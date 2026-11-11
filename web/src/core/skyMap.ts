import { astrometricState } from './alphaCentauri.ts';
import { skyAxes } from './exoplanets.ts';
import {
  galaxyLuminosity,
  YOUNG_V_PER_SFR,
  type FaceOnMap,
  type LocalGroupGalaxy,
} from './localGroup.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { Vec3 } from './vec3.ts';

/**
 * A galaxy mapped as seen from Earth (galaxies/<name>.png and .json, tools/galaxies/prepare.py):
 * the Small Magellanic Cloud, which is no disc. Torn by the Large Cloud, it is deeper along our
 * line of sight than it is wide on the sky, so a face-on map of it would be a map of nothing;
 * its maps are of the sky, and with them how deep its light lies at each place on it.
 *
 * ## The maps
 *
 * The same three channels as a disc's face-on map (localGroup.ts FaceOnMap), and its glowing
 * gas beside them -- old stars, star formation, dust as A_V, Balmer light -- but each a column
 * as seen from the Sun, on a gnomonic grid about `centre`: column i to the east, row j to the
 * north, the pixel's centre at the standard coordinates xi = ((i + 0.5) / N 2 - 1) halfDeg, eta
 * likewise. Standard coordinates are the tangent plane's: a direction q from the Sun, in the
 * frame of the centre's east, north and away, is at xi = q.east / q.away, eta = q.north /
 * q.away (radians; the maps' degrees are those times 180 / pi). Each value is per pc^2 of sky
 * at `referencePc`: a column, the same at any distance, as a surface brightness is.
 *
 * ## Its depth
 *
 * On a coarser grid over the same square, `depth`: for its old stars (from RR Lyrae) and its
 * young (from Cepheids under 150 Myr), the mean distance from the Sun along each direction and
 * the intrinsic spread about it, a Gaussian's sigma, kpc.
 *
 * ## As a volume
 *
 * A point P at a distance D from the Sun, in the direction (xi, eta), glows
 *
 *   j(P) = Sigma(xi, eta) N(D; mu(xi, eta), sigma(xi, eta)),   N the unit Gaussian in D,
 *
 * L_Sun per pc^2 per pc of path: the old stars' light by the old stars' profile, the young
 * stars' and the gas's by the young's; and its dust's optical depth per pc is A_V / 1.0857
 * times the young stars' N -- the dust lies with the young stars, as Yanchulova Merica-Jones
 * et al. 2021 (ApJ 907, 50) find the south-west bar's 3.2 kpc in front of its old stars. Along
 * a ray from the Sun xi and eta stay put and the Gaussian sums to one: the column is the map,
 * exactly, so from Earth the cloud is its photographs. From anywhere else, each point is lit by
 * the map at its own direction from the Sun, and the cloud shows its depth.
 *
 * The volume's whole light is the map's times the mean of (D / referencePc)^2 over the
 * profile -- a pixel of sky is that much bigger at D than at referencePc: 0.98 for the old
 * stars' light, 0.91 for the young stars', which lie nearer, at 59 to 61 kpc -- not corrected
 * for: what is matched is what is measured, its light on the sky.
 */

/** One kind of star's depth on the grid: index j M + i, kpc. */
export interface SkyDepthProfile {
  readonly meanKpc: readonly number[];
  readonly sigmaKpc: readonly number[];
}

export interface SkyDepth {
  readonly size: number;
  readonly halfDeg: number;
  readonly old: SkyDepthProfile;
  readonly young: SkyDepthProfile;
}

/**
 * A sky map, as its .json describes it: a face-on map's channels and bounds (so the same
 * decoding, faceOnLevels, reads it), its halfPc the tangent plane's half side at referencePc.
 */
export interface SkyMap extends FaceOnMap {
  readonly projection: 'sky';
  readonly halfDeg: number;
  /** The tangent point, RA and Dec, degrees. */
  readonly centre: readonly [number, number];
  readonly referencePc: number;
  readonly depth: SkyDepth;
}

const DEG = Math.PI / 180;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const pair = (value: unknown): boolean => Array.isArray(value) && value.length === 2 && value.every(finite);

function parseProfile(raw: unknown, cells: number, label: string): SkyDepthProfile {
  const profile = raw as SkyDepthProfile | undefined;
  const mean = profile?.meanKpc;
  const sigma = profile?.sigmaKpc;
  if (!Array.isArray(mean) || !Array.isArray(sigma) || mean.length !== cells || sigma.length !== cells) {
    throw new Error(`not a sky map: its ${label} depth is not one value a cell`);
  }
  if (!mean.every((v) => finite(v) && v > 0) || !sigma.every((v) => finite(v) && v > 0)) {
    throw new Error(`not a sky map: its ${label} depth has a distance or spread that is not one`);
  }
  return { meanKpc: mean, sigmaKpc: sigma };
}

export function parseSkyMap(raw: unknown): SkyMap {
  const map = raw as Record<string, unknown> | null;
  if (typeof map !== 'object' || map === null || map['projection'] !== 'sky') {
    throw new Error('not a sky map');
  }
  const { size, halfDeg, centre, referencePc, bounds, oldSum, sfrSum, nebula, depth } = map as Record<string, never>;
  if (!finite(size) || size < 1 || !finite(halfDeg) || halfDeg <= 0 || halfDeg >= 45) {
    throw new Error('not a sky map: no size');
  }
  if (!pair(centre) || !finite(referencePc) || referencePc <= 0 || !finite(oldSum) || !finite(sfrSum)) {
    throw new Error('not a sky map: no centre, distance or sums');
  }
  const b = bounds as Record<string, unknown> | undefined;
  if (typeof b !== 'object' || b === null || !pair(b['old']) || !pair(b['sfr']) || !pair(b['dust'])) {
    throw new Error('not a sky map: no bounds');
  }
  if (nebula !== undefined && !pair((nebula as { bounds?: unknown } | null)?.bounds)) {
    throw new Error('not a sky map: its nebula has no bounds');
  }
  const d = depth as Record<string, unknown> | undefined;
  if (typeof d !== 'object' || d === null || !finite(d['size']) || d['size'] < 1 || !finite(d['halfDeg'])) {
    throw new Error('not a sky map: no depth');
  }
  const cells = (d['size'] as number) ** 2;
  return {
    ...(map as unknown as SkyMap),
    halfPc: (referencePc as number) * (halfDeg as number) * DEG,
    depth: {
      size: d['size'] as number,
      halfDeg: d['halfDeg'] as number,
      old: parseProfile(d['old'], cells, 'old'),
      young: parseProfile(d['young'], cells, 'young'),
    },
  };
}

/**
 * The frame the map is drawn in: its centre about the Sun, scene frame, pc, and its east,
 * north and away -- the tangent plane's axes, unit vectors in the scene frame.
 */
export interface SkyFrame {
  readonly centrePc: Vec3;
  readonly east: Vec3;
  readonly north: Vec3;
  readonly away: Vec3;
}

export function skyFrame(map: Pick<SkyMap, 'centre' | 'referencePc'>): SkyFrame {
  const { position } = astrometricState({
    raDeg: map.centre[0],
    decDeg: map.centre[1],
    parallaxMas: 1000 / map.referencePc,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  });
  const centrePc = { x: position.x / PARSEC_KM, y: position.y / PARSEC_KM, z: position.z / PARSEC_KM };
  const n = Math.hypot(centrePc.x, centrePc.y, centrePc.z);
  const axes = skyAxes({ x: centrePc.x / n, y: centrePc.y / n, z: centrePc.z / n });
  return { centrePc, ...axes };
}

/** A point about the Sun, scene frame, pc, in the map's frame: east, north, away, pc about the Sun. */
export function fromSun(frame: SkyFrame, p: Vec3): Vec3 {
  const dot = (a: Vec3) => a.x * p.x + a.y * p.y + a.z * p.z;
  return { x: dot(frame.east), y: dot(frame.north), z: dot(frame.away) };
}

/** Its standard coordinates, degrees on the tangent plane; null if it is not in front of the Sun. */
export function standardCoordinates(q: Vec3): { readonly xiDeg: number; readonly etaDeg: number } | null {
  if (q.z <= 0) {
    return null;
  }
  return { xiDeg: q.x / q.z / DEG, etaDeg: q.y / q.z / DEG };
}

/**
 * The depth grid as the shader's texture reads it, RGBA a texel, row j and column i at (j M + i)
 * 4 -- the grid's own order, so its rows run north as the sky map's do: the old stars' mean
 * distance less referencePc and its spread, the young stars' the same, kpc. Less referencePc,
 * so a half float holds it to a few parsecs.
 */
export function depthTexels(depth: SkyDepth, referencePc: number): Float32Array {
  const cells = depth.size * depth.size;
  const data = new Float32Array(cells * 4);
  const ref = referencePc / 1000;
  for (let k = 0; k < cells; k += 1) {
    data[k * 4] = depth.old.meanKpc[k]! - ref;
    data[k * 4 + 1] = depth.old.sigmaKpc[k]!;
    data[k * 4 + 2] = depth.young.meanKpc[k]! - ref;
    data[k * 4 + 3] = depth.young.sigmaKpc[k]!;
  }
  return data;
}

/**
 * The depth at a place on the sky, kpc: the texels read as a linearly filtered texture is, each
 * texel's value at its centre, clamped at the edge. [old mean, old sigma, young mean, young
 * sigma], the means about the Sun.
 */
export function depthAt(depth: SkyDepth, xiDeg: number, etaDeg: number): readonly [number, number, number, number] {
  const m = depth.size;
  // Texel coordinates, texel centres at whole numbers, clamped to the outermost centres.
  const fx = Math.min(Math.max(((xiDeg / depth.halfDeg + 1) / 2) * m - 0.5, 0), m - 1);
  const fy = Math.min(Math.max(((etaDeg / depth.halfDeg + 1) / 2) * m - 0.5, 0), m - 1);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const i1 = Math.min(i0 + 1, m - 1);
  const j1 = Math.min(j0 + 1, m - 1);
  const tx = fx - i0;
  const ty = fy - j0;
  const at = (values: readonly number[]) =>
    (values[j0 * m + i0]! * (1 - tx) + values[j0 * m + i1]! * tx) * (1 - ty) +
    (values[j1 * m + i0]! * (1 - tx) + values[j1 * m + i1]! * tx) * ty;
  return [at(depth.old.meanKpc), at(depth.old.sigmaKpc), at(depth.young.meanKpc), at(depth.young.sigmaKpc)];
}

/** The unit Gaussian in D, per pc. */
export function depthDensity(dPc: number, meanPc: number, sigmaPc: number): number {
  const x = (dPc - meanPc) / sigmaPc;
  return Math.exp(-0.5 * x * x) / (sigmaPc * Math.sqrt(2 * Math.PI));
}

/**
 * Steps along a ray across its box (scene/SkyVolume.tsx). The depth profiles are smooth --
 * sigma 1.6 kpc at the least -- and across the 35 kpc of the box seen from Earth's side 32
 * steps give each column to 0.012 % at a single jitter (skyMap.test.ts); from beside it each
 * step reads the map averaged over what it crosses. 48 cost half again as much, for nothing
 * that shows.
 */
export const SKY_STEPS = 32;

/** How far either side of each place's mean distance its light is drawn: its sigmas. */
export const DEPTH_REACH = 3.5;

/**
 * The box the cloud's light is drawn in, in the map's frame about its centre (east, north, away;
 * pc): every direction of the map, from the nearest any of its light lies to the farthest --
 * DEPTH_REACH sigmas either side of the mean, of whichever kind reaches further. Its half sides
 * and its centre.
 */
export function skyBox(map: Pick<SkyMap, 'halfDeg' | 'referencePc' | 'depth'>): {
  readonly half: Vec3;
  readonly centre: Vec3;
} {
  const { depth } = map;
  let near = Number.POSITIVE_INFINITY;
  let far = 0;
  for (const profile of [depth.old, depth.young]) {
    profile.meanKpc.forEach((mean, k) => {
      const sigma = profile.sigmaKpc[k]!;
      near = Math.min(near, (mean - DEPTH_REACH * sigma) * 1000);
      far = Math.max(far, (mean + DEPTH_REACH * sigma) * 1000);
    });
  }
  near = Math.max(near, 0);
  // The square's half side on the tangent plane, xi = q.east / q.away.
  const halfRad = Math.max(map.halfDeg, depth.halfDeg) * DEG;
  // Its corner is sqrt(2) half off the axis: there the nearest light is least far along it.
  const zNear = near / Math.hypot(1, Math.SQRT2 * halfRad) - map.referencePc;
  const zFar = far - map.referencePc;
  const side = far * halfRad;
  return { half: { x: side, y: side, z: (zFar - zNear) / 2 }, centre: { x: 0, y: 0, z: (zFar + zNear) / 2 } };
}

/**
 * What each channel stands for, per unit: the old stars' and the young stars' V light, L_Sun/pc^2
 * of sky, and the dust's optical depth in V -- as a disc's (faceOnScales), its whole light the
 * galaxy's V luminosity less its young stars'.
 */
export function skyScales(galaxy: LocalGroupGalaxy, map: SkyMap): readonly [number, number, number] | null {
  const luminosity = galaxyLuminosity(galaxy);
  if (luminosity === null || map.oldSum <= 0) {
    return null;
  }
  const young = YOUNG_V_PER_SFR * map.sfrSum;
  return [Math.max(0, luminosity - young) / map.oldSum, YOUNG_V_PER_SFR / 1e6, 1 / 1.0857];
}

/**
 * The galaxies drawn from their sky maps (scene/SkyVolume.tsx), by key: LocalGroup.tsx leaves
 * their smooth volumes out, so that no light is counted twice. Here, not in SkyVolume.tsx, so
 * that LocalGroup.tsx reads it without importing what imports it.
 */
export const skyVolumesDrawn = new Set<string>();
