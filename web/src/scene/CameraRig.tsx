import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Free-rotation camera rig.
 *
 * OrbitControls keeps a fixed world "up" and clamps the polar angle, so dragging
 * past a pole stops dead and the view locks. That is right for a terrain viewer and
 * wrong here: in space there is no up, and being unable to roll over a planet's pole
 * to line up a view is exactly the discomfort that produces.
 *
 * So the rig carries its own up vector and rotates it along with the camera offset,
 * using quaternions. Drag horizontally and it yaws about the current up; drag
 * vertically and it pitches about the current right. Because up rotates too, there
 * is no pole to reach — you can tumble indefinitely in any direction.
 *
 * Zoom multiplies the distance rather than adding to it, which is what makes a range
 * from a few km to tens of AU navigable with the same wheel.
 */

export interface CameraRigProps {
  /** Distance to settle at when the focus changes, in scene units. */
  readonly framingDistance: number;
  /** Never let the camera closer than this, in scene units. */
  readonly minDistance: number;
  readonly maxDistance: number;
  /** Changing this reframes the camera. */
  readonly focusKey: string;
}

const ROTATE_SPEED = 0.005;
const ZOOM_PER_WHEEL_NOTCH = 0.0012;
/** Fraction of the remaining delta applied per frame; higher is snappier. */
const DAMPING = 0.18;

export function CameraRig({
  framingDistance,
  minDistance,
  maxDistance,
  focusKey,
}: CameraRigProps) {
  const { camera, gl } = useThree();

  // Current and target state. The target is what input writes to; the camera eases
  // toward it each frame, which is what makes dragging feel continuous.
  const offset = useRef(new THREE.Vector3(0, 0, 1));
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const targetDistance = useRef(1);
  const initialised = useRef(false);

  // Reframe on focus change: keep the viewing direction, change only the distance.
  useEffect(() => {
    if (!initialised.current) {
      offset.current.set(0.45, 0.35, 1).normalize();
      up.current.set(0, 1, 0);
      initialised.current = true;
    }
    targetDistance.current = THREE.MathUtils.clamp(framingDistance, minDistance, maxDistance);
    offset.current.normalize().multiplyScalar(targetDistance.current);
  }, [focusKey, framingDistance, minDistance, maxDistance]);

  useEffect(() => {
    const element = gl.domElement;
    let dragging = false;
    let pointerId: number | null = null;

    const onPointerDown = (event: PointerEvent): void => {
      // Primary button only; leave the rest for future context menus.
      if (event.button !== 0) {
        return;
      }
      dragging = true;
      pointerId = event.pointerId;
      element.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) {
        return;
      }

      const yaw = -event.movementX * ROTATE_SPEED;
      const pitch = -event.movementY * ROTATE_SPEED;

      // Right vector of the current view, from the current up and offset. Using the
      // live up rather than a world axis is what removes the pole.
      const right = new THREE.Vector3()
        .crossVectors(up.current, offset.current)
        .normalize();

      const rotation = new THREE.Quaternion()
        .setFromAxisAngle(up.current, yaw)
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, pitch));

      offset.current.applyQuaternion(rotation);
      // Rotating up alongside the offset is the whole trick: the frame tumbles with
      // the camera instead of fighting a fixed vertical.
      up.current.applyQuaternion(rotation).normalize();
    };

    const endDrag = (event: PointerEvent): void => {
      if (pointerId !== null && element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      dragging = false;
      pointerId = null;
      void event;
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      // Multiplicative: every notch is the same ratio, so 10 km and 10 AU feel the
      // same to navigate.
      const factor = Math.exp(event.deltaY * ZOOM_PER_WHEEL_NOTCH);
      targetDistance.current = THREE.MathUtils.clamp(
        targetDistance.current * factor,
        minDistance,
        maxDistance,
      );
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);
    element.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endDrag);
      element.removeEventListener('pointercancel', endDrag);
      element.removeEventListener('wheel', onWheel);
    };
  }, [gl, minDistance, maxDistance]);

  useFrame(() => {
    // Ease the distance; direction is applied immediately so dragging stays crisp.
    const current = offset.current.length();
    const eased = current + (targetDistance.current - current) * DAMPING;
    offset.current.setLength(eased);

    camera.position.copy(offset.current);
    camera.up.copy(up.current);
    camera.lookAt(0, 0, 0);
  });

  return null;
}
