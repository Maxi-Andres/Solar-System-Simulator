import { LIVE_STEP_PX } from '../core/renderDemand.ts';

/**
 * How often the flow lines' brightening needs a frame (Laniakea.tsx FLOW_FRAGMENT).
 *
 * The brightening runs down each line at FLOW_GYR_PER_SECOND of flow a second of the wall clock,
 * so it moves while nothing else does, and used to ask for every vsync while the lines were
 * shown at all -- from a view where the whole of them is a few pixels across as from inside
 * them. Now it asks the live clock's question (renderDemand.ts LIVE_STEP_PX): how long until
 * the brightening may have moved a quarter of a pixel? Every vsync where it moves faster, as
 * before; from far enough out, a few frames a second, each the frame the old loop would have
 * drawn at that instant.
 */

/** One frame at 60 Hz, milliseconds. */
const VSYNC_MS = 1000 / 60;

/** What bounds the brightening's motion: where the lines are, and how fast it runs down any. */
export interface FlowPulseBound {
  /** A sphere holding every vertex of the lines -- and so every point on them -- pc about the Sun. */
  readonly centreX: number;
  readonly centreY: number;
  readonly centreZ: number;
  readonly radiusPc: number;
  /** The fastest the brightening runs down any line, pc a second. */
  readonly pcPerSecond: number;
}

/**
 * The brightening's speed down a line flowing at `kmS`, pc a second: FLOW_GYR_PER_SECOND of flow
 * a second, at `gyrPerPcAtKmS` / `kmS` Gyr a parsec.
 */
export function pulsePcPerSecond(kmS: number, gyrPerSecond: number, gyrPerPcAtKmS: number): number {
  return (gyrPerSecond * kmS) / gyrPerPcAtKmS;
}

/**
 * Milliseconds until the next frame the brightening needs, from a camera at `camera` pc about
 * the Sun: 0 for every vsync. Its fastest point is no nearer than the sphere's surface, nor
 * faster than `pcPerSecond` across the view; that over the distance is its angular speed.
 */
export function flowPulseWaitMs(bound: FlowPulseBound, cameraX: number, cameraY: number, cameraZ: number, pixelsPerRadian: number): number {
  const nearestPc = Math.hypot(cameraX - bound.centreX, cameraY - bound.centreY, cameraZ - bound.centreZ) - bound.radiusPc;
  if (!(nearestPc > 0)) return 0;
  const pixelsPerSecond = (bound.pcPerSecond / nearestPc) * pixelsPerRadian;
  const ms = (LIVE_STEP_PX / pixelsPerSecond) * 1000;
  return ms < VSYNC_MS ? 0 : ms;
}

/** How far past its line a ribbon may reach on the screen, device pixels: the widest's half and a pixel more. */
export const FLOW_REACH_PX = 4;

/**
 * Whether a sphere, its centre (`x`, `y`, `z`) in the camera's view space (any unit, the
 * camera at the origin looking down -z) and its radius in that unit, can put any pixel on the
 * screen, `reachPx` device pixels past its edge allowed: the projection's terms `e` (column
 * major), the drawing buffer `widthPx` by `heightPx`. False only when the whole sphere is behind
 * the camera or beyond one side of the frustum widened by that reach -- a plane through the
 * eye, so the test holds for any part of the sphere at any distance. The lines' brightening
 * asks for no frame while none of them is in view: nothing it would change is drawn.
 */
export function sphereInView(
  x: number,
  y: number,
  z: number,
  radius: number,
  e: ArrayLike<number>,
  widthPx: number,
  heightPx: number,
  reachPx: number,
): boolean {
  if (z - radius >= 0) return false;
  // Right of the screen: x_clip > (1 + m) w, x_clip = e0 x + e8 z, w = -z.
  const mx = 1 + (2 * reachPx) / widthPx;
  const my = 1 + (2 * reachPx) / heightPx;
  const e0 = e[0]!;
  const e5 = e[5]!;
  const e8 = e[8]!;
  const e9 = e[9]!;
  // Wholly on the outer side of the plane (nx, 0 or nx, nyz) . p = 0 through the eye.
  const beyond = (nx: number, nyz: number, along: number): boolean => nx * along + nyz * z > radius * Math.hypot(nx, nyz);
  return !(
    beyond(e0, e8 + mx, x) ||
    beyond(-e0, -e8 + mx, x) ||
    beyond(e5, e9 + my, y) ||
    beyond(-e5, -e9 + my, y)
  );
}
