import type { GlobularClusterCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { CLUSTER_POPULATIONS } from './globularClusterPopulation.ts';
import {
  clusterDisplayName,
  clusterPopulation,
  clusterSampleRequest,
  clusterStarCount,
  parseGlobularClusterCatalog,
  plummerMassShare,
  PLUMMER_HALF_MASS,
  SAMPLE_BUDGET,
  SAMPLE_LIMIT_V,
  sampleGlobularCluster,
  sampleLimitV,
} from './globularClusters.ts';

/** 47 Tuc and Omega Cen as tools/src/clusters/ writes them (its run of 2026-11-03). */
const RAW = {
  count: 2,
  name: ['NGC 104', 'NGC 5139'],
  otherNames: [['47 Tucanae', '47 Tuc'], ['Omega Centauri', 'omega Cen']],
  x: [1382.98, -3409.88],
  y: [-1576.85, -2836.74],
  z: [-4003.91, -3132.17],
  vx: [-68.99, -58.32],
  vy: [97.06, -53.86],
  vz: [-42.36, -291.28],
  distancePc: [4520, 5430],
  distanceErrorPc: [30, 50],
  massSun: [853000, 3940000],
  vMag: [4.08, 3.5],
  coreRadiusPc: [0.61, 4.3],
  halfLightRadiusPc: [4.03, 7.56],
  halfMassRadiusPc: [6.44, 10.42],
  tidalRadiusPc: [124.63, 208.6],
  sigma0KmS: [11.9, 18],
  escapeKmS: [47.4, 62.2],
  feH: [-0.72, -1.53],
  ebv: [0.04, 0.12],
};
const catalog = parseGlobularClusterCatalog(RAW) as GlobularClusterCatalog;

describe('the populations', () => {
  it('each hold all their living stars', () => {
    for (const population of CLUSTER_POPULATIONS) {
      const sum = population.rows.reduce((total, row) => total + row[1], 0);
      expect(sum).toBeCloseTo(1, 4);
    }
  });

  it('are chosen by [Fe/H] + 0.21', () => {
    expect(clusterPopulation(-0.72).mh).toBe(-0.5);
    expect(clusterPopulation(-1.53).mh).toBe(-1.5);
    expect(clusterPopulation(-2.37).mh).toBe(-2);
    expect(clusterPopulation(null).mh).toBe(-1.5);
  });
});

describe('a cluster', () => {
  it('is called by the name it is known by', () => {
    expect(clusterDisplayName(catalog, 0)).toBe('47 Tucanae');
    expect(clusterDisplayName(catalog, 1)).toBe('Omega Centauri');
  });

  it('has as many stars as give its measured light: 47 Tuc’s M_V within a tenth of Harris’s -9.42', () => {
    const count = clusterStarCount(catalog, 0);
    expect(count.from).toBe('light');
    expect(count.absoluteV!).toBeCloseTo(-9.42, 0);
    // Millions: its light, over a mean star's, which the Kroupa IMF's many faint dwarfs keep small.
    expect(count.stars).toBeGreaterThan(1e6);
    expect(count.stars).toBeLessThan(1e7);
  });

  it('is spread as a Plummer sphere: half its mass inside its half-mass radius', () => {
    const a = 6.44 / PLUMMER_HALF_MASS;
    expect(plummerMassShare(6.44, a)).toBeCloseTo(0.5, 6);
  });

  it('is sampled within the budget, the same on every load', () => {
    const request = clusterSampleRequest(catalog, 1);
    const limit = sampleLimitV(request);
    expect(limit).toBeLessThanOrEqual(SAMPLE_LIMIT_V);
    const sample = sampleGlobularCluster(request);
    expect(sample.count).toBeLessThan(SAMPLE_BUDGET * 1.1);
    expect(sample.count).toBeGreaterThan(SAMPLE_BUDGET * 0.8);
    const again = sampleGlobularCluster(request);
    expect(again.count).toBe(sample.count);
    expect(again.positions[0]).toBe(sample.positions[0]);
    // Every star bright enough from the centre, none past the tidal radius.
    for (let i = 0; i < sample.count; i += 97) {
      const r = Math.hypot(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!);
      expect(r).toBeLessThanOrEqual(208.6 * 1.0001);
      expect(sample.absoluteV[i]! + 5 * (Math.log10(Math.max(r, 0.02)) - 1)).toBeLessThan(sample.limitV);
    }
  });
});
