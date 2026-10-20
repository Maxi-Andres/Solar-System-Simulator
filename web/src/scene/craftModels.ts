import type { CraftAxis, CraftShape } from '@sss/tools/types';
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { Vec3 } from '../core/vec3.ts';
import { kmToUnits, MARKER_FULL_PX, MESH_FADE_START_PX } from './scale.ts';

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
 *
 * Above every `shapeShownPx`, which stops at 4 px, so a model is never fetched before
 * it may be drawn: it is drawn the moment it lands. Going the other way it is kept
 * while it stays above 3 px, and for half a minute after (detailRelease.ts), so turning
 * back costs nothing; a heavy one is out of sight by then, hidden below 3.2 px.
 */
export const MODEL_REQUEST_PX = 6;

/**
 * On-screen radius, in pixels, above which the lightest shape replaces the marker's dot:
 * the floor of `shapeShownPx`, and where a planet's sphere stops being drawn whole.
 *
 * Not faded in like a planet's sphere. A model is dozens of materials, and fading it
 * means drawing all of them transparent, which sorts badly against itself; at a pixel
 * and a half it is a speck either way, and the marker is fully drawn around it.
 */
export const SHAPE_SHOWN_PX = MESH_FADE_START_PX;

/**
 * Triangles in a planet's sphere: 64 segments by 32 (SPHERE_SEGMENTS in SolarSystem.tsx),
 * less the slivers at the poles.
 *
 * The yardstick for what a speck may cost. The scene already draws this many for a
 * planet of a pixel and a half radius, 561 triangles to each pixel it covers, so a craft
 * spending no more per pixel than that is paying what everything else pays.
 */
export const PLANET_SPHERE_TRIANGLES = 3968;

/** Below this share of its `shapeShownPx`, a shape that is drawn stops being drawn. */
export const SHAPE_KEEP_FRACTION = 0.8;

/**
 * On-screen radius, in pixels, above which a shape of `triangles` replaces the marker's
 * dot.
 *
 * A model's cost at a speck is its triangles -- every vertex is transformed however few
 * pixels come out -- and what it buys is the pixels it covers. So a shape is drawn from
 * the size at which it spends no more triangles per pixel than a planet's sphere does
 * where that is last drawn whole: π r² pixels for r = 1.5 · √(triangles / 3,968).
 * Measured on the files (see craftModels.test.ts): CAPSTONE's 5,025 come out at 1.7 px,
 * Voyager's 20,390 at 3.4 px, and anything above 28,217 at the ceiling below.
 *
 * Never above MARKER_FULL_PX: up to there the marker is fully drawn and stands in for
 * the craft, but above it the marker fades, and a craft whose shape still waited would
 * fade to nothing. So Juice's 959,923 triangles, Orion's 112,517 and Europa Clipper's
 * 203,662 are all drawn from 4 px -- where Juice is still 19,000 triangles a pixel,
 * against 136,000 at the old 1.5 px. Fewer would take a coarser copy of the model, and
 * ESA's permission asks for its geometry as it is.
 *
 * A box is 12 triangles, drawn from the floor like before.
 */
export function shapeShownPx(triangles: number): number {
  const budgetPx = MESH_FADE_START_PX * Math.sqrt(triangles / PLANET_SPHERE_TRIANGLES);
  return Math.min(Math.max(budgetPx, SHAPE_SHOWN_PX), MARKER_FULL_PX);
}

/**
 * Whether a shape whose threshold is `shownPx` is drawn at `pixelRadius`, given whether
 * it was last frame.
 *
 * Hysteresis, so a craft hovering at its threshold -- a camera easing to rest, a craft
 * drifting along its orbit -- does not blink a model on and off frame after frame. Both
 * edges stay at or below MARKER_FULL_PX, where the marker is fully drawn over it.
 */
export function shapeVisible(pixelRadius: number, shownPx: number, wasVisible: boolean): boolean {
  return pixelRadius > (wasVisible ? shownPx * SHAPE_KEEP_FRACTION : shownPx);
}

/**
 * Triangles drawn for everything under `root`, each instance of an instanced mesh
 * counted: IMAP's file repeats parts with EXT_mesh_gpu_instancing.
 *
 * Walks every mesh, so it is counted once, when a file is loaded, and never per frame.
 */
export function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) {
      return;
    }
    // The glTF loader turns strips and fans into lists, so three corners a triangle.
    const geometry = mesh.geometry;
    const corners = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
    const instanced = mesh as THREE.InstancedMesh;
    const copies = instanced.isInstancedMesh === true ? instanced.count : 1;
    triangles += Math.floor(corners / 3) * copies;
  });
  return triangles;
}

/** URL for a model file, respecting the GitHub Pages base path. See `textureUrl`. */
export function modelUrl(file: string): string {
  return `${import.meta.env.BASE_URL}models/${file}`;
}

/**
 * The glTF loader and its meshopt decoder, fetched with the first model rather than with
 * the app: 23 KB compressed that a visit which never approaches a craft does not need.
 * The asteroids' shape models come through it too (shapeModels.ts).
 */
let loader: Promise<GLTFLoader> | null = null;
export function gltfLoader(): Promise<GLTFLoader> {
  loader ??= Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) =>
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  );
  return loader;
}

interface CachedModel {
  readonly scene: Promise<THREE.Object3D>;
  /** Copies handed out and not yet handed back. */
  users: number;
  /** What the file draws, counted once as it loads; 0 until then. See shapeShownPx. */
  triangles: number;
}

const cache = new Map<string, CachedModel>();

/**
 * A craft's model, ready to add to the scene: a fresh copy per call, sharing geometry
 * and materials with every other copy, since both Voyagers fly one file. Each call must
 * be matched by one `releaseCraftModel` once the copy is out of the scene.
 *
 * Scaled from metres to scene units; its own frame is the catalog's, untouched.
 */
export async function loadCraftModel(
  file: string,
  metresPerUnit = 1,
  pivot: readonly [number, number, number] = [0, 0, 0],
): Promise<THREE.Object3D> {
  let entry = cache.get(file);
  if (entry === undefined) {
    const scene = gltfLoader()
      .then((gltf) => gltf.loadAsync(modelUrl(file)))
      .then((gltf) => {
        // Before any copy is handed out, so every caller can read it at once; copies
        // share the geometry, so one count serves them all.
        created.triangles = countTriangles(gltf.scene);
        return gltf.scene;
      });
    const created: CachedModel = { scene, users: 0, triangles: 0 };
    // A failed load must not be cached, or the craft could never be retried.
    scene.catch(() => {
      if (cache.get(file) === created) {
        cache.delete(file);
      }
    });
    cache.set(file, created);
    entry = created;
  }
  entry.users += 1;
  const scene = await entry.scene;
  const copy = scene.clone(true);
  // The pivot, not the file's origin, goes where the craft is, and the craft turns
  // about it. See CraftShape.pivot.
  copy.position.set(-pivot[0], -pivot[1], -pivot[2]);
  const holder = new THREE.Group();
  // A model authored in arbitrary units carries its own factor to metres; see SHAPES.
  holder.scale.setScalar(UNITS_PER_METRE * metresPerUnit);
  holder.add(copy);
  return holder;
}

/**
 * Hands back one copy from `loadCraftModel`. The last one frees the file's geometry,
 * materials and textures; a later request loads it again.
 *
 * A model's textures are most of what it costs -- Orion's thirty are 130 MB decoded --
 * so a session that visits craft after craft must not keep every one it has seen.
 */
export function releaseCraftModel(file: string): void {
  const entry = cache.get(file);
  if (entry === undefined) {
    return;
  }
  entry.users -= 1;
  if (entry.users > 0) {
    return;
  }
  cache.delete(file);
  entry.scene.then(disposeObject, () => undefined);
}

/** Copies of `file` handed out and not handed back, for tests. */
export function craftModelUsers(file: string): number {
  return cache.get(file)?.users ?? 0;
}

/**
 * Triangles in `file`'s model, counted when it loaded: known by the time a copy from
 * `loadCraftModel` is in hand, and 0 for a file not held.
 */
export function craftModelTriangles(file: string): number {
  return cache.get(file)?.triangles ?? 0;
}

/**
 * Frees everything under `root` on the GPU: geometry, materials and every texture they
 * hold. Decoded images are closed too, since the loader keeps them in memory beside
 * the GPU copy.
 */
export function disposeObject(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    const drawn = node as THREE.Mesh;
    if (drawn.geometry === undefined) {
      return;
    }
    drawn.geometry.dispose();
    const materials = Array.isArray(drawn.material) ? drawn.material : [drawn.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          textures.add(value);
        }
      }
      material.dispose();
    }
  });
  for (const texture of textures) {
    texture.dispose();
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
      image.close();
    }
  }
}

/** What the box says on its broad faces, so nobody takes it for the craft. */
export const NO_MODEL_TEXT = 'NO MODEL';

/**
 * The label for a box face `widthM` by `heightM`: white, with NO MODEL across it.
 *
 * Drawn at the face's own proportions so the letters are not stretched, at a height
 * that is a fixed share of the shorter side; the canvas is sized so the text is crisp
 * at the closest the camera comes.
 */
function noModelTexture(widthM: number, heightM: number): THREE.Texture {
  const width = 1024;
  const height = Math.max(64, Math.round((width * heightM) / widthM));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#6b6b6b';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const size = Math.min(height * 0.3, (width * 0.8) / (NO_MODEL_TEXT.length * 0.75));
  context.font = `600 ${size}px Inter, 'Segoe UI', system-ui, sans-serif`;
  context.fillText(NO_MODEL_TEXT, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * The stand-in for a craft with no model: a box, white, of its published size.
 *
 * Matte rather than shiny, because it claims no material either; lit by the Sun like
 * everything else, so it has a day side and a night side and reads as a solid. Its two
 * broad faces -- the ones that face the Sun and away, where the arrays would be -- say
 * NO MODEL, because a white box this size could otherwise pass for a design.
 */
export function craftBox(sizeM: readonly [number, number, number]): THREE.Object3D {
  const plain = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0 });
  const labelled = new THREE.MeshStandardMaterial({
    map: noModelTexture(sizeM[0], sizeM[1]),
    roughness: 0.85,
    metalness: 0,
  });
  // BoxGeometry's groups run +x, -x, +y, -y, +z, -z; the broad faces are +z and -z.
  const box = new THREE.Mesh(new THREE.BoxGeometry(sizeM[0], sizeM[1], sizeM[2]), [
    plain,
    plain,
    plain,
    plain,
    labelled,
    labelled,
  ]);
  const holder = new THREE.Group();
  holder.scale.setScalar(UNITS_PER_METRE);
  holder.add(box);
  return holder;
}

/**
 * The attribution ESA's permission asks for, word for word, "wherever the models are
 * used": in the info panel of each craft drawn with one, and in About. The permission
 * itself is recorded in web/public/models/CREDITS.md.
 */
export const ESA_MODEL_CREDIT = '3D models © ESA (European Space Agency).';

const ECLIPTIC_NORTH = new THREE.Vector3(0, 0, 1);
const scratchTarget = new THREE.Vector3();
const scratchRoll = new THREE.Vector3();
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
 *
 * `rollToward` replaces ecliptic north for a craft whose roll is known: a rover's
 * front, along its heading.
 */
export function craftOrientation(
  shape: CraftShape,
  toTarget: Vec3,
  out = new THREE.Quaternion(),
  rollToward: Vec3 = ECLIPTIC_NORTH,
): THREE.Quaternion {
  const target = scratchTarget.set(toTarget.x, toTarget.y, toTarget.z).normalize();
  const roll = scratchRoll.set(rollToward.x, rollToward.y, rollToward.z);
  const up = scratchUp.copy(roll).addScaledVector(target, -target.dot(roll));
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
