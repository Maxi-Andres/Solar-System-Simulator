import {
  BAUMGARDT_ORBITS_URL,
  BAUMGARDT_STRUCTURE_URL,
  HARRIS_URL,
} from '../config.ts';
import { phaseSpace } from '../stars/build3d.ts';
import { parseSexagesimalDegrees, parseSexagesimalHours } from '../stars/buildStarCatalog.ts';
import type { GlobularClusterCatalog } from '../types.ts';

/**
 * The Milky Way's globular clusters: Baumgardt's database, Harris's catalogue beside it
 * (config.ts for both).
 *
 * ## From Baumgardt
 *
 * - **orbits_table.txt**: each cluster's centre (RA, Dec, J2000), its distance from the Sun
 *   with its error, its mean radial velocity, and its mean proper motion from Gaia EDR3
 *   (Vasiliev & Baumgardt 2021). The distances are Baumgardt & Vasiliev 2021's: Gaia
 *   parallaxes, HST and Gaia proper-motion kinematics, and the literature's photometric
 *   distances, averaged.
 * - **combined_table.txt**: the N-body fits -- mass, the radii (core, projected half-light,
 *   half-mass, tidal), the central velocity dispersion and escape velocity -- and the V
 *   magnitude of Baumgardt et al. 2020. It lists some clusters twice, identically; the first
 *   is kept.
 *
 * ## From Harris
 *
 * mwgc.dat, Part I for each cluster's other name ("47 Tuc", "omega Cen") and Part II for its
 * [Fe/H] and E(B-V): the metallicity its stars are drawn with, and the reddening in front of
 * it from the Sun. Matched to Baumgardt's by position, within MATCH_ARCMIN -- the two use
 * different spellings ("Ter 5" and "Terzan 5", "2MASS-GC01" and "2MS-GC01"), and the centres
 * agree to a few arcseconds. Ten of Baumgardt's clusters were found after 2010, and have no
 * Harris entry: they have no metallicity or reddening here.
 *
 * ## Placed
 *
 * Its centre at its distance, moving at its proper motion and radial velocity (build3d.ts
 * phaseSpace), the position taken as J2000.0's: Baumgardt's centres are J2000 coordinates,
 * and a cluster's few mas a year move it less than its own core in the clock's centuries.
 */

/** How near a Harris cluster must be to Baumgardt's to be the same, arcminutes. */
export const MATCH_ARCMIN = 1;

/** The Messier numbers of the globular clusters, by NGC number: Messier's own catalogue. */
export const MESSIER: Readonly<Record<string, string>> = {
  'NGC 7089': 'M2',
  'NGC 5272': 'M3',
  'NGC 6121': 'M4',
  'NGC 5904': 'M5',
  'NGC 6333': 'M9',
  'NGC 6254': 'M10',
  'NGC 6218': 'M12',
  'NGC 6205': 'M13',
  'NGC 6402': 'M14',
  'NGC 7078': 'M15',
  'NGC 6273': 'M19',
  'NGC 6656': 'M22',
  'NGC 6626': 'M28',
  'NGC 7099': 'M30',
  'NGC 5024': 'M53',
  'NGC 6715': 'M54',
  'NGC 6809': 'M55',
  'NGC 6779': 'M56',
  'NGC 6266': 'M62',
  'NGC 4590': 'M68',
  'NGC 6637': 'M69',
  'NGC 6681': 'M70',
  'NGC 6838': 'M71',
  'NGC 6981': 'M72',
  'NGC 6864': 'M75',
  'NGC 1904': 'M79',
  'NGC 6093': 'M80',
  'NGC 6341': 'M92',
  'NGC 6171': 'M107',
};

/** Names a cluster is known by beyond Harris's short ones. */
export const COMMON_NAMES: Readonly<Record<string, string>> = {
  'NGC 104': '47 Tucanae',
  'NGC 5139': 'Omega Centauri',
};

/** A whitespace table with "#" comments, as rows of strings. */
function rows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.trim().split(/\s+/));
}

export interface BaumgardtOrbit {
  readonly name: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distanceKpc: number;
  readonly distanceErrorKpc: number;
  readonly rvKmS: number;
  readonly pmRaMasYr: number;
  readonly pmDecMasYr: number;
}

/** orbits_table.txt: columns 1-3, 6-7, 9, 11 and 13 (1-based, as its header numbers them). */
export function parseBaumgardtOrbits(text: string): BaumgardtOrbit[] {
  return rows(text).map((c) => ({
    name: c[0]!.replace(/_/g, ' '),
    raDeg: Number(c[1]),
    decDeg: Number(c[2]),
    distanceKpc: Number(c[5]),
    distanceErrorKpc: Number(c[6]),
    rvKmS: Number(c[8]),
    pmRaMasYr: Number(c[10]),
    pmDecMasYr: Number(c[12]),
  }));
}

export interface BaumgardtStructure {
  readonly name: string;
  readonly massSun: number;
  readonly vMag: number | null;
  readonly coreRadiusPc: number;
  readonly halfLightRadiusPc: number;
  readonly halfMassRadiusPc: number;
  readonly tidalRadiusPc: number;
  readonly sigma0KmS: number;
  readonly escapeKmS: number;
}

/**
 * combined_table.txt, by the n-th value of a row (1-based): mass 10, V 12, rc 16, rh,l 17,
 * rh,m 18, rt 19, sig0 31, vesc 32. Its rows carry one value fewer than its header numbers
 * columns past the 20th -- the header's sig_c is not there -- so these are counted in the rows.
 */
export function parseBaumgardtStructure(text: string): Map<string, BaumgardtStructure> {
  const byName = new Map<string, BaumgardtStructure>();
  for (const c of rows(text)) {
    const name = c[0]!.replace(/_/g, ' ');
    if (byName.has(name)) {
      continue;
    }
    const v = Number(c[11]);
    byName.set(name, {
      name,
      massSun: Number(c[9]),
      vMag: Number.isFinite(v) && v < 90 ? v : null,
      coreRadiusPc: Number(c[15]),
      halfLightRadiusPc: Number(c[16]),
      halfMassRadiusPc: Number(c[17]),
      tidalRadiusPc: Number(c[18]),
      sigma0KmS: Number(c[30]),
      escapeKmS: Number(c[31]),
    });
  }
  return byName;
}

export interface HarrisCluster {
  readonly id: string;
  readonly otherName: string | null;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly feH: number | null;
  readonly ebv: number | null;
}

/**
 * mwgc.dat's Parts I and II, by their fixed columns: Part I the ID (1-12) and other name
 * (13-25) then the sexagesimal position; Part II the ID, [Fe/H] (13-18) and E(B-V) (22-28),
 * a blank where Harris has no value.
 */
export function parseHarris(text: string): HarrisCluster[] {
  const lines = text.split(/\r?\n/);
  const partOne = lines.findIndex((line) => line.includes('Part I:'));
  const partTwo = lines.findIndex((line) => line.includes('Part II:'));
  const partThree = lines.findIndex((line) => line.includes('Part III:'));
  if (partOne < 0 || partTwo < 0 || partThree < 0) {
    throw new Error('mwgc.dat does not have its three parts.');
  }
  const position = /^(\d\d \d\d [\d.]+)\s+([+-]\d\d \d\d [\d.]+)/;
  const found = new Map<string, { otherName: string | null; raDeg: number; decDeg: number }>();
  for (const line of lines.slice(partOne, partTwo)) {
    const match = position.exec(line.slice(25));
    if (!line.startsWith(' ') || match === null) {
      continue;
    }
    const id = line.slice(0, 12).trim();
    // "M 4" as Harris writes it, "M4" as the Messier numbers below are.
    const other = line.slice(12, 25).trim().replace(/^M (\d+)$/, 'M$1');
    found.set(id, {
      otherName: other === '' ? null : other,
      raDeg: parseSexagesimalHours(match[1]!),
      decDeg: parseSexagesimalDegrees(match[2]!),
    });
  }
  const value = (text: string): number | null => {
    const trimmed = text.trim();
    return trimmed === '' || !Number.isFinite(Number(trimmed)) ? null : Number(trimmed);
  };
  const clusters: HarrisCluster[] = [];
  for (const line of lines.slice(partTwo, partThree)) {
    const id = line.slice(0, 12).trim();
    const place = found.get(id);
    if (place === undefined) {
      continue;
    }
    clusters.push({ id, ...place, feH: value(line.slice(12, 18)), ebv: value(line.slice(21, 28)) });
  }
  return clusters;
}

const DEG = Math.PI / 180;

function separationArcmin(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = Math.sin(((dec2 - dec1) * DEG) / 2) ** 2;
  const b = Math.cos(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.sin(((ra2 - ra1) * DEG) / 2) ** 2;
  return ((2 * Math.asin(Math.sqrt(a + b))) / DEG) * 60;
}

export interface GlobularClustersInput {
  readonly orbits: readonly BaumgardtOrbit[];
  readonly structure: ReadonlyMap<string, BaumgardtStructure>;
  readonly harris: readonly HarrisCluster[];
  readonly queriedAt: string;
}

export function buildGlobularClusters({ orbits, structure, harris, queriedAt }: GlobularClustersInput): GlobularClusterCatalog {
  const kept = orbits.filter((orbit) => structure.has(orbit.name) && orbit.distanceKpc > 0);
  const round = (value: number, digits: number): number => Number(value.toFixed(digits));
  const columns = kept.map((orbit) => {
    const s = structure.get(orbit.name)!;
    const h =
      harris.find((candidate) => separationArcmin(candidate.raDeg, candidate.decDeg, orbit.raDeg, orbit.decDeg) < MATCH_ARCMIN) ??
      null;
    const otherNames = [
      COMMON_NAMES[orbit.name],
      h?.otherName ?? undefined,
      h !== null && h.id !== orbit.name ? h.id : undefined,
      MESSIER[orbit.name],
    ].filter((name): name is string => name !== undefined);
    const { position, velocity } = phaseSpace(
      orbit.raDeg,
      orbit.decDeg,
      1 / orbit.distanceKpc,
      orbit.pmRaMasYr,
      orbit.pmDecMasYr,
      orbit.rvKmS,
    );
    return { orbit, s, h, otherNames: [...new Set(otherNames)].filter((name) => name !== orbit.name), position, velocity };
  });
  return {
    sources: {
      baumgardt: { orbits: BAUMGARDT_ORBITS_URL, structure: BAUMGARDT_STRUCTURE_URL },
      harris: HARRIS_URL,
      queriedAt,
    },
    frame: 'Heliocentric; ICRS rotated about its x axis by the IAU 1976 obliquity, 84381.448": the scene frame.',
    count: columns.length,
    name: columns.map((c) => c.orbit.name),
    otherNames: columns.map((c) => c.otherNames),
    x: columns.map((c) => round(c.position[0], 2)),
    y: columns.map((c) => round(c.position[1], 2)),
    z: columns.map((c) => round(c.position[2], 2)),
    vx: columns.map((c) => round(c.velocity[0], 2)),
    vy: columns.map((c) => round(c.velocity[1], 2)),
    vz: columns.map((c) => round(c.velocity[2], 2)),
    distancePc: columns.map((c) => round(c.orbit.distanceKpc * 1000, 0)),
    distanceErrorPc: columns.map((c) => round(c.orbit.distanceErrorKpc * 1000, 0)),
    massSun: columns.map((c) => c.s.massSun),
    vMag: columns.map((c) => c.s.vMag),
    coreRadiusPc: columns.map((c) => c.s.coreRadiusPc),
    halfLightRadiusPc: columns.map((c) => c.s.halfLightRadiusPc),
    halfMassRadiusPc: columns.map((c) => c.s.halfMassRadiusPc),
    tidalRadiusPc: columns.map((c) => c.s.tidalRadiusPc),
    sigma0KmS: columns.map((c) => c.s.sigma0KmS),
    escapeKmS: columns.map((c) => c.s.escapeKmS),
    feH: columns.map((c) => c.h?.feH ?? null),
    ebv: columns.map((c) => c.h?.ebv ?? null),
  };
}

export function describeGlobularClusters(catalog: GlobularClusterCatalog): string[] {
  const withHarris = catalog.feH.filter((value) => value !== null).length;
  return [
    `[clusters] ${catalog.count} globular clusters, ${withHarris} with Harris's [Fe/H].`,
  ];
}
