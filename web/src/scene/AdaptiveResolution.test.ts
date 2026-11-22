import { describe, expect, it } from 'vitest';

import { STILL_FRAMES } from './viewMotion.ts';
import {
  ResolutionGovernor,
  SLOW_FRAME_MS,
  SLOW_FRAMES_TO_CUT,
  STILL_FRAMES_TO_RESTORE,
} from './AdaptiveResolution.tsx';

/**
 * Feeds frames `intervalMs` apart, the camera moving on each or held still (counting on from
 * the frames it was already still for); returns every step the governor took.
 */
function run(governor: ResolutionGovernor, frames: number, intervalMs: number, cpuMs: number, moving: boolean, start = { t: 0, still: 0 }) {
  const steps: string[] = [];
  for (let k = 0; k < frames; k += 1) {
    start.t += intervalMs;
    start.still = moving ? 0 : start.still + 1;
    const step = governor.frame(start.t, cpuMs, start.still);
    if (step !== null) steps.push(step);
  }
  return steps;
}

describe('the resolution governor', () => {
  it('never cuts on a GPU that keeps up', () => {
    const governor = new ResolutionGovernor();
    expect(run(governor, 600, 1000 / 60, 6, true)).toEqual([]);
  });

  it('leaves alone a drag that keeps above SLOW_FRAME_MS, GPU-bound or not', () => {
    const governor = new ResolutionGovernor();
    expect(run(governor, 600, SLOW_FRAME_MS - 1, 4, true)).toEqual([]);
  });

  it('never cuts while the camera is still, however slow', () => {
    const governor = new ResolutionGovernor();
    expect(run(governor, 100, 60, 4, false)).toEqual([]);
  });

  it('leaves alone frames the main thread spent itself on', () => {
    const governor = new ResolutionGovernor();
    expect(run(governor, 100, 60, 55, true)).toEqual([]);
  });

  it('cuts after a run of slow GPU-bound frames while moving, and restores once at rest', () => {
    const governor = new ResolutionGovernor();
    const clock = { t: 0, still: 0 };
    // The first frame has no interval to time: one more than the run.
    expect(run(governor, SLOW_FRAMES_TO_CUT + 1, 60, 5, true, clock)).toEqual(['cut']);
    expect(governor.cut).toBe(true);
    // Still cut for as long as the camera moves, fast or slow.
    expect(run(governor, 50, 20, 5, true, clock)).toEqual([]);
    // Not on the first still frames: a drag's pointer misses frames.
    expect(run(governor, STILL_FRAMES_TO_RESTORE - 1, 20, 5, false, clock)).toEqual([]);
    expect(governor.cut).toBe(true);
    expect(run(governor, 1, 20, 5, false, clock)).toEqual(['restore']);
    expect(governor.cut).toBe(false);
  });

  it('puts the ratio back the frame before the glows draw their first still frame in full', () => {
    expect(STILL_FRAMES_TO_RESTORE).toBe(STILL_FRAMES - 1);
  });

  it('does not take a still frame in a drag for the end of a run of slow ones', () => {
    const governor = new ResolutionGovernor();
    const clock = { t: 0, still: 0 };
    // The first frame has no interval to time: the run so far is two short.
    run(governor, SLOW_FRAMES_TO_CUT - 1, 60, 5, true, clock);
    // The pointer missed a frame.
    expect(run(governor, 1, 60, 5, false, clock)).toEqual([]);
    expect(run(governor, 2, 60, 5, true, clock)).toEqual(['cut']);
  });

  it('never cuts at real time once a flight has settled: ten frames a second, the camera still', () => {
    const governor = new ResolutionGovernor();
    expect(run(governor, 200, 100, 4, false)).toEqual([]);
  });

  it('does not count a hitch, or frames with the loop stopped between them', () => {
    const governor = new ResolutionGovernor();
    const clock = { t: 0, still: 0 };
    run(governor, SLOW_FRAMES_TO_CUT - 1, 60, 5, true, clock);
    // One quick frame breaks the run.
    expect(run(governor, 1, 16, 5, true, clock)).toEqual([]);
    expect(run(governor, SLOW_FRAMES_TO_CUT - 1, 60, 5, true, clock)).toEqual([]);
    // Frames a second apart are not consecutive: they say nothing of the GPU.
    expect(run(governor, 20, 1000, 5, true, clock)).toEqual([]);
  });
});
