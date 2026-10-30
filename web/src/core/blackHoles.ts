import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { colorIndexToTemperature, MAX_COLOR_INDEX, MIN_COLOR_INDEX, starColor } from '../scene/blackbody.ts';
import { astrometricState, type Astrometry } from './alphaCentauri.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes, viewOffPole } from './exoplanets.ts';
import { stateToOsculatingElements } from './kepler.ts';
import { colorHex, setStarDisc } from './starBodies.ts';
import { julianEpochJd, skyOrbitState, type SkyOrbit, type SkyState } from './skyOrbit.ts';
import { J2000_JD } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Black holes to scale (D5): Sagittarius A* at the centre of the Galaxy, with the star S2 on
 * its measured orbit about it; the two nearest black holes known, Gaia BH1 and Gaia BH3, each
 * with the star that gave it away on the orbit measured for the pair; and (D6b) Cygnus X-1,
 * the first black hole known, feeding on the wind of its supergiant. Each is a body of its
 * event horizon's real size -- 12.7 million km for Sgr A*, 28, 97 and 63 km for the others --
 * at its real place, drawn as what it looks like: its shadow, and the sky bent round it.
 *
 * ## The horizon, the shadow and the lens
 *
 * The body's radius is the **Schwarzschild radius, r_s = 2GM/c^2**: the horizon of a black
 * hole that does not spin. Of the four only Cygnus X-1 has a spin measured -- near the
 * maximum, by fitting its disc's X-rays (below) -- so not spinning is a convention for three
 * and a simplification for the fourth, and it is the largest a horizon of that mass can be:
 * a spinning one is smaller, down to half at the maximum spin. It sets how close the camera may come. What
 * one would *see* is larger: light that passes within sqrt(27)/2 = 2.6 r_s of the centre
 * falls in, and the dark **shadow** is that, not the horizon -- so the black sphere drawn
 * is scaled to hide exactly the shadow from where the camera is (schwarzschildLens.ts,
 * shadowSphereRadius). Round it the sky is **lensed**, by the exact Schwarzschild
 * deflection for a camera at its real distance: stars moved to their two images, the
 * galaxy's glow bent into its Einstein ring and the thinner rings within
 * (BlackHoleLens.tsx).
 *
 * ## Sgr A*
 *
 * - **Mass and distance:** GRAVITY Collaboration 2024, A&A 692, A242 (arXiv 2409.12261),
 *   Table B.1, their four-star fit of S2, S29, S38 and S55: M = 4.2996 +- 0.0118 million
 *   solar masses, R0 = 8275.9 +- 8.6 pc. (GRAVITY 2022, A&A 657, L12, had 4.297 and 8277;
 *   both carry a systematic +-30 pc and +-40,000 Msun beyond the statistical errors.)
 * - **Position and motion on the sky:** Gordon et al. 2023, AJ 165, 49 (arXiv 2212.00632):
 *   ICRF3 J2000 position 17h45m40.034047s, -29d00'28.21601" at the 2015.0 proper-motion
 *   epoch, and proper motion -3.128 mas/yr in RA, -5.584 in Dec from 52 VLBA epochs. That
 *   motion is the Sun's own orbit about the Galaxy, reflected: Sgr A* itself is at rest to
 *   within a few km/s (Reid & Brunthaler 2020, ApJ 892, 39).
 * - **Along the line of sight** it closes on us at 11.1 km/s, the Sun's own motion toward
 *   the centre (Schönrich, Binney & Dehnen 2010, MNRAS 403, 1829, U_sun). Neither paper
 *   above measures it; a century of it is 230 AU, against GRAVITY's +-9 pc.
 *
 * ### Sgr A* and the galaxy model's centre
 *
 * The Milky Way model (milkyWay.ts) keeps its centre at Reid et al. 2019's R0 = 8.15 kpc,
 * because its spiral arms were fitted with that number and would slide off the masers that
 * define them under another. Sgr A* is placed where GRAVITY measures it, 8,275.9 pc: so the
 * model's centre is drawn 126 pc (1.5%) nearer the Sun than the black hole it is the centre
 * of -- within Reid et al.'s own +-0.15 kpc. At the galaxy's scale the two are one point;
 * at Sgr A*'s, the model has no centre to draw (blackHoles.test.ts measures the offset).
 *
 * ### S2
 *
 * GRAVITY 2024 Table B.1 again: a = 0.12502", e = 0.88444, i = 134.67, Omega = 228.21,
 * omega = 66.279 degrees, periastron 2018.3789 -- osculating elements of the fit (at
 * 2010.35), in the visual-binary convention (Thiele-Innes; as alphaCentauri.ts), the line
 * of sight counted away from us. Checked against GRAVITY 2018 (A&A 615, L15) Fig. 2: these
 * put periastron 2 mas east and 11 mas south of Sgr A*, the radial velocity peaking near
 * +4,000 km/s just before it and dropping to -1,900 after, as measured. The period follows
 * from Kepler with the mass and distance above: 16.05 years. Drawn as a Kepler ellipse --
 * **the 12' per orbit of relativistic (Schwarzschild) precession that GRAVITY measured is
 * not drawn**, nor the light-travel and redshift effects within the orbit. S2 itself: a B0
 * to B3 dwarf of 28,500 K, 5.5 solar radii and 13.6 solar masses from its spectrum (Habibi
 * et al. 2017, ApJ 847, 120, Table 2) -- radius and mass from stellar models fitted to it.
 *
 * ## Gaia BH1 and Gaia BH3
 *
 * Each found by the wobble of a star about it in Gaia's astrometry, and confirmed by the
 * star's radial velocities. The orbit's orientation on the sky is measured: these are
 * astrometric binaries.
 *
 * - **Gaia BH1** (Gaia DR3 4373465352415301632): El-Badry et al. 2023, MNRAS 518, 1057
 *   (arXiv 2209.06833), Table 1, the joint fit of the Gaia orbit and their radial
 *   velocities: P = 185.59 d, e = 0.451, i = 126.6, Omega = 97.8, omega = 12.8 degrees,
 *   periastron JD 2,457,387.9, black hole 9.62 +- 0.18 Msun, a G dwarf of 0.93 Msun,
 *   0.99 Rsun and 5,850 K; the system at RA 262.17120816, Dec -0.58109202 (Gaia DR3,
 *   J2016.0), parallax 2.09 mas -- 478 pc, 1,560 ly -- proper motion (-7.70, -25.85)
 *   mas/yr and centre-of-mass velocity 46.6 km/s.
 * - **Gaia BH3** (Gaia DR3 4318465066420528000, the star LS II +14 13): Gaia
 *   Collaboration, Panuzzo et al. 2024, A&A 686, L2 (arXiv 2404.10486), Table 2, the
 *   combined astrometric and spectroscopic solution: P = 4,253.1 d, e = 0.7291, i =
 *   110.580, Omega = 136.236, omega = 77.34 degrees, periastron JD 2,458,177.39; its
 *   barycentre at RA 294.8278502301, Dec 14.9309190869 (J2017.5), parallax 1.6933 mas --
 *   591 pc, 1,926 ly -- proper motion (-28.317, -155.221) mas/yr, systemic velocity
 *   -357.31 km/s; black hole 32.70 +- 0.82 Msun, and the star, a metal-poor giant of
 *   0.76 Msun, 4.936 Rsun and 5,212 K (their Table 3).
 *
 * In both the elements are the luminous star's: omega is its argument of periastron, the
 * convention Gaia's (Halbwachs et al. 2023) and the visual binaries' -- the same formulas
 * as S2's -- and they give back El-Badry et al.'s Thiele-Innes constants and both papers'
 * radial velocities (blackHoles.test.ts). The separation is not taken from the papers but
 * from Kepler's law, with the period and the two masses, so the orbit drawn and the motion
 * along it agree: 1.396 AU for BH1 against their 1.40, and BH3's star 16.18 AU from the
 * barycentre against their 16.17 +- 0.27.
 *
 * ## Cygnus X-1
 *
 * Found in X-rays in 1964, and the first black hole shown to be one: the supergiant HDE
 * 226868's orbit needs an unseen companion too heavy for a neutron star. Unlike the two above
 * it is feeding: the star's wind falls onto a disc about the hole that shines in X-rays, and
 * a radio jet leaves it.
 *
 * - **The system:** Miller-Jones et al. 2021, Science 371, 1046 (arXiv 2102.09091), Table 1,
 *   their fit of the optical light curve and radial velocities: black hole 21.2 +- 2.2 Msun,
 *   the O9.7 supergiant 40.6 (+7.7 -7.1) Msun, 22.3 Rsun and 31,138 K, e = 0.0189, the star's
 *   omega = 306.6 degrees, i = 27.51 degrees; the star's orbit about the barycentre 0.0838 AU.
 * - **On the sky:** the same paper's VLBA astrometry (Table S3): the reference position
 *   19h58m21.6717793s +35d12'05.705435" at MJD 56198.0, proper motion (-3.804, -6.312) mas/yr,
 *   and the orbit turning clockwise on the sky -- so the inclination drawn is 180 - 27.51 =
 *   152.49 degrees, which their astrometric fit gives too (152.9 +- 0.7). Its node, 64.1 +- 1.0
 *   degrees, is **not measured by the orbit**: they put the jet's direction in as a prior,
 *   assuming the jet leaves along the orbit's axis, and the fit returns it. Distance 2.22
 *   (+0.18 -0.17) kpc, their parallax read with a prior on how stars are spread.
 * - **When along it:** the period, 5.599829 d, from Brocksopp et al. 1999 (MNRAS 309, 1063;
 *   26 years of radial velocities), and the star's inferior conjunction, in front of the hole,
 *   at HJD 2,451,730.449 from Gies et al. 2003 (ApJ 583, 424), whose fit also gives the
 *   system's radial velocity, -7.0 +- 0.5 km/s. There the star is nearest us: omega + nu =
 *   270 degrees, which puts periastron a tenth of a period later (periastronFromConjunction).
 * - **Spin:** a* > 0.9985 (3 sigma), by fitting its disc's X-ray continuum with the disc in the
 *   orbit's plane (Zhao et al. 2021, ApJ 908, 117; arXiv 2102.09093). Not drawn: the hole is a
 *   Schwarzschild one like the others. A hole spinning that fast has a horizon about half as
 *   wide, and a shadow a little smaller and flattened on one side.
 * - **The disc and the jet** are not drawn: the disc is X-rays, the jet radio. In visible light
 *   the system is the supergiant.
 * - **The star** is drawn a sphere; it fills 96% of its Roche lobe (their f1 = 0.960), so it is
 *   in truth drawn out a little toward the hole.
 *
 * ## Where they are, and when
 *
 * Like every star here, each is placed where it is seen: along the line its light arrives
 * on now, at its measured distance, moving at its measured velocity. The light from Sgr A*
 * left it 27,000 years ago; nothing can say where it is "now" any better than that.
 */

const DEG = Math.PI / 180;

export { julianEpochJd, skyOrbitState, thieleInnes, type SkyOrbit, type SkyState } from './skyOrbit.ts';
const AU_KM = 149_597_870.7;
const PARSEC_KM = (AU_KM * 648_000) / Math.PI;
const DAY_S = 86_400;

/** The Sun's GM, km^3/s^2, as the star bodies take it (IAU 2015 nominal). */
export const GM_SUN_KM3_S2 = 1.3271244e11;
/** The speed of light, km/s. */
export const C_KM_S = 299_792.458;
/** The nominal solar radius, km (IAU 2015 B3). */
const SOLAR_RADIUS_KM = 695_700;

/** A black hole's Schwarzschild radius, km: 2GM/c^2, 2.953 km per solar mass. */
export function schwarzschildRadiusKm(massSun: number): number {
  return (2 * GM_SUN_KM3_S2 * massSun) / (C_KM_S * C_KM_S);
}


// ---------------------------------------------------------------------------------------
// Sgr A*

export const SGR_A_ID: BodyId = 'sgr-a-star';
export const S2_ID: BodyId = 's2';

/** GRAVITY Collaboration 2024 (A&A 692, A242) Table B.1. */
export const SGR_A_MASS_SUN = 4.2996e6;
export const SGR_A_DISTANCE_PC = 8275.9;
export const SGR_A_REFERENCE = 'GRAVITY Collaboration 2024, A&A 692, A242';

/** Sgr A* on the sky: Gordon et al. 2023 (AJ 165, 49), ICRF3, at its 2015.0 epoch. */
export const SGR_A_ASTROMETRY: Astrometry & { readonly epochJd: number } = {
  /** 17h45m40.034047s */
  raDeg: (17 + 45 / 60 + 40.034047 / 3600) * 15,
  /** -29d00'28.21601" */
  decDeg: -(29 + 0 / 60 + 28.21601 / 3600),
  parallaxMas: 1000 / SGR_A_DISTANCE_PC,
  pmRaMasPerYear: -3.128,
  pmDecMasPerYear: -5.584,
  /** The Sun's 11.1 km/s toward the centre (Schönrich et al. 2010), seen from the Sun. */
  radialVelocityKmS: -11.1,
  epochJd: julianEpochJd(2015),
};

/** S2's orbit about Sgr A*, GRAVITY 2024 Table B.1. */
export const S2_ORBIT = {
  semiMajorAxisArcsec: 0.12502,
  eccentricity: 0.88444,
  inclinationDeg: 134.67,
  nodeDeg: 228.21,
  argPeriastronDeg: 66.279,
  periastronYear: 2018.3789,
} as const;

/** S2 itself, Habibi et al. 2017 (ApJ 847, 120) Table 2: model fits to its spectrum. */
export const S2_STAR = { massSun: 13.6, radiusSun: 5.53, temperatureK: 28_513 } as const;

// ---------------------------------------------------------------------------------------
// M87*, not placed

/**
 * M87*, for comparison only: Event Horizon Telescope Collaboration 2019, ApJL 875, L1 --
 * 6.5 +- 0.7 billion solar masses at 16.8 +- 0.8 Mpc. Fifty-five million light years is
 * past any distance this simulator can be zoomed out to (400,000 ly), so it is not placed:
 * its horizon is quoted against the Solar System instead.
 */
export const M87_MASS_SUN = 6.5e9;
export const M87_DISTANCE_MPC = 16.8;
export const M87_REFERENCE = 'EHT Collaboration 2019, ApJL 875, L1';

// ---------------------------------------------------------------------------------------
// Orbits on the sky

/** The semi-major axis Kepler's third law gives, km, for a period and a total mass. */
export function keplerSemiMajorAxisKm(periodDays: number, totalMassSun: number): number {
  const seconds = periodDays * DAY_S;
  return Math.cbrt((GM_SUN_KM3_S2 * totalMassSun * seconds * seconds) / (4 * Math.PI * Math.PI));
}

/** The period Kepler's third law gives, days, for a semi-major axis and a total mass. */
export function keplerPeriodDays(semiMajorAxisKm: number, totalMassSun: number): number {
  return (2 * Math.PI * Math.sqrt(semiMajorAxisKm ** 3 / (GM_SUN_KM3_S2 * totalMassSun))) / DAY_S;
}

type Axes = ReturnType<typeof skyAxes>;

function onAxes(axes: Axes, v: { east: number; north: number; away: number }): Vec3 {
  return {
    x: v.east * axes.east.x + v.north * axes.north.x + v.away * axes.away.x,
    y: v.east * axes.east.y + v.north * axes.north.y + v.away * axes.away.y,
    z: v.east * axes.east.z + v.north * axes.north.z + v.away * axes.away.z,
  };
}

function unit(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/** A sky state in the scene frame, km and km/s. */
function skyToScene(axes: Axes, state: SkyState): StateVector {
  return { position: onAxes(axes, state.position), velocity: onAxes(axes, state.velocity) };
}

/** A straight line through the Galaxy from an astrometric entry at its epoch: about the Sun. */
function linearState(entry: Astrometry & { readonly epochJd: number }): (jd: number) => StateVector {
  const at = astrometricState(entry);
  return (jd) => {
    const seconds = (jd - entry.epochJd) * DAY_S;
    return {
      position: {
        x: at.position.x + at.velocity.x * seconds,
        y: at.position.y + at.velocity.y * seconds,
        z: at.position.z + at.velocity.z * seconds,
      },
      velocity: at.velocity,
    };
  };
}

/** Sgr A* about the Sun, scene frame, km and km/s. */
export const sgrAState: (jd: number) => StateVector = linearState(SGR_A_ASTROMETRY);

/** The unit direction from the Sun to Sgr A*, at its epoch. */
export const SGR_A_TOWARD: Vec3 = unit(astrometricState(SGR_A_ASTROMETRY).position);

/** S2's orbit, in km: the angle at GRAVITY's distance, the period from Kepler's law. */
export const S2_SKY_ORBIT: SkyOrbit = (() => {
  const semiMajorAxisKm = S2_ORBIT.semiMajorAxisArcsec * SGR_A_DISTANCE_PC * AU_KM;
  return {
    semiMajorAxisKm,
    eccentricity: S2_ORBIT.eccentricity,
    inclinationDeg: S2_ORBIT.inclinationDeg,
    nodeDeg: S2_ORBIT.nodeDeg,
    argPeriastronDeg: S2_ORBIT.argPeriastronDeg,
    periastronJd: julianEpochJd(S2_ORBIT.periastronYear),
    periodDays: keplerPeriodDays(semiMajorAxisKm, SGR_A_MASS_SUN + S2_STAR.massSun),
  };
})();

/** S2 about Sgr A*, scene frame, km and km/s. */
export function s2StateAboutSgrA(jd: number): StateVector {
  return skyToScene(skyAxes(SGR_A_TOWARD), skyOrbitState(S2_SKY_ORBIT, jd));
}

/** Any state on the sky's axes at Sgr A* -- east, north, away -- in the scene frame. */
export function sgrASkyToScene(state: SkyState): StateVector {
  return skyToScene(skyAxes(SGR_A_TOWARD), state);
}

// ---------------------------------------------------------------------------------------
// Gaia BH1 and BH3

export interface DarkBinary {
  readonly key: 'gaia-bh1' | 'gaia-bh3' | 'cyg-x1';
  /** The black hole's body id and name. */
  readonly id: BodyId;
  readonly name: string;
  /** The star's. */
  readonly starId: BodyId;
  readonly starName: string;
  /** The star's Gaia DR3 source_id, where the paper gives it. */
  readonly gaiaDr3: string | null;
  /** The system's barycentre, at its epoch. */
  readonly barycentre: Astrometry & { readonly epochJd: number };
  readonly periodDays: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly nodeDeg: number;
  /** The luminous star's argument of periastron, degrees. */
  readonly argPeriastronDeg: number;
  readonly periastronJd: number;
  readonly blackHoleMassSun: number;
  readonly starMassSun: number;
  readonly starRadiusSun: number;
  readonly starTemperatureK: number;
  /** What the paper gives for the star's orbit about the barycentre: AU, and mas where it gives it. */
  readonly publishedStarOrbitAu: number;
  readonly publishedStarOrbitMas: number | null;
  readonly reference: string;
  /** The spin, where it is measured, and whose. */
  readonly spin: { readonly text: string; readonly reference: string } | null;
  /** Whether it is feeding: a disc and a jet, neither drawn. */
  readonly accreting: boolean;
}

/** El-Badry et al. 2023 (MNRAS 518, 1057) Table 1: the joint astrometric and RV fit. */
export const GAIA_BH1: DarkBinary = {
  key: 'gaia-bh1',
  id: 'gaia-bh1',
  name: 'Gaia BH1',
  starId: 'gaia-bh1-star',
  starName: 'Gaia BH1 star',
  gaiaDr3: '4373465352415301632',
  barycentre: {
    raDeg: 262.17120816,
    decDeg: -0.58109202,
    parallaxMas: 2.09,
    pmRaMasPerYear: -7.7,
    pmDecMasPerYear: -25.85,
    radialVelocityKmS: 46.6,
    epochJd: julianEpochJd(2016),
  },
  periodDays: 185.59,
  eccentricity: 0.451,
  inclinationDeg: 126.6,
  nodeDeg: 97.8,
  argPeriastronDeg: 12.8,
  // "JD - 2457389": -1.1.
  periastronJd: 2457389 - 1.1,
  blackHoleMassSun: 9.62,
  starMassSun: 0.93,
  starRadiusSun: 0.99,
  starTemperatureK: 5850,
  // Their a = 1.40 AU is the relative orbit; the star's share is mBH / (mBH + m*).
  publishedStarOrbitAu: (1.4 * 9.62) / (9.62 + 0.93),
  publishedStarOrbitMas: 2.67,
  reference: 'El-Badry et al. 2023, MNRAS 518, 1057',
  spin: null,
  accreting: false,
};

/** Gaia Collaboration, Panuzzo et al. 2024 (A&A 686, L2) Tables 2 and 3: the combined solution. */
export const GAIA_BH3: DarkBinary = {
  key: 'gaia-bh3',
  id: 'gaia-bh3',
  name: 'Gaia BH3',
  starId: 'gaia-bh3-star',
  starName: 'LS II +14 13',
  gaiaDr3: '4318465066420528000',
  barycentre: {
    raDeg: 294.8278502301,
    decDeg: 14.9309190869,
    parallaxMas: 1.6933,
    pmRaMasPerYear: -28.317,
    pmDecMasPerYear: -155.221,
    radialVelocityKmS: -357.31,
    epochJd: julianEpochJd(2017.5),
  },
  periodDays: 4253.1,
  eccentricity: 0.7291,
  inclinationDeg: 110.58,
  nodeDeg: 136.236,
  argPeriastronDeg: 77.34,
  periastronJd: 2458177.39,
  blackHoleMassSun: 32.7,
  starMassSun: 0.76,
  starRadiusSun: 4.936,
  starTemperatureK: 5212,
  publishedStarOrbitAu: 16.17,
  publishedStarOrbitMas: 27.39,
  reference: 'Gaia Collaboration, Panuzzo et al. 2024, A&A 686, L2',
  spin: null,
  accreting: false,
};

/**
 * The time of periastron from a time of conjunction: when the star is at true anomaly
 * `trueAnomalyDeg`, Kepler's equation run backwards -- E from nu, M from E.
 */
export function periastronFromConjunction(
  conjunctionJd: number,
  trueAnomalyDeg: number,
  eccentricity: number,
  periodDays: number,
): number {
  const nu = trueAnomalyDeg * DEG;
  const E = 2 * Math.atan2(Math.sqrt(1 - eccentricity) * Math.sin(nu / 2), Math.sqrt(1 + eccentricity) * Math.cos(nu / 2));
  const M = E - eccentricity * Math.sin(E);
  return conjunctionJd - (M / (2 * Math.PI)) * periodDays;
}

/** Cygnus X-1's eccentricity and its star's argument of periastron (Miller-Jones et al. 2021). */
const CYG_X1_E = 0.0189;
const CYG_X1_OMEGA_DEG = 306.6;
/** The star's inferior conjunction, HJD (Gies et al. 2003), and the period (Brocksopp et al. 1999). */
export const CYG_X1_CONJUNCTION_JD = 2451730.449;
const CYG_X1_PERIOD_DAYS = 5.599829;

/** Miller-Jones et al. 2021 (Science 371, 1046): Table 1 and Table S3; see the header. */
export const CYG_X1: DarkBinary = {
  key: 'cyg-x1',
  id: 'cyg-x1',
  name: 'Cygnus X-1',
  starId: 'cyg-x1-star',
  starName: 'HDE 226868',
  gaiaDr3: null,
  barycentre: {
    raDeg: (19 + 58 / 60 + 21.6717793 / 3600) * 15,
    decDeg: 35 + 12 / 60 + 5.705435 / 3600,
    // Their 2.22 kpc, not 1 / their 0.458 mas: the distance is read with a prior.
    parallaxMas: 1 / 2.22,
    pmRaMasPerYear: -3.804,
    pmDecMasPerYear: -6.312,
    radialVelocityKmS: -7.0,
    // MJD 56198.0.
    epochJd: 2456198.5,
  },
  periodDays: CYG_X1_PERIOD_DAYS,
  eccentricity: CYG_X1_E,
  // Clockwise on the sky, as the VLBA saw it.
  inclinationDeg: 180 - 27.51,
  nodeDeg: 64.1,
  argPeriastronDeg: CYG_X1_OMEGA_DEG,
  // Nearest us, in front of the hole, at omega + nu = 270 degrees.
  periastronJd: periastronFromConjunction(CYG_X1_CONJUNCTION_JD, 270 - CYG_X1_OMEGA_DEG, CYG_X1_E, CYG_X1_PERIOD_DAYS),
  blackHoleMassSun: 21.2,
  starMassSun: 40.6,
  starRadiusSun: 22.3,
  starTemperatureK: 31_138,
  publishedStarOrbitAu: 0.0838,
  publishedStarOrbitMas: null,
  reference: 'Miller-Jones et al. 2021, Science 371, 1046',
  spin: { text: 'a* > 0.9985 (disc X-rays)', reference: 'Zhao et al. 2021, ApJ 908, 117' },
  accreting: true,
};

export const DARK_BINARIES: readonly DarkBinary[] = [GAIA_BH1, GAIA_BH3, CYG_X1];

/** A binary's total mass, solar. */
export function totalMassSun(binary: DarkBinary): number {
  return binary.blackHoleMassSun + binary.starMassSun;
}

/** The star's orbit about the black hole, km: the separation from Kepler's law. */
export function relativeSkyOrbit(binary: DarkBinary): SkyOrbit {
  return {
    semiMajorAxisKm: keplerSemiMajorAxisKm(binary.periodDays, totalMassSun(binary)),
    eccentricity: binary.eccentricity,
    inclinationDeg: binary.inclinationDeg,
    nodeDeg: binary.nodeDeg,
    argPeriastronDeg: binary.argPeriastronDeg,
    periastronJd: binary.periastronJd,
    periodDays: binary.periodDays,
  };
}

/** The unit direction from the Sun to a binary, at its epoch. */
export function towardBinary(binary: DarkBinary): Vec3 {
  return unit(astrometricState(binary.barycentre).position);
}

/** The star about its black hole, scene frame, km and km/s. */
export function starStateAboutBlackHole(binary: DarkBinary, jd: number): StateVector {
  return skyToScene(skyAxes(towardBinary(binary)), skyOrbitState(relativeSkyOrbit(binary), jd));
}

/**
 * The black hole about the Sun: the barycentre's straight line, less the black hole's
 * share of the orbit -- m* / (mBH + m*) of the star's separation, the other way.
 */
export function blackHoleState(binary: DarkBinary): (jd: number) => StateVector {
  const barycentre = linearState(binary.barycentre);
  const share = binary.starMassSun / totalMassSun(binary);
  return (jd) => {
    const bary = barycentre(jd);
    const rel = starStateAboutBlackHole(binary, jd);
    return {
      position: {
        x: bary.position.x - share * rel.position.x,
        y: bary.position.y - share * rel.position.y,
        z: bary.position.z - share * rel.position.z,
      },
      velocity: {
        x: bary.velocity.x - share * rel.velocity.x,
        y: bary.velocity.y - share * rel.velocity.y,
        z: bary.velocity.z - share * rel.velocity.z,
      },
    };
  };
}

/**
 * The star's radial velocity as seen from the Sun, km/s, positive away: the system's,
 * plus the star's motion about the barycentre along the line of sight. What the papers'
 * spectra measure.
 */
export function starRadialVelocityKmS(binary: DarkBinary, jd: number): number {
  const share = binary.blackHoleMassSun / totalMassSun(binary);
  return binary.barycentre.radialVelocityKmS + share * skyOrbitState(relativeSkyOrbit(binary), jd).velocity.away;
}

// ---------------------------------------------------------------------------------------
// The bodies

/** What a black hole is drawn in where it needs a colour at all: its marker, name and rim. */
export const BLACK_HOLE_COLOR = '#a99cff';

/**
 * The B-V colour index the scene's colour relation (blackbody.ts, Ballesteros 2012) gives
 * for a temperature: that relation run backwards, by bisection. These stars' temperatures
 * are published; their colour indices are not. Clamped at the relation's hot end, -0.4 --
 * 21,700 K -- which S2, at 28,500 K, is past: it is drawn at that colour, a shade too warm.
 */
export function colorIndexForTemperature(kelvin: number): number {
  let hot = MIN_COLOR_INDEX;
  let cool = MAX_COLOR_INDEX;
  if (kelvin >= colorIndexToTemperature(hot)) {
    return hot;
  }
  if (kelvin <= colorIndexToTemperature(cool)) {
    return cool;
  }
  for (let k = 0; k < 60; k += 1) {
    const mid = (hot + cool) / 2;
    if (colorIndexToTemperature(mid) > kelvin) {
      hot = mid;
    } else {
      cool = mid;
    }
  }
  return (hot + cool) / 2;
}

/**
 * A black hole as a body: a sphere of its Schwarzschild radius, unlit, black -- the radius
 * the camera keeps out of; what is drawn is scaled to the shadow (SolarSystem.tsx).
 */
export function blackHoleDefinition(id: BodyId, name: string, massSun: number): BodyDefinition {
  const radius = schwarzschildRadiusKm(massSun);
  const gm = massSun * GM_SUN_KM3_S2;
  return {
    id,
    name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'black-hole',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: BLACK_HOLE_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** A star about a black hole: a disc of its published radius, in its blackbody colour. */
function companionDefinition(
  id: BodyId,
  name: string,
  parent: BodyId,
  massSun: number,
  radiusSun: number,
  temperatureK: number,
): BodyDefinition {
  const radius = radiusSun * SOLAR_RADIUS_KM;
  const gm = massSun * GM_SUN_KM3_S2;
  return {
    id,
    name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent,
    kind: 'star',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: colorHex(starColor(colorIndexForTemperature(temperatureK))),
    drawOrbit: true,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** A black hole and what goes round it, as a place to go. */
export interface BlackHoleSystem {
  readonly id: BodyId;
  readonly name: string;
  /** The star on the orbit about it. */
  readonly companion: BodyId;
  /** How far out its companion goes, km: its apocentre about the black hole. */
  readonly extentKm: number;
  /** Where the camera stands when going there, km from the black hole. */
  readonly framingKm: number;
  /** And from where it looks, as the store's framing request takes it. */
  readonly view: ReturnType<typeof viewOffPole>;
  /** The binary, for Gaia BH1 and BH3; null for Sgr A*. */
  readonly binary: DarkBinary | null;
}

/** An orbit's pole in the scene frame, from a state on it. */
function poleOf(state: StateVector): Vec3 {
  const { position: r, velocity: v } = state;
  return unit({ x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x });
}

/**
 * Sgr A* is framed at 5 AU, looking from the Sun's side with celestial north up -- as we
 * see it -- so the horizon, 0.085 AU, sits inside the scale rings of Mercury's and Earth's
 * orbits (HorizonScale.tsx), and S2's orbit opens out as GRAVITY draws it when the camera
 * pulls back.
 */
export const SGR_A_FRAMING_KM = 5 * AU_KM;

/** The view of Sgr A* from the Sun's side, north up. */
export function sgrAView(): ReturnType<typeof viewOffPole> {
  const north = skyAxes(SGR_A_TOWARD).north;
  return {
    direction: [-SGR_A_TOWARD.x, -SGR_A_TOWARD.y, -SGR_A_TOWARD.z],
    up: [north.x, north.y, north.z],
  };
}

export const BLACK_HOLE_SYSTEMS: readonly BlackHoleSystem[] = [
  {
    id: SGR_A_ID,
    name: 'Sgr A*',
    companion: S2_ID,
    extentKm: S2_SKY_ORBIT.semiMajorAxisKm * (1 + S2_SKY_ORBIT.eccentricity),
    framingKm: SGR_A_FRAMING_KM,
    view: sgrAView(),
    binary: null,
  },
  ...DARK_BINARIES.map((binary): BlackHoleSystem => {
    const orbit = relativeSkyOrbit(binary);
    const extentKm = orbit.semiMajorAxisKm * (1 + orbit.eccentricity);
    return {
      id: binary.id,
      name: binary.name,
      companion: binary.starId,
      extentKm,
      // Five apocentres out, 30 degrees off the orbit's pole: the ellipse whole, as an ellipse.
      framingKm: 5 * extentKm,
      view: viewOffPole(poleOf(starStateAboutBlackHole(binary, J2000_JD)), 30),
      binary,
    };
  }),
];

/** The black-hole system a body belongs to -- the black hole or its star -- or null. */
export function blackHoleSystemOf(id: BodyId | null): BlackHoleSystem | null {
  if (id === null) {
    return null;
  }
  return BLACK_HOLE_SYSTEMS.find((system) => system.id === id || system.companion === id) ?? null;
}

/**
 * Makes the black holes and their stars bodies, for good: done once at start (App.tsx),
 * so they are named on the sky, found by search and gone to from the breadcrumb. Each
 * black hole is placed about the Sun; each star about its black hole, so the frame tree
 * carries it, and its orbit is drawn about it with their two masses.
 */
export function ensureBlackHoles(store: EphemerisStore): void {
  if (store.isPropagatedBody(SGR_A_ID)) {
    return;
  }
  const s2Body = companionDefinition(S2_ID, 'S2', SGR_A_ID, S2_STAR.massSun, S2_STAR.radiusSun, S2_STAR.temperatureK);
  setStarDisc(S2_ID, colorIndexForTemperature(S2_STAR.temperatureK));
  const entries: Parameters<EphemerisStore['addPropagatedBodies']>[0][number][] = [
    {
      body: blackHoleDefinition(SGR_A_ID, 'Sgr A*', SGR_A_MASS_SUN),
      elements: null,
      state: sgrAState,
      // As measured, not a fallback from something better.
      options: { exact: true },
    },
    {
      body: s2Body,
      elements: stateToOsculatingElements(
        s2StateAboutSgrA(J2000_JD),
        (SGR_A_MASS_SUN + S2_STAR.massSun) * GM_SUN_KM3_S2,
        J2000_JD,
        S2_ID,
        SGR_A_ID,
      ),
      state: s2StateAboutSgrA,
      options: { aboutParent: true, exact: true },
    },
  ];
  for (const binary of DARK_BINARIES) {
    setStarDisc(binary.starId, colorIndexForTemperature(binary.starTemperatureK));
    entries.push(
      {
        body: blackHoleDefinition(binary.id, binary.name, binary.blackHoleMassSun),
        elements: null,
        state: blackHoleState(binary),
        options: { exact: true },
      },
      {
        body: companionDefinition(
          binary.starId,
          binary.starName,
          binary.id,
          binary.starMassSun,
          binary.starRadiusSun,
          binary.starTemperatureK,
        ),
        elements: stateToOsculatingElements(
          starStateAboutBlackHole(binary, J2000_JD),
          totalMassSun(binary) * GM_SUN_KM3_S2,
          J2000_JD,
          binary.starId,
          binary.id,
        ),
        state: (jd: number) => starStateAboutBlackHole(binary, jd),
        options: { aboutParent: true, exact: true },
      },
    );
  }
  store.addPropagatedBodies(entries);
}

/** The parsecs a state's position is from the Sun. */
export function distancePc(position: Vec3): number {
  return Math.hypot(position.x, position.y, position.z) / PARSEC_KM;
}
