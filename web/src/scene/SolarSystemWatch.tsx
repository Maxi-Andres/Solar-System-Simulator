import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { levelForDistance, SUN_LADDER } from '../state/levels.ts';
import { useViewStore } from '../state/store.ts';
import { nextInSolarSystem } from './inSolarSystem.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * Keeps the store's `inSolarSystem` up to date with where the camera is (inSolarSystem.ts):
 * read every frame, written only when it changes, so nothing re-renders as the camera moves.
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
  useFrame(() => {
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
    if (sun === null) return;
    const fromSunKm = Math.hypot(
      camera.position.x * KM_PER_UNIT - sun.position.x,
      camera.position.y * KM_PER_UNIT - sun.position.y,
      camera.position.z * KM_PER_UNIT - sun.position.z,
    );
    const state = useViewStore.getState();
    const next = nextInSolarSystem(state.inSolarSystem, fromSunKm);
    if (next !== state.inSolarSystem) state.setInSolarSystem(next);
    // With the Sun in focus, the breadcrumb follows the zoom: out, the level reached is selected;
    // back in to the Sun, none is (levels.ts levelForDistance). Not for Laniakea or Virgo, whose
    // centres are not the Sun, nor for any other focus.
    const current = state.selectedLevel;
    if (focus === 'sun' && (current === null || SUN_LADDER.some((rung) => rung.level === current))) {
      const level = levelForDistance(current, fromSunKm);
      if (level !== current) state.setZoomLevel(level);
    }
  });
  return null;
}
