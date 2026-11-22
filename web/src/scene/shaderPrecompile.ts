import * as THREE from 'three';

import { GLOW_LAYER } from './glowBuffer.ts';

/**
 * Shaders compiled before they are first drawn, each for the pass that will draw it.
 *
 * three compiles a material's program the first time something is drawn with it, then asks the
 * program where its uniforms and attributes are -- which waits, on the main thread, for the
 * driver to finish compiling and linking it. `compileAsync` starts the compile and asks only once
 * the driver says it is done (KHR_parallel_shader_compile): the page goes on meanwhile. The first
 * frame's programs go that way (ShaderWarmup.tsx); this is for the rest -- a planet's sphere and
 * its atmosphere seen for the first time, the galaxies' volumes, a body's surface map arriving --
 * each of which used to hold the page for 50 ms to a second the moment it came into view.
 *
 * **A program is compiled for a pass, not for a material.** three keys it by the material and
 * by where it is drawn: on the canvas it ends with the filmic curve and the sRGB encode, into a
 * render target it ends with neither, and the light count of the scene drawing it is part of the
 * key too. The glows (glowBuffer.ts) are drawn into the glow buffer with no lights, so compiled
 * for the canvas -- as a plain `compileAsync` of the scene does -- their programs are the wrong
 * ones, and each was compiled again, holding the page, on its first draw into the buffer. Here
 * an object on the glow's layer is compiled for the glow (`compileFor`), everything else for the
 * canvas.
 *
 * **A surface map changes the program.** A body is drawn in its flat colour until its map
 * arrives, and a material with a map is another program (USE_MAP): so for each material of
 * three's own that could be given one later, a twin with a placeholder map in its place is
 * compiled beside it (`mapTwins`), and kept, so its program stays in three's cache for the
 * material to find when the real map comes. The twin is never drawn, and the material is not
 * touched: what is on screen is what it was.
 */

const GLOW_MASK = 1 << GLOW_LAYER;

/** The passes a program is compiled for. */
export type Pass = 'canvas' | 'glow';

/** Whether `object` is drawn into the glow buffer rather than onto the canvas. */
export function drawnIntoGlow(object: THREE.Object3D): boolean {
  return (object.layers.mask & GLOW_MASK) !== 0;
}

/** The materials an object is drawn with; empty for anything three does not draw. */
export function materialsOf(object: THREE.Object3D): readonly THREE.Material[] {
  const drawn = object as THREE.Object3D & {
    isMesh?: boolean;
    isPoints?: boolean;
    isLine?: boolean;
    isSprite?: boolean;
    material?: THREE.Material | THREE.Material[];
  };
  if (!(drawn.isMesh || drawn.isPoints || drawn.isLine || drawn.isSprite) || drawn.material === undefined) {
    return [];
  }
  return Array.isArray(drawn.material) ? drawn.material : [drawn.material];
}

/** Each material's compile per pass: the material's version it was asked at, and whether it is done. */
const compiles: Record<Pass, WeakMap<THREE.Material, { version: number; done: boolean }>> = {
  canvas: new WeakMap(),
  glow: new WeakMap(),
};

/** Whether `material` has been asked to compile for `pass`, at its present version. */
export function askedFor(material: THREE.Material, pass: Pass): boolean {
  return compiles[pass].get(material)?.version === material.version;
}

/**
 * Whether `material`'s program for `pass` has been compiled here at some version and is done --
 * so drawing it now would not hold the page while it compiles from nothing. A material changed
 * since (needsUpdate) still counts: it was drawn before, and is not held back for it.
 */
export function compiledFor(material: THREE.Material, pass: Pass): boolean {
  return compiles[pass].get(material)?.done === true;
}

/** The glow's lights: none (GlowComposite.tsx draws the glows under a root of their own). */
const glowScene = new THREE.Scene();
let glowTarget: THREE.WebGLRenderTarget | null = null;

/**
 * Past this long a compile is taken as done, milliseconds: a glow held back for it is drawn,
 * and compiles on its first draw as it always did, rather than waiting on a driver that does
 * not say.
 */
export const COMPILE_GIVE_UP_MS = 4000;

/**
 * three's compileAsync, made safe to leave running: it compiles `scene`'s materials now, then
 * asks each program whether it is done, every 10 ms, without waiting on the driver where the
 * browser can say (KHR_parallel_shader_compile). three's own asks a material disposed meanwhile
 * for a program it no longer has, and throws, and its promise never settles; here such a
 * material, or one past COMPILE_GIVE_UP_MS, simply counts as done.
 */
function compileAndWait(
  gl: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  target: THREE.Scene,
): Promise<void> {
  const materials = gl.compile(scene, camera, target);
  const started = performance.now();
  const parallel = gl.extensions.get('KHR_parallel_shader_compile') !== null;
  return new Promise((resolve) => {
    const check = (): void => {
      const late = performance.now() - started > COMPILE_GIVE_UP_MS;
      for (const material of materials) {
        const program = (gl.properties.get(material) as { currentProgram?: { isReady: () => boolean } }).currentProgram;
        let ready = true;
        try {
          ready = late || program === undefined || program.isReady();
        } catch {
          // Counted as done: its first draw will say what is wrong with it.
        }
        if (ready) materials.delete(material);
      }
      if (materials.size === 0) resolve();
      else setTimeout(check, 10);
    };
    // Without the extension, asking waits for the driver: give it a moment first, as three does.
    if (parallel) check();
    else setTimeout(check, 10);
  });
}

/** `objects` as three's compile walks a scene: each of them, and none of their lights. */
function asScene(objects: readonly THREE.Object3D[]): THREE.Object3D {
  return {
    traverse: (callback: (object: THREE.Object3D) => void) => {
      for (const object of objects) callback(object);
    },
    traverseVisible: () => undefined,
  } as unknown as THREE.Object3D;
}

/**
 * Compiles `objects`' materials for `pass`, off the main thread where the browser can. On the
 * canvas, with the lights of `scene`; for the glow, into a render target with no lights, as the
 * glow pass draws them. Resolves when every program is done; each material is marked as it goes.
 *
 * Must not be called while three is drawing a frame (from an onBeforeRender): its compile takes
 * over the renderer's light state, which the frame being drawn still needs.
 */
export function compileFor(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene,
  objects: readonly THREE.Object3D[],
  pass: Pass,
): Promise<void> {
  if (objects.length === 0) return Promise.resolve();
  const asked: [THREE.Material, { version: number; done: boolean }][] = [];
  for (const object of objects) {
    for (const material of materialsOf(object)) {
      const entry = { version: material.version, done: false };
      // A version already done stays done; a fresh ask replaces anything older.
      if (!(compiles[pass].get(material)?.version === material.version)) compiles[pass].set(material, entry);
      asked.push([material, compiles[pass].get(material)!]);
    }
  }
  const finish = (): void => {
    for (const [, entry] of asked) entry.done = true;
  };
  let compiling: Promise<unknown>;
  try {
    if (pass === 'glow') {
      const previous = gl.getRenderTarget();
      const face = gl.getActiveCubeFace();
      const level = gl.getActiveMipmapLevel();
      glowTarget ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
      gl.setRenderTarget(glowTarget);
      try {
        compiling = compileAndWait(gl, asScene(objects), camera, glowScene);
      } finally {
        gl.setRenderTarget(previous, face, level);
      }
    } else {
      compiling = compileAndWait(gl, asScene(objects), camera, scene);
    }
  } catch (error) {
    // A shader that does not compile says so when it is drawn, as it always has.
    console.error('Could not compile ahead', error);
    compiling = Promise.resolve();
  }
  return compiling.then(finish, finish);
}

/** The materials of three's own that a map can be given to later, and so have a twin compiled. */
function mapsLater(material: THREE.Material): material is THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshBasicMaterial ||
    material instanceof THREE.MeshLambertMaterial ||
    material instanceof THREE.MeshPhongMaterial
  );
}

/** One white texel: a map of it changes nothing a material draws but which program it needs. */
let placeholder: THREE.DataTexture | null = null;
function placeholderMap(): THREE.DataTexture {
  if (placeholder === null) {
    placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    placeholder.needsUpdate = true;
  }
  return placeholder;
}

/** Each material's twins, kept for as long as it is (see the header); let go when it is disposed. */
const twins = new WeakMap<THREE.Material, THREE.Material[]>();

/**
 * The twins `material` still needs: one with a map, if it has none, and one with an alpha map
 * if it is transparent without one (Earth's clouds' deck, whose map arrives later) -- and each
 * of those, and the material itself, with `transparent` the other way: a sphere fading in from
 * its marker is drawn transparent and then opaque, and three's program for an opaque material
 * is another (OPAQUE). Each a clone that compiles to the program the material will need then:
 * its compile hook and cache key are the material's own, which a clone does not copy.
 */
function twinsOf(material: THREE.Material): THREE.Material[] {
  const known = twins.get(material);
  if (known !== undefined) return [];
  const made: THREE.Material[] = [];
  if (mapsLater(material)) {
    const make = (slot: 'map' | 'alphaMap' | null, flip: boolean): void => {
      const twin = material.clone() as THREE.MeshStandardMaterial;
      twin.onBeforeCompile = material.onBeforeCompile;
      if (Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')) {
        twin.customProgramCacheKey = material.customProgramCacheKey;
      }
      if (slot !== null) twin[slot] = placeholderMap();
      if (flip) twin.transparent = !material.transparent;
      made.push(twin);
    };
    const slots: ('map' | 'alphaMap' | null)[] = [null];
    if (material.map === null) slots.push('map');
    if (material instanceof THREE.MeshStandardMaterial && material.transparent && material.alphaMap === null) {
      slots.push('alphaMap');
    }
    for (const slot of slots) {
      if (slot !== null) make(slot, false);
      make(slot, true);
    }
  }
  twins.set(material, made);
  if (made.length > 0) {
    material.addEventListener('dispose', () => {
      for (const twin of made) twin.dispose();
      twins.delete(material);
    });
  }
  return made;
}

/**
 * Compiles, for the canvas, the twins of `objects`' materials (see the header): each drawn as
 * its object would draw it -- the object's material swapped for the twin only for the moment of
 * the compile's own synchronous part, and put back before anything is drawn.
 */
export function compileMapTwins(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene,
  objects: readonly THREE.Object3D[],
): Promise<void> {
  const compiling: Promise<unknown>[] = [];
  for (const object of objects) {
    const drawn = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    if (drawn.material === undefined || Array.isArray(drawn.material)) continue;
    const material = drawn.material;
    for (const twin of twinsOf(material)) {
      drawn.material = twin;
      try {
        compiling.push(compileAndWait(gl, asScene([object]), camera, scene));
      } catch {
        // Only a head start: the real map compiles on its first draw, as before.
      } finally {
        drawn.material = material;
      }
    }
  }
  return Promise.all(compiling).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * The objects under `scene` whose materials are not yet asked to compile for the pass they are
 * drawn in, at most `limit` materials' worth: the visible first, then the rest -- a layer
 * switched off, a body not yet near enough to be a sphere. Returns them by pass.
 */
export function uncompiled(scene: THREE.Object3D, limit: number): Record<Pass, THREE.Object3D[]> {
  const out: Record<Pass, THREE.Object3D[]> = { canvas: [], glow: [] };
  const taken: Record<Pass, Set<THREE.Material>> = { canvas: new Set(), glow: new Set() };
  const take = (object: THREE.Object3D): void => {
    if (taken.canvas.size + taken.glow.size >= limit) return;
    const pass: Pass = drawnIntoGlow(object) ? 'glow' : 'canvas';
    let fresh = false;
    for (const material of materialsOf(object)) {
      if (!askedFor(material, pass) && !taken[pass].has(material)) {
        taken[pass].add(material);
        fresh = true;
      }
    }
    if (fresh) out[pass].push(object);
  };
  scene.traverseVisible(take);
  scene.traverse(take);
  return out;
}
