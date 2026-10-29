/**
 * Regenerates the stars alone, without the Horizons run: `pnpm fetch:stars`.
 *
 *   pnpm fetch:stars                       # into web/public/data/
 *   pnpm fetch:stars --out <directory>     # anywhere else
 *   pnpm fetch:stars --cache <directory>   # keep the services' answers there
 *
 * Writes stars.json and stars3d/ together and touches nothing else -- together because a
 * 3D record names its stars.json row, so the two files are one product and must come
 * from the same read. About thirty TAP queries against the ESA Gaia Archive (VizieR when
 * it is down, and the other way round for the sky), and one download of the Bright Star
 * Catalogue: three to four minutes. It fails, and leaves both as they were, when the sky,
 * the nearby-stars census or the Hipparcos parallaxes cannot be read from either service.
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { OUTPUT_DIR, STARS3D_DIR } from '../config.ts';
import type { StarCatalog } from '../types.ts';
import { writeStars, writeStars3d } from '../writeOutput.ts';
import { build3d, skyCounterpartFilter, type SourceNote, type Stars3dBuild } from './build3d.ts';
import { buildSky, type SkyBuild } from './buildStarCatalog.ts';
import { fetchBsc } from './bsc.ts';
import { buildNames, type NamesBuild } from './names3d.ts';
import { fetchPulkovo } from './pulkovo.ts';
import { fetchBrightGaia, fetchGcns, fetchHipparcos2 } from './sources3d.ts';
import { useTapCache, type TapRead } from './tap.ts';
import { fetchHipparcos, fetchTycho2, type CatalogRow } from './vizier.ts';

export interface StarsBuild {
  readonly sky: SkyBuild;
  readonly stars3d: Stars3dBuild;
  readonly names: NamesBuild;
}

/** The sky alone, as fetch:data has always read it, now through either service. */
export async function loadSky(): Promise<SkyBuild> {
  const [hipparcos, tycho2] = await Promise.all([fetchHipparcos(), fetchTycho2()]);
  return skyFrom(hipparcos, tycho2);
}

function skyFrom(hipparcos: TapRead<CatalogRow>, tycho2: TapRead<CatalogRow>): SkyBuild {
  return buildSky({
    hipparcos: hipparcos.rows,
    tycho2: tycho2.rows,
    queriedAt: new Date().toISOString(),
    read: {
      hipparcos: { table: hipparcos.table, via: hipparcos.service.url },
      tycho2: { table: tycho2.table, via: tycho2.service.url },
    },
  });
}

/** Log lines for the sky, as fetch:data printed them. */
export function describeSky(catalog: StarCatalog): string[] {
  return [
    ...catalog.sources.map(
      (source) => `[stars] ${source.table.padEnd(14)} ${String(source.stars).padStart(6)} stars`,
    ),
    `[stars] sky ${catalog.count} stars to magnitude ${catalog.magnitudeLimit} via ${catalog.via}` +
      (catalog.dropped.noColorIndex + catalog.dropped.noPosition > 0
        ? ` (${catalog.dropped.noColorIndex} dropped for no B-V, ` +
          `${catalog.dropped.noPosition} for no position)`
        : ''),
  ];
}

/**
 * Reads everything the 3D stars need, given the sky they extend, and builds them.
 * Throws when a required catalogue cannot be read from either service.
 */
export async function loadStars3d(sky: SkyBuild): Promise<{ stars3d: Stars3dBuild; names: NamesBuild }> {
  const started = performance.now();
  // One after another, not together: the census's twelve pages and the bright set's
  // twelve are each a few megabytes of CSV, and reading them in turn holds one at a time.
  // It costs a minute against reading them in parallel and halves the peak memory.
  const gcns = await fetchGcns();
  const hipparcos2 = await fetchHipparcos2();
  const bright = await fetchBrightGaia(skyCounterpartFilter(sky));
  const bsc = await fetchBsc();
  const pulkovo = await fetchPulkovo();
  console.log(
    `[stars] read GCNS ${gcns.table.count} (${gcns.service.name}), ` +
      `Hipparcos-2 ${hipparcos2.rows.length} (${hipparcos2.service.name}), ` +
      `bright Gaia ${bright?.rows.length ?? 'NONE'}${bright !== null ? ` (${bright.service.name})` : ''}, ` +
      `BSC ${bsc?.length ?? 'NONE'}, Pulkovo RVs ${pulkovo?.rows.length ?? 'NONE'} in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );

  const sources: SourceNote[] = [
    {
      name: 'Gaia Catalogue of Nearby Stars (Gaia Collaboration, Smart et al. 2021, A&A 649, A6)',
      table: gcns.tableName,
      via: gcns.service.url,
      rows: gcns.table.count,
      note:
        'Gaia EDR3 astrometry (= DR3) and photometry; the catalogue as published (p >= 0.38, ' +
        '1st-percentile distance within 100 pc).',
    },
    {
      name: 'Gaia DR3 radial velocities (Katz et al. 2023, A&A 674, A5)',
      table: gcns.radialVelocities.table,
      via: gcns.radialVelocities.via,
      rows: gcns.radialVelocities.rows,
      note: 'Joined to the GCNS by source_id. Stars without one have proper motion only.',
    },
    {
      name: 'Hipparcos, the new reduction (van Leeuwen 2007, A&A 474, 653)',
      table: hipparcos2.table,
      via: hipparcos2.service.url,
      rows: hipparcos2.rows.length,
      note: 'Parallaxes only, at S/N >= 5: for the bright stars Gaia saturates.',
    },
  ];
  if (bright !== null) {
    sources.push({
      name: 'Gaia DR3 (Gaia Collaboration, Vallenari et al. 2023, A&A 674, A1), G < 9',
      table: bright.table,
      via: bright.service.url,
      rows: bright.rows.length,
      note:
        "The sky stars' Gaia counterparts, kept where they match a sky star by HIP or by " +
        'position: parallax, RUWE, radial velocity.',
    });
  }

  if (pulkovo !== null) {
    sources.push({
      name: 'Pulkovo Compilation of Radial Velocities (Gontcharov 2006, Astron. Lett. 32, 759)',
      table: 'III/252/table8',
      via: pulkovo.url,
      rows: pulkovo.rows.length,
      note: 'Weighted mean radial velocities of Hipparcos stars, by HIP: only where Gaia DR3 gave none.',
    });
  }

  const stars3d = build3d({
    sky,
    gcns: gcns.table,
    hipparcos2: hipparcos2.rows,
    brightGaia: bright?.rows ?? null,
    literatureRv: pulkovo === null ? null : new Map(pulkovo.rows.map((row) => [row.hip, row.rvKmS])),
    sources,
    queriedAt: new Date().toISOString(),
  });
  const names = buildNames({ build: stars3d, sky, bsc });
  for (const line of describeStars3d(stars3d, names)) {
    console.log(line);
  }
  console.log(`[stars] 3D read and built in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  return { stars3d, names };
}

export function describeStars3d(build: Stars3dBuild, names: NamesBuild): string[] {
  const { info } = build;
  return [
    `[stars] 3D ${info.count} stars: sky ${info.sky.placed} placed, ${info.sky.atInfinity} at infinity; ` +
      `GCNS ${info.counts.gcns}`,
    `[stars] parallaxes: Gaia ${info.counts.gaiaParallax}, Hipparcos ${info.counts.hipparcosParallax}, ` +
      `published ${info.counts.literatureParallax}; radial velocity ${info.counts.radialVelocity} ` +
      `(Pulkovo ${info.counts.literatureRadialVelocity ?? 0}); ` +
      `within 10 pc ${info.counts.withinTenParsecs}`,
    `[stars] sky to Gaia: ${info.crossMatch.byId} by id, ${info.crossMatch.byPosition} by position`,
    `[stars] dropped ${JSON.stringify(info.dropped)}`,
    ...info.tiers.map(
      (tier) =>
        `[stars] ${tier.file} ${String(tier.count).padStart(7)} stars, Mv ` +
        `${tier.brightestMv ?? '-inf'} .. ${tier.faintestMv ?? 'inf'}, ${(tier.bytes / 1e6).toFixed(2)} MB`,
    ),
    `[stars] names ${names.names.count} (IAU unmatched ${names.wgsnUnmatched}, by position ` +
      `${names.wgsnMatchedByPosition}; Bayer/Flamsteed ${names.bscDesignations}` +
      (names.nearbyUnmatched.length > 0 ? `; NEARBY NOT FOUND: ${names.nearbyUnmatched.join(', ')}` : '') +
      ')',
  ];
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' }, cache: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  useTapCache(values.cache === undefined ? null : resolve(values.cache));
  const started = performance.now();

  const sky = await loadSky();
  for (const line of describeSky(sky.catalog)) {
    console.log(line);
  }
  const { stars3d, names } = await loadStars3d(sky);

  await mkdir(outputDir, { recursive: true });
  await writeStars(sky.catalog, outputDir);
  await writeStars3d(stars3d, names.names, outputDir);
  console.log(
    `[stars] wrote ${resolve(outputDir, 'stars.json')} and ${resolve(outputDir, STARS3D_DIR)} ` +
      `in ${((performance.now() - started) / 1000).toFixed(1)} s; peak RSS ` +
      `${(process.resourceUsage().maxRSS / 1024).toFixed(0)} MB`,
  );
  console.log(
    '[stars] Star data: ESA Hipparcos and Tycho-2; ESA/Gaia/DPAC (Gaia DR3, GCNS); ' +
      'IAU WGSN star names; Yale Bright Star Catalogue; via CDS VizieR and the ESA Gaia Archive.',
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
