import type * as THREE from 'three';

/**
 * A point onto the screen, and whether it is in front of the camera at all.
 *
 * `Vector3.project` gives normalised device coordinates, and the usual test for "behind
 * the camera" is the z it returns falling outside [-1, 1]. **With this scene's planes
 * that test stops working a couple of light years out.** The near plane is a metre and
 * the far one 1e14 units (logDepth.ts), so three's projection term is exactly 1 and z
 * comes out as
 *
 *   in front, at distance d:   1 - 2 near / d
 *   behind, at distance d:     1 + 2 near / d
 *
 * and once 2 near / d is under float64's half-step at 1, 1.1e-16 -- d past 1.8e10
 * units, 1.9 ly -- both are exactly 1. A strict `z < 1` then hid things in front of the
 * camera, and `z <= 1` showed things behind it, mirrored through the middle of the
 * screen. Near the edge the rounding comes and goes from frame to frame: that was the
 * distance rings' names blinking on and off as the camera pulled out (2026-10-28).
 *
 * So the side is read where it is not rounded away: the point's depth in the camera's
 * own frame, which is negative in front of it.
 */
export function projectToScreen(
  point: THREE.Vector3,
  camera: THREE.Camera,
  out: THREE.Vector3,
): boolean {
  const m = camera.matrixWorldInverse.elements;
  const depth = m[2]! * point.x + m[6]! * point.y + m[10]! * point.z + m[14]!;
  out.copy(point).project(camera);
  return depth < 0;
}
