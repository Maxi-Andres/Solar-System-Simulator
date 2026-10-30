import type { PulsarCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { blackbodyChromaticity } from '../scene/blackbody.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import {
  characteristicAgeYears,
  ensurePulsarBody,
  formatPeriod,
  indexPulsars,
  neutronStarSize,
  NOMINAL_RADIUS_KM,
  parsePulsarCatalog,
  pulsarBodyId,
  pulsarIndexOf,
  pulsarOf,
  pulsarState,
  surfaceFieldGauss,
} from './pulsars.ts';
import { searchNames } from './beltNames.ts';
import { J2000_JD } from './time.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;

/** Two entries as tools/src/pulsars/ writes them (its run of 2026-10-30): the Crab, and J0437-4715. */
const RAW = {
  sources: {
    atnf: { version: '2.9.0', url: '', queriedAt: '2026-10-30T00:00:00Z' },
    mcgill: { url: '', queriedAt: '2026-10-30T00:00:00Z' },
  },
  frame: 'scene',
  counts: {
    listed: 2,
    placed: 2,
    unplaced: 0,
    byMethod: { independent: 2, parallax: 0, bounded: 0, dm: 0, magnetar: 0 },
    magnetars: 0,
    binaries: 1,
    inGlobularClusters: 0,
  },
  references: ['Trimble 1968, AJ 73, 535', 'Reardon et al. 2016, MNRAS 455, 1751'],
  pulsars: {
    count: 2,
    name: ['Crab Pulsar', 'PSR J0437-4715'],
    jName: ['J0534+2200', 'J0437-4715'],
    bName: ['B0531+21', null],
    x: [205.618, 37.593],
    y: [1988.889, 45.552],
    z: [-45.181, -145.252],
    vx: [105.81, -98.23],
    vy: [-10.26, -18.58],
    vz: [29.84, -31.25],
    distancePc: [2000, 156.8],
    distanceMethod: ['independent', 'independent'],
    distanceRef: [0, 1],
    distanceApproximate: [false, false],
    periodS: [0.033392412302258895, 0.005757451941593412],
    periodDerivative: [4.209716096219071e-13, 5.729220049814834e-20],
    types: [['HE'], ['HE']],
    binaryPeriodDays: [null, 5.7410459],
    companion: [null, 'He'],
    globularCluster: [null, null],
    remnant: ['Crab', null],
    magnetar: [false, false],
    candidate: [false, false],
  },
};

const emptyStore = (): EphemerisStore =>
  new EphemerisStore({
    manifest: { bodies: [], tables: {} },
    bodies: [],
    vectors: new Map(),
    elements: new Map(),
    generatedAt: new Date(0),
  } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);

describe('pulsars.json', () => {
  it('is checked column by column', () => {
    expect(parsePulsarCatalog(RAW).pulsars.count).toBe(2);
    const broken = { ...RAW, pulsars: { ...RAW.pulsars, x: [1] } };
    expect(() => parsePulsarCatalog(broken)).toThrow(/x does not have one entry each/);
  });

  it('is found by any of its names', () => {
    const archive = indexPulsars(parsePulsarCatalog(RAW));
    for (const query of ['crab', 'B0531+21', 'J0534', 'PSR J0437-4715', 'j0437']) {
      expect(searchNames(archive.search, query, 5).length, query).toBeGreaterThan(0);
    }
    expect(searchNames(archive.search, 'crab', 5)[0]!.k).toBe(0);
  });
});

describe('a pulsar gone to', () => {
  const catalog = parsePulsarCatalog(RAW) as PulsarCatalog;
  const archive = indexPulsars(catalog);

  it('is a neutron star where its record puts it, moving as it moves', () => {
    const at2000 = pulsarState(catalog, 0, J2000_JD);
    expect(Math.hypot(at2000.position.x, at2000.position.y, at2000.position.z) / PARSEC_KM).toBeCloseTo(2000, 0);
    const later = pulsarState(catalog, 0, J2000_JD + 365.25 * 100);
    // A century at its 110 km/s across the sky: 0.011 pc.
    const moved = Math.hypot(
      later.position.x - at2000.position.x,
      later.position.y - at2000.position.y,
      later.position.z - at2000.position.z,
    );
    expect(moved / PARSEC_KM).toBeCloseTo((Math.hypot(105.81, -10.26, 29.84) * 100 * 3.15576e7) / PARSEC_KM, 6);
  });

  it('is drawn at NICER’s radius where it is measured, else at the convention', () => {
    expect(neutronStarSize(catalog, 1).radiusKm).toBe(11.36);
    expect(neutronStarSize(catalog, 1).measured?.reference).toMatch(/Choudhury/);
    expect(neutronStarSize(catalog, 0)).toMatchObject({ radiusKm: NOMINAL_RADIUS_KM, measured: null });
  });

  it('becomes a body once, and the panel finds its entry', () => {
    const store = emptyStore();
    const id = ensurePulsarBody(store, archive, 0);
    expect(ensurePulsarBody(store, archive, 0)).toBe(id);
    expect(id).toBe(pulsarBodyId(0));
    expect(pulsarIndexOf(id)).toBe(0);
    expect(pulsarIndexOf('sun')).toBeNull();
    const body = store.body(id);
    expect(body.kind).toBe('neutron-star');
    expect(body.name).toBe('Crab Pulsar');
    expect(body.radiusEquatorialKm).toBe(12);
    expect(pulsarOf(id)?.k).toBe(0);
  });

  it('is drawn in the colour of the Rayleigh-Jeans tail: a million kelvin looks as ten million does', () => {
    const million = blackbodyChromaticity(1e6);
    const tenMillion = blackbodyChromaticity(1e7);
    for (let c = 0; c < 3; c += 1) {
      expect(million[c]).toBeCloseTo(tenMillion[c]!, 2);
    }
    // Blue the strongest.
    expect(million[2]).toBe(1);
  });
});

describe('what the spin says', () => {
  it('gives the Crab the field and age the ATNF lists for it', () => {
    const P = RAW.pulsars.periodS[0]!;
    const Pdot = RAW.pulsars.periodDerivative[0]!;
    // ATNF 2.9.0: BSURF 3.79e12 G, AGE 1.26e3 yr.
    expect(surfaceFieldGauss(P, Pdot)! / 1e12).toBeCloseTo(3.79, 2);
    expect(characteristicAgeYears(P, Pdot)!).toBeCloseTo(1257, 0);
  });

  it('gives none where the period does not lengthen', () => {
    expect(surfaceFieldGauss(0.005, -5e-20)).toBeNull();
    expect(characteristicAgeYears(0.005, null)).toBeNull();
  });

  it('says a period as it is said', () => {
    expect(formatPeriod(0.033392)).toBe('33.4 ms');
    expect(formatPeriod(7.55592)).toBe('7.56 s');
  });
});
