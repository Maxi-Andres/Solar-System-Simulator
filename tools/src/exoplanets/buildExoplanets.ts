import { EXOPLANET_ARCHIVE_TABLE } from '../config.ts';
import { phaseSpace, tierRecordBytes, type Stars3dBuild } from '../stars/build3d.ts';
import {
  STAR3D_KM_S_TO_PC_PER_YEAR,
  STAR3D_RECORD_FLOATS,
  type ExoplanetCatalog,
  type ExoplanetHosts,
  type ExoplanetPlanets,
} from '../types.ts';
import { ARCHIVE_SERVICE, type ArchiveRow } from './archive.ts';

/**
 * The Archive's planets grouped by host, and each host found among the 3D stars or placed
 * from the Archive's own astrometry: exoplanets.json (ExoplanetCatalog).
 *
 * ## Finding a host among the 3D stars
 *
 * By Gaia DR3 source_id first -- the Archive gives one for 4,477 of its 4,847 hosts, and the
 * 3D stars carry theirs (a GCNS star's, or a sky star's cross-matched counterpart) -- and
 * then by Hipparcos number, for a host with no Gaia id or one not among the 3D stars. Not
 * by HIP where the Archive names a component other than A ("HIP 12345 B"): Hipparcos's
 * number is the pair's, and its star would be the wrong one. Nor where the 3D star the
 * number leads to carries a different Gaia id: then it is another source. Never by position:
 * two ids are certain where a few arcseconds near a binary are not.
 *
 * ## The others
 *
 * A host not among the 3D stars -- past the 100-pc census and fainter than the sky's V 8,
 * which is most of the Kepler and TESS hosts -- is placed from the Archive's right
 * ascension, declination and distance (`sy_dist`), and moved by its proper motion and
 * radial velocity where the Archive gives them (zero where it does not: then it stands
 * still, and the panel says so). The Archive's positions are Gaia's where it has them, at
 * Gaia DR3's epoch, J2016.0; they are carried back to J2000.0 along that motion, the 3D
 * stars' epoch, as build3d.ts does for the census. A host with no distance and no 3D star
 * is not placed (`unplaced`): there is nowhere honest to put it.
 */

/** The 3D stars' identifiers and records, tier by tier, in the order they are written. */
export interface Star3dIds {
  readonly queriedAt: string;
  /** Stars3dInfo.frame: the frame their records, and so the hosts' places, are in. */
  readonly frame: string;
  readonly tiers: readonly {
    readonly gaia: BigUint64Array;
    readonly hip: Uint32Array;
    /** STAR3D_RECORD_FLOATS a star, as the tier file has them. */
    readonly records: Float32Array;
  }[];
}

/** The ids from a build in hand, as writeStars3d will write them. */
export function starIdsFromBuild(build: Stars3dBuild): Star3dIds {
  const { info, table, order, tierStarts } = build;
  return {
    queriedAt: info.queriedAt,
    frame: info.frame,
    tiers: info.tiers.map((entry, tier) => {
      const start = tierStarts[tier] ?? 0;
      const indices = order.subarray(start, start + entry.count);
      const bytes = tierRecordBytes(table, indices);
      return {
        gaia: BigUint64Array.from(indices, (k) => table.gaiaId[k]!),
        hip: Uint32Array.from(indices, (k) => table.hip[k]!),
        records: new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4),
      };
    }),
  };
}

/** Where a host was found among the 3D stars, and how. */
interface Match {
  readonly tier: number;
  readonly index: number;
  readonly by: 'gaia' | 'hip';
}

/** Lookups from Gaia id and HIP number to a 3D star. */
export function starLookup(ids: Star3dIds): {
  byGaia: Map<bigint, { tier: number; index: number }>;
  byHip: Map<number, { tier: number; index: number; gaia: bigint }>;
} {
  const byGaia = new Map<bigint, { tier: number; index: number }>();
  const byHip = new Map<number, { tier: number; index: number; gaia: bigint }>();
  ids.tiers.forEach((tier, t) => {
    for (let i = 0; i < tier.gaia.length; i += 1) {
      const gaia = tier.gaia[i]!;
      if (gaia !== 0n && !byGaia.has(gaia)) {
        byGaia.set(gaia, { tier: t, index: i });
      }
      const hip = tier.hip[i]!;
      if (hip !== 0 && !byHip.has(hip)) {
        byHip.set(hip, { tier: t, index: i, gaia });
      }
    }
  });
  return { byGaia, byHip };
}

/** The Hipparcos number an Archive `hip_name` gives a star by, or null: "HIP 8102", "HIP 28941 A". */
export function hipNumber(hipName: string | null): number | null {
  const match = hipName === null ? null : /^HIP (\d+)(?: (A|AB))?$/.exec(hipName);
  return match === null ? null : Number(match[1]);
}

export function matchHost(row: ArchiveRow, lookup: ReturnType<typeof starLookup>): Match | null {
  const gaia = row.gaiaDr3 === null ? null : BigInt(row.gaiaDr3);
  if (gaia !== null) {
    const found = lookup.byGaia.get(gaia);
    if (found !== undefined) {
      return { ...found, by: 'gaia' };
    }
  }
  const hip = hipNumber(row.hip);
  const found = hip === null ? undefined : lookup.byHip.get(hip);
  if (found !== undefined && (found.gaia === 0n || gaia === null || found.gaia === gaia)) {
    return { tier: found.tier, index: found.index, by: 'hip' };
  }
  return null;
}

/** Gaia DR3's epoch, J2016.0, to the 3D stars', J2000.0: years. */
const ARCHIVE_EPOCH_TO_J2000_YEARS = 2000 - 2016;

/**
 * A host placed from the Archive: position and velocity in the scene frame at J2000.0,
 * parsecs and km/s, or null with no distance.
 */
export function archivePlacement(row: ArchiveRow): { position: number[]; velocity: number[] } | null {
  if (row.distancePc === null || !(row.distancePc > 0)) {
    return null;
  }
  const { position, velocity } = phaseSpace(
    row.raDeg,
    row.decDeg,
    1000 / row.distancePc,
    row.pmRaMasYr ?? 0,
    row.pmDecMasYr ?? 0,
    row.rvKmS ?? Number.NaN,
  );
  const shift = ARCHIVE_EPOCH_TO_J2000_YEARS * STAR3D_KM_S_TO_PC_PER_YEAR;
  return { position: position.map((p, axis) => p + velocity[axis]! * shift), velocity };
}

const DEG = Math.PI / 180;

/**
 * Which convention a planet's argument of periastron is in, where its numbers can say: an
 * orbit of e >= 0.1 with a periastron time, a conjunction time and omega all from one
 * paper. Null where they cannot.
 *
 * At inferior conjunction (a transit, for a transiting planet) the planet is between its
 * star and us. Take the line of sight as pointing away from us, as a radial velocity
 * does: v = K [cos(f + omega) + e cos omega] is the star's velocity away from us, and omega
 * there is the star's own argument of periastron. Then the conjunction falls at a true
 * anomaly of 90 deg - omega (`star`). The same number is the planet's omega with the line
 * of sight pointing toward us, the transit literature's (Winn 2010, "Transits and
 * Occultations", section 2): the two flips cancel. The other reading --
 * the planet's omega with the line of sight away from us -- puts it at -90 deg - omega
 * (`planet`). The periastron time and the period put the planet at one mean anomaly at
 * the conjunction time; whichever true anomaly gives that, to 5% of a period, is the
 * convention the paper used.
 */
export function omegaConvention(row: ArchiveRow): 'star' | 'planet' | 'neither' | null {
  const { eccentricity: e, omegaDeg, periodDays, transitJd, periastronJd } = row;
  if (
    e === null ||
    omegaDeg === null ||
    periodDays === null ||
    transitJd === null ||
    periastronJd === null ||
    e < 0.1 ||
    e >= 1 ||
    row.omegaRef === null ||
    row.omegaRef !== row.transitRef ||
    row.omegaRef !== row.periastronRef
  ) {
    return null;
  }
  const meanAnomalyAt = (trueAnomaly: number): number => {
    const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(trueAnomaly / 2), Math.sqrt(1 + e) * Math.cos(trueAnomaly / 2));
    return E - e * Math.sin(E);
  };
  const turn = 2 * Math.PI;
  const fromTimes = (((transitJd - periastronJd) / periodDays) * turn) % turn;
  const miss = (trueAnomaly: number): number => {
    const d = (((fromTimes - meanAnomalyAt(trueAnomaly)) % turn) + turn + Math.PI) % turn - Math.PI;
    return Math.abs(d) / turn;
  };
  const star = miss(Math.PI / 2 - omegaDeg * DEG);
  const planet = miss(-Math.PI / 2 - omegaDeg * DEG);
  if (star <= 0.05 && star <= planet) {
    return 'star';
  }
  if (planet <= 0.05) {
    return 'planet';
  }
  return 'neither';
}

/** A planet's place in its host's list: by period, those without one last, then by name. */
function byPeriod(a: ArchiveRow, b: ArchiveRow): number {
  return (a.periodDays ?? Infinity) - (b.periodDays ?? Infinity) || a.name.localeCompare(b.name);
}

export interface ExoplanetsInput {
  readonly rows: readonly ArchiveRow[];
  readonly queriedAt: string;
  /** The 3D stars to find the hosts among; null where there are none. */
  readonly stars: Star3dIds | null;
}

export function buildExoplanets({ rows, queriedAt, stars }: ExoplanetsInput): ExoplanetCatalog {
  const references: string[] = [];
  const referenceIndex = new Map<string, number>();
  const ref = (text: string | null): number | null => {
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

  const byHost = new Map<string, ArchiveRow[]>();
  for (const row of rows) {
    const list = byHost.get(row.hostname);
    if (list === undefined) {
      byHost.set(row.hostname, [row]);
    } else {
      list.push(row);
    }
  }
  const hostNames = [...byHost.keys()].sort((a, b) => a.localeCompare(b));
  const lookup = stars === null ? null : starLookup(stars);

  const hosts = {
    count: hostNames.length,
    name: [] as string[],
    designations: [] as string[][],
    tier: [] as number[],
    index: [] as number[],
    x: [] as (number | null)[],
    y: [] as (number | null)[],
    z: [] as (number | null)[],
    vx: [] as (number | null)[],
    vy: [] as (number | null)[],
    vz: [] as (number | null)[],
    distancePc: [] as (number | null)[],
    radiusSun: [] as (number | null)[],
    radiusRef: [] as (number | null)[],
    massSun: [] as (number | null)[],
    massRef: [] as (number | null)[],
    teffK: [] as (number | null)[],
    spectralType: [] as (string | null)[],
    stars: [] as number[],
    firstPlanet: [] as number[],
    planetCount: [] as number[],
  } satisfies ExoplanetHosts;
  const planets = {
    count: rows.length,
    name: [] as string[],
    host: [] as number[],
    method: [] as string[],
    year: [] as (number | null)[],
    discoveryRef: [] as (number | null)[],
    controversial: [] as boolean[],
    transits: [] as boolean[],
    periodDays: [] as (number | null)[],
    orbitRef: [] as (number | null)[],
    semiMajorAxisAu: [] as (number | null)[],
    eccentricity: [] as (number | null)[],
    eccentricityLimit: [] as boolean[],
    omegaDeg: [] as (number | null)[],
    omegaRef: [] as (number | null)[],
    inclinationDeg: [] as (number | null)[],
    transitJd: [] as (number | null)[],
    transitRef: [] as (number | null)[],
    periastronJd: [] as (number | null)[],
    periastronRef: [] as (number | null)[],
    massEarth: [] as (number | null)[],
    massKind: [] as (string | null)[],
    massLimit: [] as number[],
    massRef: [] as (number | null)[],
    radiusEarth: [] as (number | null)[],
    radiusRef: [] as (number | null)[],
  } satisfies ExoplanetPlanets;

  let matchedByGaia = 0;
  let matchedByHip = 0;
  let placedFromArchive = 0;
  let unplaced = 0;
  let transitRadius = 0;
  let controversial = 0;
  const omegaCheck = { star: 0, planet: 0, neither: 0 };

  hostNames.forEach((hostname, h) => {
    const list = byHost.get(hostname)!.slice().sort(byPeriod);
    const first = list[0]!;
    hosts.name.push(hostname);
    hosts.designations.push(
      [first.gaiaDr3 === null ? null : `Gaia DR3 ${first.gaiaDr3}`, first.hip, first.hd].filter(
        (designation): designation is string => designation !== null && designation !== hostname,
      ),
    );
    const match = lookup === null ? null : matchHost(first, lookup);
    let state: number[] | null = null;
    if (match !== null && stars !== null) {
      const records = stars.tiers[match.tier]!.records;
      const base = match.index * STAR3D_RECORD_FLOATS;
      state = Array.from(records.subarray(base, base + 6));
      matchedByGaia += match.by === 'gaia' ? 1 : 0;
      matchedByHip += match.by === 'hip' ? 1 : 0;
    } else {
      const placed = archivePlacement(first);
      if (placed !== null) {
        state = [...placed.position, ...placed.velocity];
        placedFromArchive += 1;
      } else {
        unplaced += 1;
      }
    }
    hosts.tier.push(match?.tier ?? -1);
    hosts.index.push(match?.index ?? -1);
    // Nine significant figures: enough for a float32 record to come back float for float
    // (Math.fround of the number read is the record's), and far past the Archive's own.
    for (const [axis, column] of [hosts.x, hosts.y, hosts.z, hosts.vx, hosts.vy, hosts.vz].entries()) {
      column.push(state === null ? null : Number(state[axis]!.toPrecision(9)));
    }
    hosts.distancePc.push(first.distancePc);
    hosts.radiusSun.push(first.radiusSun);
    hosts.radiusRef.push(ref(first.radiusSunRef));
    hosts.massSun.push(first.massSun);
    hosts.massRef.push(ref(first.massSunRef));
    hosts.teffK.push(first.teffK);
    hosts.spectralType.push(first.spectralType);
    hosts.stars.push(first.stars);
    hosts.firstPlanet.push(planets.name.length);
    hosts.planetCount.push(list.length);

    for (const row of list) {
      planets.name.push(row.name);
      planets.host.push(h);
      planets.method.push(row.method);
      planets.year.push(row.year);
      planets.discoveryRef.push(ref(row.discoveryRef));
      planets.controversial.push(row.controversial);
      planets.transits.push(row.transits);
      planets.periodDays.push(row.periodDays);
      planets.orbitRef.push(ref(row.orbitRef));
      planets.semiMajorAxisAu.push(row.semiMajorAxisAu);
      planets.eccentricity.push(row.eccentricity);
      planets.eccentricityLimit.push(row.eccentricityLimit);
      planets.omegaDeg.push(row.omegaDeg);
      planets.omegaRef.push(ref(row.omegaRef));
      planets.inclinationDeg.push(row.inclinationDeg);
      planets.transitJd.push(row.transitJd);
      planets.transitRef.push(ref(row.transitRef));
      planets.periastronJd.push(row.periastronJd);
      planets.periastronRef.push(ref(row.periastronRef));
      planets.massEarth.push(row.massEarth);
      planets.massKind.push(row.massKind);
      planets.massLimit.push(row.massLimit);
      planets.massRef.push(ref(row.massRef));
      // A radius only where it was measured: the planet transits, and the value is a
      // paper's, not the Archive's estimate from the mass.
      const measured = row.transits && !row.radiusCalculated && row.radiusEarth !== null;
      planets.radiusEarth.push(measured ? row.radiusEarth : null);
      planets.radiusRef.push(measured ? ref(row.radiusRef) : null);
      transitRadius += measured ? 1 : 0;
      controversial += row.controversial ? 1 : 0;
      const convention = omegaConvention(row);
      if (convention !== null) {
        omegaCheck[convention] += 1;
      }
    }
  });

  return {
    source: { name: ARCHIVE_SERVICE.name, table: EXOPLANET_ARCHIVE_TABLE, via: ARCHIVE_SERVICE.url, queriedAt },
    stars3dQueriedAt: stars?.queriedAt ?? null,
    frame:
      stars?.frame ??
      'Heliocentric; ICRS rotated about its x axis by the IAU 1976 obliquity, 84381.448": the scene frame.',
    counts: {
      planets: rows.length,
      hosts: hostNames.length,
      matchedByGaia,
      matchedByHip,
      placedFromArchive,
      unplaced,
      transitRadius,
      controversial,
    },
    omegaCheck,
    references,
    hosts,
    planets,
  };
}

/** Log lines for a build. */
export function describeExoplanets(catalog: ExoplanetCatalog): string[] {
  const { counts, omegaCheck } = catalog;
  return [
    `[exoplanets] ${counts.planets} planets about ${counts.hosts} stars ` +
      `(${counts.controversial} flagged controversial, ${counts.transitRadius} with a transit radius)`,
    `[exoplanets] hosts among the 3D stars: ${counts.matchedByGaia} by Gaia DR3 id, ${counts.matchedByHip} by HIP; ` +
      `${counts.placedFromArchive} placed from the Archive, ${counts.unplaced} not placed (no distance)`,
    `[exoplanets] omega convention, where one paper's times can tell: star ${omegaCheck.star}, ` +
      `planet ${omegaCheck.planet}, neither ${omegaCheck.neither}`,
  ];
}
