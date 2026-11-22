/**
 * When the Milky Way's glow buffer (MilkyWay.tsx) can be kept from one frame to the next instead
 * of drawn again: its 280,000 sprites in six slabs cost the most of any layer in the picture,
 * and most frames show it from where the last one did.
 *
 * - **Still**: nothing it depends on has changed -- the camera's place about the Sun, its turn,
 *   its projection, the buffer's size, the fade. Then the buffer already holds this frame's
 *   picture, to the bit, and is shown again as it is (sameView).
 * - **Moving, the galaxy small**: from the Local Group out the whole galaxy is a few dozen pixels
 *   or less, and a turn of the camera moves it across the screen far more than it turns it. The
 *   last picture is then laid where this frame would put it -- the plane through the galaxy's
 *   centre, square to the line of sight, carried from the one view to the other (warpBetween) --
 *   as long as no part of the galaxy, front or back, lands farther than WARP_PX from where a
 *   fresh drawing would put it (warpError). The first still frame draws it in full again.
 * - **Under the floor**: from far enough away even the largest sprite, shrunk to its fraction of
 *   a pixel, is fainter than the glow buffer's floor, where the shader discards it (glowBuffer.ts
 *   GLOW_FLOOR). Every fragment would be thrown away: nothing is drawn (underFloor).
 *
 * Everything here is in the scene's units about the galaxy's centre, float64.
 */

import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';

const UNITS_PER_PC = PARSEC_KM / KM_PER_UNIT;

/** What the glow buffer was drawn from. */
export interface GlowView {
  /** The camera about the Sun, parsecs, in the scene's frame. */
  readonly position: readonly [number, number, number];
  /** The camera's world matrix, three's column-major elements (its turn; the place is `position`). */
  readonly world: readonly number[];
  /** Its projection matrix, column-major. */
  readonly projection: readonly number[];
  /** The buffer's size, pixels. */
  readonly width: number;
  readonly height: number;
  /** The galaxy's fade (MilkyWay.tsx galaxyVisibility). */
  readonly visibility: number;
}

/** The most a kept picture may stray from a fresh one while the camera moves, glow-buffer pixels. */
export const WARP_PX = 0.5;

/** The most the galaxy may grow or shrink on screen under a kept picture: its sprites keep their size. */
export const WARP_SCALE = 0.03;

/** How far inside the kept picture's edge the galaxy must have been, as a share of its half-size. */
export const WARP_MARGIN = 0.02;

/** Still, for the buffer: the camera's place, as a share of its distance from the Sun; turn and projection terms. */
export const SAME_PLACE_SHARE = 1e-6;
export const SAME_TURN = 1e-7;

/**
 * Whether `a` and `b` draw the same buffer: the same size and fade, the camera's turn and
 * projection the same to SAME_TURN, its place to SAME_PLACE_SHARE of its distance from the Sun --
 * a millionth, which moves the nearest sprite drawn (NEAR_FADE_SHARE of that distance away, and
 * more) by a few thousandths of a pixel.
 */
export function sameView(a: GlowView, b: GlowView): boolean {
  if (a.width !== b.width || a.height !== b.height || Math.abs(a.visibility - b.visibility) > 1e-9) {
    return false;
  }
  for (let i = 0; i < 16; i += 1) {
    if (i >= 12 && i <= 14) continue;
    if (Math.abs(a.world[i]! - b.world[i]!) > SAME_TURN) return false;
    if (Math.abs(a.projection[i]! - b.projection[i]!) > SAME_TURN * Math.max(1, Math.abs(a.projection[i]!))) return false;
  }
  const reach = Math.max(Math.hypot(...a.position), 1e-9);
  const moved = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
  return moved <= SAME_PLACE_SHARE * reach;
}

type Vec3 = [number, number, number];

/** A point (w = 1) or a direction (w = 0), about the galaxy's centre, to clip x, y, w through `view`. */
function clip(view: GlowView, centre: readonly number[], x: number, y: number, z: number, w: number): Vec3 {
  // About the camera: the point less the camera's place, both about the centre.
  const px = x - w * (view.position[0] - centre[0]!);
  const py = y - w * (view.position[1] - centre[1]!);
  const pz = z - w * (view.position[2] - centre[2]!);
  const m = view.world;
  // Into the camera's frame, the transpose of its turn, and into scene units, as the projection takes them.
  const vx = (m[0]! * px + m[1]! * py + m[2]! * pz) * UNITS_PER_PC;
  const vy = (m[4]! * px + m[5]! * py + m[6]! * pz) * UNITS_PER_PC;
  const vz = (m[8]! * px + m[9]! * py + m[10]! * pz) * UNITS_PER_PC;
  const p = view.projection;
  return [
    p[0]! * vx + p[4]! * vy + p[8]! * vz + p[12]! * w,
    p[1]! * vx + p[5]! * vy + p[9]! * vz + p[13]! * w,
    p[3]! * vx + p[7]! * vy + p[11]! * vz + p[15]! * w,
  ];
}

/** 3 x 3, row-major. */
type Mat3 = number[];

function inverse3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-300) return null;
  const s = 1 / det;
  return [
    A * s, -(b * i - c * h) * s, (b * f - c * e) * s,
    B * s, (a * i - c * g) * s, -(a * f - c * d) * s,
    C * s, -(a * h - b * g) * s, (a * e - b * d) * s,
  ];
}

function multiply3(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = new Array(9).fill(0);
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
    }
  }
  return out;
}

function apply3(m: Mat3, x: number, y: number, w: number): Vec3 {
  return [m[0]! * x + m[1]! * y + m[2]! * w, m[3]! * x + m[4]! * y + m[5]! * w, m[6]! * x + m[7]! * y + m[8]! * w];
}

export interface Warp {
  /** This frame's buffer uv, homogeneous, to the kept picture's: row-major, for a mat3 uniform. */
  readonly uv: readonly number[];
  /** The farthest any part of the galaxy lands from where a fresh drawing would put it, this buffer's pixels. */
  readonly errorPx: number;
}

/**
 * The plane through the galaxy's centre, square to the line of sight halfway between the kept
 * view and this one, carried from this frame's buffer to the kept picture: a homography, the
 * plane's coordinates through each view's projection (M = [e1 e2 centre] in clip x, y, w),
 * kept-from-current = M_kept M_now^-1. Null if it cannot be used: the galaxy behind or around
 * either camera, not wholly inside the kept picture, or grown or shrunk past WARP_SCALE.
 *
 * `centre` is the galaxy's centre about the Sun, pc, and `radiusPc` a sphere about it holding
 * all of its points. `errorPx` is measured, not bounded: the sphere's poles and its fourteen
 * points along the axes and diagonals, each projected through this view and through the kept
 * one carried here, in this buffer's pixels.
 */
export function warpBetween(
  kept: GlowView,
  now: GlowView,
  centre: readonly [number, number, number],
  radiusPc: number,
): Warp | null {
  const toKept: Vec3 = [centre[0] - kept.position[0], centre[1] - kept.position[1], centre[2] - kept.position[2]];
  const toNow: Vec3 = [centre[0] - now.position[0], centre[1] - now.position[1], centre[2] - now.position[2]];
  const keptDistance = Math.hypot(...toKept);
  const nowDistance = Math.hypot(...toNow);
  // Outside the galaxy by a good margin, both times: from nearer it is no small thing on screen.
  if (keptDistance < 3 * radiusPc || nowDistance < 3 * radiusPc) return null;
  if (Math.abs(nowDistance / keptDistance - 1) > WARP_SCALE) return null;
  const n: Vec3 = [
    toKept[0] / keptDistance + toNow[0] / nowDistance,
    toKept[1] / keptDistance + toNow[1] / nowDistance,
    toKept[2] / keptDistance + toNow[2] / nowDistance,
  ];
  const nLength = Math.hypot(...n);
  if (nLength < 1e-6) return null;
  n[0] /= nLength;
  n[1] /= nLength;
  n[2] /= nLength;
  // Two directions square to it.
  const seed: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1: Vec3 = [n[1] * seed[2] - n[2] * seed[1], n[2] * seed[0] - n[0] * seed[2], n[0] * seed[1] - n[1] * seed[0]];
  const e1Length = Math.hypot(...e1);
  e1[0] /= e1Length;
  e1[1] /= e1Length;
  e1[2] /= e1Length;
  const e2: Vec3 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const plane = (view: GlowView): Mat3 => {
    const a = clip(view, centre, e1[0] * radiusPc, e1[1] * radiusPc, e1[2] * radiusPc, 0);
    const b = clip(view, centre, e2[0] * radiusPc, e2[1] * radiusPc, e2[2] * radiusPc, 0);
    const c = clip(view, centre, 0, 0, 0, 1);
    return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
  };
  const nowInverse = inverse3(plane(now));
  if (nowInverse === null) return null;
  const ndc = multiply3(plane(kept), nowInverse);
  const back = inverse3(ndc);
  if (back === null) return null;
  // Sample points on the sphere: its six poles and eight diagonals.
  const points: Vec3[] = [];
  for (const axis of [e1, e2, n]) {
    points.push([axis[0], axis[1], axis[2]], [-axis[0], -axis[1], -axis[2]]);
  }
  const k = 1 / Math.sqrt(3);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        points.push([
          k * (sx * e1[0] + sy * e2[0] + sz * n[0]),
          k * (sx * e1[1] + sy * e2[1] + sz * n[1]),
          k * (sx * e1[2] + sy * e2[2] + sz * n[2]),
        ]);
      }
    }
  }
  let errorPx = 0;
  const edge = 1 - WARP_MARGIN;
  for (const [x, y, z] of points) {
    const k0 = clip(kept, centre, x * radiusPc, y * radiusPc, z * radiusPc, 1);
    const k1 = clip(now, centre, x * radiusPc, y * radiusPc, z * radiusPc, 1);
    if (k0[2] <= 0 || k1[2] <= 0) return null;
    const keptX = k0[0] / k0[2];
    const keptY = k0[1] / k0[2];
    // All of the galaxy was in the kept picture: what was outside it is not there to lay down.
    if (Math.abs(keptX) > edge || Math.abs(keptY) > edge) return null;
    const carried = apply3(back, keptX, keptY, 1);
    if (carried[2] <= 0) return null;
    const dx = (carried[0] / carried[2] - k1[0] / k1[2]) * 0.5 * now.width;
    const dy = (carried[1] / carried[2] - k1[1] / k1[2]) * 0.5 * now.height;
    errorPx = Math.max(errorPx, Math.hypot(dx, dy));
  }
  // In uv, 0 to 1: uv = (ndc + 1) / 2 either side.
  const toNdc: Mat3 = [2, 0, -1, 0, 2, -1, 0, 0, 1];
  const toUv: Mat3 = [0.5, 0, 0.5, 0, 0.5, 0.5, 0, 0, 1];
  return { uv: multiply3(toUv, multiply3(ndc, toNdc)), errorPx };
}

/**
 * Whether every sprite would be discarded as under the glow buffer's floor: the brightest a
 * fragment can be is the peak, times the largest share of its light a sprite keeps -- its
 * diameter over MIN_SPRITE_PX, squared, for the largest radius at the nearest any point can
 * be -- times the profile's centre. Below `floor` with a factor of two to spare for the GPU's
 * rounding, nothing is drawn.
 *
 * `distancePc` is the camera's distance from the centre of a sphere of `radiusPc` holding every
 * point; `largestPc` the largest sprite radius; `pixelsPerRadian` the buffer's.
 */
export function underFloor(
  peak: number,
  distancePc: number,
  radiusPc: number,
  largestPc: number,
  pixelsPerRadian: number,
  minSpritePx: number,
  profileCentre: number,
  floor: number,
): boolean {
  const nearest = distancePc - radiusPc;
  if (nearest <= 0) return false;
  const diameterPx = ((2 * largestPc) / nearest) * pixelsPerRadian;
  const coverage = Math.min(1, (diameterPx / minSpritePx) ** 2);
  return peak * coverage * profileCentre < 0.5 * floor;
}
