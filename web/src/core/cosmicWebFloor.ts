import { COSMIC_WEB_POSITION_UNIT_PC } from '@sss/tools/types';

/**
 * The faint dot of each of the cosmic web's galaxies, weighted by its neighbours, as Laniakea's
 * are (scene/Laniakea.tsx floorWeights): whole with FLOOR_FULL_AT others within its reach,
 * FLOOR_LEAST of it alone -- a map aid, not its light, which is never touched.
 *
 * ## Its reach, by its survey's density there
 *
 * Laniakea's reach is a fixed 4 Mpc. Here that would say nothing: BOSS chose a few luminous
 * galaxies per hundred, 20 Mpc apart on average, so at 4 Mpc nearly every one is alone and the
 * far map would be an even, faint dust; and the SDSS main sample is complete for bright galaxies
 * near and holds only the most luminous at z 0.2, a hundred times thinner. So each galaxy's
 * reach is where its own survey, at its distance, would put FLOOR_MEAN_NEIGHBOURS others on
 * average:
 *
 *     (4/3) pi R^3 n(r) = FLOOR_MEAN_NEIGHBOURS
 *
 * n(r) the survey's galaxies drawn so far per Mpc^3 at that distance -- counted in shells of
 * SHELL_PC over its footprint's share of the sky, smoothed over SHELL_SMOOTH shells -- and R kept
 * between REACH_LEAST_PC (Laniakea's own) and REACH_MOST_PC. A galaxy then counts how much
 * denser than its survey's mean its neighbourhood is: at the mean its dot is 36% of whole, in a
 * group or along a filament (four times the mean) whole, in a void 15%. Only its own survey's
 * galaxies are counted: the two differ a hundredfold in density where both are.
 *
 * Worked out in a worker (cosmicWebFloor.worker.ts) for every galaxy drawn, again as each chunk
 * lands -- the chunks are a luminosity cut, so with more of them n(r) and the reaches change.
 * Galaxies of like reach share a grid of cells about that size, sorted cell by cell (a radix
 * sort on the cells' three indices); swept in that order, the nine rows of three cells about a
 * galaxy's own are each found by a pointer that only moves forward, and read in the order they
 * lie in memory. A hash of the cells took ten seconds for 1.8 million galaxies, nearly all of it
 * waiting on memory.
 */

/** As Laniakea's (scene/Laniakea.tsx FLOOR_FULL_AT, FLOOR_LEAST, FLOOR_REACH_PC): a test holds them equal. */
export const FLOOR_FULL_AT = 8;
export const FLOOR_LEAST = 0.15;
export const REACH_LEAST_PC = 4e6;
export const REACH_MOST_PC = 32e6;
/** Neighbours within a galaxy's reach at its survey's mean density. */
export const FLOOR_MEAN_NEIGHBOURS = 2;
/** The shells a survey's density is counted in, pc, and how many either side are averaged. */
export const SHELL_PC = 20e6;
export const SHELL_SMOOTH = 2;

/** What the worker is given: the galaxies drawn, the survey of each, and each survey's share of the sky. */
export interface FloorRequest {
  readonly id: number;
  /** x, y, z a galaxy, COSMIC_WEB_POSITION_UNIT_PC. */
  readonly positions: Int16Array;
  /** 0 the SDSS main sample, 1 BOSS. */
  readonly surveys: Uint8Array;
  /** Each survey's footprint over the whole sky. */
  readonly skyShare: readonly number[];
}

export interface FloorAnswer {
  readonly id: number;
  /** Each galaxy's dot, 0-255 for 0-1. */
  readonly weights: Uint8Array;
  /** The median distance from the Sun of the galaxies, pc (crowding.ts halfCountRadiusPc). */
  readonly halfCountPc: number;
}

/** Each galaxy's reach, pc, from its survey's density at its distance (see the header). */
export function floorReaches(distancesPc: Float32Array, surveys: Uint8Array, skyShare: readonly number[]): Float32Array {
  const count = distancesPc.length;
  let farthest = 0;
  for (let i = 0; i < count; i += 1) farthest = Math.max(farthest, distancesPc[i]!);
  const shells = Math.floor(farthest / SHELL_PC) + 1;
  const kinds = skyShare.length;
  const counts = new Float64Array(kinds * shells);
  for (let i = 0; i < count; i += 1) counts[surveys[i]! * shells + Math.floor(distancesPc[i]! / SHELL_PC)]! += 1;
  const reachOf = new Float64Array(kinds * shells);
  for (let s = 0; s < kinds; s += 1) {
    for (let k = 0; k < shells; k += 1) {
      let n = 0;
      let volume = 0;
      for (let j = Math.max(0, k - SHELL_SMOOTH); j <= Math.min(shells - 1, k + SHELL_SMOOTH); j += 1) {
        n += counts[s * shells + j]!;
        volume += ((4 / 3) * Math.PI * (((j + 1) * SHELL_PC) ** 3 - (j * SHELL_PC) ** 3) * skyShare[s]!);
      }
      const density = n / volume;
      const reach = density > 0 ? Math.cbrt(FLOOR_MEAN_NEIGHBOURS / ((4 / 3) * Math.PI * density)) : REACH_MOST_PC;
      reachOf[s * shells + k] = Math.min(REACH_MOST_PC, Math.max(REACH_LEAST_PC, reach));
    }
  }
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) out[i] = reachOf[surveys[i]! * shells + Math.floor(distancesPc[i]! / SHELL_PC)]!;
  return out;
}

/** Galaxies `members` sorted by the cell of `cellPc` they are in, x fastest then y then z (an LSD radix sort, stable). */
function sortByCell(
  members: Uint32Array,
  x: Float32Array,
  y: Float32Array,
  z: Float32Array,
  cellPc: number,
): { order: Uint32Array; keys: Float64Array; span: number } {
  const n = members.length;
  const ci = new Int32Array(n);
  const cj = new Int32Array(n);
  const ck = new Int32Array(n);
  let lo = Infinity;
  let hi = -Infinity;
  for (let m = 0; m < n; m += 1) {
    const g = members[m]!;
    ci[m] = Math.floor(x[g]! / cellPc);
    cj[m] = Math.floor(y[g]! / cellPc);
    ck[m] = Math.floor(z[g]! / cellPc);
    lo = Math.min(lo, ci[m]!, cj[m]!, ck[m]!);
    hi = Math.max(hi, ci[m]!, cj[m]!, ck[m]!);
  }
  // Indices from 1, so a neighbour's (one less) is never below 0; the span leaves one more at the top.
  const span = n === 0 ? 3 : hi - lo + 3;
  let order = new Uint32Array(n);
  for (let m = 0; m < n; m += 1) order[m] = m;
  let next = new Uint32Array(n);
  const counts = new Uint32Array(span + 1);
  for (const digit of [ci, cj, ck]) {
    counts.fill(0);
    for (let m = 0; m < n; m += 1) counts[digit[m]! - lo + 1]! += 1;
    let sum = 0;
    for (let d = 0; d <= span; d += 1) {
      const c = counts[d]!;
      counts[d] = sum;
      sum += c;
    }
    for (let m = 0; m < n; m += 1) {
      const o = order[m]!;
      const d = digit[o]! - lo + 1;
      next[counts[d]!] = o;
      counts[d]! += 1;
    }
    [order, next] = [next, order];
  }
  const keys = new Float64Array(n);
  const sorted = new Uint32Array(n);
  for (let m = 0; m < n; m += 1) {
    const o = order[m]!;
    keys[m] = ((ck[o]! - lo + 1) * span + (cj[o]! - lo + 1)) * span + (ci[o]! - lo + 1);
    sorted[m] = members[o]!;
  }
  return { order: sorted, keys, span };
}

/**
 * How many of `members` lie within its reach of each of them that `asks` -- at most
 * FLOOR_FULL_AT -- with cells of `cellPc`, at least the largest reach asked: what is within reach
 * is in the 27 cells about a galaxy's own.
 */
function neighbourCounts(
  members: Uint32Array,
  asks: (g: number) => boolean,
  reach: Float32Array,
  x: Float32Array,
  y: Float32Array,
  z: Float32Array,
  cellPc: number,
  out: Uint8Array,
): void {
  const { order, keys, span } = sortByCell(members, x, y, z, cellPc);
  const n = order.length;
  // Positions in the sorted order: read as they lie.
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const sz = new Float32Array(n);
  for (let m = 0; m < n; m += 1) {
    sx[m] = x[order[m]!]!;
    sy[m] = y[order[m]!]!;
    sz[m] = z[order[m]!]!;
  }
  // The nine rows (dy, dz) of three cells about a cell: each row's first key, relative to the cell's.
  const rows: number[] = [];
  for (let dz = -1; dz <= 1; dz += 1) for (let dy = -1; dy <= 1; dy += 1) rows.push((dz * span + dy) * span - 1);
  const pointer = new Int32Array(9);
  for (let m = 0; m < n; m += 1) {
    const g = order[m]!;
    if (!asks(g)) continue;
    const key = keys[m]!;
    const r2 = reach[g]! * reach[g]!;
    const gx = sx[m]!;
    const gy = sy[m]!;
    const gz = sz[m]!;
    let found = 0;
    for (let row = 0; row < 9 && found < FLOOR_FULL_AT; row += 1) {
      const from = key + rows[row]!;
      let p = pointer[row]!;
      while (p < n && keys[p]! < from) p += 1;
      pointer[row] = p;
      const to = from + 2;
      for (let q = p; q < n && keys[q]! <= to; q += 1) {
        if (q === m) continue;
        const dx = sx[q]! - gx;
        const dy = sy[q]! - gy;
        const dz = sz[q]! - gz;
        if (dx * dx + dy * dy + dz * dz < r2 && (found += 1) >= FLOOR_FULL_AT) break;
      }
    }
    out[g] = found;
  }
}

/** The dots, a byte each, and the galaxies' median distance (see FloorAnswer). */
export function cosmicWebFloor(request: Omit<FloorRequest, 'id'>): Omit<FloorAnswer, 'id'> {
  const { positions, surveys, skyShare } = request;
  const count = surveys.length;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const distance = new Float32Array(count);
  for (let g = 0; g < count; g += 1) {
    x[g] = positions[g * 3]! * COSMIC_WEB_POSITION_UNIT_PC;
    y[g] = positions[g * 3 + 1]! * COSMIC_WEB_POSITION_UNIT_PC;
    z[g] = positions[g * 3 + 2]! * COSMIC_WEB_POSITION_UNIT_PC;
    distance[g] = Math.hypot(x[g]!, y[g]!, z[g]!);
  }
  const reach = floorReaches(distance, surveys, skyShare);
  // Galaxies of like reach together: cells of REACH_LEAST_PC times a power of 2^(1/4), the smallest
  // at least a galaxy's reach, so its 27 cells hold a few dozen galaxies at its survey's mean
  // density, not hundreds. A grid holds only the galaxies near enough to be anyone's neighbour.
  const levelOf = (r: number) => Math.max(0, Math.ceil(4 * Math.log2(r / REACH_LEAST_PC) - 1e-6));
  const levels = new Uint8Array(count);
  for (let g = 0; g < count; g += 1) levels[g] = levelOf(reach[g]!);
  const found = new Uint8Array(count);
  for (let s = 0; s < skyShare.length; s += 1) {
    const ofSurvey: number[] = [];
    for (let g = 0; g < count; g += 1) if (surveys[g] === s) ofSurvey.push(g);
    const used = new Map<number, { near: number; far: number }>();
    for (const g of ofSurvey) {
      const range = used.get(levels[g]!);
      if (range === undefined) used.set(levels[g]!, { near: distance[g]!, far: distance[g]! });
      else {
        range.near = Math.min(range.near, distance[g]!);
        range.far = Math.max(range.far, distance[g]!);
      }
    }
    for (const [level, { near, far }] of used) {
      const cellPc = REACH_LEAST_PC * 2 ** (level / 4);
      const members = Uint32Array.from(ofSurvey.filter((g) => distance[g]! > near - cellPc && distance[g]! < far + cellPc));
      neighbourCounts(members, (g) => levels[g] === level, reach, x, y, z, cellPc, found);
    }
  }
  const weights = new Uint8Array(count);
  for (let g = 0; g < count; g += 1) {
    weights[g] = Math.round(255 * (FLOOR_LEAST + (1 - FLOOR_LEAST) * Math.min(1, found[g]! / FLOOR_FULL_AT)));
  }
  const sorted = distance.slice().sort();
  return { weights, halfCountPc: count === 0 ? 0 : sorted[count >> 1]! };
}
