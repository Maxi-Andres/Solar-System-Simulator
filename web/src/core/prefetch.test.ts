import { afterEach, describe, expect, it, vi } from 'vitest';

import { beginLoading, loadingNow } from './loading.ts';
import {
  MAX_WAIT_MS,
  PREFETCH_ORDER,
  prefetchPlan,
  QUIET_MS,
  START_AFTER_MS,
  startPrefetch,
  type DeviceHints,
  type PrefetchStep,
} from './prefetch.ts';
import { LazySource } from './satellites.ts';

const DESKTOP: DeviceHints = { saveData: false, effectiveType: '4g', deviceMemoryGb: 8, touchOnly: false };

describe('what is fetched ahead, by device', () => {
  it('fetches all four, nearest first, on a desktop -- and never the cosmic web', () => {
    expect(prefetchPlan(DESKTOP)).toEqual(['milky-way', 'local-group', 'local-volume', 'laniakea']);
    expect(PREFETCH_ORDER).toEqual(['milky-way', 'local-group', 'local-volume', 'laniakea']);
    // A browser that says nothing of the device is taken for a desktop.
    expect(prefetchPlan({ saveData: false, effectiveType: null, deviceMemoryGb: null, touchOnly: false })).toHaveLength(4);
  });

  it('leaves Laniakea’s 8 MB to the camera on a phone or a 3G connection', () => {
    expect(prefetchPlan({ ...DESKTOP, touchOnly: true })).toEqual(['milky-way', 'local-group', 'local-volume']);
    expect(prefetchPlan({ ...DESKTOP, effectiveType: '3g' })).toEqual(['milky-way', 'local-group', 'local-volume']);
  });

  it('downloads nothing ahead when asked to save data or on 2G: only the sample, built here', () => {
    expect(prefetchPlan({ ...DESKTOP, saveData: true })).toEqual(['milky-way']);
    expect(prefetchPlan({ ...DESKTOP, effectiveType: '2g' })).toEqual(['milky-way']);
    expect(prefetchPlan({ ...DESKTOP, effectiveType: 'slow-2g', touchOnly: true })).toEqual(['milky-way']);
  });

  it('holds nothing ahead with under 4 GB of memory', () => {
    expect(prefetchPlan({ ...DESKTOP, deviceMemoryGb: 2 })).toEqual([]);
    expect(prefetchPlan({ ...DESKTOP, deviceMemoryGb: 4 })).toHaveLength(4);
  });
});

describe('the loading line and what is fetched ahead', () => {
  it('keeps a quiet load off the line until someone wants it', async () => {
    let arrive: (value: number) => void = () => {};
    const source = new LazySource<number>(() => new Promise((resolve) => (arrive = resolve)), 'the far thing', () => {});
    const prefetched = source.prefetch();
    expect(source.state).toBe('loading');
    expect(loadingNow()).toBeNull();
    // The camera gets there while it is still on its way: named now.
    const requested = source.request();
    expect(loadingNow()).toBe('the far thing');
    arrive(42);
    await Promise.all([prefetched, requested]);
    expect(source.value).toBe(42);
    expect(loadingNow()).toBeNull();
  });

  it('names a load asked for by the camera as before', async () => {
    let arrive: (value: number) => void = () => {};
    const source = new LazySource<number>(() => new Promise((resolve) => (arrive = resolve)), 'the near thing', () => {});
    const requested = source.request();
    expect(loadingNow()).toBe('the near thing');
    arrive(1);
    await requested;
    expect(loadingNow()).toBeNull();
  });
});

describe('when the steps run', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for the first view, then runs each step only after the one before it, each once it is quiet', async () => {
    vi.useFakeTimers();
    const ran: PrefetchStep[] = [];
    const finish: (() => void)[] = [];
    const task = (step: PrefetchStep) => ({
      step,
      run: () => {
        ran.push(step);
        return new Promise<void>((resolve) => finish.push(resolve));
      },
    });
    // Something the viewer waits for is on the line: nothing starts under it.
    const end = beginLoading('the first view');
    const cancel = startPrefetch([task('milky-way'), task('local-group')]);
    await vi.advanceTimersByTimeAsync(START_AFTER_MS + QUIET_MS + 1000);
    expect(ran).toEqual([]);
    end();
    await vi.advanceTimersByTimeAsync(QUIET_MS + 600);
    expect(ran).toEqual(['milky-way']);
    // The next waits for the first to be in hand.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ran).toEqual(['milky-way']);
    finish[0]!();
    await vi.advanceTimersByTimeAsync(QUIET_MS + 600);
    expect(ran).toEqual(['milky-way', 'local-group']);
    cancel();
  });

  it('is not put off for ever by a load that never ends, and stops when cancelled', async () => {
    vi.useFakeTimers();
    const ran: PrefetchStep[] = [];
    const end = beginLoading('a load that hangs');
    const cancel = startPrefetch([{ step: 'milky-way', run: async () => void ran.push('milky-way') }]);
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS + 1000);
    expect(ran).toEqual(['milky-way']);
    end();
    cancel();

    const cancelled: PrefetchStep[] = [];
    const stop = startPrefetch([{ step: 'laniakea', run: async () => void cancelled.push('laniakea') }]);
    stop();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS + 1000);
    expect(cancelled).toEqual([]);
  });
});
