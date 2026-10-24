import { describe, expect, it } from 'vitest';

import { LIGHT_YEAR_KM } from './scale.ts';
import {
  easeDistance,
  MAX_STREAK_GAIN,
  newStreak,
  PIXELS_PER_NOTCH,
  STREAK_GAP_MS,
  streakGain,
  wheelPixels,
  wheelZoomFactor,
  ZOOM_DAMPING,
} from './zoom.ts';

/** The ISS's framing distance, km: eight of its 54.5 m half-spans, as CameraRig frames it. */
const ISS_FRAMING_KM = 8 * 0.0545;

/** Seconds of steady scrolling, `rate` notches a second, from the ISS to `targetKm`. */
function secondsTo(targetKm: number, rate: number): { seconds: number; notches: number } {
  const streak = newStreak();
  let distance = ISS_FRAMING_KM;
  let nowMs = 0;
  let notches = 0;
  while (distance < targetKm) {
    distance *= wheelZoomFactor(streak, PIXELS_PER_NOTCH, nowMs);
    nowMs += 1000 / rate;
    notches += 1;
  }
  return { seconds: (notches - 1) / rate, notches };
}

describe('zooming across twenty orders of magnitude', () => {
  it('keeps a single notch at 13 %, as fine as it always was', () => {
    expect(wheelZoomFactor(newStreak(), PIXELS_PER_NOTCH, 0)).toBeCloseTo(Math.exp(0.12), 12);
  });

  it('crosses from the ISS to 1,000 light years in a few seconds of scrolling', () => {
    // 313 notches without the streak: half a minute at ten a second.
    const steady = secondsTo(1000 * LIGHT_YEAR_KM, 10);
    const quick = secondsTo(1000 * LIGHT_YEAR_KM, 20);
    expect(steady.seconds).toBeGreaterThan(3.5);
    expect(steady.seconds).toBeLessThan(5);
    expect(quick.seconds).toBeLessThan(3);
    // And to the camera's limit, 3,000 ly, hardly longer.
    expect(secondsTo(3000 * LIGHT_YEAR_KM, 10).seconds - steady.seconds).toBeLessThan(0.3);
  });

  it('is never more than 2.6 times the distance in one notch', () => {
    expect(streakGain(1e9)).toBe(MAX_STREAK_GAIN);
    expect(Math.exp(0.12 * MAX_STREAK_GAIN)).toBeLessThan(2.62);
  });

  it('starts over on a pause or a reversal', () => {
    const streak = newStreak();
    for (let t = 0; t <= 3000; t += 50) {
      wheelZoomFactor(streak, PIXELS_PER_NOTCH, t);
    }
    expect(wheelZoomFactor(streak, PIXELS_PER_NOTCH, 3050)).toBeCloseTo(Math.exp(0.96), 9);
    expect(wheelZoomFactor(streak, -PIXELS_PER_NOTCH, 3100)).toBeCloseTo(Math.exp(-0.12), 9);
    expect(wheelZoomFactor(streak, -PIXELS_PER_NOTCH, 3100 + STREAK_GAP_MS + 1)).toBeCloseTo(
      Math.exp(-0.12),
      9,
    );
  });

  it('reads a Firefox notch, three lines, as a Chromium one, a hundred pixels', () => {
    expect(wheelPixels(3, 1, 800)).toBeCloseTo(PIXELS_PER_NOTCH, 9);
    expect(wheelPixels(100, 0, 800)).toBe(100);
  });

  it('eases out as smoothly as in: the same share of the ratio each frame', () => {
    const out = easeDistance(1, 100);
    const back = easeDistance(100, 1);
    expect(out).toBeCloseTo(100 ** ZOOM_DAMPING, 9);
    expect(out * back).toBeCloseTo(100, 9);
    // The linear easing it replaced jumped 18.8 times over in that first frame.
    expect(out).toBeLessThan(2.4);
  });

  it('settles a single notch in the same number of frames as before', () => {
    let current = 1;
    let frames = 0;
    const target = Math.exp(0.12);
    while (Math.abs(target - current) > target * 1e-5) {
      current = easeDistance(current, target);
      frames += 1;
    }
    expect(frames).toBeLessThan(60);
  });
});
