import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import type { NotableStar } from './notableStars.ts';
import { addStarBody } from './starBodies.ts';
import type { StarNameIndex, Stars3dSource } from './stars3d.ts';

/**
 * The two star groups nearest the Sun: the Hyades, the nearest open cluster, and the Ursa
 * Major moving group, whose core is five stars of the Big Dipper. Each a mark in the Notable
 * Stars layer (notableStars.ts) at its measured centre, framed so that all of it is in view;
 * its stars are the catalogue's, drawn by their light where the catalogue puts them, and,
 * gone to, its named members are made star bodies (starBodies.ts) -- marked and named on
 * screen, which is how a star is singled out here.
 *
 * ## The Hyades
 *
 * Lodieu et al. 2019 (A&A 623, A35), from Gaia DR2: the cluster's barycentre, from its 122
 * members within 10 pc, at Galactic X, Y, Z = -43.83, 0.42, -17.05 pc from the Sun -- 47.03 ±
 * 0.20 pc -- turned here to right ascension and declination; 381 members within its tidal
 * radius, 9 pc, and 710 within 30 pc; 218 solar masses within the tidal radius; about 640
 * million years old by its white dwarfs. Its named members are four of its giants -- Prima
 * Hyadum (γ Tau), Secunda Hyadum (δ¹ Tau), Ain (ε Tau, with a planet) and Chamukuy (θ² Tau,
 * its brightest) -- members since Perryman et al. 1998 (A&A 331, 81). Aldebaran, in front of
 * it on the sky, is not one: it is 20 pc, not 47, away.
 *
 * ## The Ursa Major moving group
 *
 * Not a bound cluster: stars born together some 414 ± 23 million years ago (Jones et al.
 * 2015, ApJ 813, 58, from CHARA's radii of seven of them) still moving together, its core five
 * of the Big Dipper's seven -- Merak, Phecda, Megrez, Alioth, Mizar -- and Alcor; Dubhe and
 * Alkaid move otherwise (King et al. 2003, AJ 125, 1980). No centre is published for the core,
 * so the mark is at the mean of the six stars' positions, worked out here from their J2000
 * directions (the IAU's list, wgsn.ts) and the parallaxes the star catalogue holds for them
 * (van Leeuwen 2007; Gaia DR3 for Mizar): 24.8 pc. Its radius is the farthest of them from
 * that centre, Merak at 5.0 pc.
 *
 * arXiv: Lodieu et al. 2019, 1901.07534; Jones et al. 2015, 1508.05643.
 */

const DEG = Math.PI / 180;

/** ICRS to Galactic, the Hipparcos catalogue's matrix (ESA 1997, vol. 1, eq. 1.5.11). */
const GALACTIC_FROM_ICRS = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
] as const;

type Triple = readonly [number, number, number];

function equatorialOf(icrs: Triple): { readonly raDeg: number; readonly decDeg: number; readonly distancePc: number } {
  const distancePc = Math.hypot(...icrs);
  const ra = Math.atan2(icrs[1], icrs[0]) / DEG;
  return { raDeg: ra < 0 ? ra + 360 : ra, decDeg: Math.asin(icrs[2] / distancePc) / DEG, distancePc };
}

/** A point in Galactic X, Y, Z about the Sun (X toward the centre), turned to ICRS. */
export function icrsFromGalactic(galactic: Triple): Triple {
  const m = GALACTIC_FROM_ICRS;
  const at = (i: 0 | 1 | 2) => m[0][i] * galactic[0] + m[1][i] * galactic[1] + m[2][i] * galactic[2];
  return [at(0), at(1), at(2)];
}

function icrsOf(raDeg: number, decDeg: number, distancePc: number): Triple {
  return [
    distancePc * Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG),
    distancePc * Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG),
    distancePc * Math.sin(decDeg * DEG),
  ];
}

/** A member of a group: its catalogue name and number, and where the centre is worked out from. */
export interface GroupMember {
  readonly name: string;
  readonly hip: number;
  readonly raDeg: number;
  readonly decDeg: number;
  /** The parallax the star catalogue holds for it, mas. */
  readonly parallaxMas: number;
}

export interface StellarGroup {
  /** The notable-star key of its mark. */
  readonly key: string;
  readonly name: string;
  /** The members made star bodies when it is gone to: the named ones. */
  readonly members: readonly GroupMember[];
}

/** The Hyades' barycentre, Lodieu et al. 2019 Table 3 (r < 10 pc), Galactic X, Y, Z, pc. */
export const HYADES_BARYCENTRE_GALACTIC: Triple = [-43.83, 0.42, -17.05];
/** Its tidal radius, pc (Lodieu et al. 2019, after Röser et al. 2011). */
export const HYADES_TIDAL_RADIUS_PC = 9;

const LODIEU = 'Lodieu et al. 2019, A&A 623, A35';

/** Four of the Hyades' giants, named by the IAU; positions and parallaxes as the catalogue has them. */
const HYADES_MEMBERS: readonly GroupMember[] = [
  { name: 'Prima Hyadum', hip: 20205, raDeg: 64.94834968, decDeg: 15.62764205, parallaxMas: 21.665 },
  { name: 'Secunda Hyadum', hip: 20455, raDeg: 65.73372983, decDeg: 17.54251383, parallaxMas: 20.309 },
  { name: 'Ain', hip: 20889, raDeg: 67.15416773, decDeg: 19.18043421, parallaxMas: 22.365 },
  { name: 'Chamukuy', hip: 20894, raDeg: 67.16559005, decDeg: 15.87087465, parallaxMas: 21.813 },
];

/** The Ursa Major moving group's core (King et al. 2003; Jones et al. 2015). */
export const URSA_MAJOR_CORE: readonly GroupMember[] = [
  { name: 'Merak', hip: 53910, raDeg: 165.4603323, decDeg: 56.38243365, parallaxMas: 40.9 },
  { name: 'Phecda', hip: 58001, raDeg: 178.4576972, decDeg: 53.69475973, parallaxMas: 39.21 },
  { name: 'Megrez', hip: 59774, raDeg: 183.8564994, decDeg: 57.03261698, parallaxMas: 40.51 },
  { name: 'Alioth', hip: 62956, raDeg: 193.50729, decDeg: 55.95982296, parallaxMas: 39.51 },
  { name: 'Mizar', hip: 65378, raDeg: 195.398762, decDeg: 54.9253611, parallaxMas: 40.213 },
  { name: 'Alcor', hip: 65477, raDeg: 201.3064076, decDeg: 54.98795966, parallaxMas: 39.91 },
];

/** The mean of the members' positions, ICRS, pc. */
export function memberCentroid(members: readonly GroupMember[]): Triple {
  const points = members.map((m) => icrsOf(m.raDeg, m.decDeg, 1000 / m.parallaxMas));
  const mean = (i: 0 | 1 | 2) => points.reduce((sum, p) => sum + p[i], 0) / points.length;
  return [mean(0), mean(1), mean(2)];
}

/** How far the farthest member is from the members' centroid, pc. */
export function memberExtentPc(members: readonly GroupMember[]): number {
  const c = memberCentroid(members);
  return Math.max(
    ...members.map((m) => {
      const p = icrsOf(m.raDeg, m.decDeg, 1000 / m.parallaxMas);
      return Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
    }),
  );
}

const hyades = equatorialOf(icrsFromGalactic(HYADES_BARYCENTRE_GALACTIC));
const ursaMajor = equatorialOf(memberCentroid(URSA_MAJOR_CORE));
const ursaMajorExtentPc = memberExtentPc(URSA_MAJOR_CORE);

/** The groups' marks, in the Notable Stars layer (notableStars.ts NOTABLE_STARS). */
export const STELLAR_GROUP_MARKS: readonly NotableStar[] = [
  {
    key: 'hyades',
    name: 'Hyades',
    aliases: ['Melotte 25', 'Collinder 50', 'Caldwell 41', 'Hyades cluster'],
    type: 'Open cluster',
    raDeg: hyades.raDeg,
    decDeg: hyades.decDeg,
    positionSource: `${LODIEU}: its barycentre, Galactic X, Y, Z`,
    distancePc: hyades.distancePc,
    distanceUpPc: 0.2,
    distanceDownPc: 0.2,
    parallaxMas: null,
    distanceMethod: 'its 122 members within 10 pc, Gaia DR2',
    distanceReference: LODIEU,
    motion: null,
    note: 'The nearest open cluster. Aldebaran, in front of it on the sky, is not a member: it is 20 pc away.',
    extent: { pc: HYADES_TIDAL_RADIUS_PC, label: 'tidal radius', source: `${LODIEU}, after Röser et al. 2011` },
    rows: [
      ['Members', '381 within 9 pc · 710 within 30 pc'],
      ['Mass', '218 M☉ within 9 pc'],
      ['Age', 'about 640 Myr, by its white dwarfs'],
    ],
  },
  {
    key: 'ursa-major-group',
    name: 'Ursa Major moving group',
    aliases: ['Ursa Major group', 'Ursa Major association', 'Collinder 285', 'UMa moving group', 'Big Dipper group'],
    type: 'Moving group',
    raDeg: ursaMajor.raDeg,
    decDeg: ursaMajor.decDeg,
    positionSource: 'the mean of its six core stars’ places, worked out here',
    distancePc: ursaMajor.distancePc,
    distanceUpPc: null,
    distanceDownPc: null,
    parallaxMas: null,
    distanceMethod: 'its core stars’ parallaxes, as the star catalogue holds them',
    distanceReference: 'van Leeuwen 2007; Gaia DR3 (Mizar)',
    motion: null,
    note: 'Stars born together, still moving together: five of the Big Dipper’s seven, and Alcor. Dubhe and Alkaid are not of it.',
    extent: { pc: ursaMajorExtentPc, label: 'its core', source: 'the farthest core star from the centre, Merak' },
    rows: [
      ['Core', URSA_MAJOR_CORE.map((m) => m.name).join(', ')],
      ['Age', '414 ± 23 Myr (Jones et al. 2015)'],
      ['Members from', 'King et al. 2003, AJ 125, 1980'],
    ],
  },
];

export const STELLAR_GROUPS: readonly StellarGroup[] = [
  { key: 'hyades', name: 'Hyades', members: HYADES_MEMBERS },
  { key: 'ursa-major-group', name: 'Ursa Major moving group', members: URSA_MAJOR_CORE },
];

/** The group a notable-star key is the mark of, or null. */
export function stellarGroupOf(key: string | null): StellarGroup | null {
  return STELLAR_GROUPS.find((group) => group.key === key) ?? null;
}

/** The group a star is a named member of, by its designations ("HIP 53910"), or null. */
export function groupNameOf(designations: readonly string[]): string | null {
  for (const group of STELLAR_GROUPS) {
    if (group.members.some((m) => designations.includes(`HIP ${m.hip}`))) {
      return group.name;
    }
  }
  return null;
}

/**
 * Makes a group's named members star bodies -- each marked and named on screen -- when the
 * group is gone to (App.tsx). Not pinned: they go as any star body goes, once a dozen others
 * have been gone to since (starBodies.ts STAR_BODIES_KEPT). `keep` is the group's mark.
 */
export async function markGroupMembers(
  store: EphemerisStore,
  stars3d: Stars3dSource,
  index: StarNameIndex,
  group: StellarGroup,
  keep: BodyId,
): Promise<BodyId[]> {
  const ids: BodyId[] = [];
  for (const k of groupMemberEntries(index, group)) {
    ids.push(await addStarBody(store, stars3d, index, k, keep));
  }
  return ids;
}

/** The star names' entries of a group's members, found by HIP number; those the names lack are left out. */
export function groupMemberEntries(index: StarNameIndex, group: StellarGroup): number[] {
  const wanted = new Set(group.members.map((m) => `HIP ${m.hip}`));
  const { names } = index;
  const found: number[] = [];
  for (let k = 0; k < names.count; k += 1) {
    if ((names.designations[k] ?? []).some((designation) => wanted.has(designation))) {
      found.push(k);
    }
  }
  return found;
}
