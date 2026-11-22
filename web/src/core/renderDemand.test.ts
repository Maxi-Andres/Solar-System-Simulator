import { describe, expect, it } from 'vitest';

import {
  IDLE_FRAME_MS,
  LIVE_FRAME_MAX_MS,
  LIVE_STEP_PX,
  liveFrameIntervalMs,
  RenderDemand,
  SETTLE_FRAMES,
} from './renderDemand.ts';

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

  it('counts its requests, and nothing else, for the readout beat', () => {
    const demand = new RenderDemand();
    expect(demand.requests).toBe(0);
    demand.request();
    demand.request(2);
    while (demand.frameDrawn());
    expect(demand.requests).toBe(2);
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

describe('the live clock', () => {
  /** A demand whose last frame was drawn at t = 0 with this much motion, px per second. */
  function settled(motion: number): { demand: RenderDemand; wakes: () => number } {
    const demand = new RenderDemand();
    let wakes = 0;
    demand.connect(() => (wakes += 1));
    demand.setMotion(motion);
    demand.frameDrawn(0);
    return { demand, wakes: () => wakes };
  }

  it('asks for a frame once the fastest thing has moved a quarter of a pixel', () => {
    // 1 px/s: a quarter of a pixel takes 250 ms, past the 100 ms most it waits. Asked a vsync
    // and a half early, since the frame asked for comes on the vsync after.
    const slow = settled(1);
    slow.demand.clockMoved(true, 1, 50);
    expect(slow.wakes()).toBe(0);
    slow.demand.clockMoved(true, 1, LIVE_FRAME_MAX_MS);
    expect(slow.wakes()).toBe(1);
    expect(slow.demand.remaining).toBe(1);
    // One frame, no tail.
    expect(slow.demand.frameDrawn(LIVE_FRAME_MAX_MS)).toBe(false);

    // 5 px/s: every 50 ms -- asked for a vsync and a half early, drawn on the vsync after.
    const faster = settled(5);
    faster.demand.clockMoved(true, 1, 20);
    expect(faster.wakes()).toBe(0);
    faster.demand.clockMoved(true, 1, 50);
    expect(faster.wakes()).toBe(1);
  });

  it('draws every vsync when things move fast, or when the scene cannot say', () => {
    for (const motion of [100, Infinity, Number.NaN]) {
      const { demand, wakes } = settled(motion);
      demand.clockMoved(true, 1, 1);
      expect(wakes()).toBe(1);
    }
  });

  it('runs every frame, with a tail, under warp', () => {
    const { demand, wakes } = settled(0);
    demand.clockMoved(false, 86_400, 1);
    expect(wakes()).toBe(1);
    expect(demand.remaining).toBe(SETTLE_FRAMES);
  });

  it('asks for nothing more while frames are owed for anything else', () => {
    const { demand, wakes } = settled(0);
    demand.request(3);
    demand.clockMoved(true, 1, 1_000);
    expect(wakes()).toBe(1);
    expect(demand.remaining).toBe(3);
  });

  it('spaces frames by the motion, between a vsync and a tenth of a second', () => {
    expect(liveFrameIntervalMs(LIVE_STEP_PX * 10)).toBeCloseTo(100);
    expect(liveFrameIntervalMs(LIVE_STEP_PX * 20)).toBeCloseTo(50);
    expect(liveFrameIntervalMs(0)).toBe(LIVE_FRAME_MAX_MS);
    expect(liveFrameIntervalMs(LIVE_STEP_PX * 100)).toBe(0);
  });

  it('holds the floor only while what it is for could show motion', () => {
    // Unbounded, or not said: ten frames a second, as always.
    expect(liveFrameIntervalMs(0, Infinity)).toBe(LIVE_FRAME_MAX_MS);
    expect(liveFrameIntervalMs(0, Number.NaN)).toBe(LIVE_FRAME_MAX_MS);
    // Bounded at a quarter of a pixel a second: once a second, the scene's own motion permitting.
    expect(liveFrameIntervalMs(0, LIVE_STEP_PX)).toBeCloseTo(1000);
    expect(liveFrameIntervalMs(LIVE_STEP_PX * 4, LIVE_STEP_PX)).toBeCloseTo(250);
    // Faster than the floor allows: still the floor, never oftener.
    expect(liveFrameIntervalMs(0, LIVE_STEP_PX * 1000)).toBe(LIVE_FRAME_MAX_MS);
    // Nothing moving anywhere: no frame from the clock at all.
    expect(liveFrameIntervalMs(0, 0)).toBe(Infinity);
  });

  it('asks the clock for nothing from far enough away that nothing can move', () => {
    const demand = new RenderDemand();
    let wakes = 0;
    demand.connect(() => (wakes += 1));
    demand.setMotion(1e-12, 1e-15);
    demand.frameDrawn(0);
    for (const t of [100, 1_000, 60_000]) demand.clockMoved(true, 1, t);
    expect(wakes).toBe(0);
    // And the floor back the moment the camera comes within reach.
    demand.setMotion(1e-12, Infinity);
    demand.clockMoved(true, 1, 60_100);
    expect(wakes).toBe(1);
  });
});
