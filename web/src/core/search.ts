import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { isSmallMoon } from '../scene/floatingOrigin.ts';
import { recordHolderAliases, recordHolderKindLabel, recordHolderOf } from './recordHolders.ts';
import { satelliteBodyTag } from './satelliteGroups.ts';
import { deepSkyLayerKind, deepSkyOf, NOTABLE_STAR_KIND } from './deepSky.ts';
import { structureKindLabel, structureOf } from './structures.ts';
import { REGION_LAYER_IDS, regionOf } from './regions.ts';
import type { LayerId } from '../state/store.ts';
import { normalizeName } from './normalizeName.ts';

// Its own module, so the search worker (nameSearch.worker.ts) reads it without this one's imports.
export { normalizeName };

/**
 * Finding a body by name.
 *
 * The list under the breadcrumb was enough for ten planets; with 21 major moons, 437
 * small ones, 15 named small bodies and 40-odd spacecraft it is a scroll through folded
 * groups. This is the shortcut: type part of a name, get the body.
 *
 * Kept free of React and of the store, so the ranking can be tested on its own.
 */

/** The same without its spaces, so "s2004s12" and "s 2004 s 12" meet. */
function squeezed(text: string): string {
  return text.replace(/ /g, '');
}

/**
 * normalizeName and squeezed, remembered: searchBodies reads every body's name, parent,
 * operator, kind and other names each keystroke, nearly a thousand bodies, and they are the
 * same strings each time. Emptied if it ever grows past any list of bodies.
 */
const normalizedOf = new Map<string, string>();
const squeezedOf = new Map<string, string>();
const REMEMBERED = 50_000;

function normalizedName(text: string): string {
  let value = normalizedOf.get(text);
  if (value === undefined) {
    if (normalizedOf.size >= REMEMBERED) normalizedOf.clear();
    value = normalizeName(text);
    normalizedOf.set(text, value);
  }
  return value;
}

function squeezedName(text: string): string {
  let value = squeezedOf.get(text);
  if (value === undefined) {
    if (squeezedOf.size >= REMEMBERED) squeezedOf.clear();
    value = squeezed(text);
    squeezedOf.set(text, value);
  }
  return value;
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
    case 'black-hole':
      return 'Black hole';
    case 'neutron-star':
      return 'Neutron star';
    case 'globular-cluster':
      return 'Globular cluster';
    case 'supernova-remnant':
      return 'Supernova remnant';
    case 'galaxy':
      return 'Galaxy';
    case 'structure': {
      const structure = structureOf(body.id);
      const holder = structure === null ? recordHolderOf(body.id) : null;
      return structure !== null
        ? structureKindLabel(structure.kind)
        : holder !== null
          ? `${recordHolderKindLabel(holder.kind)} · z ${holder.z}`
          : 'Structure';
    }
    case 'nebula':
    case 'deep-sky':
      return deepSkyOf(body.id)?.label ?? (body.kind === 'nebula' ? 'Nebula' : 'Messier object');
    case 'region':
      return regionOf(body.id)?.kindLabel ?? 'Region';
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
    case 'black-hole':
      // Always drawn, as another star is (floatingOrigin.ts isShown).
      return [];
    case 'neutron-star':
      // Gone to from its marker, which is the Pulsars layer's.
      return ['pulsars'];
    case 'globular-cluster':
      return ['globularClusters'];
    case 'supernova-remnant':
      return ['supernovaRemnants'];
    case 'galaxy':
      return ['localGroup'];
    case 'structure':
      // A record-holder the Observable Universe's; a famous galaxy near enough (famousGalaxies.ts) Laniakea's.
      return recordHolderOf(body.id) !== null && recordHolderOf(body.id)!.nearby !== true ? ['observableUniverse'] : ['laniakea'];
    case 'nebula':
      return ['nebulae'];
    case 'deep-sky':
      return deepSkyLayerKind(body.id) === NOTABLE_STAR_KIND ? ['notableStars'] : ['messier'];
    case 'region': {
      const region = regionOf(body.id);
      if (region === null) return [];
      // A site on the Moon wants the Moon drawn under it.
      return region.layer === 'landing-site' && region.parent === 'moon'
        ? ['moons', REGION_LAYER_IDS[region.layer]]
        : [REGION_LAYER_IDS[region.layer]];
    }
  }
}

/**
 * Order of kinds when two results match equally well: what people look for most first.
 * The same order as the list under the breadcrumb.
 */
const KIND_ORDER: Readonly<Record<BodyDefinition['kind'], number>> = {
  star: 0,
  planet: 0,
  'black-hole': 0,
  'neutron-star': 0,
  'globular-cluster': 0,
  'supernova-remnant': 0,
  galaxy: 0,
  structure: 0,
  nebula: 0,
  'deep-sky': 0,
  'dwarf-planet': 1,
  region: 2,
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
  if (field.includes(word) || squeezedName(field).includes(word)) {
    return 3;
  }
  return null;
}

export interface SearchResult {
  readonly body: BodyDefinition;
  /** Lower is better; see searchBodies. */
  readonly score: number;
  /** Its name is the query, whole: "16 psyche", "s2004s12". */
  readonly exact: boolean;
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
  const typed = words.join(' ');
  const whole = squeezed(typed);

  const results: SearchResult[] = [];
  for (const body of bodies) {
    const name = normalizedName(body.name);
    const parentName = body.parent === null ? '' : normalizedName(nameOf.get(body.parent) ?? '');
    const tag = body.kind === 'satellite' ? satelliteBodyTag(body.id) : null;
    const operator = normalizedName(body.mission?.operator ?? tag?.operator ?? '');
    const kind = normalizedName(
      `${body.kind} ${body.kind === 'spacecraft' ? 'craft probe' : body.kind === 'satellite' ? 'earth' : ''}`,
    );
    // A satellite is also found by its catalogue name and numbers: "ISS", "HST", "25544",
    // "1998-067A". The International Space Station is "ISS (ZARYA)" in the catalogue, and
    // without that, "iss" found Larissa first.
    // A record-holder by its other names likewise: "Pandora's Cluster", "Tonantzintla 618".
    const catalogue =
      tag === null
        ? body.kind === 'structure'
          ? normalizedName(recordHolderAliases(body.id))
          : body.kind === 'nebula' || body.kind === 'deep-sky'
            ? normalizedName((deepSkyOf(body.id)?.aliases ?? []).join(' '))
            : body.kind === 'region'
              ? normalizedName((regionOf(body.id)?.aliases ?? []).join(' '))
              : ''
        : normalizedName(`${tag.catalogueName ?? ''} ${tag.noradId} ${tag.cosparId}`);

    // The whole query against the whole name first: "s2004s12", "16 psyche".
    const exact = name === typed || squeezedName(name) === whole;
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
      results.push({ body, score, exact });
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

/** searchNames's score of a name, or one of a galaxy's other names, typed whole (beltNames.ts). */
export const EXACT_NAME_SCORE = 0.5;

/**
 * The bodies' results and the catalogues' -- stars, exoplanet hosts, pulsars, clusters,
 * galaxies -- in one list. The bodies go first: they are few and what people look for most,
 * and the catalogues are long and mostly faint. But a catalogue entry named exactly what was
 * typed, by its name or one of its other names, goes before every body whose name merely
 * starts with it or contains it: "Cen A" is Centaurus A, though a body's name had "Cen" in it.
 * Each list keeps its own order.
 */
export function mergeBodiesAndCatalogues<T>(
  bodies: readonly { readonly item: T; readonly exact: boolean }[],
  catalogues: readonly { readonly item: T; readonly exact: boolean }[],
): T[] {
  return [
    ...bodies.filter((entry) => entry.exact),
    ...catalogues.filter((entry) => entry.exact),
    ...bodies.filter((entry) => !entry.exact),
    ...catalogues.filter((entry) => !entry.exact),
  ].map((entry) => entry.item);
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
