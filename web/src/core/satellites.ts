import type { NamedSatellite, SatelliteInfo, SatelliteNames, SgpSatellite } from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import { normalizeName } from './search.ts';
import type { Searchable } from './beltNames.ts';
import { RETRY_AFTER_MS } from './chunkedTable.ts';
import { renderDemand } from './renderDemand.ts';
import { chipOfFlags, SATELLITE_CHIPS } from './satelliteGroups.ts';

/**
 * Earth's satellites (Phase C): loading them, checking them, and holding them while they
 * are wanted.
 *
 * Three tiers, from CelesTrak's GP data as the generator writes it once a day (see
 * SatelliteInfo in tools/src/types.ts): the named satellites, a hundred or so, each with
 * its OMM for full SGP4 on the CPU, as bodies (satelliteBodies.ts); the bulk, tens of
 * thousands, as twelve float32s apiece for the GPU (satelliteShader.ts); and the few
 * hundred the bulk's model cannot follow -- very eccentric orbits, craft under thrust --
 * on SGP4 too, but as dots (SatelliteSwarm.tsx). Nothing is fetched from CelesTrak by the
 * browser: the generator does that, as CelesTrak asks.
 *
 * **Lazy, and optional**, as the comets are: fetched the first time the Satellites layer
 * is on or search opens, and data from before Phase C simply has none.
 */

/** Floats per bulk satellite: SATELLITE_RECORD_FLOATS, restated; a test holds them equal. */
export const SATELLITE_FLOATS = 12;

/** Where each value sits in a bulk record. The order is the file's. */
export const SAT = {
  a: 0,
  e: 1,
  i: 2,
  node: 3,
  peri: 4,
  M: 5,
  dM: 6,
  dNode: 7,
  dPeri: 8,
  ddM: 9,
  ay: 10,
  flags: 11,
} as const;

/** SATELLITE_REGIME_SHIFT and SATELLITE_TYPE_SHIFT, restated. */
export const REGIME_SHIFT = 16;
export const TYPE_SHIFT = 18;

/**
 * How many days from its element epoch a named satellite is drawn, either way.
 *
 * **Measured, on the ISS** -- the worst case among the named: the lowest, with the most
 * drag for its mass, and reboosted now and then. Its elements of 2026-10-21 run back
 * through SGP4 against JPL Horizons' ISS -- which is built from each day's own element
 * set, so it is the truth to a kilometre or so -- were off by:
 *
 *   days back     1      2      3      4      5      7      10      14
 *   km          0.4    1.2    5.1    9.1   17.5   37.6    90.9   189.1
 *
 * Seven days keeps the worst satellite within 40 km, five seconds along its orbit; at 14,
 * the first guess, it would be 190. A satellite higher up drifts far less -- Hubble, at
 * 530 km, a few kilometres a week. Live, the clock is always inside: the data is a day
 * old at most. The SGP4 tier's dots keep the same window, for the same reason.
 */
export const NAMED_WINDOW_DAYS = 7;

/**
 * Days from the data's reference instant within which the bulk is drawn, either way.
 *
 * From the generator's measurement of the bulk model against full SGP4 on its own
 * elements (median / 95th percentile, km):
 *
 *              0      1 h     1 d     3 d      7 d
 *   LEO       3/6     4/6     4/6     4/8     5/99
 *   MEO     12-16 / 27-31 throughout
 *   GEO     28-32 / 32-41 throughout -- the Moon's and Sun's periodic terms
 *
 * The model holds to three days and comes apart in LEO by seven, where drag is no longer
 * the parabola it is written as; and SGP4 itself has drifted by then (NAMED_WINDOW_DAYS).
 * One frame matrix would hold for thirty; the app works its own out for the instant
 * anyway (see satelliteInstant).
 */
export const BULK_WINDOW_DAYS = 3;

/** Everything the layer draws from, once it has arrived. */
export interface Satellites {
  readonly info: SatelliteInfo;
  readonly named: readonly NamedSatellite[];
  /** The SGP4 tier: dots, propagated as the named are. */
  readonly sgp4: readonly SgpSatellite[];
  /** SATELLITE_FLOATS per satellite, in the file's order. */
  readonly records: Float32Array;
  /** Each bulk record's chip, an index into SATELLITE_CHIPS; see chipOfFlags. */
  readonly chips: Uint8Array;
  /** Each named satellite's chip, in `named` order. */
  readonly namedChips: Uint8Array;
  /** Each SGP4-tier satellite's chip, in `sgp4` order. */
  readonly sgp4Chips: Uint8Array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A bare file name: the files live beside satellites.json, and nothing else may be reached. */
function isBareFileName(file: unknown): file is string {
  return typeof file === 'string' && /^[\w.-]+$/.test(file) && !file.startsWith('.');
}

/**
 * Checks satellites.json is the shape the app reads. Loud, as belt.json's check is: a
 * record length the shader does not expect would read every satellite's eccentricity out
 * of its neighbour's inclination.
 */
export function parseSatelliteInfo(raw: unknown): SatelliteInfo {
  if (!isRecord(raw)) {
    throw new Error('satellites.json did not contain an object.');
  }
  const bulk = raw['bulk'];
  if (!isRecord(bulk) || bulk['recordFloats'] !== SATELLITE_FLOATS) {
    throw new Error(
      `satellites.json has ${String(isRecord(bulk) ? bulk['recordFloats'] : undefined)} floats per satellite; this app reads ${SATELLITE_FLOATS}.`,
    );
  }
  const count = bulk['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('satellites.json has no usable satellite count.');
  }
  if (bulk['bytes'] !== count * SATELLITE_FLOATS * 4) {
    throw new Error(`satellites.json says ${String(bulk['bytes'])} bytes for ${count} satellites.`);
  }
  const named = raw['named'];
  const names = raw['names'];
  const sgp4 = raw['sgp4'];
  if (
    !isBareFileName(bulk['file']) ||
    !isRecord(named) ||
    !isBareFileName(named['file']) ||
    !isRecord(names) ||
    !isBareFileName(names['file']) ||
    !isRecord(sgp4) ||
    !isBareFileName(sgp4['file'])
  ) {
    throw new Error('satellites.json does not name its files.');
  }
  const reference = raw['referenceJdUtc'];
  if (typeof reference !== 'number' || !Number.isFinite(reference)) {
    throw new Error('satellites.json does not say when its elements are given at.');
  }
  if (!Array.isArray(raw['groups'])) {
    throw new Error('satellites.json does not list its groups.');
  }
  return raw as unknown as SatelliteInfo;
}

/**
 * Every record one the shader can place: a semi-major axis above Earth's surface, an
 * eccentricity in [0, 1), and every value finite. Anything else is a broken file, and
 * said so, rather than a dot at the centre of the Earth.
 */
export function checkSatelliteRecords(records: Float32Array): void {
  for (let base = 0; base < records.length; base += SATELLITE_FLOATS) {
    const a = records[base + SAT.a]!;
    const e = records[base + SAT.e]!;
    for (let k = 0; k < SATELLITE_FLOATS; k += 1) {
      if (!Number.isFinite(records[base + k]!)) {
        throw new Error(`Satellite ${base / SATELLITE_FLOATS} has a value that is not a number.`);
      }
    }
    if (!(a > 6000) || !(e >= 0 && e < 1)) {
      throw new Error(`Satellite ${base / SATELLITE_FLOATS} is not on an orbit: a = ${a} km, e = ${e}.`);
    }
  }
}

const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/**
 * The records as float32s: the bytes themselves on a little-endian host, which is every
 * one a browser runs on, and read through a DataView on any other, as the belt's are.
 */
export function decodeSatelliteRecords(buffer: ArrayBuffer, littleEndianHost = HOST_IS_LITTLE_ENDIAN): Float32Array {
  if (buffer.byteLength % (SATELLITE_FLOATS * 4) !== 0) {
    throw new Error(`The satellites' records are ${buffer.byteLength} bytes, not a whole number of satellites.`);
  }
  if (littleEndianHost) {
    return new Float32Array(buffer);
  }
  const view = new DataView(buffer);
  const records = new Float32Array(buffer.byteLength / 4);
  for (let k = 0; k < records.length; k += 1) {
    records[k] = view.getFloat32(k * 4, true);
  }
  return records;
}

/** Every bulk record's chip; one pass, when the records arrive. */
export function recordChips(records: Float32Array, info: SatelliteInfo): Uint8Array {
  const count = records.length / SATELLITE_FLOATS;
  const chips = new Uint8Array(count);
  for (let k = 0; k < count; k += 1) {
    chips[k] = chipOfFlags(records[k * SATELLITE_FLOATS + SAT.flags]!, info.groups, TYPE_SHIFT);
  }
  return chips;
}

/** How many of each chip, named and bulk together, in SATELLITE_CHIPS order. */
export function chipCounts(satellites: Satellites): number[] {
  const counts = SATELLITE_CHIPS.map(() => 0);
  for (const chip of satellites.chips) {
    counts[chip] = counts[chip]! + 1;
  }
  for (const chip of satellites.namedChips) {
    counts[chip] = counts[chip]! + 1;
  }
  for (const chip of satellites.sgp4Chips) {
    counts[chip] = counts[chip]! + 1;
  }
  return counts;
}

/** Reads satellites.json, its named list and its records; null when the data has none. */
export async function loadSatellites(fetchers: BeltFetchers, basePath = '/'): Promise<Satellites | null> {
  const dir = `${basePath}data/satellites/`;
  const raw = await fetchers.json(`${dir}satellites.json`);
  if (raw === null) {
    console.info('The published data has no satellites. Regenerate it to draw them.');
    return null;
  }
  const info = parseSatelliteInfo(raw);
  const [named, sgp4, buffer] = await Promise.all([
    fetchers.json(`${dir}${info.named.file}`),
    fetchers.json(`${dir}${info.sgp4.file}`),
    fetchers.binary(`${dir}${info.bulk.file}`, { expectedBytes: info.bulk.bytes }),
  ]);
  if (!Array.isArray(named) || !Array.isArray(sgp4)) {
    throw new Error(`satellites.json names ${info.named.file} and ${info.sgp4.file}, which are not both lists.`);
  }
  if (buffer === null || buffer.byteLength !== info.bulk.bytes) {
    throw new Error(`satellites.json names ${info.bulk.file} of ${info.bulk.bytes} bytes, which is not there.`);
  }
  const records = decodeSatelliteRecords(buffer);
  checkSatelliteRecords(records);
  const list = named as NamedSatellite[];
  const fallback = sgp4 as SgpSatellite[];
  return {
    info,
    named: list,
    sgp4: fallback,
    records,
    chips: recordChips(records, info),
    namedChips: Uint8Array.from(list, (satellite) => chipOfFlags(satellite.flags, info.groups, TYPE_SHIFT)),
    sgp4Chips: Uint8Array.from(fallback, (satellite) => chipOfFlags(satellite.flags, info.groups, TYPE_SHIFT)),
  };
}

type SourceState = 'idle' | 'loading' | 'ready' | 'absent' | 'failed';

/**
 * Something asked for once and kept, as the comets are: a satellite list of a few
 * megabytes, fetched the first time it is wanted. A failure may be asked again after
 * RETRY_AFTER_MS.
 */
export class LazySource<T> {
  readonly #load: () => Promise<T | null>;
  readonly #what: string;
  readonly #settled: () => void;
  #value: T | null = null;
  #state: SourceState = 'idle';
  #failedAt = 0;
  /** The load on its way, which a second request waits on rather than missing. */
  #pending: Promise<void> = Promise.resolve();
  readonly #listeners = new Set<() => void>();

  constructor(load: () => Promise<T | null>, what: string, settled: () => void = () => renderDemand.request()) {
    this.#load = load;
    this.#what = what;
    this.#settled = settled;
  }

  get value(): T | null {
    return this.#value;
  }

  get state(): SourceState {
    return this.#state;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Asks for it, once; resolves when it has arrived or failed -- this time or before. */
  request(): Promise<void> {
    if (this.#state === 'loading') {
      return this.#pending;
    }
    if (this.#state === 'ready' || this.#state === 'absent') {
      return Promise.resolve();
    }
    if (this.#state === 'failed' && Date.now() - this.#failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    this.#state = 'loading';
    this.#pending = this.#load()
      .then((value) => {
        this.#value = value;
        this.#state = value === null ? 'absent' : 'ready';
        for (const listener of this.#listeners) {
          listener();
        }
      })
      .catch((error: unknown) => {
        this.#state = 'failed';
        this.#failedAt = Date.now();
        console.error(`Could not load ${this.#what}`, error);
      })
      .finally(() => {
        this.#settled();
      });
    return this.#pending;
  }
}

export type SatelliteSource = LazySource<Satellites>;

/** The bulk's names, searchable: CelesTrak's OBJECT_NAME, and the COSPAR id as a second. */
export interface SatelliteNameIndex extends Searchable {
  readonly names: SatelliteNames;
  /** Bulk record of each NORAD catalogue number, for a search by number. */
  readonly byNorad: ReadonlyMap<number, number>;
}

/** Checks bulk-names.json against the records it names. */
export function parseSatelliteNames(raw: unknown, count: number): SatelliteNames {
  if (!isRecord(raw)) {
    throw new Error('bulk-names.json did not contain an object.');
  }
  for (const column of ['name', 'noradId', 'cosparId', 'ageDays']) {
    const values = raw[column];
    if (!Array.isArray(values) || values.length !== count) {
      throw new Error(`bulk-names.json's ${column} does not have one entry per satellite.`);
    }
  }
  return raw as unknown as SatelliteNames;
}

export function indexSatelliteNames(names: SatelliteNames): SatelliteNameIndex {
  return {
    names,
    display: names.name.map(normalizeName),
    designation: names.cosparId.map(normalizeName),
    byNorad: new Map(names.noradId.map((id, k) => [id, k] as const)),
  };
}

/** Reads bulk-names.json, once satellites.json is in hand; null where there is none. */
export async function loadSatelliteNames(
  fetchers: BeltFetchers,
  info: SatelliteInfo,
  basePath = '/',
): Promise<SatelliteNameIndex> {
  const raw = await fetchers.json(`${basePath}data/satellites/${info.names.file}`);
  if (raw === null) {
    throw new Error(`satellites.json names ${info.names.file}, which is not there.`);
  }
  return indexSatelliteNames(parseSatelliteNames(raw, info.bulk.count));
}
