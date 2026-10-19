/**
 * Regenerates the asteroid belt alone, without the Horizons run: `pnpm fetch:belt`.
 *
 * A full `pnpm fetch:data` spends nearly all its time on Horizons, thousands of requests;
 * the belt is one SBDB request of about twelve seconds. This writes belt/ into an
 * existing data directory and touches nothing else there -- see writeBelt.
 *
 *   pnpm fetch:belt                     # into web/public/data/
 *   pnpm fetch:belt --out <directory>   # anywhere else
 *
 * Its mean anomalies are moved to the same instant a full run today would use (see
 * todayUtcMidnight), so a belt regenerated on the day of the data directory's run is
 * for the same instant as the rest of it; on another day it is simply newer, and
 * belt.json says which instant it is for.
 *
 * What it leaves out is what that data directory draws as bodies: the small bodies and
 * Pluto in its bodies.json, or the whole catalog's when there is none yet.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { CATALOG } from '../catalog.ts';
import { BELT_MAGNITUDE_LIMIT, OUTPUT_DIR } from '../config.ts';
import { todayUtcMidnight } from '../fetchData.ts';
import { toJulianDay } from '../horizons/queries.ts';
import type { BodyDefinition } from '../types.ts';
import { writeBelt } from '../writeOutput.ts';
import { buildBelt, catalogDesignations, describeBelt } from './buildBelt.ts';
import { fetchBeltRows } from './sbdb.ts';

/** The bodies the data directory already draws, or null when it has no catalog yet. */
async function publishedBodies(outputDir: string): Promise<BodyDefinition[] | null> {
  try {
    return JSON.parse(await readFile(join(outputDir, 'bodies.json'), 'utf8')) as BodyDefinition[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const started = performance.now();

  const published = await publishedBodies(outputDir);
  if (published === null) {
    console.log(`[belt] no bodies.json in ${outputDir}; leaving out the whole catalog's small bodies`);
  }

  const epoch = todayUtcMidnight();
  const rows = await fetchBeltRows(BELT_MAGNITUDE_LIMIT);
  console.log(
    `[belt] ${rows.rows.length} rows from SBDB in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
  const belt = buildBelt({
    rows: rows.rows,
    queriedAt: rows.queriedAt,
    referenceJd: toJulianDay(epoch),
    magnitudeLimit: BELT_MAGNITUDE_LIMIT,
    excluded: catalogDesignations(published ?? CATALOG),
  });
  for (const line of describeBelt(belt)) {
    console.log(line);
  }

  await writeBelt(belt, outputDir);
  console.log(
    `[belt] wrote ${join(outputDir, 'belt')} in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
  console.log("[belt] Asteroid orbits from JPL's Small-Body Database (NASA/JPL-Caltech).");
}

await main();
