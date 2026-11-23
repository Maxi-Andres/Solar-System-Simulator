import type { BodyId } from '@sss/tools/types';

import {
  ALPHA_CEN_SYSTEM_DESCRIPTION_ID,
  PLANETARY_SYSTEM_DESCRIPTION_IDS,
  SOLAR_SYSTEM_DESCRIPTION_ID,
} from '../descriptions/subjects.ts';
import { hasDescription } from '../descriptions/ids.ts';
import { LEVELS, type LevelId } from '../state/levels.ts';
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
 * And the breadcrumb's levels beside them -- the Solar Neighbourhood, the Milky Way, the Local
 * Group, out to the Observable Universe -- each doing what its crumb does: "milky way" found
 * nothing, the Milky Way being no body (Maxi, 2026-11-23).
 *
 * Kept free of React and of the store, as search.ts is, so the matching can be tested on its own.
 */

/** Which system: what choosing it goes to (App.tsx goToSystem). */
export type SystemPlace =
  | { readonly kind: 'solar-system' }
  | { readonly kind: 'alpha-centauri' }
  | { readonly kind: 'planetary'; readonly key: string }
  /** A breadcrumb level, gone to as its crumb goes (state/levels.ts). */
  | { readonly kind: 'level'; readonly level: LevelId };

export interface SystemEntry {
  readonly place: SystemPlace;
  readonly name: string;
  /** The line under its name. */
  readonly detail: string;
  /** Other names it is found by, besides its name and, for a star system, its name with "system" after it. */
  readonly otherNames: readonly string[];
  /**
   * Names it is found by only when typed whole: "galaxy" is the Milky Way, but "gal" is still the
   * start of anything else's name.
   */
  readonly wholeNames?: readonly string[];
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
        about: PLANETARY_SYSTEM_DESCRIPTION_IDS[system.key] ?? null,
      }),
    ),
  ];
}

/**
 * The breadcrumb's levels that are no star system, inner to outer, with the names people call them
 * by. Alpha Centauri's and the planetary systems' are the systems above, and the Solar System is
 * one of them already.
 */
const LEVEL_NAMES: readonly {
  readonly level: LevelId;
  readonly otherNames: readonly string[];
  readonly wholeNames: readonly string[];
}[] = [
  { level: 'solar-neighbourhood', otherNames: ['Solar Neighborhood'], wholeNames: ['neighbourhood', 'neighborhood', 'the solar neighbourhood'] },
  { level: 'milky-way', otherNames: [], wholeNames: ['galaxy', 'our galaxy', 'the galaxy', 'the milky way'] },
  { level: 'local-group', otherNames: [], wholeNames: ['the local group'] },
  { level: 'local-volume', otherNames: [], wholeNames: ['the local volume'] },
  { level: 'virgo-cluster', otherNames: [], wholeNames: ['virgo', 'the virgo cluster'] },
  { level: 'laniakea', otherNames: ['Laniakea Supercluster'], wholeNames: ['the laniakea supercluster'] },
  { level: 'nearby-universe', otherNames: [], wholeNames: ['the nearby universe'] },
  { level: 'observable-universe', otherNames: [], wholeNames: ['universe', 'the universe', 'the observable universe', 'cosmos'] },
];

/** The breadcrumb's levels as search entries, each with its description where one is written. */
export function levelEntries(): SystemEntry[] {
  return LEVEL_NAMES.map(({ level, otherNames, wholeNames }): SystemEntry => {
    const { name, kind, readAbout } = LEVELS[level];
    return {
      place: { kind: 'level', level },
      name,
      detail: kind.charAt(0).toUpperCase() + kind.slice(1),
      otherNames,
      wholeNames,
      about: readAbout.find((candidate) => hasDescription(candidate.id))?.id ?? null,
    };
  });
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
    const names = [entry.name, ...(entry.place.kind === 'level' ? [] : [`${entry.name} system`]), ...entry.otherNames].map(normalizeName);
    const exact = names.includes(typed) || (entry.wholeNames ?? []).some((name) => normalizeName(name) === typed);
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
