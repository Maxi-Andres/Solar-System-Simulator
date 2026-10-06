import type { CraftAxis, CraftShape } from '@sss/tools/types';
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { Vec3 } from '../core/vec3.ts';
import { kmToUnits } from './scale.ts';

/**
 * What a spacecraft is drawn as up close, and which way it faces.
 *
 * NASA's own model where one may be used, else a plain box of the craft's published
 * dimensions. Both are in metres, and both are drawn at true size: a 30.5 m Europa
 * Clipper is 30.5 m against a 3,100 km Europa, which is the point of drawing it at all.
 * See CraftShape in tools/src/types.ts and SHAPES in the catalog for the sources.
 */

/** Scene units per metre: the models are authored in metres, the scene in 1000 km. */
export const UNITS_PER_METRE = kmToUnits(0.001);

/**
 * On-screen radius, in pixels, at which a craft's model is worth fetching.
 *
 * The same rule as a planet's surface map: ask while it is still a growing dot, so the
 * file has arrived by the time there is a shape to see. Below that it is a marker, and
 * a few hundred kilobytes would buy nothing.
 */
export const MODEL_REQUEST_PX = 6;

/**
 * On-screen radius, in pixels, above which the shape replaces the marker's dot.
 *
 * Not faded in like a planet's sphere. A model is dozens of materials, and fading it
 * means drawing all of them transparent, which sorts badly against itself; at a pixel
 * and a half it is a speck either way, and the marker is still fading out over it.
 */
export const SHAPE_SHOWN_PX = 1.5;

/** URL for a model file, respecting the GitHub Pages base path. See `textureUrl`. */
export function modelUrl(file: string): string {
  return `${import.meta.env.BASE_URL}models/${file}`;
}

/**
 * The glTF loader and its meshopt decoder, fetched with the first model rather than with
 * the app: 23 KB compressed that a visit which never approaches a craft does not need.
 */
let loader: Promise<GLTFLoader> | null = null;
function gltfLoader(): Promise<GLTFLoader> {
  loader ??= Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) =>
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  );
  return loader;
}

const cache = new Map<string, Promise<THREE.Object3D>>();

/**
 * A craft's model, ready to add to the scene: a fresh copy per call, sharing geometry
 * and materials with every other copy, since both Voyagers fly one file.
 *
 * Scaled from metres to scene units; its own frame is the catalog's, untouched.
 */
export async function loadCraftModel(file: string): Promise<THREE.Object3D> {
  let pending = cache.get(file);
  if (pending === undefined) {
    pending = gltfLoader()
      .then((gltf) => gltf.loadAsync(modelUrl(file)))
      .then((gltf) => gltf.scene);
    // A failed load must not be cached, or the craft could never be retried.
    pending.catch(() => cache.delete(file));
    cache.set(file, pending);
  }
  const scene = await pending;
  const copy = scene.clone(true);
  const holder = new THREE.Group();
  holder.scale.setScalar(UNITS_PER_METRE);
  holder.add(copy);
  return holder;
}

/**
 * The stand-in for a craft with no model: a box, white, of its published size.
 *
 * Matte rather than shiny, because it claims no material either; lit by the Sun like
 * everything else, so it has a day side and a night side and reads as a solid.
 */
export function craftBox(sizeM: readonly [number, number, number]): THREE.Object3D {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(sizeM[0], sizeM[1], sizeM[2]),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0 }),
  );
  const holder = new THREE.Group();
  holder.scale.setScalar(UNITS_PER_METRE);
  holder.add(box);
  return holder;
}

const ECLIPTIC_NORTH = new THREE.Vector3(0, 0, 1);
const scratchTarget = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchThird = new THREE.Vector3();
const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchC = new THREE.Vector3();
const scratchWorld = new THREE.Matrix4();
const scratchModel = new THREE.Matrix4();

const vector = (axis: CraftAxis, out: THREE.Vector3): THREE.Vector3 =>
  out.set(axis[0], axis[1], axis[2]).normalize();

/**
 * The rotation that keeps a craft's pointing axis on its target, its roll axis as near
 * ecliptic north as that allows.
 *
 * `toTarget` is the direction from the craft to the Earth or the Sun, in the scene's
 * frame -- ecliptic J2000, z toward its north pole. Where the target lies straight
 * along that pole the roll has nothing to hold to, and ecliptic x stands in.
 */
export function craftOrientation(
  shape: CraftShape,
  toTarget: Vec3,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  const target = scratchTarget.set(toTarget.x, toTarget.y, toTarget.z).normalize();
  const up = scratchUp.copy(ECLIPTIC_NORTH).addScaledVector(target, -target.dot(ECLIPTIC_NORTH));
  if (up.lengthSq() < 1e-12) {
    up.set(1, 0, 0).addScaledVector(target, -target.x);
  }
  up.normalize();
  const third = scratchThird.crossVectors(target, up);

  const a = vector(shape.pointingAxis, scratchA);
  const b = vector(shape.rollAxis, scratchB);
  const c = scratchC.crossVectors(a, b);

  // World basis times the transpose of the model basis: model axis a lands on the
  // target, b on the roll direction, and their cross product on the cross product.
  scratchWorld.makeBasis(target, up, third);
  scratchModel.makeBasis(a, b, c).transpose();
  return out.setFromRotationMatrix(scratchWorld.multiply(scratchModel));
}
