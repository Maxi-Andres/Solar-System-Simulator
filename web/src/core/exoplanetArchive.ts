import type { BodyId, ExoplanetCatalog } from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import type { Searchable } from './beltNames.ts';
import type { ExoPlanet, PlanetPhase } from './exoplanets.ts';
import type { PlanetarySystem } from './planetarySystems.ts';
import { normalizeName } from './search.ts';

/**
 * The whole NASA Exoplanet Archive (D4b): every confirmed planet of another star, from the
 * Archive's composite table (tools/src/exoplanets/), read here into the planets and
 * systems the curated four are made of (exoplanets.ts, planetarySystems.ts).
 *
 * The file holds the Archive's numbers as it serves them. Everything below that is not one
 * of them is a convention, stated here and on screen:
 *
 * ## Whose argument of periastron
 *
 * The Archive does not say, and the literature has two habits. A radial-velocity fit's
 * omega is the star's, with the line of sight pointing away from us; a transit paper's is
 * the planet's, with it pointing toward us -- and those two are the same number, the two
 * flips cancelling (Winn 2010, "Transits and Occultations", section 2). In both the planet
 * is in front of its star at a true anomaly of 90 deg - omega. The pipeline tests it where
 * it can: of the planets whose periastron time, conjunction time and omega all come from
 * one paper, at e >= 0.1, 35 agree with that reading and 1 with the other (run of
 * 2026-10-29; exoplanets.json `omegaCheck`). So the Archive's omega is read that way, and
 * the planet's own -- exoplanets.ts's, measured from the node where the planet recedes from
 * us -- is the Archive's plus 180 degrees.
 *
 * ## Where a value is missing
 *
 * - **Eccentricity** missing, or published only as an upper limit: **circular**.
 * - **Argument of periastron** missing: **0**, what the Archive itself lists for an orbit
 *   fitted as circular.
 * - **Where along the orbit:** from the transit midpoint (`pl_tranmid`), which for a
 *   planet that does not transit is its fitted time of inferior conjunction; else from its
 *   periastron time; else unknown, and periastron at J2000 stands in (exoplanets.ts).
 *   Times are taken as TDB Julian days whatever their stated standard: BJD against JD or
 *   HJD differs by at most the light time across Earth's orbit, 8.3 minutes, a part in a
 *   thousand of the shortest year here.
 * - **Tilt:** the Archive's inclination where it gives one -- a transiting planet's, near
 *   90 deg -- else edge-on. **Node:** never given; east-west.
 * - **Period or semi-major axis** missing (a microlensing planet has a separation and no
 *   period): the other from Kepler's third law with the star's mass, a^3 = M P^2 (AU,
 *   years, solar masses; the planet's own mass neglected). Neither: not drawn.
 * - **The star's mass** missing: from its planets' orbits the same way, where one has both
 *   period and semi-major axis. Neither: its planets are not drawn.
 * - **Radius:** measured only for a planet seen to transit; any other is drawn at the size
 *   its mass suggests (Chen & Kipping 2017; exoplanets.ts), the Archive's own estimate.
 *   With neither radius nor mass, not drawn.
 *
 * ## Not drawn twice
 *
 * Proxima Centauri's planets, Tau Ceti's, Epsilon Eridani's, Barnard's Star's and 51
 * Pegasi's are read from their papers (proximaPlanets.ts, planetarySystems.ts). Their
 * hosts keep their markers, and going to one goes to that system: CURATED_HOSTS.
 */

/** Archive hostnames whose systems are drawn from their papers instead, and which. */
export const CURATED_HOSTS: Readonly<Record<string, string>> = {
  'Proxima Cen': 'alpha-centauri',
  'tau Cet': 'tau-ceti',
  'eps Eri': 'epsilon-eridani',
  "Barnard's star": 'barnards-star',
  '51 Peg': '51-pegasi',
};

/** The catalogue, and its hosts and planets as one search index: hosts first, then planets. */
export interface ExoplanetArchive {
  readonly catalog: ExoplanetCatalog;
  /** Entry k < hosts.count is host k; entry hosts.count + p is planet p. */
  readonly search: Searchable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Checks exoplanets.json has one entry per host and per planet in every column. */
export function parseExoplanetCatalog(raw: unknown): ExoplanetCatalog {
  if (!isRecord(raw) || !isRecord(raw['hosts']) || !isRecord(raw['planets']) || !Array.isArray(raw['references'])) {
    throw new Error('exoplanets.json is not a catalogue of hosts and planets.');
  }
  for (const part of ['hosts', 'planets'] as const) {
    const table = raw[part] as Record<string, unknown>;
    const count = table['count'];
    if (typeof count !== 'number') {
      throw new Error(`exoplanets.json's ${part} have no count.`);
    }
    for (const [column, values] of Object.entries(table)) {
      if (column !== 'count' && (!Array.isArray(values) || values.length !== count)) {
        throw new Error(`exoplanets.json's ${part}.${column} does not have one entry each.`);
      }
    }
  }
  const catalog = raw as unknown as ExoplanetCatalog;
  const { hosts, planets } = catalog;
  for (let h = 0; h < hosts.count; h += 1) {
    const first = hosts.firstPlanet[h]!;
    const count = hosts.planetCount[h]!;
    if (first < 0 || first + count > planets.count || (count > 0 && planets.host[first] !== h)) {
      throw new Error(`exoplanets.json: host ${hosts.name[h]} points at planets that are not its own.`);
    }
  }
  return catalog;
}

export function indexExoplanets(catalog: ExoplanetCatalog): ExoplanetArchive {
  const { hosts, planets } = catalog;
  return {
    catalog,
    search: {
      display: [...hosts.name.map(normalizeName), ...planets.name.map(normalizeName)],
      designation: [...hosts.designations.map((list) => normalizeName(list.join(' '))), ...planets.name.map(() => '')],
    },
  };
}

/** Reads exoplanets.json; null where the published data has none. */
export async function loadExoplanetArchive(fetchers: BeltFetchers, basePath = '/'): Promise<ExoplanetArchive | null> {
  const raw = await fetchers.json(`${basePath}data/exoplanets.json`);
  if (raw === null) {
    console.warn('The published data has no exoplanets.json: the Archive’s planets are not shown.');
    return null;
  }
  return indexExoplanets(parseExoplanetCatalog(raw));
}

/** A host's system key, and a planet's body id. */
export function archiveSystemKey(host: number): string {
  return `archive-${host}`;
}
export function archivePlanetId(planet: number): BodyId {
  return `exo-${planet}`;
}

const DAYS_PER_YEAR = 365.25;

/** Kepler's third law, solar masses, AU and days: the mass that makes a and P agree. */
export function keplerMassSun(semiMajorAxisAu: number, periodDays: number): number {
  const years = periodDays / DAYS_PER_YEAR;
  return semiMajorAxisAu ** 3 / (years * years);
}

/**
 * A host's mass, solar masses: the Archive's, or where it gives none, from its first planet
 * with both a period and a semi-major axis; null where neither can be had.
 */
export function archiveHostMass(
  catalog: ExoplanetCatalog,
  host: number,
): { readonly massSun: number; readonly fromOrbits: boolean } | null {
  const { hosts, planets } = catalog;
  const published = hosts.massSun[host];
  if (published != null && published > 0) {
    return { massSun: published, fromOrbits: false };
  }
  const first = hosts.firstPlanet[host]!;
  for (let p = first; p < first + hosts.planetCount[host]!; p += 1) {
    const a = planets.semiMajorAxisAu[p];
    const period = planets.periodDays[p];
    if (a != null && period != null && a > 0 && period > 0) {
      return { massSun: keplerMassSun(a, period), fromOrbits: true };
    }
  }
  return null;
}

const MASS_NOTES: Readonly<Record<string, ExoPlanet['massNote']>> = {
  'M-R relationship': 'estimate',
};

/**
 * Planet `p` as an ExoPlanet, under the conventions in the header; null where it cannot be
 * drawn -- no orbit size, or no size at all.
 */
export function archivePlanet(catalog: ExoplanetCatalog, p: number, hostMassSun: number | null): ExoPlanet | null {
  const { planets, references } = catalog;
  let period = planets.periodDays[p] ?? null;
  let a = planets.semiMajorAxisAu[p] ?? null;
  if (period === null && a !== null && hostMassSun !== null) {
    period = Math.sqrt(a ** 3 / hostMassSun) * DAYS_PER_YEAR;
  } else if (a === null && period !== null && hostMassSun !== null) {
    a = Math.cbrt(hostMassSun * (period / DAYS_PER_YEAR) ** 2);
  }
  const mass = planets.massEarth[p] ?? null;
  const radius = planets.radiusEarth[p] ?? null;
  if (period === null || a === null || !(period > 0) || !(a > 0) || (mass === null && radius === null)) {
    return null;
  }
  const e = planets.eccentricityLimit[p] ? 0 : (planets.eccentricity[p] ?? 0);
  const transit = planets.transitJd[p] ?? null;
  const periastron = planets.periastronJd[p] ?? null;
  const phase: PlanetPhase =
    transit !== null
      ? { kind: 'conjunction', jd: transit }
      : periastron !== null
        ? { kind: 'periastron', jd: periastron }
        : { kind: 'unknown' };
  const limit = planets.massLimit[p] ?? 0;
  const massNote: ExoPlanet['massNote'] =
    mass === null
      ? 'unknown'
      : limit > 0
        ? 'upper limit'
        : limit < 0
          ? 'lower limit'
          : MASS_NOTES[planets.massKind[p] ?? ''];
  const disputed = planets.controversial[p] ?? false;
  const orbitRef = planets.orbitRef[p];
  const discoveryRef = planets.discoveryRef[p];
  const reference = orbitRef != null ? references[orbitRef] : discoveryRef != null ? references[discoveryRef] : undefined;
  return {
    id: archivePlanetId(p),
    // As the curated systems name theirs: the doubt is part of the name.
    name: disputed ? `${planets.name[p]} (disputed)` : planets.name[p]!,
    status: disputed ? 'disputed' : 'confirmed',
    periodDays: period,
    semiMajorAxisAu: a,
    eccentricity: e,
    // The Archive's omega, the star's (see the header), turned into the planet's.
    argPeriastronDeg: e === 0 ? 0 : ((((planets.omegaDeg[p] ?? 0) + 180) % 360) + 360) % 360,
    massEarth: mass ?? 0,
    massIsMinimum: planets.massKind[p] === 'Msini',
    ...(massNote === undefined ? {} : { massNote }),
    radiusEarth: radius,
    phase,
    inclinationDeg: planets.inclinationDeg[p] ?? null,
    nodeDeg: null,
    reference: reference ?? 'NASA Exoplanet Archive',
  };
}

/**
 * Host `h` as a PlanetarySystem, with its drawable planets. `placedFromArchive` and
 * `moving` say how its star is placed (archiveSystems.ts).
 */
export function archiveSystem(
  catalog: ExoplanetCatalog,
  h: number,
  placedFromArchive: boolean,
): PlanetarySystem {
  const { hosts, references } = catalog;
  const mass = archiveHostMass(catalog, h);
  const planets: ExoPlanet[] = [];
  const first = hosts.firstPlanet[h]!;
  for (let p = first; p < first + hosts.planetCount[h]!; p += 1) {
    // No mass, no orbit: a planet's speed is its star's to give.
    const planet = mass === null ? null : archivePlanet(catalog, p, mass.massSun);
    if (planet !== null) {
      planets.push(planet);
    }
  }
  const reference = (index: number | null | undefined): string | null => (index == null ? null : references[index]!);
  const velocity = [hosts.vx[h], hosts.vy[h], hosts.vz[h]];
  return {
    key: archiveSystemKey(h),
    name: hosts.name[h]!,
    hostDesignation: '',
    hostMassSun: mass?.massSun ?? 0,
    hostMassReference: mass === null ? 'none' : mass.fromOrbits ? 'Kepler’s third law' : (reference(hosts.massRef[h]) ?? 'NASA Exoplanet Archive'),
    hostRadiusSun: hosts.radiusSun[h] ?? null,
    hostRadiusReference: reference(hosts.radiusRef[h]),
    planets,
    archive: {
      host: h,
      distancePc: hosts.distancePc[h] ?? null,
      teffK: hosts.teffK[h] ?? null,
      spectralType: hosts.spectralType[h] ?? null,
      designations: hosts.designations[h] ?? [],
      stars: hosts.stars[h] ?? 1,
      listed: hosts.planetCount[h]!,
      massFromOrbits: mass?.fromOrbits ?? false,
      placedFromArchive,
      moving: velocity.some((v) => v != null && v !== 0),
    },
  };
}

/** The host a search entry stands for, and the planet if it is one. */
export function searchEntry(
  catalog: ExoplanetCatalog,
  k: number,
): { readonly host: number; readonly planet: number | null } {
  return k < catalog.hosts.count ? { host: k, planet: null } : { host: catalog.planets.host[k - catalog.hosts.count]!, planet: k - catalog.hosts.count };
}
