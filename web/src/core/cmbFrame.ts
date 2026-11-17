/**
 * The cosmic microwave background as a frame: the Sun's motion against it, and where the
 * galactic directions the CMB's features are catalogued in fall on the sky.
 *
 * ## The dipole
 *
 * The CMB is 3.36 mK hotter one way than the other (Planck Collaboration 2020, A&A 641, A1,
 * Table 3): read as our motion through it, the Sun moves 369.82 +- 0.11 km/s toward galactic
 * l 264.021, b +48.253, in Crater. tools/src/laniakea/frames.ts moves the galaxies' redshifts
 * into the CMB's frame with the same numbers (ui/about/sections.test.tsx checks they agree).
 *
 * ## Galactic to equatorial
 *
 * By the IAU's pole (RA 192.85948, Dec +27.12825, ICRS) and the north celestial pole's galactic
 * longitude, 122.93192 -- the frame scene/galactic.ts builds from the pole and the centre, to
 * an arcsecond (farLandmarks.test.ts). Kept here, without three.js, so the record-holders and
 * search.ts can reach it light.
 */

export const SPEED_OF_LIGHT_KM_S = 299_792.458;

/** The Sun's velocity against the CMB, km/s, and its apex, galactic (Planck Collaboration 2020, A&A 641, A1). */
export const CMB_DIPOLE = { speedKmS: 369.82, lDeg: 264.021, bDeg: 48.253 } as const;

/** The dipole's amplitude, uK (Planck Collaboration 2020, A&A 641, A1, Table 3). */
export const CMB_DIPOLE_AMPLITUDE_UK = 3362.08;

const DEG = Math.PI / 180;
const POLE_RA_DEG = 192.85948;
const POLE_DEC_DEG = 27.12825;
const NCP_L_DEG = 122.93192;

/** RA and Dec, J2000 degrees, of a galactic longitude and latitude. */
export function galacticToEquatorial(lDeg: number, bDeg: number): { raDeg: number; decDeg: number } {
  const b = bDeg * DEG;
  const dl = (NCP_L_DEG - lDeg) * DEG;
  const dp = POLE_DEC_DEG * DEG;
  const sinDec = Math.sin(dp) * Math.sin(b) + Math.cos(dp) * Math.cos(b) * Math.cos(dl);
  const ra = POLE_RA_DEG * DEG + Math.atan2(Math.cos(b) * Math.sin(dl), Math.cos(dp) * Math.sin(b) - Math.sin(dp) * Math.cos(b) * Math.cos(dl));
  const raDeg = ((ra / DEG) % 360 + 360) % 360;
  return { raDeg, decDeg: Math.asin(Math.max(-1, Math.min(1, sinDec))) / DEG };
}

/** The dipole's apex, where the CMB is hottest: RA and Dec. */
export const CMB_DIPOLE_APEX = galacticToEquatorial(CMB_DIPOLE.lDeg, CMB_DIPOLE.bDeg);

function unit(raDeg: number, decDeg: number): [number, number, number] {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/**
 * A heliocentric redshift in the CMB's frame, as tools/src/laniakea/frames.ts czCmb moves the
 * galaxies Laniakea's distances are from: 1 + z_CMB = (1 + z_helio)(1 + v cos(theta) / c).
 */
export function cmbFrameRedshift(raDeg: number, decDeg: number, zHelio: number): number {
  const a = unit(raDeg, decDeg);
  const apex = unit(CMB_DIPOLE_APEX.raDeg, CMB_DIPOLE_APEX.decDeg);
  const cosTheta = a[0] * apex[0] + a[1] * apex[1] + a[2] * apex[2];
  return (1 + zHelio) * (1 + (CMB_DIPOLE.speedKmS * cosTheta) / SPEED_OF_LIGHT_KM_S) - 1;
}

/**
 * The Cold Spot: Cruz et al. 2007 (ApJ 655, 11), RA 03h15m05s, Dec -19 deg 35', galactic
 * l 209, b -57 -- where cmb.test.ts finds the map's own coldest patch. Drawn as its core, 5
 * degrees in radius: the inner region Mackenzie et al. 2017 (MNRAS 470, 2328) surveyed for a
 * void behind it, and where farLandmarks.test.ts finds the map coldest on average.
 */
export const COLD_SPOT = { raDeg: 48.771, decDeg: -19.583, lDeg: 209, bDeg: -57, radiusDeg: 5 } as const;
