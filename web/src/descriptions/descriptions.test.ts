import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import { NAMED_SATELLITES } from '@sss/tools/satellites/named';
import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { blackHoleDefinition, SGR_A_ID, SGR_A_MASS_SUN } from '../core/blackHoles.ts';
import { landingSiteOf, landingSiteRegion } from '../core/landingSites.ts';
import { regionDefinition } from '../core/regions.ts';
import { namedSatelliteBodyId, satelliteDefinition } from '../core/satelliteBodies.ts';
import { starBodyDefinition, starBodyId } from '../core/starBodies.ts';
import { drawnFromData } from './generated.ts';
import { CATALOGUE_STAR_DESIGNATIONS, DESCRIBED_IDS } from './ids.ts';
import { DESCRIPTIONS, descriptionByDesignations, descriptionOf } from './index.ts';
import { ALPHA_CEN_SYSTEM_DESCRIPTION_ID } from './subjects.ts';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));

/** The ids of the places made bodies at run time, by prefix, and their kinds. */
const PLACE_KINDS: readonly (readonly [string, BodyDefinition['kind']])[] = [
  ['galaxy-', 'galaxy'],
  ['nebula-', 'nebula'],
  ['snr-', 'supernova-remnant'],
  ['structure-', 'structure'],
];

/**
 * The body a description is of: the catalog's, or -- for a named Earth satellite, which is
 * made at run time from its data -- the one its named.ts entry becomes (satelliteBodies.ts).
 */
function bodyOf(id: BodyId): BodyDefinition {
  // A catalogue star, made a body at run time from its record (starBodies.ts), and a black hole.
  if (DESCRIPTIONS.get(id)?.catalogueStar !== undefined) return starBodyDefinition(starBodyId(0, 0), id, 0.65);
  if (id === SGR_A_ID) return blackHoleDefinition(SGR_A_ID, 'Sgr A*', SGR_A_MASS_SUN);
  // A landing site, made a body at run time from its entry (core/landingSites.ts).
  const site = landingSiteOf(id);
  if (site !== null) return regionDefinition(landingSiteRegion(site));
  // A place made a body at run time from its own catalogue -- a galaxy, a nebula, a remnant, a
  // structure: what generated.ts reads of it is its id and its kind.
  const place = PLACE_KINDS.find(([prefix]) => id.startsWith(prefix));
  if (place !== undefined) {
    return { ...getBody('sun'), id, name: id, kind: place[1], horizonsId: '', rotation: null, rotationPeriodHours: null, textures: null };
  }
  const named = NAMED_SATELLITES.find((entry) => namedSatelliteBodyId(entry.id) === id);
  if (named === undefined) return getBody(id);
  const look = named.look === null ? null : { ...named.look, operator: named.operator, launchDate: null };
  return satelliteDefinition(id, named.name, look);
}

describe('the descriptions', () => {
  for (const description of DESCRIPTIONS.values()) {
    it(`${description.id}: every citation is to a source it lists, and every source is cited`, () => {
      const keys = new Set(description.sources.map((source) => source.key));
      const cited = new Set<string>();
      for (const point of [
        // What is no body (the Milky Way, the CMB) has nothing worked out from data.
        ...(description.subject === undefined ? drawnFromData(bodyOf(description.id)) : []),
        ...(description.sections ?? []).flatMap((section) => section.points),
        ...description.drawnHere,
        ...description.measured,
        ...description.estimated,
        ...description.missing,
        ...description.misconceptions,
      ]) {
        for (const key of point.cite ?? []) {
          expect(keys, `${point.title} cites ${key}`).toContain(key);
          cited.add(key);
        }
      }
      expect([...keys].filter((key) => !cited.has(key))).toEqual([]);
    });

    it(`${description.id}: every photo is on disk, credited, and says what its colours are`, () => {
      for (const photo of description.photos) {
        expect(existsSync(PUBLIC + photo.file), photo.file).toBe(true);
        expect(existsSync(PUBLIC + photo.largeFile), photo.largeFile).toBe(true);
        expect(photo.credit).not.toBe('');
        expect(photo.sourceUrl).toMatch(/^https:\/\//);
      }
    });
  }

  it('shows every landing site with a page in photographs, each credited in public/photos/CREDITS.md', () => {
    const credits = readFileSync(PUBLIC + 'photos/CREDITS.md', 'utf-8');
    for (const description of DESCRIPTIONS.values()) {
      if (landingSiteOf(description.id) === null) continue;
      expect(description.photos.length, description.id).toBeGreaterThan(0);
      for (const photo of description.photos) {
        expect(credits, photo.file).toContain(`\`${photo.file.replace(/^photos\//, '')}\``);
      }
    }
  });

  it('says how the Sun is drawn from its own data: its radius and its turn', () => {
    const points = drawnFromData(getBody('sun'));
    expect(points.find((point) => point.title === 'Its size and shape')?.text).toContain('695,700 km');
    expect(points.find((point) => point.title === 'How it turns')?.text).toContain('25.38 days');
  });

  it('says how a spacecraft is drawn from its own data, and never calls it a sphere with a map', () => {
    const coverage = { startJd: 2457720.5, stopJd: 2465025.5 };
    const points = drawnFromData(getBody('voyager-1'), coverage);
    const text = points.map((point) => point.text).join(' ');
    expect(text).not.toMatch(/sphere|surface map/);
    expect(points.find((point) => point.title === 'Where it is')?.text).toContain('spacecraft -31');
    // Launched before the data's window: said, with the date it was.
    expect(points.find((point) => point.title === 'Where it is')?.text).toContain('5 September 1977');
    expect(points.find((point) => point.title === 'What stands in its place')?.text).toContain('voyager.glb');
    expect(points.find((point) => point.title === 'Its size')?.text).toContain('13 m');
    expect(points.find((point) => point.title === 'Which way it faces')?.text).toContain('Dish to Earth');
    expect(points.some((point) => point.title === 'Its trail')).toBe(true);
  });

  it('says how a craft on Mars is drawn: on the ellipsoid from NASA’s traverse or its fixed site, never from Horizons', () => {
    const rover = drawnFromData(getBody('curiosity'));
    const where = rover.find((point) => point.title === 'Where it is')?.text ?? '';
    expect(where).toContain('MMGIS');
    expect(where).not.toMatch(/spacecraft -76/);
    expect(rover.some((point) => point.title === 'Its tracks')).toBe(true);
    expect(rover.some((point) => point.title === 'Its trail')).toBe(false);
    const lander = drawnFromData(getBody('insight'));
    expect(lander.find((point) => point.title === 'Where it is')?.text).toContain('4.502384° N');
    expect(lander.find((point) => point.title === 'Which way it faces')?.text).toContain('facing north');
    expect(lander.some((point) => point.title === 'Its tracks')).toBe(false);
  });

  it('says how a galaxy, a nebula and a remnant are drawn from their catalogues, never as a sphere with a map', () => {
    const say = (id: BodyId): string => drawnFromData(bodyOf(id)).map((point) => `${point.title}: ${point.text}`).join('\n');
    const m31 = say('galaxy-m31');
    expect(m31).toContain('761 kpc');
    expect(m31).toContain('Li et al. 2021');
    expect(m31).toContain('Tilted 77°');
    const orion = say('nebula-orion');
    expect(orion).toContain('403 pc');
    expect(orion).toContain('Kuhn et al. 2019');
    const crab = say('snr-crab');
    expect(crab).toContain('G184.6-5.8');
    expect(crab).toContain('VLT FORS2');
    for (const text of [m31, orion, crab]) expect(text).not.toMatch(/sphere of radius|surface map/);
  });

  it('says how a named Earth satellite is drawn: SGP4 from its elements, its model, no trail', () => {
    const points = drawnFromData(bodyOf(namedSatelliteBodyId('iss')));
    expect(points.find((point) => point.title === 'Where it is')?.text).toContain('NORAD 25544');
    expect(points.find((point) => point.title === 'What stands in its place')?.text).toContain('iss.glb');
    expect(points.find((point) => point.title === 'Its size')?.text).toContain('109 m');
    expect(points.some((point) => point.title === 'Its trail')).toBe(false);
  });

  it('lists in ids.ts exactly the ids that have a page, and each catalogue star’s designations', () => {
    // The panels offer "Read about" from ids.ts alone; a page missing there would never be offered.
    expect([...DESCRIBED_IDS].sort()).toEqual([...DESCRIPTIONS.keys()].sort());
    const designations = [...DESCRIPTIONS.values()]
      .filter((description) => description.catalogueStar !== undefined)
      .map((description) => [description.id, description.catalogueStar?.designations] as const);
    expect(new Map(designations)).toEqual(CATALOGUE_STAR_DESIGNATIONS);
  });

  it('finds a catalogue star’s description by any of its designations, and Sgr A*’s by its id', () => {
    expect(descriptionByDesignations(['HD 39801', 'HIP 27989'])?.id).toBe('betelgeuse');
    expect(descriptionByDesignations(['GJ 244 B', 'Sirius C'])?.id).toBe('sirius-b');
    expect(descriptionByDesignations(['alf Cen A'])?.id).toBe('alpha-centauri-a');
    expect(descriptionByDesignations(['HIP 1'])).toBeNull();
    expect(descriptionOf(SGR_A_ID)?.id).toBe(SGR_A_ID);
    // A run-time star id that is no body in the store has no description.
    expect(descriptionOf(starBodyId(9, 9))).toBeNull();
    // Each catalogue star's description is found by its own designations and by no other's.
    for (const description of DESCRIPTIONS.values()) {
      for (const designation of description.catalogueStar?.designations ?? []) {
        expect(descriptionByDesignations([designation])?.id, designation).toBe(description.id);
      }
    }
  });

  it('says how a catalogue star is drawn: its light, its blackbody colour, and a size only where measured', () => {
    const point = drawnFromData(starBodyDefinition(starBodyId(0, 1), 'Betelgeuse', 1.85));
    const disc = drawnFromData(starBodyDefinition(starBodyId(0, 2), 'Sirius B', -0.07, 5634));
    expect(point.map((entry) => entry.title)).toEqual(['Its light', 'Its colour', 'Its size']);
    expect(point.find((entry) => entry.title === 'Its size')?.text).toMatch(/stays a point/);
    expect(disc.find((entry) => entry.title === 'Its size')?.text).toContain('5,634 km');
    for (const text of [...point, ...disc].map((entry) => entry.text)) expect(text).not.toMatch(/surface map|JPL/);
  });

  it('describes Alpha Centauri as a whole, no body: its three stars, its orbits, its planets, and nothing invented', () => {
    const system = descriptionOf(ALPHA_CEN_SYSTEM_DESCRIPTION_ID);
    expect(system?.subject).toEqual({ name: 'Alpha Centauri', kind: 'triple star system' });
    // Not any one star's: none of its stars' designations finds it.
    expect(system?.catalogueStar).toBeUndefined();
    const text = [
      ...system!.lead,
      ...(system!.sections ?? []).flatMap((section) => [section.title, ...(section.text ?? []), ...section.points.flatMap((point) => [point.title, point.text])]),
      ...[...system!.drawnHere, ...system!.measured, ...system!.estimated, ...system!.missing, ...system!.misconceptions].flatMap(
        (point) => [point.title, point.text],
      ),
    ].join(' ');
    // The triple, the pair's orbit, Proxima's, the distances.
    for (const fact of ['G2', 'K1', 'M5.5', '79.93 years', 'eccentricity 0.52', '11.3 to 35.8 AU', '13,000 AU', '547,000 years', '4.37 light years', '4.25 light years']) {
      expect(text, fact).toContain(fact);
    }
    // The planets, confirmed and not, the limit of stable orbits, the sky and the one plan to go.
    for (const fact of ['Proxima b', 'confirmed in 2025', 'Proxima c', 'S1', '2.8 AU', 'Southern Cross', '29° N', 'Breakthrough Starshot']) {
      expect(text, fact).toContain(fact);
    }
    expect(system!.sources.map((source) => source.key)).toContain('holman1999');
    // Real things only: the fictional worlds set there are kept apart (core/fiction.ts).
    expect(text).not.toMatch(/fiction|Pandora|Polyphemus|Avatar|Na’vi|Na'vi/i);
  });

  it('says how a black hole is drawn: its horizon, its shadow, the lens', () => {
    const points = drawnFromData(blackHoleDefinition(SGR_A_ID, 'Sgr A*', SGR_A_MASS_SUN));
    expect(points.find((point) => point.title === 'Its size')?.text).toContain('12.7 million km');
    expect(points.find((point) => point.title === 'Its size')?.text).toContain('2.60 horizons');
    expect(points.some((point) => point.title === 'The sky round it')).toBe(true);
  });
});
