import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  CELESTRAK_GP_URL,
  CELESTRAK_REQUEST_TIMEOUT_MS,
  CELESTRAK_SATCAT_URL,
  CELESTRAK_UPDATE_HOURS,
} from '../config.ts';
import type { SatelliteGroup, SatelliteOmm } from '../types.ts';

/**
 * Reads Earth satellites from CelesTrak (https://celestrak.org), Dr. T.S. Kelso's relay of
 * the US Space Force's public catalogue: GP (general perturbations) mean elements for SGP4,
 * and the SATCAT for what each object is and when it was launched.
 *
 * **Why CelesTrak and not Space-Track.** Space-Track is the source -- the 18th and 19th
 * Space Defense Squadrons publish there -- but it needs an account, and a build that runs
 * on anyone's machine and in CI cannot carry one. CelesTrak republishes the same element
 * sets, unchanged, without one.
 *
 * **What "the whole catalogue" can mean here.** CelesTrak publishes no all-objects GP file:
 * its public data is by group (https://celestrak.org/NORAD/elements/). `active`, every
 * payload the catalogue marks operational, is the backbone -- 16,766 on 2026-10-21 -- and
 * the rest of the tracked population reaches it only through the curated groups: the
 * brightest objects (`visual`, rocket bodies among them) and three debris clouds. So this
 * is every active satellite plus those, not the 30,000-odd tracked objects Space-Track
 * holds; the other dead payloads, rocket bodies and debris are not offered as a group.
 *
 * **CelesTrak's usage policy** (https://celestrak.org/usage-policy.php, read 2026-10-21) is
 * the rule this module is written to, because breaking it gets the address firewalled --
 * and a CI runner's address is shared:
 *
 *   - GP data updates every two hours, and since March 2026 a group downloaded again
 *     before it has updated is refused with HTTP 403 ("GP data has not updated since your
 *     last successful download"). A run downloads each group once.
 *   - "M2M software should immediately stop querying when it receives any non-HTTP 200
 *     responses", and 50x means the server is struggling and queries must stop "to allow
 *     system recovery". So there are **no retries on an HTTP error**, unlike every other
 *     client here: the first non-200 ends the read, and the groups not yet read are left
 *     out (SatelliteInfo.groupsMissing). Only a network fault -- no HTTP answer at all --
 *     is tried once more.
 *   - 50 HTTP errors in two hours sends the address to the firewall; a run makes at most
 *     one.
 *   - Requests go one at a time, in CSV, which the policy recommends: about 10% smaller
 *     than TLEs, and the only format that carries the six-digit catalogue numbers given
 *     out since 2026-07-11.
 *
 * A whole run is fourteen requests and 4.7 MB, measured 2026-10-21: `active` 2.5 MB of it
 * and its SATCAT 1.5 MB.
 *
 * **The cache**, for development: `--cache <dir>` keeps each response on disk and reads it
 * back instead of asking again while it is younger than CelesTrak's update interval -- so
 * iterating on the build never repeats a download CelesTrak would refuse anyway.
 */

/** The GP groups downloaded, in the order they are asked for: `active` first. */
export const GP_GROUPS_FETCHED = [
  'active',
  'stations',
  'visual',
  'gnss',
  'geo',
  'tdrss',
  'weather',
  'resource',
  'science',
  'fengyun-1c-debris',
  'iridium-33-debris',
  'cosmos-2251-debris',
] as const satisfies readonly SatelliteGroup[];

/** The groups whose SATCAT rows are read: object type and launch date. */
export const SATCAT_GROUPS_FETCHED = ['active', 'visual'] as const satisfies readonly SatelliteGroup[];

/** One SATCAT row, the fields read of it. */
export interface SatcatRow {
  readonly noradId: number;
  /** PAY, R/B, DEB or UNK. */
  readonly objectType: string;
  /** ISO date, or null. */
  readonly launchDate: string | null;
  /** CelesTrak's owner code: "US", "PRC", "CIS", "ESA". */
  readonly owner: string | null;
}

/** What one read of CelesTrak gave: each group's rows, and what could not be read. */
export interface CelestrakRead {
  readonly gp: ReadonlyMap<SatelliteGroup, readonly SatelliteOmm[]>;
  readonly satcat: ReadonlyMap<number, SatcatRow>;
  /** The groups not read, after the first failure stopped the read. */
  readonly missing: readonly SatelliteGroup[];
  /** Why the read stopped, or null when everything came. */
  readonly failure: string | null;
  /** When the first request went out, ISO UTC. */
  readonly queriedAt: string;
  readonly requests: number;
  readonly bytes: number;
}

/**
 * Splits CSV into rows of fields, RFC 4180: a field may be quoted, a quote inside one is
 * doubled. CelesTrak's names have no commas today, but a satellite name is free text and
 * a misread row would shift every element one column over.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Rows as records keyed by the header's names, every `required` one checked present. */
function readTable(text: string, required: readonly string[], label: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) {
    throw new Error(`CelesTrak ${label}: empty response.`);
  }
  const names = header.map((name) => name.trim());
  for (const name of required) {
    if (!names.includes(name)) {
      throw new Error(`CelesTrak ${label}: no column "${name}". Got: ${names.join(', ')}`);
    }
  }
  return rows.map((row, position) => {
    if (row.length !== names.length) {
      throw new Error(
        `CelesTrak ${label}: row ${position + 1} has ${row.length} fields, the header ${names.length}.`,
      );
    }
    return Object.fromEntries(names.map((name, column) => [name, row[column]!.trim()]));
  });
}

const OMM_NUMBERS = [
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
  'EPHEMERIS_TYPE',
  'NORAD_CAT_ID',
  'ELEMENT_SET_NO',
  'REV_AT_EPOCH',
  'BSTAR',
  'MEAN_MOTION_DOT',
  'MEAN_MOTION_DDOT',
] as const;

const OMM_STRINGS = ['OBJECT_NAME', 'OBJECT_ID', 'EPOCH', 'CLASSIFICATION_TYPE'] as const;

/** A number field of a CSV row: blank or unparseable fails loudly, never becomes a zero. */
function numberField(row: Record<string, string>, field: string, label: string): number {
  const raw = row[field];
  const value = raw === undefined || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`CelesTrak ${label}: ${field} is not a number: ${JSON.stringify(raw)}`);
  }
  return value;
}

/**
 * One GP group's CSV as OMM objects, typed as CelesTrak's own JSON carries them -- the
 * same keys, numbers as numbers -- so the web hands each to satellite.js unchanged.
 *
 * CSV writes ".0024489" and ".60406552E-3"; Number reads both. EPOCH is kept as the string
 * it is, microseconds and all: SGP4 runs from it, and a Date would cut it to milliseconds.
 */
export function parseGpCsv(text: string, label: string): SatelliteOmm[] {
  const rows = readTable(text, [...OMM_STRINGS, ...OMM_NUMBERS], label);
  return rows.map((row) => {
    const name = row['OBJECT_NAME'] ?? '';
    const where = `${label} ${name}`;
    const numbers = Object.fromEntries(
      OMM_NUMBERS.map((field) => [field, numberField(row, field, where)]),
    );
    const epoch = row['EPOCH'] ?? '';
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?$/.test(epoch)) {
      throw new Error(`CelesTrak ${where}: EPOCH is not an ISO instant: ${JSON.stringify(epoch)}`);
    }
    return {
      OBJECT_NAME: name,
      OBJECT_ID: row['OBJECT_ID'] ?? '',
      EPOCH: epoch,
      CLASSIFICATION_TYPE: row['CLASSIFICATION_TYPE'] ?? 'U',
      ...numbers,
    } as unknown as SatelliteOmm;
  });
}

/** SATCAT CSV rows, the fields this layer reads. */
export function parseSatcatCsv(text: string, label: string): SatcatRow[] {
  const rows = readTable(text, ['NORAD_CAT_ID', 'OBJECT_TYPE', 'LAUNCH_DATE', 'OWNER'], label);
  return rows.map((row) => ({
    noradId: numberField(row, 'NORAD_CAT_ID', label),
    objectType: row['OBJECT_TYPE'] ?? 'UNK',
    launchDate: row['LAUNCH_DATE'] || null,
    owner: row['OWNER'] || null,
  }));
}

/**
 * The UTC Julian day of an OMM EPOCH, to the microsecond CelesTrak prints: parsed by hand,
 * because Date keeps milliseconds and a millisecond is 7.6 m along a LEO orbit.
 */
export function epochJdUtc(epoch: string): number {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d(?:\.\d+)?)$/.exec(epoch);
  if (match === null) {
    throw new Error(`Not an OMM epoch: ${epoch}`);
  }
  const [, year, month, day, hour, minute, second] = match;
  const midnightMs = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const seconds = Number(hour) * 3600 + Number(minute) * 60 + Number(second);
  return midnightMs / 86_400_000 + 2440587.5 + seconds / 86_400;
}

function gpUrl(group: string): URL {
  const url = new URL(CELESTRAK_GP_URL);
  url.searchParams.set('GROUP', group);
  url.searchParams.set('FORMAT', 'csv');
  return url;
}

function satcatUrl(group: string): URL {
  const url = new URL(CELESTRAK_SATCAT_URL);
  url.searchParams.set('GROUP', group);
  url.searchParams.set('FORMAT', 'csv');
  return url;
}

/** A refusal or failure CelesTrak answered with: the read stops here, nothing is retried. */
class CelestrakStop extends Error {}

/** A cached response still inside CelesTrak's update interval, or null. */
async function readCache(cacheDir: string | null, file: string): Promise<string | null> {
  if (cacheDir === null) {
    return null;
  }
  try {
    const path = join(cacheDir, file);
    const age = Date.now() - (await stat(path)).mtimeMs;
    if (age > CELESTRAK_UPDATE_HOURS * 3_600_000) {
      return null;
    }
    console.log(`[satellites] ${file}: from the cache, ${(age / 60_000).toFixed(0)} min old`);
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * One request. A network fault -- no HTTP answer at all -- is tried once more after a
 * pause; any HTTP status but 200 stops the read, as the policy asks, with CelesTrak's own
 * explanation (a 403 carries one) in the message.
 */
async function download(url: URL): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(CELESTRAK_REQUEST_TIMEOUT_MS),
        headers: { accept: 'text/csv' },
      });
    } catch (cause) {
      if (attempt >= 2) {
        throw new Error(`Request to CelesTrak failed twice: ${String(cause)}`);
      }
      console.warn(`[satellites] ${url.search}: no answer (${String(cause)}); trying once more in 30 s`);
      await new Promise((done) => setTimeout(done, 30_000));
      continue;
    }
    const text = await response.text();
    if (response.status !== 200) {
      throw new CelestrakStop(
        `CelesTrak answered HTTP ${response.status} to ${url.search}: ${text.trim().slice(0, 300)}`,
      );
    }
    return text;
  }
}

/**
 * Reads every group in GP_GROUPS_FETCHED and the SATCAT of SATCAT_GROUPS_FETCHED, one
 * request at a time, stopping at the first failure.
 *
 * `active` comes first and is the layer: when it cannot be read the caller publishes no
 * satellites at all. A later group that fails costs only its own bit, and the ones after
 * it -- not asked, by the policy -- are listed as missing too.
 */
export async function readCelestrak(cacheDir: string | null = null): Promise<CelestrakRead> {
  const queriedAt = new Date().toISOString();
  const gp = new Map<SatelliteGroup, SatelliteOmm[]>();
  const satcat = new Map<number, SatcatRow>();
  const missing: SatelliteGroup[] = [];
  let failure: string | null = null;
  let requests = 0;
  let bytes = 0;
  if (cacheDir !== null) {
    await mkdir(cacheDir, { recursive: true });
  }

  const get = async (file: string, url: URL): Promise<string> => {
    const cached = await readCache(cacheDir, file);
    if (cached !== null) {
      return cached;
    }
    requests += 1;
    const text = await download(url);
    bytes += Buffer.byteLength(text);
    if (cacheDir !== null) {
      await writeFile(join(cacheDir, file), text, 'utf8');
    }
    return text;
  };

  const jobs: { file: string; run: () => Promise<void>; group: SatelliteGroup; gpJob: boolean }[] = [
    ...GP_GROUPS_FETCHED.map((group) => ({
      group,
      gpJob: true,
      file: `gp-${group}.csv`,
      run: async () => {
        gp.set(group, parseGpCsv(await get(`gp-${group}.csv`, gpUrl(group)), `GP ${group}`));
      },
    })),
    ...SATCAT_GROUPS_FETCHED.map((group) => ({
      group,
      gpJob: false,
      file: `satcat-${group}.csv`,
      run: async () => {
        for (const row of parseSatcatCsv(await get(`satcat-${group}.csv`, satcatUrl(group)), `SATCAT ${group}`)) {
          satcat.set(row.noradId, row);
        }
      },
    })),
  ];

  for (const [index, job] of jobs.entries()) {
    try {
      await job.run();
    } catch (error) {
      failure = String(error instanceof Error ? error.message : error);
      for (const rest of jobs.slice(index)) {
        if (rest.gpJob) {
          missing.push(rest.group);
        }
      }
      console.error(`[satellites] stopped reading CelesTrak: ${failure}`);
      break;
    }
  }
  return { gp, satcat, missing, failure, queriedAt, requests, bytes };
}
