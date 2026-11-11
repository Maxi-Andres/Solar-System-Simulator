import { CLUSTER_LF_STEP, type ClusterLuminosityRow, type ClusterPopulation } from './globularClusterPopulation.ts';
import { clusterPopulation, plummerMassShare, SAMPLE_BUDGET, SAMPLE_LIMIT_V } from './globularClusters.ts';
import { galaxyAxes, galaxyLuminosity, type LocalGroupGalaxy } from './localGroup.ts';

/**
 * A dwarf galaxy's stars, one by one (scene/DwarfStars.tsx): the Local Group's dwarfs are drawn
 * as volumes of their integrated light (scene/LocalGroup.tsx), and the faintest of them, 27 to
 * 31 mag/arcsec^2, are no light at all -- as in a photograph, where they were found by counting
 * their stars. Near one, its stars show one at a time, as a globular cluster's do; so the one
 * the camera is near is drawn as a sample of a model, made as a cluster's is
 * (globularClusters.ts), from what is measured of it.
 *
 * ## Measured
 *
 * From McConnachie's catalogue (localGroup.ts): its luminosity (V less its distance modulus,
 * already corrected for the reddening in front), its half-light radius on the major axis, its
 * ellipticity and position angle, its mean [Fe/H], and the reddening in front of it.
 *
 * ## Modelled
 *
 * - **How many**: as many as give its light -- its luminosity over the population's mean light
 *   per living star.
 * - **What they are**: the globular clusters' 12 Gyr PARSEC population nearest its [M/H]
 *   (globularClusterPopulation.ts), [Fe/H] + 0.21 as theirs. The spheroidals and the
 *   ultra-faints are old and metal-poor, and this is near what they are; the most metal-poor
 *   table is [M/H] -2.0, and an ultra-faint at [Fe/H] -2.5 takes it. What it is not: Fornax's
 *   and Leo I's stars are mostly 2 to 10 Gyr old, brighter giants and a brighter turnoff than a
 *   12 Gyr population's; and the gas-rich irregulars (WLM, NGC 6822, IC 1613...) are forming
 *   stars, and their young blue stars are not sampled -- all of their light is given to the
 *   old population, as their volume's is given to one colour.
 * - **Where**: its own Plummer ellipsoid, the volume's -- semi-axes r_h on the major axis on
 *   the sky, r_h (1 - e) on the minor, sqrt(ab) along the line of sight, the Plummer scale
 *   being the projected half-light radius. In units of its axes a star's radius m has the
 *   share m^3 / (1 + m^2)^(3/2) inside it, as a Plummer sphere's; it is drawn by inverting that
 *   and stretched along the three axes. Cut at CUT_SCALES, where the volume's box ends; the
 *   2.3 % of a Plummer profile's light beyond is given to the rest, so the sample holds all of
 *   the galaxy's light.
 *
 * ## Which are drawn
 *
 * Within the clusters' SAMPLE_BUDGET, a star is drawn if either of two holds:
 *
 * - **It is among the galaxy's brightest**: M_V < M_all, wherever it is -- every star, if they
 *   fit in the budget, else M_all the faintest that keeps these within half of it. A
 *   galaxy is far bigger than a cluster and the camera is seldom at its centre: these show
 *   right from wherever it is, out to 10^((V_lim,sky - M_all)/5 + 1) pc from each. An
 *   ultra-faint -- Hercules, Segue 1, Boötes IV, a few thousand to a hundred thousand stars
 *   -- is drawn whole.
 * - **It shows from the centre**, as a cluster's star: M_V + 5 log10(r / 10 pc) < V_lim, V_lim
 *   the faintest that keeps the two within the budget, and no fainter than the clusters'
 *   SAMPLE_LIMIT_V: the faint dwarfs about the middle, which a camera there sees.
 *
 * So Fornax, of 2 x 10^7 suns and 10^8 stars, has its giants everywhere and its turnoff about
 * its centre; a camera inside it, away from the centre, misses the faint dwarfs nearest it.
 */

/**
 * How far out the stars are drawn, in scale radii: where a faint dwarf's box ends (localGroup.ts
 * galaxyExtentPc). Their surface density there is (1 + 64)^-2, a four-thousandth of the
 * centre's, and 2 % of them lie beyond: a thinning field, not an edge.
 */
export const CUT_SCALES = 8;
/** Inside this, pc from the centre, a star is taken as this far for the limit. */
const INNER_PC = 0.1;
/** Radial shells, log-spaced in the ellipsoid's radius, from INNER_SCALES to the cut. */
const SHELLS = 80;
const INNER_SCALES = 1e-4;
/** Directions over which a shell's expected count is averaged, for the budget (a Fibonacci sphere). */
const BUDGET_DIRECTIONS = 48;

/** The Sun's absolute V (Willmer 2018, ApJS 236, 47). */
const SUN_ABSOLUTE_V = 4.81;
/** The standard ratio of total to selective extinction. */
const R_V = 3.1;

/** What a dwarf is sampled from: what the worker is sent. */
export interface DwarfSampleRequest {
  /** Living stars. */
  readonly stars: number;
  /** Semi-axes, pc: major and minor on the sky, the line of sight; the Plummer scale along each. */
  readonly scalesPc: readonly [number, number, number];
  /** Those axes, unit vectors in the scene's frame. */
  readonly axes: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
  readonly feH: number | null;
  readonly seed: number;
  /** The limits, M_V everywhere and V from the centre; left out, the faintest within the budget. */
  readonly allV?: number;
  readonly limitV?: number;
}

/** A sample: positions about the centre, pc, scene axes; absolute V; B-V. */
export interface DwarfSample {
  readonly positions: Float32Array;
  readonly absoluteV: Float32Array;
  readonly colorIndex: Float32Array;
  readonly count: number;
  /** The limits it was sampled to: M_V everywhere, V from the centre. */
  readonly allV: number;
  readonly limitV: number;
}

/** A population's mean V luminosity per living star, solar units. */
export function meanStarLuminosity(population: ClusterPopulation): number {
  let sum = 0;
  for (const [mv, share] of population.rows) {
    sum += share * 10 ** (-0.4 * (mv + CLUSTER_LF_STEP / 2 - SUN_ABSOLUTE_V));
  }
  return sum;
}

/** The brightest its stars are, M_V: the top of its population's table. */
export function brightestStarV(feH: number | null): number {
  return clusterPopulation(feH).rows[0]![0];
}

/**
 * The share of its light in stars fainter than M_V `limit`: what is left a glow when those
 * brighter are drawn one by one (scene/DwarfStars.tsx).
 */
export function lightFainterThan(feH: number | null, limit: number): number {
  const { rows } = clusterPopulation(feH);
  let total = 0;
  let fainter = 0;
  for (const [mv, share] of rows) {
    const light = share * 10 ** (-0.4 * (mv + CLUSTER_LF_STEP / 2 - SUN_ABSOLUTE_V));
    total += light;
    fainter += light * Math.min(1, Math.max(0, (mv + CLUSTER_LF_STEP - limit) / CLUSTER_LF_STEP));
  }
  return fainter / total;
}

/** A dwarf's extinction from the Sun, A_V: 3.1 E(B-V); 0 where none is given. */
export function dwarfExtinctionV(ebv: number | null): number {
  return ebv === null ? 0 : R_V * ebv;
}

/**
 * What a dwarf is sampled from; null if it has no Plummer model or no V. Its [Fe/H] from the
 * catalogue; none, the clusters' default.
 */
export function dwarfSampleRequest(galaxy: LocalGroupGalaxy, feH: number | null, seed: number): DwarfSampleRequest | null {
  const luminosity = galaxyLuminosity(galaxy);
  const model = galaxy.model;
  if (luminosity === null || model === null || model.kind !== 'plummer') {
    return null;
  }
  const { u, v, w } = galaxyAxes(galaxy);
  return {
    stars: luminosity / meanStarLuminosity(clusterPopulation(feH)),
    scalesPc: [model.majorPc, model.minorPc, model.depthPc],
    axes: [
      [u.x, u.y, u.z],
      [v.x, v.y, v.z],
      [w.x, w.y, w.z],
    ],
    feH,
    seed,
  };
}

// ---------------------------------------------------------------------------------------
// Sampling, as the clusters' (globularClusters.ts)

/** mulberry32, as the clusters': the same galaxy on every load. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(mean: number, random: () => number): number {
  if (mean < 30) {
    const limit = Math.exp(-mean);
    let k = 0;
    let p = random();
    while (p > limit) {
      k += 1;
      p *= random();
    }
    return k;
  }
  const u = 1 - random();
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal));
}

function cumulative(rows: readonly ClusterLuminosityRow[]): Float64Array {
  const out = new Float64Array(rows.length);
  let sum = 0;
  rows.forEach((row, i) => {
    sum += row[1];
    out[i] = sum;
  });
  return out;
}

function shareBrighterThan(rows: readonly ClusterLuminosityRow[], table: Float64Array, limit: number): number {
  let share = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const [mv, s] = rows[i]!;
    if (mv + CLUSTER_LF_STEP <= limit) {
      share = table[i]!;
    } else {
      if (mv < limit) {
        share += (s * (limit - mv)) / CLUSTER_LF_STEP;
      }
      break;
    }
  }
  return share;
}

/** The magnitude limit at `r` pc from the centre: the brightest everywhere, or what shows from the centre. */
const limitAt = (allV: number, limitV: number, r: number): number =>
  Math.max(allV, limitV - 5 * (Math.log10(Math.max(r, INNER_PC)) - 1));

/** The shells, in the ellipsoid's radius, each with its share of the stars (within the cut). */
function shells(): { inner: number; outer: number; share: number }[] {
  const whole = plummerMassShare(CUT_SCALES, 1);
  const out: { inner: number; outer: number; share: number }[] = [];
  let inner = 0;
  for (let i = 1; i <= SHELLS; i += 1) {
    const outer = INNER_SCALES * (CUT_SCALES / INNER_SCALES) ** (i / SHELLS);
    out.push({ inner, outer, share: (plummerMassShare(outer, 1) - plummerMassShare(inner, 1)) / whole });
    inner = outer;
  }
  return out;
}

/** Directions spread evenly over the sphere, stretched by the axes: how far a radius of 1 reaches each way, pc. */
function reaches(scalesPc: readonly [number, number, number]): Float64Array {
  const out = new Float64Array(BUDGET_DIRECTIONS);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < BUDGET_DIRECTIONS; i += 1) {
    const z = 1 - (2 * (i + 0.5)) / BUDGET_DIRECTIONS;
    const s = Math.sqrt(1 - z * z);
    out[i] = Math.hypot(s * Math.cos(golden * i) * scalesPc[0], s * Math.sin(golden * i) * scalesPc[1], z * scalesPc[2]);
  }
  return out;
}

/** How many stars the limits would draw, expected: each shell at its middle, over the directions. */
function expectedCount(request: DwarfSampleRequest, allV: number, limitV: number): number {
  const { rows } = clusterPopulation(request.feH);
  const table = cumulative(rows);
  const reach = reaches(request.scalesPc);
  let total = 0;
  for (const shell of shells()) {
    const middle = Math.sqrt(Math.max(shell.inner, INNER_SCALES) * shell.outer);
    let share = 0;
    for (const r of reach) {
      share += shareBrighterThan(rows, table, limitAt(allV, limitV, middle * r));
    }
    total += (request.stars * shell.share * share) / reach.length;
  }
  return total;
}

/** The faintest a limit can be within `budget`, by halving, no fainter than `faintest`. */
function solve(count: (limit: number) => number, budget: number, faintest: number): number {
  if (count(faintest) <= budget) {
    return faintest;
  }
  let bright = -10;
  let faint = faintest;
  for (let i = 0; i < 30; i += 1) {
    const middle = (bright + faint) / 2;
    if (count(middle) > budget) {
      faint = middle;
    } else {
      bright = middle;
    }
  }
  return bright;
}

/** The sampling limits (see the header): M_V everywhere, then V from the centre. */
export function dwarfSampleLimits(request: DwarfSampleRequest): { readonly allV: number; readonly limitV: number } {
  const { rows } = clusterPopulation(request.feH);
  const table = cumulative(rows);
  // Every star if they fit in the budget; else the brightest half of it.
  const faintest = rows[rows.length - 1]![0] + CLUSTER_LF_STEP;
  const allV =
    request.allV ??
    (request.stars <= SAMPLE_BUDGET
      ? faintest
      : solve((limit) => request.stars * shareBrighterThan(rows, table, limit), SAMPLE_BUDGET / 2, faintest));
  const limitV = request.limitV ?? solve((limit) => expectedCount(request, allV, limit), SAMPLE_BUDGET, SAMPLE_LIMIT_V);
  return { allV, limitV };
}

/** Samples a dwarf (see the header): deterministic for its seed. */
export function sampleDwarfGalaxy(request: DwarfSampleRequest): DwarfSample {
  const random = generator(request.seed);
  const { allV, limitV } = dwarfSampleLimits(request);
  const { rows } = clusterPopulation(request.feH);
  const table = cumulative(rows);
  const [a, b, c] = request.scalesPc;
  const [u, v, w] = request.axes;
  const nearest = Math.min(a, b, c);
  const whole = plummerMassShare(CUT_SCALES, 1);
  const positions: number[] = [];
  const absoluteV: number[] = [];
  const colorIndex: number[] = [];
  for (const shell of shells()) {
    // The most generous limit in the shell: at its inner edge, along its shortest axis.
    const shellLimit = limitAt(allV, limitV, shell.inner * nearest);
    const share = shareBrighterThan(rows, table, shellLimit);
    const count = poisson(request.stars * shell.share * share, random);
    const lo = plummerMassShare(shell.inner, 1) / whole;
    const hi = plummerMassShare(shell.outer, 1) / whole;
    for (let k = 0; k < count; k += 1) {
      // The radius by inverting the profile within the shell: m = 1 / sqrt(q^(-2/3) - 1).
      const q = (lo + (hi - lo) * random()) * whole;
      const m = 1 / Math.sqrt(q ** (-2 / 3) - 1);
      const target = random() * share;
      let i = 0;
      while (i < rows.length - 1 && table[i]! < target) {
        i += 1;
      }
      const row = rows[i]!;
      const mv = row[0] + random() * Math.max(0, Math.min(CLUSTER_LF_STEP, shellLimit - row[0]));
      // On the unit sphere, then stretched along the axes.
      const cz = 2 * random() - 1;
      const phi = 2 * Math.PI * random();
      const s = Math.sqrt(1 - cz * cz);
      const x = m * s * Math.cos(phi) * a;
      const y = m * s * Math.sin(phi) * b;
      const z = m * cz * c;
      if (mv >= limitAt(allV, limitV, Math.hypot(x, y, z))) {
        continue;
      }
      positions.push(
        x * u[0] + y * v[0] + z * w[0],
        x * u[1] + y * v[1] + z * w[1],
        x * u[2] + y * v[2] + z * w[2],
      );
      absoluteV.push(mv);
      colorIndex.push(row[2]);
    }
  }
  return {
    positions: Float32Array.from(positions),
    absoluteV: Float32Array.from(absoluteV),
    colorIndex: Float32Array.from(colorIndex),
    count: absoluteV.length,
    allV,
    limitV,
  };
}
