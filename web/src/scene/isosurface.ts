/**
 * A basin's boundary as a surface (Laniakea.tsx): the watershed grid's voxels of one label
 * (laniakea/basins.bin) turned into a closed mesh.
 *
 * ## From labels to a field
 *
 * A basin is a set of voxels, 10.5 Mpc each, and its edge in the grid is a staircase. The
 * reconstruction does not know it to a voxel -- the watershed of a smooth velocity field
 * sampled on a grid -- so the staircase is not the thing to draw: the label's indicator (1 in,
 * 0 out) is blurred once by a three-voxel kernel, [1 2 1] / 4 along each axis, and the surface
 * drawn where that field is one half: through the middle of the voxels' faces where the edge is
 * flat, and rounding its corners. Nothing moves by more than half a voxel.
 *
 * ## Surface nets
 *
 * Naive surface nets (Gibson 1998, "Constrained elastic surface nets"): one vertex in each cell
 * the surface crosses, at the mean of the points where it crosses the cell's edges, and one quad
 * for each grid edge it crosses, joining the four cells about that edge. Closed wherever the
 * field is closed -- the crop is padded with empty voxels, so a basin cut by the grid's edge is
 * closed there -- and two triangles a quad, wound so that the field's inside is behind them.
 * No table of 256 cases, which is marching cubes' price for the same surface.
 */

export interface IsoMesh {
  /** x, y, z per vertex, in the field's voxel indices (fractional). */
  readonly positions: Float32Array;
  /** Three vertex indices per triangle. */
  readonly indices: Uint32Array;
}

/** The [1 2 1] / 4 kernel along each axis in turn, in place of `field` (nx x ny x nz, x fastest). */
export function blur121(field: Float32Array, nx: number, ny: number, nz: number): Float32Array {
  let a: Float32Array = field;
  let b: Float32Array = new Float32Array(field.length);
  const strides = [1, nx, nx * ny];
  const sizes = [nx, ny, nz];
  for (let axis = 0; axis < 3; axis += 1) {
    const stride = strides[axis]!;
    const n = sizes[axis]!;
    for (let k = 0; k < nz; k += 1) {
      for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const at = i + nx * (j + ny * k);
          const c = axis === 0 ? i : axis === 1 ? j : k;
          const lo = c > 0 ? a[at - stride]! : 0;
          const hi = c < n - 1 ? a[at + stride]! : 0;
          b[at] = 0.25 * lo + 0.5 * a[at]! + 0.25 * hi;
        }
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/** The surface where `field` crosses `level`; inside is above it. */
export function surfaceNets(field: Float32Array, nx: number, ny: number, nz: number, level = 0.5): IsoMesh {
  const at = (i: number, j: number, k: number) => field[i + nx * (j + ny * k)]! - level;
  const cx = nx - 1;
  const cy = ny - 1;
  const cz = nz - 1;
  const cellVertex = new Int32Array(Math.max(0, cx * cy * cz)).fill(-1);
  const positions: number[] = [];
  const corner = new Float64Array(8);
  // The cube's twelve edges, by its corners (bit 0 x, bit 1 y, bit 2 z).
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  for (let k = 0; k < cz; k += 1) {
    for (let j = 0; j < cy; j += 1) {
      for (let i = 0; i < cx; i += 1) {
        let mask = 0;
        for (let c = 0; c < 8; c += 1) {
          const v = at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1));
          corner[c] = v;
          if (v > 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a]!;
          const vb = corner[b]!;
          if (va > 0 === vb > 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + t * ((b & 1) - (a & 1));
          sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
          sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
          n += 1;
        }
        cellVertex[i + cx * (j + cy * k)] = positions.length / 3;
        positions.push(i + sx / n, j + sy / n, k + sz / n);
      }
    }
  }
  const indices: number[] = [];
  const cell = (i: number, j: number, k: number) => cellVertex[i + cx * (j + cy * k)]!;
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const inside = at(i, j, k) > 0;
        // The edge along x from this point, between the four cells about it.
        if (i < cx && j > 0 && j < cy && k > 0 && k < cz && inside !== at(i + 1, j, k) > 0) {
          quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !inside);
        }
        if (j < cy && i > 0 && i < cx && k > 0 && k < cz && inside !== at(i, j + 1, k) > 0) {
          quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !inside);
        }
        if (k < cz && i > 0 && i < cx && j > 0 && j < cy && inside !== at(i, j, k + 1) > 0) {
          quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !inside);
        }
      }
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/**
 * A label's boundary in a grid of labels (x fastest), in the grid's voxel indices: cropped to the
 * label's voxels and a margin, padded with empty voxels, blurred, and netted at one half.
 * Null where the label has no voxel.
 */
export function labelSurface(labels: Uint8Array, size: readonly [number, number, number], label: number): IsoMesh | null {
  const [nx, ny, nz] = size;
  let lo = [nx, ny, nz];
  let hi = [-1, -1, -1];
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        if (labels[i + nx * (j + ny * k)] !== label) continue;
        lo = [Math.min(lo[0]!, i), Math.min(lo[1]!, j), Math.min(lo[2]!, k)];
        hi = [Math.max(hi[0]!, i), Math.max(hi[1]!, j), Math.max(hi[2]!, k)];
      }
    }
  }
  if (hi[0]! < 0) return null;
  // Two voxels of margin: one the blur spreads into, one empty about it, so the surface closes.
  const margin = 2;
  const o = lo.map((v) => v - margin);
  const m = [hi[0]! - lo[0]! + 1 + 2 * margin, hi[1]! - lo[1]! + 1 + 2 * margin, hi[2]! - lo[2]! + 1 + 2 * margin] as const;
  const field = new Float32Array(m[0] * m[1] * m[2]);
  for (let k = 0; k < m[2]; k += 1) {
    for (let j = 0; j < m[1]; j += 1) {
      for (let i = 0; i < m[0]; i += 1) {
        const gi = i + o[0]!;
        const gj = j + o[1]!;
        const gk = k + o[2]!;
        if (gi < 0 || gj < 0 || gk < 0 || gi >= nx || gj >= ny || gk >= nz) continue;
        field[i + m[0] * (j + m[1] * k)] = labels[gi + nx * (gj + ny * gk)] === label ? 1 : 0;
      }
    }
  }
  const mesh = surfaceNets(blur121(field, m[0], m[1], m[2]), m[0], m[1], m[2], 0.5);
  const positions = mesh.positions;
  for (let v = 0; v < positions.length; v += 3) {
    positions[v] = positions[v]! + o[0]!;
    positions[v + 1] = positions[v + 1]! + o[1]!;
    positions[v + 2] = positions[v + 2]! + o[2]!;
  }
  return mesh;
}
