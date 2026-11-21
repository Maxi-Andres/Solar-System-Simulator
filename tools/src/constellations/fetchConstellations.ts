/**
 * Regenerates the constellations alone, without the Horizons run: `pnpm fetch:constellations`.
 *
 *   pnpm fetch:constellations                       # into web/public/data/
 *   pnpm fetch:constellations --out <directory>     # anywhere else
 *   pnpm fetch:constellations --cache <directory>   # the star catalogues' kept answers
 *
 * Three small downloads -- the IAU boundaries (CDS VI/49) and d3-celestial's figures and name
 * points -- and the sky, read as fetch:data reads it, for the stars the figures join. Writes
 * constellations.json and touches nothing else. The full run (fetchData.ts) builds it through
 * loadConstellations() from the sky it has already read.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  CONSTELLATION_BOUNDARY_URLS,
  CONSTELLATION_LINES_URL,
  CONSTELLATION_NAMES_URL,
  CONSTELLATIONS_FILE,
  OUTPUT_DIR,
} from '../config.ts';
import { cachedDownload } from '../pulsars/fetchPulsars.ts';
import type { SkyBuild } from '../stars/buildStarCatalog.ts';
import { loadSky } from '../stars/fetchStars.ts';
import { useTapCache } from '../stars/tap.ts';
import { writeConstellations } from '../writeOutput.ts';
import {
  buildConstellations,
  describeConstellations,
  parseBoundaries,
  parseFigures,
  parseNames,
  type ConstellationsBuild,
} from './constellations.ts';

const LOG = '[constellations]';

/** The boundary file's text, checked: 89 polygons (Serpens is two). */
function readBoundaries(bytes: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(bytes);
  const polygons = parseBoundaries(text);
  if (polygons.length !== 89) {
    throw new Error(`${polygons.length} boundary polygons, not 89; the format is not the one expected`);
  }
  return text;
}

/** A GeoJSON file of d3-celestial's, parsed and checked by `check`. */
function readGeoJson(check: (raw: unknown) => unknown): (bytes: Uint8Array) => unknown {
  return (bytes) => {
    const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
    check(raw);
    return raw;
  };
}

/** The boundaries from the first address that gives them: the CfA's mirror, then CDS. */
async function fetchBoundaries(): Promise<{ text: string; url: string }> {
  let lastError: unknown = null;
  for (const url of CONSTELLATION_BOUNDARY_URLS) {
    try {
      return { text: await cachedDownload(url, 'the constellation boundaries (VI/49)', readBoundaries, { log: LOG }), url };
    } catch (error) {
      lastError = error;
      console.warn(`${LOG} boundaries: ${url} failed (${String(error).slice(0, 200)}); trying the next address.`);
    }
  }
  throw new Error(`the constellation boundaries could not be read: ${String(lastError)}`);
}

/**
 * The constellations, given the sky the figures are matched against. Static sources, so
 * read once and kept by the download cache (downloadCache.ts); throws when any cannot be read.
 */
export async function loadConstellations(skyRead: Promise<SkyBuild>): Promise<ConstellationsBuild> {
  const [boundaries, figures, names] = await Promise.all([
    fetchBoundaries(),
    cachedDownload(CONSTELLATION_LINES_URL, 'the constellation figures (d3-celestial)', readGeoJson(parseFigures), { log: LOG }),
    cachedDownload(CONSTELLATION_NAMES_URL, 'the constellation names (d3-celestial)', readGeoJson(parseNames), { log: LOG }),
  ]);
  const sky = await skyRead;
  const build = buildConstellations({
    boundaries: boundaries.text,
    figures,
    names,
    sky: sky.stars,
    read: { boundaries: boundaries.url, figures: CONSTELLATION_LINES_URL },
    queriedAt: new Date().toISOString(),
  });
  for (const line of describeConstellations(build)) {
    console.log(line);
  }
  return build;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' }, cache: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const starCache = values.cache ?? process.env.STAR_CATALOGUE_CACHE;
  useTapCache(starCache === undefined || starCache === '' ? null : resolve(starCache));
  const build = await loadConstellations(loadSky());
  await writeConstellations(build.catalog, outputDir);
  console.log(`${LOG} wrote ${resolve(outputDir, CONSTELLATIONS_FILE)}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
