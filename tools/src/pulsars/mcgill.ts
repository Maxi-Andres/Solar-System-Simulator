import { parseSexagesimalDegrees, parseSexagesimalHours } from '../stars/buildStarCatalog.ts';
import { optionalNumber, parseCsvTable } from '../stars/tap.ts';

/**
 * The McGill Online Magnetar Catalog (Olausen & Kaspi 2014, ApJS 212, 6), its Table 1 as the
 * McGill Pulsar Group keeps it (config.ts MCGILL_MAGNETARS_URL): each magnetar's spin, its
 * distance with the paper it is from, and its X-ray position.
 *
 * - **Name:** as listed, its marks taken off: "#" a candidate, "##" PSR J1846-0258, a
 *   rotation-powered pulsar that has behaved as a magnetar.
 * - **Position:** "RA" and "Decl", sexagesimal, J2000; no epoch or proper motion is listed,
 *   so a magnetar only McGill lists stands still. Those the ATNF catalogue also lists move
 *   by its proper motion where it has one (buildPulsars.ts); the rest that have one measured
 *   move milliarcseconds a year, a few arcseconds over the clock's centuries.
 * - **Distance:** "Dist", kpc, with "~" in "Dist_lim" where the catalogue calls it
 *   approximate. Six have none (2026-10-30), four of them candidates.
 * - **Spin:** "Period", s; "Pdot", s/s, unless "Pdot_lim" makes it a limit.
 */

export interface McgillMagnetar {
  readonly name: string;
  readonly candidate: boolean;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distanceKpc: number | null;
  readonly distanceApproximate: boolean;
  readonly periodS: number | null;
  readonly periodDerivative: number | null;
}

const LABEL = 'McGill magnetar catalogue';

export function parseMcgillCsv(csv: string): McgillMagnetar[] {
  const table = parseCsvTable(csv, ['Name', 'Period', 'Pdot_lim', 'Pdot', 'Dist_lim', 'Dist', 'RA', 'Decl']);
  const magnetars: McgillMagnetar[] = [];
  for (const row of table.rows) {
    const listed = table.at(row, 'Name') ?? '';
    const ra = table.at(row, 'RA') ?? '';
    const dec = table.at(row, 'Decl') ?? '';
    if (listed === '' || ra === '' || dec === '') {
      continue;
    }
    const marks = /\s*(#+)\s*$/.exec(listed)?.[1] ?? '';
    const pdotLimit = (table.at(row, 'Pdot_lim') ?? '') !== '';
    magnetars.push({
      name: listed.replace(/\s*#+\s*$/, ''),
      candidate: marks === '#',
      raDeg: parseSexagesimalHours(ra),
      decDeg: parseSexagesimalDegrees(dec),
      distanceKpc: optionalNumber(table.at(row, 'Dist'), 'Dist', LABEL),
      distanceApproximate: (table.at(row, 'Dist_lim') ?? '') === '~',
      periodS: optionalNumber(table.at(row, 'Period'), 'Period', LABEL),
      periodDerivative: pdotLimit ? null : optionalNumber(table.at(row, 'Pdot'), 'Pdot', LABEL),
    });
  }
  return magnetars;
}
