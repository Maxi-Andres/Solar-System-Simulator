/**
 * Regenerates the quasars alone: `pnpm fetch:quasars`.
 *
 *   pnpm fetch:quasars                    # into web/public/data/quasars/
 *   pnpm fetch:quasars --out <directory>  # into <directory>/quasars/
 *   pnpm fetch:quasars --cache <dir>      # keep the downloads in <dir> and read them from there next time
 *
 * Three VizieR tables from the CfA's mirror: SDSS DR16Q's 750,414 quasars (the columns used,
 * about 80 MB of text), Richards et al. 2006's K-corrections, and the Planck PSZ2 union
 * catalogue. A minute or two. It reads laniakea/laniakea.json from the same output directory,
 * if there, to leave out the clusters Laniakea already names. Writes quasars/ and touches
 * nothing else.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { DATA_USER_AGENT, LANIAKEA_DIR, LANIAKEA_INFO_FILE, OUTPUT_DIR, VIZIER_ASU_MIRRORS } from '../config.ts';
import type { LaniakeaInfo } from '../types.ts';
import { buildClusters, landmarkPlaces, type NamedPlace } from './clusters.ts';
import { QUASARS_DIR, QUASARS_INFO_FILE, type QuasarsInfo } from './format.ts';
import { assembleQuasars, buildQuasars, describeQuasars, KCorrection, QUASAR_FILES, type QuasarsOutput } from './quasars.ts';
import {
  asuUrl,
  CLUSTER_RECORD_HOLDERS,
  DR16Q_COLUMNS,
  DR16Q_LEAST_ROWS,
  DR16Q_TABLE,
  DR16Q_TEXT_COLUMNS,
  parseAsuTable,
  PSZ2_COLUMNS,
  PSZ2_LEAST_ROWS,
  PSZ2_TABLE,
  PSZ2_TEXT_COLUMNS,
  QUASAR_RECORD_HOLDERS,
  RICHARDS_K_COLUMNS,
  RICHARDS_K_TABLE,
  type AsuTable,
} from './sources.ts';

const LOG = '[quasars]';

let cacheDirectory: string | null = null;

/** Where `--cache` keeps a URL's answer, or null without one. */
function cachePath(url: string): string | null {
  return cacheDirectory === null ? null : join(cacheDirectory, `${createHash('sha256').update(url).digest('hex').slice(0, 24)}.bin`);
}

/**
 * A table read and checked by `read`, from `--cache` if it holds it (keyed by the URL), else from
 * the host -- kept there only once it reads: a mirror whose database is down still answers 200
 * with an empty table, and that must not be kept for the next run (fetchCosmicWeb.ts keeps any).
 */
async function fetchChecked<T>(url: string, label: string, read: (bytes: Uint8Array) => T): Promise<T> {
  const path = cachePath(url);
  if (path !== null) {
    try {
      return read(new Uint8Array(await readFile(path)));
    } catch {
      // Not there, or not a table: asked for again.
    }
  }
  const bytes = await downloadStreamed(url, label);
  const value = read(bytes);
  if (path !== null && cacheDirectory !== null) {
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path, bytes);
  }
  return value;
}

/** A download given up when nothing arrives for this long, ms -- not after a fixed total: DR16Q's 100 MB of text come from VizieR at a megabyte a second or less. */
const SILENCE_MS = 120_000;
const ATTEMPTS = 3;

/** A URL's answer, streamed, a line in the log every 20 MB; retried ATTEMPTS times. */
async function downloadStreamed(url: string, label: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), SILENCE_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': DATA_USER_AGENT } });
      if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status}`);
      const parts: Uint8Array[] = [];
      let total = 0;
      let logged = 0;
      for await (const part of response.body as unknown as AsyncIterable<Uint8Array>) {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), SILENCE_MS);
        parts.push(part);
        total += part.length;
        if (total - logged >= 20e6) {
          logged = total;
          console.log(`${LOG} ${label}: ${(total / 1e6).toFixed(0)} MB so far.`);
        }
      }
      const bytes = new Uint8Array(total);
      let at = 0;
      for (const part of parts) {
        bytes.set(part, at);
        at += part.length;
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) {
        console.warn(`${LOG} ${label}: attempt ${attempt}/${ATTEMPTS} failed (${String(error).slice(0, 200)}); retrying.`);
        await new Promise((done) => setTimeout(done, 10_000 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Could not read ${label} from ${url}: ${String(lastError)}`);
}

const MIRROR_ROUNDS = 3;
const ROUND_WAIT_MS = 30_000;

/** A VizieR table's `columns`, from the first mirror that answers with at least `minimumRows`. */
async function readVizier(table: string, label: string, columns: readonly string[], textColumns: ReadonlySet<string>, minimumRows: number): Promise<AsuTable & { url: string }> {
  const failures: string[] = [];
  for (let round = 1; round <= MIRROR_ROUNDS; round += 1) {
    for (const mirror of VIZIER_ASU_MIRRORS) {
      const url = asuUrl(mirror, table, columns);
      try {
        const parsed = await fetchChecked(url, label, (bytes) => {
          const table = parseAsuTable(new TextDecoder('latin1').decode(bytes), columns, textColumns);
          if (table.rows < minimumRows) throw new Error(`only ${table.rows} rows, where the table has at least ${minimumRows}`);
          return table;
        });
        return { ...parsed, url };
      } catch (error) {
        failures.push(`${mirror} (round ${round}): ${String(error).slice(0, 300)}`);
        console.warn(`${LOG} ${label}: ${mirror} failed (${String(error).slice(0, 200)}); trying the next mirror.`);
      }
    }
    if (round < MIRROR_ROUNDS) await new Promise((done) => setTimeout(done, ROUND_WAIT_MS));
  }
  throw new Error(`Could not read ${label} (${table}) from any VizieR mirror:\n  ${failures.join('\n  ')}`);
}

/** Laniakea's named clusters, if laniakea.json is in the output directory: what the SZ clusters leave out. */
async function readLandmarks(outputDir: string): Promise<NamedPlace[] | null> {
  try {
    const info = JSON.parse(await readFile(join(outputDir, LANIAKEA_DIR, LANIAKEA_INFO_FILE), 'utf8')) as LaniakeaInfo;
    return landmarkPlaces(info.landmarks);
  } catch {
    return null;
  }
}

const VIZIER_TERMS =
  "No licence is stated for the catalogue; VizieR's rules of usage: free access for scientific use, copyright as the data's origin (the journal) holds it; cite the catalogue's paper and acknowledge VizieR (doi 10.26093/cds/vizier).";

/**
 * Where SDSS-IV's acknowledgement is, the one DR16 data asks for: linked as "SDSS-IV
 * acknowledgment" from https://www.sdss.org/collaboration/citing-sdss/, for the SDSS's earlier
 * phases. The About quotes it word for word (SourcesSection.tsx).
 */
export const SDSS4_ACKNOWLEDGEMENT_URL = 'https://www.sdss4.org/collaboration/#sdss4acknowledgement';

/** The catalogues, read, checked and built into quasars/'s contents. */
export async function loadQuasars(outputDir = OUTPUT_DIR): Promise<QuasarsOutput> {
  const queriedAt = new Date().toISOString();
  const [dr16q, kTable, psz2, landmarks] = await Promise.all([
    readVizier(DR16Q_TABLE, 'SDSS DR16Q', DR16Q_COLUMNS, DR16Q_TEXT_COLUMNS, DR16Q_LEAST_ROWS),
    readVizier(RICHARDS_K_TABLE, "Richards et al. 2006's K-corrections", RICHARDS_K_COLUMNS, new Set(), 500),
    readVizier(PSZ2_TABLE, 'Planck PSZ2', PSZ2_COLUMNS, PSZ2_TEXT_COLUMNS, PSZ2_LEAST_ROWS).catch((error: unknown) => {
      // The clusters are a few markers beside the quasars: without them, the quasars still are.
      console.warn(`${LOG} the Planck SZ clusters could not be read, and are left out this run: ${String(error).slice(0, 300)}`);
      return null;
    }),
    readLandmarks(outputDir),
  ]);
  console.log(`${LOG} read ${dr16q.rows} DR16Q rows, ${kTable.rows} K-corrections${psz2 === null ? '' : `, ${psz2.rows} PSZ2 detections`}; ${landmarks === null ? 'no laniakea.json' : `${landmarks.length} Laniakea clusters`} to leave out.`);

  const k = new KCorrection(kTable.numbers.z!, kTable.numbers.KCorr!);
  const build = buildQuasars(dr16q, k, QUASAR_RECORD_HOLDERS);
  const drawn: NamedPlace[] = [...CLUSTER_RECORD_HOLDERS.map((c) => ({ name: `${c.name} (a record-holder)`, raDeg: c.raDeg, decDeg: c.decDeg, z: c.z })), ...(landmarks ?? []).map((l) => ({ ...l, name: `${l.name} (Laniakea)` }))];
  const clusters = psz2 === null ? null : buildClusters(psz2, QUASAR_FILES.clusters, drawn);

  const dr16qCitation = 'Lyke B. W. et al. 2020, ApJS 250, 8 (The Sloan Digital Sky Survey Quasar Catalog: Sixteenth Data Release); VizieR VII/289, doi 10.26093/cds/vizier.7289';
  const sources: Record<string, QuasarsInfo['sources'][string]> = {
    dr16q: {
      citation: `${dr16qCitation}; Ahumada R. et al. 2020, ApJS 249, 3 (SDSS DR16); Blanton M. R. et al. 2017, AJ 154, 28 (SDSS-IV); Dawson K. S. et al. 2016, AJ 151, 44 (eBOSS)`,
      url: dr16q.url,
      queriedAt,
      rows: dr16q.rows,
      licence: `${VIZIER_TERMS} Public SDSS data: SDSS asks that the data release papers be cited and its acknowledgement included (${SDSS4_ACKNOWLEDGEMENT_URL}).`,
      credit: `Lyke et al. 2020, ApJS 250, 8, via VizieR (CDS, Strasbourg). SDSS-IV: the acknowledgement at ${SDSS4_ACKNOWLEDGEMENT_URL}, quoted in full in the About.`,
    },
    richards2006: {
      citation: 'Richards G. T. et al. 2006, AJ 131, 2766 (The Sloan Digital Sky Survey Quasar Survey: Quasar Luminosity Function from Data Release 3), Table 4; VizieR J/AJ/131/2766',
      url: kTable.url,
      queriedAt,
      rows: kTable.rows,
      licence: VIZIER_TERMS,
      credit: 'Richards et al. 2006, AJ 131, 2766, via VizieR (CDS, Strasbourg).',
    },
  };
  if (psz2 !== null) {
    sources.psz2 = {
      citation: 'Planck Collaboration 2016, A&A 594, A27 (Planck 2015 results. XXVII. The second Planck catalogue of Sunyaev-Zeldovich sources); VizieR J/A+A/594/A27, union catalogue',
      url: psz2.url,
      queriedAt,
      rows: psz2.rows,
      licence: `${VIZIER_TERMS} ESA's Planck data are public; ESA asks that the Planck Collaboration's paper be cited and the Planck mission acknowledged.`,
      credit: 'Based on observations obtained with Planck (http://www.esa.int/Planck), an ESA science mission with instruments and contributions directly funded by ESA Member States, NASA, and Canada. Planck Collaboration 2016, A&A 594, A27, via VizieR (CDS, Strasbourg).',
    };
  }
  return assembleQuasars({ build, sources, clusters });
}

/** quasars/, the chunks and the clusters, then quasars.json last: a run cut short leaves none, which the app reads as no quasars. */
export async function writeQuasars(output: QuasarsOutput, outputDir = OUTPUT_DIR): Promise<void> {
  const directory = join(outputDir, QUASARS_DIR);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  for (const [file, bytes] of Object.entries(output.files)) await writeFile(join(directory, file), bytes);
  await writeFile(join(directory, QUASARS_INFO_FILE), `${JSON.stringify(output.info, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' }, cache: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  cacheDirectory = values.cache === undefined ? null : resolve(values.cache);
  const output = await loadQuasars(outputDir);
  for (const line of describeQuasars(output)) console.log(line);
  await writeQuasars(output, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
