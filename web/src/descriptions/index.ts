import type { BodyId } from '@sss/tools/types';

import { SUN } from './sun.ts';
import type { Description } from './types.ts';

/** Every body with a description, by id. Written one at a time; the panel offers it where there is one. */
export const DESCRIPTIONS: ReadonlyMap<BodyId, Description> = new Map([[SUN.id, SUN]]);

export function descriptionOf(id: BodyId): Description | null {
  return DESCRIPTIONS.get(id) ?? null;
}
