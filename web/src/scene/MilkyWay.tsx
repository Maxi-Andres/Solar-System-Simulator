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
import { starColor } from './blackbody.ts';
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
 * It fades in as the camera leaves the star catalogue behind, from GALAXY_FROM_LY to
 * GALAXY_FULL_LY from the Sun, and stays out of the neighbourhood of the camera, where a
 * sprite standing for a cloud of a million stars would be a blot rather than a glow.
 *
 * Precision is the 3D stars' (stars3dShader.ts): points are float32 parsecs about the
 * Sun, the group sits at the camera, and the camera about the Sun comes as a float32 pair.
 */

/** The radius each point is drawn with, pc: a little more than the points' spacing in the disc. */
export const POINT_RADIUS_PC = 140;

/** How many points the model is drawn with. */
export const GALAXY_POINTS = 200_000;

/** Light each sprite adds at its centre, before the fade and the shoulder. */
export const GALAXY_POINT_PEAK = 0.035;

/** The glow buffer's size against the canvas's device pixels, each way. */
export const GLOW_SCALE = 0.5;

/** Smallest sprite, glow-buffer pixels; below the size its parsecs would give, light goes instead. */
const MIN_SPRITE_PX = 1.5;
/** Largest sprite, glow-buffer pixels: the near fade has taken a point long before it gets here. */
const MAX_SPRITE_PX = 24;

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
uniform float uPointRadiusPc;
uniform float uPixelsPerRadian;
uniform float uPeak;
uniform float uNearFadePc;

attribute vec3 color;

varying vec3 vColor;
varying float vPeak;

void main() {
  vec3 rel = (position - uCameraHigh) - uCameraLow;
  float distancePc = length(rel);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);

  float diameterPx = 2.0 * uPointRadiusPc / max(distancePc, 1e-3) * uPixelsPerRadian;
  float drawnPx = clamp(diameterPx, ${MIN_SPRITE_PX.toFixed(1)}, ${MAX_SPRITE_PX.toFixed(1)});
  // Below the floor the light goes, not the size: constant flux per point.
  float coverage = min(1.0, (diameterPx * diameterPx) / (drawnPx * drawnPx));
  vPeak = uPeak * coverage * smoothstep(0.5 * uNearFadePc, uNearFadePc, distancePc);
  gl_PointSize = drawnPx;
  vColor = color;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vPeak;

void main() {
  vec2 offset = gl_PointCoord - vec2(0.5);
  // A Gaussian reaching the sprite's edge at 2.5 sigma.
  float r2 = dot(offset, offset) * 25.0;
  float profile = exp(-0.5 * r2);
  if (vPeak * profile < 1.0 / 1024.0) discard;
  gl_FragColor = vec4(vColor * (vPeak * profile), 1.0);
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

function buildGeometry(sample: MilkyWaySample): THREE.BufferGeometry {
  const positions = new Float32Array(sample.count * 3);
  const colors = new Float32Array(sample.count * 3);
  const hues = POPULATIONS.map((population) => displayHue(population.colorIndex));
  for (let i = 0; i < sample.count; i += 1) {
    toEcliptic(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!, positions, i * 3);
    const hue = hues[sample.populations[i]!]!;
    colors[i * 3] = hue[0];
    colors[i * 3 + 1] = hue[1];
    colors[i * 3 + 2] = hue[2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCameraHigh: { value: new THREE.Vector3() },
          uCameraLow: { value: new THREE.Vector3() },
          uUnitsPerPc: { value: PARSEC_KM / KM_PER_UNIT },
          uPointRadiusPc: { value: POINT_RADIUS_PC },
          uPixelsPerRadian: { value: 1 },
          uPeak: { value: 0 },
          uNearFadePc: { value: 0 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      }),
    [],
  );

  const group = useMemo(() => {
    const made = new THREE.Group();
    glowScene.add(made);
    return made;
  }, [glowScene]);

  useEffect(
    () => () => {
      worker.current?.terminate();
      points.current?.geometry.dispose();
      material.dispose();
      target.dispose();
      composite.geometry.dispose();
      (composite.material as THREE.Material).dispose();
    },
    [material, target, composite],
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
      made.onmessage = (event: MessageEvent<MilkyWaySample>) => {
        const cloud = new THREE.Points(buildGeometry(event.data), material);
        cloud.frustumCulled = false;
        group.add(cloud);
        points.current = cloud;
        made.terminate();
        worker.current = null;
        renderDemand.request();
      };
      made.postMessage({ count: GALAXY_POINTS });
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
    uniforms['uNearFadePc']!.value = NEAR_FADE_SHARE * cameraPc.length();

    // The glow, into its buffer, through this frame's camera (CameraRig ran first).
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.clear(true, false, false);
    gl.render(glowScene, camera);
    gl.setRenderTarget(previous);

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
