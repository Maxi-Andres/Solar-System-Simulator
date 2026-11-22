import { COMET, COMET_FLOATS, FALLBACK_K1, type Comets } from '../core/comets.ts';
import { SECONDS_PER_DAY } from '../core/time.ts';
import { AU_KM } from './scale.ts';

/**
 * The comets' vertex shader: every comet's conic solved on the GPU, as the belt's ellipses
 * are (beltShader.ts), and its TypeScript mirror for the tests.
 *
 * **Why this is safe in float32 when the textbook equations are not.** conic.ts explains
 * why the comets need universal variables: a third of them are on parabolas or hyperbolas
 * and hundreds on ellipses at e = 0.999, where Kepler's, Barker's and the hyperbolic
 * equation each go wrong, and float32 would make each worse. The shader solves the same
 * universal equation conic.ts does, with three changes that keep float32 from costing more
 * than float32 must:
 *
 * - **Time counted from near now.** A perihelion time can be centuries from the catalogue's
 *   reference, and days since it in float32 would be minutes off. So the frame loop keeps
 *   an epoch within a day of the clock, and each comet's perihelion is given relative to it
 *   (cometTimes, in float64 on the CPU, redone only when the clock has moved a day): the
 *   shader's days-since-perihelion is then off by a float32 step *of itself*, so the error
 *   in time shrinks with the time since perihelion -- milliseconds for a comet at its
 *   perihelion, where it is fastest. An ellipse's perihelion is the one nearest the epoch.
 * - **No cancellation in the position.** conic.ts's Lagrange g, t - chi^3 S / sqrt(mu),
 *   subtracts two nearly equal numbers far out on a long orbit; the same g is
 *   q chi (1 - z S) / sqrt(mu) on the solution, which subtracts nothing, so the perifocal y
 *   is chi (1 - z S) sqrt(q (1 + e)).
 * - **Nothing cubed that can overflow.** a^3 for a = q / (1 - e) at e = 0.9999 is past
 *   float32's range, so the mean motion is sqrt(mu) * alpha^1.5 instead.
 *
 * **And no answer that rests on the GPU's sin, cos or exp.** GLSL sets them no precision,
 * and they can have little: SwiftShader's sin is good to about 5e-4, which put comets half a
 * pixel off at the camera's distance from them, and its sinh, (e^x - e^-x) / 2, cancels to
 * nothing for small x -- which chose a hopeless start for two comets at e = 1 + 6e-7 and
 * drew them at their perihelia, 40 AU from where they are. Only + - * / and sqrt are near
 * enough the same everywhere. So Stumpff's functions are summed from their series over
 * every z a solution can have -- an ellipse's z is E^2, within (pi + a day's motion)^2 once
 * reduced to half a period; a hyperbola's runs negative, -F^2 -- down to SERIES_Z_MIN, and
 * past it, far out on a hyperbola, come from an exp built of a polynomial and an exact
 * power of two. The GPU's own functions are left to the start (a guess Laguerre corrects),
 * the look, and a z beyond the series' reach that only an iteration on its way visits.
 *
 * cometShader.test.ts holds the mirror against conic.ts's float64 for every comet in the
 * catalogue and a grid of eccentricities from 0.2 to 6.
 */

const f = Math.fround;

/** Floats per comet in the static buffer: q, e, period; P; Q; M1, K1. */
export const COMET_STATIC_FLOATS = 11;
/** Floats per comet in the buffer the frame loop rewrites: perihelion from the epoch, hidden. */
export const COMET_TIME_FLOATS = 2;

/**
 * Stumpff's functions by their series for z in [SERIES_Z_MIN, SERIES_Z_MAX]: SERIES_TERMS
 * reach float32's floor at either end. The top is past (pi + 0.3)^2, the bottom F = 8.
 */
export const SERIES_Z_MIN = -64;
export const SERIES_Z_MAX = 12;
export const SERIES_TERMS = 16;
/** ln 2 in two parts, the first short enough that n times it is exact for |n| < 512. */
const LN2_HIGH = 0.693145751953125;
const LN2_LOW = 1.428606765330187e-6;
/** Laguerre's iterations at most; it stops sooner once |F| stops falling. */
export const LAGUERRE_ITERATIONS = 8;
/** How far the clock may move from the epoch before the times are worked out again, days. */
export const REBASE_DAYS = 1;

const LOG10_2 = Math.log10(2);

/** Display colour, before alpha: a pale blue-white. A convention; see Comets.tsx. */
export const COMET_COLOR: readonly [number, number, number] = [0.62, 0.8, 0.92];

/** Brightest and faintest magnitudes the look runs between; see cometLook. */
export const COMET_BRIGHT_MAG = 6;
export const COMET_FAINT_MAG = 20;
/** Dot diameters in CSS pixels at those two ends. */
export const COMET_BRIGHT_PX = 2;
export const COMET_FAINT_PX = 1;
/** Opacities at those two ends: no comet is drawn fainter than the second. */
export const COMET_BRIGHT_ALPHA = 1;
export const COMET_FAINT_ALPHA = 0.35;

/**
 * How a comet's magnitude at its present distance from the Sun (cometMagnitude) becomes a
 * dot: linear in magnitude between the two ends, clamped. A comet at magnitude 6 -- one
 * near perihelion, or a great comet -- is a full 2-pixel dot; one at 20, a bare nucleus
 * out past Saturn, is the faint 1-pixel floor, so every comet stays on the map.
 */
export function cometLook(magnitude: number): { readonly sizePx: number; readonly alpha: number } {
  const t = Math.min(1, Math.max(0, (COMET_FAINT_MAG - magnitude) / (COMET_FAINT_MAG - COMET_BRIGHT_MAG)));
  return {
    sizePx: COMET_FAINT_PX + (COMET_BRIGHT_PX - COMET_FAINT_PX) * t,
    alpha: COMET_FAINT_ALPHA + (COMET_BRIGHT_ALPHA - COMET_FAINT_ALPHA) * t,
  };
}

/** An ellipse's period from its perihelion distance (km) and eccentricity, days; 0 if open. */
export function conicPeriodDays(q: number, e: number, mu: number): number {
  const alpha = (1 - e) / q;
  return alpha > 0 ? (2 * Math.PI * Math.sqrt(1 / (alpha * alpha * alpha * mu))) / SECONDS_PER_DAY : 0;
}

/**
 * What never changes about the comets, as the static buffer: per comet q (km), e, the
 * period (days, 0 for a parabola or hyperbola), the perifocal axes P and Q, and the
 * magnitude parameters with SBDB's gaps filled (cometMagnitude's fallbacks).
 */
export function cometStaticBuffer(comets: Comets, mu: number): Float32Array {
  const { records, axes, fallbackM1 } = comets;
  const count = comets.info.count;
  const out = new Float32Array(count * COMET_STATIC_FLOATS);
  for (let k = 0; k < count; k += 1) {
    const base = k * COMET_FLOATS;
    const at = k * COMET_STATIC_FLOATS;
    const q = records[base + COMET.q]!;
    const e = records[base + COMET.e]!;
    out[at] = q;
    out[at + 1] = e;
    out[at + 2] = conicPeriodDays(q, e, mu);
    for (let j = 0; j < 6; j += 1) {
      out[at + 3 + j] = axes[k * 6 + j]!;
    }
    const M1 = records[base + COMET.M1]!;
    const K1 = records[base + COMET.K1]!;
    out[at + 9] = Number.isFinite(M1) ? M1 : fallbackM1;
    out[at + 10] = Number.isFinite(K1) ? K1 : FALLBACK_K1;
  }
  return out;
}

/**
 * Each comet's perihelion in days after the catalogue's reference instant and its period
 * in days (0 for a parabola or hyperbola), float64, two numbers a comet: what cometTimes
 * reads, worked out once.
 */
export function cometPerihelia(comets: Comets, mu: number): Float64Array {
  const { records, info } = comets;
  const out = new Float64Array(info.count * 2);
  for (let k = 0; k < info.count; k += 1) {
    const base = k * COMET_FLOATS;
    out[k * 2] = records[base + COMET.tp]!;
    out[k * 2 + 1] = conicPeriodDays(records[base + COMET.q]!, records[base + COMET.e]!, mu);
  }
  return out;
}

/**
 * Every comet's perihelion in days from `epochJd` (TDB), into `out` at stride
 * COMET_TIME_FLOATS, in float64 before the one rounding to float32. An ellipse's is the
 * perihelion nearest the epoch -- the same place on the same orbit, a whole number of
 * periods on, the period in float64 as conic.ts reduces by -- so the shader's
 * days-since-perihelion is never more than half a period and a day. `perihelia` is
 * cometPerihelia's, `referenceJd` the catalogue's.
 */
export function cometTimes(perihelia: Float64Array, referenceJd: number, epochJd: number, out: Float32Array): void {
  const shift = referenceJd - epochJd;
  const count = perihelia.length / 2;
  for (let k = 0; k < count; k += 1) {
    let tp = perihelia[k * 2]! + shift;
    const period = perihelia[k * 2 + 1]!;
    if (period > 0) {
      tp -= period * Math.round(tp / period);
    }
    out[k * COMET_TIME_FLOATS] = tp;
  }
}

export const COMET_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  // q (km), e, period (days; 0 when open).
  attribute vec3 aConic;
  // The perifocal axes in the ecliptic: towards perihelion, and along the motion there.
  attribute vec3 aAxisP;
  attribute vec3 aAxisQ;
  // M1 and K1, gaps filled.
  attribute vec2 aMagnitude;
  // Perihelion in days from the epoch; 1 when the comet is a body of its own just now.
  attribute vec2 aTime;

  uniform float uDtDays;
  uniform float uSqrtMu;
  uniform vec3 uSunHigh;
  uniform vec3 uSunLow;
  uniform float uUnitsPerKm;
  uniform float uPixelRatio;

  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;

  float cbrtSigned(float x) {
    return sign(x) * pow(abs(x), 1.0 / 3.0);
  }

  // exp(x), |x| < 80, to float32's precision: e^r by its series, |r| <= ln2 / 2, times 2^n
  // made exactly from its bits. expF32() in TypeScript.
  float expExact(float x) {
    float n = floor(x * 1.4426950408889634 + 0.5);
    float r = (x - n * ${LN2_HIGH.toFixed(15)}) - n * ${LN2_LOW.toExponential(15)};
    float p = 1.0 + r / 7.0;
    p = 1.0 + r / 6.0 * p;
    p = 1.0 + r / 5.0 * p;
    p = 1.0 + r / 4.0 * p;
    p = 1.0 + r / 3.0 * p;
    p = 1.0 + r / 2.0 * p;
    p = 1.0 + r * p;
    return p * intBitsToFloat((int(n) + 127) * 8388608);
  }

  // Stumpff's C(z), S(z) and 1 - z S(z): stumpffF32() in TypeScript.
  vec3 stumpff(float z) {
    if (z >= ${SERIES_Z_MIN.toFixed(1)} && z <= ${SERIES_Z_MAX.toFixed(1)}) {
      float c1 = 0.0;
      float c2 = 0.0;
      float c3 = 0.0;
      float a = 1.0;
      float b = 0.5;
      float c = 1.0 / 6.0;
      for (int k = 0; k < ${SERIES_TERMS}; k++) {
        c1 += a;
        c2 += b;
        c3 += c;
        float n = float(2 * k);
        a *= -z / ((n + 2.0) * (n + 3.0));
        b *= -z / ((n + 3.0) * (n + 4.0));
        c *= -z / ((n + 4.0) * (n + 5.0));
      }
      return vec3(c2, c3, c1);
    }
    if (z > 0.0) {
      // Visited only by an iteration on its way, never by an answer: the GPU's sin will do.
      float s = sqrt(z);
      float h = sin(0.5 * s);
      return vec3(2.0 * h * h / z, (s - sin(s)) / (s * s * s), sin(s) / s);
    }
    // Far out on a hyperbola, s > 8: sinh(s / 2) and cosh(s / 2) from one exp, no cancelling.
    float s = sqrt(-z);
    float eh = expExact(0.5 * s);
    float h = 0.5 * (eh - 1.0 / eh);
    float sh = 2.0 * h * (0.5 * (eh + 1.0 / eh));
    return vec3(2.0 * h * h / -z, (sh - s) / (s * s * s), sh / s);
  }

  // |e sinh(x) - x - M|, without the cancellation sinh(x) - x has for small x.
  float hyperbolicMiss(float x, float e, float M) {
    float x2 = x * x;
    float tail = sinh(x) - x;
    if (abs(x) < 1.0) {
      float t = 1.0 + x2 / 110.0;
      t = 1.0 + x2 / 72.0 * t;
      t = 1.0 + x2 / 42.0 * t;
      t = 1.0 + x2 / 20.0 * t;
      tail = x * x2 / 6.0 * t;
    }
    return abs((e - 1.0) * x + e * tail - M);
  }

  float ellipticStart(float M, float e) {
    if (e <= 0.5) {
      return M + e * sin(M);
    }
    float P = 6.0 * (1.0 - e) / e;
    float h = 3.0 * M / e;
    float p3 = P / 3.0;
    float D = sqrt(h * h + p3 * p3 * p3);
    return clamp(cbrtSigned(D + h) - cbrtSigned(D - h), -PI, PI);
  }

  float hyperbolicStart(float M, float e) {
    float P = 6.0 * (e - 1.0) / e;
    float h = 3.0 * M / e;
    float p3 = P / 3.0;
    float D = sqrt(h * h + p3 * p3 * p3);
    float cubic = cbrtSigned(D + h) - cbrtSigned(D - h);
    float far = sign(M) * log(2.0 * abs(M) / e + 1.0);
    return hyperbolicMiss(cubic, e, M) <= hyperbolicMiss(far, e, M) ? cubic : far;
  }

  void main() {
    if (aTime.y > 0.5) {
      // A body of its own just now, drawn as that: outside the clip volume, no solve.
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      gl_PointSize = 1.0;
      vAlpha = 0.0;
      vRadiusPx = 0.0;
      vSpritePx = 1.0;
      return;
    }

    // cometHelioF32(), in TypeScript.
    float q = aConic.x;
    float e = aConic.y;
    float period = aConic.z;
    float days = uDtDays - aTime.x;
    if (period > 0.0) {
      days -= period * floor(days / period + 0.5);
    }
    float t = days * ${SECONDS_PER_DAY.toFixed(1)};
    float target = uSqrtMu * t;
    float alpha = (1.0 - e) / q;
    float chi;
    if (alpha > 0.0) {
      float M = uSqrtMu * (alpha * sqrt(alpha)) * t;
      chi = ellipticStart(M, e) / sqrt(alpha);
    } else if (alpha < 0.0) {
      float na = -alpha;
      float M = uSqrtMu * (na * sqrt(na)) * t;
      chi = hyperbolicStart(M, e) / sqrt(na);
    } else {
      float B = abs(target) / sqrt(2.0 * q * q * q);
      float Y = cbrtSigned(1.5 * B + sqrt(1.0 + 2.25 * B * B));
      chi = sign(t) * sqrt(2.0 * q) * (Y - 1.0 / Y);
    }

    // Laguerre, n = 5, as conic.ts: kept at the chi with the smallest |F| seen.
    float best = 3.0e38;
    float bestChi = chi;
    for (int k = 0; k < ${LAGUERRE_ITERATIONS}; k++) {
      float z = alpha * chi * chi;
      vec3 st = stumpff(z);
      float chi2 = chi * chi;
      float F = e * chi2 * chi * st.y + q * chi - target;
      float dF = e * chi2 * st.x + q;
      float ddF = e * chi * st.z;
      float miss = abs(F);
      if (!(miss < best)) {
        break;
      }
      best = miss;
      bestChi = chi;
      float root = sqrt(abs(16.0 * dF * dF - 20.0 * F * ddF));
      chi -= 5.0 * F / (dF + root);
    }
    chi = bestChi;
    vec3 st = stumpff(alpha * chi * chi);
    float xp = q - chi * chi * st.x;
    float yp = chi * st.z * sqrt(q * (1.0 + e));
    vec3 helio = aAxisP * xp + aAxisQ * yp;
    vec3 km = (helio + uSunHigh) + uSunLow;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(km * uUnitsPerKm, 1.0);
    #include <logdepthbuf_vertex>

    // cometMagnitude() and cometLook(), from the distance to the Sun.
    float rAu = length(vec2(xp, yp)) / ${AU_KM.toFixed(1)};
    float magnitude = aMagnitude.x + aMagnitude.y * log2(max(rAu, 1.0e-3)) * ${LOG10_2.toFixed(9)};
    float bright = clamp((${COMET_FAINT_MAG.toFixed(1)} - magnitude) / ${(COMET_FAINT_MAG - COMET_BRIGHT_MAG).toFixed(1)}, 0.0, 1.0);
    float diameterPx = mix(${COMET_FAINT_PX.toFixed(3)}, ${COMET_BRIGHT_PX.toFixed(3)}, bright) * uPixelRatio;
    vRadiusPx = 0.5 * diameterPx;
    vSpritePx = ceil(diameterPx + 1.0);
    gl_PointSize = vSpritePx;
    vAlpha = mix(${COMET_FAINT_ALPHA.toFixed(3)}, ${COMET_BRIGHT_ALPHA.toFixed(3)}, bright);
  }
`;

/** The belt's soft disc: each pixel takes the share of the dot over it. */
export const COMET_FRAGMENT_SHADER = /* glsl */ `
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

// ---------------------------------------------------------------------------------------
// The mirror: the shader's statements in TypeScript, float32 rounding written out.

function cbrtSignedF32(x: number): number {
  return f(Math.sign(x) * f(Math.pow(Math.abs(x), f(1 / 3))));
}

/** The shader's expExact(): e^x to float32's precision, from a series and an exact 2^n. */
export function expF32(x: number): number {
  const n = Math.floor(f(f(x * f(Math.LOG2E)) + 0.5));
  const r = f(f(x - f(n * f(LN2_HIGH))) - f(n * f(LN2_LOW)));
  let p = f(1 + f(r / 7));
  for (const k of [6, 5, 4, 3, 2]) {
    p = f(1 + f(f(r / k) * p));
  }
  p = f(1 + f(r * p));
  return f(p * 2 ** n);
}

/** The shader's stumpff(): [C, S, 1 - z S] in float32. */
export function stumpffF32(z: number): [number, number, number] {
  z = f(z);
  if (z >= SERIES_Z_MIN && z <= SERIES_Z_MAX) {
    let c1 = 0;
    let c2 = 0;
    let c3 = 0;
    let a = 1;
    let b = 0.5;
    let c = f(1 / 6);
    for (let k = 0; k < SERIES_TERMS; k += 1) {
      c1 = f(c1 + a);
      c2 = f(c2 + b);
      c3 = f(c3 + c);
      const n = 2 * k;
      a = f(a * f(-z / f((n + 2) * (n + 3))));
      b = f(b * f(-z / f((n + 3) * (n + 4))));
      c = f(c * f(-z / f((n + 4) * (n + 5))));
    }
    return [c2, c3, c1];
  }
  if (z > 0) {
    const s = f(Math.sqrt(z));
    const h = f(Math.sin(f(0.5 * s)));
    return [
      f(f(f(2 * h) * h) / z),
      f(f(s - f(Math.sin(s))) / f(f(s * s) * s)),
      f(f(Math.sin(s)) / s),
    ];
  }
  const s = f(Math.sqrt(-z));
  const eh = expF32(f(0.5 * s));
  const h = f(0.5 * f(eh - f(1 / eh)));
  const sh = f(f(2 * h) * f(0.5 * f(eh + f(1 / eh))));
  return [f(f(f(2 * h) * h) / -z), f(f(sh - s) / f(f(s * s) * s)), f(sh / s)];
}

/** The shader's hyperbolicMiss(): |e sinh x - x - M|, sinh x - x by its series below 1. */
function hyperbolicMissF32(x: number, e: number, M: number): number {
  const x2 = f(x * x);
  let tail = f(f(Math.sinh(x)) - x);
  if (Math.abs(x) < 1) {
    let t = f(1 + f(x2 / 110));
    t = f(1 + f(f(x2 / 72) * t));
    t = f(1 + f(f(x2 / 42) * t));
    t = f(1 + f(f(x2 / 20) * t));
    tail = f(f(f(x * x2) / 6) * t);
  }
  return Math.abs(f(f(f(f(e - 1) * x) + f(e * tail)) - M));
}

function ellipticStartF32(M: number, e: number): number {
  if (e <= 0.5) {
    return f(M + f(e * f(Math.sin(M))));
  }
  const P = f(f(6 * f(1 - e)) / e);
  const h = f(f(3 * M) / e);
  const p3 = f(P / 3);
  const D = f(Math.sqrt(f(f(h * h) + f(f(p3 * p3) * p3))));
  return Math.min(f(Math.PI), Math.max(f(-Math.PI), f(cbrtSignedF32(f(D + h)) - cbrtSignedF32(f(D - h)))));
}

function hyperbolicStartF32(M: number, e: number): number {
  const P = f(f(6 * f(e - 1)) / e);
  const h = f(f(3 * M) / e);
  const p3 = f(P / 3);
  const D = f(Math.sqrt(f(f(h * h) + f(f(p3 * p3) * p3))));
  const cubic = f(cbrtSignedF32(f(D + h)) - cbrtSignedF32(f(D - h)));
  const far = f(Math.sign(M) * f(Math.log(f(f(f(2 * Math.abs(M)) / e) + 1))));
  return hyperbolicMissF32(cubic, e, M) <= hyperbolicMissF32(far, e, M) ? cubic : far;
}

/** What cometHelioF32 found: the heliocentric position (km) and how many Laguerre steps. */
export interface CometSolveF32 {
  x: number;
  y: number;
  z: number;
  rAu: number;
  steps: number;
}

/**
 * The shader's position for one comet, heliocentric km, float32 at every step. `q`, `e`,
 * `period` and the axes are the static buffer's; `tpDays` its perihelion from the epoch;
 * `dtDays` the clock from the epoch; `sqrtMu` the Sun's sqrt(GM), as uploaded.
 */
export function cometHelioF32(
  q: number,
  e: number,
  period: number,
  axisP: readonly [number, number, number],
  axisQ: readonly [number, number, number],
  tpDays: number,
  dtDays: number,
  sqrtMu: number,
  out: CometSolveF32 = { x: 0, y: 0, z: 0, rAu: 0, steps: 0 },
): CometSolveF32 {
  q = f(q);
  e = f(e);
  period = f(period);
  sqrtMu = f(sqrtMu);
  let days = f(f(dtDays) - f(tpDays));
  if (period > 0) {
    days = f(days - f(period * Math.floor(f(f(days / period) + 0.5))));
  }
  const t = f(days * SECONDS_PER_DAY);
  const target = f(sqrtMu * t);
  const alpha = f(f(1 - e) / q);
  let chi: number;
  if (alpha > 0) {
    const M = f(f(sqrtMu * f(alpha * f(Math.sqrt(alpha)))) * t);
    chi = f(ellipticStartF32(M, e) / f(Math.sqrt(alpha)));
  } else if (alpha < 0) {
    const na = -alpha;
    const M = f(f(sqrtMu * f(na * f(Math.sqrt(na)))) * t);
    chi = f(hyperbolicStartF32(M, e) / f(Math.sqrt(na)));
  } else {
    const B = f(Math.abs(target) / f(Math.sqrt(f(f(f(2 * q) * q) * q))));
    const Y = cbrtSignedF32(f(f(1.5 * B) + f(Math.sqrt(f(1 + f(f(2.25 * B) * B))))));
    chi = f(f(Math.sign(t) * f(Math.sqrt(f(2 * q)))) * f(Y - f(1 / Y)));
  }

  let best = 3.0e38;
  let bestChi = chi;
  let steps = 0;
  for (let k = 0; k < LAGUERRE_ITERATIONS; k += 1) {
    const z = f(f(alpha * chi) * chi);
    const [C, S, c1] = stumpffF32(z);
    const chi2 = f(chi * chi);
    const F = f(f(f(f(f(e * chi2) * chi) * S) + f(q * chi)) - target);
    const dF = f(f(f(e * chi2) * C) + q);
    const ddF = f(f(e * chi) * c1);
    const miss = Math.abs(F);
    if (!(miss < best)) {
      break;
    }
    best = miss;
    bestChi = chi;
    steps = k + 1;
    const root = f(Math.sqrt(Math.abs(f(f(f(16 * dF) * dF) - f(f(20 * F) * ddF)))));
    chi = f(chi - f(f(5 * F) / f(dF + root)));
  }
  chi = bestChi;
  const [C, , c1] = stumpffF32(f(f(alpha * chi) * chi));
  const xp = f(q - f(f(chi * chi) * C));
  const yp = f(f(chi * c1) * f(Math.sqrt(f(q * f(1 + e)))));
  out.x = f(f(f(axisP[0]) * xp) + f(f(axisQ[0]) * yp));
  out.y = f(f(f(axisP[1]) * xp) + f(f(axisQ[1]) * yp));
  out.z = f(f(f(axisP[2]) * xp) + f(f(axisQ[2]) * yp));
  out.rAu = f(f(Math.hypot(xp, yp)) / f(AU_KM));
  out.steps = steps;
  return out;
}

/** The shader's look for a comet at `rAu`: cometLook of cometMagnitude, as the GPU does it. */
export function cometLookF32(m1: number, k1: number, rAu: number): { sizePx: number; alpha: number } {
  const magnitude = f(f(m1) + f(f(f(k1) * f(Math.log2(Math.max(rAu, f(1e-3))))) * f(LOG10_2)));
  const bright = Math.min(1, Math.max(0, f(f(COMET_FAINT_MAG - magnitude) / (COMET_FAINT_MAG - COMET_BRIGHT_MAG))));
  return {
    sizePx: f(COMET_FAINT_PX + f((COMET_BRIGHT_PX - COMET_FAINT_PX) * bright)),
    alpha: f(COMET_FAINT_ALPHA + f((COMET_BRIGHT_ALPHA - COMET_FAINT_ALPHA) * bright)),
  };
}
