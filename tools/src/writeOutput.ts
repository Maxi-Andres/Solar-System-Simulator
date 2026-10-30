import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  BELT_NAMES_FILE,
  COMETS_INFO_FILE,
  EXOPLANETS_FILE,
  OUTPUT_DIR,
  POSITION_DECIMALS,
  PULSARS_FILE,
  SATELLITES_DIR,
  SATELLITES_INFO_FILE,
  STARS3D_DIR,
  STARS3D_INFO_FILE,
  STARS3D_NAMES_FILE,
  TIME_DECIMALS,
  VELOCITY_DECIMALS,
} from './config.ts';
import { beltBytes, type BeltBuild } from './belt/buildBelt.ts';
import type { CometBuild } from './belt/comets.ts';
import type { SatelliteBuild } from './satellites/buildSatellites.ts';
import {
  namesEntry,
  tierDetailsBytes,
  tierRecordBytes,
  type Stars3dBuild,
} from './stars/build3d.ts';
import type {
  ExoplanetCatalog,
  BeltInfo,
  BodyDefinition,
  ChunkInfo,
  Manifest,
  OsculatingElements,
  PathTable,
  PulsarCatalog,
  Seam,
  SmallMoonBundle,
  StarCatalog,
  Stars3dInfo,
  Stars3dNames,
  SurfaceTrack,
  VectorTable,
} from './types.ts';

/**
 * Rounds to a fixed number of decimals.
 *
 * Horizons returns 16 significant digits, far past the precision that matters at
 * kilometre scale. Trimming to millimetres cuts the JSON size by roughly a third
 * with no visible effect.
 */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundAll(values: readonly number[], decimals: number): number[] {
  return values.map((value) => round(value, decimals));
}

/** Pretty JSON for small files a human might open. */
async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Compact JSON for the vector tables, which are thousands of numbers each. */
async function writeCompactJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8');
}

/**
 * Clears and recreates the output tree.
 *
 * A full wipe means a body removed from the catalog cannot leave a stale file behind
 * that the manifest no longer lists.
 */
export async function prepareOutputDir(): Promise<void> {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(join(OUTPUT_DIR, 'vectors'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'elements'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'paths'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'surface'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'small-moons'), { recursive: true });
}

function serializeTable(table: VectorTable): VectorTable {
  return {
    id: table.id,
    horizonsId: table.horizonsId,
    center: table.center,
    count: table.count,
    t: roundAll(table.t, TIME_DECIMALS),
    x: roundAll(table.x, POSITION_DECIMALS),
    y: roundAll(table.y, POSITION_DECIMALS),
    z: roundAll(table.z, POSITION_DECIMALS),
    vx: roundAll(table.vx, VELOCITY_DECIMALS),
    vy: roundAll(table.vy, VELOCITY_DECIMALS),
    vz: roundAll(table.vz, VELOCITY_DECIMALS),
  };
}

/** A table shipped whole, as vectors/<id>.json. */
export async function writeVectors(table: VectorTable): Promise<void> {
  await writeCompactJson(join(OUTPUT_DIR, 'vectors', `${table.id}.json`), serializeTable(table));
}

/**
 * One piece of a chunked table, as vectors/<id>/<index>.json.
 *
 * Same columns and rounding as a whole table, so the app reads either with the same
 * interpolator; the manifest says which bodies are split and where.
 *
 * Returns the span the file actually covers, taken from the rounded times it was
 * written with. The app picks a chunk by that span and then searches the file's own
 * `t`, so the two must agree to the last digit or an instant on a boundary would fall
 * between them.
 */
export async function writeVectorChunk(table: VectorTable, index: number): Promise<ChunkInfo> {
  const directory = join(OUTPUT_DIR, 'vectors', table.id);
  await mkdir(directory, { recursive: true });
  const serialized = serializeTable(table);
  await writeCompactJson(join(directory, `${index}.json`), serialized);

  const startJd = serialized.t[0];
  const stopJd = serialized.t.at(-1);
  if (startJd === undefined || stopJd === undefined) {
    throw new Error(`${table.id} chunk ${index} is empty.`);
  }
  return { startJd, stopJd, count: serialized.count };
}

/**
 * A spacecraft's trajectory, as paths/<id>.json.
 *
 * Rounded exactly as the full table is, so every sample in it is, to the last digit, the
 * sample of the same instant in the craft's vector files.
 */
export async function writePath(path: PathTable): Promise<void> {
  await writeCompactJson(join(OUTPUT_DIR, 'paths', `${path.id}.json`), {
    ...serializeTable(path),
    // A metre is far inside every tolerance here; the floor alone is a kilometre.
    toleranceKm: roundAll(path.toleranceKm, 3),
    gaps: path.gaps,
  });
}

/**
 * A surface craft's stops, as surface/<id>.json. Coordinates to 1e-8 degree, a
 * fifth of a millimetre on Mars; headings to a hundredth of a degree.
 */
export async function writeSurface(track: SurfaceTrack): Promise<void> {
  await writeCompactJson(join(OUTPUT_DIR, 'surface', `${track.id}.json`), {
    ...track,
    t: roundAll(track.t, TIME_DECIMALS),
    latitudeDeg: roundAll(track.latitudeDeg, 8),
    longitudeDeg: roundAll(track.longitudeDeg, 8),
    headingDeg: track.headingDeg.map((heading) =>
      heading === null ? null : Math.round(heading * 100) / 100,
    ),
  });
}

/**
 * A seam as the manifest carries it: its instants rounded as the tables' are, so that
 * they match the samples on either side of it to the last digit.
 */
export function serializeSeam(seam: Seam): Seam {
  return {
    startJd: round(seam.startJd, TIME_DECIMALS),
    stopJd: round(seam.stopJd, TIME_DECIMALS),
    jumpKm: round(seam.jumpKm, POSITION_DECIMALS),
  };
}

export async function writeElements(elements: OsculatingElements): Promise<void> {
  await writeJson(join(OUTPUT_DIR, 'elements', `${elements.id}.json`), elements);
}

/**
 * One planet's small moons, as small-moons/<planet>.json. See SmallMoonBundle: the app
 * fetches it only once that planet's system is entered.
 */
export async function writeSmallMoonBundle(planet: string, bundle: SmallMoonBundle): Promise<void> {
  await writeCompactJson(join(OUTPUT_DIR, 'small-moons', `${planet}.json`), bundle);
}

/**
 * The star catalogue: 25,000 rows of six columns, so compact JSON like the vectors.
 *
 * Already rounded by `buildStarCatalog`, which does it against a pixel rather than
 * against a byte count -- so there is nothing left to trim here.
 */
export async function writeStars(stars: StarCatalog, outputDir = OUTPUT_DIR): Promise<void> {
  await writeCompactJson(join(outputDir, 'stars.json'), stars);
}

/**
 * The stars in 3D, as stars3d/: the tier files of records and of details, the search
 * index names.json, and stars3d.json describing them. See Stars3dInfo.
 *
 * Like the belt it takes the directory, because `pnpm fetch:stars` regenerates it on its
 * own, and it replaces stars3d/ and nothing else. stars3d.json goes last, after every file
 * it names, so an interrupted write leaves no stars3d.json -- which the app reads as no 3D
 * stars -- never a description of files that are not all there. Write stars.json first:
 * the records name its rows.
 */
export async function writeStars3d(
  build: Stars3dBuild,
  names: Stars3dNames,
  outputDir = OUTPUT_DIR,
): Promise<void> {
  const directory = join(outputDir, STARS3D_DIR);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const { info, table, order, tierStarts } = build;
  for (const [tier, entry] of info.tiers.entries()) {
    const start = tierStarts[tier] ?? 0;
    const indices = order.subarray(start, start + entry.count);
    await writeFile(join(directory, entry.file), tierRecordBytes(table, indices));
    await writeFile(join(directory, entry.details), tierDetailsBytes(table, indices));
  }
  const namesJson = `${JSON.stringify(names)}\n`;
  await writeFile(join(directory, STARS3D_NAMES_FILE), namesJson, 'utf8');
  const full: Stars3dInfo = { ...info, names: namesEntry(names, namesJson) };
  await writeJson(join(directory, STARS3D_INFO_FILE), full);
}

/**
 * The asteroid belt and the comets, as belt/: belt.json and its tiers' binary files of
 * elements, the search index names.json, and comets.json with comets.bin. See BeltInfo
 * and CometInfo.
 *
 * Takes the directory, unlike the writers above, because the belt can be regenerated on
 * its own (`pnpm fetch:belt`) into a data directory a full run already filled. So it
 * replaces belt/ and nothing else: the other files there are a different run's, and
 * still valid. belt.json is written last, after every file it points to, so an
 * interrupted write leaves no belt.json at all -- which the app reads as no belt --
 * never a description of a file that is not there, or not all there.
 */
export async function writeBelt(
  build: BeltBuild,
  comets: CometBuild,
  outputDir = OUTPUT_DIR,
): Promise<void> {
  const directory = join(outputDir, 'belt');
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  // One tier at a time, so only one tier's bytes are ever copied out at once.
  for (const { tier, records } of build.tiers) {
    await writeFile(join(directory, tier.file), beltBytes(records));
  }
  await writeFile(join(directory, BELT_NAMES_FILE), build.namesJson, 'utf8');
  await writeFile(join(directory, comets.info.file), beltBytes(comets.records));
  await writeJson(join(directory, COMETS_INFO_FILE), comets.info);
  const info: BeltInfo = {
    ...build.info,
    comets: { file: COMETS_INFO_FILE, count: comets.info.count },
  };
  await writeJson(join(directory, 'belt.json'), info);
}

/**
 * The Earth satellites, as satellites/: see SatelliteInfo. Like the belt it takes the
 * directory, because `pnpm fetch:satellites` regenerates it on its own, and it replaces
 * satellites/ and nothing else. satellites.json goes last, after every file it names, so an
 * interrupted write leaves no satellites.json -- which the app reads as no satellites.
 */
export async function writeSatellites(build: SatelliteBuild, outputDir = OUTPUT_DIR): Promise<void> {
  const directory = join(outputDir, SATELLITES_DIR);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const { info } = build;
  await writeFile(join(directory, info.bulk.file), beltBytes(build.bulk));
  await writeCompactJson(join(directory, info.names.file), build.names);
  await writeCompactJson(join(directory, info.sgp4.file), build.sgp4);
  await writeJson(join(directory, info.named.file), build.named);
  await writeJson(join(directory, SATELLITES_INFO_FILE), info);
}

export async function writeCatalog(bodies: readonly BodyDefinition[]): Promise<void> {
  await writeJson(join(OUTPUT_DIR, 'bodies.json'), bodies);
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await writeJson(join(OUTPUT_DIR, 'manifest.json'), manifest);
}

/**
 * The Exoplanet Archive's planets and their hosts, as exoplanets.json (ExoplanetCatalog).
 * One compact file, 1.9 MB (0.5 MB gzipped) on 2026-10-29: the app fetches it only once the
 * camera leaves the planets with the Exoplanet Hosts layer on, or search opens. Takes the directory, because `pnpm fetch:exoplanets`
 * regenerates it alone.
 */
export async function writeExoplanets(catalog: ExoplanetCatalog, outputDir = OUTPUT_DIR): Promise<void> {
  await writeCompactJson(join(outputDir, EXOPLANETS_FILE), catalog);
}

/**
 * The pulsars and magnetars, as pulsars.json (PulsarCatalog): one compact file, fetched by
 * the app once the camera is out among the stars with the Pulsars layer on, or search
 * opens. Takes the directory, because `pnpm fetch:pulsars` regenerates it alone.
 */
export async function writePulsars(catalog: PulsarCatalog, outputDir = OUTPUT_DIR): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeCompactJson(join(outputDir, PULSARS_FILE), catalog);
}
