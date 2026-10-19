/**
 * Rendering on demand: a frame is drawn only when something on screen may have changed.
 *
 * The canvas used to redraw sixty times a second whatever was happening, and with the
 * clock paused and the camera still that is sixty identical pictures a second -- on a
 * laptop whose GPU shares the CPU's power budget and its memory. So the canvas runs with
 * react-three-fiber's `frameloop="demand"`, and everything that can change the picture
 * asks for frames here:
 *
 *  - the clock, whenever its instant moved (see useSimulation.ts) -- which in live mode
 *    and under warp is every frame, so a running clock renders exactly as before;
 *  - the camera, on input and for as long as it is still easing (CameraRig.tsx);
 *  - data and maps arriving, any change to the view store or the scene's props, and a
 *    resized canvas (RenderOnDemand.tsx).
 *
 * **Every request buys a tail of frames, not one.** Several things in the scene settle
 * over a few frames after whatever moved them stops: a label shown for the first time is
 * placed by a guessed width and measured on the next frame, and the label and marker
 * declutter hold on to last frame's winners (see `declutterLabels`), so the frame after a
 * change can still differ from the one that showed it. One frame per request would freeze
 * those half-way. `SETTLE_FRAMES` is far more than any of them takes, so a source never
 * has to know how its change propagates -- it asks, and the picture comes to rest.
 *
 * This module holds no three.js and no React, so it can be asked from anywhere -- a data
 * fetch, a DOM listener -- and tested on its own. The canvas connects the wake-up.
 */

/**
 * Frames drawn after the last request, about half a second at 60 Hz.
 *
 * What needs them takes two or three: one to measure a newly shown label, one more for
 * the declutter to settle on its held winners. The rest is margin, and it is cheap --
 * once per interaction, not per frame.
 */
export const SETTLE_FRAMES = 30;

/**
 * While nothing asks, one frame anyway this often, in milliseconds.
 *
 * Two things in the frame loop run on wall-clock time and change nothing on screen when
 * they act, so no one would ever ask for them: releasing a body's maps after it has been
 * a speck for half a minute (detailRelease.ts), and retrying a chunk whose download
 * failed ten seconds ago. Without a frame they would wait for the next touch of the
 * mouse, and a paused, untouched tab would hold its memory forever. One frame a second
 * keeps both on time to within a second, at about one sixtieth of the old cost. It also
 * covers, a second late, anything that changes the scene without asking -- which should
 * be nothing, and is the reason to have it.
 */
export const IDLE_FRAME_MS = 1000;

export class RenderDemand {
  #remaining = 0;
  #wake: (() => void) | null = null;

  /** Frames still owed to the last request. */
  get remaining(): number {
    return this.#remaining;
  }

  /**
   * Asks for at least `frames` more frames, starting the render loop if it had stopped.
   *
   * Never shortens a tail already owed: a small request arriving in the middle of a big
   * one must not cut it off.
   */
  request(frames = SETTLE_FRAMES): void {
    this.#remaining = Math.max(this.#remaining, frames);
    this.#wake?.();
  }

  /**
   * Connects the render loop. `wake` must start a frame if none is coming; the canvas
   * passes react-three-fiber's `invalidate`. Returns the disconnect.
   *
   * A request made before anything is connected is kept, and wakes the loop on connect:
   * the first frames of the session are asked for before the canvas exists.
   */
  connect(wake: () => void): () => void {
    this.#wake = wake;
    if (this.#remaining > 0) {
      wake();
    }
    return () => {
      if (this.#wake === wake) {
        this.#wake = null;
      }
    };
  }

  /** Called once for every frame drawn. True while frames are still owed after it. */
  frameDrawn(): boolean {
    if (this.#remaining > 0) {
      this.#remaining -= 1;
    }
    return this.#remaining > 0;
  }
}

/** The app's one canvas's demand. */
export const renderDemand = new RenderDemand();
