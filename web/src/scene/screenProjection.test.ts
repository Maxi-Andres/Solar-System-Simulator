import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CAMERA_FAR_UNITS, CAMERA_NEAR_UNITS } from './logDepth.ts';
import { kmToUnits, LIGHT_YEAR_KM } from './scale.ts';
import { projectToScreen } from './screenProjection.ts';

function camera(): THREE.PerspectiveCamera {
  // The scene's own camera, looking down -z from the origin.
  const made = new THREE.PerspectiveCamera(50, 16 / 9, CAMERA_NEAR_UNITS, CAMERA_FAR_UNITS);
  made.updateMatrixWorld();
  made.updateProjectionMatrix();
  return made;
}

describe('projectToScreen', () => {
  const out = new THREE.Vector3();

  it('knows front from back at a hundred light years, where z cannot tell them apart', () => {
    const cam = camera();
    const far = kmToUnits(100 * LIGHT_YEAR_KM);
    const ahead = new THREE.Vector3(0, 0, -far);
    const behind = new THREE.Vector3(0, 0, far);

    // The trap, shown: both come out at exactly z = 1.
    expect(ahead.clone().project(cam).z).toBe(1);
    expect(behind.clone().project(cam).z).toBe(1);

    expect(projectToScreen(ahead, cam, out)).toBe(true);
    expect(projectToScreen(behind, cam, out)).toBe(false);
  });

  it('places a point where Vector3.project does', () => {
    const cam = camera();
    const point = new THREE.Vector3(3, -2, -10);
    expect(projectToScreen(point, cam, out)).toBe(true);
    const expected = point.clone().project(cam);
    expect(out.x).toBeCloseTo(expected.x, 12);
    expect(out.y).toBeCloseTo(expected.y, 12);
  });

  it('may write into the point it reads', () => {
    const cam = camera();
    const point = new THREE.Vector3(0, 0, kmToUnits(5 * LIGHT_YEAR_KM));
    expect(projectToScreen(point, cam, point)).toBe(false);
  });

  it('works off a moved and turned camera', () => {
    const cam = camera();
    cam.position.set(1e9, 0, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    expect(projectToScreen(new THREE.Vector3(0, 0, 0), cam, out)).toBe(true);
    expect(projectToScreen(new THREE.Vector3(3e9, 0, 0), cam, out)).toBe(false);
  });
});
