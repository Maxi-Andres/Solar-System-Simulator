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
 * What the mirror cannot reproduce is the GPU's own sin and cos, which GLSL leaves to the
 * implementation; it rounds the exact ones to float32. On a desktop GPU the built-ins are
 * good to a few float32 steps over [-π, π], which is all the range they are given here.
 */

/**
 * Newton iterations on Kepler's equation, fixed, so every vertex does the same work.
 *
 * **The start is what decides it**, and the obvious one fails. From E0 = M + e·sin M --
 * kepler.ts's, and fine for every planet -- Newton diverges outright for e above about
 * 0.99 just before perihelion: at e = 0.994 and M = -0.045 it overshoots to the far side
 * of the orbit and never comes back. The belt has such orbits: the scattered and
 * detached objects far past Neptune, up to e = 0.9996 with a semi-major axis of 14,500 AU. Starting from π for every e > 0.8, the usual cure, always converges
 * but slowly: eleven iterations to reach an asteroid at perihelion.
 *
 * So for e > CUBIC_START_E the start is the root of Kepler's equation with sin E cut at
 * its cubic term, (e/6)·E³ + (1 - e)·E = M -- exact in the limit that matters, a nearly
 * parabolic orbit near perihelion, where E races ahead of M -- solved in closed form by
 * Cardano and clamped to [-π, π]. Below it, the plain start is already close.
 *
 * Measured in float32 emulation (`solveKeplerF32`) over e in [0, 0.999] at steps of 0.001,
 * plus 0.9965, 0.9996 and on to 0.99999, and M at 6,000 steps across [-π, π) plus logarithmic runs down to 1e-9 from
 * both sides of perihelion and of aphelion:
 *
 *   iterations   worst |E - e·sin E - M|
 *       2              6.0e-5 rad
 *       3              3.8e-7 rad
 *       4, 5, 6        3.8e-7 rad
 *
 * Three reach the floor: 3.8e-7 rad is one and a half float32 steps of E near 2 rad, as
 * close as float32 can write the answer down, and more iterations only move it around
 * inside that step. Four ship, one to spare, because the GPU's sin, cos and pow are not
 * the mirror's correctly rounded ones and Newton is what absorbs the difference. At four
 * the worst error in E itself, against a float64 bisection, is 1.7e-6 rad, at e = 0.999
 * a hair before perihelion -- not the iteration but the equation: there 1 - e·cos E is
 * 0.002, so one float32 step of the residual is five hundred of E.
 *
 * And M is wrapped into [-π, π), the range the file stores it in, for the reason the file
 * does: perihelion is then at zero, where float32 is finest, instead of at a seam near
 * 2π. The wrap accepts M0 in either range.
 */
export const KEPLER_ITERATIONS = 4;

/** Above this eccentricity Newton starts from the cubic root; see KEPLER_ITERATIONS. */
export const CUBIC_START_E = 0.5;

/** π and 2π as the GPU holds them: three's <common> defines both, rounded to float32. */
const PI_F32 = Math.fround(Math.PI);
const PI2_F32 = Math.fround(2 * Math.PI);

const f = Math.fround;

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
 * Dot size in CSS pixels, at the file's faintest H and at the brightest.
 *
 * Constant on screen whatever the distance, as NASA Eyes draws its belt, and **a
 * legibility convention**: a 1-km asteroid at 1 AU subtends 1.4 milliarcseconds, a
 * seventy-thousandth of a pixel, and even Pallas, 512 km across, is a two-hundredth of
 * one from Earth at its closest. Drawn at
 * true size the belt would be nothing at all. One CSS pixel is the smallest mark that
 * survives the screen; brighter -- which at one albedo means larger -- gets a little
 * more, so the large ones read as a sparser, stronger layer through the cloud, without
 * any dot growing into something that claims a size.
 */
export const DOT_FAINT_PX = 1;
export const DOT_BRIGHT_PX = 1.5;

/**
 * Dot opacity at the faintest H and at the brightest.
 *
 * Alpha-blended, not added. The belt is a faint cloud seen through, not a light source:
 * where the dots pile up -- the whole belt in a few hundred pixels, from far out -- it
 * saturates at BELT_COLOR, a mid grey, rather than adding up to white and burning out
 * the planets in front of it. At the faintest a dot on one pixel is 0.66 × 0.55 = 0.36
 * of white, code 93 of 255: visible on black, and well below a planet's marker.
 */
export const DOT_FAINT_ALPHA = 0.55;
export const DOT_BRIGHT_ALPHA = 0.9;

/**
 * Magnitudes from the file's limit up to full size and opacity.
 *
 * Eight, so that H = 7 and brighter -- the largest, about 170 km and up at an albedo of
 * 0.1 -- are the full-size dots, and the tens of thousands near the limit share the
 * faint end. Between them the step is linear in H, which is linear
 * in the log of size, so each magnitude adds the same.
 */
export const DOT_H_SPAN = 8;

/** How far a dot is from faintest to brightest, 0 to 1: the shader's `bright`. */
function brightness(H: number, faintH: number): number {
  return Math.min(1, Math.max(0, (faintH - H) / DOT_H_SPAN));
}

/** A dot's diameter in CSS pixels; the shader's rule. */
export function dotDiameterPx(H: number, faintH: number): number {
  return DOT_FAINT_PX + (DOT_BRIGHT_PX - DOT_FAINT_PX) * brightness(H, faintH);
}

/** A dot's opacity; the shader's rule. */
export function dotAlpha(H: number, faintH: number): number {
  return DOT_FAINT_ALPHA + (DOT_BRIGHT_ALPHA - DOT_FAINT_ALPHA) * brightness(H, faintH);
}

/**
 * The vertex shader.
 *
 * The record arrives as three attributes over one interleaved buffer (see
 * AsteroidBelt.tsx), straight from the file: `aShape` is a (km), e, i; `aAngles` the
 * node, the argument of perihelion and M at the reference instant, in [-π, π); `aMotion`
 * n (rad/day) and H. All radians.
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
 * chain is off by at most 141 km within a year of the reference instant, 2.4e-6 of the
 * orbit at ten years (404 km at Ceres's distance) and 3.1e-5 at a century. Splitting Δt
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
  attribute vec2 aMotion;

  uniform float uDtDays;
  uniform vec3 uSunHigh;
  uniform vec3 uSunLow;
  uniform float uUnitsPerKm;
  uniform float uPixelRatio;
  uniform float uFaintH;

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

  void main() {
    // beltPosition(), below in beltShader.ts, is these lines in TypeScript.
    float a = aShape.x;
    float e = aShape.y;
    float M = mod(aAngles.z + aMotion.x * uDtDays + PI, PI2) - PI;
    float E = e > ${CUBIC_START_E.toFixed(2)} ? cubicStart(M, e) : M + e * sin(M);
    for (int k = 0; k < ${KEPLER_ITERATIONS}; k++) {
      E = E - (E - e * sin(E) - M) / (1.0 - e * cos(E));
    }
    float xp = a * (cos(E) - e);
    float yp = a * sqrt(1.0 - e * e) * sin(E);

    float cosNode = cos(aAngles.x);
    float sinNode = sin(aAngles.x);
    float cosPeri = cos(aAngles.y);
    float sinPeri = sin(aAngles.y);
    float cosI = cos(aShape.z);
    float sinI = sin(aShape.z);
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

    // dotDiameterPx() and dotAlpha(), in TypeScript.
    float bright = clamp((uFaintH - aMotion.y) / ${DOT_H_SPAN.toFixed(1)}, 0.0, 1.0);
    float diameterPx =
      mix(${DOT_FAINT_PX.toFixed(3)}, ${DOT_BRIGHT_PX.toFixed(3)}, bright) * uPixelRatio;
    vRadiusPx = 0.5 * diameterPx;
    // A whole number of pixels, with one to spare all round for the soft edge.
    vSpritePx = ceil(diameterPx) + 2.0;
    gl_PointSize = vSpritePx;
    vAlpha = mix(${DOT_FAINT_ALPHA.toFixed(3)}, ${DOT_BRIGHT_ALPHA.toFixed(3)}, bright);
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

/**
 * Kepler's equation in float32, as the shader solves it: E from M in [-π, π) and e.
 *
 * `iterations` is there for the test that chose KEPLER_ITERATIONS; the shader has only
 * the one.
 */
export function solveKeplerF32(M: number, e: number, iterations = KEPLER_ITERATIONS): number {
  let E = e > CUBIC_START_E ? cubicStartF32(M, e) : f(M + f(e * f(Math.sin(M))));
  for (let k = 0; k < iterations; k += 1) {
    E = f(E - f(f(f(E - f(e * f(Math.sin(E)))) - M) / f(1 - f(e * f(Math.cos(E))))));
  }
  return E;
}

/** The shader's mean anomaly: moved on by n·Δt and wrapped into [-π, π), in float32. */
export function meanAnomalyF32(M0: number, n: number, dtDays: number): number {
  const x = f(f(f(M0) + f(f(n) * f(dtDays))) + PI_F32);
  // GLSL's mod(x, y) is x - y·floor(x / y).
  return f(f(x - f(PI2_F32 * Math.floor(f(x / PI2_F32)))) - PI_F32);
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
  const E = solveKeplerF32(M, e);
  const xp = f(a * f(f(Math.cos(E)) - e));
  const yp = f(f(a * f(Math.sqrt(f(1 - f(e * e))))) * f(Math.sin(E)));

  const cosNode = f(Math.cos(records[base + RECORD.node]!));
  const sinNode = f(Math.sin(records[base + RECORD.node]!));
  const cosPeri = f(Math.cos(records[base + RECORD.peri]!));
  const sinPeri = f(Math.sin(records[base + RECORD.peri]!));
  const cosI = f(Math.cos(records[base + RECORD.i]!));
  const sinI = f(Math.sin(records[base + RECORD.i]!));
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
