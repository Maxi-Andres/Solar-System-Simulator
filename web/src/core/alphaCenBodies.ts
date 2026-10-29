import type { BodyId, Stars3dNames } from '@sss/tools/types';

import { abOrbitNormal } from './alphaCentauri.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { addStarBody, starBodyFacts } from './starBodies.ts';
import { stateToOsculatingElements } from './kepler.ts';
import {
  PROXIMA_PLANETS,
  planetBodyDefinition,
  planetStateAboutStar,
  proximaPlanetId,
} from './proximaPlanets.ts';
import { STAR3D, type StarNameIndex, type Stars3dSource } from './stars3d.ts';

/**
 * Alpha Centauri as a place to go (D3b): its three stars, found in the star names and
 * made bodies on demand, so the breadcrumb can list them and take the camera there the
 * way it lists the Solar System's planets. See BodyPicker.
 */

export type AlphaCenKey = 'A' | 'B' | 'Proxima';

/** The system's name in names.json's `system` column, and on the breadcrumb. */
export const ALPHA_CEN_SYSTEM = 'Alpha Centauri';

/**
 * The three in the order the breadcrumb lists them: the designation that tells each apart
 * in the star names, and the name names.json displays it by -- the IAU's (WGSN) for all
 * three, checked against the shipped file in alphaCenBodies.test.ts.
 */
export const ALPHA_CEN_MEMBERS: readonly {
  readonly key: AlphaCenKey;
  readonly designation: string;
  readonly name: string;
}[] = [
  { key: 'A', designation: 'alf Cen A', name: 'Rigil Kentaurus' },
  { key: 'B', designation: 'alf Cen B', name: 'Toliman' },
  { key: 'Proxima', designation: 'Proxima Cen', name: 'Proxima Centauri' },
];

/**
 * Where to stand when going to the system rather than to one star, km from A: 120 AU,
 * from where the pair's orbits -- 11 and 13 AU in semi-major axis about their barycentre,
 * 36 AU apart at the widest -- fill the middle of the frame.
 */
export const ALPHA_CEN_FRAMING_KM = 120 * 149_597_870.7;

/**
 * Where the system is looked at from: 20 degrees off the pair's orbital pole, so the two
 * orbits read as the ellipses they are -- from the Sun they are seen at 79 degrees, nearly
 * edge-on, two lines -- with up chosen square to it. A direction from the focus to the
 * camera and an up, as the store's framing request takes them.
 */
export function alphaCenView(): {
  readonly direction: readonly [number, number, number];
  readonly up: readonly [number, number, number];
} {
  const pole = abOrbitNormal();
  // Any direction not along the pole, made square to it: the in-plane axis to tilt toward.
  const seed = Math.abs(pole.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const along = seed.x * pole.x + seed.y * pole.y + seed.z * pole.z;
  const inPlaneRaw = { x: seed.x - along * pole.x, y: seed.y - along * pole.y, z: seed.z - along * pole.z };
  const n = Math.hypot(inPlaneRaw.x, inPlaneRaw.y, inPlaneRaw.z);
  const inPlane = { x: inPlaneRaw.x / n, y: inPlaneRaw.y / n, z: inPlaneRaw.z / n };
  const tilt = (20 * Math.PI) / 180;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return {
    direction: [pole.x * c - inPlane.x * s, pole.y * c - inPlane.y * s, pole.z * c - inPlane.z * s],
    up: [inPlane.x * c + pole.x * s, inPlane.y * c + pole.y * s, inPlane.z * c + pole.z * s],
  };
}

/** Each member's entry in the star names, by its designation; null where one is missing. */
export function alphaCenEntries(names: Stars3dNames): Record<AlphaCenKey, number> | null {
  const found: Partial<Record<AlphaCenKey, number>> = {};
  for (let k = 0; k < names.count; k += 1) {
    if (names.system[k] !== ALPHA_CEN_SYSTEM) {
      continue;
    }
    const designations = names.designations[k] ?? [];
    for (const member of ALPHA_CEN_MEMBERS) {
      if (designations.includes(member.designation) || names.display[k] === member.designation) {
        found[member.key] = k;
      }
    }
  }
  return found.A !== undefined && found.B !== undefined && found.Proxima !== undefined
    ? { A: found.A, B: found.B, Proxima: found.Proxima }
    : null;
}

/** Which member a body is, or null for any body not of Alpha Centauri. */
export function alphaCenMember(id: BodyId): AlphaCenKey | null {
  const facts = starBodyFacts(id);
  if (facts === null || facts.system !== ALPHA_CEN_SYSTEM) {
    return null;
  }
  for (const member of ALPHA_CEN_MEMBERS) {
    if (facts.designations.includes(member.designation)) {
      return member.key;
    }
  }
  return null;
}

/**
 * Makes Alpha Centauri's three stars bodies, pinned, and returns their ids: done once at
 * start (App.tsx), so they are named on the sky from anywhere, as the planets are, and can
 * be gone to by a click on the name as well as from the breadcrumb. Each is three small
 * reads from its tier file; the tiers themselves need not be in.
 */
export async function ensureAlphaCenBodies(
  store: EphemerisStore,
  stars3d: Stars3dSource,
  names: StarNameIndex,
  keep: BodyId,
): Promise<Record<AlphaCenKey, BodyId> | null> {
  const entries = alphaCenEntries(names.names);
  if (entries === null) {
    return null;
  }
  const ids: Partial<Record<AlphaCenKey, BodyId>> = {};
  for (const member of ALPHA_CEN_MEMBERS) {
    ids[member.key] = await addStarBody(store, stars3d, names, entries[member.key], keep, true);
  }
  addProximaPlanets(store, ids.Proxima!);
  return ids as Record<AlphaCenKey, BodyId>;
}

/**
 * Proxima's planets as bodies about it (proximaPlanets.ts): their states about Proxima, so
 * the frame tree carries them with it, and their orbits drawn about it with its measured
 * mass. The line of sight they are drawn edge-on to is fixed at J2000 -- Proxima's
 * direction moves 3.9 arcseconds a year, nothing to an orbit's tilt.
 */
function addProximaPlanets(store: EphemerisStore, proxima: BodyId): void {
  const record = starBodyFacts(proxima)?.record;
  if (record === undefined) {
    return;
  }
  const x = record[STAR3D.x]!;
  const y = record[STAR3D.y]!;
  const z = record[STAR3D.z]!;
  const length = Math.hypot(x, y, z);
  const toward = { x: x / length, y: y / length, z: z / length };
  const gmStar = store.body(proxima).gmBodyOnlyKm3S2;
  store.addPropagatedBodies(
    PROXIMA_PLANETS.map((planet) => ({
      body: planetBodyDefinition(planet, proxima),
      // Elements too, which is what the orbit line is first drawn from; it is redrawn
      // from the state as the planet moves (SolarSystem.tsx).
      elements: stateToOsculatingElements(
        planetStateAboutStar(planet, planet.epochJd, toward),
        gmStar + planet.minimumMassEarth * 398_600.4,
        planet.epochJd,
        proximaPlanetId(planet.key),
        proxima,
      ),
      state: (jd: number) => planetStateAboutStar(planet, jd, toward),
      // As published, not a fallback from something better: the conventions are stated.
      options: { aboutParent: true, exact: true },
    })),
  );
}
