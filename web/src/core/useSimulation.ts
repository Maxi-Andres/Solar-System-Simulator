import { useEffect, useRef, useState } from 'react';

import { EphemerisStore, httpFetcher, loadEphemerisStore } from './ephemerisStore.ts';
import { SimClock } from './time.ts';

/**
 * Loads the ephemerides once and drives the simulation clock from the browser's
 * frame loop.
 *
 * The clock ticks on every animation frame, but React only re-renders at a fixed
 * cadence: in step 3 the 3D scene will read the clock directly inside useFrame, and
 * re-rendering the DOM 60 times a second to show a readout would be wasteful. The
 * clock stays the single source of truth either way.
 */

export interface Simulation {
  readonly store: EphemerisStore | null;
  readonly clock: SimClock;
  readonly error: string | null;
  /** Bumped on each UI refresh, so consumers re-render at the readout cadence. */
  readonly frame: number;
}

export function useSimulation(refreshHz = 10): Simulation {
  const clockRef = useRef<SimClock>(null);
  clockRef.current ??= new SimClock();

  const [store, setStore] = useState<EphemerisStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // BASE_URL carries the GitHub Pages prefix; a hardcoded '/' would 404 there.
    loadEphemerisStore(httpFetcher, import.meta.env.BASE_URL)
      .then((loaded) => {
        if (!cancelled) {
          setStore(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Failed to load ephemerides.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const clock = clockRef.current;
    if (clock === null) {
      return;
    }

    let handle = 0;
    let lastTime = performance.now();
    let lastRefresh = 0;
    const refreshInterval = 1000 / refreshHz;

    const loop = (time: number): void => {
      const deltaSeconds = (time - lastTime) / 1000;
      lastTime = time;
      clock.tick(deltaSeconds);

      if (time - lastRefresh >= refreshInterval) {
        lastRefresh = time;
        setFrame((n) => n + 1);
      }

      handle = requestAnimationFrame(loop);
    };

    handle = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [refreshHz]);

  return { store, clock: clockRef.current, error, frame };
}
