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
import {
  GALAXY_FRAMING_KM,
  LOCAL_GROUP_FRAMING_KM,
  LOCAL_VOLUME_FRAMING_KM,
  NEARBY_UNIVERSE_FRAMING_KM,
  NEIGHBOURHOOD_FRAMING_KM,
  OBSERVABLE_UNIVERSE_FRAMING_KM,
  SOLAR_SYSTEM_FRAMING_KM,
} from '../scene/scale.ts';

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

/**
 * The levels centred on the Sun, nearest first, each with the distance its crumb frames it from
 * (scene/scale.ts) -- and before them the Sun itself, null, at the eight radii a body is framed
 * from. Zooming out from the Sun walks up this list and zooming in walks back down (Maxi,
 * 2026-11-20: "si hago zoom o deszoom debería aparecer y desaparecer el camino"), so the
 * breadcrumb grows and shrinks with the view as it does with a crumb clicked.
 */
export const SUN_LADDER: readonly { readonly level: LevelId | null; readonly km: number }[] = [
  { level: null, km: 8 * 695_700 },
  { level: 'solar-system', km: SOLAR_SYSTEM_FRAMING_KM },
  { level: 'solar-neighbourhood', km: NEIGHBOURHOOD_FRAMING_KM },
  { level: 'milky-way', km: GALAXY_FRAMING_KM },
  { level: 'local-group', km: LOCAL_GROUP_FRAMING_KM },
  { level: 'local-volume', km: LOCAL_VOLUME_FRAMING_KM },
  { level: 'nearby-universe', km: NEARBY_UNIVERSE_FRAMING_KM },
  { level: 'observable-universe', km: OBSERVABLE_UNIVERSE_FRAMING_KM },
];

/** How far past the boundary between two rungs the view must go before the level changes. */
export const LADDER_HYSTERESIS = 1.25;

/**
 * The Sun-centred level for the camera `cameraFromSunKm` from the Sun, given the one selected
 * now: the rung whose framing is nearest in the logarithm, the boundary between two rungs at
 * their geometric mean, and the current rung kept until the view is LADDER_HYSTERESIS past it,
 * so a camera resting near a boundary does not flicker the breadcrumb.
 */
export function levelForDistance(current: LevelId | null, cameraFromSunKm: number): LevelId | null {
  const d = Math.max(cameraFromSunKm, 1);
  let index = 0;
  for (let k = 1; k < SUN_LADDER.length; k += 1) {
    if (d >= Math.sqrt(SUN_LADDER[k - 1]!.km * SUN_LADDER[k]!.km)) index = k;
  }
  const at = SUN_LADDER.findIndex((rung) => rung.level === current);
  if (at >= 0 && Math.abs(at - index) === 1) {
    const boundary = Math.sqrt(SUN_LADDER[Math.min(at, index)]!.km * SUN_LADDER[Math.max(at, index)]!.km);
    const past = index > at ? d / boundary : boundary / d;
    if (past < LADDER_HYSTERESIS) return current;
  }
  return SUN_LADDER[index]!.level;
}
