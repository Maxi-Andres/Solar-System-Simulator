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
 * the intrinsic spread about it, a standard deviation, kpc, and its shape (DepthShape): what
 * the stars round each place spread by once the distance method's own scatter is taken out --
 * the period-luminosity relation's width and each star's photometry, 0.068 mag in distance
 * modulus for the Cepheids and 0.10 for the RR Lyrae, measured in the same catalogues' LMC
 * stars -- and a mean that changes across them is not counted as depth.
 *
 * ## As a volume
 *
 * A point P at a distance D from the Sun, in the direction (xi, eta), glows
 *
 *   j(P) = Sigma(xi, eta) N(D; mu(xi, eta), sigma(xi, eta)),   N the profile in D,
 *
 * L_Sun per pc^2 per pc of path: the old stars' light by the old stars' profile, the young
 * stars' and the gas's by the young's; and its dust's optical depth per pc is A_V / 1.0857
 * times the young stars' N -- the dust lies with the young stars, as Yanchulova Merica-Jones
 * et al. 2021 (ApJ 907, 50) find the south-west bar's 3.2 kpc in front of its old stars. Along
 * a ray from the Sun xi and eta stay put and the profile sums to one: the column is the map,
 * exactly, so from Earth the cloud is its photographs. From anywhere else, each point is lit by
 * the map at its own direction from the Sun, and the cloud shows its depth.
 *
 * ## Two scales
 *
 * But sigma is a population's spread along the line of sight, 1.4 to 3.9 kpc, not each thing's
 * in it: spread by it, an HII region 100 pc across, a cluster, a knot of dust would each be a
 * tube kilo-parsecs long pointing at the Sun, and from beside the cloud nothing but tubes. So
 * each channel is split in two. Its large-scale part, the map averaged over SMOOTH_DEG of sky
 * (smoothLevel's mipmap, a texel 0.31 degrees, 341 pc at 62.44 kpc), keeps the population's
 * depth; what stands above that, the compact part, lies at the population's mean distance as
 * deep as the widest compact thing is wide -- a Gaussian of COMPACT_SIGMA_PC:
 *
 *   j = S_large N(D; mu, sigma) + S_compact N(D; mu, COMPACT_SIGMA_PC),
 *
 *   S_large = min(S_smooth, S),   S_compact = S - S_large   (twoScales).
 *
 * The min makes the two sum to the map everywhere, so from Earth the cloud is still exactly its
 * photographs: a plain S_smooth for the large part, with the excess clamped from the compact
 * one, would add wherever the map is darker than its surroundings -- 3 % of the old stars'
 * light, 7 % of the young's, 16 % of the dust and 37 % of the glowing gas, as much as their
 * compact parts hold. The price is that a hole in the map is a hole through the cloud's whole
 * depth, a darker tube rather than a brighter one. Where along the population's depth each
 * compact thing lies is not measured: each is put at the mean, an estimate.
 *
 * The volume's whole light is the map's times the mean of (D / referencePc)^2 over the
 * profile -- a pixel of sky is that much bigger at D than at referencePc: 0.98 for the old
 * stars' light, 0.91 for the young stars', which lie nearer, at 59 to 61 kpc -- not corrected
 * for: what is matched is what is measured, its light on the sky.
 */

/**
 * The shape of a population's spread along the line of sight, the same over the whole grid: a
 * Gaussian, or a Laplace -- e^(-sqrt 2 |x|) / sqrt 2 in standard deviations, a sharp core with
 * long wings -- whichever its stars show (tools/galaxies/prepare.py depth_shape): the old
 * stars' a Gaussian, the young's a Laplace. Both have a cumulative in closed form, so a step's
 * column is exact.
 */
export type DepthShape = 'gaussian' | 'laplace';

/** One kind of star's depth on the grid: index j M + i, kpc; sigma a standard deviation. */
export interface SkyDepthProfile {
  readonly shape: DepthShape;
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
  const profile = raw as Partial<SkyDepthProfile> | undefined;
  const mean = profile?.meanKpc;
  const sigma = profile?.sigmaKpc;
  // A map from before shapes were fitted: Gaussian, as it was drawn.
  const shape = profile?.shape ?? 'gaussian';
  if (shape !== 'gaussian' && shape !== 'laplace') {
    throw new Error(`not a sky map: its ${label} depth has no shape it knows`);
  }
  if (!Array.isArray(mean) || !Array.isArray(sigma) || mean.length !== cells || sigma.length !== cells) {
    throw new Error(`not a sky map: its ${label} depth is not one value a cell`);
  }
  if (!mean.every((v) => finite(v) && v > 0) || !sigma.every((v) => finite(v) && v > 0)) {
    throw new Error(`not a sky map: its ${label} depth has a distance or spread that is not one`);
  }
  return { shape, meanKpc: mean, sigmaKpc: sigma };
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

/** The profile in D, per pc, of standard deviation sigmaPc: a Gaussian, or a Laplace. */
export function depthDensity(dPc: number, meanPc: number, sigmaPc: number, shape: DepthShape = 'gaussian'): number {
  const x = (dPc - meanPc) / sigmaPc;
  return (shape === 'laplace' ? laplaceDensity(x) : density(x)) / sigmaPc;
}

/**
 * The large-scale part's scale on the sky, degrees: the map's mipmap whose texel is nearest
 * it is the smooth map (smoothLevel). A third of a degree: above it, the bar, the wing and the
 * depth grid's own cells, 0.31 degrees; below it, HII regions, clusters, knots of dust.
 */
export const SMOOTH_DEG = 0.3;

/** The mipmap of the map read as its large-scale part: the Small Cloud's, 5 -- 0.31 degrees. */
export function smoothLevel(map: Pick<SkyMap, 'size' | 'halfDeg'>): number {
  return Math.max(0, Math.round(Math.log2((SMOOTH_DEG * map.size) / (2 * map.halfDeg))));
}

/**
 * The compact part's depth, a Gaussian's sigma, pc: as deep as the widest thing the split
 * leaves compact is wide -- one smooth texel, 341 pc, a full width at half maximum, sigma
 * 341 / 2.355 = 145 pc on the sky; 150.
 */
export const COMPACT_SIGMA_PC = 150;

/** A channel's value split in its two scales, [large, compact]: summing to it, neither negative. */
export function twoScales(fine: number, smooth: number): readonly [number, number] {
  const large = Math.min(smooth, fine);
  return [large, fine - large];
}

/**
 * The unit Gaussian's tail past a >= 0, 1 - Phi(a): Abramowitz and Stegun 7.1.26's erfc, to
 * 1.5e-7 -- the shader's (scene/SkyVolume.tsx), here to test it.
 */
export function normalTail(a: number): number {
  const t = 1 / (1 + (0.3275911 / Math.SQRT2) * a);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return 0.5 * poly * Math.exp(-0.5 * a * a);
}

/** The unit Gaussian's density at x. */
function density(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** The unit Laplace's -- standard deviation one, scale 1 / sqrt 2 -- density at x. */
function laplaceDensity(x: number): number {
  return Math.exp(-Math.SQRT2 * Math.abs(x)) / Math.SQRT2;
}

/** The unit Laplace's tail past a >= 0, e^(-sqrt 2 a) / 2: the shader's (scene/SkyVolume.tsx). */
export function laplaceTail(a: number): number {
  return 0.5 * Math.exp(-Math.SQRT2 * a);
}

/**
 * The unit Laplace's mean over [x0, x1], as gaussianAcross the Gaussian's, the difference of
 * its cumulative over the width, exactly however thin: across its cusp, one less its two tails;
 * to one side, the nearer end's tail times 1 - e^(-sqrt 2 |dx|) -- for a sliver, a hundredth or
 * less, its series to the third order, 3e-7 of it, so that nothing is lost to rounding. Along a
 * ray from the Sun, where x runs straight and the profile stays put, the steps' columns sum to
 * the difference of its cumulative at the ray's ends: its sharp core is not missed between
 * steps. The shader's (scene/SkyVolume.tsx).
 */
export function laplaceAcross(x0: number, x1: number): number {
  const width = Math.abs(x1 - x0);
  const a = Math.abs(x0);
  const b = Math.abs(x1);
  if (x0 >= 0 !== x1 >= 0) {
    // Across the cusp, one less the two tails: for a sliver, each tail's series to the third order.
    return width < 0.01
      ? Math.SQRT1_2 + (-0.5 * (a * a + b * b) + (Math.SQRT2 / 6) * (a * a * a + b * b * b)) / width
      : (1 - laplaceTail(a) - laplaceTail(b)) / width;
  }
  const u = Math.SQRT2 * width;
  const share = width < 0.01 ? Math.SQRT2 * (1 - u / 2 + (u * u) / 6) : (1 - Math.exp(-u)) / width;
  return laplaceTail(Math.min(a, b)) * share;
}

/**
 * The unit Gaussian's mean over [x0, x1], as the shader takes it: the difference of its
 * cumulative over the width -- of the two tails when both ends are on one side, so nothing is
 * lost to rounding near one -- or, the ends within a hundredth, the mean of its two ends'
 * densities. A step whose x = (D - mu) / sigma runs from x0 to x1 holds that times its length
 * over sigma of the light: all of a layer it crosses, however thin and however long the step.
 */
export function gaussianAcross(x0: number, x1: number): number {
  const dx = x1 - x0;
  if (Math.abs(dx) < 0.01) {
    return 0.5 * (density(x0) + density(x1));
  }
  const a = normalTail(Math.abs(x0));
  const b = normalTail(Math.abs(x1));
  const s0 = x0 >= 0 ? 1 : -1;
  const s1 = x1 >= 0 ? 1 : -1;
  return (s0 === s1 ? s1 * (a - b) : s1 * (1 - a - b)) / dx;
}

/**
 * Where along a step, a share of it, the light of a Gaussian layer it runs through from x0 to
 * x1 is centred: its mean x there, (phi(x0) - phi(x1)) over its cumulative across, back to the
 * step. The map read there is right for any map that changes evenly along the step. Null where
 * the step runs along the layer, the ends within a hundredth: its light is then even along it.
 */
export function gaussianCentroid(x0: number, x1: number): number | null {
  const dx = x1 - x0;
  const across = gaussianAcross(x0, x1) * dx;
  if (Math.abs(dx) < 0.01 || Math.abs(across) < 1e-7) {
    return null;
  }
  const mean = (density(x0) - density(x1)) / across;
  return Math.min(Math.max((mean - x0) / dx, 0), 1);
}

/**
 * Steps along a ray across its box (scene/SkyVolume.tsx). Each step takes a Gaussian
 * population's column across it by the trapezoid between its ends -- the profiles 2.0 kpc deep
 * at the least, the steps under a sigma -- a Laplace population's, whose core is a cusp the
 * trapezoid would cut, and the compact layers' exactly (laplaceAcross, gaussianAcross), x = (D
 * - mu) / sigma straight along the step: from Earth's side an even map's column is the map to
 * 0.03 % (skyMap.test.ts), and the compact layers, 150 pc deep against steps of 500, are never
 * missed between them; from beside the cloud each step reads the map averaged over what it
 * crosses. 48 cost half again as much, for nothing that shows.
 */
export const SKY_STEPS = 32;

/** How far either side of each place's mean distance a Gaussian's light is drawn: its sigmas. */
export const DEPTH_REACH = 3.5;

/**
 * How far either side a profile's light is drawn, its standard deviations: as much of it left
 * outside as a Gaussian's DEPTH_REACH leaves, 4.7e-4 -- a Laplace's, its wings long, 5.4.
 */
export function depthReach(shape: DepthShape): number {
  return shape === 'laplace' ? -Math.log(2 * normalTail(DEPTH_REACH)) / Math.SQRT2 : DEPTH_REACH;
}

/**
 * The box the cloud's light is drawn in, in the map's frame about its centre (east, north, away;
 * pc): every direction of the map, from the nearest any of its light lies to the farthest --
 * depthReach sigmas either side of the mean, of whichever kind reaches further. Its half sides
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
    const reach = depthReach(profile.shape);
    profile.meanKpc.forEach((mean, k) => {
      const sigma = profile.sigmaKpc[k]!;
      near = Math.min(near, (mean - reach * sigma) * 1000);
      far = Math.max(far, (mean + reach * sigma) * 1000);
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
 * The stretch of a ray within the maps' circle, as seen from the Sun -- the cone xi^2 + eta^2 <
 * halfRad^2 in front of it, where all of the light is -- inside `span`; null if none. From `o`
 * along `d`, both in the map's frame about the Sun: |q.xy|^2 - halfRad^2 q.z^2, a quadratic in
 * t, is negative inside it and inside its mirror behind the Sun. The cone in front of the Sun is
 * convex, so the stretch is one interval.
 * The shader (scene/SkyVolume.tsx) marches only it: rays past the cloud's edge cost nothing,
 * and those through it spend every step where there is light.
 */
export function coneSpan(
  o: Vec3,
  d: Vec3,
  halfRad: number,
  span: readonly [number, number],
): readonly [number, number] | null {
  const r2 = halfRad * halfRad;
  const a = d.x * d.x + d.y * d.y - r2 * d.z * d.z;
  const b = o.x * d.x + o.y * d.y - r2 * o.z * d.z;
  const c = o.x * o.x + o.y * o.y - r2 * o.z * o.z;
  const disc = b * b - a * c;
  let lo = span[0];
  let hi = span[1];
  if (disc < 0) {
    // Never on the cone: all inside or all outside.
    if (a > 0) return null;
  } else if (Math.abs(a) > 1e-12) {
    const s = Math.sqrt(disc);
    const t1 = Math.min((-b - s) / a, (-b + s) / a);
    const t2 = Math.max((-b - s) / a, (-b + s) / a);
    if (a > 0) {
      // Between the roots, in one sheet of the double cone: the one behind the Sun is not the maps'.
      if (o.z + d.z * 0.5 * (t1 + t2) <= 0) return null;
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
    } else if (d.z > 0) {
      // Steeper than the cone: inside it from the far root on, going away from the Sun...
      lo = Math.max(lo, t2);
    } else {
      // ...or up to the near one, coming back.
      hi = Math.min(hi, t1);
    }
  }
  return hi > lo ? [lo, hi] : null;
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
