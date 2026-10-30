import { ATNF_PACKAGE_URL, MCGILL_MAGNETARS_URL } from '../config.ts';
import { phaseSpace } from '../stars/build3d.ts';
import { STAR3D_KM_S_TO_PC_PER_YEAR, type PulsarCatalog, type PulsarDistanceMethod } from '../types.ts';
import {
  atnfAssociations,
  atnfAstrometry,
  atnfBinary,
  atnfDistance,
  atnfSpin,
  atnfTypes,
  type AtnfAstrometry,
  type AtnfDatabase,
  type AtnfRecord,
} from './atnf.ts';
import type { McgillMagnetar } from './mcgill.ts';

/**
 * The ATNF catalogue's pulsars and McGill's magnetars as one list, each placed in 3D:
 * pulsars.json (PulsarCatalog).
 *
 * ## One entry per neutron star
 *
 * A magnetar seen as a radio or X-ray pulsar is in both catalogues. McGill's entry is
 * matched to the ATNF pulsar within MATCH_ARCSEC of it -- a radio timing position and an
 * X-ray one agree to an arcsecond or two; the nearest other pulsar to any magnetar is
 * arcminutes off -- and the two are one entry: called by McGill's name ("SGR 1806-20"),
 * spun at the ATNF's timing where it has it, and placed at McGill's distance where McGill
 * gives one, which for a magnetar is the better: most have no dispersion measure at all, and
 * McGill cites a measurement for each (a cluster's, a remnant's, an absorption column's).
 * Where McGill gives none, the ATNF's.
 *
 * ## Placed
 *
 * From its position at its epoch, its distance and its proper motion, as the 3D stars are
 * (build3d.ts phaseSpace), and carried to J2000.0 along that motion. No radial velocity: zero.
 * A pulsar with no distance at all is counted and left out.
 *
 * ## Names
 *
 * "PSR " and its J2000 name, as the ATNF lists it; McGill's for a magnetar; and for the
 * few known by another name, that one (COMMON_NAMES).
 */

/** How near an ATNF pulsar must be to a McGill magnetar to be the same star, arcseconds. */
export const MATCH_ARCSEC = 30;

/**
 * Pulsars better known by a name than by their designation, by J2000 name. Each is the
 * name the literature uses, or the IAU's: PSR B1257+12 was named Lich in the IAU's
 * NameExoWorlds vote of 2015, with its planets Draugr, Poltergeist and Phobetor.
 */
export const COMMON_NAMES: Readonly<Record<string, string>> = {
  'J0534+2200': 'Crab Pulsar',
  'J0835-4510': 'Vela Pulsar',
  'J0633+1746': 'Geminga',
  'J1915+1606': 'Hulse–Taylor Pulsar',
  'J0737-3039A': 'Double Pulsar A',
  'J0737-3039B': 'Double Pulsar B',
  'J1300+1240': 'Lich',
  'J1959+2048': 'Black Widow Pulsar',
};

const DEG = Math.PI / 180;

/** The angle between two directions, arcseconds. */
export function separationArcsec(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = Math.sin(((dec2 - dec1) * DEG) / 2) ** 2;
  const b = Math.cos(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.sin(((ra2 - ra1) * DEG) / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(a + b))) / DEG * 3600;
}

/** Position and velocity, scene frame at J2000.0, parsecs and km/s. */
export function pulsarPlacement(sky: AtnfAstrometry, distanceKpc: number): { position: number[]; velocity: number[] } {
  const { position, velocity } = phaseSpace(sky.raDeg, sky.decDeg, 1 / distanceKpc, sky.pmRaMasYr, sky.pmDecMasYr, Number.NaN);
  const shift = (2000 - sky.epochYear) * STAR3D_KM_S_TO_PC_PER_YEAR;
  return { position: position.map((p, axis) => p + velocity[axis]! * shift), velocity };
}

export interface PulsarsInput {
  readonly atnf: AtnfDatabase;
  /** psrcat_ref, shortened (atnf.ts parseAtnfReferences). */
  readonly atnfReferences: ReadonlyMap<string, string>;
  readonly magnetars: readonly McgillMagnetar[];
  readonly queriedAt: string;
}

/**
 * The citation a McGill distance is given with: the catalogue's paper, as its reference codes
 * are its own (the panel says the distance is McGill's beside it).
 */
export const MCGILL_REFERENCE = 'Olausen & Kaspi 2014, ApJS 212, 6';

interface Entry {
  name: string;
  jName: string | null;
  bName: string | null;
  sky: AtnfAstrometry;
  distanceKpc: number;
  method: PulsarDistanceMethod;
  ref: string | null;
  approximate: boolean;
  periodS: number | null;
  periodDerivative: number | null;
  types: string[];
  binaryPeriodDays: number | null;
  companion: string | null;
  globularCluster: string | null;
  remnant: string | null;
  magnetar: boolean;
  candidate: boolean;
}

export function buildPulsars({ atnf, atnfReferences, magnetars, queriedAt }: PulsarsInput): PulsarCatalog {
  const entries: Entry[] = [];
  let unplaced = 0;
  const skyOf = new Map<AtnfRecord, AtnfAstrometry>();
  for (const record of atnf.records) {
    const sky = atnfAstrometry(record);
    if (sky !== null) {
      skyOf.set(record, sky);
    }
  }

  // Each magnetar to its ATNF pulsar, where it is one.
  const magnetarOf = new Map<AtnfRecord, McgillMagnetar>();
  const matched = new Set<McgillMagnetar>();
  for (const magnetar of magnetars) {
    let best: AtnfRecord | null = null;
    let bestArcsec = MATCH_ARCSEC;
    for (const [record, sky] of skyOf) {
      if (Math.abs(sky.decDeg - magnetar.decDeg) * 3600 > MATCH_ARCSEC) {
        continue;
      }
      const arcsec = separationArcsec(sky.raDeg, sky.decDeg, magnetar.raDeg, magnetar.decDeg);
      if (arcsec <= bestArcsec) {
        bestArcsec = arcsec;
        best = record;
      }
    }
    if (best !== null) {
      magnetarOf.set(best, magnetar);
      matched.add(magnetar);
    }
  }

  for (const record of atnf.records) {
    const sky = skyOf.get(record);
    const jName = record.get('PSRJ')?.text ?? null;
    const magnetar = magnetarOf.get(record) ?? null;
    const own = atnfDistance(record);
    const fromMcgill = magnetar !== null && magnetar.distanceKpc !== null && magnetar.distanceKpc > 0;
    if (sky === undefined || (own === null && !fromMcgill)) {
      unplaced += 1;
      continue;
    }
    const spin = atnfSpin(record);
    const binary = atnfBinary(record);
    const types = atnfTypes(record);
    entries.push({
      name:
        (jName === null ? undefined : COMMON_NAMES[jName]) ??
        magnetar?.name ??
        (jName === null ? (record.get('PSRB')?.text ?? 'PSR') : `PSR ${jName}`),
      jName,
      bName: record.get('PSRB')?.text ?? null,
      sky,
      distanceKpc: fromMcgill ? magnetar.distanceKpc! : own!.kpc,
      method: fromMcgill ? 'magnetar' : own!.method,
      ref: fromMcgill ? MCGILL_REFERENCE : own!.ref === null ? null : (atnfReferences.get(own!.ref) ?? null),
      approximate: fromMcgill && magnetar.distanceApproximate,
      periodS: spin.periodS ?? magnetar?.periodS ?? null,
      periodDerivative: spin.periodDerivative ?? magnetar?.periodDerivative ?? null,
      types,
      binaryPeriodDays: binary.periodDays,
      companion: binary.companion,
      ...atnfAssociations(record),
      magnetar: magnetar !== null || types.includes('AXP'),
      candidate: magnetar?.candidate ?? false,
    });
  }

  // McGill's magnetars the ATNF catalogue does not list.
  for (const magnetar of magnetars) {
    if (matched.has(magnetar)) {
      continue;
    }
    if (magnetar.distanceKpc === null || !(magnetar.distanceKpc > 0)) {
      unplaced += 1;
      continue;
    }
    entries.push({
      name: magnetar.name,
      jName: null,
      bName: null,
      sky: { raDeg: magnetar.raDeg, decDeg: magnetar.decDeg, pmRaMasYr: 0, pmDecMasYr: 0, epochYear: 2000 },
      distanceKpc: magnetar.distanceKpc,
      method: 'magnetar',
      ref: MCGILL_REFERENCE,
      approximate: magnetar.distanceApproximate,
      periodS: magnetar.periodS,
      periodDerivative: magnetar.periodDerivative,
      types: [],
      binaryPeriodDays: null,
      companion: null,
      globularCluster: null,
      remnant: null,
      magnetar: true,
      candidate: magnetar.candidate,
    });
  }

  const references: string[] = [];
  const referenceIndex = new Map<string, number>();
  const cite = (text: string | null): number | null => {
    if (text === null) {
      return null;
    }
    let index = referenceIndex.get(text);
    if (index === undefined) {
      index = references.length;
      references.push(text);
      referenceIndex.set(text, index);
    }
    return index;
  };

  const round = (value: number, digits: number): number => Number(value.toFixed(digits));
  const placed = entries.map((entry) => pulsarPlacement(entry.sky, entry.distanceKpc));
  const byMethod: Record<PulsarDistanceMethod, number> = { independent: 0, parallax: 0, bounded: 0, dm: 0, magnetar: 0 };
  for (const entry of entries) {
    byMethod[entry.method] += 1;
  }
  const column = <T>(pick: (entry: Entry, k: number) => T): T[] => entries.map(pick);

  return {
    sources: {
      atnf: { version: atnf.version, url: ATNF_PACKAGE_URL, queriedAt },
      mcgill: { url: MCGILL_MAGNETARS_URL, queriedAt },
    },
    frame: 'Heliocentric; ICRS rotated about its x axis by the IAU 1976 obliquity, 84381.448": the scene frame.',
    counts: {
      listed: entries.length + unplaced,
      placed: entries.length,
      unplaced,
      byMethod,
      magnetars: entries.filter((entry) => entry.magnetar).length,
      binaries: entries.filter((entry) => entry.binaryPeriodDays !== null).length,
      inGlobularClusters: entries.filter((entry) => entry.globularCluster !== null).length,
    },
    references,
    pulsars: {
      count: entries.length,
      name: column((entry) => entry.name),
      jName: column((entry) => entry.jName),
      bName: column((entry) => entry.bName),
      // A thousandth of a parsec is 200 AU, and the nearest pulsar is 156 pc away.
      x: column((_, k) => round(placed[k]!.position[0]!, 3)),
      y: column((_, k) => round(placed[k]!.position[1]!, 3)),
      z: column((_, k) => round(placed[k]!.position[2]!, 3)),
      vx: column((_, k) => round(placed[k]!.velocity[0]!, 2)),
      vy: column((_, k) => round(placed[k]!.velocity[1]!, 2)),
      vz: column((_, k) => round(placed[k]!.velocity[2]!, 2)),
      distancePc: column((entry) => round(entry.distanceKpc * 1000, 1)),
      distanceMethod: column((entry) => entry.method),
      distanceRef: column((entry) => cite(entry.ref)),
      distanceApproximate: column((entry) => entry.approximate),
      periodS: column((entry) => entry.periodS),
      periodDerivative: column((entry) => entry.periodDerivative),
      types: column((entry) => entry.types),
      binaryPeriodDays: column((entry) => entry.binaryPeriodDays),
      companion: column((entry) => entry.companion),
      globularCluster: column((entry) => entry.globularCluster),
      remnant: column((entry) => entry.remnant),
      magnetar: column((entry) => entry.magnetar),
      candidate: column((entry) => entry.candidate),
    },
  };
}

/** A few lines for the log. */
export function describePulsars(catalog: PulsarCatalog): string[] {
  const { counts } = catalog;
  const m = counts.byMethod;
  return [
    `[pulsars] ATNF ${catalog.sources.atnf.version}: ${counts.placed} placed of ${counts.listed} listed (${counts.unplaced} with no distance).`,
    `[pulsars] distances: ${m.independent} independent, ${m.parallax} parallax, ${m.bounded} bounded, ${m.dm} YMW16, ${m.magnetar} McGill.`,
    `[pulsars] ${counts.magnetars} magnetars, ${counts.binaries} binaries, ${counts.inGlobularClusters} in globular clusters.`,
  ];
}
