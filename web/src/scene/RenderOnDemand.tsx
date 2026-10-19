import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { IDLE_FRAME_MS, renderDemand } from '../core/renderDemand.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { useViewStore } from '../state/store.ts';

/**
 * Connects `renderDemand` to the canvas, and asks for frames on the canvas's own behalf.
 *
 * The canvas runs with `frameloop="demand"`: react-three-fiber draws only when
 * invalidated. This is the piece that invalidates. See renderDemand.ts for the whole list
 * of what asks and why each request buys a tail of frames; the requests made here are:
 *
 *  - **The view store, on any change.** Focus, layers, lighting -- and the toolbar's zoom
 *    buttons, which leave an impulse in the store for CameraRig to pick up inside its
 *    frame loop; with no frame coming it would wait there. Opening a panel asks too, for
 *    nothing; that is half a second of frames per click, and listing which fields matter
 *    is how one gets forgotten.
 *  - **The store's version**: a planet's small moons arriving add bodies to the scene.
 *  - **A resized canvas.** react-three-fiber draws one frame for it itself; the labels
 *    need the tail.
 *  - **Every file three.js loads**: the surface maps, and the craft models with the
 *    textures inside them. Both go through three's default loading manager, which says
 *    when each file is done -- after the code waiting for it has run, so the frame that
 *    follows shows it. A loader given a manager of its own would bypass this, and its
 *    loads would then show up only with the idle frame, a second late.
 *  - **One frame a second while idle.** See `IDLE_FRAME_MS`.
 *
 * Its frame callback is what keeps the loop going while a tail is owed. Where it runs in
 * the frame does not matter: a request made by a callback after it wakes the loop for one
 * more frame by itself, and this one counts it there.
 */
export function RenderOnDemand({ store }: { readonly store: EphemerisStore }) {
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const version = useStoreVersion(store);

  useEffect(() => renderDemand.connect(() => invalidate()), [invalidate]);

  useEffect(() => useViewStore.subscribe(() => renderDemand.request()), []);

  useEffect(() => {
    renderDemand.request();
  }, [version, size]);

  useEffect(() => {
    const manager = THREE.DefaultLoadingManager;
    const previous = manager.onProgress;
    manager.onProgress = (url, loaded, total) => {
      previous?.(url, loaded, total);
      renderDemand.request();
    };
    return () => {
      manager.onProgress = previous;
    };
  }, []);

  useEffect(() => {
    // One frame, not a tail: nothing it is for needs settling. If frames are already
    // being drawn this asks for nothing more.
    const timer = setInterval(() => invalidate(), IDLE_FRAME_MS);
    return () => clearInterval(timer);
  }, [invalidate]);

  useFrame(() => {
    // Asked from inside a frame, react-three-fiber schedules exactly one more.
    if (renderDemand.frameDrawn()) {
      invalidate();
    }
  });

  return null;
}
