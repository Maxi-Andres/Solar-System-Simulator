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
  extra = 0,
): boolean {
  return reachesInSlabs((nearPc - nearest) / step, (farPc - nearest) / step, k, slices, blend, extra);
}

/** `reaches`, the distances already in slabs from the first slab's near edge. */
function reachesInSlabs(uNear: number, uFar: number, k: number, slices: number, blend: number, extra: number): boolean {
  const margin = REACH_MARGIN + extra;
  return (k === 0 || uFar > k - blend - margin) && (k === slices - 1 || uNear < k + 1 + blend + margin);
}

/**
 * With a record of what reached (slabRanges' `reach`), a cube is handed to a slab it comes
 * within FILL_EXTRA slabs of, and kept there until it is DROP_EXTRA away: the index is a
 * superset of what the shader needs, so the picture is the same, and it is rewritten only when
 * a cube that does reach is missing from it or one far out is still in it -- not each time
 * the camera's turn carries some cube of thousands across an edge. A slab is 3.3 kpc deep at
 * the least, so a tenth of one hands a pass a few more cubes than it needs.
 */
const FILL_EXTRA = 0.1;
const DROP_EXTRA = 0.3;
/** Drift (driftSinceWritten) under which the record holds without a look: half of FILL_EXTRA. */
const SURE_DRIFT = FILL_EXTRA / 2;

/** What slabRanges returns when `reach` shows nothing changed: index and ranges are as they were. */
export const SLABS_UNCHANGED = -1;

/**
 * What slabRanges handed each cube when it last wrote the index (`spans`, each cube's first
 * and last slab), and the last place it found them still serving (`at`): the camera, the first
 * slab's near edge and the slabs' depth, the widest |distance in slabs| of any cube, and how far
 * in slabs every cube's distances could move from there before the spans stopped serving.
 */
export interface SlabReach {
  readonly spans: Uint8Array;
  readonly at: Float64Array;
  /** Whether `spans` were written: false until the first write. */
  written: boolean;
}

/** A record for slabRanges' `record`, nothing handed yet. */
export function slabReach(cubes: Cubes): SlabReach {
  return { spans: new Uint8Array(cubes.start.length * 2).fill(NOTHING_HANDED), at: new Float64Array(7), written: false };
}

/**
 * How far, in slabs, any cube's distance may have moved since the place in the record, at most:
 * a distance to a box moves no more than the camera, the slabs' start moves by its own change,
 * and a distance of u slabs is u times the change in the slab's depth.
 */
function driftSinceWritten(reach: SlabReach, camera: readonly [number, number, number], nearest: number, step: number): number {
  const at = reach.at;
  const moved = Math.hypot(camera[0] - at[0]!, camera[1] - at[1]!, camera[2] - at[2]!);
  return at[5]! * Math.abs(at[4]! / step - 1) + (moved + Math.abs(nearest - at[3]!)) / step;
}

/** A cube's span in a record before anything was handed: no span holds a reaching cube. */
const NOTHING_HANDED = 255;

/** 0, 1, 2, ...: copied from, a cube's run of the index is one memory copy. */
let counting = new Uint32Array(0);
let near = new Float64Array(0);
let far = new Float64Array(0);

/**
 * The slabs a cube reaches, as `reachesInSlabs` decides each, first and last into `span`: the
 * first condition holds for every slab up to a last, the second for every slab from a first,
 * so they are a run, found without asking slab by slab.
 */
export function slabSpan(uNear: number, uFar: number, slices: number, blend: number, extra: number, span: Int32Array): void {
  const margin = REACH_MARGIN + extra;
  // k < uFar + blend + margin, or k the first; k > uNear - 1 - blend - margin, or k the last.
  span[0] = Math.min(slices - 1, Math.max(0, Math.floor(uNear - 1 - blend - margin) + 1));
  span[1] = Math.max(0, Math.min(slices - 1, Math.ceil(uFar + blend + margin) - 1));
}

const fillSpan = new Int32Array(2);

/**
 * Each slab's points as ranges of `index`: for each slab k, `ranges[2k]` its first entry and
 * `ranges[2k + 1]` how many, the points of every cube that reaches it. Returns how many entries
 * were written; if they would not fit, every slab gets every point instead (the index then the
 * points in order), as before the cubes.
 *
 * `record`, if given (slabReach), holds the slabs each cube was handed the last time, its first
 * and last, with the margins of FILL_EXTRA. While that still holds every slab each cube
 * reaches and none it is DROP_EXTRA short of, nothing is written and
 * SLABS_UNCHANGED is returned: the index and the ranges from then serve this place too.
 * Rewritten and uploaded every frame the camera turned, the same half a million entries were
 * a millisecond and a half of the main thread at the Milky Way's view.
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
  record?: SlabReach,
): number {
  const m = cubes.start.length;
  if (near.length < m) {
    near = new Float64Array(m);
    far = new Float64Array(m);
  }
  // Moved so little since the record was written that no cube can have come within reach of a
  // slab it was not handed (FILL_EXTRA away then) or gone out of all reach of one it was: the
  // index serves as it is, with no cube looked at.
  if (record?.written === true && driftSinceWritten(record, camera, nearest, step) < record.at[6]!) {
    return SLABS_UNCHANGED;
  }
  const reach = record?.spans;
  const box = cubes.box;
  const [cx, cy, cz] = camera;
  // The spans' edges as slabSpan works them out, less the first and last slabs' clamps.
  const lastSlab = slices - 1;
  const strictBelow = 1 + blend + REACH_MARGIN;
  const strictAbove = blend + REACH_MARGIN;
  const dropBelow = strictBelow + DROP_EXTRA;
  const dropAbove = strictAbove + DROP_EXTRA;
  let holds = reach !== undefined;
  let widest = 0;
  let slack = Infinity;
  for (let c = 0; c < m; c += 1) {
    const b = c * 6;
    // Each axis: how far outside the box the camera is, and the farthest the box reaches.
    const lx = box[b]! - cx;
    const hx = box[b + 3]! - cx;
    const ly = box[b + 1]! - cy;
    const hy = box[b + 4]! - cy;
    const lz = box[b + 2]! - cz;
    const hz = box[b + 5]! - cz;
    const ox = lx > 0 ? lx : hx < 0 ? -hx : 0;
    const oy = ly > 0 ? ly : hy < 0 ? -hy : 0;
    const oz = lz > 0 ? lz : hz < 0 ? -hz : 0;
    const fx = Math.max(Math.abs(lx), Math.abs(hx));
    const fy = Math.max(Math.abs(ly), Math.abs(hy));
    const fz = Math.max(Math.abs(lz), Math.abs(hz));
    // In slabs from the first one's near edge, as `reaches` works them out.
    const uNear = (Math.sqrt(ox * ox + oy * oy + oz * oz) - nearest) / step;
    const uFar = (Math.sqrt(fx * fx + fy * fy + fz * fz) - nearest) / step;
    near[c] = uNear;
    far[c] = uFar;
    widest = Math.max(widest, Math.abs(uNear), Math.abs(uFar));
    if (holds) {
      // What was handed must hold every slab the cube reaches, and none it is DROP_EXTRA short of.
      const first = reach![2 * c]!;
      const last = reach![2 * c + 1]!;
      const needFirst = Math.min(lastSlab, Math.max(0, Math.floor(uNear - strictBelow) + 1));
      const needLast = Math.max(0, Math.min(lastSlab, Math.ceil(uFar + strictAbove) - 1));
      const mayFirst = Math.min(lastSlab, Math.max(0, Math.floor(uNear - dropBelow) + 1));
      const mayLast = Math.max(0, Math.min(lastSlab, Math.ceil(uFar + dropAbove) - 1));
      holds = first !== NOTHING_HANDED && first <= needFirst && last >= needLast && first >= mayFirst && last <= mayLast;
      // And how much farther this cube's distances may move before it would not.
      if (first > 0) slack = Math.min(slack, uNear - (first - 1 + strictBelow));
      if (last < lastSlab) slack = Math.min(slack, last + 1 - strictAbove - uFar);
      if (first < lastSlab) slack = Math.min(slack, first + dropBelow - uNear);
      if (last > 0) slack = Math.min(slack, uFar + dropAbove - last);
    }
  }
  if (record !== undefined && reach !== undefined) {
    if (holds) {
      // Still serving from here, with `slack` to spare: the next frames measure from here.
      record.at.set([camera[0], camera[1], camera[2], nearest, step, widest, slack]);
      return SLABS_UNCHANGED;
    }
    for (let c = 0; c < m; c += 1) {
      slabSpan(near[c]!, far[c]!, slices, blend, FILL_EXTRA, fillSpan);
      reach[2 * c] = fillSpan[0]!;
      reach[2 * c + 1] = fillSpan[1]!;
    }
    // Handed FILL_EXTRA wide, every cube has at least that before a slab it reaches is missed.
    record.at.set([camera[0], camera[1], camera[2], nearest, step, widest, SURE_DRIFT]);
    record.written = true;
  }
  const points = m === 0 ? 0 : cubes.start[m - 1]! + cubes.count[m - 1]!;
  if (counting.length < points) {
    counting = new Uint32Array(points);
    for (let j = 0; j < points; j += 1) counting[j] = j;
  }
  let written = 0;
  for (let k = 0; k < slices; k += 1) {
    ranges[2 * k] = written;
    for (let c = 0; c < m; c += 1) {
      if (reach !== undefined ? k < reach[2 * c]! || k > reach[2 * c + 1]! : !reachesInSlabs(near[c]!, far[c]!, k, slices, blend, 0)) continue;
      const from = cubes.start[c]!;
      const count = cubes.count[c]!;
      if (written + count > index.length) {
        // Forget what reached: the next call, whatever reaches, writes the index again.
        if (record !== undefined) {
          record.spans.fill(NOTHING_HANDED);
          record.written = false;
        }
        return everyPoint(cubes, index, ranges, slices);
      }
      index.set(counting.subarray(from, from + count), written);
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
