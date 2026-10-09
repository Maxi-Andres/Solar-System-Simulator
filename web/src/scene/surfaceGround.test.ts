import { getBody } from '@sss/tools/catalog';
import type { SurfaceTrack } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { KM_PER_UNIT } from './scale.ts';
import {
  meshFramePointKm,
  PATCH_HALF_WIDTH_DEG,
  PATCH_SEGMENTS,
  patchGeometry,
  SurfaceGround,
  traversePoints,
} from './surfaceGround.ts';

const mars = getBody('mars');
const LAT = -4.82513971;
const LON = 137.3888471;

/** How far a mesh-frame point is outside the ellipsoid, km. */
function aboveEllipsoidKm(point: THREE.Vector3): number {
  const a = mars.radiusEquatorialKm;
  const c = mars.radiusPolarKm;
  const scale = Math.sqrt((point.x ** 2 + point.z ** 2) / (a * a) + (point.y * point.y) / (c * c));
  return point.length() * (1 - 1 / scale);
}

describe('the ground patch', () => {
  const geometry = patchGeometry(mars, LAT, LON, 180);
  const positions = geometry.getAttribute('position');
  const centre = meshFramePointKm(mars, LAT, LON, 180);
  const vertex = (k: number) =>
    new THREE.Vector3()
      .fromBufferAttribute(positions, k)
      .multiplyScalar(KM_PER_UNIT)
      .add(centre);

  it('is centred on the craft, at the origin', () => {
    const middle = (PATCH_SEGMENTS / 2) * (PATCH_SEGMENTS + 1) + PATCH_SEGMENTS / 2;
    expect(new THREE.Vector3().fromBufferAttribute(positions, middle).length()).toBeLessThan(1e-9);
  });

  it('lies on the ellipsoid at every vertex, to the float32 rounding of its offsets', () => {
    let worst = 0;
    for (let k = 0; k < positions.count; k += 1) {
      worst = Math.max(worst, Math.abs(aboveEllipsoidKm(vertex(k))));
    }
    // Offsets of up to 84 km, kept to float32: a few millimetres.
    expect(worst).toBeLessThan(2e-5);
  });

  it('spans two degrees, and its faces sag by centimetres', () => {
    const corner = vertex(0);
    const opposite = vertex(positions.count - 1);
    expect(corner.distanceTo(opposite)).toBeGreaterThan(2 * 59 * Math.SQRT2 * 0.98);
    const sideKm = corner.distanceTo(vertex(1));
    // A chord of a 3,390 km circle sags by its length squared over 8 R.
    expect((sideKm * sideKm) / (8 * mars.radiusPolarKm)).toBeLessThan(0.0001);
    expect((2 * PATCH_HALF_WIDTH_DEG) / PATCH_SEGMENTS).toBeCloseTo(2 / 96, 12);
  });

  it('reads the map where the sphere does', () => {
    // The sphere lays u = 0 at the map's first column and runs east; v from the south.
    const uvs = geometry.getAttribute('uv');
    const middle = (PATCH_SEGMENTS / 2) * (PATCH_SEGMENTS + 1) + PATCH_SEGMENTS / 2;
    expect(uvs.getX(middle)).toBeCloseTo((LON - 180 + 360) / 360, 6);
    expect(uvs.getY(middle)).toBeCloseTo((LAT + 90) / 180, 6);
    // And it agrees with three's own sphere, vertex for vertex, where the two meet.
    const sphere = new THREE.SphereGeometry(1, 64, 32);
    const k = 20 * 65 + 33; // a vertex of the sphere: row 20 from the north, column 33
    const lat = 90 - (20 / 32) * 180;
    const lon = 180 + (33 / 64) * 360;
    const direction = meshFramePointKm(mars, lat, lon, 180).normalize();
    const sphereVertex = new THREE.Vector3().fromBufferAttribute(sphere.getAttribute('position'), k);
    expect(direction.distanceTo(sphereVertex)).toBeLessThan(0.01);
  });

  it('faces outward', () => {
    // The first triangle's normal, from its winding, against the ellipsoid's up.
    const index = geometry.getIndex()!;
    const [a, b, c] = [0, 1, 2].map((i) => vertex(index.getX(i)));
    const normal = new THREE.Vector3().subVectors(b!, a!).cross(new THREE.Vector3().subVectors(c!, a!));
    expect(normal.dot(a!)).toBeGreaterThan(0);
  });
});

describe('the traverse', () => {
  const track: SurfaceTrack = {
    id: 'rover',
    host: 'mars',
    count: 3,
    t: [0, 1, 2],
    latitudeDeg: [-4.5895, -4.59, -4.6],
    longitudeDeg: [137.4416, 137.4416, 137.45],
    headingDeg: [null, 90, 180],
    sol: [0, 3, 16],
  };

  it('runs from touchdown to the craft, which is at the origin', () => {
    const points = traversePoints(mars, track, 2, 2, 180);
    const last = points.length - 3;
    expect(Math.hypot(points[last]!, points[last + 1]!, points[last + 2]!)).toBeLessThan(1e-12);
    const first = new THREE.Vector3(points[0], points[1], points[2]).multiplyScalar(KM_PER_UNIT);
    const expected = meshFramePointKm(mars, -4.5895, 137.4416, 180).sub(
      meshFramePointKm(mars, -4.6, 137.45, 180),
    );
    expect(first.distanceTo(expected)).toBeLessThan(1e-6);
  });

  it('is cut into pieces of at most 200 m, so it follows the ground', () => {
    const points = traversePoints(mars, track, 2, 2, 180);
    for (let k = 3; k < points.length; k += 3) {
      const step = Math.hypot(
        points[k]! - points[k - 3]!,
        points[k + 1]! - points[k - 2]!,
        points[k + 2]! - points[k - 1]!,
      );
      expect(step * KM_PER_UNIT).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it('ends at the stop the craft is at, not the last one there is', () => {
    expect(traversePoints(mars, track, 0, 0, 180)).toHaveLength(3);
  });
});

describe('SurfaceGround', () => {
  it('rebuilds only when the craft moves on or the map changes', () => {
    const track: SurfaceTrack = {
      id: 'rover',
      host: 'mars',
      count: 2,
      t: [0, 1],
      latitudeDeg: [LAT, LAT + 0.001],
      longitudeDeg: [LON, LON],
      headingDeg: [null, null],
      sol: [0, 1],
    };
    const ground = new SurfaceGround(mars, track, new THREE.MeshBasicMaterial());
    const patch = ground.object.children[0] as THREE.Mesh;
    ground.update(0, 180, true, true, 1);
    const first = patch.geometry;
    ground.update(0, 180, false, true, 0.5);
    expect(patch.geometry).toBe(first);
    expect(patch.visible).toBe(false);
    ground.update(1, 180, true, true, 1);
    expect(patch.geometry).not.toBe(first);
  });
});
