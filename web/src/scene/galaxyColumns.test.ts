import { describe, expect, it } from 'vitest';

import { prugnielSimien, SERSIC_REACH, sersicLightWithin, sersicUnitColumn } from '../core/localGroup.ts';
import { discColumn, sersicAtlas, sersicTable, sersicTableColumn } from './galaxyColumns.ts';

/**
 * The columns through the galaxies beyond the Local Group (galaxyColumns.ts): that the disc's
 * piecewise exponential is the integral it stands for along any ray, and exact face-on; that
 * the Prugniel-Simien table is too; and that summed over the sky from afar each holds the
 * light it is given -- the light conserved, as the dwarfs' and the giants' are.
 */

type V3 = [number, number, number];

const H = 1;
const HZ = 1 / 7.3;
/** A box big enough that what lies past it is nothing: 14 scale lengths, 14 heights. */
const BOX: V3 = [14, 14, 14 * HZ];

/** The integral along the ray by brute force: a million midpoints across the box. */
function bruteDisc(c: V3, d: V3, extent: V3, near = 0): number {
  let lo = 0;
  let hi = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const a = (-extent[i]! - c[i]!) / d[i]!;
    const b = (extent[i]! - c[i]!) / d[i]!;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  lo = Math.max(lo, near);
  if (!(hi > lo)) return 0;
  const n = 1_000_000;
  const dt = (hi - lo) / n;
  let sum = 0;
  for (let k = 0; k < n; k += 1) {
    const t = lo + (k + 0.5) * dt;
    const x = c[0] + d[0] * t;
    const y = c[1] + d[1] * t;
    const z = c[2] + d[2] * t;
    sum += Math.exp(-Math.hypot(x, y) / H - Math.abs(z) / HZ) * dt;
  }
  return sum;
}

/** A ray at inclination `i` degrees to the disc's normal, passing `offset` (in the sky plane: along the major axis and the minor) from its centre, from far off. */
function ray(iDeg: number, major: number, minor: number, far = 100): { c: V3; d: V3 } {
  const i = (iDeg * Math.PI) / 180;
  // Looking along -n where n is the normal tipped by i about the x (major) axis.
  const d: V3 = [0, Math.sin(i), -Math.cos(i)];
  // The sky's axes: x, and the minor axis e2 = (0, cos i, sin i).
  const e2: V3 = [0, Math.cos(i), Math.sin(i)];
  const c: V3 = [major - far * d[0], minor * e2[1] - far * d[1], minor * e2[2] - far * d[2]];
  return { c, d };
}

const unit = (v: V3): V3 => {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
};

describe('a disc’s column', () => {
  it('is exact face-on: 2 rho0 h_z e^(-R/h), whatever the steps', () => {
    for (const r of [0, 0.5, 2, 5]) {
      const column = discColumn([r, 0, 10], [0, 0, -1], H, HZ, BOX, 0, 3);
      const exact = 2 * HZ * (1 - Math.exp(-BOX[2] / HZ)) * Math.exp(-r / H);
      expect(column / exact).toBeCloseTo(1, 9);
    }
  });

  it('is the integral it stands for along any ray, tipped or edge-on, through the centre or off it', () => {
    let worst = 0;
    for (const i of [30, 60, 75, 85, 89, 90]) {
      for (const [major, minor] of [
        [0, 0],
        [0.3, 0],
        [0, 0.05],
        [1.5, 0.02],
        [3, 0.1],
      ] as const) {
        const { c, d } = ray(i, major, minor);
        const exact = bruteDisc(c, d, BOX);
        if (exact < 1e-6) continue;
        const error = Math.abs(discColumn(c, d, H, HZ, BOX) / exact - 1);
        worst = Math.max(worst, error);
      }
    }
    expect(worst).toBeLessThan(0.02);
  });

  it('is right from inside the disc, and leaves out the light nearer than its near limit', () => {
    const c: V3 = [2, -1, 0.05];
    for (const d of [unit([1, 0.3, 0.02]), unit([-0.2, 1, -0.5]), unit([0, 0, 1])]) {
      for (const near of [0, 0.5]) {
        const exact = bruteDisc(c, d, BOX, near);
        expect(discColumn(c, d, H, HZ, BOX, near) / exact).toBeCloseTo(1, 1);
        expect(Math.abs(discColumn(c, d, H, HZ, BOX, near) / exact - 1)).toBeLessThan(0.02);
      }
    }
  });

  it('holds the disc’s whole light summed over the sky, at any inclination', () => {
    // rho0 = 1: the light is 4 pi h^2 h_z.
    const light = 4 * Math.PI * H * H * HZ;
    for (const iDeg of [0, 45, 80, 90]) {
      const i = (iDeg * Math.PI) / 180;
      // On the sky the disc spans h across its major axis and h cos i + h_z sin i across its minor.
      const minorReach = 14 * (H * Math.cos(i) + HZ * Math.sin(i));
      const step = 0.05;
      const minorStep = Math.max(0.002, (minorReach / 14) * 0.05);
      let sum = 0;
      for (let x = -14 + step / 2; x < 14; x += step) {
        for (let y = -minorReach + minorStep / 2; y < minorReach; y += minorStep) {
          const { c, d } = ray(iDeg, x, y, 50);
          sum += discColumn(c, d, H, HZ, BOX) * step * minorStep;
        }
      }
      expect(sum / light, `${iDeg} degrees`).toBeGreaterThan(0.985);
      expect(sum / light, `${iDeg} degrees`).toBeLessThan(1.005);
    }
  });
});

describe('the Prugniel-Simien table', () => {
  const n = 4;
  const table = sersicTable(n);
  const { p, b, unitLuminosity } = prugnielSimien(n);
  const rho = (r: number) => Math.max(r, 1e-9) ** -p * Math.exp(-b * Math.max(r, 1e-9) ** (1 / n));
  /** T(m, s) by brute force, on s' = s + u^4 to resolve the cusp. */
  const brute = (m: number, s: number): number => {
    let sum = 0;
    const far = 2 * SERSIC_REACH;
    const samples = 200_000;
    // Split at s' = 0, where the cusp is, when the ray passes it.
    const pieces = s < 0 ? ([[s, 0], [0, far]] as const) : ([[s, far]] as const);
    for (const [from, to] of pieces) {
      for (let k = 0; k < samples; k += 1) {
        const u0 = k / samples;
        const u1 = (k + 1) / samples;
        // s' from `from` to `to`, packed towards whichever end is nearer the centre.
        const map = (u: number) => (from < 0 ? to - (to - from) * (1 - u) ** 4 : from + (to - from) * u ** 4);
        const a = map(u0);
        const c = map(u1);
        sum += rho(Math.hypot(m, 0.5 * (a + c))) * Math.abs(c - a);
      }
    }
    return sum;
  };

  it('is the integral it stands for, wherever the ray passes and the camera stands', () => {
    for (const [m, s] of [
      [0.02, -40],
      [0.3, -40],
      [1, -40],
      [3, -40],
      [8, -40],
      [0.5, 0],
      [1, 0.4],
      [2, -1.5],
      [0.1, 0.2],
    ] as const) {
      const exact = brute(m, s);
      expect(Math.abs(sersicTableColumn(table, m, s, true) / exact - 1), `m ${m}, s ${s}`).toBeLessThan(0.03);
    }
  });

  it('is very nearly the Sersic profile on the sky, as Prugniel and Simien made it', () => {
    for (const m of [0.3, 1, 3]) {
      expect(sersicTableColumn(table, m, -SERSIC_REACH) / sersicUnitColumn(m, n)).toBeGreaterThan(0.9);
      expect(sersicTableColumn(table, m, -SERSIC_REACH) / sersicUnitColumn(m, n)).toBeLessThan(1.1);
    }
  });

  it('keeps every index’s table in one atlas, each its own layer', () => {
    const atlas = sersicAtlas([4, 11.84, 4, 5.99]);
    expect(atlas.layers).toBe(3);
    expect([atlas.layerOf(4), atlas.layerOf(5.99), atlas.layerOf(11.84)]).toEqual([0, 1, 2]);
    expect(atlas.texture.image.height).toBe(3 * atlas.texture.image.width);
  });

  it('holds a steep profile’s light too, as far as it reaches', () => {
    const steep = sersicTable(11.84);
    let sum = 0;
    const steps = 20_000;
    for (let k = 0; k < steps; k += 1) {
      const m0 = SERSIC_REACH * (k / steps) ** 4;
      const m1 = SERSIC_REACH * ((k + 1) / steps) ** 4;
      const m = 0.5 * (m0 + m1);
      sum += 2 * Math.PI * m * sersicTableColumn(steep, m, -1e9, true) * (m1 - m0);
    }
    const drawn = prugnielSimien(11.84).unitLuminosity * sersicLightWithin(SERSIC_REACH, 11.84);
    expect(Math.abs(sum / drawn - 1)).toBeLessThan(0.03);
  });

  it('holds the profile’s whole light summed over the sky from afar', () => {
    // A round one of unit effective radius: its light 2 pi times the integral of T(m) m dm.
    let sum = 0;
    const steps = 20_000;
    for (let k = 0; k < steps; k += 1) {
      const x0 = k / steps;
      const x1 = (k + 1) / steps;
      // m = REACH x^4, packed to the centre.
      const m0 = SERSIC_REACH * x0 ** 4;
      const m1 = SERSIC_REACH * x1 ** 4;
      const m = 0.5 * (m0 + m1);
      sum += 2 * Math.PI * m * sersicTableColumn(table, m, -1e9, true) * (m1 - m0);
    }
    expect(sum / unitLuminosity).toBeGreaterThan(0.99);
    expect(sum / unitLuminosity).toBeLessThan(1.005);
  });
});
