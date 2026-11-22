import * as THREE from 'three';

import type { MemberFolds } from './markHosts.ts';

/**
 * The galaxies' marks decluttered: which of the Local Volume's and Laniakea's marks show this
 * frame (LocalGroup.tsx, Laniakea.tsx).
 *
 * Every frame the camera moves, so it is kept cheap: the marks projected with three's own
 * quaternion arithmetic written out, the same numbers to the last bit, and placed in a grid of
 * typed arrays over the screen that is reused from frame to frame, rather than a map of
 * arrays and a pair allocated a mark. Laniakea's 86,899 galaxies are mostly folded away from
 * anywhere; it hands over only those that could change (`candidates`), the rest left as they
 * were, which is what a pass over them would have left them.
 */

/** The galaxies' mark, an ellipse, CSS pixels across: no two closer than this both show. */
export const GALAXY_MARK_PX = 15;

/** How near a held mark may let another come before it goes, as a share of the mark's size. */
export const MARK_HELD_FRACTION = 0.7;

/** The marks as the declutter reads and writes them. */
export interface Marks {
  readonly centres: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  readonly shown: THREE.BufferAttribute;
  /** Most luminous first. */
  readonly order: readonly number[];
  /** 1 where the galaxy is a body, whose own marker stands for it. */
  readonly body: Uint8Array;
  /** 1 where the mark kept its place last frame. */
  readonly kept: Uint8Array;
  /** Each one's host, and this frame's fold into it (markFolding.ts). */
  readonly folds: MemberFolds;
}

/** Some of the marks, in their declutter order (`Marks.order`): the first `count` of `list`. */
export interface MarkCandidates {
  readonly list: Int32Array;
  readonly count: number;
}

const inverse = new THREE.Quaternion();

/** The screen's grid, reused: each cell's first placed mark, and each placed mark's next and place. */
let heads = new Int32Array(0);
let next = new Int32Array(64);
let placedX = new Float64Array(64);
let placedY = new Float64Array(64);
/** Each mark's place on the screen this frame, in the order looked at. */
let screenX = new Float64Array(64);
let screenY = new Float64Array(64);

/**
 * Which marks show: the bodies' places taken first, then each galaxy's, most luminous first,
 * where no mark already placed lies within a mark's size, GALAXY_MARK_PX -- one already shown
 * holding its place unless another comes within MARK_HELD_FRACTION of that, so a pair at the
 * threshold does not swap each frame. `width` and `height` are the canvas's, CSS pixels.
 *
 * A mark folded into its host's (markFolding.ts) takes no place; one folding is drawn as much
 * as it is there, its fold this frame.
 *
 * `candidates`, if given, are the only marks looked at, in their order: every mark left out must
 * be one a pass would leave as it is -- not a body, folded away (fold 0), not shown and kept --
 * which is what a pass leaves such a mark as.
 */
export function declutterMarks(
  marks: Marks,
  frameCamera: THREE.Camera,
  cameraPc: { readonly x: number; readonly y: number; readonly z: number },
  width: number,
  height: number,
  candidates?: MarkCandidates,
): void {
  const S = GALAXY_MARK_PX;
  frameCamera.updateMatrixWorld();
  inverse.copy(frameCamera.quaternion).invert();
  const qx = inverse.x;
  const qy = inverse.y;
  const qz = inverse.z;
  const qw = inverse.w;
  const e = (frameCamera as THREE.PerspectiveCamera).projectionMatrix.elements;
  const e0 = e[0]!;
  const e5 = e[5]!;
  const camX = cameraPc.x;
  const camY = cameraPc.y;
  const camZ = cameraPc.z;

  // Marks are placed from -S to the far edge plus S, so their cells and the cells about those
  // run from -2 to the far edge's plus 2: two cells of margin each side, and one more for the
  // rounding of a place on the far edge.
  const columns = (width > 0 && Number.isFinite(width) ? Math.floor(width / S) : 0) + 6;
  const rows = (height > 0 && Number.isFinite(height) ? Math.floor(height / S) : 0) + 6;
  if (heads.length < columns * rows) heads = new Int32Array(columns * rows);
  const count = candidates === undefined ? marks.order.length : candidates.count;
  if (next.length < count) {
    next = new Int32Array(count);
    placedX = new Float64Array(count);
    placedY = new Float64Array(count);
    screenX = new Float64Array(count);
    screenY = new Float64Array(count);
  }
  const cellHead = heads;
  const cellNext = next;
  const atX = placedX;
  const atY = placedY;
  const sx = screenX;
  const sy = screenY;
  cellHead.fill(-1, 0, columns * rows);
  let placedCount = 0;

  const shown = marks.shown;
  const shownArray = shown.array as Float32Array;
  const { body, kept, centres, order } = marks;
  const value = marks.folds.value;
  const list = candidates?.list;

  // Where each mark that needs a place is on the screen -- a body, or one not folded away --
  // as Vector3.applyQuaternion puts it; not a number where it is off the screen, behind the
  // camera or nowhere (a place that is not a number is near nothing, and nothing is near it,
  // so both are kept and take no place, as before).
  for (let n = 0; n < count; n += 1) {
    const i = list === undefined ? order[n]! : list[n]!;
    if (body[i] !== 1 && value[i] === 0) continue;
    const centre = centres[i]!;
    const vx = centre.x - camX;
    const vy = centre.y - camY;
    const vz = centre.z - camZ;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    const rx = vx + qw * tx + qy * tz - qz * ty;
    const ry = vy + qw * ty + qz * tx - qx * tz;
    const rz = vz + qw * tz + qx * ty - qy * tx;
    const depth = -rz;
    let x = Number.NaN;
    let y = Number.NaN;
    if (depth > 0) {
      x = ((e0 * rx) / depth + 1) * 0.5 * width;
      y = (1 - (e5 * ry) / depth) * 0.5 * height;
      if (x < -S || y < -S || x > width + S || y > height + S) {
        x = Number.NaN;
        y = Number.NaN;
      }
    }
    sx[n] = x;
    sy[n] = y;
  }

  let changed = false;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let n = 0; n < count; n += 1) {
      const i = list === undefined ? order[n]! : list[n]!;
      // The bodies' places first, then the galaxies'.
      if ((body[i] === 1) !== (pass === 0)) continue;
      if (pass === 1 && value[i] === 0) {
        // Folded away: kept, so it comes back as it was.
        kept[i] = 1;
        if (shownArray[i] !== 0) {
          shownArray[i] = 0;
          changed = true;
        }
        continue;
      }
      const x = sx[n]!;
      const y = sy[n]!;
      let keep = true;
      if (x === x && y === y) {
        const cx = Math.floor(x / S) + 2;
        const cy = Math.floor(y / S) + 2;
        if (pass === 1) {
          const gap = kept[i] === 1 ? S * MARK_HELD_FRACTION : S;
          search: for (let a = -1; a <= 1; a += 1) {
            for (let b = -1; b <= 1; b += 1) {
              for (let p = cellHead[(cy + b) * columns + cx + a]!; p >= 0; p = cellNext[p]!) {
                if (Math.abs(atX[p]! - x) < gap && Math.abs(atY[p]! - y) < gap) {
                  keep = false;
                  break search;
                }
              }
            }
          }
        }
        if (keep) {
          const cell = cy * columns + cx;
          atX[placedCount] = x;
          atY[placedCount] = y;
          cellNext[placedCount] = cellHead[cell]!;
          cellHead[cell] = placedCount;
          placedCount += 1;
        }
      }
      // Off the screen, or nowhere: kept, so it comes back as it was.
      kept[i] = keep ? 1 : 0;
      const show = keep && body[i] === 0 ? value[i]! : 0;
      const was = shownArray[i]!;
      if (was !== show && (Math.abs(was - show) > 1 / 512 || show === 0 || show === 1)) {
        shownArray[i] = show;
        changed = true;
      }
    }
  }
  if (changed) {
    shown.needsUpdate = true;
  }
}
