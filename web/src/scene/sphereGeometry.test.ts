import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { sphereGeometry } from './sphereGeometry.ts';

describe('sphereGeometry', () => {
  it('is THREE.SphereGeometry to the bit, array by array', () => {
    // The scene's: bodies at 64 x 32, clouds and atmospheres finer; radii from a
    // kilometre to the Sun's, in scene units, and the odd ones in between.
    for (const [radius, width, height] of [
      [6378.1366 / 1000, 64, 32],
      [696000 / 1000, 64, 32],
      [0.001, 64, 32],
      [1, 32, 16],
      [3.3962, 128, 64],
      [12345.678, 7, 5],
    ] as const) {
      const ours = sphereGeometry(radius, width, height);
      const theirs = new THREE.SphereGeometry(radius, width, height);
      for (const name of ['position', 'normal', 'uv']) {
        const a = ours.getAttribute(name);
        const b = theirs.getAttribute(name);
        expect(a.itemSize).toBe(b.itemSize);
        expect(a.array.constructor).toBe(b.array.constructor);
        expect(Array.from(a.array)).toEqual(Array.from(b.array));
      }
      expect(ours.index!.array.constructor).toBe(theirs.index!.array.constructor);
      expect(Array.from(ours.index!.array)).toEqual(Array.from(theirs.index!.array));
      ours.computeBoundingSphere();
      theirs.computeBoundingSphere();
      expect(ours.boundingSphere!.radius).toBe(theirs.boundingSphere!.radius);
    }
  });

  it('gives each sphere arrays of its own', () => {
    const a = sphereGeometry(1, 16, 8);
    const b = sphereGeometry(2, 16, 8);
    expect(a.index!.array).not.toBe(b.index!.array);
    expect(a.getAttribute('uv').array).not.toBe(b.getAttribute('uv').array);
  });
});
