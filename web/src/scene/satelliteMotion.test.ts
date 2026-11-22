import { describe, expect, it } from 'vitest';

import { IDLE_FRAME_MS } from '../core/renderDemand.ts';
import { bulkStateTeme } from '../core/satelliteBodies.ts';
import { SAT, SATELLITE_FLOATS } from '../core/satellites.ts';
import {
  boundAfter,
  emptySwarmMotion,
  MAX_AGE_MS,
  MAX_PLACED,
  measureSwarm,
  satelliteSwarmRate,
  swarmMotion,
  type SwarmPassInput,
} from './satelliteMotion.ts';
import { swarmRate, transverseRate } from './screenMotion.ts';

const MU = 398_600.435;

/** A small deterministic generator, so a failure is the same failure every run. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Records of every regime the bulk has: LEO shells, GNSS, GEO, Molniya and GTO. */
function records(count: number, seed = 1): Float32Array {
  const rand = random(seed);
  const out = new Float32Array(count * SATELLITE_FLOATS);
  for (let k = 0; k < count; k += 1) {
    const kind = rand();
    let a: number;
    let e: number;
    if (kind < 0.8) {
      a = 6_700 + rand() * 1_200;
      e = rand() * 0.01;
    } else if (kind < 0.88) {
      a = 26_560 + rand() * 1_000;
      e = rand() * 0.02;
    } else if (kind < 0.95) {
      a = 42_164 + (rand() - 0.5) * 200;
      e = rand() * 0.001;
    } else {
      a = 24_000 + rand() * 3_000;
      e = 0.7 + rand() * 0.04;
    }
    const n = Math.sqrt(MU / (a * a * a)) * 86_400;
    const base = k * SATELLITE_FLOATS;
    out[base + SAT.a] = a;
    out[base + SAT.e] = e;
    out[base + SAT.i] = rand() * Math.PI;
    out[base + SAT.node] = rand() * 2 * Math.PI;
    out[base + SAT.peri] = rand() * 2 * Math.PI;
    out[base + SAT.M] = rand() * 2 * Math.PI;
    out[base + SAT.dM] = n;
    out[base + SAT.dNode] = -0.08 * (rand() - 0.2);
    out[base + SAT.dPeri] = 0.06 * (rand() - 0.5);
    out[base + SAT.ddM] = 1e-6 * rand();
    out[base + SAT.ay] = 1e-4 * (rand() - 0.5);
    out[base + SAT.flags] = 0;
  }
  return out;
}

/** A TEME-to-scene rotation of the kind teme.ts makes: about x by the obliquity, a little about z. */
const MATRIX = (() => {
  const c = Math.cos(0.4091);
  const s = Math.sin(0.4091);
  const cz = Math.cos(0.006);
  const sz = Math.sin(0.006);
  return Float64Array.from([cz, sz, 0, -sz * c, cz * c, s, sz * s, -cz * s, c]);
})();

// Under MAX_PLACED, so a pass with nothing settled by ranges places every one.
const COUNT = 1_500;
const RECORDS = records(COUNT);
const CHIPS = new Uint8Array(COUNT);

function input(camera: readonly [number, number, number], over: Partial<SwarmPassInput> = {}): SwarmPassInput {
  return {
    records: RECORDS,
    bulkCount: COUNT,
    dtDays: 2.3,
    matrix: MATRIX,
    chips: CHIPS,
    chipVisible: [1, 1, 1, 1],
    hiddenRecords: [],
    placed: null,
    placedInfo: null,
    cameraX: camera[0],
    cameraY: camera[1],
    cameraZ: camera[2],
    muKm3S2: MU,
    settledRate: 1e-4,
    ...over,
  };
}

/** Record k's scene position, km, `seconds` after the pass's instant. */
function sceneAt(k: number, dtDays: number, seconds: number): [number, number, number] {
  const teme = bulkStateTeme(RECORDS, k, dtDays + seconds / 86_400, new Float64Array(6));
  return [
    MATRIX[0]! * teme[0]! + MATRIX[1]! * teme[1]! + MATRIX[2]! * teme[2]!,
    MATRIX[3]! * teme[0]! + MATRIX[4]! * teme[1]! + MATRIX[5]! * teme[2]!,
    MATRIX[6]! * teme[0]! + MATRIX[7]! * teme[1]! + MATRIX[8]! * teme[2]!,
  ];
}

/**
 * The fastest any record really crosses the view from `camera`, radians a second, `seconds`
 * after the pass: its velocity by a finite difference, so the node's and perigee's drift and
 * the drag term are in it, as they are on the GPU.
 */
function trueRate(camera: readonly [number, number, number], dtDays: number, seconds: number, extra: readonly [number, number, number] = [0, 0, 0]): number {
  let fastest = 0;
  const h = 0.01;
  for (let k = 0; k < COUNT; k += 1) {
    const p0 = sceneAt(k, dtDays, seconds - h);
    const p1 = sceneAt(k, dtDays, seconds + h);
    const p = sceneAt(k, dtDays, seconds);
    const rate = transverseRate(
      p[0] - camera[0],
      p[1] - camera[1],
      p[2] - camera[2],
      (p1[0] - p0[0]) / (2 * h) + extra[0],
      (p1[1] - p0[1]) / (2 * h) + extra[1],
      (p1[2] - p0[2]) / (2 * h) + extra[2],
    );
    fastest = Math.max(fastest, rate);
  }
  return fastest;
}

describe('a pass over the swarm', () => {
  // The default view of Earth is some 30,000 km out; GEO's ring, GNSS's and the Molniyas
  // all cross that distance, so the shells' bound there is infinite.
  const cameras: [string, [number, number, number]][] = [
    ['the default view of Earth', [18_000, -21_000, 9_000]],
    ['inside GEO', [0, 35_000, 12_000]],
    ['just past GEO', [44_000, 3_000, -2_000]],
    ['beside the GNSS shell', [-20_000, 18_000, 4_000]],
    ['the Moon’s distance', [300_000, 200_000, 10_000]],
  ];

  it.each(cameras)('bounds every dot from %s, finitely where the shells say infinite', (_, camera) => {
    const motion = measureSwarm(input(camera), 0, emptySwarmMotion());
    const bound = boundAfter(motion, ...camera, 0, 0);
    expect(Number.isFinite(bound)).toBe(true);
    expect(bound).toBeGreaterThanOrEqual(trueRate(camera, 2.3, 0));
    if (Math.hypot(...camera) < 1e6) expect(swarmRate(Math.hypot(...camera), MU)).toBe(Infinity);
  });

  it('is not loose: within a few times the fastest dot really is', () => {
    for (const [, camera] of cameras) {
      const motion = measureSwarm(input(camera, { settledRate: 0 }), 0, emptySwarmMotion());
      // Each dot's speed is taken at its perigee and all of it as across the view: up to a few
      // times what the fastest dot shows, never orders of magnitude.
      expect(motion.rate).toBeLessThan(5 * trueRate(camera, 2.3, 0));
    }
  });

  it('still holds a second on, with the camera moved and Earth moving about it', () => {
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    const moved: [number, number, number] = [18_400, -20_700, 9_100];
    const extra: [number, number, number] = [0.6, -0.8, 0.1];
    const motion = measureSwarm(input(camera), 0, emptySwarmMotion());
    const ageMs = 900;
    const bound = boundAfter(motion, ...moved, Math.hypot(...extra), ageMs);
    // Anywhere from now to the longest live mode then waits for the next frame.
    for (const seconds of [ageMs / 1000, (ageMs + IDLE_FRAME_MS / 2) / 1000, (ageMs + IDLE_FRAME_MS) / 1000]) {
      expect(bound).toBeGreaterThanOrEqual(trueRate(moved, 2.3, seconds, extra));
    }
    expect(bound).toBeGreaterThan(motion.rate);
  });

  it('goes infinite once the camera may have reached the nearest dot, and silent once too old', () => {
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    const motion = measureSwarm(input(camera), 0, emptySwarmMotion());
    const toward = motion.nearestKm / Math.hypot(...camera);
    expect(boundAfter(motion, camera[0] * (1 - toward), camera[1] * (1 - toward), camera[2] * (1 - toward), 0, 10)).toBe(Infinity);
    expect(boundAfter(motion, ...camera, 0, MAX_AGE_MS + 1)).toBeNaN();
    expect(boundAfter(motion, ...camera, 0, -1)).toBeNaN();
    expect(boundAfter(emptySwarmMotion(), ...camera, 0, 0)).toBeNaN();
  });

  it('places only the dots their radius ranges cannot clear, and their answer is the same', () => {
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    const settled = measureSwarm(input(camera, { settledRate: 1e-4 }), 0, emptySwarmMotion());
    const all = measureSwarm(input(camera, { settledRate: 0 }), 0, emptySwarmMotion());
    // Every record placed is the tightest pass; settling by ranges may only loosen it, and only
    // up to the settled rate.
    expect(settled.rate).toBeGreaterThanOrEqual(all.rate);
    expect(settled.rate).toBeLessThanOrEqual(Math.max(all.rate, 1e-4));
    expect(settled.fastestKmS).toBe(all.fastestKmS);
  });

  it('with more unsettled dots than it places, goes by their ranges: infinite inside one', () => {
    const many = records(MAX_PLACED + 500, 7);
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    const over = { records: many, bulkCount: MAX_PLACED + 500, chips: new Uint8Array(MAX_PLACED + 500), settledRate: 0 };
    // A Molniya's range, perigee to apogee, takes in the camera.
    expect(measureSwarm(input(camera, over), 0, emptySwarmMotion()).rate).toBe(Infinity);
  });

  it('leaves out chips not drawn and records that are bodies of their own', () => {
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    const none = measureSwarm(input(camera, { chipVisible: [0, 0, 0, 0] }), 5, emptySwarmMotion());
    expect(none.any).toBe(false);
    expect(boundAfter(none, ...camera, 0, 5)).toBe(0);
    // The dot nearest the camera, hidden: the pass no longer counts it.
    const all = measureSwarm(input(camera, { settledRate: 0 }), 0, emptySwarmMotion());
    let nearest = 0;
    let best = Infinity;
    for (let k = 0; k < COUNT; k += 1) {
      const p = sceneAt(k, 2.3, 0);
      const d = Math.hypot(p[0] - camera[0], p[1] - camera[1], p[2] - camera[2]);
      if (d < best) {
        best = d;
        nearest = k;
      }
    }
    const without = measureSwarm(input(camera, { settledRate: 0, hiddenRecords: [nearest] }), 0, emptySwarmMotion());
    expect(without.nearestKm).toBeGreaterThan(all.nearestKm);
  });

  it('counts the SGP4 tier where it is drawn, by escape speed where it is', () => {
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    const placed = Float32Array.from([17_000, -20_000, 8_500, 0, 7_000, 0]);
    const info = Float32Array.from([0, 0, 1, 0, 0, 0]);
    const motion = measureSwarm(input(camera, { bulkCount: 0, placed, placedInfo: info }), 0, emptySwarmMotion());
    const d = Math.hypot(1_000, 1_000, 500);
    const r = Math.hypot(17_000, -20_000, 8_500);
    expect(motion.any).toBe(true);
    expect(motion.rate).toBeCloseTo((Math.sqrt((2 * MU) / r) * 1.01) / (d - 5), 9);
    info[2] = 0;
    expect(measureSwarm(input(camera, { bulkCount: 0, placed, placedInfo: info }), 0, emptySwarmMotion()).any).toBe(false);
  });
});

describe('the scene’s rate for the swarm', () => {
  it('is the shells’ bound with no pass, and never more than it with one', () => {
    swarmMotion.atMs = Number.NaN;
    const far: [number, number, number] = [3e6, 0, 0];
    expect(satelliteSwarmRate(...far, MU, 0, 0)).toBe(swarmRate(3e6, MU, 0));
    const camera: [number, number, number] = [18_000, -21_000, 9_000];
    measureSwarm(input(camera), 100, swarmMotion);
    const rate = satelliteSwarmRate(...camera, MU, 0, 150);
    expect(Number.isFinite(rate)).toBe(true);
    expect(rate).toBeLessThanOrEqual(swarmRate(Math.hypot(...camera), MU, 0));
    measureSwarm(input(far), 100, swarmMotion);
    expect(satelliteSwarmRate(...far, MU, 0, 150)).toBeLessThanOrEqual(swarmRate(3e6, MU, 0));
    swarmMotion.atMs = Number.NaN;
  });
});
