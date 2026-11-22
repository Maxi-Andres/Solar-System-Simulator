import { describe, expect, it } from 'vitest';

import {
  blackbodyChromaticity,
  blackbodyLinearSrgb,
  cieX,
  cieY,
  cieZ,
  colorIndexToTemperature,
  MAX_COLOR_INDEX,
  MIN_COLOR_INDEX,
  planckSpectralRadiance,
  provideStarColorSteps,
  starColor,
  starColorSteps,
  temperatureToColorIndex,
} from './blackbody.ts';

/**
 * Colour from temperature, and temperature from a measurement.
 *
 * Two published answers anchor the whole chain, and neither of them is ours:
 *
 *   - **The Sun.** Its colour index is 0.65 and its effective temperature is 5,772 K.
 *     The relation used here is fitted to blackbodies, knows nothing about the Sun, and
 *     returns 5,778 K.
 *   - **Sodium street lighting.** The city lights on Earth's night side were computed
 *     from a 2,000 K blackbody before this module existed; that constant is still in
 *     `earthExtras.ts` and this has to reproduce it digit for digit.
 *
 * With both of those pinned, "Betelgeuse comes out orange" stops being a matter of
 * taste and becomes arithmetic.
 */

const SOLAR_LUMINANCE = (color: readonly [number, number, number]): number =>
  0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];

describe("Planck's law", () => {
  it('peaks where Wien says it does', () => {
    // Wien's displacement law: lambda_max * T = 2.898e-3 m K. For the Sun that is
    // 502 nm, which is green, and is why the eye is most sensitive there.
    const kelvin = 5772;
    const peakNm = 2.897771955e-3 / kelvin / 1e-9;
    const atPeak = planckSpectralRadiance(peakNm, kelvin);
    expect(planckSpectralRadiance(peakNm - 40, kelvin)).toBeLessThan(atPeak);
    expect(planckSpectralRadiance(peakNm + 40, kelvin)).toBeLessThan(atPeak);
    expect(peakNm).toBeCloseTo(502, 0);
  });
});

describe('colour index to temperature', () => {
  it('returns the Sun for the Sun', () => {
    // 5,772 K measured; this returns 5,778, from a formula fitted to blackbody
    // colours alone that knows nothing about the Sun. One part in nine hundred.
    expect(colorIndexToTemperature(0.65)).toBeCloseTo(5778, 0);
    expect(Math.abs(colorIndexToTemperature(0.65) - 5772) / 5772).toBeLessThan(0.002);
  });

  it('is within a few percent for a hot star, and that is its weakest end', () => {
    // Vega: B-V 0.00, effective temperature 9,602 K. The relation gives 10,125 --
    // five percent high, which is where this approximation is worst and is worth
    // knowing rather than hiding. It costs a hint of blue, not a colour.
    const vega = colorIndexToTemperature(0.0);
    expect(Math.abs(vega - 9602) / 9602).toBeLessThan(0.06);
  });

  it('puts Betelgeuse in the right part of the scale', () => {
    // B-V 1.85, measured effective temperature about 3,600 K.
    expect(colorIndexToTemperature(1.85)).toBeGreaterThan(3000);
    expect(colorIndexToTemperature(1.85)).toBeLessThan(3700);
  });

  it('falls with colour index, without exception', () => {
    let previous = Infinity;
    for (let colorIndex = -0.4; colorIndex <= 3.8; colorIndex += 0.05) {
      const kelvin = colorIndexToTemperature(colorIndex);
      expect(kelvin).toBeLessThan(previous);
      previous = kelvin;
    }
  });

  it('clamps the colour index before the formula, where the poles are', () => {
    // Past B-V = -0.67 the expression returns a negative temperature, not a large
    // one, so clamping the output alone would not save it. Hipparcos never goes
    // there; a corrupted column would.
    expect(colorIndexToTemperature(-5)).toBe(colorIndexToTemperature(MIN_COLOR_INDEX));
    expect(colorIndexToTemperature(20)).toBe(colorIndexToTemperature(MAX_COLOR_INDEX));
    expect(colorIndexToTemperature(-5)).toBeGreaterThan(10_000);
  });
});

describe('the colour itself', () => {
  it('reproduces the sodium chromaticity the city lights were built from', () => {
    const [r, g, b] = blackbodyChromaticity(2000);
    expect(r).toBeCloseTo(1, 4);
    expect(g).toBeCloseTo(0.2663, 4);
    expect(b).toBeCloseTo(0.0077, 4);
  });

  it('comes out at unit luminance, which is what lets a magnitude mean anything', () => {
    // A red star and a blue star of the same magnitude must render equally bright.
    // Normalising to the peak channel instead would make the reddest ones brightest.
    for (const kelvin of [2000, 3600, 5772, 9600, 22000]) {
      expect(SOLAR_LUMINANCE(blackbodyLinearSrgb(kelvin))).toBeCloseTo(1, 3);
    }
  });

  it('makes Betelgeuse orange because it is 3,600 K', () => {
    const [r, g, b] = starColor(1.85);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('makes Rigel blue for the same reason', () => {
    const [r, , b] = starColor(-0.03);
    expect(b).toBeGreaterThan(r);
  });

  it('gets bluer with temperature, monotonically', () => {
    let previous = 0;
    for (const kelvin of [2500, 3500, 4500, 5772, 7500, 10000, 15000, 25000]) {
      const [r, , b] = blackbodyLinearSrgb(kelvin);
      const blueness = b / r;
      expect(blueness).toBeGreaterThan(previous);
      previous = blueness;
    }
  });

  it('caches by the published measurement, so it is a cache and not an approximation', () => {
    expect(starColor(0.65)).toBe(starColor(0.65));
    expect(starColor(0.65)).not.toBe(starColor(0.66));
    // A published value read back from a float32 file is still that value.
    expect(starColor(Math.fround(0.65))).toBe(starColor(0.65));
    expect(starColor(0.65)).toEqual(blackbodyLinearSrgb(colorIndexToTemperature(0.65)));
  });

  it('interpolates between published steps to well under a millionth of a channel', () => {
    // The 3D stars' derived B-V has no fixed decimals; see starColor.
    for (const colorIndex of [-0.3995, 0.0123456, 0.6505, 1.2345678, 3.9999]) {
      const exact = blackbodyLinearSrgb(colorIndexToTemperature(colorIndex));
      const looked = starColor(colorIndex);
      for (let channel = 0; channel < 3; channel += 1) {
        expect(Math.abs(looked[channel]! - exact[channel]!)).toBeLessThan(1e-6);
      }
    }
  });

  it('colours a few hundred thousand distinct stars in a blink', () => {
    // 356,749 distinct values took 14 s before the table; this is the regression guard.
    const start = performance.now();
    for (let index = 0; index < 300_000; index += 1) {
      starColor(-0.4 + (index / 300_000) * 4.4 + 1e-7);
    }
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it('gives every colour index past the clamp the clamp\'s colour', () => {
    expect(starColor(-3)).toBe(starColor(-0.4));
    expect(starColor(9)).toBe(starColor(4));
  });
});

describe('temperatureToColorIndex', () => {
  it('inverts colorIndexToTemperature across the range', () => {
    for (const bv of [-0.3, 0, 0.65, 1.5, 3]) {
      expect(temperatureToColorIndex(colorIndexToTemperature(bv))).toBeCloseTo(bv, 6);
    }
    // TRAPPIST-1, 2,566 K (Agol et al. 2021): a red dwarf's colour index.
    expect(temperatureToColorIndex(2566)).toBeGreaterThan(1.8);
  });
});

describe('the colour integral, made faster', () => {
  it('sums exactly the samples planckSpectralRadiance gives', () => {
    // The integral as it was: planckSpectralRadiance at each wavelength, through the curves.
    const reference = (kelvin: number): readonly [number, number, number] => {
      let x = 0;
      let y = 0;
      let z = 0;
      for (let wavelength = 360; wavelength <= 830; wavelength += 1) {
        const radiance = planckSpectralRadiance(wavelength, kelvin);
        x += radiance * cieX(wavelength);
        y += radiance * cieY(wavelength);
        z += radiance * cieZ(wavelength);
      }
      const bigX = x / y;
      const bigZ = z / y;
      return [
        Math.max(0, 3.2406 * bigX - 1.5372 - 0.4986 * bigZ),
        Math.max(0, -0.9689 * bigX + 1.8758 + 0.0415 * bigZ),
        Math.max(0, 0.0557 * bigX - 0.204 + 1.057 * bigZ),
      ];
    };
    for (const kelvin of [1800, 2300.5, 3600, 5772, 9940, 25000, 40000, 1e6]) {
      expect(blackbodyLinearSrgb(kelvin)).toEqual(reference(kelvin));
    }
  });

  it('hands over the steps a catalogue needs, the very colours starColor makes', () => {
    const indices = [0.65, -0.4, 3.85, 1.2345, 0.0001, 4.5, 1.2345];
    const steps = starColorSteps(indices);
    let made = 0;
    for (let k = 0; k < steps.length; k += 3) if (steps[k] === steps[k]) made += 1;
    // 0.65, -0.4, 3.85 and the clamp each on a step; 1.2345 and 0.0001 between two.
    expect(made).toBe(8);
    // Taken in where the table has them already: nothing changes.
    provideStarColorSteps(steps);
    const step = Math.round((0.65 + 0.4) / 0.001);
    expect([steps[step * 3], steps[step * 3 + 1], steps[step * 3 + 2]]).toEqual([...starColor(0.65)]);
  });
});
