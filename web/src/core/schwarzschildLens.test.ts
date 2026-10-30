import { describe, expect, it } from 'vitest';

import { PARSEC_KM } from '../scene/scale.ts';
import { schwarzschildRadiusKm, SGR_A_DISTANCE_PC, SGR_A_MASS_SUN } from './blackHoles.ts';
import {
  buildLensTables,
  carlsonRF,
  CRITICAL_IMPACT,
  deflectionReach,
  deflectionSeen,
  escapeAngle,
  farEinsteinAngle,
  orbitCubic,
  shadowAngle,
  shadowSphereRadius,
  strongFieldDeflection,
  STRONG_FIELD_B,
  sweptAngle,
  tableDeflection,
  tableImage,
  totalDeflection,
  turningRoots,
  weakFieldDeflection,
} from './schwarzschildLens.ts';

/** Composite Simpson, for integrands with no singularity on [a, b]. */
function simpson(f: (u: number) => number, a: number, b: number, n = 20_000): number {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i += 1) {
    sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  }
  return (sum * h) / 3;
}

/**
 * The orbit equation u'' + u = 1.5 u^2 stepped with classical Runge-Kutta from the camera,
 * u = 1/r, until u = 0: the angle swept, independent of every elliptic integral.
 */
function sweptByOrbitEquation(theta: number, r: number, h = 2e-4): number {
  const b = (r * Math.sin(theta)) / Math.sqrt(1 - 1 / r);
  let u = 1 / r;
  let v = (theta < Math.PI / 2 ? 1 : -1) * Math.sqrt(Math.max(0, orbitCubic(u, b)));
  let phi = 0;
  const accel = (x: number): number => 1.5 * x * x - x;
  for (let step = 0; step < 10_000_000; step += 1) {
    const k1u = v;
    const k1v = accel(u);
    const k2u = v + (h / 2) * k1v;
    const k2v = accel(u + (h / 2) * k1u);
    const k3u = v + (h / 2) * k2v;
    const k3v = accel(u + (h / 2) * k2u);
    const k4u = v + h * k3v;
    const k4v = accel(u + h * k3u);
    const nextU = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    const nextV = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (nextU <= 0) {
      return phi + (h * u) / (u - nextU);
    }
    u = nextU;
    v = nextV;
    phi += h;
  }
  return NaN;
}

describe('the elliptic integrals', () => {
  it("Carlson's R_F matches his published test values", () => {
    // Carlson 1995, Numer. Algorithms 10, 13, section 3.
    expect(carlsonRF(1, 2, 0)).toBeCloseTo(1.3110287771461, 12);
    expect(carlsonRF(2, 3, 4)).toBeCloseTo(0.58408284167715, 12);
  });

  it('the swept angle agrees with direct quadrature, three real roots and one', () => {
    for (const b of [3, 4, 10, 50]) {
      const { u0 } = turningRoots(b);
      const x = u0 * 0.7;
      const direct = simpson((u) => 1 / Math.sqrt(orbitCubic(u, b)), 0, x);
      expect(Math.abs(sweptAngle(b, 0, x) - direct)).toBeLessThan(1e-10);
    }
    for (const b of [0.5, 1, 2, 2.5]) {
      const x = 0.6;
      const direct = simpson((u) => 1 / Math.sqrt(orbitCubic(u, b)), 0, x);
      expect(Math.abs(sweptAngle(b, 0, x) - direct)).toBeLessThan(1e-10);
    }
  });

  it('the turning point is a root of the cubic, even a million r_s out', () => {
    for (const b of [2.6, 3, 10, 1e3, 1e6]) {
      const { u1, u0, u3 } = turningRoots(b);
      expect(Math.abs(orbitCubic(u0, b)) * b * b).toBeLessThan(1e-9);
      expect(u1).toBeLessThan(0);
      expect(u0).toBeLessThanOrEqual(2 / 3);
      expect(u3).toBeGreaterThanOrEqual(2 / 3);
    }
  });
});

describe('the total deflection, camera and source at infinity', () => {
  it('is the weak field far out: within 1% of 2 r_s / b at 1000 r_s, and of the series to 1e-8', () => {
    const alpha = totalDeflection(1000);
    expect(Math.abs(alpha / (2 / 1000) - 1)).toBeLessThan(0.01);
    expect(Math.abs(alpha / weakFieldDeflection(1000) - 1)).toBeLessThan(1e-8);
    expect(Math.abs(totalDeflection(100) / weakFieldDeflection(100) - 1)).toBeLessThan(1e-5);
  });

  it('diverges logarithmically at b_c = sqrt(27)/2, as Darwin and Bozza give it', () => {
    expect(CRITICAL_IMPACT).toBeCloseTo(2.598076211, 9);
    expect(STRONG_FIELD_B).toBeCloseTo(-0.4002, 4);
    for (const epsilon of [1e-4, 1e-6, 1e-9]) {
      const b = CRITICAL_IMPACT * (1 + epsilon);
      expect(Math.abs(totalDeflection(b) - strongFieldDeflection(b))).toBeLessThan(30 * epsilon * Math.log(1 / epsilon) + 1e-6);
    }
    // Three times round and more, a hair outside the photon sphere's orbit.
    expect(totalDeflection(CRITICAL_IMPACT * (1 + 1e-12))).toBeGreaterThan(27);
  });

  it('falls monotonically with b', () => {
    let previous = Infinity;
    for (let k = 0; k <= 400; k += 1) {
      const b = CRITICAL_IMPACT * (1 + Math.exp(-20 + (k * 30) / 400));
      const alpha = totalDeflection(b);
      expect(alpha).toBeLessThan(previous);
      previous = alpha;
    }
  });

  it('at b = 3 r_s and 5 r_s, agrees with the orbit equation stepped from far away', () => {
    // A camera a million r_s out looking just past the hole is a ray from infinity.
    const r = 1e6;
    for (const b of [3, 5]) {
      const theta = Math.asin((b * Math.sqrt(1 - 1 / r)) / r);
      // From the camera in to periapsis and out: the whole bend, less the camera's share.
      const swept = escapeAngle(theta, r);
      expect(Math.abs(swept - sweptByOrbitEquation(theta, r, 1e-4))).toBeLessThan(1e-6);
      expect(Math.abs(deflectionSeen(theta, r) - totalDeflection(b))).toBeLessThan(2e-5);
    }
    // For the record: the bend at 3 r_s is 1.7194 rad, 98.5 degrees.
    expect(totalDeflection(3)).toBeCloseTo(1.7194, 4);
  });
});

describe('from a camera at a finite distance', () => {
  it('follows the orbit equation stepped from the camera, in and out', () => {
    for (const [r, thetaDeg] of [
      [3, 60],
      [10, 30],
      [10, 120],
      [59, 5],
      [59, 170],
      [1.3, 150],
    ] as const) {
      const theta = (thetaDeg * Math.PI) / 180;
      expect(Math.abs(escapeAngle(theta, r) - sweptByOrbitEquation(theta, r))).toBeLessThan(2e-6);
    }
  });

  it("captures exactly inside Synge's shadow, from outside the photon sphere and from inside", () => {
    for (const r of [1.2, 1.45, 2, 3, 59, 1e4]) {
      const edge = shadowAngle(r);
      expect(escapeAngle(edge * (1 - 1e-9), r)).toBeNaN();
      expect(Number.isFinite(escapeAngle(edge * (1 + 1e-9), r))).toBe(true);
    }
    // At the photon sphere the shadow is exactly half the sky.
    expect(shadowAngle(1.5)).toBeCloseTo(Math.PI / 2, 9);
    // And the sphere drawn for it subtends it.
    for (const r of [2, 10, 1e3]) {
      expect(Math.asin(shadowSphereRadius(r) / r)).toBeCloseTo(shadowAngle(r), 12);
    }
  });

  it('puts the Einstein ring where the lens equation does, far out', () => {
    for (const r of [1e4, 1e6]) {
      const tables = buildLensTables(r);
      expect(Math.abs(tables.einsteinAngle / farEinsteinAngle(r) - 1)).toBeLessThan(3 / Math.sqrt(r));
      // The point straight behind the hole is seen there: deflected by its own angle, to the
      // table's interpolation.
      expect(Math.abs(deflectionSeen(tables.einsteinAngle, r) / tables.einsteinAngle - 1)).toBeLessThan(2e-5);
    }
  });

  it("gives a point source the textbook magnifications, far out", () => {
    // Paczynski 1986: for a source u Einstein radii off the axis, the two images are
    // magnified by (u^2 + 2) / (2 u sqrt(u^2 + 4)) +- 1/2.
    const tables = buildLensTables(1e6);
    for (const u of [0.5, 1, 3]) {
      const y = u * tables.einsteinAngle;
      const total = (u * u + 2) / (u * Math.sqrt(u * u + 4));
      const primary = 10 ** tableImage(tables, y).log10Mu;
      const secondary = 10 ** tableImage(tables, -y).log10Mu;
      expect(primary).toBeCloseTo(total / 2 + 0.5, 2);
      expect(secondary).toBeCloseTo(total / 2 - 0.5, 2);
    }
  });
});

describe('the tables', () => {
  for (const r of [1.3, 3, 59, 3e4, 3e6]) {
    it(`hold the deflection and the images to well under a pixel, camera at ${r} r_s`, () => {
      const tables = buildLensTables(r);
      for (let k = 1; k < 60; k += 1) {
        const theta = tables.shadowAngle * (1 + Math.exp(-12 + ((k / 60) * (tables.xMax + 12))));
        const exact = deflectionSeen(theta, r);
        // 3e-5 of the deflection, or a hundredth of a pixel at 2,250 px per radian.
        expect(Math.abs(tableDeflection(tables, theta) - exact)).toBeLessThan(Math.max(3e-5 * exact, 4.4e-6));
      }
      for (const y of [-3, -1, -0.1, -1e-3, 1e-3, 0.1, 1, 3]) {
        const { theta } = tableImage(tables, y);
        if (theta > tables.shadowAngle * (1 + Math.exp(-14))) {
          // Off by the error in y over the slope of y in theta: in angle on the sky.
          const g = (t: number): number => t - deflectionSeen(t, r);
          const slope = (g(theta * (1 + 1e-7)) - g(theta * (1 - 1e-7))) / (2e-7 * theta);
          expect(Math.abs(g(theta) - y) / slope).toBeLessThan(4.4e-6);
        }
      }
    });
  }

  it('reach no farther than the deflection is worth drawing', () => {
    const tables = buildLensTables(1e5);
    const reach = deflectionReach(tables, 1e-4);
    expect(deflectionSeen(reach * 1.01, 1e5)).toBeLessThan(1e-4);
    expect(deflectionSeen(reach * 0.99, 1e5)).toBeGreaterThan(1e-4);
  });
});

describe('Sgr A*', () => {
  it("has a shadow 53 microarcseconds across from here, the EHT's ring within its error", () => {
    const rs = schwarzschildRadiusKm(SGR_A_MASS_SUN);
    const distance = SGR_A_DISTANCE_PC * PARSEC_KM;
    const microarcsec = (radians: number): number => (radians * 180 * 3600e6) / Math.PI;
    const diameter = microarcsec(2 * shadowAngle(distance / rs));
    expect(diameter).toBeCloseTo(53.3, 1);
    // EHT Collaboration 2022, ApJL 930, L12: the ring is 51.8 +- 2.3 uas.
    expect(Math.abs(diameter - 51.8)).toBeLessThan(2.3);
  });
});
