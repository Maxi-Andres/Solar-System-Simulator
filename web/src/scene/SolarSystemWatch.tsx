import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { inAlphaCen } from '../core/alphaCenBodies.ts';
import { planetarySystemOf, systemFramingKm } from '../core/planetarySystems.ts';
import { STAR_FRAMING_RADIUS_KM } from '../core/starBodies.ts';
import { alphaCenLadder, ladderLevel, levelForDistance, sunLadder, systemLadder, type Rung } from '../state/levels.ts';
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
    const sun = store.sunFromFocus(focus, clock.tdbJulianDay);
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
    if (focus === 'sun' && (current === null || sunLadder().some((rung) => rung.level === current))) {
      const level = levelForDistance(current, fromSunKm);
      if (level !== current) state.setZoomLevel(level);
    } else if (current === null || current === 'alpha-centauri' || current === 'planetary-system') {
      // Every other star system the same, from any of its stars or what goes round them -- a
      // planet, a fictional moon at Alpha Centauri A: zoomed out past its scale the view is the
      // system's, its panel and its description with it; back in, the body's again (levels.ts
      // systemLadder). The camera stands about the focus, so its distance from it is the zoom.
      // A level the user picked themselves is any other, and is left alone.
      const ladder = systemLadderOf(store, focus);
      if (ladder !== null) {
        const level = ladderLevel(ladder, current, camera.position.length() * KM_PER_UNIT);
        if (level !== current) state.setZoomLevel(level);
      }
    }
  });
  return null;
}

/**
 * The ladder of the star system `focus` is in: Alpha Centauri's, or its planetary system's about
 * its star -- framed as a body from eight of the star's radii (the Sun's where none is measured,
 * starBodies.ts) and as a system from where its breadcrumb entry frames it (planetarySystems.ts
 * systemFramingKm); null for a body of no such system.
 */
function systemLadderOf(store: EphemerisStore, focus: BodyId): readonly Rung[] | null {
  if (inAlphaCen(store, focus)) return alphaCenLadder();
  const system = planetarySystemOf(focus);
  if (system === null) return null;
  const starRadiusKm = system.hostRadiusSun === null ? STAR_FRAMING_RADIUS_KM : system.hostRadiusSun * 695_700;
  return systemLadder('planetary-system', starRadiusKm, systemFramingKm(system));
}
