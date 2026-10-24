/**
 * How the wheel turns into distance, over twenty orders of magnitude.
 *
 * The camera's range is now 0.06 km -- just off the International Space Station's 109 m --
 * to 3,000 light years: 2.8e16 km, a ratio of 5e17, or 40 factors of e. Zoom has always
 * been multiplicative, so every notch is the same ratio and 10 km feels like 10 AU; what
 * the light years broke is the count. At 13 % a notch, ISS to 1,000 ly is 313 notches,
 * half a minute of steady scrolling -- the same everywhere, and tedious everywhere.
 *
 * Two changes, each fixing one thing:
 *
 *  1. **A streak speeds up.** Notches that keep coming in one direction -- under
 *     `STREAK_GAP_MS` apart -- grow from one ratio to `MAX_STREAK_GAIN` times it over
 *     `STREAK_RAMP_MS`. A single notch is what it was, so the last adjustment near a
 *     planet is as fine as ever; a long spin crosses the scales in seconds. Measured in
 *     zoom.test.ts: ISS to 1,000 ly in 4.6 s at ten notches a second (47 notches), 2.6 s
 *     at twenty, 8.4 s at a leisurely five.
 *  2. **The easing is in the logarithm.** The distance used to ease linearly, a fixed
 *     share of the gap per frame. Zooming in, that is geometric and fine; zooming out it
 *     is not: with the target a hundred times further, the first frame jumped eighteen
 *     times over. Eased in log distance, a frame closes the same share of the remaining
 *     *ratio* either way, so zooming out is as smooth as zooming in at every scale.
 *
 * And one fix that was always owed: Firefox reports the wheel in lines, three per notch,
 * where Chromium reports a hundred pixels. Read raw, a Firefox notch zoomed 0.4 %.
 */

/** e-folds of distance per pixel of wheel delta: a 100-pixel notch is e^0.12, 13 %. */
export const ZOOM_PER_WHEEL_PIXEL = 0.0012;

/** What one wheel notch is reported as in pixels, by Chromium on every desktop. */
export const PIXELS_PER_NOTCH = 100;

/** A notch reported as lines (Firefox: three a notch), in pixels. */
export const PIXELS_PER_LINE = PIXELS_PER_NOTCH / 3;

/** Wheel events closer together than this, in one direction, are one streak. */
export const STREAK_GAP_MS = 250;

/** How long a streak takes to reach full speed. */
export const STREAK_RAMP_MS = 1500;

/**
 * The most a streak multiplies each notch by: a notch at full speed is e^0.96, 2.6 times
 * the distance. Chosen against the measurement above -- a few seconds from the ISS to the
 * light years -- and against jumpiness: at twenty notches a second the target moves 2.6
 * times every three frames, which the easing turns into a steady 19 e-folds a second
 * rather than steps.
 */
export const MAX_STREAK_GAIN = 8;

/**
 * Fraction of the remaining log-distance closed per frame; higher is snappier. The value
 * the linear easing had, so a single notch settles in the same number of frames.
 */
export const ZOOM_DAMPING = 0.18;

/** A wheel event's delta in pixels, whatever unit the browser reported it in. */
export function wheelPixels(deltaY: number, deltaMode: number, pageHeightPx: number): number {
  // WheelEvent.DOM_DELTA_LINE and DOM_DELTA_PAGE, written out so this runs without a DOM.
  if (deltaMode === 1) {
    return deltaY * PIXELS_PER_LINE;
  }
  if (deltaMode === 2) {
    return deltaY * pageHeightPx;
  }
  return deltaY;
}

/** The streak's multiplier after it has run `streakMs`: 1 at its start, ramping linearly. */
export function streakGain(streakMs: number): number {
  const progress = Math.min(1, Math.max(0, streakMs / STREAK_RAMP_MS));
  return 1 + (MAX_STREAK_GAIN - 1) * progress;
}

/** The wheel's state between events: when the current streak began, and its direction. */
export interface WheelStreak {
  startMs: number;
  lastMs: number;
  sign: number;
}

export function newStreak(): WheelStreak {
  return { startMs: -Infinity, lastMs: -Infinity, sign: 0 };
}

/**
 * The factor one wheel event multiplies the target distance by, advancing the streak.
 *
 * A reversal, or a pause longer than `STREAK_GAP_MS`, starts a new streak at gain 1.
 */
export function wheelZoomFactor(streak: WheelStreak, pixels: number, nowMs: number): number {
  const sign = Math.sign(pixels);
  if (sign === 0) {
    return 1;
  }
  if (sign !== streak.sign || nowMs - streak.lastMs > STREAK_GAP_MS) {
    streak.startMs = nowMs;
    streak.sign = sign;
  }
  streak.lastMs = nowMs;
  return Math.exp(pixels * ZOOM_PER_WHEEL_PIXEL * streakGain(nowMs - streak.startMs));
}

/** One frame of easing from `current` toward `target`, in the logarithm of distance. */
export function easeDistance(current: number, target: number, damping = ZOOM_DAMPING): number {
  if (!(current > 0) || !(target > 0)) {
    return target;
  }
  return current * Math.pow(target / current, damping);
}
