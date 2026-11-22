import type * as THREE from 'three';

/**
 * Whether the camera moved since the last frame, for the glows that are drawn more cheaply while
 * it moves and in full the moment it stops (MilkyWay.tsx, GlowComposite.tsx).
 *
 * A moving picture is seen for a sixtieth of a second and then replaced; a still one is looked
 * at. So a glow may give up some resolution while the view changes under it, as long as the
 * first frame drawn after the camera comes to rest is the full picture again -- and one always
 * is: the camera asks for a tail of frames after its last move (core/renderDemand.ts), and the
 * first of them finds it still.
 *
 * Each user keeps its own: it compares the camera with what it saw the last time *it* asked,
 * so where in the frame it asks does not matter, nor how many others ask.
 */

/** Rotation and projection terms are unitless: a change under this is no change. */
export const STILL_ROTATION = 1e-6;
/** The camera's translation, as a share of its distance from the scene's origin, the focus. */
export const STILL_TRANSLATION_SHARE = 1e-6;

/**
 * Frames in a row the camera must hold still before it counts as still: a tenth of a second at
 * 60 Hz. A drag does not move the camera on every frame -- the pointer's events and the frames
 * do not keep step -- and without this a frame in the middle of a drag would be drawn in full,
 * the dearest frame there is, and the picture would sharpen and soften as the hand moved.
 */
export const STILL_FRAMES = 6;

export class ViewMotion {
  #world: number[] | null = null;
  #projection: number[] | null = null;
  #stillFor = 0;

  /**
   * True if `camera` has turned, moved or changed its projection in the last STILL_FRAMES
   * calls; the first call is a move. `camera.matrixWorld` must be this frame's.
   */
  moved(camera: THREE.Camera): boolean {
    const world = camera.matrixWorld.elements;
    const projection = camera.projectionMatrix.elements;
    const lastWorld = this.#world;
    const lastProjection = this.#projection;
    this.#world = world.slice();
    this.#projection = projection.slice();
    const now = lastWorld === null || lastProjection === null || changed(lastWorld, world, lastProjection, projection);
    this.#stillFor = now ? 0 : this.#stillFor + 1;
    return this.#stillFor < STILL_FRAMES;
  }

  /** How many calls in a row, up to the last, found the camera where it was: 0 if it moved. */
  get stillFrames(): number {
    return this.#stillFor;
  }
}

/** Whether two camera poses and projections differ by more than the still tolerances. */
export function changed(
  worldA: readonly number[],
  worldB: readonly number[],
  projectionA: readonly number[],
  projectionB: readonly number[],
): boolean {
  // The rotation's nine terms and the projection's sixteen: unitless, or near enough.
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
    if (Math.abs(worldA[i]! - worldB[i]!) > STILL_ROTATION) return true;
  }
  for (let i = 0; i < 16; i += 1) {
    const scale = Math.max(1, Math.abs(projectionA[i]!));
    if (Math.abs(projectionA[i]! - projectionB[i]!) > STILL_ROTATION * scale) return true;
  }
  // The translation against how far the camera stands from the origin.
  const reach = Math.max(Math.hypot(worldA[12]!, worldA[13]!, worldA[14]!), 1e-9);
  const moved = Math.hypot(worldA[12]! - worldB[12]!, worldA[13]! - worldB[13]!, worldA[14]! - worldB[14]!);
  return moved > STILL_TRANSLATION_SHARE * reach;
}
