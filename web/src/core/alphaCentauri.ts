import type { OsculatingElements } from '@sss/tools/types';

import { stateToOsculatingElements } from './kepler.ts';
import { DAYS_PER_JULIAN_YEAR, J2000_JD } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * The Alpha Centauri system as it moves (D3a): A and B on their measured orbit about each
 * other, their barycentre on its measured path through the Galaxy, and Proxima's orbit
 * about the pair.
 *
 * The catalogue carries each star on a straight line, r + v t, from one position and one
 * velocity -- right for a single star, wrong for these two. A and B go round each other
 * in eighty years at 11 to 36 AU, so a straight line drawn from Hipparcos's 1991
 * velocities had drifted by several AU by now and would keep drifting. Here they follow
 * the orbit instead, and the 3D stars and the star bodies both read them from it.
 *
 * ## Sources, read in the papers (2026-10-28)
 *
 * - **The orbit of B about A:** Kervella, Mignard, Mérand & Thévenin 2016, A&A 594, A107,
 *   Table 1, their own fit ("K16"): a = 17.592", i = 79.320, omega = 232.006,
 *   Omega = 205.064 degrees, P = 79.929 yr, T0 = 1955.604, e = 0.5208, and B's share
 *   of the mass, 0.45884. **Checked, not assumed:** these elements put B about A where
 *   their Table 2 measured it -- Hipparcos 1991.25 and NTT/SOFI 2009.15 -- to a tenth
 *   of an arcsecond (alphaCentauri.test.ts). omega is as published (omega + 180 would
 *   put B on the other side), and the line-of-sight component, r sin(nu + omega) sin i,
 *   counts away from us: that makes B recede from A through the 1990s, as measured.
 * - **The barycentre:** Kervella, Thévenin & Lovis 2017, A&A 598, L7, Table 2: its ICRS
 *   position at the Hipparcos epoch, 1991.25, the system parallax 747.17 mas and proper
 *   motion (-3619.9, +693.8) mas/yr of K16, and the absolute radial velocity -22.332 km/s
 *   (corrected for convective blueshift and gravitational redshift).
 * - **Masses:** K16, A 1.1055 and B 0.9373 solar masses; Proxima 0.1221 (Kervella et
 *   al. 2017 Table 1, after Mann et al. 2015).
 *
 * ## Proxima's orbit
 *
 * Not from Kervella et al. 2017's Table 3 angles: they derived them from Proxima's
 * position and velocity relative to the barycentre in Galactic coordinates, and read in
 * the sky frame those angles put Proxima 9,000 AU from where it is. So this does what
 * they did, elements from the state (proximaOrbit), and from their own Table 2 inputs it
 * gives back their a = 8.6 kau, e = 0.50, P = 546 ka (alphaCentauri.test.ts).
 *
 * **The velocity is theirs, the position is the catalogue's.** Proxima moves about the
 * pair at 273 m/s, and at that speed the corrections they made to both radial
 * velocities -- for gravitational redshift and convective blueshift, half a km/s for
 * Proxima alone -- are most of the answer: from the shipped Gaia record's uncorrected
 * velocity the orbit comes out at 7.4 kau instead. So the relative velocity is the one
 * worked out from their Table 2 (PROXIMA_RELATIVE_VELOCITY), and the position is where
 * the scene draws Proxima, so the ellipse passes through the star.
 */

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

/** Kervella et al. 2016 Table 1, K16: the orbit of B about A. */
export const AB_ORBIT = {
  semiMajorAxisArcsec: 17.592,
  inclinationDeg: 79.32,
  argPeriastronDeg: 232.006,
  ascendingNodeDeg: 205.064,
  periodYears: 79.929,
  periastronYear: 1955.604,
  eccentricity: 0.5208,
  /** mB / (mA + mB). */
  massFractionB: 0.45884,
} as const;

/** Kervella et al. 2016 and 2017: masses, solar. */
export const MASS_A_SUN = 1.1055;
export const MASS_B_SUN = 0.9373;
export const MASS_PROXIMA_SUN = 0.1221;

/** The barycentre, Kervella et al. 2017 Table 2, ICRS at the Hipparcos epoch. */
export const BARYCENTRE = {
  /** 14:39:40.2068 */
  raDeg: (14 + 39 / 60 + 40.2068 / 3600) * 15,
  /** -60:50:13.673 */
  decDeg: -(60 + 50 / 60 + 13.673 / 3600),
  parallaxMas: 747.17,
  pmRaMasPerYear: -3619.9,
  pmDecMasPerYear: 693.8,
  radialVelocityKmS: -22.332,
  /** J1991.25, TT. */
  epochJd: 2448349.0625,
} as const;

/** The Sun's GM, km^3/s^2 (IAU 2015 nominal). */
const GM_SUN = 1.3271244e11;

/** Gravitational parameter of Proxima and the pair about each other, km^3/s^2. */
export const GM_PROXIMA_AB = GM_SUN * (MASS_A_SUN + MASS_B_SUN + MASS_PROXIMA_SUN);

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
/** km/s per (mas/yr) per mas: one AU per year. */
const AU_PER_YEAR_KM_S = 149_597_870.7 / (DAYS_PER_JULIAN_YEAR * 86_400);

/** The scene's obliquity, 84381.448", as orientation.ts and the star catalogues use it. */
const OBLIQUITY = (84381.448 / 3600) * DEG;

function toScene(v: Vec3): Vec3 {
  const cos = Math.cos(OBLIQUITY);
  const sin = Math.sin(OBLIQUITY);
  return { x: v.x, y: v.y * cos + v.z * sin, z: -v.y * sin + v.z * cos };
}

/** The sky's local axes at a direction: toward us is -away; east and north on the sky. */
function skyBasis(raDeg: number, decDeg: number): { away: Vec3; east: Vec3; north: Vec3 } {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return {
    away: { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) },
    east: { x: -Math.sin(ra), y: Math.cos(ra), z: 0 },
    north: { x: -Math.sin(dec) * Math.cos(ra), y: -Math.sin(dec) * Math.sin(ra), z: Math.cos(dec) },
  };
}

/** An astrometric entry -- position, parallax, proper motion, radial velocity -- as a state. */
export interface Astrometry {
  readonly raDeg: number;
  readonly decDeg: number;
  readonly parallaxMas: number;
  readonly pmRaMasPerYear: number;
  readonly pmDecMasPerYear: number;
  readonly radialVelocityKmS: number;
}

/**
 * About the Sun, scene frame, km and km/s, at the entry's own epoch. Shared with the black
 * holes' systems (blackHoles.ts).
 */
export function astrometricState(entry: Astrometry): StateVector {
  const axes = skyBasis(entry.raDeg, entry.decDeg);
  const distance = (1000 / entry.parallaxMas) * PARSEC_KM;
  const east = (AU_PER_YEAR_KM_S * entry.pmRaMasPerYear) / entry.parallaxMas;
  const north = (AU_PER_YEAR_KM_S * entry.pmDecMasPerYear) / entry.parallaxMas;
  const radial = entry.radialVelocityKmS;
  return {
    position: toScene({ x: distance * axes.away.x, y: distance * axes.away.y, z: distance * axes.away.z }),
    velocity: toScene({
      x: radial * axes.away.x + east * axes.east.x + north * axes.north.x,
      y: radial * axes.away.y + east * axes.east.y + north * axes.north.y,
      z: radial * axes.away.z + east * axes.east.z + north * axes.north.z,
    }),
  };
}

/**
 * Proxima at the Hipparcos epoch, Kervella et al. 2017 Table 2: Hipparcos position,
 * Benedict et al. 1999 parallax and proper motion, and their radial velocity corrected
 * as the barycentre's is.
 */
export const PROXIMA_KERVELLA: Astrometry = {
  raDeg: (14 + 29 / 60 + 47.7474 / 3600) * 15,
  decDeg: -(62 + 40 / 60 + 52.868 / 3600),
  parallaxMas: 768.77,
  pmRaMasPerYear: -3773.8,
  pmDecMasPerYear: 770.5,
  radialVelocityKmS: -22.204,
};

const basis = skyBasis(BARYCENTRE.raDeg, BARYCENTRE.decDeg);
const distanceKm = (1000 / BARYCENTRE.parallaxMas) * PARSEC_KM;
const barycentreAtEpochState = astrometricState(BARYCENTRE);
const barycentreVelocity = barycentreAtEpochState.velocity;
const barycentreAtEpoch = barycentreAtEpochState.position;

/** Proxima's velocity about the barycentre, scene frame, km/s: 273 m/s (their Sect. 3.2). */
export const PROXIMA_RELATIVE_VELOCITY: Vec3 = (() => {
  const proxima = astrometricState(PROXIMA_KERVELLA).velocity;
  return {
    x: proxima.x - barycentreVelocity.x,
    y: proxima.y - barycentreVelocity.y,
    z: proxima.z - barycentreVelocity.z,
  };
})();

/** Proxima per Kervella et al. 2017 at their epoch, about the Sun: the tests' reference. */
export function proximaKervellaState(): StateVector {
  return astrometricState(PROXIMA_KERVELLA);
}

/** The barycentre of A and B about the Sun, scene frame, km and km/s: a straight line. */
export function barycentreState(jdTdb: number): StateVector {
  const seconds = (jdTdb - BARYCENTRE.epochJd) * 86_400;
  return {
    position: {
      x: barycentreAtEpoch.x + barycentreVelocity.x * seconds,
      y: barycentreAtEpoch.y + barycentreVelocity.y * seconds,
      z: barycentreAtEpoch.z + barycentreVelocity.z * seconds,
    },
    velocity: barycentreVelocity,
  };
}

/** Julian year (TT/TDB) of a Julian day: 2000.0 at J2000. */
export function julianYear(jd: number): number {
  return 2000 + (jd - J2000_JD) / DAYS_PER_JULIAN_YEAR;
}

/**
 * Where B is about A on the sky at a Julian year, arcseconds: east and north, and the
 * line-of-sight component, positive away from us. Thiele-Innes, from K16's elements.
 */
export function relativeOrbitArcsec(year: number): { east: number; north: number; away: number } {
  const o = AB_ORBIT;
  const meanAnomaly = (2 * Math.PI * (year - o.periastronYear)) / o.periodYears;
  let E = meanAnomaly;
  for (let k = 0; k < 30; k += 1) {
    E -= (E - o.eccentricity * Math.sin(E) - meanAnomaly) / (1 - o.eccentricity * Math.cos(E));
  }
  const nu =
    2 *
    Math.atan2(
      Math.sqrt(1 + o.eccentricity) * Math.sin(E / 2),
      Math.sqrt(1 - o.eccentricity) * Math.cos(E / 2),
    );
  const r = o.semiMajorAxisArcsec * (1 - o.eccentricity * Math.cos(E));
  const u = nu + o.argPeriastronDeg * DEG;
  const node = o.ascendingNodeDeg * DEG;
  const i = o.inclinationDeg * DEG;
  return {
    north: r * (Math.cos(u) * Math.cos(node) - Math.sin(u) * Math.sin(node) * Math.cos(i)),
    east: r * (Math.cos(u) * Math.sin(node) + Math.sin(u) * Math.cos(node) * Math.cos(i)),
    away: r * Math.sin(u) * Math.sin(i),
  };
}

/**
 * B's position relative to A in the scene frame, km. The arcseconds are turned into
 * kilometres at the system's distance, along the sky's axes at the barycentre -- whose
 * direction drifts by 3.7" a year, a thousandth of a degree in the centuries this is used
 * over, so the basis is fixed at the Hipparcos epoch.
 */
function relativeKm(year: number): Vec3 {
  const { east, north, away } = relativeOrbitArcsec(year);
  const scale = distanceKm * ARCSEC;
  return toScene({
    x: scale * (east * basis.east.x + north * basis.north.x + away * basis.away.x),
    y: scale * (east * basis.east.y + north * basis.north.y + away * basis.away.y),
    z: scale * (east * basis.east.z + north * basis.north.z + away * basis.away.z),
  });
}

export type AlphaCenComponent = 'A' | 'B';

/**
 * A or B about the Sun, scene frame, km and km/s: the barycentre, plus the star's share of
 * the relative orbit -- A at -mB/m of it, B at +mA/m. Velocity by a central difference
 * over a day, a part in 10^9 of the orbit.
 */
export function componentState(component: AlphaCenComponent, jdTdb: number): StateVector {
  const share = component === 'A' ? -AB_ORBIT.massFractionB : 1 - AB_ORBIT.massFractionB;
  const at = (jd: number): Vec3 => {
    const bary = barycentreState(jd).position;
    const rel = relativeKm(julianYear(jd));
    return { x: bary.x + share * rel.x, y: bary.y + share * rel.y, z: bary.z + share * rel.z };
  };
  const position = at(jdTdb);
  const before = at(jdTdb - 0.5);
  const after = at(jdTdb + 0.5);
  return {
    position,
    velocity: {
      x: (after.x - before.x) / 86_400,
      y: (after.y - before.y) / 86_400,
      z: (after.z - before.z) / 86_400,
    },
  };
}

/**
 * Which of A and B a catalogue record is, from its J2000 position in parsecs about the
 * Sun: the one whose direction the orbit puts within MATCH_ARCSEC of the record's at
 * J2000, the nearer if both, or null.
 *
 * **By direction, not by position**, because the records' depths are not the orbit's.
 * The catalogue gives both stars the one system parallax (build3d.ts OVERRIDES), so it
 * puts them at the same distance, where the orbit has B 30 AU beyond A at J2000; and it
 * places a star at J2000 by its proper motion only, not by its radial velocity -- 22 km/s
 * for these, 41 AU between the 1991 parallax and 2000. Negligible on a map of the stars,
 * not beside a 20 AU orbit: here the orbit decides, and the records are only how the pair
 * is recognised. On the sky the two are 10" apart, and each record sits within a second of
 * arc of the orbit (alphaCentauriData.test.ts).
 */
export const MATCH_ARCSEC = 3;

/** A and B at J2000 as unit vectors, worked out once: every record is checked against them. */
let directionsAtJ2000: Record<AlphaCenComponent, Vec3> | null = null;

function directionAtJ2000(component: AlphaCenComponent): Vec3 {
  if (directionsAtJ2000 === null) {
    const unit = (v: Vec3): Vec3 => {
      const n = Math.hypot(v.x, v.y, v.z);
      return { x: v.x / n, y: v.y / n, z: v.z / n };
    };
    directionsAtJ2000 = {
      A: unit(componentState('A', J2000_JD).position),
      B: unit(componentState('B', J2000_JD).position),
    };
  }
  return directionsAtJ2000[component];
}

/** The angle between a record's direction and a component's at J2000, arcseconds. */
export function componentOffsetArcsec(component: AlphaCenComponent, positionPcAtJ2000: Vec3): number {
  const d = directionAtJ2000(component);
  const cos =
    (d.x * positionPcAtJ2000.x + d.y * positionPcAtJ2000.y + d.z * positionPcAtJ2000.z) /
    Math.hypot(positionPcAtJ2000.x, positionPcAtJ2000.y, positionPcAtJ2000.z);
  return Math.acos(Math.min(1, cos)) / ARCSEC;
}

export function matchComponent(positionPcAtJ2000: Vec3): AlphaCenComponent | null {
  const length = Math.hypot(positionPcAtJ2000.x, positionPcAtJ2000.y, positionPcAtJ2000.z);
  // Nothing farther than a few hundredths of a parsec from the pair's distance can be it.
  if (Math.abs(length - 1000 / BARYCENTRE.parallaxMas) > 0.05) {
    return null;
  }
  let best: AlphaCenComponent | null = null;
  let bestAngle = MATCH_ARCSEC;
  for (const component of ['A', 'B'] as const) {
    const angle = componentOffsetArcsec(component, positionPcAtJ2000);
    if (angle < bestAngle) {
      best = component;
      bestAngle = angle;
    }
  }
  return best;
}

/**
 * Proxima's orbit about the barycentre of A and B, as osculating elements in the scene
 * frame: from where Proxima is (km about the Sun, at `jdTdb`) and Kervella et al.'s
 * relative velocity unless another is given -- see the header for why. The Kepler problem
 * for the pair's and Proxima's masses together; the elements are relative to the
 * barycentre. Null if they give no closed orbit.
 */
export function proximaOrbit(
  proximaPosition: Vec3,
  jdTdb: number,
  relativeVelocity: Vec3 = PROXIMA_RELATIVE_VELOCITY,
): OsculatingElements | null {
  const bary = barycentreState(jdTdb).position;
  return stateToOsculatingElements(
    {
      position: {
        x: proximaPosition.x - bary.x,
        y: proximaPosition.y - bary.y,
        z: proximaPosition.z - bary.z,
      },
      velocity: relativeVelocity,
    },
    GM_PROXIMA_AB,
    jdTdb,
    'proxima',
    'alpha-cen-ab',
  );
}

/**
 * Whether a catalogue record is Proxima, from its J2000 position in parsecs: the one star
 * between 10,000 and 16,000 AU from the pair's barycentre then -- Proxima is at 13,000,
 * and the census has nothing else within a parsec of the pair (alphaCentauriData.test.ts).
 */
export function isProximaRecord(positionPcAtJ2000: Vec3): boolean {
  const bary = barycentreState(J2000_JD).position;
  const au =
    Math.hypot(
      positionPcAtJ2000.x * PARSEC_KM - bary.x,
      positionPcAtJ2000.y * PARSEC_KM - bary.y,
      positionPcAtJ2000.z * PARSEC_KM - bary.z,
    ) / 149_597_870.7;
  return au > 10_000 && au < 16_000;
}

/**
 * The orbit of B about A as a closed polyline, scene frame, km: `segments` points spaced
 * evenly in eccentric anomaly, so periastron gets the points it needs, the last repeating
 * the first. A's orbit about the barycentre is this times -mB/m, B's times mA/m.
 */
export function relativeOrbitPolylineKm(segments = 512): Vec3[] {
  const o = AB_ORBIT;
  const points: Vec3[] = [];
  for (let k = 0; k <= segments; k += 1) {
    const E = (k / segments) * 2 * Math.PI;
    const year = o.periastronYear + (o.periodYears * (E - o.eccentricity * Math.sin(E))) / (2 * Math.PI);
    points.push(relativeKm(year));
  }
  return points;
}

/**
 * The three stars' measured radii, in solar radii, and the nominal solar radius they are
 * counted in (IAU 2015 B3, 695,700 km). A and B by interferometry with VLTI/PIONIER,
 * Kervella et al. 2017, A&A 597, A137: 1.2234 +- 0.0053 and 0.8632 +- 0.0037. Proxima
 * 0.1542 +- 0.0045, the value Kervella et al. 2017 (A&A 598, L7) adopt in their Table 1,
 * from Mann et al. 2015's relations for M dwarfs.
 */
export const RADIUS_A_SUN = 1.2234;
export const RADIUS_B_SUN = 0.8632;
export const RADIUS_PROXIMA_SUN = 0.1542;
const SOLAR_RADIUS_KM = 695_700;

/** A catalogue record's measured radius in km if it is one of the three, else null. */
export function measuredRadiusKm(positionPcAtJ2000: Vec3): number | null {
  const component = matchComponent(positionPcAtJ2000);
  if (component !== null) {
    return (component === 'A' ? RADIUS_A_SUN : RADIUS_B_SUN) * SOLAR_RADIUS_KM;
  }
  return isProximaRecord(positionPcAtJ2000) ? RADIUS_PROXIMA_SUN * SOLAR_RADIUS_KM : null;
}

/**
 * The unit normal of the pair's orbital plane in the scene frame, on the side B's orbit
 * turns counter-clockwise about: what to look down along to see the orbit as it is,
 * rather than at its 79 degrees to the sky as we see it from here.
 */
export function abOrbitNormal(): Vec3 {
  const year = AB_ORBIT.periastronYear;
  const r = relativeKm(year);
  const later = relativeKm(year + AB_ORBIT.periodYears / 8);
  const n = {
    x: r.y * later.z - r.z * later.y,
    y: r.z * later.x - r.x * later.z,
    z: r.x * later.y - r.y * later.x,
  };
  const length = Math.hypot(n.x, n.y, n.z);
  return { x: n.x / length, y: n.y / length, z: n.z / length };
}

/** A catalogue record's measured mass in solar masses if it is one of the three, else null. */
export function measuredMassSun(positionPcAtJ2000: Vec3): number | null {
  const component = matchComponent(positionPcAtJ2000);
  if (component !== null) {
    return component === 'A' ? MASS_A_SUN : MASS_B_SUN;
  }
  return isProximaRecord(positionPcAtJ2000) ? MASS_PROXIMA_SUN : null;
}
