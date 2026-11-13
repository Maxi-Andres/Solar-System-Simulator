/**
 * Regenerates Laniakea and its surroundings alone (G3): `pnpm fetch:laniakea`.
 *
 *   pnpm fetch:laniakea                    # into web/public/data/laniakea/
 *   pnpm fetch:laniakea --out <directory>  # into <directory>/laniakea/
 *
 * Five VizieR tables (Cosmicflows-4's galaxies and groups, 2MRS, Tully's 2MASS groups,
 * Einasto et al.'s superclusters; 50 MB of text), HyperLEDA for some 87,000 galaxies by PGC
 * number (about 45 queries), the CF4 density cube from Zenodo (8 MB) and the watersheds from
 * the CosmicFlows project page (67 MB); and local-group.json's and local-volume.json's
 * catalogues, read afresh, to leave out the galaxies they draw. Writes laniakea/ and
 * touches nothing else. The full run (fetchData.ts) calls loadLaniakea() too, handing it
 * the Local Group and the Local Volume it has already read.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  CF4_DENSITY_URLS,
  CF4_GALAXY_TABLE,
  CF4_GROUP_TABLE,
  CF4_WATERSHEDS_URL,
  DATA_USER_AGENT,
  EINASTO_1997_TABLE,
  HYPERLEDA_SQL_URLS,
  OUTPUT_DIR,
  TULLY_2015_GALAXY_TABLE,
  TWO_MRS_TABLE,
} from '../config.ts';
import { loadLocalGroup } from '../localGroup/fetchLocalGroup.ts';
import { readVizierTable } from '../localVolume/asu.ts';
import { loadLocalVolume } from '../localVolume/fetchLocalVolume.ts';
import { download } from '../pulsars/fetchPulsars.ts';
import type { LaniakeaInfo, LocalGroupCatalog, LocalVolumeCatalog } from '../types.ts';
import { writeLaniakea } from '../writeOutput.ts';
import {
  buildLaniakeaGalaxies,
  localGalaxies,
  readCf4Galaxies,
  readCf4Groups,
  readTullyGalaxies,
  readTwoMrs,
  type LaniakeaBuild,
} from './galaxies.ts';
import { assembleLaniakea, describeLaniakea, type LaniakeaOutput } from './laniakea.ts';
import { basinLandmarks, clusterLandmarks, greatAttractor, superclusterLandmarks, voidLandmarks, wallLandmarks } from './landmarks.ts';
import { fetchLedaByPgc } from './ledaPgc.ts';
import { checkAttractors, cropBasins, quantiseDensity, readFitsCube, readZip, WATERSHED_FILES, type WatershedGrid } from './watersheds.ts';

const LOG = '[laniakea]';

/** The density cube: Zenodo's 128^3, else the project page's 64^3. */
async function readDensity(): Promise<{ size: number; values: Float64Array; url: string }> {
  const failures: string[] = [];
  for (const { url, voxels } of CF4_DENSITY_URLS) {
    try {
      const cube = readFitsCube(await download(url, 'the CF4 density cube', { 'User-Agent': DATA_USER_AGENT }));
      if (cube.size !== voxels) {
        throw new Error(`a cube of ${cube.size}^3, where ${voxels}^3 was expected`);
      }
      return { ...cube, url };
    } catch (error) {
      failures.push(`${url}: ${String(error).slice(0, 300)}`);
      console.warn(`${LOG} the CF4 density cube: ${url} failed (${String(error).slice(0, 200)}); trying the next.`);
    }
  }
  throw new Error(`Could not read the CF4 density cube:\n  ${failures.join('\n  ')}`);
}

export interface LaniakeaLoad {
  readonly output: LaniakeaOutput;
  readonly build: LaniakeaBuild;
}

/** The catalogues and grids, read, matched and built into laniakea/'s contents. */
export async function loadLaniakea(
  localGroup?: Promise<LocalGroupCatalog>,
  localVolume?: Promise<LocalVolumeCatalog>,
): Promise<LaniakeaLoad> {
  const queriedAt = new Date().toISOString();
  const lg = localGroup ?? loadLocalGroup();
  const [cf4Rows, groupRows, mrsRows, tullyRows, einastoRows, watershedZip, density, lgCatalog, lvCatalog] = await Promise.all([
    readVizierTable(CF4_GALAXY_TABLE, 'Cosmicflows-4\'s galaxies', ['PGC', '1PGC', 'Vcmb', 'DM', 'e_DM', 'DMtf', 'DMfp', 'DMsnIa', 'RAJ2000', 'DEJ2000'], 55000, LOG),
    readVizierTable(CF4_GROUP_TABLE, 'Cosmicflows-4\'s groups', ['1PGC', 'Ngal', 'DMzp', 'e_DMzp', 'Vcmb', 'RAJ2000', 'DEJ2000'], 38000, LOG),
    readVizierTable(TWO_MRS_TABLE, 'the 2MASS Redshift Survey', ['ID', 'RAJ2000', 'DEJ2000', 'GLON', 'GLAT', 'Ktmag', 'Riso', 'b/a', 'type', 'cz'], 44000, LOG),
    readVizierTable(TULLY_2015_GALAXY_TABLE, 'Tully\'s 2MASS groups', ['PGC', 'MType', 'HV', 'Kmag', 'Nest', 'Nmb', 'PGC1', 'Mvir', 'Mlum', 'R2t', 'sigP', '_RA.icrs', '_DE.icrs'], 42000, LOG),
    readVizierTable(EINASTO_1997_TABLE, 'Einasto et al.\'s superclusters', ['SC', 'Nmembers', 'Dist', 'ID', '_RAJ2000', '_DEJ2000'], 800, LOG, '&-out.add=_RAJ,_DEJ'),
    download(CF4_WATERSHEDS_URL, 'the CF4 watersheds', { 'User-Agent': DATA_USER_AGENT }),
    readDensity(),
    lg,
    localVolume ?? loadLocalVolume(lg),
  ]);
  const cf4 = readCf4Galaxies(cf4Rows.rows);
  const { groups: cf4Groups, moved } = readCf4Groups(groupRows.rows, cf4);
  const mrs = readTwoMrs(mrsRows.rows);
  const tully = readTullyGalaxies(tullyRows.rows);
  console.log(`${LOG} read ${cf4.length} CF4 galaxies in ${cf4Groups.size} groups (${moved} centred on their members, the table's centre over 2 degrees away), ${mrs.length} 2MRS galaxies, ${tully.length} of Tully's, ${einastoRows.rows.length} Einasto rows.`);

  const ledaQueriedAt = new Date().toISOString();
  const pgcs = [...new Set([...cf4.map((c) => c.pgc), ...tully.map((t) => t.pgc)])];
  const leda = await fetchLedaByPgc(pgcs);
  console.log(`${LOG} HyperLEDA: ${leda.size} of ${pgcs.length} PGC numbers found.`);

  const build = buildLaniakeaGalaxies({ cf4, cf4Groups, mrs, tully, leda, locals: localGalaxies(lgCatalog, lvCatalog) });

  const zip = readZip(watershedZip);
  const cubes = {} as Record<WatershedGrid, { size: number; values: Float64Array }>;
  for (const [grid, file] of Object.entries(WATERSHED_FILES) as [WatershedGrid, string][]) {
    const bytes = zip.get(file);
    if (bytes === undefined) {
      throw new Error(`The watersheds zip has no ${file} (it has ${[...zip.keys()].join(', ')}).`);
    }
    cubes[grid] = readFitsCube(bytes);
  }
  const problems = checkAttractors(cubes);
  if (problems.length > 0) {
    throw new Error(`The watershed grids do not read as Dupuy & Courtois describe them:\n  ${problems.join('\n  ')}`);
  }
  const basins = cropBasins(cubes);
  const basinSize = cubes.galaxiesAttraction.size;

  const clusters = clusterLandmarks({ cf4, cf4Groups, tully, einasto: einastoRows.rows, groups: build.groups, basinVoxels: basins.voxels, basinVoxelSize: basinSize });
  const superclusters = superclusterLandmarks(einastoRows.rows);
  for (const missing of [...clusters.missing, ...superclusters.missing]) {
    console.warn(`${LOG} landmark ${missing}: not found in the catalogues, left out.`);
  }
  const landmarks = [
    ...basinLandmarks({ basinVoxels: basins.voxels, basinVoxelSize: basinSize }),
    greatAttractor(),
    ...superclusters.landmarks,
    ...clusters.landmarks,
    ...voidLandmarks(),
    ...wallLandmarks(),
  ];

  const sources: LaniakeaInfo['sources'] = {
    cf4: { citation: 'Tully et al. 2023, ApJ 944, 94 (Cosmicflows-4), table2', url: cf4Rows.url, queriedAt, rows: cf4Rows.rows.length },
    cf4Groups: { citation: 'Tully et al. 2023, ApJ 944, 94 (Cosmicflows-4), groups', url: groupRows.url, queriedAt, rows: groupRows.rows.length },
    twoMrs: { citation: 'Huchra et al. 2012, ApJS 199, 26 (the 2MASS Redshift Survey), table3', url: mrsRows.url, queriedAt, rows: mrsRows.rows.length },
    tully2015: { citation: 'Tully 2015, AJ 149, 171 (Galaxy groups: a 2MASS catalog), table5', url: tullyRows.url, queriedAt, rows: tullyRows.rows.length },
    einasto1997: { citation: 'Einasto et al. 1997, A&AS 123, 119 (The supercluster-void network I), Table A2', url: einastoRows.url, queriedAt, rows: einastoRows.rows.length },
    hyperleda: { citation: 'Makarov et al. 2014, A&A 570, A13 (HyperLEDA)', url: HYPERLEDA_SQL_URLS[0]!, queriedAt: ledaQueriedAt, rows: leda.size },
    cf4Density: {
      citation: 'Courtois et al. 2023, A&A 670, L15 (density and velocity fields from CosmicFlows-4); data: H. Courtois, Zenodo doi 10.5281/zenodo.20653238 (CC BY 4.0)',
      url: density.url,
      queriedAt,
      rows: null,
    },
    cf4Watersheds: { citation: 'Dupuy & Courtois 2023, A&A 678, A176 (Laniakea and five more watershed superclusters)', url: CF4_WATERSHEDS_URL, queriedAt, rows: null },
  };
  const output = assembleLaniakea({
    build,
    density: {
      size: density.size,
      values: quantiseDensity(density.values),
      source: `Courtois et al. 2023, A&A 670, L15: the CF4 galaxies' reconstruction, ${density.size}^3 voxels over 1000 Mpc/h (${density.url}).`,
    },
    basins,
    basinSize,
    landmarks,
    sources,
  });
  return { output, build };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const { output, build } = await loadLaniakea();
  for (const line of describeLaniakea(output, build)) {
    console.log(line);
  }
  await writeLaniakea(output, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
