import { describe, expect, it } from 'vitest';

import { hasDescription } from '../descriptions/ids.ts';
import { PLANETARY_SYSTEMS } from './planetarySystems.ts';
import { LEVELS } from '../state/levels.ts';
import { levelEntries, searchSystems, systemEntries } from './systemSearch.ts';

const ENTRIES = systemEntries(PLANETARY_SYSTEMS);
const names = (query: string): string[] => searchSystems(ENTRIES, query).map(({ entry }) => entry.name);

describe('the star systems in search', () => {
  it('lists every system the breadcrumb does, in its order', () => {
    expect(ENTRIES.map((entry) => entry.name)).toEqual([
      'Solar System',
      'Alpha Centauri',
      'Tau Ceti',
      'Epsilon Eridani',
      "Barnard's Star",
      '51 Pegasi',
    ]);
  });

  it('finds Alpha Centauri by its name, typed whole or begun, and by its Bayer name', () => {
    for (const query of ['alpha centauri', 'Alpha Centauri system', 'alpha', 'alp', 'alpha cen', 'alf cen', 'α Centauri', 'α cen']) {
      expect(names(query), query).toEqual(['Alpha Centauri']);
    }
    expect(searchSystems(ENTRIES, 'alpha centauri')[0]?.exact).toBe(true);
    expect(searchSystems(ENTRIES, 'alpha')[0]?.exact).toBe(false);
  });

  it('leaves a star’s name to the star: one of its letters, or one word from the middle', () => {
    for (const query of ['alpha centauri a', 'alf cen b', 'toliman', 'rigil kentaurus', 'proxima', 'centauri', 'cen', 'al', 'a']) {
      expect(names(query), query).toEqual([]);
    }
  });

  it('finds the others by name and their star’s designation, and the Solar System', () => {
    expect(names('tau ceti')).toEqual(['Tau Ceti']);
    expect(names('tau ceti system')).toEqual(['Tau Ceti']);
    expect(names('eps eri')).toEqual(['Epsilon Eridani']);
    expect(names('solar system')).toEqual(['Solar System']);
    expect(names('solar')).toEqual(['Solar System']);
  });

  it('offers the descriptions that exist: the Solar System’s, Alpha Centauri’s and Tau Ceti’s', () => {
    const about = ENTRIES.filter((entry) => entry.about !== null);
    expect(about.map((entry) => entry.name)).toEqual(['Solar System', 'Alpha Centauri', 'Tau Ceti']);
    for (const entry of about) expect(hasDescription(entry.about!), entry.name).toBe(true);
  });
});

describe('the breadcrumb’s levels in search', () => {
  const LEVEL_ENTRIES = levelEntries();
  const ALL = [...ENTRIES, ...LEVEL_ENTRIES];
  const first = (query: string): string | undefined => searchSystems(ALL, query)[0]?.entry.name;

  it('lists every level the breadcrumb has, the star systems’ among the systems', () => {
    const listed = new Set([
      ...LEVEL_ENTRIES.map((entry) => (entry.place.kind === 'level' ? entry.place.level : '')),
      'solar-system',
      'alpha-centauri',
      'planetary-system',
    ]);
    expect([...listed].sort()).toEqual(Object.keys(LEVELS).sort());
  });

  it('finds each by its name and the names people call it by', () => {
    for (const [query, name] of [
      ['milky way', 'Milky Way'],
      ['galaxy', 'Milky Way'],
      ['our galaxy', 'Milky Way'],
      ['the milky way', 'Milky Way'],
      ['solar neighbourhood', 'Solar Neighbourhood'],
      ['solar neighborhood', 'Solar Neighbourhood'],
      ['local group', 'Local Group'],
      ['local volume', 'Local Volume'],
      ['laniakea', 'Laniakea'],
      ['laniakea supercluster', 'Laniakea'],
      ['virgo', 'Virgo Cluster'],
      ['virgo cluster', 'Virgo Cluster'],
      ['nearby universe', 'Nearby Universe'],
      ['observable universe', 'Observable Universe'],
      ['the universe', 'Observable Universe'],
      ['universe', 'Observable Universe'],
    ] as const) {
      expect(first(query), query).toBe(name);
    }
  });

  it('takes a level’s other names whole only: "gal" is still the start of any galaxy’s name', () => {
    expect(names('gal')).toEqual([]);
    expect(searchSystems(LEVEL_ENTRIES, 'gal')).toEqual([]);
    expect(searchSystems(LEVEL_ENTRIES, 'univ')).toEqual([]);
  });

  it('offers the description of each level that has one', () => {
    for (const entry of LEVEL_ENTRIES) {
      if (entry.about !== null) expect(hasDescription(entry.about), entry.name).toBe(true);
    }
    expect(LEVEL_ENTRIES.find((entry) => entry.name === 'Milky Way')?.about).toBe('milky-way');
  });
});
