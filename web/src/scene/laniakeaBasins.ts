import * as THREE from 'three';

import { transformPoint } from '../core/laniakea.ts';
import { labelSurface, labelVolume } from './isosurface.ts';

/**
 * A basin of attraction's surface and field (Laniakea.tsx basinObjectsFor), as arrays: made in
 * laniakeaBasin.worker.ts, or here where there is no worker. Netting a basin and blurring its
 * field is 100 to 200 ms a basin, which in a frame held it back as long.
 */
export interface BasinParts {
  /** The surface's vertices, parsecs about the Sun. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  /** The field as bytes for a 3D texture, and where its first voxel is (isosurface.ts labelVolume). */
  readonly volume: {
    readonly data: Uint8Array;
    readonly size: readonly [number, number, number];
    readonly origin: readonly [number, number, number];
  };
}

/** What the worker is asked: one basin's label in its grid. */
export interface BasinRequest {
  readonly labels: Uint8Array;
  readonly size: readonly [number, number, number];
  readonly label: number;
  readonly voxelToScene: readonly number[];
}

/** A basin's surface (isosurface.ts) in parsecs about the Sun, its normals worked out there. */
export function basinGeometry(
  labels: Uint8Array,
  size: readonly [number, number, number],
  label: number,
  voxelToScene: readonly number[],
): THREE.BufferGeometry | null {
  const mesh = labelSurface(labels, size, label);
  if (mesh === null) return null;
  const positions = new Float32Array(mesh.positions.length);
  for (let v = 0; v < mesh.positions.length; v += 3) {
    const p = transformPoint(voxelToScene, [mesh.positions[v]!, mesh.positions[v + 1]!, mesh.positions[v + 2]!]);
    positions.set(p, v);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** A basin's surface and field; null where the grid has no such basin. */
export function basinParts({ labels, size, label, voxelToScene }: BasinRequest): BasinParts | null {
  const geometry = basinGeometry(labels, size, label, voxelToScene);
  const volume = labelVolume(labels, size, label);
  if (geometry === null || volume === null) return null;
  return {
    positions: geometry.getAttribute('position').array as Float32Array,
    normals: geometry.getAttribute('normal').array as Float32Array,
    indices: geometry.getIndex()!.array as Uint32Array,
    volume,
  };
}

/** The surface made a geometry again: the same arrays, the same attributes. */
export function basinPartsGeometry(parts: BasinParts): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(parts.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(parts.indices, 1));
  geometry.setAttribute('normal', new THREE.BufferAttribute(parts.normals, 3));
  return geometry;
}

/**
 * A basin's parts made in a worker (laniakeaBasin.worker.ts); null where the grid has no such
 * basin. With no worker, or one that fails, made here.
 */
export function basinPartsAhead(request: BasinRequest): Promise<BasinParts | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./laniakeaBasin.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(basinParts(request));
      return;
    }
    worker.onmessage = (event: MessageEvent<BasinParts | null>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (error) => {
      console.error('The basins’ worker failed; netting the basin here', error);
      worker.terminate();
      resolve(basinParts(request));
    };
    // The grid copied: the catalogue keeps its own.
    worker.postMessage(request);
  });
}
