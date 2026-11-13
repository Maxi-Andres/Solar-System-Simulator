import { inflateRawSync } from 'node:zlib';

import { readHeader } from '../localGroup/nearbyGalaxies.ts';
import { LITTLE_H, supergalacticToScene, type Vec3 } from './frames.ts';

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
 * Each a FITS image, BITPIX -64 (the basins) or -32 (delta), axes NAXIS1..3 = SGX, SGY, SGZ
 * -- the page's "(SGZ, SGY, SGX)" is the array's order in C, slowest first. Voxel (i, j, k)
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
 *   (a step of 1/32), the whole cube, 128^3 bytes (or 64^3 from the fallback).
 * - **basins.bin**: three Uint8 grids of basin numbers, cropped to the box holding every
 *   basin kept (BASINS): the galaxies' basins of attraction, their basins of repulsion, and
 *   the groups' basins of attraction. The basins the SDSS volume shows at the far edge of the
 *   data (SDSS-1a to 2c) are set to 0: Dupuy & Courtois say themselves they cannot be
 *   constrained, their streamlines running off the grid for want of data beyond.
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

/** The basin numbers kept in each grid. */
export function keptLabels(grid: WatershedGrid): Set<number> {
  const labels = new Set<number>();
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
export function cropBasins(cubes: Readonly<Record<WatershedGrid, { size: number; values: Float64Array }>>): BasinCrop {
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
    const kept = keptLabels(name);
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
    const kept = keptLabels(name);
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
