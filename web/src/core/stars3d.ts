import type { Star3dTier, Stars3dInfo, Stars3dNames } from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import { normalizeName } from './search.ts';
import type { Searchable } from './beltNames.ts';
import { renderDemand } from './renderDemand.ts';
import { DAYS_PER_JULIAN_YEAR, J2000_JD } from './time.ts';
import type { StateVector } from './vec3.ts';

/**
 * The stars at their real distances (step D2): loading them, checking them, holding them.
 *
 * `stars3d/stars3d.json` lists tier files of ten float32s a star -- position in parsecs
 * about the Sun at J2000.0, velocity in km/s, absolute V, B-V, its row in the sky
 * catalogue and flags; see STAR3D_RECORD_FLOATS in tools/src/types.ts, which is the
 * contract. The GPU moves them and works out how bright each is from wherever the camera
 * is (scene/stars3dShader.ts); the CPU only holds the buffers.
 *
 * **Lazy, and nothing is lost by it.** A sky star in 3D keeps the sky's direction, V and
 * B-V, so from inside the Solar System the 3D stars and the sky at infinity are the same
 * picture: until a tier arrives, its sky stars are simply drawn at infinity, where they
 * already were. So nothing is fetched until it could make a difference -- the camera far
 * enough from the Sun for the nearest star's parallax to approach a pixel
 * (STARS3D_FROM_KM), a star searched for, or one in focus -- and then the tiers come in
 * order, the most luminous first, which are the ones seen from farthest.
 *
 * **Optional.** A data directory from before D2 has no stars3d.json: the sky stays at
 * infinity, said once on the console, never an error screen.
 */

/** STAR3D_RECORD_FLOATS, restated: the app imports the generator's types, not its values. */
export const STAR3D_FLOATS = 10;

/** km/s to pc per Julian year, STAR3D_KM_S_TO_PC_PER_YEAR restated: 31,557,600 s / 1 pc. */
export const KM_S_TO_PC_PER_YEAR = 1.0227121650537077e-6;

/** Where each value sits in a record. */
export const STAR3D = {
  x: 0,
  y: 1,
  z: 2,
  vx: 3,
  vy: 4,
  vz: 5,
  Mv: 6,
  bv: 7,
  sky: 8,
  flags: 9,
} as const;

/** STAR3D_FLAGS, restated. */
export const STAR3D_FLAG = {
  RADIAL_VELOCITY: 1,
  HIPPARCOS_PARALLAX: 2,
  LITERATURE_PARALLAX: 4,
  GAIA_PHOTOMETRY: 8,
  GCNS: 16,
  /** In GCNS with its distance estimate (dist_50) inside 100 pc: the census's clean sample. */
  GCNS_WITHIN_100PC: 32,
  /** The radial velocity is the Pulkovo compilation's (Gontcharov 2006): Gaia DR3 gave none. */
  LITERATURE_RADIAL_VELOCITY: 64,
} as const;

/**
 * A star's system as a reader should see it, or null. names.json's `system` also holds
 * double-star catalogue entries -- "WDS J03329-0927", "CCDM J01441-1557" -- which group a
 * pair's stars (names3d.ts) but are not names, and do not even say the star has a
 * companion: those catalogues list pairs that only line up on the sky as well. Tau Ceti,
 * single, is in CCDM for faint stars that merely appear near it.
 */
export function systemDisplayName(system: string | null): string | null {
  return system === null || /^(WDS|CCDM) J/.test(system) ? null : system;
}

/** One parsec, km (IAU 2015 B2: 648,000/pi AU). */
export const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;

/**
 * How far the camera must be from the Sun before the 3D stars are fetched: 50 AU.
 *
 * From there the nearest star, Proxima at 268,000 AU, has moved 50 / 268,000 rad against
 * its direction from the Sun: 1.9e-4 rad, 0.35 of a pixel at this field of view in a
 * 910-pixel frame. Inside it the sky at infinity is the same picture to a third of a
 * pixel; Pluto at aphelion is 49 AU, so the whole planetary system is browsed for free.
 */
export const STARS3D_FROM_KM = 50 * 149_597_870.7;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A bare file name: the tiers live beside stars3d.json, and nothing else may be reached. */
function isBareFileName(file: unknown): file is string {
  return typeof file === 'string' && /^[\w.-]+$/.test(file) && !file.startsWith('.');
}

/**
 * Checks stars3d.json is the shape the renderer expects, against the sky catalogue it
 * was built with.
 *
 * Loud rather than forgiving, as the sky and the belt are. A record length the renderer
 * does not expect would read every star's velocity out of its neighbour's position; a
 * stars.json from another run would hide the wrong rows of the sky.
 */
export function parseStars3dInfo(raw: unknown, skyRows: number): Stars3dInfo {
  if (!isRecord(raw)) {
    throw new Error('stars3d.json did not contain an object.');
  }
  if (raw['recordFloats'] !== STAR3D_FLOATS) {
    throw new Error(`stars3d.json has ${String(raw['recordFloats'])} floats a star; this app reads ${STAR3D_FLOATS}.`);
  }
  if (raw['epochJulianYear'] !== 2000) {
    throw new Error(`stars3d.json is at epoch ${String(raw['epochJulianYear'])}; this app reads J2000.0.`);
  }
  const sky = raw['sky'];
  if (!isRecord(sky) || sky['rows'] !== skyRows) {
    throw new Error(
      `stars3d.json was built against a sky of ${String(isRecord(sky) ? sky['rows'] : '?')} stars; stars.json has ${skyRows}.`,
    );
  }
  const tiers = raw['tiers'];
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error('stars3d.json lists no tiers.');
  }
  let total = 0;
  for (const tier of tiers as unknown[]) {
    if (
      !isRecord(tier) ||
      !isBareFileName(tier['file']) ||
      !isBareFileName(tier['details']) ||
      typeof tier['count'] !== 'number' ||
      !Number.isInteger(tier['count']) ||
      tier['bytes'] !== (tier['count'] as number) * STAR3D_FLOATS * 4
    ) {
      throw new Error('stars3d.json has a tier that is not a file of whole records.');
    }
    total += tier['count'] as number;
  }
  if (raw['count'] !== total) {
    throw new Error(`stars3d.json counts ${String(raw['count'])} stars but its tiers hold ${total}.`);
  }
  return raw as unknown as Stars3dInfo;
}

/** Julian years from J2000.0 to a TDB Julian day: the unit the motion is in. */
export function julianYearsSinceJ2000(jdTdb: number): number {
  return (jdTdb - J2000_JD) / DAYS_PER_JULIAN_YEAR;
}

/**
 * Where star `i` of `records` is at `jdTdb`, about the Sun: km and km/s, float64 from the
 * file's float32s. Linear: r(t) = r + v (t - J2000), which over the centuries the clock
 * reaches is the catalogue's own model, not an approximation of something better.
 */
export function starState(records: Float32Array, i: number, jdTdb: number): StateVector {
  const base = i * STAR3D_FLOATS;
  const years = julianYearsSinceJ2000(jdTdb);
  const vx = records[base + STAR3D.vx]!;
  const vy = records[base + STAR3D.vy]!;
  const vz = records[base + STAR3D.vz]!;
  const motion = years * KM_S_TO_PC_PER_YEAR;
  return {
    position: {
      x: (records[base + STAR3D.x]! + vx * motion) * PARSEC_KM,
      y: (records[base + STAR3D.y]! + vy * motion) * PARSEC_KM,
      z: (records[base + STAR3D.z]! + vz * motion) * PARSEC_KM,
    },
    velocity: { x: vx, y: vy, z: vz },
  };
}

/** Apparent V from absolute V at a distance, the distance modulus: m = M + 5 log10(d / 10 pc). */
export function apparentMagnitude(absoluteMagnitude: number, distancePc: number): number {
  return absoluteMagnitude + 5 * Math.log10(distancePc / 10);
}

/** One tier in hand. */
export interface LoadedStarTier {
  readonly index: number;
  readonly tier: Star3dTier;
  readonly records: Float32Array;
}

export type Stars3dState = 'idle' | 'loading' | 'ready' | 'absent' | 'failed';

/** What the scene and the panels draw from; replaced, never changed in place. */
export interface Stars3dView {
  readonly state: Stars3dState;
  readonly info: Stars3dInfo | null;
  /** The tiers in hand, in the catalogue's order; a prefix of them while loading. */
  readonly tiers: readonly LoadedStarTier[];
}

const EMPTY: Stars3dView = { state: 'idle', info: null, tiers: [] };

/**
 * The 3D stars, held as a prefix of their tiers: `request()` fetches stars3d.json and then
 * every tier in order, each handed to the scene the moment it lands.
 */
export class Stars3dSource {
  readonly #fetchers: BeltFetchers;
  readonly #base: string;
  readonly #skyRows: number;
  #view: Stars3dView = EMPTY;
  #requested = false;
  readonly #listeners = new Set<() => void>();

  constructor(fetchers: BeltFetchers, skyRows: number, basePath = '/') {
    this.#fetchers = fetchers;
    this.#skyRows = skyRows;
    this.#base = basePath;
  }

  get view(): Stars3dView {
    return this.#view;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #set(view: Stars3dView): void {
    this.#view = view;
    for (const listener of this.#listeners) {
      listener();
    }
    renderDemand.request();
  }

  /** stars3d.json, once it is in; resolves null where there is none. */
  async info(): Promise<Stars3dInfo | null> {
    await this.request(false);
    return this.#view.info;
  }

  /**
   * Asks for the stars: stars3d.json, and with `tiers` every tier after it. Once is
   * enough; later calls wait on the first.
   */
  #pending: Promise<void> | null = null;
  #tiersPending: Promise<void> | null = null;

  request(tiers = true): Promise<void> {
    this.#pending ??= this.#loadInfo();
    if (!tiers) {
      return this.#pending;
    }
    if (!this.#requested) {
      this.#requested = true;
      this.#tiersPending = this.#pending.then(() => this.#loadTiers());
    }
    return this.#tiersPending ?? this.#pending;
  }

  async #loadInfo(): Promise<void> {
    this.#set({ ...this.#view, state: 'loading' });
    try {
      const raw = await this.#fetchers.json(`${this.#base}data/stars3d/stars3d.json`);
      if (raw === null) {
        console.warn('The published data has no 3D stars (stars3d.json); the sky stays at infinity.');
        this.#set({ state: 'absent', info: null, tiers: [] });
        return;
      }
      this.#set({ state: 'loading', info: parseStars3dInfo(raw, this.#skyRows), tiers: [] });
    } catch (error) {
      console.error('Could not load the 3D stars', error);
      this.#set({ state: 'failed', info: null, tiers: [] });
    }
  }

  async #loadTiers(): Promise<void> {
    const info = this.#view.info;
    if (info === null) {
      return;
    }
    for (let index = this.#view.tiers.length; index < info.tiers.length; index += 1) {
      const tier = info.tiers[index]!;
      try {
        const buffer = await this.#fetchers.binary(`${this.#base}data/stars3d/${tier.file}`, {
          expectedBytes: tier.bytes,
        });
        if (buffer === null || buffer.byteLength !== tier.bytes) {
          throw new Error(`${tier.file} is ${buffer?.byteLength ?? 'missing'}, not ${tier.bytes} bytes.`);
        }
        this.#set({
          state: index === info.tiers.length - 1 ? 'ready' : 'loading',
          info,
          tiers: [...this.#view.tiers, { index, tier, records: new Float32Array(buffer) }],
        });
      } catch (error) {
        console.error(`Could not load the 3D stars' ${tier.file}`, error);
        this.#set({ ...this.#view, state: 'failed' });
        return;
      }
    }
  }

  /**
   * One star's record, whether or not its tier is in: from the tier if it is, otherwise
   * read on its own -- forty bytes -- for a search result the camera is about to go to.
   */
  async record(tierIndex: number, index: number): Promise<Float32Array> {
    const loaded = this.#view.tiers[tierIndex];
    if (loaded !== undefined) {
      return loaded.records.subarray(index * STAR3D_FLOATS, (index + 1) * STAR3D_FLOATS);
    }
    const info = await this.info();
    const tier = info?.tiers[tierIndex];
    if (tier === undefined || index < 0 || index >= tier.count) {
      throw new Error(`There is no 3D star ${tierIndex}/${index}.`);
    }
    const bytes = STAR3D_FLOATS * 4;
    const buffer = await this.#fetchers.binary(`${this.#base}data/stars3d/${tier.file}`, {
      range: { offset: index * bytes, length: bytes },
    });
    if (buffer === null || buffer.byteLength !== bytes) {
      throw new Error(`Could not read 3D star ${tierIndex}/${index}.`);
    }
    return new Float32Array(buffer);
  }

  /** A star's identifiers and parallax, from its tier's details file: four small reads. */
  async details(tierIndex: number, index: number): Promise<StarDetails | null> {
    const info = await this.info();
    const tier = info?.tiers[tierIndex];
    if (tier === undefined) {
      return null;
    }
    const n = tier.count;
    const path = `${this.#base}data/stars3d/${tier.details}`;
    const read = (offset: number, length: number): Promise<ArrayBuffer | null> =>
      this.#fetchers.binary(path, { range: { offset, length } });
    const [gaia, hip, plx, plxError] = await Promise.all([
      read(index * 8, 8),
      read(n * 8 + index * 4, 4),
      read(n * 12 + index * 4, 4),
      read(n * 16 + index * 4, 4),
    ]);
    if (gaia === null || hip === null || plx === null || plxError === null) {
      return null;
    }
    const gaiaId = new DataView(gaia).getBigUint64(0, true);
    const hipId = new DataView(hip).getUint32(0, true);
    const error = new DataView(plxError).getFloat32(0, true);
    return {
      gaiaDr3: gaiaId === 0n ? null : gaiaId.toString(),
      hip: hipId === 0 ? null : hipId,
      parallaxMas: new DataView(plx).getFloat32(0, true),
      parallaxErrorMas: error === 0 ? null : error,
    };
  }
}

/** What a tier's details file says about one star. */
export interface StarDetails {
  readonly gaiaDr3: string | null;
  readonly hip: number | null;
  readonly parallaxMas: number;
  readonly parallaxErrorMas: number | null;
}

/** The names, searchable: the display name, and every other designation joined as a second. */
export interface StarNameIndex extends Searchable {
  readonly names: Stars3dNames;
}

/** Checks names.json against the tiers it points into. */
export function parseStarNames(raw: unknown, info: Stars3dInfo): Stars3dNames {
  if (!isRecord(raw) || typeof raw['count'] !== 'number') {
    throw new Error('stars3d names.json did not contain a count.');
  }
  const count = raw['count'];
  for (const column of ['display', 'iau', 'designations', 'system', 'nearest', 'spectralType', 'tier', 'index']) {
    const values = raw[column];
    if (!Array.isArray(values) || values.length !== count) {
      throw new Error(`stars3d names.json's ${column} does not have one entry per star.`);
    }
  }
  const tiers = raw['tier'] as unknown[];
  const indices = raw['index'] as unknown[];
  for (let k = 0; k < count; k += 1) {
    const t = tiers[k];
    const i = indices[k];
    if (
      typeof t !== 'number' ||
      typeof i !== 'number' ||
      t < 0 ||
      t >= info.tiers.length ||
      i < 0 ||
      i >= info.tiers[t]!.count
    ) {
      throw new Error(`stars3d names.json: entry ${k} points at a record that is not there.`);
    }
  }
  return raw as unknown as Stars3dNames;
}

export function indexStarNames(names: Stars3dNames): StarNameIndex {
  return {
    names,
    display: names.display.map(normalizeName),
    designation: names.designations.map((list) => normalizeName(list.join(' '))),
  };
}

/** Reads names.json, once stars3d.json is in hand; null where there is none. */
export async function loadStarNames(
  source: Stars3dSource,
  fetchers: BeltFetchers,
  basePath = '/',
): Promise<StarNameIndex | null> {
  const info = await source.info();
  if (info === null) {
    return null;
  }
  const raw = await fetchers.json(`${basePath}data/stars3d/${info.names.file}`);
  if (raw === null) {
    throw new Error(`stars3d.json names ${info.names.file}, which is not there.`);
  }
  return indexStarNames(parseStarNames(raw, info));
}

/** A star as seen from the Sun at an instant: what its info panel quotes. */
export interface StarNow {
  readonly distancePc: number;
  /** V from the Sun now: Mv through the distance modulus. */
  readonly apparentV: number;
  /** Proper motion, arcseconds a year: the motion across the line of sight over the distance. */
  readonly properMotionArcsecPerYear: number;
  /** Along the line of sight, km/s, positive receding; null where none was measured. */
  readonly radialKmS: number | null;
  /** The whole space motion relative to the Sun, km/s, or its tangential part alone. */
  readonly speedKmS: number;
}

/** km/s per (arcsecond a year times parsec): 1 AU per Julian year, in km/s. */
export const KM_S_PER_ARCSEC_PC_PER_YEAR = 4.740470463533348;

/** Star `i` of `records` seen from the Sun at `jdTdb`. */
export function starNow(records: Float32Array, i: number, jdTdb: number): StarNow {
  const base = i * STAR3D_FLOATS;
  const state = starState(records, i, jdTdb);
  const r = state.position;
  const v = state.velocity;
  const distanceKm = Math.hypot(r.x, r.y, r.z);
  const distancePc = distanceKm / PARSEC_KM;
  const radial = (r.x * v.x + r.y * v.y + r.z * v.z) / distanceKm;
  const speed = Math.hypot(v.x, v.y, v.z);
  const tangential = Math.sqrt(Math.max(0, speed * speed - radial * radial));
  const measured = (records[base + STAR3D.flags]! & STAR3D_FLAG.RADIAL_VELOCITY) !== 0;
  return {
    distancePc,
    apparentV: apparentMagnitude(records[base + STAR3D.Mv]!, distancePc),
    properMotionArcsecPerYear: tangential / (KM_S_PER_ARCSEC_PC_PER_YEAR * distancePc),
    radialKmS: measured ? radial : null,
    speedKmS: speed,
  };
}
