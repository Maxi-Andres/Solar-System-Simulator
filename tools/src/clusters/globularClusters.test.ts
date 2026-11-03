import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildGlobularClusters,
  parseBaumgardtOrbits,
  parseBaumgardtStructure,
  parseHarris,
} from './globularClusters.ts';

/**
 * Against the files as served on 2026-11-03, verbatim excerpts in __fixtures__: Baumgardt's
 * two tables for 47 Tuc, Omega Cen, M4, Terzan 5, Crater (too recent for Harris) and
 * 2MASS-GC01 (Harris has no [Fe/H] for it), the structure table with 47 Tuc twice as it
 * lists it; and Harris's Parts I and II for those Harris has.
 */

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, '__fixtures__', name), 'latin1');
const orbits = parseBaumgardtOrbits(fixture('orbits_table.txt'));
const structure = parseBaumgardtStructure(fixture('combined_table.txt'));
const harris = parseHarris(fixture('mwgc.dat'));
const catalog = buildGlobularClusters({ orbits, structure, harris, queriedAt: '2026-11-03T00:00:00Z' });
const at = (name: string): number => catalog.name.indexOf(name);

describe('Baumgardt’s tables', () => {
  it('read every cluster, its spaces back, the structure table’s repeats once', () => {
    expect(orbits.map((o) => o.name).sort()).toEqual(['2MASS-GC01', 'Crater', 'NGC 104', 'NGC 5139', 'NGC 6121', 'Ter 5']);
    expect(structure.size).toBe(6);
  });

  it('take 47 Tuc’s numbers from the columns they are in', () => {
    const o = orbits.find((orbit) => orbit.name === 'NGC 104')!;
    expect(o).toMatchObject({ raDeg: 6.023792, decDeg: -72.081306, distanceKpc: 4.52, rvKmS: -17.45, pmRaMasYr: 5.253, pmDecMasYr: -2.557 });
    // Its mass, V, the radii, the central dispersion and the escape velocity, as its row gives them.
    expect(structure.get('NGC 104')).toMatchObject({
      massSun: 8.53e5,
      vMag: 4.08,
      coreRadiusPc: 0.61,
      halfLightRadiusPc: 4.03,
      halfMassRadiusPc: 6.44,
      tidalRadiusPc: 124.63,
      sigma0KmS: 11.9,
      escapeKmS: 47.4,
    });
  });
});

describe('Harris’s catalogue', () => {
  it('reads the other name, the metallicity and the reddening, blank where blank', () => {
    const tuc = harris.find((h) => h.id === 'NGC 104')!;
    expect(tuc).toMatchObject({ otherName: '47 Tuc', feH: -0.72, ebv: 0.04 });
    expect(harris.find((h) => h.id === 'NGC 6121')!.otherName).toBe('M4');
    const gc01 = harris.find((h) => h.id === '2MS-GC01')!;
    expect(gc01.feH).toBeNull();
    expect(gc01.ebv).toBe(6.8);
  });
});

describe('globular-clusters.json', () => {
  it('matches the two by position, whatever their spelling', () => {
    expect(catalog.feH[at('Ter 5')]).toBe(-0.23);
    expect(catalog.otherNames[at('Ter 5')]).toContain('Terzan 5');
    expect(catalog.feH[at('Crater')]).toBeNull();
    expect(catalog.otherNames[at('NGC 5139')]).toEqual(['Omega Centauri', 'omega Cen']);
    expect(catalog.otherNames[at('NGC 6121')]).toEqual(['M4']);
  });

  it('places 47 Tuc 4.52 kpc away', () => {
    const k = at('NGC 104');
    expect(Math.hypot(catalog.x[k]!, catalog.y[k]!, catalog.z[k]!)).toBeCloseTo(4520, -1);
    expect(catalog.distancePc[k]).toBe(4520);
  });
});
