/**
 * Regenerates the cosmic web alone: `pnpm fetch:cosmic-web`.
 *
 *   pnpm fetch:cosmic-web                    # into web/public/data/cosmic-web/
 *   pnpm fetch:cosmic-web --out <directory>  # into <directory>/cosmic-web/
 *   pnpm fetch:cosmic-web --cache <dir>      # keep the downloads in <dir> and read them from there next time
 *
 * Three VizieR tables (Tempel et al. 2014's filaments, their points and their galaxies; 100 MB
 * of text from the CfA's mirror), Malavasi et al.'s BOSS skeleton from the IAS (7.5 MB), and
 * BOSS DR12's galaxies from the SDSS Science Archive Server (300 MB gzipped): about 400 MB, two
 * to five minutes. It reads laniakea/ and local-volume.json from the same output directory --
 * the galaxies they draw are left out here -- so `pnpm fetch:laniakea` (or fetch:data) must
 * have run first. Writes cosmic-web/ and touches nothing else.
 *
 * Not part of `pnpm fetch:data`: every host here is one more that can turn GitHub's runners
 * away, and 400 MB more a deploy. See the module's report for when to hook it in.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';

import {
  BOSS_DR12_GALAXY_URLS,
  DATA_USER_AGENT,
  LANIAKEA_DIR,
  LANIAKEA_INFO_FILE,
  LOCAL_VOLUME_FILE,
  MALAVASI_2020_PAGE,
  MALAVASI_2020_SKELETON_URL,
  OUTPUT_DIR,
  TEMPEL_2014_FILAMENT_TABLE,
  TEMPEL_2014_GALAXY_TABLE,
  TEMPEL_2014_POINT_TABLE,
  VIZIER_ASU_MIRRORS,
} from '../config.ts';
import { czCmb, C_KM_S, unitVector } from '../laniakea/frames.ts';
import { download } from '../pulsars/fetchPulsars.ts';
import type { CosmicWebInfo, LaniakeaInfo, LocalVolumeCatalog } from '../types.ts';
import { writeCosmicWeb } from '../writeOutput.ts';
import {
  asuColumnsUrl,
  parseAsuColumns,
  parseNdskl,
  readFitsColumns,
  readTempelPoints,
  TEMPEL_FILAMENT_COLUMNS,
  TEMPEL_GALAXY_COLUMNS,
  TEMPEL_POINT_COLUMNS,
} from './catalogues.ts';
import {
  assembleCosmicWeb,
  bossCandidates,
  buildGalaxies,
  checkMalavasiFrame,
  checkTempelFrame,
  describeCosmicWeb,
  malavasiFilaments,
  MALAVASI_CHECK_LEAST,
  readG3,
  tempelFilaments,
  type BossGalaxies,
  type CosmicWebOutput,
  type LocalVolumeGalaxies,
} from './cosmicWeb.ts';
import { MALAVASI_LOWZ_CMASS_CENTRE } from './distances.ts';

const LOG = '[cosmic-web]';

let cacheDirectory: string | null = null;

/** A download, from `--cache` if it holds it (keyed by the URL), else from the host, kept there if asked. */
async function fetchBytes(url: string, label: string): Promise<Uint8Array> {
  if (cacheDirectory === null) {
    return download(url, label, { 'User-Agent': DATA_USER_AGENT });
  }
  const path = join(cacheDirectory, `${createHash('sha256').update(url).digest('hex').slice(0, 24)}.bin`);
  try {
    return new Uint8Array(await readFile(path));
  } catch {
    const bytes = await download(url, label, { 'User-Agent': DATA_USER_AGENT });
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path, bytes);
    return bytes;
  }
}

/** Times round the mirrors before giving up, and the wait between rounds (as localVolume/asu.ts). */
const MIRROR_ROUNDS = 3;
const ROUND_WAIT_MS = 30_000;

/** A VizieR table's `columns`, from the first mirror that answers with at least `minimumRows`. */
async function readVizierColumns(table: string, label: string, columns: readonly string[], minimumRows: number) {
  const failures: string[] = [];
  for (let round = 1; round <= MIRROR_ROUNDS; round += 1) {
    for (const mirror of VIZIER_ASU_MIRRORS) {
      const url = asuColumnsUrl(mirror, table, columns);
      try {
        const parsed = parseAsuColumns(new TextDecoder('latin1').decode(await fetchBytes(url, label)), columns);
        if (parsed.rows < minimumRows) {
          throw new Error(`only ${parsed.rows} rows, where the table has at least ${minimumRows}`);
        }
        return { ...parsed, url };
      } catch (error) {
        failures.push(`${mirror} (round ${round}): ${String(error).slice(0, 300)}`);
        console.warn(`${LOG} ${label}: ${mirror} failed (${String(error).slice(0, 200)}); trying the next mirror.`);
      }
    }
    if (round < MIRROR_ROUNDS) await new Promise((done) => setTimeout(done, ROUND_WAIT_MS));
  }
  throw new Error(`Could not read ${label} (${table}) from any VizieR mirror:\n  ${failures.join('\n  ')}`);
}

async function readBoss(cap: 'north' | 'south'): Promise<BossGalaxies> {
  const gz = await fetchBytes(BOSS_DR12_GALAXY_URLS[cap], `BOSS DR12 ${cap}`);
  const { rows, columns } = readFitsColumns(gunzipSync(gz), ['RA', 'DEC', 'Z', 'IMATCH', 'MODELFLUX', 'EXTINCTION']);
  const minimum = cap === 'north' ? 900_000 : 350_000;
  if (rows < minimum) throw new Error(`BOSS DR12 ${cap} has ${rows} galaxies, where it has at least ${minimum}.`);
  return {
    cap,
    count: rows,
    ra: columns.RA!.values,
    dec: columns.DEC!.values,
    z: columns.Z!.values,
    imatch: columns.IMATCH!.values,
    modelFlux: columns.MODELFLUX!.values,
    extinction: columns.EXTINCTION!.values,
  };
}

/** G3's galaxies and local-volume.json's, from `outputDir`: what is already drawn. */
async function readDrawn(outputDir: string) {
  const directory = join(outputDir, LANIAKEA_DIR);
  let info: LaniakeaInfo;
  try {
    info = JSON.parse(await readFile(join(directory, LANIAKEA_INFO_FILE), 'utf8')) as LaniakeaInfo;
  } catch (error) {
    throw new Error(`The cosmic web leaves out the galaxies Laniakea draws, and ${join(directory, LANIAKEA_INFO_FILE)} cannot be read (${String(error).slice(0, 200)}): run pnpm fetch:laniakea first.`);
  }
  const [records, details, lvText] = await Promise.all([
    readFile(join(directory, info.galaxies.file)),
    readFile(join(directory, info.galaxies.details.file)),
    readFile(join(outputDir, LOCAL_VOLUME_FILE), 'utf8'),
  ]);
  const g3 = readG3(info.galaxies.count, new Uint8Array(records), new Uint8Array(details), info.galaxies.recordFloats);
  const lv = JSON.parse(lvText) as LocalVolumeCatalog;
  const localVolume: LocalVolumeGalaxies = {
    directions: lv.raDeg.map((ra, i) => unitVector(ra, lv.decDeg[i]!)),
    zCmb: lv.raDeg.map((ra, i) => {
      const v = lv.radialVelocityKmS[i];
      return v === null || v === undefined ? Number.NaN : czCmb(ra, lv.decDeg[i]!, v) / C_KM_S;
    }),
  };
  return { g3, localVolume, laniakeaGeneratedAt: (info as { generatedAt?: string }).generatedAt ?? 'unknown' };
}

const VIZIER_TERMS =
  "No licence is stated for the catalogue; VizieR's rules of usage: free access for scientific use, copyright as the data's origin (the journal) holds it; cite the catalogue's paper and acknowledge VizieR (doi 10.26093/cds/vizier).";
const SDSS3_ACKNOWLEDGEMENT =
  'Funding for SDSS-III has been provided by the Alfred P. Sloan Foundation, the Participating Institutions, the National Science Foundation, and the U.S. Department of Energy Office of Science (the full SDSS-III acknowledgement: https://www.sdss3.org/collaboration/boiler-plate.php).';

/** The catalogues, read, checked and built into cosmic-web/'s contents. */
export async function loadCosmicWeb(outputDir = OUTPUT_DIR): Promise<CosmicWebOutput> {
  const queriedAt = new Date().toISOString();
  const [filamentTable, pointTable, galaxyTable, skeletonBytes, north, south, drawn] = await Promise.all([
    readVizierColumns(TEMPEL_2014_FILAMENT_TABLE, "Tempel et al.'s filaments", TEMPEL_FILAMENT_COLUMNS, 15_000),
    readVizierColumns(TEMPEL_2014_POINT_TABLE, "Tempel et al.'s filament points", TEMPEL_POINT_COLUMNS, 275_000),
    readVizierColumns(TEMPEL_2014_GALAXY_TABLE, "Tempel et al.'s galaxies", TEMPEL_GALAXY_COLUMNS, 576_000),
    fetchBytes(MALAVASI_2020_SKELETON_URL, "Malavasi et al.'s BOSS skeleton"),
    readBoss('north'),
    readBoss('south'),
    readDrawn(outputDir),
  ]);
  const points = readTempelPoints(pointTable.values, pointTable.rows);
  const tempel = { count: galaxyTable.rows, values: galaxyTable.values };
  const skeleton = parseNdskl(new TextDecoder('latin1').decode(skeletonBytes));
  console.log(`${LOG} read ${filamentTable.rows} Tempel filaments (${points.count} points), ${tempel.count} SDSS galaxies, ${skeleton.filaments.count} skeleton filaments, ${north.count} + ${south.count} BOSS galaxies; ${drawn.g3.count} G3 galaxies to leave out.`);

  const tempelCheck = checkTempelFrame(tempel, points);
  console.log(`${LOG} Tempel's frame: ${tempelCheck.checked} galaxies by a filament's axis lie a median ${tempelCheck.median.toFixed(3)} h^-1 Mpc from its nearest point.`);

  const galaxies = buildGalaxies({ tempel, boss: [north, south], g3: drawn.g3, localVolume: drawn.localVolume });

  // The skeleton's check: on BOSS North's galaxies as placed.
  const northCandidates = bossCandidates(north).candidates;
  const northPlaced = new Float32Array(northCandidates.length * 3);
  northCandidates.forEach((c, i) => northPlaced.set(c.position, i * 3));
  const malavasiCheck = checkMalavasiFrame(skeleton, MALAVASI_LOWZ_CMASS_CENTRE, northPlaced);
  console.log(`${LOG} Malavasi's frame: ${(100 * malavasiCheck.share).toFixed(1)}% of the skeleton among BOSS North's galaxies, ${(100 * malavasiCheck.mirrored).toFixed(1)}% mirrored.`);

  const galaxiesByFilament = new Map<number, number>();
  for (let i = 0; i < filamentTable.rows; i += 1) galaxiesByFilament.set(filamentTable.values.ID![i]!, filamentTable.values['Ng.5']![i]!);
  const tempelBuilt = tempelFilaments(points, galaxiesByFilament);
  const malavasiBuilt = malavasiFilaments(skeleton, MALAVASI_LOWZ_CMASS_CENTRE, galaxies.footprints.bossNorth);

  const tempelCitation =
    'Tempel E., Stoica R. S., Martinez V. J., Liivamagi L. J., Castellan G., Saar E. 2014, MNRAS 438, 3465 (Detecting filamentary pattern in the cosmic web: a catalogue of filaments for the SDSS); VizieR J/MNRAS/438/3465, doi 10.26093/cds/vizier.74383465';
  const tempelCredit = `Tempel et al. 2014, MNRAS 438, 3465, via VizieR (CDS, Strasbourg). Built on SDSS DR8: ${SDSS3_ACKNOWLEDGEMENT}`;
  const bossCitation =
    'Reid B. et al. 2016, MNRAS 455, 1553 (SDSS-III BOSS DR12 galaxy and random catalogues for large-scale structure); Alam S. et al. 2015, ApJS 219, 12 (SDSS DR12); Dawson K. S. et al. 2013, AJ 145, 10 (BOSS); Eisenstein D. J. et al. 2011, AJ 142, 72 (SDSS-III)';
  const bossTerms = 'No licence is stated: public SDSS data; SDSS asks that the data release papers be cited and the SDSS-III acknowledgement included (https://www.sdss4.org/collaboration/citing-sdss/).';
  const sources: CosmicWebInfo['sources'] = {
    tempel2014Filaments: { citation: `${tempelCitation}, table1`, url: filamentTable.url, queriedAt, rows: filamentTable.rows, licence: VIZIER_TERMS, credit: tempelCredit },
    tempel2014Points: { citation: `${tempelCitation}, table2`, url: pointTable.url, queriedAt, rows: pointTable.rows, licence: VIZIER_TERMS, credit: tempelCredit },
    tempel2014Galaxies: {
      citation: `${tempelCitation}, table3 (the galaxies of Tempel E. et al. 2012, A&A 540, A106)`,
      url: galaxyTable.url,
      queriedAt,
      rows: galaxyTable.rows,
      licence: VIZIER_TERMS,
      credit: tempelCredit,
    },
    malavasi2020: {
      citation:
        'Malavasi N., Aghanim N., Douspis M., Tanimura H., Bonjean V. 2020, A&A 642, A19 (Characterising filaments in the SDSS volume from the galaxy distribution): BOSS DR12 LOWZ+CMASS north, persistence 5 sigma, skeleton smoothed once',
      url: MALAVASI_2020_SKELETON_URL,
      queriedAt,
      rows: skeleton.filaments.count,
      licence: `No licence is stated on the L3S/COSFIL page (${MALAVASI_2020_PAGE}); it asks that Malavasi et al. 2020 be cited and the service acknowledged.`,
      credit: `Malavasi et al. 2020, A&A 642, A19. "This work makes use of the service L3S/COSFIL." Built on SDSS-III BOSS DR12: ${SDSS3_ACKNOWLEDGEMENT}`,
    },
    bossNorth: { citation: `${bossCitation}: galaxy_DR12v5_CMASSLOWZTOT_North`, url: BOSS_DR12_GALAXY_URLS.north, queriedAt, rows: north.count, licence: bossTerms, credit: `SDSS-III BOSS DR12. ${SDSS3_ACKNOWLEDGEMENT}` },
    bossSouth: { citation: `${bossCitation}: galaxy_DR12v5_CMASSLOWZTOT_South`, url: BOSS_DR12_GALAXY_URLS.south, queriedAt, rows: south.count, licence: bossTerms, credit: `SDSS-III BOSS DR12. ${SDSS3_ACKNOWLEDGEMENT}` },
  };
  const checks: CosmicWebInfo['checks'] = {
    tempelFrame: {
      passed: true,
      value: Number(tempelCheck.median.toFixed(3)),
      note: `Median distance, h^-1 Mpc, of ${tempelCheck.checked} galaxies within 0.3 of a filament's axis (put in Tempel's frame by RA, Dec and distance) from the filament point table3 names as nearest; under 0.35 required (points 0.5 apart).`,
    },
    malavasiFrame: {
      passed: true,
      value: Number(malavasiCheck.ratio.toFixed(2)),
      note: `The skeleton's points as placed fall in a 10 Mpc cell holding a BOSS North galaxy ${(100 * malavasiCheck.share).toFixed(1)}% of the time, mirrored in RA ${(100 * malavasiCheck.mirrored).toFixed(1)}%: the ratio, at least ${MALAVASI_CHECK_LEAST} required.`,
    },
  };
  return assembleCosmicWeb({ galaxies, tempel: tempelBuilt, malavasi: malavasiBuilt, sources, checks });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' }, cache: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  cacheDirectory = values.cache === undefined ? null : resolve(values.cache);
  const output = await loadCosmicWeb(outputDir);
  for (const line of describeCosmicWeb(output)) {
    console.log(line);
  }
  await writeCosmicWeb(output, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
