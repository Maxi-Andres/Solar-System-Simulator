import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { redshiftDistances, mpcToKm, type RedshiftDistances } from './cosmology.ts';
import { FAR_LANDMARKS } from './farLandmarks.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * The record-holders (G4): the farthest of their kind -- galaxy, quasar, star, gamma-ray burst --
 * and the few far things everyone has heard of, each at its comoving distance from its redshift.
 *
 * ## Where each one is
 *
 * On the sky at its position (J2000; the paper's, or NED's where the paper gives none, each said
 * below), and out along it at the comoving distance its redshift has in Planck 2018's cosmology
 * (cosmology.ts): where it is now, on the Hubble flow, in the one instant the scene is -- as
 * Laniakea's galaxies are placed. Not where it was when its light left: MoM-z14, 33.9 billion ly
 * off now, was 2.2 billion ly off then, and its light has been 13.5 billion years on the way.
 * Each panel gives all three.
 *
 * ## The redshifts, and how sure each is
 *
 * A spectroscopic redshift is a line, or a break, measured in a spectrum: certain to the digits
 * given. A photometric one is the colours fitted to a template, and can be wrong outright -- HD1,
 * whose colours put it at z 13 in 2022, has a spectrum that puts it at z 4.0, a galaxy in front;
 * so it is drawn there, and says so. Each one's `how` says which, and with what.
 *
 * ## Checked
 *
 * Every number below was taken from its paper's abstract or tables (arXiv, the journal), on
 * 2026-11-13; positions from NED are marked "NED". SIMBAD was down that day, and nothing was
 * checked against it.
 */

// 'quasar-group' and 'deep-field' are farLandmarks.ts's, made bodies here with the record-holders.
export type RecordHolderKind = 'galaxy' | 'quasar' | 'star' | 'grb' | 'transient' | 'cluster' | 'supercluster' | 'quasar-group' | 'deep-field';

export interface RecordHolder {
  readonly key: string;
  readonly name: string;
  readonly otherNames: readonly string[];
  readonly kind: RecordHolderKind;
  /** What record it holds or held, a few words. */
  readonly record: string;
  readonly z: number;
  /** The redshift's uncertainty, either way, as the paper gives it; null where it gives none. */
  readonly zPlus: number | null;
  readonly zMinus: number | null;
  readonly spectroscopic: boolean;
  /** How the redshift was measured: instrument and line. */
  readonly how: string;
  readonly raDeg: number;
  readonly decDeg: number;
  /** Where the position is from. */
  readonly position: string;
  readonly reference: string;
  /** Anything disputed, or what the number is not. */
  readonly note: string | null;
}

export const RECORD_HOLDERS: readonly RecordHolder[] = [
  {
    key: 'mom-z14',
    name: 'MoM-z14',
    otherNames: [],
    kind: 'galaxy',
    record: 'Farthest galaxy confirmed',
    z: 14.44,
    zPlus: 0.02,
    zMinus: 0.02,
    spectroscopic: true,
    how: 'JWST NIRSpec prism: five ultraviolet emission lines and the Lyman break',
    raDeg: 150.0933255,
    decDeg: 2.2731627,
    position: 'the paper',
    reference: 'Naidu et al. 2026, Open J. Astrophys. 9 (arXiv 2505.11263)',
    note: null,
  },
  {
    key: 'jades-gs-z14-0',
    name: 'JADES-GS-z14-0',
    otherNames: [],
    kind: 'galaxy',
    record: 'Farthest galaxy, 2024–2025',
    z: 14.1796,
    zPlus: 0.0007,
    zMinus: 0.0007,
    spectroscopic: true,
    how: 'ALMA, the [O III] 88 µm line; first 14.32 from JWST NIRSpec’s Lyman break',
    raDeg: 53.082937,
    decDeg: -27.855631,
    position: 'Carniani et al. 2024',
    reference: 'Carniani et al. 2024, Nature 633, 318; 2025, A&A 696, A87',
    note: null,
  },
  {
    key: 'gn-z11',
    name: 'GN-z11',
    otherNames: [],
    kind: 'galaxy',
    record: 'Farthest galaxy, 2016–2022',
    z: 10.6034,
    zPlus: 0.0013,
    zMinus: 0.0013,
    spectroscopic: true,
    how: 'JWST NIRSpec: eight emission lines',
    raDeg: 189.1060542,
    decDeg: 62.2420489,
    position: 'NED',
    reference: 'Bunker et al. 2023, A&A 677, A88',
    note: null,
  },
  {
    key: 'uhz1',
    name: 'UHZ1',
    otherNames: ['UHZ-1'],
    kind: 'quasar',
    record: 'Farthest black hole seen in X-rays',
    z: 10.073,
    zPlus: 0.002,
    zMinus: 0.002,
    spectroscopic: true,
    how: 'JWST NIRSpec prism; Chandra’s X-rays from its black hole',
    raDeg: 3.567070796,
    decDeg: -30.3778606,
    position: 'Goulding et al. 2023',
    reference: 'Goulding et al. 2023, ApJL 955, L24; Bogdán et al. 2024, Nat. Astron. 8, 126',
    note: 'Behind Abell 2744, magnified by it. Its black hole’s mass, 1e7–1e8 M☉, assumes it feeds at the Eddington limit.',
  },
  {
    key: 'hd1',
    name: 'HD1',
    otherNames: [],
    kind: 'galaxy',
    record: 'Claimed farthest galaxy, 2022: not',
    z: 4.0,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'JWST NIRSpec prism: a Balmer break, not a Lyman break',
    raDeg: 150.463792,
    decDeg: 2.547222,
    position: 'Harikane et al. 2025',
    reference: 'Harikane et al. 2022, ApJ 929, 1; 2025, ApJ 980, 138',
    note: 'Its colours put it at z 12–13, a tentative ALMA line at 13.27; its spectrum puts it at z 4.0, a galaxy in front.',
  },
  {
    key: 'earendel',
    name: 'Earendel',
    otherNames: ['WHL0137-LS'],
    kind: 'star',
    record: 'Farthest single star, if one',
    z: 5.926,
    zPlus: 0.013,
    zMinus: 0.012,
    spectroscopic: true,
    how: 'JWST NIRSpec prism: its galaxy’s (the Sunrise Arc’s) emission lines; first 6.2 from colours',
    raDeg: 24.346875,
    decDeg: -8.464519,
    position: 'NED',
    reference: 'Welch et al. 2022, Nature 603, 815; Pascale et al. 2025, ApJL 988, L76',
    note: 'Its spectrum fits a star cluster as well as a star: disputed. Magnified by the cluster WHL0137-08 in front.',
  },
  {
    key: 'eucl-j1729',
    name: 'EUCL J1729+6410',
    otherNames: ['EUCL J172902.75+641018.1'],
    kind: 'quasar',
    record: 'Farthest quasar',
    z: 7.77,
    zPlus: 0.05,
    zMinus: 0.05,
    spectroscopic: true,
    how: 'Keck MOSFIRE and LBT LUCI: Lyman-alpha and the Gunn–Peterson trough',
    raDeg: 262.261458,
    decDeg: 64.171694,
    position: 'Yang et al. 2026',
    reference: 'Yang et al. 2026, A&A 711, A104 (Euclid)',
    note: null,
  },
  {
    key: 'j0313-1806',
    name: 'J0313−1806',
    otherNames: ['J0313-1806', 'J031343.84-180636.4'],
    kind: 'quasar',
    record: 'Farthest quasar, 2021–2026',
    z: 7.6423,
    zPlus: 0.0013,
    zMinus: 0.0013,
    spectroscopic: true,
    how: 'ALMA, the [C II] 158 µm line',
    raDeg: 48.432667,
    decDeg: -18.110111,
    position: 'Wang et al. 2021',
    reference: 'Wang et al. 2021, ApJL 907, L1',
    note: 'Its black hole 1.6 billion M☉, from its Mg II line.',
  },
  {
    key: 'grb-090429b',
    name: 'GRB 090429B',
    otherNames: [],
    kind: 'grb',
    record: 'Farthest gamma-ray burst, by its colours',
    z: 9.4,
    zPlus: 0.12,
    zMinus: 0.34,
    spectroscopic: false,
    how: 'Photometric: its afterglow’s colours (Gemini, UKIRT)',
    raDeg: 210.667125,
    decDeg: 32.170528,
    position: 'NED',
    reference: 'Cucchiara et al. 2011, ApJ 736, 7',
    note: 'No spectrum: 9.06–9.52 at 90 %, with a small chance of far less.',
  },
  {
    key: 'grb-090423',
    name: 'GRB 090423',
    otherNames: [],
    kind: 'grb',
    record: 'Farthest gamma-ray burst with a spectrum',
    z: 8.26,
    zPlus: 0.07,
    zMinus: 0.08,
    spectroscopic: true,
    how: 'VLT ISAAC and SINFONI: the Lyman-alpha break',
    raDeg: 148.888599,
    decDeg: 18.14941,
    position: 'NED',
    reference: 'Tanvir et al. 2009, Nature 461, 1254; Salvaterra et al. 2009, Nature 461, 1258',
    note: null,
  },
  {
    key: 'grb-250314a',
    name: 'GRB 250314A',
    otherNames: [],
    kind: 'grb',
    record: 'Farthest supernova seen, with its burst',
    z: 7.3,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'VLT X-shooter: the Lyman-alpha break; JWST saw the supernova',
    raDeg: 201.30125,
    decDeg: -5.28225,
    position: 'NED',
    reference: 'Cordier et al. 2025, A&A 704, L7; Levan et al. 2025, A&A 704, L8',
    note: null,
  },
  {
    key: 'ton-618',
    name: 'TON 618',
    otherNames: ['Tonantzintla 618', 'FBQS J122824.9+312837'],
    kind: 'quasar',
    record: 'Among the most massive black holes',
    z: 2.219,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its broad emission lines',
    raDeg: 187.1040249,
    decDeg: 31.4771192,
    position: 'NED',
    reference: 'Shemmer et al. 2004, ApJ 614, 547',
    note: 'Its 66 billion M☉ is one spectrum’s H-beta line width: uncertain by a factor of two or three.',
  },
  {
    key: 'el-gordo',
    name: 'El Gordo',
    otherNames: ['ACT-CL J0102-4915'],
    kind: 'cluster',
    record: 'Most massive cluster that far',
    z: 0.87,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'VLT FORS2: 89 of its galaxies',
    raDeg: 15.71875,
    decDeg: -49.249444,
    position: 'NED',
    reference: 'Menanteau et al. 2012, ApJ 748, 7',
    note: null,
  },
  {
    key: 'abell-2744',
    name: 'Abell 2744',
    otherNames: ['Pandora’s Cluster', 'Pandora Cluster'],
    kind: 'cluster',
    record: 'Four clusters colliding',
    z: 0.308,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its galaxies’ spectra',
    raDeg: 3.58641,
    decDeg: -30.39997,
    position: 'NED',
    reference: 'Jauzac et al. 2016, MNRAS 463, 3876',
    note: null,
  },
  {
    key: 'bullet-cluster',
    name: 'Bullet Cluster',
    otherNames: ['1E 0657-558', '1E 0657-56'],
    kind: 'cluster',
    record: 'Dark matter seen apart from gas',
    z: 0.296,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its galaxies’ spectra',
    raDeg: 104.6317,
    decDeg: -55.9465,
    position: 'NED',
    reference: 'Clowe et al. 2006, ApJ 648, L109',
    note: null,
  },
  {
    key: 'saraswati',
    name: 'Saraswati Supercluster',
    otherNames: ['Saraswati'],
    kind: 'supercluster',
    record: 'Among the largest superclusters',
    z: 0.28,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'SDSS: its 43 clusters’ galaxies; marked at Abell 2631, its centre',
    raDeg: 354.41553,
    decDeg: 0.27137,
    position: 'Bagchi et al. 2017 (Abell 2631’s brightest galaxy)',
    reference: 'Bagchi et al. 2017, ApJ 844, 25',
    note: 'At least 200 Mpc across: a mark at its centre, not its extent.',
  },
  {
    key: 'asassn-15lh',
    name: 'ASASSN-15lh',
    otherNames: ['SN 2015L'],
    kind: 'transient',
    record: 'Most luminous supernova, if one',
    z: 0.2326,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'SALT and Magellan: Mg II absorption',
    raDeg: 330.564375,
    decDeg: -61.659611,
    position: 'Dong et al. 2016',
    reference: 'Dong et al. 2016, Science 351, 257; Leloudas et al. 2016, Nat. Astron. 1, 0002',
    note: 'More likely a star torn apart by a spinning black hole than a supernova (Leloudas et al.).',
  },
  {
    key: '3c-273',
    name: '3C 273',
    otherNames: [],
    kind: 'quasar',
    record: 'The first quasar found, the brightest',
    z: 0.158339,
    zPlus: 0.000067,
    zMinus: 0.000067,
    spectroscopic: true,
    how: 'Its emission lines',
    raDeg: 187.2779154,
    decDeg: 2.0523883,
    position: 'NED',
    reference: 'Strauss et al. 1992, ApJS 83, 29 (via NED)',
    note: null,
  },
  {
    key: 'grb-221009a',
    name: 'GRB 221009A',
    otherNames: ['BOAT'],
    kind: 'grb',
    record: 'Brightest gamma-ray burst seen',
    z: 0.151,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'VLT X-shooter: its galaxy’s lines',
    raDeg: 288.2645,
    decDeg: 19.7735,
    position: 'NED',
    reference: 'Malesani et al. 2025, A&A 701, A134',
    note: null,
  },
];

/** What a record-holder is, as its panel and the search say it. */
export function recordHolderKindLabel(kind: RecordHolderKind): string {
  switch (kind) {
    case 'galaxy':
      return 'Galaxy';
    case 'quasar':
      return 'Quasar';
    case 'star':
      return 'Lensed star';
    case 'grb':
      return 'Gamma-ray burst';
    case 'transient':
      return 'Transient';
    case 'cluster':
      return 'Galaxy cluster';
    case 'supercluster':
      return 'Supercluster';
    case 'quasar-group':
      return 'Large quasar group';
    case 'deep-field':
      return 'Deep field';
  }
}

/** The pseudo-kind the Observable Universe layer switches them by (floatingOrigin.ts isShown). */
export const RECORD_HOLDER_LAYER = 'record-holder';

/** A record-holder's mark and name: a pale violet, apart from the structures' gold. */
export const RECORD_HOLDER_COLOR = '#c4b2ec';

export function recordHolderBodyId(holder: Pick<RecordHolder, 'key'>): BodyId {
  return `far-${holder.key}`;
}

// With them the far landmarks (farLandmarks.ts): the same kind of body, not counted among the record-holders.
const byId = new Map<BodyId, RecordHolder>([...RECORD_HOLDERS, ...FAR_LANDMARKS].map((holder) => [recordHolderBodyId(holder), holder]));

export function recordHolderOf(id: BodyId | null): RecordHolder | null {
  return id === null ? null : (byId.get(id) ?? null);
}

const distances = new Map<string, RedshiftDistances>();

/** Its distances and times, Planck 2018 (cosmology.ts). */
export function recordHolderDistances(holder: RecordHolder): RedshiftDistances {
  const known = distances.get(holder.key);
  if (known !== undefined) return known;
  const computed = redshiftDistances(holder.z);
  distances.set(holder.key, computed);
  return computed;
}

const DEG = Math.PI / 180;
/** The ecliptic's obliquity at J2000, the scene's (orientation.ts OBLIQUITY_J2000_DEG), kept here so search.ts can reach this module light. */
const OBLIQUITY = 23.439291111111111 * DEG;

/** Its direction from the Sun, scene frame (ecliptic J2000): RA and Dec turned by the obliquity. */
export function recordHolderDirection(holder: Pick<RecordHolder, 'raDeg' | 'decDeg'>): Vec3 {
  const ra = holder.raDeg * DEG;
  const dec = holder.decDeg * DEG;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  return { x, y: c * y + s * z, z: -s * y + c * z };
}

/** Where it is, km from the Sun, scene frame: its comoving distance along its direction. */
export function recordHolderPositionKm(holder: RecordHolder): Vec3 {
  const d = mpcToKm(recordHolderDistances(holder).comovingMpc);
  const u = recordHolderDirection(holder);
  return { x: u.x * d, y: u.y * d, z: u.z * d };
}

/**
 * How far from it the camera stands when going to it, km: a billion light years, on the Sun's
 * side, looking out along our line of sight to it -- as it is seen, the CMB's sphere behind it.
 * Each is a mark: a galaxy at z 14 is a few hundred parsecs across, nothing to frame.
 */
export const RECORD_HOLDER_FRAMING_KM = 1e9 * 299_792.458 * 365.25 * 86_400;

/** Earth's view of it: the camera on the Sun's side, looking out, north up (as structureEarthView). */
export function recordHolderEarthView(holder: RecordHolder): { direction: [number, number, number]; up: [number, number, number] } {
  const { north, away } = skyAxes(recordHolderDirection(holder));
  return { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] };
}

function definition(holder: RecordHolder): BodyDefinition {
  // A parsec: a radius for the camera to keep clear of, as a structure's; the mark is the body.
  const radius = (149_597_870.7 * 648_000) / Math.PI;
  return {
    id: recordHolderBodyId(holder),
    name: holder.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'structure',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: RECORD_HOLDER_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** The record-holders made bodies, from the start (App.tsx): every number is here. */
export function ensureRecordHolders(store: EphemerisStore): void {
  const missing = [...RECORD_HOLDERS, ...FAR_LANDMARKS].filter((holder) => !store.isPropagatedBody(recordHolderBodyId(holder)));
  if (missing.length === 0) return;
  store.addPropagatedBodies(
    missing.map((holder) => {
      const state: StateVector = { position: recordHolderPositionKm(holder), velocity: { x: 0, y: 0, z: 0 } };
      return { body: definition(holder), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}

/** Their other names, for the search, as a satellite's catalogue names are (search.ts). */
export function recordHolderAliases(id: BodyId): string {
  const holder = recordHolderOf(id);
  return holder === null ? '' : holder.otherNames.join(' ');
}

/** A light year in km, for the fade below. */
const LIGHT_YEAR_KM = 299_792.458 * 365.25 * 86_400;

/**
 * When their marks and names are drawn, light years from the Sun: none of them nearer than
 * RECORD_HOLDERS_FROM_LY, all from RECORD_HOLDERS_FULL_LY, smoothly in the logarithm -- past
 * Laniakea's view and the Nearby Universe's (1.8 and 1.5 billion), so neither has a second sky
 * of names, 13 to 34 billion ly behind its own. The focused one is always drawn.
 */
export const RECORD_HOLDERS_FROM_LY = 3e9;
export const RECORD_HOLDERS_FULL_LY = 10e9;

export function recordHoldersFade(cameraFromSunKm: number): number {
  const ly = cameraFromSunKm / LIGHT_YEAR_KM;
  if (!(ly > RECORD_HOLDERS_FROM_LY)) return 0;
  const t = Math.min(1, (Math.log(ly) - Math.log(RECORD_HOLDERS_FROM_LY)) / (Math.log(RECORD_HOLDERS_FULL_LY) - Math.log(RECORD_HOLDERS_FROM_LY)));
  return t * t * (3 - 2 * t);
}
