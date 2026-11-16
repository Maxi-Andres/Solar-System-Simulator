import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import { SGR_A_DISTANCE_PC, SGR_A_REFERENCE } from './blackHoles.ts';
import { NOTABLE_STAR_PREFIX, registerDeepSky } from './deepSky.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { GAIA_ZERO_POINT_MAS } from './messier.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector } from './vec3.ts';
import type { FramingRequest } from '../state/store.ts';

/**
 * Named stars, stellar black holes and young clusters the star catalogue does not place --
 * too faint for it, too far, missing from Gaia, or with no parallax it can use -- each a mark
 * at a measured distance, in the Notable Stars layer: bodies of kind 'deep-sky', as the
 * Messier marks are (messier.ts), found by search and gone to.
 *
 * ## Where and how far
 *
 * Positions are SIMBAD's (J2000), or the paper's where SIMBAD's is not the object's own.
 * Distances, each from its own measurement, named in its panel: a Gaia DR3 parallax with
 * Gaia's zero-point, -0.017 mas, taken off (Lindegren et al. 2021), where Gaia's solution is
 * sound (RUWE under 1.4, or under 2 for a binary it is known to be); a radio parallax of a
 * maser or a jet (VY CMa, V404 Cyg, GRS 1915+105); a ground-based parallax (Luhman 16,
 * WISE 0855); the Large Magellanic Cloud's, the Galactic Centre's or a globular cluster's for
 * what is in one. Those that move fast across the sky -- the brown dwarfs, the white dwarfs,
 * HD 140283 -- move as the catalogue's stars do, along their proper motion and radial velocity
 * from J2000; the rest stand still, as nothing of theirs would show in centuries.
 *
 * ## Not drawn
 *
 * Their size, light and colour: a mark, not a star (the catalogue's stars are drawn by their
 * light). Procyon B is marked at Procyon A's place -- they are 5″ apart -- and no orbit of
 * either is drawn. Left out, with no distance that holds (SKIPPED): μ Cephei, ρ Cassiopeiae,
 * WR 104 and the G-cloud.
 */

export interface NotableStar {
  readonly key: string;
  readonly name: string;
  readonly aliases: readonly string[];
  /** What it is: "Brown dwarf pair", "Stellar black hole". */
  readonly type: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly positionSource: string;
  readonly distancePc: number;
  /** Up and down, pc; null where only a systematic error is known. */
  readonly distanceUpPc: number | null;
  readonly distanceDownPc: number | null;
  /** The parallax it is from, mas, as published (before any zero-point); null for another method. */
  readonly parallaxMas: number | null;
  readonly distanceMethod: string;
  readonly distanceReference: string;
  /** Its motion, mas/yr and km/s, for those that move fast enough to matter; null to stand still. */
  readonly motion: { readonly pmRa: number; readonly pmDec: number; readonly rv: number } | null;
  readonly note: string | null;
}

const SIMBAD = 'SIMBAD (CDS)';
const GAIA_DR3 = 'Gaia DR3 (Gaia Collaboration 2023)';
const GAIA_METHOD = 'its Gaia DR3 parallax, zero-point corrected';

/** A distance from a parallax and its error, mas: its inverse, and the range the error spans. */
function fromParallax(mas: number, error: number): Pick<NotableStar, 'distancePc' | 'distanceUpPc' | 'distanceDownPc'> {
  const d = 1000 / mas;
  return {
    distancePc: d,
    distanceUpPc: 1000 / (mas - error) - d,
    distanceDownPc: d - 1000 / (mas + error),
  };
}

/** A Gaia DR3 parallax, the zero-point taken off first. */
function gaia(mas: number, error: number): Pick<NotableStar, 'distancePc' | 'distanceUpPc' | 'distanceDownPc' | 'parallaxMas' | 'distanceMethod' | 'distanceReference'> {
  return {
    ...fromParallax(mas - GAIA_ZERO_POINT_MAS, error),
    parallaxMas: mas,
    distanceMethod: GAIA_METHOD,
    distanceReference: GAIA_DR3,
  };
}

/** Where the Galactic Centre's stars are: Sgr A*'s distance (blackHoles.ts). */
const galacticCentre = (member: string): Pick<NotableStar, 'distancePc' | 'distanceUpPc' | 'distanceDownPc' | 'parallaxMas' | 'distanceMethod' | 'distanceReference'> => ({
  distancePc: SGR_A_DISTANCE_PC,
  distanceUpPc: null,
  distanceDownPc: null,
  parallaxMas: null,
  distanceMethod: `the Galactic Centre’s, as ${member}: its depth there not measured`,
  distanceReference: SGR_A_REFERENCE,
});

export const NOTABLE_STARS: readonly NotableStar[] = [
  // --- Near ones the catalogue lacks -------------------------------------------------------
  {
    key: 'luhman-16',
    name: 'Luhman 16',
    aliases: ['Luhman 16 AB', 'WISE J104915.57-531906.1', 'WISE 1049-5319'],
    type: 'Brown dwarf pair',
    raDeg: 162.328814,
    decDeg: -53.319466,
    positionSource: `${SIMBAD}, from 2MASS`,
    ...fromParallax(501.557, 0.082),
    parallaxMas: 501.557,
    distanceMethod: 'its parallax, from ground-based imaging (FORS2, VLT)',
    distanceReference: 'Lazorenko & Sahlmann 2018, A&A 618, A111',
    motion: { pmRa: -2767.502, pmDec: 356.856, rv: 0 },
    note: 'The nearest brown dwarfs: two, about 3 AU apart, marked as one. Gaia has no parallax for them.',
  },
  {
    key: 'wise-0855',
    name: 'WISE 0855−0714',
    aliases: ['WISE J085510.83-071442.5', 'WISE 0855', 'WISEA J085510.74-071442.5'],
    type: 'Brown dwarf',
    raDeg: 133.81890825,
    decDeg: -7.247048,
    positionSource: `${SIMBAD}, from Kirkpatrick et al. 2021`,
    ...fromParallax(439.0, 2.4),
    parallaxMas: 439.0,
    distanceMethod: 'its Spitzer parallax',
    distanceReference: 'Kirkpatrick et al. 2021, ApJS 253, 7',
    motion: { pmRa: -8123.7, pmDec: 673.2, rv: 0 },
    note: 'The coldest brown dwarf known, near water’s freezing point. Too faint for Gaia.',
  },
  {
    key: 'procyon-b',
    name: 'Procyon B',
    aliases: ['α CMi B', 'alf CMi B', 'Alpha Canis Minoris B'],
    type: 'White dwarf',
    raDeg: 114.82549790798149,
    decDeg: 5.224987557059477,
    positionSource: `Procyon A’s (${SIMBAD}, Hipparcos)`,
    ...fromParallax(284.56, 1.26),
    parallaxMas: 284.56,
    distanceMethod: 'Procyon A’s Hipparcos parallax',
    distanceReference: 'van Leeuwen 2007, A&A 474, 653',
    motion: { pmRa: -714.59, pmDec: -1036.8, rv: -4.5 },
    note: 'Marked at Procyon A’s place: they are 5″ apart, on a 40.8-year orbit not drawn. Gaia does not measure it.',
  },
  {
    key: '40-eri-b',
    name: '40 Eridani B',
    aliases: ['ο² Eridani B', 'omi02 Eri B', '40 Eri B', 'Keid B'],
    type: 'White dwarf',
    raDeg: 63.84081549227875,
    decDeg: -7.658112218552501,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(199.6911, 0.0512),
    motion: { pmRa: -2236.169, pmDec: -3338.955, rv: -21.0 },
    note: 'The first white dwarf recognised, in 1910.',
  },
  // --- Extreme stars -----------------------------------------------------------------------
  {
    key: 'uy-sct',
    name: 'UY Scuti',
    aliases: ['UY Sct', 'BD-12 5055'],
    type: 'Red supergiant',
    raDeg: 276.90220071786,
    decDeg: -12.46636071492,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(0.5166, 0.0494),
    motion: null,
    note: 'Among the largest stars known; how large hangs on its distance.',
  },
  {
    key: 'vy-cma',
    name: 'VY Canis Majoris',
    aliases: ['VY CMa'],
    type: 'Red hypergiant',
    raDeg: 110.74302556341208,
    decDeg: -25.76755399738722,
    positionSource: `${SIMBAD}, from Gaia`,
    ...fromParallax(0.83, 0.08),
    parallaxMas: 0.83,
    distanceMethod: 'the VLBA parallax of its SiO masers',
    distanceReference: 'Zhang et al. 2012, ApJ 744, 23',
    motion: null,
    note: 'Gaia’s parallax, 0.42 ± 0.41 mas, is spoiled by its dusty envelope (RUWE 14).',
  },
  {
    key: 'r136a1',
    name: 'R136a1',
    aliases: ['RMC 136a1', 'BAT99 108'],
    type: 'Wolf–Rayet star',
    raDeg: 84.67665,
    decDeg: -69.10079722222221,
    positionSource: `${SIMBAD}, from Brands et al. 2022`,
    distancePc: 49590,
    distanceUpPc: 540,
    distanceDownPc: 540,
    parallaxMas: null,
    distanceMethod: 'the Large Magellanic Cloud’s, from eclipsing binaries',
    distanceReference: 'Pietrzyński et al. 2019, Nature 567, 200',
    motion: null,
    note: 'The most massive star known, near 200 solar masses, in the Tarantula Nebula’s core.',
  },
  {
    key: 'pistol-star',
    name: 'Pistol Star',
    aliases: ['V4647 Sgr', '[FMM95] 3'],
    type: 'Luminous blue variable',
    raDeg: 266.5635,
    decDeg: -28.834327777777776,
    positionSource: SIMBAD,
    ...galacticCentre('a member of the Quintuplet cluster'),
    motion: null,
    note: 'Hidden from us in visible light by the dust toward the Galactic Centre; seen in the infrared.',
  },
  {
    key: 'p-cyg',
    name: 'P Cygni',
    aliases: ['P Cyg', '34 Cyg', 'HD 193237'],
    type: 'Luminous blue variable',
    raDeg: 304.4466748889121,
    decDeg: 38.03293031463083,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(0.6251, 0.0729),
    motion: null,
    note: 'Flared to third magnitude in 1600, unseen before.',
  },
  {
    key: 'ag-car',
    name: 'AG Carinae',
    aliases: ['AG Car', 'HD 94910'],
    type: 'Luminous blue variable',
    raDeg: 164.04824225602,
    decDeg: -60.45355852034999,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(0.1925, 0.0165),
    motion: null,
    note: null,
  },
  {
    key: 'wr-140',
    name: 'WR 140',
    aliases: ['HD 193793', 'V1687 Cyg'],
    type: 'Wolf–Rayet binary',
    raDeg: 305.11656579529,
    decDeg: 43.85452412229001,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(0.5378, 0.0237),
    motion: null,
    note: 'Its colliding winds make a shell of dust every 7.9 years, at each close pass.',
  },
  {
    key: 'hd-140283',
    name: 'HD 140283',
    aliases: ['Methuselah star', 'Methuselah'],
    type: 'Metal-poor subgiant',
    raDeg: 235.76290466259124,
    decDeg: -10.933498803663333,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(16.2672, 0.026),
    motion: { pmRa: -1115.141, pmDec: -303.573, rv: -170.101 },
    note: 'Among the oldest stars known: 14.5 ± 0.8 billion years (Bond et al. 2013).',
  },
  {
    key: 'smss-0313',
    name: 'SMSS J0313−6708',
    aliases: ['SMSS J031300.36-670839.3', 'SMSS 0313-6708'],
    type: 'Metal-poor star',
    raDeg: 48.25156163689999,
    decDeg: -67.14426004014,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(0.1078, 0.0139),
    motion: null,
    note: 'No iron seen in it: under a ten-millionth of the Sun’s share (Keller et al. 2014).',
  },
  {
    key: 'przybylski',
    name: 'Przybylski’s Star',
    aliases: ['HD 101065', 'V816 Cen', 'Przybylski'],
    type: 'Peculiar star',
    raDeg: 174.40433733673,
    decDeg: -46.70968829912,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(9.1496, 0.0213),
    motion: null,
    note: 'Its spectrum is crowded with lines of rare and short-lived elements; how they are made is unknown.',
  },
  {
    key: 'tabby',
    name: 'Tabby’s Star',
    aliases: ['KIC 8462852', 'Boyajian’s Star', 'TYC 3162-665-1'],
    type: 'Irregular dimming star',
    raDeg: 301.5643860504275,
    decDeg: 44.4568863525439,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(2.2545, 0.0099),
    motion: null,
    note: 'Dims by up to 22% at no regular interval (Boyajian et al. 2016); dust is the likeliest cause.',
  },
  {
    key: 't-crb',
    name: 'T Coronae Borealis',
    aliases: ['T CrB', 'Blaze Star'],
    type: 'Recurrent nova',
    raDeg: 239.87567594413002,
    decDeg: 25.92017038415,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(1.092, 0.0275),
    motion: null,
    note: 'A white dwarf and a red giant; it erupts about every 80 years, seen in 1866 and 1946.',
  },
  // --- Young massive clusters --------------------------------------------------------------
  {
    key: 'westerlund-1',
    name: 'Westerlund 1',
    aliases: ['Wd 1', 'Westerlund1'],
    type: 'Young massive cluster',
    raDeg: 251.75955,
    decDeg: -45.85306,
    positionSource: 'Unified Cluster Catalogue (Perren et al. 2023)',
    ...fromParallax(0.2076 - GAIA_ZERO_POINT_MAS, 0.011),
    parallaxMas: 0.2076,
    distanceMethod: 'mean Gaia DR3 parallax of its members, zero-point corrected',
    distanceReference: 'Unified Cluster Catalogue (Perren et al. 2023)',
    motion: null,
    note: 'Among the most massive young clusters in the Milky Way. Other Gaia studies give 3.9 to 4.2 kpc.',
  },
  {
    key: 'arches',
    name: 'Arches Cluster',
    aliases: ['Arches'],
    type: 'Young massive cluster',
    raDeg: 266.4604166666667,
    decDeg: -28.824444444444445,
    positionSource: SIMBAD,
    ...galacticCentre('a cluster in it'),
    motion: null,
    note: 'Among the densest young clusters known, 27 pc from Sgr A* on the sky.',
  },
  {
    key: 'quintuplet',
    name: 'Quintuplet Cluster',
    aliases: ['Quintuplet'],
    type: 'Young massive cluster',
    raDeg: 266.55778269545,
    decDeg: -28.83003348404491,
    positionSource: SIMBAD,
    ...galacticCentre('a cluster in it'),
    motion: null,
    note: 'Home of the Pistol Star.',
  },
  // --- Black holes -------------------------------------------------------------------------
  {
    key: 'gaia-bh2',
    name: 'Gaia BH2',
    aliases: ['Gaia DR3 5870569352746779008'],
    type: 'Stellar black hole',
    raDeg: 207.56971624,
    decDeg: -59.239005,
    positionSource: 'El-Badry et al. 2023, MNRAS 521, 4323',
    ...fromParallax(0.859, 0.018),
    parallaxMas: 0.859,
    distanceMethod: 'Gaia’s parallax fitted with the orbit',
    distanceReference: 'El-Badry et al. 2023, MNRAS 521, 4323',
    motion: null,
    note: 'A red giant on a 1,277-day orbit about an 8.9-solar-mass black hole. Its orbit is not drawn.',
  },
  {
    key: 'a0620-00',
    name: 'A0620−00',
    aliases: ['V616 Mon', '1A 0620-00', 'A0620-00', 'Nova Monocerotis 1975'],
    type: 'Stellar black hole',
    raDeg: 95.68559327388,
    decDeg: -0.34563623903999996,
    positionSource: `${SIMBAD}, from Gaia`,
    distancePc: 1060,
    distanceUpPc: 120,
    distanceDownPc: 120,
    parallaxMas: null,
    distanceMethod: 'its star’s brightness, against its size from the orbit',
    distanceReference: 'Cantrell et al. 2010, ApJ 710, 1127',
    motion: null,
    note: 'A 6.6-solar-mass black hole and a K dwarf. Gaia’s parallax, 0.70 ± 0.12 mas, gives 1.4 kpc.',
  },
  {
    key: 'v404-cyg',
    name: 'V404 Cygni',
    aliases: ['V404 Cyg', 'GS 2023+338'],
    type: 'Stellar black hole',
    raDeg: 306.0159362655975,
    decDeg: 33.86721143190583,
    positionSource: `${SIMBAD}, from Gaia`,
    ...fromParallax(0.418, 0.024),
    parallaxMas: 0.418,
    distanceMethod: 'the VLBI parallax of its radio emission',
    distanceReference: 'Miller-Jones et al. 2009, ApJ 706, L230',
    motion: null,
    note: 'The first black hole given a parallax distance.',
  },
  {
    key: 'grs-1915',
    name: 'GRS 1915+105',
    aliases: ['V1487 Aql', 'Granat 1915+105'],
    type: 'Stellar black hole',
    raDeg: 288.798149,
    decDeg: 10.945807,
    positionSource: SIMBAD,
    distancePc: 8600,
    distanceUpPc: 2000,
    distanceDownPc: 1600,
    parallaxMas: null,
    distanceMethod: 'the VLBA parallax of its jets’ core',
    distanceReference: 'Reid et al. 2014, ApJ 796, 2',
    motion: null,
    note: 'A 12-solar-mass black hole and a K giant; its jets seem to move faster than light.',
  },
  {
    key: 'ss-433',
    name: 'SS 433',
    aliases: ['V1343 Aql'],
    type: 'Microquasar',
    raDeg: 287.95651987395,
    decDeg: 4.982729757679999,
    positionSource: `${SIMBAD}, from Gaia`,
    ...gaia(0.1182, 0.0233),
    motion: null,
    note: 'Disputed: its precessing jets’ motions give 5.5 kpc (Blundell & Bowler 2004). Its compact object may be a black hole.',
  },
  {
    key: 'omega-cen-imbh',
    name: 'ω Centauri’s black hole',
    aliases: ['Omega Centauri black hole', 'ω Cen IMBH', 'omega Cen IMBH'],
    type: 'Intermediate-mass black hole',
    raDeg: 201.69699999999997,
    decDeg: -47.47947222222223,
    positionSource: 'ω Centauri’s centre (Goldsbury et al. 2010, via SIMBAD)',
    distancePc: 5430,
    distanceUpPc: 50,
    distanceDownPc: 50,
    parallaxMas: null,
    distanceMethod: 'ω Centauri’s, the cluster’s, as the Globular Clusters layer has it',
    distanceReference: 'Baumgardt & Vasiliev 2021, MNRAS 505, 5957',
    motion: null,
    note: 'At least 8,200 solar masses, from seven stars moving faster than the centre could hold without it (Häberle et al. 2024, Nature 631, 285).',
  },
];

/** Asked for and left out, with why: no distance that holds. */
export const SKIPPED: readonly { readonly name: string; readonly reason: string }[] = [
  { name: 'μ Cephei', reason: 'Gaia’s parallax is 0.12 ± 0.26 mas (RUWE 3.1), Hipparcos’s no better; no other measures it.' },
  { name: 'ρ Cassiopeiae', reason: 'Gaia DR3’s parallax is −0.06 ± 0.09 mas (RUWE 2.3); DR2’s 0.95 ± 0.20 disagrees.' },
  { name: 'WR 104', reason: 'Gaia’s parallax is spoiled (RUWE 5.5); other distances rest on an assumed luminosity.' },
  { name: 'G-cloud', reason: 'Only its outline on the sky and its velocity are published (Redfield & Linsky 2008), not how far it reaches.' },
];

export function notableStarBodyId(star: NotableStar): BodyId {
  return `${NOTABLE_STAR_PREFIX}${star.key}`;
}

export function notableStarOf(id: BodyId | null): NotableStar | null {
  return NOTABLE_STARS.find((star) => notableStarBodyId(star) === id) ?? null;
}

const J2000_JD = 2451545.0;
const DAY_S = 86_400;

/** Where a mark is about the Sun at a time, km: its J2000 place, moved along its motion if it has one. */
export function notableStarState(star: NotableStar): (jd: number) => StateVector {
  const at = astrometricState({
    raDeg: star.raDeg,
    decDeg: star.decDeg,
    parallaxMas: 1000 / star.distancePc,
    pmRaMasPerYear: star.motion?.pmRa ?? 0,
    pmDecMasPerYear: star.motion?.pmDec ?? 0,
    radialVelocityKmS: star.motion?.rv ?? 0,
  });
  if (star.motion === null) {
    const still = { position: at.position, velocity: { x: 0, y: 0, z: 0 } };
    return () => still;
  }
  const { position: p, velocity: v } = at;
  return (jd) => {
    const s = (jd - J2000_JD) * DAY_S;
    return { position: { x: p.x + v.x * s, y: p.y + v.y * s, z: p.z + v.z * s }, velocity: v };
  };
}

/** Marks have no size: framed from this far, km -- a tenth of a parsec. */
const FRAMING_KM = PARSEC_KM / 10;

const COLOURS: Readonly<Record<string, string>> = {
  'Stellar black hole': '#b48cff',
  'Intermediate-mass black hole': '#b48cff',
  Microquasar: '#b48cff',
  'White dwarf': '#cfe0ff',
  'Brown dwarf': '#c0745a',
  'Brown dwarf pair': '#c0745a',
  'Red supergiant': '#ff9a6a',
  'Red hypergiant': '#ff9a6a',
  'Young massive cluster': '#b4c6e6',
};

function definition(star: NotableStar): BodyDefinition {
  const radius = FRAMING_KM / 8;
  return {
    id: notableStarBodyId(star),
    name: star.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'deep-sky',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: COLOURS[star.type] ?? '#e6dcc0',
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** Makes the marks bodies, at start (App.tsx): named, found by search, gone to. */
export function ensureNotableStars(store: EphemerisStore): void {
  for (const star of NOTABLE_STARS) {
    registerDeepSky(notableStarBodyId(star), { label: star.type, aliases: [star.name, ...star.aliases] });
  }
  const missing = NOTABLE_STARS.filter((star) => !store.isPropagatedBody(notableStarBodyId(star)));
  if (missing.length === 0) {
    return;
  }
  store.addPropagatedBodies(
    missing.map((star) => ({ body: definition(star), elements: null, state: notableStarState(star), options: { exact: true } })),
  );
}

/** The framing a mark asks for: from the Sun's side, along the line of sight, north up, a tenth of a parsec out. */
export function notableStarFraming(id: BodyId): FramingRequest | null {
  const star = notableStarOf(id);
  if (star === null) {
    return null;
  }
  const at = notableStarState(star)(J2000_JD).position;
  const n = Math.hypot(at.x, at.y, at.z);
  const { north, away } = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
  return { km: FRAMING_KM, view: { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] } };
}
