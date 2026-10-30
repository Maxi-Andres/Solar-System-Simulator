import type { BodyId } from '@sss/tools/types';

import { addStarBody } from './starBodies.ts';
import type { StarNameIndex, Stars3dSource } from './stars3d.ts';

/**
 * Sirius A and B as bodies from the start, pinned, as Alpha Centauri's are (alphaCenBodies.ts):
 * named on the sky from anywhere, and each a sphere of its measured size once near -- B
 * 5,630 km in radius. Both are 3D stars (B is Gaia DR3 2947050466531873024), placed on their
 * orbit (orbitingStars.ts, sirius.ts).
 */

export const SIRIUS_SYSTEM = 'Sirius';

/** The two stars' entries in the star names, by how they are named there. */
export function siriusEntries(index: StarNameIndex): { readonly a: number; readonly b: number } | null {
  const { names } = index;
  let a = -1;
  let b = -1;
  for (let k = 0; k < names.count; k += 1) {
    if (names.system[k] !== SIRIUS_SYSTEM) {
      continue;
    }
    if (names.display[k] === 'Sirius') {
      a = k;
    } else if (names.display[k] === 'Sirius B') {
      b = k;
    }
  }
  return a < 0 || b < 0 ? null : { a, b };
}

/** Makes Sirius A and B bodies, pinned; their ids, or null where the names lack them. */
export async function ensureSirius(
  store: Parameters<typeof addStarBody>[0],
  stars3d: Stars3dSource,
  index: StarNameIndex,
  keep: BodyId,
): Promise<{ readonly a: BodyId; readonly b: BodyId } | null> {
  const entries = siriusEntries(index);
  if (entries === null) {
    return null;
  }
  const a = await addStarBody(store, stars3d, index, entries.a, keep, true);
  const b = await addStarBody(store, stars3d, index, entries.b, keep, true);
  return { a, b };
}
