import { describe, expect, it } from 'vitest';

import { directionToGalactic, GALACTIC_BASIS } from '../scene/galactic.ts';
import {
  ARM_EXTENSION_DEG,
  ARM_TAPER_DEG,
  armTaper,
  DUST_DISC,
  sampleDust,
  armLabelPoints,
  armRadiusKpc,
  armWidthKpc,
  CENSUS_RADIUS_PC,
  galacticCentrePc,
  galactocentricToSun,
  LONG_BAR,
  POPULATION,
  POPULATIONS,
  R0_PC,
  sampleMilkyWay,
  SPIRAL_ARMS,
  SUN_ABOVE_PLANE_PC,
} from './milkyWay.ts';

const DEG = Math.PI / 180;
const arm = (name: string) => SPIRAL_ARMS.find((entry) => entry.name === name)!;

describe('the spiral arms, Reid et al. 2019 Table 2', () => {
  it('carries the table as published', () => {
    expect(SPIRAL_ARMS).toHaveLength(7);
    // Two rows, every column: the Sun's own arm and the one past it.
    expect(arm('Local Arm')).toMatchObject({ betaMinDeg: -8, betaMaxDeg: 34, betaKinkDeg: 9, rKinkKpc: 8.26, pitchBeforeDeg: 11.4, pitchAfterDeg: 11.4, widthKpc: 0.31 });
    expect(arm('Perseus Arm')).toMatchObject({ betaMinDeg: -23, betaMaxDeg: 115, betaKinkDeg: 40, rKinkKpc: 8.87, pitchBeforeDeg: 10.3, pitchAfterDeg: 8.7, widthKpc: 0.35 });
    expect(R0_PC).toBe(8150);
  });

  it('passes through its kink at the kink radius', () => {
    for (const spiral of SPIRAL_ARMS) {
      expect(armRadiusKpc(spiral, spiral.betaKinkDeg)).toBeCloseTo(spiral.rKinkKpc, 12);
    }
  });

  it('puts the arms where they are known to be along the Sun-centre line', () => {
    // At beta = 0, toward the centre and away: the Local Arm just outside the Sun's circle,
    // Sagittarius-Carina 1.3 kpc inside it, Perseus 1.9 kpc outside -- the picture every
    // map of the Galaxy since the masers has drawn.
    expect(armRadiusKpc(arm('Local Arm'), 0) * 1000 - R0_PC).toBeCloseTo(380, -1);
    expect(R0_PC - armRadiusKpc(arm('Sagittarius–Carina Arm'), 0) * 1000).toBeGreaterThan(1100);
    expect(R0_PC - armRadiusKpc(arm('Sagittarius–Carina Arm'), 0) * 1000).toBeLessThan(1500);
    expect(armRadiusKpc(arm('Perseus Arm'), 0) * 1000 - R0_PC).toBeGreaterThan(1700);
    expect(armRadiusKpc(arm('Perseus Arm'), 0) * 1000 - R0_PC).toBeLessThan(2100);
  });

  it('winds inward with rotation, as trailing arms do', () => {
    // Positive pitch: the radius falls as beta grows in the direction of rotation.
    const perseus = arm('Perseus Arm');
    expect(armRadiusKpc(perseus, 60)).toBeLessThan(armRadiusKpc(perseus, 20));
  });

  it('widens at 42 pc per kpc of radius', () => {
    const local = arm('Local Arm');
    expect(armWidthKpc(local, local.rKinkKpc + 1)).toBeCloseTo(0.31 + 0.042, 12);
  });
});

describe('the frame', () => {
  it('puts beta = 0 at the Sun and moves along +y with rotation', () => {
    const [x, y] = galactocentricToSun(R0_PC, 0);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(galactocentricToSun(R0_PC, 10)[1]).toBeGreaterThan(0);
  });

  it('runs the plane 25 pc below the Sun and through Sagittarius A*', () => {
    expect(galactocentricToSun(R0_PC, 0)[2]).toBeCloseTo(-SUN_ABOVE_PLANE_PC, 9);
    const [x, y, z] = galacticCentrePc();
    expect(x).toBe(R0_PC);
    expect(y).toBe(0);
    // Sgr A* at b = -0.046 deg.
    expect(Math.atan2(z, x) / DEG).toBeCloseTo(-0.046, 6);
  });

  it('lands the centre at l = 0 through the IAU frame', () => {
    const [x, y, z] = galacticCentrePc();
    const { x: ex, y: ey, z: ez } = GALACTIC_BASIS;
    const ecliptic = {
      x: ex.x * x + ey.x * y + ez.x * z,
      y: ex.y * x + ey.y * y + ez.y * z,
      z: ex.z * x + ey.z * y + ez.z * z,
    };
    const galactic = directionToGalactic(ecliptic);
    expect(Math.min(galactic.longitudeDeg, 360 - galactic.longitudeDeg)).toBeLessThan(1e-9);
    expect(galactic.latitudeDeg).toBeCloseTo(-0.046, 6);
  });
});

describe('the sample', () => {
  const count = 60_000;
  const sample = sampleMilkyWay(count);

  it('is the same on every load', () => {
    const again = sampleMilkyWay(count);
    expect(again.positions).toEqual(sample.positions);
    expect(again.populations).toEqual(sample.populations);
  });

  it('leaves the census to the real stars', () => {
    for (let i = 0; i < count; i += 1) {
      const d = Math.hypot(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!);
      expect(d).toBeGreaterThanOrEqual(CENSUS_RADIUS_PC);
    }
  });

  it('draws each population in its share', () => {
    const counts = new Array<number>(POPULATIONS.length).fill(0);
    for (const population of sample.populations) counts[population]! += 1;
    POPULATIONS.forEach((population, index) => {
      expect(counts[index]! / count).toBeCloseTo(population.share, 1);
    });
  });

  it('thins out the thin disc with its scale length and height', () => {
    // A radius drawn as R e^(-R/h) has mean 2h; a height e^(-|z|/h) has mean |z| = h.
    let radiusSum = 0;
    let heightSum = 0;
    let n = 0;
    for (let i = 0; i < count; i += 1) {
      if (sample.populations[i] !== POPULATION.thinDisc) continue;
      const x = sample.positions[i * 3]!;
      const y = sample.positions[i * 3 + 1]!;
      const z = sample.positions[i * 3 + 2]!;
      radiusSum += Math.hypot(R0_PC - x, y);
      heightSum += Math.abs(z - (-SUN_ABOVE_PLANE_PC + (x / R0_PC) * (R0_PC * Math.tan(-0.046 * DEG) + SUN_ABOVE_PLANE_PC)));
      n += 1;
    }
    expect(radiusSum / n / 2600).toBeCloseTo(2, 1);
    expect(heightSum / n / 300).toBeCloseTo(1, 1);
  });

  it('lays the arm points along their spirals', () => {
    // Every arm point within a few widths of some arm at its azimuth.
    let checked = 0;
    for (let i = 0; i < count && checked < 2000; i += 1) {
      if (sample.populations[i] !== POPULATION.arm) continue;
      const x = sample.positions[i * 3]!;
      const y = sample.positions[i * 3 + 1]!;
      const radius = Math.hypot(R0_PC - x, y) / 1000;
      const beta = Math.atan2(y, R0_PC - x) / DEG;
      const nearest = Math.min(
        ...SPIRAL_ARMS.flatMap((spiral) =>
          [-360, 0, 360].map((turn) => {
            const b = beta + turn;
            if (b < spiral.betaMinDeg - ARM_EXTENSION_DEG - 5 || b > spiral.betaMaxDeg + ARM_EXTENSION_DEG + 5) return Infinity;
            return Math.abs(armRadiusKpc(spiral, b) - radius) / armWidthKpc(spiral, radius);
          }),
        ),
      );
      expect(nearest).toBeLessThan(6);
      checked += 1;
    }
    expect(checked).toBe(2000);
  });

  it('puts the bar’s near end at positive longitudes', () => {
    // Bland-Hawthorn & Gerhard 2016: the near end of the bar is in the first quadrant.
    let nearSide = 0;
    let nearAndPositive = 0;
    for (let i = 0; i < count; i += 1) {
      if (sample.populations[i] !== POPULATION.bar) continue;
      const x = sample.positions[i * 3]!;
      const y = sample.positions[i * 3 + 1]!;
      if (x < R0_PC - 0.5 * LONG_BAR.halfLengthPc * Math.cos(LONG_BAR.angleDeg * DEG)) {
        nearSide += 1;
        if (y > 0) nearAndPositive += 1;
      }
    }
    expect(nearAndPositive / nearSide).toBeGreaterThan(0.9);
  });
});

describe('the labels', () => {
  it('name every arm, in the middle of its measured stretch', () => {
    const labels = armLabelPoints();
    expect(labels.map((label) => label.name)).toEqual(SPIRAL_ARMS.map((spiral) => spiral.name));
    const local = labels.find((label) => label.name === 'Local Arm')!;
    // The Local Arm's middle is a kiloparsec or so from the Sun.
    expect(Math.hypot(...local.position)).toBeLessThan(2500);
  });
});

describe('the arms past their parallaxes', () => {
  it('fade out rather than stop', () => {
    const local = arm('Local Arm');
    expect(armTaper(local, 10)).toBe(1);
    expect(armTaper(local, local.betaMaxDeg)).toBe(1);
    expect(armTaper(local, local.betaMaxDeg + ARM_TAPER_DEG)).toBeCloseTo(Math.exp(-0.5), 12);
    expect(armTaper(local, local.betaMinDeg - 90)).toBeLessThan(0.05);
  });
});

describe('the dust, Drimmel & Spergel 2001', () => {
  const count = 30_000;
  const dust = sampleDust(count);

  it('carries their disc as published', () => {
    expect(DUST_DISC).toEqual({ scaleLengthPc: 2260, scaleHeightPc: 134.4, flarePcPerKpc: 14.8, flareFromKpc: 4.4 });
  });

  it('is the same on every load, and stays out of the census', () => {
    expect(sampleDust(count)).toEqual(dust);
    for (let i = 0; i < count; i += 1) {
      expect(Math.hypot(dust[i * 3]!, dust[i * 3 + 1]!, dust[i * 3 + 2]!)).toBeGreaterThanOrEqual(CENSUS_RADIUS_PC);
    }
  });

  it('keeps to a thin layer and has their hole in the middle', () => {
    let inHole = 0;
    let nearHalf = 0;
    let thin = 0;
    for (let i = 0; i < count; i += 1) {
      const x = dust[i * 3]!;
      const y = dust[i * 3 + 1]!;
      const z = dust[i * 3 + 2]! + SUN_ABOVE_PLANE_PC;
      const radius = Math.hypot(R0_PC - x, y);
      if (radius < 1000) inHole += 1;
      if (radius > 3500 && radius < 4500) nearHalf += 1;
      if (Math.abs(z) < 600) thin += 1;
    }
    // A sech^2 layer 134 pc thick, flaring outward: nearly all of it within 600 pc.
    expect(thin / count).toBeGreaterThan(0.95);
    // Within a kiloparsec of the centre the hole has taken almost everything.
    expect(inHole).toBeLessThan(nearHalf / 20);
  });
});
