import type { GlobularClusterCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { MIN_SIGMA_PX, pointPeak } from '../scene/LocalGroup.tsx';
import { HALF_LIGHT_SIGMAS } from '../scene/GlobularClusters.tsx';
import { clusterLuminosity, populationColourIndex, unresolvedShare } from './globularClusterLight.ts';
import { CLUSTER_POPULATIONS } from './globularClusterPopulation.ts';
import { clusterPopulation, parseGlobularClusterCatalog } from './globularClusters.ts';

/** 47 Tuc and Omega Cen as tools/src/clusters/ writes them (its run of 2026-11-03), and the latter again with no reddening. */
const RAW = {
  count: 3,
  name: ['NGC 104', 'NGC 5139', 'NGC 5139'],
  otherNames: [['47 Tucanae', '47 Tuc'], ['Omega Centauri', 'omega Cen'], []],
  x: [1382.98, -3409.88, -3409.88],
  y: [-1576.85, -2836.74, -2836.74],
  z: [-4003.91, -3132.17, -3132.17],
  vx: [-68.99, -58.32, -58.32],
  vy: [97.06, -53.86, -53.86],
  vz: [-42.36, -291.28, -291.28],
  distancePc: [4520, 5430, 5430],
  distanceErrorPc: [30, 50, 50],
  massSun: [853000, 3940000, 3940000],
  vMag: [4.08, 3.5, 3.5],
  coreRadiusPc: [0.61, 4.3, 4.3],
  halfLightRadiusPc: [4.03, 7.56, 7.56],
  halfMassRadiusPc: [6.44, 10.42, 10.42],
  tidalRadiusPc: [124.63, 208.6, 208.6],
  sigma0KmS: [11.9, 18, 18],
  escapeKmS: [47.4, 62.2, 62.2],
  feH: [-0.72, -1.53, -1.53],
  ebv: [0.04, 0.12, null],
};
const catalog = parseGlobularClusterCatalog(RAW) as GlobularClusterCatalog;

describe("a cluster's light", () => {
  it('is its V less its distance modulus and 3.1 E(B-V)', () => {
    const tuc = clusterLuminosity(catalog, 0);
    expect(tuc.from).toBe('light');
    expect(tuc.absoluteV).toBeCloseTo(4.08 - 5 * Math.log10(4520 / 10) - 3.1 * 0.04, 9);
    expect(tuc.luminosity / 10 ** (-0.4 * (tuc.absoluteV - 4.81))).toBeCloseTo(1, 12);
    // Harris (2010) gives M_V -9.42 for 47 Tuc and -10.26 for Omega Cen, from his own V_t and
    // distances (4.5 and 5.2 kpc); Baumgardt's farther 5.43 kpc makes Omega Cen 0.3 brighter.
    expect(Math.abs(tuc.absoluteV - -9.42)).toBeLessThan(0.15);
    const omega = clusterLuminosity(catalog, 1);
    expect(Math.abs(omega.absoluteV - -10.26)).toBeLessThan(0.35);
  });

  it('is its mass times its population\'s light per solar mass where there is no reddening', () => {
    const omega = clusterLuminosity(catalog, 2);
    expect(omega.from).toBe('mass');
    // A 12 Gyr population's M/L_V is near 2 (Baumgardt et al. 2020 find 1.5 to 2.5).
    const massToLight = 3_940_000 / omega.luminosity;
    expect(massToLight).toBeGreaterThan(1);
    expect(massToLight).toBeLessThan(4);
  });

  it("is in its population's integrated colour: an old cluster's, redder the richer in metals", () => {
    const colours = CLUSTER_POPULATIONS.map(populationColourIndex);
    for (const bv of colours) {
      // Globular clusters' dereddened integrated B-V: 0.6 to 0.9 (Harris 2010).
      expect(bv).toBeGreaterThan(0.55);
      expect(bv).toBeLessThan(0.95);
    }
    for (let i = 1; i < colours.length; i += 1) {
      expect(colours[i]!).toBeGreaterThan(colours[i - 1]!);
    }
  });

  it('left unresolved is all of it above its brightest star and none below its faintest', () => {
    const population = clusterPopulation(-0.72);
    expect(unresolvedShare(population, -20)).toBeCloseTo(1, 12);
    expect(unresolvedShare(population, 30)).toBeCloseTo(0, 12);
    let last = 1;
    for (let limit = -4; limit <= 12; limit += 0.25) {
      const share = unresolvedShare(population, limit);
      expect(share).toBeLessThanOrEqual(last + 1e-12);
      last = share;
    }
    // Most of an old population's V light is its giants' and its turnoff's.
    expect(unresolvedShare(population, 4)).toBeLessThan(0.5);
  });
});

describe('the point', () => {
  it("holds the cluster's whole luminosity, summed over its sprite's pixels", () => {
    const luminosity = clusterLuminosity(catalog, 0).luminosity;
    for (const [distancePc, pixelsPerRadian] of [
      [30_000, 1200],
      [500, 1200],
      [5_000, 2400],
    ] as const) {
      // As the shader: sigma from the half-light radius, never narrower than MIN_SIGMA_PX.
      const halfLight = RAW.halfLightRadiusPc[0]!;
      const sigmaPx = Math.max(MIN_SIGMA_PX, ((halfLight / distancePc) * pixelsPerRadian) / HALF_LIGHT_SIGMAS);
      const pixelPc = distancePc / pixelsPerRadian;
      const peak = pointPeak(luminosity, sigmaPx * pixelPc);
      const size = Math.ceil(6 * sigmaPx) + 1;
      let sum = 0;
      for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
          const x = i + 0.5 - size / 2;
          const y = j + 0.5 - size / 2;
          sum += peak * Math.exp((-0.5 * (x * x + y * y)) / (sigmaPx * sigmaPx)) * pixelPc * pixelPc;
        }
      }
      expect(Math.abs(sum / luminosity - 1)).toBeLessThan(0.01);
    }
  });
});
