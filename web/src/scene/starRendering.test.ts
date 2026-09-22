import { describe, expect, it } from 'vitest';

import { DISPLAY_FLOOR, linearToSrgb } from './shading.ts';
import {
  FAINTEST_PEAK,
  magnitudeToPeakCoefficients,
  MAS_PER_YEAR_TO_RAD,
  peakDisplayValue,
  profileDisplayValue,
  profileRadiusPx,
  PSF_SIGMA_PX,
  spriteDiameterPx,
  srgbToLinear,
  STAR_FRAGMENT_SHADER,
  STAR_VERTEX_SHADER,
} from './starRendering.ts';

/**
 * The response, and the shader that has to agree with it.
 *
 * Two kinds of test here. The first kind checks the arithmetic that turns a magnitude
 * into a peak and a size. The second reads the GLSL as text, which is the only way to
 * check a shader without a GPU, and is the same device the field-of-view and favicon
 * tests use: it does not prove the shader runs, it proves the shader and the module it
 * mirrors cannot quietly say different things.
 */

const BRIGHTEST = -1.44;
const LIMIT = 8;
const COEFFICIENTS = magnitudeToPeakCoefficients(BRIGHTEST, LIMIT);

describe('the response', () => {
  it('puts the brightest star at white and the faintest at the stated floor', () => {
    expect(peakDisplayValue(BRIGHTEST, COEFFICIENTS)).toBeCloseTo(1, 10);
    expect(peakDisplayValue(LIMIT, COEFFICIENTS)).toBeCloseTo(FAINTEST_PEAK, 10);
  });

  it('is linear in magnitude, which is linear in the eye', () => {
    // Equal steps of magnitude are equal steps on screen. That is the claim, and it is
    // the reason the sky is not three white dots on black.
    const first = peakDisplayValue(1, COEFFICIENTS) - peakDisplayValue(2, COEFFICIENTS);
    const second = peakDisplayValue(5, COEFFICIENTS) - peakDisplayValue(6, COEFFICIENTS);
    expect(first).toBeCloseTo(second, 10);
  });

  it('compresses six thousand to one into fifty to one, and that is the whole cost', () => {
    const fluxRatio = 10 ** (-0.4 * (BRIGHTEST - LIMIT));
    const screenRatio =
      peakDisplayValue(BRIGHTEST, COEFFICIENTS) / peakDisplayValue(LIMIT, COEFFICIENTS);
    expect(fluxRatio).toBeGreaterThan(5900);
    expect(screenRatio).toBeCloseTo(1 / FAINTEST_PEAK, 6);
    expect(screenRatio).toBeCloseTo(50, 6);
  });

  it('never asks the display for something it cannot show', () => {
    for (let magnitude = -2; magnitude <= 9; magnitude += 0.25) {
      const peak = peakDisplayValue(magnitude, COEFFICIENTS);
      expect(peak).toBeLessThanOrEqual(1);
      expect(peak).toBeGreaterThanOrEqual(DISPLAY_FLOOR);
    }
  });

  it('refuses a catalogue with no magnitude range rather than dividing by zero', () => {
    expect(() => magnitudeToPeakCoefficients(7.5, 7.5)).toThrow();
  });
});

describe('the point spread function', () => {
  it('inverts the encode it is built on', () => {
    for (const value of [0, 0.002, 0.04, 0.12, 0.5, 1]) {
      expect(srgbToLinear(linearToSrgb(value))).toBeCloseTo(value, 10);
    }
  });

  it('falls off as a Gaussian in linear light, not in code values', () => {
    // A point spread spreads energy. At one sigma the linear value is down by
    // exp(-1/2), and that is what has to hold -- not the display value.
    const peak = 1;
    const atSigma = profileDisplayValue(PSF_SIGMA_PX, peak);
    expect(srgbToLinear(atSigma) / srgbToLinear(peak)).toBeCloseTo(Math.exp(-0.5), 6);
  });

  it('gives a brighter star a bigger disc, without a size setting anywhere', () => {
    const sizes = [8, 6, 4, 2, 0, BRIGHTEST].map((magnitude) =>
      spriteDiameterPx(peakDisplayValue(magnitude, COEFFICIENTS)),
    );
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]!).toBeGreaterThan(sizes[index - 1]!);
    }
    // And the range is narrow, because it is a tail crossing a threshold rather than a
    // glow being drawn: four orders of magnitude in flux is under three in radius. The
    // brightness does the work; the size only follows it.
    expect(sizes.at(-1)! / sizes[0]!).toBeLessThan(3);
  });

  it('draws points, at the sizes measured off the reference', () => {
    // Both frames were read pixel by pixel at the same view. NASA Eyes draws stars
    // with a median equivalent diameter of 2.26 px and a 90th percentile of 2.99.
    // These are the analytic sizes behind that, which run about 10% above what the
    // render then measures -- a sprite is sampled at pixel centres, not at its own.
    const faintest = spriteDiameterPx(peakDisplayValue(LIMIT, COEFFICIENTS));
    const brightest = spriteDiameterPx(peakDisplayValue(BRIGHTEST, COEFFICIENTS));
    expect(faintest).toBeGreaterThan(1.3);
    expect(faintest).toBeLessThan(1.7);
    expect(brightest).toBeGreaterThan(3.8);
    expect(brightest).toBeLessThan(4.6);
  });

  it('sizes the sprite to hold everything above the floor and nothing more', () => {
    const peak = peakDisplayValue(3, COEFFICIENTS);
    const radius = spriteDiameterPx(peak) / 2;
    expect(profileDisplayValue(radius * 0.99, peak)).toBeGreaterThan(DISPLAY_FLOOR);
    expect(profileDisplayValue(radius * 1.01, peak)).toBeLessThan(DISPLAY_FLOOR);
  });

  it('still draws a star that never clears the floor', () => {
    // Zero radius would mean zero pixels, which is not a star, it is an absence.
    expect(profileRadiusPx(DISPLAY_FLOOR, DISPLAY_FLOOR)).toBe(0);
    expect(spriteDiameterPx(DISPLAY_FLOOR)).toBe(1);
  });
});

describe('the unit conversion', () => {
  it('turns milliarcseconds a year into radians a year', () => {
    // One arcsecond a year, in radians, is 4.8481e-6.
    expect(1000 * MAS_PER_YEAR_TO_RAD).toBeCloseTo(4.84814e-6, 10);
  });
});

describe('the shaders say the same thing as the module', () => {
  it('uses the same sRGB transfer function in both directions', () => {
    // The two thresholds and the exponent are the sRGB standard's, and they appear in
    // three places now: shading.ts, this module, and the two shaders.
    expect(STAR_VERTEX_SHADER).toContain('0.04045');
    expect(STAR_VERTEX_SHADER).toContain('12.92');
    expect(STAR_VERTEX_SHADER).toContain('2.4');
    expect(STAR_FRAGMENT_SHADER).toContain('0.0031308');
    expect(STAR_FRAGMENT_SHADER).toContain('1.055');
  });

  it('evaluates the Gaussian in linear light, like profileDisplayValue', () => {
    expect(STAR_FRAGMENT_SHADER).toContain('vPeakLinear * exp(');
    expect(STAR_FRAGMENT_SHADER).toContain('uSigmaPx * uSigmaPx');
  });

  it('applies the response as one multiply-add, from the coefficients', () => {
    expect(STAR_VERTEX_SHADER).toContain('uMagnitudeToPeak.x + uMagnitudeToPeak.y * magnitude');
  });

  it('moves stars by proper motion as a rotation, not by dividing by cos(dec)', () => {
    // The division is the textbook form and it comes apart near the poles. If this
    // ever reappears here, `buildStarCatalog.ts` and the shader have parted ways.
    expect(STAR_VERTEX_SHADER).toContain('east * properMotion.x + north * properMotion.y');
    expect(STAR_VERTEX_SHADER).not.toMatch(/cos\s*\(\s*dec/i);
  });

  it('does not redeclare position, which three.js already provides', () => {
    expect(STAR_VERTEX_SHADER).not.toContain('attribute vec3 position');
  });

  it('scales the sprite by the device pixel ratio, so the angle is what stays fixed', () => {
    expect(STAR_VERTEX_SHADER).toContain('gl_PointSize = vSizePx * uPixelRatio');
  });
});
