import { keplerStart, solveKepler } from './kepler.ts';
import { SECONDS_PER_DAY } from './time.ts';

/**
 * Two-body motion on any conic: ellipse, parabola or hyperbola, from perihelion.
 *
 * The belt's asteroids are all ellipses and are solved on the GPU (see beltShader.ts).
 * Comets are not: 1,763 of SBDB's are on parabolas and 520 on hyperbolas, 3I/ATLAS at
 * e = 6.14, and hundreds more on ellipses so long that e is 0.999 and the period is
 * thousands of years. Those near e = 1 are where the three textbook equations each go
 * wrong -- Kepler's needs a semi-major axis that runs to infinity, Barker's holds only
 * at e exactly 1, the hyperbolic one cancels catastrophically -- and float32 on a GPU
 * would make each worse. There are only four thousand comets, so they are worked out
 * here instead, in float64, a few microseconds each.
 *
 * **One equation for every conic: universal variables.** In the universal anomaly
 * chi, Kepler's equation from perihelion is
 *
 *   sqrt(mu) * t = e * chi^3 * S(z) + q * chi,   z = alpha * chi^2,   alpha = (1 - e) / q
 *
 * with Stumpff's functions S and C, which are smooth through z = 0: the ellipse, the
 * parabola and the hyperbola are one curve in it, and e = 0.999, 1 and 1.001 are three
 * nearby points on it rather than three different formulas. It is solved by Laguerre's
 * iteration (Conway's choice for exactly this equation), from a start taken from the
 * classical solution where that is well conditioned, and the position follows from the
 * Lagrange coefficients f and g -- no semi-major axis anywhere, so nothing to blow up.
 *
 * Everything is perifocal here: x towards perihelion, y along the motion there.
 */

/** Below this |z|, Stumpff's functions by their series rather than closed forms. */
const SERIES_Z = 0.1;

/**
 * The last Stumpff values worked out, so the hot path allocates nothing: four thousand
 * comets times a handful of iterations is tens of thousands of calls a frame, and an
 * object returned from each would be that many objects for the collector.
 */
let stumpffC = 0.5;
let stumpffS = 1 / 6;

/**
 * Stumpff's C(z) and S(z): (1 - cos sqrt z) / z and (sqrt z - sin sqrt z) / z^(3/2),
 * continued smoothly through z = 0 and into negative z with cosh and sinh, into
 * `stumpffC` and `stumpffS`. Near zero the closed forms cancel, so the series is used
 * there: seven terms at |z| < 0.1 is past float64's last digit.
 */
function computeStumpff(z: number): void {
  if (Math.abs(z) < SERIES_Z) {
    let C = 0;
    let S = 0;
    let term = 1;
    // C = sum (-z)^k / (2k + 2)!, S = sum (-z)^k / (2k + 3)!
    let factorialC = 2;
    let factorialS = 6;
    for (let k = 0; k < 7; k += 1) {
      C += term / factorialC;
      S += term / factorialS;
      term *= -z;
      factorialC *= (2 * k + 3) * (2 * k + 4);
      factorialS *= (2 * k + 4) * (2 * k + 5);
    }
    stumpffC = C;
    stumpffS = S;
  } else if (z > 0) {
    const s = Math.sqrt(z);
    stumpffC = (1 - Math.cos(s)) / z;
    stumpffS = (s - Math.sin(s)) / (s * s * s);
  } else {
    const s = Math.sqrt(-z);
    stumpffC = (Math.cosh(s) - 1) / -z;
    stumpffS = (Math.sinh(s) - s) / (s * s * s);
  }
}

/** Stumpff's C(z) and S(z), as an object: for the tests and anyone not in a frame loop. */
export function stumpff(z: number): { readonly C: number; readonly S: number } {
  computeStumpff(z);
  return { C: stumpffC, S: stumpffS };
}

/** A hyperbolic start: the cubic near perihelion, the logarithm far out. */
function hyperbolicStart(M: number, e: number): number {
  // (e/6) F^3 + (e - 1) F = M, by Cardano: exact near perihelion as e goes to 1.
  const P = (6 * (e - 1)) / e;
  const Q = (6 * M) / e;
  const h = 0.5 * Q;
  const p3 = P / 3;
  const D = Math.sqrt(h * h + p3 * p3 * p3);
  const cubic = Math.cbrt(D + h) - Math.cbrt(D - h);
  // Far out e sinh F dominates: e e^F / 2 = M, F = ln(2M / e).
  const far = Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1);
  // Whichever is nearer the answer: the cubic overshoots far out, the logarithm near in.
  const cubicMiss = Math.abs(e * Math.sinh(cubic) - cubic - M);
  const farMiss = Math.abs(e * Math.sinh(far) - far - M);
  return cubicMiss <= farMiss ? cubic : far;
}

/**
 * The universal anomaly `t` seconds after perihelion, on the conic of perihelion
 * distance `q` km and eccentricity `e` about a body of `mu` km^3/s^2. For an ellipse `t`
 * should already be reduced to within half a period of perihelion; see conicPosition.
 */
export function universalAnomaly(q: number, e: number, t: number, mu: number): number {
  const alpha = (1 - e) / q;
  const target = Math.sqrt(mu) * t;
  // A start from the conic's own classical solution, where it is well conditioned.
  let chi: number;
  if (alpha > 0) {
    const a = 1 / alpha;
    const M = Math.sqrt(mu / (a * a * a)) * t;
    chi = Math.sqrt(a) * keplerStart(M, e);
  } else if (alpha < 0) {
    const a = -1 / alpha;
    const M = Math.sqrt(mu / (a * a * a)) * t;
    chi = Math.sqrt(a) * hyperbolicStart(M, e);
  } else {
    // Barker's equation, exact: tan(nu/2) = s with s + s^3/3 = t sqrt(mu / 2q^3).
    const B = t * Math.sqrt(mu / (2 * q * q * q));
    const Y = Math.cbrt(1.5 * B + Math.sqrt(1 + 2.25 * B * B));
    chi = Math.sqrt(2 * q) * (Y - 1 / Y);
  }

  // Laguerre, n = 5: converges from far worse starts than these, and in a few steps.
  const n = 5;
  let best = Infinity;
  let bestChi = chi;
  for (let k = 0; k < 50; k += 1) {
    const z = alpha * chi * chi;
    computeStumpff(z);
    const chi2 = chi * chi;
    const F = e * chi2 * chi * stumpffS + q * chi - target;
    // dF/dchi is the distance from the Sun, r; its derivative is e * chi * (1 - z S).
    const dF = e * chi2 * stumpffC + q;
    const ddF = e * chi * (1 - z * stumpffS);
    if (Math.abs(F) >= best) {
      return bestChi;
    }
    best = Math.abs(F);
    bestChi = chi;
    const root = Math.sqrt(Math.abs((n - 1) * (n - 1) * dF * dF - n * (n - 1) * F * ddF));
    const step = (n * F) / (dF + Math.sign(dF) * root);
    chi -= step;
    if (Math.abs(step) <= 1e-15 * Math.max(1, Math.abs(chi))) {
      return chi;
    }
  }
  return chi;
}

/** A perifocal position and velocity: km and km/s. */
export interface PerifocalState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Where a body on a conic is `days` after perihelion, perifocal, into `out`.
 *
 * An ellipse is first brought to within half a period of perihelion: a comet that went
 * round twelve times since its listed perihelion is in the same place as after none.
 */
export function conicPosition(
  q: number,
  e: number,
  days: number,
  mu: number,
  out: PerifocalState,
): PerifocalState {
  let t = days * SECONDS_PER_DAY;
  const alpha = (1 - e) / q;
  if (alpha > 0) {
    const period = 2 * Math.PI * Math.sqrt(1 / (alpha * alpha * alpha * mu));
    t -= period * Math.round(t / period);
  }
  const chi = universalAnomaly(q, e, t, mu);
  const z = alpha * chi * chi;
  computeStumpff(z);
  const C = stumpffC;
  const S = stumpffS;
  const sqrtMu = Math.sqrt(mu);
  // Lagrange's f and g from perihelion, where r = q along x and v = sqrt(mu (1 + e) / q)
  // along y.
  const r = e * chi * chi * C + q;
  const f = 1 - (chi * chi * C) / q;
  const g = t - (chi * chi * chi * S) / sqrtMu;
  const fDot = ((sqrtMu / (r * q)) * (z * S - 1)) * chi;
  const gDot = 1 - (chi * chi * C) / r;
  const vPerihelion = Math.sqrt((mu * (1 + e)) / q);
  out.x = f * q;
  out.y = g * vPerihelion;
  out.vx = fDot * q;
  out.vy = gDot * vPerihelion;
  return out;
}

/**
 * The same ellipse solved the classical way, for the tests to hold the universal one to:
 * Kepler's equation in E, with solveKepler. Perifocal x and y, km.
 */
export function ellipticPosition(q: number, e: number, days: number, mu: number): { x: number; y: number } {
  const a = q / (1 - e);
  const n = Math.sqrt(mu / (a * a * a));
  const E = solveKepler(n * days * SECONDS_PER_DAY, e);
  return { x: a * (Math.cos(E) - e), y: a * Math.sqrt(1 - e * e) * Math.sin(E) };
}
