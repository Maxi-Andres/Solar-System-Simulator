import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { astrometricState } from './alphaCentauri.ts';
import { GIANTS, galaxyLuminosity, YOUNG_V_PER_SFR } from './localGroup.ts';
import {
  depthAt,
  depthDensity,
  depthTexels,
  DEPTH_REACH,
  fromSun,
  parseSkyMap,
  skyBox,
  skyFrame,
  skyScales,
  SKY_STEPS,
  standardCoordinates,
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

/**
 * The shader's march (SkyVolume.tsx), one channel: from `camera` (the map's frame about the
 * Sun, pc) along `d`, `steps` steps at `jitter` across [t0, t1], the light j = Sigma N(D).
 */
function marched(
  map: SkyMap,
  sigmaAt: (xiDeg: number, etaDeg: number) => number,
  camera: Vec3,
  d: Vec3,
  span: readonly [number, number],
  steps: number,
  jitter: number,
  kind: 'old' | 'young' = 'old',
  cut = true,
): number {
  const dt = (span[1] - span[0]) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i += 1) {
    const t = span[0] + (i + jitter) * dt;
    const q = { x: camera.x + d.x * t, y: camera.y + d.y * t, z: camera.z + d.z * t };
    const s = standardCoordinates(q)!;
    if (Math.abs(s.xiDeg) >= map.halfDeg || Math.abs(s.etaDeg) >= map.halfDeg) continue;
    const [om, os, ym, ys] = depthAt(map.depth, s.xiDeg, s.etaDeg);
    const [mean, sigma] = kind === 'old' ? [om, os] : [ym, ys];
    const distance = Math.hypot(q.x, q.y, q.z);
    // Past 4.3 sigmas of both kinds the shader reads nothing.
    const x = Math.min(Math.abs(distance - om * 1000) / (os * 1000), Math.abs(distance - ym * 1000) / (ys * 1000));
    if (cut && Math.exp(-0.5 * x * x) < 1e-4) continue;
    sum += sigmaAt(s.xiDeg, s.etaDeg) * depthDensity(distance, mean * 1000, sigma * 1000) * dt;
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
  it('sums, along any ray from the Sun, to the map: the Gaussian in D holds all of it', async () => {
    const map = await smc();
    const sigma = 3.7;
    for (const [xi, eta] of [[0, 0], [1.2, 0.8], [-2.5, -1], [3, -3.5]] as const) {
      // The ray's direction in the map's frame: (xi, eta, 1), normalised.
      const n = Math.hypot(xi * DEG, eta * DEG, 1);
      const d = { x: (xi * DEG) / n, y: (eta * DEG) / n, z: 1 / n };
      for (const kind of ['old', 'young'] as const) {
        // Finely, from the Sun out to 150 kpc.
        const column = marched(map, () => sigma, { x: 0, y: 0, z: 0 }, d, [0, 150_000], 30_000, 0.5, kind, false);
        expect(column / sigma).toBeCloseTo(1, 6);
        // The shader's tails past 4.3 sigmas, left out, are less than a ten-thousandth of it.
        const cut = marched(map, () => sigma, { x: 0, y: 0, z: 0 }, d, [0, 150_000], 30_000, 0.5, kind);
        expect(1 - cut / sigma).toBeLessThan(1e-4);
      }
    }
  });

  it('sums to the map in the shader’s box and steps, from where the camera looks at it from Earth’s side', async () => {
    const map = await smc();
    const box = skyBox(map);
    // galaxyFramingKm: 28 scale lengths of 1.25 kpc from the centre, on the Sun's side.
    const camera = { x: 0, y: 0, z: map.referencePc - 35_000 };
    const boxAboutSun = { ...box.centre, z: box.centre.z + map.referencePc };
    const sigma = 1;
    for (const [xi, eta] of [[0, 0], [1.5, 1], [-2, -0.5]] as const) {
      // The ray from the camera to the point at (xi, eta) at the reference distance.
      const target = { x: xi * DEG * map.referencePc, y: eta * DEG * map.referencePc, z: map.referencePc };
      const r = Math.hypot(target.x - camera.x, target.y - camera.y, target.z - camera.z);
      const d = { x: (target.x - camera.x) / r, y: (target.y - camera.y) / r, z: (target.z - camera.z) / r };
      const span = slab(camera, d, boxAboutSun, box.half);
      const exact = marched(map, () => sigma, camera, d, span, 20_000, 0.5);
      // Off the Sun's line of sight the ray crosses directions, but at 35 kpc not by much.
      expect(exact).toBeGreaterThan(0.97);
      expect(exact).toBeLessThan(1.03);
      // One jitter at a time, as one pixel sees it, SKY_STEPS steps: within 0.1 % of the fine column.
      for (const jitter of [0.05, 0.3, 0.55, 0.8]) {
        const step = marched(map, () => sigma, camera, d, span, SKY_STEPS, jitter);
        expect(Math.abs(step / exact - 1)).toBeLessThan(0.001);
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
});

describe('its depth grid as a texture', () => {
  const m = 4;
  const grid = (f: (i: number, j: number) => number) =>
    Array.from({ length: m * m }, (_, k) => f(k % m, Math.floor(k / m)));
  const depth = {
    size: m,
    halfDeg: 4,
    old: { meanKpc: grid((i, j) => 60 + i + 10 * j), sigmaKpc: grid(() => 3) },
    young: { meanKpc: grid((i) => 59 - i), sigmaKpc: grid((_, j) => 2 + j) },
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
  });
});
