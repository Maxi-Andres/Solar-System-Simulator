import { describe, expect, it } from 'vitest';

import { BRIGHT_STARS, brightStarOf } from './brightStars.ts';

describe('the famous stars', () => {
  it('are the checklist’s, each once, joined by its Hipparcos number', () => {
    expect(BRIGHT_STARS.map((star) => star.name)).toEqual([
      'Polaris',
      'Deneb',
      'Altair',
      'Spica',
      'Regulus',
      'Fomalhaut',
      'Mira',
      'Algol',
      'Castor',
      'Alnitak',
      'Alnilam',
      'Mintaka',
    ]);
    expect(new Set(BRIGHT_STARS.map((star) => star.hip)).size).toBe(BRIGHT_STARS.length);
    expect(brightStarOf(['HR 424', 'Alpha Ursae Minoris Aa', 'HIP 11767'])?.name).toBe('Polaris');
    expect(brightStarOf(['HR 2491', 'HIP 32349'])).toBeNull();
    expect(brightStarOf(['Gaia DR3 1'])).toBeNull();
  });

  it('each name a source and say why it is known', () => {
    for (const star of BRIGHT_STARS) {
      expect(star.reference, star.name).toMatch(/\d{4}/);
      expect(star.note.length, star.name).toBeGreaterThan(30);
      expect(star.rows.length, star.name).toBeGreaterThan(0);
    }
  });

  it('draw a disc only for Fomalhaut, single, round and at the catalogue’s distance', () => {
    expect(BRIGHT_STARS.filter((star) => star.disc !== undefined).map((star) => star.name)).toEqual(['Fomalhaut']);
  });

  it('say where a distance is in doubt: Polaris, Deneb and the Belt', () => {
    const doubted = BRIGHT_STARS.filter((star) => star.distanceNote !== null).map((star) => star.name);
    expect(doubted).toEqual(expect.arrayContaining(['Polaris', 'Deneb', 'Alnitak', 'Alnilam', 'Mintaka']));
  });

  it('name whose distance each Belt star is drawn at, all three being published ones', () => {
    const belt = BRIGHT_STARS.filter((star) => ['Alnitak', 'Alnilam', 'Mintaka'].includes(star.name));
    expect(belt.map((star) => star.distanceSource !== undefined)).toEqual([true, true, true]);
  });
});
