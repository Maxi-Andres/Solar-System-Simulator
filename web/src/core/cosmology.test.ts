import { describe, expect, it } from 'vitest';

import {
  ageGyr,
  CF4_COSMOLOGY,
  comovingDistanceMpc,
  eventHorizonMpc,
  hubbleDistanceMpc,
  LAST_SCATTERING_RADIUS_MPC,
  lookbackTimeGyr,
  mpcToLy,
  OBSERVABLE_RADIUS_MPC,
  omegaRadiation,
  PLANCK18,
  redshiftDistances,
  Z_LAST_SCATTERING,
} from './cosmology.ts';

/** Planck 2018, A&A 641, A6, Table 2, TT,TE,EE+lowE+lensing+BAO: what the integrals must give back. */
const PLANCK_AGE_GYR = 13.787;
const PLANCK_R_STAR_MPC = 144.57;
const PLANCK_100_THETA_STAR = 1.04119;

describe('Planck 2018 cosmology', () => {
  it('gives the universe Planck’s age', () => {
    // 13.787 +- 0.020 billion years.
    expect(Math.abs(ageGyr() - PLANCK_AGE_GYR)).toBeLessThan(0.02);
  });

  it('puts the last-scattering surface where Planck’s acoustic angle does', () => {
    // theta* = r* / D_M(z*): 144.57 Mpc at 1.04119e-2 rad is 13,885 Mpc.
    const fromAngle = PLANCK_R_STAR_MPC / (PLANCK_100_THETA_STAR / 100);
    expect(Math.abs(LAST_SCATTERING_RADIUS_MPC - fromAngle) / fromAngle).toBeLessThan(0.002);
    expect(Z_LAST_SCATTERING).toBe(1089.8);
  });

  it('makes the observable universe 46.2 billion light years in radius, the CMB just inside', () => {
    expect(mpcToLy(OBSERVABLE_RADIUS_MPC) / 1e9).toBeCloseTo(46.19, 2);
    expect(mpcToLy(LAST_SCATTERING_RADIUS_MPC) / 1e9).toBeCloseTo(45.27, 2);
    expect(OBSERVABLE_RADIUS_MPC - LAST_SCATTERING_RADIUS_MPC).toBeLessThan(300);
  });

  it('has radiation a ten-thousandth of today’s density: photons and three neutrinos', () => {
    expect(omegaRadiation(PLANCK18) * (PLANCK18.h0 / 100) ** 2).toBeCloseTo(4.18e-5, 7);
  });

  it('gives the Hubble sphere and the event horizon their textbook sizes', () => {
    expect(mpcToLy(hubbleDistanceMpc()) / 1e9).toBeCloseTo(14.45, 2);
    expect(mpcToLy(eventHorizonMpc()) / 1e9).toBeCloseTo(16.6, 1);
  });

  it('is nearly cz / H0 nearby, as Hubble’s law', () => {
    const z = 0.001;
    expect(comovingDistanceMpc(z) / ((299_792.458 * z) / PLANCK18.h0)).toBeCloseTo(1, 3);
    expect(lookbackTimeGyr(0)).toBe(0);
  });

  it('puts MoM-z14 33.9 billion ly off now, its light 13.5 billion years old, 2.2 billion off then', () => {
    const d = redshiftDistances(14.44);
    expect(d.comovingLy / 1e9).toBeCloseTo(33.86, 2);
    expect(d.lookbackGyr).toBeCloseTo(13.50, 2);
    expect(d.properAtEmissionLy / 1e9).toBeCloseTo(2.19, 2);
    expect(d.ageAtEmissionGyr * 1000).toBeCloseTo(283, -1);
    // Light-travel distance, comoving and proper then, in that order.
    expect(d.properAtEmissionLy).toBeLessThan(d.lightTravelLy);
    expect(d.lightTravelLy).toBeLessThan(d.comovingLy);
  });

  it('depends on H0 as the header says: Cosmicflows-4’s makes everything 8 % nearer and younger', () => {
    const cf4 = comovingDistanceMpc(Infinity, CF4_COSMOLOGY);
    expect(mpcToLy(cf4) / 1e9).toBeCloseTo(42.57, 2);
    expect(cf4 / OBSERVABLE_RADIUS_MPC).toBeCloseTo(0.92, 2);
    expect(ageGyr(CF4_COSMOLOGY)).toBeCloseTo(12.63, 2);
    // At the catalogue's far edge, z 0.17, the two disagree by a tenth.
    expect(comovingDistanceMpc(0.17) / comovingDistanceMpc(0.17, CF4_COSMOLOGY)).toBeCloseTo(1.1, 1);
  });
});

describe('redshiftDistances in one pass', () => {
  it('gives the same numbers, to the bit, as the integrals one at a time', () => {
    for (const c of [PLANCK18, CF4_COSMOLOGY]) {
      for (const z of [0.0012, 0.158339, 1, 7.64, 14.44, Z_LAST_SCATTERING]) {
        const d = redshiftDistances(z, c);
        expect(d.comovingMpc).toBe(comovingDistanceMpc(z, c));
        expect(d.lookbackGyr).toBe(lookbackTimeGyr(z, c));
        expect(d.ageAtEmissionGyr).toBe(lookbackTimeGyr(Infinity, c) - lookbackTimeGyr(z, c));
      }
      expect(ageGyr(c)).toBe(lookbackTimeGyr(Infinity, c));
    }
  });
});
