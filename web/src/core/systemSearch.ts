import type { BodyId } from '@sss/tools/types';

import { ALPHA_CEN_SYSTEM_DESCRIPTION_ID, SOLAR_SYSTEM_DESCRIPTION_ID } from '../descriptions/subjects.ts';
import { ALPHA_CEN_SYSTEM } from './alphaCenBodies.ts';
import { normalizeName } from './normalizeName.ts';
import type { PlanetarySystem } from './planetarySystems.ts';

/**
 * The star systems as search results: the places the breadcrumb's "Star systems" list goes to
 * (ui/BodyPicker.tsx SystemList), each framed whole as that list frames it -- the Solar System
 * as its level, Alpha Centauri from out of the pair's orbital plane, a planetary system with its
 * planets' orbits. None of them is a body: searching "alpha centauri" found its stars, one at a
 * time, and never the system (Maxi, 2026-11-22).
 *
 * Kept free of React and of the store, as search.ts is, so the matching can be tested on its own.
 */

/** Which system: what choosing it goes to (App.tsx goToSystem). */
export type SystemPlace =
  | { readonly kind: 'solar-system' }
  | { readonly kind: 'alpha-centauri' }
  | { readonly kind: 'planetary'; readonly key: string };

export interface SystemEntry {
  readonly place: SystemPlace;
  readonly name: string;
  /** The line under its name. */
  readonly detail: string;
  /** Other names it is found by, besides its name and its name with "system" after it. */
  readonly otherNames: readonly string[];
  /** Its description's id, where it has one (descriptions/subjects.ts). */
  readonly about: BodyId | null;
}

/** The systems the breadcrumb lists, in its order: `planetary` is planetarySystems.ts allPlanetarySystems(). */
export function systemEntries(planetary: readonly PlanetarySystem[]): SystemEntry[] {
  return [
    {
      place: { kind: 'solar-system' },
      name: 'Solar System',
      detail: 'Planetary system · ours',
      otherNames: [],
      about: SOLAR_SYSTEM_DESCRIPTION_ID,
    },
    {
      place: { kind: 'alpha-centauri' },
      name: ALPHA_CEN_SYSTEM,
      detail: 'Triple star system',
      // By its Bayer name, typed as the star names write it ("alf Cen") or with the letter.
      otherNames: ['α Centauri', 'alf Cen'],
      about: ALPHA_CEN_SYSTEM_DESCRIPTION_ID,
    },
    ...planetary.map(
      (system): SystemEntry => ({
        place: { kind: 'planetary', key: system.key },
        name: system.name,
        detail: 'Planetary system',
        otherNames: system.hostDesignation === '' ? [] : [system.hostDesignation],
        about: null,
      }),
    ),
  ];
}

/** Shortest query a system is listed for by a name merely starting with it: "alp", not "a". */
const PREFIX_MIN_LENGTH = 3;

/** A system that matches, and whether its name was typed whole. */
export interface SystemMatch {
  readonly entry: SystemEntry;
  readonly exact: boolean;
}

/**
 * The systems `query` names, in the breadcrumb's order: each word of the query the start of the
 * word in the same place of one of its names -- "alpha", "alpha cen", "alpha centauri", "alf cen",
 * "tau ceti system". Word by word and in order, so "alpha centauri a" is the star, not the system,
 * and "centauri" alone, or "cen", names no system: there a star is what is meant.
 */
export function searchSystems(entries: readonly SystemEntry[], query: string): SystemMatch[] {
  const typed = normalizeName(query);
  if (typed === '') {
    return [];
  }
  const words = typed.split(' ');
  const matches: SystemMatch[] = [];
  for (const entry of entries) {
    const names = [entry.name, `${entry.name} system`, ...entry.otherNames].map(normalizeName);
    const exact = names.includes(typed);
    const prefix =
      typed.length >= PREFIX_MIN_LENGTH &&
      names.some((name) => {
        const nameWords = name.split(' ');
        return words.length <= nameWords.length && words.every((word, k) => nameWords[k]!.startsWith(word));
      });
    if (exact || prefix) {
      matches.push({ entry, exact });
    }
  }
  return matches;
}
