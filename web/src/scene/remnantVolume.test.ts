import { describe, expect, it } from 'vitest';

import { SUPERNOVA_REMNANTS } from '../core/supernovaRemnants.ts';
import {
  lineColour,
  NOISE_SIZE,
  REMNANT_FRAGMENT_SHADER,
  REMNANT_VERTEX_SHADER,
  remnantLook,
  remnantNoise,
  remnantSeed,
  SHELL_FWHM,
  synchrotronColour,
} from './remnantVolume.ts';

describe('a supernova remnant’s gas', () => {
  it('is a shell one twelfth of its radius thick: the swept-up gas at four times its density', () => {
    // 4 pi R^2 dR * 4 rho = 4/3 pi R^3 rho.
    expect(SHELL_FWHM).toBeCloseTo((1 / 3) / 4, 12);
  });

  it('is coloured by its lines: H-alpha red, [O III] blue-green, a Balmer shock pink-red', () => {
    const [r, g, b] = lineColour([[656.3, 1]]);
    expect(r).toBe(1);
    expect(g).toBeLessThan(0.05);
    expect(b).toBeLessThan(0.05);
    const [ro, go, bo] = lineColour([[500.7, 1]]);
    expect(ro).toBe(0);
    expect(go).toBe(1);
    expect(bo).toBeGreaterThan(0.1);
    // H-beta at a third of H-alpha adds a little blue to the red.
    const balmer = remnantLook('balmer').colourA;
    expect(balmer[0]).toBe(1);
    expect(balmer[2]).toBeGreaterThan(0.02);
  });

  it('fills a pulsar wind nebula with bluish-white synchrotron light', () => {
    const [r, g, b] = synchrotronColour();
    expect(b).toBe(1);
    expect(r).toBeGreaterThan(0.5);
    expect(g).toBeGreaterThan(0.6);
    expect(remnantLook('pulsar-wind').fill).toBe(1);
    expect(remnantLook('radiative').fill).toBe(0);
  });

  it('draws each remnant in the light its paper gives it', () => {
    const byKey = (key: string) => SUPERNOVA_REMNANTS.find((remnant) => remnant.key === key)!;
    expect(byKey('crab').emission).toBe('pulsar-wind');
    expect(byKey('cas-a').emission).toBe('oxygen-rich');
    expect(byKey('sn-1006').emission).toBe('balmer');
    expect(byKey('cygnus-loop').emission).toBe('radiative');
    for (const remnant of SUPERNOVA_REMNANTS) {
      expect(remnant.emissionReference).toMatch(/\d{4}/);
    }
  });

  it('gives each remnant its own place in the noise', () => {
    const seeds = SUPERNOVA_REMNANTS.map((remnant) => remnantSeed(remnant).toArray().join(','));
    expect(new Set(seeds).size).toBe(SUPERNOVA_REMNANTS.length);
  });

  it('is drawn from noise that tiles, uses its whole range, and is made in a moment -- under 4 s with the whole suite running beside it', () => {
    const start = performance.now();
    const noise = remnantNoise();
    const took = performance.now() - start;
    expect(noise.length).toBe(NOISE_SIZE ** 3 * 4);
    expect(took).toBeLessThan(4000);
    for (let channel = 0; channel < 4; channel += 1) {
      let low = 255;
      let high = 0;
      for (let v = channel; v < noise.length; v += 4) {
        low = Math.min(low, noise[v]!);
        high = Math.max(high, noise[v]!);
      }
      expect(low).toBe(0);
      expect(high).toBe(255);
    }
    // Tiling: the last voxel of a row is next to the first, so they differ by a voxel's step only.
    const at = (i: number, j: number, k: number) => noise[((k * NOISE_SIZE + j) * NOISE_SIZE + i) * 4]!;
    let jump = 0;
    let step = 0;
    for (let j = 0; j < NOISE_SIZE; j += 8) {
      for (let k = 0; k < NOISE_SIZE; k += 8) {
        jump = Math.max(jump, Math.abs(at(NOISE_SIZE - 1, j, k) - at(0, j, k)));
        step = Math.max(step, Math.abs(at(1, j, k) - at(0, j, k)));
      }
    }
    expect(jump).toBeLessThan(step * 2 + 4);
  });

  it('writes the scene’s logarithmic depth', () => {
    expect(REMNANT_VERTEX_SHADER).toContain('#include <logdepthbuf_vertex>');
    expect(REMNANT_FRAGMENT_SHADER).toContain('#include <logdepthbuf_fragment>');
  });
});
