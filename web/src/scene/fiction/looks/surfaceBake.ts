import * as THREE from 'three';

import { renderDemand } from '../../../core/renderDemand.ts';
import { NOISE_GLSL } from './noise.ts';
import { type AlphaStorage, type SurfaceImageSet, prebakedFiles } from './prebakedSurfaces.ts';

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
 * that GPU for the jungle's land: in one frame, a visible stall. So it is baked in tiles, as
 * many a frame as fit a budget of GPU time, each frame asking for the next (renderDemand), and
 * the world is drawn in its flat stand-in colour until the last tile is in. The budget is in
 * milliseconds, not texels: where the GPU can time itself (EXT_disjoint_timer_query_webgl2)
 * each frame's tiles are timed, and the next frame bakes as many as that cost per texel fits --
 * so a cheap look bakes in a few frames and a costly one never holds a frame past the budget.
 * Without the timer, a look's own texel count a frame.
 *
 * **Or not baked at all.** Where the world's surface was baked ahead of time into images
 * (prebakedSurfaces.ts), they are fetched instead, a 32-texel preview first, and copied into the
 * same cube maps by a pass that only reads them -- no noise, no compile to speak of. The bake
 * here is the fallback, for a look changed since its images were made.
 *
 * **Compiled first, off the frame.** The bake's shader is the expensive one to compile, and
 * three compiles on first draw, holding the page. It is compiled with `compileAsync` for the
 * render target it draws into (a program for the canvas would be another), outside the frame's
 * render -- compile inside it clears the render state the frame is using -- and baking starts
 * in the frame after it is ready.
 */

/** Texels a cube face is baked at by default: at a world filling a 1080-line screen, a texel a pixel. */
export const BAKE_FACE_SIZE = 1024;

/** Texels baked per frame until the bake's cost is measured: a quarter of a 1,024 face, about 5 ms on the integrated GPU measured. */
export const BAKE_TEXELS_PER_FRAME = 512 * 512;

/** GPU time a frame's bake may take, once its cost is measured: a frame stays under about 8 ms with the rest. */
export const BAKE_FRAME_MS = 6;

/** A tile's side: the unit the budget is counted in. */
const TILE = 64;


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

/**
 * The copy from images: a face's colour, and its alpha from where the images keep it -- none (1),
 * a grayscale image (byte), sixteen bits over two channels (word), or the colour image's own
 * alpha (the preview strip). Read texel for texel, unfiltered: a word's two bytes must not blend.
 */
const DECODE_FRAGMENT = /* glsl */ `
  uniform sampler2D uColour;
  uniform sampler2D uAlpha;
  uniform int uAlphaMode;
  uniform float uSize;
  uniform vec2 uStrip;

  void main() {
    vec2 uv = gl_FragCoord.xy / uSize;
    uv.x = uStrip.x + uv.x * uStrip.y;
    vec4 colour = texture2D(uColour, uv);
    float a = 1.0;
    if (uAlphaMode == 1) {
      a = texture2D(uAlpha, uv).r;
    } else if (uAlphaMode == 2) {
      vec2 word = floor(texture2D(uAlpha, uv).rg * 255.0 + 0.5);
      a = (word.x * 256.0 + word.y) / 65535.0;
    } else if (uAlphaMode == 3) {
      a = colour.a;
    }
    gl_FragColor = vec4(colour.rgb, a);
  }
`;

const ALPHA_MODE: Record<AlphaStorage | 'strip', number> = { none: 0, byte: 1, word: 2, strip: 3 };

/** A bitmap as a texture read texel for texel. */
function dataTexture(bitmap: ImageBitmap): THREE.Texture {
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Where a bake may find its world already baked, and what to tell the material as it goes. */
export interface BakeImages {
  /** The images, or null: then it is baked here. */
  find(): Promise<SurfaceImageSet | null>;
  /** A first, coarse surface is in: these cube maps for now. */
  onPreview(textures: THREE.CubeTexture[]): void;
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
  /** Texels baked a frame until the cost is measured; BAKE_TEXELS_PER_FRAME when absent. */
  readonly texelsPerFrame?: number;
}

type TimerExtension = { readonly TIME_ELAPSED_EXT: number; readonly GPU_DISJOINT_EXT: number };

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
  #state: 'new' | 'finding' | 'loading' | 'compiling' | 'baking' | 'done' | 'disposed' = 'new';
  readonly #images: BakeImages | null;
  /** Images arrived and waiting for a frame to copy them in. */
  #previewIn: { readonly strip: ImageBitmap; readonly storage: AlphaStorage }[] | null = null;
  #facesIn: { colour: readonly ImageBitmap[]; alpha: readonly ImageBitmap[] | null; storage: AlphaStorage }[] | null = null;
  #previewTargets: THREE.WebGLCubeRenderTarget[] = [];
  #decodeMaterial: THREE.ShaderMaterial | null = null;
  /** The next tile: layer, face and position folded into one count. */
  #next = 0;
  readonly #tile: number;
  readonly #texelsPerFrame: number;
  readonly #tilesPerFace: number;
  readonly #onDone: () => void;
  /** Measured GPU milliseconds a texel, once a frame's tiles have been timed. */
  #msPerTexel: number | null = null;
  /** Tiles baked in the last frame that baked: the next may bake at most half as many again. */
  #lastTiles = 0;
  /** Frames' timer queries not yet read back, with the texels each covered. */
  #pending: { query: WebGLQuery; texels: number }[] = [];

  constructor(
    source: BakeSource,
    uniforms: Record<string, THREE.IUniform>,
    onDone: () => void,
    faceSize = BAKE_FACE_SIZE,
    images: BakeImages | null = null,
  ) {
    this.#onDone = onDone;
    this.#images = images;
    this.#texelsPerFrame = source.texelsPerFrame ?? BAKE_TEXELS_PER_FRAME;
    this.#tile = Math.min(TILE, faceSize);
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

  /** The cube maps' render targets, for the generator that reads them back (web/scripts). */
  get targets(): readonly THREE.WebGLCubeRenderTarget[] {
    return this.#targets;
  }

  /**
   * Called from the world's draw (inside the frame's render): bakes this frame's tiles, or
   * starts the compile that must come first. Asks for the next frame while there is more.
   */
  step(renderer: THREE.WebGLRenderer): void {
    if (this.#state === 'new') {
      if (this.#images !== null) {
        this.#state = 'finding';
        this.#images.find().then(
          (set) => (set === null ? this.#bakeHere() : this.#load(set)),
          () => this.#bakeHere(),
        );
        return;
      }
      this.#bakeHere();
      return;
    }
    if (this.#state === 'loading') {
      this.#copyIn(renderer);
      return;
    }
    if (this.#state === 'compiling' && this.#needsCompile) {
      this.#needsCompile = false;
      // Not here: compiling inside the frame's render would end the render state it is using.
      setTimeout(() => this.#compile(renderer), 0);
      return;
    }
    if (this.#state !== 'baking') return;
    renderDemand.request(1);
    if (renderer.info.render.frame === frameTaken) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
    if (timer !== null) this.#readTimers(gl, timer);
    // The frame's budget: what the measured cost fits in BAKE_FRAME_MS, or the look's own count.
    const tileTexels = this.#tile ** 2;
    const budget = this.#msPerTexel === null ? this.#texelsPerFrame : BAKE_FRAME_MS / this.#msPerTexel;
    // Growing by half at most a frame: a look's cost varies across the sphere, and a cheap stretch
    // read back would otherwise send the next frame into a costly one at full stride.
    const fits = Math.max(1, Math.floor(budget / tileTexels));
    const tiles = this.#lastTiles === 0 ? fits : Math.min(fits, Math.ceil(this.#lastTiles * 1.5));
    // Timed only when nothing else is timing: queries of one kind cannot nest.
    const query = timer !== null && gl.getQuery(timer.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === null ? gl.createQuery() : null;
    if (query !== null) gl.beginQuery(timer!.TIME_ELAPSED_EXT, query);
    let baked = 0;
    for (; baked < tiles && this.#state === 'baking'; baked += 1) this.#bakeTile(renderer);
    this.#lastTiles = baked;
    if (query !== null) {
      gl.endQuery(timer!.TIME_ELAPSED_EXT);
      this.#pending.push({ query, texels: baked * tileTexels });
    }
    // After the tiles' own renders, which count as frames too.
    frameTaken = renderer.info.render.frame;
  }

  /** Reads back the timed frames that are ready: the cost a texel. */
  #readTimers(gl: WebGL2RenderingContext, timer: TimerExtension): void {
    const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT) as boolean;
    while (this.#pending.length > 0) {
      const { query, texels } = this.#pending[0]!;
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) !== true) break;
      this.#pending.shift();
      const ms = (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6;
      gl.deleteQuery(query);
      if (disjoint || texels === 0 || ms <= 0) continue;
      // Up at once, down slowly: a costlier stretch of the sphere is met in the next frame, a
      // cheaper one trusted only as it lasts.
      const cost = ms / texels;
      const known = this.#msPerTexel;
      this.#msPerTexel = known === null || cost > known ? cost : 0.7 * known + 0.3 * cost;
    }
  }

  /** No images: bake it here, from the next frame on. */
  #bakeHere(): void {
    if (this.#state !== 'new' && this.#state !== 'finding') return;
    this.#state = 'compiling';
    // Not inside the frame's render: compiling there would end the render state it is using.
    // The compile needs the renderer, which the next step brings.
    this.#needsCompile = true;
    renderDemand.request(1);
  }

  #needsCompile = false;

  /** Images found: fetch the preview and the faces, each copied in by the next frame after it lands. */
  #load(set: SurfaceImageSet): void {
    if (this.#state !== 'finding') return;
    this.#state = 'loading';
    set.preview().then(
      (strips) => {
        if (this.#state !== 'loading') return strips.forEach(({ strip }) => strip.close());
        this.#previewIn = strips;
        renderDemand.request(1);
      },
      () => {},
    );
    set.faces().then(
      (layers) => {
        if (this.#state !== 'loading') return layers.forEach((layer) => [...layer.colour, ...(layer.alpha ?? [])].forEach((b) => b.close()));
        this.#facesIn = layers.map((layer) => ({ colour: layer.colour, alpha: layer.alpha, storage: layer.storage }));
        renderDemand.request(1);
      },
      // The images failed to come: bake it here after all.
      () => {
        if (this.#state !== 'loading') return;
        this.#state = 'finding';
        this.#bakeHere();
      },
    );
  }

  /** Copies whatever images have landed into cube maps: the preview's small ones, or the real ones. */
  #copyIn(renderer: THREE.WebGLRenderer): void {
    if (this.#facesIn !== null) {
      const layers = this.#facesIn;
      this.#facesIn = null;
      this.#previewIn?.forEach(({ strip }) => strip.close());
      this.#previewIn = null;
      layers.forEach((layer, i) => {
        const target = this.#targets[i]!;
        for (let face = 0; face < 6; face += 1) {
          this.#decode(renderer, target, face, layer.colour[face]!, layer.alpha?.[face] ?? null, layer.storage, [0, 1]);
        }
        [...layer.colour, ...(layer.alpha ?? [])].forEach((bitmap) => bitmap.close());
      });
      for (const target of this.#previewTargets) target.dispose();
      this.#previewTargets = [];
      this.#decodeMaterial?.dispose();
      this.#decodeMaterial = null;
      this.#state = 'done';
      this.#onDone();
      return;
    }
    if (this.#previewIn !== null && this.#previewTargets.length === 0) {
      const strips = this.#previewIn;
      this.#previewIn = null;
      this.#previewTargets = strips.map(({ strip }) => {
        const target = new THREE.WebGLCubeRenderTarget(prebakedFiles.previewSize, {
          generateMipmaps: true,
          minFilter: THREE.LinearMipmapLinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
        });
        for (let face = 0; face < 6; face += 1) this.#decode(renderer, target, face, strip, null, 'strip', [face / 6, 1 / 6]);
        strip.close();
        return target;
      });
      this.#images?.onPreview(this.#previewTargets.map((target) => target.texture));
    }
  }

  /** One face of `target` from images: the colour, and the alpha as stored. */
  #decode(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLCubeRenderTarget,
    face: number,
    colour: ImageBitmap,
    alpha: ImageBitmap | null,
    storage: AlphaStorage | 'strip',
    strip: [number, number],
  ): void {
    this.#decodeMaterial ??= new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: DECODE_FRAGMENT,
      uniforms: {
        uColour: { value: null },
        uAlpha: { value: null },
        uAlphaMode: { value: 0 },
        uSize: { value: 1 },
        uStrip: { value: new THREE.Vector2(0, 1) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const material = this.#decodeMaterial;
    const colourTexture = dataTexture(colour);
    const alphaTexture = alpha === null ? null : dataTexture(alpha);
    material.uniforms['uColour']!.value = colourTexture;
    material.uniforms['uAlpha']!.value = alphaTexture ?? colourTexture;
    material.uniforms['uAlphaMode']!.value = ALPHA_MODE[storage];
    material.uniforms['uSize']!.value = target.width;
    (material.uniforms['uStrip']!.value as THREE.Vector2).set(strip[0], strip[1]);
    this.#mesh.material = material;
    target.scissorTest = false;
    // Mipmaps once, after the last face.
    target.texture.generateMipmaps = face === 5;
    const previous = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousLevel = renderer.getActiveMipmapLevel();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(target, face);
    renderer.render(this.#scene, this.#camera);
    renderer.setRenderTarget(previous, previousFace, previousLevel);
    renderer.autoClear = autoClear;
    colourTexture.dispose();
    alphaTexture?.dispose();
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
    for (const target of this.#previewTargets) target.dispose();
    this.#decodeMaterial?.dispose();
    this.#pending = [];
    for (const target of this.#targets) target.dispose();
    for (const material of this.#materials) material.dispose();
    this.#geometry.dispose();
  }
}
