import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { tracked } from '../core/loading.ts';
import {
  bubbleRadiusPc,
  bubbleSurface,
  isLocalIsmData,
  LIC_CENTRE_PC,
  licRadiusPc,
  licSurface,
  waveMiddle,
  type LocalIsmData,
  type SurfaceMesh,
} from '../core/localInterstellar.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { GALACTIC_BASIS } from './galactic.ts';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';
import { SceneLabels } from './sceneLabels.ts';

/**
 * The Local Interstellar Medium layer (core/localInterstellar.ts): the Local Bubble's shell, the
 * Radcliffe Wave and the Local Interstellar Cloud, about the Sun, each from its paper's numbers.
 *
 * ## Surfaces that are not walls
 *
 * The bubble and the cloud are closed surfaces with the Sun inside. Drawn as light along the
 * line of sight through a thin shell -- brightest where the line grazes it, as a soap bubble
 * is, `1 / |n . v|` capped -- they read as bubbles from outside and fade to almost nothing from
 * within, where every line meets the shell head on. Additive, faint, in muted colours: they are
 * gas and dust too thin to see, and a map of where they are, not a view.
 *
 * Each shows only while it is a size on screen worth showing -- from where it is some tens of
 * pixels across, until it all but fills the view, when it would be a wall of facets -- and the
 * camera inside it sees it fade further. The wave's line fades near its own clouds, through
 * which it would otherwise cut across the view. All in a group at the Sun in parsecs, turned to the scene's axes.
 */

const DATA_URL = (): string => `${import.meta.env.BASE_URL}local-ism/local-ism.json`;

/** Muted colours, linear: the bubble's dust, the wave's clouds, the cloud's warm gas. */
const BUBBLE_COLOUR = new THREE.Color(0.28, 0.21, 0.15);
const WAVE_COLOUR = new THREE.Color(0.42, 0.55, 0.75);
const LIC_COLOUR = new THREE.Color(0.18, 0.3, 0.29);
/** The wave's line: faint, and gone near its own clouds, where it would cross the view. */
const WAVE_LINE_OPACITY = 0.25;
const WAVE_NEAR_GONE_PC = 30;
const WAVE_NEAR_FULL_PC = 150;

/** How much light a head-on shell gives, against a grazing one capped at 1. */
const FACE_ON = 0.12;

/** The names, in order. */
const NAMES = ['Local Bubble', 'Radcliffe Wave', 'Local Interstellar Cloud'] as const;

const SHELL_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = view.xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * view;
    #include <logdepthbuf_vertex>
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColour;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    #include <logdepthbuf_fragment>
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    // A thin shell's path length goes as 1 / cos: grazing it is brightest. Capped, and a little
    // at least, so its face is not quite nothing.
    float grazing = min(1.0, ${FACE_ON.toFixed(3)} / max(facing, 0.02));
    gl_FragColor = vec4(uColour * grazing * uOpacity, 1.0);
  }
`;

const DOT_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float size;
  uniform float uPixelsPerUnit;
  varying float vFaint;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    // A cloud's spread at its distance, in pixels: at least a few, at most a few dozen.
    float px = size * uPixelsPerUnit / max(-view.z, 1e-6);
    gl_PointSize = clamp(px, 3.0, 40.0);
    // Light spread over a disc: fainter as it grows.
    vFaint = clamp(6.0 / gl_PointSize, 0.15, 1.0);
    gl_Position = projectionMatrix * view;
    #include <logdepthbuf_vertex>
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColour;
  uniform float uOpacity;
  varying float vFaint;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(uColour * exp(-3.0 * r2) * vFaint * uOpacity, 1.0);
  }
`;

function shellMaterial(colour: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColour: { value: colour }, uOpacity: { value: 0 } },
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function surfaceGeometry(mesh: SurfaceMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

/** The group's rotation: heliocentric Galactic axes (pc) into the scene's. */
function galacticMatrix(): THREE.Matrix4 {
  const { x, y, z } = GALACTIC_BASIS;
  return new THREE.Matrix4().set(x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0, 0, 0, 0, 1);
}

interface Built {
  readonly bubble: THREE.Mesh;
  readonly wave: THREE.Line;
  readonly clouds: THREE.Points;
  readonly bubbleTop: THREE.Vector3;
  readonly waveMiddle: THREE.Vector3;
  /** The bubble's mean radius, the wave's half-length, pc. */
  readonly bubbleRadius: number;
  readonly waveHalf: number;
  /** The wave's model points, pc, Galactic axes. */
  readonly wavePoints: readonly THREE.Vector3[];
}

export function LocalInterstellar({ store, clock, focus, visible, showLabels }: FeatureProps) {
  const { camera, size, gl } = useThree();
  const group = useMemo(() => {
    const made = new THREE.Group();
    made.matrixAutoUpdate = false;
    return made;
  }, []);
  const rotation = useMemo(galacticMatrix, []);
  // The LIC needs no file: its nine numbers are in the code.
  const lic = useMemo(() => {
    const mesh = new THREE.Mesh(surfaceGeometry(licSurface()), shellMaterial(LIC_COLOUR));
    mesh.frustumCulled = false;
    mesh.visible = false;
    const top = [LIC_CENTRE_PC[0], LIC_CENTRE_PC[1], LIC_CENTRE_PC[2] + licRadiusPc(0, 0, 1)] as const;
    return { mesh, top: new THREE.Vector3(...top), radius: licRadiusPc(1, 0, 0) };
  }, []);
  const built = useRef<Built | null>(null);
  const asked = useRef(false);
  const labels = useRef<SceneLabels | null>(null);
  const scratch = useMemo(() => ({ sun: new THREE.Vector3(), point: new THREE.Vector3(), cameraPc: new THREE.Vector3() }), []);

  useEffect(() => {
    group.add(lic.mesh);
    labels.current = new SceneLabels(gl.domElement, NAMES, 'local-ism');
    return () => {
      labels.current?.dispose();
      labels.current = null;
      group.remove(lic.mesh);
      lic.mesh.geometry.dispose();
      (lic.mesh.material as THREE.Material).dispose();
      const made = built.current;
      if (made !== null) {
        for (const object of [made.bubble, made.wave, made.clouds]) {
          group.remove(object);
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
        built.current = null;
      }
      asked.current = false;
    };
  }, [group, lic, gl]);

  const build = (data: LocalIsmData): void => {
    const bubble = new THREE.Mesh(surfaceGeometry(bubbleSurface(data.bubble)), shellMaterial(BUBBLE_COLOUR));
    const points = data.wave.model.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const wave = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: WAVE_COLOUR, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    const cloudPositions = new Float32Array(data.wave.clouds.length * 3);
    const cloudSizes = new Float32Array(data.wave.clouds.length);
    data.wave.clouds.forEach((cloud, k) => {
      cloudPositions.set([cloud.xyz[0]!, cloud.xyz[1]!, cloud.xyz[2]!], k * 3);
      // Its spread, the mean of the three; at least 10 pc where none is given.
      const spread = (cloud.spread[0]! + cloud.spread[1]! + cloud.spread[2]!) / 3;
      cloudSizes[k] = Math.max(spread, 10) * 2;
    });
    const cloudGeometry = new THREE.BufferGeometry();
    cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
    cloudGeometry.setAttribute('size', new THREE.BufferAttribute(cloudSizes, 1));
    const clouds = new THREE.Points(
      cloudGeometry,
      new THREE.ShaderMaterial({
        uniforms: { uColour: { value: WAVE_COLOUR }, uOpacity: { value: 0 }, uPixelsPerUnit: { value: 1 } },
        vertexShader: DOT_VERTEX,
        fragmentShader: DOT_FRAGMENT,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    for (const object of [bubble, wave, clouds]) {
      object.frustumCulled = false;
      object.visible = false;
      group.add(object);
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    let sum = 0;
    for (const r of data.bubble.radiiPc) sum += r;
    built.current = {
      bubble,
      wave,
      clouds,
      bubbleTop: new THREE.Vector3(0, 0, bubbleRadiusPc(data.bubble, 0, 90)),
      waveMiddle: new THREE.Vector3(...waveMiddle(data.wave)),
      bubbleRadius: sum / data.bubble.radiiPc.length,
      waveHalf: first.distanceTo(last) / 2,
      wavePoints: points,
    };
    renderDemand.request();
  };

  useFrame(() => {
    const hideAll = (): void => {
      lic.mesh.visible = false;
      if (built.current !== null) {
        built.current.bubble.visible = false;
        built.current.wave.visible = false;
        built.current.clouds.visible = false;
      }
      labels.current?.hideAll();
    };
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      hideAll();
      return;
    }
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    scratch.sun.set(sun.position.x / KM_PER_UNIT, sun.position.y / KM_PER_UNIT, sun.position.z / KM_PER_UNIT);
    group.matrix.copy(rotation).scale(new THREE.Vector3(unitsPerPc, unitsPerPc, unitsPerPc)).setPosition(scratch.sun);
    group.matrixWorldNeedsUpdate = true;
    // The camera about the Sun, pc, in Galactic axes.
    const cameraFromSun = scratch.cameraPc.copy(camera.position).sub(scratch.sun).divideScalar(unitsPerPc);
    const { x: gx, y: gy, z: gz } = GALACTIC_BASIS;
    const cx = cameraFromSun.x * gx.x + cameraFromSun.y * gx.y + cameraFromSun.z * gx.z;
    const cy = cameraFromSun.x * gy.x + cameraFromSun.y * gy.y + cameraFromSun.z * gy.z;
    const cz = cameraFromSun.x * gz.x + cameraFromSun.y * gz.y + cameraFromSun.z * gz.z;
    const fromSunPc = Math.hypot(cx, cy, cz);
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const pixelsPerRadian = size.height / ((fov * Math.PI) / 180);
    /** How many pixels a size of `pc` at `distancePc` is. */
    const pixels = (pc: number, distancePc: number): number => (pc / Math.max(distancePc, 1e-9)) * pixelsPerRadian;
    /** How far a shell of this radius on screen fills the view: gone once it is all wall, near it. */
    const fillsView = (radiusPx: number): number => ramp(radiusPx, 0.45 * size.height, 0.9 * size.height);
    const placeName = (index: number, at: THREE.Vector3, opacity: number): void => {
      if (!showLabels || labels.current === null) {
        labels.current?.hide(index);
        return;
      }
      scratch.point.copy(at).applyMatrix4(group.matrix);
      labels.current.place(index, scratch.point, camera, size, opacity);
    };

    // The Local Interstellar Cloud: from where it is a few dozen pixels across, the camera
    // outside it -- inside, its shell is all about the camera, and the Sun is only 0.1 pc in.
    const licDistance = Math.hypot(cx - LIC_CENTRE_PC[0], cy - LIC_CENTRE_PC[1], cz - LIC_CENTRE_PC[2]);
    const licShown = ramp(pixels(lic.radius, licDistance), 12, 40) * ramp(licDistance / lic.radius, 1.1, 2.5) * (1 - fillsView(pixels(lic.radius, licDistance)));
    lic.mesh.visible = licShown > 0;
    (lic.mesh.material as THREE.ShaderMaterial).uniforms.uOpacity!.value = licShown;
    placeName(2, lic.top, licShown);

    const made = built.current;
    if (made === null) {
      // Fetched once anything of it could show: the camera a few parsecs out.
      if (!asked.current && fromSunPc > 2) {
        asked.current = true;
        void tracked(
          'the local interstellar medium',
          fetch(DATA_URL()).then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText)))),
        )
          .then((data: unknown) => {
            if (isLocalIsmData(data)) build(data);
          })
          .catch((error: unknown) => console.error('The local interstellar medium could not be loaded', error));
      }
      labels.current?.hide(0);
      labels.current?.hide(1);
      return;
    }

    // The bubble: once the camera is near its wall or past it, and while it is big enough.
    const bubbleShown =
      ramp(fromSunPc / made.bubbleRadius, 0.5, 1.3) *
      ramp(pixels(made.bubbleRadius, fromSunPc), 15, 45) *
      (1 - fillsView(pixels(made.bubbleRadius, fromSunPc)));
    made.bubble.visible = bubbleShown > 0;
    (made.bubble.material as THREE.ShaderMaterial).uniforms.uOpacity!.value = bubbleShown;
    placeName(0, made.bubbleTop, bubbleShown);

    // The wave: from a few tens of parsecs out to where it is small.
    const toWave = Math.hypot(cx - made.waveMiddle.x, cy - made.waveMiddle.y, cz - made.waveMiddle.z);
    let nearest = Infinity;
    for (const p of made.wavePoints) nearest = Math.min(nearest, Math.hypot(cx - p.x, cy - p.y, cz - p.z));
    const waveShown =
      ramp(fromSunPc, 20, 80) * ramp(pixels(made.waveHalf, toWave), 20, 60) * ramp(nearest, WAVE_NEAR_GONE_PC, WAVE_NEAR_FULL_PC);
    made.wave.visible = waveShown > 0;
    made.clouds.visible = waveShown > 0;
    (made.wave.material as THREE.LineBasicMaterial).opacity = WAVE_LINE_OPACITY * waveShown;
    const cloudUniforms = (made.clouds.material as THREE.ShaderMaterial).uniforms;
    cloudUniforms.uOpacity!.value = waveShown;
    // A parsec's size at a view depth of one unit, pixels: the group's scale times the view's.
    cloudUniforms.uPixelsPerUnit!.value = unitsPerPc * pixelsPerRadian;
    placeName(1, made.waveMiddle, waveShown);
  });

  return <primitive object={group} />;
}
