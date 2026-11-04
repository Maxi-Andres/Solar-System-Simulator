/**
 * Regenerates the Local Group alone: `pnpm fetch:local-group`.
 *
 *   pnpm fetch:local-group                    # into web/public/data/
 *   pnpm fetch:local-group --out <directory>  # anywhere else
 *
 * One FITS file of 60 KB, McConnachie's catalogue. The full run (fetchData.ts) reads it
 * through loadLocalGroup() too.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { NEARBY_GALAXIES_URL, OUTPUT_DIR } from '../config.ts';
import { download } from '../pulsars/fetchPulsars.ts';
import type { LocalGroupCatalog } from '../types.ts';
import { writeLocalGroup } from '../writeOutput.ts';
import { buildLocalGroup, describeLocalGroup, readFitsTable } from './nearbyGalaxies.ts';

/** The catalogue, read and built into local-group.json's contents. */
export async function loadLocalGroup(): Promise<LocalGroupCatalog> {
  const queriedAt = new Date().toISOString();
  const bytes = await download(NEARBY_GALAXIES_URL, "McConnachie's catalogue of nearby galaxies");
  return buildLocalGroup(readFitsTable(bytes), queriedAt);
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const catalog = await loadLocalGroup();
  for (const line of describeLocalGroup(catalog)) {
    console.log(line);
  }
  await writeLocalGroup(catalog, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
