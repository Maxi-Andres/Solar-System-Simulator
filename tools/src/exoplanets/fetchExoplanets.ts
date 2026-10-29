/**
 * Regenerates the exoplanets alone, without the Horizons run: `pnpm fetch:exoplanets`.
 *
 *   pnpm fetch:exoplanets                    # into web/public/data/
 *   pnpm fetch:exoplanets --out <directory>  # anywhere else
 *
 * One query to the NASA Exoplanet Archive, four seconds; the hosts are matched against the
 * 3D stars already in the output directory (stars3d/), read from their tier and details
 * files -- so it is run after `pnpm fetch:stars` or a full run, never before. Without them
 * every host is placed from the Archive, and the log says so. Writes exoplanets.json and
 * touches nothing else.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { OUTPUT_DIR, STARS3D_DIR, STARS3D_INFO_FILE } from '../config.ts';
import { STAR3D_RECORD_FLOATS, type Stars3dInfo } from '../types.ts';
import { writeExoplanets } from '../writeOutput.ts';
import { ARCHIVE_ACKNOWLEDGEMENT, fetchArchive } from './archive.ts';
import { buildExoplanets, describeExoplanets, type Star3dIds } from './buildExoplanets.ts';

/** A file's bytes as an ArrayBuffer of their own, so typed arrays can be laid over them. */
async function readBuffer(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * The 3D stars' ids and records from a data directory: stars3d.json, and each tier's
 * record file and details file (Gaia ids, 8 bytes a star, then HIP numbers, 4). Null where
 * there are no 3D stars there.
 */
export async function starIdsFromDisk(outputDir: string): Promise<Star3dIds | null> {
  const directory = join(outputDir, STARS3D_DIR);
  let info: Stars3dInfo;
  try {
    info = JSON.parse(await readFile(join(directory, STARS3D_INFO_FILE), 'utf8')) as Stars3dInfo;
  } catch {
    return null;
  }
  const tiers = await Promise.all(
    info.tiers.map(async (tier) => {
      const records = new Float32Array(await readBuffer(join(directory, tier.file)));
      const details = await readBuffer(join(directory, tier.details));
      const n = tier.count;
      if (records.length !== n * STAR3D_RECORD_FLOATS || details.byteLength < n * 12) {
        throw new Error(`${tier.file} or ${tier.details} does not hold ${n} stars.`);
      }
      return { gaia: new BigUint64Array(details, 0, n), hip: new Uint32Array(details, n * 8, n), records };
    }),
  );
  return { queriedAt: info.queriedAt, frame: info.frame, tiers };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const stars = await starIdsFromDisk(outputDir);
  if (stars === null) {
    console.warn(`[exoplanets] no 3D stars in ${outputDir}: every host is placed from the Archive.`);
  }
  const { rows, queriedAt } = await fetchArchive();
  const catalog = buildExoplanets({ rows, queriedAt, stars });
  for (const line of describeExoplanets(catalog)) {
    console.log(line);
  }
  await writeExoplanets(catalog, outputDir);
  console.log(`[exoplanets] ${ARCHIVE_ACKNOWLEDGEMENT}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
