import type { BodyDefinition, ShapeModel } from '@sss/tools/types';
import * as THREE from 'three';

import { gltfLoader } from './craftModels.ts';
import { kmToUnits } from './scale.ts';

/**
 * The real shapes of the small bodies spacecraft have visited: step B1b.
 *
 * Bennu, Ryugu, Arrokoth and the rest are not ellipsoids -- a spinning top, two lobes
 * stuck together -- and an ellipsoid of their radii would be a shape they do not have.
 * So each is drawn from its mission team's own shape model, at true size, in the frame
 * the mission's PCK turns (see `bodyFixedOrientation`). The files and where each comes
 * from are in web/public/shapes/CREDITS.md; the catalog entries in
 * tools/src/smallBodies.ts.
 *
 * Fetched and let go exactly as a craft's model is -- asked for at MODEL_REQUEST_PX,
 * drawn from `shapeShownPx` of its facets, released half a minute after it was last big
 * enough (detailRelease.ts) -- and through the same glTF loader and meshopt decoder.
 */

/** URL for a shape file, respecting the GitHub Pages base path. See `textureUrl`. */
export function shapeUrl(file: string): string {
  return `${import.meta.env.BASE_URL}shapes/${file}`;
}

/** Relative luminance of a linear RGB colour, Rec. 709 weights, as three.js uses. */
function luminance(color: THREE.Color): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/**
 * The colour a shape is drawn in: the catalog colour's hue, at the body's albedo.
 *
 * The catalog colour cannot be used as it is. It is also the marker's, the label's and
 * the orbit line's, so it is chosen to be seen against black -- Bennu's is a mid grey
 * that, as a surface, would reflect 15% of the light, three and a half times what Bennu
 * does. So its hue is kept and its luminance, in linear light, set to the albedo:
 * MeshStandardMaterial at roughness 1 is a Lambert surface, whose reflectance seen
 * face-on is its colour, and the albedo is what the body measured face-on to the Sun.
 *
 * With a map, the map carries the variation and this the level: the colour is grey, at
 * albedo over the map's own mean, so the map's average comes out at the albedo.
 */
export function shapeSurfaceColor(
  catalogColor: string,
  shape: Pick<ShapeModel, 'albedo' | 'map'>,
  out = new THREE.Color(),
): THREE.Color {
  if (shape.map !== null) {
    return out.setScalar(shape.albedo / shape.map.meanLinear);
  }
  // Hex is sRGB; three.js's working space is linear, which is what the albedo is in.
  out.set(catalogColor);
  return out.multiplyScalar(shape.albedo / luminance(out));
}

/** What `loadShapeModel` hands over, to give back to `releaseShapeModel`. */
export interface LoadedShape {
  /** What goes in the body's group, and is turned: kilometres to scene units. */
  readonly object: THREE.Object3D;
  /** The mesh inside it, which holds the geometry, the material and the map. */
  readonly mesh: THREE.Mesh;
}

/**
 * A shape's map, from web/public/shapes/: one user, the body it is draped on, so it is
 * fetched here rather than shared through the texture cache, and freed with the shape.
 */
function loadShapeMap(file: string, anisotropy: number): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(shapeUrl(file)).then((texture) => {
    // A picture, authored in sRGB, as the body maps are.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    // u runs past 1 on the facets that straddle the left edge: the map repeats in
    // longitude, and must not in latitude.
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  });
}

/**
 * A body's shape model, ready to add to its group: positions turned from kilometres into
 * scene units, its own material at the body's albedo, and its map if it has one.
 *
 * Its frame is the file's, untouched -- the body-fixed one -- so the caller turns it with
 * `bodyFixedOrientation`. One copy per body, and no cache: no two bodies share a shape.
 */
export async function loadShapeModel(
  body: BodyDefinition,
  anisotropy: number,
): Promise<LoadedShape> {
  const shape = body.shapeModel;
  if (shape === undefined) {
    throw new Error(`${body.id} has no shape model.`);
  }
  const [gltf, map] = await Promise.allSettled([
    gltfLoader().then((loader) => loader.loadAsync(shapeUrl(shape.file))),
    shape.map === null ? Promise.resolve(null) : loadShapeMap(shape.map.file, anisotropy),
  ]);
  // One failed, so neither is kept.
  if (gltf.status === 'rejected' || map.status === 'rejected') {
    if (map.status === 'fulfilled') {
      map.value?.dispose();
    }
    throw gltf.status === 'rejected' ? gltf.reason : (map as PromiseRejectedResult).reason;
  }
  try {
    return buildShape(body, gltf.value.scene, map.value);
  } catch (error) {
    map.value?.dispose();
    throw error;
  }
}

/**
 * The drawn shape, from a loaded file and its map: what `loadShapeModel` hands over, and
 * what the tests run the files through, so they hold the very transform drawn.
 */
export function buildShape(
  body: BodyDefinition,
  scene: THREE.Object3D,
  map: THREE.Texture | null,
): LoadedShape {
  const shape = body.shapeModel!;
  let source: THREE.Mesh | null = null;
  scene.traverse((node) => {
    if (source === null && (node as THREE.Mesh).isMesh === true) {
      source = node as THREE.Mesh;
    }
  });
  if (source === null) {
    throw new Error(`${shape.file} holds no mesh.`);
  }
  const found: THREE.Mesh = source;
  // The loader's own material is the file's default grey; this one is the body's.
  (found.material as THREE.Material).dispose();

  const material = new THREE.MeshStandardMaterial({
    color: shapeSurfaceColor(body.color, shape),
    map,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(found.geometry, material);
  // Quantised positions come with the node transform that undoes the quantisation. It is
  // kept as a transform: baked into the 16-bit integers it would clip them.
  found.updateWorldMatrix(true, false);
  found.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
  const holder = new THREE.Group();
  holder.scale.setScalar(kmToUnits(1));
  holder.add(mesh);
  holder.name = `${body.id}-shape`;
  return { object: holder, mesh };
}

/** Frees a shape from `loadShapeModel`: its geometry, its material, and its map. */
export function releaseShapeModel(loaded: LoadedShape): void {
  const material = loaded.mesh.material as THREE.MeshStandardMaterial;
  loaded.mesh.geometry.dispose();
  material.map?.dispose();
  material.dispose();
}
