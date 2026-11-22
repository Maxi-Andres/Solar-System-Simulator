import * as THREE from 'three';

import type { MarkerShape } from './markerTexture.ts';

/**
 * Every body's marker in one draw.
 *
 * Each body had a sprite of its own, and so a draw call and a material switch of its own:
 * a few dozen in a planet's system, hundreds where the craft and the small moons crowd. One
 * instanced quad does the same work in one call. What each marker needs is a handful of
 * numbers, worked out in the frame loop anyway -- where it is, how big, its colour, how
 * faded, which shape -- and they go up as one buffer each frame.
 *
 * **Drawn exactly as the sprites were.** The sprite's own shader takes its centre into the
 * camera's frame, moves the corners out in that frame by its scale, and projects; so does
 * this, with the centre already in the camera's frame. That is worked out on the CPU, in
 * float64, from the same matrices three multiplied for the sprite -- so no precision is
 * lost to the floating origin or to a marker a billion light years out -- and the corners
 * are moved by the sprite's own size, so a marker off the middle of the screen is the same
 * few percent larger than eleven pixels it always was. The textures are markerTexture.ts's,
 * sampled the same way; the colour is the body's, times the texture, at the marker's
 * opacity; the tone curve and the output encoding are the renderer's, as on a sprite.
 *
 * **Packed afresh each frame, not held in slots.** Which markers are drawn changes every
 * frame anyway (the fade, the declutter, a moon waiting for its system to open up), so
 * every frame the ones drawn are written to the front of the buffer and the count says
 * how many. A body that leaves the store simply stops being written: there is no slot to
 * give back and no hole to skip. The buffer grows, never shrinks, when a frame has more
 * markers than it holds.
 *
 * **Far to near**, as three sorted the sprites, transparent objects back to front: two
 * markers the declutter lets overlap a little (a held one, markerDeclutter.ts) blend in
 * the same order as before.
 */

/** Floats per marker: centre in view space, size; colour, opacity; shape. */
export const MARKER_STRIDE = 9;

/** The buffer's first size, in markers: grown by doubling from there. */
const INITIAL_CAPACITY = 256;

/** How many markers a buffer must hold for `needed`, from `current`: doubled until it fits. */
export function grownCapacity(needed: number, current: number): number {
  let capacity = Math.max(current, 1);
  while (capacity < needed) {
    capacity *= 2;
  }
  return capacity;
}

/**
 * The sprite's vertex shader, from three's sprite_vert, with what it took from the object's
 * matrices handed in per instance instead: the centre in the camera's frame and the size
 * there. Rotation is zero and the centre is the middle, as every marker's was.
 */
const VERTEX_SHADER = /* glsl */ `
  attribute vec4 aView;
  attribute vec4 aColor;
  attribute float aShape;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vShape;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vColor = aColor;
    vShape = aShape;
    vec4 mvPosition = vec4(aView.xyz, 1.0);
    mvPosition.xy += position.xy * aView.w;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

/**
 * The sprite's fragment shader, from three's sprite_frag: the colour times the map, at the
 * opacity, then tone mapped and encoded. Every map is read and one kept, rather than
 * branching on the shape: the shape is the same over the whole quad, so `mix` by 0 or 1 is
 * exactly the one map -- circle 0, diamond 1, triangle 2 (SHAPE_INDEX).
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uCircle;
  uniform sampler2D uDiamond;
  uniform sampler2D uTriangle;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vShape;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec4 shape = mix(texture2D(uCircle, vUv), texture2D(uDiamond, vUv), clamp(vShape, 0.0, 1.0));
    gl_FragColor = vColor * mix(shape, texture2D(uTriangle, vUv), clamp(vShape - 1.0, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The sprite's quad: its corners, -0.5 to 0.5, and its uvs, as three builds it. */
function quadGeometry(buffer: THREE.InstancedInterleavedBuffer): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('aView', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  geometry.setAttribute('aColor', new THREE.InterleavedBufferAttribute(buffer, 4, 4));
  geometry.setAttribute('aShape', new THREE.InterleavedBufferAttribute(buffer, 1, 8));
  geometry.instanceCount = 0;
  return geometry;
}

function instanceBuffer(capacity: number): THREE.InstancedInterleavedBuffer {
  const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity * MARKER_STRIDE), MARKER_STRIDE);
  buffer.setUsage(THREE.DynamicDrawUsage);
  return buffer;
}

const noRaycast = (): void => {};

/** Each shape's number in the instance data, which the fragment shader picks its map by. */
export const SHAPE_INDEX: Readonly<Record<MarkerShape, number>> = { circle: 0, diamond: 1, triangle: 2 };

export class MarkerInstances {
  /** The one object drawn: in the scene for as long as the markers are. */
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

  /** This frame's markers as staged, in float64, before the declutter has had its say. */
  private staged = new Float64Array(INITIAL_CAPACITY * MARKER_STRIDE);
  private stagedIds: string[] = [];
  /** Indices into the staged markers, reused for the sort. */
  private order: number[] = [];
  private buffer: THREE.InstancedInterleavedBuffer;
  private capacity = INITIAL_CAPACITY;

  constructor(circle: THREE.Texture, diamond: THREE.Texture, triangle: THREE.Texture) {
    this.buffer = instanceBuffer(this.capacity);
    const material = new THREE.ShaderMaterial({
      uniforms: { uCircle: { value: circle }, uDiamond: { value: diamond }, uTriangle: { value: triangle } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      // Over everything: a planet behind the Sun still needs its marker, and its label.
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(quadGeometry(this.buffer), material);
    this.mesh.renderOrder = 10;
    // The quads are placed in the shader, from the camera's frame; the object's own place
    // and bounds mean nothing, so neither culling nor picking may go by them.
    this.mesh.frustumCulled = false;
    this.mesh.raycast = noRaycast;
    this.mesh.visible = false;
  }

  /** Starts a frame: nothing staged. */
  begin(): void {
    this.stagedIds.length = 0;
  }

  /**
   * A marker this frame, in front of the camera: its centre in the camera's frame (z
   * negative in front), its size there in scene units -- the sprite's world size at that
   * depth -- its colour in the working space, its opacity and its shape.
   */
  stage(
    id: string,
    view: THREE.Vector3Like,
    size: number,
    color: THREE.Color,
    opacity: number,
    shape: MarkerShape,
  ): void {
    const index = this.stagedIds.length;
    if ((index + 1) * MARKER_STRIDE > this.staged.length) {
      const grown = new Float64Array(grownCapacity(index + 1, this.staged.length / MARKER_STRIDE) * MARKER_STRIDE);
      grown.set(this.staged);
      this.staged = grown;
    }
    const at = index * MARKER_STRIDE;
    const s = this.staged;
    s[at] = view.x;
    s[at + 1] = view.y;
    s[at + 2] = view.z;
    s[at + 3] = size;
    s[at + 4] = color.r;
    s[at + 5] = color.g;
    s[at + 6] = color.b;
    s[at + 7] = opacity;
    s[at + 8] = SHAPE_INDEX[shape];
    this.stagedIds.push(id);
  }

  /**
   * Ends a frame: the staged markers that `keep` passes are written, far to near, and only
   * they are drawn. Returns how many.
   */
  commit(keep: (id: string) => boolean): number {
    const order = this.order;
    order.length = 0;
    for (let i = 0; i < this.stagedIds.length; i += 1) {
      if (keep(this.stagedIds[i]!)) {
        order.push(i);
      }
    }
    const s = this.staged;
    // Farthest first: the most negative z in the camera's frame.
    order.sort((a, b) => s[a * MARKER_STRIDE + 2]! - s[b * MARKER_STRIDE + 2]!);

    const count = order.length;
    if (count > this.capacity) {
      this.grow(count);
    }
    const array = this.buffer.array as Float32Array;
    for (let k = 0; k < count; k += 1) {
      const from = order[k]! * MARKER_STRIDE;
      array.set(s.subarray(from, from + MARKER_STRIDE), k * MARKER_STRIDE);
    }
    if (count > 0) {
      this.buffer.clearUpdateRanges();
      this.buffer.addUpdateRange(0, count * MARKER_STRIDE);
      this.buffer.needsUpdate = true;
    }
    this.mesh.geometry.instanceCount = count;
    // Nothing to draw is no draw at all, not one of no instances.
    this.mesh.visible = count > 0;
    return count;
  }

  /**
   * A buffer and a geometry big enough for `needed`. A new geometry, not the old one with a
   * bigger array: three sizes a GPU buffer once, and fixes an instanced geometry's maximum
   * instance count the first time it is drawn.
   */
  private grow(needed: number): void {
    this.capacity = grownCapacity(needed, this.capacity);
    this.buffer = instanceBuffer(this.capacity);
    const old = this.mesh.geometry;
    this.mesh.geometry = quadGeometry(this.buffer);
    old.dispose();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    // The maps are markerTexture.ts's, shared, and outlive this.
    this.mesh.material.dispose();
  }
}
