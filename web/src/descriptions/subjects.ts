/**
 * The ids of the descriptions of what is no body (Description.subject): the Milky Way, which is
 * seen only from inside, and the cosmic microwave background, the wall of the observable
 * universe. Opened by the breadcrumb's lists (BodyPicker.tsx), never by a focus.
 */
export const MILKY_WAY_DESCRIPTION_ID = 'milky-way';
export const CMB_DESCRIPTION_ID = 'cosmic-microwave-background';

/**
 * The breadcrumb's other levels (state/levels.ts), each offered by its panel (LevelFacts.tsx)
 * once its description is written: reserved here so the pages, when they come, need only use
 * them. Until the Observable Universe's exists, its panel offers the CMB's.
 */
export const SOLAR_SYSTEM_DESCRIPTION_ID = 'solar-system';
export const SOLAR_NEIGHBOURHOOD_DESCRIPTION_ID = 'solar-neighbourhood';
export const LOCAL_GROUP_DESCRIPTION_ID = 'local-group';
export const LOCAL_VOLUME_DESCRIPTION_ID = 'local-volume';
export const VIRGO_CLUSTER_DESCRIPTION_ID = 'virgo-cluster';
export const NEARBY_UNIVERSE_DESCRIPTION_ID = 'nearby-universe';
export const OBSERVABLE_UNIVERSE_DESCRIPTION_ID = 'observable-universe';

/**
 * Alpha Centauri as a whole, its three stars together: no body, for its stars are three. Offered
 * by its level's panel (state/levels.ts), the breadcrumb's Alpha Centauri list and its search result.
 */
export const ALPHA_CEN_SYSTEM_DESCRIPTION_ID = 'alpha-centauri';

/** Tau Ceti as a system, its star with its planets and its disc: offered as Alpha Centauri's is. */
export const TAU_CETI_SYSTEM_DESCRIPTION_ID = 'tau-ceti';

/**
 * The planetary systems' descriptions, by system key (core/planetarySystems.ts): offered by the
 * planetary-system level's panel and the system's search result. A system not here has none.
 */
export const PLANETARY_SYSTEM_DESCRIPTION_IDS: Readonly<Record<string, string>> = {
  'tau-ceti': TAU_CETI_SYSTEM_DESCRIPTION_ID,
};

/**
 * Laniakea's is a body's -- the structure "Laniakea Supercluster" (laniakea.ts), its level's
 * centre -- and is offered by its level's panel too.
 */
export const LANIAKEA_DESCRIPTION_ID = 'structure-laniakea-supercluster';
