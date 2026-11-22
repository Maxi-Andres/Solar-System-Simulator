import { RECORD, RECORD_FLOATS } from '../core/belt.ts';
import type { Vec3 } from '../core/vec3.ts';

/**
 * The asteroid belt's shaders, and the same arithmetic in TypeScript.
 *
 * Every asteroid is placed by the GPU, every frame, from its orbital elements: the mean
 * anomaly moved on by n·Δt, Kepler's equation solved for the eccentric anomaly, the
 * ellipse turned into the ecliptic, and the Sun's position added. Per frame the CPU sets
 * a handful of uniforms -- Δt, the Sun's offset, the pixel ratio -- and touches no
 * asteroid at all, which is what lets 84,000 of them (and B2b's hundreds of thousands)
 * move at sixty frames a second.
 *
 * **The GLSL and the TypeScript below are the same lines.** `beltPosition` is the vertex
 * shader written out in TypeScript, statement for statement, with every float32 rounding
 * the GPU makes spelled out as a Math.fround -- so the tests can hold the shader's
 * arithmetic against kepler.ts, the app's float64 two-body propagator, and measure what
 * float32 costs. Change one and change the other: nothing else checks the shader.
 *
 * **And no answer that rests on the GPU's sin or cos.** GLSL sets them no precision, and
 * they can have little: SwiftShader's are good to about 5e-4, which moved every asteroid
 * by that share of its distance, and a desktop GPU's own differ from the mirror's by up
 * to 4e-5 of it on the eccentric orbits (measured on an AMD iGPU by transform feedback).
 * So every sine and cosine an answer depends on -- Kepler's iterations, the final
 * position, the three angles of the orbit's plane -- is sinCos(): a range reduction by
 * π/2 in two parts and Cephes's minimax polynomials, + - * / only, which every GPU does
 * the same to a rounding. The GPU's own sin, like its pow, is left to the start, a guess
 * Newton corrects.
 */

/**
 * Newton iterations on Kepler's equation, fixed, so every vertex does the same work.
 *
 * **The start is what decides it**, and the obvious one fails. From E0 = M + e·sin M --
 * kepler.ts's, and fine for every planet -- Newton diverges outright for e above about
 * 0.99 just before perihelion: at e = 0.994 and M = -0.045 it overshoots to the far side
 * of the orbit and never comes back. The belt has such orbits: the scattered and
 * detached objects far past Neptune, up to e = 0.9996 with a semi-major axis of 14,500
 * AU. Starting from π for every e > 0.8, the usual cure, always converges but slowly:
 * eleven iterations to reach an asteroid at perihelion.
 *
 * So for e > CUBIC_START_E the start is the root of Kepler's equation with sin E cut at
 * its cubic term, (e/6)·E³ + (1 - e)·E = M -- exact in the limit that matters, a nearly
 * parabolic orbit near perihelion, where E races ahead of M -- solved in closed form by
 * Cardano and clamped to [-π, π]. Below it, the plain start is already close.
 *
 * Measured in float32 emulation (`solveKeplerF32`) over e in [0, 0.999] at steps of
 * 0.001, plus 0.9965, 0.9996 and on to 0.99999, and M at 6,000 steps across [-π, π) plus
 * logarithmic runs down to 1e-9 from both sides of perihelion and of aphelion:
 *
 *   iterations   worst |E - e·sin E - M|
 *       2              6.0e-5 rad
 *       3              3.9e-7 rad
 *       4, 5, 6        3.8e-7 to 4.0e-7 rad
 *
 * Three reach the floor: 4e-7 rad is about one and a half float32 steps of E near 2 rad,
 * as close as float32 can write the answer down, and more iterations only move it around
 * inside that step. Four ship, one to spare, because the start is the GPU's own sin or
 * pow, not the mirror's, and Newton is what absorbs the difference. (Three for the low
 * eccentricities alone, where two reach the floor, was tried: a loop of varying length is
 * not unrolled, and cost the GPU more than the iteration saved.)
 *
 * **The residual is written so it does not cancel near perihelion.** E - e·sin E for e
 * near 1 and E small subtracts two nearly equal numbers, and a float32 step of the
 * difference is then hundreds of E's: within NEAR_ZERO of perihelion it is written as
 * (1 - e)·E - e·(sin E - E), with sin E - E taken from the series' own terms (see
 * sinCos), and subtracts nothing -- 1 - e is exact in float32 for e over a half. The
 * slope and the position likewise use 1 - cos E from the series there, and √(1 - e²) is
 * √((1 - e)(1 + e)). At four iterations the worst error in E against a float64 bisection
 * is then 2.9e-7 rad, about a float32 step; it was 1.7e-6, at e = 0.999 a hair before
 * perihelion.
 *
 * And M is wrapped into [-π, π), the range the file stores it in, for the reason the file
 * does: perihelion is then at zero, where float32 is finest, instead of at a seam near
 * 2π. The wrap subtracts whole turns and nothing else, so an M already in range comes out
 * exactly as it went in -- the wrap there was, as mod(M + π, 2π) - π, which rounds M to a
 * step of π, 2.4e-7 rad: near perihelion at e = 0.996 that moved E by 2.4e-5 rad and a
 * 14,000-AU orbit's asteroid by four million kilometres. The wrap accepts M0 in either
 * range.
 */
export const KEPLER_ITERATIONS = 4;

/** Above this eccentricity Newton starts from the cubic root; see KEPLER_ITERATIONS. */
export const CUBIC_START_E = 0.5;

/** π and 2π as the GPU holds them: three's <common> defines both, rounded to float32. */
const PI_F32 = Math.fround(Math.PI);
const PI2_F32 = Math.fround(2 * Math.PI);

const f = Math.fround;

/**
 * π/2 and 2π each in two parts for range reduction: the first short enough (8 significant
 * bits) that a whole number of turns or quadrants times it is exact in float32, the second
 * the float32 of what is left -- so x - k·c loses nothing to c's own rounding, which for 2π
 * is 1.7e-7 rad a turn.
 */
const PIO2_HIGH = 1.5703125;
const PIO2_LOW = f(Math.PI / 2 - PIO2_HIGH);
const PI2_HIGH = 6.28125;
const PI2_LOW = f(2 * Math.PI - PI2_HIGH);
const TWO_OVER_PI = f(2 / Math.PI);

/**
 * Within this of perihelion, |E| in radians, Kepler's residual and the position are
 * written without cancelling (see KEPLER_ITERATIONS); outside it, plainly, which rounds
 * less where there is nothing to cancel. Under π/4, so sinCos's tails there are sin E - E
 * and 1 - cos E themselves.
 */
const NEAR_ZERO = 0.78;

/**
 * Cephes's single-precision minimax polynomials for sin and cos on [-π/4, π/4]: sin r =
 * r + r·z·(S0 + z·(S1 + z·S2)) and 1 - cos r = z·(1/2 - z·(C0 + z·(C1 + z·C2))), z = r².
 * Good to a float32 step on that range; outside it, sinCos reduces to it first.
 */
const SIN_COEFFICIENTS = [-1.6666654611e-1, 8.3321608736e-3, -1.9515295891e-4].map(f);
const COS_COEFFICIENTS = [4.166664568298827e-2, -1.388731625493765e-3, 2.443315711809948e-5].map(f);

/** A float32 as a GLSL literal that reads back as the same float32. */
function glslFloat(x: number): string {
  const text = f(x).toPrecision(9);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

/**
 * Display colour of a belt dot, before its alpha: a dim, slightly warm grey.
 *
 * **A convention, not a colour anyone measured.** Asteroids are dark -- a C-type reflects
 * 5% of the light that falls on it -- and slightly red, which is the warmth; but no
 * asteroid drawn here is anywhere near a pixel, so there is no real colour to show, only
 * a mark that says "something is here". Written as display values rather than through
 * THREE.Color, which would read them as sRGB and convert them to linear for a shader that
 * writes them out unconverted.
 */
export const BELT_COLOR: readonly [number, number, number] = [0.66, 0.64, 0.6];

/**
 * Where the dot rule is anchored: the first tier's limit, the H that B2a's 84,000
 * asteroids end at, and where the constants below were set by eye. Fixed here rather than
 * read from the data, so moving a tier boundary in the generator changes what is loaded
 * and never how anything looks.
 */
export const DOT_REFERENCE_H = 15;

/**
 * Dot size in CSS pixels: at DOT_REFERENCE_H and fainter, and at the brightest.
 *
 * Constant on screen whatever the distance, as NASA Eyes draws its belt, and **a
 * legibility convention**: a 1-km asteroid at 1 AU subtends 1.4 milliarcseconds, a
 * seventy-thousandth of a pixel, and even Pallas, 512 km across, is a two-hundredth of
 * one from Earth at its closest. Drawn at true size the belt would be nothing at all. One
 * CSS pixel is the smallest mark that survives the screen, so nothing is drawn smaller;
 * brighter -- which at one albedo means larger -- gets a little more, so the large ones
 * read as a sparser, stronger layer through the cloud, without any dot growing into
 * something that claims a size.
 */
export const DOT_FAINT_PX = 1;
export const DOT_BRIGHT_PX = 1.5;

/**
 * Dot opacity at DOT_REFERENCE_H and at the brightest.
 *
 * Alpha-blended, not added. The belt is a faint cloud seen through, not a light source:
 * where the dots pile up -- the whole belt in a few hundred pixels, from far out -- it
 * saturates at BELT_COLOR, a mid grey, rather than adding up to white and burning out
 * the planets in front of it. At the reference a dot on one pixel is 0.66 × 0.55 = 0.36
 * of white, code 93 of 255: visible on black, and well below a planet's marker.
 */
export const DOT_FAINT_ALPHA = 0.55;
export const DOT_BRIGHT_ALPHA = 0.9;

/**
 * Magnitudes from DOT_REFERENCE_H up to full size and opacity.
 *
 * Eight, so that H = 7 and brighter -- the largest, about 170 km and up at an albedo of
 * 0.1 -- are the full-size dots, and the tens of thousands near the reference share the
 * faint end. Between them the step is linear in H, which is linear in the log of size,
 * so each magnitude adds the same.
 */
export const DOT_H_SPAN = 8;

/**
 * The flux law: one magnitude fainter is 10^-0.4 of the light, 2.512 times less. Past
 * DOT_REFERENCE_H it is the most a dot may be drawn with -- never the amount; see
 * faintBinAlphas for what decides that.
 */
export const DOT_FADE_PER_MAGNITUDE = 10 ** -0.4;

/** How far a dot is from the reference to the brightest, 0 to 1: the shader's `bright`. */
function brightness(H: number): number {
  return Math.min(1, Math.max(0, (DOT_REFERENCE_H - H) / DOT_H_SPAN));
}

/** A dot's diameter in CSS pixels, brighter than the reference; the shader's rule. */
export function dotDiameterPx(H: number): number {
  return DOT_FAINT_PX + (DOT_BRIGHT_PX - DOT_FAINT_PX) * brightness(H);
}

/**
 * A dot's opacity by the flux law: B2a's rule brighter than the reference, and from it
 * 2.512 times less a magnitude. What a dot brighter than the reference is drawn with,
 * and the cap on one fainter.
 */
export function dotAlpha(H: number): number {
  const fade = DOT_FADE_PER_MAGNITUDE ** Math.max(0, H - DOT_REFERENCE_H);
  return (DOT_FAINT_ALPHA + (DOT_BRIGHT_ALPHA - DOT_FAINT_ALPHA) * brightness(H)) * fade;
}

/**
 * Whole magnitudes past DOT_REFERENCE_H that get a light of their own: 15 to 16, 16 to
 * 17, and so on, the last taking everything fainter -- the catalogue runs out of
 * asteroids long before H 31.
 */
export const FAINT_BINS = 16;

/**
 * Each magnitude past the reference carries this share of the light of the one before.
 *
 * **Past the reference, the light drawn is an exposure, not the asteroids'.** By the flux
 * law alone (DOT_FADE_PER_MAGNITUDE) the whole catalogue is a sheet: the numbers grow 2.3
 * times a magnitude through the main belt while each asteroid gets 2.5 times fainter, so
 * each magnitude carries nearly as much light as the last -- 92% -- and from Jupiter's
 * distance, seven dots to a pixel, the belt drawn that way was a solid beige annulus. So
 * each fainter magnitude is given half the light of the one before, whatever its count,
 * shared equally among its dots: the light of the 14th magnitude, B2a's last, for the
 * chain to start from, then half, a quarter, an eighth. However many there are, the
 * faint catalogue together adds no more light than that one magnitude of the bright.
 * Measured on the generated belt, in opacity times area: B2a's 84,000 carry 64,000, its
 * last magnitude 31,000, and the four fainter tiers together 29,000 -- 0.45 of B2a,
 * where by the flux law they were 2.4 times it. So the shape is still the bright
 * asteroids', with the faint ones a haze in which density reads.
 *
 * What it costs, said plainly: the faint dots alone get very faint. On its one pixel at a
 * ratio of 1.25, a dot of the 15th magnitude is 31 code values of 255, the 16th 7, the
 * 17th 2 and the 18th under one -- which an 8-bit canvas rounds away unless several land
 * on the same pixel. Keeping them would take adding their light in a floating-point
 * target and compressing it once, and that is a second pass with the scene's depth this
 * renderer does not have. Stated as the choice it is, as the stars' exposure is (see
 * starRendering.ts).
 */
export const FAINT_LIGHT_PER_MAGNITUDE = 0.5;

/**
 * The least opacity a bright dot -- H under 15 -- is drawn at however crowded it gets:
 * 0.08, 13 code values of 255 on one pixel. Visible on black as a point, too faint to
 * pile into a blob until dozens share a pixel.
 */
export const CROWDED_BRIGHT_FLOOR = 0.08;

/** Slots in the per-class uniform: room for every class code, and spare. */
export const CLASS_SLOTS = 16;

/** The magnitude bin a faint H falls in, 0 to FAINT_BINS - 1; the shader's `bin`. */
export function faintBin(H: number): number {
  return Math.min(FAINT_BINS - 1, Math.max(0, Math.floor(H - DOT_REFERENCE_H)));
}

/**
 * The opacity every dot in each faint magnitude is drawn with, before its pixel: the
 * shader's `uFaintAlpha`, worked out from the records in hand whenever a tier arrives.
 *
 * "Light" here is opacity times area, in dots of one CSS pixel: a bright dot of 1.5 px
 * counts 2.25. The 14th magnitude's light is summed from its own dots; magnitude m past
 * the reference gets that times FAINT_LIGHT_PER_MAGNITUDE^(m + 1), divided among its
 * dots, and never more per dot than the flux law gives at the bin's bright edge -- a
 * magnitude the catalogue is running out of, with few dots to share its light, does not
 * get them brighter than they are. A bin with no dots is zero.
 */
export function faintBinAlphas(tiers: readonly Float32Array[]): Float32Array {
  let referenceLight = 0;
  const counts = new Float64Array(FAINT_BINS);
  for (const records of tiers) {
    for (let base = 0; base < records.length; base += RECORD_FLOATS) {
      const H = records[base + RECORD.H]!;
      if (H >= DOT_REFERENCE_H) {
        const bin = faintBin(H);
        counts[bin] = counts[bin]! + 1;
      } else if (H >= DOT_REFERENCE_H - 1) {
        referenceLight += dotAlpha(H) * dotDiameterPx(H) ** 2;
      }
    }
  }
  const alphas = new Float32Array(FAINT_BINS);
  for (let bin = 0; bin < FAINT_BINS; bin += 1) {
    const count = counts[bin]!;
    if (count > 0) {
      const share = (referenceLight * FAINT_LIGHT_PER_MAGNITUDE ** (bin + 1)) / count;
      alphas[bin] = Math.min(share, dotAlpha(DOT_REFERENCE_H + bin));
    }
  }
  return alphas;
}

/**
 * The area, in device pixels, of the soft one-CSS-pixel disc a faint dot used to be: what
 * its single pixel's opacity is scaled by, so it gives the light the disc gave. A disc of
 * radius r with a one-pixel linear edge covers pi·(r² + 1/12) in all; at a ratio of 1.25,
 * 1.49 pixels.
 */
export function faintDotArea(pixelRatio: number): number {
  const r = 0.5 * pixelRatio;
  return Math.PI * (r * r + 1 / 12);
}

/** A faint dot's opacity on its one pixel; the shader's faint branch. */
export function faintDotAlpha(H: number, binAlphas: Float32Array, pixelRatio: number): number {
  return Math.min(1, binAlphas[faintBin(H)]! * faintDotArea(pixelRatio));
}

/**
 * Fragments a dot's point sprite covers, device pixels: the shader's gl_PointSize,
 * squared. Faint dots are one pixel; the rest a whole number of pixels around a disc and
 * its soft edge.
 */
export function spriteFragments(H: number, pixelRatio: number): number {
  if (H >= DOT_REFERENCE_H) {
    return 1;
  }
  const side = Math.ceil(dotDiameterPx(H) * pixelRatio + 1);
  return side * side;
}

/**
 * The vertex shader.
 *
 * The record arrives as three attributes over one interleaved buffer (see
 * AsteroidBelt.tsx), straight from the file: `aShape` is a (km), e, i; `aAngles` the
 * node, the argument of perihelion and M at the reference instant, in [-π, π); `aMotion`
 * n (rad/day), H and the class code, which picks the population's crowding and fade
 * (see beltCrowding.ts). All radians.
 *
 * The Sun's offset from the focus comes split into a high and a low float32, as a
 * trajectory's origin does (see splitDouble in trajectoryLine.ts), and is added high
 * first: near the focus the asteroid and the Sun's high part nearly cancel, exactly, and
 * the low part then carries what one float32 could not. Without it every asteroid would
 * move together by up to half a float32 step of the Sun's distance -- 256 km with Pluto
 * in focus -- each time the focus moved. What is left is each asteroid's own float32
 * position, a step of 32 km at 3 AU, and that is the floor (see the tests).
 *
 * Δt arrives as one float32 and is multiplied by n in float32, and past a few years that
 * product's rounding is most of the error: a main-belt n·Δt reaches 14 rad in ten years,
 * where one float32 step is 1e-6 rad. Measured against kepler.ts in float64, the whole
 * chain is off by at most 71 km within a year of the reference instant, 1.8e-6 of the
 * orbit at ten years (405 km at Ceres's distance) and 3.8e-5 at a century; over the whole
 * catalogue at the reference instant, by 3.3e-7 of each asteroid's distance at worst and
 * 7.5e-8 typically, the same on the GPU as in the mirror. Splitting Δt
 * into two floats would not touch it -- the rounding is in the product, not in Δt -- and
 * a per-asteroid wrap is what the CPU must not do. It is left, because the two-body
 * model's own drift is 40,000 to 190,000 km in the first year alone.
 *
 * The log-depth chunks are not optional: the scene's depth buffer is logarithmic (see
 * logDepth.ts), and a point written with a plain depth would be tested against the
 * planets at the wrong distance -- in front of all of them, or behind.
 */
export const BELT_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute vec3 aShape;
  attribute vec3 aAngles;
  attribute vec3 aMotion;

  uniform float uDtDays;
  uniform vec3 uSunHigh;
  uniform vec3 uSunLow;
  uniform float uUnitsPerKm;
  uniform float uPixelRatio;
  uniform float uFaintAlpha[${FAINT_BINS}];
  uniform float uClassCrowding[${CLASS_SLOTS}];
  uniform float uClassFade[${CLASS_SLOTS}];
  // This tier's records that are bodies of their own just now (see beltBodies.ts), or -1.
  uniform int uHidden[2];

  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;

  // cubicStartF32(), in TypeScript. GLSL has no cbrt; pow wants a non-negative base.
  float cbrtSigned(float x) {
    return sign(x) * pow(abs(x), 1.0 / 3.0);
  }

  float cubicStart(float M, float e) {
    float P = 6.0 * (1.0 - e) / e;
    float Q = 6.0 * M / e;
    float h = 0.5 * Q;
    float p3 = P / 3.0;
    float D = sqrt(h * h + p3 * p3 * p3);
    return clamp(cbrtSigned(D + h) - cbrtSigned(D - h), -PI, PI);
  }

  // sinCosF32(), in TypeScript: sin x and cos x from + - * / alone; and sin r - r and
  // 1 - cos r of the reduced r, which within π/4 of zero are sin x - x and 1 - cos x
  // straight from the series' own terms, with nothing cancelled.
  void sinCos(float x, out float s, out float c, out float sinTail, out float cosTail) {
    float q = floor(x * ${glslFloat(TWO_OVER_PI)} + 0.5);
    float r = (x - q * ${glslFloat(PIO2_HIGH)}) - q * ${glslFloat(PIO2_LOW)};
    float z = r * r;
    sinTail = (r * z) * (${glslFloat(SIN_COEFFICIENTS[0]!)} + z * (${glslFloat(SIN_COEFFICIENTS[1]!)} + z * ${glslFloat(SIN_COEFFICIENTS[2]!)}));
    cosTail = z * (0.5 - z * (${glslFloat(COS_COEFFICIENTS[0]!)} + z * (${glslFloat(COS_COEFFICIENTS[1]!)} + z * ${glslFloat(COS_COEFFICIENTS[2]!)})));
    float sr = r + sinTail;
    float cr = 1.0 - cosTail;
    int quadrant = int(q) & 3;
    bool odd = (quadrant & 1) == 1;
    float flip = quadrant >= 2 ? -1.0 : 1.0;
    s = flip * (odd ? cr : sr);
    c = flip * (odd ? -sr : cr);
  }

  void main() {
    // A population faded out with its region (see beltCrowding.ts), or hidden with its
    // family, is put outside the clip volume before anything is worked out for it: no
    // Kepler solve, no fragment. So is an asteroid that is a body of its own just now,
    // which is drawn as that and must not be drawn twice.
    int population = int(clamp(aMotion.z, 0.0, ${(CLASS_SLOTS - 1).toFixed(1)}) + 0.5);
    float fade = uClassFade[population];
    if (fade <= 0.0 || gl_VertexID == uHidden[0] || gl_VertexID == uHidden[1]) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      gl_PointSize = 1.0;
      vAlpha = 0.0;
      vRadiusPx = 0.0;
      vSpritePx = 1.0;
      return;
    }

    // beltPosition(), below in beltShader.ts, is these lines in TypeScript.
    float a = aShape.x;
    float e = aShape.y;
    float oneMinusE = 1.0 - e;
    float Mraw = aAngles.z + aMotion.x * uDtDays;
    float turns = floor((Mraw + PI) / PI2);
    float M = (Mraw - turns * ${glslFloat(PI2_HIGH)}) - turns * ${glslFloat(PI2_LOW)};
    float E = e > ${CUBIC_START_E.toFixed(2)} ? cubicStart(M, e) : M + e * sin(M);
    float sinE;
    float cosE;
    float sinTail;
    float cosTail;
    bool nearZero = false;
    float newtonStep = 0.0;
    for (int k = 0; k < ${KEPLER_ITERATIONS}; k++) {
      sinCos(E, sinE, cosE, sinTail, cosTail);
      nearZero = abs(E) < ${glslFloat(NEAR_ZERO)};
      float residual = nearZero ? (oneMinusE * E - e * sinTail) - M : (E - e * sinE) - M;
      float slope = nearZero ? oneMinusE + e * cosTail : 1.0 - e * cosE;
      newtonStep = -residual / slope;
      E = E + newtonStep;
    }
    // The answer's sin E and cos E: the last iteration's, turned through its step.
    float halfStep2 = 0.5 * (newtonStep * newtonStep);
    float xp = nearZero
      ? a * (oneMinusE - ((cosTail + sinE * newtonStep) + cosE * halfStep2))
      : a * (((cosE - sinE * newtonStep) - cosE * halfStep2) - e);
    float yp = (a * sqrt(oneMinusE * (1.0 + e))) * ((sinE + cosE * newtonStep) - sinE * halfStep2);

    float unused;
    float cosNode;
    float sinNode;
    float cosPeri;
    float sinPeri;
    float cosI;
    float sinI;
    sinCos(aAngles.x, sinNode, cosNode, unused, unused);
    sinCos(aAngles.y, sinPeri, cosPeri, unused, unused);
    sinCos(aShape.z, sinI, cosI, unused, unused);
    vec3 helio = vec3(
      (cosNode * cosPeri - sinNode * sinPeri * cosI) * xp +
        (-cosNode * sinPeri - sinNode * cosPeri * cosI) * yp,
      (sinNode * cosPeri + cosNode * sinPeri * cosI) * xp +
        (-sinNode * sinPeri + cosNode * cosPeri * cosI) * yp,
      sinPeri * sinI * xp + cosPeri * sinI * yp
    );
    vec3 km = (helio + uSunHigh) + uSunLow;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(km * uUnitsPerKm, 1.0);
    #include <logdepthbuf_vertex>

    if (aMotion.y >= ${DOT_REFERENCE_H.toFixed(1)}) {
      // faintDotAlpha(), in TypeScript. One device pixel, carrying the light of the soft
      // one-CSS-pixel disc it replaces: one fragment where the disc took nine, which is
      // what a million and a half of them on a third of the screen was costing. The disc's
      // soft edge was against a visible dot hopping a pixel as it moves; these are a
      // haze, and do not show it.
      int bin = int(clamp(floor(aMotion.y - ${DOT_REFERENCE_H.toFixed(1)}), 0.0, ${(FAINT_BINS - 1).toFixed(1)}));
      float r = 0.5 * uPixelRatio;
      vAlpha = min(1.0, uFaintAlpha[bin] * PI * (r * r + 1.0 / 12.0)) * uClassCrowding[population];
      // Radius one half, sprite one: the fragment shader's coverage is then exactly 1.
      vRadiusPx = 0.5;
      vSpritePx = 1.0;
    } else {
      // dotDiameterPx() and dotAlpha(), in TypeScript: B2a's dots, unchanged.
      float bright = clamp((${DOT_REFERENCE_H.toFixed(1)} - aMotion.y) / ${DOT_H_SPAN.toFixed(1)}, 0.0, 1.0);
      float diameterPx =
        mix(${DOT_FAINT_PX.toFixed(3)}, ${DOT_BRIGHT_PX.toFixed(3)}, bright) * uPixelRatio;
      vRadiusPx = 0.5 * diameterPx;
      // A whole number of pixels holding the disc and its half-pixel soft edge all round.
      vSpritePx = ceil(diameterPx + 1.0);
      float alpha = mix(${DOT_FAINT_ALPHA.toFixed(3)}, ${DOT_BRIGHT_ALPHA.toFixed(3)}, bright);
      // crowdedAlpha(), in beltCrowding.ts: never under the floor however crowded.
      vAlpha = max(alpha * uClassCrowding[population], min(alpha, ${CROWDED_BRIGHT_FLOOR.toFixed(3)}));
    }
    vAlpha *= fade;
    gl_PointSize = vSpritePx;
  }
`;

/**
 * The fragment shader: a disc with a one-pixel soft edge.
 *
 * Not a hard square of pixels. A one-pixel point lands on whichever pixel its centre is
 * nearest, so a dot moving across the screen hops a pixel at a time and a slowly turning
 * belt shimmers. Here each pixel takes the share of the disc over it -- a dot on a pixel
 * corner lights four at a quarter each, and the light it gives stays about one pixel's
 * worth wherever it is.
 */
export const BELT_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uColor;
  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;

  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - vec2(0.5)) * vSpritePx;
    float coverage = clamp(vRadiusPx + 0.5 - d, 0.0, 1.0);
    if (coverage <= 0.0) {
      discard;
    }
    gl_FragColor = vec4(uColor, vAlpha * coverage);
  }
`;

/** The shader's cube root: sign times pow of the magnitude, in float32. */
function cbrtSignedF32(x: number): number {
  return f(Math.sign(x) * f(Math.pow(Math.abs(x), f(1 / 3))));
}

/**
 * The shader's start for an eccentric orbit: the real root of (e/6)·E³ + (1 - e)·E = M,
 * by Cardano, clamped to [-π, π]. The cubic is monotonic, so the root is unique, and D is
 * at least |h|, so neither cube root's argument is negative but by a rounding.
 */
export function cubicStartF32(M: number, e: number): number {
  const P = f(f(6 * f(1 - e)) / e);
  const Q = f(f(6 * M) / e);
  const h = f(0.5 * Q);
  const p3 = f(P / 3);
  const D = f(Math.sqrt(f(f(h * h) + f(f(p3 * p3) * p3))));
  return Math.min(PI_F32, Math.max(-PI_F32, f(cbrtSignedF32(f(D + h)) - cbrtSignedF32(f(D - h)))));
}

/** What sinCosF32 returns: sin x, cos x, and sin r - r and 1 - cos r of the reduced r. */
export type SinCos = readonly [sin: number, cos: number, sinTail: number, cosTail: number];

/**
 * The shader's sinCos(), in float32: x reduced to r within π/4 of the nearest multiple of
 * π/2, Cephes's polynomials for r, and the quadrant's swap and signs. The tails are the
 * polynomials' own terms past r and past 1: for |x| under π/4, where r is x, they are
 * sin x - x and 1 - cos x with no cancellation however small x is.
 */
export function sinCosF32(x: number): SinCos {
  x = f(x);
  const q = Math.floor(f(f(x * TWO_OVER_PI) + 0.5));
  const r = f(f(x - f(q * PIO2_HIGH)) - f(q * PIO2_LOW));
  const z = f(r * r);
  const [s0, s1, s2] = SIN_COEFFICIENTS as [number, number, number];
  const [c0, c1, c2] = COS_COEFFICIENTS as [number, number, number];
  const sinTail = f(f(r * z) * f(s0 + f(z * f(s1 + f(z * s2)))));
  const cosTail = f(z * f(0.5 - f(z * f(c0 + f(z * f(c1 + f(z * c2)))))));
  const sr = f(r + sinTail);
  const cr = f(1 - cosTail);
  const quadrant = ((q % 4) + 4) % 4;
  const odd = quadrant % 2 === 1;
  const flip = quadrant >= 2 ? -1 : 1;
  return [flip * (odd ? cr : sr), flip * (odd ? -sr : cr), sinTail, cosTail];
}

/**
 * Kepler's equation in float32, as the shader solves it: E from M in [-π, π) and e.
 *
 * `iterations` is there for the test that chose KEPLER_ITERATIONS; the shader has only
 * the one.
 */
export function solveKeplerF32(M: number, e: number, iterations = KEPLER_ITERATIONS): number {
  return keplerF32(M, e, iterations).E;
}

/** What the shader's Kepler solve leaves: E, and the perifocal x and y over a. */
export interface KeplerF32 {
  readonly E: number;
  /** cos E - e: the perifocal x, in semi-major axes. */
  readonly cosEMinusE: number;
  readonly sinE: number;
}

/**
 * The shader's Kepler solve, statement for statement.
 *
 * Near perihelion the residual is (1 - e)·E - e·(sin E - E) and the slope (1 - e) +
 * e·(1 - cos E), the tails from sinCos; elsewhere E - e·sin E and 1 - e·cos E, which round
 * less where nothing cancels. sin E and cos E at the answer are not worked out afresh:
 * they are the last iteration's, turned through its step by the angle-sum formulas to
 * second order. That step is a few float32 steps of E -- the iteration before reached the
 * floor (see KEPLER_ITERATIONS) -- so the third-order terms left out are under 1e-17, and
 * it saves the GPU one sinCos an asteroid.
 */
export function keplerF32(M: number, e: number, iterations = KEPLER_ITERATIONS): KeplerF32 {
  const oneMinusE = f(1 - e);
  let E = e > CUBIC_START_E ? cubicStartF32(M, e) : f(M + f(e * f(Math.sin(M))));
  let sinE = 0;
  let cosE = 1;
  let cosTail = 0;
  let nearZero = false;
  let step = 0;
  for (let k = 0; k < iterations; k += 1) {
    let sinTail: number;
    [sinE, cosE, sinTail, cosTail] = sinCosF32(E);
    nearZero = Math.abs(E) < f(NEAR_ZERO);
    const residual = nearZero
      ? f(f(f(oneMinusE * E) - f(e * sinTail)) - M)
      : f(f(E - f(e * sinE)) - M);
    const slope = nearZero ? f(oneMinusE + f(e * cosTail)) : f(1 - f(e * cosE));
    step = -f(residual / slope);
    E = f(E + step);
  }
  const halfStep2 = f(0.5 * f(step * step));
  return {
    E,
    cosEMinusE: nearZero
      ? f(oneMinusE - f(f(cosTail + f(sinE * step)) + f(cosE * halfStep2)))
      : f(f(f(cosE - f(sinE * step)) - f(cosE * halfStep2)) - e),
    sinE: f(f(sinE + f(cosE * step)) - f(sinE * halfStep2)),
  };
}

/**
 * The shader's mean anomaly: moved on by n·Δt and wrapped into [-π, π), in float32, by
 * whole turns of 2π in two parts -- none at all when M is already in range.
 */
export function meanAnomalyF32(M0: number, n: number, dtDays: number): number {
  const raw = f(f(M0) + f(f(n) * f(dtDays)));
  const turns = Math.floor(f(f(raw + PI_F32) / PI2_F32));
  return f(f(raw - f(turns * PI2_HIGH)) - f(turns * PI2_LOW));
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * Where asteroid `index` is, `dtDays` after the belt's reference instant, relative to
 * whatever `sunKm` is measured from: the vertex shader, line for line, in float32.
 *
 * `sunKm` is the Sun's position relative to the focus, float64, split exactly as the
 * frame loop splits it. Left out, the answer is heliocentric. Kilometres, ecliptic and
 * mean equinox of J2000, the frame of every table here.
 */
export function beltPosition(
  records: Float32Array,
  index: number,
  dtDays: number,
  sunKm: Vec3 = ZERO,
): Vec3 {
  const base = index * RECORD_FLOATS;
  const a = records[base + RECORD.a]!;
  const e = records[base + RECORD.e]!;
  const M = meanAnomalyF32(records[base + RECORD.M]!, records[base + RECORD.n]!, dtDays);
  const { cosEMinusE, sinE } = keplerF32(M, e);
  const xp = f(a * cosEMinusE);
  const yp = f(f(a * f(Math.sqrt(f(f(1 - e) * f(1 + e))))) * sinE);

  const [sinNode, cosNode] = sinCosF32(records[base + RECORD.node]!);
  const [sinPeri, cosPeri] = sinCosF32(records[base + RECORD.peri]!);
  const [sinI, cosI] = sinCosF32(records[base + RECORD.i]!);
  const helio = {
    x: f(
      f(f(f(cosNode * cosPeri) - f(f(sinNode * sinPeri) * cosI)) * xp) +
        f(f(f(-cosNode * sinPeri) - f(f(sinNode * cosPeri) * cosI)) * yp),
    ),
    y: f(
      f(f(f(sinNode * cosPeri) + f(f(cosNode * sinPeri) * cosI)) * xp) +
        f(f(f(-sinNode * sinPeri) + f(f(cosNode * cosPeri) * cosI)) * yp),
    ),
    z: f(f(f(sinPeri * sinI) * xp) + f(f(cosPeri * sinI) * yp)),
  };

  // The frame loop's split (see AsteroidBelt), then the shader's high-first sum.
  const xHigh = f(sunKm.x);
  const yHigh = f(sunKm.y);
  const zHigh = f(sunKm.z);
  return {
    x: f(f(helio.x + xHigh) + f(sunKm.x - xHigh)),
    y: f(f(helio.y + yHigh) + f(sunKm.y - yHigh)),
    z: f(f(helio.z + zHigh) + f(sunKm.z - zHigh)),
  };
}
