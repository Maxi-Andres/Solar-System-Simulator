import { createHash } from 'node:crypto';
import { readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import {
  HORIZONS_API_URL,
  HORIZONS_CACHE_MAX_MB,
  HORIZONS_CACHE_MIN_AGE_DAYS,
  HORIZONS_CACHE_REFRESH_DAYS,
} from '../config.ts';
import { cachePath, keep, readKept } from '../downloadCache.ts';
import type { HorizonsResponse } from './client.ts';

/**
 * Horizons' answers about the past, kept between runs.
 *
 * A full run asks Horizons several thousand questions, and many are the same every week:
 * a craft whose mission is over (DART, Cassini's last years) or launched inside the window
 * (Parker, Juice, Lucy) is sampled on a grid anchored at its own coverage edge, so its
 * coarse pass and every refinement between two grid points are the same query run after
 * run; a craft or a small moon whose grid moves with the window by whole days still asks
 * the same refinement spans between the same grid points. Those answers come from JPL's
 * files for the past, which do not change from Monday to Monday. This keeps them.
 *
 * **What may be kept** -- the whole policy is `reusable` and `stillFresh` below:
 *
 * 1. Only a query whose every instant is at least HORIZONS_CACHE_MIN_AGE_DAYS (90) in the
 *    past when it is asked, and again when it is read back: its STOP_TIME, or the latest
 *    of its TLIST. Anything reaching nearer the present, or into the future -- the planets'
 *    windows, today's osculating elements, the coverage probe at 2200, the stated end of a
 *    craft still flying -- is always asked. So is a query with no instant at all (the
 *    major-body list). The margin is for JPL's revisions: a mission still flying has its
 *    recent weeks re-delivered as navigation turns predictions into reconstructions, and
 *    three months is well past that.
 *
 * 2. And only for a while: every body's answers are dropped together, in one run, every
 *    HORIZONS_CACHE_REFRESH_DAYS (28) days, and asked afresh. Time is cut into 28-day
 *    periods, shifted for each body by a phase from its COMMAND and CENTER, and an answer
 *    is used only in the period it was fetched in. So whatever JPL re-delivers about the
 *    past -- a re-processed reconstruction, a new satellite ephemeris -- is in the release
 *    within four weeks; a body's answers are never from two periods at once, so a refreshed
 *    coarse pass is never spliced with refinements from before a revision; and the phases
 *    spread the refreshes over the weeks, so each Monday run asks about a quarter of them.
 *
 * An answer is kept exactly as Horizons gave it, its signature too, and goes through the
 * same parsing as a fresh one: the data produced from a kept answer is the data the fresh
 * one would have produced, older by at most the period above. Only successful answers are
 * kept (callHorizons hands this nothing else), keyed by the exact query -- every parameter,
 * sorted, and the API's URL -- so a changed query is a new question. Files are gzipped
 * JSON, written whole or not at all (downloadCache.ts's `keep`), and one that does not read
 * back is deleted and asked again.
 *
 * At the end of a full run `pruneHorizonsCache` deletes every answer that run did not use,
 * so what the deploy saves is one run's working set, capped at HORIZONS_CACHE_MAX_MB.
 */

/** Unless HORIZONS_CACHE says otherwise: gitignored with the rest of tools/.cache. */
export const DEFAULT_HORIZONS_CACHE = resolve(import.meta.dirname, '../../.cache/horizons');

/** Bumped when the stored layout changes: an older file is then a different key. */
const FORMAT = 'horizons-cache-v1';
const EXTENSION = '.json.gz';
const DAY_MS = 86_400_000;

let configured: string | null | undefined;

/** Sets the directory (null: keep nothing; undefined: back to HORIZONS_CACHE or the default). */
export function useHorizonsCache(directory: string | null | undefined): void {
  configured = directory;
}

/**
 * HORIZONS_CACHE's directory, "off" for none, the default when unset. Under vitest, none unless
 * a test names one: a test must never read a real answer kept by an earlier run.
 */
export function horizonsCacheDirectory(): string | null {
  if (configured !== undefined) {
    return configured;
  }
  const fromEnv = process.env.HORIZONS_CACHE;
  if (fromEnv === 'off' || (process.env.VITEST !== undefined && (fromEnv === undefined || fromEnv === ''))) {
    return null;
  }
  return fromEnv === undefined || fromEnv === '' ? DEFAULT_HORIZONS_CACHE : resolve(fromEnv);
}

/** The exact query, as one string: what an answer is kept under. */
export function horizonsCacheKey(params: Readonly<Record<string, string>>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((name) => [name, params[name]]);
  return `${FORMAT} ${HORIZONS_API_URL} ${JSON.stringify(sorted)}`;
}

/** 'YYYY-MM-DD HH:MM', as queries.ts writes START/STOP_TIME, read as UTC. */
const HORIZONS_DATE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/;
/** Julian day of the Unix epoch. */
const UNIX_EPOCH_JD = 2440587.5;

/**
 * The latest instant a query is about, or null when it names none this can read -- and a
 * query this cannot date is never kept. TDB and UTC differ by a minute, nothing at the scale
 * of the margin.
 */
export function latestInstant(params: Readonly<Record<string, string>>): Date | null {
  const stop = params['STOP_TIME'];
  if (stop !== undefined) {
    const match = HORIZONS_DATE.exec(stop.trim());
    if (match === null) {
      return null;
    }
    const [, year, month, day, hour = '0', minute = '0'] = match;
    const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isFinite(time) ? new Date(time) : null;
  }
  const list = params['TLIST'];
  if (list !== undefined) {
    const days = list
      .split(/[\s,]+/)
      .filter((item) => item !== '')
      .map(Number);
    if (days.length === 0 || !days.every((jd) => Number.isFinite(jd))) {
      return null;
    }
    return new Date((Math.max(...days) - UNIX_EPOCH_JD) * DAY_MS);
  }
  return null;
}

/** Rule 1: every instant of the query at least the margin in the past. */
export function reusable(
  params: Readonly<Record<string, string>>,
  now: number,
  minAgeDays = HORIZONS_CACHE_MIN_AGE_DAYS,
): boolean {
  const latest = latestInstant(params);
  return latest !== null && latest.getTime() <= now - minAgeDays * DAY_MS;
}

/** A body's phase in the refresh cycle, ms: the same for every query about it from the same centre. */
export function refreshPhaseMs(
  params: Readonly<Record<string, string>>,
  periodDays = HORIZONS_CACHE_REFRESH_DAYS,
): number {
  const body = `${params['COMMAND'] ?? ''}|${params['CENTER'] ?? ''}`;
  const hash = Number.parseInt(createHash('sha256').update(body).digest('hex').slice(0, 12), 16);
  return hash % (periodDays * DAY_MS);
}

/** Rule 2: fetched in the body's current refresh period. */
export function stillFresh(
  params: Readonly<Record<string, string>>,
  fetchedAt: number,
  now: number,
  periodDays = HORIZONS_CACHE_REFRESH_DAYS,
): boolean {
  if (!(fetchedAt <= now)) {
    return false;
  }
  const period = periodDays * DAY_MS;
  const phase = refreshPhaseMs(params, periodDays);
  return Math.floor((fetchedAt + phase) / period) === Math.floor((now + phase) / period);
}

interface KeptAnswer {
  readonly key: string;
  readonly fetchedAt: number;
  readonly response: HorizonsResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads a kept file back; throws on anything not written by `keepAnswer` for this key. */
function readAnswer(bytes: Uint8Array, key: string): KeptAnswer {
  const parsed: unknown = JSON.parse(gunzipSync(bytes).toString('utf8'));
  if (
    !isRecord(parsed) ||
    parsed['key'] !== key ||
    typeof parsed['fetchedAt'] !== 'number' ||
    !isRecord(parsed['response']) ||
    typeof parsed['response']['result'] !== 'string' ||
    !isRecord(parsed['response']['signature']) ||
    typeof parsed['response']['signature']['source'] !== 'string' ||
    typeof parsed['response']['signature']['version'] !== 'string'
  ) {
    throw new Error('not a kept Horizons answer for this query');
  }
  return parsed as unknown as KeptAnswer;
}

/** What this process did with the cache, for the log. */
export interface HorizonsCacheStats {
  /** Answered from a kept answer. */
  hits: number;
  /** Reusable, but nothing fresh was kept: asked, and kept. */
  stored: number;
  /** Reaching too near the present, or undated: asked, not kept. */
  live: number;
}

const stats: HorizonsCacheStats = { hits: 0, stored: 0, live: 0 };
/** Every file read or written this run: what `pruneHorizonsCache` keeps. */
const used = new Set<string>();

export function horizonsCacheStats(): Readonly<HorizonsCacheStats> {
  return { ...stats };
}

/** For tests: forget this process's counts and uses. */
export function resetHorizonsCacheStats(): void {
  stats.hits = 0;
  stats.stored = 0;
  stats.live = 0;
  used.clear();
}

/**
 * The answer to `params`: a kept one where the policy allows, else `ask()`'s, kept when the
 * policy allows. `now` is read once, before asking, for both rules.
 */
export async function throughHorizonsCache(
  params: Readonly<Record<string, string>>,
  ask: () => Promise<HorizonsResponse>,
  now: number = Date.now(),
): Promise<HorizonsResponse> {
  const directory = horizonsCacheDirectory();
  if (directory === null || !reusable(params, now)) {
    stats.live += 1;
    return ask();
  }
  const key = horizonsCacheKey(params);
  const path = cachePath(directory, key, EXTENSION);
  const kept = await readKept(path, (bytes) => readAnswer(bytes, key), 'a kept Horizons answer', '[horizons-cache]');
  if (kept !== null && stillFresh(params, kept.value.fetchedAt, now)) {
    stats.hits += 1;
    used.add(path);
    return kept.value.response;
  }
  const response = await ask();
  const answer: KeptAnswer = { key, fetchedAt: now, response };
  await keep(path, gzipSync(JSON.stringify(answer)));
  stats.stored += 1;
  used.add(path);
  return response;
}

/**
 * Deletes every kept answer this run did not use, then the oldest of the rest while they
 * add up to more than `maxMb`. Only after a full run that finished: a run that stopped
 * halfway has not used what its second half would have. Returns what is left.
 */
export async function pruneHorizonsCache(
  maxMb = HORIZONS_CACHE_MAX_MB,
): Promise<{ files: number; bytes: number; removed: number } | null> {
  const directory = horizonsCacheDirectory();
  if (directory === null) {
    return null;
  }
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return { files: 0, bytes: 0, removed: 0 };
  }
  let removed = 0;
  const kept: { path: string; size: number; mtime: number }[] = [];
  for (const name of names) {
    const path = join(directory, name);
    if (!used.has(path)) {
      await rm(path, { force: true, recursive: true });
      removed += 1;
      continue;
    }
    const info = await stat(path);
    kept.push({ path, size: info.size, mtime: info.mtimeMs });
  }
  let bytes = kept.reduce((total, file) => total + file.size, 0);
  kept.sort((a, b) => a.mtime - b.mtime);
  const limit = maxMb * 1024 * 1024;
  while (bytes > limit && kept.length > 0) {
    const oldest = kept.shift()!;
    await rm(oldest.path, { force: true });
    bytes -= oldest.size;
    removed += 1;
  }
  return { files: kept.length, bytes, removed };
}
