/**
 * Regenerates the pulsars alone, without the Horizons run: `pnpm fetch:pulsars`.
 *
 *   pnpm fetch:pulsars                    # into web/public/data/
 *   pnpm fetch:pulsars --out <directory>  # anywhere else
 *
 * Two downloads, a few seconds: the ATNF's psrcat package and McGill's magnetar table.
 * Writes pulsars.json and touches nothing else. The full run (fetchData.ts) reads them
 * through loadPulsars() too.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { ATNF_PACKAGE_URL, MAX_RETRIES, MCGILL_MAGNETARS_URL, OUTPUT_DIR, REQUEST_TIMEOUT_MS } from '../config.ts';
import { type CachePolicy, throughCache } from '../downloadCache.ts';
import { retryDelayMs } from '../horizons/client.ts';
import type { PulsarCatalog } from '../types.ts';
import { writePulsars } from '../writeOutput.ts';
import { parseAtnfDatabase, parseAtnfReferences, unpackAtnf } from './atnf.ts';
import { buildPulsars, describePulsars } from './buildPulsars.ts';
import { parseMcgillCsv } from './mcgill.ts';

/**
 * One file over HTTPS, its bytes; retried with the project's backoff, then thrown. `headers`
 * for a host that wants them (Zenodo answers 403 to a request that does not say who asks).
 */
export async function download(url: string, label: string, headers?: Record<string, string>): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...(headers === undefined ? {} : { headers }) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        break;
      }
      const wait = retryDelayMs(attempt, null);
      console.warn(`[pulsars] ${label}: attempt ${attempt}/${MAX_RETRIES} failed (${String(error).slice(0, 200)}); retrying.`);
      await new Promise((done) => setTimeout(done, wait));
    }
  }
  throw new Error(`Could not read ${label} from ${url}: ${String(lastError)}`);
}

/**
 * One file, through the download cache (downloadCache.ts): parsed and checked by `read`,
 * which runs on a kept copy too, and kept by the URL. `policy` says whether the host is
 * asked first (a `living` catalogue) or only when nothing is kept (`static`, the default).
 *
 * download() itself keeps nothing: the cosmic web keeps its own downloads apart (its
 * `--cache`), and calls it directly.
 */
export function cachedDownload<T>(
  url: string,
  label: string,
  read: (bytes: Uint8Array) => T,
  options: { readonly policy?: CachePolicy; readonly headers?: Record<string, string>; readonly log?: string } = {},
): Promise<T> {
  return throughCache({
    key: url,
    label,
    fetch: () => download(url, label, options.headers),
    read,
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.log === undefined ? {} : { log: options.log }),
  });
}

/**
 * Both catalogues, read and built into pulsars.json's contents. Both are living catalogues,
 * added to as pulsars are found, so both are asked every run; the last answers kept are the
 * fallback when a host cannot be read (downloadCache.ts).
 */
export async function loadPulsars(): Promise<PulsarCatalog> {
  const queriedAt = new Date().toISOString();
  const [atnf, magnetars] = await Promise.all([
    cachedDownload(
      ATNF_PACKAGE_URL,
      'the ATNF Pulsar Catalogue',
      (bytes) => {
        const { database, references } = unpackAtnf(bytes);
        return { atnf: parseAtnfDatabase(database), atnfReferences: parseAtnfReferences(references) };
      },
      { policy: 'living', log: '[pulsars]' },
    ),
    cachedDownload(
      MCGILL_MAGNETARS_URL,
      'the McGill magnetar catalogue',
      (bytes) => parseMcgillCsv(new TextDecoder().decode(bytes)),
      { policy: 'living', log: '[pulsars]' },
    ),
  ]);
  return buildPulsars({ ...atnf, magnetars, queriedAt });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const catalog = await loadPulsars();
  for (const line of describePulsars(catalog)) {
    console.log(line);
  }
  await writePulsars(catalog, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
