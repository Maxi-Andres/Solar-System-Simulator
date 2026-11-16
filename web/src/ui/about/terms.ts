import type { BodyKind } from '@sss/tools/types';

import { anchorId } from './nav.ts';

/**
 * The glossary's anchors (GlossarySection.tsx), kept apart from its text so that the body
 * panel's "what is this?" can link to an entry without loading the About to do it.
 */

/** The DOM id of a glossary entry. Kept apart from the subsections' ids by its prefix. */
export function termAnchor(term: string): string {
  return anchorId('glossary', `term-${term}`);
}

/** The entry that says what a body of each kind is: the body panel's "what is this?". */
export const KIND_TERM: Readonly<Record<BodyKind, string>> = {
  star: 'star',
  planet: 'planet',
  'dwarf-planet': 'dwarf-planet',
  asteroid: 'asteroid',
  comet: 'comet',
  moon: 'moon',
  spacecraft: 'spacecraft',
  satellite: 'satellite',
  'black-hole': 'black-hole',
  'neutron-star': 'neutron-star',
  'globular-cluster': 'star-cluster',
  'supernova-remnant': 'supernova-remnant',
  galaxy: 'galaxy',
  structure: 'supercluster',
  nebula: 'supernova-remnant',
  'deep-sky': 'star-cluster',
  region: 'lagrange-point',
};
