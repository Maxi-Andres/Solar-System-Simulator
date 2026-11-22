import { addAfterEffect, addEffect, useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { renderDemand } from '../core/renderDemand.ts';

import { STILL_FRAMES, ViewMotion } from './viewMotion.ts';

/**
 * Fewer pixels while the camera moves, on a GPU that cannot keep up -- and every pixel back
 * the moment it stops.
 *
 * Far out the scene is bound by the GPU's fragments, not by anything on the CPU: the Milky
 * Way's glow and the galaxies' sprites cost 58 ms a frame on the reference laptop's
 * integrated GPU at a pixel ratio of 1 and 76 at 1.5, so dragging the view there runs at
 * fifteen frames a second. A moving picture shows less detail than a still one, and a drag
 * that follows the hand matters more than detail nobody can hold their eye on. So while the
 * camera moves on such a GPU the canvas draws at RATIO_WHILE_MOVING of its pixel ratio -- half
 * the pixels -- and when the camera comes to rest it is put back and a frame drawn at full
 * resolution: a still view, the one anybody looks at, is never drawn with fewer pixels.
 *
 * **Only where the GPU is the bottleneck.** Frames are timed while the camera moves: the time
 * between them, and the main thread's own share of each (from the frame loop's first effect to
 * after the render). A frame that comes slowly while the CPU's part stayed small was waiting
 * on the GPU, and fewer pixels help exactly that; a slow frame the CPU spent itself on is
 * left alone, since fewer pixels would only blur it. On a GPU that keeps up, frames come every
 * vsync and none of this ever happens.
 *
 * **Moving is what the glows call moving** (viewMotion.ts), with their tolerances: a camera
 * easing the last millionths into place after a flight is still. Compared exactly, that creep
 * counted as motion, and at real time its frames come ten a second by design (renderDemand.ts
 * clockMoved) -- a hundred milliseconds apart with the main thread idle, which is what a slow
 * GPU looks like: every flight ended with the still view cut, for as long as the creep went on.
 *
 * **Restored one frame before the glows' first still frame.** The Milky Way and the glow pass
 * draw in full once the camera has held still for STILL_FRAMES, the dearest frame there is; a
 * new pixel ratio reallocates their buffers and draws them again. Put back on that frame, the
 * full drawing was made twice, the second time at the new size; put back the frame before, it
 * is made once, at the size it is shown.
 */

/** The share of the pixel ratio drawn while the camera moves on a slow GPU: half the pixels. */
export const RATIO_WHILE_MOVING = 0.7;
/** Never below this many device pixels per CSS pixel, however far the ratio is cut. */
const MIN_PIXEL_RATIO = 0.5;
/**
 * A frame is slow when it comes this long after the last, milliseconds: under 30 frames a
 * second, a drag that visibly stutters.
 *
 * Not sooner: a new pixel ratio resizes the canvas, and resizing it while the GPU is behind
 * waits on the main thread for the frames already queued -- 75 to 110 ms for the frame that
 * cuts, 25 to 65 for the one that restores, measured on the reference laptop at pixel ratios of
 * 1.5 and 2 with the Milky Way's own cheaper moving frames in. At 45 frames a second (the first
 * threshold) the cut fired in the middle of drags that were smooth enough, and the hitch it
 * made was worse than the frames it saved.
 */
export const SLOW_FRAME_MS = 1000 / 30;
/** ...and the main thread spent under this share of that time on it: the rest was the GPU's. */
export const GPU_BOUND_SHARE = 0.6;
/** Consecutive slow moving frames before the ratio is cut: a hitch is not a slow GPU. */
export const SLOW_FRAMES_TO_CUT = 6;
/** Consecutive frames with the camera at rest before the ratio is put back: see the header. */
export const STILL_FRAMES_TO_RESTORE = STILL_FRAMES - 1;
/** Frames further apart than this are not consecutive: the loop had stopped in between. */
const GAP_MS = 250;

export type ResolutionStep = 'cut' | 'restore' | null;

/**
 * The decision, apart from the canvas so it can be tested: fed every frame drawn, it says when
 * to cut the ratio and when to put it back.
 */
export class ResolutionGovernor {
  #lastMs = Number.NaN;
  #slow = 0;
  #cut = false;

  get cut(): boolean {
    return this.#cut;
  }

  /**
   * One frame drawn at `nowMs`, the main thread having spent `cpuMs` on it, the camera having
   * held still for `stillFrames` frames up to it (0: it moved on this one; ViewMotion).
   *
   * A still frame in the middle of a drag -- the pointer's events and the frames do not keep
   * step -- says nothing of the GPU, and is neither counted nor breaks a run.
   */
  frame(nowMs: number, cpuMs: number, stillFrames: number): ResolutionStep {
    const interval = nowMs - this.#lastMs;
    this.#lastMs = nowMs;
    if (stillFrames > 0) {
      if (stillFrames >= STILL_FRAMES_TO_RESTORE) {
        this.#slow = 0;
        if (this.#cut) {
          this.#cut = false;
          return 'restore';
        }
      }
      return null;
    }
    if (this.#cut) {
      return null;
    }
    const consecutive = interval < GAP_MS;
    if (consecutive && interval > SLOW_FRAME_MS && cpuMs < interval * GPU_BOUND_SHARE) {
      this.#slow += 1;
    } else if (consecutive) {
      this.#slow = 0;
    }
    if (this.#slow >= SLOW_FRAMES_TO_CUT) {
      this.#slow = 0;
      this.#cut = true;
      return 'cut';
    }
    return null;
  }

  /** The ratio was set from outside (a canvas re-render puts it back): start over. */
  reset(): void {
    this.#cut = false;
    this.#slow = 0;
  }
}

export function AdaptiveResolution() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const governor = new ResolutionGovernor();
    const motion = new ViewMotion();
    let started = 0;
    // The ratio the canvas was given, and the cut one while it is in force. Set on the renderer
    // itself, not through the canvas's setDpr: that changes react-three-fiber's store, and every
    // component that reads the store whole (useThree()) -- most of the scene, SolarSystem among
    // them -- renders again. Everything that draws by the ratio asks the renderer each frame.
    let full = gl.getPixelRatio();
    let reduced = Number.NaN;

    const stopBefore = addEffect(() => {
      started = performance.now();
    });
    const stopAfter = addAfterEffect((timestamp) => {
      // After the render, so the camera's matrices are this frame's.
      motion.moved(camera);

      const dpr = gl.getPixelRatio();
      if (governor.cut && dpr !== reduced) {
        // Set back from outside -- the canvas resized, which sets the renderer's ratio from
        // its store again, or the window moved to another screen. That is now the full ratio.
        governor.reset();
      }
      if (!governor.cut) {
        full = dpr;
      }

      const step = governor.frame(timestamp, performance.now() - started, motion.stillFrames);
      if (step === 'cut') {
        reduced = Math.max(MIN_PIXEL_RATIO, full * RATIO_WHILE_MOVING);
        if (reduced < full) {
          gl.setPixelRatio(reduced);
        } else {
          governor.reset();
        }
      } else if (step === 'restore') {
        gl.setPixelRatio(full);
        reduced = Number.NaN;
        // The still view at full resolution, and its labels settled on it.
        renderDemand.request();
      }
    });
    return () => {
      stopBefore();
      stopAfter();
      if (governor.cut) {
        gl.setPixelRatio(full);
      }
    };
  }, [camera, gl]);

  return null;
}
