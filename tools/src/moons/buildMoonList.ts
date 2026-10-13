/**
 * Builds `smallMoons.ts`: every natural satellite JPL publishes beyond the catalog's
 * major ones, with what is known of each.
 *
 * Run by hand (`pnpm moons:list`) when JPL announces new moons; the output is committed,
 * so a data run never depends on scraping a web page. Three sources, all JPL's Solar
 * System Dynamics group:
 *
 *   https://ssd.jpl.nasa.gov/sats/elem/      mean orbital elements of every satellite
 *   https://ssd.jpl.nasa.gov/sats/phys_par/  GM and mean radius, where measured
 *   Horizons object summaries                radius where only an estimate is given
 *
 * A moon with no radius in any of them gets none: it is drawn as a marker, and nothing
 * claims a size for it.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { CATALOG } from '../catalog.ts';
import { callHorizons } from '../horizons/client.ts';
import type { SmallMoonRecord } from './smallMoonRecord.ts';

const ELEMENTS_URL = 'https://ssd.jpl.nasa.gov/sats/elem/';
const PHYSICAL_URL = 'https://ssd.jpl.nasa.gov/sats/phys_par/';
const OUTPUT = join(import.meta.dirname, 'smallMoons.ts');

/** The planets whose moons are listed, by the name JPL's tables use. */
const PLANETS: Record<string, string> = {
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
  Pluto: 'pluto',
};

/** The text of each cell of each table row in an HTML page. */
function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((row) =>
    [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      cell[1]!.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
    ),
  );
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`${url} answered HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * A radius from a Horizons object summary: "Radius (km) = 77 +- 3", "= ~60", or
 * "Radii (IAU2015): 0.7 x 0.25 x 0.2 km", whose mean is taken as the cube root of the
 * product -- the radius of the sphere of the same volume.
 */
export function radiusFromSummary(summary: string): number | null {
  const triaxial =
    /Radii[^:]*:\s*([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*km/i.exec(summary) ??
    /Radius \(km\)\s*=\s*([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/i.exec(summary);
  if (triaxial !== null) {
    const [a, b, c] = triaxial.slice(1, 4).map(Number) as [number, number, number];
    return Math.cbrt(a * b * c);
  }
  const single = /Radius[^=\n]*=\s*~?\s*([\d.]+)/i.exec(summary);
  if (single !== null) {
    const value = Number(single[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return null;
}

/** The ids in Horizons' list of major bodies (`COMMAND='MB'`): one row each, id first. */
export function majorBodyIds(listing: string): Set<string> {
  const ids = new Set<string>();
  for (const line of listing.split(/\r?\n/)) {
    const match = /^\s+(-?\d+)\s{2}/.exec(line);
    if (match !== null) {
      ids.add(match[1]!);
    }
  }
  return ids;
}

async function main(): Promise<void> {
  const [elementsHtml, physicalHtml] = await Promise.all([
    fetchText(ELEMENTS_URL),
    fetchText(PHYSICAL_URL),
  ]);

  // Physical parameters: planet, satellite, code, then one "value sigma ref" cell each
  // for GM, mean radius and density.
  const physical = new Map<string, { gm: number | null; radius: number | null }>();
  for (const cells of tableRows(physicalHtml)) {
    if (cells.length < 5 || !/^\d+$/.test(cells[2] ?? '')) continue;
    const gm = Number.parseFloat(cells[3]!);
    const radius = Number.parseFloat(cells[4]!);
    physical.set(cells[2]!, {
      gm: Number.isFinite(gm) ? gm : null,
      radius: Number.isFinite(radius) ? radius : null,
    });
  }

  // Elements: index, planet, name, code, ephemeris, frame, epoch, a, e, w, M, i, node, P.
  // Some moons are listed twice, under two element sets; the first is kept.
  // The catalog's own moons, not the small ones this script wrote last time.
  const known = new Set(
    CATALOG.filter((body) => body.sampling === undefined).map((body) => body.horizonsId),
  );
  // And only those Horizons itself lists as major bodies. A moon announced since may be
  // in the elements table before it is in Horizons, and then its number is read as an
  // asteroid's: S/2025 U 1's code, 75052, is also (75052) 1999 UM50, and was fetched as
  // that -- a billion kilometres from Uranus.
  const majorBodies = majorBodyIds(
    (await callHorizons({ COMMAND: 'MB' }, 'major bodies')).result,
  );
  const candidates = tableRows(elementsHtml).filter((cells) => {
    if (cells.length < 14 || !(cells[1]! in PLANETS) || known.has(cells[3]!)) {
      return false;
    }
    known.add(cells[3]!);
    if (!majorBodies.has(cells[3]!)) {
      console.log(`[moons] ${cells[2]} (${cells[3]}) is not in Horizons yet; left out`);
      return false;
    }
    return true;
  });

  const moons: SmallMoonRecord[] = [];
  for (const cells of candidates) {
    const horizonsId = cells[3]!;
    const measured = physical.get(horizonsId);
    let radiusKm = measured?.radius ?? null;
    let radiusSource: SmallMoonRecord['radiusSource'] = radiusKm === null ? null : 'phys_par';
    if (radiusKm === null) {
      const response = await callHorizons(
        // The client quotes every value itself.
        { COMMAND: horizonsId, OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' },
        `${cells[2]} summary`,
      );
      radiusKm = radiusFromSummary(response.result);
      radiusSource = radiusKm === null ? null : 'horizons';
    }
    moons.push({
      horizonsId,
      name: cells[2]!,
      parent: PLANETS[cells[1]!]!,
      semiMajorAxisKm: Number(cells[7]),
      eccentricity: Number(cells[8]),
      inclinationDeg: Number(cells[11]),
      periodDays: Number(cells[13]),
      ephemeris: cells[4]!,
      // A thousandth of a kilometre is far below anything JPL's radii claim.
      radiusKm: radiusKm === null ? null : Math.round(radiusKm * 1000) / 1000,
      radiusSource,
      gmKm3S2: measured?.gm ?? null,
    });
    console.log(
      `[moons] ${cells[1]!.padEnd(8)} ${cells[2]!.padEnd(14)} ${horizonsId.padStart(6)} ` +
        `${radiusKm === null ? 'no radius' : `${radiusKm.toFixed(2)} km (${radiusSource})`}`,
    );
  }

  moons.sort((a, b) => a.parent.localeCompare(b.parent) || a.semiMajorAxisKm - b.semiMajorAxisKm);
  const header =
    '// Generated by buildMoonList.ts (`pnpm moons:list`) from JPL Solar System Dynamics\n' +
    `// tables, ${new Date().toISOString().slice(0, 10)}. Do not edit by hand; rerun the script.\n` +
    "import type { SmallMoonRecord } from './smallMoonRecord.ts';\n\n" +
    'export const SMALL_MOON_RECORDS: readonly SmallMoonRecord[] = ';
  await writeFile(OUTPUT, `${header}${JSON.stringify(moons, null, 2)};\n`, 'utf8');
  console.log(`[moons] Wrote ${moons.length} moons to ${OUTPUT}`);
}

// Run when invoked, not when a test imports radiusFromSummary.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
