import type { BodyDefinition, BodyId, GlobularClusterCatalog } from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import type { Searchable } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import {
  CLUSTER_LF_STEP,
  CLUSTER_POPULATIONS,
  type ClusterLuminosityRow,
  type ClusterPopulation,
} from './globularClusterPopulation.ts';
import { normalizeName } from './search.ts';
import { julianYearsSinceJ2000, KM_S_TO_PC_PER_YEAR, PARSEC_KM } from './stars3d.ts';
import type { StateVector } from './vec3.ts';

/**
 * The Milky Way's globular clusters (D6d), from globular-clusters.json (tools/src/clusters/):
 * each marked on the map and the galaxy, and the one the camera is near drawn as stars --
 * each a star of its own brightness, as the nuclear cluster's are (NuclearCluster.tsx).
 *
 * ## Measured
 *
 * Where each is and how it moves (Vasiliev & Baumgardt 2021; distances Baumgardt & Vasiliev
 * 2021), its size and structure from N-body fits (Baumgardt & Hilker 2018 and after), its V
 * magnitude (Baumgardt et al. 2020), and from Harris (1996, 2010 edition) its metallicity and
 * the reddening in front of it.
 *
 * ## Modelled: its stars
 *
 * No catalogue lists a cluster's stars one by one to the bottom of its main sequence. So each
 * is drawn as a sample of a model, built from what is measured of it:
 *
 * - **How many**: as many as give its measured light. Its V magnitude, less its distance
 *   modulus and its extinction from the Sun (A_V = 3.1 E(B-V), the standard R_V), is its
 *   total luminosity; the population (below) says how much light a star gives on average; the
 *   ratio is the number of living stars. Not from its mass: the N-body mass counts the
 *   remnants too -- white dwarfs, neutron stars, the dark third or so of an old cluster -- and
 *   light is what is seen. A cluster with no V or no reddening takes its mass times the
 *   population's stars per solar mass instead, and its panel says so.
 * - **Its faint stars** are the Kroupa IMF's, and these clusters have lost many of theirs:
 *   the Galaxy's tides take the low-mass stars first, and their measured mass functions are
 *   flatter (Baumgardt et al. 2023, arXiv 2303.01636). So the model has more faint dwarfs than
 *   the cluster -- 47 Tuc's living stars come to more than its whole dynamical mass -- while
 *   its giants and the stars about its turnoff, which give its light and are what is seen,
 *   come out as many as there are.
 * - **Where**: a Plummer sphere (Plummer 1911) of the cluster's measured half-mass radius --
 *   its scale a = r_h / 1.305 -- cut at its tidal radius: rho proportional to
 *   (1 + r^2 / a^2)^(-5/2), mass inside r = M r^3 / (r^2 + a^2)^(3/2). One shape for all, round:
 *   the fits' own King-like profiles are not tabulated, and a Plummer sphere of the same
 *   half-mass radius puts the same half of the stars inside it.
 * - **What they are**: the 12 Gyr PARSEC population nearest the cluster's [M/H]
 *   (globularClusterPopulation.ts).
 *
 * ## Which are drawn: those bright as seen from the centre
 *
 * As the nuclear cluster's: every star that, seen from the cluster's centre, is brighter than
 * a limit -- M_V + 5 log10(r / 10 pc) < V_lim -- the dwarfs near the middle, the giants out to
 * the edge. V_lim is solved for each cluster so that no more than SAMPLE_BUDGET stars are
 * drawn, and is never fainter than SAMPLE_LIMIT_V; a small cluster has all its stars that
 * could show, Omega Centauri its brightest hundred and twenty thousand. The panel gives the
 * limit.
 */

/** The most stars one cluster is drawn with. */
export const SAMPLE_BUDGET = 120_000;
/** The faintest the sampling limit goes, V from the centre: the picture's own limit, near enough. */
export const SAMPLE_LIMIT_V = 7.5;
/** Inside this, pc from the centre, a star is taken as this far for the limit: a cluster has no star at its very centre. */
const INNER_PC = 0.02;

/** The Sun's absolute V (Willmer 2018, ApJS 236, 47). */
export const SUN_ABSOLUTE_V = 4.81;

/** Plummer's half-mass radius in units of its scale: (2^(2/3) - 1)^(-1/2). */
export const PLUMMER_HALF_MASS = 1 / Math.sqrt(2 ** (2 / 3) - 1);

/** The standard ratio of total to selective extinction. */
const R_V = 3.1;

export function globularClusterBodyId(k: number): BodyId {
  return `gc-${k}`;
}

export function globularClusterIndexOf(id: BodyId | null): number | null {
  const match = id === null ? null : /^gc-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** The catalogue, and its clusters as a search index: by designation, then their other names. */
export interface GlobularClusterArchive {
  readonly catalog: GlobularClusterCatalog;
  readonly search: Searchable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseGlobularClusterCatalog(raw: unknown): GlobularClusterCatalog {
  if (!isRecord(raw) || typeof raw['count'] !== 'number' || !Array.isArray(raw['name'])) {
    throw new Error('globular-clusters.json is not a catalogue of clusters.');
  }
  for (const [column, values] of Object.entries(raw)) {
    if (Array.isArray(values) && values.length !== raw['count']) {
      throw new Error(`globular-clusters.json's ${column} does not have one entry each.`);
    }
  }
  return raw as unknown as GlobularClusterCatalog;
}

export function indexGlobularClusters(catalog: GlobularClusterCatalog): GlobularClusterArchive {
  return {
    catalog,
    search: {
      display: catalog.name.map(normalizeName),
      designation: catalog.otherNames.map((names) => normalizeName(names.join(' '))),
    },
  };
}

export async function loadGlobularClusterArchive(
  fetchers: BeltFetchers,
  basePath = '/',
): Promise<GlobularClusterArchive | null> {
  const raw = await fetchers.json(`${basePath}data/globular-clusters.json`);
  if (raw === null) {
    console.warn('The published data has no globular-clusters.json: the globular clusters are not shown.');
    return null;
  }
  return indexGlobularClusters(parseGlobularClusterCatalog(raw));
}

/** What a cluster is called: its best-known other name, else its designation. */
export function clusterDisplayName(catalog: GlobularClusterCatalog, k: number): string {
  const others = catalog.otherNames[k]!;
  const messier = others.find((name) => /^M\d+$/.test(name));
  const spelled = others.find((name) => /Centauri|Tucanae/.test(name));
  return spelled ?? (messier === undefined ? catalog.name[k]! : `${messier} (${catalog.name[k]})`);
}

/** A cluster's centre about the Sun at `jd`, km and km/s: its straight line. */
export function clusterState(catalog: GlobularClusterCatalog, k: number, jd: number): StateVector {
  const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
  return {
    position: {
      x: (catalog.x[k]! + catalog.vx[k]! * motion) * PARSEC_KM,
      y: (catalog.y[k]! + catalog.vy[k]! * motion) * PARSEC_KM,
      z: (catalog.z[k]! + catalog.vz[k]! * motion) * PARSEC_KM,
    },
    velocity: { x: catalog.vx[k]!, y: catalog.vy[k]!, z: catalog.vz[k]! },
  };
}

/** Its extinction from the Sun, A_V: 3.1 E(B-V); null where Harris gives no reddening. */
export function clusterExtinctionV(catalog: GlobularClusterCatalog, k: number): number | null {
  const ebv = catalog.ebv[k];
  return ebv == null ? null : R_V * ebv;
}

/** The population a cluster is drawn with: the table nearest its [M/H] = [Fe/H] + 0.21. */
export function clusterPopulation(feH: number | null): ClusterPopulation {
  const mh = feH === null ? -1.5 : feH + 0.21;
  let best = CLUSTER_POPULATIONS[0]!;
  for (const population of CLUSTER_POPULATIONS) {
    if (Math.abs(population.mh - mh) < Math.abs(best.mh - mh)) {
      best = population;
    }
  }
  return best;
}

/** A population's mean V luminosity per living star, solar units. */
export function meanLuminosity(population: ClusterPopulation): number {
  let sum = 0;
  for (const [mv, share] of population.rows) {
    sum += share * 10 ** (-0.4 * (mv + CLUSTER_LF_STEP / 2 - SUN_ABSOLUTE_V));
  }
  return sum;
}

/** How many living stars a cluster has, and from what (see the header). */
export function clusterStarCount(
  catalog: GlobularClusterCatalog,
  k: number,
): { readonly stars: number; readonly from: 'light' | 'mass'; readonly absoluteV: number | null } {
  const population = clusterPopulation(catalog.feH[k] ?? null);
  const v = catalog.vMag[k];
  const extinction = clusterExtinctionV(catalog, k);
  if (v != null && extinction !== null) {
    const absoluteV = v - 5 * Math.log10(catalog.distancePc[k]! / 10) - extinction;
    const luminosity = 10 ** (-0.4 * (absoluteV - SUN_ABSOLUTE_V));
    return { stars: luminosity / meanLuminosity(population), from: 'light', absoluteV };
  }
  return { stars: catalog.massSun[k]! * population.starsPerSolarMass, from: 'mass', absoluteV: null };
}

/** A sample of a cluster: positions about its centre, pc, scene axes; absolute V; B-V. */
export interface ClusterSample {
  readonly positions: Float32Array;
  readonly absoluteV: Float32Array;
  readonly colorIndex: Float32Array;
  readonly count: number;
  /** The limit it was sampled to, V from the centre. */
  readonly limitV: number;
}

/** The parameters a sample is drawn from: what the worker is sent. */
export interface ClusterSampleRequest {
  readonly stars: number;
  readonly halfMassRadiusPc: number;
  readonly tidalRadiusPc: number;
  readonly feH: number | null;
  readonly seed: number;
}

/** mulberry32, as the nuclear cluster's: the same cluster on every load. */
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

/** The share of a population's stars brighter than M_V `limit`, and the cumulative table. */
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

/** Plummer: the share of the mass inside r, for scale a. */
export function plummerMassShare(r: number, a: number): number {
  return r ** 3 / (r * r + a * a) ** 1.5;
}

/** The radial shells sampled, log-spaced, with each one's mass share and its most generous limit. */
function shells(request: ClusterSampleRequest, limitV: number) {
  const a = request.halfMassRadiusPc / PLUMMER_HALF_MASS;
  const edge = Math.max(request.tidalRadiusPc, 2 * request.halfMassRadiusPc);
  const n = 80;
  const out: { inner: number; outer: number; share: number; magnitudeLimit: number }[] = [];
  let inner = 0;
  for (let i = 1; i <= n; i += 1) {
    const outer = INNER_PC * (edge / INNER_PC) ** (i / n);
    out.push({
      inner,
      outer,
      share: plummerMassShare(outer, a) - plummerMassShare(inner, a),
      magnitudeLimit: limitV - 5 * (Math.log10(Math.max(inner, INNER_PC)) - 1),
    });
    inner = outer;
  }
  return { a, shells: out };
}

/** How many stars a limit would draw, expected: what the budget is solved with. */
function expectedCount(request: ClusterSampleRequest, limitV: number): number {
  const { rows } = clusterPopulation(request.feH);
  const table = cumulative(rows);
  let total = 0;
  for (const shell of shells(request, limitV).shells) {
    // At the shell's middle, as an estimate of what is kept.
    const middle = Math.max(INNER_PC, Math.sqrt(Math.max(shell.inner, INNER_PC) * shell.outer));
    total += request.stars * shell.share * shareBrighterThan(rows, table, limitV - 5 * (Math.log10(middle) - 1));
  }
  return total;
}

const limits = new Map<string, number>();

/** The sampling limit for a cluster: the faintest within the budget, no fainter than SAMPLE_LIMIT_V. */
export function sampleLimitV(request: ClusterSampleRequest): number {
  const key = `${request.stars}:${request.halfMassRadiusPc}:${request.tidalRadiusPc}:${request.feH}`;
  const known = limits.get(key);
  if (known !== undefined) {
    return known;
  }
  const limit = solveLimitV(request);
  limits.set(key, limit);
  return limit;
}

function solveLimitV(request: ClusterSampleRequest): number {
  if (expectedCount(request, SAMPLE_LIMIT_V) <= SAMPLE_BUDGET) {
    return SAMPLE_LIMIT_V;
  }
  let bright = -10;
  let faint = SAMPLE_LIMIT_V;
  for (let i = 0; i < 40; i += 1) {
    const middle = (bright + faint) / 2;
    if (expectedCount(request, middle) > SAMPLE_BUDGET) {
      faint = middle;
    } else {
      bright = middle;
    }
  }
  return bright;
}

/** Samples a cluster (see the header): deterministic for its seed. */
export function sampleGlobularCluster(request: ClusterSampleRequest): ClusterSample {
  const random = generator(request.seed);
  const limitV = sampleLimitV(request);
  const { rows } = clusterPopulation(request.feH);
  const table = cumulative(rows);
  const { a, shells: list } = shells(request, limitV);
  const positions: number[] = [];
  const absoluteV: number[] = [];
  const colorIndex: number[] = [];
  for (const shell of list) {
    const share = shareBrighterThan(rows, table, shell.magnitudeLimit);
    const count = poisson(request.stars * shell.share * share, random);
    const lo = plummerMassShare(shell.inner, a);
    const hi = plummerMassShare(shell.outer, a);
    for (let k = 0; k < count; k += 1) {
      // The radius by inverting the mass profile within the shell: r = a / sqrt(u^(-2/3) - 1).
      const u = lo + (hi - lo) * random();
      const r = a / Math.sqrt(u ** (-2 / 3) - 1);
      // A magnitude from the luminosity function, no fainter than the shell's limit.
      const target = random() * share;
      let i = 0;
      while (i < rows.length - 1 && table[i]! < target) {
        i += 1;
      }
      const row = rows[i]!;
      const mv = row[0] + random() * Math.max(0, Math.min(CLUSTER_LF_STEP, shell.magnitudeLimit - row[0]));
      if (mv >= limitV - 5 * (Math.log10(Math.max(r, INNER_PC)) - 1)) {
        continue;
      }
      const cz = 2 * random() - 1;
      const phi = 2 * Math.PI * random();
      const s = Math.sqrt(1 - cz * cz);
      positions.push(r * s * Math.cos(phi), r * s * Math.sin(phi), r * cz);
      absoluteV.push(mv);
      colorIndex.push(row[2]);
    }
  }
  return {
    positions: Float32Array.from(positions),
    absoluteV: Float32Array.from(absoluteV),
    colorIndex: Float32Array.from(colorIndex),
    count: absoluteV.length,
    limitV,
  };
}

/** What a cluster is sampled from. */
export function clusterSampleRequest(catalog: GlobularClusterCatalog, k: number): ClusterSampleRequest {
  return {
    stars: clusterStarCount(catalog, k).stars,
    halfMassRadiusPc: catalog.halfMassRadiusPc[k]!,
    tidalRadiusPc: catalog.tidalRadiusPc[k]!,
    feH: catalog.feH[k] ?? null,
    seed: 20261103 + k,
  };
}

// ---------------------------------------------------------------------------------------
// As a body

/** A cluster as a body: a place to go, of no surface; framed by its half-light radius. */
export function clusterDefinition(id: BodyId, name: string, massSun: number): BodyDefinition {
  // The size the camera keeps out of: none to speak of -- one may fly into a cluster.
  const radius = 1e6;
  const gm = massSun * 1.3271244e11;
  return {
    id,
    name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'globular-cluster',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: CLUSTER_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** The colour clusters are marked in: an old population's warm white. */
export const CLUSTER_COLOR = '#f2d7a2';

let madeFrom: GlobularClusterCatalog | null = null;

export function globularClusterOf(id: BodyId | null): { readonly catalog: GlobularClusterCatalog; readonly k: number } | null {
  const k = globularClusterIndexOf(id);
  return k === null || madeFrom === null || k >= madeFrom.count ? null : { catalog: madeFrom, k };
}

/** Makes cluster `k` a body, if it is not yet, and returns its id. */
export function ensureClusterBody(store: EphemerisStore, archive: GlobularClusterArchive, k: number): BodyId {
  const id = globularClusterBodyId(k);
  madeFrom = archive.catalog;
  if (!store.isPropagatedBody(id)) {
    store.addPropagatedBody(
      clusterDefinition(id, clusterDisplayName(archive.catalog, k), archive.catalog.massSun[k]!),
      null,
      (jd) => clusterState(archive.catalog, k, jd),
      { exact: true },
    );
  }
  return id;
}

/** Where the camera stands when going to a cluster, km: four half-light radii out. */
export function clusterFramingKm(catalog: GlobularClusterCatalog, k: number): number {
  return 4 * catalog.halfLightRadiusPc[k]! * PARSEC_KM;
}
