import type { BodyDefinition, BodyId } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { Vec3 } from '../core/vec3.ts';
import { rebaseFrame, type FrameSnapshot } from './floatingOrigin.ts';
import { isLandingSite, landingSiteVisibility } from '../core/landingSites.ts';
import { angularRadiusPixels, kmToUnits, satelliteOpacity, unitsToKm } from './scale.ts';

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

  // A landing site has a rule of its own: the ground it stands on large, and that side of it
  // turned to the camera.
  if (isLandingSite(body.id)) {
    const own = snapshot.bodies.get(body.id);
    if (own === undefined) {
      return 0;
    }
    const host = store.body(body.parent);
    const cameraKm: Vec3 = { x: unitsToKm(cameraUnits.x), y: unitsToKm(cameraUnits.y), z: unitsToKm(cameraUnits.z) };
    return landingSiteVisibility(
      parent.positionKm,
      own.positionKm,
      host.radiusEquatorialKm,
      cameraKm,
      viewportHeightPx,
      fovDeg,
    );
  }

  // The osculating semi-major axis is the orbit's size to well under a percent for
  // every moon here, which is far finer than a fade needs. Without elements, the
  // moon's current distance from its planet stands in -- and for a craft not placed yet,
  // the furthest it gets from its planet in the chunk it would be placed with (see
  // EphemerisStore.reachKm): if the craft would be hidden even there, it is hidden.
  const own = snapshot.bodies.get(body.id);
  const orbitKm =
    store.elementsFor(body.id)?.semiMajorAxisKm ??
    (own === undefined
      ? (store.reachKm(body.id, snapshot.jd) ?? 0)
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
 * This frame's snapshot, handed from the scene to the labels.
 *
 * Both used to call `rebaseVisibleFrame` themselves, with the same arguments in the same
 * frame -- the same instant, the same camera, which CameraRig has already moved by then,
 * and the same set of wanted bodies -- and so worked out every position twice. Now the
 * scene, whose frame runs first, leaves its snapshot here and the labels take it.
 *
 * Taken, not read: the labels clear it, so a frame in which the scene did not run finds
 * nothing rather than last frame's positions, and works them out itself as before. The
 * asteroid belt, whose frame runs between the two, reads the Sun's position from it and
 * leaves it where it is (see AsteroidBelt).
 */
export interface SharedFrame {
  snapshot: FrameSnapshot | null;
}

/**
 * One frame's rebased positions, resolving a moon only once it can be seen.
 *
 * Everything that is not a moon is resolved first; that is enough to say, from each
 * moon's orbit size and its planet's distance, which moons are showing at all -- and only
 * those are then resolved, and after them whatever circles them. The distinction matters
 * because resolving a moon fetches its data: from the default view of the whole system
 * not one moon is visible, and without this the first frame would ask for twenty chunks,
 * about a megabyte, to draw nothing. A craft about a planet is a moon here when its reach
 * is published (ChunkInfo.reachKm): the orbiters of Mars and the Moon were 1.9 MB of the
 * default view's chunks on 2026-11-21, every one hidden on its planet.
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
    // A satellite with no elements -- JWST, which hangs off Earth -- has no orbit size to
    // judge by until it has a position, so it is resolved up front like a planet. Its
    // current distance from its parent then stands in for the orbit. Not a craft whose
    // reach is published with its chunks (ChunkInfo.reachKm): that bounds its orbit
    // before anything is fetched, so it is judged like a moon -- and the orbiters of Mars
    // and the Moon, hidden on their planets from the default view, fetch nothing for it.
    if (
      body.parent === null ||
      always.has(id) ||
      (store.elementsFor(id) === null && store.reachKm(id, jd) === null)
    ) {
      primaries.add(id);
    } else {
      satellites.push(body);
    }
  }

  // Then the satellites, a level of the tree at a time: one about a moon -- LRO, whose
  // Moon is itself a satellite -- is judged once its parent has been placed. Each that is
  // hidden, or whose parent is, is not resolved at all.
  let frame = rebaseFrame(store, focus, jd, primaries);
  let waiting = satellites;
  while (waiting.length > 0) {
    const shown = new Set<BodyId>();
    const later: BodyDefinition[] = [];
    for (const body of waiting) {
      if (!frame.bodies.has(body.parent!)) {
        later.push(body);
      } else if (satelliteVisibility(store, frame, body, cameraUnits, viewportHeightPx, fovDeg) > 0) {
        shown.add(body.id);
      }
    }
    if (shown.size === 0) {
      break;
    }
    const next = rebaseFrame(store, focus, jd, shown);
    const bodies = new Map(frame.bodies);
    for (const [id, rebased] of next.bodies) {
      bodies.set(id, rebased);
    }
    frame = { ...frame, bodies, approximate: frame.approximate || next.approximate };
    waiting = later;
  }
  return frame;
}
