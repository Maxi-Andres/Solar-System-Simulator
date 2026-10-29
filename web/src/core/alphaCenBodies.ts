import type { BodyId, Stars3dNames } from '@sss/tools/types';

import { abOrbitNormal } from './alphaCentauri.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { viewOffPole } from './exoplanets.ts';
import { addPlanets } from './planetarySystems.ts';
import { PROXIMA_PLANETS } from './proximaPlanets.ts';
import { addStarBody, starBodyFacts } from './starBodies.ts';
import type { StarNameIndex, Stars3dSource } from './stars3d.ts';

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
export function alphaCenView(): ReturnType<typeof viewOffPole> {
  return viewOffPole(abOrbitNormal(), 20);
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
  // Proxima's planets (proximaPlanets.ts), as any star's (planetarySystems.ts).
  addPlanets(store, ids.Proxima!, PROXIMA_PLANETS);
  return ids as Record<AlphaCenKey, BodyId>;
}
