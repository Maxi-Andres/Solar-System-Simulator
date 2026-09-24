import type { BodyDefinition, BodyId } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { Vec3 } from '../core/vec3.ts';
import { rebaseFrame, type FrameSnapshot } from './floatingOrigin.ts';
import { angularRadiusPixels, kmToUnits, satelliteOpacity } from './scale.ts';

/**
 * How much of a moon to show this frame, 1 to 0. Always 1 for a body with no parent.
 *
 * One function for the marker, the label and the orbit line, so the three can never
 * disagree about whether a moon is there. See `satelliteOpacity` for the rule itself.
 *
 * `cameraUnits` is the camera position in scene units, which after the floating origin
 * is relative to the focused body -- the same frame the snapshot's positions are in.
 */
export function satelliteVisibility(
  store: EphemerisStore,
  snapshot: FrameSnapshot,
  body: BodyDefinition,
  cameraUnits: Vec3,
  viewportHeightPx: number,
  fovDeg: number,
): number {
  if (body.parent === null) {
    return 1;
  }
  const parent = snapshot.bodies.get(body.parent);
  if (parent === undefined) {
    return 0;
  }

  // The osculating semi-major axis is the orbit's size to well under a percent for
  // every moon here, which is far finer than a fade needs. Without elements, the
  // moon's current distance from its planet stands in.
  const own = snapshot.bodies.get(body.id);
  const orbitKm =
    store.elementsFor(body.id)?.semiMajorAxisKm ??
    (own === undefined
      ? 0
      : Math.hypot(
          own.positionKm.x - parent.positionKm.x,
          own.positionKm.y - parent.positionKm.y,
          own.positionKm.z - parent.positionKm.z,
        ));

  const cameraToParentKm =
    Math.hypot(
      kmToUnits(parent.positionKm.x) - cameraUnits.x,
      kmToUnits(parent.positionKm.y) - cameraUnits.y,
      kmToUnits(parent.positionKm.z) - cameraUnits.z,
    ) * 1000;

  return satelliteOpacity(angularRadiusPixels(orbitKm, cameraToParentKm, viewportHeightPx, fovDeg));
}

/**
 * One frame's rebased positions, resolving a moon only once it can be seen.
 *
 * Two passes. Everything that is not a moon is resolved first; that is enough to say,
 * from each moon's orbit size and its planet's distance, which moons are showing at all
 * -- and only those are then resolved. The distinction matters because resolving a
 * moon fetches its data: from the default view of the whole system not one moon is
 * visible, and without this the first frame would ask for twenty chunks, about a
 * megabyte, to draw nothing.
 *
 * The focus and whatever it hangs off are always resolved, since they are the origin.
 */
export function rebaseVisibleFrame(
  store: EphemerisStore,
  focus: BodyId,
  jd: number,
  wanted: ReadonlySet<BodyId>,
  cameraUnits: Vec3,
  viewportHeightPx: number,
  fovDeg: number,
): FrameSnapshot {
  const always = new Set<BodyId>([focus, ...store.tree.ancestorsOf(focus)]);
  const primaries = new Set<BodyId>();
  const satellites: BodyDefinition[] = [];
  for (const id of wanted) {
    const body = store.body(id);
    if (body.parent === null || always.has(id)) {
      primaries.add(id);
    } else {
      satellites.push(body);
    }
  }

  const first = rebaseFrame(store, focus, jd, primaries);
  const shown = new Set<BodyId>();
  for (const body of satellites) {
    if (satelliteVisibility(store, first, body, cameraUnits, viewportHeightPx, fovDeg) > 0) {
      shown.add(body.id);
    }
  }
  if (shown.size === 0) {
    return first;
  }

  const second = rebaseFrame(store, focus, jd, shown);
  const bodies = new Map(first.bodies);
  for (const [id, rebased] of second.bodies) {
    bodies.set(id, rebased);
  }
  return { ...first, bodies, approximate: first.approximate || second.approximate };
}
