import {
  LANIAKEA_FLAGS,
  LANIAKEA_METHODS,
  LANIAKEA_RECORD_FLOATS,
  type BodyDefinition,
  type BodyId,
  type LaniakeaBasinGrid,
  type LaniakeaGroups,
  type LaniakeaInfo,
  type LaniakeaLandmark,
  type LaniakeaNames,
} from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import { aliasField, type Searchable } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { structureBodies } from './structures.ts';
import { colourIndex, type LocalGroupGalaxy } from './localGroup.ts';
import { volumeClass, volumeModel, axisRatioFromInclination, bulgeShare, BULGE_LEAST_SHARE, inclinationFromAxisRatio } from './localVolume.ts';
import { normalizeName } from './search.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector } from './vec3.ts';

/**
 * Laniakea and what lies about it (G3): 86,899 galaxies out to 700 Mpc, the groups they were
 * placed with, the Cosmicflows-4 reconstruction's watersheds, and the named clusters,
 * superclusters, basins, voids and walls -- from laniakea/ (tools/src/laniakea/).
 *
 * ## Measured
 *
 * Cosmicflows-4's 55,000 distances (Tully et al. 2023, ApJ 944, 94) and the 2MASS Redshift
 * Survey's 43,000 redshifts (Huchra et al. 2012, ApJS 199, 26), merged and placed by the tool:
 * each galaxy at its own measured distance, its group's, or -- a fifth of them -- its redshift's,
 * with HyperLEDA's photometry and shapes (Makarov et al. 2014). Every place is comoving: the
 * scene is one instant, and the light of each galaxy left it long ago, the farthest 2.2 billion
 * years ago -- the map is where they are on the Hubble flow, not where they were seen.
 *
 * ## Estimated, and said so
 *
 * A distance by redshift (flag DISTANCE_REDSHIFT), a group's mean redshift (GROUP_REDSHIFT), a
 * place along the line of sight within its group (DEPTH_DRAWN), a distance linked from a 2MASS
 * group (DISTANCE_LINKED); B-V by type, V from K by type, the half-light radius from D25 or the K
 * isophote: always estimated (LaniakeaInfo.calibration). The flags are in the record; each panel
 * says which.
 *
 * ## Drawn as
 *
 * Each galaxy a point holding all its light (scene/Laniakea.tsx), and the few the camera is
 * near as volumes, by the same profiles as the Local Volume's (localVolume.ts volumeClass and
 * volumeModel): a dwarf a Plummer ellipsoid, a disc an exponential disc with its bulge, an
 * elliptical de Vaucouleurs's ellipsoid. A galaxy is a LocalGroupGalaxy only when it needs to
 * be -- drawn as a volume, or gone to -- made from its record here (`laniakeaGalaxy`).
 */

// ---------------------------------------------------------------------------------------
// The record

/** The record's fields, by offset (tools/src/types.ts LANIAKEA_RECORD_FLOATS). */
export const FIELD = { x: 0, y: 1, z: 2, absV: 3, bv: 4, rePc: 5, q: 6, pa: 7, incl: 8, t: 9, flags: 10, group: 11 } as const;

/** The Sun's absolute V (Willmer 2018, ApJS 236, 47), as localGroup.ts. */
const SUN_ABSOLUTE_V = 4.81;

/** A group's radius drawn about its brightest, pc: never less than this, nor more than the most. */
export const GROUP_RADIUS_LEAST_PC = 150_000;
export const GROUP_RADIUS_MOST_PC = 3_000_000;

/** A galaxy of no group is a place of its own within this many half-light radii of it (its marks). */
export const FIELD_GALAXY_REACH = 10;

/** What a structure's mark and name are drawn in: a pale gold, apart from the galaxies' blue. */
export const STRUCTURE_COLOR = '#d9c38e';

export interface LaniakeaCatalogue {
  readonly info: LaniakeaInfo;
  readonly count: number;
  /** count x LANIAKEA_RECORD_FLOATS, most luminous first. */
  readonly records: Float32Array;
  /** Per group (groups.json's order): its brightest member here, -1 none; its radius, pc; members here. */
  readonly groupBrightest: Int32Array;
  readonly groupRadiusPc: Float32Array;
  readonly groupMembers: Int32Array;
  /** The landmark a group is, by group index. */
  readonly groupLandmark: ReadonlyMap<number, number>;
  /** The basins (basins.bin), or null where the file is not there. */
  readonly basins: BasinGrids | null;
}

/** basins.bin, its three grids. */
export interface BasinGrids {
  readonly size: readonly [number, number, number];
  readonly offset: readonly [number, number, number];
  readonly voxelPc: number;
  /** Column-major, as LaniakeaGrid.voxelToScene. */
  readonly voxelToScene: readonly number[];
  /** Scene to voxel indices, column-major. */
  readonly sceneToVoxel: readonly number[];
  readonly grids: Readonly<Record<LaniakeaBasinGrid, Uint8Array>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Checks laniakea.json is the shape this reads. */
export function parseLaniakeaInfo(raw: unknown): LaniakeaInfo {
  if (
    !isRecord(raw) ||
    !isRecord(raw['galaxies']) ||
    raw['galaxies']['recordFloats'] !== LANIAKEA_RECORD_FLOATS ||
    typeof raw['galaxies']['count'] !== 'number' ||
    !Array.isArray(raw['landmarks']) ||
    !isRecord(raw['basins'])
  ) {
    throw new Error('laniakea.json is not the description of a Laniakea catalogue this app reads.');
  }
  return raw as unknown as LaniakeaInfo;
}

/** The records of galaxies.bin, checked against laniakea.json's count. */
export function parseGalaxyRecords(buffer: ArrayBuffer, count: number): Float32Array {
  const expected = count * LANIAKEA_RECORD_FLOATS * 4;
  if (buffer.byteLength !== expected) {
    throw new Error(`galaxies.bin is ${buffer.byteLength} bytes, not the ${expected} laniakea.json says.`);
  }
  return new Float32Array(buffer);
}

/** A 4x4 column-major matrix's inverse (general; three's Matrix4.invert, without three). */
export function invert4(m: readonly number[]): number[] {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m as [
    number, number, number, number, number, number, number, number,
    number, number, number, number, number, number, number, number,
  ];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

/** A column-major 4x4 applied to a point. */
export function transformPoint(m: readonly number[], p: readonly [number, number, number]): [number, number, number] {
  return [
    m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
    m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
    m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
  ];
}

/** basins.bin's grids, checked against laniakea.json. */
export function parseBasins(buffer: ArrayBuffer, info: LaniakeaInfo): BasinGrids {
  const b = info.basins;
  const voxels = b.size[0] * b.size[1] * b.size[2];
  if (buffer.byteLength !== voxels * b.grids.length) {
    throw new Error(`basins.bin is ${buffer.byteLength} bytes, not the ${voxels * b.grids.length} laniakea.json says.`);
  }
  const grids = {} as Record<LaniakeaBasinGrid, Uint8Array>;
  b.grids.forEach((grid, i) => {
    grids[grid] = new Uint8Array(buffer, i * voxels, voxels);
  });
  return {
    size: b.size,
    offset: b.offset,
    voxelPc: b.voxelPc,
    voxelToScene: b.voxelToScene,
    sceneToVoxel: invert4(b.voxelToScene),
    grids,
  };
}

/** The basin label of `grid` at a place in the scene, pc: the nearest voxel's; 0 outside the grid or in none. */
export function basinAt(basins: BasinGrids, grid: LaniakeaBasinGrid, scenePc: readonly [number, number, number]): number {
  const [fi, fj, fk] = transformPoint(basins.sceneToVoxel, scenePc);
  const i = Math.round(fi);
  const j = Math.round(fj);
  const k = Math.round(fk);
  const [nx, ny, nz] = basins.size;
  if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) {
    return 0;
  }
  return basins.grids[grid][i + nx * (j + ny * k)]!;
}

/**
 * Each group's brightest member here -- the records are most luminous first, so the first of
 * each group met -- its members, and its radius: the farthest member from the brightest, held
 * between GROUP_RADIUS_LEAST_PC and GROUP_RADIUS_MOST_PC.
 */
export function indexGroups(records: Float32Array, count: number, groups: number) {
  const brightest = new Int32Array(groups).fill(-1);
  const radius = new Float32Array(groups);
  const members = new Int32Array(groups);
  const R = LANIAKEA_RECORD_FLOATS;
  for (let k = 0; k < count; k += 1) {
    const g = records[k * R + FIELD.group]!;
    if (!(g >= 0) || g >= groups) continue;
    members[g] = members[g]! + 1;
    const b = brightest[g]!;
    if (b < 0) {
      brightest[g] = k;
      continue;
    }
    const d = Math.hypot(
      records[k * R]! - records[b * R]!,
      records[k * R + 1]! - records[b * R + 1]!,
      records[k * R + 2]! - records[b * R + 2]!,
    );
    if (d > radius[g]!) radius[g] = d;
  }
  for (let g = 0; g < groups; g += 1) {
    radius[g] = Math.min(GROUP_RADIUS_MOST_PC, Math.max(GROUP_RADIUS_LEAST_PC, radius[g]!));
  }
  return { brightest, radius, members };
}

export function indexLaniakea(info: LaniakeaInfo, records: Float32Array, basins: BasinGrids | null): LaniakeaCatalogue {
  const count = info.galaxies.count;
  const groups = indexGroups(records, count, info.groups.count);
  const groupLandmark = new Map<number, number>();
  info.landmarks.forEach((landmark, i) => {
    if (landmark.group >= 0) groupLandmark.set(landmark.group, i);
  });
  return {
    info,
    count,
    records,
    groupBrightest: groups.brightest,
    groupRadiusPc: groups.radius,
    groupMembers: groups.members,
    groupLandmark,
    basins,
  };
}

// ---------------------------------------------------------------------------------------
// A record's numbers

const R = LANIAKEA_RECORD_FLOATS;

function field(c: Pick<LaniakeaCatalogue, 'records'>, k: number, f: number): number | null {
  const v = c.records[k * R + f]!;
  return Number.isNaN(v) ? null : v;
}

export function positionPc(c: Pick<LaniakeaCatalogue, 'records'>, k: number): [number, number, number] {
  return [c.records[k * R]!, c.records[k * R + 1]!, c.records[k * R + 2]!];
}

export function flagsOf(c: Pick<LaniakeaCatalogue, 'records'>, k: number): number {
  return c.records[k * R + FIELD.flags]! | 0;
}

export function groupOf(c: Pick<LaniakeaCatalogue, 'records'>, k: number): number {
  const g = c.records[k * R + FIELD.group]!;
  return g >= 0 ? g | 0 : -1;
}

/** Its luminosity, solar V; 0 with no V. */
export function luminosityOf(c: Pick<LaniakeaCatalogue, 'records'>, k: number): number {
  const absV = c.records[k * R + FIELD.absV]!;
  return Number.isNaN(absV) ? 0 : 10 ** (-0.4 * (absV - SUN_ABSOLUTE_V));
}

const OBLIQUITY = (84381.448 / 3600) * (Math.PI / 180);

/** Its place on the sky, J2000, from its place in the scene frame (ICRS turned by the obliquity). */
export function skyOf(p: readonly [number, number, number]): { raDeg: number; decDeg: number; distancePc: number } {
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  const x = p[0];
  const y = p[1] * c - p[2] * s;
  const z = p[1] * s + p[2] * c;
  const r = Math.hypot(x, y, z);
  const ra = (Math.atan2(y, x) * 180) / Math.PI;
  return { raDeg: ra < 0 ? ra + 360 : ra, decDeg: (Math.asin(z / r) * 180) / Math.PI, distancePc: r };
}

/** How its distance was had, as its panel says it. */
export function distanceSource(flags: number): string {
  const F = LANIAKEA_FLAGS;
  if (flags & F.DISTANCE_OWN) return 'Cosmicflows-4';
  if (flags & F.DISTANCE_GROUP) return 'its group’s, Cosmicflows-4';
  if (flags & F.DISTANCE_LINKED) return 'its 2MASS group’s, Cosmicflows-4';
  if (flags & F.GROUP_REDSHIFT) return 'its group’s redshift, estimated';
  return 'its redshift, estimated';
}

/** Whether its distance is an estimate: by redshift. */
export function distanceEstimated(flags: number): boolean {
  return (flags & LANIAKEA_FLAGS.DISTANCE_REDSHIFT) !== 0;
}

/** The methods of a details.bin bitfield, named. */
export function methodNames(bits: number): string[] {
  return Object.entries(LANIAKEA_METHODS)
    .filter(([, bit]) => (bits & bit) !== 0)
    .map(([name]) => (name === 'SNIa' ? 'SN Ia' : name === 'SNII' ? 'SN II' : name));
}

/** Its key, for its body id. */
export function laniakeaKey(k: number): string {
  return `lk-${k}`;
}

/**
 * A record as a galaxy (localGroup.ts), for a body or a volume: placed where the record puts
 * it, its V the one its luminosity has at that distance (so galaxyLuminosity is its own), its
 * profile by volumeClass and volumeModel as the Local Volume's (see the header).
 */
export function laniakeaGalaxy(c: Pick<LaniakeaCatalogue, 'records'>, k: number, name = `Galaxy ${k}`, otherNames: readonly string[] = []): LocalGroupGalaxy {
  const p = positionPc(c, k);
  const sky = skyOf(p);
  const absV = field(c, k, FIELD.absV);
  const vMag = absV === null ? null : absV + 5 * Math.log10(sky.distancePc / 10);
  const t = field(c, k, FIELD.t);
  const kind = volumeClass(t, null, absV);
  const pa = field(c, k, FIELD.pa);
  const q = field(c, k, FIELD.q);
  const incl = field(c, k, FIELD.incl);
  let inclinationDeg = 0;
  let fromAxisRatio = false;
  if (kind === 'disc' && pa !== null) {
    if (incl !== null) {
      inclinationDeg = incl;
    } else if (q !== null) {
      inclinationDeg = inclinationFromAxisRatio(q);
      fromAxisRatio = true;
    }
  }
  const axisRatio =
    pa === null ? 1 : kind === 'disc' ? (q ?? axisRatioFromInclination(inclinationDeg)) : Math.min(1, Math.max(0.05, q ?? 1));
  const share = kind === 'disc' && t !== null ? bulgeShare(t) : 0;
  const re = field(c, k, FIELD.rePc);
  const flags = flagsOf(c, k);
  const model = volumeModel({
    kind,
    scalePc: re === null ? null : kind === 'disc' ? re / 1.678 : re,
    sizeFrom: re === null ? null : 'half-light-estimated',
    axisRatio,
    positionAngleDeg: pa,
    inclinationDeg,
    inclinationFromAxisRatio: fromAxisRatio,
    bulgeShare: share >= BULGE_LEAST_SHARE ? share : 0,
  });
  const bv = field(c, k, FIELD.bv);
  const luminosity = absV === null ? null : 10 ** (-0.4 * (absV - SUN_ABSOLUTE_V));
  return {
    key: laniakeaKey(k),
    name,
    otherNames,
    catalogueIndex: null,
    ambiguous: false,
    raDeg: sky.raDeg,
    decDeg: sky.decDeg,
    distancePc: sky.distancePc,
    distanceUpPc: null,
    distanceDownPc: null,
    distanceSource: distanceSource(flags),
    vMag,
    colourIndex: bv ?? colourIndex(null, luminosity),
    model,
    shapeSource: flags & LANIAKEA_FLAGS.SIZE_FROM_K ? 'HyperLEDA, 2MRS; radius estimated' : 'HyperLEDA; radius estimated',
    giant: false,
    laniakeaIndex: k,
  };
}

// ---------------------------------------------------------------------------------------
// The lazy files: names, groups, details

export interface LaniakeaNameIndex {
  readonly names: LaniakeaNames;
  readonly search: Searchable;
  /** Other names by record. */
  readonly others: ReadonlyMap<number, readonly string[]>;
}

export function indexNames(names: LaniakeaNames): LaniakeaNameIndex {
  if (!Array.isArray(names.name) || names.name.length !== names.count) {
    throw new Error('laniakea/names.json does not have one name a galaxy.');
  }
  const others = new Map<number, readonly string[]>(names.otherNames.map(([k, list]) => [k, list]));
  return {
    names,
    others,
    search: {
      display: names.name.map(normalizeName),
      designation: names.name.map((_, k) => aliasField(others.get(k) ?? [])),
    },
  };
}

export interface LaniakeaDetails {
  readonly pgc: Uint32Array;
  readonly redshift: Float32Array;
  readonly luminosityDistancePc: Float32Array;
  readonly distanceErrorPc: Float32Array;
  readonly ownDistancePc: Float32Array;
  readonly vMag: Float32Array;
  readonly kMag: Float32Array;
  readonly methods: Uint8Array;
}

/** details.bin, its columns (LaniakeaInfo.galaxies.details). */
export function parseDetails(buffer: ArrayBuffer, count: number): LaniakeaDetails {
  if (buffer.byteLength !== count * 29) {
    throw new Error(`details.bin is ${buffer.byteLength} bytes, not ${count * 29}.`);
  }
  // Copied out, as the columns of Float32 do not start on a multiple of four after the PGCs' Uint32 always.
  const view = new DataView(buffer);
  const u32 = (at: number) => {
    const out = new Uint32Array(count);
    for (let k = 0; k < count; k += 1) out[k] = view.getUint32(at + k * 4, true);
    return out;
  };
  const f32 = (at: number) => {
    const out = new Float32Array(count);
    for (let k = 0; k < count; k += 1) out[k] = view.getFloat32(at + k * 4, true);
    return out;
  };
  const column = (i: number) => count * 4 * i;
  return {
    pgc: u32(0),
    redshift: f32(column(1)),
    luminosityDistancePc: f32(column(2)),
    distanceErrorPc: f32(column(3)),
    ownDistancePc: f32(column(4)),
    vMag: f32(column(5)),
    kMag: f32(column(6)),
    methods: new Uint8Array(buffer.slice(column(7), column(7) + count)),
  };
}

export function parseGroups(raw: unknown): LaniakeaGroups {
  if (!isRecord(raw) || typeof raw['count'] !== 'number' || !Array.isArray(raw['name'])) {
    throw new Error('laniakea/groups.json is not the groups this app reads.');
  }
  return raw as unknown as LaniakeaGroups;
}

// ---------------------------------------------------------------------------------------
// Loading

/** The catalogue last read, for the panels, the marks' hosts and the breadcrumb. */
let readCatalogue: LaniakeaCatalogue | null = null;

export function laniakeaCatalogue(): LaniakeaCatalogue | null {
  return readCatalogue;
}

/** For the tests: as if it had been read. */
export function setLaniakeaCatalogue(c: LaniakeaCatalogue | null): void {
  readCatalogue = c;
}

/**
 * laniakea.json, then galaxies.bin and basins.bin together, each streamed into one buffer of
 * the size laniakea.json gives. No laniakea.json: no G3 data published, nothing drawn.
 */
export async function loadLaniakeaCatalogue(fetchers: BeltFetchers, basePath = '/'): Promise<LaniakeaCatalogue | null> {
  const raw = await fetchers.json(`${basePath}data/laniakea/laniakea.json`);
  if (raw === null) {
    console.warn('The published data has no laniakea/laniakea.json: nothing beyond the Virgo Cluster is shown.');
    return null;
  }
  const info = parseLaniakeaInfo(raw);
  const [galaxies, basins] = await Promise.all([
    fetchers.binary(`${basePath}data/laniakea/${info.galaxies.file}`, { expectedBytes: info.galaxies.bytes }),
    fetchers.binary(`${basePath}data/laniakea/${info.basins.file}`, { expectedBytes: info.basins.bytes }),
  ]);
  if (galaxies === null) {
    return null;
  }
  const catalogue = indexLaniakea(info, parseGalaxyRecords(galaxies, info.galaxies.count), basins === null ? null : parseBasins(basins, info));
  readCatalogue = catalogue;
  return catalogue;
}

let readNames: LaniakeaNameIndex | null = null;
let readDetails: LaniakeaDetails | null = null;
let readGroups: LaniakeaGroups | null = null;

export function laniakeaNames(): LaniakeaNameIndex | null {
  return readNames;
}
export function laniakeaDetails(): LaniakeaDetails | null {
  return readDetails;
}
export function laniakeaGroups(): LaniakeaGroups | null {
  return readGroups;
}

export async function loadLaniakeaNames(fetchers: BeltFetchers, basePath = '/'): Promise<LaniakeaNameIndex | null> {
  const raw = await fetchers.json(`${basePath}data/laniakea/names.json`);
  if (raw === null) return null;
  readNames = indexNames(raw as LaniakeaNames);
  return readNames;
}

/** The details and the groups, for a galaxy's panel: fetched together the first time one is opened. */
export async function loadLaniakeaExtras(
  fetchers: BeltFetchers,
  basePath = '/',
): Promise<{ details: LaniakeaDetails | null; groups: LaniakeaGroups | null } | null> {
  const info = readCatalogue?.info;
  if (info === undefined) return null;
  const [details, groups] = await Promise.all([
    fetchers.binary(`${basePath}data/laniakea/${info.galaxies.details.file}`, { expectedBytes: info.galaxies.details.bytes }),
    fetchers.json(`${basePath}data/laniakea/${info.groups.file}`),
  ]);
  readDetails = details === null ? null : parseDetails(details, info.galaxies.count);
  readGroups = groups === null ? null : parseGroups(groups);
  return { details: readDetails, groups: readGroups };
}

// ---------------------------------------------------------------------------------------
// The named structures, as bodies

/** A structure's key: "Coma Cluster" coma-cluster. */
export function landmarkKey(landmark: Pick<LaniakeaLandmark, 'name'>): string {
  return landmark.name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function structureBodyId(landmark: Pick<LaniakeaLandmark, 'name'>): BodyId {
  return `structure-${landmarkKey(landmark)}`;
}

export { structureKindLabel, structureOf } from './structures.ts';

/** Its radius as drawn and framed, pc: its own, else the largest of its extents, else a supercluster's usual 20 Mpc. */
export function structureRadiusPc(landmark: LaniakeaLandmark): number {
  if (landmark.radiusPc !== null) return landmark.radiusPc;
  if (landmark.extentPc !== null) return Math.max(...landmark.extentPc) / 2;
  return landmark.kind === 'supercluster' ? 20e6 : landmark.kind === 'attractor' ? 10e6 : 5e6;
}

/** How far from it the camera stands when going to it, km: its radius at 11 degrees of the frame's 13.5 half-height. */
export function structureFramingKm(landmark: LaniakeaLandmark): number {
  return 5 * structureRadiusPc(landmark) * PARSEC_KM;
}

function structureState(landmark: LaniakeaLandmark): StateVector {
  return {
    position: { x: landmark.x * PARSEC_KM, y: landmark.y * PARSEC_KM, z: landmark.z * PARSEC_KM },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

function structureDefinition(landmark: LaniakeaLandmark): BodyDefinition {
  const radius = PARSEC_KM;
  return {
    id: structureBodyId(landmark),
    name: landmark.name,
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
    color: STRUCTURE_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/**
 * The structures made bodies at once (App.tsx, once the catalogue arrives): named and marked
 * on the sky, gone to, listed, found. The Virgo Cluster's galaxies are G2's, M87 their mark.
 */
export function ensureStructureBodies(store: EphemerisStore, landmarks: readonly LaniakeaLandmark[]): void {
  for (const landmark of landmarks) {
    structureBodies.set(structureBodyId(landmark), landmark);
  }
  const missing = landmarks.filter((landmark) => !store.isPropagatedBody(structureBodyId(landmark)));
  if (missing.length === 0) return;
  store.addPropagatedBodies(
    missing.map((landmark) => {
      const state = structureState(landmark);
      return { body: structureDefinition(landmark), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}

/** The structures searchable by name and other names. */
export function structureSearch(landmarks: readonly LaniakeaLandmark[]): Searchable {
  return {
    display: landmarks.map((landmark) => normalizeName(landmark.name)),
    designation: landmarks.map((landmark) => aliasField(landmark.otherNames)),
  };
}

// ---------------------------------------------------------------------------------------
// Where a place is: in Laniakea, or beyond

/** The basin `grid` puts Laniakea in: its number there (the galaxies' reconstruction's 1). */
export function laniakeaLabel(c: Pick<LaniakeaCatalogue, 'info'>, grid: LaniakeaBasinGrid = 'galaxiesAttraction'): number {
  const basin = c.info.basins.basins.find((b) => b.grid === grid && b.name === 'Laniakea');
  return basin?.label ?? 0;
}

/**
 * Whether a place is in Laniakea, by the galaxies' reconstruction (Dupuy & Courtois 2023): the
 * breadcrumb's. The groups' reconstruction has no Laniakea -- its Milky Way's flow ends at
 * Shapley -- which the panels and the About say.
 */
export function inLaniakea(c: LaniakeaCatalogue, scenePc: readonly [number, number, number]): boolean {
  if (c.basins === null) {
    // Without the grid: within its volume's radius of its attractor.
    const home = c.info.landmarks.find((l) => l.kind === 'basin' && l.basin?.some((b) => b.grid === 'galaxiesAttraction' && b.label === laniakeaLabel(c)));
    return home !== undefined && Math.hypot(scenePc[0] - home.x, scenePc[1] - home.y, scenePc[2] - home.z) < (home.radiusPc ?? 0);
  }
  const label = laniakeaLabel(c);
  return label > 0 && basinAt(c.basins, 'galaxiesAttraction', scenePc) === label;
}

/** The basins' names at a place, each grid's: "Laniakea", "Shapley"; null where none. */
export function basinNamesAt(c: LaniakeaCatalogue, scenePc: readonly [number, number, number]): { galaxies: string | null; groups: string | null } {
  if (c.basins === null) return { galaxies: null, groups: null };
  const name = (grid: LaniakeaBasinGrid) => {
    const label = basinAt(c.basins!, grid, scenePc);
    return label === 0 ? null : (c.info.basins.basins.find((b) => b.grid === grid && b.label === label)?.name ?? null);
  };
  return { galaxies: name('galaxiesAttraction'), groups: name('groupsAttraction') };
}

/** Earth's view of a structure: the camera on the Sun's side of it, looking out, north up (as galaxyEarthView). */
export function structureEarthView(landmark: Pick<LaniakeaLandmark, 'x' | 'y' | 'z'>): { direction: [number, number, number]; up: [number, number, number] } {
  const n = Math.hypot(landmark.x, landmark.y, landmark.z);
  const { north, away } = skyAxes({ x: landmark.x / n, y: landmark.y / n, z: landmark.z / n });
  return { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] };
}

/** Laniakea's own entry among the landmarks: the basin the galaxies' reconstruction numbers as Laniakea's. */
export function laniakeaLandmark(c: Pick<LaniakeaCatalogue, 'info'>): LaniakeaLandmark | null {
  const label = laniakeaLabel(c);
  return (
    c.info.landmarks.find((l) => l.kind === 'basin' && l.basin?.some((b) => b.grid === 'galaxiesAttraction' && b.label === label)) ?? null
  );
}

/** Where a structure body or a galaxy of the catalogue is, scene frame, pc; null for anything else. */
export function laniakeaPlaceOf(c: LaniakeaCatalogue, id: BodyId, galaxyIndex: number | undefined): [number, number, number] | null {
  const structure = structureBodies.get(id);
  if (structure !== undefined) return [structure.x, structure.y, structure.z];
  return galaxyIndex === undefined ? null : positionPc(c, galaxyIndex);
}
