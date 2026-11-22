import { IDLE_FRAME_MS } from '../core/renderDemand.ts';
import { bulkStateTeme } from '../core/satelliteBodies.ts';
import { SAT, SATELLITE_FLOATS } from '../core/satellites.ts';
import { applyMatrix } from '../core/teme.ts';
import { swarmRate } from './screenMotion.ts';

/**
 * How fast Earth's satellites can cross the screen, from where they are: live mode's frame
 * rate with the Satellites layer on (renderDemand.ts).
 *
 * The scene used to bound the swarm by its shells alone (screenMotion.ts swarmRate): no
 * satellite faster than escape speed at a shell's inner edge, none nearer the camera than the
 * shell's nearest edge. With the camera anywhere from 6,500 to a million kilometres from Earth
 * it is inside a shell, a satellite could be passing at any distance, and the bound is
 * infinite: every vsync, sixty frames a second, at the default view of Earth and every view
 * near it -- half a core and the GPU never resting, to draw dots that cross a third of a pixel
 * a second. But a satellite is not anywhere; the swarm's dots are where the bulk model and SGP4
 * put them, and the nearest of them is thousands of kilometres from the camera at any view
 * the layer is seen from.
 *
 * So every so often the swarm (SatelliteSwarm.tsx) works out, over the dots it draws, the
 * fastest any can cross the view -- each one's top speed over its distance from the camera --
 * and keeps that with the nearest distance and the top speed of all. The scene's frame asks
 * for it (`satelliteSwarmRate`), and between two such passes it holds whatever happens: the
 * dots have moved since by at most their top speed times the time gone by, the camera by what
 * it has, and every distance is shrunk by both before it is used (`boundAfter`) -- an upper
 * bound that only loosens, never one too low. Past MAX_AGE_MS, or with the camera moved as far
 * as the nearest dot, it is the shells' bound again.
 *
 * A pass is cheap: each bulk record is first judged by its radius range alone -- perigee to
 * apogee, which no position of it leaves -- and only one that range cannot clear of the camera
 * is placed, by the bulk model's own recipe (satelliteBodies.ts bulkStateTeme), as the GPU
 * places it: from the default view of Earth, the few whose orbits reach out past the camera's
 * distance -- the high, eccentric ones -- not the LEO thousands. The SGP4 tier's places are the
 * ones the swarm wrote this frame.
 */

/** Taken off every distance, km: the float32 the GPU places a dot with, and the mirror's own rounding, many times over. */
export const DISTANCE_MARGIN_KM = 5;
/**
 * Put on every top speed: the bulk model's node and perigee drift and its drag term add about a
 * thousandth to the ellipse's speed in LEO (satelliteBodies.ts bulkStateTeme); this is ten.
 */
export const SPEED_MARGIN = 1.01;
/** How old a pass may be and still be used, ms; past it, the shells' bound. */
export const MAX_AGE_MS = 1000;
/** A pass at most this often while nothing moves, ms. */
export const PASS_EVERY_MS = 250;
/**
 * More bulk records than this the radius ranges cannot clear, and they are not placed one by
 * one: the camera is in the thick of a shell, where some satellite is near enough to want
 * every vsync anyway, and the ranges' own bound says so.
 */
export const MAX_PLACED = 2000;

/** What a pass found. */
export interface SwarmMotion {
  /** Whether any dot was drawn then; none, and nothing of the swarm moves on the screen. */
  any: boolean;
  /** The fastest any dot crossed the view then, radians a second: its top speed over its distance. */
  rate: number;
  /** The nearest any dot was to the camera then, km, DISTANCE_MARGIN_KM taken off. Never more than the distances `rate` used. */
  nearestKm: number;
  /** The top speed of any dot drawn, km/s. */
  fastestKmS: number;
  /** The camera's place about Earth then, scene frame, km. */
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  /** When, performance.now() milliseconds; NaN before the first pass. */
  atMs: number;
}

export function emptySwarmMotion(): SwarmMotion {
  return { any: false, rate: 0, nearestKm: Infinity, fastestKmS: 0, cameraX: 0, cameraY: 0, cameraZ: 0, atMs: Number.NaN };
}

/** The swarm's latest pass, written by SatelliteSwarm and read by the scene's frame. */
export const swarmMotion: SwarmMotion = emptySwarmMotion();

/** What a pass looks at: the dots the swarm draws, and where the camera is. */
export interface SwarmPassInput {
  /** The bulk's records (core/satellites.ts) and how many are drawn, or none outside the bulk's window. */
  readonly records: Float32Array;
  readonly bulkCount: number;
  /** UTC days from the bulk's reference instant. */
  readonly dtDays: number;
  /** TEME to the scene frame (core/teme.ts satelliteInstant). */
  readonly matrix: ArrayLike<number>;
  /** Each bulk record's chip, and which chips are drawn (1) or not (0). */
  readonly chips: Uint8Array;
  readonly chipVisible: ArrayLike<number>;
  /** Bulk records that are bodies of their own just now, their dots hidden. */
  readonly hiddenRecords: readonly number[];
  /**
   * The SGP4 tier's places this frame, Earth-centred scene km, three a satellite, and its info
   * buffer, whose third float a satellite is 1 where it is drawn (SatelliteSwarm writePlacedTier).
   */
  readonly placed: Float32Array | null;
  readonly placedInfo: Float32Array | null;
  /** The camera about Earth, scene frame, km. */
  readonly cameraX: number;
  readonly cameraY: number;
  readonly cameraZ: number;
  /** Earth's GM, km^3/s^2. */
  readonly muKm3S2: number;
  /**
   * A record whose radius range alone bounds it below this, radians a second, is not placed:
   * the swarm's rate matters only down to the slowest live mode draws at anyway.
   */
  readonly settledRate: number;
}

const scratchTeme = new Float64Array(6);
const scratchScene = new Float64Array(3);

/**
 * One pass over the dots drawn, into `out`. Allocates nothing.
 *
 * A bulk record's eccentricity is its mean one plus J3's offset at most, its radius between
 * a(1 - e) and a(1 + e) whatever its angles, and its speed under perigee's, sqrt(mu (1 + e) /
 * (a (1 - e))); an SGP4 dot's speed is under escape speed where it is.
 */
export function measureSwarm(input: SwarmPassInput, nowMs: number, out: SwarmMotion): SwarmMotion {
  const { records, chips, chipVisible, hiddenRecords, cameraX, cameraY, cameraZ, muKm3S2 } = input;
  const cameraR = Math.hypot(cameraX, cameraY, cameraZ);
  let any = false;
  let rate = 0;
  let nearest = Infinity;
  let fastest = 0;
  // First the ranges: what each record's alone says; those it does not settle, counted.
  let unsettled = 0;
  for (let k = 0; k < input.bulkCount; k += 1) {
    if (chipVisible[chips[k]!] === 0 || k === hiddenRecords[0] || k === hiddenRecords[1]) continue;
    const base = k * SATELLITE_FLOATS;
    const a = records[base + SAT.a]!;
    const e = Math.min(records[base + SAT.e]! + Math.abs(records[base + SAT.ay]!), 0.999);
    const speed = Math.sqrt((muKm3S2 * (1 + e)) / (a * (1 - e))) * SPEED_MARGIN;
    const perigee = a * (1 - e);
    const apogee = a * (1 + e);
    const gap = (cameraR > apogee ? cameraR - apogee : cameraR < perigee ? perigee - cameraR : 0) - DISTANCE_MARGIN_KM;
    any = true;
    if (speed > fastest) fastest = speed;
    if (gap > 0 && speed / gap <= input.settledRate) {
      if (speed / gap > rate) rate = speed / gap;
      if (gap < nearest) nearest = gap;
    } else {
      unsettled += 1;
    }
  }
  // Then the ones the ranges did not settle, each placed -- unless there are so many that the
  // camera is among them, where their ranges' bound stands.
  if (unsettled > 0) {
    const place = unsettled <= MAX_PLACED;
    for (let k = 0; k < input.bulkCount; k += 1) {
      if (chipVisible[chips[k]!] === 0 || k === hiddenRecords[0] || k === hiddenRecords[1]) continue;
      const base = k * SATELLITE_FLOATS;
      const a = records[base + SAT.a]!;
      const e = Math.min(records[base + SAT.e]! + Math.abs(records[base + SAT.ay]!), 0.999);
      const speed = Math.sqrt((muKm3S2 * (1 + e)) / (a * (1 - e))) * SPEED_MARGIN;
      const perigee = a * (1 - e);
      const apogee = a * (1 + e);
      let distance = (cameraR > apogee ? cameraR - apogee : cameraR < perigee ? perigee - cameraR : 0) - DISTANCE_MARGIN_KM;
      if (distance > 0 && speed / distance <= input.settledRate) continue;
      if (place) {
        bulkStateTeme(records, k, input.dtDays, scratchTeme);
        applyMatrix(input.matrix as Float64Array, scratchTeme[0]!, scratchTeme[1]!, scratchTeme[2]!, scratchScene, 0);
        distance = Math.hypot(scratchScene[0]! - cameraX, scratchScene[1]! - cameraY, scratchScene[2]! - cameraZ) - DISTANCE_MARGIN_KM;
      }
      if (!(distance > 0)) {
        rate = Infinity;
        nearest = 0;
        continue;
      }
      if (speed / distance > rate) rate = speed / distance;
      if (distance < nearest) nearest = distance;
    }
  }
  // The SGP4 tier, from where the swarm put each dot this frame.
  const { placed, placedInfo } = input;
  if (placed !== null && placedInfo !== null) {
    for (let k = 0; k < placed.length / 3; k += 1) {
      if (!(placedInfo[k * 3 + 2]! > 0)) continue;
      const x = placed[k * 3]!;
      const y = placed[k * 3 + 1]!;
      const z = placed[k * 3 + 2]!;
      const speed = Math.sqrt((2 * muKm3S2) / Math.hypot(x, y, z)) * SPEED_MARGIN;
      const distance = Math.hypot(x - cameraX, y - cameraY, z - cameraZ) - DISTANCE_MARGIN_KM;
      any = true;
      if (speed > fastest) fastest = speed;
      if (!(distance > 0)) {
        rate = Infinity;
        nearest = 0;
        continue;
      }
      if (speed / distance > rate) rate = speed / distance;
      if (distance < nearest) nearest = distance;
    }
  }
  out.any = any;
  out.rate = any ? rate : 0;
  out.nearestKm = nearest;
  out.fastestKmS = fastest;
  out.cameraX = cameraX;
  out.cameraY = cameraY;
  out.cameraZ = cameraZ;
  out.atMs = nowMs;
  return out;
}

/**
 * The pass's bound carried to `nowMs` and to a camera at (x, y, z) about Earth, and on over the
 * longest live mode may then wait for a frame (IDLE_FRAME_MS: one comes at least that often,
 * whatever the scene says), radians a second; `extraKmS` is
 * Earth's own speed about the camera. Infinite once the dots or the camera may have closed the
 * nearest distance; NaN when the pass is too old to say (MAX_AGE_MS) or there has been none.
 *
 * Every dot was at least `nearestKm` away and at most `fastestKmS` fast; since then each has
 * come at most s = (camera's move) + (fastest + extra) x (time) nearer, so each dot's rate,
 * (v + extra) / (d - s), is at most (rate + extra / nearest) / (1 - s / nearest).
 */
export function boundAfter(motion: SwarmMotion, x: number, y: number, z: number, extraKmS: number, nowMs: number): number {
  const age = nowMs - motion.atMs;
  if (!(age >= 0 && age <= MAX_AGE_MS)) return Number.NaN;
  if (!motion.any) return 0;
  const moved = Math.hypot(x - motion.cameraX, y - motion.cameraY, z - motion.cameraZ);
  const shrink = moved + (motion.fastestKmS + extraKmS) * ((age + IDLE_FRAME_MS) / 1000);
  if (!(shrink < motion.nearestKm)) return Infinity;
  return (motion.rate + extraKmS / motion.nearestKm) / (1 - shrink / motion.nearestKm);
}

/**
 * The fastest any of Earth's satellites drawn as dots can cross the view, radians a second,
 * from a camera at (x, y, z) km about Earth: the swarm's latest pass carried to now
 * (`boundAfter`), and never more than the shells' bound (screenMotion.ts swarmRate), which
 * stands alone when there is no pass to go by. Both are upper bounds, so the smaller is one.
 */
export function satelliteSwarmRate(x: number, y: number, z: number, muKm3S2: number, extraKmS: number, nowMs: number = performance.now()): number {
  const shells = swarmRate(Math.hypot(x, y, z), muKm3S2, extraKmS);
  const measured = boundAfter(swarmMotion, x, y, z, extraKmS, nowMs);
  return Number.isNaN(measured) ? shells : Math.min(shells, measured);
}
