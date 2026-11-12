import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { astrometricState } from './alphaCentauri.ts';
import { GIANTS, galaxyLuminosity, YOUNG_V_PER_SFR } from './localGroup.ts';
import {
  COMPACT_SIGMA_PC,
  coneSpan,
  depthAt,
  depthDensity,
  depthReach,
  depthTexels,
  DEPTH_REACH,
  fromSun,
  gaussianAcross,
  gaussianCentroid,
  laplaceAcross,
  laplaceTail,
  normalTail,
  parseSkyMap,
  skyBox,
  skyFrame,
  skyScales,
  SKY_STEPS,
  smoothLevel,
  standardCoordinates,
  twoScales,
  type DepthShape,
  type SkyDepth,
  type SkyMap,
} from './skyMap.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { Vec3 } from './vec3.ts';

const DEG = Math.PI / 180;
const folder = join(import.meta.dirname, '../../public/galaxies');
const readJson = async (name: string): Promise<unknown> => JSON.parse(await readFile(join(folder, name), 'utf8'));
const smc = async (): Promise<SkyMap> => parseSkyMap(await readJson('smc.json'));

/** A place on the sky about the Sun, scene frame, pc. */
function at(raDeg: number, decDeg: number, distancePc: number): Vec3 {
  const { position } = astrometricState({
    raDeg,
    decDeg,
    parallaxMas: 1000 / distancePc,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  });
  return { x: position.x / PARSEC_KM, y: position.y / PARSEC_KM, z: position.z / PARSEC_KM };
}

/** The gnomonic projection, as the maps were made by (tools/galaxies/prepare.py gnomonic). */
function gnomonic(raDeg: number, decDeg: number, ra0: number, dec0: number): [number, number] {
  const [ra, dec, r0, d0] = [raDeg * DEG, decDeg * DEG, ra0 * DEG, dec0 * DEG];
  const cosc = Math.sin(d0) * Math.sin(dec) + Math.cos(d0) * Math.cos(dec) * Math.cos(ra - r0);
  return [
    (Math.cos(dec) * Math.sin(ra - r0)) / cosc / DEG,
    (Math.cos(d0) * Math.sin(dec) - Math.sin(d0) * Math.cos(dec) * Math.cos(ra - r0)) / cosc / DEG,
  ];
}

type SkyAt = (xiDeg: number, etaDeg: number) => number;

/** Inside the maps' circle (SkyVolume.tsx): its standard coordinates, else null. */
function onMap(map: SkyMap, q: Vec3): { readonly xiDeg: number; readonly etaDeg: number } | null {
  const s = standardCoordinates(q);
  return s === null || Math.hypot(s.xiDeg, s.etaDeg) >= map.halfDeg ? null : s;
}

/**
 * The light j at a point (the map's frame about the Sun, pc), one channel of one kind: its
 * large-scale part by the population's profile in D, its compact part by COMPACT_SIGMA_PC's,
 * both about the population's mean -- the map `fine`, its large scale `smooth`.
 */
function emission(map: SkyMap, fine: SkyAt, smooth: SkyAt, kind: 'old' | 'young', q: Vec3): number {
  const s = onMap(map, q);
  if (s === null) return 0;
  const [om, os, ym, ys] = depthAt(map.depth, s.xiDeg, s.etaDeg);
  const [mean, sigma] = kind === 'old' ? [om, os] : [ym, ys];
  const [large, compact] = twoScales(fine(s.xiDeg, s.etaDeg), smooth(s.xiDeg, s.etaDeg));
  const distance = Math.hypot(q.x, q.y, q.z);
  const shape = map.depth[kind].shape;
  return large * depthDensity(distance, mean * 1000, sigma * 1000, shape) + compact * depthDensity(distance, mean * 1000, COMPACT_SIGMA_PC);
}

/** The column along a ray, finely, by points: the reference. */
function integrated(
  map: SkyMap,
  fine: SkyAt,
  smooth: SkyAt,
  kind: 'old' | 'young',
  camera: Vec3,
  d: Vec3,
  span: readonly [number, number],
  steps: number,
): number {
  const dt = (span[1] - span[0]) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i += 1) {
    const t = span[0] + (i + 0.5) * dt;
    sum += emission(map, fine, smooth, kind, { x: camera.x + d.x * t, y: camera.y + d.y * t, z: camera.z + d.z * t }) * dt;
  }
  return sum;
}

/**
 * The shader's march (SkyVolume.tsx), one channel: from `camera` along `d`, `steps` steps across
 * [t0, t1], each profile's column across each step between the depth read at its ends -- a
 * Gaussian population's by the trapezoid, a Laplace's and the compact layers' exactly
 * (laplaceAcross, gaussianAcross) -- and the map
 * read twice a step: its large-scale part at `jitter`, its compact part where its layer's light
 * in the step is centred.
 */
function marched(
  map: SkyMap,
  fine: SkyAt,
  smooth: SkyAt,
  kind: 'old' | 'young',
  camera: Vec3,
  d: Vec3,
  span: readonly [number, number],
  steps: number,
  jitter: number,
  cut = true,
): number {
  const dt = (span[1] - span[0]) / steps;
  const point = (t: number): Vec3 => ({ x: camera.x + d.x * t, y: camera.y + d.y * t, z: camera.z + d.z * t });
  // Old large, young large, old compact, young compact: x in sigmas, and the sigmas, pc.
  const profiles = (t: number): [number[], number[]] => {
    const q = point(t);
    const s = standardCoordinates(q)!;
    const [om, os, ym, ys] = depthAt(map.depth, s.xiDeg, s.etaDeg);
    const sigma = [os * 1000, ys * 1000, COMPACT_SIGMA_PC, COMPACT_SIGMA_PC];
    const distance = Math.hypot(q.x, q.y, q.z);
    return [[om, ym, om, ym].map((mean, k) => (distance - mean * 1000) / sigma[k]!), sigma];
  };
  let [x0, sigma0] = profiles(span[0]);
  let sum = 0;
  for (let i = 0; i < steps; i += 1) {
    const t0 = span[0] + i * dt;
    const [x1, sigma1] = profiles(t0 + dt);
    // The populations' columns by the trapezoid of their densities per pc, the compact layers'
    // exactly, where one is within four sigmas of the step or crossed in it.
    const layer = kind === 'old' ? 2 : 3;
    const near = x0[layer]! * x1[layer]! <= 0 || Math.min(Math.abs(x0[layer]!), Math.abs(x1[layer]!)) < 4;
    const population =
      map.depth[kind].shape === 'laplace'
        ? laplaceAcross(x0[layer - 2]!, x1[layer - 2]!) * dt * 0.5 * (1 / sigma0[layer - 2]! + 1 / sigma1[layer - 2]!)
        : 0.5 * (depthDensity(x0[layer - 2]!, 0, 1) / sigma0[layer - 2]! + depthDensity(x1[layer - 2]!, 0, 1) / sigma1[layer - 2]!) * dt;
    const compactColumn = near ? (gaussianAcross(x0[layer]!, x1[layer]!) * dt) / COMPACT_SIGMA_PC : 0;
    // The compact light read where its layer's light in the step is centred.
    const centre = (near ? gaussianCentroid(x0[layer]!, x1[layer]!) : null) ?? jitter;
    x0 = x1;
    sigma0 = sigma1;
    if (cut && Math.max(population, compactColumn) < 1e-5) continue;
    // The large-scale part at the jittered point; the compact part at the layer's centre.
    const s = onMap(map, point(t0 + jitter * dt));
    if (s !== null) {
      sum += twoScales(fine(s.xiDeg, s.etaDeg), smooth(s.xiDeg, s.etaDeg))[0] * population;
    }
    const c = onMap(map, point(t0 + centre * dt));
    if (c !== null && compactColumn > 0) {
      sum += Math.max(fine(c.xiDeg, c.etaDeg) - smooth(c.xiDeg, c.etaDeg), 0) * compactColumn;
    }
  }
  return sum;
}

/** Where a ray from `o` along unit `d` crosses the box, as the shader's slab. */
function slab(o: Vec3, d: Vec3, centre: Vec3, half: Vec3): [number, number] {
  const axis = (oc: number, dc: number, h: number): [number, number] => {
    const a = (-h - oc) / dc;
    const b = (h - oc) / dc;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const [ax, bx] = axis(o.x - centre.x, d.x, half.x);
  const [ay, by] = axis(o.y - centre.y, d.y, half.y);
  const [az, bz] = axis(o.z - centre.z, d.z, half.z);
  return [Math.max(ax, ay, az, 0), Math.min(bx, by, bz)];
}

/** The stretch the shader marches: the box's, within the maps' circle seen from the Sun. */
function marchSpan(map: SkyMap, o: Vec3, d: Vec3): readonly [number, number] {
  const box = skyBox(map);
  const span = slab(o, d, { ...box.centre, z: box.centre.z + map.referencePc }, box.half);
  return coneSpan(o, d, map.halfDeg * DEG, span) ?? [0, 0];
}

describe('a galaxy mapped as seen from Earth: its standard coordinates', () => {
  const map = { centre: [12.75, -73.12] as const, referencePc: 62_440 };
  const frame = skyFrame(map);

  it('puts its centre at the referencePc along away, and its axes at right angles', () => {
    const r = Math.hypot(frame.centrePc.x, frame.centrePc.y, frame.centrePc.z);
    expect(r).toBeCloseTo(62_440, 6);
    const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
    expect(dot(frame.away, frame.centrePc) / r).toBeCloseTo(1, 12);
    expect(dot(frame.east, frame.north)).toBeCloseTo(0, 12);
    expect(dot(frame.east, frame.away)).toBeCloseTo(0, 12);
  });

  it('gives a point on the centre’s line of sight xi = eta = 0, at any distance', () => {
    for (const d of [100, 50_000, 62_440, 80_000]) {
      const s = standardCoordinates(fromSun(frame, at(12.75, -73.12, d)))!;
      expect(s.xiDeg).toBeCloseTo(0, 9);
      expect(s.etaDeg).toBeCloseTo(0, 9);
    }
  });

  it('gives a point a degree east xi of a degree, and as the maps’ gnomonic projection does anywhere', () => {
    // A degree east of the centre along the great circle through it: xi = tan(1 deg), in degrees.
    const c = Math.cos(DEG) * 61_000;
    const s = Math.sin(DEG) * 61_000;
    const p = { x: c * frame.away.x + s * frame.east.x, y: c * frame.away.y + s * frame.east.y, z: c * frame.away.z + s * frame.east.z };
    const east = standardCoordinates(fromSun(frame, p))!;
    expect(east.xiDeg).toBeCloseTo(Math.tan(DEG) / DEG, 9);
    expect(east.xiDeg).toBeCloseTo(1, 3);
    expect(east.etaDeg).toBeCloseTo(0, 9);
    // And a degree of RA at its declination, a small circle: east, and curving to the pole.
    const alongDec = standardCoordinates(fromSun(frame, at(12.75 + 1 / Math.cos(73.12 * DEG), -73.12, 61_000)))!;
    expect(alongDec.xiDeg).toBeCloseTo(1, 2);
    expect(alongDec.etaDeg).toBeLessThan(0);
    const north = standardCoordinates(fromSun(frame, at(12.75, -72.12, 61_000)))!;
    expect(north.xiDeg).toBeCloseTo(0, 9);
    expect(north.etaDeg).toBeCloseTo(Math.tan(DEG) / DEG, 9);
    for (const [ra, dec] of [[20, -70], [5, -76.5], [16.1, -74]] as const) {
      const s = standardCoordinates(fromSun(frame, at(ra, dec, 58_000)))!;
      const [xi, eta] = gnomonic(ra, dec, 12.75, -73.12);
      expect(s.xiDeg).toBeCloseTo(xi, 8);
      expect(s.etaDeg).toBeCloseTo(eta, 8);
    }
  });

  it('has nothing behind the Sun', () => {
    expect(standardCoordinates({ x: 1, y: 1, z: -5 })).toBeNull();
  });
});

describe('its light along a line of sight', () => {
  /** A ray from the Sun through (xi, eta), degrees: its direction in the map's frame. */
  const fromTheSun = (xi: number, eta: number): Vec3 => {
    const n = Math.hypot(xi * DEG, eta * DEG, 1);
    return { x: (xi * DEG) / n, y: (eta * DEG) / n, z: 1 / n };
  };
  const sun = { x: 0, y: 0, z: 0 };

  it('sums, along any ray from the Sun, to the map: the Gaussian in D holds all of it', async () => {
    const map = await smc();
    const sigma = 3.7;
    for (const [xi, eta] of [[0, 0], [1.2, 0.8], [-2.5, -1], [3, -3.5]] as const) {
      const d = fromTheSun(xi, eta);
      for (const kind of ['old', 'young'] as const) {
        // Finely, from the Sun out to 150 kpc, by points.
        const column = integrated(map, () => sigma, () => sigma, kind, sun, d, [1, 150_000], 30_000);
        expect(column / sigma).toBeCloseTo(1, 6);
        // And as the shader steps across its box, its cut included: steps whose columns are
        // each under a hundred-thousandth leave out less than a ten-thousandth -- a Laplace,
        // whose wings are long, no more than the box leaves past its reach (depthReach).
        const span = marchSpan(map, sun, d);
        const lost = map.depth[kind].shape === 'laplace' ? 2 * normalTail(DEPTH_REACH) : 1e-4;
        for (const jitter of [0.05, 0.55]) {
          const stepped = marched(map, () => sigma, () => sigma, kind, sun, d, span, SKY_STEPS, jitter);
          expect(Math.abs(1 - stepped / sigma)).toBeLessThan(lost);
        }
      }
    }
  });

  it('sums, along any ray from the Sun, to the map in its two scales: the large-scale part and the compact', async () => {
    const map = await smc();
    // A compact thing on a smooth background, and a hole in it: the map above its large scale
    // and below it.
    for (const [fine, smooth] of [[3.7, 1.2], [3.7, 5], [0.4, 0.4], [2, 0]] as const) {
      const [large, compact] = twoScales(fine, smooth);
      expect(large + compact).toBe(fine);
      expect(Math.min(large, compact)).toBeGreaterThanOrEqual(0);
      for (const [xi, eta] of [[0, 0], [1.2, 0.8], [-2.5, -1]] as const) {
        const d = fromTheSun(xi, eta);
        for (const kind of ['old', 'young'] as const) {
          const column = integrated(map, () => fine, () => smooth, kind, sun, d, [1, 150_000], 60_000);
          expect(Math.abs(column / fine - 1)).toBeLessThan(1e-3);
          // In the shader's SKY_STEPS steps across the box: each Gaussian's cumulative across a
          // step, so the steps sum to the whole whatever their length.
          const span = marchSpan(map, sun, d);
          for (const jitter of [0.05, 0.55]) {
            const stepped = marched(map, () => fine, () => smooth, kind, sun, d, span, SKY_STEPS, jitter);
            expect(Math.abs(stepped / fine - 1)).toBeLessThan(1e-3);
          }
        }
      }
    }
  });

  it('holds all of the light in its box, along every direction of the map', async () => {
    const map = await smc();
    const box = skyBox(map);
    const m = map.depth.size;
    for (const profile of [map.depth.old, map.depth.young]) {
      for (let k = 0; k < m * m; k += 1) {
        const xi = (((k % m) + 0.5) / m * 2 - 1) * map.depth.halfDeg * DEG;
        const eta = ((Math.floor(k / m) + 0.5) / m * 2 - 1) * map.depth.halfDeg * DEG;
        for (const sign of [-1, 1]) {
          const distance = (profile.meanKpc[k]! + sign * DEPTH_REACH * profile.sigmaKpc[k]!) * 1000;
          const z = distance / Math.hypot(1, xi, eta);
          expect(Math.abs(xi * z - box.centre.x)).toBeLessThanOrEqual(box.half.x);
          expect(Math.abs(eta * z - box.centre.y)).toBeLessThanOrEqual(box.half.y);
          expect(Math.abs(z - map.referencePc - box.centre.z)).toBeLessThanOrEqual(box.half.z + 1e-6);
        }
      }
    }
  });

  it('sums to the map in the shader’s box and steps, from where the camera looks at it from Earth’s side', async () => {
    const map = await smc();
    // galaxyFramingKm: 28 scale lengths of 1.25 kpc from the centre, on the Sun's side.
    const camera = { x: 0, y: 0, z: map.referencePc - 35_000 };
    for (const [xi, eta] of [[0, 0], [1.5, 1], [-2, -0.5]] as const) {
      // A compact thing 0.1 degrees (110 pc) wide, twenty times its background, where the ray
      // points, on an even large scale. (An uneven one the shader reads averaged over each
      // step's sweep across the sky, which a point read here is not.)
      const r2 = (x: number, e: number) => (x - xi) ** 2 + (e - eta) ** 2;
      const fine = (x: number, e: number) => 1 + 20 * Math.exp(-r2(x, e) / (2 * 0.1 ** 2));
      const smooth = () => 1;
      // The ray from the camera to the point at (xi, eta) at the reference distance.
      const target = { x: xi * DEG * map.referencePc, y: eta * DEG * map.referencePc, z: map.referencePc };
      const r = Math.hypot(target.x - camera.x, target.y - camera.y, target.z - camera.z);
      const d = { x: (target.x - camera.x) / r, y: (target.y - camera.y) / r, z: (target.z - camera.z) / r };
      const span = marchSpan(map, camera, d);
      for (const kind of ['old', 'young'] as const) {
        // An even map first: its column, a population's, by the trapezoid to 0.01 %.
        const even = integrated(map, () => 1, () => 1, kind, camera, d, span, 40_000);
        for (const jitter of [0.05, 0.55]) {
          expect(Math.abs(marched(map, () => 1, () => 1, kind, camera, d, span, SKY_STEPS, jitter) / even - 1)).toBeLessThan(1e-4);
        }
        const exact = integrated(map, fine, smooth, kind, camera, d, span, 40_000);
        // One jitter at a time, as one pixel sees it, SKY_STEPS steps: within 0.6 % of the fine
        // column, the compact light read where its layer's light in the step is centred. What is
        // left is the thing's curvature across the 0.01 degrees the ray sweeps in the layer, which
        // the shader's read, averaged over that sweep, mostly takes -- most, 0.53 %, at (-2,
        // -0.5), where the young stars' mean changes fastest across the sky; in 64 steps 0.03 %.
        for (const jitter of [0.05, 0.3, 0.55, 0.8]) {
          const step = marched(map, fine, smooth, kind, camera, d, span, SKY_STEPS, jitter);
          expect(Math.abs(step / exact - 1)).toBeLessThan(0.006);
        }
      }
    }
  });

  /**
   * A depth grid of the Small Cloud's size that is linear on the sky, so that its texels read
   * linearly filtered are exactly it: the young stars 1.5 kpc nearer a degree to the north-east,
   * as its Cepheids are, the old 0.3 kpc farther a degree to the east.
   */
  const linearDepth = (map: SkyMap): SkyDepth => {
    const m = map.depth.size;
    const h = map.depth.halfDeg;
    const at = (f: (xi: number, eta: number) => number) =>
      Array.from({ length: m * m }, (_, k) => f((((k % m) + 0.5) / m * 2 - 1) * h, ((Math.floor(k / m) + 0.5) / m * 2 - 1) * h));
    return {
      ...map.depth,
      old: { shape: 'gaussian', meanKpc: at((xi) => 61 + 0.3 * xi), sigmaKpc: at(() => 3.5) },
      young: { shape: 'laplace', meanKpc: at((xi, eta) => 60.5 - 1.5 * (xi + eta)), sigmaKpc: at(() => 2.5) },
    };
  };

  it('takes a compact layer’s whole column across steps three times its depth, from any side', async () => {
    const real = await smc();
    const map = { ...real, depth: linearDepth(real) };
    // All of the map compact, the same everywhere: what is left to get right is the layer.
    const one = () => 1;
    const none = () => 0;
    for (const angleDeg of [45, 60, 80, 90]) {
      // The camera 35 kpc from the centre, turned from the Sun's side about north.
      const a = angleDeg * DEG;
      const camera = { x: 35_000 * Math.sin(a), y: 0, z: map.referencePc - 35_000 * Math.cos(a) };
      // Rays through the young stars' layer at places on the sky, degrees.
      for (const [xi, eta] of [[0, 0], [-1, 0.8], [1.2, -0.5], [2.5, 2]] as const) {
        const [, , mean] = depthAt(map.depth, xi, eta);
        const z = (mean * 1000) / Math.hypot(1, xi * DEG, eta * DEG);
        const c = { x: xi * DEG * z - camera.x, y: eta * DEG * z - camera.y, z: z - camera.z };
        const n = Math.hypot(c.x, c.y, c.z);
        const d = { x: c.x / n, y: c.y / n, z: c.z / n };
        const span = marchSpan(map, camera, d);
        const exact = integrated(map, one, none, 'young', camera, d, span, 60_000);
        expect(exact).toBeGreaterThan(0.1);
        for (const jitter of [0.05, 0.55]) {
          const step = marched(map, one, none, 'young', camera, d, span, SKY_STEPS, jitter);
          expect(Math.abs(step / exact - 1)).toBeLessThan(0.01);
        }
      }
    }
  });

  it('draws a compact thing from beside the cloud as deep as COMPACT_SIGMA_PC, not as the population', async () => {
    const real = await smc();
    // The depth even across the sky, so the layer is flat; a thing 0.02 degrees (22 pc) wide at
    // the centre.
    const flat = (kpc: number, sigma: number, shape: DepthShape) => ({
      shape,
      meanKpc: real.depth.old.meanKpc.map(() => kpc),
      sigmaKpc: real.depth.old.sigmaKpc.map(() => sigma),
    });
    const map = { ...real, depth: { ...real.depth, old: flat(62.44, 3.5, 'gaussian'), young: flat(62.44, 2.5, 'laplace') } };
    const fine = (x: number, e: number) => Math.exp(-(x * x + e * e) / (2 * 0.02 ** 2));
    // Rays from due east, across the line of sight, at depths about its mean distance, pc apart.
    const profile = (smooth: SkyAt, apart: number) =>
      Array.from({ length: 401 }, (_, k) => {
        const camera = { x: 2_000, y: 0, z: map.referencePc + (k - 200) * apart };
        return integrated(map, fine, smooth, 'young', camera, { x: -1, y: 0, z: 0 }, [1_500, 2_500], 4_000);
      });
    const fullWidth = (values: number[], apart: number) => {
      const half = Math.max(...values) / 2;
      return values.filter((v) => v >= half).length * apart;
    };
    // All of it compact: its depth's full width at half maximum is 2.355 sigma, 353 pc, to the
    // 5 pc the rays are apart.
    expect(Math.abs(fullWidth(profile(() => 0, 5), 5) - 2.3548 * COMPACT_SIGMA_PC)).toBeLessThan(10);
    // Left in the large-scale part, it would be as deep as the young stars, whose Laplace of 2.5
    // kpc is 2 ln 2 / sqrt 2 sigma, 2.45 kpc, wide at half its height.
    expect(Math.abs(fullWidth(profile(fine, 25), 25) - Math.SQRT2 * Math.LN2 * 2_500)).toBeLessThan(60);
  });
});

describe('a Gaussian’s column across a step', () => {
  /** Its integral over [x0, x1], by Simpson's rule in 20 000 pieces. */
  const simpson = (x0: number, x1: number) => {
    const n = 20_000;
    const h = (x1 - x0) / n;
    const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    let sum = phi(x0) + phi(x1);
    for (let i = 1; i < n; i += 1) sum += (i % 2 === 1 ? 4 : 2) * phi(x0 + i * h);
    return (sum * h) / 3;
  };

  it('has the tail Abramowitz and Stegun give, to 1.5e-7', () => {
    expect(normalTail(0)).toBeCloseTo(0.5, 8);
    for (const a of [0.1, 0.5, 1, 1.645, 2, 3, 4.5]) {
      expect(Math.abs(normalTail(a) - simpson(a, 40))).toBeLessThan(1.5e-7);
    }
  });

  it('matches its numerical integral, across the layer, to one side of it, far out and in a sliver', () => {
    const cases = [
      [-0.5, 0.7], [-3.4, 3.2], [1, 4], [-6, -2], [3, 9], [-10, 10], [6, -1],
      [2, 2.3], [-0.2, -0.19], [0.4, 0.405], [0, 1], [-1, 0],
    ] as const;
    for (const [x0, x1] of cases) {
      const exact = simpson(x0, x1);
      const column = gaussianAcross(x0, x1) * (x1 - x0);
      expect(Math.abs(column - exact)).toBeLessThan(2e-7);
      // Relative too, where the column is a share worth drawing.
      if (Math.abs(exact) > 1e-3) expect(Math.abs(column / exact - 1)).toBeLessThan(1e-4);
    }
  });

  it('reads the Small Cloud’s smooth map a third of a degree across: mipmap 5, 341 pc', async () => {
    const map = await smc();
    expect(smoothLevel(map)).toBe(5);
    const texelPc = ((2 * map.halfDeg) / map.size) * 2 ** smoothLevel(map) * DEG * map.referencePc;
    expect(texelPc).toBeCloseTo(340.6, 0);
    // The compact part as deep as one such texel's width at half maximum.
    expect(Math.abs(COMPACT_SIGMA_PC - texelPc / 2.3548)).toBeLessThan(10);
  });
});

describe('a Laplace’s column across a step', () => {
  /** The unit Laplace's integral over [x0, x1], by Simpson's rule in 20 000 pieces each side of its cusp. */
  const simpson = (x0: number, x1: number) => {
    const f = (x: number) => Math.exp(-Math.SQRT2 * Math.abs(x)) / Math.SQRT2;
    const piece = (a: number, b: number) => {
      const n = 20_000;
      const h = (b - a) / n;
      let sum = f(a) + f(b);
      for (let i = 1; i < n; i += 1) sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
      return (sum * h) / 3;
    };
    // Split at the cusp, where Simpson's rule would not see it.
    return x0 * x1 < 0 ? piece(x0, 0) + piece(0, x1) : piece(x0, x1);
  };

  it('has a standard deviation of one and the tails e^(-sqrt 2 a) / 2', () => {
    expect(laplaceTail(0)).toBe(0.5);
    expect(simpson(-40, 40)).toBeCloseTo(1, 9);
    for (const a of [0.1, 1, 3, 6]) expect(Math.abs(laplaceTail(a) - simpson(a, 60))).toBeLessThan(1e-9);
    // Its variance, by the same rule: x^2 under it.
    const n = 40_000;
    const h = 40 / n;
    let variance = 0;
    for (let i = 0; i < n; i += 1) {
      const x = (i + 0.5) * h;
      variance += 2 * x * x * (Math.exp(-Math.SQRT2 * x) / Math.SQRT2) * h;
    }
    expect(variance).toBeCloseTo(1, 6);
  });

  it('matches its numerical integral, across its cusp, to one side of it, far out and in a sliver', () => {
    const cases = [
      [-0.5, 0.7], [-3.4, 3.2], [1, 4], [-6, -2], [3, 9], [-10, 10], [6, -1],
      [2, 2.3], [-0.2, -0.19], [0.4, 0.405], [0, 1], [-1, 0], [-0.003, 0.004],
    ] as const;
    for (const [x0, x1] of cases) {
      const exact = simpson(x0, x1);
      const column = laplaceAcross(x0, x1) * (x1 - x0);
      expect(Math.abs(column - exact)).toBeLessThan(2e-7);
      if (Math.abs(exact) > 1e-3) expect(Math.abs(column / exact - 1)).toBeLessThan(1e-4);
    }
  });

  it('leaves as much outside its reach as a Gaussian outside DEPTH_REACH', () => {
    expect(depthReach('gaussian')).toBe(DEPTH_REACH);
    expect(2 * laplaceTail(depthReach('laplace'))).toBeCloseTo(2 * normalTail(DEPTH_REACH), 12);
    expect(depthReach('laplace')).toBeCloseTo(5.43, 2);
  });

  it('is what the profile in D sums to: its density, per pc, is the unit one over sigma', () => {
    for (const shape of ['gaussian', 'laplace'] as const) {
      let sum = 0;
      for (let d = 30_000; d < 90_000; d += 1) sum += depthDensity(d + 0.5, 60_000, 2_500, shape);
      expect(sum).toBeCloseTo(1, 6);
    }
    // The Laplace's core sharper, its wings longer: at its mean sqrt(pi) times the Gaussian's.
    expect(depthDensity(60_000, 60_000, 2_500, 'laplace') / depthDensity(60_000, 60_000, 2_500)).toBeCloseTo(Math.sqrt(Math.PI), 9);
  });
});

describe('the stretch of a ray within the maps’ circle', () => {
  it('is where, and only where, the ray is inside the cone of the circle seen from the Sun', async () => {
    const map = await smc();
    const half = map.halfDeg * DEG;
    const inside = (q: Vec3) => q.z > 0 && Math.hypot(q.x / q.z, q.y / q.z) < half;
    // Rays from Earth's side, from the cloud's sides, from beyond it, from within it.
    let seen = 0;
    let wrong = 0;
    for (const [cx, cy, cz] of [[0, 0, 27_440], [35_000, 0, 62_440], [-20_000, 25_000, 50_000], [0, 3_000, 95_000], [500, -300, 62_000]] as const) {
      const o = { x: cx, y: cy, z: cz };
      for (let k = 0; k < 300; k += 1) {
        // Directions spread over the sphere, deterministically.
        const u = (k + 0.5) / 300;
        const z = 1 - 2 * u;
        const phi = k * 2.399963;
        const r = Math.sqrt(1 - z * z);
        const d = { x: r * Math.cos(phi), y: r * Math.sin(phi), z };
        const span: readonly [number, number] = [0, 120_000];
        const got = coneSpan(o, d, half, span);
        const at = (t: number) => ({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t });
        const n = 1_000;
        const inSteps = Array.from({ length: n }, (_, i) => span[0] + ((i + 0.5) / n) * (span[1] - span[0])).filter((t) => inside(at(t)));
        if (got === null) {
          wrong += inSteps.length;
          continue;
        }
        seen += 1;
        // Every point inside the cone is in the stretch, and every point of the stretch inside.
        wrong += inSteps.filter((t) => t < got[0] - 1e-6 || t > got[1] + 1e-6).length;
        wrong += [0.001, 0.5, 0.999].filter((f) => !inside(at(got[0] + f * (got[1] - got[0])))).length;
      }
    }
    expect(wrong).toBe(0);
    expect(seen).toBeGreaterThan(50);
  });
});

describe('its depth grid as a texture', () => {
  const m = 4;
  const grid = (f: (i: number, j: number) => number) =>
    Array.from({ length: m * m }, (_, k) => f(k % m, Math.floor(k / m)));
  const depth = {
    size: m,
    halfDeg: 4,
    old: { shape: 'gaussian' as const, meanKpc: grid((i, j) => 60 + i + 10 * j), sigmaKpc: grid(() => 3) },
    young: { shape: 'laplace' as const, meanKpc: grid((i) => 59 - i), sigmaKpc: grid((_, j) => 2 + j) },
  };

  it('keeps the grid’s order: index j M + i is row j, column i -- rows north, columns east', () => {
    const texels = depthTexels(depth, 62_000);
    expect(texels.length).toBe(m * m * 4);
    // Row 2, column 1.
    const k = 2 * m + 1;
    expect(texels[k * 4]).toBeCloseTo(60 + 1 + 20 - 62, 5);
    expect(texels[k * 4 + 1]).toBe(3);
    expect(texels[k * 4 + 2]).toBeCloseTo(58 - 62, 5);
    expect(texels[k * 4 + 3]).toBe(4);
  });

  it('reads each grid point at its texel’s centre, the east to larger xi, the north to larger eta', () => {
    // Column 1's centre: ((1 + 0.5) / 4 2 - 1) 4 = -1 degree; row 2's, +1.
    const [oldMean, oldSigma, youngMean, youngSigma] = depthAt(depth, -1, 1);
    expect(oldMean).toBeCloseTo(81, 9);
    expect(oldSigma).toBeCloseTo(3, 9);
    expect(youngMean).toBeCloseTo(58, 9);
    expect(youngSigma).toBeCloseTo(4, 9);
    // Halfway to the next column east, and clamped past the edge.
    expect(depthAt(depth, 0, 1)[0]).toBeCloseTo(81.5, 9);
    expect(depthAt(depth, 9, -9)[0]).toBeCloseTo(63, 9);
  });

  it('has the Small Cloud’s young stars nearer in the north-east, as its Cepheids are', async () => {
    const map = await smc();
    expect(depthAt(map.depth, 1, 1)[2]).toBeLessThan(depthAt(map.depth, -1, -1)[2] - 1);
  });
});

describe('a sky map’s description', () => {
  it('reads the Small Cloud’s', async () => {
    const map = await smc();
    expect(map.projection).toBe('sky');
    expect(map.size).toBeGreaterThan(0);
    expect(map.halfPc).toBeCloseTo(map.referencePc * map.halfDeg * DEG, 6);
    expect(map.depth.old.meanKpc.length).toBe(map.depth.size ** 2);
    // Its old stars spread along the line of sight as a Gaussian, its young as a Laplace, as their
    // stars show (tools/galaxies/prepare.py depth_shape).
    expect(map.depth.old.shape).toBe('gaussian');
    expect(map.depth.young.shape).toBe('laplace');
    expect(map.nebula?.bounds.length).toBe(2);
    // Its old stars' light the Small Cloud's less its young stars'.
    const smcGalaxy = GIANTS.find((g) => g.key === 'smc')!;
    const [old, young] = skyScales(smcGalaxy, map)!;
    expect(old * map.oldSum + young * map.sfrSum * 1e6).toBeCloseTo(galaxyLuminosity(smcGalaxy)!, -3);
    expect(young).toBe(YOUNG_V_PER_SFR / 1e6);
  });

  it('rejects what is not one', async () => {
    const real = (await readJson('smc.json')) as Record<string, unknown>;
    const depth = real['depth'] as Record<string, Record<string, number[]>>;
    expect(() => parseSkyMap(null)).toThrow();
    expect(() => parseSkyMap('smc')).toThrow();
    expect(() => parseSkyMap({})).toThrow();
    // A disc's face-on map is not one.
    const lmc = await readJson('lmc.json');
    expect(() => parseSkyMap(lmc)).toThrow();
    expect(() => parseSkyMap({ ...real, centre: [12] })).toThrow();
    expect(() => parseSkyMap({ ...real, bounds: { old: [0, 1], sfr: [0, 1] } })).toThrow();
    expect(() => parseSkyMap({ ...real, nebula: {} })).toThrow();
    expect(() => parseSkyMap({ ...real, depth: undefined })).toThrow();
    const short = { ...depth['old']!, meanKpc: depth['old']!['meanKpc']!.slice(1) };
    expect(() => parseSkyMap({ ...real, depth: { ...depth, old: short } })).toThrow();
    const negative = { ...depth['young']!, sigmaKpc: depth['young']!['sigmaKpc']!.map((v) => -v) };
    expect(() => parseSkyMap({ ...real, depth: { ...depth, young: negative } })).toThrow();
    expect(() => parseSkyMap({ ...real, referencePc: 'far' })).toThrow();
    const odd = { ...depth['young']!, shape: 'cauchy' };
    expect(() => parseSkyMap({ ...real, depth: { ...depth, young: odd } })).toThrow();
  });

  it('reads a map from before its shapes were fitted as Gaussian, as it was drawn', async () => {
    const real = (await readJson('smc.json')) as Record<string, unknown>;
    const depth = real['depth'] as Record<string, Record<string, unknown>>;
    const { shape: _, ...young } = depth['young']!;
    const map = parseSkyMap({ ...real, depth: { ...depth, young } });
    expect(map.depth.young.shape).toBe('gaussian');
    expect(map.depth.young.sigmaKpc).toEqual(depth['young']!['sigmaKpc']);
  });
});
