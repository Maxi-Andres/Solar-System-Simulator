/**
 * What a temperature looks like: Planck's law through the CIE 1931 observer, to linear
 * sRGB.
 *
 * This started as a derivation inside `earthExtras.test.ts`, where it existed to show
 * that the city lights' amber was computed rather than picked off a swatch. Step 6f
 * needs the same integral for a different reason -- 25,000 stars whose colours come
 * from a measured colour index -- so it moved here, and the city-light test now checks
 * its constant against this module instead of against a copy of it.
 *
 * That matters more than tidiness. Betelgeuse has to come out orange *because it is
 * 3,600 K*, through the same arithmetic that makes a sodium lamp amber, and not because
 * somebody with a colour picker decided red stars should be red.
 *
 * ## The pieces
 *
 * **Planck** gives spectral radiance against wavelength for a given temperature. A star
 * is not a perfect blackbody -- absorption lines, a temperature gradient through the
 * photosphere -- but at the resolution of three numbers it is an excellent one, and it
 * is the model the colour index was calibrated against in the first place.
 *
 * **The CIE 1931 observer** is the measured response of human colour vision: three
 * curves, published in 1931 and still the definition. The fits used here are the
 * multi-lobe Gaussians from Wyman, Sloan and Shirley (2013), within a percent of the
 * tabulated values and a great deal shorter than the table.
 *
 * **The sRGB matrix** is the standard one, and it is where a colour can leave the
 * gamut: a 20,000 K blue is bluer than any screen primary. Those components come out
 * negative and are clamped, which is a real loss and is the reason the hottest stars
 * render slightly less blue than they are.
 */

/** Planck and Boltzmann constants and the speed of light, SI, exact by definition. */
const PLANCK_H = 6.62607015e-34;
const SPEED_OF_LIGHT = 299792458;
const BOLTZMANN_K = 1.380649e-23;

/** The visible range, in nanometres, at the resolution the CIE table is published in. */
const WAVELENGTH_MIN_NM = 360;
const WAVELENGTH_MAX_NM = 830;
const WAVELENGTH_STEP_NM = 1;

/** Spectral radiance of a blackbody, W / (m^2 sr m), at a wavelength in nanometres. */
export function planckSpectralRadiance(wavelengthNm: number, kelvin: number): number {
  const metres = wavelengthNm * 1e-9;
  return (
    (2 * PLANCK_H * SPEED_OF_LIGHT * SPEED_OF_LIGHT) /
    metres ** 5 /
    Math.expm1((PLANCK_H * SPEED_OF_LIGHT) / (metres * BOLTZMANN_K * kelvin))
  );
}

/** One lobe of the Wyman-Sloan-Shirley fit: a Gaussian with a different width each side. */
function lobe(wavelength: number, mean: number, low: number, high: number): number {
  const t = (wavelength - mean) / (wavelength < mean ? low : high);
  return Math.exp(-0.5 * t * t);
}

export function cieX(wavelengthNm: number): number {
  return (
    1.056 * lobe(wavelengthNm, 599.8, 37.9, 31.0) +
    0.362 * lobe(wavelengthNm, 442.0, 16.0, 26.7) -
    0.065 * lobe(wavelengthNm, 501.1, 20.4, 26.2)
  );
}

export function cieY(wavelengthNm: number): number {
  return (
    0.821 * lobe(wavelengthNm, 568.8, 46.9, 40.5) + 0.286 * lobe(wavelengthNm, 530.9, 16.3, 31.1)
  );
}

export function cieZ(wavelengthNm: number): number {
  return (
    1.217 * lobe(wavelengthNm, 437.0, 11.8, 36.0) + 0.681 * lobe(wavelengthNm, 459.0, 26.0, 13.8)
  );
}

export type Rgb = readonly [number, number, number];

/**
 * Colour of a blackbody in linear sRGB, scaled so its **luminance is 1**.
 *
 * Luminance rather than peak channel, and the distinction is the whole reason stars can
 * use this. The integral is normalised at Y = 1 before the matrix, and the sRGB
 * luminance weights are the inverse of that same transform, so what comes back is a
 * colour whose brightness is already the right one: multiply it by how bright the star
 * should be and a red star and a blue star of the same magnitude read as equally
 * bright, which is what a magnitude means.
 *
 * Normalising to the peak channel instead -- what `blackbodyChromaticity` does below --
 * would make every colour as bright as its strongest primary allows, and a deep red
 * star would come out as bright as a white one.
 */
export function blackbodyLinearSrgb(kelvin: number): Rgb {
  let x = 0;
  let y = 0;
  let z = 0;

  for (
    let wavelength = WAVELENGTH_MIN_NM;
    wavelength <= WAVELENGTH_MAX_NM;
    wavelength += WAVELENGTH_STEP_NM
  ) {
    const radiance = planckSpectralRadiance(wavelength, kelvin);
    x += radiance * cieX(wavelength);
    y += radiance * cieY(wavelength);
    z += radiance * cieZ(wavelength);
  }

  // Y = 1, which makes the result a colour at unit luminance rather than a spectrum.
  const bigX = x / y;
  const bigZ = z / y;

  return [
    Math.max(0, 3.2406 * bigX - 1.5372 - 0.4986 * bigZ),
    Math.max(0, -0.9689 * bigX + 1.8758 + 0.0415 * bigZ),
    Math.max(0, 0.0557 * bigX - 0.204 + 1.057 * bigZ),
  ];
}

/** The same colour scaled so its strongest channel is 1: a hue with no brightness. */
export function blackbodyChromaticity(kelvin: number): Rgb {
  const [r, g, b] = blackbodyLinearSrgb(kelvin);
  const peak = Math.max(r, g, b);
  return [r / peak, g / peak, b / peak];
}

/**
 * Effective temperature from the Johnson B-V colour index.
 *
 * Ballesteros (2012), *New insights into black bodies*, EPL 97 34008. It is a closed
 * form fitted to blackbody colours rather than a table lookup, which is why it belongs
 * next to the integral above rather than being a separate body of data:
 *
 *     T = 4600 K * ( 1 / (0.92 (B-V) + 1.7) + 1 / (0.92 (B-V) + 0.62) )
 *
 * The check that it is the right relation is the Sun. Its colour index is 0.65, and
 * this returns 5,778 K against a measured effective temperature of 5,772 K -- one part
 * in nine hundred, from a formula that knows nothing about the Sun.
 *
 * **The colour index is clamped before the formula, not after**, and that is not
 * defensive tidying. The expression has two poles, at B-V = -1.85 and -0.67, and past
 * the second one it returns a *negative* temperature rather than a large one. Hipparcos
 * runs from -0.4 to 3.8 in this set so neither pole is reachable from real data, but a
 * single bad value would otherwise turn a star black instead of blue.
 */
export const MIN_COLOR_INDEX = -0.4;
export const MAX_COLOR_INDEX = 4;
export const MIN_STAR_TEMPERATURE_K = 1800;
export const MAX_STAR_TEMPERATURE_K = 40000;

export function colorIndexToTemperature(colorIndex: number): number {
  const clamped = Math.min(MAX_COLOR_INDEX, Math.max(MIN_COLOR_INDEX, colorIndex));
  const shifted = 0.92 * clamped;
  const kelvin = 4600 * (1 / (shifted + 1.7) + 1 / (shifted + 0.62));
  return Math.min(MAX_STAR_TEMPERATURE_K, Math.max(MIN_STAR_TEMPERATURE_K, kelvin));
}

/**
 * Colour of a star from its colour index, at unit luminance.
 *
 * Memoised, because the integral is 470 samples and a catalogue is 25,000 stars. The
 * key is the colour index as published -- three decimals -- so this is a cache and not
 * an approximation: two stars share an entry only when they share a measurement.
 */
const colorCache = new Map<number, Rgb>();

export function starColor(colorIndex: number): Rgb {
  const cached = colorCache.get(colorIndex);
  if (cached !== undefined) {
    return cached;
  }
  const color = blackbodyLinearSrgb(colorIndexToTemperature(colorIndex));
  colorCache.set(colorIndex, color);
  return color;
}
