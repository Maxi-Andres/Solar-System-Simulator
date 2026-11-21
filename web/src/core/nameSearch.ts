import type { BeltInfo, LaniakeaNames } from '@sss/tools/types';

import { httpBeltFetchers, type BeltFetchers } from './belt.ts';
import { aliasField, indexNames, parseBeltNames, prepareSearch, searchNames, type NameMatch, type Searchable } from './beltNames.ts';
import { normalizeName } from './normalizeName.ts';
import { indexSatelliteNames, parseSatelliteNames } from './satellites.ts';

/**
 * The three big name indexes searched off the main thread: the belt's 137,000 asteroid names
 * (belt/names.json, 4.6 MB), Laniakea's galaxies (laniakea/names.json, 3.4 MB) and the
 * satellites' dots (satellites/bulk-names.json). Each was fetched, parsed and made comparable
 * on the main thread the first time search opened -- some 320 ms in blocks of up to 120 ms on
 * a fast machine -- and searched there on every keystroke.
 *
 * Now nameSearch.worker.ts does all of that, with the very functions the main thread used
 * (parseBeltNames, indexNames, searchNames ...), so the matches are the same entries in the
 * same order. The main thread keeps, of each, only the rows it has been sent: an index's
 * columns are filled at the entries a search returned, which are all anything reads (a
 * result's row, the body made from it). Laniakea's names are the exception: its labels name
 * any galaxy drawn, so the main thread still reads that file whole -- only the search is the
 * worker's.
 *
 * Where there are no workers (the tests), or the worker cannot run, everything is done on the
 * main thread as before; a worker that dies after loading is replaced the same way, by
 * loading the file here the first time it is searched.
 */

/** Which index. */
export type NameSource = 'belt' | 'bulk' | 'laniakea';

/** What the main thread keeps of each source's entries: its columns, by name. */
const COLUMNS: Readonly<Record<NameSource, readonly string[]>> = {
  belt: ['display', 'designation', 'tier', 'index', 'classIndex'],
  bulk: ['name', 'noradId', 'cosparId', 'ageDays'],
  laniakea: [],
};

export type NameSearchRequest =
  | { readonly id: number; readonly type: 'load'; readonly source: 'belt'; readonly url: string; readonly info: BeltInfo }
  | { readonly id: number; readonly type: 'load'; readonly source: 'bulk'; readonly url: string; readonly count: number }
  | { readonly id: number; readonly type: 'load'; readonly source: 'laniakea'; readonly url: string }
  | {
      readonly id: number;
      readonly type: 'search';
      readonly source: NameSource;
      readonly query: string;
      readonly limit: number;
    };

/** A request before the client numbers it. */
type Unnumbered<R> = R extends unknown ? Omit<R, 'id'> : never;

/** One search's answer: the matches, and the rows of each entry it names, by column. */
export interface NameSearchAnswer {
  readonly matches: readonly NameMatch[];
  /**
   * For the satellites, the entry whose NORAD number the query is, if it is one: what
   * satelliteResults (SearchPanel.tsx) read from byNorad.
   */
  readonly norad: number | null;
  /** The entries the rows are of: the matches', then norad's. */
  readonly ks: readonly number[];
  readonly rows: Readonly<Record<string, readonly unknown[]>>;
}

export type NameSearchReply =
  | { readonly id: number; readonly error: string }
  | { readonly id: number; readonly count: number }
  | ({ readonly id: number } & NameSearchAnswer);

/** An index made, and the columns its rows are read from. */
interface Loaded {
  readonly search: Searchable;
  readonly columns: Readonly<Record<string, readonly unknown[]>>;
  readonly byNorad: ReadonlyMap<number, number> | null;
  readonly count: number;
}

/** Laniakea's search index: its names, and each one's other names kept apart (aliasField). */
export function laniakeaSearch(names: LaniakeaNames, others: ReadonlyMap<number, readonly string[]>): Searchable {
  return {
    display: names.name.map(normalizeName),
    designation: names.name.map((_, k) => aliasField(others.get(k) ?? [])),
  };
}

/** Each record's other names, from names.json's sparse list. */
export function laniakeaOthers(names: LaniakeaNames): Map<number, readonly string[]> {
  return new Map<number, readonly string[]>(names.otherNames.map(([k, list]) => [k, list]));
}

/** Checks laniakea/names.json has a name a galaxy. */
export function checkLaniakeaNames(names: LaniakeaNames): void {
  if (!Array.isArray(names.name) || names.name.length !== names.count) {
    throw new Error('laniakea/names.json does not have one name a galaxy.');
  }
}

/** One search of a made index: searchNames, the NORAD number, and the rows of what it found. */
export function answer(loaded: Loaded, source: NameSource, query: string, limit: number): NameSearchAnswer {
  const matches = searchNames(loaded.search, query, limit);
  const trimmed = query.trim();
  const norad = loaded.byNorad !== null && /^\d+$/.test(trimmed) ? (loaded.byNorad.get(Number(trimmed)) ?? null) : null;
  const ks = matches.map(({ k }) => k);
  if (norad !== null) {
    ks.push(norad);
  }
  const rows: Record<string, unknown[]> = {};
  for (const column of COLUMNS[source]) {
    const values = loaded.columns[column]!;
    rows[column] = ks.map((k) => values[k]);
  }
  return { matches, norad, ks, rows };
}

/**
 * The worker's side: what each request does, against the indexes it holds. Exported, with the
 * fetchers injected, so a test can run it on this thread.
 */
export function nameSearchHandler(fetchers: BeltFetchers = httpBeltFetchers): (request: NameSearchRequest) => Promise<NameSearchReply> {
  const loaded = new Map<NameSource, Loaded>();
  return async (request) => {
    try {
      if (request.type === 'search') {
        const index = loaded.get(request.source);
        if (index === undefined) {
          throw new Error(`The ${request.source} names are not loaded.`);
        }
        return { id: request.id, ...answer(index, request.source, request.query, request.limit) };
      }
      const raw = await fetchers.json(request.url);
      if (raw === null) {
        throw new Error(`${request.url} is not there.`);
      }
      let made: Loaded;
      if (request.source === 'belt') {
        const index = indexNames(request.info, parseBeltNames(raw, request.info));
        made = { search: index, columns: index.names as unknown as Loaded['columns'], byNorad: null, count: index.names.count };
      } else if (request.source === 'bulk') {
        const index = indexSatelliteNames(parseSatelliteNames(raw, request.count));
        made = { search: index, columns: index.names as unknown as Loaded['columns'], byNorad: index.byNorad, count: request.count };
      } else {
        const names = raw as LaniakeaNames;
        checkLaniakeaNames(names);
        made = { search: laniakeaSearch(names, laniakeaOthers(names)), columns: {}, byNorad: null, count: names.count };
      }
      // Prepared now, while nobody waits, rather than on the first search.
      prepareSearch(made.search);
      loaded.set(request.source, made);
      return { id: request.id, count: made.count };
    } catch (error) {
      return { id: request.id, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

/** What the client talks to: a Worker, or in a test something that behaves as one. */
export interface NamePort {
  postMessage(request: NameSearchRequest): void;
  onmessage: ((event: MessageEvent<NameSearchReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

/** The main thread's end: one worker, lazily made, every request answered by id. */
export class NameSearchClient {
  readonly #makePort: () => NamePort;
  #port: NamePort | null = null;
  #broken = false;
  #next = 1;
  readonly #pending = new Map<number, { resolve: (reply: NameSearchReply) => void; reject: (error: Error) => void }>();

  constructor(makePort: () => NamePort) {
    this.#makePort = makePort;
  }

  /** True once the worker has failed: every later request is refused, for the fallback. */
  get broken(): boolean {
    return this.#broken;
  }

  #fail(error: Error): void {
    this.#broken = true;
    this.#port?.terminate();
    this.#port = null;
    for (const { reject } of this.#pending.values()) {
      reject(error);
    }
    this.#pending.clear();
  }

  #send(request: Unnumbered<NameSearchRequest>): Promise<NameSearchReply> {
    if (this.#broken) {
      return Promise.reject(new Error('The name search worker has failed.'));
    }
    if (this.#port === null) {
      try {
        const port = this.#makePort();
        port.onmessage = (event) => {
          const pending = this.#pending.get(event.data.id);
          if (pending !== undefined) {
            this.#pending.delete(event.data.id);
            pending.resolve(event.data);
          }
        };
        port.onerror = (event) => this.#fail(new Error(event.message || 'The name search worker failed.'));
        this.#port = port;
      } catch (error) {
        this.#fail(error instanceof Error ? error : new Error(String(error)));
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    const id = this.#next;
    this.#next += 1;
    const port = this.#port;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      port.postMessage({ ...request, id } as NameSearchRequest);
    });
  }

  /** Has the worker make an index; resolves with its entry count, rejects with why not. */
  async load(request: Unnumbered<Extract<NameSearchRequest, { type: 'load' }>>): Promise<number> {
    const reply = await this.#send(request);
    if ('error' in reply) throw new Error(reply.error);
    if (!('count' in reply)) throw new Error('The name search worker answered a load with a search.');
    return reply.count;
  }

  async search(source: NameSource, query: string, limit: number): Promise<NameSearchAnswer> {
    const reply = await this.#send({ type: 'search', source, query, limit });
    if ('error' in reply) throw new Error(reply.error);
    if (!('matches' in reply)) throw new Error('The name search worker answered a search with a load.');
    return reply;
  }
}

let shared: NameSearchClient | null | undefined;

/** The app's client, or null where there are no workers (the tests). */
export function sharedNameSearch(): NameSearchClient | null {
  if (shared === undefined) {
    shared =
      typeof Worker !== 'undefined' && typeof location !== 'undefined'
        ? new NameSearchClient(
            () => new Worker(new URL('./nameSearch.worker.ts', import.meta.url), { type: 'module' }) as unknown as NamePort,
          )
        : null;
  }
  return shared === null || shared.broken ? null : shared;
}

/**
 * An index whose entries are in the worker: searched there, its rows written into `columns`
 * as they come. If the worker fails, `local` loads the file on this thread, once, and the
 * searches go on there with the same answers.
 */
export class RemoteNames {
  readonly source: NameSource;
  readonly #client: NameSearchClient;
  readonly #columns: Record<string, unknown[]>;
  readonly #local: () => Promise<Loaded>;
  #fallback: Promise<Loaded> | null = null;

  constructor(client: NameSearchClient, source: NameSource, columns: Record<string, unknown[]>, local: () => Promise<Loaded>) {
    this.#client = client;
    this.source = source;
    this.#columns = columns;
    this.#local = local;
  }

  async search(query: string, limit: number): Promise<NameSearchAnswer> {
    let result: NameSearchAnswer;
    if (this.#fallback === null && !this.#client.broken) {
      try {
        result = await this.#client.search(this.source, query, limit);
      } catch (error) {
        console.warn(`Searching the ${this.source} names on the main thread:`, error);
        result = answer(await this.#loadHere(), this.source, query, limit);
      }
    } else {
      result = answer(await this.#loadHere(), this.source, query, limit);
    }
    result.ks.forEach((k, i) => {
      for (const column of COLUMNS[this.source]) {
        this.#columns[column]![k] = result.rows[column]![i];
      }
    });
    return result;
  }

  #loadHere(): Promise<Loaded> {
    this.#fallback ??= this.#local();
    return this.#fallback;
  }
}

const remotes = new WeakMap<object, RemoteNames>();

/** The worker behind an index, or null for one searched here. */
export function remoteNames(index: object): RemoteNames | null {
  return remotes.get(index) ?? null;
}

/** Empty columns, one per name, filled as searches return rows. */
function emptyColumns(source: NameSource): Record<string, unknown[]> {
  return Object.fromEntries(COLUMNS[source].map((column) => [column, []]));
}

function absolute(path: string): string {
  return new URL(path, location.href).href;
}

/**
 * The belt's names in the worker, as a NameIndex whose columns fill as they are searched; null
 * where there is no worker or it could not load them -- the caller then loads them here.
 */
export async function beltNamesInWorker<T extends object>(
  path: string,
  info: BeltInfo,
  local: () => Promise<{ readonly display: readonly string[]; readonly designation: readonly string[]; readonly names: object }>,
  make: (names: Record<string, unknown[]> & { count: number }) => T,
): Promise<T | null> {
  const client = sharedNameSearch();
  if (client === null) return null;
  try {
    const count = await client.load({ type: 'load', source: 'belt', url: absolute(path), info });
    const columns = { ...emptyColumns('belt'), count } as Record<string, unknown[]> & { count: number };
    const index = make(columns);
    remotes.set(
      index,
      new RemoteNames(client, 'belt', columns, async () => {
        const full = await local();
        return { search: full, columns: full.names as Loaded['columns'], byNorad: null, count };
      }),
    );
    return index;
  } catch (error) {
    console.warn('Reading the asteroid names on the main thread:', error);
    return null;
  }
}

/** The satellites' names in the worker, likewise. */
export async function satelliteNamesInWorker<T extends object>(
  path: string,
  count: number,
  local: () => Promise<{ readonly display: readonly string[]; readonly designation: readonly string[]; readonly names: object; readonly byNorad: ReadonlyMap<number, number> }>,
  make: (names: Record<string, unknown[]>) => T,
): Promise<T | null> {
  const client = sharedNameSearch();
  if (client === null) return null;
  try {
    await client.load({ type: 'load', source: 'bulk', url: absolute(path), count });
    const columns = emptyColumns('bulk');
    const index = make(columns);
    remotes.set(
      index,
      new RemoteNames(client, 'bulk', columns, async () => {
        const full = await local();
        return { search: full, columns: full.names as Loaded['columns'], byNorad: full.byNorad, count };
      }),
    );
    return index;
  } catch (error) {
    console.warn('Reading the satellite names on the main thread:', error);
    return null;
  }
}

/**
 * Laniakea's search in the worker, as a placeholder Searchable it answers for; null where there
 * is no worker or it could not make it -- the caller then makes it here.
 */
export async function laniakeaSearchInWorker(path: string, local: () => Searchable): Promise<Searchable | null> {
  const client = sharedNameSearch();
  if (client === null) return null;
  try {
    const count = await client.load({ type: 'load', source: 'laniakea', url: absolute(path) });
    const placeholder: Searchable = { display: [], designation: [] };
    remotes.set(
      placeholder,
      new RemoteNames(client, 'laniakea', {}, async () => ({ search: local(), columns: {}, byNorad: null, count })),
    );
    return placeholder;
  } catch (error) {
    console.warn('Making the Laniakea search on the main thread:', error);
    return null;
  }
}
