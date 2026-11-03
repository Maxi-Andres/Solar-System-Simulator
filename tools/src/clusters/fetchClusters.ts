/**
 * Regenerates the globular clusters alone: `pnpm fetch:clusters`.
 *
 *   pnpm fetch:clusters                    # into web/public/data/
 *   pnpm fetch:clusters --out <directory>  # anywhere else
 *
 * Three small text files: Baumgardt's two tables and Harris's catalogue. The full run
 * (fetchData.ts) reads them through loadGlobularClusters() too.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { BAUMGARDT_ORBITS_URL, BAUMGARDT_STRUCTURE_URL, HARRIS_URL, OUTPUT_DIR } from '../config.ts';
import { download } from '../pulsars/fetchPulsars.ts';
import type { GlobularClusterCatalog } from '../types.ts';
import { writeGlobularClusters } from '../writeOutput.ts';
import {
  buildGlobularClusters,
  describeGlobularClusters,
  parseBaumgardtOrbits,
  parseBaumgardtStructure,
  parseHarris,
} from './globularClusters.ts';

/** The three files, read and built into globular-clusters.json's contents. */
export async function loadGlobularClusters(): Promise<GlobularClusterCatalog> {
  const queriedAt = new Date().toISOString();
  const text = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);
  const [orbits, structure, harris] = await Promise.all([
    download(BAUMGARDT_ORBITS_URL, "Baumgardt's cluster motions"),
    download(BAUMGARDT_STRUCTURE_URL, "Baumgardt's cluster structure"),
    download(HARRIS_URL, 'the Harris catalogue'),
  ]);
  return buildGlobularClusters({
    orbits: parseBaumgardtOrbits(text(orbits)),
    structure: parseBaumgardtStructure(text(structure)),
    harris: parseHarris(text(harris)),
    queriedAt,
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const catalog = await loadGlobularClusters();
  for (const line of describeGlobularClusters(catalog)) {
    console.log(line);
  }
  await writeGlobularClusters(catalog, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
