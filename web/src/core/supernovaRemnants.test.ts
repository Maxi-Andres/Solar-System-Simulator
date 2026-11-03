import { describe, expect, it } from 'vitest';

import { EphemerisStore } from './ephemerisStore.ts';
import {
  ensureSupernovaRemnants,
  remnantBodyId,
  remnantOf,
  remnantRadiusKm,
  remnantState,
  SUPERNOVA_REMNANTS,
} from './supernovaRemnants.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const byKey = (key: string) => SUPERNOVA_REMNANTS.find((remnant) => remnant.key === key)!;

describe('the supernova remnants', () => {
  it('are where their distances put them', () => {
    for (const remnant of SUPERNOVA_REMNANTS) {
      const p = remnantState(remnant).position;
      expect(Math.hypot(p.x, p.y, p.z) / PARSEC_KM).toBeCloseTo(remnant.distancePc, 3);
    }
  });

  it('are the size Green gives them at that distance: the Crab 3.5 pc across, the Cygnus Loop 41', () => {
    // The Crab's 6' mean at 2 kpc: 3.5 pc across, 1.7 in radius.
    expect(remnantRadiusKm(byKey('crab')) / PARSEC_KM).toBeCloseTo(1.75, 1);
    // The Cygnus Loop's 195' mean at 725 pc: 41 pc across.
    expect((2 * remnantRadiusKm(byKey('cygnus-loop'))) / PARSEC_KM).toBeCloseTo(41.1, 0);
  });

  it('sit round the pulsars that are theirs: the Crab’s pulsar inside its nebula', () => {
    // The Crab Pulsar's ATNF position, 05h34m31.97s +22d00m52.2s, against Green's centre to the arcminute.
    const crab = byKey('crab');
    const pulsarRa = (5 + 34 / 60 + 31.97 / 3600) * 15;
    const pulsarDec = 22 + 0 / 60 + 52.2 / 3600;
    const offArcmin = Math.hypot((pulsarRa - crab.raDeg) * Math.cos((pulsarDec * Math.PI) / 180), pulsarDec - crab.decDeg) * 60;
    expect(offArcmin).toBeLessThan(crab.sizeArcmin[1] / 2);
  });

  it('become bodies once, found by id', () => {
    const store = new EphemerisStore({
      manifest: { bodies: [], tables: {} },
      bodies: [],
      vectors: new Map(),
      elements: new Map(),
      generatedAt: new Date(0),
    } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
    ensureSupernovaRemnants(store);
    ensureSupernovaRemnants(store);
    for (const remnant of SUPERNOVA_REMNANTS) {
      expect(store.isPropagatedBody(remnantBodyId(remnant))).toBe(true);
      expect(remnantOf(remnantBodyId(remnant))).toBe(remnant);
    }
    expect(store.body('snr-crab').kind).toBe('supernova-remnant');
  });
});
