import { STAR3D_OBLIQUITY_ARCSEC } from '../config.ts';
import { SphereGrid } from '../stars/build3d.ts';
import { CMB_DIPOLE, C_KM_S, unitVector, type Vec3 } from '../laniakea/frames.ts';
import {
  COSMIC_WEB_ABS_V,
  COSMIC_WEB_BV,
  COSMIC_WEB_FILAMENT_CATALOGUES,
  COSMIC_WEB_FLAGS,
  COSMIC_WEB_GALAXY_BYTES,
  COSMIC_WEB_POSITION_UNIT_PC,
  LANIAKEA_FLAGS,
  type CosmicWebFootprint,
  type CosmicWebInfo,
} from '../types.ts';
import type { Skeleton, TempelPoints } from './catalogues.ts';
import {
  APP_COSMOLOGY,
  APP_DISTANCES,
  equatorialToTempel,
  fromScene,
  MALAVASI_DISTANCES,
  malavasiToEquatorial,
  scenePc,
  TEMPEL_DISTANCES,
  tempelToEquatorial,
  zCmbOf,
} from './distances.ts';
import { medianAndScatter, nanomaggiesToMagnitudes, restFrame } from './photometry.ts';

/**
 * The cosmic web beyond Laniakea's catalogue: the filaments the galaxies are strung along, and
 * the galaxies of the two great SDSS redshift surveys, out to z 0.8 -- 2.8 billion parsecs,
 * nine billion light years -- each where its redshift puts it.
 *
 * ## The catalogues
 *
 * - **Tempel et al. 2014** (MNRAS 438, 3465; VizieR J/MNRAS/438/3465): the filaments of the
 *   SDSS DR8 main galaxy sample's contiguous northern area found by the Bisous model, a
 *   marked point process fitting short cylinders of 0.5 h^-1 Mpc radius to the galaxies and
 *   joining them into chains -- 15,421 filaments to z 0.155, their spines as 275,599 points
 *   half an h^-1 Mpc apart, each with the "visit map", the share of the model's realisations
 *   in which a filament covers it. With them, table3: the 576,493 galaxies of the group
 *   catalogue they were found in (Tempel et al. 2012, A&A 540, A106), z 0.009-0.2, each with
 *   its ugriz, its distance with the groups' fingers of god taken out, and its nearest
 *   filament.
 * - **Malavasi et al. 2020** (A&A 642, A19; the ByoPiC team's L3S/COSFIL service): DisPerSE's
 *   skeleton of BOSS DR12 LOWZ+CMASS in the northern galactic cap -- the ridges of the
 *   galaxies' Delaunay density field -- at 5 sigma persistence, unsmoothed density, the
 *   skeleton smoothed once. Used past Tempel's reach, z 0.15-0.75.
 * - **BOSS DR12** (Reid et al. 2016, MNRAS 455, 1553; Alam et al. 2015, ApJS 219, 12): the
 *   large-scale-structure catalogue CMASSLOWZTOT, north and south, 1.3 million luminous
 *   galaxies with a redshift, chosen by colour to be massive and far: LOWZ to z 0.43,
 *   CMASS 0.43-0.7, a few past.
 *
 * ## Once each
 *
 * A galaxy G3 draws is not drawn again: an SDSS or BOSS galaxy within DUPLICATE_ARCSEC of a
 * G3 galaxy (or of one of local-volume.json's) whose redshift agrees within
 * DUPLICATE_CZ_KMS is left out -- G3's is the better placed, by a measured distance or its
 * group's. A BOSS galaxy the SDSS main sample also holds (BOSS re-lists SDSS-I/II's redshifts,
 * IMATCH 2) is the main sample's: within BOSS_DUPLICATE_ARCSEC (the same SDSS photometric
 * object) and BOSS_DUPLICATE_DZ.
 *
 * ## Fingers of god
 *
 * A cluster's galaxies orbit at a thousand km/s, so placed by redshift they string out along
 * the line of sight, the "finger of god" pointing at the Sun that no cluster has. Tempel et
 * al.'s distances take that out for the main sample (GROUP_COMPRESSED); BOSS's galaxies are
 * placed by their own redshifts -- mostly the brightest of their groups, near its centre,
 * but their fingers of god, and the filaments found on them, are not taken out (Malavasi et
 * al. work in redshift space too).
 *
 * ## What is not here
 *
 * The surveys see the sky through SDSS's footprint: a third of it in the north, a strip in the
 * south for BOSS, nothing toward the Milky Way's plane. The footprints (cosmic-web.json)
 * say where, so the web can say why the map is wedges.
 */

// ---------------------------------------------------------------------------------------
// Constants

/** A G3 or Local Volume galaxy within this of an SDSS or BOSS one, its redshift agreeing, is the same galaxy. */
export const DUPLICATE_ARCSEC = 15;
export const DUPLICATE_CZ_KMS = 600;
/** BOSS against the SDSS main sample: the same photometric object, the same spectrum. */
export const BOSS_DUPLICATE_ARCSEC = 3;
export const BOSS_DUPLICATE_DZ = 0.002;
/** Malavasi et al.'s skeleton kept between these CMB-frame redshifts: LOWZ's lower limit, and DR12's clustering analyses' upper one (Alam et al. 2017, MNRAS 470, 2617). */
export const MALAVASI_Z_RANGE: readonly [number, number] = [0.15, 0.75];
/** BOSS galaxies kept to this redshift: the Int16 positions reach z 0.98. */
export const BOSS_Z_MAX = 0.95;
/** Galaxies a chunk of galaxies-<k>.bin: 2.4 MB. */
export const CHUNK_GALAXIES = 262_144;
/** The equal-area sky grid of the footprints: 2.55 square degrees a cell. */
export const FOOTPRINT_DEC_BANDS = 90;
export const FOOTPRINT_RA_CELLS = 180;
/** The shells galaxies are counted in, pc. */
export const SHELL_PC = 100e6;
/** The calibration's galaxies: near enough that K-corrections and G3's lack of one agree. */
export const CALIBRATION_Z_MAX = 0.03;

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

// ---------------------------------------------------------------------------------------
// The galaxies' inputs

/** The SDSS main sample's galaxies as Tempel et al. 2014's table3 gives them. */
export interface TempelGalaxies {
  readonly count: number;
  readonly values: Readonly<Record<string, Float64Array>>;
}

/** BOSS's columns, north or south. */
export interface BossGalaxies {
  readonly cap: 'north' | 'south';
  readonly count: number;
  readonly ra: Float64Array;
  readonly dec: Float64Array;
  readonly z: Float64Array;
  readonly imatch: Float64Array;
  /** u g r i z, five a row. */
  readonly modelFlux: Float64Array;
  readonly extinction: Float64Array;
}

/** G3's galaxies, what deduplication and calibration need: direction (ICRS unit vectors), z (CMB), V, B-V, flags. */
export interface G3Galaxies {
  readonly count: number;
  readonly directions: readonly Vec3[];
  readonly zCmb: Float32Array;
  readonly vMag: Float32Array;
  readonly bv: Float32Array;
  readonly flags: Uint32Array;
}

/** local-volume.json's galaxies: direction and heliocentric velocity (NaN unknown). */
export interface LocalVolumeGalaxies {
  readonly directions: readonly Vec3[];
  readonly zCmb: readonly number[];
}

/** G3's files, read into what this needs: galaxies.bin's records and details.bin's z and V. */
export function readG3(count: number, records: Uint8Array, details: Uint8Array, recordFloats: number): G3Galaxies {
  if (records.length !== count * recordFloats * 4) {
    throw new Error(`laniakea/galaxies.bin holds ${records.length} bytes, not ${count} records of ${recordFloats} floats.`);
  }
  const r = new DataView(records.buffer, records.byteOffset, records.byteLength);
  const d = new DataView(details.buffer, details.byteOffset, details.byteLength);
  const directions: Vec3[] = [];
  const zCmb = new Float32Array(count);
  const vMag = new Float32Array(count);
  const bv = new Float32Array(count);
  const flags = new Uint32Array(count);
  for (let k = 0; k < count; k += 1) {
    const at = k * recordFloats * 4;
    const scene: Vec3 = [r.getFloat32(at, true), r.getFloat32(at + 4, true), r.getFloat32(at + 8, true)];
    const icrs = fromScene(scene);
    const n = Math.hypot(icrs[0], icrs[1], icrs[2]);
    directions.push([icrs[0] / n, icrs[1] / n, icrs[2] / n]);
    bv[k] = r.getFloat32(at + 16, true);
    flags[k] = r.getFloat32(at + 40, true);
    // details.bin: Uint32 PGC [n], then Float32 columns z, d_L, its error, own distance, V, K.
    zCmb[k] = d.getFloat32(count * 4 + k * 4, true);
    vMag[k] = d.getFloat32(count * 4 * 5 + k * 4, true);
  }
  return { count, directions, zCmb, vMag, bv, flags };
}

// ---------------------------------------------------------------------------------------
// Checks of the catalogues' frames

/**
 * Tempel's frame (distances.ts), checked on table3: each galaxy within 0.3 h^-1 Mpc of a
 * filament's axis, put in the frame by its RA, Dec and distance, against the filament point
 * the table names as its nearest. The points are half an h^-1 Mpc apart, so a galaxy that close
 * to the axis is within 0.39 of its nearest point: the median distance must be under 0.35.
 */
export function checkTempelFrame(galaxies: TempelGalaxies, points: TempelPoints): { median: number; checked: number } {
  const index = new Map<number, number>();
  for (let i = 0; i < points.count; i += 1) index.set(points.point[i]!, i);
  const v = galaxies.values;
  const distances: number[] = [];
  for (let g = 0; g < galaxies.count; g += 1) {
    if (!(v.Dfil![g]! < 0.3) || !(v.IDpt![g]! > 0)) continue;
    const at = index.get(v.IDpt![g]!);
    if (at === undefined) continue;
    const u = equatorialToTempel(v.RAJ2000![g]!, v.DEJ2000![g]!);
    const d = v.Dcor![g]!;
    distances.push(Math.hypot(u[0] * d - points.x[at]!, u[1] * d - points.y[at]!, u[2] * d - points.z[at]!));
  }
  const { median } = medianAndScatter(distances);
  if (!(median < 0.35)) {
    throw new Error(`Tempel et al.'s galaxies lie a median ${median.toFixed(2)} h^-1 Mpc from their nearest filament point: the SDSS survey frame (distances.ts) is not theirs.`);
  }
  return { median, checked: distances.length };
}

/** Cells of `cellPc` in the scene frame holding a galaxy. */
function occupiedCells(positions: Float32Array, cellPc: number): Set<string> {
  const cells = new Set<string>();
  for (let i = 0; i < positions.length; i += 3) {
    cells.add(`${Math.floor(positions[i]! / cellPc)},${Math.floor(positions[i + 1]! / cellPc)},${Math.floor(positions[i + 2]! / cellPc)}`);
  }
  return cells;
}

/** The share of `vertices` (scene, pc, interleaved) in an occupied cell. */
function shareIn(vertices: Float64Array, cells: Set<string>, cellPc: number): number {
  let inside = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    if (cells.has(`${Math.floor(vertices[i]! / cellPc)},${Math.floor(vertices[i + 1]! / cellPc)},${Math.floor(vertices[i + 2]! / cellPc)}`)) inside += 1;
  }
  return inside / (vertices.length / 3);
}

/** The cell the Malavasi check counts BOSS galaxies in: their mean spacing. */
export const MALAVASI_CHECK_CELL_PC = 10e6;
/** How much more often the skeleton must fall among the galaxies than its mirror image does. */
export const MALAVASI_CHECK_LEAST = 1.5;

// ---------------------------------------------------------------------------------------
// The footprint grid

/** The cell of the equal-area grid a direction falls in. */
export function footprintCell(raDeg: number, decDeg: number): number {
  const band = Math.min(FOOTPRINT_DEC_BANDS - 1, Math.max(0, Math.floor(((Math.sin(decDeg * DEG) + 1) / 2) * FOOTPRINT_DEC_BANDS)));
  const column = Math.min(FOOTPRINT_RA_CELLS - 1, Math.floor((((raDeg % 360) + 360) % 360) / (360 / FOOTPRINT_RA_CELLS)));
  return band * FOOTPRINT_RA_CELLS + column;
}

export const FOOTPRINT_CELL_DEG2 = (4 * Math.PI) / (FOOTPRINT_DEC_BANDS * FOOTPRINT_RA_CELLS) / (DEG * DEG);

/** A footprint's cells, as bits: bit i in byte i >> 3, least significant first. */
export class Footprint {
  readonly bits = new Uint8Array(Math.ceil((FOOTPRINT_DEC_BANDS * FOOTPRINT_RA_CELLS) / 8));
  zMin = Number.POSITIVE_INFINITY;
  zMax = Number.NEGATIVE_INFINITY;

  add(raDeg: number, decDeg: number, z: number): void {
    const cell = footprintCell(raDeg, decDeg);
    this.bits[cell >> 3]! |= 1 << (cell & 7);
    if (z < this.zMin) this.zMin = z;
    if (z > this.zMax) this.zMax = z;
  }

  has(raDeg: number, decDeg: number): boolean {
    const cell = footprintCell(raDeg, decDeg);
    return (this.bits[cell >> 3]! & (1 << (cell & 7))) !== 0;
  }

  cellCount(): number {
    let n = 0;
    for (const byte of this.bits) for (let b = byte; b !== 0; b &= b - 1) n += 1;
    return n;
  }

  describe(name: string, of: 'galaxies' | 'filaments', note: string): CosmicWebFootprint {
    const cellCount = this.cellCount();
    return {
      name,
      of,
      cells: Buffer.from(this.bits).toString('base64'),
      cellCount,
      areaDeg2: Math.round(cellCount * FOOTPRINT_CELL_DEG2),
      zMin: Number(this.zMin.toFixed(4)),
      zMax: Number(this.zMax.toFixed(4)),
      distanceMinPc: Math.round(APP_DISTANCES.distance(this.zMin) * 1e6),
      distanceMaxPc: Math.round(APP_DISTANCES.distance(this.zMax) * 1e6),
      note,
    };
  }
}

// ---------------------------------------------------------------------------------------
// The galaxies, built

/** A galaxy as this layer draws it, before encoding. */
export interface WebGalaxy {
  readonly position: Vec3;
  readonly absV: number;
  readonly bv: number;
  readonly flags: number;
}

/** An SDSS or BOSS galaxy read, before deduplication and calibration. */
interface Candidate {
  readonly raDeg: number;
  readonly decDeg: number;
  readonly zCmb: number;
  readonly position: Vec3;
  readonly v: number;
  readonly bv: number;
  readonly absV: number;
  readonly flags: number;
}

const direction = (raDeg: number, decDeg: number): Vec3 => unitVector(raDeg, decDeg);

/** Tempel's galaxies as candidates: at their finger-of-god-suppressed distances, rest-frame V and B-V. */
export function tempelCandidates(galaxies: TempelGalaxies): Candidate[] {
  const v = galaxies.values;
  const out: Candidate[] = [];
  for (let g = 0; g < galaxies.count; g += 1) {
    const ra = v.RAJ2000![g]!;
    const dec = v.DEJ2000![g]!;
    const z = v.z![g]!;
    // The redshift Dcor stands for: the galaxy's own where it is alone, its place in its group made round where not.
    const zPlaced = TEMPEL_DISTANCES.redshift(v.Dcor![g]!);
    const position = scenePc(ra, dec, zPlaced);
    const comovingPc = APP_DISTANCES.distance(zPlaced) * 1e6;
    const mags = ['umag', 'gmag', 'rmag', 'imag', 'zmag'].map((c) => v[c]![g]!);
    const rest = restFrame(mags, z, comovingPc);
    let flags = COSMIC_WEB_FLAGS.SDSS_MAIN;
    if (v.Ngal![g]! >= 2) flags |= COSMIC_WEB_FLAGS.GROUP_COMPRESSED;
    if (v.Dfil![g]! <= 0.5 && v.IDpt![g]! > 0) flags |= COSMIC_WEB_FLAGS.IN_FILAMENT;
    if (rest.extrapolated) flags |= COSMIC_WEB_FLAGS.COLOUR_EXTRAPOLATED;
    out.push({ raDeg: ra, decDeg: dec, zCmb: z, position, v: rest.v, bv: rest.bv, absV: rest.absV, flags });
  }
  return out;
}

/** BOSS's galaxies as candidates: at their own redshifts, moved to the CMB frame. */
export function bossCandidates(boss: BossGalaxies): { candidates: Candidate[]; dropped: Record<string, number> } {
  const out: Candidate[] = [];
  const dropped: Record<string, number> = { notGalaxyRedshift: 0, outsideRedshiftRange: 0 };
  for (let g = 0; g < boss.count; g += 1) {
    const imatch = boss.imatch[g]!;
    if (imatch !== 1 && imatch !== 2) {
      dropped.notGalaxyRedshift! += 1;
      continue;
    }
    const ra = boss.ra[g]!;
    const dec = boss.dec[g]!;
    const zCmb = zCmbOf(ra, dec, boss.z[g]!);
    if (!(zCmb > 0.005) || zCmb > BOSS_Z_MAX) {
      dropped.outsideRedshiftRange! += 1;
      continue;
    }
    const position = scenePc(ra, dec, zCmb);
    const comovingPc = APP_DISTANCES.distance(zCmb) * 1e6;
    const mags = nanomaggiesToMagnitudes(Array.from(boss.modelFlux.subarray(g * 5, g * 5 + 5)), Array.from(boss.extinction.subarray(g * 5, g * 5 + 5)));
    // The band shift is the observed (heliocentric) redshift's.
    const rest = restFrame(mags, boss.z[g]!, comovingPc);
    let flags = COSMIC_WEB_FLAGS.BOSS;
    if (imatch === 2) flags |= COSMIC_WEB_FLAGS.LEGACY_REDSHIFT;
    if (rest.extrapolated) flags |= COSMIC_WEB_FLAGS.COLOUR_EXTRAPOLATED;
    out.push({ raDeg: ra, decDeg: dec, zCmb, position, v: rest.v, bv: rest.bv, absV: rest.absV, flags });
  }
  return { candidates: out, dropped };
}

/** A sky index of directions with their redshifts: the matches within `radiusArcsec` and `dz`. */
class SkyIndex {
  private readonly grid: SphereGrid<number>;
  private readonly z: number[] = [];

  constructor(radiusArcsec: number) {
    // Cells a few times the radius: SphereGrid searches the 27 about a point.
    this.grid = new SphereGrid<number>(Math.max(radiusArcsec * ARCSEC * 4, 1e-4));
  }

  add(vector: Vec3, z: number): number {
    this.grid.add(vector, this.z.length);
    this.z.push(z);
    return this.z.length - 1;
  }

  /** The nearest entry within `radiusArcsec` whose redshift is within `dz`, or -1. */
  match(vector: Vec3, z: number, radiusArcsec: number, dz: number): number {
    for (const { item } of this.grid.near(vector, radiusArcsec * ARCSEC)) {
      const other = this.z[item]!;
      if (Number.isNaN(other) || Math.abs(other - z) <= dz) return item;
    }
    return -1;
  }
}

export interface GalaxyBuild {
  readonly galaxies: WebGalaxy[];
  readonly counts: Record<string, number>;
  readonly calibration: CosmicWebInfo['galaxies']['calibration'][number][];
  readonly footprints: { sdssMain: Footprint; bossNorth: Footprint; bossSouth: Footprint };
}

/**
 * The SDSS and BOSS galaxies, once each and none G3 draws, their V and B-V calibrated onto
 * G3's (photometry.ts). `tempel` and `boss` are read; `g3` and `localVolume` are what to
 * leave out.
 */
export function buildGalaxies(input: {
  tempel: TempelGalaxies;
  boss: readonly BossGalaxies[];
  g3: G3Galaxies;
  localVolume: LocalVolumeGalaxies;
}): GalaxyBuild {
  const counts: Record<string, number> = {};
  const czDz = DUPLICATE_CZ_KMS / C_KM_S;

  // What is already drawn: G3's galaxies, and the Local Volume's.
  const drawn = new SkyIndex(DUPLICATE_ARCSEC);
  input.g3.directions.forEach((d, k) => drawn.add(d, input.g3.zCmb[k]!));
  const g3Count = input.g3.count;
  input.localVolume.directions.forEach((d, k) => drawn.add(d, input.localVolume.zCmb[k]!));

  const footprints = { sdssMain: new Footprint(), bossNorth: new Footprint(), bossSouth: new Footprint() };

  // The SDSS main sample: left out where G3 or the Local Volume has it; the pairs with G3 calibrate.
  const tempel = tempelCandidates(input.tempel);
  counts.sdssMainRead = tempel.length;
  const vPairs: number[] = [];
  const bvPairs: number[] = [];
  const keptTempel: Candidate[] = [];
  for (const c of tempel) {
    footprints.sdssMain.add(c.raDeg, c.decDeg, c.zCmb);
    const match = drawn.match(direction(c.raDeg, c.decDeg), c.zCmb, DUPLICATE_ARCSEC, czDz);
    if (match < 0) {
      keptTempel.push(c);
      continue;
    }
    if (match >= g3Count) {
      counts.sdssMainInLocalVolume = (counts.sdssMainInLocalVolume ?? 0) + 1;
      continue;
    }
    counts.sdssMainInG3 = (counts.sdssMainInG3 ?? 0) + 1;
    const f = input.g3.flags[match]!;
    if (c.zCmb < CALIBRATION_Z_MAX && Number.isFinite(c.v)) {
      if ((f & LANIAKEA_FLAGS.V_MEASURED) !== 0) vPairs.push(input.g3.vMag[match]! - c.v);
      if ((f & LANIAKEA_FLAGS.V_MEASURED) !== 0 && (f & LANIAKEA_FLAGS.COLOUR_ESTIMATED) === 0 && Number.isFinite(c.bv)) bvPairs.push(input.g3.bv[match]! - c.bv);
    }
  }
  const tempelV = medianAndScatter(vPairs);
  const tempelBv = medianAndScatter(bvPairs);
  if (tempelV.count < 100 || tempelBv.count < 100) {
    throw new Error(`Only ${tempelV.count} (V) and ${tempelBv.count} (B-V) galaxies both G3 and the SDSS main sample hold to calibrate on, under z ${CALIBRATION_Z_MAX}.`);
  }
  const calibrated = (c: Candidate, dv: number, dbv: number): Candidate => ({ ...c, v: c.v + dv, absV: c.absV + dv, bv: c.bv + dbv });
  const tempelKept = keptTempel.map((c) => calibrated(c, tempelV.median, tempelBv.median));

  // BOSS: left out where G3 has it; where the main sample has it, that one is kept, and the pair calibrates BOSS.
  const mainIndex = new SkyIndex(BOSS_DUPLICATE_ARCSEC);
  const mainByIndex: Candidate[] = [];
  for (const c of tempel) {
    mainIndex.add(direction(c.raDeg, c.decDeg), c.zCmb);
    mainByIndex.push(calibrated(c, tempelV.median, tempelBv.median));
  }
  const bossKept: Candidate[] = [];
  const bossVPairs: number[] = [];
  const bossBvPairs: number[] = [];
  for (const sample of input.boss) {
    const { candidates, dropped } = bossCandidates(sample);
    counts[`boss${sample.cap === 'north' ? 'North' : 'South'}Read`] = sample.count;
    for (const [why, n] of Object.entries(dropped)) counts[`boss${why[0]!.toUpperCase()}${why.slice(1)}`] = (counts[`boss${why[0]!.toUpperCase()}${why.slice(1)}`] ?? 0) + n;
    const footprint = sample.cap === 'north' ? footprints.bossNorth : footprints.bossSouth;
    for (const c of candidates) {
      footprint.add(c.raDeg, c.decDeg, c.zCmb);
      const d = direction(c.raDeg, c.decDeg);
      const main = mainIndex.match(d, c.zCmb, BOSS_DUPLICATE_ARCSEC, BOSS_DUPLICATE_DZ);
      if (main >= 0) {
        counts.bossInSdssMain = (counts.bossInSdssMain ?? 0) + 1;
        const m = mainByIndex[main]!;
        if (Number.isFinite(m.v) && Number.isFinite(c.v)) bossVPairs.push(m.v - c.v);
        if (Number.isFinite(m.bv) && Number.isFinite(c.bv)) bossBvPairs.push(m.bv - c.bv);
        continue;
      }
      const g3 = drawn.match(d, c.zCmb, DUPLICATE_ARCSEC, czDz);
      if (g3 >= 0) {
        counts[g3 < g3Count ? 'bossInG3' : 'bossInLocalVolume'] = (counts[g3 < g3Count ? 'bossInG3' : 'bossInLocalVolume'] ?? 0) + 1;
        continue;
      }
      bossKept.push(c);
    }
  }
  const bossV = medianAndScatter(bossVPairs);
  const bossBv = medianAndScatter(bossBvPairs);
  if (bossV.count < 100 || bossBv.count < 100) {
    throw new Error(`Only ${bossV.count} (V) and ${bossBv.count} (B-V) galaxies both BOSS and the SDSS main sample hold to calibrate on.`);
  }

  const galaxies: WebGalaxy[] = [
    ...tempelKept.map((c) => ({ position: c.position, absV: c.absV, bv: c.bv, flags: c.flags })),
    ...bossKept.map((c) => ({ position: c.position, absV: c.absV + bossV.median, bv: c.bv + bossBv.median, flags: c.flags })),
  ];
  counts.sdssMain = tempelKept.length;
  counts.boss = bossKept.length;
  const round = (x: number) => Number(x.toFixed(3));
  const calibration: GalaxyBuild['calibration'] = [
    { survey: 'SDSS main (Tempel et al. 2014)', onto: 'G3 (HyperLEDA V, B-V)', quantity: 'V', offset: round(tempelV.median), scatter: round(tempelV.scatter), galaxies: tempelV.count },
    { survey: 'SDSS main (Tempel et al. 2014)', onto: 'G3 (HyperLEDA V, B-V)', quantity: 'B-V', offset: round(tempelBv.median), scatter: round(tempelBv.scatter), galaxies: tempelBv.count },
    { survey: 'BOSS DR12', onto: 'SDSS main, calibrated', quantity: 'V', offset: round(bossV.median), scatter: round(bossV.scatter), galaxies: bossV.count },
    { survey: 'BOSS DR12', onto: 'SDSS main, calibrated', quantity: 'B-V', offset: round(bossBv.median), scatter: round(bossBv.scatter), galaxies: bossBv.count },
  ];
  return { galaxies, counts, calibration, footprints };
}

// ---------------------------------------------------------------------------------------
// The filaments, built

/** A filament as drawn: its vertices (scene, pc), a value a vertex (catalogue's units), its galaxies (or -1). */
export interface WebFilament {
  readonly catalogue: keyof typeof COSMIC_WEB_FILAMENT_CATALOGUES;
  readonly vertices: Vec3[];
  readonly values: number[];
  readonly galaxies: number;
  /** The CMB-frame redshifts of its ends, for the catalogue's range. */
  readonly zMin: number;
  readonly zMax: number;
}

/**
 * Tempel's filaments in the scene: each point's direction from its place in Tempel's frame, its
 * distance the redshift its comoving distance stands for, in the app's cosmology; the value
 * the visit map. `galaxies`: table1's Ng0.5 by filament ID.
 */
export function tempelFilaments(points: TempelPoints, galaxiesByFilament: ReadonlyMap<number, number>): { filaments: WebFilament[]; footprint: Footprint } {
  const filaments: WebFilament[] = [];
  const footprint = new Footprint();
  let start = 0;
  while (start < points.count) {
    const id = points.filament[start]!;
    let end = start;
    while (end < points.count && points.filament[end] === id) end += 1;
    const vertices: Vec3[] = [];
    const values: number[] = [];
    let zMin = Number.POSITIVE_INFINITY;
    let zMax = Number.NEGATIVE_INFINITY;
    for (let i = start; i < end; i += 1) {
      const p: Vec3 = [points.x[i]!, points.y[i]!, points.z[i]!];
      const { raDeg, decDeg } = tempelToEquatorial(p);
      const z = TEMPEL_DISTANCES.redshift(Math.hypot(p[0], p[1], p[2]));
      vertices.push(scenePc(raDeg, decDeg, z));
      values.push(points.visitMap[i]!);
      footprint.add(raDeg, decDeg, z);
      zMin = Math.min(zMin, z);
      zMax = Math.max(zMax, z);
    }
    filaments.push({ catalogue: 'tempel2014', vertices, values, galaxies: galaxiesByFilament.get(id) ?? -1, zMin, zMax });
    start = end;
  }
  return { filaments, footprint };
}

/** A Malavasi skeleton's sampling point in the scene, its CMB-frame redshift and direction; `mirror` flips dRA (the check's control). */
function malavasiPoint(skeleton: Skeleton, s: number, centre: { raDeg: number; decDeg: number }, mirror = false) {
  const p: Vec3 = [skeleton.points[s * 3]!, (mirror ? -1 : 1) * skeleton.points[s * 3 + 1]!, skeleton.points[s * 3 + 2]!];
  const { raDeg, decDeg, distance } = malavasiToEquatorial(p, centre);
  const zHelio = MALAVASI_DISTANCES.redshift(distance);
  const zCmb = zCmbOf(raDeg, decDeg, zHelio);
  return { raDeg, decDeg, zCmb, scene: scenePc(raDeg, decDeg, zCmb) };
}

/**
 * Malavasi et al.'s skeleton in the scene. Left out, as the paper did, the filaments that end
 * at a critical point DisPerSE tags as on the sample's boundary; and the parts outside BOSS
 * North's footprint (`footprint`, the galaxies' cells) or MALAVASI_Z_RANGE, where the density
 * field DisPerSE traces is interpolated across no galaxies: each filament is cut to its runs
 * of two or more points inside. The value a vertex is log10 of the DTFE density there.
 */
export function malavasiFilaments(skeleton: Skeleton, centre: { raDeg: number; decDeg: number }, footprint: Footprint): { filaments: WebFilament[]; dropped: Record<string, number>; kept: Footprint } {
  const filaments: WebFilament[] = [];
  const dropped: Record<string, number> = { boundaryFilaments: 0, pointsOutsideFootprint: 0, pointsOutsideRedshiftRange: 0, runsOfOnePoint: 0 };
  const kept = new Footprint();
  const logField = skeleton.pointFields.log_field_value;
  if (logField === undefined) throw new Error('The skeleton has no log_field_value.');
  const { cpA, cpB, first, count } = skeleton.filaments;
  for (let f = 0; f < count; f += 1) {
    if (skeleton.criticalPoints.boundary[cpA[f]!] !== 0 || skeleton.criticalPoints.boundary[cpB[f]!] !== 0) {
      dropped.boundaryFilaments! += 1;
      continue;
    }
    let run: { vertices: Vec3[]; values: number[]; zMin: number; zMax: number; at: { ra: number; dec: number; z: number }[] } | null = null;
    const close = () => {
      if (run === null) return;
      if (run.vertices.length >= 2) {
        filaments.push({ catalogue: 'malavasi2020', vertices: run.vertices, values: run.values, galaxies: -1, zMin: run.zMin, zMax: run.zMax });
        for (const a of run.at) kept.add(a.ra, a.dec, a.z);
      } else {
        dropped.runsOfOnePoint! += 1;
      }
      run = null;
    };
    for (let s = first[f]!; s < first[f + 1]!; s += 1) {
      const p = malavasiPoint(skeleton, s, centre);
      const inRange = p.zCmb >= MALAVASI_Z_RANGE[0] && p.zCmb <= MALAVASI_Z_RANGE[1];
      const inside = footprint.has(p.raDeg, p.decDeg);
      if (!inRange || !inside) {
        if (!inRange) dropped.pointsOutsideRedshiftRange! += 1;
        else dropped.pointsOutsideFootprint! += 1;
        close();
        continue;
      }
      run ??= { vertices: [], values: [], zMin: Number.POSITIVE_INFINITY, zMax: Number.NEGATIVE_INFINITY, at: [] };
      run.vertices.push(p.scene);
      run.values.push(logField[s]!);
      run.zMin = Math.min(run.zMin, p.zCmb);
      run.zMax = Math.max(run.zMax, p.zCmb);
      run.at.push({ ra: p.raDeg, dec: p.decDeg, z: p.zCmb });
    }
    close();
  }
  return { filaments, dropped, kept };
}

/**
 * Malavasi's frame (distances.ts), checked on BOSS North's galaxies: the share of the
 * skeleton's points, as placed, in a MALAVASI_CHECK_CELL_PC cell holding a galaxy, against the
 * share for the skeleton mirrored in RA (the other way the paper's words could be read). A
 * skeleton traced on these galaxies lies among them.
 */
export function checkMalavasiFrame(skeleton: Skeleton, centre: { raDeg: number; decDeg: number }, galaxies: Float32Array): { share: number; mirrored: number; ratio: number } {
  const cells = occupiedCells(galaxies, MALAVASI_CHECK_CELL_PC);
  const samples = skeleton.points.length / 3;
  const placed: number[] = [];
  const mirrored: number[] = [];
  for (let s = 0; s < samples; s += 1) {
    const p = malavasiPoint(skeleton, s, centre);
    if (p.zCmb < MALAVASI_Z_RANGE[0] || p.zCmb > MALAVASI_Z_RANGE[1]) continue;
    placed.push(...p.scene);
    mirrored.push(...malavasiPoint(skeleton, s, centre, true).scene);
  }
  const share = shareIn(Float64Array.from(placed), cells, MALAVASI_CHECK_CELL_PC);
  const mirror = shareIn(Float64Array.from(mirrored), cells, MALAVASI_CHECK_CELL_PC);
  const ratio = share / mirror;
  if (!(ratio >= MALAVASI_CHECK_LEAST)) {
    throw new Error(`Malavasi et al.'s skeleton falls among BOSS's galaxies ${(100 * share).toFixed(1)}% of the time, mirrored ${(100 * mirror).toFixed(1)}%: the frame (distances.ts) is not theirs.`);
  }
  return { share, mirrored: mirror, ratio };
}

// ---------------------------------------------------------------------------------------
// Encoding

/** A value as a byte, min + code x step; past the byte's range it is not known: there it is bad photometry, not a galaxy (a B-V under -0.25, an absolute V fainter than -13.3 at z 0.1). */
const quantise = (value: number, min: number, step: number, unknown: number) => {
  if (!Number.isFinite(value)) return unknown;
  const code = Math.round((value - min) / step);
  return code < 0 || code > unknown - 1 ? unknown : code;
};

const toUnit = (pc: number, what: string): number => {
  const unit = Math.round(pc / COSMIC_WEB_POSITION_UNIT_PC);
  if (unit < -32767 || unit > 32767) {
    throw new Error(`${what} at ${(pc / 1e6).toFixed(0)} Mpc is past the Int16 positions' reach.`);
  }
  return unit;
};

/** The galaxies ordered most luminous first, in chunks of CHUNK_GALAXIES (COSMIC_WEB_GALAXY_BYTES each). */
export function encodeGalaxies(galaxies: readonly WebGalaxy[], chunkSize = CHUNK_GALAXIES): { bytes: Uint8Array; count: number; absVBrightest: number; absVFaintest: number }[] {
  // An absolute V the byte cannot hold is not known (quantise): sorted with those that have none.
  const known = (v: number) => (quantise(v, COSMIC_WEB_ABS_V.min, COSMIC_WEB_ABS_V.step, COSMIC_WEB_ABS_V.unknown) === COSMIC_WEB_ABS_V.unknown ? Number.NaN : v);
  const absV = galaxies.map((g) => known(g.absV));
  const order = galaxies.map((_, i) => i).sort((a, b) => {
    const va = absV[a]!;
    const vb = absV[b]!;
    if (!Number.isFinite(va)) return Number.isFinite(vb) ? 1 : 0;
    if (!Number.isFinite(vb)) return -1;
    return va - vb;
  });
  const chunks = [];
  for (let start = 0; start < order.length; start += chunkSize) {
    const slice = order.slice(start, start + chunkSize);
    const n = slice.length;
    const bytes = new Uint8Array(n * COSMIC_WEB_GALAXY_BYTES);
    const view = new DataView(bytes.buffer);
    slice.forEach((g, k) => {
      const galaxy = galaxies[g]!;
      for (let axis = 0; axis < 3; axis += 1) view.setInt16((k * 3 + axis) * 2, toUnit(galaxy.position[axis]!, 'A galaxy'), true);
      bytes[n * 6 + k] = quantise(galaxy.absV, COSMIC_WEB_ABS_V.min, COSMIC_WEB_ABS_V.step, COSMIC_WEB_ABS_V.unknown);
      bytes[n * 7 + k] = quantise(galaxy.bv, COSMIC_WEB_BV.min, COSMIC_WEB_BV.step, COSMIC_WEB_BV.unknown);
      bytes[n * 8 + k] = galaxy.flags;
    });
    const finite = slice.map((g) => absV[g]!).filter(Number.isFinite);
    chunks.push({ bytes, count: n, absVBrightest: finite.length > 0 ? finite[0]! : Number.NaN, absVFaintest: finite.length > 0 ? finite[finite.length - 1]! : Number.NaN });
  }
  return chunks;
}

/** The vertex byte of each catalogue: value = min + code x step. */
export const VERTEX_VALUES: Readonly<Record<keyof typeof COSMIC_WEB_FILAMENT_CATALOGUES, { meaning: string; min: number; step: number }>> = {
  tempel2014: { meaning: 'the visit map: the share of the Bisous model\'s realisations in which a filament covers the point, 0-1 (Tempel et al. 2014, vmap)', min: 0, step: 1 / 254 },
  malavasi2020: { meaning: 'log10 of the DTFE galaxy density at the point, DisPerSE\'s field value, in its own (arbitrary) units (Malavasi et al. 2020, log_field_value)', min: -7.8, step: 0.05 },
};

/** filaments.bin: see CosmicWebInfo.filaments. Lengths as placed. */
export function encodeFilaments(filaments: readonly WebFilament[]): { bytes: Uint8Array; vertices: number; lengthsMpc: number[] } {
  const lines = filaments.length;
  const vertices = filaments.reduce((n, f) => n + f.vertices.length, 0);
  const bytes = new Uint8Array(4 * (lines + 1) + 6 * vertices + 2 * lines + 2 * lines + vertices + lines);
  const view = new DataView(bytes.buffer);
  const positionsAt = 4 * (lines + 1);
  const lengthsAt = positionsAt + 6 * vertices;
  const galaxiesAt = lengthsAt + 2 * lines;
  const valuesAt = galaxiesAt + 2 * lines;
  const cataloguesAt = valuesAt + vertices;
  const lengthsMpc: number[] = [];
  let v = 0;
  filaments.forEach((f, line) => {
    view.setUint32(line * 4, v, true);
    let length = 0;
    const scale = VERTEX_VALUES[f.catalogue];
    f.vertices.forEach((p, k) => {
      for (let axis = 0; axis < 3; axis += 1) view.setInt16(positionsAt + (v * 3 + axis) * 2, toUnit(p[axis]!, 'A filament'), true);
      bytes[valuesAt + v] = quantise(f.values[k]!, scale.min, scale.step, 255);
      if (k > 0) {
        const q = f.vertices[k - 1]!;
        length += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      }
      v += 1;
    });
    lengthsMpc.push(length / 1e6);
    view.setUint16(lengthsAt + line * 2, Math.min(65534, Math.round(length / 1e5)), true);
    view.setUint16(galaxiesAt + line * 2, f.galaxies < 0 ? 65535 : Math.min(65534, f.galaxies), true);
    bytes[cataloguesAt + line] = COSMIC_WEB_FILAMENT_CATALOGUES[f.catalogue];
  });
  view.setUint32(lines * 4, v, true);
  return { bytes, vertices, lengthsMpc };
}

// ---------------------------------------------------------------------------------------
// Assembly

export const COSMIC_WEB_FILES = { filaments: 'filaments.bin', galaxyChunk: (k: number) => `galaxies-${k}.bin` } as const;

export interface CosmicWebOutput {
  readonly info: CosmicWebInfo;
  readonly files: Readonly<Record<string, Uint8Array>>;
}

const quantile = (sorted: readonly number[], p: number) => (sorted.length === 0 ? Number.NaN : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!);

export function assembleCosmicWeb(input: {
  galaxies: GalaxyBuild;
  tempel: { filaments: WebFilament[]; footprint: Footprint };
  malavasi: { filaments: WebFilament[]; dropped: Record<string, number>; kept: Footprint };
  sources: CosmicWebInfo['sources'];
  checks: CosmicWebInfo['checks'];
}): CosmicWebOutput {
  const files: Record<string, Uint8Array> = {};
  const chunks = encodeGalaxies(input.galaxies.galaxies);
  const chunkInfo = chunks.map((c, k) => {
    files[COSMIC_WEB_FILES.galaxyChunk(k)] = c.bytes;
    return { file: COSMIC_WEB_FILES.galaxyChunk(k), bytes: c.bytes.length, count: c.count, absVBrightest: Number(c.absVBrightest.toFixed(2)), absVFaintest: Number(c.absVFaintest.toFixed(2)) };
  });

  const all = [...input.tempel.filaments, ...input.malavasi.filaments];
  const encoded = encodeFilaments(all);
  files[COSMIC_WEB_FILES.filaments] = encoded.bytes;
  const describeCatalogue = (key: keyof typeof COSMIC_WEB_FILAMENT_CATALOGUES, name: string, firstLine: number, list: WebFilament[], dropped: Record<string, number>, note: string) => {
    const lengths = encoded.lengthsMpc.slice(firstLine, firstLine + list.length).sort((a, b) => a - b);
    const r = (x: number) => Number(x.toFixed(1));
    return {
      key,
      name,
      firstLine,
      lines: list.length,
      vertices: list.reduce((n, f) => n + f.vertices.length, 0),
      vertexValue: VERTEX_VALUES[key],
      lengthMpc: { median: r(quantile(lengths, 0.5)), p90: r(quantile(lengths, 0.9)), max: r(lengths[lengths.length - 1] ?? Number.NaN) },
      zRange: [Number(Math.min(...list.map((f) => f.zMin)).toFixed(4)), Number(Math.max(...list.map((f) => f.zMax)).toFixed(4))] as const,
      dropped,
      note,
    };
  };

  // Distances and shells.
  const distances = input.galaxies.galaxies.map((g) => Math.hypot(g.position[0], g.position[1], g.position[2])).sort((a, b) => a - b);
  const shells: Record<string, number[]> = { sdssMain: [], boss: [] };
  for (const g of input.galaxies.galaxies) {
    const key = (g.flags & COSMIC_WEB_FLAGS.BOSS) !== 0 ? 'boss' : 'sdssMain';
    const shell = Math.floor(Math.hypot(g.position[0], g.position[1], g.position[2]) / SHELL_PC);
    const list = shells[key]!;
    while (list.length <= shell) list.push(0);
    list[shell]! += 1;
  }
  for (const list of Object.values(shells)) for (let i = 0; i < list.length; i += 1) list[i] ??= 0;

  const fp = input.galaxies.footprints;
  const info: CosmicWebInfo = {
    generatedAt: new Date().toISOString(),
    sources: input.sources,
    frame: 'Heliocentric, ICRS rotated about its x axis by the IAU 1976 obliquity (the scene frame, as laniakea/), parsecs; positions Int16 of positionUnitPc.',
    obliquityArcsec: STAR3D_OBLIQUITY_ARCSEC,
    positionUnitPc: COSMIC_WEB_POSITION_UNIT_PC,
    cosmology: {
      h0KmSMpc: APP_COSMOLOGY.h0,
      omegaM: APP_COSMOLOGY.omegaM,
      cmbDipole: CMB_DIPOLE,
      note:
        "Laniakea's (laniakea.json): flat Lambda-CDM, H0 74.6 km/s/Mpc (Cosmicflows-4's) and Omega_m 0.3, comoving distances of CMB-frame redshifts -- for every galaxy and filament here, so they meet G3's galaxies cluster for cluster and the map has no seam. Planck 2018 (web/src/core/cosmology.ts) would put everything 9-10% farther, the ratio of the two H0s, the Hubble tension. Distance is monotonic in redshift, so a point's distance here gives back its redshift exactly, and any other cosmology's distance from that. Each catalogue's own cosmology was undone first: Tempel et al.'s h^-1 Mpc in WMAP's Omega_m 0.27, Malavasi et al.'s Mpc in Planck 2015's H0 67.74, Omega_m 0.3075 from heliocentric redshifts.",
    },
    galaxies: {
      count: input.galaxies.galaxies.length,
      bytesPerGalaxy: COSMIC_WEB_GALAXY_BYTES,
      chunks: chunkInfo,
      absV: COSMIC_WEB_ABS_V,
      bv: COSMIC_WEB_BV,
      flags: COSMIC_WEB_FLAGS,
      counts: input.galaxies.counts,
      distanceRangePc: { min: Math.round(distances[0] ?? 0), median: Math.round(quantile(distances, 0.5)), max: Math.round(distances[distances.length - 1] ?? 0) },
      calibration: input.galaxies.calibration,
      photometryNote:
        'Rest-frame V and B-V (Vega) read off the five SDSS bands (extinction-corrected; Petrosian for the main sample, model for BOSS) by interpolating in log wavelength at B and V moved by 1 + z, the band-shift K-correction applied (photometry.ts); then moved by the median offsets in calibration onto G3\'s HyperLEDA V and B-V, over the galaxies both hold under z 0.03 (BOSS onto the main sample over the galaxies both hold). Absolute V at d_L = (1 + z) x the placed comoving distance. Past z 0.63 rest-frame V is beyond the z band and the i - z slope is carried on: COLOUR_EXTRAPOLATED. A V or B-V past the range a byte holds (absolute V -26 to -13.3, B-V -0.25 to 2.29) is bad photometry, a blend or a shredded galaxy, and is written as not known (a few hundred V, under two thousand B-V).',
      placementNote:
        'SDSS main sample: at Tempel et al.\'s finger-of-god-suppressed comoving distance (GROUP_COMPRESSED for a group of two or more), turned back into the redshift it stands for and placed in Laniakea\'s cosmology. BOSS: at its own CMB-frame redshift; fingers of god not taken out. None G3 or local-volume.json draws.',
    },
    filaments: {
      file: COSMIC_WEB_FILES.filaments,
      bytes: encoded.bytes.length,
      lines: all.length,
      vertices: encoded.vertices,
      catalogues: [
        describeCatalogue(
          'tempel2014',
          'Tempel et al. 2014: SDSS DR8 filaments (Bisous model)',
          0,
          input.tempel.filaments,
          {},
          'Spines half an h^-1 Mpc apart; radius 0.5 h^-1 Mpc, as the model fits them. Found in finger-of-god-suppressed space, the space the SDSS main galaxies are placed in. Every catalogued filament kept.',
        ),
        describeCatalogue(
          'malavasi2020',
          'Malavasi et al. 2020: BOSS DR12 LOWZ+CMASS skeleton (DisPerSE, 5 sigma)',
          input.tempel.filaments.length,
          input.malavasi.filaments,
          input.malavasi.dropped,
          'DisPerSE ridges of the Delaunay density of BOSS North\'s galaxies, broken at bifurcations, the skeleton smoothed once. In redshift space. Filaments ending at a boundary critical point left out (as the paper did); the rest cut to BOSS North\'s footprint and z 0.15-0.75. The paper\'s further cut -- bifurcations within 200 Mpc of the sample\'s convex hull -- is not made: some filaments near the footprint\'s edges are the field interpolated across the edge.',
        ),
      ],
    },
    footprints: {
      grid: { decBands: FOOTPRINT_DEC_BANDS, raCells: FOOTPRINT_RA_CELLS, cellDeg2: Number(FOOTPRINT_CELL_DEG2.toFixed(4)) },
      surveys: [
        fp.sdssMain.describe('SDSS DR8 main galaxy sample (Tempel et al. 2014)', 'galaxies', 'The Legacy survey\'s contiguous northern area, r < 17.77: complete for bright galaxies, thinning with distance to the most luminous at z 0.2.'),
        fp.bossNorth.describe('BOSS DR12 LOWZ+CMASS, northern galactic cap', 'galaxies', 'Colour-selected luminous, mostly red galaxies: a sparse sample of the massive ones, near-constant in density from z 0.2 to 0.6.'),
        fp.bossSouth.describe('BOSS DR12 LOWZ+CMASS, southern galactic cap', 'galaxies', 'As the north, a strip about the celestial equator; no filament catalogue covers it.'),
        input.tempel.footprint.describe('Tempel et al. 2014 filaments', 'filaments', 'The main sample\'s area, to z 0.155.'),
        input.malavasi.kept.describe('Malavasi et al. 2020 filaments, as kept', 'filaments', 'BOSS North only, z 0.15-0.75.'),
      ],
    },
    shells: { widthPc: SHELL_PC, counts: shells },
    checks: input.checks,
    coverage: [
      'Everything here is in the SDSS\'s footprints: the main sample\'s and BOSS North\'s third of the sky about the north galactic pole, and BOSS South\'s strip about the equator. Elsewhere the surveys did not look: the map is wedges, and the dark between them is unobserved, not empty.',
      'Toward the Milky Way\'s plane nothing is drawn: SDSS avoided it.',
      'The SDSS main sample is flux-limited (r < 17.77): out to z 0.05 it holds dwarfs, by z 0.15 only galaxies brighter than the Milky Way, and its filaments stop at z 0.155, where the galaxies grow too sparse for them.',
      'BOSS chose massive, luminous galaxies by colour, a few per hundred of those there: its galaxies are a thin sample of the brightest, and its filaments are traced on that sample, longer and coarser than the main sample\'s.',
      'Past z 0.7 BOSS thins out; past 0.75 no filaments are kept.',
      'Within G3\'s volume, G3\'s galaxies are G3\'s: the same galaxy is not drawn twice.',
    ],
  };
  return { info, files };
}

/** Lines for the log. */
export function describeCosmicWeb(output: CosmicWebOutput): string[] {
  const { info } = output;
  const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;
  const totalBytes = Object.values(output.files).reduce((n, b) => n + b.length, 0);
  return [
    `[cosmic-web] ${info.galaxies.count} galaxies in ${info.galaxies.chunks.length} chunks (${mb(info.galaxies.chunks.reduce((n, c) => n + c.bytes, 0))}): ${Object.entries(info.galaxies.counts).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `[cosmic-web] distances ${(info.galaxies.distanceRangePc.min / 1e6).toFixed(0)}-${(info.galaxies.distanceRangePc.max / 1e6).toFixed(0)} Mpc, median ${(info.galaxies.distanceRangePc.median / 1e6).toFixed(0)}.`,
    ...info.galaxies.calibration.map((c) => `[cosmic-web] calibration ${c.survey} ${c.quantity} onto ${c.onto}: ${c.offset >= 0 ? '+' : ''}${c.offset} (scatter ${c.scatter}, ${c.galaxies} galaxies).`),
    ...info.filaments.catalogues.map((c) => `[cosmic-web] ${c.name}: ${c.lines} lines, ${c.vertices} vertices, length median ${c.lengthMpc.median} Mpc (p90 ${c.lengthMpc.p90}, max ${c.lengthMpc.max}), z ${c.zRange.join('-')}${Object.keys(c.dropped).length > 0 ? `; dropped ${Object.entries(c.dropped).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}.`),
    ...info.footprints.surveys.map((s) => `[cosmic-web] footprint ${s.name}: ${s.areaDeg2} deg^2, z ${s.zMin}-${s.zMax}.`),
    ...Object.entries(info.checks).map(([k, c]) => `[cosmic-web] check ${k}: ${c.passed ? 'passed' : 'FAILED'} (${c.value}) ${c.note}`),
    `[cosmic-web] ${mb(totalBytes)} in all, filaments ${mb(info.filaments.bytes)}.`,
  ];
}
