/**
 * Which of the Milky Way's points each slab's pass draws (MilkyWay.tsx, "Dust, drawn as what it
 * does").
 *
 * The galaxy is drawn in DEPTH_SLICES passes, and every pass used to send every point to the GPU
 * for the vertex shader to find that most of them belong to another slab and throw them away:
 * 1.68 million vertices a frame for 280,000 points, a millisecond a pass on the GPU it was
 * measured on whether the galaxy filled the screen or was a speck. So the points are binned once
 * into cubes CUBE_PC a side, and each pass is handed, through an index buffer rebuilt when the
 * camera moves, only the cubes whose nearest and farthest points from the camera reach into its
 * slab -- with the soft edges' blend and a margin for float32 either side. The vertex shader
 * still works out every point's share of its slab as before: a point left out is one whose share
 * would have been nothing, so the picture is the one drawn before, point for point.
 */

/**
 * The cubes' side, pc. A slab is never less than 3.3 kpc deep, so a cube reaches at most two (and
 * the index has room for three). Twice as wide, a point went to 2.0 to 2.2 passes on average
 * against at most 2 at this size, from the views tested (milkyWaySlabs.test.ts).
 */
export const CUBE_PC = 1000;

/** How far past a slab's soft edge a cube still counts as reaching it, in slabs: float32's rounding and some. */
const REACH_MARGIN = 1e-3;

export interface Cubes {
  /** Each cube's first point and how many, in the reordered points. */
  readonly start: Uint32Array;
  readonly count: Uint32Array;
  /** Each cube's box about its own points, pc: min x, y, z, max x, y, z. */
  readonly box: Float64Array;
}

/**
 * The points' order binned into cubes, and the cubes: `order[i]` is the point that goes i-th.
 * Within a cube the points keep their order.
 */
export function binIntoCubes(positions: Float32Array, cubePc = CUBE_PC): { order: Uint32Array; cubes: Cubes } {
  const n = positions.length / 3;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < 3; a += 1) {
      lo[a] = Math.min(lo[a]!, positions[i * 3 + a]!);
      hi[a] = Math.max(hi[a]!, positions[i * 3 + a]!);
    }
  }
  const cells = [0, 1, 2].map((a) => Math.max(1, Math.floor((hi[a]! - lo[a]!) / cubePc) + 1));
  const key = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) {
    let k = 0;
    for (let a = 0; a < 3; a += 1) {
      const c = Math.min(cells[a]! - 1, Math.floor((positions[i * 3 + a]! - lo[a]!) / cubePc));
      k = k * cells[a]! + c;
    }
    key[i] = k;
  }
  // A counting sort by cube, stable.
  const total = cells[0]! * cells[1]! * cells[2]!;
  const first = new Uint32Array(total + 1);
  for (let i = 0; i < n; i += 1) first[key[i]! + 1]! += 1;
  for (let k = 0; k < total; k += 1) first[k + 1]! += first[k]!;
  const order = new Uint32Array(n);
  const next = first.slice(0, total);
  for (let i = 0; i < n; i += 1) order[next[key[i]!]!++] = i;
  const start: number[] = [];
  const count: number[] = [];
  const box: number[] = [];
  for (let k = 0; k < total; k += 1) {
    const from = first[k]!;
    const to = first[k + 1]!;
    if (to === from) continue;
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let j = from; j < to; j += 1) {
      const p = order[j]! * 3;
      for (let a = 0; a < 3; a += 1) {
        b[a] = Math.min(b[a]!, positions[p + a]!);
        b[a + 3] = Math.max(b[a + 3]!, positions[p + a]!);
      }
    }
    start.push(from);
    count.push(to - from);
    box.push(...b);
  }
  return { order, cubes: { start: Uint32Array.from(start), count: Uint32Array.from(count), box: Float64Array.from(box) } };
}

/** `array`, `itemSize` values a point, in `order`. */
export function reorder(array: Float32Array, itemSize: number, order: Uint32Array): Float32Array {
  const out = new Float32Array(array.length);
  for (let i = 0; i < order.length; i += 1) {
    const from = order[i]! * itemSize;
    for (let c = 0; c < itemSize; c += 1) out[i * itemSize + c] = array[from + c]!;
  }
  return out;
}

/**
 * Whether points from `nearPc` to `farPc` from the camera can have a share of slab `k`: the
 * vertex shader's share, below - above, is above nothing only past the slab's near edge less the
 * blend (but for the first slab, which runs on to the camera) and short of its far edge plus the
 * blend (but for the last, which runs on to everything).
 */
export function reaches(
  nearPc: number,
  farPc: number,
  k: number,
  nearest: number,
  step: number,
  slices: number,
  blend: number,
): boolean {
  const uNear = (nearPc - nearest) / step;
  const uFar = (farPc - nearest) / step;
  return (k === 0 || uFar > k - blend - REACH_MARGIN) && (k === slices - 1 || uNear < k + 1 + blend + REACH_MARGIN);
}

/**
 * Each slab's points as ranges of `index`: for each slab k, `ranges[2k]` its first entry and
 * `ranges[2k + 1]` how many, the points of every cube that reaches it. Returns how many entries
 * were written; if they would not fit, every slab gets every point instead (the index then the
 * points in order), as before the cubes.
 */
export function slabRanges(
  cubes: Cubes,
  camera: readonly [number, number, number],
  nearest: number,
  step: number,
  slices: number,
  blend: number,
  index: Uint32Array,
  ranges: Int32Array,
): number {
  const m = cubes.start.length;
  const near = new Float64Array(m);
  const far = new Float64Array(m);
  for (let c = 0; c < m; c += 1) {
    let n2 = 0;
    let f2 = 0;
    for (let a = 0; a < 3; a += 1) {
      const lo = cubes.box[c * 6 + a]! - camera[a]!;
      const hi = cubes.box[c * 6 + 3 + a]! - camera[a]!;
      const outside = lo > 0 ? lo : hi < 0 ? -hi : 0;
      n2 += outside * outside;
      const most = Math.max(Math.abs(lo), Math.abs(hi));
      f2 += most * most;
    }
    near[c] = Math.sqrt(n2);
    far[c] = Math.sqrt(f2);
  }
  let written = 0;
  for (let k = 0; k < slices; k += 1) {
    ranges[2 * k] = written;
    for (let c = 0; c < m; c += 1) {
      if (!reaches(near[c]!, far[c]!, k, nearest, step, slices, blend)) continue;
      const from = cubes.start[c]!;
      const count = cubes.count[c]!;
      if (written + count > index.length) {
        return everyPoint(cubes, index, ranges, slices);
      }
      for (let j = 0; j < count; j += 1) index[written + j] = from + j;
      written += count;
    }
    ranges[2 * k + 1] = written - ranges[2 * k]!;
  }
  return written;
}

/** Every point for every slab; the index must hold the points (MilkyWay.tsx sizes it for three times as many). */
function everyPoint(cubes: Cubes, index: Uint32Array, ranges: Int32Array, slices: number): number {
  const last = cubes.start.length - 1;
  const n = last < 0 ? 0 : cubes.start[last]! + cubes.count[last]!;
  for (let j = 0; j < n; j += 1) index[j] = j;
  for (let k = 0; k < slices; k += 1) {
    ranges[2 * k] = 0;
    ranges[2 * k + 1] = n;
  }
  return n;
}
