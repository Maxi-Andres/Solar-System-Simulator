import type { BodyId } from '@sss/tools/types';

import { galacticDirection } from '../scene/galactic.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { galacticUnit } from './localInterstellar.ts';
import { registerRegion, regionDefinition, regionOf, type Region, type RegionFact } from './regions.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { Vec3 } from './vec3.ts';

/**
 * Named clouds of the interstellar medium and the Milky Way's gas beyond its disc, each a mark at
 * its measured distance with a ring of its measured size (scene/InterstellarClouds.tsx; the
 * Interstellar Clouds layer): made bodies as the regions are (regions.ts) -- named, found by
 * search, gone to -- each panel saying how far it is, from what, and what is not measured.
 *
 * ## Measured, and where from
 *
 * Distances from Gaia's 3D dust and VLBA maser parallaxes where there are any, each in its panel:
 * the Coalsack, Taurus and the Ophiuchus clouds from Zucker et al. 2019 and 2020 (ApJ 879, 125;
 * A&A 633, A51), stars' Gaia photometry and parallaxes locating the jump in the dust along each
 * line of sight; rho Ophiuchi's core L1688 from its young stars' VLBA parallaxes (Ortiz-Leon et
 * al. 2017, ApJ 834, 141); Cygnus X from four masers' (Rygl et al. 2012, A&A 539, A79). The
 * high-velocity clouds from stars in front of and behind them, their gas absorbing in the far
 * ones' spectra and not in the near ones' (Complex C: Thom et al. 2008, ApJ 684, 364; Complex A:
 * van Woerden et al. 1999, Nature 400, 138, and Wakker et al. 2003), and the Smith Cloud from its
 * motion, a kinematic distance (Lockman et al. 2008, ApJ 679, L21). Sizes from the same papers
 * or the surveys named in each panel.
 *
 * ## Assumed or disputed, said so
 *
 * - **Barnard's Loop** has no distance of its own: the Orion complex's, 400 pc, is assumed for it
 *   by those who model it (Ochsendorf et al. 2015, ApJ 808, 111; Foley et al. 2023, ApJ 947, 66),
 *   and its centre on the sky, on which the papers do not agree, is taken at Orion OB1b's.
 * - **The Orion-Eridanus superbubble** is a cavity 45 degrees across from Orion to Eridanus, its
 *   near wall some 180 pc off and its Orion end at 400 (Pon et al. 2016, ApJ 827, 42; Joubaud et
 *   al. 2019, A&A 631, A52): marked at its driving stars' place in Pon et al.'s fits, 390 pc,
 *   ringed at Ochsendorf et al.'s 160 pc.
 * - **Loop I and the North Polar Spur**: the dust in front of the Spur's high-latitude part is
 *   112-135 pc off (Panopoulou et al. 2021, ApJ 922, 210; Das et al. 2020, MNRAS 498, 5863), but
 *   its X rays are absorbed by gas past 300 pc (Lallement et al. 2016, A&A 595, A131), and many
 *   read it as the near edge of the eROSITA bubble, kiloparsecs off (Predehl et al. 2020). Drawn
 *   as the local answer -- a sphere filling Berkhuijsen, Haslam & Salter's circle on the sky
 *   (1971, A&A 14, 252: l = 329, b = 17.5, 58 degrees in radius), its rim at 120 pc -- dashed,
 *   the panel saying it is one of two.
 * - **Barnard 68**: 125 pc is the distance Alves, Lada & Lada (2001, Nature 409, 159) assumed;
 *   estimates run from 60 to 205 pc. Dashed.
 *
 * ## The Magellanic Stream, Bridge and Leading Arm
 *
 * Their gas is mapped on the sky in H I (Nidever, Majewski & Burton 2008, ApJ 679, 432; Nidever
 * et al. 2010, ApJ 723, 1618), along a great circle whose pole is at l = 188.5, b = -7.5 and
 * whose zero is the Large Cloud: the Stream at least 140 degrees behind the Clouds, the Leading
 * Arm 60 ahead, the Bridge between them. No distance along any of them is measured -- no star is
 * known in the gas -- and the models disagree by a factor of ten: 80-230 kpc at the Stream's tip
 * (Besla et al. 2012, MNRAS 421, 2109), or 20 kpc at its nearest (Lucchini et al. 2021, ApJL 921,
 * L36). So the tracks are drawn on the sky where they are measured and at the Clouds' own
 * distance -- the Large Cloud's; the Bridge from it to the Small Cloud's -- dashed, a choice the
 * panels state, not a measurement. The Leading Arm wanders off the great circle in their maps; it
 * is drawn along it.
 */

/** What a cloud is, for its colour and the panel. */
export type CloudKind = 'dark' | 'molecular' | 'ionised' | 'superbubble' | 'fast' | 'magellanic';

export interface InterstellarCloud {
  readonly key: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly kind: CloudKind;
  /** What it is, a few words: "Dark cloud", "High-velocity cloud". */
  readonly kindLabel: string;
  /** Its centre, Galactic longitude and latitude, degrees. */
  readonly lDeg: number;
  readonly bDeg: number;
  readonly distancePc: number;
  /** Up and down, pc; null where the paper gives a range or none. */
  readonly distanceUpPc: number | null;
  readonly distanceDownPc: number | null;
  readonly distanceMethod: string;
  readonly distanceReference: string;
  /** True where its distance is assumed or other measurements put it elsewhere. Drawn dashed. */
  readonly distanceDisputed: boolean;
  /** Its radius, pc -- half its longest extent -- and from what. */
  readonly radiusPc: number;
  readonly sizeNote: string;
  readonly note: string | null;
}

/** A Magellanic H I track: points on the sky (l, b, degrees) and the distance drawn at each, pc. */
export interface MagellanicTrack {
  readonly key: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly points: readonly (readonly [number, number, number])[];
  readonly distanceMethod: string;
  readonly lengthNote: string;
  readonly note: string;
}

const ZUCKER_2019 = 'Zucker et al. 2019, ApJ 879, 125';
const ZUCKER_2020 = 'Zucker et al. 2020, A&A 633, A51';
const DEG = Math.PI / 180;
const AU_PER_PC = 206_264.806;

export const INTERSTELLAR_CLOUDS: readonly InterstellarCloud[] = [
  {
    key: 'coalsack',
    name: 'Coalsack',
    aliases: ['Coalsack Nebula', 'Caldwell 99'],
    kind: 'dark',
    kindLabel: 'Dark cloud',
    // Versteeg et al. 2024 (AJ 167, 177): about l = 303, b = 0, some 10 degrees on the sky.
    lDeg: 303,
    bDeg: 0,
    // The mean of Zucker et al. 2020's six lines of sight through it, 182 to 193 pc, each with a
    // 5% systematic beside its own error.
    distancePc: 189,
    distanceUpPc: 9,
    distanceDownPc: 9,
    distanceMethod: 'Gaia: where the dust begins along six lines of sight, 182–193 pc',
    distanceReference: ZUCKER_2020,
    distanceDisputed: false,
    radiusPc: 16.5,
    sizeNote: 'half its 10° on the sky (Versteeg et al. 2024)',
    note: 'Dust that hides the Milky Way behind it, 26 pc deep (Versteeg et al. 2024). Part of its north-east is another cloud, 3 kpc behind.',
  },
  {
    key: 'rho-oph',
    name: 'ρ Ophiuchi Cloud',
    aliases: ['Rho Ophiuchi cloud', 'L1688', 'Ophiuchus molecular cloud'],
    kind: 'molecular',
    kindLabel: 'Molecular cloud',
    // L1688, the dense core round the young cluster: Zucker et al. 2020's line of sight through it.
    lDeg: 353.2,
    bDeg: 16.6,
    distancePc: 137.3,
    distanceUpPc: 1.2,
    distanceDownPc: 1.2,
    distanceMethod: 'VLBA parallaxes of its young stars, in L1688',
    distanceReference: 'Ortiz-León et al. 2017, ApJ 834, 141',
    distanceDisputed: false,
    radiusPc: 7,
    sizeNote: 'half the 6° box of its clouds (Zucker et al. 2019)',
    note: 'The nearest cloud forming a cluster of stars. Its dust, from Gaia: 139 pc (Zucker et al. 2020); L1689, beside it, 147 pc.',
  },
  {
    key: 'taurus',
    name: 'Taurus Molecular Cloud',
    aliases: ['Taurus–Auriga', 'TMC-1', 'Taurus dark clouds'],
    kind: 'molecular',
    kindLabel: 'Molecular cloud',
    // The middle of Zucker et al. 2019's box, l 166 to 176, b -19 to -13.
    lDeg: 171,
    bDeg: -16,
    distancePc: 141,
    distanceUpPc: 7,
    distanceDownPc: 7,
    distanceMethod: 'Gaia: where the dust begins, over the clouds’ box',
    distanceReference: ZUCKER_2019,
    distanceDisputed: false,
    radiusPc: 18.5,
    sizeNote: 'half the 15° its young stars spread over (Galli et al. 2019)',
    note: 'As deep as it is wide: L1495 at 130 pc, the filament behind it at 160, L1558 at 198 (Galli et al. 2019, Gaia).',
  },
  {
    key: 'b68',
    name: 'Barnard 68',
    aliases: ['B68', 'LDN 57'],
    kind: 'dark',
    kindLabel: 'Dark globule',
    // 17h22m38.6s -23d49'46", its extinction peak (Alves et al. 2001), in Galactic degrees.
    lDeg: 1.523,
    bDeg: 7.086,
    distancePc: 125,
    distanceUpPc: 25,
    distanceDownPc: 25,
    distanceMethod: 'assumed, the region’s (de Geus 1989); estimates run 60–205 pc',
    distanceReference: 'Alves, Lada & Lada 2001, Nature 409, 159',
    distanceDisputed: true,
    radiusPc: 12_500 / AU_PER_PC,
    sizeNote: '12,500 AU at 125 pc (Alves et al. 2001)',
    note: 'A cloud of 2.1 solar masses, its dust so thick no star shows through it.',
  },
  {
    key: 'barnards-loop',
    name: 'Barnard’s Loop',
    aliases: ['Sh2-276', 'Barnards Loop'],
    kind: 'ionised',
    kindLabel: 'Ionised arc',
    // Taken at Orion OB1b's place, the Belt, whose stars light it: the papers' centres disagree.
    lDeg: 205.2,
    bDeg: -17.2,
    distancePc: 400,
    distanceUpPc: null,
    distanceDownPc: null,
    distanceMethod: 'the Orion complex’s, assumed: none of its own is measured',
    distanceReference: 'Ochsendorf et al. 2015, ApJ 808, 111; Foley et al. 2023, ApJ 947, 66',
    distanceDisputed: true,
    radiusPc: 50,
    sizeNote: 'its 14° arc at 400 pc (Foley et al. 2023)',
    note: 'The bright eastern half of a shell of glowing hydrogen about the Orion complex; its western half is faint.',
  },
  {
    key: 'orion-eridanus',
    name: 'Orion–Eridanus Superbubble',
    aliases: ['Orion-Eridanus superbubble', 'Eridanus Loop', 'Orion–Eridanus Bubble'],
    kind: 'superbubble',
    kindLabel: 'Superbubble',
    // Pon et al. 2016's fitted driving source: l 207.3-208.5, b -15.3 to -17.4, 356-423 pc.
    lDeg: 208,
    bDeg: -16.4,
    distancePc: 390,
    distanceUpPc: 33,
    distanceDownPc: 34,
    distanceMethod: 'its driving stars’ place in fits to its shape; its near wall about 180 pc',
    distanceReference: 'Pon et al. 2016, ApJ 827, 42',
    distanceDisputed: false,
    radiusPc: 160,
    sizeNote: 'its outer wall, 45° across at 400 pc (Ochsendorf et al. 2015)',
    note: 'Hot gas blown out of Orion by its stars’ winds and supernovae, reaching toward the Sun; shells in it lie at 150–250 pc (Joubaud et al. 2019).',
  },
  {
    key: 'loop-i',
    name: 'Loop I',
    aliases: ['North Polar Spur', 'NPS', 'Loop 1'],
    kind: 'superbubble',
    kindLabel: 'Radio loop',
    lDeg: 329,
    bDeg: 17.5,
    // A sphere filling the 58-degree circle, its rim at 120 pc: its centre 120 / cos 58 away.
    distancePc: 120 / Math.cos(58 * DEG),
    distanceUpPc: null,
    distanceDownPc: null,
    distanceMethod:
      'its rim at the dust before the Spur, 112–135 pc; its X rays put it past 300 pc, or at the Galactic Centre',
    distanceReference: 'Panopoulou et al. 2021, ApJ 922, 210; Lallement et al. 2016, A&A 595, A131',
    distanceDisputed: true,
    radiusPc: 120 * Math.tan(58 * DEG),
    sizeNote: 'Berkhuijsen et al. 1971’s 58° circle, at this distance',
    note: 'A ring of radio light over a third of the sky: a bubble blown by the Sco–Cen stars, or the near edge of the eROSITA bubble, kiloparsecs off (Predehl et al. 2020).',
  },
  {
    key: 'cygnus-x',
    name: 'Cygnus X',
    aliases: ['Cygnus X complex', 'Cygnus-X'],
    kind: 'ionised',
    kindLabel: 'Star-forming complex',
    // Cyg OB2, about which the complex divides (Rygl et al. 2012).
    lDeg: 80.22,
    bDeg: 0.8,
    distancePc: 1400,
    distanceUpPc: 80,
    distanceDownPc: 80,
    distanceMethod: 'VLBA parallaxes of four masers in it, 1.30–1.50 kpc',
    distanceReference: 'Rygl et al. 2012, A&A 539, A79',
    distanceDisputed: false,
    radiusPc: 75,
    sizeNote: 'half the 6° of longitude its dust spans (Zucker et al. 2020)',
    note: 'The richest star-forming region near us: Cygnus OB2’s young stars, the DR21 and W75N clouds.',
  },
  {
    key: 'smith-cloud',
    name: 'Smith Cloud',
    aliases: ['Smith’s Cloud', 'GHVC J039-13'],
    kind: 'fast',
    kindLabel: 'High-velocity cloud',
    // Its tip, nearest the plane (Lockman et al. 2008).
    lDeg: 39,
    bDeg: -13,
    distancePc: 12_400,
    distanceUpPc: 1300,
    distanceDownPc: 1300,
    distanceMethod: 'its motion: a kinematic distance',
    distanceReference: 'Lockman et al. 2008, ApJ 679, L21',
    distanceDisputed: false,
    radiusPc: 1500,
    sizeNote: 'half its 3 kpc length (Lockman et al. 2008)',
    note: 'Over a million solar masses of hydrogen, 2.9 kpc below the plane and falling toward it at 73 km/s: it strikes the disc in some 27 million years.',
  },
  {
    key: 'complex-c',
    name: 'Complex C',
    aliases: ['HVC Complex C'],
    kind: 'fast',
    kindLabel: 'High-velocity cloud',
    // Between the two stars whose spectra place it: S437 (100.7, 48.4) and S674 (114.0, 54.0).
    lDeg: 107.4,
    bDeg: 51.2,
    distancePc: 10_000,
    distanceUpPc: 2500,
    distanceDownPc: 2500,
    distanceMethod: 'its gas absorbing in two halo stars’ spectra',
    distanceReference: 'Thom et al. 2008, ApJ 684, 364',
    distanceDisputed: false,
    radiusPc: 7500,
    sizeNote: 'half its 15 kpc length (Thom et al. 2008)',
    note: 'Some 5 million solar masses of hydrogen, poor in metals, falling onto the Galaxy: gas from outside it.',
  },
  {
    key: 'complex-a',
    name: 'Complex A',
    aliases: ['HVC Complex A'],
    kind: 'fast',
    kindLabel: 'High-velocity cloud',
    // The middle of Barger et al. 2012's box about it (l 130-170, b 22-51).
    lDeg: 150,
    bDeg: 36,
    distancePc: 9000,
    distanceUpPc: 1000,
    distanceDownPc: 1000,
    distanceMethod: 'its gas absorbing in halo stars’ spectra: between 8 and 10 kpc',
    distanceReference: 'van Woerden et al. 1999, Nature 400, 138; Wakker et al. 2003',
    distanceDisputed: false,
    radiusPc: 2400,
    sizeNote: 'half its 30° filament at 9 kpc (van Woerden et al. 1999)',
    note: 'The first high-velocity cloud to have its distance bracketed: 5 to 7 kpc above the plane.',
  },
];

/** The Large and Small Clouds on the sky, degrees, and their distances, pc (localGroup.ts). */
const LMC = { l: 280.465, b: -32.889, pc: 49_590 } as const;
const SMC = { l: 302.976, b: -44.008, pc: 62_440 } as const;
/** Nidever et al. 2008's Magellanic Stream coordinates: their great circle's pole. */
export const MS_POLE_DEG = { l: 188.5, b: -7.5 } as const;
/** Where L_MS = 0 is: the Large Cloud's centre, as they take it. */
const MS_ZERO_DEG = { l: 280.47, b: -32.75 } as const;

const toLb = (v: readonly [number, number, number]): [number, number] => [
  (((Math.atan2(v[1], v[0]) / DEG) % 360) + 360) % 360,
  Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG,
];

/** Galactic l, b of a point at Magellanic Stream longitude L_MS on its great circle (B_MS = 0), degrees. */
export function magellanicStreamLb(lMsDeg: number): [number, number] {
  const pole = galacticUnit(MS_POLE_DEG.l, MS_POLE_DEG.b);
  const zero = galacticUnit(MS_ZERO_DEG.l, MS_ZERO_DEG.b);
  const k = pole[0] * zero[0] + pole[1] * zero[1] + pole[2] * zero[2];
  const a0: [number, number, number] = [zero[0] - k * pole[0], zero[1] - k * pole[1], zero[2] - k * pole[2]];
  const n = Math.hypot(...a0);
  const a: [number, number, number] = [a0[0] / n, a0[1] / n, a0[2] / n];
  // The circle's second axis, pole x zero: L_MS falls toward the tail, which runs past the south
  // Galactic pole (interstellarClouds.test.ts).
  const c: [number, number, number] = [
    pole[1] * a[2] - pole[2] * a[1],
    pole[2] * a[0] - pole[0] * a[2],
    pole[0] * a[1] - pole[1] * a[0],
  ];
  const t = lMsDeg * DEG;
  return toLb([
    Math.cos(t) * a[0] + Math.sin(t) * c[0],
    Math.cos(t) * a[1] + Math.sin(t) * c[1],
    Math.cos(t) * a[2] + Math.sin(t) * c[2],
  ]);
}

/** Points along the Stream's great circle from L_MS `from` to `to`, every two degrees, at `pc`. */
function onStreamCircle(from: number, to: number, pc: number): (readonly [number, number, number])[] {
  const n = Math.max(1, Math.round(Math.abs(to - from) / 2));
  const points: (readonly [number, number, number])[] = [];
  for (let k = 0; k <= n; k += 1) {
    const [l, b] = magellanicStreamLb(from + ((to - from) * k) / n);
    points.push([l, b, pc]);
  }
  return points;
}

/** The Bridge: the great circle from the Large Cloud to the Small, its distance between theirs. */
function bridge(): (readonly [number, number, number])[] {
  const a = galacticUnit(LMC.l, LMC.b);
  const b = galacticUnit(SMC.l, SMC.b);
  const points: (readonly [number, number, number])[] = [];
  for (let k = 0; k <= 20; k += 1) {
    const t = k / 20;
    const v: [number, number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const n = Math.hypot(...v);
    const [l, lat] = toLb([v[0] / n, v[1] / n, v[2] / n]);
    points.push([l, lat, LMC.pc + (SMC.pc - LMC.pc) * t]);
  }
  return points;
}

const NOT_MEASURED = 'none measured along it: drawn at the Large Cloud’s, 49.6 kpc';
const NIDEVER = 'Nidever et al. 2008, ApJ 679, 432; 2010, ApJ 723, 1618';

export const MAGELLANIC_TRACKS: readonly MagellanicTrack[] = [
  {
    key: 'magellanic-stream',
    name: 'Magellanic Stream',
    aliases: ['MS'],
    points: onStreamCircle(0, -140, LMC.pc),
    distanceMethod: NOT_MEASURED,
    lengthNote: 'at least 140° of sky, behind the Clouds',
    note: 'Hydrogen torn from the Clouds, trailing them. Models put its tip at 80–230 kpc (Besla et al. 2012), or its nearest part at 20 (Lucchini et al. 2021).',
  },
  {
    key: 'leading-arm',
    name: 'Leading Arm',
    aliases: ['Magellanic Leading Arm'],
    points: onStreamCircle(0, 60, LMC.pc),
    distanceMethod: NOT_MEASURED,
    lengthNote: 'about 60° of sky, ahead of the Clouds; drawn along the Stream’s great circle, which it wanders from',
    note: 'Gas pulled out ahead of the Clouds, toward the Galactic plane.',
  },
  {
    key: 'magellanic-bridge',
    name: 'Magellanic Bridge',
    aliases: ['Bridge'],
    points: bridge(),
    distanceMethod: 'none measured along it: drawn from the Large Cloud’s 49.6 kpc to the Small’s 62.4',
    lengthNote: 'from the Large Cloud to the Small',
    note: 'Gas and young stars between the two Clouds, pulled out at their last close passage.',
  },
];

/** The colours of their rings, tracks and marks. */
export const CLOUD_COLOUR: Record<CloudKind, string> = {
  dark: '#8a7a6a',
  molecular: '#a08e78',
  ionised: '#e8786a',
  superbubble: '#b9a6e0',
  fast: '#7fb2e8',
  magellanic: '#7fb2e8',
};

export function interstellarCloudBodyId(cloud: { readonly key: string }): BodyId {
  return `ism-${cloud.key}`;
}

/** A place about the Sun, scene frame, km. */
function placeKm(lDeg: number, bDeg: number, pc: number): Vec3 {
  const u = galacticDirection(lDeg, bDeg);
  const d = pc * PARSEC_KM;
  return { x: u.x * d, y: u.y * d, z: u.z * d };
}

/** A cloud's centre about the Sun, scene frame, km. */
export function cloudPositionKm(cloud: InterstellarCloud): Vec3 {
  return placeKm(cloud.lDeg, cloud.bDeg, cloud.distancePc);
}

/** A track's points about the Sun, scene frame, km. */
export function trackPointsKm(track: MagellanicTrack): Vec3[] {
  return track.points.map(([l, b, pc]) => placeKm(l, b, pc));
}

/** Where a track's mark and name are: its middle point. */
export function trackMiddle(track: MagellanicTrack): readonly [number, number, number] {
  return track.points[Math.floor(track.points.length / 2)]!;
}

function formatPc(pc: number): string {
  if (pc >= 1000) return `${(pc / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} kpc`;
  if (pc < 1) return `${Math.round(pc * AU_PER_PC).toLocaleString('en-US')} AU`;
  return `${pc.toLocaleString('en-US', { maximumFractionDigits: pc < 20 ? 1 : 0 })} pc`;
}

function cloudRegion(cloud: InterstellarCloud): Region {
  const error =
    cloud.distanceUpPc === null || cloud.distanceDownPc === null
      ? ''
      : Math.abs(cloud.distanceUpPc - cloud.distanceDownPc) <= 0.05 * cloud.distanceUpPc
        ? ` ± ${formatPc(cloud.distanceUpPc)}`
        : ` +${formatPc(cloud.distanceUpPc)} −${formatPc(cloud.distanceDownPc)}`;
  const facts: RegionFact[] = [
    { label: 'Distance', value: `${formatPc(cloud.distancePc)}${error}` },
    { label: 'From', value: cloud.distanceMethod },
    { label: 'Source', value: cloud.distanceReference },
    {
      label: 'Radius',
      value: `${formatPc(cloud.radiusPc)}: ${cloud.sizeNote}`,
    },
    ...(cloud.aliases.length > 0 ? [{ label: 'Also', value: cloud.aliases.join(' · ') }] : []),
    ...(cloud.note === null ? [] : [{ label: 'Note', value: cloud.note }]),
    {
      label: 'Drawn',
      value: cloud.distanceDisputed
        ? 'a mark and a dashed ring of its size: its distance not settled'
        : 'a mark and a ring of its size',
    },
  ];
  return {
    id: interstellarCloudBodyId(cloud),
    name: cloud.name,
    layer: 'interstellar-cloud',
    kindLabel: cloud.distanceDisputed ? `${cloud.kindLabel} · distance uncertain` : cloud.kindLabel,
    measured: !cloud.distanceDisputed,
    facts,
    framingKm: 3 * cloud.radiusPc * PARSEC_KM,
    aliases: cloud.aliases,
    parent: null,
    color: CLOUD_COLOUR[cloud.kind],
  };
}

function trackRegion(track: MagellanicTrack): Region {
  return {
    id: interstellarCloudBodyId(track),
    name: track.name,
    layer: 'interstellar-cloud',
    kindLabel: 'H I gas · distance not measured',
    measured: false,
    facts: [
      { label: 'Distance', value: track.distanceMethod },
      { label: 'On the sky', value: `${track.lengthNote} (${NIDEVER})` },
      ...(track.aliases.length > 0 ? [{ label: 'Also', value: track.aliases.join(' · ') }] : []),
      { label: 'Note', value: track.note },
      {
        label: 'Drawn',
        value: 'its track on the sky, dashed: a mark at its middle',
      },
    ],
    // From far enough to see the Clouds and the track's reach.
    framingKm: 120_000 * PARSEC_KM,
    aliases: track.aliases,
    parent: null,
    color: CLOUD_COLOUR.magellanic,
  };
}

/** Makes the clouds and the Magellanic tracks bodies, at start (App.tsx): each a fixed place about the Sun. */
export function ensureInterstellarClouds(store: EphemerisStore): void {
  const places = [
    ...INTERSTELLAR_CLOUDS.map((cloud) => ({
      region: cloudRegion(cloud),
      at: cloudPositionKm(cloud),
    })),
    ...MAGELLANIC_TRACKS.map((track) => {
      const [l, b, pc] = trackMiddle(track);
      return { region: trackRegion(track), at: placeKm(l, b, pc) };
    }),
  ];
  const missing = places.filter(({ region }) => !store.isPropagatedBody(region.id));
  if (missing.length === 0) return;
  for (const { region } of missing) registerRegion(region);
  store.addPropagatedBodies(
    missing.map(({ region, at }) => {
      const still = { position: at, velocity: { x: 0, y: 0, z: 0 } };
      return {
        body: regionDefinition(regionOf(region.id)!),
        elements: null,
        state: () => still,
        options: { exact: true },
      };
    }),
  );
}
