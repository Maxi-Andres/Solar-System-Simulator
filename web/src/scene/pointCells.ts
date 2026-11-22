/**
 * Points in a grid of cells, each cell knowing the largest weight among its points and the box
 * they fill, so a question of the form "which points are within weight x `reachPerWeight` of the
 * camera?" looks only at the points of cells that could hold one (Laniakea.tsx: the galaxies
 * large enough on the screen to be volumes, those of no group near enough to be a mark).
 *
 * It only narrows: every point it hands back is still to be tested exactly by the caller, as a
 * pass over all of them would have tested it, and every point it leaves out is one that test
 * would have turned down -- a cell is left out only when the nearest corner of its points' box
 * is farther than its largest weight's reach, with a margin for rounding.
 */

export interface PointCells {
  /** Cells along each axis, and the grid's corner and cell size, pc. */
  readonly size: readonly [number, number, number];
  readonly origin: readonly [number, number, number];
  readonly cellPc: number;
  /** Cell c's points are `items[start[c]]` to `items[start[c + 1]]`, ascending. */
  readonly start: Int32Array;
  readonly items: Int32Array;
  /** The points that are not a place (a coordinate not a finite number): in every answer. */
  readonly always: Int32Array;
  /** Per cell: the largest weight in it (0 for an empty cell), and its points' box, pc. */
  readonly maxWeight: Float64Array;
  readonly low: Float64Array;
  readonly high: Float64Array;
  /** The largest weight of all. */
  readonly mostWeight: number;
}

/** A cell is left out only when its box is farther than its reach by this share: rounding is far below it. */
const MARGIN = 1e-6;

/**
 * The grid over the points `indices` (all `count` if null) of `records`, x, y, z the first three
 * floats of each `stride`, each weighed by `weight`; `perAxis` cells along the longest axis of
 * their box, the others in proportion.
 */
export function pointCells(
  records: Float32Array,
  stride: number,
  indices: ArrayLike<number> | null,
  count: number,
  weight: (k: number) => number,
  perAxis = 32,
): PointCells {
  const all = indices === null ? Int32Array.from({ length: count }, (_, k) => k) : Int32Array.from(indices);
  // A point that is not a place is handed back by every question: the caller's test decides.
  const placed: number[] = [];
  const always: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < all.length; i += 1) {
    const k = all[i]!;
    const x = records[k * stride]!;
    const y = records[k * stride + 1]!;
    const z = records[k * stride + 2]!;
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      always.push(k);
      continue;
    }
    placed.push(k);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const n = placed.length;
  if (n === 0) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 1;
  }
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
  const cellPc = extent / perAxis;
  const nx = Math.max(1, Math.ceil((maxX - minX) / cellPc));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cellPc));
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cellPc));
  const cells = nx * ny * nz;
  const cellOf = new Int32Array(n);
  const start = new Int32Array(cells + 1);
  for (let i = 0; i < n; i += 1) {
    const o = placed[i]! * stride;
    const cx = Math.min(nx - 1, Math.max(0, Math.floor((records[o]! - minX) / cellPc)));
    const cy = Math.min(ny - 1, Math.max(0, Math.floor((records[o + 1]! - minY) / cellPc)));
    const cz = Math.min(nz - 1, Math.max(0, Math.floor((records[o + 2]! - minZ) / cellPc)));
    const c = (cz * ny + cy) * nx + cx;
    cellOf[i] = c;
    start[c + 1] = start[c + 1]! + 1;
  }
  for (let c = 0; c < cells; c += 1) start[c + 1] = start[c + 1]! + start[c]!;
  const items = new Int32Array(n);
  const fill = start.slice(0, cells);
  const maxWeight = new Float64Array(cells);
  const low = new Float64Array(cells * 3).fill(Infinity);
  const high = new Float64Array(cells * 3).fill(-Infinity);
  let mostWeight = 0;
  // In the order given, so a cell's points stay ascending where `indices` is.
  for (let i = 0; i < n; i += 1) {
    const c = cellOf[i]!;
    const k = placed[i]!;
    items[fill[c]!] = k;
    fill[c] = fill[c]! + 1;
    const w = weight(k);
    // A weight that is not a number reaches no one; one that is infinite, everyone.
    if (w > maxWeight[c]!) maxWeight[c] = w;
    if (w > mostWeight) mostWeight = w;
    const o = k * stride;
    for (let axis = 0; axis < 3; axis += 1) {
      const v = records[o + axis]!;
      if (v < low[c * 3 + axis]!) low[c * 3 + axis] = v;
      if (v > high[c * 3 + axis]!) high[c * 3 + axis] = v;
    }
  }
  for (const k of always) {
    if (weight(k) > mostWeight) mostWeight = weight(k);
  }
  return {
    size: [nx, ny, nz],
    origin: [minX, minY, minZ],
    cellPc,
    start,
    items,
    always: Int32Array.from(always),
    maxWeight,
    low,
    high,
    mostWeight,
  };
}

/**
 * The points that could be within weight x `reachPerWeight` of `camera` (pc), into `out` from 0:
 * returns how many. Ascending within each cell, not overall. A reach that is not a positive
 * finite number, or a camera that is not a place, narrows nothing: every point.
 */
export function cellCandidates(
  grid: PointCells,
  camera: readonly [number, number, number],
  reachPerWeight: number,
  out: Int32Array,
): number {
  const { size, origin, cellPc, start, items, always, maxWeight, low, high } = grid;
  if (
    !(reachPerWeight > 0 && Number.isFinite(reachPerWeight)) ||
    !Number.isFinite(grid.mostWeight) ||
    !(Number.isFinite(camera[0]) && Number.isFinite(camera[1]) && Number.isFinite(camera[2]))
  ) {
    out.set(items);
    out.set(always, items.length);
    return items.length + always.length;
  }
  // The cells within the largest reach of all, along each axis.
  const reach = grid.mostWeight * reachPerWeight * (1 + MARGIN);
  const from = [0, 0, 0];
  const to = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    from[axis] = Math.max(0, Math.floor((camera[axis]! - reach - origin[axis]!) / cellPc) - 1);
    to[axis] = Math.min(size[axis]! - 1, Math.floor((camera[axis]! + reach - origin[axis]!) / cellPc) + 1);
  }
  out.set(always);
  let n = always.length;
  for (let cz = from[2]!; cz <= to[2]!; cz += 1) {
    for (let cy = from[1]!; cy <= to[1]!; cy += 1) {
      for (let cx = from[0]!; cx <= to[0]!; cx += 1) {
        const c = (cz * size[1] + cy) * size[0] + cx;
        const first = start[c]!;
        const last = start[c + 1]!;
        if (first === last) continue;
        // The nearest point of its points' box.
        let d2 = 0;
        for (let axis = 0; axis < 3; axis += 1) {
          const v = camera[axis]!;
          const a = low[c * 3 + axis]!;
          const b = high[c * 3 + axis]!;
          const gap = v < a ? a - v : v > b ? v - b : 0;
          d2 += gap * gap;
        }
        const cellReach = maxWeight[c]! * reachPerWeight * (1 + MARGIN);
        if (d2 > cellReach * cellReach) continue;
        for (let i = first; i < last; i += 1) out[n++] = items[i]!;
      }
    }
  }
  return n;
}
