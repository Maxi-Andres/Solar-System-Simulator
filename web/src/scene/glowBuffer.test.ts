import { describe, expect, it } from 'vitest';

import {
  unresolvedOnset,
  unresolvedShare,
  UNRESOLVED_FULL_PX,
  UNRESOLVED_HIDDEN_PX,
} from '../core/globularClusterLight.ts';
import { clusterPopulation } from '../core/globularClusters.ts';
import { faintLightShare, HALF_LIGHT_RADIUS_PC } from '../core/nuclearClusterLight.ts';
import {
  GLOW_DISPLAY_GLSL,
  GLOW_FLOOR,
  GLOW_MAX,
  glowDisplay,
  HALF_DISPLAY_STEP,
  haloLevels,
  haloPyramid,
  haloShares,
  keptLight,
  WHITE_X,
} from './glowBuffer.ts';
import { linearToSrgb } from './shading.ts';
import { PSF_SIGMA_PX, srgbToLinear, STAR_WING_FRACTION } from './starRendering.ts';

/**
 * The glow buffer (glowBuffer.ts): light past white spilled into a halo by the stars' own point
 * spread, conserved; and the clusters' unresolved light coming in as they shrink on the screen.
 */

const sum = (a: Float32Array): number => a.reduce((s, v) => s + v, 0);

/** The star's profile, core and wing, integrated over a disc of radius `r` CSS px, by steps. */
function profileLight(r: number): number {
  const steps = 200_000;
  let total = 0;
  for (let i = 0; i < steps; i += 1) {
    // Even in log r from 1e-4 sigma, where the disc inside holds nothing to speak of.
    const a = 1e-4 * PSF_SIGMA_PX * (r / (1e-4 * PSF_SIGMA_PX)) ** (i / steps);
    const b = 1e-4 * PSF_SIGMA_PX * (r / (1e-4 * PSF_SIGMA_PX)) ** ((i + 1) / steps);
    const m = Math.sqrt(a * b) / PSF_SIGMA_PX;
    total += (Math.exp(-0.5 * m * m) + STAR_WING_FRACTION / (1 + m * m)) * 2 * Math.PI * Math.sqrt(a * b) * (b - a);
  }
  return total;
}

describe('the halo kernel', () => {
  it('shares all the light out, the core keeping a good part of it in place', () => {
    for (const levels of [1, 4, 8, 11]) {
      for (const ratio of [1, 1.5, 2]) {
        const shares = haloShares(levels, ratio);
        const total = shares.core + shares.levels.reduce((s, v) => s + v, 0);
        expect(total).toBeCloseTo(1, 12);
        expect(shares.levels.every((v) => v > 0)).toBe(true);
        expect(shares.core).toBeGreaterThan(0.2);
      }
    }
  });

  it('is the star profile (starRendering.ts) integrated: core plus Lorentzian wing at STAR_WING_FRACTION', () => {
    const levels = 8;
    const shares = haloShares(levels, 1);
    const all = profileLight(2 ** levels);
    // The core's share: everything inside the first pixel.
    expect(shares.core).toBeCloseTo(profileLight(1) / all, 3);
    // Each level: the profile's light between 2^(k-1) and 2^k pixels.
    for (let k = 1; k <= levels; k += 1) {
      const band = (profileLight(2 ** k) - profileLight(2 ** (k - 1))) / all;
      expect(shares.levels[k - 1]!).toBeCloseTo(band, 3);
    }
  });

  it('gives each octave of radius the same light, far out: an r^-2 wing', () => {
    const shares = haloShares(10, 1);
    for (let k = 4; k < 10; k += 1) {
      expect(shares.levels[k]! / shares.levels[k - 1]!).toBeCloseTo(1, 2);
    }
  });

  it('reaches across the frame and no farther', () => {
    expect(haloLevels(1536, 864)).toBe(7);
    expect(haloLevels(3840, 2160)).toBe(9);
    expect(haloLevels(8, 8)).toBe(1);
    expect(haloLevels(1e6, 1e6)).toBe(11);
  });
});

describe('light past white', () => {
  it('leaves everything up to white exactly as it was', () => {
    const w = 128;
    const input = new Float32Array(w * w).map((_, i) => (WHITE_X * ((i * 7919) % 1000)) / 1000);
    const { shown, halo } = haloPyramid(input, w, w);
    expect(sum(halo)).toBe(0);
    expect(Array.from(shown)).toEqual(Array.from(input));
  });

  it('keeps a hue as it spills', () => {
    const kept = keptLight([30, 15, 6]);
    expect(Math.max(...kept)).toBeCloseTo(WHITE_X, 12);
    expect(kept[1] / kept[0]).toBeCloseTo(0.5, 12);
    expect(keptLight([0.5, 0.2, 0.1])).toEqual([0.5, 0.2, 0.1]);
  });

  it('is conserved: a point a thousand times past white keeps all its light, moved into its halo', () => {
    const w = 256;
    const input = new Float32Array(w * w);
    input[128 * w + 128] = 1000;
    const { shown, halo } = haloPyramid(input, w, w);
    expect(sum(shown)).toBeCloseTo(1000, 1);
    // Most of it stays where it was; the rest is the halo.
    const shares = haloShares(haloLevels(w, w), 1);
    expect(sum(halo)).toBeCloseTo((1000 - WHITE_X) * (1 - shares.core), 1);
  });

  it('is conserved for a field of light, wherever it lies past white', () => {
    const w = 192;
    const input = new Float32Array(w * w);
    for (let y = 40; y < 150; y += 1) {
      for (let x = 40; x < 150; x += 1) {
        input[y * w + x] = 50 * Math.exp(-((x - 90) ** 2 + (y - 100) ** 2) / 200) + 0.3;
      }
    }
    const { shown } = haloPyramid(input, w, w);
    expect(sum(shown) / sum(input)).toBeCloseTo(1, 4);
  });

  it('spreads its halo as the star wing does, r^-2 at the light the wing holds', () => {
    const w = 512;
    const input = new Float32Array(w * w);
    // Under GLOW_MAX, which caps a pixel.
    const energy = 2e4;
    input[256 * w + 256] = energy + WHITE_X;
    const { halo } = haloPyramid(input, w, w);
    // The wing's own surface brightness at r: E w sigma^2 / (N (sigma^2 + r^2)), N the profile's light.
    const N = (2 + STAR_WING_FRACTION * Math.log1p((2 ** haloLevels(w, w) / PSF_SIGMA_PX) ** 2)) * Math.PI * PSF_SIGMA_PX ** 2;
    for (const r of [4, 8, 16, 32, 64]) {
      const ring: number[] = [];
      for (let a = 0; a < 64; a += 1) {
        const x = Math.round(256 + r * Math.cos((a / 64) * 2 * Math.PI));
        const y = Math.round(256 + r * Math.sin((a / 64) * 2 * Math.PI));
        ring.push(halo[y * w + x]!);
      }
      const mean = ring.reduce((s, v) => s + v, 0) / ring.length;
      const wing = (energy * STAR_WING_FRACTION * PSF_SIGMA_PX ** 2) / (N * (PSF_SIGMA_PX ** 2 + r * r));
      // Within a factor of two of the Lorentzian at every radius: a pyramid of blurs is not the
      // exact curve, but its light per octave is.
      expect(mean / wing).toBeGreaterThan(0.5);
      expect(mean / wing).toBeLessThan(2);
    }
  });

  it('moves smoothly as its source does: no light gained or lost, no pixel jumping', () => {
    const w = 128;
    const frames: Float32Array[] = [];
    for (let step = 0; step <= 8; step += 1) {
      const cx = 60 + step / 8;
      const input = new Float32Array(w * w);
      for (let y = 0; y < w; y += 1) {
        for (let x = 0; x < w; x += 1) {
          input[y * w + x] = 400 * Math.exp(-((x + 0.5 - cx) ** 2 + (y + 0.5 - 64) ** 2) / (2 * 1.5 * 1.5));
        }
      }
      frames.push(haloPyramid(input, w, w).halo);
    }
    const totals = frames.map(sum);
    for (const t of totals) expect(t / totals[0]!).toBeCloseTo(1, 3);
    // Ten pixels out, a step of an eighth of a pixel moves the halo by a few per cent at most.
    for (let k = 1; k < frames.length; k += 1) {
      const a = frames[k - 1]![64 * w + 75]!;
      const b = frames[k]![64 * w + 75]!;
      expect(Math.abs(b / a - 1)).toBeLessThan(0.05);
    }
  });

  it('caps a pixel at GLOW_MAX, under the half float', () => {
    expect(GLOW_MAX).toBeLessThan(65_504);
    const input = new Float32Array(64 * 64);
    input[32 * 64 + 32] = 1e9;
    const { shown } = haloPyramid(input, 64, 64);
    expect(sum(shown)).toBeCloseTo(GLOW_MAX, -1);
  });
});

describe('what the screen shows of the glow', () => {
  it('is the shoulder’s linear light encoded as a star’s is', () => {
    for (const x of [0, 1e-4, 0.01, 0.1, 1, 5]) {
      expect(glowDisplay(x)).toBeCloseTo(linearToSrgb(1 - Math.exp(-x)), 12);
    }
    // A tenth of white: 87 of 255, where the shoulder's light unencoded showed 24.
    expect(glowDisplay(0.1) * 255).toBeCloseTo(86.9, 1);
    expect((1 - Math.exp(-0.1)) * 255).toBeCloseTo(24.3, 1);
    // White itself, and far past it, under the display's own white.
    expect(glowDisplay(WHITE_X) * 255).toBeCloseTo(208.2, 1);
    expect(glowDisplay(GLOW_MAX)).toBeCloseTo(1, 12);
  });

  it('rises with the light, and from black', () => {
    expect(glowDisplay(0)).toBe(0);
    let last = 0;
    for (let x = 1e-6; x < 20; x *= 1.1) {
      const now = glowDisplay(x);
      expect(now).toBeGreaterThan(last);
      last = now;
    }
  });

  it('cuts a glow where, encoded, it is half a display step: under it, black', () => {
    expect(GLOW_FLOOR).toBeCloseTo(srgbToLinear(0.5 / 255), 15);
    expect(GLOW_FLOOR).toBeCloseTo(1.518e-4, 7);
    expect(glowDisplay(GLOW_FLOOR)).toBeLessThan(HALF_DISPLAY_STEP);
    expect(glowDisplay(GLOW_FLOOR)).toBeGreaterThan(0.999 * HALF_DISPLAY_STEP);
    // The floor it replaced, 0.0005, encoded is over a display step and a half.
    expect(glowDisplay(0.0005) * 255).toBeGreaterThan(1.6);
  });

  it('is worked in the shader by the same curve', () => {
    expect(GLOW_DISPLAY_GLSL).toContain('12.92 * v');
    expect(GLOW_DISPLAY_GLSL).toContain('1.055 * pow(v, 1.0 / 2.4) - 0.055');
    expect(GLOW_DISPLAY_GLSL).toContain('v <= 0.0031308');
    expect(GLOW_DISPLAY_GLSL).toContain('vec3(1.0) - exp(-max(total, vec3(0.0)))');
  });
});

describe('a cluster’s unresolved light, coming in as it shrinks on the screen', () => {
  it('is none while the cluster is large, all once it is small, smoothly between', () => {
    expect(unresolvedOnset(UNRESOLVED_HIDDEN_PX)).toBe(0);
    expect(unresolvedOnset(1000)).toBe(0);
    expect(unresolvedOnset(UNRESOLVED_FULL_PX)).toBe(1);
    expect(unresolvedOnset(1)).toBe(1);
    expect(unresolvedOnset(Math.sqrt(UNRESOLVED_HIDDEN_PX * UNRESOLVED_FULL_PX))).toBeCloseTo(0.5, 12);
    let last = 0;
    for (let px = 200; px > 10; px *= 0.99) {
      const now = unresolvedOnset(px);
      expect(now).toBeGreaterThanOrEqual(last);
      expect(now - last).toBeLessThan(0.02);
      last = now;
    }
  });

  /** CSS pixels a radian for a 864-pixel-high view at 27 degrees (scale.ts FOV_DEG). */
  const PER_RADIAN = 864 / (2 * Math.tan((27 * Math.PI) / 360));

  /**
   * A cluster's light drawn, in its own light, from `distancePc`: its stars brighter than the
   * picture's limit there (V 8 from the camera), and its glow of the rest, as it comes in.
   */
  function drawnLight(distancePc: number, halfLightPc: number, share: (limit: number) => number): number {
    const limit = 8 - 5 * (Math.log10(distancePc) - 1);
    const unresolved = share(limit);
    return 1 - unresolved + unresolved * unresolvedOnset((halfLightPc / distancePc) * PER_RADIAN);
  }

  for (const [name, halfLightPc, share] of [
    ['47 Tuc', 4.03, (limit: number) => unresolvedShare(clusterPopulation(-0.72), limit)],
    ['Djor 2', 4.64, (limit: number) => unresolvedShare(clusterPopulation(-0.65), limit)],
    ['the nuclear cluster', HALF_LIGHT_RADIUS_PC, faintLightShare],
  ] as const) {
    it(`${name}: continuous along the way out, from 1 to 3,000 light years, and whole once small`, () => {
      let last = drawnLight(1 / 3.2616, halfLightPc, share);
      let worst = 1;
      for (let ly = 1; ly <= 3000; ly *= 1.01) {
        const now = drawnLight(ly / 3.2616, halfLightPc, share);
        worst = Math.max(worst, now / last, last / now);
        last = now;
      }
      expect(worst).toBeLessThan(1.02);
      // Once its half-light radius is UNRESOLVED_FULL_PX across, stars and glow hold all of it.
      const far = (halfLightPc * PER_RADIAN) / UNRESOLVED_FULL_PX;
      expect(drawnLight(far, halfLightPc, share)).toBeCloseTo(1, 12);
      expect(drawnLight(far * 3, halfLightPc, share)).toBeCloseTo(1, 12);
    });
  }
});
