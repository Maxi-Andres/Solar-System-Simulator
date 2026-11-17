import type { BodyId } from '@sss/tools/types';

import { EARTH } from './earth.ts';
import { JUPITER } from './jupiter.ts';
import { MARS } from './mars.ts';
import { MERCURY } from './mercury.ts';
import { MOON } from './moon.ts';
import { NEPTUNE } from './neptune.ts';
import { SATURN } from './saturn.ts';
import { SUN } from './sun.ts';
import { URANUS } from './uranus.ts';
import { VENUS } from './venus.ts';
import type { Description } from './types.ts';

/** Every body with a description, by id. Written one at a time; the panel offers it where there is one. */
export const DESCRIPTIONS: ReadonlyMap<BodyId, Description> = new Map(
  [SUN, MERCURY, VENUS, EARTH, MOON, MARS, JUPITER, SATURN, URANUS, NEPTUNE].map((description) => [description.id, description]),
);

export function descriptionOf(id: BodyId): Description | null {
  return DESCRIPTIONS.get(id) ?? null;
}
