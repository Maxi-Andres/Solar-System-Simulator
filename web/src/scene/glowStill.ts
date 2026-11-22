import type * as THREE from 'three';

/**
 * Whether the glows (glowBuffer.ts) would draw this frame exactly what they drew the last time,
 * so the glow pass can keep its buffers instead of drawing them again (GlowComposite.tsx).
 *
 * At real time almost nothing in the glows moves -- a galaxy a hundred million light years off
 * does not, and the camera is still -- and the frames the clock and the idle tick still draw
 * (core/renderDemand.ts) each drew every glow again: from Laniakea at a pixel ratio of 1.5 the
 * dearest part of a still frame, the giants' ray-marched volumes at full resolution among them.
 * The Milky Way keeps its own buffer the same way (milkyWayView.ts); this is the rest.
 *
 * **Exact, not near enough.** A frame is the same only when every input of the glow draw is the
 * same to the bit of the single-precision number the GPU is given -- the camera rig works out the
 * camera's matrix afresh every frame, and a still camera's comes out a part in 10^17 different,
 * which no float32 sees -- the camera's pose and projection, the buffer's size, whether the volumes are
 * drawn apart (viewMotion.ts), which objects are drawn and in what order, and for each of them --
 * and each of its children drawn with it -- its world matrix, its material's version and every
 * uniform, its geometry's draw range, instance count and the versions of its attributes and
 * index. So a kept buffer is the buffer a fresh draw would make, not one close to it. Anything
 * this cannot see into -- a uniform of a kind it does not know, a texture something renders into
 * (whose contents change with no version to say so) -- makes the frame count as changed.
 *
 * A glow that sets its uniforms in its own onBeforeRender, from the camera that draws it
 * (Nebulae.tsx), is compared on what it set the last time it was drawn: when the camera has
 * just changed that differs from what it will set now, and the frame counts as changed -- one
 * draw more than needed, never one fewer.
 */

/** A snapshot of the glow draw's inputs: numbers, and the objects compared by identity. */
interface Fingerprint {
  numbers: number[];
  refs: unknown[];
  /** False when something in it could change without the snapshot seeing it. */
  complete: boolean;
}

function fingerprint(): Fingerprint {
  return { numbers: [], refs: [], complete: true };
}

export class GlowStill {
  #last: Fingerprint | null = null;
  #now: Fingerprint = fingerprint();

  /**
   * True if drawing `glows` and `volumes` through `camera` into a buffer `width` by `height`,
   * the volumes apart or not, would draw exactly what the last call that returned false was
   * about to draw. The caller draws when it is false, and keeps its buffers when it is true.
   */
  same(
    camera: THREE.Camera,
    width: number,
    height: number,
    apart: boolean,
    glows: readonly THREE.Object3D[],
    volumes: readonly THREE.Object3D[],
  ): boolean {
    const now = this.#now;
    now.numbers.length = 0;
    now.refs.length = 0;
    now.complete = true;
    const n = now.numbers;
    n.push(width, height, apart ? 1 : 0, glows.length, volumes.length);
    pushArray(n, camera.matrixWorld.elements);
    pushArray(n, camera.projectionMatrix.elements);
    for (const list of [glows, volumes]) {
      for (const object of list) {
        object.traverseVisible((child) => addObject(now, child));
      }
    }
    const last = this.#last;
    const same = last !== null && now.complete && last.complete && equal(last, now);
    if (!same) {
      // Kept as what the buffers now hold; the spare is reused for the next frame's snapshot.
      this.#now = last ?? fingerprint();
      this.#last = now;
    }
    return same;
  }

  /** Forgets the last draw: the next call is a change, whatever it is (buffers reallocated, say). */
  forget(): void {
    this.#last = null;
  }
}

function equal(a: Fingerprint, b: Fingerprint): boolean {
  if (a.numbers.length !== b.numbers.length || a.refs.length !== b.refs.length) return false;
  for (let i = 0; i < a.numbers.length; i += 1) {
    // As the GPU is given them, single precision; and by Object.is, NaN is NaN and 0 is not -0.
    if (!Object.is(Math.fround(a.numbers[i]!), Math.fround(b.numbers[i]!))) return false;
  }
  for (let i = 0; i < a.refs.length; i += 1) {
    if (a.refs[i] !== b.refs[i]) return false;
  }
  return true;
}

function pushArray(out: number[], values: ArrayLike<number>): void {
  out.push(values.length);
  for (let i = 0; i < values.length; i += 1) out.push(values[i]!);
}

/** An object as the glow pass draws it: on its layer or not, every input its draw reads. */
function addObject(fp: Fingerprint, object: THREE.Object3D): void {
  fp.refs.push(object);
  fp.numbers.push(object.layers.mask, object.renderOrder);
  pushArray(fp.numbers, object.matrixWorld.elements);
  const drawn = object as THREE.Object3D & {
    material?: THREE.Material | THREE.Material[];
    geometry?: THREE.BufferGeometry;
    count?: number;
    instanceMatrix?: THREE.BufferAttribute;
  };
  if (drawn.count !== undefined) {
    fp.numbers.push(drawn.count);
    // None drawn: nothing else of it matters.
    if (drawn.count === 0) return;
  }
  if (drawn.instanceMatrix !== undefined) addInstances(fp, drawn.instanceMatrix, drawn.count ?? 0, 16);
  const colours = (drawn as { instanceColor?: THREE.BufferAttribute | null }).instanceColor;
  if (colours !== undefined && colours !== null) addInstances(fp, colours, drawn.count ?? 0, 3);
  const materials = drawn.material === undefined ? [] : Array.isArray(drawn.material) ? drawn.material : [drawn.material];
  for (const material of materials) addMaterial(fp, material);
  if (drawn.geometry !== undefined) addGeometry(fp, drawn.geometry);
}

/**
 * An instanced mesh's per-instance attribute: by its values, the `count` drawn -- its owner may
 * mark it changed every frame with the same numbers in it -- or by its version past
 * MAX_COMPARED_INSTANCES, where comparing every value would cost more than it saves.
 */
function addInstances(fp: Fingerprint, attribute: THREE.BufferAttribute, count: number, size: number): void {
  if (count > MAX_COMPARED_INSTANCES) {
    fp.numbers.push(attribute.version);
    return;
  }
  const values = attribute.array;
  const n = Math.min(values.length, count * size);
  fp.numbers.push(n);
  for (let i = 0; i < n; i += 1) fp.numbers.push(values[i]!);
}

/** Past this many instances an instanced mesh is compared by its attributes' versions. */
const MAX_COMPARED_INSTANCES = 4096;

function addMaterial(fp: Fingerprint, material: THREE.Material): void {
  fp.refs.push(material);
  fp.numbers.push(material.version, material.visible ? 1 : 0, material.opacity);
  const uniforms = (material as THREE.Material & { uniforms?: Record<string, THREE.IUniform> }).uniforms;
  if (uniforms === undefined) {
    // A built-in material: its colour, map and the rest are not uniforms here. None draws a
    // glow today; if one ever does, it is drawn every frame rather than guessed at.
    fp.complete = false;
    return;
  }
  for (const key in uniforms) addValue(fp, uniforms[key]!.value);
}

function addGeometry(fp: Fingerprint, geometry: THREE.BufferGeometry): void {
  fp.refs.push(geometry);
  fp.numbers.push(geometry.drawRange.start, geometry.drawRange.count);
  const instanced = geometry as THREE.BufferGeometry & { instanceCount?: number };
  if (instanced.instanceCount !== undefined) {
    fp.numbers.push(instanced.instanceCount);
    // None drawn: nothing else of it matters.
    if (instanced.instanceCount === 0) return;
  }
  if (geometry.index !== null) fp.numbers.push(geometry.index.version);
  for (const name in geometry.attributes) {
    const attribute = geometry.attributes[name]! as THREE.BufferAttribute & {
      data?: { version: number };
      isInstancedBufferAttribute?: boolean;
    };
    fp.refs.push(attribute);
    if (attribute.isInstancedBufferAttribute === true && attribute.data === undefined) {
      // Per instance, as an instanced mesh's: by the values of those drawn.
      addInstances(fp, attribute, Math.min(instanced.instanceCount ?? Infinity, attribute.count), attribute.itemSize);
    } else {
      // An interleaved attribute's version is its buffer's.
      fp.numbers.push(attribute.data?.version ?? attribute.version);
    }
  }
}

/** A uniform's value, by kind; anything it cannot read in full makes the snapshot incomplete. */
function addValue(fp: Fingerprint, value: unknown): void {
  if (typeof value === 'number') {
    fp.numbers.push(value);
    return;
  }
  if (typeof value === 'boolean') {
    fp.numbers.push(value ? 1 : 0);
    return;
  }
  if (value === null || value === undefined) {
    fp.refs.push(null);
    return;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    pushArray(fp.numbers, value as unknown as ArrayLike<number>);
    return;
  }
  if (Array.isArray(value)) {
    fp.numbers.push(value.length);
    for (const item of value) addValue(fp, item);
    return;
  }
  const v = value as Record<string, unknown> & { elements?: ArrayLike<number>; version?: number };
  if (v['isTexture'] === true) {
    fp.refs.push(value);
    fp.numbers.push(v.version ?? 0);
    // Rendered into: its pixels change with no version to say so.
    if (v['isRenderTargetTexture'] === true) fp.complete = false;
    return;
  }
  if (v['isMatrix4'] === true || v['isMatrix3'] === true) {
    pushArray(fp.numbers, v.elements!);
    return;
  }
  if (v['isVector2'] === true) {
    fp.numbers.push(v['x'] as number, v['y'] as number);
    return;
  }
  if (v['isVector3'] === true) {
    fp.numbers.push(v['x'] as number, v['y'] as number, v['z'] as number);
    return;
  }
  if (v['isVector4'] === true || v['isQuaternion'] === true) {
    fp.numbers.push(v['x'] as number, v['y'] as number, v['z'] as number, v['w'] as number);
    return;
  }
  if (v['isColor'] === true) {
    fp.numbers.push(v['r'] as number, v['g'] as number, v['b'] as number);
    return;
  }
  // A struct uniform, or something unknown: not guessed at.
  fp.complete = false;
}
