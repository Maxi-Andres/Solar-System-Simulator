import type { BodyId, Stars3dNames } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import { stateToOsculatingElements } from './kepler.ts';
import {
  GM_EARTH,
  orbitPole,
  planetBodyDefinition,
  planetStateAboutStar,
  viewOffPole,
  type ExoPlanet,
} from './exoplanets.ts';
import { proximaPlanetOf } from './proximaPlanets.ts';
import { addStarBody, starBodyFacts } from './starBodies.ts';
import { STAR3D, type StarNameIndex, type Stars3dSource } from './stars3d.ts';
import { J2000_JD } from './time.ts';
import type { Vec3 } from './vec3.ts';

/**
 * Nearby stars with planets, as places to go (D4a): Tau Ceti, Epsilon Eridani, Barnard's
 * Star and 51 Pegasi -- each star a body from the start, named on the sky, its planets on
 * their fitted orbits about it (exoplanets.ts), and the system on the breadcrumb.
 *
 * Every planet below was checked against the NASA Exoplanet Archive (queried 2026-10-29)
 * for whether it is counted confirmed, and its numbers read from the paper itself. All the
 * Archive lists for these four stars is here. None of them passes in front of its star, so
 * none has a measured radius: the radii the Archive shows for them are its estimates from
 * the mass, and each is drawn as a marker.
 *
 * Each star is a disc of its measured radius -- interferometry, the star's angular size
 * times its distance -- as Alpha Centauri's are: Tau Ceti 0.793 +- 0.004 Rsun (Teixeira
 * et al. 2009, A&A 494, 237, from Di Folco et al. 2004's VLTI diameter); Epsilon Eridani
 * 0.74 +- 0.01 (Baines & Armstrong 2012, ApJ 744, 138, Navy Optical Interferometer);
 * Barnard's Star 0.1869 +- 0.0012 (Boyajian et al. 2012, ApJ 757, 112, CHARA); 51 Pegasi
 * 1.150 +- 0.020 (Boyajian et al. 2013, ApJ 771, 40, CHARA).
 *
 * ## Tau Ceti -- Feng et al. 2017, AJ 154, 135, Table 4 (MAP, C1AP1 data set)
 *
 * Four signals in HARPS radial velocities of 0.35 to 0.55 m/s, among the smallest ever
 * claimed. g, h and f are in the Archive with its controversy flag set; e is not in it at
 * all. g, h and f are drawn as disputed, e as a candidate -- all four grey. Periods,
 * distances, eccentricities and arguments of periastron are the table's; the minimum
 * masses take tau Ceti's 0.783 Msun (Teixeira et al. 2009), as the paper does. The table
 * gives each one's mean anomaly but not the epoch it holds at, so **where each is along its
 * orbit is not known**: the stand-in is periastron at J2000.
 *
 * ## Epsilon Eridani b -- Thompson et al. 2025, AJ 170, 301 (arXiv 2502.20561)
 *
 * The one planet here whose orbit is oriented on the sky by measurement: their full model
 * (RV, Hipparcos, HST FGS, Gaia DR2 and DR3; Table 3, 68% intervals) gives i = 40 +6/-5,
 * node 186 +8/-9, a 3.53 AU, P 7.33 yr, e 0.06 +0.06/-0.04 -- drawn circular, the paper's
 * own "near-circular" -- and a mass of 1.00 +- 0.10 Jupiter masses, a mass and not a
 * minimum. Their periastron time and argument of periastron are each so loosely bound
 * that the medians together would not place the planet; its phase is the RV fit's
 * inferior conjunction instead, BJD 2,457,405 (Harada et al. 2025, AJ 170, 343; NASA
 * Archive). It agrees with Thompson et al.'s prediction for 2025-01-01, the planet SSW of
 * the star near its widest: planetarySystems.test.ts.
 *
 * ## Barnard's Star -- Basant et al. 2025, ApJL 982, L1 (arXiv 2503.08095), Table 2
 *
 * Four planets of 0.19 to 0.34 Earth masses at least, b found by González Hernández et
 * al. 2024 and c, d and e confirmed by Basant et al. with MAROON-X and ESPRESSO. All four
 * confirmed in the Archive. Drawn circular: their eccentricities are all consistent with
 * zero, and stability favours under 0.02. The paper calls t0 a periastron time, but its
 * fit (juliet) takes t0 as the time of inferior conjunction, and a periastron could not
 * be pinned to a tenth of a day with omega free across +-120 degrees: it is read as the
 * conjunction. Star 0.162 Msun, the Archive's for this solution.
 *
 * ## 51 Pegasi b -- Cont et al. 2026, A&A 710, A345 (NASA Archive default)
 *
 * The first planet found about a Sun-like star (Mayor & Queloz 1995). Its own light,
 * Doppler-shifted, gives its orbital speed and so its tilt: i = 49.8 degrees (or 130.2:
 * the speed gives sin i alone, and which way it runs is a choice) and a mass of 193.9
 * Earth masses. P 4.2307966 d, a 0.052 AU, e 0.0063 (drawn circular), inferior
 * conjunction BJD 2,456,326.9323, star 1.07 Msun. The node is unknown: east-west.
 */

export interface PlanetarySystem {
  readonly key: string;
  /** On the breadcrumb, and on the sky from afar. */
  readonly name: string;
  /** A designation names.json lists for the star, to find it by. */
  readonly hostDesignation: string;
  /** The star's mass, solar masses, for the orbits' speeds; and whose. */
  readonly hostMassSun: number;
  readonly hostMassReference: string;
  /** The star's measured radius, solar radii, and whose (see the header). */
  readonly hostRadiusSun: number;
  readonly hostRadiusReference: string;
  readonly planets: readonly ExoPlanet[];
}

const TAU_CETI: PlanetarySystem = {
  key: 'tau-ceti',
  name: 'Tau Ceti',
  hostDesignation: 'tau Cet',
  hostMassSun: 0.783,
  hostMassReference: 'Teixeira et al. 2009, A&A 494, 237',
  hostRadiusSun: 0.793,
  hostRadiusReference: 'Teixeira et al. 2009, A&A 494, 237',
  planets: (
    [
      ['g', 'disputed', 20.0, 0.133, 0.06, 6.9, 1.75],
      ['h', 'disputed', 49.41, 0.243, 0.23, 0.13, 1.83],
      ['e', 'candidate', 162.87, 0.538, 0.18, 0.39, 3.93],
      ['f', 'disputed', 636.13, 1.334, 0.16, 2.09, 3.93],
    ] as const
  ).map(([letter, status, periodDays, semiMajorAxisAu, eccentricity, omegaRad, massEarth]): ExoPlanet => ({
    id: `tau-ceti-${letter}`,
    name: `Tau Ceti ${letter} (${status})`,
    status,
    periodDays,
    semiMajorAxisAu,
    eccentricity,
    argPeriastronDeg: (omegaRad * 180) / Math.PI,
    massEarth,
    massIsMinimum: true,
    phase: { kind: 'unknown' },
    inclinationDeg: null,
    nodeDeg: null,
    reference: 'Feng et al. 2017, AJ 154, 135',
  })),
};

const EPSILON_ERIDANI: PlanetarySystem = {
  key: 'epsilon-eridani',
  name: 'Epsilon Eridani',
  hostDesignation: 'eps Eri',
  hostMassSun: 0.82,
  hostMassReference: 'Thompson et al. 2025, AJ 170, 301',
  hostRadiusSun: 0.74,
  hostRadiusReference: 'Baines & Armstrong 2012, ApJ 744, 138',
  planets: [
    {
      id: 'epsilon-eridani-b',
      name: 'Epsilon Eridani b',
      status: 'confirmed',
      periodDays: 7.33 * 365.25,
      semiMajorAxisAu: 3.53,
      eccentricity: 0,
      argPeriastronDeg: 0,
      // 1.00 Jupiter masses, in Earth's: 317.83.
      massEarth: 317.83,
      massIsMinimum: false,
      phase: { kind: 'conjunction', jd: 2457405 },
      inclinationDeg: 40,
      nodeDeg: 186,
      reference: 'Thompson et al. 2025, AJ 170, 301; conjunction from Harada et al. 2025, AJ 170, 343',
    },
  ],
};

const BARNARD: PlanetarySystem = {
  key: 'barnards-star',
  name: "Barnard's Star",
  hostDesignation: 'GJ 699',
  hostMassSun: 0.162,
  hostMassReference: 'NASA Exoplanet Archive, for Basant et al. 2025',
  hostRadiusSun: 0.1869,
  hostRadiusReference: 'Boyajian et al. 2012, ApJ 757, 112',
  planets: (
    [
      ['d', 2.3402, 0.0188, 0.263, 2460243.7],
      ['b', 3.1542, 0.0229, 0.299, 2460243.38],
      ['c', 4.1244, 0.0274, 0.335, 2460242.92],
      ['e', 6.7392, 0.0381, 0.193, 2460245.3],
    ] as const
  ).map(([letter, periodDays, semiMajorAxisAu, massEarth, conjunction]): ExoPlanet => ({
    id: `barnards-star-${letter}`,
    name: `Barnard's Star ${letter}`,
    status: 'confirmed',
    periodDays,
    semiMajorAxisAu,
    eccentricity: 0,
    argPeriastronDeg: 0,
    massEarth,
    massIsMinimum: true,
    phase: { kind: 'conjunction', jd: conjunction },
    inclinationDeg: null,
    nodeDeg: null,
    reference:
      letter === 'b'
        ? 'González Hernández et al. 2024, A&A 690, A79; Basant et al. 2025, ApJL 982, L1'
        : 'Basant et al. 2025, ApJL 982, L1',
  })),
};

const PEGASI_51: PlanetarySystem = {
  key: '51-pegasi',
  name: '51 Pegasi',
  hostDesignation: '51 Peg',
  hostMassSun: 1.07,
  hostMassReference: 'Cont et al. 2026, A&A 710, A345',
  hostRadiusSun: 1.15,
  hostRadiusReference: 'Boyajian et al. 2013, ApJ 771, 40',
  planets: [
    {
      id: '51-pegasi-b',
      name: '51 Pegasi b',
      status: 'confirmed',
      periodDays: 4.2307966,
      semiMajorAxisAu: 0.052,
      eccentricity: 0,
      argPeriastronDeg: 0,
      massEarth: 193.9,
      massIsMinimum: false,
      phase: { kind: 'conjunction', jd: 2456326.9323 },
      inclinationDeg: 49.8,
      nodeDeg: null,
      reference: 'Mayor & Queloz 1995, Nature 378, 355; Cont et al. 2026, A&A 710, A345',
    },
  ],
};

export const PLANETARY_SYSTEMS: readonly PlanetarySystem[] = [TAU_CETI, EPSILON_ERIDANI, BARNARD, PEGASI_51];

/** A planet of these systems by its body id, with its system; null for any other body. */
export function systemPlanetOf(id: BodyId): { system: PlanetarySystem; planet: ExoPlanet } | null {
  for (const system of PLANETARY_SYSTEMS) {
    const planet = system.planets.find((candidate) => candidate.id === id);
    if (planet !== undefined) {
      return { system, planet };
    }
  }
  return null;
}

/** Any star's planet by its body id -- Proxima's or these systems' -- or null. */
export function exoPlanetOf(id: BodyId): ExoPlanet | null {
  return proximaPlanetOf(id) ?? systemPlanetOf(id)?.planet ?? null;
}

/** The system whose star a set of designations names, or null. */
export function systemOfDesignations(designations: readonly string[]): PlanetarySystem | null {
  return PLANETARY_SYSTEMS.find((system) => designations.includes(system.hostDesignation)) ?? null;
}

/** The system a body is in -- its star, or a planet of it -- or null. */
export function planetarySystemOf(id: BodyId): PlanetarySystem | null {
  const facts = starBodyFacts(id);
  if (facts !== null) {
    return systemOfDesignations(facts.designations);
  }
  return systemPlanetOf(id)?.system ?? null;
}

/** Each system's star's entry in the star names, by system key; missing where not found. */
export function systemEntries(names: Stars3dNames): Map<string, number> {
  const found = new Map<string, number>();
  for (let k = 0; k < names.count; k += 1) {
    const system = systemOfDesignations(names.designations[k] ?? []);
    if (system !== null) {
      found.set(system.key, k);
    }
  }
  return found;
}

const AU_KM = 149_597_870.7;

/** How far out a system reaches, km: its outermost planet's farthest. */
export function systemExtentKm(system: PlanetarySystem): number {
  return Math.max(...system.planets.map((p) => p.semiMajorAxisAu * (1 + p.eccentricity))) * AU_KM;
}

/** Where to stand when going to a system, km from its star: its whole extent in view. */
export function systemFramingKm(system: PlanetarySystem): number {
  return 5 * systemExtentKm(system);
}

/** The unit direction from the Sun to a star body, from its catalogue position. */
function towardStar(id: BodyId): Vec3 | null {
  const record = starBodyFacts(id)?.record;
  if (record === undefined) {
    return null;
  }
  const x = record[STAR3D.x]!;
  const y = record[STAR3D.y]!;
  const z = record[STAR3D.z]!;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

/**
 * Where a system is looked at from: 30 degrees off its outermost planet's orbital pole,
 * so the orbits read as the ellipses they are -- drawn edge-on to the Sun, from the Sun
 * they are lines.
 */
export function systemView(
  system: PlanetarySystem,
  host: BodyId,
): ReturnType<typeof viewOffPole> | undefined {
  const toward = towardStar(host);
  if (toward === null) {
    return undefined;
  }
  const outermost = system.planets.reduce((a, b) => (b.semiMajorAxisAu > a.semiMajorAxisAu ? b : a));
  return viewOffPole(orbitPole(outermost, toward, J2000_JD), 30);
}

/**
 * A star's planets as bodies about it: their states about the star, so the frame tree
 * carries them with it, and their orbits drawn about it with its mass. Shared with
 * Proxima's (alphaCenBodies.ts).
 */
export function addPlanets(store: EphemerisStore, host: BodyId, planets: readonly ExoPlanet[]): void {
  const toward = towardStar(host);
  if (toward === null) {
    return;
  }
  const gmStar = store.body(host).gmBodyOnlyKm3S2;
  store.addPropagatedBodies(
    planets
      .filter((planet) => !store.isPropagatedBody(planet.id))
      .map((planet) => ({
        body: planetBodyDefinition(planet, host),
        // Elements too, which is what the orbit line is first drawn from; it is redrawn
        // from the state as the planet moves (SolarSystem.tsx).
        elements: stateToOsculatingElements(
          planetStateAboutStar(planet, J2000_JD, toward),
          gmStar + planet.massEarth * GM_EARTH,
          J2000_JD,
          planet.id,
          host,
        ),
        state: (jd: number) => planetStateAboutStar(planet, jd, toward),
        // As published, not a fallback from something better: the conventions are stated.
        options: { aboutParent: true, exact: true },
      })),
  );
}

/**
 * Makes each system's star a body, pinned, with its planets: done once at start (App.tsx),
 * so they are named on the sky and can be gone to from it and from the breadcrumb.
 * Returns each system's star's id by system key.
 */
export async function ensurePlanetarySystems(
  store: EphemerisStore,
  stars3d: Stars3dSource,
  names: StarNameIndex,
  keep: BodyId,
): Promise<Map<string, BodyId>> {
  const entries = systemEntries(names.names);
  const hosts = new Map<string, BodyId>();
  for (const system of PLANETARY_SYSTEMS) {
    const k = entries.get(system.key);
    if (k === undefined) {
      continue;
    }
    const host = await addStarBody(store, stars3d, names, k, keep, true, system.hostMassSun, system.hostRadiusSun);
    hosts.set(system.key, host);
    addPlanets(store, host, system.planets);
  }
  return hosts;
}
