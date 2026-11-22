import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { renderDemand } from '../core/renderDemand.ts';

import {
  GLOW_DISPLAY_GLSL,
  GLOW_LAYER,
  GLOW_MAX,
  HALF_DISPLAY_STEP,
  haloLevels,
  haloShares,
  milkyWayGlow,
  shownGlows,
  WHITE_X,
} from './glowBuffer.ts';
import { GlowStill } from './glowStill.ts';
import { askedFor, compiledFor, compileFor, drawnIntoGlow, materialsOf } from './shaderPrecompile.ts';
import { ViewMotion } from './viewMotion.ts';

/**
 * The glow buffer laid over the frame, once (glowBuffer.ts for what and why).
 *
 * A quad over the screen, drawn first among the opaque things as the Milky Way's glow was:
 * every body is drawn over it, the stars add on top. Just before it is drawn, from its own
 * onBeforeRender, it fills what it shows:
 *
 * 1. the glows -- the objects drawn into the glow (glowBuffer.ts drawIntoGlow), through this
 *    frame's camera, on GLOW_LAYER -- into a half-float buffer the canvas's size, added. Found
 *    by a walk of the scene that tests only each object's visibility and layer (shownGlows) and
 *    drawn under a root of their own, not by rendering the whole scene a second time: three
 *    would update every matrix in the scene again, which the frame's render has just done, and
 *    put every object through its culling to keep the few dozen that are glows -- a millisecond
 *    and more of the main thread at the galactic scales. While the camera moves, the
 *    ray-marched volumes among them -- the Clouds' and the giants', a full-screen march each --
 *    go into a buffer of half the size each way instead, added back as it is read
 *    (viewMotion.ts): a quarter of their cost, and the first still frame has them in full again;
 * 2. the light each pixel holds past WHITE_X, the Milky Way's buffer added in, into the first
 *    level of a pyramid, halving down to haloLevels; then back up, each level's share of the
 *    wing (haloShares) added as it goes;
 * 3. then the quad itself: the light kept, the core's share of the excess, the halo, one
 *    shoulder, the sRGB encode (glowDisplay) and half a display step of dither among the
 *    display values; a pixel under half a step, rounding to black, not drawn at all.
 *
 * Nested inside the frame's render, as three's Reflector draws its mirror: the frame's own
 * uniforms are set by then, whichever component set them.
 *
 * **Step 1 is kept when nothing in it changed** (glowStill.ts): the camera, the buffer and every
 * input of every glow the same to the bit, the buffers already hold what drawing them again
 * would make -- at real time, from the Local Group out, that is nearly every frame. Steps 2 and
 * 3 are drawn every time: they read the Milky Way's buffer, which keeps or redraws itself
 * (MilkyWay.tsx), and cost a millisecond or two.
 *
 * **A glow is drawn once its program for the buffer is compiled** (shaderPrecompile.ts). One
 * whose program has not been compiled for the glow -- a layer's object made and shown in the
 * same frame -- is left out of the buffer, its compile started off the main thread, and drawn
 * in the frame after it is done: it comes in a moment late instead of holding the page while
 * its shader compiles. Everything mounted is compiled ahead in idle moments (ShaderWarmup.tsx),
 * so this is the exception.
 */

/** Every pass's vertex: a quad over its target. */
const PASS_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Down (glowBuffer.ts haloPyramid). The first level from the glow itself, a 2 x 2 box by texel
 * fetches, each texel's excess past WHITE_X taken first, the Milky Way's buffer added to it;
 * every later level a 4 x 4 box at stride 2, as four bilinear taps on the corners between
 * texels, each the mean of the four about it.
 */
const DOWN_FRAGMENT = /* glsl */ `
uniform sampler2D uSource;
uniform sampler2D uMilkyWay;
uniform float uMilkyWayOn;
uniform sampler2D uVolumes;
uniform float uVolumesOn;
uniform float uFirst;
uniform vec2 uSourceSize;

vec3 excess(ivec2 at) {
  ivec2 c = min(at, ivec2(uSourceSize) - 1);
  vec3 x = texelFetch(uSource, c, 0).rgb;
  vec2 uv = (vec2(c) + 0.5) / uSourceSize;
  x += uVolumesOn * texture2D(uVolumes, uv).rgb;
  x = min(x + uMilkyWayOn * texture2D(uMilkyWay, uv).rgb, vec3(${GLOW_MAX.toFixed(1)}));
  float peak = max(x.r, max(x.g, x.b));
  return peak > ${WHITE_X.toFixed(6)} ? x * (1.0 - ${WHITE_X.toFixed(6)} / peak) : vec3(0.0);
}

void main() {
  vec2 base = 2.0 * floor(gl_FragCoord.xy);
  if (uFirst > 0.5) {
    ivec2 b = ivec2(base);
    gl_FragColor = vec4(0.25 * (excess(b) + excess(b + ivec2(1, 0)) + excess(b + ivec2(0, 1)) + excess(b + ivec2(1, 1))), 1.0);
    return;
  }
  vec2 texel = 1.0 / uSourceSize;
  gl_FragColor = vec4(0.25 * (
    texture2D(uSource, base * texel).rgb +
    texture2D(uSource, (base + vec2(2.0, 0.0)) * texel).rgb +
    texture2D(uSource, (base + vec2(0.0, 2.0)) * texel).rgb +
    texture2D(uSource, (base + vec2(2.0, 2.0)) * texel).rgb
  ), 1.0);
}
`;

/** The tent: four bilinear taps half a texel of `source` off each diagonal (glowBuffer.ts upsample). */
const TENT_GLSL = /* glsl */ `
vec3 tent(sampler2D source, vec2 uv, vec2 texel) {
  vec2 h = 0.5 * texel;
  return 0.25 * (
    texture2D(source, uv + vec2(-h.x, -h.y)).rgb +
    texture2D(source, uv + vec2(h.x, -h.y)).rgb +
    texture2D(source, uv + vec2(-h.x, h.y)).rgb +
    texture2D(source, uv + vec2(h.x, h.y)).rgb
  );
}
`;

/** Up: the level below, tented, plus this level's share of the wing. */
const UP_FRAGMENT = /* glsl */ `
uniform sampler2D uLower;
uniform vec2 uLowerTexel;
uniform float uHasLower;
uniform sampler2D uLevel;
uniform float uShare;
varying vec2 vUv;
${TENT_GLSL}
void main() {
  vec3 lower = uHasLower > 0.5 ? tent(uLower, vUv, uLowerTexel) : vec3(0.0);
  gl_FragColor = vec4(lower + uShare * texture2D(uLevel, vUv).rgb, 1.0);
}
`;

/** The quad over the frame: kept light, the core's share of the excess, the halo; one shoulder, encoded for the display. */
const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D uGlow;
uniform sampler2D uMilkyWay;
uniform float uMilkyWayOn;
uniform sampler2D uVolumes;
uniform float uVolumesOn;
uniform sampler2D uHalo;
uniform vec2 uHaloTexel;
uniform float uCore;
uniform float uOn;
varying vec2 vUv;
${TENT_GLSL}
${GLOW_DISPLAY_GLSL}
void main() {
  if (uOn < 0.5) discard;
  vec3 x = texture2D(uGlow, vUv).rgb + uVolumesOn * texture2D(uVolumes, vUv).rgb;
  x = min(x + uMilkyWayOn * texture2D(uMilkyWay, vUv).rgb, vec3(${GLOW_MAX.toFixed(1)}));
  float peak = max(x.r, max(x.g, x.b));
  vec3 kept = peak > ${WHITE_X.toFixed(6)} ? x * (${WHITE_X.toFixed(6)} / peak) : x;
  vec3 total = kept + uCore * (x - kept) + tent(uHalo, vUv, uHaloTexel);
  // The shoulder's linear light, encoded as the stars' is: display values from here on.
  vec3 shown = glowDisplay(total);
  // Under half a display step it rounds to black: not drawn, so the dither adds nothing there.
  if (max(shown.r, max(shown.g, shown.b)) < ${HALF_DISPLAY_STEP.toPrecision(6)}) discard;
  // Half a display step of noise: a faint gradient in 8 bits is otherwise rings.
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(max(shown + (n - 0.5) / 255.0, 0.0), 1.0);
}
`;

function halfFloatTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
}

const scratchSize = new THREE.Vector2();

export function GlowComposite() {
  const passes = useMemo(() => {
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    quadScene.add(quad);
    const down = new THREE.ShaderMaterial({
      uniforms: {
        uSource: { value: null },
        uMilkyWay: { value: null },
        uMilkyWayOn: { value: 0 },
        uVolumes: { value: null },
        uVolumesOn: { value: 0 },
        uFirst: { value: 0 },
        uSourceSize: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: PASS_VERTEX,
      fragmentShader: DOWN_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const up = new THREE.ShaderMaterial({
      uniforms: {
        uLower: { value: null },
        uLowerTexel: { value: new THREE.Vector2() },
        uHasLower: { value: 0 },
        uLevel: { value: null },
        uShare: { value: 0 },
      },
      vertexShader: PASS_VERTEX,
      fragmentShader: UP_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    // The glows' own root: its children are this frame's list, set before each draw. Its
    // matrices are not updated -- the frame's render has just updated every one of them.
    const root = new THREE.Scene();
    root.matrixWorldAutoUpdate = false;
    return {
      quadScene,
      quadCamera,
      quad,
      down,
      up,
      glow: halfFloatTarget(),
      volumes: halfFloatTarget(),
      downs: [] as THREE.WebGLRenderTarget[],
      ups: [] as THREE.WebGLRenderTarget[],
      root,
      glows: [] as THREE.Object3D[],
      volumeList: [] as THREE.Object3D[],
      motion: new ViewMotion(),
      still: new GlowStill(),
      /** Glows left out until their program for the buffer is compiled; see the header. */
      waiting: new Set<THREE.Object3D>(),
      /** The passes' own programs asked for: once. */
      passesCompiled: false,
    };
  }, []);

  const composite = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uGlow: { value: passes.glow.texture },
        uMilkyWay: { value: null },
        uMilkyWayOn: { value: 0 },
        uVolumes: { value: passes.volumes.texture },
        uVolumesOn: { value: 0 },
        uHalo: { value: null },
        uHaloTexel: { value: new THREE.Vector2() },
        uCore: { value: 1 },
        uOn: { value: 0 },
      },
      vertexShader: PASS_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      // With the opaque things, first: every body is drawn over the glow behind it, and the
      // stars add over it (see MilkyWay.tsx, where this quad used to be).
      transparent: false,
      toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    quad.renderOrder = -2;
    return quad;
  }, [passes]);

  useEffect(() => {
    const uniforms = (composite.material as THREE.ShaderMaterial).uniforms;
    composite.onBeforeRender = (renderer, scene, camera) => {
      // The volumes apart only while the camera moves; still, every glow in one buffer as before.
      const moving = passes.motion.moved(camera);
      shownGlows(scene, passes.glows, passes.volumeList, moving);
      // Not drawn until compiled for the buffer: the frame callback below starts the compile,
      // which cannot run here, inside the frame's render -- a frame asked for it to run in. One
      // already compiling asks for its own frame when it is done.
      if (holdUncompiled(passes.glows, passes.waiting) + holdUncompiled(passes.volumeList, passes.waiting) > 0) {
        renderDemand.request(1);
      }
      const on =
        (milkyWayGlow.on && milkyWayGlow.texture !== null) || passes.glows.length > 0 || passes.volumeList.length > 0;
      uniforms['uOn']!.value = on ? 1 : 0;
      if (!on) {
        return;
      }
      fill(renderer, camera, passes, uniforms);
    };
    return () => {
      composite.onBeforeRender = () => {};
    };
  }, [composite, passes]);

  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useFrame(({ camera }) => {
    if (!passes.passesCompiled) {
      passes.passesCompiled = true;
      // The halo's own passes, into the pyramid's targets: compiled ahead too, as the glows are.
      const quads = [passes.down, passes.up].map((material) => new THREE.Mesh(passes.quad.geometry, material));
      void compileFor(gl, passes.quadCamera, passes.quadScene, quads, 'glow');
    }
    if (passes.waiting.size === 0) return;
    const asked: THREE.Object3D[] = [];
    for (const object of passes.waiting) {
      if (materialsOf(object).some((material) => !askedFor(material, 'glow'))) asked.push(object);
    }
    passes.waiting.clear();
    if (asked.length > 0) {
      void compileFor(gl, camera, scene, asked, 'glow').then(() => renderDemand.request());
    }
  });

  useEffect(
    () => () => {
      composite.geometry.dispose();
      (composite.material as THREE.Material).dispose();
      passes.quad.geometry.dispose();
      passes.down.dispose();
      passes.up.dispose();
      passes.glow.dispose();
      passes.volumes.dispose();
      passes.root.children = [];
      for (const target of [...passes.downs, ...passes.ups]) target.dispose();
    },
    [composite, passes],
  );

  return <primitive object={composite} />;
}

interface Passes {
  readonly quadScene: THREE.Scene;
  readonly quadCamera: THREE.Camera;
  readonly quad: THREE.Mesh;
  readonly down: THREE.ShaderMaterial;
  readonly up: THREE.ShaderMaterial;
  readonly glow: THREE.WebGLRenderTarget;
  readonly volumes: THREE.WebGLRenderTarget;
  readonly downs: THREE.WebGLRenderTarget[];
  readonly ups: THREE.WebGLRenderTarget[];
  readonly root: THREE.Scene;
  readonly glows: THREE.Object3D[];
  readonly volumeList: THREE.Object3D[];
  readonly still: GlowStill;
}

/** Each object drawn with a glow, on the glow's layer: the glow, and any of its children on it. */
function eachDrawnGlow(root: THREE.Object3D, callback: (object: THREE.Object3D) => void): void {
  root.traverseVisible((object) => {
    if (drawnIntoGlow(object) && materialsOf(object).length > 0) callback(object);
  });
}

/**
 * Takes out of `glows` each one with a program not yet compiled for the buffer (see the header),
 * and into `waiting` those whose compile is still to be started. Returns how many of those.
 */
function holdUncompiled(glows: THREE.Object3D[], waiting: Set<THREE.Object3D>): number {
  let kept = 0;
  let toStart = 0;
  for (const glow of glows) {
    let ready = true;
    eachDrawnGlow(glow, (object) => {
      for (const material of materialsOf(object)) {
        if (compiledFor(material, 'glow')) continue;
        ready = false;
        if (!askedFor(material, 'glow') && !waiting.has(object)) {
          waiting.add(object);
          toStart += 1;
        }
      }
    });
    if (ready) glows[kept++] = glow;
  }
  glows.length = kept;
  return toStart;
}

/** Step 1 of the header: the glows into their buffer, and the volumes into theirs if apart. */
function drawGlows(renderer: THREE.WebGLRenderer, camera: THREE.Camera, passes: Passes, width: number, height: number): void {
  const mask = camera.layers.mask;
  camera.layers.set(GLOW_LAYER);
  renderer.setRenderTarget(passes.glow);
  renderer.clear(true, false, false);
  passes.root.children = passes.glows;
  renderer.render(passes.root, camera);
  if (passes.volumeList.length > 0) {
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 2));
    if (passes.volumes.width !== w || passes.volumes.height !== h) passes.volumes.setSize(w, h);
    renderer.setRenderTarget(passes.volumes);
    renderer.clear(true, false, false);
    passes.root.children = passes.volumeList;
    renderer.render(passes.root, camera);
  }
  passes.root.children = [];
  camera.layers.mask = mask;
}

/** Steps 1 and 2 of the header, into the passes' buffers; the composite's uniforms pointed at them. */
function fill(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  passes: Passes,
  uniforms: Record<string, THREE.IUniform>,
): void {
  const size = renderer.getDrawingBufferSize(scratchSize);
  const width = Math.max(1, Math.round(size.x));
  const height = Math.max(1, Math.round(size.y));
  const count = haloLevels(width, height);
  if (passes.glow.width !== width || passes.glow.height !== height || passes.downs.length !== count) {
    passes.still.forget();
    passes.glow.setSize(width, height);
    let w = width;
    let h = height;
    for (let k = 0; k < count; k += 1) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      for (const list of [passes.downs, passes.ups]) {
        if (list[k] === undefined) list[k] = halfFloatTarget();
        list[k]!.setSize(w, h);
      }
    }
    for (const list of [passes.downs, passes.ups]) {
      while (list.length > count) list.pop()!.dispose();
    }
  }

  const previous = renderer.getRenderTarget();
  const autoClear = renderer.autoClear;
  const clearColor = renderer.getClearColor(new THREE.Color());
  const clearAlpha = renderer.getClearAlpha();
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);

  // 1. The glows, through this frame's camera, on their layer alone, from their list; the
  // volumes apart, at half the size each way, while the camera moves. Kept as they are when
  // drawing them again would draw the same (see the header).
  const volumes = passes.volumeList.length > 0;
  if (!passes.still.same(camera, width, height, volumes, passes.glows, passes.volumeList)) {
    drawGlows(renderer, camera, passes, width, height);
  }

  // 2. Down the pyramid, the excess first; then up it, each level's share added.
  const mw = milkyWayGlow.on && milkyWayGlow.texture !== null;
  const down = passes.down.uniforms;
  down['uMilkyWay']!.value = milkyWayGlow.texture;
  down['uMilkyWayOn']!.value = mw ? 1 : 0;
  down['uVolumes']!.value = passes.volumes.texture;
  down['uVolumesOn']!.value = volumes ? 1 : 0;
  passes.quad.material = passes.down;
  let source = passes.glow;
  for (let k = 0; k < count; k += 1) {
    down['uSource']!.value = source.texture;
    down['uFirst']!.value = k === 0 ? 1 : 0;
    (down['uSourceSize']!.value as THREE.Vector2).set(source.width, source.height);
    renderer.setRenderTarget(passes.downs[k]!);
    renderer.render(passes.quadScene, passes.quadCamera);
    source = passes.downs[k]!;
  }
  const shares = haloShares(count, renderer.getPixelRatio());
  const up = passes.up.uniforms;
  passes.quad.material = passes.up;
  for (let k = count - 1; k >= 0; k -= 1) {
    const lower = k + 1 < count ? passes.ups[k + 1]! : null;
    up['uLower']!.value = lower === null ? null : lower.texture;
    up['uHasLower']!.value = lower === null ? 0 : 1;
    if (lower !== null) (up['uLowerTexel']!.value as THREE.Vector2).set(1 / lower.width, 1 / lower.height);
    up['uLevel']!.value = passes.downs[k]!.texture;
    up['uShare']!.value = shares.levels[k]!;
    renderer.setRenderTarget(passes.ups[k]!);
    renderer.render(passes.quadScene, passes.quadCamera);
  }

  renderer.setRenderTarget(previous);
  renderer.autoClear = autoClear;
  renderer.setClearColor(clearColor, clearAlpha);

  const top = passes.ups[0]!;
  uniforms['uMilkyWay']!.value = milkyWayGlow.texture;
  uniforms['uMilkyWayOn']!.value = mw ? 1 : 0;
  uniforms['uVolumesOn']!.value = volumes ? 1 : 0;
  uniforms['uHalo']!.value = top.texture;
  (uniforms['uHaloTexel']!.value as THREE.Vector2).set(1 / top.width, 1 / top.height);
  uniforms['uCore']!.value = shares.core;
}
