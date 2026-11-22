import * as THREE from 'three';

/**
 * The basins' fills (Laniakea.tsx FILL_FRAGMENT) drawn at half the resolution each way while the
 * camera moves, and in full, on the canvas as ever, the moment it is still (viewMotion.ts).
 *
 * A fill is a ray march through the basin's field, 48 samples of a 3D texture for every pixel
 * the basin's box covers -- and from Laniakea's view the boxes cover most of the screen, two or
 * three deep. On the integrated GPU it was measured on, a full frame of them was 80 ms: orbiting
 * with the Basins layer on fell from 63 frames a second to 19. The fill is a soft glow, smooth
 * at the scale of a pixel but for its jitter, so a moving frame -- seen for a sixtieth of a
 * second and replaced -- may draw it on a quarter of the pixels: into a buffer half the
 * canvas's size each way, with no lights and nothing to test depth against, laid over the
 * canvas by a quad that adds it, where the fills would have been drawn.
 *
 * Still, the fills are drawn exactly as before, straight onto the canvas in their place among
 * the transparent objects, by the same material: the still picture is the one drawn before,
 * pixel for pixel. Only while moving does the buffer stand in: the blend's sum is taken in half
 * floats before it is added, not after each basin; the jitter and the bilinear upsampling are
 * at the coarser grid; and an opaque object in front of a basin, of which Laniakea's view has
 * none, would not hide it.
 */

/** The share of the canvas's size each way the fills are drawn at while the camera moves. */
export const MOVING_SCALE = 0.5;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const QUAD_FRAGMENT = /* glsl */ `
uniform sampler2D uFill;
varying vec2 vUv;
void main() {
  // What the fills added there, colour and alpha: added to the canvas as they would have added it.
  gl_FragColor = texture2D(uFill, vUv);
}
`;

/** The size of the buffer for a canvas `width` by `height` device pixels. */
export function movingSize(width: number, height: number): [number, number] {
  return [Math.max(1, Math.ceil(width * MOVING_SCALE)), Math.max(1, Math.ceil(height * MOVING_SCALE))];
}

const scratchSize = new THREE.Vector2();
const scratchColor = new THREE.Color();

export class BasinFillPass {
  /** The quad that lays the buffer over the canvas: in the scene, shown while the fills are drawn apart. */
  readonly quad: THREE.Mesh;
  readonly #target: THREE.WebGLRenderTarget;
  /** Draws the fills of the frame into the buffer: its children are set for the moment of the draw. */
  readonly #root = new THREE.Group();
  #fills: THREE.Mesh[] = [];

  constructor() {
    this.#target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { uFill: { value: this.#target.texture } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: QUAD_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquation: THREE.AddEquation,
        toneMapped: false,
      }),
    );
    this.quad.frustumCulled = false;
    this.quad.raycast = () => {};
    // Where the fills are among the transparent objects (Laniakea.tsx basinObjectsFor).
    this.quad.renderOrder = 1;
    this.quad.visible = false;
    this.quad.onBeforeRender = (renderer, _scene, camera) => this.#draw(renderer, camera);
  }

  /**
   * This frame's fills to draw apart, each with its uniforms set: shown by the quad, hidden from
   * the canvas's own pass. An empty list puts the quad away; the caller shows the fills again.
   */
  setFills(fills: readonly THREE.Mesh[]): void {
    this.#fills = fills.slice();
    for (const fill of fills) fill.visible = false;
    this.quad.visible = fills.length > 0;
  }

  #draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const size = renderer.getDrawingBufferSize(scratchSize);
    const [width, height] = movingSize(size.x, size.y);
    if (this.#target.width !== width || this.#target.height !== height) this.#target.setSize(width, height);
    const previous = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    const clearColor = renderer.getClearColor(scratchColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.#target);
    renderer.clear(true, false, false);
    // The fills where the canvas's pass left them, in its order; shown for this draw alone.
    for (const fill of this.#fills) fill.visible = true;
    this.#root.children = this.#fills;
    renderer.render(this.#root, camera);
    this.#root.children = [];
    for (const fill of this.#fills) fill.visible = false;
    renderer.setRenderTarget(previous);
    renderer.autoClear = autoClear;
    renderer.setClearColor(clearColor, clearAlpha);
  }

  dispose(): void {
    this.#target.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }
}
