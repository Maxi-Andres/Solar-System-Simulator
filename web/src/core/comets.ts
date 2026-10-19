import type { BeltInfo, CometInfo } from '@sss/tools/types';

import { decodeBeltRecords, loadBeltInfo, type BeltFetchers } from './belt.ts';
import { RETRY_AFTER_MS } from './chunkedTable.ts';
import { conicPosition, type PerifocalState } from './conic.ts';
import { renderDemand } from './renderDemand.ts';

/**
 * The comets: SBDB's four thousand, each on its own conic about the Sun.
 *
 * Read from `belt/comets.json` and the records beside it (step B2c), named in belt.json
 * and fetched only when the Comets layer is on. Unlike the belt, they are placed on the
 * CPU, in float64, by universal variables (see conic.ts): a third of them are on
 * parabolas or hyperbolas, many more on ellipses with e = 0.999, and four thousand is
 * few enough that doing it properly costs 1.6 ms a frame and nothing per frame while the
 * clock is paused.
 */

/**
 * Floats per comet: COMET_RECORD_FLOATS, restated as the belt's is. The same nine floats,
 * four bytes each, so the belt's decoder reads them.
 */
export const COMET_FLOATS = 9;

/** Where each element sits in a comet record. The order is the file's. */
export const COMET = {
  q: 0,
  e: 1,
  i: 2,
  node: 3,
  peri: 4,
  tp: 5,
  M1: 6,
  K1: 7,
  class: 8,
} as const;

export interface Comets {
  readonly info: CometInfo;
  readonly records: Float32Array;
  /**
   * Each comet's perifocal axes in the ecliptic, six numbers apiece -- P, towards
   * perihelion, then Q, along the motion there -- worked out once, so the frame loop does
   * a conic and two multiply-adds per comet and no trigonometry of the orientation.
   */
  readonly axes: Float64Array;
  /**
   * The total magnitude parameter drawn for a comet SBDB gives none: the median of those
   * it does. See cometMagnitude.
   */
  readonly fallbackM1: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Checks comets.json is the shape the renderer expects; loud, as belt.json's check is. */
export function parseCometInfo(raw: unknown): CometInfo {
  if (!isRecord(raw)) {
    throw new Error('comets.json did not contain an object.');
  }
  if (raw['recordFloats'] !== COMET_FLOATS) {
    throw new Error(
      `comets.json has ${String(raw['recordFloats'])} floats per comet; this app reads ${COMET_FLOATS}.`,
    );
  }
  const count = raw['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('comets.json has no usable comet count.');
  }
  const file = raw['file'];
  if (typeof file !== 'string' || !/^[\w.-]+$/.test(file) || file.startsWith('.')) {
    throw new Error('comets.json does not name its records file.');
  }
  if (raw['bytes'] !== count * COMET_FLOATS * 4) {
    throw new Error(`comets.json says ${String(raw['bytes'])} bytes for ${count} comets.`);
  }
  const names = raw['names'];
  if (!Array.isArray(names) || names.length !== count) {
    throw new Error('comets.json does not name every comet.');
  }
  const referenceJd = raw['referenceJd'];
  if (typeof referenceJd !== 'number' || !Number.isFinite(referenceJd)) {
    throw new Error('comets.json does not say when its perihelion times are counted from.');
  }
  return raw as unknown as CometInfo;
}

/**
 * Every record an orbit the propagator can follow: a positive perihelion distance, a
 * non-negative eccentricity, and finite angles and time. M1 and K1 may be NaN -- about
 * half of SBDB's comets have no magnitude parameters -- and are not checked.
 */
export function checkCometRecords(records: Float32Array): void {
  for (let base = 0; base < records.length; base += COMET_FLOATS) {
    const q = records[base + COMET.q]!;
    const e = records[base + COMET.e]!;
    const finite = [COMET.i, COMET.node, COMET.peri, COMET.tp].every((k) =>
      Number.isFinite(records[base + k]!),
    );
    if (!(q > 0) || !(e >= 0) || !Number.isFinite(e) || !finite) {
      throw new Error(`Comet ${base / COMET_FLOATS} is not on a conic: q = ${q} km, e = ${e}.`);
    }
  }
}

/**
 * The perifocal axes of every comet in the ecliptic: P towards perihelion and Q along the
 * motion there, from the node, the inclination and the argument of perihelion -- the
 * same 3-1-3 rotation kepler.ts's perifocalToReference does.
 */
export function cometAxes(records: Float32Array): Float64Array {
  const count = records.length / COMET_FLOATS;
  const axes = new Float64Array(count * 6);
  for (let k = 0; k < count; k += 1) {
    const base = k * COMET_FLOATS;
    const node = records[base + COMET.node]!;
    const i = records[base + COMET.i]!;
    const peri = records[base + COMET.peri]!;
    const cN = Math.cos(node);
    const sN = Math.sin(node);
    const cI = Math.cos(i);
    const sI = Math.sin(i);
    const cW = Math.cos(peri);
    const sW = Math.sin(peri);
    axes.set(
      [
        cN * cW - sN * sW * cI,
        sN * cW + cN * sW * cI,
        sW * sI,
        -cN * sW - sN * cW * cI,
        -sN * sW + cN * cW * cI,
        cW * sI,
      ],
      k * 6,
    );
  }
  return axes;
}

/** The median of the M1s SBDB gives; 12 if it gives none, which no real catalogue does. */
export function medianM1(records: Float32Array): number {
  const known: number[] = [];
  for (let base = COMET.M1; base < records.length; base += COMET_FLOATS) {
    const m = records[base]!;
    if (Number.isFinite(m)) {
      known.push(m);
    }
  }
  if (known.length === 0) {
    return 12;
  }
  known.sort((a, b) => a - b);
  return known[Math.floor(known.length / 2)]!;
}

/**
 * The slope drawn for a comet SBDB gives no K1: 10, which is 2.5·n with n = 4 -- the
 * brightening with the inverse fourth power of the Sun's distance that is the long-
 * standing default for a comet whose own has not been measured.
 */
export const FALLBACK_K1 = 10;

/**
 * A comet's total magnitude at `rAu` from the Sun, seen from one AU: SBDB's
 * m = M1 + 5 log10(delta) + K1 log10(r) with delta held at 1. Not its magnitude from
 * Earth or from the camera, which would make the same comet brighter when the camera
 * moved closer -- this says how bright the comet itself is, now, which is how active it
 * is: a comet at perihelion is tens of magnitudes brighter than the same nucleus out
 * past Jupiter.
 *
 * Where SBDB has no M1 or K1 the fallbacks stand in (`fallbackM1`, FALLBACK_K1), so
 * half the catalogue is not left without a brightness. **A convention, stated as one**:
 * such a comet is drawn as a typical comet would be at its distance, which is all that
 * can be said about it.
 */
export function cometMagnitude(M1: number, K1: number, rAu: number, fallbackM1: number): number {
  const m1 = Number.isFinite(M1) ? M1 : fallbackM1;
  const k1 = Number.isFinite(K1) ? K1 : FALLBACK_K1;
  return m1 + k1 * Math.log10(Math.max(rAu, 1e-3));
}

const AU_KM = 149_597_870.7;

/** Scratch for the frame loop's conic, so it allocates nothing. */
const perifocal: PerifocalState = { x: 0, y: 0, vx: 0, vy: 0 };

/**
 * Comet `k`'s heliocentric position `jd` (TDB) into `out` at `out[k*3]`, km, ecliptic
 * of J2000; returns its distance from the Sun in AU. `mu` is the Sun's GM, km^3/s^2.
 *
 * tp is days after the reference instant in float32: its step is six minutes for a
 * perihelion within 180 years of it, an hour and a half at the oldest. A comet's place is
 * that far off in time along its path -- at a sungrazer's 600 km/s at perihelion, about
 * 200,000 km; for the rest, which move at tens of km/s, ten thousand or less, against a
 * two-body model that is off by far more for any comet that has passed a planet.
 */
export function cometPosition(comets: Comets, k: number, jd: number, mu: number, out: Float64Array): number {
  const { records, axes, info } = comets;
  const base = k * COMET_FLOATS;
  const days = jd - info.referenceJd - records[base + COMET.tp]!;
  conicPosition(records[base + COMET.q]!, records[base + COMET.e]!, days, mu, perifocal);
  const a = k * 6;
  const { x, y } = perifocal;
  out[k * 3] = axes[a]! * x + axes[a + 3]! * y;
  out[k * 3 + 1] = axes[a + 1]! * x + axes[a + 4]! * y;
  out[k * 3 + 2] = axes[a + 2]! * x + axes[a + 5]! * y;
  return Math.hypot(x, y) / AU_KM;
}

/**
 * Reads the comets belt.json names, or null when the data has none -- data from before
 * step B2c, or a belt.json that is not there at all.
 */
export async function loadComets(fetchers: BeltFetchers, basePath = '/'): Promise<Comets | null> {
  const belt: BeltInfo | null = await loadBeltInfo(fetchers, basePath);
  if (belt?.comets === undefined) {
    if (belt !== null) {
      console.info('The published data has no comets. Regenerate it to draw them.');
    }
    return null;
  }
  const info = parseCometInfo(await fetchers.json(`${basePath}data/belt/${belt.comets.file}`));
  const buffer = await fetchers.binary(`${basePath}data/belt/${info.file}`, {
    expectedBytes: info.bytes,
  });
  if (buffer === null) {
    throw new Error(`comets.json names ${info.file}, which is not there.`);
  }
  // The same nine float32s a record as the belt, so the same decoder and byte check.
  const records = decodeBeltRecords(buffer, info.count);
  checkCometRecords(records);
  return { info, records, axes: cometAxes(records), fallbackM1: medianM1(records) };
}

/**
 * The comets, asked for once and kept, as the belt's first tier is: 150 KB, fetched the
 * first time the Comets layer is on. A failure may be asked again after RETRY_AFTER_MS.
 */
export class CometSource {
  readonly #load: () => Promise<Comets | null>;
  readonly #settled: () => void;
  #comets: Comets | null = null;
  #state: 'idle' | 'loading' | 'ready' | 'absent' | 'failed' = 'idle';
  #failedAt = 0;
  readonly #listeners = new Set<() => void>();

  constructor(load: () => Promise<Comets | null>, settled: () => void = () => renderDemand.request()) {
    this.#load = load;
    this.#settled = settled;
  }

  get comets(): Comets | null {
    return this.#comets;
  }

  get state(): 'idle' | 'loading' | 'ready' | 'absent' | 'failed' {
    return this.#state;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  request(): Promise<void> {
    if (this.#state === 'loading' || this.#state === 'ready' || this.#state === 'absent') {
      return Promise.resolve();
    }
    if (this.#state === 'failed' && Date.now() - this.#failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    this.#state = 'loading';
    return this.#load()
      .then((comets) => {
        this.#comets = comets;
        this.#state = comets === null ? 'absent' : 'ready';
        for (const listener of this.#listeners) {
          listener();
        }
      })
      .catch((error: unknown) => {
        this.#state = 'failed';
        this.#failedAt = Date.now();
        console.error('Could not load the comets', error);
      })
      .finally(() => {
        this.#settled();
      });
  }
}
