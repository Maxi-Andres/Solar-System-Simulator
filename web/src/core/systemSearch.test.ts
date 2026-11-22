import { describe, expect, it } from 'vitest';

import { hasDescription } from '../descriptions/ids.ts';
import { PLANETARY_SYSTEMS } from './planetarySystems.ts';
import { searchSystems, systemEntries } from './systemSearch.ts';

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

  it('offers the descriptions that exist: the Solar System’s and Alpha Centauri’s', () => {
    const about = ENTRIES.filter((entry) => entry.about !== null);
    expect(about.map((entry) => entry.name)).toEqual(['Solar System', 'Alpha Centauri']);
    for (const entry of about) expect(hasDescription(entry.about!), entry.name).toBe(true);
  });
});
