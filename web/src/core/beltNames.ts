import type { BeltInfo, BeltNames } from '@sss/tools/types';

import {
  beltTiers,
  decodeBeltRecords,
  loadBeltInfo,
  RECORD_BYTES,
  RECORD_FLOATS,
  type BeltFetchers,
  type LoadedTier,
} from './belt.ts';
import { RETRY_AFTER_MS } from './chunkedTable.ts';
import { normalizeName } from './search.ts';

/**
 * The belt asteroids search can find by name (step B2c): `belt/names.json`, fetched the
 * first time the search panel opens and kept.
 *
 * Not every asteroid -- the index holds the IAU-named ones, every near-Earth asteroid,
 * every centaur and trans-Neptunian object, and all of the first tier; see BeltNames in
 * tools/src/types.ts -- each pointing at its record by tier and index, so a result is a
 * name and a place to read the orbit from, not an orbit itself.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks names.json against the belt it indexes: every column as long as the count,
 * every pointer inside a tier that exists. Loud, because a pointer one tier out would
 * fly the camera to some other asteroid under the name searched for.
 */
export function parseBeltNames(raw: unknown, info: BeltInfo): BeltNames {
  if (!isRecord(raw)) {
    throw new Error('names.json did not contain an object.');
  }
  const count = raw['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('names.json has no usable count.');
  }
  for (const column of ['display', 'designation', 'tier', 'index', 'classIndex']) {
    const values = raw[column];
    if (!Array.isArray(values) || values.length !== count) {
      throw new Error(`names.json: column "${column}" is not ${count} long.`);
    }
  }
  const tiers = beltTiers(info);
  const tier = raw['tier'] as unknown[];
  const index = raw['index'] as unknown[];
  for (let k = 0; k < count; k += 1) {
    const t = tier[k];
    const i = index[k];
    if (
      typeof t !== 'number' ||
      typeof i !== 'number' ||
      !Number.isInteger(t) ||
      !Number.isInteger(i) ||
      t < 0 ||
      t >= tiers.length ||
      i < 0 ||
      i >= tiers[t]!.count
    ) {
      throw new Error(`names.json: entry ${k} points at tier ${String(t)}, record ${String(i)}, which is not there.`);
    }
  }
  return raw as unknown as BeltNames;
}

/** Names made comparable once rather than on every keystroke: what searchNames reads. */
export interface Searchable {
  readonly display: readonly string[];
  /** A second name each, or '' for none. */
  readonly designation: readonly string[];
}

/** The belt's names, searchable. */
export interface NameIndex extends Searchable {
  readonly info: BeltInfo;
  readonly names: BeltNames;
}

/** Any list of names, searchable: the comets', whose names are all they have. */
export function searchable(names: readonly string[]): Searchable {
  return { display: names.map(normalizeName), designation: names.map(() => '') };
}

export function indexNames(info: BeltInfo, names: BeltNames): NameIndex {
  return {
    info,
    names,
    display: names.display.map(normalizeName),
    designation: names.designation.map((value) => (value === null ? '' : normalizeName(value))),
  };
}

/** One match: entry `k` of the index, and how good, 0 best. */
export interface NameMatch {
  readonly k: number;
  readonly score: number;
}

/**
 * The entries whose name or designation matches `query`, best first, at most `limit`.
 *
 * The same idea as searchBodies, cut down for 140,000 entries a keystroke: the whole name,
 * then a name starting with the query, then one with a word starting with it, then one
 * containing it, and the designation counting one step less than the name. Equal scores
 * keep the index's own order, which is tier and record order -- brightness -- so "eros"
 * puts 433 Eros above every fainter asteroid whose name merely contains it.
 */
export function searchNames(index: Searchable, query: string, limit = 20): NameMatch[] {
  const q = normalizeName(query);
  if (q === '') {
    return [];
  }
  const squeezed = q.replace(/ /g, '');
  const score = (field: string): number | null => {
    if (field === '') {
      return null;
    }
    if (field === q || field.replace(/ /g, '') === squeezed) {
      return 0;
    }
    if (field.startsWith(q)) {
      return 1;
    }
    if (field.includes(` ${q}`)) {
      return 2;
    }
    return field.includes(q) ? 3 : null;
  };
  const best: NameMatch[] = [];
  for (let k = 0; k < index.display.length; k += 1) {
    const byName = score(index.display[k]!);
    const byDesignation = score(index.designation[k]!);
    const s = byName ?? (byDesignation === null ? null : byDesignation + 0.5);
    if (s === null) {
      continue;
    }
    // Kept sorted as it goes and cut at the limit: no 140,000-entry sort a keystroke.
    if (best.length === limit && s >= best[best.length - 1]!.score) {
      continue;
    }
    let at = best.length;
    while (at > 0 && best[at - 1]!.score > s) {
      at -= 1;
    }
    best.splice(at, 0, { k, score: s });
    if (best.length > limit) {
      best.pop();
    }
  }
  return best;
}

/** Reads belt.json and the names it points at; null where either is not there. */
export async function loadNameIndex(fetchers: BeltFetchers, basePath = '/'): Promise<NameIndex | null> {
  const info = await loadBeltInfo(fetchers, basePath);
  if (info?.names === undefined) {
    return null;
  }
  const raw = await fetchers.json(`${basePath}data/belt/${info.names.file}`);
  if (raw === null) {
    throw new Error(`belt.json names ${info.names.file}, which is not there.`);
  }
  return indexNames(info, parseBeltNames(raw, info));
}

/**
 * One asteroid's record, for a search result: from its tier if that is loaded, and
 * otherwise just its own 36 bytes, by a range request (see readRange in belt.ts) -- not
 * the tier, which for the faintest is 23 MB to fly to one asteroid.
 */
export async function loadBeltRecord(
  fetchers: BeltFetchers,
  info: BeltInfo,
  tier: number,
  index: number,
  loaded: readonly LoadedTier[],
  basePath = '/',
): Promise<Float32Array> {
  const inHand = loaded.find((candidate) => candidate.index === tier);
  if (inHand !== undefined) {
    return inHand.records.slice(index * RECORD_FLOATS, (index + 1) * RECORD_FLOATS);
  }
  const file = beltTiers(info)[tier]!.file;
  const buffer = await fetchers.binary(`${basePath}data/belt/${file}`, {
    range: { offset: index * RECORD_BYTES, length: RECORD_BYTES },
  });
  if (buffer === null) {
    throw new Error(`belt.json names ${file}, which is not there.`);
  }
  return decodeBeltRecords(buffer, 1);
}

/**
 * The name index, asked for once -- when search opens -- and kept: a few megabytes,
 * nothing until then. A failure may be asked again after RETRY_AFTER_MS.
 */
export class NameIndexSource {
  readonly #load: () => Promise<NameIndex | null>;
  #index: NameIndex | null = null;
  #state: 'idle' | 'loading' | 'ready' | 'absent' | 'failed' = 'idle';
  #failedAt = 0;
  readonly #listeners = new Set<() => void>();

  constructor(load: () => Promise<NameIndex | null>) {
    this.#load = load;
  }

  get index(): NameIndex | null {
    return this.#index;
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
      .then((index) => {
        this.#index = index;
        this.#state = index === null ? 'absent' : 'ready';
        for (const listener of this.#listeners) {
          listener();
        }
      })
      .catch((error: unknown) => {
        this.#state = 'failed';
        this.#failedAt = Date.now();
        console.error('Could not load the asteroid names', error);
      });
  }
}
