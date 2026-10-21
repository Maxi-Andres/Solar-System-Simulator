import type { BodyDefinition, BodyId } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { satelliteBodyChip, satelliteChipLayer } from '../core/satelliteGroups.ts';
import type { Vec3 } from '../core/vec3.ts';

/**
 * The floating origin.
 *
 * Every frame, all body positions are recomputed relative to the focused body, in
 * float64 kilometres, and only then converted to scene units. The focused body sits
 * at (0,0,0) and the camera orbits that.
 *
 * Why this is not optional: Pluto is 5.9e9 km out, which is 5.9e6 scene units. A
 * float32 there has an ulp of about 0.5 units — 500 km of quantisation. Put the
 * camera near Earth's surface with absolute coordinates and the ground would visibly
 * jitter in 500 km steps. Rebasing means the numbers the GPU sees are always small
 * near the camera, and the large ones belong to objects far enough away that their
 * quantisation is far below a pixel.
 *
 * A useful consequence: switching focus costs nothing but a different subtraction,
 * so following Pluto is as precise as following Earth.
 */

/** One body's position and its distance from the camera's focus, both in km. */
export interface RebasedBody {
  readonly id: BodyId;
  /** Position relative to the focused body, in km, float64. */
  readonly positionKm: Vec3;
  /** Distance from the focused body, in km. */
  readonly distanceKm: number;
  /** Speed relative to the focused body, in km/s. */
  readonly speedKmS: number;
  /** True when this position came from Keplerian propagation. */
  readonly approximate: boolean;
}

export interface FrameSnapshot {
  readonly focus: BodyId;
  readonly jd: number;
  readonly bodies: ReadonlyMap<BodyId, RebasedBody>;
  /** True when any body in the frame fell back to propagation. */
  readonly approximate: boolean;
}

/**
 * Computes one frame's worth of rebased positions.
 *
 * Allocates a Map per frame, which at forty-two bodies is not worth optimising away;
 * when phase C brings tens of thousands of satellites, that path will want typed arrays
 * and a worker instead. Keeping this a plain function makes that swap local.
 *
 * `include`, when given, limits the frame to those bodies. Leaving one out is not only
 * cheaper: for a moon it means its data is never fetched. See `bodiesToResolve`.
 */
export function rebaseFrame(
  store: EphemerisStore,
  focus: BodyId,
  jd: number,
  include: ReadonlySet<BodyId> | null = null,
): FrameSnapshot {
  const bodies = new Map<BodyId, RebasedBody>();
  let approximate = false;

  for (const body of store.bodies) {
    if (include !== null && !include.has(body.id)) {
      continue;
    }
    const state = store.stateRelativeTo(body.id, focus, jd);
    if (state === null) {
      continue;
    }
    if (state.approximate) {
      approximate = true;
    }

    bodies.set(body.id, {
      id: body.id,
      positionKm: state.position,
      distanceKm: Math.hypot(state.position.x, state.position.y, state.position.z),
      speedKmS: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
      approximate: state.approximate,
    });
  }

  return { focus, jd, bodies, approximate };
}

/**
 * The bodies a frame has to resolve: every visible one, and whatever they hang off.
 *
 * Not simply the visible ones. A moon's orbit is drawn around its planet, so the planet
 * must be resolved even with the planets switched off; the Sun lights everything; and
 * the focus is the origin itself. Skipping the rest is not about arithmetic, which is
 * cheap -- it is that resolving a moon fetches its data, and a layer that is switched
 * off should cost nothing.
 *
 * The small moons are wanted only inside their own planet's system: with the planet,
 * one of its moons or a craft about it in focus. Their orbits are tens of millions of
 * kilometres across, so by the rule the other moons follow -- shown once the orbit is a
 * dozen pixels -- Jupiter's hundred would crowd round it from the inner Solar System,
 * and the default view would fetch four hundred files.
 */
/**
 * The Small Moons layer, among the visible kinds. Not a catalog kind -- the small moons
 * are kind 'moon' -- but the switch that adds them to the Moons layer.
 */
export const SMALL_MOON_LAYER = 'small-moon';

/**
 * True for a small moon: one of a planet's hundreds, sampled adaptively and fetched with
 * its planet's system. The named small bodies about the Sun are sampled the same way,
 * and are not small moons.
 */
export function isSmallMoon(body: BodyDefinition): boolean {
  return body.sampling !== undefined && body.parent !== null;
}

/**
 * Whether a body's layers are on: its kind's, for a small moon the Small Moons too, and for
 * an Earth satellite its chip in the Satellites layer (see satelliteGroups.ts) -- so a
 * named satellite goes with the dots of its group.
 */
export function isShown(body: BodyDefinition, visibleKinds: ReadonlySet<string>): boolean {
  return (
    visibleKinds.has(body.kind) &&
    (!isSmallMoon(body) || visibleKinds.has(SMALL_MOON_LAYER)) &&
    (body.kind !== 'satellite' || visibleKinds.has(satelliteChipLayer(satelliteBodyChip(body.id))))
  );
}

export function bodiesToResolve(
  store: EphemerisStore,
  visibleKinds: ReadonlySet<string>,
  focus: BodyId,
): Set<BodyId> {
  const wanted = new Set<BodyId>(['sun', focus, ...store.tree.ancestorsOf(focus)]);
  const system = systemOf(store, focus);
  for (const body of store.bodies) {
    if (isSmallMoon(body) && body.parent !== system && body.id !== focus) {
      continue;
    }
    if (isShown(body, visibleKinds)) {
      wanted.add(body.id);
      for (const ancestor of store.tree.ancestorsOf(body.id)) {
        wanted.add(ancestor);
      }
    }
  }
  return wanted;
}

/**
 * The planet whose system a body is in: itself for a planet, its planet for a moon or a
 * craft hung from one -- the top of its branch of the frame tree, short of the Sun.
 */
export function systemOf(store: EphemerisStore, id: BodyId): BodyId {
  let current = id;
  for (let parent = store.body(current).parent; parent !== null; parent = store.body(current).parent) {
    current = parent;
  }
  return current;
}

/**
 * Where a body's orbit line should be centred, relative to the current focus.
 *
 * An orbit ellipse is drawn in its parent's frame — for the planets, around the Sun,
 * matching how the osculating elements were requested. So the line's origin is the
 * Sun's rebased position, not the scene origin. Get this wrong and every orbit is
 * offset by the Sun's barycentric wobble, up to 1.5 million km.
 */
export function orbitCenterKm(snapshot: FrameSnapshot, parentId: BodyId): Vec3 | null {
  return snapshot.bodies.get(parentId)?.positionKm ?? null;
}
