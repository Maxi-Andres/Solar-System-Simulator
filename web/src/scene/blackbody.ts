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
 * The colour index Ballesteros's relation gives a temperature: its inverse, by bisection
 * -- the relation falls monotonically from MIN_COLOR_INDEX to MAX_COLOR_INDEX. For a star
 * known by its effective temperature and not its B-V (an Exoplanet Archive host placed from
 * the Archive), so its colour takes the same path every other star's does.
 */
export function temperatureToColorIndex(kelvin: number): number {
  let low = MIN_COLOR_INDEX;
  let high = MAX_COLOR_INDEX;
  for (let step = 0; step < 50; step += 1) {
    const middle = (low + high) / 2;
    if (colorIndexToTemperature(middle) > kelvin) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/**
 * Colour of a star from its colour index, at unit luminance.
 *
 * The integral is 471 samples, so it is worked out once per thousandth of a magnitude
 * of B-V -- the resolution the catalogues publish it at -- and kept: a colour index
 * that is a published three-decimal value gets its own integral, exactly, and the same
 * object every time.
 *
 * **Between those steps it interpolates, and that is new with the 3D stars.** The sky's
 * 25,000 Hipparcos values come in thousandths, and keying the cache on the value itself
 * cost 25,000 integrals at most. The 3D tiers' B-V is derived for the Gaia stars, a
 * float with no fixed decimals: nearly every one of their 356,749 stars was its own key,
 * so loading them ran the integral 356,749 times -- 14 seconds with the page frozen,
 * measured on 2026-10-28, as the camera pulled out of the Solar System. Linear between
 * neighbours 0.001 apart, the colour is off by the curvature over that step, under a
 * millionth of a channel against a B-V uncertainty of hundredths: nothing a screen or
 * an eye could tell, and 4,401 integrals at the very most.
 */
const COLOR_INDEX_STEP = 0.001;
const COLOR_STEPS = Math.round((MAX_COLOR_INDEX - MIN_COLOR_INDEX) / COLOR_INDEX_STEP);
const colorTable: (Rgb | undefined)[] = [];

/** How close to a step, in steps, counts as on it: float32's rounding of a published value. */
const ON_STEP = 1e-3;

function colorAtStep(step: number): Rgb {
  let color = colorTable[step];
  if (color === undefined) {
    const colorIndex = MIN_COLOR_INDEX + step * COLOR_INDEX_STEP;
    color = blackbodyLinearSrgb(colorIndexToTemperature(colorIndex));
    colorTable[step] = color;
  }
  return color;
}

export function starColor(colorIndex: number): Rgb {
  // Past the clamp every colour index is the same colour (colorIndexToTemperature).
  const clamped = Math.min(MAX_COLOR_INDEX, Math.max(MIN_COLOR_INDEX, colorIndex));
  const position = (clamped - MIN_COLOR_INDEX) / COLOR_INDEX_STEP;
  const nearest = Math.round(position);
  if (Math.abs(position - nearest) < ON_STEP) {
    return colorAtStep(nearest);
  }
  const below = Math.min(Math.floor(position), COLOR_STEPS - 1);
  const t = position - below;
  const [r0, g0, b0] = colorAtStep(below);
  const [r1, g1, b1] = colorAtStep(below + 1);
  return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t];
}

/**
 * How bright a blackbody's surface looks against the Sun's, per unit area: the luminance
 * of Planck's law through the CIE observer at one temperature over the same at the Sun's
 * 5,772 K. What sets a star's disc against the Sun's on screen -- the same radiance per
 * square metre at the same temperature, less at a cooler one: an M dwarf at 3,000 K about
 * a fiftieth of the Sun's, which is why Proxima's disc is a dull red where the Sun's is
 * white.
 */
export function surfaceLuminanceRelativeToSun(kelvin: number): number {
  const luminance = (t: number): number => {
    let y = 0;
    for (let wavelength = WAVELENGTH_MIN_NM; wavelength <= WAVELENGTH_MAX_NM; wavelength += WAVELENGTH_STEP_NM) {
      y += planckSpectralRadiance(wavelength, t) * cieY(wavelength);
    }
    return y;
  };
  return luminance(kelvin) / luminance(5772);
}
