import * as THREE from 'three';

import { kmToUnits } from './scale.ts';

/**
 * A flat annulus for a ring system, with the UVs a radial strip texture needs.
 *
 * three.js has `RingGeometry`, and it is the wrong shape of right: its UVs are a
 * *planar* mapping, `u = (x / outerRadius + 1) / 2`, which projects the texture across
 * the ring as though it were a picture lying on a table. A ring map is not a picture:
 * it is one radial line of the ring, and every point at the same distance from the
 * planet has to sample the same column. Used with RingGeometry's own UVs, Saturn's
 * divisions would appear as straight bands across the rings instead of circles.
 *
 * So `u` here is the fraction of the way from the inner radius to the outer one, and
 * `v` is 0.5 everywhere because the texture is constant vertically.
 *
 * One radial segment is not a simplification: `u` is linear in radius and hardware
 * interpolation across the quad is linear too, so two rows of vertices reproduce the
 * mapping exactly. Adding rows would change nothing.
 */

/**
 * Angular segments around the ring.
 *
 * A polygon of N sides cuts inside its circle by `r * (1 - cos(pi / N))`. At Saturn's
 * outer ring radius of 141,880 km, 512 segments give 2.7 km of chord error -- 0.004%
 * of Saturn's own radius, so the edge reads as a circle at any zoom the app allows.
 * It costs 1026 vertices, which is nothing beside the 18,847 the orbit lines already
 * carry.
 */
export const RING_SEGMENTS = 512;

export function ringGeometry(
  innerRadiusKm: number,
  outerRadiusKm: number,
  segments = RING_SEGMENTS,
): THREE.BufferGeometry {
  const inner = kmToUnits(innerRadiusKm);
  const outer = kmToUnits(outerRadiusKm);

  const vertexCount = (segments + 1) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Two vertices per angular step: one on the inner edge, one on the outer.
    for (let edge = 0; edge < 2; edge += 1) {
      const radius = edge === 0 ? inner : outer;
      const vertex = i * 2 + edge;

      positions[vertex * 3] = cos * radius;
      positions[vertex * 3 + 1] = sin * radius;
      positions[vertex * 3 + 2] = 0;

      // The ring lies in its own xy plane, so its normal is +z. The mesh's quaternion
      // is what swings that onto the planet's pole.
      normals[vertex * 3] = 0;
      normals[vertex * 3 + 1] = 0;
      normals[vertex * 3 + 2] = 1;

      uvs[vertex * 2] = edge;
      uvs[vertex * 2 + 1] = 0.5;
    }

    if (i < segments) {
      const innerHere = i * 2;
      const outerHere = i * 2 + 1;
      const innerNext = (i + 1) * 2;
      const outerNext = (i + 1) * 2 + 1;
      // Counter-clockwise seen from +z, so the front face is the one the +z normal
      // points out of.
      indices.push(innerHere, outerHere, outerNext);
      indices.push(innerHere, outerNext, innerNext);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Radius a point on the ring sits at, from its texture coordinate.
 *
 * The inverse of the mapping the geometry builds, kept here so the calibration can be
 * checked against surveyed ring radii in a test rather than trusted.
 */
export function ringRadiusKm(u: number, innerRadiusKm: number, outerRadiusKm: number): number {
  return innerRadiusKm + u * (outerRadiusKm - innerRadiusKm);
}
