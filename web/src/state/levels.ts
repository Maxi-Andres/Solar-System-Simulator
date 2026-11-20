import type { BodyId } from '@sss/tools/types';

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
} from '../descriptions/subjects.ts';

/**
 * The breadcrumb's levels, as things that can be selected (Maxi, 2026-11-20: "toqué Milky Way
 * pero me pone read about the Sun"). A level crumb clicked is what is selected -- its panel
 * the info panel's, its description the one offered -- while the focus, what the camera orbits,
 * is its centre: the Sun for most, M87 for the Virgo Cluster, the attractor for Laniakea. Any
 * body chosen afterwards, however, clears it (store.ts setFocus).
 */
export type LevelId =
  | 'solar-system'
  | 'solar-neighbourhood'
  | 'milky-way'
  | 'local-group'
  | 'local-volume'
  | 'virgo-cluster'
  | 'laniakea'
  | 'nearby-universe'
  | 'observable-universe';

export interface Level {
  readonly id: LevelId;
  /** As the breadcrumb writes it, and the panel's title. */
  readonly name: string;
  /** What kind of thing it is, the panel's kind line. */
  readonly kind: string;
  /**
   * Which crumb it is, outermost first: what is below the selected one is not shown. Laniakea and
   * the Nearby Universe are the same crumb, as the Local Volume and the Virgo Cluster are.
   */
  readonly tier: number;
  /**
   * The descriptions to offer, in order of preference, each with the name the button says: the
   * first that exists is offered (LevelFacts.tsx levelReading). The Observable Universe's falls
   * back to the CMB's until its own is written.
   */
  readonly readAbout: readonly { readonly id: BodyId; readonly name: string }[];
}

export const LEVELS: Readonly<Record<LevelId, Level>> = {
  'observable-universe': {
    id: 'observable-universe',
    name: 'Observable Universe',
    kind: 'the observable universe',
    tier: 0,
    readAbout: [
      { id: OBSERVABLE_UNIVERSE_DESCRIPTION_ID, name: 'observable universe' },
      { id: CMB_DESCRIPTION_ID, name: 'cosmic microwave background' },
    ],
  },
  laniakea: {
    id: 'laniakea',
    name: 'Laniakea',
    kind: 'supercluster',
    tier: 1,
    readAbout: [{ id: LANIAKEA_DESCRIPTION_ID, name: 'Laniakea Supercluster' }],
  },
  'nearby-universe': {
    id: 'nearby-universe',
    name: 'Nearby Universe',
    kind: 'the mapped galaxies',
    tier: 1,
    readAbout: [{ id: NEARBY_UNIVERSE_DESCRIPTION_ID, name: 'Nearby Universe' }],
  },
  'local-volume': {
    id: 'local-volume',
    name: 'Local Volume',
    kind: 'galaxies about the Local Group',
    tier: 2,
    readAbout: [{ id: LOCAL_VOLUME_DESCRIPTION_ID, name: 'Local Volume' }],
  },
  'virgo-cluster': {
    id: 'virgo-cluster',
    name: 'Virgo Cluster',
    kind: 'cluster of galaxies',
    tier: 2,
    readAbout: [{ id: VIRGO_CLUSTER_DESCRIPTION_ID, name: 'Virgo Cluster' }],
  },
  'local-group': {
    id: 'local-group',
    name: 'Local Group',
    kind: 'group of galaxies',
    tier: 3,
    readAbout: [{ id: LOCAL_GROUP_DESCRIPTION_ID, name: 'Local Group' }],
  },
  'milky-way': {
    id: 'milky-way',
    name: 'Milky Way',
    kind: 'galaxy',
    tier: 4,
    readAbout: [{ id: MILKY_WAY_DESCRIPTION_ID, name: 'Milky Way' }],
  },
  'solar-neighbourhood': {
    id: 'solar-neighbourhood',
    name: 'Solar Neighbourhood',
    kind: 'region of the galaxy',
    tier: 5,
    readAbout: [{ id: SOLAR_NEIGHBOURHOOD_DESCRIPTION_ID, name: 'Solar Neighbourhood' }],
  },
  'solar-system': {
    id: 'solar-system',
    name: 'Solar System',
    kind: 'planetary system',
    tier: 6,
    readAbout: [{ id: SOLAR_SYSTEM_DESCRIPTION_ID, name: 'Solar System' }],
  },
};

/**
 * Whether the crumb of `tier` is shown with `selected` the selected level: those above it and its
 * own, nothing below -- the selected level is where the breadcrumb ends, as the focus is otherwise.
 */
export function crumbShown(tier: number, selected: LevelId | null): boolean {
  return selected === null || tier <= LEVELS[selected].tier;
}
