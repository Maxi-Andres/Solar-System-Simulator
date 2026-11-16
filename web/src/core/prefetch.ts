import { whenIdle } from './idle.ts';
import { isLoading, loadingNow } from './loading.ts';

/**
 * The far layers, fetched ahead of the camera.
 *
 * Each far layer loads when the camera first gets far enough out to draw it: the Milky Way's
 * sample at 500 light years, the Local Group's galaxies at 10,000, the Local Volume's at 3
 * million, Laniakea's catalogue at 30 million. Once loaded, each is drawn from wherever the
 * camera is past the star catalogue -- so the Milky Way seen on the way back in had the other
 * galaxies behind it, and the same view on the way out, the first time, did not. Fetched here
 * once the first view is up and the page is idle, they are in hand by the time anyone zooms
 * out, and the first look at the Milky Way is the look on the way back.
 *
 * ## When
 *
 * Not before the first view: nothing starts until no load anyone waits for is on the loading
 * line (loading.ts) for QUIET_MS, and then only in an idle moment (idle.ts) -- and the same
 * again before each next step, so a step never competes with what the viewer asked for. Each
 * is fetched quietly: off the loading line, unless the camera gets there while it is still on
 * its way, when the line names it as before.
 *
 * ## What, by device
 *
 * In PREFETCH_ORDER, nearest first, as much as the device can be expected to take
 * (`prefetchPlan`): all four on a desktop; the three small ones -- the sample built here, 24
 * and 300 KB -- on a touch-only device or a 3G connection, without Laniakea's 8 MB; only the
 * sample, which downloads nothing, when the viewer asked to save data or the connection is 2G;
 * nothing with under 4 GB of memory, where what is never looked at should not be held.
 *
 * The cosmic web is never fetched ahead. It is 19 MB and 1.8 million points; and from the
 * Milky Way's view, the only place the prefetch is for, its galaxies are a billion light years
 * behind a camera 180,000 out, dimmed by the depth cue to nothing (CosmicWeb.tsx). It loads, as
 * before, once the camera is a few hundred million light years out.
 */

export type PrefetchStep = 'milky-way' | 'local-group' | 'local-volume' | 'laniakea';

/** Nearest first: the order the camera would reach them in. */
export const PREFETCH_ORDER: readonly PrefetchStep[] = ['milky-way', 'local-group', 'local-volume', 'laniakea'];

/** What the browser says of the device and its connection; null where it does not say. */
export interface DeviceHints {
  /** The viewer asked for less data (Save-Data). */
  readonly saveData: boolean;
  /** navigator.connection.effectiveType: 'slow-2g', '2g', '3g' or '4g'. */
  readonly effectiveType: string | null;
  /** navigator.deviceMemory, GB, rounded down and capped at 8 by the browser. */
  readonly deviceMemoryGb: number | null;
  /** No mouse or trackpad, only a finger: a phone or a tablet. */
  readonly touchOnly: boolean;
}

/** What to fetch ahead on a device: a prefix-like subset of PREFETCH_ORDER, in that order. */
export function prefetchPlan(device: DeviceHints): PrefetchStep[] {
  if (device.deviceMemoryGb !== null && device.deviceMemoryGb < 4) return [];
  if (device.saveData || device.effectiveType === 'slow-2g' || device.effectiveType === '2g') return ['milky-way'];
  if (device.touchOnly || device.effectiveType === '3g') return ['milky-way', 'local-group', 'local-volume'];
  return [...PREFETCH_ORDER];
}

export function deviceHints(): DeviceHints {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const media = (query: string): boolean => typeof matchMedia === 'function' && matchMedia(query).matches;
  return {
    saveData: nav.connection?.saveData === true,
    effectiveType: nav.connection?.effectiveType ?? null,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    touchOnly: media('(pointer: coarse)') && !media('(any-pointer: fine)'),
  };
}

/** No load anyone waits for, this long, before a step: the first view is up. */
export const QUIET_MS = 1500;
/** Nor before this long after the start, whatever the line says. */
export const START_AFTER_MS = 2000;
/** But never put off longer than this by a load that does not end. */
export const MAX_WAIT_MS = 20_000;
/** How long an idle moment is waited for once it is quiet. */
export const IDLE_TIMEOUT_MS = 5000;

export interface PrefetchTask {
  readonly step: PrefetchStep;
  /** Starts the step; resolves once it is in hand, or has failed. */
  readonly run: () => Promise<void>;
}

/** Runs `tasks` one after another, each once it is quiet and idle; returns the cancel. */
export function startPrefetch(tasks: readonly PrefetchTask[]): () => void {
  let cancelled = false;
  let cancelWait: () => void = () => {};
  const step = (k: number, minimumMs: number): void => {
    if (cancelled || k >= tasks.length) return;
    cancelWait = afterQuiet(minimumMs, () => {
      cancelWait = whenIdle(() => {
        if (cancelled) return;
        void tasks[k]!
          .run()
          .catch(() => undefined)
          .then(() => step(k + 1, 0));
      }, IDLE_TIMEOUT_MS);
    });
  };
  step(0, START_AFTER_MS);
  return () => {
    cancelled = true;
    cancelWait();
  };
}

/** Calls `work` once nothing on the loading line has been waited for, for QUIET_MS -- and `minimumMs` has passed. */
function afterQuiet(minimumMs: number, work: () => void): () => void {
  const started = Date.now();
  let quietSince = Number.NaN;
  const timer = setInterval(() => {
    const now = Date.now();
    if (loadingNow() !== null) quietSince = Number.NaN;
    else if (Number.isNaN(quietSince)) quietSince = now;
    const quiet = !Number.isNaN(quietSince) && now - quietSince >= QUIET_MS && now - started >= minimumMs;
    if (quiet || now - started >= MAX_WAIT_MS) {
      clearInterval(timer);
      work();
    }
  }, 250);
  return () => clearInterval(timer);
}

/**
 * Resolves once the load named `what` (loading.ts) has come and gone: for a step whose load
 * starts elsewhere -- the Milky Way's sample, begun by its own component's next frame. If it
 * has not started within `startMs` it is not coming (its layer is off), and that is the end of it.
 */
export function loadSettled(what: string, startMs = 3000, maxMs = 60_000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    let seen = false;
    const timer = setInterval(() => {
      const now = isLoading(what);
      seen ||= now;
      const elapsed = Date.now() - started;
      if ((seen && !now) || (!seen && elapsed >= startMs) || elapsed >= maxMs) {
        clearInterval(timer);
        resolve();
      }
    }, 250);
  });
}

/** Whether the Milky Way's sample has been asked for ahead of the camera (MilkyWay.tsx reads it). */
let milkyWayAsked = false;

export function milkyWayAhead(): boolean {
  return milkyWayAsked;
}

export function askMilkyWayAhead(): void {
  milkyWayAsked = true;
}
