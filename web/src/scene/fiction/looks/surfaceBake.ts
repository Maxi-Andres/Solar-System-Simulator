import * as THREE from 'three';

import { renderDemand } from '../../../core/renderDemand.ts';
import { NOISE_GLSL } from './noise.ts';

/**
 * A world's procedural surface, worked out once on the GPU into cube maps and sampled after.
 *
 * **Why baked.** Drawn live, a jungle moon filling the screen cost 36 ms of GPU a frame on this
 * project's integrated Radeon (measured with EXT_disjoint_timer_query_webgl2), and the banded
 * giant 22: some forty octaves of 3D noise per pixel, every frame, for a surface that does not
 * change. Baked, the same noise is paid once, and each frame is a texture read and the light.
 *
 * **Why a cube map.** It covers the sphere with no seam and no pinched pole -- the two faults of
 * a latitude-longitude map -- and WebGL 2 filters across its faces seamlessly, mipmaps included,
 * so a world a few pixels across is sampled from a level that averages it rather than shimmering.
 * Each face's texel is the direction it stands for, so the bake runs the look's noise on the
 * same unit directions the live shader did: what is drawn is that noise, sampled.
 *
 * **Spread over frames.** A whole layer at 1,024 a face is 6.3 million texels, about 110 ms of
 * that GPU for the jungle's land: in one frame, a visible stall. So it is baked in tiles of a
 * budget of texels per frame, each frame asking for the next (renderDemand), and the world is
 * drawn in its flat stand-in colour until the last tile is in -- under a second.
 *
 * **Compiled first, off the frame.** The bake's shader is the expensive one to compile, and
 * three compiles on first draw, holding the page. It is compiled with `compileAsync` for the
 * render target it draws into (a program for the canvas would be another), outside the frame's
 * render -- compile inside it clears the render state the frame is using -- and baking starts
 * in the frame after it is ready.
 */

/** Texels a cube face is baked at by default: at a world filling a 1080-line screen, a texel a pixel. */
export const BAKE_FACE_SIZE = 1024;

/** Texels baked per frame: a quarter of a 1,024 face, about 5 ms on the integrated GPU measured. */
export const BAKE_TEXELS_PER_FRAME = 512 * 512;


/**
 * The frame (three's render count) in which some bake last drew a tile. One bake a frame, of
 * all the worlds': thirteen moons coming into view together would otherwise each bake a tile in
 * the same frame, and that frame would take them all. A bake that finds the frame taken asks
 * for the next one and waits its turn.
 */
let frameTaken = -1;

const VERTEX_SHADER = /* glsl */ `
  void main() {
    // One triangle over the whole target: position is already in clip space.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * The bake's fragment shader for one layer: `bakeLayer` (from the look) at the direction this
 * texel of this face stands for, in WebGL's cube map convention, so sampling with that direction
 * reads it back.
 */
export function bakeFragmentShader(lookGlsl: string, layer: number): string {
  return /* glsl */ `
    #include <common>

    uniform int uFace;
    uniform float uFaceSize;

    ${NOISE_GLSL}
    ${lookGlsl}

    vec3 faceDirection(vec2 uv) {
      float sc = 2.0 * uv.x - 1.0;
      float tc = 2.0 * uv.y - 1.0;
      if (uFace == 0) return vec3(1.0, -tc, -sc);
      if (uFace == 1) return vec3(-1.0, -tc, sc);
      if (uFace == 2) return vec3(sc, 1.0, tc);
      if (uFace == 3) return vec3(sc, -1.0, -tc);
      if (uFace == 4) return vec3(sc, -tc, 1.0);
      return vec3(-sc, -tc, -1.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uFaceSize;
      vec3 corner = faceDirection(uv);
      float length2 = dot(corner, corner);
      vec3 direction = corner * inversesqrt(length2);
      // A texel's width on the unit sphere: 2 / size on the face, shrunk by the face's slant.
      float footprint = 2.0 / (uFaceSize * length2);
      gl_FragColor = bakeLayer${layer}(direction, footprint);
    }
  `;
}

/** What a look bakes: GLSL defining `vec4 bakeLayer0(vec3 d, float footprint)` and so on. */
export interface BakeSource {
  readonly glsl: string;
  readonly layers: number;
  /**
   * Half floats rather than bytes: twice the memory, for relief read up close. Eight bits of
   * height magnified come out as terraces, every step a line of shading.
   */
  readonly halfFloat?: boolean;
  /** Texels baked a frame; BAKE_TEXELS_PER_FRAME when absent. */
  readonly texelsPerFrame?: number;
}

const FULL_TRIANGLE = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);

/** One world's bake: its cube maps, and the steps that fill them. */
export class SurfaceBake {
  readonly textures: THREE.CubeTexture[];
  #targets: THREE.WebGLCubeRenderTarget[];
  #materials: THREE.ShaderMaterial[];
  #geometry = new THREE.BufferGeometry();
  #scene = new THREE.Scene();
  #mesh: THREE.Mesh;
  #camera = new THREE.OrthographicCamera();
  #state: 'new' | 'compiling' | 'baking' | 'done' | 'disposed' = 'new';
  /** The next tile: layer, face and position folded into one count. */
  #next = 0;
  readonly #tile: number;
  readonly #texelsPerFrame: number;
  readonly #tilesPerFace: number;
  readonly #onDone: () => void;

  constructor(source: BakeSource, uniforms: Record<string, THREE.IUniform>, onDone: () => void, faceSize = BAKE_FACE_SIZE) {
    this.#onDone = onDone;
    this.#texelsPerFrame = source.texelsPerFrame ?? BAKE_TEXELS_PER_FRAME;
    // Square tiles of a frame's texels, or the whole face if that is smaller.
    this.#tile = Math.min(Math.floor(Math.sqrt(this.#texelsPerFrame)), faceSize);
    this.#tilesPerFace = Math.ceil(faceSize / this.#tile) ** 2;
    this.#geometry.setAttribute('position', new THREE.BufferAttribute(FULL_TRIANGLE, 3));
    this.#targets = [];
    this.#materials = [];
    for (let layer = 0; layer < source.layers; layer += 1) {
      const target = new THREE.WebGLCubeRenderTarget(faceSize, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        type: source.halfFloat === true ? THREE.HalfFloatType : THREE.UnsignedByteType,
      });
      target.texture.name = `fiction-surface-${layer}`;
      this.#targets.push(target);
      this.#materials.push(
        new THREE.ShaderMaterial({
          vertexShader: VERTEX_SHADER,
          fragmentShader: bakeFragmentShader(source.glsl, layer),
          // The look's uniforms themselves, so the bake sees the world's seed.
          uniforms: { ...uniforms, uFace: { value: 0 }, uFaceSize: { value: faceSize } },
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
    }
    this.textures = this.#targets.map((target) => target.texture);
    this.#mesh = new THREE.Mesh(this.#geometry, this.#materials[0]);
    this.#mesh.frustumCulled = false;
    this.#scene.add(this.#mesh);
  }

  get done(): boolean {
    return this.#state === 'done';
  }

  /**
   * Called from the world's draw (inside the frame's render): bakes this frame's tiles, or
   * starts the compile that must come first. Asks for the next frame while there is more.
   */
  step(renderer: THREE.WebGLRenderer): void {
    if (this.#state === 'new') {
      this.#state = 'compiling';
      // Not here: compiling inside the frame's render would end the render state it is using.
      setTimeout(() => this.#compile(renderer), 0);
      return;
    }
    if (this.#state !== 'baking') return;
    renderDemand.request(1);
    if (renderer.info.render.frame === frameTaken) return;
    // Tiles up to the frame's budget: one of a large face, a whole small face or more.
    for (let texels = 0; texels < this.#texelsPerFrame && this.#state === 'baking'; texels += this.#tile ** 2) {
      this.#bakeTile(renderer);
    }
    // After the tiles' own renders, which count as frames too.
    frameTaken = renderer.info.render.frame;
  }

  #compile(renderer: THREE.WebGLRenderer): void {
    if (this.#state !== 'compiling') return;
    // For the render target it draws into: the program for the canvas would be another one.
    const previous = renderer.getRenderTarget();
    const compiles: Promise<unknown>[] = [];
    for (let layer = 0; layer < this.#materials.length; layer += 1) {
      this.#mesh.material = this.#materials[layer]!;
      renderer.setRenderTarget(this.#targets[layer]!);
      try {
        compiles.push(renderer.compileAsync(this.#scene, this.#camera));
      } catch {
        compiles.push(Promise.resolve());
      }
    }
    renderer.setRenderTarget(previous);
    const ready = (): void => {
      if (this.#state !== 'compiling') return;
      this.#state = 'baking';
      renderDemand.request(1);
    };
    Promise.all(compiles).then(ready, ready);
  }

  #bakeTile(renderer: THREE.WebGLRenderer): void {
    const tilesPerLayer = this.#tilesPerFace * 6;
    const layer = Math.floor(this.#next / tilesPerLayer);
    const withinLayer = this.#next % tilesPerLayer;
    const face = Math.floor(withinLayer / this.#tilesPerFace);
    const tile = withinLayer % this.#tilesPerFace;
    const target = this.#targets[layer]!;
    const material = this.#materials[layer]!;
    const size = target.width;
    const side = this.#tile;
    const across = Math.ceil(size / side);
    const x = (tile % across) * side;
    const y = Math.floor(tile / across) * side;
    const lastOfLayer = withinLayer === tilesPerLayer - 1;

    material.uniforms['uFace']!.value = face;
    this.#mesh.material = material;
    target.scissor.set(x, y, Math.min(side, size - x), Math.min(side, size - y));
    target.scissorTest = true;
    // Mipmaps once, after the layer's last tile, not after every one.
    target.texture.generateMipmaps = lastOfLayer;

    const previous = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousLevel = renderer.getActiveMipmapLevel();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(target, face);
    renderer.render(this.#scene, this.#camera);
    renderer.setRenderTarget(previous, previousFace, previousLevel);
    renderer.autoClear = autoClear;

    this.#next += 1;
    if (this.#next >= tilesPerLayer * this.#targets.length) {
      this.#state = 'done';
      this.#onDone();
    }
  }

  dispose(): void {
    this.#state = 'disposed';
    for (const target of this.#targets) target.dispose();
    for (const material of this.#materials) material.dispose();
    this.#geometry.dispose();
  }
}
