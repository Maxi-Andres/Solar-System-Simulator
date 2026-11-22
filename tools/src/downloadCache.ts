import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { githubWarning } from './annotate.ts';

/**
 * The answers of the catalogues' hosts, kept between runs.
 *
 * Most of what a run reads does not change with the date: a paper's VizieR table, the CF4
 * cubes, HyperLEDA's measurements of a galaxy. And the hosts that serve them are the ones a
 * deploy loses most often -- VizieR's "database is not currently reachable", HyperLEDA's
 * dropped connections, the CosmicFlows page timing out on a 67 MB zip. Asking them again
 * every week is a chance a week of losing the release to a host that has nothing new to say.
 * So every answer is kept, keyed by the request, and the next run reads it from here.
 *
 * Two policies, by what the source is:
 *
 * - `static`, a published table that will not change: read from here first, the host asked
 *   only when nothing is kept. This is most of them.
 * - `living`, a catalogue its authors keep adding to (the ATNF's pulsars, the Exoplanet
 *   Archive, a rover's traverse): asked first, every run, so the release carries what they
 *   have published since; the kept answer is the fallback when the host cannot be read,
 *   with a warning that says how old it is.
 *
 * Either way an answer is kept only once `read` has accepted it -- parsed and checked as the
 * fresh answer is -- and a kept answer `read` refuses is thrown away and fetched again, so a
 * bad answer is never served twice. Files are written whole or not at all (a temporary file
 * renamed into place), so a run killed mid-write leaves no half an answer behind.
 *
 * Nothing that changes with the date is kept this way: Horizons, SBDB, CelesTrak. Horizons'
 * answers about the far past are kept by horizons/responseCache.ts, with a policy of their
 * own -- by how far in the past a query reaches, and only for a few weeks -- built on the
 * `keep` and `readKept` below.
 */

export type CachePolicy = 'static' | 'living';

/** Where the answers are kept unless DOWNLOAD_CACHE says otherwise: gitignored. */
export const DEFAULT_DOWNLOAD_CACHE = resolve(import.meta.dirname, '../.cache/downloads');

let configured: string | null | undefined;

/**
 * Sets the directory (null: keep nothing, ask every host every time; undefined: back to the
 * default). Unset, it is DOWNLOAD_CACHE's, or DEFAULT_DOWNLOAD_CACHE; DOWNLOAD_CACHE=off
 * keeps nothing.
 */
export function useDownloadCache(directory: string | null | undefined): void {
  configured = directory;
}

export function downloadCacheDirectory(): string | null {
  if (configured !== undefined) {
    return configured;
  }
  const fromEnv = process.env.DOWNLOAD_CACHE;
  if (fromEnv === 'off') {
    return null;
  }
  return fromEnv === undefined || fromEnv === '' ? DEFAULT_DOWNLOAD_CACHE : resolve(fromEnv);
}

/** The file an answer is kept in: the request's hash, so any request names a valid file. */
export function cachePath(directory: string, key: string, extension = '.bin'): string {
  return join(directory, `${createHash('sha256').update(key).digest('hex').slice(0, 32)}${extension}`);
}

export interface CachedRequest<T> {
  /** What identifies the answer: the URL, and the query for a POST. Not which mirror answered. */
  readonly key: string;
  /** For the log: "the CF4 watersheds". */
  readonly label: string;
  /** The answer's bytes from the host, retried as the caller retries; throws when it cannot. */
  readonly fetch: () => Promise<Uint8Array>;
  /** Parses and checks an answer; throws on one not to be trusted. Run on a kept one too. */
  readonly read: (bytes: Uint8Array) => T;
  readonly policy?: CachePolicy;
  /** Defaults to downloadCacheDirectory(); the star catalogues keep theirs apart. */
  readonly directory?: string | null;
  readonly extension?: string;
  /** Prefixes the log lines: the pipeline that asks. */
  readonly log?: string;
}

/**
 * A kept answer `read` accepts, or null when none is kept. One it refuses is deleted, with a
 * line in the log, and null returned: the caller fetches it afresh.
 */
export async function readKept<T>(
  path: string,
  read: (bytes: Uint8Array) => T,
  label: string,
  log = '[download-cache]',
): Promise<{ value: T; keptAt: Date } | null> {
  let bytes: Uint8Array;
  let keptAt: Date;
  try {
    bytes = new Uint8Array(await readFile(path));
    keptAt = (await stat(path)).mtime;
  } catch {
    return null;
  }
  try {
    return { value: read(bytes), keptAt };
  } catch (error) {
    console.warn(`${log} ${label}: the kept answer does not read (${String(error).slice(0, 200)}); discarded, asking the host.`);
    await rm(path, { force: true });
    return null;
  }
}

/** Keeps an answer, whole or not at all. */
export async function keep(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, path);
}

/** An answer through the cache, by the request's policy. See the header. */
export async function throughCache<T>(request: CachedRequest<T>): Promise<T> {
  const directory = request.directory === undefined ? downloadCacheDirectory() : request.directory;
  if (directory === null) {
    return request.read(await request.fetch());
  }
  const log = request.log ?? '[download-cache]';
  const path = cachePath(directory, request.key, request.extension);

  if ((request.policy ?? 'static') === 'static') {
    const kept = await readKept(path, request.read, request.label, log);
    if (kept !== null) {
      return kept.value;
    }
    const bytes = await request.fetch();
    const value = request.read(bytes);
    await keep(path, bytes);
    return value;
  }

  let bytes: Uint8Array;
  let value: T;
  try {
    bytes = await request.fetch();
    value = request.read(bytes);
  } catch (error) {
    const kept = await readKept(path, request.read, request.label, log);
    if (kept === null) {
      throw error;
    }
    const since = kept.keptAt.toISOString().slice(0, 10);
    const reason = String(error).replace(/\s+/g, ' ').slice(0, 300);
    console.warn(`${log} ${request.label}: the host could not be read (${reason}); using the answer kept on ${since}.`);
    githubWarning(`${request.label}: from ${since}`, `The host could not be read, so this run uses its answer kept on ${since}. ${reason}`);
    return kept.value;
  }
  await keep(path, bytes);
  return value;
}
