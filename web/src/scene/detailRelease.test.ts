import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { craftModelUsers, disposeObject, loadCraftModel, releaseCraftModel } from './craftModels.ts';
import {
  DETAIL_KEEP_FRACTION,
  DETAIL_RELEASE_MS,
  detailExpired,
  detailWanted,
} from './detailRelease.ts';
import {
  clearTextureCache,
  loadBodyTexture,
  releaseBodyTexture,
  textureUsers,
} from './textureCache.ts';

/** A model file: one mesh, one textured material. Counts how often it is loaded. */
const gltfLoads: string[] = [];
function modelScene(): THREE.Object3D {
  const map = new THREE.Texture();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }));
  const scene = new THREE.Group();
  scene.add(mesh);
  return scene;
}
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder() {
      return this;
    }
    loadAsync(url: string) {
      gltfLoads.push(url);
      return Promise.resolve({ scene: modelScene() });
    }
  },
}));
vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({ MeshoptDecoder: {} }));

/** Every disposal a scene's resources announce. */
function disposals(root: THREE.Object3D): string[] {
  const seen: string[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry === undefined) {
      return;
    }
    mesh.geometry.addEventListener('dispose', () => seen.push('geometry'));
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.addEventListener('dispose', () => seen.push('material'));
    material.map?.addEventListener('dispose', () => seen.push('texture'));
  });
  return seen;
}

describe('when detail is let go', () => {
  it('keeps it down to half the radius it was asked for at', () => {
    expect(DETAIL_KEEP_FRACTION).toBe(0.5);
    expect(detailWanted(6, 6)).toBe(true);
    expect(detailWanted(3, 6)).toBe(true);
    expect(detailWanted(2.9, 6)).toBe(false);
  });

  it('releases only after it has stayed small for the whole delay', () => {
    expect(detailExpired(1000, 1000 + DETAIL_RELEASE_MS)).toBe(false);
    expect(detailExpired(1000, 1001 + DETAIL_RELEASE_MS)).toBe(true);
    // Never wanted at all: free to release at once.
    expect(detailExpired(-Infinity, 0)).toBe(true);
  });
});

describe('the texture cache', () => {
  afterEach(() => {
    clearTextureCache();
    vi.restoreAllMocks();
  });

  /** TextureLoader without a DOM: every load succeeds at once with a fresh texture. */
  function fakeLoader(): THREE.Texture[] {
    const made: THREE.Texture[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new THREE.Texture<HTMLImageElement>();
      made.push(texture);
      onLoad?.(texture);
      return texture;
    });
    return made;
  }

  it('shares one texture between callers and frees it when the last hands it back', async () => {
    const made = fakeLoader();
    const first = await loadBodyTexture('mars.jpg');
    const second = await loadBodyTexture('mars.jpg');
    expect(second).toBe(first);
    expect(made).toHaveLength(1);
    expect(textureUsers('mars.jpg')).toBe(2);

    let disposed = 0;
    first.addEventListener('dispose', () => (disposed += 1));
    releaseBodyTexture('mars.jpg');
    await Promise.resolve();
    expect(disposed).toBe(0);
    releaseBodyTexture('mars.jpg');
    await Promise.resolve();
    expect(disposed).toBe(1);
    expect(textureUsers('mars.jpg')).toBe(0);

    // Wanted again: fetched again, a new texture.
    expect(await loadBodyTexture('mars.jpg')).not.toBe(first);
    expect(made).toHaveLength(2);
  });

  it('ignores a release of something it does not hold', () => {
    expect(() => releaseBodyTexture('never-loaded.jpg')).not.toThrow();
  });
});

describe('the model cache', () => {
  it('loads a file once for every copy, and frees it with the last one', async () => {
    gltfLoads.length = 0;
    const [one, two] = await Promise.all([
      loadCraftModel('voyager.glb'),
      loadCraftModel('voyager.glb'),
    ]);
    expect(gltfLoads).toHaveLength(1);
    expect(craftModelUsers('voyager.glb')).toBe(2);
    // Two copies, one set of resources.
    const meshOf = (holder: THREE.Object3D) => holder.children[0]!.children[0] as THREE.Mesh;
    expect(meshOf(one).geometry).toBe(meshOf(two).geometry);

    const seen = disposals(one);
    releaseCraftModel('voyager.glb');
    await Promise.resolve();
    expect(seen).toEqual([]);
    releaseCraftModel('voyager.glb');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen.sort()).toEqual(['geometry', 'material', 'texture']);
    expect(craftModelUsers('voyager.glb')).toBe(0);

    await loadCraftModel('voyager.glb');
    expect(gltfLoads).toHaveLength(2);
    releaseCraftModel('voyager.glb');
  });

  it('frees geometry, every material and every texture they hold', () => {
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshStandardMaterial({ map }),
      new THREE.MeshStandardMaterial({ normalMap }),
    ]);
    root.add(mesh);
    const freed: string[] = [];
    mesh.geometry.addEventListener('dispose', () => freed.push('geometry'));
    for (const material of mesh.material) {
      material.addEventListener('dispose', () => freed.push('material'));
    }
    map.addEventListener('dispose', () => freed.push('map'));
    normalMap.addEventListener('dispose', () => freed.push('normalMap'));

    disposeObject(root);
    expect(freed.sort()).toEqual(['geometry', 'map', 'material', 'material', 'normalMap']);
  });
});
