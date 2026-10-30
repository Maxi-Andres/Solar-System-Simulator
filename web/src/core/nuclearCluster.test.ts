import { describe, expect, it } from 'vitest';

import { R0_PC } from './milkyWay.ts';
import {
  cameraExtinctionV,
  candidateCount,
  CENTRE_EXTINCTION_V,
  CLUSTER_EDGE_PC,
  CLUSTER_MASS,
  FLATTENING,
  massWithin,
  sampleMagnitudeLimit,
  sampleNuclearCluster,
  SAMPLE_COUNT,
  SAMPLE_LIMIT_V,
  shareBrighterThan,
} from './nuclearCluster.ts';
import { DWARF_ROWS, EVOLVED_BY_K, EVOLVED_ROWS, STARS_PER_SOLAR_MASS } from './nuclearClusterPopulation.ts';

/**
 * The nuclear star cluster's model held to the papers it is built from: the mass inside
 * each radius against Schödel et al. 2018's own, the sample's stars where the density law
 * puts them, its luminosity function against the measured one, and the sample the same on
 * every load.
 */

/** Least-squares slope of y against x. */
function slope(points: readonly (readonly [number, number])[]): number {
  const n = points.length;
  const sx = points.reduce((sum, [x]) => sum + x, 0);
  const sy = points.reduce((sum, [, y]) => sum + y, 0);
  const sxx = points.reduce((sum, [x]) => sum + x * x, 0);
  const sxy = points.reduce((sum, [x, y]) => sum + x * y, 0);
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

describe('the density law', () => {
  it('holds the masses Schödel et al. 2018 give inside 0.01, 0.1, 1 and 3 pc', () => {
    // Their section 4.5: 180 +- 30, 1.3e4 +- 0.1e4, 1.0e6 +- 0.1e6 (the normalisation), 7.8e6 +- 0.6e6.
    expect(Math.abs(massWithin(0.01) - 180)).toBeLessThan(30);
    expect(Math.abs(massWithin(0.1) - 1.3e4)).toBeLessThan(0.1e4);
    expect(massWithin(1)).toBeCloseTo(1e6, -2);
    expect(Math.abs(massWithin(3) - 7.8e6)).toBeLessThan(0.6e6);
  });

  it('stops where it has gathered the cluster’s 25 million solar masses, 15.7 pc out', () => {
    expect(massWithin(CLUSTER_EDGE_PC)).toBeCloseTo(CLUSTER_MASS, -4);
    expect(CLUSTER_EDGE_PC).toBeGreaterThan(15);
    expect(CLUSTER_EDGE_PC).toBeLessThan(16.5);
  });

  it('is a cusp inside the break: the mass grows as m^(3 - 1.13) close in', () => {
    const local = Math.log(massWithin(0.002) / massWithin(0.001)) / Math.log(2);
    expect(local).toBeCloseTo(3 - 1.13, 2);
  });
});

describe('the sample', () => {
  const sample = sampleNuclearCluster();

  it('is the same on every load, and another seed gives another', () => {
    const again = sampleNuclearCluster();
    expect(again.count).toBe(sample.count);
    expect(again.positions).toEqual(sample.positions);
    expect(again.absoluteV).toEqual(sample.absoluteV);
    const other = sampleNuclearCluster(SAMPLE_LIMIT_V, 7);
    expect(other.count).not.toBe(sample.count);
  }, 30_000);

  it('holds 171,739 stars, every one brighter than the cut as seen from Sgr A*', () => {
    expect(sample.count).toBe(SAMPLE_COUNT);
    expect(SAMPLE_COUNT).toBe(171_739);
    expect(sample.count).toBeLessThan(candidateCount());
    let tooFaint = 0;
    let outside = 0;
    for (let i = 0; i < sample.count; i += 1) {
      const x = sample.positions[i * 3]!;
      const y = sample.positions[i * 3 + 1]!;
      const z = sample.positions[i * 3 + 2]!;
      if (!(sample.absoluteV[i]! < sampleMagnitudeLimit(Math.hypot(x, y, z)))) tooFaint += 1;
      // Inside the ellipsoid at the edge.
      if (!(Math.hypot(x, y, z / FLATTENING) < CLUSTER_EDGE_PC * 1.0001)) outside += 1;
    }
    expect(tooFaint).toBe(0);
    expect(outside).toBe(0);
  }, 30_000);

  // A limit no star misses: the whole population inside 0.03 pc, about 6,000 stars.
  const inner = sampleNuclearCluster(60, 11, 0.03);

  it('puts every star of the inner cluster where the density law does: all of them, inside 0.03 pc', () => {
    const ms: number[] = [];
    for (let i = 0; i < inner.count; i += 1) {
      ms.push(
        Math.hypot(inner.positions[i * 3]!, inner.positions[i * 3 + 1]!, inner.positions[i * 3 + 2]! / FLATTENING),
      );
    }
    const stars = (m: number): number => (massWithin(m) - massWithin(1e-4)) * STARS_PER_SOLAR_MASS;
    expect(Math.abs(inner.count - stars(0.03))).toBeLessThan(4 * Math.sqrt(stars(0.03)));
    for (const m of [0.003, 0.01, 0.02]) {
      const within = ms.filter((value) => value < m).length;
      expect(Math.abs(within - stars(m)), `inside ${m} pc`).toBeLessThan(4 * Math.sqrt(stars(m)) + 2);
    }
  });

  it('is flattened as the cluster is, q = 0.71, about the Galactic pole', () => {
    // On the whole population: the cut, made at each star's distance from the hole, favours
    // the stars nearer it, and so the poles of each ellipsoid -- the drawn sample is rounder.
    let z = 0;
    let x = 0;
    for (let i = 0; i < inner.count; i += 1) {
      x += Math.abs(inner.positions[i * 3]!) + Math.abs(inner.positions[i * 3 + 1]!);
      z += Math.abs(inner.positions[i * 3 + 2]!);
    }
    expect(Math.abs((2 * z) / x - FLATTENING)).toBeLessThan(0.03);
  });

  it('is red giants far out and dwarfs close in, as an eye at the centre would rank them', () => {
    let farRed = 0;
    let far = 0;
    let nearRed = 0;
    let near = 0;
    for (let i = 0; i < sample.count; i += 1) {
      const r = Math.hypot(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!);
      const red = sample.absoluteV[i]! < 2.5 ? 1 : 0;
      if (r > 3) {
        far += 1;
        farRed += red;
      } else if (r < 0.03) {
        near += 1;
        nearRed += red;
      }
    }
    expect(farRed / far).toBeGreaterThan(0.95);
    expect(nearRed / near).toBeLessThan(0.05);
  });
});

describe('the population', () => {
  it('shares out all its living stars, at 3.15 a solar mass', () => {
    const total = [...DWARF_ROWS, ...EVOLVED_ROWS].reduce((sum, row) => sum + row[1], 0);
    expect(total).toBeCloseTo(1, 3);
    expect(STARS_PER_SOLAR_MASS).toBeCloseTo(3.153, 3);
    expect(shareBrighterThan(99)).toBeCloseTo(1, 6);
    expect(shareBrighterThan(-5)).toBe(0);
  });

  it('has the measured K luminosity function: 0.27 +- 0.02 dex a magnitude over the giants', () => {
    // Schödel et al. 2010: Ks 11 to 14, M_K -6.1 to -3.1 here; Gallego-Cano et al. 2018: 0.26 +- 0.02.
    const points = EVOLVED_BY_K.filter((row) => row[0] >= -6.2 && row[0] < -3.2).map(
      (row) => [row[0] + 0.05, Math.log10(row[1])] as const,
    );
    expect(Math.abs(slope(points) - 0.27)).toBeLessThan(0.03);
  });

  it('has its red clump where the cluster’s is, M_K = -1.54', () => {
    const clump = EVOLVED_BY_K.filter((row) => row[0] > -3 && row[0] < 0).reduce((best, row) =>
      row[1] > best[1] ? row : best,
    );
    expect(Math.abs(clump[0] + 0.05 - -1.54)).toBeLessThan(0.15);
  });
});

describe('the dust in front', () => {
  const centre = [8275.9, 0, -6.6] as const;

  it('is the measured 30 magnitudes from the Sun, and none from the centre', () => {
    expect(cameraExtinctionV([0, 0, 0], centre)).toBeCloseTo(CENTRE_EXTINCTION_V, 6);
    expect(cameraExtinctionV(centre, centre)).toBe(0);
  });

  it('falls as the camera closes in along the line, and is next to nothing inside the model’s hole', () => {
    let previous = Infinity;
    for (const share of [0, 0.25, 0.5, 0.75, 0.9]) {
      const camera = [centre[0] * share, 0, centre[2] * share] as const;
      const value = cameraExtinctionV(camera, centre);
      expect(value).toBeLessThan(previous);
      previous = value;
    }
    // Inside half the Sun's radius Drimmel & Spergel's disc has a hole.
    expect(cameraExtinctionV([R0_PC - 1000, 0, 0], centre)).toBeLessThan(1);
  });
});
