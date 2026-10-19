import { describe, expect, it } from 'vitest';

import { IDLE_FRAME_MS, RenderDemand, SETTLE_FRAMES } from './renderDemand.ts';

/** Draws frames the way the canvas does, until none is owed; returns how many. */
function drawUntilIdle(demand: RenderDemand, limit = 10_000): number {
  let drawn = 0;
  do {
    drawn += 1;
  } while (demand.frameDrawn() && drawn < limit);
  return drawn;
}

describe('rendering on demand', () => {
  it('owes nothing until asked', () => {
    const demand = new RenderDemand();
    expect(demand.remaining).toBe(0);
    expect(demand.frameDrawn()).toBe(false);
  });

  it('wakes the loop on every request', () => {
    const demand = new RenderDemand();
    let wakes = 0;
    demand.connect(() => (wakes += 1));
    demand.request();
    demand.request(1);
    expect(wakes).toBe(2);
  });

  it('draws the whole settling tail for one request, and then stops', () => {
    const demand = new RenderDemand();
    demand.request();
    expect(drawUntilIdle(demand)).toBe(SETTLE_FRAMES);
    expect(demand.remaining).toBe(0);
    expect(demand.frameDrawn()).toBe(false);
  });

  it('never lets a small request cut short a longer tail', () => {
    const demand = new RenderDemand();
    demand.request(10);
    demand.frameDrawn();
    demand.request(2);
    expect(demand.remaining).toBe(9);
    // And a later, longer one extends it.
    demand.request(20);
    expect(demand.remaining).toBe(20);
  });

  it('keeps drawing while something keeps asking, and settles a tail after it stops', () => {
    // The clock running, or the camera easing: a request every frame.
    const demand = new RenderDemand();
    for (let frame = 0; frame < 100; frame += 1) {
      demand.request();
      expect(demand.frameDrawn()).toBe(true);
    }
    // Stopped asking: the frames it was owed, and no more. The last frame drawn with a
    // request was already one of them.
    expect(drawUntilIdle(demand)).toBe(SETTLE_FRAMES - 1);
  });

  it('keeps a request made before the canvas connects, and wakes it on connect', () => {
    const demand = new RenderDemand();
    demand.request();
    let wakes = 0;
    demand.connect(() => (wakes += 1));
    expect(wakes).toBe(1);

    // Nothing owed: connecting asks for nothing.
    const idle = new RenderDemand();
    let idleWakes = 0;
    idle.connect(() => (idleWakes += 1));
    expect(idleWakes).toBe(0);
  });

  it('stops waking a loop once it has disconnected, but not a newer one', () => {
    const demand = new RenderDemand();
    let oldWakes = 0;
    let newWakes = 0;
    const disconnectOld = demand.connect(() => (oldWakes += 1));
    demand.connect(() => (newWakes += 1));
    // An unmount that arrives after the remount must not cut the new canvas off.
    disconnectOld();
    demand.request();
    expect(oldWakes).toBe(0);
    expect(newWakes).toBe(1);
  });

  it('settles quickly and idles rarely', () => {
    // Half a second of tail at 60 Hz, and one idle frame a second: cheap next to the
    // sixty a second it replaces, frequent enough for the half-minute detail release.
    expect(SETTLE_FRAMES).toBeLessThanOrEqual(60);
    expect(SETTLE_FRAMES).toBeGreaterThanOrEqual(3);
    expect(IDLE_FRAME_MS).toBeGreaterThanOrEqual(250);
    expect(IDLE_FRAME_MS).toBeLessThanOrEqual(30_000 / 10);
  });
});
