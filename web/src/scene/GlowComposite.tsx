import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import {
  anyGlow,
  GLOW_LAYER,
  GLOW_MAX,
  haloLevels,
  haloShares,
  milkyWayGlow,
  WHITE_X,
} from './glowBuffer.ts';

/**
 * The glow buffer laid over the frame, once (glowBuffer.ts for what and why).
 *
 * A quad over the screen, drawn first among the opaque things as the Milky Way's glow was:
 * every body is drawn over it, the stars add on top. Just before it is drawn, from its own
 * onBeforeRender, it fills what it shows:
 *
 * 1. the glows -- the scene again, through this frame's camera, on GLOW_LAYER alone -- into a
 *    half-float buffer the canvas's size, added;
 * 2. the light each pixel holds past WHITE_X, the Milky Way's buffer added in, into the first
 *    level of a pyramid, halving down to haloLevels; then back up, each level's share of the
 *    wing (haloShares) added as it goes;
 * 3. then the quad itself: the light kept, the core's share of the excess, the halo, one
 *    shoulder and half a display step of dither.
 *
 * Nested inside the frame's render, as three's Reflector draws its mirror: the frame's own
 * uniforms are set by then, whichever component set them.
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
uniform float uFirst;
uniform vec2 uSourceSize;

vec3 excess(ivec2 at) {
  ivec2 c = min(at, ivec2(uSourceSize) - 1);
  vec3 x = texelFetch(uSource, c, 0).rgb;
  vec2 uv = (vec2(c) + 0.5) / uSourceSize;
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

/** The quad over the frame: kept light, the core's share of the excess, the halo; one shoulder. */
const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D uGlow;
uniform sampler2D uMilkyWay;
uniform float uMilkyWayOn;
uniform sampler2D uHalo;
uniform vec2 uHaloTexel;
uniform float uCore;
uniform float uOn;
varying vec2 vUv;
${TENT_GLSL}
void main() {
  if (uOn < 0.5) discard;
  vec3 x = min(texture2D(uGlow, vUv).rgb + uMilkyWayOn * texture2D(uMilkyWay, vUv).rgb, vec3(${GLOW_MAX.toFixed(1)}));
  float peak = max(x.r, max(x.g, x.b));
  vec3 kept = peak > ${WHITE_X.toFixed(6)} ? x * (${WHITE_X.toFixed(6)} / peak) : x;
  vec3 total = kept + uCore * (x - kept) + tent(uHalo, vUv, uHaloTexel);
  vec3 light = vec3(1.0) - exp(-total);
  if (max(light.r, max(light.g, light.b)) < 0.0005) discard;
  // Half a display step of noise: a faint gradient in 8 bits is otherwise rings.
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(max(light + (n - 0.5) / 255.0, 0.0), 1.0);
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
    return {
      quadScene,
      quadCamera,
      quad,
      down,
      up,
      glow: halfFloatTarget(),
      downs: [] as THREE.WebGLRenderTarget[],
      ups: [] as THREE.WebGLRenderTarget[],
    };
  }, []);

  const composite = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uGlow: { value: passes.glow.texture },
        uMilkyWay: { value: null },
        uMilkyWayOn: { value: 0 },
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
      const on = anyGlow();
      uniforms['uOn']!.value = on ? 1 : 0;
      if (!on) {
        return;
      }
      fill(renderer, scene, camera, passes, uniforms);
    };
    return () => {
      composite.onBeforeRender = () => {};
    };
  }, [composite, passes]);

  useEffect(
    () => () => {
      composite.geometry.dispose();
      (composite.material as THREE.Material).dispose();
      passes.quad.geometry.dispose();
      passes.down.dispose();
      passes.up.dispose();
      passes.glow.dispose();
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
  readonly downs: THREE.WebGLRenderTarget[];
  readonly ups: THREE.WebGLRenderTarget[];
}

/** Steps 1 and 2 of the header, into the passes' buffers; the composite's uniforms pointed at them. */
function fill(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  passes: Passes,
  uniforms: Record<string, THREE.IUniform>,
): void {
  const size = renderer.getDrawingBufferSize(scratchSize);
  const width = Math.max(1, Math.round(size.x));
  const height = Math.max(1, Math.round(size.y));
  const count = haloLevels(width, height);
  if (passes.glow.width !== width || passes.glow.height !== height || passes.downs.length !== count) {
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

  // 1. The glows, through this frame's camera, on their layer alone.
  const mask = camera.layers.mask;
  camera.layers.set(GLOW_LAYER);
  renderer.setRenderTarget(passes.glow);
  renderer.clear(true, false, false);
  renderer.render(scene, camera);
  camera.layers.mask = mask;

  // 2. Down the pyramid, the excess first; then up it, each level's share added.
  const mw = milkyWayGlow.on && milkyWayGlow.texture !== null;
  const down = passes.down.uniforms;
  down['uMilkyWay']!.value = milkyWayGlow.texture;
  down['uMilkyWayOn']!.value = mw ? 1 : 0;
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
  uniforms['uHalo']!.value = top.texture;
  (uniforms['uHaloTexel']!.value as THREE.Vector2).set(1 / top.width, 1 / top.height);
  uniforms['uCore']!.value = shares.core;
}
