import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { isSmallMoon } from '../scene/floatingOrigin.ts';
import { satelliteBodyTag } from './satelliteGroups.ts';
import type { LayerId } from '../state/store.ts';

/**
 * Finding a body by name.
 *
 * The list under the breadcrumb was enough for ten planets; with 21 major moons, 437
 * small ones, 15 named small bodies and 40-odd spacecraft it is a scroll through folded
 * groups. This is the shortcut: type part of a name, get the body.
 *
 * Kept free of React and of the store, so the ranking can be tested on its own.
 */

/**
 * A name made comparable: lower case, accents dropped, and anything that is not a letter
 * or a digit turned into a single space.
 *
 * So "Europa Clipper", "europa-clipper" and "EUROPA  clipper" are one name, "Hiʻiaka"
 * matches "hiiaka", and a provisional designation like "S/2004 S 12" matches "s 2004 s12"
 * as well as "2004 s 12".
 */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    // Combining marks, and modifier letters such as the ʻokina in Hiʻiaka, which Unicode
    // counts as a letter but nobody types.
    .replace(/[\p{M}\p{Lm}]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The same without its spaces, so "s2004s12" and "s 2004 s 12" meet. */
function squeezed(text: string): string {
  return text.replace(/ /g, '');
}

/** What a result says under its name: its kind, and what it belongs to. */
export function describeBody(body: BodyDefinition, parentName: string | null): string {
  switch (body.kind) {
    case 'star':
      return 'Star';
    case 'planet':
      return 'Planet';
    case 'dwarf-planet':
      return 'Dwarf planet';
    case 'asteroid':
      return 'Asteroid';
    case 'comet':
      return 'Comet';
    case 'moon':
      return parentName === null ? 'Moon' : `Moon of ${parentName}`;
    case 'spacecraft': {
      const operator = body.mission?.operator ?? null;
      return operator === null ? 'Spacecraft' : `Spacecraft · ${operator}`;
    }
    case 'satellite': {
      const tag = satelliteBodyTag(body.id);
      return tag?.operator == null ? 'Earth satellite' : `Earth satellite · ${tag.operator}`;
    }
  }
}

/**
 * The layers a body needs switched on to be on screen at all.
 *
 * Choosing a result whose layer is off would otherwise focus something the app then
 * steps straight back from (see App.tsx): small moons are off by default, so searching
 * for Pan would do nothing. So choosing turns its layers on.
 */
export function layersFor(body: BodyDefinition): LayerId[] {
  switch (body.kind) {
    case 'star':
      // The Sun rides with the Planets; any other star is in no layer.
      return body.id === 'sun' ? ['planets'] : [];
    case 'planet':
      return ['planets'];
    case 'dwarf-planet':
      return ['dwarfPlanets'];
    case 'asteroid':
      return ['asteroids'];
    case 'comet':
      return ['comets'];
    case 'spacecraft':
      return ['spacecraft'];
    case 'satellite':
      return ['satellites'];
    case 'moon':
      return isSmallMoon(body) ? ['moons', 'smallMoons'] : ['moons'];
  }
}

/**
 * Order of kinds when two results match equally well: what people look for most first.
 * The same order as the list under the breadcrumb.
 */
const KIND_ORDER: Readonly<Record<BodyDefinition['kind'], number>> = {
  star: 0,
  planet: 0,
  'dwarf-planet': 1,
  moon: 2,
  asteroid: 3,
  comet: 3,
  spacecraft: 4,
  satellite: 4,
};

/** How well one query word matches one field, 0 best; null for no match. */
function wordScore(word: string, field: string): number | null {
  if (field === word) {
    return 0;
  }
  if (field.startsWith(word)) {
    return 1;
  }
  // The start of any word inside the field: "clipper" in "europa clipper".
  if (field.includes(` ${word}`)) {
    return 2;
  }
  if (field.includes(word) || squeezed(field).includes(word)) {
    return 3;
  }
  return null;
}

export interface SearchResult {
  readonly body: BodyDefinition;
  /** Lower is better; see searchBodies. */
  readonly score: number;
}

/**
 * The bodies whose name matches `query`, best first, at most `limit` of them.
 *
 * Every word of the query must match something about the body -- its name first, then
 * what it orbits, then its operator, then its kind -- so "jupiter" brings Jupiter and
 * then its moons, "moon saturn" the moons of Saturn, and "nasa mars" the NASA craft at
 * Mars. A word matched in the name counts four times more than one matched elsewhere,
 * so typing a name always puts that body above the ones merely related to it. Ties go
 * to the kind order above, then to the larger body, then alphabetically.
 */
export function searchBodies(
  bodies: readonly BodyDefinition[],
  query: string,
  limit = 50,
): SearchResult[] {
  const words = normalizeName(query).split(' ').filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }
  const nameOf = new Map(bodies.map((body) => [body.id, body.name] as const));
  const whole = squeezed(words.join(' '));

  const results: SearchResult[] = [];
  for (const body of bodies) {
    const name = normalizeName(body.name);
    const parentName = body.parent === null ? '' : normalizeName(nameOf.get(body.parent) ?? '');
    const tag = body.kind === 'satellite' ? satelliteBodyTag(body.id) : null;
    const operator = normalizeName(body.mission?.operator ?? tag?.operator ?? '');
    const kind = normalizeName(
      `${body.kind} ${body.kind === 'spacecraft' ? 'craft probe' : body.kind === 'satellite' ? 'earth' : ''}`,
    );
    // A satellite is also found by its catalogue name and numbers: "ISS", "HST", "25544",
    // "1998-067A". The International Space Station is "ISS (ZARYA)" in the catalogue, and
    // without that, "iss" found Larissa first.
    const catalogue =
      tag === null
        ? ''
        : normalizeName(`${tag.catalogueName ?? ''} ${tag.noradId} ${tag.cosparId}`);

    // The whole query against the whole name first: "s2004s12", "16 psyche".
    const exact = name === words.join(' ') || squeezed(name) === whole;
    let score = exact ? 0 : 0.5;
    let matched = true;
    for (const word of words) {
      const inName = wordScore(word, name);
      if (inName !== null) {
        score += inName;
        continue;
      }
      const inCatalogue = catalogue === '' ? null : wordScore(word, catalogue);
      if (inCatalogue !== null) {
        score += inCatalogue;
        continue;
      }
      const elsewhere = [parentName, operator, kind]
        .map((field) => (field === '' ? null : wordScore(word, field)))
        .filter((value): value is number => value !== null);
      if (elsewhere.length === 0) {
        matched = false;
        break;
      }
      score += 4 * (1 + Math.min(...elsewhere));
    }
    if (matched) {
      results.push({ body, score });
    }
  }

  results.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_ORDER[a.body.kind] - KIND_ORDER[b.body.kind] ||
      b.body.radiusEquatorialKm - a.body.radiusEquatorialKm ||
      a.body.name.localeCompare(b.body.name),
  );
  return results.slice(0, limit);
}

/** Parent name for `describeBody`, looked up in the same list. */
export function parentNameOf(
  bodies: readonly BodyDefinition[],
  id: BodyId | null,
): string | null {
  if (id === null) {
    return null;
  }
  return bodies.find((body) => body.id === id)?.name ?? null;
}
