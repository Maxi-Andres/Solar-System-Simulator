import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { ladderLevel, type Rung } from '../state/levels.ts';
import { useViewStore } from '../state/store.ts';
import { focusLadder, onLadder } from './focusLadder.ts';
import { nextInSolarSystem } from './inSolarSystem.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * Keeps the store's `inSolarSystem` up to date with where the camera is (inSolarSystem.ts):
 * read every frame, written only when it changes, so nothing re-renders as the camera moves.
 *
 * And the breadcrumb following the zoom, from whatever is in focus: out, the level reached is
 * selected; back in to the focus, none is (focusLadder.ts) -- the Sun's Solar System, Solar
 * Neighbourhood and Milky Way, Alpha Centauri's own system before them, a galaxy's Local Group.
 */
export function SolarSystemWatch({
  store,
  clock,
  focus,
}: {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
}) {
  const { camera } = useThree();
  // The focus's ladder, made when the focus changes or a body arrives (a galaxy's catalogue, its
  // region with it), not every frame.
  const ladder = useRef<{ focus: BodyId; version: number; rungs: readonly Rung[] } | null>(null);
  useFrame(() => {
    const state = useViewStore.getState();
    const sun = store.sunFromFocus(focus, clock.tdbJulianDay);
    if (sun !== null) {
      const fromSunKm = Math.hypot(
        camera.position.x * KM_PER_UNIT - sun.position.x,
        camera.position.y * KM_PER_UNIT - sun.position.y,
        camera.position.z * KM_PER_UNIT - sun.position.z,
      );
      const next = nextInSolarSystem(state.inSolarSystem, fromSunKm);
      if (next !== state.inSolarSystem) state.setInSolarSystem(next);
    }
    // The camera stands about the focus it was rendered for; while the store has already moved
    // on to another, that distance is the old focus's, and a level from it would outlive the
    // change -- the Sun's Local Volume carried over to Earth, kept there at any zoom.
    if (state.focus !== focus) return;
    if (ladder.current === null || ladder.current.focus !== focus || ladder.current.version !== store.version) {
      ladder.current = { focus, version: store.version, rungs: focusLadder(store, focus) };
    }
    const rungs = ladder.current.rungs;
    // A level not on this focus's ladder was picked by hand -- Laniakea, the Virgo Cluster -- and
    // is left alone.
    const current = state.selectedLevel;
    if (current !== null && !onLadder(rungs, current)) return;
    const level = ladderLevel(rungs, current, camera.position.length() * KM_PER_UNIT);
    if (level !== current) state.setZoomLevel(level);
  });
  return null;
}
