/**
 * Regenerates the asteroid belt and the comets alone, without the Horizons run:
 * `pnpm fetch:belt`.
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
 * Pluto in its bodies.json, out of the belt, and its famous comets out of the comets -- or
 * the whole catalog's when there is none yet.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { CATALOG } from '../catalog.ts';
import { cometDesignations } from '../famousComets.ts';
import { BELT_MAGNITUDE_LIMIT, BELT_TIER_LIMITS, OUTPUT_DIR } from '../config.ts';
import { todayUtcMidnight } from '../fetchData.ts';
import { toJulianDay } from '../horizons/queries.ts';
import type { BodyDefinition } from '../types.ts';
import { writeBelt } from '../writeOutput.ts';
import { BeltAccumulator, catalogDesignations, describeBelt } from './buildBelt.ts';
import { buildComets, describeComets, fetchComets } from './comets.ts';
import { fetchBelt } from './sbdb.ts';

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

  const excluded = catalogDesignations(published ?? CATALOG);
  const referenceJd = toJulianDay(todayUtcMidnight());
  // The comets alongside: one request, back long before the belt's sixteen.
  const [read, cometRows] = await Promise.all([
    fetchBelt(
      () =>
        new BeltAccumulator({
          referenceJd,
          candidates: excluded,
          namesBrighterThan: BELT_TIER_LIMITS[0]!,
        }),
      BELT_MAGNITUDE_LIMIT,
    ),
    fetchComets(),
  ]);
  console.log(
    `[belt] ${read.count} rows from SBDB in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
  const belt = read.sink.finish({
    queriedAt: read.queriedAt,
    excluded,
    tierLimits: BELT_TIER_LIMITS,
  });
  const comets = buildComets({
    ...cometRows,
    referenceJd,
    excluded: cometDesignations(published ?? CATALOG),
  });
  for (const line of [...describeBelt(belt), ...describeComets(comets)]) {
    console.log(line);
  }

  await writeBelt(belt, comets, outputDir);
  // maxRSS is in kilobytes. Logged because the whole catalogue is the one thing in the
  // tools that could outgrow a CI runner's memory, and the place to see it first is here.
  console.log(
    `[belt] wrote ${join(outputDir, 'belt')} in ${((performance.now() - started) / 1000).toFixed(1)} s, ` +
      `peak memory ${Math.round(process.resourceUsage().maxRSS / 1024)} MB`,
  );
  console.log("[belt] Asteroid orbits from JPL's Small-Body Database (NASA/JPL-Caltech).");
}

await main();
