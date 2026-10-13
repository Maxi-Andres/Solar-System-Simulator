import { useCallback, useSyncExternalStore } from 'react';

import type { EphemerisStore } from './ephemerisStore.ts';

/**
 * The store's version, as React state: anything that lists the bodies calls this, and
 * redraws when a planet's small moons are added. See EphemerisStore.loadSmallMoons.
 * Zero, and nothing subscribed, before the store has loaded.
 */
export function useStoreVersion(store: EphemerisStore | null): number {
  const subscribe = useCallback(
    (listener: () => void) => (store === null ? () => {} : store.subscribe(listener)),
    [store],
  );
  return useSyncExternalStore(subscribe, () => store?.version ?? 0);
}
