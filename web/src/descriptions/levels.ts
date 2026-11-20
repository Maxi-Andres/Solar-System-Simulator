import { LOCAL_GROUP } from './localGroup.ts';
import { LOCAL_VOLUME } from './localVolume.ts';
import { NEARBY_UNIVERSE } from './nearbyUniverse.ts';
import { OBSERVABLE_UNIVERSE } from './observableUniverse.ts';
import { SOLAR_NEIGHBOURHOOD } from './solarNeighbourhood.ts';
import { SOLAR_SYSTEM } from './solarSystem.ts';
import type { Description } from './types.ts';
import { VIRGO_CLUSTER } from './virgoCluster.ts';

/**
 * The breadcrumb's levels with descriptions of their own (state/levels.ts): what is no body, each
 * offered by its level's panel (ui/LevelFacts.tsx), inner to outer. The Milky Way's and
 * Laniakea's are with the far objects' (index.ts FAR).
 */
export const LEVEL_DESCRIPTIONS: readonly Description[] = [SOLAR_SYSTEM, SOLAR_NEIGHBOURHOOD, LOCAL_GROUP, LOCAL_VOLUME, VIRGO_CLUSTER, NEARBY_UNIVERSE, OBSERVABLE_UNIVERSE];
