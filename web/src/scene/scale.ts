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

/** Below this many pixels a sphere is not worth drawing; show the marker instead. */
export const MARKER_ONLY_PX = 2.5;

/** Above this many pixels the mesh carries the image on its own. */
export const MESH_ONLY_PX = 6;

/**
 * How much the marker should show, from 1 (marker only) to 0 (mesh only).
 *
 * The band between the two thresholds cross-fades, so a planet does not pop as you
 * approach it. This is exactly the transition visible in NASA Eyes: distant planets
 * are hollow circles, and they dissolve into lit spheres as the camera closes in.
 */
export function markerOpacity(pixelRadius: number): number {
  if (pixelRadius <= MARKER_ONLY_PX) {
    return 1;
  }
  if (pixelRadius >= MESH_ONLY_PX) {
    return 0;
  }
  return 1 - (pixelRadius - MARKER_ONLY_PX) / (MESH_ONLY_PX - MARKER_ONLY_PX);
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
