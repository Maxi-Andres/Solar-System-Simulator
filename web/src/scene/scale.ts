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
 * Rotation angle of a body about its own axis, in radians.
 *
 * Sidereal rotation, measured from J2000. A negative period means retrograde
 * rotation, which the sign of the result carries through: Venus and Uranus really do
 * turn the other way, and the catalog records that as a negative period.
 *
 * This is not aligned to a real prime meridian — that needs the IAU rotational
 * elements (W0 and Wdot per body), which is a phase A concern once textures make
 * longitude visible. Until then the rate and direction are right and the zero point
 * is arbitrary.
 */
export function rotationAngle(jd: number, j2000Jd: number, rotationPeriodHours: number): number {
  if (rotationPeriodHours === 0) {
    return 0;
  }
  const periodDays = rotationPeriodHours / 24;
  return ((jd - j2000Jd) / periodDays) * 2 * Math.PI;
}
