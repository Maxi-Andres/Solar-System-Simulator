import type { BeltInfo, BeltNames } from '@sss/tools/types';

import {
  beltTiers,
  decodeBeltRecords,
  httpBeltFetchers,
  loadBeltInfo,
  RECORD_BYTES,
  RECORD_FLOATS,
  type BeltFetchers,
  type LoadedTier,
} from './belt.ts';
import { RETRY_AFTER_MS } from './chunkedTable.ts';
import { beltNamesInWorker } from './nameSearch.ts';
import { normalizeName } from './normalizeName.ts';

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
  /** A second name each, or '' for none; or several, as aliasField joins them. */
  readonly designation: readonly string[];
}

/** What aliasField puts between names: normalizeName leaves no "|" in a name. */
const ALIAS_SEPARATOR = ' | ';

/**
 * Several other names as one designation, each made comparable and kept apart, so that one
 * typed whole is matched whole: "Cen A" is Centaurus A's own other name, not a run of words
 * across two of them.
 */
export function aliasField(names: readonly string[]): string {
  return names
    .map(normalizeName)
    .filter((name) => name !== '')
    .join(ALIAS_SEPARATOR);
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
 * containing it, and the designation counting one step less than the name -- one of its
 * several names typed whole counting as its whole (aliasField). Equal scores
 * keep the index's own order, which is tier and record order -- brightness -- so "eros"
 * puts 433 Eros above every fainter asteroid whose name merely contains it.
 */
export function searchNames(index: Searchable, query: string, limit = 20): NameMatch[] {
  const q = normalizeName(query);
  if (q === '') {
    return [];
  }
  const squeezed = q.replace(/ /g, '');
  const first = squeezed.charCodeAt(0);
  const word = ` ${q}`;
  const prepared = preparedOf(index);
  // 270,000 names twice a keystroke, so nothing is made for a name that cannot match: one
  // with spaces whose spaces taken out could be the query's has as many other characters
  // (`solid`), starts as it does (names are trimmed) and is longer, and any other match
  // contains the query.
  const score = (field: string, solid: number): number | null => {
    if (field === '') {
      return null;
    }
    if (field === q || field === squeezed) {
      return 0;
    }
    if (
      solid === squeezed.length &&
      field.charCodeAt(0) === first &&
      field.length > squeezed.length &&
      field.includes(' ') &&
      field.replace(/ /g, '') === squeezed
    ) {
      return 0;
    }
    if (!field.includes(q)) {
      return null;
    }
    // One of several names, whole (aliasField).
    if (field.includes(ALIAS_SEPARATOR) && isOneOf(field, q)) {
      return 0;
    }
    if (field.startsWith(q)) {
      return 1;
    }
    return field.includes(word) ? 2 : 3;
  };
  // Which entries are scored at all: see Prepared.
  const wanted = charMask(squeezed);
  const wantedPairs = pairMask(q);
  const short = q.length === 1;
  const wordStart = short ? charMask(q) : pairBit(q.charCodeAt(0), q.charCodeAt(1));
  const wordStart2 = short ? 0 : pairBit2(q.charCodeAt(0), q.charCodeAt(1));
  const wordStarts = short ? prepared.wordFirsts : prepared.wordPairs;
  const best: NameMatch[] = [];
  const scoreOf = (k: number): number | null => {
    const inName = (wanted & ~prepared.displayMask[k]!) === 0;
    const inDesignation = (wanted & ~prepared.designationMask[k]!) === 0;
    if (!inName && !inDesignation) {
      return null;
    }
    const byName = inName ? score(index.display[k]!, prepared.displaySolid[k]!) : null;
    const byDesignation =
      byName === null && inDesignation ? score(index.designation[k]!, prepared.designationSolid[k]!) : null;
    return byName ?? (byDesignation === null ? null : byDesignation + 0.5);
  };
  // Kept sorted as it goes and cut at the limit, in index order: no 140,000-entry sort.
  const add = (k: number, s: number): void => {
    if (best.length === limit && s >= best[best.length - 1]!.score) {
      return;
    }
    let at = best.length;
    while (at > 0 && best[at - 1]!.score > s) {
      at -= 1;
    }
    best.splice(at, 0, { k, score: s });
    if (best.length > limit) {
      best.pop();
    }
  };
  // First the entries that are the query whole, scoring 0 or 0.5: all of them are among those
  // with a name of as many characters besides spaces as the query has (wholeAt).
  for (const k of prepared.wholeAt.get(squeezed.length) ?? []) {
    const s = scoreOf(k);
    if (s !== null && s <= 0.5) {
      add(k, s);
    }
  }
  // Then the rest, in order, each of which contains the query: so it has every character and
  // every pair of characters the query has. Once the list is full of names better than any
  // merely containing it, a name must have the query at the start of one of its words to
  // come in, and once full of names starting with it, no name can.
  for (let k = 0; k < prepared.count; k += 1) {
    if (best.length === limit) {
      const worst = best[best.length - 1]!.score;
      if (worst <= 1) {
        break;
      }
      if (worst <= 3 && ((wordStart & wordStarts[k]!) === 0 || (wordStart2 & ~prepared.wordPairs2[k]!) !== 0)) {
        continue;
      }
    }
    if (
      (wantedPairs & ~prepared.displayPairs[k]!) !== 0 &&
      (wantedPairs & ~prepared.designationPairs[k]!) !== 0
    ) {
      continue;
    }
    const s = scoreOf(k);
    if (s !== null && s > 0.5) {
      add(k, s);
    }
  }
  return best;
}

/**
 * Whether `name` is one of the several names of `field` (aliasField): whether ` | field | `
 * contains ` | name | `, read in place rather than made for every designation that contains
 * it -- "ma" is in nearly every 2MASX name of Laniakea's.
 */
function isOneOf(field: string, name: string): boolean {
  // `name` is trimmed and has no '|', so it lies inside `field` wherever it is in the padded one.
  const padded = (i: number): number =>
    i < 3 ? ALIAS_SEPARATOR.charCodeAt(i) : i < 3 + field.length ? field.charCodeAt(i - 3) : ALIAS_SEPARATOR.charCodeAt(i - 3 - field.length);
  for (let at = field.indexOf(name); at >= 0; at = field.indexOf(name, at + 1)) {
    const end = at + 3 + name.length;
    if (
      padded(at) === 32 &&
      padded(at + 1) === 124 &&
      padded(at + 2) === 32 &&
      padded(end) === 32 &&
      padded(end + 1) === 124 &&
      padded(end + 2) === 32
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Which characters a string holds, as bits: one a letter a to z, four for the digits in
 * groups, one for a space and one for anything else. A string holding another holds all its
 * bits, so a name whose mask lacks one of the query's cannot contain it.
 */
function charMask(text: string): number {
  let mask = 0;
  for (let k = 0; k < text.length; k += 1) {
    mask |= charBit(text.charCodeAt(k));
  }
  return mask;
}

function charBit(c: number): number {
  if (c >= 97 && c <= 122) {
    return 1 << (c - 97);
  }
  if (c >= 48 && c <= 57) {
    return DIGIT_BITS[c - 48]!;
  }
  return c === 32 ? SPACE_BIT : OTHER_BIT;
}

const DIGIT_BITS = [1 << 26, 1 << 26, 1 << 26, 1 << 27, 1 << 27, 1 << 27, 1 << 28, 1 << 28, 1 << 29, 1 << 29];
const SPACE_BIT = 1 << 30;
const OTHER_BIT = 1 << 31;

/** Characters other than spaces. */
function solidLength(text: string): number {
  let count = 0;
  for (let k = 0; k < text.length; k += 1) {
    if (text.charCodeAt(k) !== 32) {
      count += 1;
    }
  }
  return count;
}

/** One of 32 bits for a pair of characters side by side, hashed. */
function pairBit(first: number, second: number): number {
  return 1 << (Math.imul((first << 16) | second, 0x9e3779b1) >>> 27);
}

/** Another, hashed otherwise: a word's pair must have both, so two pairs rarely pass as one. */
function pairBit2(first: number, second: number): number {
  return 1 << (Math.imul(((first << 16) | second) ^ 0x5bd1e995, 0x27d4eb2d) >>> 27);
}

/** The bits of every pair of characters side by side in a string. */
function pairMask(text: string): number {
  let mask = 0;
  for (let k = 0; k + 1 < text.length; k += 1) {
    mask |= pairBit(text.charCodeAt(k), text.charCodeAt(k + 1));
  }
  return mask;
}

/**
 * What searchNames keeps of an index, made the first time it is searched, again if it grows:
 * by entry, which characters each name holds and which pairs of them, and which begin its
 * words -- a name lacking one of the query's cannot contain it, so it is passed over before
 * anything is read of it.
 */
interface Prepared {
  readonly count: number;
  readonly displayMask: Int32Array;
  readonly designationMask: Int32Array;
  readonly displayPairs: Int32Array;
  readonly designationPairs: Int32Array;
  /** Characters besides spaces, for a name typed without its spaces. */
  readonly displaySolid: Int32Array;
  readonly designationSolid: Int32Array;
  /**
   * The characters beginning the words of either name (charMask), and those with the one after
   * each (pairBit, pairBit2): a query of one character is looked for by the first, a longer one
   * by the pairs.
   */
  readonly wordFirsts: Int32Array;
  readonly wordPairs: Int32Array;
  readonly wordPairs2: Int32Array;
  /**
   * By a length: the entries, in order, with a name or designation -- or one of a designation's
   * several names -- of that many characters besides spaces, as any match scoring 0 has.
   */
  readonly wholeAt: ReadonlyMap<number, Int32Array>;
}

const preparedIndexes = new WeakMap<Searchable, Prepared>();

/** An index part-way prepared: the entries before `next` are read. */
interface Preparing extends Omit<Prepared, 'wholeAt'> {
  readonly lists: Map<number, number[]>;
  next: number;
}

const preparingIndexes = new WeakMap<Searchable, Preparing>();

function startPreparing(count: number): Preparing {
  return {
    count,
    displayMask: new Int32Array(count),
    designationMask: new Int32Array(count),
    displayPairs: new Int32Array(count),
    designationPairs: new Int32Array(count),
    displaySolid: new Int32Array(count),
    designationSolid: new Int32Array(count),
    wordFirsts: new Int32Array(count),
    wordPairs: new Int32Array(count),
    wordPairs2: new Int32Array(count),
    lists: new Map(),
    next: 0,
  };
}

/** Lists entry `k` under a length (wholeAt), once. */
function listUnder(p: Preparing, length: number, k: number): void {
  let entries = p.lists.get(length);
  if (entries === undefined) {
    entries = [];
    p.lists.set(length, entries);
  }
  if (entries[entries.length - 1] !== k) {
    entries.push(k);
  }
}

/** Reads one name of entry `k`, its display or its designation, into `p`. */
function readName(p: Preparing, field: string, k: number, mask: Int32Array, pairs: Int32Array, solid: Int32Array): void {
  // One pass: the characters, their pairs, those not spaces, and the words' starts -- each
  // word beginning the name or following a space.
  let characters = 0;
  let pairsHeld = 0;
  let solidCount = 0;
  let firsts = 0;
  let wordPairs = 0;
  let wordPairs2 = 0;
  let previous = 32;
  for (let at = 0; at < field.length; at += 1) {
    const c = field.charCodeAt(at);
    characters |= charBit(c);
    if (c !== 32) {
      solidCount += 1;
    }
    if (at > 0) {
      pairsHeld |= pairBit(previous, c);
    }
    if (at === 0 || previous === 32) {
      firsts |= charBit(c);
      if (at + 1 < field.length) {
        const next = field.charCodeAt(at + 1);
        wordPairs |= pairBit(c, next);
        wordPairs2 |= pairBit2(c, next);
      }
    }
    previous = c;
  }
  mask[k] = characters;
  pairs[k] = pairsHeld;
  solid[k] = solidCount;
  p.wordFirsts[k]! |= firsts;
  p.wordPairs[k]! |= wordPairs;
  p.wordPairs2[k]! |= wordPairs2;
  listUnder(p, solidCount, k);
  // One of several names, between its '|'s; its spaces either side are not counted.
  if (field.includes('|')) {
    for (const name of field.split('|')) {
      listUnder(p, solidLength(name), k);
    }
  }
}

/**
 * Prepares `index` until it is done -- returning it -- or until `deadline`, a performance.now()
 * time, has passed, returning null to be called again.
 */
function prepare(index: Searchable, deadline: number): Prepared | null {
  const count = Math.min(index.display.length, index.designation.length);
  const cached = preparedIndexes.get(index);
  if (cached !== undefined && cached.count === count) {
    return cached;
  }
  let p = preparingIndexes.get(index);
  if (p === undefined || p.count !== count) {
    p = startPreparing(count);
    preparingIndexes.set(index, p);
  }
  for (; p.next < count; p.next += 1) {
    if ((p.next & 1023) === 0 && deadline !== Infinity && performance.now() > deadline) {
      return null;
    }
    const k = p.next;
    readName(p, index.display[k]!, k, p.displayMask, p.displayPairs, p.displaySolid);
    readName(p, index.designation[k]!, k, p.designationMask, p.designationPairs, p.designationSolid);
  }
  const prepared: Prepared = {
    count,
    displayMask: p.displayMask,
    designationMask: p.designationMask,
    displayPairs: p.displayPairs,
    designationPairs: p.designationPairs,
    displaySolid: p.displaySolid,
    designationSolid: p.designationSolid,
    wordFirsts: p.wordFirsts,
    wordPairs: p.wordPairs,
    wordPairs2: p.wordPairs2,
    wholeAt: new Map([...p.lists].map(([length, entries]) => [length, Int32Array.from(entries)])),
  };
  preparedIndexes.set(index, prepared);
  preparingIndexes.delete(index);
  return prepared;
}

function preparedOf(index: Searchable): Prepared {
  return prepare(index, Infinity)!;
}

/**
 * Prepares an index for searchNames ahead of it, so that the first search after it arrives does
 * not: some tens of milliseconds for the largest, done in idle moments a few milliseconds at a
 * time (SearchPanel.tsx). Goes on until `deadline`, a performance.now() time; true once done.
 */
export function prepareSearch(index: Searchable, deadline = Infinity): boolean {
  return prepare(index, deadline) !== null;
}

/**
 * Reads belt.json and the names it points at; null where either is not there.
 *
 * Over HTTP, where there are workers, the names are read, made comparable and searched in
 * one (nameSearch.ts): what comes back has its columns filled only at the entries searches
 * return, and is searched through remoteNames. Otherwise, or if the worker cannot, here.
 */
export async function loadNameIndex(fetchers: BeltFetchers, basePath = '/'): Promise<NameIndex | null> {
  const info = await loadBeltInfo(fetchers, basePath);
  if (info?.names === undefined) {
    return null;
  }
  const path = `${basePath}data/belt/${info.names.file}`;
  const here = async (): Promise<NameIndex> => {
    const raw = await fetchers.json(path);
    if (raw === null) {
      throw new Error(`belt.json names ${info.names!.file}, which is not there.`);
    }
    return indexNames(info, parseBeltNames(raw, info));
  };
  if (fetchers === httpBeltFetchers) {
    const remote = await beltNamesInWorker(path, info, here, (names): NameIndex => ({
      info,
      names: names as unknown as BeltNames,
      display: [],
      designation: [],
    }));
    if (remote !== null) {
      return remote;
    }
  }
  return here();
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
