/**
 * Distances in an expanding universe (G4): what a redshift puts where, and how long its light
 * has been on the way.
 *
 * ## Which cosmology, and why not the catalogue's
 *
 * Laniakea's catalogue (G3, laniakea.ts) turns a redshift into a distance in flat Lambda-CDM with
 * H0 74.6 km/s/Mpc and Omega_m 0.3 -- Cosmicflows-4's own H0, measured from the distances it is
 * made of (Tully et al. 2023, ApJ 944, 94), and right for z under 0.2, where a distance is very
 * nearly cz / H0 and the matter density barely enters. Past that the expansion's whole history
 * enters, and the one cosmology that fits it from the last-scattering surface on is Planck's:
 * the base Lambda-CDM fit to Planck 2018's temperature, polarisation and lensing with the BAO
 * (Planck Collaboration 2020, A&A 641, A6, Table 2, last column) -- H0 67.66, Omega_m 0.3111,
 * age 13.787 billion years. With 74.6 and 0.3 the universe would be 12.6 billion years old,
 * younger than its oldest stars allow, and the CMB's acoustic peaks would sit at the wrong
 * angle: the two H0s are the Hubble tension, unresolved.
 *
 * So everything of G4 -- the CMB's sphere, the record-holders -- is placed in Planck 2018, and
 * Laniakea's catalogue stays in its own. They meet at the catalogue's far edge, 700 Mpc, z 0.17,
 * where the two disagree by 9 %, the ratio of the H0s: a galaxy at z 0.17 is 700 Mpc off in one
 * and 760 in the other. The About says so.
 *
 * ## The pieces
 *
 * Flat, so Omega_Lambda = 1 - Omega_m - Omega_r. Radiation is the CMB's photons at T0 = 2.7255 K
 * (Fixsen 2009, ApJ 707, 916) and three species of neutrino, Neff 3.046, all treated as massless
 * -- Planck's one massive neutrino of 0.06 eV is in Omega_m, as Planck's Omega_m counts it, and
 * relativistic only past z ~ 100, where it is a 0.4 % share of the radiation: counting it in
 * both moves the distance to the CMB by under a part in a thousand. Radiation is nothing today,
 * 1e-4 of the total, and decides the last 2 % of the distance to the CMB, emitted at z 1090,
 * when it was a quarter of the matter's density.
 *
 * Every distance is an integral over the scale factor a = 1 / (1 + z):
 *
 *   comoving distance   D = (c / H0) * integral from a_e to 1 of da / (a^2 E(a))
 *   lookback time       t = (1 / H0) * integral from a_e to 1 of da / (a E(a))
 *   E(a) = sqrt(Omega_r a^-4 + Omega_m a^-3 + Omega_Lambda)
 *
 * taken with u = sqrt(a), which leaves both integrands smooth down to a = 0, so the particle
 * horizon -- the comoving distance to the Big Bang, the observable universe's radius -- is the
 * same integral from a_e = 0. Simpson's rule over 20,000 steps; the tests check it against
 * Planck's own derived numbers.
 */

export interface Cosmology {
  /** km/s/Mpc. */
  readonly h0: number;
  /** Matter, today, with the massive neutrino. */
  readonly omegaM: number;
  /** The CMB's temperature today, K. */
  readonly t0K: number;
  /** Effective number of neutrino species, all treated as relativistic. */
  readonly nEff: number;
  readonly name: string;
}

/**
 * Planck 2018, TT,TE,EE+lowE+lensing+BAO (Planck Collaboration 2020, A&A 641, A6, Table 2): H0
 * 67.66 +- 0.42, Omega_m 0.3111 +- 0.0056. T0 from Fixsen 2009. Neff the standard 3.046 the fit
 * fixes.
 */
export const PLANCK18: Cosmology = { h0: 67.66, omegaM: 0.3111, t0K: 2.7255, nEff: 3.046, name: 'Planck 2018' };

/** Laniakea's catalogue's (laniakea.json): Cosmicflows-4's H0, Omega_m 0.3. For comparison only. */
export const CF4_COSMOLOGY: Cosmology = { h0: 74.6, omegaM: 0.3, t0K: 2.7255, nEff: 3.046, name: 'Cosmicflows-4' };

/**
 * The redshift of last scattering, z*: where the CMB's photons were last scattered, the
 * optical depth through the plasma reaching one -- Planck 2018's same fit, 1089.80 +- 0.21.
 */
export const Z_LAST_SCATTERING = 1089.8;

/** km/s, exact. */
export const SPEED_OF_LIGHT_KM_S = 299_792.458;
/** A parsec, km (IAU 2015 B2), as stars3d.ts: kept here so search.ts can reach this module without a cycle. */
const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const MPC_KM = 1e6 * PARSEC_KM;
/** A light year, km, and a Julian year, s: as scale.ts, kept here so this module needs nothing from the scene. */
const YEAR_S = 365.25 * 86_400;
const LIGHT_YEAR_KM = SPEED_OF_LIGHT_KM_S * YEAR_S;

/**
 * The radiation's share today: photons, by the Stefan-Boltzmann law against the critical
 * density, plus Neff neutrino species at (7/8)(4/11)^(4/3) of the photons' each.
 */
export function omegaRadiation(c: Cosmology): number {
  const sigma = 5.670_374_419e-8; // W m^-2 K^-4, exact since 2019
  const cSi = 299_792_458;
  const g = 6.674_30e-11;
  const h0PerS = (c.h0 * 1000) / (MPC_KM * 1000);
  const rhoCritical = (3 * h0PerS * h0PerS) / (8 * Math.PI * g); // kg m^-3
  const rhoPhotons = (4 * sigma * c.t0K ** 4) / cSi ** 3; // kg m^-3
  const photons = rhoPhotons / rhoCritical;
  return photons * (1 + c.nEff * (7 / 8) * (4 / 11) ** (4 / 3));
}

const STEPS = 20_000;

/** Simpson over u = sqrt(a) from sqrt(aFrom) to 1 of `f(a) * 2u`, f in a. */
function integrate(aFrom: number, f: (a: number) => number): number {
  const u0 = Math.sqrt(Math.max(0, aFrom));
  const h = (1 - u0) / STEPS;
  let sum = 0;
  for (let i = 0; i <= STEPS; i += 1) {
    const u = u0 + i * h;
    const weight = i === 0 || i === STEPS ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * f(u * u) * 2 * u;
  }
  return (sum * h) / 3;
}

function shares(c: Cosmology): { r: number; m: number; l: number } {
  const r = omegaRadiation(c);
  return { r, m: c.omegaM, l: 1 - c.omegaM - r };
}

/** The Hubble distance c / H0, Mpc. */
export function hubbleDistanceMpc(c: Cosmology = PLANCK18): number {
  return SPEED_OF_LIGHT_KM_S / c.h0;
}

/** The Hubble time 1 / H0, billions of years. */
export function hubbleTimeGyr(c: Cosmology = PLANCK18): number {
  return MPC_KM / c.h0 / YEAR_S / 1e9;
}

/** Comoving distance to redshift z, Mpc; z = Infinity is the particle horizon. */
export function comovingDistanceMpc(z: number, c: Cosmology = PLANCK18): number {
  const { r, m, l } = shares(c);
  const aFrom = Number.isFinite(z) ? 1 / (1 + z) : 0;
  // da / (a^2 E) = da / sqrt(r + m a + l a^4).
  return hubbleDistanceMpc(c) * integrate(aFrom, (a) => 1 / Math.sqrt(r + m * a + l * a ** 4));
}

/** How long ago light from redshift z left, billions of years; z = Infinity is the age. */
export function lookbackTimeGyr(z: number, c: Cosmology = PLANCK18): number {
  const { r, m, l } = shares(c);
  const aFrom = Number.isFinite(z) ? 1 / (1 + z) : 0;
  // da / (a E) = a da / sqrt(r + m a + l a^4).
  return hubbleTimeGyr(c) * integrate(aFrom, (a) => a / Math.sqrt(r + m * a + l * a ** 4));
}

/**
 * Both integrals at once, comoving distance's and lookback time's, Mpc and billions of years:
 * one pass, one square root a step for the two -- each sum made with exactly the operations
 * comovingDistanceMpc and lookbackTimeGyr make it with, so the same numbers to the bit.
 */
function distanceAndLookback(z: number, c: Cosmology): { readonly comovingMpc: number; readonly lookbackGyr: number } {
  const { r, m, l } = shares(c);
  const aFrom = Number.isFinite(z) ? 1 / (1 + z) : 0;
  const u0 = Math.sqrt(Math.max(0, aFrom));
  const h = (1 - u0) / STEPS;
  let distance = 0;
  let lookback = 0;
  for (let i = 0; i <= STEPS; i += 1) {
    const u = u0 + i * h;
    const weight = i === 0 || i === STEPS ? 1 : i % 2 === 1 ? 4 : 2;
    const a = u * u;
    const root = Math.sqrt(r + m * a + l * a ** 4);
    distance += weight * (1 / root) * 2 * u;
    lookback += weight * (a / root) * 2 * u;
  }
  return {
    comovingMpc: hubbleDistanceMpc(c) * ((distance * h) / 3),
    lookbackGyr: hubbleTimeGyr(c) * ((lookback * h) / 3),
  };
}

/** Each cosmology's age, worked out once: it is every redshift's `ageAtEmissionGyr`. */
const ages = new WeakMap<Cosmology, number>();

/** The universe's age today, billions of years. */
export function ageGyr(c: Cosmology = PLANCK18): number {
  let age = ages.get(c);
  if (age === undefined) {
    age = lookbackTimeGyr(Infinity, c);
    ages.set(c, age);
  }
  return age;
}

/**
 * The comoving distance to the cosmic event horizon, Mpc: the farthest place light sent today
 * will ever reach, with a cosmological constant -- the integral from a = 1 to infinity of
 * da / (a^2 E(a)), which with b = 1 / a is the integral from 0 to 1 of db / E(1 / b).
 */
export function eventHorizonMpc(c: Cosmology = PLANCK18): number {
  const { r, m, l } = shares(c);
  // integral from b = 0 to 1 of db / sqrt(r b^4 + m b^3 + l), Simpson in b: smooth throughout.
  const h = 1 / STEPS;
  let sum = 0;
  for (let i = 0; i <= STEPS; i += 1) {
    const b = i * h;
    const weight = i === 0 || i === STEPS ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight / Math.sqrt(r * b ** 4 + m * b ** 3 + l);
  }
  return hubbleDistanceMpc(c) * ((sum * h) / 3);
}

/** Mpc to light years, and to km. */
export function mpcToLy(mpc: number): number {
  return (mpc * MPC_KM) / LIGHT_YEAR_KM;
}
export function mpcToKm(mpc: number): number {
  return mpc * MPC_KM;
}

/**
 * The observable universe's radius, comoving, Mpc: the particle horizon. In Planck 2018, 14,180
 * Mpc, 46.2 billion light years; the CMB's sphere, 13,870 Mpc -- 45.3 billion -- just inside it.
 */
export const OBSERVABLE_RADIUS_MPC = comovingDistanceMpc(Infinity);

/** The last-scattering sphere's radius, comoving, Mpc (Z_LAST_SCATTERING, Planck 2018). */
export const LAST_SCATTERING_RADIUS_MPC = comovingDistanceMpc(Z_LAST_SCATTERING);

/** Everything a panel says of a redshift: its distances, Mpc and light years, and its times. */
export interface RedshiftDistances {
  readonly z: number;
  readonly comovingMpc: number;
  readonly comovingLy: number;
  /** Light-travel distance: the lookback time times c. */
  readonly lightTravelLy: number;
  /** Proper distance when the light left: comoving / (1 + z). */
  readonly properAtEmissionLy: number;
  readonly lookbackGyr: number;
  readonly ageAtEmissionGyr: number;
}

/**
 * Three integrals of 20,000 steps each it was, the age among them for every redshift: the
 * forty record-holders and landmarks took a tenth of a second (recordHolders.ts). Now one pass and
 * the age once, a third of that, and the same numbers.
 */
export function redshiftDistances(z: number, c: Cosmology = PLANCK18): RedshiftDistances {
  const { comovingMpc, lookbackGyr } = distanceAndLookback(z, c);
  return {
    z,
    comovingMpc,
    comovingLy: mpcToLy(comovingMpc),
    lightTravelLy: lookbackGyr * 1e9,
    properAtEmissionLy: mpcToLy(comovingMpc) / (1 + z),
    lookbackGyr,
    ageAtEmissionGyr: ageGyr(c) - lookbackGyr,
  };
}
