import { useEffect } from 'react';

import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import { FICTION, fictionBodyId } from '../../core/fiction.ts';
import { placeFiction } from '../../core/fictionBodies.ts';
import { renderDemand } from '../../core/renderDemand.ts';
import { createFictionWorldExtras, fictionWorldMaterial } from './fictionLooks.ts';
import { setFictionWorldMakers } from './fictionHooks.ts';

// Before any fictional body exists, so SolarSystem builds each in its look (fictionHooks.ts).
setFictionWorldMakers({ material: fictionWorldMaterial, extras: createFictionWorldExtras });

/**
 * The Fiction layer (core/fiction.ts), its own chunk: loaded the first time the layer is switched
 * on (SolarSystemCanvas.tsx, lazyLayer.tsx), and kept, as the other layers off at first are. Off,
 * it is never fetched, and nothing fictional is a body: the cost is none.
 *
 * Its worlds are bodies like any other, drawn by SolarSystem in their looks and hidden with the
 * layer (floatingOrigin.ts isShown); this makes them bodies, as soon as what they are anchored to
 * is one -- Alpha Centauri's stars are placed once the star names are in (App.tsx), which may be
 * after the layer is first on. What is not a world -- a monolith, a ship -- will be drawn here,
 * in this component's frame.
 */
export function FictionLayer({ store }: { readonly store: EphemerisStore }) {
  useEffect(() => {
    const placed = (): boolean => FICTION.every((record) => store.isPropagatedBody(fictionBodyId(record.id)));
    // Adding a body tells the store's listeners, this one among them: not placed again inside.
    let placing = false;
    const place = (): void => {
      if (placing) return;
      placing = true;
      try {
        if (placeFiction(store).length > 0) renderDemand.request();
      } finally {
        placing = false;
      }
    };
    place();
    if (placed()) return undefined;
    const unsubscribe = store.subscribe(() => {
      place();
      if (placed()) unsubscribe();
    });
    return unsubscribe;
  }, [store]);
  return null;
}
