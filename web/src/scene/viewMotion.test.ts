import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { STILL_FRAMES, ViewMotion } from './viewMotion.ts';

/** A camera at `distance` from the origin looking at it, its matrices worked out. */
function camera(distance: number, yawRad = 0): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 16 / 9, 1, 1e12);
  c.position.set(Math.sin(yawRad) * distance, 0, Math.cos(yawRad) * distance);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}

describe('whether the camera is moving', () => {
  it('moves on its first frame, and is still once it has held still for STILL_FRAMES', () => {
    const motion = new ViewMotion();
    const c = camera(1e9);
    expect(motion.moved(c)).toBe(true);
    for (let i = 1; i < STILL_FRAMES; i += 1) expect(motion.moved(c)).toBe(true);
    expect(motion.moved(c)).toBe(false);
    expect(motion.moved(c)).toBe(false);
  });

  it('counts the frames held still, from nought on a move', () => {
    const motion = new ViewMotion();
    const c = camera(1e9);
    motion.moved(c);
    expect(motion.stillFrames).toBe(0);
    motion.moved(c);
    motion.moved(c);
    expect(motion.stillFrames).toBe(2);
    motion.moved(camera(1e9, 0.01));
    expect(motion.stillFrames).toBe(0);
  });

  it('counts a frame in a drag that did not move as moving, not as a still frame', () => {
    const motion = new ViewMotion();
    for (let i = 0; i < STILL_FRAMES + 1; i += 1) motion.moved(camera(1e9));
    expect(motion.moved(camera(1e9, 0.01))).toBe(true);
    // The pointer missed a frame: the camera where it was.
    expect(motion.moved(camera(1e9, 0.01))).toBe(true);
    expect(motion.moved(camera(1e9, 0.02))).toBe(true);
  });

  it('ignores what no pixel would show: a turn of a billionth, a move of a billionth of the distance', () => {
    const motion = new ViewMotion();
    for (let i = 0; i < STILL_FRAMES + 1; i += 1) motion.moved(camera(1e9));
    expect(motion.moved(camera(1e9, 1e-9))).toBe(false);
    expect(motion.moved(camera(1e9 + 1, 1e-9))).toBe(false);
    expect(motion.moved(camera(1e9 * 1.0001, 1e-9))).toBe(true);
  });

  it('sees a change of the projection: a zoom of the field of view', () => {
    const motion = new ViewMotion();
    const c = camera(1e9);
    for (let i = 0; i < STILL_FRAMES + 1; i += 1) motion.moved(c);
    c.fov = 49;
    c.updateProjectionMatrix();
    expect(motion.moved(c)).toBe(true);
  });
});
