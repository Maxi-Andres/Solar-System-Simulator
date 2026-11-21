import type { BodyId } from '@sss/tools/types';

import { CALLISTO } from './callisto.ts';
import { EARTH } from './earth.ts';
import { ENCELADUS } from './enceladus.ts';
import { EUROPA } from './europa.ts';
import { GANYMEDE } from './ganymede.ts';
import { IO } from './io.ts';
import { TITAN } from './titan.ts';
import { TRITON } from './triton.ts';
import { JUPITER } from './jupiter.ts';
import { MARS } from './mars.ts';
import { MERCURY } from './mercury.ts';
import { MOON } from './moon.ts';
import { NEPTUNE } from './neptune.ts';
import { SATURN } from './saturn.ts';
import { SUN } from './sun.ts';
import { URANUS } from './uranus.ts';
import { VENUS } from './venus.ts';
import { HUBBLE } from './hubble.ts';
import { ISS } from './iss.ts';
import { JWST } from './jwst.ts';
import { NEW_HORIZONS } from './newHorizons.ts';
import { PARKER_SOLAR_PROBE } from './parkerSolarProbe.ts';
import { ROMAN } from './roman.ts';
import { VOYAGER_1 } from './voyager1.ts';
import { VOYAGER_2 } from './voyager2.ts';
import { CERES } from './ceres.ts';
import { CHARON } from './charon.ts';
import { ERIS } from './eris.ts';
import { HAUMEA } from './haumea.ts';
import { MAKEMAKE } from './makemake.ts';
import { PLUTO } from './pluto.ts';
import { ANDROMEDA } from './andromeda.ts';
import { LMC } from './lmc.ts';
import { SMC } from './smc.ts';
import { ORION_NEBULA } from './orionNebula.ts';
import { CRAB_NEBULA } from './crabNebula.ts';
import { LANIAKEA } from './laniakea.ts';
import { MILKY_WAY } from './milkyWay.ts';
import { CMB } from './cmb.ts';
import { LEVEL_DESCRIPTIONS } from './levels.ts';
import { ALPHA_CENTAURI_A, ALPHA_CENTAURI_B } from './alphaCentauri.ts';
import { BETELGEUSE } from './betelgeuse.ts';
import { POLARIS } from './polaris.ts';
import { PROXIMA_CENTAURI } from './proximaCentauri.ts';
import { SGR_A_STAR } from './sgrAStar.ts';
import { SIRIUS_A, SIRIUS_B } from './sirius.ts';
import { MARS_PATHFINDER } from './sites/marsPathfinder.ts';
import { VIKING_LANDER_1 } from './sites/vikingLander1.ts';
import { VIKING_LANDER_2 } from './sites/vikingLander2.ts';
import { OPPORTUNITY } from './sites/opportunity.ts';
import { PHOENIX } from './sites/phoenix.ts';
import { SPIRIT } from './sites/spirit.ts';
import { TIANWEN_1 } from './sites/tianwen1.ts';
import { CURIOSITY } from './sites/curiosity.ts';
import { INSIGHT } from './sites/insight.ts';
import { PERSEVERANCE } from './sites/perseverance.ts';
import { MOON_SITES } from './sites/moonSites.ts';
import { describedId } from './ids.ts';
import type { Description } from './types.ts';

/** The spacecraft and Earth satellites with descriptions. */
const CRAFT: readonly Description[] = [VOYAGER_1, VOYAGER_2, NEW_HORIZONS, PARKER_SOLAR_PROBE, JWST, HUBBLE, ROMAN, ISS];

/** Pluto and the other dwarf planets with descriptions, and Charon. */
const DWARFS: readonly Description[] = [CERES, PLUTO, CHARON, HAUMEA, MAKEMAKE, ERIS];

/**
 * Beyond the Solar System: the galaxies, nebulae, remnants and structures with descriptions, and
 * what is no body at all -- the Milky Way, the cosmic microwave background (Description.subject).
 */
const FAR: readonly Description[] = [MILKY_WAY, ANDROMEDA, LMC, SMC, ORION_NEBULA, CRAB_NEBULA, LANIAKEA, CMB];

/**
 * The stars with descriptions, and Sgr A*. A catalogue star's body id is made at run time from
 * its record (core/starBodies.ts), so it is found by its designations (Description.catalogueStar).
 */
const STARS: readonly Description[] = [ALPHA_CENTAURI_A, ALPHA_CENTAURI_B, PROXIMA_CENTAURI, SIRIUS_A, SIRIUS_B, BETELGEUSE, POLARIS, SGR_A_STAR];

/**
 * The landing sites with descriptions (core/landingSites.ts): places on the ground, made bodies;
 * and the craft standing on Mars (catalog SURFACE_CRAFT), Curiosity, Perseverance and InSight.
 */
const SITES: readonly Description[] = [VIKING_LANDER_1, VIKING_LANDER_2, MARS_PATHFINDER, SPIRIT, OPPORTUNITY, PHOENIX, TIANWEN_1, CURIOSITY, PERSEVERANCE, INSIGHT, ...MOON_SITES];

/** Every body with a description, by id. Written one at a time; the panel offers it where there is one. */
export const DESCRIPTIONS: ReadonlyMap<BodyId, Description> = new Map(
  [SUN, MERCURY, VENUS, EARTH, MOON, MARS, JUPITER, IO, EUROPA, GANYMEDE, CALLISTO, SATURN, ENCELADUS, TITAN, URANUS, NEPTUNE, TRITON, ...DWARFS, ...CRAFT, ...FAR, ...LEVEL_DESCRIPTIONS, ...STARS, ...SITES].map((description) => [description.id, description]),
);

/** The description of the catalogue star known by any of `designations` ("HIP 27989", "alf CMa B"), or null. */
export function descriptionByDesignations(designations: readonly string[]): Description | null {
  return STARS.find((description) => description.catalogueStar?.designations.some((name) => designations.includes(name))) ?? null;
}

/**
 * A body's description, if it has one: only what is worth a page of its own has one, written
 * and checked by hand (Maxi, 2026-11-20: "todo lo que es así automático no me gusta, quiero
 * cosas de calidad"); a kind of thing is explained by the glossary's "what is this?". A catalogue
 * star made a body (`star-<tier>-<index>`) has no fixed id, so it is looked up by the
 * designations it carries (ids.ts). Only the description page (DescriptionView.tsx) imports this
 * module, so the prose stays out of the first view's chunk; the panels ask ids.ts hasDescription.
 */
export function descriptionOf(id: BodyId): Description | null {
  const described = describedId(id);
  return described === null ? null : (DESCRIPTIONS.get(described) ?? null);
}
