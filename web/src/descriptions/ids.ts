import type { BodyId } from '@sss/tools/types';

import { SGR_A_ID } from '../core/blackHoles.ts';
import { starBodyFacts } from '../core/starBodies.ts';
import {
  CMB_DESCRIPTION_ID,
  LANIAKEA_DESCRIPTION_ID,
  LOCAL_GROUP_DESCRIPTION_ID,
  LOCAL_VOLUME_DESCRIPTION_ID,
  MILKY_WAY_DESCRIPTION_ID,
  NEARBY_UNIVERSE_DESCRIPTION_ID,
  OBSERVABLE_UNIVERSE_DESCRIPTION_ID,
  SOLAR_NEIGHBOURHOOD_DESCRIPTION_ID,
  SOLAR_SYSTEM_DESCRIPTION_ID,
  VIRGO_CLUSTER_DESCRIPTION_ID,
} from './subjects.ts';

/**
 * Which ids have a description, without the descriptions: the panels only need to know whether
 * to offer "Read about", and the pages themselves (index.ts, a megabyte of prose) load with the
 * page that shows them (DescriptionView.tsx, its own chunk). Kept equal to index.ts's
 * DESCRIPTIONS by descriptions.test.ts, so a new page cannot be left out of here.
 */
export const DESCRIBED_IDS: ReadonlySet<BodyId> = new Set<BodyId>([
  // The Sun, the planets and their described moons.
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'io', 'europa', 'ganymede', 'callisto',
  'saturn', 'enceladus', 'titan', 'uranus', 'neptune', 'triton',
  // The dwarf planets, and Charon.
  'ceres', 'pluto', 'charon', 'haumea', 'makemake', 'eris',
  // Spacecraft and Earth satellites (satelliteBodies.ts namedSatelliteBodyId: `sat-<id>`).
  'voyager-1', 'voyager-2', 'new-horizons', 'parker-solar-probe', 'jwst', 'sat-hubble', 'roman', 'sat-iss',
  // Beyond the Solar System, and what is no body.
  MILKY_WAY_DESCRIPTION_ID, 'galaxy-m31', 'galaxy-lmc', 'galaxy-smc', 'nebula-orion', 'snr-crab', LANIAKEA_DESCRIPTION_ID, CMB_DESCRIPTION_ID,
  // The breadcrumb's levels.
  SOLAR_SYSTEM_DESCRIPTION_ID, SOLAR_NEIGHBOURHOOD_DESCRIPTION_ID, LOCAL_GROUP_DESCRIPTION_ID, LOCAL_VOLUME_DESCRIPTION_ID,
  VIRGO_CLUSTER_DESCRIPTION_ID, NEARBY_UNIVERSE_DESCRIPTION_ID, OBSERVABLE_UNIVERSE_DESCRIPTION_ID,
  // The stars, and Sgr A*.
  'alpha-centauri-a', 'alpha-centauri-b', 'proxima-centauri', 'sirius', 'sirius-b', 'betelgeuse', 'polaris', SGR_A_ID,
  // Landing sites, and the craft standing on Mars.
  'site-viking-1', 'site-viking-2', 'site-mars-pathfinder', 'site-spirit', 'site-opportunity', 'site-phoenix', 'site-tianwen-1',
  'curiosity', 'perseverance', 'insight',
  'site-surveyor-1', 'site-apollo-11', 'site-apollo-12', 'site-lunokhod-1', 'site-apollo-14', 'site-apollo-15', 'site-apollo-16',
  'site-apollo-17', 'site-lunokhod-2', 'site-change-3', 'site-change-4', 'site-change-5', 'site-chandrayaan-3', 'site-slim',
  'site-change-6', 'site-blue-ghost-1',
]);

/**
 * The described catalogue stars' designations (Description.catalogueStar), by description id: a
 * catalogue star made a body has a run-time id (`star-<tier>-<index>`, core/starBodies.ts), so it
 * is found by any of the names it carries.
 */
export const CATALOGUE_STAR_DESIGNATIONS: ReadonlyMap<BodyId, readonly string[]> = new Map<BodyId, readonly string[]>([
  ['alpha-centauri-a', ['HIP 71683', 'alf Cen A']],
  ['alpha-centauri-b', ['HIP 71681', 'alf Cen B']],
  ['proxima-centauri', ['HIP 70890', 'Proxima Cen', 'alf Cen C']],
  ['sirius', ['HIP 32349', 'alf CMa A']],
  ['sirius-b', ['alf CMa B', 'GJ 244 B']],
  ['betelgeuse', ['HIP 27989']],
  ['polaris', ['HIP 11767']],
]);

/** The described catalogue star known by any of `designations` ("HIP 27989", "alf CMa B"), or null. */
export function describedStarId(designations: readonly string[]): BodyId | null {
  for (const [id, names] of CATALOGUE_STAR_DESIGNATIONS) {
    if (names.some((name) => designations.includes(name))) return id;
  }
  return null;
}

/**
 * The id of `id`'s description, if it has one: its own, or, for a catalogue star made a body,
 * the described star its designations name.
 */
export function describedId(id: BodyId): BodyId | null {
  if (DESCRIBED_IDS.has(id)) return id;
  const designations = starBodyFacts(id)?.designations;
  return designations === undefined ? null : describedStarId(designations);
}

/** Whether `id` has a description: what a panel asks before offering "Read about". */
export function hasDescription(id: BodyId): boolean {
  return describedId(id) !== null;
}
