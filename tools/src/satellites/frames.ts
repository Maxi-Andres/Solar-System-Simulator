/**
 * From TEME, the frame SGP4's elements and positions are in, to the scene's ecliptic and
 * mean equinox of J2000.
 *
 * TEME -- "true equator, mean equinox" -- is SGP4's own frame of date: its z axis is the
 * true pole of date (precessed and nutated), its x axis the mean equinox of date measured
 * along that true equator. Vallado, Crawford, Hujsak & Kelso, "Revisiting Spacetrack
 * Report #3", AIAA 2006-6753, section 4 and appendix C, define it and give the chain used
 * here:
 *
 *   r_TOD   = R3(−Eq) · r_TEME          Eq = Δψ·cos ε, the equation of the equinoxes
 *                                       without its post-1997 terms, as SGP4 assumes
 *   r_MOD   = Nᵀ · r_TOD                N  = R1(−ε−Δε) R3(−Δψ) R1(ε), IAU 1980 nutation
 *   r_J2000 = Pᵀ · r_MOD                P  = R3(−z) R2(θ) R3(−ζ), IAU 1976 precession
 *   r_ecl   = R1(ε0) · r_J2000          ε0 = 84,381.448", the IAU 1976 obliquity of J2000
 *
 * (Rk(α) are coordinate rotations: the frame turned by α about axis k.) The last step is
 * the obliquity Horizons' ECLIPTIC frame is defined with, so a satellite and the Moon share
 * one plane. J2000's mean equator is not quite ICRF's -- the frame bias is 23 mas -- and
 * that is 0.8 m at GEO, below everything else here.
 *
 * **How large each step is in 2026.** Precession since J2000 is 0.374° (1,346"): 44 km
 * at LEO's radius and 275 km at GEO's, so it cannot be skipped. Nutation is up to 17" in
 * longitude and 9" in obliquity, 0.6 km at LEO and 3.5 km at GEO. The equation of the
 * equinoxes is the same 17" again, in TEME's x axis.
 *
 * **Nutation is truncated** to the series' 20 largest terms (Seidelmann 1982, the IAU
 * 1980 theory as tabulated in the Explanatory Supplement, 1992, table 3.222.1), every term
 * of 0.0046" or more. The 86 left out sum, at worst, to a few hundredths of an arcsecond:
 * 2 m at GEO. The test checks the result against an independent IAU 2000B implementation.
 */

const ARCSEC = Math.PI / (180 * 3600);
const DEG = Math.PI / 180;
/** One revolution in arcseconds, for the fundamental arguments. */
const REVOLUTION_ARCSEC = 1_296_000;

/** The IAU 1976 obliquity of J2000, radians: what Horizons' ECLIPTIC frame is tilted by. */
export const OBLIQUITY_J2000 = 84_381.448 * ARCSEC;

/** TT − UTC from 2017 on, seconds: 37 leap seconds and TT's 32.184 (IERS Bulletin C). */
const TT_MINUS_UTC_SECONDS = 69.184;

/** A 3×3 matrix, row-major. */
export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const out = new Array<number>(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      out[row * 3 + column] =
        a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!;
    }
  }
  return out as unknown as Matrix3;
}

export function transpose(m: Matrix3): Matrix3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function apply(m: Matrix3, v: readonly [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Coordinate rotation about x: the frame turned by `angle`. */
function r1(angle: number): Matrix3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, c, s, 0, -s, c];
}

function r2(angle: number): Matrix3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, 0, -s, 0, 1, 0, s, 0, c];
}

function r3(angle: number): Matrix3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, 0, -s, c, 0, 0, 0, 1];
}

/** Julian centuries of TT since J2000, from a UTC Julian day. */
export function centuriesTt(jdUtc: number): number {
  return (jdUtc + TT_MINUS_UTC_SECONDS / 86_400 - 2_451_545) / 36_525;
}

/**
 * IAU 1976 precession, J2000 to mean of date (Lieske et al. 1977, A&A 58, 1): the matrix
 * P with r_MOD = P · r_J2000.
 */
export function precessionMatrix(t: number): Matrix3 {
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) * ARCSEC;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) * ARCSEC;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) * ARCSEC;
  return multiply(r3(-z), multiply(r2(theta), r3(-zeta)));
}

/** Mean obliquity of date, IAU 1976, radians. */
export function meanObliquity(t: number): number {
  return (84_381.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t ** 3) * ARCSEC;
}

/**
 * The IAU 1980 nutation series' 20 largest terms: multipliers of the Delaunay arguments
 * l, l', F, D, Ω, then Δψ = (A + B·T)·sin(arg) and Δε = (C + D·T)·cos(arg), in units of
 * 0.0001". Explanatory Supplement to the Astronomical Almanac (1992), table 3.222.1.
 */
const NUTATION_1980: readonly (readonly [number, number, number, number, number, number, number, number, number])[] = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [0, 0, 2, -2, 2, -13187, -1.6, 5736, -3.1],
  [0, 0, 2, 0, 2, -2274, -0.2, 977, -0.5],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [1, 0, 0, 0, 0, 712, 0.1, -7, 0],
  [0, 1, 2, -2, 2, -517, 1.2, 224, -0.6],
  [0, 0, 2, 0, 1, -386, -0.4, 200, 0],
  [1, 0, 2, 0, 2, -301, 0, 129, -0.1],
  [0, -1, 2, -2, 2, 217, -0.5, -95, 0.3],
  [1, 0, 0, -2, 0, -158, 0, -1, 0],
  [0, 0, 2, -2, 1, 129, 0.1, -70, 0],
  [-1, 0, 2, 0, 2, 123, 0, -53, 0],
  [1, 0, 0, 0, 1, 63, 0.1, -33, 0],
  [0, 0, 0, 2, 0, 63, 0, -2, 0],
  [-1, 0, 2, 2, 2, -59, 0, 26, 0],
  [-1, 0, 0, 0, 1, -58, -0.1, 32, 0],
  [1, 0, 2, 0, 1, -51, 0, 27, 0],
  [2, 0, 0, -2, 0, 48, 0, 1, 0],
  [-2, 0, 2, 0, 1, 46, 0, -24, 0],
];

/** Nutation in longitude and obliquity at T, radians: IAU 1980, truncated as above. */
export function nutation(t: number): { dPsi: number; dEps: number } {
  // The Delaunay arguments, IAU 1980 (Seidelmann 1982), arcseconds.
  const arg = (base: number, revolutions: number, rate: number, t2: number, t3: number) =>
    ((base + (revolutions * REVOLUTION_ARCSEC + rate) * t + t2 * t * t + t3 * t ** 3) % REVOLUTION_ARCSEC) *
    ARCSEC;
  const l = arg(485_866.733, 1325, 715_922.633, 31.31, 0.064);
  const lPrime = arg(1_287_099.804, 99, 1_292_581.224, -0.577, -0.012);
  const f = arg(335_778.877, 1342, 295_263.137, -13.257, 0.011);
  const d = arg(1_072_261.307, 1236, 1_105_601.328, -6.891, 0.019);
  const omega = arg(450_160.28, -5, -482_890.539, 7.455, 0.008);
  let dPsi = 0;
  let dEps = 0;
  for (const [kl, klp, kf, kd, ko, a, b, c, dd] of NUTATION_1980) {
    const angle = kl * l + klp * lPrime + kf * f + kd * d + ko * omega;
    dPsi += (a + b * t) * Math.sin(angle);
    dEps += (c + dd * t) * Math.cos(angle);
  }
  return { dPsi: dPsi * 1e-4 * ARCSEC, dEps: dEps * 1e-4 * ARCSEC };
}

/** True equator and equinox of date to J2000 mean: r_J2000 = m · r_TOD. */
export function todToJ2000(jdUtc: number): Matrix3 {
  const t = centuriesTt(jdUtc);
  const eps = meanObliquity(t);
  const { dPsi, dEps } = nutation(t);
  const n = multiply(r1(-eps - dEps), multiply(r3(-dPsi), r1(eps)));
  return multiply(transpose(precessionMatrix(t)), transpose(n));
}

/** TEME to J2000 mean equator and equinox: r_J2000 = m · r_TEME. */
export function temeToJ2000(jdUtc: number): Matrix3 {
  const t = centuriesTt(jdUtc);
  const eps = meanObliquity(t);
  const { dPsi, dEps } = nutation(t);
  const equationOfEquinoxes = dPsi * Math.cos(eps);
  const n = multiply(r1(-eps - dEps), multiply(r3(-dPsi), r1(eps)));
  const p = precessionMatrix(t);
  // r_TOD = R3(−Eq) r_TEME; r_TOD = N P r_J2000.
  return multiply(transpose(p), multiply(transpose(n), r3(-equationOfEquinoxes)));
}

/** TEME to the scene's ecliptic and mean equinox of J2000: r_ecl = m · r_TEME. */
export function temeToEclipticJ2000(jdUtc: number): Matrix3 {
  return multiply(r1(OBLIQUITY_J2000), temeToJ2000(jdUtc));
}

/** The angle of the rotation taking one matrix to another, radians. */
export function angleBetween(a: Matrix3, b: Matrix3): number {
  const r = multiply(transpose(a), b);
  const cosine = Math.min(1, Math.max(-1, (r[0] + r[4] + r[8] - 1) / 2));
  // acos loses precision near zero; the skew part is better there.
  const sine = Math.hypot(r[7] - r[5], r[2] - r[6], r[3] - r[1]) / 2;
  return Math.atan2(sine, cosine);
}

/**
 * The largest angle, arcseconds, between the one matrix for `jdUtc` and the exact one at
 * any instant of jdUtc ± windowDays, sampled every six hours -- finer than the shortest
 * nutation term kept (13.7 days) needs.
 */
export function frameDrift(jdUtc: number, windowDays: number): number {
  const fixed = temeToEclipticJ2000(jdUtc);
  let worst = 0;
  for (let day = -windowDays; day <= windowDays; day += 0.25) {
    worst = Math.max(worst, angleBetween(fixed, temeToEclipticJ2000(jdUtc + day)));
  }
  return worst / ARCSEC;
}

export { ARCSEC, DEG };
