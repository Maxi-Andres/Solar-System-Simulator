import { J2000_JD, tdbToUtc } from './time.ts';

/**
 * From the frame SGP4 answers in to the frame everything here is drawn in.
 *
 * SGP4 gives a satellite's position in TEME, "true equator, mean equinox": the Earth's
 * equator as it really is on the day, nutation and all, with its x axis on the equinox
 * the mean sidereal time counts from. The app's frame is the ecliptic of J2000 -- every
 * Horizons table here is in it. Between the two lie, in order:
 *
 *   TEME --(equation of the equinoxes)--> true of date
 *        --(nutation, IAU 1980)--------> mean of date
 *        --(precession, IAU 1976)------> J2000 equatorial
 *        --(obliquity of J2000)--------> J2000 ecliptic
 *
 * The 1976/1980 theories, not the 2006/2000A ones, and on purpose: TEME is defined by
 * them -- it is the frame the element sets are fitted in, and Vallado's own reference
 * conversion (AIAA 2006-6753, "Revisiting Spacetrack Report #3") is this chain. The
 * newer theories differ from these by milliarcseconds, a few centimetres at a satellite.
 *
 * None of the three steps is small enough to leave out, which is why they are here:
 *
 *   precession   0.34 degrees by 2026, 40 km at the ISS, 250 km at GEO;
 *   nutation     up to 17 arcseconds, 0.6 km at the ISS and 3.5 km at GEO;
 *   equinoxes    up to 1.1 seconds of time, the same size as nutation.
 *
 * Measured end to end against JPL Horizons' own ISS (see teme.test.ts and
 * satelliteBodies.test.ts): the ISS lands within 10 metres of where Horizons puts it,
 * over a fortnight, when both work from the same element set.
 */

const ARCSEC = Math.PI / (180 * 3600);
const DEG = Math.PI / 180;

/**
 * The IAU 1980 nutation series, its largest 30 terms of 106: multipliers of the Delaunay
 * arguments D, M, M', F and Omega, then the longitude coefficient and its rate per
 * century, then the obliquity coefficient and its rate, in units of 0.0001".
 *
 * As Meeus tabulates it (Astronomical Algorithms, table 22.A). The 76 left out are each
 * 0.0015" or less in longitude: together, at their worst all in phase, 0.11", which would
 * move a satellite at GEO by 23 metres and the ISS by 4. They are never all in phase: on
 * Meeus's worked example the 30 land within 0.005" of his 63 (teme.test.ts).
 */
const NUTATION: readonly (readonly [number, number, number, number, number, number, number, number, number])[] = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [-2, 0, 0, 2, 2, -13187, -1.6, 5736, -3.1],
  [0, 0, 0, 2, 2, -2274, -0.2, 977, -0.5],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [0, 0, 1, 0, 0, 712, 0.1, -7, 0],
  [-2, 1, 0, 2, 2, -517, 1.2, 224, -0.6],
  [0, 0, 0, 2, 1, -386, -0.4, 200, 0],
  [0, 0, 1, 2, 2, -301, 0, 129, -0.1],
  [-2, -1, 0, 2, 2, 217, -0.5, -95, 0.3],
  [-2, 0, 1, 0, 0, -158, 0, 0, 0],
  [-2, 0, 0, 2, 1, 129, 0.1, -70, 0],
  [0, 0, -1, 2, 2, 123, 0, -53, 0],
  [2, 0, 0, 0, 0, 63, 0, 0, 0],
  [0, 0, 1, 0, 1, 63, 0.1, -33, 0],
  [2, 0, -1, 2, 2, -59, 0, 26, 0],
  [0, 0, -1, 0, 1, -58, -0.1, 32, 0],
  [0, 0, 1, 2, 1, -51, 0, 27, 0],
  [-2, 0, 2, 0, 0, 48, 0, 0, 0],
  [0, 0, -2, 2, 1, 46, 0, -24, 0],
  [2, 0, 0, 2, 2, -38, 0, 16, 0],
  [0, 0, 2, 2, 2, -31, 0, 13, 0],
  [0, 0, 2, 0, 0, 29, 0, 0, 0],
  [-2, 0, 1, 2, 2, 29, 0, -12, 0],
  [0, 0, 0, 2, 0, 26, 0, 0, 0],
  [-2, 0, 0, 2, 0, -22, 0, 0, 0],
  [0, 0, -1, 2, 1, 21, 0, -10, 0],
  [0, 2, 0, 0, 0, 17, -0.1, 0, 0],
  [2, 0, -1, 0, 1, 16, 0, -8, 0],
  [-2, 2, 0, 2, 2, -16, 0.1, 7, 0],
];

/** Nutation in longitude and obliquity, and the mean obliquity, all radians. */
export interface Nutation {
  readonly deltaPsi: number;
  readonly deltaEpsilon: number;
  readonly meanObliquity: number;
}

/** IAU 1980 nutation at `jdTt`, from the series above. */
export function nutation1980(jdTt: number): Nutation {
  const T = (jdTt - J2000_JD) / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  // The Delaunay arguments, degrees (Meeus 22).
  const D = (297.85036 + 445267.11148 * T - 0.0019142 * T2 + T3 / 189474) * DEG;
  const M = (357.52772 + 35999.05034 * T - 0.0001603 * T2 - T3 / 300000) * DEG;
  const Mp = (134.96298 + 477198.867398 * T + 0.0086972 * T2 + T3 / 56250) * DEG;
  const F = (93.27191 + 483202.017538 * T - 0.0036825 * T2 + T3 / 327270) * DEG;
  const Om = (125.04452 - 1934.136261 * T + 0.0020708 * T2 + T3 / 450000) * DEG;
  let dPsi = 0;
  let dEps = 0;
  for (const [d, m, mp, f, om, psi, psiT, eps, epsT] of NUTATION) {
    const argument = d * D + m * M + mp * Mp + f * F + om * Om;
    dPsi += (psi + psiT * T) * Math.sin(argument);
    dEps += (eps + epsT * T) * Math.cos(argument);
  }
  // IAU 1980 mean obliquity of the date (Lieske 1979).
  const meanObliquity = (84381.448 - 46.815 * T - 0.00059 * T2 + 0.001813 * T3) * ARCSEC;
  return { deltaPsi: dPsi * 1e-4 * ARCSEC, deltaEpsilon: dEps * 1e-4 * ARCSEC, meanObliquity };
}

/** A 3x3 matrix, row-major, nine numbers. */
export type Matrix3 = Float64Array;

function multiply(a: Matrix3, b: Matrix3, out: Matrix3): Matrix3 {
  const r = new Float64Array(9);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
    }
  }
  out.set(r);
  return out;
}

/**
 * The rotations as Vallado writes them: of the frame, not of the vector. ROT3(a) takes a
 * vector's coordinates into a frame turned by +a about z.
 */
function rot1(a: number): Matrix3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return Float64Array.of(1, 0, 0, 0, c, s, 0, -s, c);
}

function rot2(a: number): Matrix3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return Float64Array.of(c, 0, -s, 0, 1, 0, s, 0, c);
}

function rot3(a: number): Matrix3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return Float64Array.of(c, s, 0, -s, c, 0, 0, 0, 1);
}

/**
 * The matrix taking TEME into the J2000 equatorial frame at `jdTt`, into `out`:
 * P · N · ROT3(-Eq), Vallado's [P][N] with TEME's own equation of the equinoxes.
 *
 * The equation of the equinoxes is the 1982 one, Δψ cos ε̄, without the two small terms
 * the IAU added in 1994 -- TEME's equinox is the one GMST 1982 counts from, and Vallado
 * recommends exactly this for it. The terms left out are 0.0026" at most, 20 cm at GEO.
 */
export function temeToJ2000Matrix(jdTt: number, out: Matrix3 = new Float64Array(9)): Matrix3 {
  const T = (jdTt - J2000_JD) / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  // IAU 1976 precession angles (Lieske et al. 1977), arcseconds.
  const zeta = (2306.2181 * T + 0.30188 * T2 + 0.017998 * T3) * ARCSEC;
  const theta = (2004.3109 * T - 0.42665 * T2 - 0.041833 * T3) * ARCSEC;
  const z = (2306.2181 * T + 1.09468 * T2 + 0.018203 * T3) * ARCSEC;
  const { deltaPsi, deltaEpsilon, meanObliquity } = nutation1980(jdTt);
  const trueObliquity = meanObliquity + deltaEpsilon;
  const equationOfEquinoxes = deltaPsi * Math.cos(meanObliquity);

  const precession = multiply(multiply(rot3(zeta), rot2(-theta), new Float64Array(9)), rot3(z), new Float64Array(9));
  const nutationMatrix = multiply(
    multiply(rot1(-meanObliquity), rot3(deltaPsi), new Float64Array(9)),
    rot1(trueObliquity),
    new Float64Array(9),
  );
  return multiply(multiply(precession, nutationMatrix, new Float64Array(9)), rot3(-equationOfEquinoxes), out);
}

/**
 * Obliquity of the J2000 ecliptic as Horizons uses it for its ecliptic frame: the IAU 1976
 * value, 84381.448". The scene's own (OBLIQUITY_J2000_DEG, 84381.406") is the IAU 2006
 * one; the two differ by 0.042", 1.4 metres at the ISS and 9 at GEO. This one is used
 * here so a satellite matches Horizons in Horizons' frame; the planets' poles keep theirs.
 */
export const OBLIQUITY_J2000_IAU1976_RAD = 84381.448 * ARCSEC;

const COS_EPS = Math.cos(OBLIQUITY_J2000_IAU1976_RAD);
const SIN_EPS = Math.sin(OBLIQUITY_J2000_IAU1976_RAD);

/**
 * The matrix taking TEME straight into the J2000 ecliptic -- the app's frame -- at
 * `jdTt`, into `out`: the J2000 equatorial one, then the obliquity.
 */
export function temeToEclipticMatrix(jdTt: number, out: Matrix3 = new Float64Array(9)): Matrix3 {
  temeToJ2000Matrix(jdTt, out);
  // ROT1(ε) on the left: rows 1 and 2 mixed, row 0 kept.
  for (let j = 0; j < 3; j += 1) {
    const y = out[3 + j]!;
    const zz = out[6 + j]!;
    out[3 + j] = COS_EPS * y + SIN_EPS * zz;
    out[6 + j] = -SIN_EPS * y + COS_EPS * zz;
  }
  return out;
}

/** `m` times (x, y, z), written into `out` at `offset`. Allocates nothing. */
export function applyMatrix(
  m: Matrix3,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
  offset = 0,
): void {
  out[offset] = m[0]! * x + m[1]! * y + m[2]! * z;
  out[offset + 1] = m[3]! * x + m[4]! * y + m[5]! * z;
  out[offset + 2] = m[6]! * x + m[7]! * y + m[8]! * z;
}

/** One instant as the satellites need it: UTC for their elements, and the frame matrix. */
export interface SatelliteInstant {
  /** The TDB Julian day this was worked out for: the app's clock. */
  jdTdb: number;
  /** The same instant as a UTC Julian day: what SGP4 and the bulk model run on. */
  jdUtc: number;
  /** TEME of this instant to the J2000 ecliptic. */
  readonly matrix: Matrix3;
}

const instant: SatelliteInstant = { jdTdb: Number.NaN, jdUtc: Number.NaN, matrix: new Float64Array(9) };

/**
 * The UTC day and the TEME matrix for `jdTdb`, worked out once per instant and kept: every
 * satellite placed in a frame shares them, so a hundred SGP4 calls cost one leap-second
 * lookup and one precession-nutation matrix between them. The object is reused -- read
 * it, do not keep it.
 *
 * The matrix is for the instant on the clock, not for the data's reference instant as
 * SatelliteInfo.frame's is: it costs a microsecond, and so holds at any date without a
 * window of its own. The TDB day stands in for TT, which it differs from by 1.7 ms at most.
 */
export function satelliteInstant(jdTdb: number): SatelliteInstant {
  if (instant.jdTdb !== jdTdb) {
    instant.jdTdb = jdTdb;
    instant.jdUtc = tdbToUtc(jdTdb);
    temeToEclipticMatrix(jdTdb, instant.matrix);
  }
  return instant;
}
