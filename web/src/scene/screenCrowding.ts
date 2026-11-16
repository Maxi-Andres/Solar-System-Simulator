import { FLOOR_FULL_SEPARATION_PX } from './crowding.ts';

/**
 * Where on the screen a catalogue's faint dots crowd (CosmicWeb.tsx's galaxies), cell by cell.
 *
 * crowding.ts dims a catalogue's faint dots as a whole by how crowded the nearer half of it is on
 * the screen: Laniakea's, all over the sky, is a ball. The SDSS's are wedges
 * 9 billion light years deep, seen from inside or beside them: a third of the screen can hold a
 * million dots a pixel or two apart while the rest is empty, and the dots there, added, were a
 * grey haze over the wedge that hid what it held. So, in each cell of a coarse grid on the
 * screen, the dots' separation there: a fixed sample of the galaxies drawn, projected each
 * frame, counted in cells of CELL_PX, smoothed over the cells about each, and scaled to all of
 * them. Where they are under CROWDED_SEPARATION_PX apart, each dot is (separation / that)^2
 * of itself -- so the dots of a crowded cell add up to no more than they do at that separation,
 * a faint even glow over the cell, its texture the dots' own weights: the web's contrast and
 * not the depth of the survey behind it -- crowding.ts's rule, cell by cell, in place of its
 * whole-catalogue one (CosmicWeb.tsx takes only its floorShown). Their light, the sprites of
 * their luminosity, is untouched.
 */

/** The separation, device pixels, under which the dots of a cell are dimmed: crowding.ts's own, so both keep the same patch brightness. */
export const CROWDED_SEPARATION_PX = FLOOR_FULL_SEPARATION_PX;

/** A cell's side, device pixels at most: the grid is the drawing buffer over this, rounded up. */
export const CELL_PX = 48;
/** The galaxies sampled for it: a few dozen in a cell where the dots are a pixel apart. */
export const CROWDING_SAMPLE = 16384;

export interface CrowdingGrid {
  readonly cols: number;
  readonly rows: number;
  /** A byte a cell, row 0 at the bottom (as a texture): each dot's share kept there, 0-255. */
  readonly kept: Uint8Array;
  readonly counts: Float32Array;
}

export function crowdingGrid(widthPx: number, heightPx: number): CrowdingGrid {
  const cols = Math.max(1, Math.ceil(widthPx / CELL_PX));
  const rows = Math.max(1, Math.ceil(heightPx / CELL_PX));
  return { cols, rows, kept: new Uint8Array(cols * rows).fill(255), counts: new Float32Array(cols * rows) };
}

/**
 * Fills `grid.kept` for `samplePc` (x, y, z, pc about the Sun, `sampleCount` of them standing
 * for `perSample` galaxies each), seen from `cameraPc` with the camera's inverse rotation
 * `toView` (a column-major 3x3) and its projection's x and y scales `e0`, `e5`.
 */
export function measureCrowding(
  grid: CrowdingGrid,
  samplePc: Float32Array,
  sampleCount: number,
  perSample: number,
  cameraPc: { readonly x: number; readonly y: number; readonly z: number },
  toView: ArrayLike<number>,
  e0: number,
  e5: number,
  widthPx: number,
  heightPx: number,
): void {
  const { cols, rows, counts, kept } = grid;
  counts.fill(0);
  const m = toView;
  for (let k = 0; k < sampleCount; k += 1) {
    const x = samplePc[k * 3]! - cameraPc.x;
    const y = samplePc[k * 3 + 1]! - cameraPc.y;
    const z = samplePc[k * 3 + 2]! - cameraPc.z;
    const vz = m[2]! * x + m[5]! * y + m[8]! * z;
    if (vz >= 0) continue;
    const vx = m[0]! * x + m[3]! * y + m[6]! * z;
    const vy = m[1]! * x + m[4]! * y + m[7]! * z;
    const sx = ((e0 * vx) / -vz + 1) * 0.5;
    const sy = ((e5 * vy) / -vz + 1) * 0.5;
    if (sx < 0 || sx >= 1 || sy < 0 || sy >= 1) continue;
    counts[Math.floor(sy * rows) * cols + Math.floor(sx * cols)]! += 1;
  }
  const cellArea = (widthPx / cols) * (heightPx / rows);
  const full2 = CROWDED_SEPARATION_PX * CROWDED_SEPARATION_PX;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      // The cells about it, averaged: a few dozen samples where it matters, not a few.
      let n = 0;
      let cells = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          n += counts[rr * cols + cc]!;
          cells += 1;
        }
      }
      // Dots a pixel squared: separation^2 is its inverse.
      const density = (n * perSample) / (cells * cellArea);
      kept[r * cols + c] = Math.round(255 * Math.min(1, 1 / Math.max(1e-12, density * full2)));
    }
  }
}
