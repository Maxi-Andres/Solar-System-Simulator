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
import { VOYAGER_1 } from './voyager1.ts';
import { VOYAGER_2 } from './voyager2.ts';
import { CERES } from './ceres.ts';
import { CHARON } from './charon.ts';
import { ERIS } from './eris.ts';
import { HAUMEA } from './haumea.ts';
import { MAKEMAKE } from './makemake.ts';
import { PLUTO } from './pluto.ts';
import type { Description } from './types.ts';

/** The spacecraft and Earth satellites with descriptions. */
const CRAFT: readonly Description[] = [VOYAGER_1, VOYAGER_2, NEW_HORIZONS, PARKER_SOLAR_PROBE, JWST, HUBBLE, ISS];

/** Pluto and the other dwarf planets with descriptions, and Charon. */
const DWARFS: readonly Description[] = [CERES, PLUTO, CHARON, HAUMEA, MAKEMAKE, ERIS];

/** Every body with a description, by id. Written one at a time; the panel offers it where there is one. */
export const DESCRIPTIONS: ReadonlyMap<BodyId, Description> = new Map(
  [SUN, MERCURY, VENUS, EARTH, MOON, MARS, JUPITER, IO, EUROPA, GANYMEDE, CALLISTO, SATURN, ENCELADUS, TITAN, URANUS, NEPTUNE, TRITON, ...DWARFS, ...CRAFT].map((description) => [description.id, description]),
);

export function descriptionOf(id: BodyId): Description | null {
  return DESCRIPTIONS.get(id) ?? null;
}
