import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import { registerDeepSky } from './deepSky.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector } from './vec3.ts';
import type { FramingRequest } from '../state/store.ts';

/**
 * Messier's 110: each one drawn, and found by its number.
 *
 * Most are drawn already as something else, and are that: the 29 globular clusters
 * (globularClusters.ts, by Baumgardt's and Harris's catalogues, their Messier numbers among
 * their names), the 40 galaxies (the Local Group's, the Local Volume's, the Virgo Cluster's and
 * Laniakea's catalogues, theirs too), the Crab Nebula (supernovaRemnants.ts) and the seven
 * nebulae drawn as volumes (nebulae.ts). The rest are marks of their own here, bodies of kind
 * 'deep-sky' in the Messier Objects layer, each at its measured distance (MESSIER_MARKS):
 *
 * - **26 open clusters**: their centres, half-member radii and members' mean Gaia DR3 parallax
 *   from the Unified Cluster Catalogue (Perren et al. 2023, MNRAS 526, 4107; version 260615,
 *   zenodo.org/records/20705026, CC BY 4.0), the distance the parallax's inverse once Gaia's
 *   zero-point, -0.017 mas (Lindegren et al. 2021, A&A 649, A4), is taken off. A mark: their
 *   stars are drawn where the star catalogue has them.
 * - **M43 and M78**: Orion's nebulae, at the distances the VLBA's parallaxes of their young
 *   stars give, the Orion Nebula Cluster's and NGC 2068's (Kounkel et al. 2017, ApJ 834, 142).
 * - **M97, the Owl Nebula**: its central star's Gaia parallax.
 * - **M40 and M73**: not clusters. Messier's "double nebula" M40 is Winnecke 4, two stars Gaia
 *   puts at 309 and 144 pc; M73, four stars at four distances, an asterism (Odenkirchen &
 *   Soubiran 2002, A&A 383, 163). Each star is marked where it is.
 *
 * Not drawn (MESSIER, 'skipped'): M24, the Sagittarius Star Cloud, a window through the dust
 * onto stars at every distance along it, no one place; and M76, the Little Dumbbell, whose
 * central star's parallax is 0.29 ± 0.20 mas, no distance. M102 is taken to be NGC 5866,
 * which it most likely is; that is disputed -- it may be M101 seen again.
 */

/** Gaia's parallax zero-point (Lindegren et al. 2021): its parallaxes are this much too small, mas. */
export const GAIA_ZERO_POINT_MAS = -0.017;

/** What each Messier object is drawn as. */
export type MessierDrawn =
  | { readonly as: 'globular-cluster'; readonly ngc: string }
  | {
      readonly as: 'galaxy';
      readonly ngc: string;
      readonly catalogue: 'Local Group' | 'Local Volume' | 'Virgo Cluster' | 'Laniakea';
    }
  | { readonly as: 'remnant' | 'nebula'; readonly bodyId: BodyId }
  | { readonly as: 'marked'; readonly marks: readonly string[] }
  | { readonly as: 'skipped'; readonly reason: string };

export interface MessierEntry {
  readonly m: number;
  readonly drawn: MessierDrawn;
  /** Anything the entry needs said: M102's identity. */
  readonly note?: string;
}

/** A Messier object marked here: where it is, how far, how big, and from whom. */
export interface MessierMark {
  readonly key: string;
  readonly m: number;
  readonly name: string;
  readonly aliases: readonly string[];
  /** What it is: "Open cluster", "Planetary nebula", "Star". */
  readonly type: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distancePc: number;
  /** Either way, pc; null where the source's systematic error is all there is (see the header). */
  readonly distanceErrorPc: number | null;
  /** The Gaia parallax it is from, mas, as measured (the zero-point not yet taken off); null for another method. */
  readonly parallaxMas: number | null;
  readonly distanceMethod: string;
  readonly distanceReference: string;
  /** Its half-member radius, or its nebula's, arcminutes; null where none is catalogued. */
  readonly radiusArcmin: number | null;
  readonly radiusSource: string | null;
  /** Gaia's count of its members, for a cluster. */
  readonly members: number | null;
  readonly positionSource: string;
  readonly note: string | null;
}

const UCC = 'Unified Cluster Catalogue (Perren et al. 2023)';
const UCC_METHOD = 'mean Gaia DR3 parallax of its members, zero-point corrected';
const GAIA = 'Gaia DR3 (Gaia Collaboration 2023)';
const KOUNKEL = 'Kounkel et al. 2017, ApJ 834, 142';

function cluster(
  m: number,
  ngc: string,
  aliases: readonly string[],
  raDeg: number,
  decDeg: number,
  parallaxMas: number,
  r50Arcmin: number,
  members: number,
  name: string = `M${m} (${ngc})`,
): MessierMark {
  return {
    key: `m${m}`,
    m,
    name,
    aliases: [`M${m}`, `Messier ${m}`, ngc, ...aliases],
    type: 'Open cluster',
    raDeg,
    decDeg,
    distancePc: 1000 / (parallaxMas - GAIA_ZERO_POINT_MAS),
    distanceErrorPc: null,
    parallaxMas,
    distanceMethod: UCC_METHOD,
    distanceReference: UCC,
    radiusArcmin: r50Arcmin,
    radiusSource: `${UCC}, half its members within`,
    members,
    positionSource: UCC,
    note: null,
  };
}

function star(
  key: string,
  m: number,
  name: string,
  gaiaId: string,
  raDeg: number,
  decDeg: number,
  parallaxMas: number,
  parallaxErrorMas: number,
  note: string,
): MessierMark {
  const distancePc = 1000 / (parallaxMas - GAIA_ZERO_POINT_MAS);
  return {
    key,
    m,
    name,
    aliases: [`M${m}`, `Messier ${m}`, `Gaia DR3 ${gaiaId}`],
    type: 'Star',
    raDeg,
    decDeg,
    distancePc,
    distanceErrorPc: (distancePc * parallaxErrorMas) / (parallaxMas - GAIA_ZERO_POINT_MAS),
    parallaxMas,
    distanceMethod: 'its Gaia DR3 parallax, zero-point corrected',
    distanceReference: GAIA,
    radiusArcmin: null,
    radiusSource: null,
    members: null,
    positionSource: GAIA,
    note,
  };
}

const M40_NOTE = 'M40 is two stars that only look close: Winnecke 4 A at 309 pc, B at 144 pc.';
const M73_NOTE = 'M73 is four stars that only look close, at 694, 381, 314 and 658 pc: an asterism (Odenkirchen & Soubiran 2002).';

/** The Messier objects marked here, each where it is measured to be (see the header). */
export const MESSIER_MARKS: readonly MessierMark[] = [
  cluster(6, 'NGC 6405', ['Butterfly Cluster'], 265.09113, -32.23444, 2.1765, 14.5, 761),
  cluster(7, 'NGC 6475', ['Ptolemy Cluster'], 268.47051, -34.83094, 3.5775, 35.3, 964),
  cluster(11, 'NGC 6705', ['Wild Duck Cluster'], 282.76842, -6.27188, 0.4133, 4.1, 1899),
  cluster(18, 'NGC 6613', [], 274.99666, -17.10514, 0.6284, 6.5, 126),
  cluster(21, 'NGC 6531', [], 271.04587, -22.5033, 0.7994, 4.7, 205),
  cluster(23, 'NGC 6494', [], 269.23952, -18.99002, 1.3662, 16.6, 822),
  cluster(25, 'IC 4725', [], 277.93755, -19.11728, 1.5122, 15.0, 487),
  cluster(26, 'NGC 6694', [], 281.31678, -9.38996, 0.5132, 3.8, 332),
  cluster(29, 'NGC 6913', [], 305.9287, 38.50455, 0.5594, 6.2, 120),
  cluster(34, 'NGC 1039', [], 40.54905, 42.72822, 1.9935, 24.8, 1283),
  cluster(35, 'NGC 2168', [], 92.26759, 24.34339, 1.151, 16.4, 1763),
  cluster(36, 'NGC 1960', [], 84.08612, 34.13675, 0.8416, 5.1, 419),
  cluster(37, 'NGC 2099', [], 88.07474, 32.54338, 0.6715, 8.5, 2002),
  cluster(38, 'NGC 1912', [], 82.18425, 35.82008, 0.879, 13.8, 1157),
  cluster(39, 'NGC 7092', [], 322.80144, 48.25233, 3.3597, 51.2, 313),
  cluster(41, 'NGC 2287', [], 101.50047, -20.71601, 1.3574, 21.4, 1166),
  cluster(44, 'NGC 2632', ['Beehive Cluster'], 130.01266, 19.60494, 5.4074, 78.3, 1204, 'Praesepe'),
  cluster(45, 'Melotte 22', ['Seven Sisters'], 56.59978, 24.11362, 7.3612, 95.5, 1678, 'Pleiades'),
  cluster(46, 'NGC 2437', [], 115.44553, -14.84352, 0.5963, 11.3, 2014),
  cluster(47, 'NGC 2422', [], 114.13952, -14.48593, 2.093, 23.5, 1348),
  cluster(48, 'NGC 2548', [], 123.38922, -5.7324, 1.2978, 20.1, 592),
  cluster(50, 'NGC 2323', [], 105.6952, -8.35909, 1.0056, 10.0, 781),
  cluster(52, 'NGC 7654', [], 351.19178, 61.59168, 0.6084, 6.1, 1216),
  cluster(67, 'NGC 2682', [], 132.84738, 11.81824, 1.1518, 17.2, 1650),
  cluster(93, 'NGC 2447', [], 116.14022, -23.85088, 0.9899, 11.7, 1077),
  cluster(103, 'NGC 581', [], 23.34103, 60.6609, 0.3616, 3.3, 208),
  {
    key: 'm43',
    m: 43,
    name: 'M43 (De Mairan’s Nebula)',
    aliases: ['M43', 'Messier 43', 'NGC 1982', 'De Mairan’s Nebula'],
    type: 'H II region',
    raDeg: 83.87917,
    decDeg: -5.27,
    distancePc: 388,
    distanceErrorPc: 5,
    parallaxMas: null,
    distanceMethod: 'VLBA parallaxes of the Orion Nebula Cluster’s young stars',
    distanceReference: KOUNKEL,
    radiusArcmin: null,
    radiusSource: null,
    members: null,
    positionSource: 'SIMBAD',
    note: 'Lit by NU Ori; the Orion Nebula’s neighbour, past a lane of dust.',
  },
  {
    key: 'm78',
    m: 78,
    name: 'M78 (NGC 2068)',
    aliases: ['M78', 'Messier 78', 'NGC 2068'],
    type: 'Reflection nebula',
    raDeg: 86.69083,
    decDeg: 0.07917,
    distancePc: 388,
    distanceErrorPc: 10,
    parallaxMas: null,
    distanceMethod: 'VLBA parallaxes of NGC 2068’s young stars',
    distanceReference: KOUNKEL,
    radiusArcmin: 13.2,
    radiusSource: `${UCC}: its cluster NGC 2068, half its members within`,
    members: 191,
    positionSource: 'SIMBAD',
    note: 'Dust lit by the young stars in it, in the Orion B cloud.',
  },
  {
    key: 'm97',
    m: 97,
    name: 'Owl Nebula',
    aliases: ['M97', 'Messier 97', 'NGC 3587'],
    type: 'Planetary nebula',
    raDeg: 168.69880,
    decDeg: 55.01902,
    distancePc: 1000 / (1.2347 - GAIA_ZERO_POINT_MAS),
    distanceErrorPc: (1000 / (1.2347 - GAIA_ZERO_POINT_MAS)) * (0.0461 / (1.2347 - GAIA_ZERO_POINT_MAS)),
    parallaxMas: 1.2347,
    distanceMethod: 'its central star’s Gaia parallax, zero-point corrected',
    distanceReference: 'Gaia EDR3 (Gaia Collaboration 2021), via SIMBAD',
    radiusArcmin: 3.333 / 2,
    radiusSource: 'SIMBAD, its diameter 3.3′',
    members: null,
    positionSource: 'SIMBAD',
    note: null,
  },
  star('m40-a', 40, 'Winnecke 4 A', '1575047353068482688', 185.5518004, 58.0829015, 3.2191321, 0.0118437, M40_NOTE),
  star('m40-b', 40, 'Winnecke 4 B', '1575047731026006528', 185.5789266, 58.08651, 6.9327922, 0.0155434, M40_NOTE),
  star('m73-1', 73, 'M73 star 1', '6888761925104124544', 314.7365828, -12.6418228, 1.423965, 0.015108, M73_NOTE),
  star('m73-2', 73, 'M73 star 2', '6888763058975491840', 314.7400871, -12.629399, 2.6105186, 0.0198713, M73_NOTE),
  star('m73-3', 73, 'M73 star 3', '6888762676722911104', 314.7283334, -12.6344702, 3.1657682, 0.027423, M73_NOTE),
  star('m73-4', 73, 'M73 star 4', '6888762676722910720', 314.7222137, -12.6318107, 1.5029299, 0.0149233, M73_NOTE),
];

const globular = (ngc: string): MessierDrawn => ({ as: 'globular-cluster', ngc });
const galaxy = (ngc: string, catalogue: 'Local Group' | 'Local Volume' | 'Virgo Cluster' | 'Laniakea'): MessierDrawn => ({
  as: 'galaxy',
  ngc,
  catalogue,
});
const nebula = (key: string): MessierDrawn => ({ as: 'nebula', bodyId: `nebula-${key}` });
const marked = (...marks: string[]): MessierDrawn => ({ as: 'marked', marks });
const one = (m: number): MessierDrawn => marked(`m${m}`);

/** All 110, by number, and what each is drawn as. */
export const MESSIER: readonly MessierEntry[] = [
  { m: 1, drawn: { as: 'remnant', bodyId: 'snr-crab' } },
  { m: 2, drawn: globular('NGC 7089') },
  { m: 3, drawn: globular('NGC 5272') },
  { m: 4, drawn: globular('NGC 6121') },
  { m: 5, drawn: globular('NGC 5904') },
  { m: 6, drawn: one(6) },
  { m: 7, drawn: one(7) },
  { m: 8, drawn: nebula('lagoon') },
  { m: 9, drawn: globular('NGC 6333') },
  { m: 10, drawn: globular('NGC 6254') },
  { m: 11, drawn: one(11) },
  { m: 12, drawn: globular('NGC 6218') },
  { m: 13, drawn: globular('NGC 6205') },
  { m: 14, drawn: globular('NGC 6402') },
  { m: 15, drawn: globular('NGC 7078') },
  { m: 16, drawn: nebula('eagle') },
  { m: 17, drawn: nebula('omega') },
  { m: 18, drawn: one(18) },
  { m: 19, drawn: globular('NGC 6273') },
  { m: 20, drawn: nebula('trifid') },
  { m: 21, drawn: one(21) },
  { m: 22, drawn: globular('NGC 6656') },
  { m: 23, drawn: one(23) },
  {
    m: 24,
    drawn: {
      as: 'skipped',
      reason:
        'The Sagittarius Star Cloud: a window through the dust onto the Milky Way’s stars at every distance along it, not one object at one place.',
    },
  },
  { m: 25, drawn: one(25) },
  { m: 26, drawn: one(26) },
  { m: 27, drawn: nebula('dumbbell') },
  { m: 28, drawn: globular('NGC 6626') },
  { m: 29, drawn: one(29) },
  { m: 30, drawn: globular('NGC 7099') },
  { m: 31, drawn: galaxy('NGC 224', 'Local Group') },
  { m: 32, drawn: galaxy('NGC 221', 'Local Group') },
  { m: 33, drawn: galaxy('NGC 598', 'Local Group') },
  { m: 34, drawn: one(34) },
  { m: 35, drawn: one(35) },
  { m: 36, drawn: one(36) },
  { m: 37, drawn: one(37) },
  { m: 38, drawn: one(38) },
  { m: 39, drawn: one(39) },
  { m: 40, drawn: marked('m40-a', 'm40-b') },
  { m: 41, drawn: one(41) },
  { m: 42, drawn: nebula('orion') },
  { m: 43, drawn: one(43) },
  { m: 44, drawn: one(44) },
  { m: 45, drawn: one(45) },
  { m: 46, drawn: one(46) },
  { m: 47, drawn: one(47) },
  { m: 48, drawn: one(48) },
  { m: 49, drawn: galaxy('NGC 4472', 'Virgo Cluster') },
  { m: 50, drawn: one(50) },
  { m: 51, drawn: galaxy('NGC 5194', 'Local Volume') },
  { m: 52, drawn: one(52) },
  { m: 53, drawn: globular('NGC 5024') },
  { m: 54, drawn: globular('NGC 6715') },
  { m: 55, drawn: globular('NGC 6809') },
  { m: 56, drawn: globular('NGC 6779') },
  { m: 57, drawn: nebula('ring') },
  { m: 58, drawn: galaxy('NGC 4579', 'Virgo Cluster') },
  { m: 59, drawn: galaxy('NGC 4621', 'Virgo Cluster') },
  { m: 60, drawn: galaxy('NGC 4649', 'Virgo Cluster') },
  { m: 61, drawn: galaxy('NGC 4303', 'Laniakea') },
  { m: 62, drawn: globular('NGC 6266') },
  { m: 63, drawn: galaxy('NGC 5055', 'Local Volume') },
  { m: 64, drawn: galaxy('NGC 4826', 'Local Volume') },
  { m: 65, drawn: galaxy('NGC 3623', 'Laniakea') },
  { m: 66, drawn: galaxy('NGC 3627', 'Local Volume') },
  { m: 67, drawn: one(67) },
  { m: 68, drawn: globular('NGC 4590') },
  { m: 69, drawn: globular('NGC 6637') },
  { m: 70, drawn: globular('NGC 6681') },
  { m: 71, drawn: globular('NGC 6838') },
  { m: 72, drawn: globular('NGC 6981') },
  { m: 73, drawn: marked('m73-1', 'm73-2', 'm73-3', 'm73-4') },
  { m: 74, drawn: galaxy('NGC 628', 'Local Volume') },
  { m: 75, drawn: globular('NGC 6864') },
  {
    m: 76,
    drawn: {
      as: 'skipped',
      reason:
        'The Little Dumbbell: its central star’s Gaia parallax is 0.29 ± 0.20 mas, which gives it no distance, and no other measures one.',
    },
  },
  { m: 77, drawn: galaxy('NGC 1068', 'Laniakea') },
  { m: 78, drawn: one(78) },
  { m: 79, drawn: globular('NGC 1904') },
  { m: 80, drawn: globular('NGC 6093') },
  { m: 81, drawn: galaxy('NGC 3031', 'Local Volume') },
  { m: 82, drawn: galaxy('NGC 3034', 'Local Volume') },
  { m: 83, drawn: galaxy('NGC 5236', 'Local Volume') },
  { m: 84, drawn: galaxy('NGC 4374', 'Virgo Cluster') },
  { m: 85, drawn: galaxy('NGC 4382', 'Virgo Cluster') },
  { m: 86, drawn: galaxy('NGC 4406', 'Virgo Cluster') },
  { m: 87, drawn: galaxy('NGC 4486', 'Virgo Cluster') },
  { m: 88, drawn: galaxy('NGC 4501', 'Virgo Cluster') },
  { m: 89, drawn: galaxy('NGC 4552', 'Virgo Cluster') },
  { m: 90, drawn: galaxy('NGC 4569', 'Virgo Cluster') },
  { m: 91, drawn: galaxy('NGC 4548', 'Virgo Cluster') },
  { m: 92, drawn: globular('NGC 6341') },
  { m: 93, drawn: one(93) },
  { m: 94, drawn: galaxy('NGC 4736', 'Local Volume') },
  { m: 95, drawn: galaxy('NGC 3351', 'Local Volume') },
  { m: 96, drawn: galaxy('NGC 3368', 'Local Volume') },
  { m: 97, drawn: one(97) },
  { m: 98, drawn: galaxy('NGC 4192', 'Virgo Cluster') },
  { m: 99, drawn: galaxy('NGC 4254', 'Virgo Cluster') },
  { m: 100, drawn: galaxy('NGC 4321', 'Virgo Cluster') },
  { m: 101, drawn: galaxy('NGC 5457', 'Local Volume') },
  {
    m: 102,
    drawn: galaxy('NGC 5866', 'Laniakea'),
    note: 'Most likely NGC 5866, the Spindle; disputed -- it may be M101 seen again.',
  },
  { m: 103, drawn: one(103) },
  { m: 104, drawn: galaxy('NGC 4594', 'Local Volume') },
  { m: 105, drawn: galaxy('NGC 3379', 'Local Volume') },
  { m: 106, drawn: galaxy('NGC 4258', 'Local Volume') },
  { m: 107, drawn: globular('NGC 6171') },
  { m: 108, drawn: galaxy('NGC 3556', 'Local Volume') },
  { m: 109, drawn: galaxy('NGC 3992', 'Laniakea') },
  { m: 110, drawn: galaxy('NGC 205', 'Local Group') },
];

/**
 * A query that is a Messier number a catalogue does not carry, and what to look it up by:
 * "M102", NGC 5866 in Laniakea's names (the others' are among their catalogues' names).
 */
export function messierSynonym(query: string): string | null {
  const number = /^\s*m(?:essier)?\s*0*(\d{1,3})\s*$/i.exec(query);
  return number !== null && Number(number[1]) === 102 ? 'NGC 5866' : null;
}

export function messierMarkBodyId(mark: MessierMark): BodyId {
  return `messier-${mark.key}`;
}

export function messierMarkOf(id: BodyId | null): MessierMark | null {
  return MESSIER_MARKS.find((mark) => messierMarkBodyId(mark) === id) ?? null;
}

/** A mark's radius, km: its catalogued radius at its distance; null where none is catalogued. */
export function messierRadiusKm(mark: MessierMark): number | null {
  return mark.radiusArcmin === null
    ? null
    : Math.tan((mark.radiusArcmin / 60) * (Math.PI / 180)) * mark.distancePc * PARSEC_KM;
}

/** Where a mark is about the Sun, km, standing still. */
export function messierState(mark: MessierMark): StateVector {
  const state = astrometricState({
    raDeg: mark.raDeg,
    decDeg: mark.decDeg,
    parallaxMas: 1000 / mark.distancePc,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  });
  return { position: state.position, velocity: { x: 0, y: 0, z: 0 } };
}

/** A star or a mark of no catalogued size is framed from this far, km: a parsec. */
const UNSIZED_FRAMING_KM = PARSEC_KM;

const COLOURS: Readonly<Record<string, string>> = {
  'Open cluster': '#b4c6e6',
  'H II region': '#e8786a',
  'Reflection nebula': '#8fb0e6',
  'Planetary nebula': '#6fcfc4',
  Star: '#d8cfb4',
};

function markDefinition(mark: MessierMark): BodyDefinition {
  // A place, not a surface: three-eighths of its radius, so that framed at eight of these the
  // camera stands three of its radii out, as a remnant's is (supernovaRemnants.ts).
  const radius = (3 / 8) * (messierRadiusKm(mark) ?? UNSIZED_FRAMING_KM / 3);
  return {
    id: messierMarkBodyId(mark),
    name: mark.name,
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
    color: COLOURS[mark.type] ?? '#b4c6e6',
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** Makes the marks bodies, at start (App.tsx): named, found by search, gone to. */
export function ensureMessierObjects(store: EphemerisStore): void {
  for (const mark of MESSIER_MARKS) {
    registerDeepSky(messierMarkBodyId(mark), { label: mark.type, aliases: mark.aliases });
  }
  const missing = MESSIER_MARKS.filter((mark) => !store.isPropagatedBody(messierMarkBodyId(mark)));
  if (missing.length === 0) {
    return;
  }
  store.addPropagatedBodies(
    missing.map((mark) => {
      const state = messierState(mark);
      return { body: markDefinition(mark), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}

/**
 * The framing a Messier mark asks for when focused: from the Sun's side, looking out along the
 * line of sight, north up -- as it is seen -- three of its radii out (a parsec for a star).
 */
export function messierFraming(id: BodyId): FramingRequest | null {
  const mark = messierMarkOf(id);
  if (mark === null) {
    return null;
  }
  const at = messierState(mark).position;
  const n = Math.hypot(at.x, at.y, at.z);
  const { north, away } = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
  return {
    km: 3 * (messierRadiusKm(mark) ?? UNSIZED_FRAMING_KM / 3),
    view: { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] },
  };
}
