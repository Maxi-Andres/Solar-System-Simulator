/**
 * Regenerates the Earth satellites alone, without the Horizons run: `pnpm fetch:satellites`.
 *
 *   pnpm fetch:satellites                       # into web/public/data/
 *   pnpm fetch:satellites --out <directory>     # anywhere else
 *   pnpm fetch:satellites --cache <directory>   # keep CelesTrak's answers there
 *
 * Fourteen requests to CelesTrak, 4.7 MB, and two seconds of SGP4. It writes
 * satellites/ into the data directory and touches nothing else there -- see
 * writeSatellites. Run it no more often than CelesTrak updates, every two hours: a group
 * asked for again before then is refused (see celestrak.ts), which `--cache` avoids while
 * iterating.
 *
 * It fails, and leaves any satellites/ already there as it was, when CelesTrak's `active`
 * group cannot be read; a later group that fails costs only its own filter bit.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { OUTPUT_DIR, SATELLITES_DIR } from '../config.ts';
import { writeSatellites } from '../writeOutput.ts';
import { buildSatellites, describeSatellites, referenceFor, type SatelliteBuild } from './buildSatellites.ts';
import { readCelestrak } from './celestrak.ts';

/**
 * Reads CelesTrak and builds the layer, or returns null -- with the reason in the log --
 * when the backbone group could not be read. Used by this script and by fetch:data.
 */
export async function loadSatellites(cacheDir: string | null = null): Promise<SatelliteBuild | null> {
  const started = performance.now();
  const read = await readCelestrak(cacheDir);
  if (!read.gp.has('active')) {
    console.error(`[satellites] CelesTrak's active group could not be read: ${read.failure}`);
    return null;
  }
  console.log(
    `[satellites] ${read.requests} requests to CelesTrak, ${(read.bytes / 1e6).toFixed(1)} MB, ` +
      `${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
  const build = buildSatellites({ read, referenceJdUtc: referenceFor(read.queriedAt) });
  for (const line of describeSatellites(build)) {
    console.log(line);
  }
  console.log(`[satellites] built in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  return build;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' }, cache: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const build = await loadSatellites(values.cache === undefined ? null : resolve(values.cache));
  if (build === null) {
    console.error(`[satellites] nothing written; ${outputDir} is as it was.`);
    process.exitCode = 1;
    return;
  }
  await writeSatellites(build, outputDir);
  console.log(`[satellites] wrote ${resolve(outputDir, SATELLITES_DIR)}`);
  console.log(`[satellites] ${build.info.credit}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
