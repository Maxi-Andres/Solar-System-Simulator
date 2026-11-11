import { describe, expect, it } from 'vitest';

import { SUN_ABSOLUTE_V } from './globularClusters.ts';
import {
  CLUSTER_EDGE_PC,
  FLATTENING,
  massWithin,
  sampleMagnitudeLimit,
  sampleNuclearCluster,
} from './nuclearCluster.ts';
import {
  CLUSTER_LUMINOSITY_V,
  clusterExposure,
  column,
  exposureWeight,
  FAINT_TABLE,
  FAINT_TABLE_FROM,
  FAINT_TABLE_STEP,
  faintLightShare,
  faintShareFromTable,
  glowMeteredExposure,
  LIGHT_PER_SOLAR_MASS,
  luminosityDensity,
  meanColumn,
  MIDDLE_GREY_X,
  nthBrightestMagnitude,
  POPULATION_COLOUR_INDEX,
  starsMeteredExposure,
} from './nuclearClusterLight.ts';

/**
 * The nuclear star cluster's light: its luminosity function's light, the glow that holds
 * what the stars drawn leave out -- the two together the model's light, once -- and the
 * meters its exposure is set by, held to the surface brightness the model gives.
 */

/** mag/arcsec^2 of a column in L_Sun/pc^2. */
function mu(columnLPerPc2: number): number {
  return SUN_ABSOLUTE_V + 21.572 - 2.5 * Math.log10(columnLPerPc2);
}

/** A seeded uniform generator for the integrals below. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('the population’s light', () => {
  it('is 0.35 L_Sun in V per solar mass of living stars: 8.7 million suns for the cluster', () => {
    // An old, slightly metal-rich population: M/L_V about 3 (Maraston 2005 gives 3 to 4 at 10 Gyr
    // with its remnants, which this leaves out).
    expect(LIGHT_PER_SOLAR_MASS).toBeGreaterThan(0.3);
    expect(LIGHT_PER_SOLAR_MASS).toBeLessThan(0.4);
    expect(CLUSTER_LUMINOSITY_V).toBeGreaterThan(8e6);
    expect(CLUSTER_LUMINOSITY_V).toBeLessThan(9.5e6);
    // An old population's integrated colour: B-V about 0.9 to 1.0.
    expect(POPULATION_COLOUR_INDEX).toBeGreaterThan(0.85);
    expect(POPULATION_COLOUR_INDEX).toBeLessThan(1.05);
  });

  it('is all in stars fainter than M_V -2 and none in stars fainter than M_V 20, and falls between', () => {
    expect(faintLightShare(-2)).toBeCloseTo(1, 6);
    expect(faintLightShare(-Infinity)).toBe(1);
    expect(faintLightShare(20)).toBeCloseTo(0, 6);
    let previous = 1;
    for (let limit = -2; limit <= 20; limit += 0.25) {
      const share = faintLightShare(limit);
      expect(share).toBeLessThanOrEqual(previous + 1e-12);
      previous = share;
    }
    // The giants hold a quarter of it, the red clump and the giant branch above it.
    expect(1 - faintLightShare(1)).toBeGreaterThan(0.15);
    expect(1 - faintLightShare(1)).toBeLessThan(0.35);
  });

  it('is read by the shader from a table that is the function at its points and within 2% of the light between', () => {
    for (let k = 0; k < FAINT_TABLE.length; k += 1) {
      expect(FAINT_TABLE[k]!).toBeCloseTo(faintLightShare(FAINT_TABLE_FROM + k * FAINT_TABLE_STEP), 6);
    }
    for (let limit = -2; limit < 19; limit += 0.13) {
      // The red clump is a step a tenth of a magnitude wide: between two points 0.2 apart the
      // line misses it by a percent or two of the light.
      expect(Math.abs(faintShareFromTable(limit) - faintLightShare(limit))).toBeLessThan(0.02);
    }
  });
});

describe('the glow and the stars', () => {
  const sample = sampleNuclearCluster();

  it('hold the model’s light once: the sample’s stars and the light of those it leaves out add to the whole', () => {
    // The sample's light, star by star.
    let stars = 0;
    for (let i = 0; i < sample.count; i += 1) {
      stars += 10 ** (-0.4 * (sample.absoluteV[i]! - SUN_ABSOLUTE_V));
    }
    // The glow's, with no limit from the camera: the luminosity in each ellipsoidal shell
    // times the faint share at the sample's limit there, averaged over the shell as the
    // sampler places its stars, at their own distances from the hole.
    const random = generator(7);
    const shells = 400;
    const lo = Math.log(1e-4);
    const hi = Math.log(CLUSTER_EDGE_PC);
    let glow = 0;
    for (let k = 0; k < shells; k += 1) {
      const inner = Math.exp(lo + ((hi - lo) * k) / shells);
      const outer = Math.exp(lo + ((hi - lo) * (k + 1)) / shells);
      const m = Math.sqrt(inner * outer);
      let share = 0;
      const points = 48;
      for (let j = 0; j < points; j += 1) {
        const cz = 2 * random() - 1;
        const radius = m * Math.sqrt(1 - cz * cz + (cz * FLATTENING) ** 2);
        share += faintLightShare(sampleMagnitudeLimit(radius));
      }
      glow += (massWithin(outer) - massWithin(inner)) * LIGHT_PER_SOLAR_MASS * (share / points);
    }
    const inside = (massWithin(CLUSTER_EDGE_PC) - massWithin(1e-4)) * LIGHT_PER_SOLAR_MASS;
    // The stars hold 40% of it, and the two together all of it, to the sample's noise.
    expect(stars / inside).toBeGreaterThan(0.35);
    expect(stars / inside).toBeLessThan(0.45);
    expect(Math.abs((stars + glow) / inside - 1)).toBeLessThan(0.02);
  }, 60_000);

  it('holds the model’s whole light, tapered edge and all, as its lines of sight sum it from afar: within 2%', () => {
    // From 1 kpc along x, each line of sight's column times the area it stands for, over the
    // projected ellipse: polar in (y, z / q), log-spaced in radius from the hole outward.
    const far = 1000;
    const rings = 160;
    const turns = 24;
    const lo = Math.log(1e-5);
    const hi = Math.log(CLUSTER_EDGE_PC);
    let light = 0;
    for (let i = 0; i < rings; i += 1) {
      const b0 = Math.exp(lo + ((hi - lo) * i) / rings);
      const b1 = Math.exp(lo + ((hi - lo) * (i + 1)) / rings);
      const b = Math.sqrt(b0 * b1);
      for (let j = 0; j < turns; j += 1) {
        const phi = (2 * Math.PI * (j + 0.5)) / turns;
        const y = b * Math.cos(phi);
        const z = FLATTENING * b * Math.sin(phi);
        light += column([-far, y, z], [1, 0, 0], undefined, 128) * FLATTENING * b * (b1 - b0) * ((2 * Math.PI) / turns);
      }
    }
    // Inside the first ring, the cusp's column (r^-1.13 projects to b^-0.13): the rest.
    light += (column([-far, 1e-5, 0], [1, 0, 0], undefined, 128) * FLATTENING * Math.PI * 1e-10) / 0.935;
    expect(Math.abs(light / CLUSTER_LUMINOSITY_V - 1)).toBeLessThan(0.02);
    // And the density, shell by shell, the same: 4 pi q m^2 rho dm.
    let shells = 0;
    const n = 4000;
    const from = Math.log(1e-6);
    const to = Math.log(CLUSTER_EDGE_PC * 1.01);
    for (let k = 0; k < n; k += 1) {
      const m = Math.exp(from + ((to - from) * (k + 0.5)) / n);
      shells += 4 * Math.PI * FLATTENING * m ** 3 * luminosityDensity(m) * ((to - from) / n);
    }
    expect(Math.abs(shells / CLUSTER_LUMINOSITY_V - 1)).toBeLessThan(0.02);
  });

  it('integrates a line of sight as finely stepped sums do: within 2%, through the cusp and past it', () => {
    // Its 32 steps against 20,000 of the same, where the line passes close to the hole, and
    // against plain steps in distance where it does not.
    const fine = (camera: readonly [number, number, number], d: readonly [number, number, number]): number => {
      let sum = 0;
      const n = 20000;
      const lo = Math.log(1e-7);
      const hi = Math.log(200);
      for (let k = 0; k < n; k += 1) {
        const t0 = Math.exp(lo + ((hi - lo) * k) / n);
        const t1 = Math.exp(lo + ((hi - lo) * (k + 1)) / n);
        const t = Math.sqrt(t0 * t1);
        const x = camera[0] + d[0] * t;
        const y = camera[1] + d[1] * t;
        const z = camera[2] + d[2] * t;
        const m = Math.hypot(x, y, z / FLATTENING);
        if (m < CLUSTER_EDGE_PC) sum += luminosityDensity(m) * (t1 - t0);
      }
      return sum;
    };
    const cases: [readonly [number, number, number], readonly [number, number, number]][] = [
      [[0.3, -50, 0], [0, 1, 0]],
      [[4.2, -50, 0], [0, 1, 0]],
      [[2, 0, 0], [1, 0, 0]],
      [[1, 3, -8], [0, -0.6, 0.8]],
    ];
    for (const [camera, d] of cases) {
      const exact = fine(camera, d);
      expect(Math.abs(column(camera, d) / exact - 1), `from ${camera.join(', ')}`).toBeLessThan(0.02);
    }
    const close: [readonly [number, number, number], readonly [number, number, number]][] = [
      [[0.001, 0, -50], [0, 0, 1]],
      [[1e-5, -50, 0], [0, 1, 0]],
      [[0.01, 0, 0], [0, 0.6, 0.8]],
      [[1e-4, 0, 0], [1, 0, 0]],
    ];
    for (const [camera, d] of close) {
      const exact = column(camera, d, undefined, 20_000);
      expect(Math.abs(column(camera, d) / exact - 1), `from ${camera.join(', ')}`).toBeLessThan(0.02);
    }
  });

  it('is the cluster’s surface brightness seen from outside: 11 mag/arcsec^2 at its centre, 14.6 at its half-light radius', () => {
    expect(mu(column([0.01, -100, 0], [0, 1, 0]))).toBeCloseTo(11.1, 0);
    expect(Math.abs(mu(column([4.2, -100, 0], [0, 1, 0])) - 14.6)).toBeLessThan(0.3);
    expect(mu(column([15, -100, 0], [0, 1, 0]))).toBeGreaterThan(19);
  });
});

describe('the meters', () => {
  const sample = sampleNuclearCluster();

  it('read the sky from Sgr A* as 11 mag/arcsec^2, and the cluster from outside as the same 16.3 from any distance', () => {
    expect(mu(meanColumn([1e-4, 0, 0]))).toBeCloseTo(11.0, 0);
    for (const d of [30, 100, 300]) {
      expect(Math.abs(mu(meanColumn([d, 0, 0])) - 16.3), `at ${d} pc`).toBeLessThan(0.2);
    }
  });

  it('put the sky from Sgr A* to the depth of the sky from the Sun: its 25,723rd star at V -3.3', () => {
    const nth = nthBrightestMagnitude(sample, [1e-4, 0, 0], 25_723);
    expect(nth).toBeCloseTo(-3.3, 0);
    // Read over every eighth star, as drawn, the same within a tenth.
    expect(Math.abs(nthBrightestMagnitude(sample, [1e-4, 0, 0], 25_723, 0, 8) - nth)).toBeLessThan(0.1);
    // 11 magnitudes shorter than the Sun's for a catalogue to V 8.
    expect(starsMeteredExposure(nth, 8)).toBeCloseTo(11.3, 0);
  }, 30_000);

  it('set the glow so its mean is at middle grey, and neither exposure longer than the Sun’s', () => {
    const white = 100;
    const exposure = glowMeteredExposure(white * MIDDLE_GREY_X, white);
    expect(exposure).toBeCloseTo(0, 10);
    expect(1 - Math.exp(-MIDDLE_GREY_X)).toBeCloseTo(0.18, 10);
    expect(clusterExposure(-3, -5, 1)).toEqual({ stars: 0, glow: 0 });
    expect(clusterExposure(11, 9, 1)).toEqual({ stars: 11, glow: 11 });
    expect(clusterExposure(2, 6, 0.5)).toEqual({ stars: 1, glow: 3 });
  });

  it('are taken in full from a half-light radius of 30 pixels and not at all below 3', () => {
    expect(exposureWeight(1)).toBe(0);
    expect(exposureWeight(3)).toBe(0);
    expect(exposureWeight(30)).toBe(1);
    expect(exposureWeight(300)).toBe(1);
    expect(exposureWeight(9.5)).toBeGreaterThan(0.3);
    expect(exposureWeight(9.5)).toBeLessThan(0.7);
  });
});
