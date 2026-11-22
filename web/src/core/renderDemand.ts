/**
 * Rendering on demand: a frame is drawn only when something on screen may have changed.
 *
 * The canvas used to redraw sixty times a second whatever was happening, and with the
 * clock paused and the camera still that is sixty identical pictures a second -- on a
 * laptop whose GPU shares the CPU's power budget and its memory. So the canvas runs with
 * react-three-fiber's `frameloop="demand"`, and everything that can change the picture
 * asks for frames here:
 *
 *  - the clock, whenever its instant moved (see useSimulation.ts): under warp every frame,
 *    and in live mode as often as the scene says something on it moves (`clockMoved`);
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

/**
 * In live mode, how far anything on screen may move between two frames, in pixels.
 *
 * At real time almost nothing moves: from the default view of Earth the ISS crosses a third
 * of a pixel a second, Earth's surface a fortieth. Sixty frames a second of that was half a
 * core and the GPU never resting, on a laptop, to draw sixty pictures no eye could tell
 * apart. So in live mode a frame is drawn once the fastest thing the scene knows of has
 * moved this far since the last -- a quarter of a pixel, under what antialiasing lets a
 * moving edge show -- and every vsync when it moves faster than that.
 */
export const LIVE_STEP_PX = 0.25;

/**
 * In live mode, the longest wait between frames however still the scene says it is,
 * milliseconds: ten frames a second.
 *
 * The scene's estimate covers what it draws and can bound -- the bodies, their markers and
 * names, their turning surfaces and clouds, eclipse shadows, the satellites. Not every line:
 * an orbit or a trail moves with what it is drawn about, by less than a pixel a second in
 * every case worked out, and a dot of the belt or a comet comes close enough to the camera
 * to move faster only rarely. Those are held to this, which is smooth for anything under two
 * and a half pixels a second, and still a sixth of the old cost.
 */
export const LIVE_FRAME_MAX_MS = 100;

/** One frame at 60 Hz, milliseconds. */
const VSYNC_MS = 1000 / 60;

/**
 * How long live mode waits between frames for this much motion, in pixels per second of
 * real time: long enough for it to cover LIVE_STEP_PX, and none (every vsync) when that is
 * under a frame -- at most LIVE_FRAME_MAX_MS. Not finite, a scene that cannot bound what it
 * shows, is every vsync.
 */
export function liveFrameIntervalMs(pixelsPerSecond: number): number {
  if (!(pixelsPerSecond >= 0) || !Number.isFinite(pixelsPerSecond)) {
    return 0;
  }
  const ms = (LIVE_STEP_PX / pixelsPerSecond) * 1000;
  return ms < VSYNC_MS ? 0 : Math.min(ms, LIVE_FRAME_MAX_MS);
}

/**
 * Slack on the live interval, milliseconds: half a vsync. The clock's frame callback and the
 * canvas's run in the same animation frame but not at the same instant, and frames come only
 * on vsyncs; without it a wait due a millisecond after one would slip to the next, and ten
 * frames a second come out as eight and a half.
 */
const LIVE_SLACK_MS = VSYNC_MS / 2;

export class RenderDemand {
  #remaining = 0;
  #requests = 0;
  #wake: (() => void) | null = null;
  /** When the last frame was drawn, performance.now() milliseconds. */
  #lastFrameMs = -Infinity;
  /**
   * The fastest on-screen motion the last frame found, pixels per simulated second; not
   * finite until a frame has said. See `setMotion`.
   */
  #motion = Infinity;

  /**
   * How many requests there have been. Whatever asks for a frame -- data landing, the view
   * store, the camera -- may also have changed what a panel shows, so the readout beat fires
   * on a change of this as well as of the clock (useSimulation.ts).
   */
  get requests(): number {
    return this.#requests;
  }

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
    this.#requests += 1;
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

  /**
   * The clock's instant has moved; `rate` is how many simulated seconds go by in a real one,
   * and `live` whether the clock is following real time.
   *
   * Under warp it is `request()`: every frame, and a tail after. In live mode it asks for one
   * frame, and only once the motion the last frame reported has had time to cover
   * LIVE_STEP_PX (see `liveFrameIntervalMs`); a frame already owed for anything else is
   * drawn at the clock's instant anyway, so it asks for nothing then. No tail: the clock
   * moving things by a quarter of a pixel settles nothing.
   */
  clockMoved(live: boolean, rate: number, nowMs: number = performance.now()): void {
    if (!live) {
      this.request();
      return;
    }
    if (this.#remaining > 0) {
      return;
    }
    // The frame asked for now is drawn on the next vsync, not this one: ask one early.
    const due = liveFrameIntervalMs(this.#motion * Math.abs(rate)) - VSYNC_MS - LIVE_SLACK_MS;
    if (nowMs - this.#lastFrameMs >= due) {
      this.#remaining = 1;
      this.#wake?.();
    }
  }

  /**
   * How fast the fastest thing on screen moves, pixels per simulated second, as the frame
   * being drawn found it: the scene says, every frame (SolarSystem.tsx), and Infinity when it
   * cannot bound it. Live mode spaces its frames by this; see `clockMoved`.
   */
  setMotion(pixelsPerSimSecond: number): void {
    this.#motion = pixelsPerSimSecond;
  }

  /** Called once for every frame drawn. True while frames are still owed after it. */
  frameDrawn(nowMs: number = performance.now()): boolean {
    this.#lastFrameMs = nowMs;
    if (this.#remaining > 0) {
      this.#remaining -= 1;
    }
    return this.#remaining > 0;
  }
}

/** The app's one canvas's demand. */
export const renderDemand = new RenderDemand();
