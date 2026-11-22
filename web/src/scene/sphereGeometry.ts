import * as THREE from 'three';

/**
 * THREE.SphereGeometry's sphere, the same to the bit, built without its cost.
 *
 * The scene's mount built some eighty-five 64-segment spheres, one per body drawn as one --
 * 38 ms of the task before the first frame, measured in production on 2026-11-22. Nearly all
 * of it was not the sphere but the way it is put together: four plain arrays grown a push at a
 * time, then copied into typed arrays, and a cosine and sine per vertex that are the same for
 * every sphere of those segments. Here the angles' cosines and sines are worked out once per
 * segment count and kept, the vertices written straight into typed arrays, and the indices and
 * texture coordinates -- which do not depend on the radius -- copied from a kept set.
 *
 * Every number is the one three.js computes, by the same operations in the same order: the
 * same cosine of the same angle, the ring's radius from the same square root, the normal
 * normalised as Vector3.normalize does (times one over the length). sphereGeometry.test.ts
 * holds it to THREE.SphereGeometry array by array. Only the full sphere, as every call here
 * makes it: no partial sweeps.
 */

interface SphereTemplate {
  /** cos and sin of each column's phi, and cos of each row's theta. */
  readonly cosPhi: Float64Array;
  readonly sinPhi: Float64Array;
  readonly cosTheta: Float64Array;
  readonly uvs: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

const templates = new Map<string, SphereTemplate>();

function template(widthSegments: number, heightSegments: number): SphereTemplate {
  const key = `${widthSegments}x${heightSegments}`;
  const kept = templates.get(key);
  if (kept !== undefined) {
    return kept;
  }
  // SphereGeometry's defaults: a whole turn in phi from 0, theta from 0 to pi.
  const phiStart = 0;
  const phiLength = Math.PI * 2;
  const thetaStart = 0;
  const thetaLength = Math.PI;
  const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);

  const cosPhi = new Float64Array(widthSegments + 1);
  const sinPhi = new Float64Array(widthSegments + 1);
  for (let ix = 0; ix <= widthSegments; ix += 1) {
    const u = ix / widthSegments;
    const phi = phiStart + u * phiLength;
    cosPhi[ix] = Math.cos(phi);
    sinPhi[ix] = Math.sin(phi);
  }
  const cosTheta = new Float64Array(heightSegments + 1);
  const uvs = new Float32Array((widthSegments + 1) * (heightSegments + 1) * 2);
  let k = 0;
  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const v = iy / heightSegments;
    const theta = thetaStart + v * thetaLength;
    cosTheta[iy] = Math.cos(theta);
    // The poles' special case, as three.js has it.
    let uOffset = 0;
    if (iy === 0 && thetaStart === 0) {
      uOffset = 0.5 / widthSegments;
    } else if (iy === heightSegments && thetaEnd === Math.PI) {
      uOffset = -0.5 / widthSegments;
    }
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const u = ix / widthSegments;
      uvs[k++] = u + uOffset;
      uvs[k++] = 1 - v;
    }
  }

  const row = widthSegments + 1;
  const list: number[] = [];
  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * row + ix + 1;
      const b = iy * row + ix;
      const c = (iy + 1) * row + ix;
      const d = (iy + 1) * row + ix + 1;
      if (iy !== 0 || thetaStart > 0) list.push(a, b, d);
      if (iy !== heightSegments - 1 || thetaEnd < Math.PI) list.push(b, c, d);
    }
  }
  // The index type three.js picks for the same list (BufferGeometry.setIndex).
  const vertexCount = row * (heightSegments + 1);
  const indices = vertexCount - 1 >= 65535 ? new Uint32Array(list) : new Uint16Array(list);

  const made = { cosPhi, sinPhi, cosTheta, uvs, indices };
  templates.set(key, made);
  return made;
}

/** A sphere of `radius`, as `new THREE.SphereGeometry(radius, widthSegments, heightSegments)`. */
export function sphereGeometry(radius: number, widthSegments = 32, heightSegments = 16): THREE.BufferGeometry {
  const width = Math.max(3, Math.floor(widthSegments));
  const height = Math.max(2, Math.floor(heightSegments));
  const { cosPhi, sinPhi, cosTheta, uvs, indices } = template(width, height);
  const count = (width + 1) * (height + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  let k = 0;
  for (let iy = 0; iy <= height; iy += 1) {
    const y = radius * cosTheta[iy]!;
    const ringRadius = Math.sqrt(radius * radius - y * y);
    for (let ix = 0; ix <= width; ix += 1) {
      const x = -ringRadius * cosPhi[ix]!;
      const z = ringRadius * sinPhi[ix]!;
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      // Vector3.normalize: divideScalar(length || 1), which is times one over it.
      const scale = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      normals[k] = x * scale;
      normals[k + 1] = y * scale;
      normals[k + 2] = z * scale;
      k += 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs.slice(), 2));
  return geometry;
}
