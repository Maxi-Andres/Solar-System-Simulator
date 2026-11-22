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
