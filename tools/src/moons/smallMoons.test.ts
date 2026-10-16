import { describe, expect, it } from 'vitest';

import { CATALOG, smallMoonId, smallMoonName } from '../catalog.ts';
import {
  CLOSE_ORBIT_WINDOW_MONTHS,
  INNER_MOON_PERIOD_DAYS,
  SMALL_MOON_TOLERANCE_FLOOR_KM,
  SMALL_MOON_WINDOW_MONTHS,
} from '../config.ts';
import { majorBodyIds, radiusFromSummary } from './buildMoonList.ts';
import { SMALL_MOON_RECORDS } from './smallMoons.ts';

// Sampled adaptively and hung from a planet; the small bodies about the Sun are sampled
// the same way and are tested in smallBodies.test.ts.
const small = CATALOG.filter((body) => body.sampling !== undefined && body.parent !== null);

describe('the small moons', () => {
  it('are every one JPL lists, under the planet it lists them under', () => {
    expect(small).toHaveLength(SMALL_MOON_RECORDS.length);
    expect(small.length).toBeGreaterThan(400);
    for (const body of small) {
      expect(body.kind, body.id).toBe('moon');
      expect(['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'], body.id).toContain(
        body.parent,
      );
    }
  });

  it('never share an id or a Horizons id with anything else in the catalog', () => {
    const ids = CATALOG.map((body) => body.id);
    const horizons = CATALOG.map((body) => body.horizonsId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(horizons).size).toBe(horizons.length);
  });

  it('claim no size where JPL publishes none', () => {
    for (const record of SMALL_MOON_RECORDS) {
      const body = small.find((candidate) => candidate.horizonsId === record.horizonsId)!;
      if (record.radiusKm === null) {
        expect(body.radiusPublished, body.id).toBe(false);
      } else {
        expect(body.radiusPublished, body.id).toBeUndefined();
        expect(body.radiusEquatorialKm, body.id).toBe(record.radiusKm);
      }
    }
  });

  it('are held to a hundredth of their radius, never finer than a kilometre', () => {
    for (const body of small) {
      const expected = Math.max(
        SMALL_MOON_TOLERANCE_FLOOR_KM,
        body.radiusPublished === false ? 0 : body.radiusEquatorialKm / 100,
      );
      expect(body.sampling!.toleranceKm, body.id).toBe(expected);
    }
    // Himalia, 85 km, is the largest of them with a size: still the floor.
    const himalia = small.find((body) => body.id === 'himalia')!;
    expect(himalia.sampling!.toleranceKm).toBe(1);
  });

  it('follow the inner moons three months either side, the rest a year', () => {
    for (const record of SMALL_MOON_RECORDS) {
      const body = small.find((candidate) => candidate.horizonsId === record.horizonsId)!;
      expect(body.sampling!.windowMonths, body.id).toBe(
        record.periodDays < INNER_MOON_PERIOD_DAYS
          ? CLOSE_ORBIT_WINDOW_MONTHS
          : SMALL_MOON_WINDOW_MONTHS,
      );
    }
    expect(small.find((body) => body.id === 'metis')!.sampling!.windowMonths).toBe(3);
    expect(small.find((body) => body.id === 'sycorax')!.sampling!.windowMonths).toBe(12);
  });

  it('start sampling at a whole number of minutes, no coarser than four days', () => {
    for (const body of small) {
      const minutes = body.stepDays * 1440;
      expect(Number.isInteger(Math.round(minutes * 1e6) / 1e6), body.id).toBe(true);
      expect(minutes, body.id).toBeGreaterThanOrEqual(1);
      expect(minutes, body.id).toBeLessThanOrEqual(4 * 1440);
    }
  });
});

describe('names', () => {
  it('writes provisional designations the way they are written', () => {
    expect(smallMoonName('S2004_S31')).toBe('S/2004 S 31');
    expect(smallMoonId('S2004_S31')).toBe('s-2004-s-31');
    expect(smallMoonName('Himalia')).toBe('Himalia');
  });

  it('mends the two names JPL’s table cuts short or misspells', () => {
    expect(smallMoonName('Philophrosyn')).toBe('Philophrosyne');
    expect(smallMoonName('Magaclite')).toBe('Megaclite');
  });
});

describe('majorBodyIds', () => {
  it('reads the ids of Horizons’ major-body list, satellites, provisional ones and craft', () => {
    const listing = [
      '  ID#      Name                               Designation  IAU/aliases/other   ',
      '  -------  ---------------------------------- -----------  ------------------- ',
      '      719  Setebos                            S1999_U1     UXIX 1999U1          ',
      '    75051  2023U1                                                               ',
      '  -125544  International Space Station        1998-067A                         ',
    ].join('\n');
    expect([...majorBodyIds(listing)].sort()).toEqual(['-125544', '719', '75051']);
  });

  it('leaves out every moon Horizons does not list, as S/2025 U 1 was', () => {
    expect(SMALL_MOON_RECORDS.some((record) => record.horizonsId === '75052')).toBe(false);
  });
});

describe('radiusFromSummary', () => {
  it('reads a plain radius, an approximate one, and three radii', () => {
    expect(radiusFromSummary('  Radius (km)           = 77 +- 3   ')).toBe(77);
    expect(radiusFromSummary('  Radius (km)           = ~60 ')).toBe(60);
    expect(radiusFromSummary(' Radii (IAU2015): 0.7 x 0.25 x 0.2 km')).toBeCloseTo(
      Math.cbrt(0.7 * 0.25 * 0.2),
      12,
    );
    expect(radiusFromSummary('  Radius (km)           = 68.2x41.6x28.2    ')).toBeCloseTo(
      Math.cbrt(68.2 * 41.6 * 28.2),
      12,
    );
    expect(radiusFromSummary(' Recently discovered irregular Jovian satellite.')).toBeNull();
  });
});
