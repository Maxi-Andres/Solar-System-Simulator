import { phaseSpace } from '../stars/build3d.ts';
import { parseSexagesimalDegrees, parseSexagesimalHours } from '../stars/buildStarCatalog.ts';
import type { LocalGroupCatalog, LocalVolumeCatalog } from '../types.ts';
import { asuNumber, type AsuRow } from './asu.ts';
import { type LedaMatch, type LedaProbe, separationArcmin } from './hyperleda.ts';

/**
 * Beyond the Local Group: every galaxy of the Local Volume, out to about 11 Mpc, and the
 * Virgo Cluster's, at 16.5 Mpc and its clouds behind -- each on its sky position, at its
 * distance, with its brightness, colour, size and shape -- less the galaxies McConnachie's
 * catalogue (local-group.json) already draws.
 *
 * ## The catalogues
 *
 * - **The Updated Nearby Galaxy Catalog** (UNGC; Karachentsev, Makarov & Kaisina 2013, AJ
 *   145, 101): 869 galaxies with a distance under 11 Mpc or a Local Group velocity under
 *   600 km/s. Its "catalog" table gives each centre, Holmberg diameter a26 (to the 26.5
 *   B mag/arcsec^2 isophote) and axis ratio b/a, apparent B and the Galactic extinction A_B in
 *   front, de Vaucouleurs T type and dwarf class, heliocentric velocity, inclination, HI mass,
 *   the adopted distance and how it was measured, and its "main disturber" and tidal index.
 *   Its "table6" gives each measured distance's modulus and error.
 * - **The Extended Virgo Cluster Catalog** (EVCC; Kim et al. 2014, ApJS 215, 22): 1,589
 *   galaxies with cz < 3,000 km/s over 725 square degrees about Virgo, photometered by the
 *   authors on SDSS DR7 images (SExtractor AUTO magnitudes in ugriz, already corrected for
 *   the Galactic extinction in front by Schlegel et al. 1998's map, their section 3.2; and the
 *   r-band half-light radius R50). Membership by a spherical infall model (Praton &
 *   Schneider 1994): "certain" members lie inside its caustic in the velocity -- projected
 *   radius plane, "possible" ones outside it. **Only the certain members are kept**, 1,028 of
 *   the 1,589: Kim et al. say themselves that by definition the ones outside the caustic are
 *   not members, kept as "possible" only after the VCC's habit -- the W and M clouds, twice as
 *   far, are mostly such. A galaxy whose distance is not known to a factor of two is not
 *   drawn at the cluster's.
 * - **SBF distances** for the EVCC's early types the ACS Virgo Cluster Survey measured (Mei
 *   et al. 2007, ApJ 655, 144; 84 galaxies, 79 of them among the members kept), matched by VCC
 *   number.
 * - **HyperLEDA** (Makarov et al. 2014, A&A 570, A13) for the position angle of each, and the
 *   EVCC's axis ratios and inclinations (hyperleda.ts). Where it has no match, or cannot be
 *   reached, the position angle is null (and for the EVCC the axis ratio and inclination too);
 *   the renderer decides how to draw a galaxy whose orientation is not known. For the
 *   brightest it gives no position angle, RC3's or the 2MASS Large Galaxy Atlas's
 *   (POSITION_ANGLES).
 *
 * ## Who is left out
 *
 * - A UNGC galaxy McConnachie's catalogue lists (local-group.json draws it): the same object
 *   if its centre is within an arcminute of the other's; or within half its Holmberg diameter,
 *   or under the same name within a degree, with distances agreeing to a factor of 1.5 (the
 *   two place Fornax's centre 4.7' apart). M31 and the Milky Way too, which McConnachie does
 *   not list because the app draws them itself; and Segue 3, which is a star cluster.
 * - An EVCC galaxy the UNGC lists, or McConnachie: within half an arcminute, or a quarter of
 *   the UNGC's Holmberg diameter with velocities within 300 km/s. The UNGC's entry is kept:
 *   it has the measured distance (several "Virgo" galaxies at low velocity are in front of it,
 *   Karachentsev et al. 2014, ApJ 782, 4).
 *
 * ## Each column
 *
 * - **Name**: the UNGC's run together ("NGC0253", "UGCA086", "MESSIER081") spaced and without
 *   the padding zeros ("NGC 253", "UGCA 86"); a Messier object by its Messier number, with its
 *   NGC number among the other names; an EVCC galaxy by its NGC number, else its VCC number,
 *   else "EVCC n".
 * - **Distance**, UNGC: from table6's modulus where its method is the adopted one (two
 *   decimals of modulus, 1%, finer than the catalogue's distance to 10 kpc), its error from
 *   the modulus's; else the catalogue's own. The method is the UNGC's code: TRGB, Cep, SBF,
 *   TF, BS (brightest stars), txt (SBF-like texture), HB, RR, CMD, SN, FP, PNLF, geom -- each
 *   a measurement (an error past a magnitude, a typo, left out) -- or mem (its group's
 *   distance), h and h' (from its velocity by the Hubble law), which are estimates
 *   (distanceEstimated). EVCC: SBF where Mei et al.
 *   measured it; else "cluster": placed by the cluster's measured structure (virgoPlacement),
 *   distanceEstimated.
 * - **vMag**: total apparent V corrected for the Milky Way's extinction in front -- not for
 *   the galaxy's own dust, which is part of how it looks. UNGC: B less A_B, less a B-V for its
 *   type (templateColour, colourEstimated): the UNGC gives no V. (Behind the Milky Way's
 *   plane that correction is large -- A_B is 5.1 and 7.2 mag for Maffei 1 and 2 -- and these come out
 *   among the brightest, as they would be seen from outside the Galaxy.) EVCC: from its
 *   extinction-corrected g and r by Jester et al. 2005 (AJ 130, 873), for stars with
 *   R-I < 1.15: V = g - 0.59 (g-r) - 0.01, B-V = 0.98 (g-r) + 0.22. Measured
 *   (colourEstimated false); Jester's relations are fitted to stars, whose g-r range a galaxy's
 *   lies in.
 * - **colourIndex**: that B-V, corrected for the reddening in front, like V.
 * - **Half-light radius**, on the major axis. EVCC: R50 -- SExtractor's, in circular apertures
 *   -- divided by what a disc of its axis ratio shows in circles (circularHalfLightFraction)
 *   where HyperLEDA gives the axis ratio; left circular where it does not. UNGC: a fraction
 *   of the Holmberg radius, measured on the galaxies both catalogues hold
 *   (holmbergHalfLightRatio), halfLightEstimated.
 * - **Axis ratio**: the UNGC's b/a; the EVCC's from HyperLEDA's log r25. **Inclination**: the
 *   UNGC's; the EVCC's HyperLEDA's. **Position angle**: HyperLEDA's for both; where it gives
 *   none, for the brightest, RC3's or the 2MASS Large Galaxy Atlas's (POSITION_ANGLES).
 * - **Group**: UNGC, by its tidal links (ungcGroups): named for the most luminous galaxy it is
 *   bound to, through its main disturber and theirs; null in the field. EVCC: the Virgo
 *   substructure it lies in (virgoPlacement), or "Virgo" for the cluster's outskirts.
 * - **Position**: x, y, z by the same conversion the Local Group's use (phaseSpace), so the
 *   two files agree: ICRS rotated about its x axis by the IAU 1976 obliquity, parsecs.
 */

// ---------------------------------------------------------------------------------------
// Names

/** Messier's galaxies by NGC number: the ones the Local Volume and Virgo hold, and M31's. */
export const MESSIER_BY_NGC: Readonly<Record<number, number>> = {
  205: 110, 221: 32, 224: 31, 598: 33, 628: 74, 1068: 77, 3031: 81, 3034: 82, 3351: 95, 3368: 96, 3379: 105,
  3556: 108, 3623: 65, 3627: 66, 3992: 109, 4192: 98, 4254: 99, 4258: 106, 4303: 61, 4321: 100, 4374: 84,
  4382: 85, 4406: 86, 4472: 49, 4486: 87, 4501: 88, 4548: 91, 4552: 89, 4569: 90, 4579: 58, 4594: 104,
  4621: 59, 4649: 60, 4736: 94, 4826: 64, 5055: 63, 5194: 51, 5236: 83, 5457: 101,
};
const NGC_BY_MESSIER: Readonly<Record<number, number>> = Object.fromEntries(
  Object.entries(MESSIER_BY_NGC).map(([ngc, m]) => [m, Number(ngc)]),
);

/**
 * The names the brightest are known by, by their NGC or IC name -- the common names the
 * literature and the observing guides use (each a Messier object's too) -- and the radio
 * sources' short names, Cen A and Vir A, by which they are as often looked for.
 */
const POPULAR: Readonly<Record<string, readonly string[]>> = {
  'NGC 253': ['Sculptor Galaxy', 'Silver Coin Galaxy', 'Silver Dollar Galaxy'],
  'NGC 2683': ['UFO Galaxy'],
  'NGC 3031': ["Bode's Galaxy"],
  'NGC 3034': ['Cigar Galaxy'],
  'NGC 3115': ['Spindle Galaxy'],
  'NGC 4486': ['Virgo A', 'Vir A'],
  'NGC 4490': ['Cocoon Galaxy'],
  'NGC 4565': ['Needle Galaxy'],
  'NGC 4567': ['Siamese Twins'],
  'NGC 4568': ['Siamese Twins'],
  'NGC 4594': ['Sombrero Galaxy'],
  'NGC 4631': ['Whale Galaxy'],
  'NGC 4656': ['Hockey Stick Galaxy'],
  'NGC 4736': ["Cat's Eye Galaxy", "Croc's Eye Galaxy"],
  'NGC 4826': ['Black Eye Galaxy', 'Sleeping Beauty Galaxy', 'Evil Eye Galaxy'],
  'NGC 5055': ['Sunflower Galaxy'],
  'NGC 5128': ['Centaurus A', 'Cen A'],
  'NGC 5194': ['Whirlpool Galaxy'],
  'NGC 5236': ['Southern Pinwheel Galaxy'],
  'NGC 5457': ['Pinwheel Galaxy'],
  'NGC 6946': ['Fireworks Galaxy'],
  'IC 342': ['Hidden Galaxy'],
  'IC 2574': ["Coddington's Nebula"],
};

/** UNGC names that are not a designation and a number. */
const SPELLED: Readonly<Record<string, string>> = {
  HolmI: 'Holmberg I',
  HolmII: 'Holmberg II',
  HolmIV: 'Holmberg IV',
  HolmIX: 'Holmberg IX',
  Maffei1: 'Maffei 1',
  Maffei2: 'Maffei 2',
  Dw1: 'Dwingeloo 1',
  Dw2: 'Dwingeloo 2',
  CIRCINUS: 'Circinus Galaxy',
  'Milky Way': 'Milky Way',
};

/** The UNGC's name made readable, and its other names. */
export function ungcName(catalogueName: string): { name: string; otherNames: string[] } {
  const raw = catalogueName.trim();
  const messier = /^MESSIER0*(\d+)$/.exec(raw);
  if (messier !== null) {
    const m = Number(messier[1]);
    const ngc = NGC_BY_MESSIER[m];
    return { name: `M${m}`, otherNames: ngc === undefined ? [] : [`NGC ${ngc}`, ...(POPULAR[`NGC ${ngc}`] ?? [])] };
  }
  const spelled = SPELLED[raw];
  if (spelled !== undefined) {
    return { name: spelled, otherNames: [] };
  }
  const ngc = /^NGC0*(\d+)$/.exec(raw);
  if (ngc !== null) {
    const n = Number(ngc[1]);
    const m = MESSIER_BY_NGC[n];
    return m === undefined
      ? { name: `NGC ${n}`, otherNames: [...(POPULAR[`NGC ${n}`] ?? [])] }
      : { name: `M${m}`, otherNames: [`NGC ${n}`, ...(POPULAR[`NGC ${n}`] ?? [])] };
  }
  // A designation then a number: padding zeros off the first number, the rest as written.
  const designation = /^(UGCA|UGC|IC|DDO|KDG|KKH|KKR|KKs|KK|PGC|AGC|ESO|VCC|MCG|GR|LeG|BK|FS|MRK)\s*(\d+)(.*)$/.exec(raw);
  if (designation !== null) {
    const prefix = designation[1] === 'MRK' ? 'Mrk' : designation[1]!;
    const name = `${prefix} ${Number(designation[2])}${designation[3]}`;
    return { name, otherNames: [...(POPULAR[name] ?? [])] };
  }
  // "[CKT2009]d0926+70": the bracketed reference is the catalogue's, not the name.
  return { name: raw.replace(/^\[[^\]]+\]\s*/, ''), otherNames: [] };
}

/** An EVCC galaxy's name: its NGC (or Messier) name, else VCC, else EVCC; and the rest. */
export function evccName(evcc: number, vcc: number | null, ngcText: string): { name: string; otherNames: string[] } {
  const others: string[] = [];
  let name: string | null = null;
  const ngc = /^(\d+)([A-Z]?)$/.exec(ngcText.trim());
  if (ngc !== null) {
    const n = Number(ngc[1]);
    const m = ngc[2] === '' ? MESSIER_BY_NGC[n] : undefined;
    const ngcName = `NGC ${n}${ngc[2]}`;
    if (m === undefined) {
      name = ngcName;
    } else {
      name = `M${m}`;
      others.push(ngcName);
    }
    others.push(...(ngc[2] === '' ? (POPULAR[`NGC ${n}`] ?? []) : []));
  }
  if (vcc !== null) {
    if (name === null) {
      name = `VCC ${vcc}`;
    } else {
      others.push(`VCC ${vcc}`);
    }
  }
  if (name === null) {
    return { name: `EVCC ${evcc}`, otherNames: [] };
  }
  others.push(`EVCC ${evcc}`);
  return { name, otherNames: others };
}

// ---------------------------------------------------------------------------------------
// Colour and size, where they are not measured

/**
 * B-V by morphology, for the UNGC, which gives none (colourEstimated). The integrated colours
 * of galaxies of each Hubble type -- Fukugita, Shimasaku & Ichikawa 1995 (PASP 107, 945),
 * Table 3a, Johnson B-V: E 0.96, S0 0.85, Sab 0.78, Sbc 0.57, Scd 0.50 -- placed at the T types
 * their groups centre on (E -5, S0 -2, Sa-Sb 2, Sb-Sc 4, Sc-Sd 6) and interpolated in T. Their
 * Im colour, 0.27, is one spectrum (Kennicutt 1992's); the irregular end is instead the median
 * measured for the Local Group's irregulars, below.
 *
 * Dwarfs by the UNGC's dwarf class, from the colours Mateo 1998 (ARA&A 36, 435) lists for the
 * Local Group's dwarfs, Table 3's (B-V)_T less Table 2's E(B-V), the median of each kind:
 * spheroidals and dwarf ellipticals (Sph, dE; ten galaxies, M32 left out as a compact
 * elliptical) 0.72; irregulars (Ir, Im, BCD, Sm; thirteen) 0.47; transition types (Tr; four,
 * Mateo's dIrr/dSph) 0.59.
 */
const TYPE_COLOURS: readonly (readonly [number, number])[] = [
  [-5, 0.96],
  [-2, 0.85],
  [2, 0.78],
  [4, 0.57],
  [6, 0.5],
  [10, 0.47],
];
const DWARF_COLOURS: Readonly<Record<string, number>> = {
  Sph: 0.72,
  dE: 0.72,
  dEem: 0.72,
  dS0em: 0.72,
  S0em: 0.72,
  Tr: 0.59,
  Ir: 0.47,
  Im: 0.47,
  BCD: 0.47,
  Sm: 0.47,
};

export function templateColour(tType: number | null, dwarfClass: string): number | null {
  const dwarf = DWARF_COLOURS[dwarfClass];
  if (dwarf !== undefined) {
    return dwarf;
  }
  if (tType === null) {
    return null;
  }
  const first = TYPE_COLOURS[0]!;
  const last = TYPE_COLOURS[TYPE_COLOURS.length - 1]!;
  if (tType <= first[0]) {
    return first[1];
  }
  if (tType >= last[0]) {
    return last[1];
  }
  for (let i = 1; i < TYPE_COLOURS.length; i += 1) {
    const [t1, c1] = TYPE_COLOURS[i]!;
    const [t0, c0] = TYPE_COLOURS[i - 1]!;
    if (tType <= t1) {
      return c0 + ((c1 - c0) * (tType - t0)) / (t1 - t0);
    }
  }
  return last[1];
}

const circularFractions = new Map<number, number>();

/**
 * The half-light radius an exponential disc of axis ratio q shows in circular apertures, as a
 * fraction of its half-light radius along the major axis: 1 face on, 0.744 at q = 0.5, 0.57 at
 * q = 0.1 -- not sqrt(q), the elliptical-aperture answer, which an edge-on disc's circular
 * half-light radius is far from (a line of light still holds half its light within a
 * finite circle). Found by integrating the disc's light I0 exp(-sqrt(x^2 + (y/q)^2) / h) in
 * circles, in closed form along each direction and numerically about the centre, and
 * solving for the circle that holds half; kept to two decimals of q.
 *
 * SExtractor's R50, the EVCC's, is measured in circular apertures; the schema's half-light
 * radius is the major axis's, so EVCC radii are divided by this where the axis ratio is known.
 */
export function circularHalfLightFraction(axisRatio: number): number {
  const q = Math.min(1, Math.max(0.02, Math.round(axisRatio * 100) / 100));
  const cached = circularFractions.get(q);
  if (cached !== undefined) {
    return cached;
  }
  const steps = 360;
  const rates: number[] = [];
  for (let j = 0; j < steps; j += 1) {
    const phi = ((j + 0.5) * 2 * Math.PI) / steps;
    rates.push(Math.hypot(Math.cos(phi), Math.sin(phi) / q));
  }
  // Light within radius r (scale length 1): the sum over directions of
  // the integral of rho e^(-k rho) from 0 to r, (1 - e^(-kr)(1 + kr)) / k^2.
  const enclosed = (r: number) => rates.reduce((sum, k) => sum + (1 - Math.exp(-k * r) * (1 + k * r)) / (k * k), 0) * ((2 * Math.PI) / steps);
  const half = Math.PI * q;
  let lo = 0;
  let hi = 20;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (enclosed(mid) > half) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  const fraction = (lo + hi) / 2 / RE_PER_H;
  circularFractions.set(q, fraction);
  return fraction;
}

/** Half-light radius of an exponential disc over its scale length (Graham & Driver 2005, PASA 22, 118). */
const RE_PER_H = 1.678347;

/** An EVCC galaxy the UNGC also holds: its measured half-light radius against the UNGC's diameter. */
export interface HolmbergCalibrator {
  readonly name: string;
  readonly holmbergRadiusArcmin: number;
  readonly halfLightArcmin: number;
}

/**
 * The UNGC's half-light radii (halfLightEstimated): a fixed fraction of the Holmberg radius,
 * a26 / 2, the fraction measured here -- the median, over the galaxies both catalogues hold,
 * of the EVCC's half-light radius (made major-axis by the UNGC's axis ratio) over the UNGC's
 * Holmberg radius. On 2026-11-12, 29 galaxies, 0.53, scatter 0.17 dex (a factor of
 * 1.5) -- dwarfs and late spirals, as most of the UNGC is.
 *
 * An exponential disc fitted to each galaxy's Holmberg diameter and mean surface brightness
 * was tried first, and set aside: on the same 29 it came out 1.75 times too small, and once
 * that offset was taken out, no better than this fraction (0.17 dex either way) -- the dwarfs'
 * light falls faster than exponential at the Holmberg isophote (Sersic n < 1), so its surface
 * brightness says nothing the diameter does not. Fewer than ten calibrators means the tables
 * have changed under it: the run stops rather than guess.
 */
export function holmbergHalfLightRatio(calibrators: readonly HolmbergCalibrator[]): { ratio: number; scatterDex: number } {
  if (calibrators.length < 10) {
    throw new Error(`Only ${calibrators.length} galaxies in both the UNGC and the EVCC to calibrate the half-light radii on; expected about 29.`);
  }
  const ratios = calibrators.map((c) => c.halfLightArcmin / c.holmbergRadiusArcmin).sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const ratio = ratios.length % 2 === 1 ? ratios[mid]! : (ratios[mid - 1]! + ratios[mid]!) / 2;
  const scatterDex = Math.sqrt(ratios.reduce((sum, r) => sum + Math.log10(r / ratio) ** 2, 0) / ratios.length);
  return { ratio, scatterDex };
}

// ---------------------------------------------------------------------------------------
// Virgo's depth

/**
 * The cluster's substructures, as Boselli et al. 2014 (A&A 570, A69, Table 2) define them on
 * the sky after Binggeli et al. (1987, 1993) and Gavazzi et al. (1999): a centre, a radius and
 * a velocity range. A galaxy in two belongs to the smaller (their note). Each placed at its
 * measured distance:
 *
 * - **Virgo A** (about M87): 16.7 +- 0.2 Mpc, and **Virgo B** (about M49): 16.4 +- 0.2 Mpc --
 *   Mei et al. 2007's SBF distances of the two subclusters.
 * - **Virgo C** (about M60), and the **Low Velocity Cloud**: with cluster A, Gavazzi et al.
 *   1999 find; at the cluster's mean, 16.5 Mpc (Mei et al. 2007).
 * - **W' cloud** (about NGC 4365): 22.9 Mpc, the mean of the five W' galaxies Mei et al.
 *   measured (22.1-23.8 Mpc).
 * - **W and M clouds**: twice cluster A's distance, Gavazzi et al. 1999 find (by the H-band
 *   Tully-Fisher and Fundamental Plane relations); 2 x 16.7 = 33.4 Mpc on Mei's scale.
 */
export interface VirgoSubstructure {
  readonly name: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly radiusDeg: number;
  readonly minVelocity: number;
  readonly maxVelocity: number;
  readonly distanceMpc: number;
}

export const VIRGO_SUBSTRUCTURES: readonly VirgoSubstructure[] = [
  { name: 'Virgo A', raDeg: 187.71, decDeg: 12.39, radiusDeg: 2.692, minVelocity: -Infinity, maxVelocity: 3500, distanceMpc: 16.7 },
  { name: 'Virgo B', raDeg: 187.44, decDeg: 8.0, radiusDeg: 1.667, minVelocity: -Infinity, maxVelocity: 3500, distanceMpc: 16.4 },
  { name: 'Virgo C', raDeg: 190.85, decDeg: 11.45, radiusDeg: 0.7, minVelocity: -Infinity, maxVelocity: 3500, distanceMpc: 16.5 },
  { name: 'Virgo W', raDeg: 185.0, decDeg: 5.8, radiusDeg: 1.2, minVelocity: 1000, maxVelocity: 3500, distanceMpc: 33.4 },
  { name: "Virgo W'", raDeg: 186.0, decDeg: 7.2, radiusDeg: 0.8, minVelocity: -Infinity, maxVelocity: 2000, distanceMpc: 22.9 },
  { name: 'Virgo M', raDeg: 183.0, decDeg: 13.4, radiusDeg: 1.5, minVelocity: 1500, maxVelocity: 3500, distanceMpc: 33.4 },
  { name: 'Virgo LVC', raDeg: 184.0, decDeg: 13.4, radiusDeg: 1.5, minVelocity: -Infinity, maxVelocity: 400, distanceMpc: 16.5 },
];

/** M87, the cluster's centre (the UNGC's and NED's position). */
const M87 = { raDeg: 187.70593, decDeg: 12.39112 };
/** The cluster's mean distance, Mpc, and the rms scatter of its members' (Mei et al. 2007). */
export const VIRGO_DISTANCE_MPC = 16.5;
export const VIRGO_DEPTH_SIGMA_MPC = 0.6;
/** Virgo's zero-velocity radius, Mpc: 7.2 +- 0.7 (Karachentsev et al. 2014, ApJ 782, 4). */
export const VIRGO_ZERO_VELOCITY_MPC = 7.2;

/** The substructure a galaxy at this position and velocity belongs to, or null (the outskirts). */
export function virgoSubstructure(raDeg: number, decDeg: number, velocity: number | null): VirgoSubstructure | null {
  const containing = VIRGO_SUBSTRUCTURES.filter(
    (s) =>
      separationArcmin(raDeg, decDeg, s.raDeg, s.decDeg) / 60 < s.radiusDeg &&
      (velocity === null ? s.minVelocity === -Infinity : velocity > s.minVelocity && velocity < s.maxVelocity),
  );
  containing.sort((a, b) => a.radiusDeg - b.radiusDeg);
  return containing[0] ?? null;
}

/** FNV-1a: a name's 32-bit hash, the seed of its draw. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small, well-mixed generator; the same seed gives the same stream on every run. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal stream, by Box-Muller, seeded by a name. */
export function seededNormals(name: string): () => number {
  const next = generator(hash(name));
  return () => {
    const u = Math.max(next(), Number.MIN_VALUE);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
}

/**
 * Where along its line of sight a Virgo member with no distance of its own is put
 * (distanceMethod "cluster", distanceEstimated): in front of or behind its substructure's
 * distance by a draw from the cluster's measured depth -- a normal of sigma 0.6 Mpc, the rms
 * scatter of Mei et al. 2007's 79 members about the cluster's (their back-to-front depth,
 * +-2 sigma, 2.4 Mpc) -- seeded by its name, so every run puts it in the same place. One
 * distance for all would draw the cluster as a sheet seen edge on from the side.
 *
 * Outside every substructure, in the outskirts the EVCC reaches -- 3.5 virial radii -- the
 * centre is the cluster's mean distance and the depth grows with how far out it is seen:
 * sigma^2 = 0.6^2 + R^2 / 2, R its projected distance from M87. Kim et al.'s membership is a
 * spherical infall model, and in a sphere the line of sight's mean square offset is half
 * the projected one's (<z^2> = <x^2> = <R^2> / 2). Draws putting it past Virgo's
 * zero-velocity radius, 7.2 Mpc (Karachentsev et al. 2014), are drawn again: a member is
 * inside it by definition.
 *
 * The error given is that sigma.
 */
export function virgoPlacement(
  name: string,
  raDeg: number,
  decDeg: number,
  velocity: number | null,
): { distanceMpc: number; sigmaMpc: number; group: string } {
  const normal = seededNormals(name);
  const substructure = virgoSubstructure(raDeg, decDeg, velocity);
  if (substructure !== null) {
    return {
      distanceMpc: substructure.distanceMpc + VIRGO_DEPTH_SIGMA_MPC * normal(),
      sigmaMpc: VIRGO_DEPTH_SIGMA_MPC,
      group: substructure.name,
    };
  }
  const projected = VIRGO_DISTANCE_MPC * ((separationArcmin(raDeg, decDeg, M87.raDeg, M87.decDeg) / 60) * Math.PI) / 180;
  const sigma = Math.sqrt(VIRGO_DEPTH_SIGMA_MPC ** 2 + projected ** 2 / 2);
  const room = VIRGO_ZERO_VELOCITY_MPC ** 2 - projected ** 2;
  let offset = 0;
  if (room > 0) {
    for (let tries = 0; tries < 1000; tries += 1) {
      offset = sigma * normal();
      if (offset * offset <= room) {
        break;
      }
      offset = 0;
    }
  }
  return { distanceMpc: VIRGO_DISTANCE_MPC + offset, sigmaMpc: sigma, group: 'Virgo' };
}

// ---------------------------------------------------------------------------------------
// Selection

/** One galaxy as it will be written, before HyperLEDA's orientation is added. */
export interface Galaxy {
  readonly sample: 'ungc' | 'evcc';
  readonly name: string;
  readonly otherNames: readonly string[];
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distancePc: number;
  readonly distanceErrorPc: number | null;
  readonly distanceMethod: string;
  readonly distanceEstimated: boolean;
  readonly vMag: number | null;
  readonly colourIndex: number | null;
  readonly colourEstimated: boolean;
  readonly tType: number | null;
  readonly morphology: string | null;
  readonly diameterArcmin: number | null;
  /** UNGC: null until calibrated (withHolmbergHalfLight); EVCC: R50, circular, made major-axis once the axis ratio is known. */
  readonly halfLightArcmin: number | null;
  readonly halfLightEstimated: boolean;
  readonly axisRatio: number | null;
  readonly inclinationDeg: number | null;
  readonly radialVelocityKmS: number | null;
  readonly logHiMassSun: number | null;
  readonly group: string | null;
  /** The size HyperLEDA's D25 is checked against, arcmin. */
  readonly ledaSizeArcmin: number | null;
}

const ESTIMATED_METHODS = new Set(['mem', 'h', "h'"]);
const MODULUS_TO_FRACTION = Math.LN10 / 5;

const RC3_SYMBOLS: Readonly<Record<number, string>> = {
  [-5]: 'E', [-4]: 'E+', [-3]: 'S0-', [-2]: 'S0', [-1]: 'S0+', 0: 'S0/a', 1: 'Sa', 2: 'Sab', 3: 'Sb',
  4: 'Sbc', 5: 'Sc', 6: 'Scd', 7: 'Sd', 8: 'Sdm', 9: 'Sm', 10: 'Im',
};

/** A group's name: its principal's, Centaurus A by its own. */
function groupName(catalogueName: string): string {
  return catalogueName === 'NGC5128' ? 'Centaurus A' : ungcName(catalogueName).name;
}

/**
 * The group each UNGC galaxy is in, by the catalogue's names: null for one in the field.
 *
 * The UNGC gives each galaxy its main disturber -- the neighbour whose tide on it is
 * strongest -- and the tidal index Theta_1 of that tide, which Karachentsev et al. scale so
 * that Theta_1 > 0 is inside the neighbour's zero-velocity surface: bound to it. But the
 * disturber is not the group: M81's is M82, the Sombrero's an ultra-compact dwarf beside it.
 * So the links are followed -- each galaxy to its disturber while the tie is bound, until a
 * galaxy comes round again -- and the group is named for the most luminous galaxy on the way
 * (the UNGC's K-band luminosity): M81 for M81, M82 and their satellites. A galaxy that is
 * nobody's member but has members of its own (Theta_1 <= 0 itself, like NGC 253) heads its
 * own group. A disturber the UNGC does not hold names the group itself.
 */
export function ungcGroups(catalog: readonly AsuRow[]): Map<string, string | null> {
  const byName = new Map(catalog.map((row) => [row['Name']!, row]));
  const bound = (row: AsuRow): string | null => {
    const tidal = asuNumber(row, 'Ti1');
    const disturber = row['MD'] ?? '';
    return tidal !== null && tidal > 0 && disturber !== '' ? disturber : null;
  };
  const luminosity = (name: string) => {
    const row = byName.get(name);
    return row === undefined ? -Infinity : (asuNumber(row, 'KLum') ?? -Infinity);
  };
  const principal = new Map<string, string | null>();
  const heads = new Set<string>();
  for (const row of catalog) {
    const chain = [row['Name']!];
    let next = bound(row);
    while (next !== null && !chain.includes(next)) {
      chain.push(next);
      const nextRow = byName.get(next);
      next = nextRow === undefined ? null : bound(nextRow);
    }
    if (chain.length === 1) {
      principal.set(row['Name']!, null);
      continue;
    }
    // The most luminous on the way -- unless the way leaves the catalogue, whose disturber
    // beyond it then names the group.
    let head = chain[chain.length - 1]!;
    if (byName.has(head)) {
      for (const name of chain) {
        if (luminosity(name) > luminosity(head)) {
          head = name;
        }
      }
    }
    principal.set(row['Name']!, head);
    heads.add(head);
  }
  const groups = new Map<string, string | null>();
  for (const [name, head] of principal) {
    groups.set(name, head !== null ? groupName(head) : heads.has(name) ? groupName(name) : null);
  }
  return groups;
}

/** Is this UNGC galaxy one McConnachie's catalogue holds? Its index there, or -1. */
function inLocalGroup(
  name: string,
  raDeg: number,
  decDeg: number,
  distancePc: number | null,
  a26: number | null,
  lg: LocalGroupCatalog,
): number {
  for (let i = 0; i < lg.count; i += 1) {
    const separation = separationArcmin(raDeg, decDeg, lg.raDeg[i]!, lg.decDeg[i]!);
    if (separation < 1) {
      return i;
    }
    const ratio = distancePc === null ? Infinity : Math.max(distancePc / lg.distancePc[i]!, lg.distancePc[i]! / distancePc);
    const sameName = lg.name[i] === name || lg.otherNames[i]!.includes(name);
    if (sameName && separation < 60 && ratio < 1.5) {
      return i;
    }
    const near = separation < 0.5 * (a26 ?? 0);
    if (near && ratio < 1.5) {
      return i;
    }
  }
  return -1;
}

/** The app draws these itself; McConnachie's catalogue does not list them. */
const DRAWN_BY_THE_APP = new Set(['MESSIER031', 'Milky Way']);

/** Not a galaxy: Segue 3 is an old star cluster in the Milky Way's halo (Fadely et al. 2011, AJ 142, 88). */
const NOT_GALAXIES = new Set(['Segue 3']);

/**
 * A distance modulus's error past this is not one: the UNGC gives M51's (SN, V+12) as 24.23
 * mag, its modulus's own digits repeated. Such an error is left out (null).
 */
const MAX_MODULUS_ERROR = 1;

export interface UngcSelection {
  readonly galaxies: Galaxy[];
  readonly inLocalGroup: string[];
  readonly drawnByTheApp: string[];
  readonly notGalaxies: string[];
}

export function selectUngc(catalog: readonly AsuRow[], distances: readonly AsuRow[], lg: LocalGroupCatalog): UngcSelection {
  const moduli = new Map(distances.map((row) => [row['Name']!, row]));
  const galaxies: Galaxy[] = [];
  const matched: string[] = [];
  const drawn: string[] = [];
  const notGalaxies: string[] = [];
  const groups = ungcGroups(catalog);
  for (const row of catalog) {
    const catalogueName = row['Name']!;
    if (DRAWN_BY_THE_APP.has(catalogueName)) {
      drawn.push(catalogueName);
      continue;
    }
    if (NOT_GALAXIES.has(catalogueName)) {
      notGalaxies.push(catalogueName);
      continue;
    }
    const raDeg = parseSexagesimalHours(row['RAJ2000']!);
    const decDeg = parseSexagesimalDegrees(row['DEJ2000']!);
    const method = row['f_Dist']!;
    const adoptedMpc = asuNumber(row, 'Dist');
    if (adoptedMpc === null) {
      throw new Error(`The UNGC gives ${catalogueName} no distance.`);
    }
    const measured = moduli.get(catalogueName);
    const modulus = measured !== undefined && measured['n_DM'] === method ? asuNumber(measured, 'DM') : null;
    const quoted = modulus === null ? null : asuNumber(measured!, 'e_DM');
    const modulusError = quoted !== null && quoted < MAX_MODULUS_ERROR ? quoted : null;
    const distancePc = modulus === null ? adoptedMpc * 1e6 : 10 ** (1 + modulus / 5);
    const a26 = asuNumber(row, 'a26');
    if (inLocalGroup(ungcName(catalogueName).name, raDeg, decDeg, distancePc, a26, lg) >= 0) {
      matched.push(catalogueName);
      continue;
    }
    const axisRatio = asuNumber(row, 'b/a');
    const bMag = asuNumber(row, 'Bmag');
    const extinctionB = asuNumber(row, 'AB');
    const tType = asuNumber(row, 'TT');
    const dwarfClass = row['Mcl'] ?? '';
    const colour = templateColour(tType, dwarfClass);
    const vMag = bMag === null || extinctionB === null || colour === null ? null : bMag - extinctionB - colour;
    const hiLimit = row['l_MHI'] === '<';
    const { name, otherNames } = ungcName(catalogueName);
    galaxies.push({
      sample: 'ungc',
      name,
      otherNames,
      raDeg,
      decDeg,
      distancePc,
      distanceErrorPc: modulusError === null ? null : distancePc * MODULUS_TO_FRACTION * modulusError,
      distanceMethod: method,
      distanceEstimated: ESTIMATED_METHODS.has(method),
      vMag,
      colourIndex: colour,
      colourEstimated: true,
      tType,
      morphology: dwarfClass !== '' ? dwarfClass : tType === null ? null : (RC3_SYMBOLS[tType] ?? null),
      diameterArcmin: a26,
      halfLightArcmin: null,
      halfLightEstimated: true,
      axisRatio,
      inclinationDeg: asuNumber(row, 'i'),
      radialVelocityKmS: asuNumber(row, 'HRV'),
      logHiMassSun: hiLimit ? null : asuNumber(row, 'MHI'),
      group: groups.get(catalogueName) ?? null,
      ledaSizeArcmin: a26,
    });
  }
  return { galaxies, inLocalGroup: matched, drawnByTheApp: drawn, notGalaxies };
}

/** The EVCC's primary morphology as a T type (RC3's numbering; dwarfs as their giant kin). */
const EVCC_T_TYPES: Readonly<Record<string, number>> = {
  E: -5, dE: -5, 'dE(N)': -5, S0: -2, SB0: -2, dS0: -2, 'dS0(N)': -2, Sa: 1, SBa: 1, Sb: 3, SBb: 3,
  Sc: 5, SBc: 5, Sd: 7, SBd: 7, Sm: 9, SBm: 9, 'Irr(LSB)': 10, 'Irr(HSB)': 10,
};

/** Jester et al. 2005, Table 1, all stars with R-I < 1.15. */
export function johnsonFromSdss(g: number, r: number): { v: number; bv: number } {
  return { v: g - 0.59 * (g - r) - 0.01, bv: 0.98 * (g - r) + 0.22 };
}

export interface EvccSelection {
  readonly galaxies: Galaxy[];
  readonly possibleMembers: number;
  readonly inUngc: string[];
  /** The galaxies in both, with a Holmberg diameter: holmbergHalfLightRatio's calibrators. */
  readonly calibrators: HolmbergCalibrator[];
  readonly inLocalGroup: string[];
  readonly sbf: number;
}

export function selectEvcc(
  evcc: readonly AsuRow[],
  mei: readonly AsuRow[],
  ungc: readonly Galaxy[],
  lg: LocalGroupCatalog,
): EvccSelection {
  const sbfByVcc = new Map<number, { modulus: number; error: number | null }>();
  for (const row of mei) {
    const vcc = asuNumber(row, 'VCC');
    const modulus = asuNumber(row, 'm-M');
    if (vcc !== null && modulus !== null) {
      sbfByVcc.set(vcc, { modulus, error: asuNumber(row, 'e_m-M') });
    }
  }
  const galaxies: Galaxy[] = [];
  const inUngc: string[] = [];
  const calibrators: HolmbergCalibrator[] = [];
  const matchedLg: string[] = [];
  let possible = 0;
  let sbf = 0;
  for (const row of evcc) {
    if (row['MmI'] !== 'M') {
      possible += 1;
      continue;
    }
    const id = asuNumber(row, 'EVCC')!;
    const vcc = asuNumber(row, 'VCC');
    const { name, otherNames } = evccName(id, vcc, row['NGC'] ?? '');
    const raDeg = asuNumber(row, 'RAJ2000')!;
    const decDeg = asuNumber(row, 'DEJ2000')!;
    const velocity = asuNumber(row, 'cz') ?? asuNumber(row, 'cz2');
    const twin = ungc.find((u) => {
      const separation = separationArcmin(raDeg, decDeg, u.raDeg, u.decDeg);
      const sameVelocity = velocity === null || u.radialVelocityKmS === null || Math.abs(velocity - u.radialVelocityKmS) < 300;
      return separation < 0.5 || (separation < 0.25 * (u.diameterArcmin ?? 0) && sameVelocity);
    });
    if (twin !== undefined) {
      inUngc.push(`${name} = ${twin.name}`);
      const r50 = asuNumber(row, 'R50');
      if (twin.diameterArcmin !== null && r50 !== null) {
        const fraction = twin.axisRatio === null ? 1 : circularHalfLightFraction(twin.axisRatio);
        calibrators.push({ name: twin.name, holmbergRadiusArcmin: twin.diameterArcmin / 2, halfLightArcmin: r50 / 60 / fraction });
      }
      continue;
    }
    if (lg.raDeg.some((ra, i) => separationArcmin(raDeg, decDeg, ra, lg.decDeg[i]!) < 0.5)) {
      matchedLg.push(name);
      continue;
    }
    const measured = vcc === null ? undefined : sbfByVcc.get(vcc);
    const placed = virgoPlacement(name, raDeg, decDeg, velocity);
    let distancePc: number;
    let distanceErrorPc: number | null;
    if (measured !== undefined) {
      sbf += 1;
      distancePc = 10 ** (1 + measured.modulus / 5);
      distanceErrorPc = measured.error === null ? null : distancePc * MODULUS_TO_FRACTION * measured.error;
    } else {
      distancePc = placed.distanceMpc * 1e6;
      distanceErrorPc = placed.sigmaMpc * 1e6;
    }
    const g = asuNumber(row, 'gmag');
    const r = asuNumber(row, 'rmag');
    const johnson = g === null || r === null ? null : johnsonFromSdss(g, r);
    const r50 = asuNumber(row, 'R50');
    const morphology = row['MTyp1'] === '' ? null : (row['MTyp1'] ?? null);
    galaxies.push({
      sample: 'evcc',
      name,
      otherNames,
      raDeg,
      decDeg,
      distancePc,
      distanceErrorPc,
      distanceMethod: measured === undefined ? 'cluster' : 'SBF',
      distanceEstimated: measured === undefined,
      vMag: johnson?.v ?? null,
      colourIndex: johnson?.bv ?? null,
      colourEstimated: false,
      tType: morphology === null ? null : (EVCC_T_TYPES[morphology] ?? null),
      morphology,
      diameterArcmin: null,
      halfLightArcmin: r50 === null ? null : r50 / 60,
      halfLightEstimated: false,
      axisRatio: null,
      inclinationDeg: null,
      radialVelocityKmS: velocity,
      logHiMassSun: null,
      group: placed.group,
      // About three half-light radii make a D25 (an exponential disc of typical central
      // surface brightness reaches 25 mag/arcsec^2 at 1.8 Re).
      ledaSizeArcmin: r50 === null ? null : (3 * r50) / 60,
    });
  }
  return { galaxies, possibleMembers: possible, inUngc, calibrators, inLocalGroup: matchedLg, sbf };
}

/** The UNGC's galaxies with their half-light radii: `ratio` of the Holmberg radius. */
export function withHolmbergHalfLight(galaxies: readonly Galaxy[], ratio: number): Galaxy[] {
  return galaxies.map((galaxy) => ({
    ...galaxy,
    halfLightArcmin: galaxy.diameterArcmin === null ? null : (ratio * galaxy.diameterArcmin) / 2,
  }));
}

export function ledaProbe(galaxy: Galaxy): LedaProbe {
  return { raDeg: galaxy.raDeg, decDeg: galaxy.decDeg, sizeArcmin: galaxy.ledaSizeArcmin, names: [galaxy.name, ...galaxy.otherNames] };
}

// ---------------------------------------------------------------------------------------
// The catalogue

/**
 * Position angles, degrees east of north, for the brightest galaxies HyperLEDA gives none
 * (hyperleda.ts): every one brighter than V 10.5 left without, nearly all of them nearly face
 * on, where the major axis is ill-defined and measurements disagree (M74's: RC3 25, the LGA 70)
 * -- so the shape it gives a nearly round galaxy is slight either way, but the direction is a
 * measured one. Taken, in this order, from:
 *
 * - **RC3**, the Third Reference Catalogue of Bright Galaxies (de Vaucouleurs et al. 1991;
 *   VizieR VII/155, column PA): the D25 isophote's, in B, as HyperLEDA's are.
 * - **The 2MASS Large Galaxy Atlas** (Jarrett et al. 2003, AJ 125, 525; IRSA's lga_v2, column
 *   sup_pa): the major axis of the co-added J+H+Ks image, which sees through the dust that
 *   hides Maffei 2 in B. Its angles run -90 to 90; made 0-180 here.
 *
 * Each found by the galaxy's position (within 2' in RC3, 3' in the LGA), on 2026-11-12. NGC 404
 * and IC 5332 are left without: the LGA finds them round (b/a 1.00), with no major axis to
 * measure, and RC3 gives none; HIZSS008, Cas 1 and NGC 4624 are in neither. A name here the
 * catalogue no longer holds is reported by describeLocalVolume.
 */
export const POSITION_ANGLES: Readonly<Record<string, { readonly deg: number; readonly source: 'RC3' | '2MASS LGA' }>> = {
  'IC 342': { deg: 10, source: '2MASS LGA' },
  'Maffei 2': { deg: 30, source: '2MASS LGA' },
  M83: { deg: 47.5, source: '2MASS LGA' },
  'Maffei 1': { deg: 100, source: 'RC3' },
  'NGC 6946': { deg: 70, source: '2MASS LGA' },
  M101: { deg: 28.5, source: '2MASS LGA' },
  M87: { deg: 157.5, source: '2MASS LGA' },
  M74: { deg: 25, source: 'RC3' },
  M85: { deg: 10, source: '2MASS LGA' },
  M100: { deg: 30, source: 'RC3' },
  'NGC 5068': { deg: 110, source: 'RC3' },
  'NGC 4214': { deg: 120, source: '2MASS LGA' },
  'NGC 3344': { deg: 172.5, source: '2MASS LGA' },
  'NGC 3184': { deg: 135, source: 'RC3' },
  M99: { deg: 28.5, source: '2MASS LGA' },
  M89: { deg: 150, source: '2MASS LGA' },
};

const round = (value: number, digits: number): number => Number(value.toFixed(digits));
const roundOrNull = (value: number | null, digits: number): number | null => (value === null ? null : round(value, digits));

export interface LocalVolumeParts {
  readonly ungc: readonly Galaxy[];
  readonly evcc: readonly Galaxy[];
  /** HyperLEDA's match for each, in the same order; null throughout if it was not reached. */
  readonly ledaUngc: readonly (LedaMatch | null)[] | null;
  readonly ledaEvcc: readonly (LedaMatch | null)[] | null;
  readonly sources: LocalVolumeCatalog['sources'];
}

export function buildLocalVolume(parts: LocalVolumeParts): LocalVolumeCatalog {
  const oriented = [
    ...parts.ungc.map((galaxy, i) => ({ galaxy, leda: parts.ledaUngc?.[i] ?? null })),
    ...parts.evcc.map((galaxy, i) => ({ galaxy, leda: parts.ledaEvcc?.[i] ?? null })),
  ].map(({ galaxy, leda }) => {
    const positionAngleDeg = leda?.positionAngleDeg ?? POSITION_ANGLES[galaxy.name]?.deg ?? null;
    if (galaxy.sample === 'ungc') {
      return { ...galaxy, positionAngleDeg };
    }
    const axisRatio = leda?.axisRatio ?? null;
    return {
      ...galaxy,
      axisRatio,
      inclinationDeg: leda?.inclinationDeg ?? null,
      positionAngleDeg,
      halfLightArcmin:
        galaxy.halfLightArcmin === null || axisRatio === null ? galaxy.halfLightArcmin : galaxy.halfLightArcmin / circularHalfLightFraction(axisRatio),
    };
  });
  const positions = oriented.map((g) => phaseSpace(g.raDeg, g.decDeg, 1000 / g.distancePc, 0, 0, 0).position);
  return {
    sources: parts.sources,
    frame: 'Heliocentric; ICRS rotated about its x axis by the IAU 1976 obliquity, 84381.448": the scene frame.',
    count: oriented.length,
    sample: oriented.map((g) => g.sample),
    name: oriented.map((g) => g.name),
    otherNames: oriented.map((g) => g.otherNames),
    raDeg: oriented.map((g) => round(g.raDeg, 5)),
    decDeg: oriented.map((g) => round(g.decDeg, 5)),
    x: positions.map((p) => Math.round(p[0])),
    y: positions.map((p) => Math.round(p[1])),
    z: positions.map((p) => Math.round(p[2])),
    distancePc: oriented.map((g) => Math.round(g.distancePc)),
    distanceErrorPc: oriented.map((g) => (g.distanceErrorPc === null ? null : Math.round(g.distanceErrorPc))),
    distanceMethod: oriented.map((g) => g.distanceMethod),
    distanceEstimated: oriented.map((g) => g.distanceEstimated),
    vMag: oriented.map((g) => roundOrNull(g.vMag, 2)),
    colourIndex: oriented.map((g) => roundOrNull(g.colourIndex, 2)),
    colourEstimated: oriented.map((g) => g.colourEstimated),
    tType: oriented.map((g) => g.tType),
    morphology: oriented.map((g) => g.morphology),
    diameterArcmin: oriented.map((g) => roundOrNull(g.diameterArcmin, 2)),
    halfLightArcmin: oriented.map((g) => roundOrNull(g.halfLightArcmin, 3)),
    halfLightEstimated: oriented.map((g) => g.halfLightEstimated),
    axisRatio: oriented.map((g) => roundOrNull(g.axisRatio, 2)),
    inclinationDeg: oriented.map((g) => roundOrNull(g.inclinationDeg, 0)),
    positionAngleDeg: oriented.map((g) => roundOrNull(g.positionAngleDeg, 1)),
    radialVelocityKmS: oriented.map((g) => roundOrNull(g.radialVelocityKmS, 0)),
    logHiMassSun: oriented.map((g) => roundOrNull(g.logHiMassSun, 2)),
    group: oriented.map((g) => g.group),
  };
}

// ---------------------------------------------------------------------------------------
// The summary

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const at = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[at]!;
}

export function describeLocalVolume(catalog: LocalVolumeCatalog): string[] {
  const indices = (sample: 'ungc' | 'evcc') => catalog.sample.flatMap((s, i) => (s === sample ? [i] : []));
  const count = <T>(values: readonly T[], keep: readonly number[], test: (value: T) => boolean) =>
    keep.filter((i) => test(values[i]!)).length;
  const lines: string[] = [];
  for (const sample of ['ungc', 'evcc'] as const) {
    const keep = indices(sample);
    const methods = new Map<string, number>();
    for (const i of keep) {
      methods.set(catalog.distanceMethod[i]!, (methods.get(catalog.distanceMethod[i]!) ?? 0) + 1);
    }
    const byMethod = [...methods].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(', ');
    lines.push(
      `[local-volume] ${sample.toUpperCase()}: ${keep.length} galaxies; distances ${byMethod}; ` +
        `${count(catalog.distanceEstimated, keep, Boolean)} estimated. ` +
        `PA ${count(catalog.positionAngleDeg, keep, (v) => v !== null)}, axis ratio ${count(catalog.axisRatio, keep, (v) => v !== null)}, ` +
        `V ${count(catalog.vMag, keep, (v) => v !== null)}, measured colour ${count(catalog.colourEstimated, keep, (v) => !v)}, ` +
        `half-light ${count(catalog.halfLightArcmin, keep, (v) => v !== null)} (${count(catalog.halfLightEstimated, keep, Boolean)} estimated).`,
    );
  }
  const brightest = catalog.vMag
    .map((v, i) => ({ v, i }))
    .filter((e): e is { v: number; i: number } => e.v !== null)
    .sort((a, b) => a.v - b.v)
    .slice(0, 10)
    .map(({ v, i }) => `${catalog.name[i]} ${v.toFixed(2)}`)
    .join(', ');
  lines.push(`[local-volume] brightest in V: ${brightest}.`);
  const named = new Set(catalog.name);
  const unused = Object.keys(POSITION_ANGLES).filter((name) => !named.has(name));
  lines.push(
    `[local-volume] position angles from RC3 or the 2MASS LGA where HyperLEDA gives none: ` +
      `${Object.keys(POSITION_ANGLES).length - unused.length}` +
      (unused.length === 0 ? '.' : `; not in the catalogue, so not used: ${unused.join(', ')}.`),
  );
  const virgo = indices('evcc');
  const groups = new Map<string, number[]>();
  for (const i of virgo) {
    const list = groups.get(catalog.group[i] ?? '') ?? [];
    list.push(catalog.distancePc[i]! / 1e6);
    groups.set(catalog.group[i] ?? '', list);
  }
  const spread = [...groups]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([group, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      return `${group} ${list.length} (${percentile(sorted, 0.05).toFixed(1)}-${percentile(sorted, 0.5).toFixed(1)}-${percentile(sorted, 0.95).toFixed(1)} Mpc)`;
    })
    .join(', ');
  lines.push(`[local-volume] Virgo by substructure, distance 5th-50th-95th percentile: ${spread}.`);
  return lines;
}
