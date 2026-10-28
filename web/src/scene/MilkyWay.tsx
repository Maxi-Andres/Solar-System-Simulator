import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  armLabelPoints,
  galacticCentrePc,
  POPULATIONS,
  type MilkyWaySample,
} from '../core/milkyWay.ts';
import type { SimClock } from '../core/time.ts';
import type { FramingView } from '../state/store.ts';
import { cieX, cieY, cieZ, starColor } from './blackbody.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { KM_PER_UNIT, LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { projectToScreen } from './screenProjection.ts';
import { splitHigh, splitLow } from './stars3dShader.ts';

/**
 * The Milky Way model of core/milkyWay.ts, drawn as a glow (D2b).
 *
 * Each sampled point is a soft sprite a fixed number of parsecs across, so the picture has
 * a surface brightness -- the same however far back the camera stands, as a galaxy's has
 * -- until a sprite is down to a pixel and a half, past which it keeps that size and gives
 * up light in proportion to the area it no longer covers. Added, not blended over: light
 * from behind light.
 *
 * ## Drawn small, then laid over the picture
 *
 * A glow of splats costs its overlap: to read as smooth rather than as grain each pixel
 * wants tens of sprites on it, and at full resolution that was 300 million fragments a
 * frame from mid-distance -- 15 frames a second on the integrated GPU it was measured on.
 * A glow has no detail finer than its sprites, so it is drawn into a buffer at a quarter
 * of the canvas's pixels (GLOW_SCALE each way), in half floats so a hundred faint sprites
 * add up without rounding to nothing, and that buffer is laid over the frame first, under
 * everything else, with a soft shoulder (1 - e^-x) instead of a hard clip where the bulge
 * piles up. A quarter of the fragments, and the upsampling's filtering smooths the grain.
 *
 * ## Dust, drawn as what it does
 *
 * The dust (sampleDust) is a second set of points that darken instead of shine: each keeps
 * e^-tau of the light already in the buffer where it falls. Dust only dims what is behind
 * it, so the order matters, and a buffer of added light has none. So the galaxy is drawn
 * in DEPTH_SLICES slabs of distance from the camera, far to near, each in its own pass:
 * first that slab's dust, dimming everything already drawn -- the slabs behind it -- and
 * then that slab's light, added on top. The dust on the far side of the galaxy then
 * leaves the bulge alone, and the dust between the camera and the bulge crosses it, as a
 * lane does in every photograph of an edge-on spiral.
 *
 * Two attempts came before, both order-free and both wrong in the same way. A straight
 * multiply dimmed the stars in front of the dust as hard as those behind, and seen edge-on
 * turned the plane to a black bar ("se ve full negro"); the mixed-slab escape fraction,
 * (1 - e^-tau)/tau, fixed the black but still let dust behind the centre darken it, so the
 * bulge looked to sit behind the disc from every side ("la luz del centro se pone atrÃ¡s
 * de todo") -- Maxi, both 2026-10-28.
 *
 * Inside a slab the light is drawn after its own dust, so it is never dimmed by the dust
 * it is mixed with: an error of half a slab's depth, a few kiloparsecs, where the slabs
 * are thinnest -- across the disc.
 *
 * **The slabs' edges are soft.** With hard ones the light just behind an edge took all
 * the dust of the slab in front and the light just in front of it took none, and that
 * step showed: a dark line across the disc where the edge -- a sphere about the camera --
 * cut it, moving as the camera moved (Maxi, 2026-10-28: "siempre sigue a la cÃ¡mara").
 * So a point within SLAB_BLEND of an edge goes into both slabs, its light and its tau
 * shared between them in proportion -- the two shares adding to the whole, and e^-tau
 * multiplying to the whole -- and the step becomes a ramp a slab wide.
 *
 * It fades in as the camera leaves the star catalogue behind, from GALAXY_FROM_LY to
 * GALAXY_FULL_LY from the Sun, and stays out of the neighbourhood of the camera, where a
 * sprite standing for a cloud of a million stars would be a blot rather than a glow.
 *
 * Precision is the 3D stars' (stars3dShader.ts): points are float32 parsecs about the
 * Sun, the group sits at the camera, and the camera about the Sun comes as a float32 pair.
 */

/** How many points the model's light is drawn with; each population's size is its own. */
export const GALAXY_POINTS = 200_000;

/** Light each sprite adds at its centre, times its population's gain, before the shoulder. */
export const GALAXY_POINT_PEAK = 0.04;

/**
 * How many slabs of depth the galaxy is drawn in, and how far either side of its centre
 * they reach, pc: the disc's radius and some.
 */
export const DEPTH_SLICES = 6;
export const GALAXY_DEPTH_PC = 20_000;

/**
 * Half the width of the ramp across a slab's edge, in slabs: a point this close to an
 * edge is shared between the slabs either side of it.
 */
export const SLAB_BLEND = 0.35;

/** The dust: how many points, how wide each, and the optical depth each adds at its centre. */
export const DUST_POINTS = 80_000;
export const DUST_RADIUS_PC = 200;
export const DUST_TAU = 0.08;

/**
 * The HII regions' colour: hydrogen's two brightest visible lines, H-alpha at 656.28 nm
 * and H-beta at 486.13 nm, at the Balmer decrement of 2.86 that recombination gives at
 * 10,000 K (Osterbrock & Ferland 2006, Case B) -- through the CIE observer to sRGB, as
 * the stars' blackbodies go. The pink every photograph of a nebula has, worked out.
 */
export const BALMER_DECREMENT = 2.86;

/** The glow buffer's size against the canvas's device pixels, each way. */
export const GLOW_SCALE = 0.5;

/** Smallest sprite, glow-buffer pixels; below the size its parsecs would give, light goes instead. */
const MIN_SPRITE_PX = 1.5;
/** Largest sprite, glow-buffer pixels: the near fade has taken a point long before it gets here. */
const MAX_SPRITE_PX = 16;

/** The model fades in between these camera distances from the Sun, light years. */
export const GALAXY_FROM_LY = 1000;
export const GALAXY_FULL_LY = 5000;

/** The sample is asked of the worker from here, so it is in hand before the fade starts. */
export const GALAXY_SAMPLE_FROM_LY = 500;

/**
 * Below this angle between the line of sight and the galactic plane the arms' names go:
 * edge-on, the arms lie along one line and their names pile on top of each other.
 */
const EDGE_ON_LABELS_DEG = 12;

/** Points nearer the camera than this share of its distance from the Sun fade out. */
const NEAR_FADE_SHARE = 0.35;

/**
 * Where the breadcrumb's Milky Way looks from: above the north galactic pole, tipped 20
 * degrees so the disc reads as a disc with a thickness, and turned so the line from the
 * Sun to the centre runs across the frame -- the long way, since the frame is wider than
 * it is tall and the disc reaches 76,000 ly past the centre but only 23,000 behind the
 * Sun. Seen from the north pole the galaxy turns clockwise, as Reid et al. draw it.
 */
export const GALAXY_VIEW: FramingView = (() => {
  const tilt = (20 * Math.PI) / 180;
  const { y, z } = GALACTIC_BASIS;
  const direction = [
    z.x * Math.cos(tilt) - y.x * Math.sin(tilt),
    z.y * Math.cos(tilt) - y.y * Math.sin(tilt),
    z.z * Math.cos(tilt) - y.z * Math.sin(tilt),
  ] as const;
  const up = [
    y.x * Math.cos(tilt) + z.x * Math.sin(tilt),
    y.y * Math.cos(tilt) + z.y * Math.sin(tilt),
    y.z * Math.cos(tilt) + z.z * Math.sin(tilt),
  ] as const;
  return { direction, up };
})();

/** Galaxy visibility, 0 to 1, by the camera's distance from the Sun. */
export function galaxyVisibility(cameraFromSunKm: number): number {
  const ly = cameraFromSunKm / LIGHT_YEAR_KM;
  if (ly <= GALAXY_FROM_LY) return 0;
  if (ly >= GALAXY_FULL_LY) return 1;
  const t = (Math.log(ly) - Math.log(GALAXY_FROM_LY)) / (Math.log(GALAXY_FULL_LY) - Math.log(GALAXY_FROM_LY));
  return t * t * (3 - 2 * t);
}

const VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uPeak;
uniform float uNearFadePc;
// This pass's slab: nearest edge and depth of a slab, pc; its index; how many there are.
// Points outside it wait for theirs; points near an edge go into both (see the header).
uniform vec4 uSlab;

attribute vec3 color;
attribute float radiusPc;

varying vec3 vColor;
varying float vPeak;

void main() {
  vec3 rel = (position - uCameraHigh) - uCameraLow;
  float distancePc = length(rel);
  float u = (distancePc - uSlab.x) / uSlab.y;
  float halfBlend = ${SLAB_BLEND.toFixed(3)};
  float below = uSlab.z < 0.5 ? 1.0 : clamp((u - uSlab.z + halfBlend) / (2.0 * halfBlend), 0.0, 1.0);
  float above = uSlab.z > uSlab.w - 1.5 ? 0.0 : clamp((u - uSlab.z - 1.0 + halfBlend) / (2.0 * halfBlend), 0.0, 1.0);
  float share = below - above;
  if (share <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vPeak = 0.0;
    vColor = vec3(0.0);
    return;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);

  float diameterPx = 2.0 * radiusPc / max(distancePc, 1e-3) * uPixelsPerRadian;
  float drawnPx = clamp(diameterPx, ${MIN_SPRITE_PX.toFixed(1)}, ${MAX_SPRITE_PX.toFixed(1)});
  // Below the floor the light goes, not the size: constant flux per point.
  float coverage = min(1.0, (diameterPx * diameterPx) / (drawnPx * drawnPx));
  vPeak = uPeak * share * coverage * smoothstep(0.5 * uNearFadePc, uNearFadePc, distancePc);
  gl_PointSize = drawnPx;
  vColor = color;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
// 0 for light, added; 1 for dust, which keeps e^-tau of what is behind it.
uniform float uDust;

varying vec3 vColor;
varying float vPeak;

void main() {
  vec2 offset = gl_PointCoord - vec2(0.5);
  // A Gaussian reaching the sprite's edge at 2.5 sigma.
  float r2 = dot(offset, offset) * 25.0;
  float profile = exp(-0.5 * r2);
  if (vPeak * profile < 1.0 / 1024.0) discard;
  float amount = vPeak * profile;
  gl_FragColor = uDust > 0.5 ? vec4(vec3(1.0 - exp(-amount)), 1.0) : vec4(vColor * amount, 1.0);
}
`;

/** The glow buffer over the frame: clip-space quad, soft shoulder, added under everything. */
const COMPOSITE_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uGlow;
varying vec2 vUv;
void main() {
  vec3 light = texture2D(uGlow, vUv).rgb;
  gl_FragColor = vec4(vec3(1.0) - exp(-light), 1.0);
}
`;

const scratchCamera = new THREE.Vector3();
const scratchClear = new THREE.Color();
const scratchPoint = new THREE.Vector3();

/** Galactic-frame parsecs about the Sun to the scene's ecliptic frame. */
function toEcliptic(x: number, y: number, z: number, out: Float32Array | number[], offset: number): void {
  const { x: ex, y: ey, z: ez } = GALACTIC_BASIS;
  out[offset] = ex.x * x + ey.x * y + ez.x * z;
  out[offset + 1] = ex.y * x + ey.y * y + ez.y * z;
  out[offset + 2] = ex.z * x + ey.z * y + ez.z * z;
}

/** A colour index as a display hue: the blackbody colour, brightest channel 1, sRGB. */
function displayHue(colorIndex: number): [number, number, number] {
  const [r, g, b] = starColor(colorIndex);
  const peak = Math.max(r, g, b);
  const encode = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return [encode(r / peak), encode(g / peak), encode(b / peak)];
}

/** An emission spectrum of lines as a display hue: CIE 1931, then sRGB, brightest channel 1. */
export function emissionHue(lines: readonly (readonly [number, number])[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [wavelengthNm, power] of lines) {
    x += power * cieX(wavelengthNm);
    y += power * cieY(wavelengthNm);
    z += power * cieZ(wavelengthNm);
  }
  const linear = [
    Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z),
    Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z),
    Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z),
  ];
  const peak = Math.max(...linear);
  const encode = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return [encode(linear[0]! / peak), encode(linear[1]! / peak), encode(linear[2]! / peak)];
}

/** Hydrogen's visible recombination light: H-alpha to H-beta at the Balmer decrement. */
export const BALMER_HUE = emissionHue([
  [656.28, BALMER_DECREMENT],
  [486.13, 1],
]);

function buildGeometry(sample: MilkyWaySample): THREE.BufferGeometry {
  const positions = new Float32Array(sample.count * 3);
  const colors = new Float32Array(sample.count * 3);
  const radii = new Float32Array(sample.count);
  const looks = POPULATIONS.map((population) => {
    const hue = population.colorIndex === null ? BALMER_HUE : displayHue(population.colorIndex);
    return { color: hue.map((channel) => channel * population.gain), radius: population.radiusPc };
  });
  for (let i = 0; i < sample.count; i += 1) {
    toEcliptic(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!, positions, i * 3);
    const look = looks[sample.populations[i]!]!;
    colors[i * 3] = look.color[0]!;
    colors[i * 3 + 1] = look.color[1]!;
    colors[i * 3 + 2] = look.color[2]!;
    radii[i] = look.radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('radiusPc', new THREE.BufferAttribute(radii, 1));
  return geometry;
}

/** The dust's points: grey, so the multiply darkens every channel alike. */
function buildDustGeometry(dust: Float32Array): THREE.BufferGeometry {
  const count = dust.length / 3;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    toEcliptic(dust[i * 3]!, dust[i * 3 + 1]!, dust[i * 3 + 2]!, positions, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  geometry.setAttribute('radiusPc', new THREE.BufferAttribute(new Float32Array(count).fill(DUST_RADIUS_PC), 1));
  return geometry;
}

/** The names on the model: the Galactic Centre first, then the arms in SPIRAL_ARMS order. */
export const GALAXY_LABELS: readonly string[] = ['Galactic Centre', ...armLabelPoints().map((arm) => arm.name)];

const LABEL_POINTS: readonly number[][] = (() => {
  const [cx, cy, cz] = galacticCentrePc();
  const points = [[cx, cy, cz], ...armLabelPoints().map((arm) => arm.position)];
  return points.map(([x, y, z]) => {
    const out = [0, 0, 0];
    toEcliptic(x!, y!, z!, out, 0);
    return out;
  });
})();

export interface MilkyWayProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** The labels, in GALAXY_LABELS order, owned by the overlay outside the canvas. */
  readonly labels: RefObject<(HTMLElement | null)[]>;
}

export function MilkyWay({ store, clock, focus, visible, labels }: MilkyWayProps) {
  const { camera, size, gl } = useThree();
  const points = useRef<THREE.Points | null>(null);
  const dustPoints = useRef<THREE.Points | null>(null);
  const sampleAsked = useRef(false);
  const worker = useRef<Worker | null>(null);

  // The glow's own scene and buffer; see the header.
  const glowScene = useMemo(() => new THREE.Scene(), []);
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
    [],
  );
  const composite = useMemo(() => {
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uGlow: { value: target.texture } },
        vertexShader: COMPOSITE_VERTEX_SHADER,
        fragmentShader: COMPOSITE_FRAGMENT_SHADER,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      }),
    );
    quad.frustumCulled = false;
    // First of all: the stars and everything else go over it.
    quad.renderOrder = -2;
    quad.visible = false;
    return quad;
  }, [target]);

  // The light and the dust share every uniform but their peak.
  const [material, dustMaterial] = useMemo(() => {
    const shared = {
      uCameraHigh: { value: new THREE.Vector3() },
      uCameraLow: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: PARSEC_KM / KM_PER_UNIT },
      uPixelsPerRadian: { value: 1 },
      uNearFadePc: { value: 0 },
      uSlab: { value: new THREE.Vector4(0, 1e30, 0, 1) },
    };
    const common = { depthWrite: false, transparent: true, toneMapped: false } as const;
    // Light adds.
    const light = new THREE.ShaderMaterial({
      uniforms: { ...shared, uPeak: { value: 0 }, uDust: { value: 0 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      ...common,
    });
    // dst = dst (1 - src) with src = 1 - e^-tau: dust keeps e^-tau of what is behind it.
    const dust = new THREE.ShaderMaterial({
      uniforms: { ...shared, uPeak: { value: 0 }, uDust: { value: 1 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcColorFactor,
      ...common,
    });
    return [light, dust] as const;
  }, []);

  const group = useMemo(() => {
    const made = new THREE.Group();
    glowScene.add(made);
    return made;
  }, [glowScene]);

  useEffect(
    () => () => {
      worker.current?.terminate();
      points.current?.geometry.dispose();
      dustPoints.current?.geometry.dispose();
      material.dispose();
      dustMaterial.dispose();
      target.dispose();
      composite.geometry.dispose();
      (composite.material as THREE.Material).dispose();
    },
    [material, dustMaterial, target, composite],
  );

  useFrame(() => {
    const elements = labels.current;
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    const cameraFromSunKm =
      sun === null
        ? 0
        : scratchCamera
            .set(
              camera.position.x * KM_PER_UNIT - sun.position.x,
              camera.position.y * KM_PER_UNIT - sun.position.y,
              camera.position.z * KM_PER_UNIT - sun.position.z,
            )
            .length();
    // The sample, from the worker, once the camera is on its way out.
    if (!sampleAsked.current && cameraFromSunKm > GALAXY_SAMPLE_FROM_LY * LIGHT_YEAR_KM) {
      sampleAsked.current = true;
      const made = new Worker(new URL('../core/milkyWay.worker.ts', import.meta.url), { type: 'module' });
      worker.current = made;
      made.onmessage = (event: MessageEvent<{ light: MilkyWaySample; dust: Float32Array }>) => {
        const cloud = new THREE.Points(buildGeometry(event.data.light), material);
        cloud.frustumCulled = false;
        // In each slab, after its dust: see the header.
        cloud.renderOrder = 1;
        group.add(cloud);
        points.current = cloud;
        // Before its slab's light, after every slab behind.
        const dust = new THREE.Points(buildDustGeometry(event.data.dust), dustMaterial);
        dust.frustumCulled = false;
        dust.renderOrder = 0;
        group.add(dust);
        dustPoints.current = dust;
        made.terminate();
        worker.current = null;
        renderDemand.request();
      };
      made.postMessage({ count: GALAXY_POINTS, dust: DUST_POINTS });
    }

    const visibility = sun === null || points.current === null ? 0 : galaxyVisibility(cameraFromSunKm);
    if (visibility === 0) {
      composite.visible = false;
      for (const element of elements) {
        hide(element);
      }
      return;
    }

    composite.visible = true;
    group.position.copy(camera.position);
    const cameraPc = scratchCamera.multiplyScalar(1 / PARSEC_KM);
    const uniforms = material.uniforms;
    (uniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(cameraPc.x), splitHigh(cameraPc.y), splitHigh(cameraPc.z));
    (uniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(cameraPc.x), splitLow(cameraPc.y), splitLow(cameraPc.z));
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const width = Math.max(1, Math.round(size.width * gl.getPixelRatio() * GLOW_SCALE));
    const height = Math.max(1, Math.round(size.height * gl.getPixelRatio() * GLOW_SCALE));
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height);
    }
    uniforms['uPixelsPerRadian']!.value = height / (2 * Math.tan((fov * Math.PI) / 360));
    uniforms['uPeak']!.value = GALAXY_POINT_PEAK * visibility;
    dustMaterial.uniforms['uPeak']!.value = DUST_TAU * visibility;
    uniforms['uNearFadePc']!.value = NEAR_FADE_SHARE * cameraPc.length();

    // The glow, into its buffer, through this frame's camera (CameraRig ran first).
    const previous = gl.getRenderTarget();
    gl.getClearColor(scratchClear);
    const clearAlpha = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    // Far to near, slab by slab: see the header. The slabs span the galaxy as seen from
    // here, GALAXY_DEPTH_PC either side of its centre; the first and last run on to
    // nothing and to everything, so no point is left out.
    const centre = LABEL_POINTS[0]!;
    const toCentre = Math.hypot(centre[0]! - cameraPc.x, centre[1]! - cameraPc.y, centre[2]! - cameraPc.z);
    const nearest = Math.max(0, toCentre - GALAXY_DEPTH_PC);
    const step = (toCentre + GALAXY_DEPTH_PC - nearest) / DEPTH_SLICES;
    const slab = uniforms['uSlab']!.value as THREE.Vector4;
    // Each pass draws over the last: the renderer must not clear between them.
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    for (let index = DEPTH_SLICES - 1; index >= 0; index -= 1) {
      slab.set(nearest, step, index, DEPTH_SLICES);
      gl.render(glowScene, camera);
    }
    gl.autoClear = autoClear;
    gl.setRenderTarget(previous);
    gl.setClearColor(scratchClear, clearAlpha);

    // The names: the Sun's place plus each label's parsecs, in scene units.
    camera.updateMatrixWorld();
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    // How far out of the plane the camera looks from, as seen from the Sun.
    const pole = GALACTIC_BASIS.z;
    const outOfPlane = Math.abs(
      (scratchCamera.x * pole.x + scratchCamera.y * pole.y + scratchCamera.z * pole.z) / scratchCamera.length(),
    );
    const edgeOn = outOfPlane < Math.sin((EDGE_ON_LABELS_DEG * Math.PI) / 180);
    LABEL_POINTS.forEach((point, index) => {
      const element = elements[index] ?? null;
      if (element === null) {
        return;
      }
      // The Galactic Centre keeps its name from any side; the arms only off the plane.
      if (visibility < 0.5 || (edgeOn && index > 0)) {
        hide(element);
        return;
      }
      scratchPoint.set(
        sun!.position.x / KM_PER_UNIT + point[0]! * unitsPerPc,
        sun!.position.y / KM_PER_UNIT + point[1]! * unitsPerPc,
        sun!.position.z / KM_PER_UNIT + point[2]! * unitsPerPc,
      );
      const onScreen =
        projectToScreen(scratchPoint, camera, scratchPoint) &&
        Math.abs(scratchPoint.x) <= 1 &&
        Math.abs(scratchPoint.y) <= 1;
      if (!onScreen) {
        hide(element);
        return;
      }
      if (element.style.display !== 'block') {
        element.style.display = 'block';
      }
      const x = (scratchPoint.x * 0.5 + 0.5) * size.width;
      const y = (-scratchPoint.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      element.style.opacity = String(visibility);
    });
  });

  return <primitive object={composite} />;
}

function hide(element: HTMLElement | null | undefined): void {
  if (element != null && element.style.display !== 'none') {
    element.style.display = 'none';
  }
}
