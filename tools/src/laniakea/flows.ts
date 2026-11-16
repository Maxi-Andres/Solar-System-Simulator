import { readHeader } from '../localGroup/nearbyGalaxies.ts';
import type { Vec3 } from './frames.ts';

/**
 * Where the galaxies go: the streamlines of the Cosmicflows-4 velocity field, traced here and
 * written as flows.bin.
 *
 * ## What is published, and what it is
 *
 * Courtois et al. 2023 (A&A 670, L15) fit the Cosmicflows-4 distances with a Hamiltonian Monte
 * Carlo model of the linear density field and the velocity it drives, and published both:
 *
 * - **128^3 on Zenodo** (H. Courtois, doi 10.5281/zenodo.20653238, CC BY 4.0): the CF4
 *   galaxies' reconstruction, CF4_new_128-z008_delta.fits (density.bin's) and
 *   CF4_new_128-z008_velocity.fits -- a FITS image of NAXIS 4, 128 x 128 x 128 x 3, float32.
 *   That is the field traced here: the one whose watersheds Dupuy & Courtois drew Laniakea's
 *   basin from (watersheds.ts).
 * - **64^3 on the CosmicFlows project page** (https://projets.ip2i.in2p3.fr/cosmicflows/): the
 *   same for the galaxies (CF4_new_64-z008_velocity.fits, the fallback here) and for the groups
 *   (CF4gp_), each with an error cube, CF4_new_64-z008_velocity_cube_error.fits: one number a
 *   voxel, the scatter of the velocity over the HMC's samples. The groups' field is published at
 *   64^3 only, and is not traced: the lines are the galaxies' reconstruction's, and are tagged by
 *   its own basins.
 *
 * **Units.** The page says to multiply the velocities and their errors by 52 to have km/s; the
 * Zenodo cube is in the same units -- at the same places its values follow the 64^3's (rms ratio
 * 1.01, correlation 0.83 sampled at the coarser grid's voxels). Times 52, the Milky Way's voxel
 * moves at 460 km/s, the reconstruction's own motion smoothed over 7.8 Mpc/h.
 *
 * **Axes.** The page gives the grids as (SGZ, SGY, SGX), and the density's and the velocity's
 * are stored with NAXIS1 = SGZ -- the other way about from the watersheds' (watersheds.ts),
 * whose NAXIS1 is SGX -- and the three planes of NAXIS4 in the order SGX, SGY, SGZ. Found by
 * the data, not assumed:
 *
 * - read so, 97.8% of the lines that reach an attractor end in the basin Dupuy & Courtois's
 *   watersheds give their start (`agreement`), and the Milky Way's line ends in Laniakea; read
 *   with NAXIS1 = SGX, half do, and the Milky Way's ends in Perseus-Pisces;
 * - the density at Dupuy & Courtois's attractors is then +1.5 (Laniakea's), +3.0 (Hercules),
 *   +2.4 (Shapley), and at their repellers -1.3, -2.8 and -0.5; the other way +0.1, -0.2, +0.5
 *   and +0.4, -0.3, -0.3;
 * - in linear theory -- which is what the fit is -- the divergence of the velocity is minus H f
 *   times the overdensity, and of the six orders of the planes only this one gives it, a
 *   correlation of -0.9998 with the published delta; the next best -0.57 (checkVelocityAxes,
 *   run on every build with the agreement).
 *
 * The density.bin of G3's first build was read with NAXIS1 = SGX, transposed; it is read here
 * the right way about (fetchLaniakea.ts readDensity). The error cube, the same family as the
 * 64^3 velocity, is read as they are: its correlation with where Cosmicflows-4 has galaxies is
 * the stronger that way in every shell from 50 to 170 Mpc/h.
 *
 * ## The lines
 *
 * A streamline is the curve everywhere along the velocity: where a galaxy at its start would
 * be carried if the field stood still. It is not a galaxy's path -- the field is today's, and
 * at a few hundred km/s a galaxy moves 1 Mpc in 3 billion years, a few Mpc since the Big Bang
 * -- but it is how Laniakea is drawn: its basin is every voxel whose streamline ends at its
 * attractor (Tully et al. 2014; Dupuy & Courtois 2023).
 *
 * - **Traced** by fourth-order Runge-Kutta through the field interpolated trilinearly between
 *   voxels, in steps of STEP_VOXELS along the velocity's direction, slowing below SOFT_KMS so
 *   a line comes to rest at an attractor -- where the velocity vanishes -- rather than circling
 *   it. A line ends at an attractor (its speed under SINK_KMS, or no farther on in SETTLE_STEPS
 *   steps), at the grid's edge, or where the field stops being constrained.
 * - **Seeded** on a lattice every SEED_SPACING voxels, each point moved within its cell by a
 *   fixed draw, wherever the field is constrained (below); taken with a chance that grows with
 *   the overdensity, so the lines start where the galaxies are -- (1 + delta) / 2, at least
 *   SEED_LEAST.
 * - **Chosen**, a few to a basin: traced in full, longest first -- those from its far edges,
 *   which run the whole way in -- each taken if it starts more than START_SEPARATION_VOXELS
 *   from every line taken, until its basin has its LINES_PER_BASIN (more for Laniakea's), and
 *   kept until it comes within JOIN_VOXELS of a line already kept, where it joins it: a few
 *   dozen lines, tributaries into rivers into each attractor, as Tully et al. 2014 drew
 *   Laniakea's, and not a thousand on top of one another. Spaced as
 * - **Spaced**: a line dropped if it starts within SEPARATION_VOXELS of
 *   one (Jobard & Lefer 1997, "Creating evenly-spaced streamlines of arbitrary density"). The
 *   lines draw a drainage network, tributaries into rivers into the attractor, and not a
 *   thousand lines on top of one another.
 * - **Tagged** by the basin each ends in: its whole streamline followed to its end, joined or
 *   not, and the basin of the galaxies' watershed grid there (watersheds.ts, the kept basins;
 *   0 for none). That this tracer reproduces Dupuy & Courtois's watersheds is checked on every
 *   build: the share of the seeds whose line ends in the basin their own voxel is in
 *   (`agreement`, 0.9 or more expected; less only along basins' edges).
 *
 * ## Where the data stop
 *
 * Past 150 or so Mpc/h the distances thin and the fit returns to its prior, the cosmic mean:
 * a velocity there is the model's guess. Each vertex carries how constrained the field is
 * there, from the error cube: whole where its error is under FULL_BELOW_KMS, nothing where it
 * is over GONE_ABOVE_KMS -- about 17 km/s at the Milky Way, 100 to 150 at 125 Mpc/h, 200 past
 * 190 -- and a line is cut where it reaches nothing. The web fades each line by it.
 */

// ---------------------------------------------------------------------------------------
// The grids

/** The published velocity's unit, km/s (the CosmicFlows page: "multiply by 52"). */
export const VELOCITY_UNIT_KMS = 52;

/** Which plane of NAXIS4 holds each supergalactic component (see the header: found by checkVelocityAxes). */
export const VELOCITY_PLANES = { x: 0, y: 1, z: 2 } as const;

/** A field of 3-vectors on an N^3 grid centred on the Milky Way's voxel N/2, x (SGX) fastest, km/s. */
export interface VectorField {
  readonly size: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
}

/** A scalar on an N^3 grid as watersheds.ts readFitsCube gives it. */
export interface ScalarCube {
  readonly size: number;
  readonly values: ArrayLike<number>;
}

/**
 * An N^3 cube with its first and third axes swapped: a Cosmicflows-4 density or velocity grid,
 * NAXIS1 = SGZ, made SGX fastest as the watersheds' and the scene's grids are (see the header).
 */
export function transposeCube<T extends Float32Array | Float64Array>(values: T, n: number): T {
  const out = new (values.constructor as { new (length: number): T })(values.length);
  for (let k = 0; k < n; k += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        out[i + n * (j + n * k)] = values[k + n * (j + n * i)]!;
      }
    }
  }
  return out;
}

/**
 * A FITS primary image of N^3 x 3 (NAXIS4 = 3: the components, slowest) as a vector field,
 * each plane assigned by `planes`, times `unit`, and transposed SGX fastest (transposeCube).
 */
export function readFitsVectorCube(bytes: Uint8Array, unit = VELOCITY_UNIT_KMS, planes: { x: number; y: number; z: number } = VELOCITY_PLANES): VectorField {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 9));
  if (head !== 'SIMPLE  =') {
    throw new Error('Not a FITS file: it does not start with SIMPLE.');
  }
  const { cards, dataAt } = readHeader(bytes, 0);
  const size = Number(cards.get('NAXIS1'));
  if (
    Number(cards.get('NAXIS')) !== 4 ||
    Number(cards.get('NAXIS2')) !== size ||
    Number(cards.get('NAXIS3')) !== size ||
    Number(cards.get('NAXIS4')) !== 3
  ) {
    throw new Error(
      `Expected a velocity cube of N^3 x 3; the FITS image has NAXIS ${cards.get('NAXIS')} (${cards.get('NAXIS1')}, ${cards.get('NAXIS2')}, ${cards.get('NAXIS3')}, ${cards.get('NAXIS4')}).`,
    );
  }
  const bitpix = Number(cards.get('BITPIX'));
  if (bitpix !== -32 && bitpix !== -64) {
    throw new Error(`A velocity cube of BITPIX ${bitpix} is not read here.`);
  }
  const width = -bitpix / 8;
  const count = size ** 3;
  if (dataAt + 3 * count * width > bytes.length) {
    throw new Error(`The velocity cube is cut short: ${bytes.length} bytes, where ${dataAt + 3 * count * width} are needed.`);
  }
  const scale = Number(cards.get('BSCALE') ?? 1) * unit;
  const zero = Number(cards.get('BZERO') ?? 0) * unit;
  const view = new DataView(bytes.buffer, bytes.byteOffset + dataAt, 3 * count * width);
  const plane = (p: number): Float32Array => {
    const out = new Float32Array(count);
    for (let at = 0; at < count; at += 1) {
      const raw = width === 4 ? view.getFloat32((p * count + at) * 4) : view.getFloat64((p * count + at) * 8);
      if (!Number.isFinite(raw)) {
        throw new Error(`The velocity cube holds ${raw} at plane ${p}, voxel ${at}.`);
      }
      out[at] = raw * scale + zero;
    }
    return transposeCube(out, size);
  };
  return { size, x: plane(planes.x), y: plane(planes.y), z: plane(planes.z) };
}

/** The checks a build must pass: the divergence's correlation with the density under this; the watersheds' agreement over this. */
export const FLOW_AXES_MOST = -0.9;
export const FLOW_AGREEMENT_LEAST = 0.9;

/** A position in one N-grid's voxels as the same place in an M-grid's: both centred on the Milky Way's voxel. */
export function regrid(p: number, from: number, to: number): number {
  return (p - from / 2) * (to / from) + to / 2;
}

/**
 * The correlation of the field's divergence with the overdensity, over the grid's inside: in
 * linear theory -1 exactly (div v = -H f delta). The check on the planes' order.
 */
export function checkVelocityAxes(field: VectorField, density: ScalarCube): number {
  const n = field.size;
  const m = density.size;
  const at = (i: number, j: number, k: number) => i + n * (j + n * k);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let k = 1; k < n - 1; k += 1) {
    for (let j = 1; j < n - 1; j += 1) {
      for (let i = 1; i < n - 1; i += 1) {
        const div =
          field.x[at(i + 1, j, k)]! - field.x[at(i - 1, j, k)]! +
          (field.y[at(i, j + 1, k)]! - field.y[at(i, j - 1, k)]!) +
          (field.z[at(i, j, k + 1)]! - field.z[at(i, j, k - 1)]!);
        const di = Math.round(regrid(i, n, m));
        const dj = Math.round(regrid(j, n, m));
        const dk = Math.round(regrid(k, n, m));
        if (di < 0 || dj < 0 || dk < 0 || di >= m || dj >= m || dk >= m) continue;
        const d = Number(density.values[di + m * (dj + m * dk)]);
        sxy += div * d;
        sxx += div * div;
        syy += d * d;
        sx += div;
        sy += d;
        count += 1;
      }
    }
  }
  const cov = sxy / count - (sx / count) * (sy / count);
  const vx = sxx / count - (sx / count) ** 2;
  const vy = syy / count - (sy / count) ** 2;
  return cov / Math.sqrt(vx * vy);
}

/** A scalar grid's value at a fractional voxel, trilinear, clamped to the grid. */
export function trilinear(values: ArrayLike<number>, n: number, x: number, y: number, z: number): number {
  const cx = Math.min(n - 1, Math.max(0, x));
  const cy = Math.min(n - 1, Math.max(0, y));
  const cz = Math.min(n - 1, Math.max(0, z));
  const i = Math.min(n - 2, Math.floor(cx));
  const j = Math.min(n - 2, Math.floor(cy));
  const k = Math.min(n - 2, Math.floor(cz));
  const fx = cx - i;
  const fy = cy - j;
  const fz = cz - k;
  const at = i + n * (j + n * k);
  const nn = n * n;
  const c00 = Number(values[at]) * (1 - fx) + Number(values[at + 1]) * fx;
  const c10 = Number(values[at + n]) * (1 - fx) + Number(values[at + n + 1]) * fx;
  const c01 = Number(values[at + nn]) * (1 - fx) + Number(values[at + nn + 1]) * fx;
  const c11 = Number(values[at + nn + n]) * (1 - fx) + Number(values[at + nn + n + 1]) * fx;
  return (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
}

function sample(field: VectorField, p: Vec3, out: Vec3): Vec3 {
  out[0] = trilinear(field.x, field.size, p[0], p[1], p[2]);
  out[1] = trilinear(field.y, field.size, p[0], p[1], p[2]);
  out[2] = trilinear(field.z, field.size, p[0], p[1], p[2]);
  return out;
}

// ---------------------------------------------------------------------------------------
// Tracing

/** A step, in the field's voxels (7.8 Mpc/h at 128^3): a quarter of one. */
export const STEP_VOXELS = 0.25;
/** Below this speed, km/s, a step shortens with the speed, so a line settles at an attractor. */
export const SOFT_KMS = 30;
/** A line under this speed, km/s, is at its attractor. */
export const SINK_KMS = 8;
/** A line that has gone less than SETTLE_VOXELS in SETTLE_STEPS steps is at its attractor. */
export const SETTLE_STEPS = 48;
export const SETTLE_VOXELS = 0.5;
/** No line longer than this many steps: 400 voxels, three times across the box. */
export const MAX_STEPS = 1600;

export type TraceEnd = 'attractor' | 'edge' | 'length';

export interface Trace {
  /** x, y, z per step, the field's voxels (fractional). */
  readonly points: number[];
  /** The speed at each, km/s. */
  readonly speeds: number[];
  readonly end: TraceEnd;
}

/** A streamline from `seed`, forward along the velocity (see the header). */
export function traceStreamline(field: VectorField, seed: Vec3): Trace {
  const n = field.size;
  const points: number[] = [];
  const speeds: number[] = [];
  const v: Vec3 = [0, 0, 0];
  const k1: Vec3 = [0, 0, 0];
  const k2: Vec3 = [0, 0, 0];
  const k3: Vec3 = [0, 0, 0];
  const k4: Vec3 = [0, 0, 0];
  const q: Vec3 = [0, 0, 0];
  // The direction of the flow, its length the speed over SOFT_KMS where that is under one.
  const f = (p: Vec3, out: Vec3): number => {
    sample(field, p, v);
    const speed = Math.hypot(v[0], v[1], v[2]);
    const s = 1 / Math.max(speed, SOFT_KMS);
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    out[2] = v[2] * s;
    return speed;
  };
  const p: Vec3 = [seed[0], seed[1], seed[2]];
  const h = STEP_VOXELS;
  const inside = (r: Vec3) => r[0] >= 0 && r[1] >= 0 && r[2] >= 0 && r[0] <= n - 1 && r[1] <= n - 1 && r[2] <= n - 1;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (!inside(p)) {
      return { points, speeds, end: 'edge' };
    }
    const speed = f(p, k1);
    points.push(p[0], p[1], p[2]);
    speeds.push(speed);
    if (speed < SINK_KMS) {
      return { points, speeds, end: 'attractor' };
    }
    if (step >= SETTLE_STEPS) {
      const back = (step - SETTLE_STEPS) * 3;
      if (Math.hypot(p[0] - points[back]!, p[1] - points[back + 1]!, p[2] - points[back + 2]!) < SETTLE_VOXELS) {
        return { points, speeds, end: 'attractor' };
      }
    }
    for (let c = 0; c < 3; c += 1) q[c] = p[c]! + 0.5 * h * k1[c]!;
    f(q, k2);
    for (let c = 0; c < 3; c += 1) q[c] = p[c]! + 0.5 * h * k2[c]!;
    f(q, k3);
    for (let c = 0; c < 3; c += 1) q[c] = p[c]! + h * k3[c]!;
    f(q, k4);
    for (let c = 0; c < 3; c += 1) p[c] = p[c]! + (h / 6) * (k1[c]! + 2 * k2[c]! + 2 * k3[c]! + k4[c]!);
  }
  return { points, speeds, end: 'length' };
}

// ---------------------------------------------------------------------------------------
// Seeding, spacing and tagging

/** Seeds every this many voxels (15.6 Mpc/h at 128^3). */
export const SEED_SPACING = 1.5;
/** A seed's least chance of being taken, in the emptiest voids; (1 + delta) / 2 elsewhere. */
export const SEED_LEAST = 0.15;
/** A seed only where the field is at least this constrained (`constraint`). */
export const SEED_CONSTRAINT = 0.5;
/** No line starts within this many voxels of one kept; a line joins one when within JOIN_VOXELS. */
export const SEPARATION_VOXELS = 1.25;
export const JOIN_VOXELS = 0.8;
/** No line starts within this many voxels of another's start (27 Mpc/h): spread over its basin. */
export const START_SEPARATION_VOXELS = 3.5;
/** The lines a basin is given, and the basins named here more (FlowInput.budgets). */
export const LINES_PER_BASIN = 7;
export const LANIAKEA_LINES = 18;
/** A line kept shorter than this, voxels, is dropped. */
export const MIN_LINE_VOXELS = 5;
/** Every this many steps a vertex is written: half a voxel apart. */
export const WRITE_EVERY = 2;
/** The velocity's error, km/s, under which a line is whole and over which it is gone. */
export const FULL_BELOW_KMS = 100;
export const GONE_ABOVE_KMS = 160;

/** How constrained the field is, 0 to 1, from its error there (see the header). */
export function constraint(errorKmS: number): number {
  return Math.min(1, Math.max(0, (GONE_ABOVE_KMS - errorKmS) / (GONE_ABOVE_KMS - FULL_BELOW_KMS)));
}

/** A fixed draw in [0, 1) for a lattice point and a channel (a 32-bit hash). */
export function draw(i: number, j: number, k: number, channel: number): number {
  let h = Math.imul(i + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(j + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(k + 0x165667b1, 0x27d4eb2f) ^ Math.imul(channel + 1, 0x61c88647);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export interface FlowInput {
  readonly velocity: VectorField;
  /** The velocity's error, km/s. */
  readonly error: ScalarCube;
  /** The overdensity delta. */
  readonly density: ScalarCube;
  /** Basin numbers (the galaxies' basins of attraction), and the ones kept: any other is 0. */
  readonly basins: ScalarCube;
  readonly kept: ReadonlySet<number>;
  /** Lines for a basin other than LINES_PER_BASIN, by number. */
  readonly budgets?: ReadonlyMap<number, number>;
}

export interface FlowLine {
  /** x, y, z per vertex, the velocity grid's voxels from its corner (fractional). */
  readonly points: number[];
  readonly speeds: number[];
  /** How constrained the field is at each vertex, 0 to 1. */
  readonly weights: number[];
  /** The kept basin its streamline ends in, 0 none. */
  readonly basin: number;
  /** How it ends as drawn: at its attractor, joining another, where the data stop, at the grid's edge. */
  readonly end: 'attractor' | 'joined' | 'unconstrained' | 'edge' | 'length';
}

export interface FlowResult {
  readonly lines: FlowLine[];
  readonly seeds: number;
  /** Of the seeds whose streamline ends at an attractor, the share ending in their own voxel's basin. */
  readonly agreement: number;
}

function labelAt(basins: ScalarCube, fieldSize: number, p: readonly number[], at: number): number {
  const m = basins.size;
  const i = Math.round(regrid(p[at]!, fieldSize, m));
  const j = Math.round(regrid(p[at + 1]!, fieldSize, m));
  const k = Math.round(regrid(p[at + 2]!, fieldSize, m));
  if (i < 0 || j < 0 || k < 0 || i >= m || j >= m || k >= m) return 0;
  return Number(basins.values[i + m * (j + m * k)]);
}

/**
 * How far a line is drawn at a place, 0 to 1: how constrained the field is there by its error,
 * and nothing in a voxel of no kept basin -- the SDSS basins at the data's edge, which Dupuy &
 * Courtois say cannot be constrained (watersheds.ts), and whatever lies beyond.
 */
function usableAt(input: FlowInput, fieldSize: number, x: number, y: number, z: number): number {
  if (!input.kept.has(labelAt(input.basins, fieldSize, [x, y, z], 0))) return 0;
  const m = input.error.size;
  return constraint(trilinear(input.error.values, m, regrid(x, fieldSize, m), regrid(y, fieldSize, m), regrid(z, fieldSize, m)));
}

/**
 * The seeds, the lines traced from them, spaced and tagged (see the header). The spacings are
 * in voxels of a 128^3 grid, `scale` of the field's to one of those: the same Mpc at 64^3.
 */
export function traceFlows(input: FlowInput, scale = input.velocity.size / 128): FlowResult {
  const { velocity: field } = input;
  const n = field.size;
  const spacing = SEED_SPACING * scale;
  const cells = Math.floor(n / spacing);
  const traces: { trace: Trace; basin: number; seed: Vec3 }[] = [];
  let agreeing = 0;
  let ending = 0;
  for (let k = 0; k < cells; k += 1) {
    for (let j = 0; j < cells; j += 1) {
      for (let i = 0; i < cells; i += 1) {
        const seed: Vec3 = [(i + draw(i, j, k, 0)) * spacing, (j + draw(i, j, k, 1)) * spacing, (k + draw(i, j, k, 2)) * spacing];
        if (usableAt(input, n, seed[0], seed[1], seed[2]) < SEED_CONSTRAINT) continue;
        const d = input.density.size;
        const delta = trilinear(input.density.values, d, regrid(seed[0], n, d), regrid(seed[1], n, d), regrid(seed[2], n, d));
        if (draw(i, j, k, 3) >= Math.max(SEED_LEAST, Math.min(1, (1 + delta) / 2))) continue;
        const trace = traceStreamline(field, seed);
        if (trace.points.length < 2) continue;
        const endLabel = labelAt(input.basins, n, trace.points, trace.points.length - 3);
        if (trace.end === 'attractor') {
          ending += 1;
          if (endLabel === labelAt(input.basins, n, seed, 0)) agreeing += 1;
        }
        traces.push({ trace, basin: input.kept.has(endLabel) ? endLabel : 0, seed });
      }
    }
  }
  // Longest first: the rivers are laid down before their tributaries.
  traces.sort((a, b) => b.trace.points.length - a.trace.points.length || a.seed[0] - b.seed[0] || a.seed[1] - b.seed[1] || a.seed[2] - b.seed[2]);

  // The kept lines' points, by cell of SEPARATION_VOXELS.
  const cellSize = SEPARATION_VOXELS * scale;
  const join = JOIN_VOXELS * scale;
  const grid = new Map<number, number[]>();
  const kept: number[] = [];
  const keptSpeeds: number[] = [];
  const keptWeights: number[] = [];
  const key = (x: number, y: number, z: number) => Math.floor(x / cellSize) + 1024 * (Math.floor(y / cellSize) + 1024 * Math.floor(z / cellSize));
  /** The nearest kept point within `reach`, its index, or -1. */
  const nearest = (x: number, y: number, z: number, reach: number): number => {
    const ci = Math.floor(x / cellSize);
    const cj = Math.floor(y / cellSize);
    const ck = Math.floor(z / cellSize);
    let best = -1;
    let bestD = reach;
    for (let dk = -1; dk <= 1; dk += 1) {
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          const list = grid.get(ci + di + 1024 * (cj + dj + 1024 * (ck + dk)));
          if (list === undefined) continue;
          for (const at of list) {
            const d = Math.hypot(kept[at * 3]! - x, kept[at * 3 + 1]! - y, kept[at * 3 + 2]! - z);
            if (d < bestD) {
              bestD = d;
              best = at;
            }
          }
        }
      }
    }
    return best;
  };
  const lines: FlowLine[] = [];
  const starts: number[] = [];
  const taken = new Map<number, number>();
  const startReach = START_SEPARATION_VOXELS * scale;
  for (const { trace, basin } of traces) {
    if ((taken.get(basin) ?? 0) >= (input.budgets?.get(basin) ?? LINES_PER_BASIN)) continue;
    {
      const p = trace.points;
      let crowded = false;
      for (let at = 0; at < starts.length && !crowded; at += 3) {
        crowded = Math.hypot(starts[at]! - p[0]!, starts[at + 1]! - p[1]!, starts[at + 2]! - p[2]!) < startReach;
      }
      if (crowded) continue;
    }
    const p = trace.points;
    const steps = p.length / 3;
    if (nearest(p[0]!, p[1]!, p[2]!, cellSize) >= 0) continue;
    const points: number[] = [];
    const speeds: number[] = [];
    const weights: number[] = [];
    let end: FlowLine['end'] = trace.end === 'attractor' ? 'attractor' : trace.end;
    let length = 0;
    for (let s = 0; s < steps; s += 1) {
      const x = p[s * 3]!;
      const y = p[s * 3 + 1]!;
      const z = p[s * 3 + 2]!;
      const weight = usableAt(input, n, x, y, z);
      if (weight <= 0) {
        end = 'unconstrained';
        break;
      }
      if (s > 0) {
        length += Math.hypot(x - p[s * 3 - 3]!, y - p[s * 3 - 2]!, z - p[s * 3 - 1]!);
      }
      const other = s === 0 ? -1 : nearest(x, y, z, join);
      if (other >= 0) {
        // Joined: drawn on to the point it meets.
        points.push(kept[other * 3]!, kept[other * 3 + 1]!, kept[other * 3 + 2]!);
        speeds.push(keptSpeeds[other]!);
        weights.push(keptWeights[other]!);
        end = 'joined';
        break;
      }
      if (s % WRITE_EVERY === 0 || s === steps - 1) {
        points.push(x, y, z);
        speeds.push(trace.speeds[s]!);
        weights.push(weight);
      }
    }
    if (points.length < 6 || length < MIN_LINE_VOXELS * scale) continue;
    // Its own points kept for the lines after it (the join point is another's already).
    const own = end === 'joined' ? points.length / 3 - 1 : points.length / 3;
    for (let v = 0; v < own; v += 1) {
      const at = kept.length / 3;
      kept.push(points[v * 3]!, points[v * 3 + 1]!, points[v * 3 + 2]!);
      keptSpeeds.push(speeds[v]!);
      keptWeights.push(weights[v]!);
      const cell = key(points[v * 3]!, points[v * 3 + 1]!, points[v * 3 + 2]!);
      const list = grid.get(cell);
      if (list === undefined) grid.set(cell, [at]);
      else list.push(at);
    }
    lines.push({ points, speeds, weights, basin, end });
    starts.push(points[0]!, points[1]!, points[2]!);
    taken.set(basin, (taken.get(basin) ?? 0) + 1);
  }
  return { lines, seeds: traces.length, agreement: ending === 0 ? 0 : agreeing / ending };
}

// ---------------------------------------------------------------------------------------
// The file

/** A vertex's position is written as Int16 of this many to a voxel, from the Milky Way's voxel. */
export const FLOW_POSITION_SCALE = 64;

/**
 * flows.bin, little-endian, one column after another (LaniakeaFlows in types.ts):
 * Uint32 first vertex of each line and one past the last [lines + 1]; Int16 x, y, z per vertex,
 * FLOW_POSITION_SCALE to a voxel from the Milky Way's [3 vertices]; Uint16 speed, km/s
 * [vertices]; Uint8 constraint, 255 whole [vertices]; Uint8 basin [lines].
 */
export function encodeFlows(lines: readonly FlowLine[], fieldSize: number): { bytes: Uint8Array; vertices: number } {
  const vertices = lines.reduce((sum, line) => sum + line.points.length / 3, 0);
  const L = lines.length;
  const size = 4 * (L + 1) + 6 * vertices + 2 * vertices + vertices + L;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  const positionsAt = 4 * (L + 1);
  const speedsAt = positionsAt + 6 * vertices;
  const weightsAt = speedsAt + 2 * vertices;
  const basinsAt = weightsAt + vertices;
  const half = fieldSize / 2;
  let v = 0;
  lines.forEach((line, l) => {
    view.setUint32(l * 4, v, true);
    const count = line.points.length / 3;
    for (let i = 0; i < count; i += 1, v += 1) {
      for (let c = 0; c < 3; c += 1) {
        const q = Math.round((line.points[i * 3 + c]! - half) * FLOW_POSITION_SCALE);
        if (q < -32768 || q > 32767) throw new Error(`A flow vertex at ${line.points[i * 3 + c]} voxels is beyond Int16 at scale ${FLOW_POSITION_SCALE}.`);
        view.setInt16(positionsAt + (v * 3 + c) * 2, q, true);
      }
      view.setUint16(speedsAt + v * 2, Math.min(65535, Math.round(line.speeds[i]!)), true);
      view.setUint8(weightsAt + v, Math.round(255 * line.weights[i]!));
    }
    view.setUint8(basinsAt + l, line.basin);
  });
  view.setUint32(L * 4, v, true);
  return { bytes, vertices };
}

/** The field at the Milky Way's voxel, N/2, supergalactic x, y, z, km/s. */
export function milkyWayVelocity(field: VectorField): [number, number, number] {
  const h = field.size / 2;
  const at = h + field.size * (h + field.size * h);
  return [field.x[at]!, field.y[at]!, field.z[at]!];
}

/** flows.bin read back: for the tests, and the web's reader's twin (web/src/core/laniakea.ts). */
export function decodeFlows(bytes: Uint8Array, lines: number, vertices: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const positionsAt = 4 * (lines + 1);
  const speedsAt = positionsAt + 6 * vertices;
  const weightsAt = speedsAt + 2 * vertices;
  const basinsAt = weightsAt + vertices;
  return {
    starts: Array.from({ length: lines + 1 }, (_, l) => view.getUint32(l * 4, true)),
    positions: Array.from({ length: 3 * vertices }, (_, i) => view.getInt16(positionsAt + i * 2, true) / FLOW_POSITION_SCALE),
    speeds: Array.from({ length: vertices }, (_, i) => view.getUint16(speedsAt + i * 2, true)),
    weights: Array.from({ length: vertices }, (_, i) => view.getUint8(weightsAt + i) / 255),
    basins: Array.from({ length: lines }, (_, l) => view.getUint8(basinsAt + l)),
  };
}
