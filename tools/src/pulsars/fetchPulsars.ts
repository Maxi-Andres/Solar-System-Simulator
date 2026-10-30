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
import { retryDelayMs } from '../horizons/client.ts';
import type { PulsarCatalog } from '../types.ts';
import { writePulsars } from '../writeOutput.ts';
import { parseAtnfDatabase, parseAtnfReferences, unpackAtnf } from './atnf.ts';
import { buildPulsars, describePulsars } from './buildPulsars.ts';
import { parseMcgillCsv } from './mcgill.ts';

/** One file over HTTPS, its bytes; retried with the project's backoff, then thrown. */
async function download(url: string, label: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
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

/** Both catalogues, read and built into pulsars.json's contents. */
export async function loadPulsars(): Promise<PulsarCatalog> {
  const queriedAt = new Date().toISOString();
  const [atnfPackage, mcgillCsv] = await Promise.all([
    download(ATNF_PACKAGE_URL, 'the ATNF Pulsar Catalogue'),
    download(MCGILL_MAGNETARS_URL, 'the McGill magnetar catalogue'),
  ]);
  const { database, references } = unpackAtnf(atnfPackage);
  return buildPulsars({
    atnf: parseAtnfDatabase(database),
    atnfReferences: parseAtnfReferences(references),
    magnetars: parseMcgillCsv(new TextDecoder().decode(mcgillCsv)),
    queriedAt,
  });
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
