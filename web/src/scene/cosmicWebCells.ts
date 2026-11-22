import { COSMIC_WEB_POSITION_UNIT_PC } from '@sss/tools/types';

import { FLOOR_THIN } from './crowding.ts';
import { SPRITE_FLOOR } from './gaussianSprite.ts';

/**
 * Which of the SDSS's galaxies the glow pass is handed (CosmicWeb.tsx, "The galaxies").
 *
 * 1.8 million sprites in one instanced draw, and every one of them ran the vertex shader each
 * time the glow was drawn -- its place and bytes fetched, its light and its faint dot worked
 * out -- to find, from inside the web, that most of them were behind the camera or off the
 * screen: 6.5 ms of the GPU a frame from 32 Mpc out on the integrated GPU this was measured on,
 * the picture's dearest draw while the camera turned. So the galaxies are binned once, as they
 * land, into cubes CELL_UNITS a side (milkyWaySlabs.ts bins the Milky Way's points the same
 * way), each with a box about its own galaxies and the most light and the most saturated hue
 * any of them has; and the draw is handed, through a list of galaxy indices it reads its
 * galaxies by, only the cubes that can put a pixel on the screen:
 *
 * - **in front of the camera** -- a sprite whose centre is behind it is not drawn at all
 *   (gaussianSprite.ts spriteCorner);
 * - **within its sprites' reach of the screen** -- a sprite is a quad as wide as the light of
 *   its centre carries over the glow's floor (spriteRadiusPx), so a cube is left out only when
 *   every point of it is past the screen's edge by more than the widest sprite any of its
 *   galaxies could draw from the nearest of its points;
 * - **over the floor at all** -- a cube whose brightest possible centre, its most luminous
 *   galaxy at its nearest point or the most its faint dot could be, is under the glow's floor
 *   draws nothing, wherever it is.
 *
 * Every galaxy left out is one whose sprite would have drawn no pixel; the list keeps the
 * galaxies in their own order and each its own index (the faint dots' thinning is by it), so
 * the sprites that are drawn are drawn in the same order with the same numbers: the same
 * picture, to the bit.
 *
 * The list is a superset, written with a margin (HAND_PX past the screen, a little behind the
 * camera, and HAND_GAIN times the light), and written again only once it no longer holds every
 * cube within half of that (SOON_PX, SOON_GAIN) or holds one KEEP_PX or KEEP_GAIN out: as the
 * view turns or nears through the margin, not every frame --
 * a pass over every galaxy, a few milliseconds. Where it does not hold every cube needed -- the
 * first frame, a fast turn, a new chunk of galaxies -- the draw takes every galaxy, as before,
 * while the list is written for the next.
 */

/** A cube's side in the positions' units (COSMIC_WEB_POSITION_UNIT_PC): 100 Mpc. */
export const CELL_UNITS = 1000;
/** The cubes along each axis of the positions' int16 range. */
const GRID = Math.ceil(65536 / CELL_UNITS);
/** The cube of every galaxy past the 65,535th cube: always handed. */
export const OVERFLOW_CELL = 65535;

/**
 * The list's margin past the screen's edge, device pixels; how far in it may run short before it
 * is written again (half of it: written ahead, not when a cube needed is already missing); and
 * the most it may reach before it is written again.
 */
export const HAND_PX = 240;
export const SOON_PX = 120;
export const KEEP_PX = 640;
/** The same behind the camera: a cube that far behind it, as a share of its distance, counts as behind. */
const HAND_BEHIND = 0.25;
const SOON_BEHIND = 0.125;
const KEEP_BEHIND = 0.5;
/**
 * The same margins in light: a cube is handed while its brightest sprite, this many times
 * brighter, would draw a pixel; written again once one that would at SOON_GAIN is missing, or
 * one it holds would not even at KEEP_GAIN. Without them a cube just under the floor was in no
 * list, and as the camera moved -- from the far view an orbit takes it a few per cent nearer or
 * further each frame -- some cube crossed the floor nearly every frame the camera moved, the
 * list no longer covered, and the draw took all 1.8 million galaxies: one frame in three at 60
 * ms instead of 25 (DPR 1.5, 2026-11-22). Four times the light is twice the distance.
 */
export const SOON_GAIN = 2;
export const HAND_GAIN = 4;
export const KEEP_GAIN = 8;

/** The shader's numbers (CosmicWeb.tsx GALAXY_VERTEX) that bound a sprite's reach. */
export interface SpriteLaw {
  /** The sprites' Gaussian, device pixels (LocalGroup.tsx MIN_SIGMA_PX). */
  readonly sigmaPx: number;
  /** A faint dot's strength, whole (LocalGroup.tsx FAINT_GALAXY_FLOOR). */
  readonly faintFloor: number;
  /** The least the depth dims a faint dot to (CosmicWeb.tsx FILAMENT_DEPTH_LEAST). */
  readonly depthLeast: number;
}

/** The galaxies binned: each galaxy's cube, and each cube's box, its most light and its most saturated hue. */
export class GalaxyCells {
  /** Each galaxy's cube. */
  readonly cellOf: Uint16Array;
  /** How many cubes hold galaxies. */
  count = 0;
  /** Each cube's box about its galaxies, pc: min x, y, z, max x, y, z. */
  box = new Float64Array(0);
  /** Each cube's most light (the brightest channel of light times hue), white columns. */
  light = new Float32Array(0);
  /** Each cube's most saturated hue, its brightest channel (the faint dot's colour). */
  hue = new Float32Array(0);
  /** Bumped as galaxies are added: a list written before does not hold them. */
  version = 0;
  readonly #index = new Map<number, number>();

  constructor(capacity: number) {
    this.cellOf = new Uint16Array(capacity);
  }

  #cube(key: number): number {
    const known = this.#index.get(key);
    if (known !== undefined) return known;
    if (this.count >= OVERFLOW_CELL) return OVERFLOW_CELL;
    const c = this.count;
    this.count += 1;
    if (this.count * 6 > this.box.length) {
      const grow = Math.max(256, this.count * 2);
      const box = new Float64Array(grow * 6);
      box.set(this.box);
      this.box = box;
      const light = new Float32Array(grow);
      light.set(this.light);
      this.light = light;
      const hue = new Float32Array(grow);
      hue.set(this.hue);
      this.hue = hue;
    }
    this.box.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], c * 6);
    this.light[c] = 0;
    this.hue[c] = 0;
    this.#index.set(key, c);
    return c;
  }

  /**
   * Galaxies `from` to `to`, their places (four int16s a galaxy, x y z in
   * COSMIC_WEB_POSITION_UNIT_PC) and bytes (absolute V's code, B-V's, ...), binned; `lightOf`
   * and `hueOf` each code's light and hue's brightest channel (CosmicWeb.tsx galaxyTable).
   */
  add(place: Int16Array, bytes: Uint8Array, from: number, to: number, lightOf: Float32Array, hueOf: Float32Array): void {
    const unit = COSMIC_WEB_POSITION_UNIT_PC;
    for (let g = from; g < to; g += 1) {
      const x = place[g * 4]!;
      const y = place[g * 4 + 1]!;
      const z = place[g * 4 + 2]!;
      const key = (Math.floor((x + 32768) / CELL_UNITS) * GRID + Math.floor((y + 32768) / CELL_UNITS)) * GRID + Math.floor((z + 32768) / CELL_UNITS);
      const c = this.#cube(key);
      this.cellOf[g] = c;
      if (c === OVERFLOW_CELL) continue;
      const b = c * 6;
      const box = this.box;
      const px = x * unit;
      const py = y * unit;
      const pz = z * unit;
      if (px < box[b]!) box[b] = px;
      if (py < box[b + 1]!) box[b + 1] = py;
      if (pz < box[b + 2]!) box[b + 2] = pz;
      if (px > box[b + 3]!) box[b + 3] = px;
      if (py > box[b + 4]!) box[b + 4] = py;
      if (pz > box[b + 5]!) box[b + 5] = pz;
      const hue = hueOf[bytes[g * 4 + 1]!]!;
      const light = hue * lightOf[bytes[g * 4]!]!;
      if (light > this.light[c]!) this.light[c] = light;
      if (hue > this.hue[c]!) this.hue[c] = hue;
    }
    this.version += 1;
  }
}

/** What the glow draw is given this frame, as CosmicWeb.tsx sets its uniforms. */
export interface CellView {
  /** The camera, pc about the Sun. */
  readonly cameraX: number;
  readonly cameraY: number;
  readonly cameraZ: number;
  /**
   * What takes a place in the draw's own units about the camera -- (place - camera) times
   * `unitsPerPc` -- into view space, as the GPU does it: the draw's model-view matrix; and the
   * projection. Column major.
   */
  readonly modelView: ArrayLike<number>;
  readonly unitsPerPc: number;
  readonly projection: ArrayLike<number>;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly pixelsPerRadian: number;
  /** uFade, uFloorKept, uDepthPc. */
  readonly fade: number;
  readonly floorKept: number;
  readonly depthPc: number;
}

/**
 * A cube's verdicts in classifyCells' output: needed now; within the margin a list must still
 * hold not to be written again; within the margin a list is written with; within what a list may
 * keep.
 */
export const NEEDED = 1;
export const SOON = 2;
export const HANDED = 4;
export const KEPT = 8;

/**
 * The most a sprite of a cube's galaxies could reach past its centre on the screen, device
 * pixels, seen from `nearestPc` at the least -- 0 if none could draw a pixel: the shader's peak,
 * its light over its Gaussian's area at that distance or its faint dot at the most it could be
 * (whole weight, crowding and depth at their least dimming, thinned to no less than FLOOR_THIN),
 * through spriteRadiusPx, with a part in a thousand and a pixel to spare for float32. With
 * `gain`, the same for sprites that many times brighter (the list's margins in light).
 */
export function cellReachPx(light: number, hue: number, nearestPc: number, view: CellView, law: SpriteLaw, gain = 1): number {
  if (!(nearestPc > 0)) return Infinity;
  const sigmaPc = (law.sigmaPx / view.pixelsPerRadian) * nearestPc;
  const lit = light / (2 * Math.PI * sigmaPc * sigmaPc);
  const depth = Math.min(1, Math.max(law.depthLeast, view.depthPc / nearestPc));
  const kept = Math.max(0, view.floorKept) * depth;
  const thinned = kept >= FLOOR_THIN ? kept : kept > 0 ? FLOOR_THIN : 0;
  const peak = view.fade * Math.max(lit, hue * law.faintFloor * thinned) * 1.001 * gain;
  if (!(peak > SPRITE_FLOOR)) return 0;
  return law.sigmaPx * Math.sqrt(2 * Math.log(peak / SPRITE_FLOOR)) + 2;
}

/** |(a, b)|: Math.hypot is several times slower, and these never overflow. */
function norm(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

/**
 * Whether a sphere about (`x`, `y`, `z`) in view space (the camera at the origin looking down
 * -z), `radius` about it, is wholly behind the camera by `behind` of its distance, or wholly past
 * one side of the screen by `reachPx`: past a plane through the eye, so every point of it is.
 */
function outside(x: number, y: number, z: number, radius: number, distance: number, e: ArrayLike<number>, widthPx: number, heightPx: number, reachPx: number, behind: number): boolean {
  if (z - radius >= behind * distance) return true;
  // Right of the screen: x_clip > (1 + m) w, x_clip = e0 x + e8 z, w = -z (flowPulse.ts sphereInView).
  const mx = 1 + (2 * reachPx) / widthPx;
  const my = 1 + (2 * reachPx) / heightPx;
  const e0 = e[0]!;
  const e5 = e[5]!;
  const e8 = e[8]!;
  const e9 = e[9]!;
  return (
    e0 * x + (e8 + mx) * z > radius * norm(e0, e8 + mx) ||
    -e0 * x + (-e8 + mx) * z > radius * norm(e0, -e8 + mx) ||
    e5 * y + (e9 + my) * z > radius * norm(e5, e9 + my) ||
    -e5 * y + (-e9 + my) * z > radius * norm(e5, -e9 + my)
  );
}

/**
 * Each cube's verdicts into `out` (NEEDED, SOON, HANDED, KEPT bits), for the view: NEEDED if any
 * of its galaxies could draw a pixel; the others the same with the list's margins. Each implies
 * the next.
 */
export function classifyCells(cells: GalaxyCells, view: CellView, law: SpriteLaw, out: Uint8Array): void {
  const m = view.modelView;
  const u = view.unitsPerPc;
  const e = view.projection;
  const box = cells.box;
  const shift = Math.sqrt(m[12]! * m[12]! + m[13]! * m[13]! + m[14]! * m[14]!);
  for (let c = 0; c < cells.count; c += 1) {
    const b = c * 6;
    const cx = (box[b]! + box[b + 3]!) / 2;
    const cy = (box[b + 1]! + box[b + 4]!) / 2;
    const cz = (box[b + 2]! + box[b + 5]!) / 2;
    const rx = cx - view.cameraX;
    const ry = cy - view.cameraY;
    const rz = cz - view.cameraZ;
    const distance = Math.sqrt(rx * rx + ry * ry + rz * rz);
    // A part in a million of the distances more, for float32's rounding of the places.
    const sx = box[b + 3]! - box[b]!;
    const sy = box[b + 4]! - box[b + 1]!;
    const sz = box[b + 5]! - box[b + 2]!;
    const radius = Math.sqrt(sx * sx + sy * sy + sz * sz) / 2 + 1e-6 * (distance + Math.sqrt(cx * cx + cy * cy + cz * cz));
    const light = cells.light[c]!;
    const hue = cells.hue[c]!;
    const nearestPc = distance - radius;
    // The widest reach first: under the floor even KEEP_GAIN times brighter, nothing at all.
    const reachKeep = cellReachPx(light, hue, nearestPc, view, law, KEEP_GAIN);
    if (reachKeep === 0) {
      out[c] = 0;
      continue;
    }
    if (reachKeep === Infinity) {
      out[c] = NEEDED | SOON | HANDED | KEPT;
      continue;
    }
    // Into view space as the draw puts it -- the camera may have moved since its uniforms were
    // set, which the model-view matrix carries -- in the draw's units.
    const x = rx * u;
    const y = ry * u;
    const z = rz * u;
    const vx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    const vy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    const vz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
    const vr = radius * u * (1 + 1e-6) + 1e-6 * shift;
    const vd = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const w = view.widthPx;
    const h = view.heightPx;
    // Each margin in place and in light; a reach of 0 is a cube that draws nothing at that light.
    let verdict = 0;
    if (!outside(vx, vy, vz, vr, vd, e, w, h, reachKeep + KEEP_PX, KEEP_BEHIND)) {
      verdict |= KEPT;
      const reachHand = cellReachPx(light, hue, nearestPc, view, law, HAND_GAIN);
      if (reachHand > 0 && !outside(vx, vy, vz, vr, vd, e, w, h, reachHand + HAND_PX, HAND_BEHIND)) {
        verdict |= HANDED;
        const reachSoon = cellReachPx(light, hue, nearestPc, view, law, SOON_GAIN);
        if (reachSoon > 0 && !outside(vx, vy, vz, vr, vd, e, w, h, reachSoon + SOON_PX, SOON_BEHIND)) {
          verdict |= SOON;
          const reach = cellReachPx(light, hue, nearestPc, view, law);
          if (reach > 0 && !outside(vx, vy, vz, vr, vd, e, w, h, reach, 0)) verdict |= NEEDED;
        }
      }
    }
    out[c] = verdict;
  }
}

/**
 * Whether a list handed `handed` (a byte a cube, non-zero if handed) serves the verdicts: it
 * holds every cube NEEDED (`covers`: drawn from), every cube SOON (`ahead`: if not, written
 * again before it stops covering), and every cube in it is still within KEPT (`fits`).
 */
export function listServes(handed: Uint8Array, verdicts: Uint8Array, count: number): { covers: boolean; ahead: boolean; fits: boolean } {
  let covers = true;
  let ahead = true;
  let fits = true;
  for (let c = 0; c < count; c += 1) {
    const v = verdicts[c]!;
    if (handed[c] !== 0) {
      if ((v & KEPT) === 0) fits = false;
    } else if ((v & SOON) !== 0) {
      ahead = false;
      if ((v & NEEDED) !== 0) covers = false;
    }
  }
  return { covers, ahead, fits };
}

/**
 * The galaxies `0` to `count` whose cube is handed, in their order, into `out` as their indices;
 * the overflow cube's always. Returns how many.
 */
export function writeList(cellOf: Uint16Array, count: number, handed: Uint8Array, out: Float32Array): number {
  let n = 0;
  for (let g = 0; g < count; g += 1) {
    const c = cellOf[g]!;
    if (c === OVERFLOW_CELL || handed[c] !== 0) out[n++] = g;
  }
  return n;
}
