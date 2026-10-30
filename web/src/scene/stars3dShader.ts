import { KM_S_TO_PC_PER_YEAR, PARSEC_KM, STAR3D, STAR3D_FLOATS } from '../core/stars3d.ts';
import { DISPLAY_FLOOR } from './shading.ts';
import { LENS_VERTEX_GLSL } from './lens.ts';
import { srgbToLinear, STAR_WING_FRACTION } from './starRendering.ts';

/**
 * The stars at their real distances, drawn from wherever the camera is (step D2).
 *
 * ## The same sky, from the Sun
 *
 * The response is the sky's (starRendering.ts), unchanged: the same two coefficients
 * from the same catalogue's brightest star and limit, the same point spread, the same
 * colour from B-V. The only new step is where the magnitude comes from. The sky reads V
 * off the catalogue; here it is worked out per star, per frame, from the camera:
 *
 *     m = Mv + 5 log10(d / 10 pc)
 *
 * and since the generator wrote Mv = V + 5 log10(parallax / 100 mas) with no extinction,
 * with the camera at the Sun that gives V back. So the picture from home is the sky's,
 * star for star (measured in stars3dShader.test.ts and, on the real data, stars3dSky.test.ts),
 * and flying to Alpha Centauri makes it blaze while the Sun shrinks to a 0.5-magnitude
 * yellow star -- by the same arithmetic, nothing added.
 *
 * ## Brighter than anything in the sky
 *
 * The sky's response is a line from its brightest star (peak 1) to its limit, clamped at
 * 1. Here the line is carried on past 1 instead: the display clips the core, as it would,
 * and the star's light goes into the size of its halo, which is how a source brighter
 * than the exposure shows in any image. Nothing in the sky from the Sun is past 1, so
 * this changes nothing there; Alpha Centauri from a light year, at -3.2, gets a halo a
 * third wider than Sirius's from Earth.
 *
 * ## The limit, as seen from the camera
 *
 * A star fainter than the sky's limiting magnitude *from where the camera is* is not
 * drawn: that is what a limiting magnitude means, and it is the rule that keeps the
 * hundred-parsec census -- three hundred thousand stars, all but eleven fainter than V 8
 * from the Sun -- out of the sky at home. The eleven are real stars Hipparcos and Tycho-2
 * missed, mostly companions listed under their primary's number, and they are the one
 * change to the sky from home, toward the truth: Mizar B, V 3.9, now beside Mizar. The cut is hard, at the brightness that is already
 * the threshold of visibility (FAINTEST_PEAK, five code values), and it is made at the
 * limit plus half the step the catalogue quotes V in (LIMIT_SLACK), for the reason given
 * there.
 *
 * ## The map: every star a dot, a convention
 *
 * Out among the stars that rule leaves almost nothing: from 50 light years only the
 * giants are brighter than V 8. So past the Solar System every star is drawn at least as a
 * dot (uMapDotPeak), at its real place and in its own colour -- **a map, not a view**, the
 * same convention the belt's dots are, and with the same crowding rule so the census seen
 * whole is a haze rather than a white ball (mapDotPeak). The Star Map layer switches it
 * off for the photometric picture alone.
 *
 * ## Precision
 *
 * The records are float32 parsecs about the Sun, exact as stored. The camera's position
 * about the Sun, float64 on the CPU, comes split into a high and a low float32, and the
 * star is taken from the high part first: near the camera the two nearly cancel, exactly,
 * and the low part carries what one float32 could not. What is left is
 *
 *  - the camera's low part, rounded: 2^-48 of its distance from the Sun, 10 km at 100 pc;
 *  - the motion, v times (t - J2000) times a constant, added after the subtraction so it is
 *    never rounded against a 100-pc position: float32 of the displacement, about 2^-24 of
 *    it -- for Barnard's Star, 140 km/s for 26 years, 3.8e-3 pc, measured 4,100 km;
 *  - the record itself, which is the data's own: 7.6e-6 pc at 100 pc (1.6 AU), 1.2e-7 pc
 *    at Alpha Centauri (0.025 AU), far inside every parallax's error.
 *
 * So a star the camera stands an AU from is placed within 4,100 km of its float64 position
 * in 2026 (Sirius 930, Alpha Centauri 1,260; 2,700 at most a century out), a twentieth
 * of a pixel at most, and does not move against its own marker. Measured in
 * stars3dShader.test.ts against astrometry written as the generator writes it.
 */

/**
 * How far past the sky's limit the cut is made, magnitudes: half of 0.01, the step stars.json
 * quotes V in.
 *
 * **Found on the shipped data, not chosen.** A star at exactly V 8.00, the limit, comes
 * back from Mv + 5 log10(d / 10) in float32 as 8.0000019 -- a few float32 steps of a
 * magnitude, from a distance of 2,342 pc -- and a cut at 8.00 dropped it, while the sky had
 * drawn it at FAINTEST_PEAK: 5.1 code values of difference at the faint end, the worst in
 * the whole sky. The arithmetic was right and the comparison was not: a catalogue that
 * quotes V to two decimals has said nothing finer than 0.01 about any star, so "at most
 * 8.00" means anything that rounds to 8.00, which is up to 8.005. That is the sky's own
 * limit read at its own precision, and three orders of magnitude wider than float32's
 * rounding, so no star sits on the edge of it by accident.
 */
export const LIMIT_SLACK = 0.005;

/** Light-years-out map dots: the display value of a star drawn only because it is in the map. */
export const MAP_DOT_PEAK = 0.12;

/**
 * Dots per pixel the map may put down before each is dimmed: the belt's rule, a budget of
 * light rather than of points. Past it each dot's peak goes down in proportion, so the
 * census seen whole reads as a glow whose brightness says how dense it is, and never as
 * a saturated disc.
 */
export const MAP_DOT_BUDGET = 0.3;

/** The radius the crowding is worked out over: the census, 100 pc. */
export const MAP_RADIUS_PC = 100;

/** Largest sprite, CSS pixels. Only a star a hundred magnitudes past the sky would reach it. */
export const MAX_STAR_SPRITE_PX = 256;

/** Scene units per parsec: 1000 km a unit. */
export const UNITS_PER_PC = PARSEC_KM / 1000;

/**
 * How bright each map dot is drawn, display value: MAP_DOT_PEAK, dimmed where they crowd.
 *
 * The census as a uniform ball of `count` stars and radius MAP_RADIUS_PC about the Sun.
 * From outside it they share the solid angle it fills; from inside, the whole sky. Per
 * pixel that is a density, and past MAP_DOT_BUDGET each dot gives up what the crowd
 * would add. Worked out once a frame, from four numbers: nothing per star.
 */
export function mapDotPeak(count: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  if (count <= 0) {
    return 0;
  }
  const ratio = MAP_RADIUS_PC / Math.max(cameraFromSunPc, MAP_RADIUS_PC);
  // The solid angle of a sphere seen from outside: 2 pi (1 - cos of its angular radius).
  const steradians =
    cameraFromSunPc > MAP_RADIUS_PC ? 2 * Math.PI * (1 - Math.sqrt(1 - ratio * ratio)) : 4 * Math.PI;
  const perPixel = count / steradians / (pixelsPerRadian * pixelsPerRadian);
  return MAP_DOT_PEAK * Math.min(1, MAP_DOT_BUDGET / perPixel);
}

/** A float64 split into the float32 pair the shader adds back together. */
export function splitHigh(value: number): number {
  return Math.fround(value);
}
export function splitLow(value: number): number {
  return Math.fround(value - Math.fround(value));
}

const f = Math.fround;
const LOG10_2 = 0.30102999566398120;

/** What the vertex shader works out for one star, in float32 as the GPU does. */
export interface StarSeen {
  /** From the camera, parsecs. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distancePc: number;
  readonly magnitude: number;
}

/**
 * The vertex shader's first lines in TypeScript, every operation rounded to float32 as the
 * GPU rounds it, so the tests can hold the shader to a number. `cameraPc` is the camera
 * about the Sun in float64; `years` Julian years since J2000.
 */
export function starSeenFrom(
  records: Float32Array,
  i: number,
  cameraPc: { readonly x: number; readonly y: number; readonly z: number },
  years: number,
): StarSeen {
  const base = i * STAR3D_FLOATS;
  const motion = f(years * KM_S_TO_PC_PER_YEAR);
  const axis = (p: number, v: number, camera: number): number =>
    f(f(f(p - splitHigh(camera)) - splitLow(camera)) + f(v * motion));
  const x = axis(records[base + STAR3D.x]!, records[base + STAR3D.vx]!, cameraPc.x);
  const y = axis(records[base + STAR3D.y]!, records[base + STAR3D.vy]!, cameraPc.y);
  const z = axis(records[base + STAR3D.z]!, records[base + STAR3D.vz]!, cameraPc.z);
  const distancePc = f(Math.sqrt(f(f(f(x * x) + f(y * y)) + f(z * z))));
  const magnitude = f(
    records[base + STAR3D.Mv]! + f(5 * f(f(f(Math.log2(Math.max(distancePc, 1e-12))) * f(LOG10_2)) - 1)),
  );
  return { x, y, z, distancePc, magnitude };
}

/**
 * The display peak the shader draws a star at, before fading: the sky's line, carried past
 * 1; or the map's dot; or null where it is not drawn at all.
 */
export function star3dPeak(
  magnitude: number,
  coefficients: readonly [number, number],
  limitMagnitude: number,
  dotPeak: number,
): number | null {
  if (magnitude <= limitMagnitude + LIMIT_SLACK) {
    return Math.max(DISPLAY_FLOOR, coefficients[0] + coefficients[1] * magnitude, dotPeak);
  }
  return dotPeak > 0 ? dotPeak : null;
}

/** Peak linear light, for a peak display value past 1 too: the sRGB curve, continued. */
export function peakLinear(peakDisplay: number): number {
  return peakDisplay <= 1 ? srgbToLinear(peakDisplay) : ((peakDisplay + 0.055) / 1.055) ** 2.4;
}

/**
 * The vertex shader. The fragment shader is the sky's, STAR_FRAGMENT_SHADER: the same
 * point spread, from the same varyings.
 *
 * The object is drawn at the camera's position, so the model-view matrix is a rotation:
 * three works it out in float64, and the camera's translation cancels there rather than in
 * float32. Depth is the sky's too -- none written, and the default one tested, which at
 * this near plane is 1 for anything past a few metres: a star is behind every body, which
 * at these distances is where it is.
 */
export const STAR3D_VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uMotion;
uniform float uUnitsPerPc;
uniform vec2 uMagnitudeToPeak;
uniform float uMagnitudeLimit;
uniform float uMapDotPeak;
uniform float uFade;
uniform float uSigmaPx;
uniform float uDisplayFloor;
uniform float uPixelRatio;

attribute vec3 velocity;
attribute float absMag;
attribute vec3 starColor;

varying vec3 vColor;
varying float vPeakLinear;
varying float vSizePx;

${LENS_VERTEX_GLSL}

float srgbToLinear(float value) {
  return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4);
}

void main() {
  // starSeenFrom(), in stars3dShader.ts, is these lines in TypeScript. The order is the
  // precision: the camera's high part first, then its low part, then the motion.
  vec3 rel = ((position - uCameraHigh) - uCameraLow) + velocity * uMotion;
  float distancePc = max(length(rel), 1e-12);
  float m = absMag + 5.0 * (log2(distancePc) * ${LOG10_2.toFixed(12)} - 1.0);

  // A black hole near the camera shows the star elsewhere, brighter or fainter, and twice:
  // this pass's image (lens.ts). Its distance stays what it is.
  float dm;
  bool imaged = lensStar(rel, dm);
  m += dm;

  // star3dPeak(), in TypeScript.
  float peak;
  // The limit at the catalogue's own precision: see LIMIT_SLACK.
  if (!imaged) {
    peak = -1.0;
  } else if (m <= uMagnitudeLimit + ${LIMIT_SLACK.toFixed(4)}) {
    peak = max(max(uDisplayFloor, uMagnitudeToPeak.x + uMagnitudeToPeak.y * m), uMapDotPeak);
  } else if (uMapDotPeak > 0.0 && uLensImage < 0.5) {
    // The map's dot marks where the star is, it is not its light: no dot for a far-side image.
    peak = uMapDotPeak;
  } else {
    peak = -1.0;
  }
  if (peak < 0.0) {
    // Fainter than the limit from here, and no map: outside the clip volume, no fragment.
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vColor = vec3(0.0);
    vPeakLinear = 0.0;
    vSizePx = 1.0;
    return;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);

  // peakLinear(): the sRGB curve, continued past 1 for a star brighter than the sky's.
  vPeakLinear = (peak <= 1.0 ? srgbToLinear(peak) : pow((peak + 0.055) / 1.055, 2.4)) * uFade;

  // The sprite the sky's shader sizes, from the same two terms.
  float peakOverFloor =
    vPeakLinear / (${(1 + STAR_WING_FRACTION).toFixed(3)} * srgbToLinear(uDisplayFloor));
  float coreRadius = uSigmaPx * sqrt(2.0 * max(0.0, log(max(1.0, peakOverFloor))));
  float wingRadius =
    uSigmaPx * sqrt(max(0.0, 2.0 * peakOverFloor * ${STAR_WING_FRACTION.toFixed(3)} - 1.0));
  vSizePx = min(max(2.0 * max(coreRadius, wingRadius), 1.0), ${MAX_STAR_SPRITE_PX.toFixed(1)});
  gl_PointSize = vSizePx * uPixelRatio;

  vColor = starColor;
}
`;
