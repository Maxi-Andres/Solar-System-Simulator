import { describe, expect, it } from 'vitest';

import { SimClock, WARP_RATES } from '../core/time.ts';
import { RATES, stepRate } from './TimeControls.tsx';

/**
 * The transport controls behave like a media transport: tapping an arrow repeatedly
 * speeds up in that direction, and tapping the opposing one flips direction at the
 * same speed rather than starting over. That second rule is what makes scrubbing
 * back and forth over an event usable.
 */

function fresh(): SimClock {
  return new SimClock(new Date('2026-08-24T00:00:00Z'));
}

describe('stepRate', () => {
  it('starts at the slowest rate from a standstill', () => {
    const clock = fresh();
    clock.pause();

    stepRate(clock, 1);
    expect(clock.rate).toBe(RATES[0]![1]);
    expect(clock.mode).toBe('warp');
  });

  it('climbs one rung per press', () => {
    const clock = fresh();
    clock.pause();

    const seen: number[] = [];
    for (let i = 0; i < RATES.length + 2; i += 1) {
      stepRate(clock, 1);
      seen.push(clock.rate);
    }

    expect(seen.slice(0, RATES.length)).toEqual(RATES.map(([, rate]) => rate));
  });

  it('stops at the top rung instead of running away', () => {
    const clock = fresh();
    clock.setRate(WARP_RATES.yearPerSecond);

    stepRate(clock, 1);
    stepRate(clock, 1);

    expect(clock.rate).toBe(WARP_RATES.yearPerSecond);
  });

  it('flips direction at the same speed', () => {
    const clock = fresh();
    clock.setRate(WARP_RATES.dayPerSecond);

    stepRate(clock, -1);
    expect(clock.rate).toBe(-WARP_RATES.dayPerSecond);

    stepRate(clock, 1);
    expect(clock.rate).toBe(WARP_RATES.dayPerSecond);
  });

  it('climbs in reverse just as it does forward', () => {
    const clock = fresh();
    clock.setRate(-WARP_RATES.hourPerSecond);

    stepRate(clock, -1);
    expect(clock.rate).toBe(-WARP_RATES.dayPerSecond);
  });

  it('leaves live mode, since warping is not real time', () => {
    const clock = fresh();
    expect(clock.isLive).toBe(true);

    stepRate(clock, 1);
    expect(clock.isLive).toBe(false);
  });

  it('resumes from a pause at the previous direction', () => {
    const clock = fresh();
    clock.setRate(-WARP_RATES.weekPerSecond);
    clock.pause();

    // From paused, the ladder restarts rather than guessing; the play button is
    // what resumes at the old rate.
    stepRate(clock, -1);
    expect(clock.rate).toBeLessThan(0);
  });
});

describe('rate ladder', () => {
  it('is strictly increasing, so a rung is never skipped or repeated', () => {
    const rates = RATES.map(([, rate]) => rate);
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]!).toBeGreaterThan(rates[i - 1]!);
    }
  });

  it('spans real time to a year per second', () => {
    expect(RATES[0]![1]).toBe(WARP_RATES.realTime);
    expect(RATES.at(-1)![1]).toBe(WARP_RATES.yearPerSecond);
  });
});

/**
 * The play rule, as a scenario.
 *
 * Reported as awkward in use: rewind a few months to reach a moment, then getting
 * time to run forward again meant hunting for a forward rate first. Pause and play
 * are now separate buttons, and **play always means real time forward** — one
 * simulated second per real second, from wherever you are.
 *
 * That single rule is what these pin down. It is the only answer that is never
 * surprising: remembering the last forward rate would fix the direction but still
 * shoot you forward at a month per second after a fast rewind.
 */
describe('rewind then play', () => {
  /** Exactly what the play button does. */
  function play(clock: SimClock): void {
    clock.setRate(WARP_RATES.realTime);
  }

  it('runs forward at real time after rewinding, not backwards', () => {
    const clock = fresh();

    // Rewind hard to reach a moment months back.
    for (let i = 0; i < 6; i += 1) {
      stepRate(clock, -1);
    }
    expect(clock.rate).toBeLessThan(0);

    // One press of play, with no pause first.
    play(clock);
    expect(clock.rate).toBe(WARP_RATES.realTime);
    expect(clock.mode).toBe('warp');
  });

  it('returns to real time from any rate, in either direction', () => {
    for (const [, rate] of RATES) {
      for (const signed of [rate, -rate]) {
        const clock = fresh();
        clock.setRate(signed);
        play(clock);

        expect(clock.rate).toBe(WARP_RATES.realTime);
      }
    }
  });

  it('runs forward at real time from a pause too', () => {
    const clock = fresh();
    clock.setRate(-WARP_RATES.monthPerSecond);
    clock.pause();
    expect(clock.mode).toBe('paused');

    play(clock);
    expect(clock.rate).toBe(WARP_RATES.realTime);
    expect(clock.mode).toBe('warp');
  });

  it('does not move the clock, only its rate', () => {
    // Play resumes from where you are; it must never jump you somewhere else.
    const clock = fresh();
    clock.setRate(-WARP_RATES.dayPerSecond);
    clock.tick(2);
    const before = clock.date.getTime();

    play(clock);
    expect(clock.date.getTime()).toBe(before);
  });

  it('leaves rewind as the only way to run time backwards', () => {
    const clock = fresh();

    play(clock);
    expect(clock.rate).toBeGreaterThan(0);

    for (const [, rate] of RATES) {
      clock.setRate(rate);
      expect(clock.rate).toBeGreaterThan(0);
    }

    stepRate(clock, -1);
    expect(clock.rate).toBeLessThan(0);
  });
});
