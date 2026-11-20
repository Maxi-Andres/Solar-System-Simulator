import { inflateRawSync } from 'node:zlib';

import { readHeader } from '../localGroup/nearbyGalaxies.ts';
import { constraint, regrid, SEED_CONSTRAINT } from './flows.ts';
import { LITTLE_H, OMEGA_M, supergalacticToScene, type Vec3 } from './frames.ts';

/**
 * Laniakea's boundary, and the matter about it, as the Cosmicflows-4 velocity field draws
 * them.
 *
 * ## What exists, and what does not
 *
 * Laniakea is not a cluster of galaxies with an edge one can see but a basin of attraction:
 * the volume whose galaxies' peculiar motions -- their velocities less the Hubble flow --
 * all flow toward one place (Tully, Courtois, Hoffman & Pomarede 2014, Nature 513, 71, from
 * Cosmicflows-2). Its edge is drawn by a reconstruction of the velocity field from measured
 * distances, and a reconstruction is a model fitted to them, not a measurement. Three have
 * been made from Cosmicflows-4:
 *
 * - **Courtois et al. 2023** (A&A 670, L15): a Hamiltonian Monte Carlo fit of the CF4
 *   galaxies' and of the CF4 groups' distances, the overdensity delta and the velocity on a
 *   grid of 1000 Mpc/h a side about the Milky Way, at Omega_m 0.3 and H0 74.6. Published:
 *   128^3 voxels (7.8 Mpc/h) on Zenodo (H. Courtois, doi 10.5281/zenodo.20653238, CC BY 4.0)
 *   and 64^3 on the CosmicFlows project page (https://projets.ip2i.in2p3.fr/cosmicflows/).
 * - **Dupuy & Courtois 2023** (A&A 678, A176): the watersheds of that field -- every voxel
 *   followed along its streamline to the attractor it ends at, and the voxels sharing one
 *   grouped into its basin; the same backward for the repellers. Published on the same
 *   page as four 128^3 grids of basin numbers: attraction and repulsion, for the galaxies'
 *   reconstruction and for the groups'. **This is Laniakea's boundary as data**, read here.
 * - **Valade et al. 2024** (Nature Astronomy 8, 1610; arXiv 2409.17261): the basins as
 *   probabilities over the HMC samples of the grouped CF4, finding only a slight preference
 *   for the Milky Way's basin being Shapley's rather than a Laniakea of its own. Its grids are
 *   not published.
 *
 * So the two reconstructions Dupuy & Courtois segmented disagree about Laniakea, as Valade et
 * al. find the data do: from the CF4 galaxies, Laniakea is a basin of its own, 1.9 x 10^6
 * (Mpc/h)^3 (basin 1 of the galaxies' grid); from the CF4 groups, the Milky Way's voxel flows
 * to Shapley, whose basin then takes in Laniakea and Apus, 27 x 10^6 (Mpc/h)^3. Both are
 * written; neither is the answer.
 *
 * ## The grids
 *
 * Each basin grid a FITS image, BITPIX -64, axes NAXIS1..3 = SGX, SGY, SGZ. Not so the density
 * and the velocity (BITPIX -32): theirs are the other way about, NAXIS1 = SGZ, as the page's
 * "(SGZ, SGY, SGX)" says, and they are transposed on reading (flows.ts says how that was found).
 * Here, x is SGX in every grid written. Voxel (i, j, k)
 * is at supergalactic (i - N/2, j - N/2, k - N/2) x 1000/N Mpc/h: the Milky Way at the
 * voxel N/2, not between voxels. Both were found by the data rather than assumed: every
 * attractor and repeller of Dupuy & Courtois's Table A.1 falls in its own basin's voxel this
 * way and in no other axis order (12 of 12), and their positions are whole voxels from N/2;
 * and the basins' voxel counts give back the paper's volumes (Laniakea 4,079 voxels, 1.94 x
 * 10^6 (Mpc/h)^3). Mpc/h is turned into parsecs with h = 0.746 (H0 74.6, the field's).
 *
 * ## What is written
 *
 * - **density.bin**: delta, the reconstruction's overdensity (rho / rho_mean - 1, a linear
 *   field: below -1 where the fit asks for it), as Int8 of 32 delta, rounded and clamped
 *   (a step of 1/32), the whole cube, 128^3 bytes (or 64^3 from the fallback) SGX fastest.
 * - **basins.bin**: three Uint8 grids of basin numbers, cropped to the box holding every
 *   basin kept (BASINS): the galaxies' basins of attraction, their basins of repulsion, and
 *   the groups' basins of attraction. The basins the SDSS volume shows at the far edge of the
 *   data (SDSS-1a to 2c) are set to 0: Dupuy & Courtois say themselves they cannot be
 *   constrained, their streamlines running off the grid for want of data beyond. Any basin of
 *   attraction more than Table A.1 names would be kept if it passes selectBasins' cuts (its
 *   size, and the field constrained at its attractor); by the paper's table, the grids hold none.
 */

// ---------------------------------------------------------------------------------------
// Files

/**
 * The files of a zip archive, by name. Stored and deflated entries both, from the central
 * directory (the local headers' sizes may be deferred to a data descriptor).
 */
export function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) {
    throw new Error('Not a zip archive: no end-of-central-directory record.');
  }
  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < entries; n += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) {
      throw new Error('A zip central directory entry is not where its directory says.');
    }
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (view.getUint32(local, true) !== 0x04034b50) {
      throw new Error(`The zip's ${name} has no local header where its directory says.`);
    }
    const dataAt = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + compressed);
    let data: Uint8Array;
    if (method === 0) {
      data = raw;
    } else if (method === 8) {
      data = new Uint8Array(inflateRawSync(raw));
    } else {
      throw new Error(`The zip's ${name} is compressed by method ${method}, which is not read here.`);
    }
    if (data.length !== size) {
      throw new Error(`The zip's ${name} is ${data.length} bytes, where its directory says ${size}.`);
    }
    files.set(name, data);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/** A FITS primary image of N^3 voxels (NAXIS1..3 equal; a fourth axis is refused), as numbers, NAXIS1 fastest. */
export function readFitsCube(bytes: Uint8Array): { size: number; values: Float64Array } {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 9));
  if (head !== 'SIMPLE  =') {
    throw new Error('Not a FITS file: it does not start with SIMPLE.');
  }
  const { cards, dataAt } = readHeader(bytes, 0);
  const axes = Number(cards.get('NAXIS'));
  const size = Number(cards.get('NAXIS1'));
  if (axes !== 3 || Number(cards.get('NAXIS2')) !== size || Number(cards.get('NAXIS3')) !== size) {
    throw new Error(`Expected a cube of N^3 voxels; the FITS image has NAXIS ${axes} (${cards.get('NAXIS1')}, ${cards.get('NAXIS2')}, ${cards.get('NAXIS3')}).`);
  }
  const bitpix = Number(cards.get('BITPIX'));
  const scale = Number(cards.get('BSCALE') ?? 1);
  const zero = Number(cards.get('BZERO') ?? 0);
  const count = size ** 3;
  const width = Math.abs(bitpix) / 8;
  if (dataAt + count * width > bytes.length) {
    throw new Error(`The FITS cube is cut short: ${bytes.length} bytes, where ${dataAt + count * width} are needed.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + dataAt, count * width);
  const read: Record<number, (at: number) => number> = {
    [-64]: (at) => view.getFloat64(at * 8),
    [-32]: (at) => view.getFloat32(at * 4),
    32: (at) => view.getInt32(at * 4),
    16: (at) => view.getInt16(at * 2),
    8: (at) => view.getUint8(at),
  };
  const get = read[bitpix];
  if (get === undefined) {
    throw new Error(`FITS BITPIX ${bitpix} is not read here.`);
  }
  const values = new Float64Array(count);
  for (let at = 0; at < count; at += 1) {
    values[at] = get(at) * scale + zero;
  }
  return { size, values };
}

// ---------------------------------------------------------------------------------------
// The basins

/** Mpc/h a side of every Cosmicflows-4 grid (Courtois et al. 2023). */
export const CF4_BOX_MPC_H = 1000;

/** The grids in the watersheds zip, by what they hold. */
export const WATERSHED_FILES = {
  galaxiesAttraction: 'CF4_new_128-z008_BoA.fits',
  galaxiesRepulsion: 'CF4_new_128-z008_BoR.fits',
  groupsAttraction: 'CF4gp_new_128-z008_BoA.fits',
} as const;

export type WatershedGrid = keyof typeof WATERSHED_FILES;

/**
 * Dupuy & Courtois 2023, Table A.1: each basin, its number in each grid (the table's rows in
 * order, blank ones skipped, as the page says), its attractor or repeller -- RA, Dec in
 * degrees and V_CMB in km/s, and SGX, SGY, SGZ in Mpc/h -- and its volume in 10^6 (Mpc/h)^3.
 * The galaxies' reconstruction first, the groups' second (null where that reconstruction
 * finds no such basin). Only the basins kept are listed: the SDSS ones are left out (see
 * the header).
 */
export interface BasinRow {
  readonly name: string;
  readonly kind: 'attraction' | 'repulsion';
  readonly galaxies: BasinFit | null;
  readonly groups: BasinFit | null;
}

export interface BasinFit {
  readonly label: number;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly vCmbKmS: number;
  readonly sgMpcH: Vec3;
  readonly volumeMpcH3: number;
}

export const BASINS: readonly BasinRow[] = [
  { name: 'Laniakea', kind: 'attraction', galaxies: { label: 1, raDeg: 263, decDeg: -39, vCmbKmS: 7412, sgMpcH: [-62, -8, 39], volumeMpcH3: 1.9e6 }, groups: null },
  { name: 'Apus', kind: 'attraction', galaxies: { label: 2, raDeg: 199, decDeg: -75, vCmbKmS: 13096, sgMpcH: [-125, -23, -31], volumeMpcH3: 9.5e6 }, groups: null },
  {
    name: 'Hercules',
    kind: 'attraction',
    galaxies: { label: 3, raDeg: 237, decDeg: 9, vCmbKmS: 11213, sgMpcH: [-39, 70, 78], volumeMpcH3: 3.1e6 },
    groups: { label: 1, raDeg: 234, decDeg: 7, vCmbKmS: 12002, sgMpcH: [-47, 78, 78], volumeMpcH3: 0.8e6 },
  },
  {
    name: 'Lepus',
    kind: 'attraction',
    galaxies: { label: 4, raDeg: 99, decDeg: -49, vCmbKmS: 13189, sgMpcH: [-62, -39, -109], volumeMpcH3: 8.1e6 },
    groups: { label: 2, raDeg: 88, decDeg: -43, vCmbKmS: 14427, sgMpcH: [-47, -55, -125], volumeMpcH3: 6.9e6 },
  },
  {
    name: 'Perseus-Pisces',
    kind: 'attraction',
    galaxies: { label: 5, raDeg: 56, decDeg: 21, vCmbKmS: 6102, sgMpcH: [47, -23, -31], volumeMpcH3: 4.8e6 },
    groups: { label: 3, raDeg: 62, decDeg: 18, vCmbKmS: 6536, sgMpcH: [47, -23, -39], volumeMpcH3: 2.0e6 },
  },
  {
    name: 'Shapley',
    kind: 'attraction',
    galaxies: { label: 6, raDeg: 199, decDeg: -40, vCmbKmS: 15468, sgMpcH: [-141, 62, -16], volumeMpcH3: 7.9e6 },
    groups: { label: 4, raDeg: 199, decDeg: -40, vCmbKmS: 15468, sgMpcH: [-141, 62, -16], volumeMpcH3: 27.0e6 },
  },
  { name: 'Sculptor Void', kind: 'repulsion', galaxies: { label: 1, raDeg: 18, decDeg: -16, vCmbKmS: 11294, sgMpcH: [23, -109, -16], volumeMpcH3: 1.3e6 }, groups: null },
  { name: 'Near the Bootes Void', kind: 'repulsion', galaxies: { label: 2, raDeg: 194, decDeg: 13, vCmbKmS: 12908, sgMpcH: [-31, 125, 8], volumeMpcH3: 7.8e6 }, groups: null },
  {
    name: 'Dipole Repeller and Cold Spot Repeller',
    kind: 'repulsion',
    galaxies: { label: 3, raDeg: 360, decDeg: 22, vCmbKmS: 19795, sgMpcH: [133, -133, 62], volumeMpcH3: 163.0e6 },
    groups: null,
  },
];

/** The grid each kind of basin of each reconstruction is in. */
export function basinGrid(kind: BasinRow['kind'], reconstruction: 'galaxies' | 'groups'): WatershedGrid | null {
  if (reconstruction === 'galaxies') {
    return kind === 'attraction' ? 'galaxiesAttraction' : 'galaxiesRepulsion';
  }
  return kind === 'attraction' ? 'groupsAttraction' : null;
}

/** A basin by its grid and number. */
export interface BasinRef {
  readonly grid: WatershedGrid;
  readonly label: number;
}

/** The basin numbers kept in each grid: Table A.1's, and any more selectBasins draws. */
export function keptLabels(grid: WatershedGrid, extra: readonly BasinRef[] = []): Set<number> {
  const labels = new Set<number>(extra.filter((b) => b.grid === grid).map((b) => b.label));
  for (const row of BASINS) {
    for (const reconstruction of ['galaxies', 'groups'] as const) {
      const fit = row[reconstruction];
      if (fit !== null && basinGrid(row.kind, reconstruction) === grid) {
        labels.add(fit.label);
      }
    }
  }
  return labels;
}

/** The scene position, pc, of a supergalactic point in Mpc/h. */
export function sgMpcHToScenePc(sg: Vec3): Vec3 {
  const pcPerMpcH = 1e6 / LITTLE_H;
  return supergalacticToScene([sg[0] * pcPerMpcH, sg[1] * pcPerMpcH, sg[2] * pcPerMpcH]);
}

/**
 * The 4x4 matrix taking a voxel's indices in a cropped grid, (i, j, k, 1), to its centre in
 * the scene frame, parsecs: column-major, as three.js's Matrix4.elements.
 */
export function voxelToScene(size: number, offset: Vec3): number[] {
  const cellPc = (CF4_BOX_MPC_H / size) * (1e6 / LITTLE_H);
  const axis = (sg: Vec3): Vec3 => supergalacticToScene(sg);
  const ex = axis([cellPc, 0, 0]);
  const ey = axis([0, cellPc, 0]);
  const ez = axis([0, 0, cellPc]);
  const half = size / 2;
  const origin = axis([(offset[0] - half) * cellPc, (offset[1] - half) * cellPc, (offset[2] - half) * cellPc]);
  return [...ex, 0, ...ey, 0, ...ez, 0, ...origin, 1];
}

export interface BasinCrop {
  readonly offset: Vec3;
  readonly size: Vec3;
  /** The three grids, cropped, in WATERSHED_FILES' order, unkept basins set to 0. */
  readonly grids: Readonly<Record<WatershedGrid, Uint8Array>>;
  /** Voxels of each kept basin, by grid and number: their volume, to check against the paper's. */
  readonly voxels: Readonly<Record<WatershedGrid, Readonly<Record<number, number>>>>;
  /** The basin each grid puts the Milky Way's voxel in. */
  readonly home: Readonly<Record<WatershedGrid, number>>;
}

/**
 * The kept basins of the three grids, cropped to the smallest box that holds every one of
 * them (the same box for all three), as Uint8 basin numbers, x (SGX) fastest.
 */
export function cropBasins(cubes: Readonly<Record<WatershedGrid, { size: number; values: Float64Array }>>, extra: readonly BasinRef[] = []): BasinCrop {
  const names = Object.keys(WATERSHED_FILES) as WatershedGrid[];
  const size = cubes.galaxiesAttraction.size;
  for (const name of names) {
    if (cubes[name].size !== size) {
      throw new Error(`The watershed grids differ in size: ${name} is ${cubes[name].size}^3, not ${size}^3.`);
    }
  }
  const lo: Vec3 = [size, size, size];
  const hi: Vec3 = [-1, -1, -1];
  const voxels = {} as Record<WatershedGrid, Record<number, number>>;
  const home = {} as Record<WatershedGrid, number>;
  const centre = size / 2 + size * (size / 2 + size * (size / 2));
  for (const name of names) {
    const kept = keptLabels(name, extra);
    const values = cubes[name].values;
    const counts: Record<number, number> = {};
    home[name] = values[centre]!;
    for (let k = 0; k < size; k += 1) {
      for (let j = 0; j < size; j += 1) {
        for (let i = 0; i < size; i += 1) {
          const label = values[i + size * (j + size * k)]!;
          if (!Number.isInteger(label) || label < 0 || label > 255) {
            throw new Error(`The ${name} grid holds ${label}, not a basin number.`);
          }
          if (!kept.has(label)) {
            continue;
          }
          counts[label] = (counts[label] ?? 0) + 1;
          lo[0] = Math.min(lo[0], i);
          lo[1] = Math.min(lo[1], j);
          lo[2] = Math.min(lo[2], k);
          hi[0] = Math.max(hi[0], i);
          hi[1] = Math.max(hi[1], j);
          hi[2] = Math.max(hi[2], k);
        }
      }
    }
    voxels[name] = counts;
  }
  if (hi[0] < 0) {
    throw new Error('The watershed grids hold none of the basins kept.');
  }
  const extent: Vec3 = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1];
  const grids = {} as Record<WatershedGrid, Uint8Array>;
  for (const name of names) {
    const kept = keptLabels(name, extra);
    const values = cubes[name].values;
    const out = new Uint8Array(extent[0] * extent[1] * extent[2]);
    for (let k = 0; k < extent[2]; k += 1) {
      for (let j = 0; j < extent[1]; j += 1) {
        for (let i = 0; i < extent[0]; i += 1) {
          const label = values[i + lo[0] + size * (j + lo[1] + size * (k + lo[2]))]!;
          out[i + extent[0] * (j + extent[1] * k)] = kept.has(label) ? label : 0;
        }
      }
    }
    grids[name] = out;
  }
  return { offset: lo, size: extent, grids, voxels, home };
}

/** Each kept basin's attractor (or repeller) in its own basin's voxel: the axis order's check. */
export function checkAttractors(cubes: Readonly<Record<WatershedGrid, { size: number; values: Float64Array }>>): string[] {
  const problems: string[] = [];
  for (const row of BASINS) {
    for (const reconstruction of ['galaxies', 'groups'] as const) {
      const fit = row[reconstruction];
      const grid = basinGrid(row.kind, reconstruction);
      if (fit === null || grid === null) {
        continue;
      }
      const { size, values } = cubes[grid];
      const cell = CF4_BOX_MPC_H / size;
      const [i, j, k] = fit.sgMpcH.map((c) => Math.round(c / cell) + size / 2) as Vec3;
      const label = values[i + size * (j + size * k)];
      if (label !== fit.label) {
        problems.push(`${row.name} (${reconstruction}): its ${row.kind === 'attraction' ? 'attractor' : 'repeller'} is in basin ${label}, not ${fit.label}`);
      }
    }
  }
  return problems;
}

/** The overdensity as Int8 of 32 delta, rounded and clamped. */
export const DENSITY_SCALE = 32;

export function quantiseDensity(values: Float64Array): Int8Array {
  const out = new Int8Array(values.length);
  for (let at = 0; at < values.length; at += 1) {
    out[at] = Math.max(-127, Math.min(127, Math.round(values[at]! * DENSITY_SCALE)));
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Every basin: what the grids hold, and which are drawn

/**
 * Dupuy & Courtois 2023's Table 1 lists every basin the two attraction grids hold: the
 * galaxies' thirteen -- the six named (BASINS) and seven at the far edge of the SDSS volume,
 * SDSS-1a to 1d and 2a to 2c -- and the groups' seven, Hercules, Lepus, Perseus-Pisces and
 * Shapley and SDSS-1a, 2a and 2b. The SDSS basins' numbers here are read off the table's row
 * order (blank rows skipped), as the named ones' are and are checked to be; theirs are not
 * checked -- their attractors lie by the grid's edge -- and they are cut whatever their number:
 * the authors say their streamlines run off the grid for want of data, so they "cannot be
 * constrained correctly". There is no Coma basin (the paper puts the Coma Supercluster inside
 * a larger basin) and no Arrowhead (Pomarede et al. 2015's, from Cosmicflows-2, is smaller than
 * this grid resolves).
 */
export const SDSS_BASINS: readonly (BasinRef & { readonly name: string })[] = [
  { name: 'SDSS-1a', grid: 'galaxiesAttraction', label: 7 },
  { name: 'SDSS-1b', grid: 'galaxiesAttraction', label: 8 },
  { name: 'SDSS-1c', grid: 'galaxiesAttraction', label: 9 },
  { name: 'SDSS-1d', grid: 'galaxiesAttraction', label: 10 },
  { name: 'SDSS-2a', grid: 'galaxiesAttraction', label: 11 },
  { name: 'SDSS-2b', grid: 'galaxiesAttraction', label: 12 },
  { name: 'SDSS-2c', grid: 'galaxiesAttraction', label: 13 },
  { name: 'SDSS-1a', grid: 'groupsAttraction', label: 5 },
  { name: 'SDSS-2a', grid: 'groupsAttraction', label: 6 },
  { name: 'SDSS-2b', grid: 'groupsAttraction', label: 7 },
];

/**
 * The cuts on a basin Table 1 does not name, should a grid hold one:
 *
 * - **size**: at least MIN_BASIN_VOXELS voxels, 0.12 million (Mpc/h)^3 at 128^3 -- a sphere 60
 *   Mpc/h (80 Mpc) across, four voxels in radius; the field is smoothed over a few voxels, and a
 *   basin smaller is the grid's noise, not a supercluster (the smallest Table 1 gives, the
 *   groups' Hercules, is 1,652 voxels);
 * - **reliability**: its attractor where the velocity field is constrained, by the flow lines'
 *   own rule (flows.ts): constraint() of the velocity's error there at least SEED_CONSTRAINT --
 *   an error under 130 km/s, where a flow line may start. Table 1's named basins are kept as the
 *   paper keeps them.
 */
export const MIN_BASIN_VOXELS = 250;

/**
 * Naming a basin Table 1 does not name: for the named structure (a supercluster or a cluster,
 * landmarks.ts) nearest its attractor -- "<it> basin" within NAME_WITHIN_PC, "Basin near <it>"
 * within NAME_NEAR_PC, else "Unnamed basin (CF4 ...)". 25 Mpc is two and a half voxels: the
 * reconstruction's attractor is smoothed over that.
 */
export const NAME_WITHIN_PC = 25e6;
export const NAME_NEAR_PC = 75e6;

/** A basin's voxels, box and densest voxel, as a grid gives them. */
export interface BasinStats {
  readonly label: number;
  readonly voxels: number;
  /** Its box in the grid's voxels, inclusive. */
  readonly lo: Vec3;
  readonly hi: Vec3;
  /** Its voxel of the highest overdensity (its first voxel where there is no density). */
  readonly peak: Vec3;
  /** Sum over its voxels of max(0, 1 + delta): its mass in voxels of the mean density. */
  readonly meanDensityVoxels: number;
}

/** A scalar on an N^3 grid centred on the Milky Way's voxel, x (SGX) fastest. */
export interface Cube {
  readonly size: number;
  readonly values: ArrayLike<number>;
}

/** A cube's value at voxel (i, j, k) of an N-grid, read at the nearest voxel of its own size. */
export function sampleAt(cube: Cube, n: number, i: number, j: number, k: number): number {
  const m = cube.size;
  const at = (p: number) => Math.min(m - 1, Math.max(0, Math.round(regrid(p, n, m))));
  return Number(cube.values[at(i) + m * (at(j) + m * at(k))]);
}

/** Every basin a grid holds (numbers over 0): its voxels, box and densest voxel. */
export function basinStats(grid: Cube, density: Cube | null): Map<number, BasinStats> {
  const n = grid.size;
  const out = new Map<number, { label: number; voxels: number; lo: Vec3; hi: Vec3; peak: Vec3; best: number; meanDensityVoxels: number }>();
  for (let k = 0; k < n; k += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const label = Number(grid.values[i + n * (j + n * k)]);
        if (!(label > 0)) continue;
        const delta = density === null ? 0 : sampleAt(density, n, i, j, k);
        let s = out.get(label);
        if (s === undefined) {
          s = { label, voxels: 0, lo: [i, j, k], hi: [i, j, k], peak: [i, j, k], best: delta, meanDensityVoxels: 0 };
          out.set(label, s);
        }
        s.voxels += 1;
        s.meanDensityVoxels += Math.max(0, 1 + delta);
        s.lo = [Math.min(s.lo[0], i), Math.min(s.lo[1], j), Math.min(s.lo[2], k)];
        s.hi = [Math.max(s.hi[0], i), Math.max(s.hi[1], j), Math.max(s.hi[2], k)];
        if (delta > s.best) {
          s.best = delta;
          s.peak = [i, j, k];
        }
      }
    }
  }
  return new Map([...out].map(([label, s]) => [label, { label, voxels: s.voxels, lo: s.lo, hi: s.hi, peak: s.peak, meanDensityVoxels: s.meanDensityVoxels }]));
}

/** Solar masses in a voxel of an N-grid at the mean matter density: Omega_m rho_crit, at H0 74.6. */
export function meanVoxelMassSun(n: number): number {
  const rhoCritSunPerMpc3 = 2.775e11 * LITTLE_H ** 2;
  return OMEGA_M * rhoCritSunPerMpc3 * (CF4_BOX_MPC_H / n / LITTLE_H) ** 3;
}

/** A named structure a basin may be named for: its name and scene position, pc. */
export interface NamedPlace {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A basin's name from the nearest named structure (see NAME_WITHIN_PC), never one already taken. */
export function nameBasin(
  attractorPc: Vec3,
  places: readonly NamedPlace[],
  fallback: string,
  taken: ReadonlySet<string> = new Set(),
): { name: string; naming: 'nearby' | 'near' | 'unnamed' } {
  let nearest: NamedPlace | null = null;
  let best = Infinity;
  for (const place of places) {
    const d = Math.hypot(place.x - attractorPc[0], place.y - attractorPc[1], place.z - attractorPc[2]);
    if (d < best) {
      best = d;
      nearest = place;
    }
  }
  if (nearest !== null && best <= NAME_WITHIN_PC) {
    const name = `${nearest.name.replace(/ (Supercluster|Cluster)$/, '')} basin`;
    if (!taken.has(name)) return { name, naming: 'nearby' };
  }
  if (nearest !== null && best <= NAME_NEAR_PC) {
    const name = `Basin near ${nearest.name}`;
    if (!taken.has(name)) return { name, naming: 'near' };
  }
  return { name: fallback, naming: 'unnamed' };
}

/** A basin drawn: Table 1's, or one more that passed the cuts. */
export interface DrawnBasin extends BasinRef {
  readonly name: string;
  /** Where its name is from: the paper's table, the structure at its attractor, one near it, or none. */
  readonly naming: 'paper' | 'nearby' | 'near' | 'unnamed';
  readonly voxels: number;
  /** Its attractor, supergalactic Mpc/h: the paper's, else where the flow from its densest voxel comes to rest. */
  readonly attractorSgMpcH: Vec3;
  /** Its box's sides along SGX, SGY, SGZ, Mpc/h. */
  readonly extentMpcH: Vec3;
  /** Its mass at the reconstruction's density, solar masses: an estimate (see selectBasins). */
  readonly massSun: number;
}

export interface BasinCut extends BasinRef {
  readonly name: string | null;
  readonly voxels: number;
  readonly why: 'sdss' | 'small' | 'unconstrained';
}

export interface BasinSelection {
  readonly drawn: DrawnBasin[];
  readonly cuts: BasinCut[];
}

export interface BasinSelectionInput {
  readonly cubes: Readonly<Record<WatershedGrid, Cube>>;
  /** The overdensity, for each basin's densest voxel and its mass; null: neither. */
  readonly density: Cube | null;
  /** The velocity's error, km/s, for the reliability cut; null: every basin Table 1 does not name is cut. */
  readonly error: Cube | null;
  /** The named structures a basin may be named for. */
  readonly places: readonly NamedPlace[];
  /**
   * Where the flow from a voxel of the grid comes to rest, fractional voxels, or null where it
   * does not (flows.ts traceStreamline); absent, the densest voxel stands for the attractor.
   */
  readonly settle?: (grid: WatershedGrid, voxel: Vec3) => Vec3 | null;
}

/**
 * Every basin of attraction the two attraction grids hold, drawn or cut. Table 1's named
 * basins are drawn as the paper names and places them; the SDSS ones are cut; any other is
 * drawn if it passes MIN_BASIN_VOXELS and its attractor the reliability cut, named by
 * nameBasin. Each drawn basin's mass is the mean matter density times its volume weighted by
 * 1 + delta of the galaxies' reconstruction, floored at 0 -- a linear field, so a rough
 * figure, labelled as estimated; the paper gives volumes only.
 */
export function selectBasins(input: BasinSelectionInput): BasinSelection {
  const drawn: DrawnBasin[] = [];
  const cuts: BasinCut[] = [];
  const taken = new Set<string>([...BASINS.map((row) => row.name), ...input.places.map((p) => p.name)]);
  for (const grid of ['galaxiesAttraction', 'groupsAttraction'] as const) {
    const cube = input.cubes[grid];
    const n = cube.size;
    const cell = CF4_BOX_MPC_H / n;
    const stats = basinStats(cube, input.density);
    const voxelMass = meanVoxelMassSun(n);
    const reconstruction = grid === 'galaxiesAttraction' ? 'galaxies' : 'groups';
    for (const s of [...stats.values()].sort((a, b) => a.label - b.label)) {
      const extentMpcH: Vec3 = [(s.hi[0] - s.lo[0] + 1) * cell, (s.hi[1] - s.lo[1] + 1) * cell, (s.hi[2] - s.lo[2] + 1) * cell];
      const massSun = Number((s.meanDensityVoxels * voxelMass).toPrecision(2));
      const row = BASINS.find((r) => r.kind === 'attraction' && r[reconstruction]?.label === s.label);
      if (row !== undefined) {
        const fit = row[reconstruction]!;
        drawn.push({ grid, label: s.label, name: row.name, naming: 'paper', voxels: s.voxels, attractorSgMpcH: fit.sgMpcH, extentMpcH, massSun });
        continue;
      }
      const sdss = SDSS_BASINS.find((b) => b.grid === grid && b.label === s.label);
      if (sdss !== undefined) {
        cuts.push({ grid, label: s.label, name: sdss.name, voxels: s.voxels, why: 'sdss' });
        continue;
      }
      if (s.voxels < MIN_BASIN_VOXELS) {
        cuts.push({ grid, label: s.label, name: null, voxels: s.voxels, why: 'small' });
        continue;
      }
      const settled = input.settle?.(grid, s.peak) ?? null;
      const inside = (p: Vec3) => {
        const [i, j, k] = p.map((c) => Math.round(c)) as Vec3;
        return i >= 0 && j >= 0 && k >= 0 && i < n && j < n && k < n && Number(cube.values[i + n * (j + n * k)]) === s.label;
      };
      const at: Vec3 = settled !== null && inside(settled) ? settled : s.peak;
      const error = input.error === null ? Infinity : sampleAt(input.error, n, at[0], at[1], at[2]);
      if (!(constraint(error) >= SEED_CONSTRAINT)) {
        cuts.push({ grid, label: s.label, name: null, voxels: s.voxels, why: 'unconstrained' });
        continue;
      }
      const attractorSgMpcH: Vec3 = [(at[0] - n / 2) * cell, (at[1] - n / 2) * cell, (at[2] - n / 2) * cell];
      const fallback = `Unnamed basin (CF4 ${reconstruction}, ${s.label})`;
      const { name, naming } = nameBasin(sgMpcHToScenePc(attractorSgMpcH), input.places, fallback, taken);
      taken.add(name);
      drawn.push({ grid, label: s.label, name, naming, voxels: s.voxels, attractorSgMpcH, extentMpcH, massSun });
    }
  }
  return { drawn, cuts };
}
