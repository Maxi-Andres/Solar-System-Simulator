import type { Vec3 } from '../core/vec3.ts';

/**
 * Turning real kilometres into something a GPU can draw.
 *
 * The v1 catalog spans from Pluto's 1188 km radius to its 5.9e9 km distance: a
 * dynamic range of 5 million, against float32's ~7 significant digits. Three
 * mechanisms together make it work, and each one is doing real load-bearing work:
 *
 *  1. Floating origin. Positions are computed in float64 relative to the focused
 *     body, and only the small relative vector is handed to the GPU. Absolute
 *     coordinates never reach float32 at all.
 *  2. Logarithmic depth buffer, set on the renderer, so a near plane of a metre and
 *     a far plane past Pluto can coexist without z-fighting.
 *  3. Adaptive markers. A body smaller than a few pixels is drawn as a fixed-size
 *     marker instead of a mesh, because a sub-pixel sphere is invisible. This is the
 *     one place the render deviates from physical scale, and it deviates only below
 *     the point where physical scale stops being visible at all.
 *
 * Distances themselves are never compressed. That is the whole project.
 */

/**
 * One scene unit is 1000 km.
 *
 * The exact value barely matters — floating origin means relative error, not
 * absolute, is what counts — but this keeps familiar things in a readable range:
 * Earth's radius is 6.378 units, 1 AU is 149,598, and Pluto sits around 5.9e6.
 */
export const KM_PER_UNIT = 1000;

/**
 * Vertical field of view of the camera, degrees.
 *
 * **It was 50, and 50 is a wide-angle lens.** A perspective camera is not wrong at any
 * field of view -- nothing about the projection is incorrect -- but the field decides
 * where you end up standing when a planet fills the frame, and that is what the eye
 * reads as distortion.
 *
 * The arithmetic, since it is what settles the argument. A planet filling the frame
 * height sits at `1 / sin(fov / 2)` of its own radii from its centre, and from there you
 * can see `(1 - sin(fov / 2)) / 2` of its surface:
 *
 *   50 deg   2.37 radii   8,700 km over Earth    28.9% of the surface visible
 *   35 deg   3.33 radii   14,800 km              35.0%
 *   27 deg   4.28 radii   20,900 km              38.3%
 *   15 deg   7.66 radii   42,500 km              43.5%
 *   0        infinity     orthographic           50%
 *
 * At 50 degrees a full-frame Earth is seen from 8,700 km up, and everything past about
 * 65 degrees from the point under the camera is crushed into the rim. **That is not what
 * a photograph of a planet looks like**, and the reason is physical rather than
 * aesthetic: real planetary images are taken from far away through narrow fields, so
 * they are very nearly orthographic. Reference renders look the way they do because they
 * are standing much further back.
 *
 * 27 degrees is not a taste value either. It is the vertical field of a 50 mm lens on 35
 * mm film -- the photographic definition of a normal lens, the focal length that renders
 * perspective without wide-angle exaggeration. `2 * atan(12 / 50)`.
 *
 * Nothing needs to be kept in sync with this by hand: every place that converts between
 * angles and pixels takes the live `camera.fov`, so the marker sizes, the label
 * projection and the mesh fade all follow it.
 */
export const FOV_DEG = 27;

export function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}

export function unitsToKm(units: number): number {
  return units * KM_PER_UNIT;
}

/**
 * Converts a float64 kilometre vector into scene units.
 *
 * Returns a plain tuple rather than a THREE.Vector3 so this stays testable without
 * a renderer, and so the float32 truncation happens at exactly one point: when the
 * caller writes these numbers into an object's position.
 */
export function toSceneUnits(km: Vec3): [number, number, number] {
  return [km.x / KM_PER_UNIT, km.y / KM_PER_UNIT, km.z / KM_PER_UNIT];
}

/**
 * On-screen radius of a sphere, in pixels.
 *
 * Small-angle form: a body of radius r at distance d subtends r/d radians, and the
 * viewport maps a half-FOV of `fovRad/2` onto `height/2` pixels. Accurate to well
 * under a pixel for anything not filling the screen, and it degrades gracefully when
 * it is — the caller only cares whether the answer crosses a threshold of a few
 * pixels.
 *
 * `fovDeg` is the vertical field of view, matching three.js's PerspectiveCamera.
 */
export function angularRadiusPixels(
  radiusKm: number,
  distanceKm: number,
  viewportHeightPx: number,
  fovDeg: number,
): number {
  if (distanceKm <= 0) {
    return Infinity;
  }
  const halfFovRad = (fovDeg * Math.PI) / 360;
  return (radiusKm / distanceKm) * (viewportHeightPx / (2 * Math.tan(halfFovRad)));
}

/**
 * Marker and mesh visibility.
 *
 * These two do NOT hand off to each other — they overlap, and that is the point. An
 * earlier version faded the sphere out at 2.5 px and swapped in the marker, which
 * popped twice over: the sphere vanished while it was still a 5 px wide disc, and
 * the 11 px marker that replaced it was more than double its size.
 *
 * Instead the hollow marker fades in *around* the shrinking sphere, the way NASA
 * Eyes draws it. A distant planet is a dot inside a ring; approach and the dot grows
 * until it fills the ring, which then fades away. The sphere itself is only faded
 * out once it drops below a pixel, where it has nothing left to show and would
 * otherwise shimmer against the antialiasing.
 *
 * Nothing ever appears or disappears abruptly, at any distance.
 */

/** Above this radius the sphere is larger than the ring, so the ring is gone. */
export const MARKER_FADE_OUT_PX = 9;

/** Below this radius the ring is fully drawn, comfortably enclosing the sphere. */
export const MARKER_FULL_PX = 4;

/** Below this radius the sphere starts fading; it is nearly sub-pixel already. */
export const MESH_FADE_START_PX = 1.5;

/** Below this radius the sphere is gone, having become genuinely invisible. */
export const MESH_FADE_END_PX = 0.4;

/** Linear ramp from 1 at `full` to 0 at `none`, clamped outside. */
function ramp(value: number, full: number, none: number): number {
  if (full < none) {
    if (value <= full) return 1;
    if (value >= none) return 0;
    return 1 - (value - full) / (none - full);
  }
  if (value >= full) return 1;
  if (value <= none) return 0;
  return (value - none) / (full - none);
}

/**
 * How visible the hollow marker ring should be, from 1 to 0.
 *
 * Full below MARKER_FULL_PX, gone above MARKER_FADE_OUT_PX.
 */
export function markerOpacity(pixelRadius: number): number {
  return ramp(pixelRadius, MARKER_FULL_PX, MARKER_FADE_OUT_PX);
}

/**
 * How visible the real sphere should be, from 1 to 0.
 *
 * Stays fully drawn until it is nearly sub-pixel, so it shrinks smoothly rather than
 * cutting out while still clearly visible.
 */
export function meshOpacity(pixelRadius: number): number {
  return ramp(pixelRadius, MESH_FADE_START_PX, MESH_FADE_END_PX);
}

/**
 * World-space size that renders as a fixed pixel size at a given distance.
 *
 * The inverse of `angularRadiusPixels`, used to keep markers the same size on screen
 * whether the body is at 1 AU or 40.
 */
export function pixelsToWorldSize(
  pixels: number,
  distanceUnits: number,
  viewportHeightPx: number,
  fovDeg: number,
): number {
  const halfFovRad = (fovDeg * Math.PI) / 360;
  return (pixels / viewportHeightPx) * 2 * distanceUnits * Math.tan(halfFovRad);
}

/**
 * When the focused body's own orbit stops being drawn.
 *
 * Expressed as the body's on-screen radius against the viewport's half-height, so it is
 * the same rule for Pluto and for Jupiter: **1 is a body whose disc exactly fills the
 * frame height.**
 *
 * The rule, rather than the numbers: *an orbit is context while you can see the body it
 * belongs to.* Once the body is larger than the view, the visible piece of its orbit is a
 * straight line crossing the picture — it has stopped saying where the body goes and
 * become something drawn over it. Other bodies' orbits are untouched, because those are
 * still telling you where things are relative to the one you are at.
 *
 * **Both ends were measured off screenshots, twice, and both times they were too late.**
 * The first version held full strength until the body filled the frame and then took the
 * line away over a short approach, which reads as it being switched off rather than as it
 * receding. The second still had the orbit at full strength in a shot where it was plainly
 * in the way: the body covered 39% of the frame height there, so that is the number the
 * far end is set against.
 *
 * Then the pair moved out twice more on the same report — right in character, still too
 * close — settling where **the orbit is gone by twenty-five of the body's own radii**.
 * Both ends moved together each time, rather than only the far one: scaling the pair moves
 * where the fade happens and keeps its shape, where moving one end alone would have made
 * it steeper as well as earlier.
 *
 * Distance is how it was asked for and apparent size is how it is stored, because
 * converting one into the other needs a field of view and this has to survive someone
 * changing that. Twenty-five radii at 27 degrees is a body covering a sixth of the frame
 * height, and it is that ratio which stays true.
 *
 * The two ends in plain terms: **fully drawn while the body is under a twentieth of the
 * frame's height, gone by the time it is a sixth of it** — untouched beyond about ninety
 * of the body's own radii, gone inside twenty-five.
 *
 * The consequence worth stating, because it reverses an earlier decision: at the 8 radii
 * `CameraRig` settles at, a body covers about half the frame and its own orbit is
 * therefore **already gone**. Selecting a body no longer shows you its orbit. That is the
 * point rather than a side effect — the moment you are close enough to look at something,
 * its own orbit has stopped being information about it and become a line drawn over it.
 * Every other orbit is still there, and those are what say where you are.
 */
export const FOCUS_ORBIT_FULL = 0.045;

/**
 * Gone by here: a sixth of the frame height, which is twenty-five radii out.
 *
 * The last digit is not spare precision. A body at exactly twenty-five of its own radii
 * covers 0.16663 of the frame at a 27 degree field, so rounding this to 0.167 would leave
 * a sliver of orbit still drawn at the distance the threshold was asked for -- and the
 * test that checks it would fail for a reason that looks like arithmetic noise.
 */
export const FOCUS_ORBIT_GONE = 0.1666;

/**
 * How visible the focused body's own orbit should be, 1 to 0.
 *
 * `pixelRadius` is the body's on-screen radius from `angularRadiusPixels`.
 */
export function focusOrbitOpacity(pixelRadius: number, viewportHeightPx: number): number {
  if (viewportHeightPx <= 0) {
    return 1;
  }
  return ramp(pixelRadius / (viewportHeightPx / 2), FOCUS_ORBIT_FULL, FOCUS_ORBIT_GONE);
}
