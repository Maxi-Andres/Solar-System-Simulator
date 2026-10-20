import { describe, expect, it } from 'vitest';

import { catalogDesignations } from './belt/buildBelt.ts';
import { CATALOG, SSB_CENTER, SUN_CENTER } from './catalog.ts';
import { SMALL_BODY_TOLERANCE_KM } from './config.ts';
import { cometCommand, cometDesignations, FAMOUS_COMETS } from './famousComets.ts';
import { stepMinutes } from './horizons/queries.ts';

const byId = (id: string) => FAMOUS_COMETS.find((body) => body.id === id)!;

describe('the famous comets', () => {
  it('are the comets people look for, and in the catalog once each', () => {
    expect(FAMOUS_COMETS.map((body) => body.name)).toEqual([
      '1P/Halley',
      '2P/Encke',
      '9P/Tempel 1',
      '12P/Pons-Brooks',
      '19P/Borrelly',
      '21P/Giacobini-Zinner',
      '46P/Wirtanen',
      '55P/Tempel-Tuttle',
      '67P/Churyumov-Gerasimenko',
      '81P/Wild 2',
      '103P/Hartley 2',
      '109P/Swift-Tuttle',
      'C/1995 O1 (Hale-Bopp)',
      'C/2020 F3 (NEOWISE)',
      'C/2022 E3 (ZTF)',
      'C/2023 A3 (Tsuchinshan-ATLAS)',
      '2I/Borisov (C/2019 Q4)',
      '3I/ATLAS (C/2025 N1)',
    ]);
    expect(CATALOG.filter((body) => body.kind === 'comet')).toEqual(FAMOUS_COMETS);
  });

  it('hang from the barycentre, with their orbits about the Sun', () => {
    for (const body of FAMOUS_COMETS) {
      expect(body.kind, body.id).toBe('comet');
      expect(body.parent, body.id).toBeNull();
      expect(body.center, body.id).toBe(SSB_CENTER);
      expect(body.elementsCenter, body.id).toBe(SUN_CENTER);
      // Every one's elements are published; the app decides from them whether a line is drawn.
      expect(body.drawOrbit, body.id).toBe(true);
    }
  });

  it('ask Horizons for the last apparition solution, by designation', () => {
    expect(byId('1p-halley').horizonsId).toBe('DES=1P;CAP;');
    expect(byId('c-1995-o1-hale-bopp').horizonsId).toBe('DES=C/1995 O1;CAP;');
    // 2I by its C/ name, which Horizons answers with the same record and SBDB knows.
    expect(byId('2i-borisov').horizonsId).toBe('DES=C/2019 Q4;CAP;');
    for (const body of FAMOUS_COMETS) {
      expect(body.horizonsId, body.id).toMatch(/^DES=[^;]+;CAP;$/);
    }
    expect(cometCommand('3I')).toBe('DES=3I;CAP;');
  });

  it('are sampled to a kilometre over the full window, starting from whole minutes', () => {
    for (const body of FAMOUS_COMETS) {
      expect(body.vectorWindow, body.id).toBe('full');
      expect(body.sampling, body.id).toEqual({
        toleranceKm: SMALL_BODY_TOLERANCE_KM,
        windowMonths: null,
      });
      expect(() => stepMinutes(body.stepDays), body.id).not.toThrow();
    }
  });

  it('are markers, sized only where a size is published', () => {
    for (const body of FAMOUS_COMETS) {
      expect(body.shapeDrawn, body.id).toBe(false);
      expect(body.rotation, body.id).toBeNull();
    }
    const unsized = FAMOUS_COMETS.filter((body) => body.radiusPublished === false).map(
      (body) => body.id,
    );
    expect(unsized).toEqual([
      '12p-pons-brooks',
      'c-2020-f3-neowise',
      'c-2022-e3-ztf',
      'c-2023-a3-tsuchinshan-atlas',
      '2i-borisov',
      '3i-atlas',
    ]);
    expect(byId('1p-halley').triaxialRadiiKm).toEqual([7.45, 4.1, 4.1]);
    expect(byId('67p-churyumov-gerasimenko').radiusEquatorialKm).toBe(1.7);
    expect(byId('c-1995-o1-hale-bopp').radiusEquatorialKm).toBe(30);
  });

  it("carry a GM only where one was measured: 67P's, from Rosetta", () => {
    expect(byId('67p-churyumov-gerasimenko').gmKm3S2).toBe(6.622e-7);
    expect(FAMOUS_COMETS.filter((body) => body.gmKm3S2 !== 0).map((body) => body.id)).toEqual([
      '67p-churyumov-gerasimenko',
    ]);
  });
});

describe('leaving them out of the comet cloud', () => {
  it("reads SBDB's designations from the Horizons commands", () => {
    expect(cometDesignations(CATALOG)).toEqual(
      [
        '1P', '2P', '9P', '19P', '67P', '81P', '103P', '12P', '21P', '46P', '55P', '109P',
        '1995 O1', '2020 F3', '2022 E3', '2023 A3', '2019 Q4', '2025 N1',
      ].sort(),
    );
  });

  it('is asked only of the comets a run publishes', () => {
    expect(cometDesignations(CATALOG.filter((body) => body.id !== '1p-halley'))).not.toContain('1P');
    expect(cometDesignations(CATALOG.filter((body) => body.kind !== 'comet'))).toEqual([]);
  });

  it('fails on a comet whose designation it cannot read, rather than draw it twice', () => {
    expect(() => cometDesignations([{ ...byId('1p-halley'), horizonsId: '90000030;' }])).toThrow(
      /1p-halley/,
    );
  });

  it('takes nothing out of the belt', () => {
    const belt = catalogDesignations(CATALOG);
    for (const designation of cometDesignations(CATALOG)) {
      expect(belt).not.toContain(designation);
    }
  });
});
