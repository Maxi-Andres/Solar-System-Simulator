import { useSyncExternalStore } from 'react';

import type { Signal } from './signal.ts';

/**
 * Re-renders the calling component each time `signal` fires, and only it.
 *
 * Returns the signal's count, which is new on every firing: pass it on as a `tick` to
 * whatever below needs to know there is news. The values themselves are read straight
 * from their source -- `clock.tdbJulianDay`, the store -- during the render this causes.
 */
export function useSignal(signal: Signal): number {
  return useSyncExternalStore(signal.subscribe, () => signal.count);
}
