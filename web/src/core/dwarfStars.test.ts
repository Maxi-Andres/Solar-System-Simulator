import { describe, expect, it } from 'vitest';

import { CLUSTER_LF_STEP } from './globularClusterPopulation.ts';
import { clusterPopulation, SAMPLE_BUDGET } from './globularClusters.ts';
import {
  brightestStarV,
  dwarfSampleLimits,
  dwarfSampleRequest,
  lightFainterThan,
  meanStarLuminosity,
  sampleDwarfGalaxy,
  type DwarfSampleRequest,
} from './dwarfStars.ts';
import { galaxyAxes, galaxyLuminosity, type LocalGroupGalaxy } from './localGroup.ts';

const SUN_V = 4.81;
const ARCMIN = Math.PI / 180 / 60;

/** A dwarf as catalogueGalaxy makes it: Hercules's numbers in McConnachie's catalogue (2021). */
function dwarf(name: string, distancePc: number, vMag: number, rhArcmin: number, e: number, pa: number, ra: number, dec: number): LocalGroupGalaxy {
  const major = Math.tan(rhArcmin * ARCMIN) * distancePc;
  const minor = major * (1 - e);
  return {
    key: name.toLowerCase(),
    name,
    otherNames: [],
    catalogueIndex: 0,
    ambiguous: false,
    raDeg: ra,
    decDeg: dec,
    distancePc,
    distanceUpPc: null,
    distanceDownPc: null,
    distanceSource: '',
    vMag,
    colourIndex: 0.75,
    model: { kind: 'plummer', majorPc: major, minorPc: minor, depthPc: Math.sqrt(major * minor), positionAngleDeg: pa },
    shapeSource: '',
    giant: false,
  };
}

const HERCULES = dwarf('Hercules', 131_826, 14.77, 5.99, 0.69, -78.0, 247.7722, 12.7852);
const FORNAX = dwarf('Fornax', 147_231, 7.38, 18.4, 0.28, 41, 39.997, -34.4492);

/** Each star's position along the galaxy's own axes, pc. */
function alongAxes(request: DwarfSampleRequest, positions: Float32Array, i: number): [number, number, number] {
  const p = [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
  return request.axes.map((axis) => axis[0] * p[0]! + axis[1] * p[1]! + axis[2] * p[2]!) as [number, number, number];
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[sorted.length >> 1]!;
};

describe("a dwarf galaxy's stars", () => {
  // Every star, to the bottom of the main sequence: Hercules has some 10^5.
  const request = { ...dwarfSampleRequest(HERCULES, -2.41, 1)!, limitV: Infinity };
  const sample = sampleDwarfGalaxy(request);

  it('are as many as give its light', () => {
    expect(request.stars).toBeCloseTo(galaxyLuminosity(HERCULES)! / meanStarLuminosity(clusterPopulation(-2.41)), 6);
    expect(sample.count).toBeGreaterThan(0.98 * request.stars);
    expect(sample.count).toBeLessThan(1.02 * request.stars);
  });

  it('lie on its Plummer ellipsoid: half of them inside its half-light ellipse on the sky', () => {
    const [a, b] = request.scalesPc;
    // Seen along its own line of sight: the elliptical radius on the sky, in units of the major axis.
    const radii: number[] = [];
    const along: number[][] = [[], [], []];
    for (let i = 0; i < sample.count; i += 1) {
      const [x, y, z] = alongAxes(request, sample.positions, i);
      radii.push(Math.hypot(x / a, y / b));
      along[0]!.push(Math.abs(x));
      along[1]!.push(Math.abs(y));
      along[2]!.push(Math.abs(z));
    }
    // A Plummer profile's projected half-light radius is its scale; the 2.3 % past the cut
    // given back to the rest moves the median in by about a percent.
    expect(median(radii)).toBeGreaterThan(0.97);
    expect(median(radii)).toBeLessThan(1.01);
    // The axes as measured, and its depth sqrt(ab): the median |x| scales with its axis.
    const [ma, mb, mc] = along.map(median) as [number, number, number];
    expect(mb / ma).toBeCloseTo(b / a, 1);
    expect(mc / ma).toBeCloseTo(Math.sqrt(a * b) / a, 1);
    expect(request.scalesPc[2]).toBeCloseTo(Math.sqrt(a * b), 9);
  });

  it('lie along its axes in the scene', () => {
    const { u, v, w } = galaxyAxes(HERCULES);
    expect(request.axes[0]).toEqual([u.x, u.y, u.z]);
    expect(request.axes[1]).toEqual([v.x, v.y, v.z]);
    expect(request.axes[2]).toEqual([w.x, w.y, w.z]);
  });

  it('hold all of its light, to the faint end, within the sampling noise', () => {
    const { rows } = clusterPopulation(-2.41);
    // The light of a star and its square, over the population: a Poisson sum's variance is N <l^2>.
    let l2 = 0;
    for (const [mv, share] of rows) {
      l2 += share * 10 ** (-0.8 * (mv + CLUSTER_LF_STEP / 2 - SUN_V));
    }
    const expected = galaxyLuminosity(HERCULES)!;
    const sigma = Math.sqrt(request.stars * l2);
    let sum = 0;
    for (let i = 0; i < sample.count; i += 1) {
      sum += 10 ** (-0.4 * (sample.absoluteV[i]! - SUN_V));
    }
    expect(Math.abs(sum - expected)).toBeLessThan(4 * sigma);
    // And the noise small next to the whole: a few giants are most of it.
    expect(sigma / expected).toBeLessThan(0.1);
  });

  it('are drawn alike for the same seed', () => {
    const again = sampleDwarfGalaxy(request);
    expect(again.count).toBe(sample.count);
    expect(again.positions[123]).toBe(sample.positions[123]);
  });
});

describe('which stars are drawn', () => {
  it('a faint dwarf whole: every star, wherever it is', () => {
    const request = dwarfSampleRequest(HERCULES, -2.41, 1)!;
    expect(request.stars).toBeLessThan(SAMPLE_BUDGET);
    const sample = sampleDwarfGalaxy(request);
    const { rows } = clusterPopulation(-2.41);
    expect(sample.allV).toBeGreaterThan(rows[rows.length - 1]![0]);
    expect(Math.abs(sample.count - request.stars)).toBeLessThan(5 * Math.sqrt(request.stars));
  });

  it('Fornax within the budget: its brightest everywhere, and what shows from its centre', () => {
    const request = dwarfSampleRequest(FORNAX, -0.99, 2)!;
    expect(request.stars).toBeGreaterThan(1e8);
    const { allV, limitV } = dwarfSampleLimits(request);
    // Its giants, at least, wherever they are.
    expect(allV).toBeGreaterThan(0);
    expect(limitV).toBeLessThanOrEqual(7.5);
    const sample = sampleDwarfGalaxy(request);
    expect(sample.count).toBeLessThan(1.1 * SAMPLE_BUDGET);
    expect(sample.count).toBeGreaterThan(0.5 * SAMPLE_BUDGET);
    let everywhere = 0;
    for (let i = 0; i < sample.count; i += 1) {
      const r = Math.hypot(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!);
      const m = sample.absoluteV[i]!;
      expect(m < allV || m + 5 * (Math.log10(Math.max(r, 0.1)) - 1) < limitV).toBe(true);
      if (m < allV) everywhere += 1;
    }
    expect(Math.abs(everywhere - SAMPLE_BUDGET / 2)).toBeLessThan(0.05 * SAMPLE_BUDGET);
  });
});

describe('the light left a glow', () => {
  it('is all of it when no star is drawn, none when every star is', () => {
    expect(lightFainterThan(-2.41, brightestStarV(-2.41))).toBeCloseTo(1, 12);
    expect(lightFainterThan(-2.41, 30)).toBeCloseTo(0, 12);
  });

  it('is what the stars fainter than the limit give', () => {
    const { rows } = clusterPopulation(-1.0);
    const light = (mv: number, share: number): number => share * 10 ** (-0.4 * (mv + CLUSTER_LF_STEP / 2 - SUN_V));
    const total = rows.reduce((sum, [mv, share]) => sum + light(mv, share), 0);
    // At a bin's edge, exactly the bins below it.
    const edge = rows[20]![0];
    const fainter = rows.filter(([mv]) => mv >= edge).reduce((sum, [mv, share]) => sum + light(mv, share), 0);
    expect(lightFainterThan(-1.0, edge)).toBeCloseTo(fainter / total, 12);
    // Falls as the limit gets fainter.
    expect(lightFainterThan(-1.0, 0)).toBeLessThan(lightFainterThan(-1.0, -1));
  });
});
