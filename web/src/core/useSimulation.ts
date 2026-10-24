import { useEffect, useMemo, useRef, useState } from 'react';

import type { StarCatalog } from '@sss/tools/types';

import { BeltSource, httpBeltFetchers } from './belt.ts';
import { loadNameIndex, NameIndexSource } from './beltNames.ts';
import { CometSource, loadComets } from './comets.ts';
import {
  LazySource,
  loadSatelliteNames,
  loadSatellites,
  type SatelliteNameIndex,
  type Satellites,
} from './satellites.ts';
import { EphemerisStore, httpFetcher, loadEphemerisStore, type Fetcher } from './ephemerisStore.ts';
import { renderDemand } from './renderDemand.ts';
import { Signal } from './signal.ts';
import { loadStarCatalog } from './starCatalog.ts';
import { loadStarNames, Stars3dSource, type StarNameIndex } from './stars3d.ts';
import { SimClock } from './time.ts';

/**
 * Loads the ephemerides once and drives the simulation clock from the browser's
 * frame loop.
 *
 * The clock ticks on every animation frame, but nothing in React re-renders on that
 * beat: the 3D scene reads the clock directly inside useFrame, and the DOM readouts
 * listen to `readout`, a much slower beat of their own. The clock stays the single
 * source of truth either way.
 */

export interface Simulation {
  readonly store: EphemerisStore | null;
  /**
   * The sky. Loaded with the ephemerides rather than behind them, because it is a
   * fifth of their weight and a sky that appears a second late reads as a bug.
   */
  readonly stars: StarCatalog | null;
  /**
   * The asteroid belt, fetched only when asked for: App asks once the ephemerides are in
   * and the Asteroids layer is on, for as many tiers as the viewer chose. See belt.ts.
   */
  readonly belt: BeltSource;
  /** The comets, fetched once the Comets layer is first on; see comets.ts. */
  readonly comets: CometSource;
  /** The belt's name index, fetched when search first opens; see beltNames.ts. */
  readonly names: NameIndexSource;
  /**
   * Earth's satellites, fetched once the Satellites layer is first on or search opens;
   * see satellites.ts.
   */
  readonly satellites: LazySource<Satellites>;
  /** The bulk satellites' names, fetched when search first opens. */
  readonly satelliteNames: LazySource<SatelliteNameIndex>;
  /**
   * The stars at their real distances, once the sky is in (it needs the sky's row count to
   * check the pair): fetched when the camera leaves the planets, or search asks. See
   * stars3d.ts.
   */
  readonly stars3d: Stars3dSource | null;
  /** Their names, fetched when search first opens. */
  readonly starNames: LazySource<StarNameIndex> | null;
  readonly clock: SimClock;
  readonly error: string | null;
  /**
   * Fires at the readout cadence. Only what shows a number that moves with the clock
   * listens, through `useSignal`; see signal.ts for why it is not React state here.
   */
  readonly readout: Signal;
}

/**
 * Every published file the store or the sky fetches, with a frame asked for when it
 * lands.
 *
 * The scene renders on demand (see renderDemand.ts), and data arriving is one of the
 * things that changes it without anybody touching anything: with the clock paused, a
 * moon's chunk or a craft's trajectory that came in after the last frame would otherwise
 * sit unused until the next drag. Asked for on failure too -- the scene shows a failure
 * as well, by carrying on without it. The store's own handling of the response runs in
 * promise callbacks queued behind this one, so it has finished before the frame starts.
 */
const renderingFetcher: Fetcher = (path) =>
  httpFetcher(path).finally(() => {
    renderDemand.request();
  });

export function useSimulation(refreshHz = 10): Simulation {
  const clockRef = useRef<SimClock>(null);
  clockRef.current ??= new SimClock();
  const readoutRef = useRef<Signal>(null);
  readoutRef.current ??= new Signal();
  const beltRef = useRef<BeltSource>(null);
  // BASE_URL carries the GitHub Pages prefix, as below.
  beltRef.current ??= new BeltSource(httpBeltFetchers, import.meta.env.BASE_URL);
  const cometsRef = useRef<CometSource>(null);
  cometsRef.current ??= new CometSource(() => loadComets(httpBeltFetchers, import.meta.env.BASE_URL));
  const namesRef = useRef<NameIndexSource>(null);
  namesRef.current ??= new NameIndexSource(() => loadNameIndex(httpBeltFetchers, import.meta.env.BASE_URL));
  const satellitesRef = useRef<LazySource<Satellites>>(null);
  satellitesRef.current ??= new LazySource(
    () => loadSatellites(httpBeltFetchers, import.meta.env.BASE_URL),
    'the satellites',
  );
  const satelliteNamesRef = useRef<LazySource<SatelliteNameIndex>>(null);
  satelliteNamesRef.current ??= new LazySource(async () => {
    const source = satellitesRef.current!;
    await source.request();
    const satellites = source.value;
    return satellites === null
      ? null
      : loadSatelliteNames(httpBeltFetchers, satellites.info, import.meta.env.BASE_URL);
  }, 'the satellite names');

  const [store, setStore] = useState<EphemerisStore | null>(null);
  const [stars, setStars] = useState<StarCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // BASE_URL carries the GitHub Pages prefix; a hardcoded '/' would 404 there.
    const base = import.meta.env.BASE_URL;

    // Both or neither. The data directory is generated in one run and published as
    // one artifact, so a missing star catalogue means the generator did not finish --
    // which is exactly what the error screen is for.
    Promise.all([
      loadEphemerisStore(renderingFetcher, base),
      loadStarCatalog(renderingFetcher, base),
    ])
      .then(([loadedStore, loadedStars]) => {
        if (!cancelled) {
          setStore(loadedStore);
          setStars(loadedStars);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Failed to load the published data.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stars3d = useMemo(
    () => (stars === null ? null : new Stars3dSource(httpBeltFetchers, stars.count, import.meta.env.BASE_URL)),
    [stars],
  );
  const starNames = useMemo(
    () =>
      stars3d === null
        ? null
        : new LazySource(
            () => loadStarNames(stars3d, httpBeltFetchers, import.meta.env.BASE_URL),
            'the star names',
          ),
    [stars3d],
  );

  useEffect(() => {
    const clock = clockRef.current;
    const readout = readoutRef.current;
    if (clock === null || readout === null) {
      return;
    }

    let handle = 0;
    let lastTime = performance.now();
    let lastRefresh = 0;
    // NaN, so the first frame always counts as a change.
    let lastEpochMs = Number.NaN;
    const refreshInterval = 1000 / refreshHz;

    const loop = (time: number): void => {
      const deltaSeconds = (time - lastTime) / 1000;
      lastTime = time;
      clock.tick(deltaSeconds);

      // The scene only redraws when the instant it shows has moved: every frame while
      // the clock runs, live or warped, and once when a date is typed in while paused --
      // which happens between ticks, so it is the instant that is compared, not whether
      // this tick moved it. Paused, this loop costs a comparison and draws nothing.
      if (clock.epochMs !== lastEpochMs) {
        lastEpochMs = clock.epochMs;
        renderDemand.request();
      }

      if (time - lastRefresh >= refreshInterval) {
        lastRefresh = time;
        readout.emit();
      }

      handle = requestAnimationFrame(loop);
    };

    handle = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [refreshHz]);

  return {
    store,
    stars,
    belt: beltRef.current,
    comets: cometsRef.current,
    names: namesRef.current,
    satellites: satellitesRef.current,
    satelliteNames: satelliteNamesRef.current,
    stars3d,
    starNames,
    clock: clockRef.current,
    error,
    readout: readoutRef.current,
  };
}
