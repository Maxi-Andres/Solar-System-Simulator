import type { BodyDefinition } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { describeBody, layersFor, normalizeName, searchBodies } from './search.ts';

/** Just enough of a body for the search; the rest is never read. */
function body(
  id: string,
  name: string,
  kind: BodyDefinition['kind'],
  parent: string | null = null,
  extra: Partial<BodyDefinition> = {},
): BodyDefinition {
  return {
    id,
    name,
    kind,
    parent,
    radiusEquatorialKm: 1,
    mission: null,
    ...extra,
  } as BodyDefinition;
}

const BODIES: BodyDefinition[] = [
  body('sun', 'Sun', 'star', null, { radiusEquatorialKm: 695_700 }),
  body('jupiter', 'Jupiter', 'planet', null, { radiusEquatorialKm: 71_492 }),
  body('saturn', 'Saturn', 'planet', null, { radiusEquatorialKm: 60_268 }),
  body('mars', 'Mars', 'planet', null, { radiusEquatorialKm: 3_396 }),
  body('europa', 'Europa', 'moon', 'jupiter', { radiusEquatorialKm: 1_561 }),
  body('io', 'Io', 'moon', 'jupiter', { radiusEquatorialKm: 1_822 }),
  body('ganymede', 'Ganymede', 'moon', 'jupiter', { radiusEquatorialKm: 2_634 }),
  body('titan', 'Titan', 'moon', 'saturn', { radiusEquatorialKm: 2_575 }),
  // A small moon: sampled adaptively, hung off its planet.
  body('s2004s12', 'S/2004 S 12', 'moon', 'saturn', {
    sampling: { toleranceKm: 1, windowMonths: 12 },
  }),
  body('hiiaka', 'Hiʻiaka', 'moon', null),
  body('16-psyche', '16 Psyche', 'asteroid'),
  body('psyche', 'Psyche', 'spacecraft', null, {
    mission: { operator: 'NASA' } as BodyDefinition['mission'],
  }),
  body('europa-clipper', 'Europa Clipper', 'spacecraft', 'jupiter', {
    mission: { operator: 'NASA' } as BodyDefinition['mission'],
  }),
  body('mro', 'Mars Reconnaissance Orbiter', 'spacecraft', 'mars', {
    mission: { operator: 'NASA' } as BodyDefinition['mission'],
  }),
  body('mex', 'Mars Express', 'spacecraft', 'mars', {
    mission: { operator: 'ESA' } as BodyDefinition['mission'],
  }),
  body('ceres', 'Ceres', 'dwarf-planet'),
];

const ids = (query: string) => searchBodies(BODIES, query).map((result) => result.body.id);

describe('normalizeName', () => {
  it('drops case, accents and punctuation', () => {
    expect(normalizeName('Hiʻiaka')).toBe('hiiaka');
    expect(normalizeName('  EUROPA--Clipper ')).toBe('europa clipper');
    expect(normalizeName('S/2004 S 12')).toBe('s 2004 s 12');
    expect(normalizeName('Nereida')).toBe('nereida');
    expect(normalizeName('Ñandú')).toBe('nandu');
  });
});

describe('searchBodies', () => {
  it('puts the body named first, and what is related to it after', () => {
    // Jupiter, then its moons by size, then the craft that flies about it.
    expect(ids('jupiter')).toEqual(['jupiter', 'ganymede', 'io', 'europa', 'europa-clipper']);
  });

  it('prefers an exact name to a longer one that starts the same', () => {
    expect(ids('europa').slice(0, 2)).toEqual(['europa', 'europa-clipper']);
    // The asteroid and the craft are both Psyche; the whole name decides.
    expect(ids('16 psyche')[0]).toBe('16-psyche');
    expect(ids('psyche')[0]).toBe('psyche');
  });

  it('finds a word inside a name', () => {
    expect(ids('clipper')).toEqual(['europa-clipper']);
    expect(ids('reconnaissance')).toEqual(['mro']);
  });

  it('matches a provisional designation however it is typed', () => {
    for (const query of ['S/2004 S 12', 's2004s12', '2004 s 12', 's 2004']) {
      expect(ids(query), query).toContain('s2004s12');
    }
  });

  it('ignores accents in the name and in the query', () => {
    expect(ids('hiiaka')).toEqual(['hiiaka']);
    expect(ids('Hiʻiaka')).toEqual(['hiiaka']);
  });

  it('narrows by kind, parent and operator, every word required', () => {
    expect(ids('moon saturn')).toEqual(['titan', 's2004s12']);
    expect(ids('nasa mars')).toEqual(['mro']);
    expect(ids('esa')).toEqual(['mex']);
    expect(ids('dwarf')).toEqual(['ceres']);
    expect(ids('zzz')).toEqual([]);
  });

  it('returns nothing for an empty query, and no more than the limit', () => {
    expect(ids('   ')).toEqual([]);
    expect(searchBodies(BODIES, 'a', 3)).toHaveLength(3);
  });
});

describe('describeBody', () => {
  it('says what a body is and what it belongs to', () => {
    expect(describeBody(BODIES.find((b) => b.id === 'titan')!, 'Saturn')).toBe('Moon of Saturn');
    expect(describeBody(BODIES.find((b) => b.id === 'mex')!, 'Mars')).toBe('Spacecraft · ESA');
    expect(describeBody(BODIES.find((b) => b.id === 'ceres')!, null)).toBe('Dwarf planet');
  });
});

describe('layersFor', () => {
  it('turns on the Small Moons along with the Moons for a small moon', () => {
    expect(layersFor(BODIES.find((b) => b.id === 's2004s12')!)).toEqual(['moons', 'smallMoons']);
    expect(layersFor(BODIES.find((b) => b.id === 'titan')!)).toEqual(['moons']);
    expect(layersFor(BODIES.find((b) => b.id === 'sun')!)).toEqual(['planets']);
    expect(layersFor(BODIES.find((b) => b.id === 'psyche')!)).toEqual(['spacecraft']);
  });
});
