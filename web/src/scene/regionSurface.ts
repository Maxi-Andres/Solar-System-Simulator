import * as THREE from 'three';

import { projectToScreen } from './screenProjection.ts';

/**
 * What the Solar System's modelled boundaries are drawn with (Heliosphere.tsx, Magnetosphere.tsx):
 * a surface of revolution, faint where it faces the camera and brighter where it is seen edge-on,
 * so that it reads as a surface without hiding what is behind it -- a model, not a wall; and a
 * name placed in the page beside it.
 */

/**
 * A surface of revolution about local +x: `profile(t)` gives the axial coordinate and the distance
 * from the axis at t in [0, 1], and `fade(t)` how much of it is drawn there, 1 to 0 -- a tail whose
 * extent is not known fading out rather than ending at an edge it does not have.
 */
export function revolutionGeometry(
  profile: (t: number) => readonly [number, number],
  fade: (t: number) => number,
  steps: number,
  around: number,
): THREE.BufferGeometry {
  const positions = new Float32Array((steps + 1) * (around + 1) * 3);
  const fades = new Float32Array((steps + 1) * (around + 1));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const [x, rho] = profile(t);
    const f = fade(t);
    for (let j = 0; j <= around; j += 1) {
      const phi = (j / around) * 2 * Math.PI;
      const k = i * (around + 1) + j;
      positions[k * 3] = x;
      positions[k * 3 + 1] = rho * Math.cos(phi);
      positions[k * 3 + 2] = rho * Math.sin(phi);
      fades[k] = f;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < around; j += 1) {
      const a = i * (around + 1) + j;
      const b = a + around + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aFade', new THREE.BufferAttribute(fades, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A smooth step, 0 below `from` and 1 above `to` (or the reverse when to < from). */
export function smoothRamp(value: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

const RIM_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aFade;
varying float vFade;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vFade = aFade;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = -view.xyz;
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
}
`;

const RIM_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFloor;
varying float vFade;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  #include <logdepthbuf_fragment>
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = pow(1.0 - facing, 3.0);
  gl_FragColor = vec4(uColor, uOpacity * vFade * (uFloor + (1.0 - uFloor) * rim));
}
`;

/**
 * The faint, rim-lit material every modelled boundary is drawn with; its opacity set each frame.
 * `floor` is how much of it shows face-on: none for a shell hugging a planet, which would
 * otherwise veil its whole disc.
 */
export function rimMaterial(color: string, floor = 0.05): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: RIM_VERTEX,
    fragmentShader: RIM_FRAGMENT,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uFloor: { value: floor } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** A unit sphere as a surface of revolution, with no fade: the termination shock, the Kármán line. */
export function sphereGeometry(steps = 64, around = 96): THREE.BufferGeometry {
  return revolutionGeometry(
    (t) => [Math.cos(Math.PI * t), Math.sin(Math.PI * t)],
    () => 1,
    steps,
    around,
  );
}

export const REGION_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  left: '0',
  display: 'none',
  fontSize: '0.64rem',
  letterSpacing: '0.12em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};

/** A name in the page over the canvas, styled as the distance rings' are. */
export function makeLabel(container: HTMLElement | null, text: string, color: string): HTMLElement | null {
  if (container === null) return null;
  const element = document.createElement('span');
  Object.assign(element.style, REGION_LABEL_STYLE, { color });
  element.textContent = text;
  container.appendChild(element);
  return element;
}

export function hideLabel(element: HTMLElement | null): void {
  if (element !== null && element.style.display !== 'none') element.style.display = 'none';
}

const scratch = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchForward = new THREE.Vector3();

/**
 * Places a sphere's name: on its right-hand limb as the camera sees it when the camera is outside
 * it, and on the sphere ahead and to the right when inside, where it has no limb. Hidden when off
 * screen. `centre` and `radius` in scene units.
 */
export function placeShellLabel(
  element: HTMLElement | null,
  centre: THREE.Vector3,
  radius: number,
  camera: THREE.Camera,
  size: { readonly width: number; readonly height: number },
  opacity: number,
): void {
  if (element === null) return;
  if (opacity < 0.3) {
    hideLabel(element);
    return;
  }
  scratchRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const fromCentre = camera.position.distanceTo(centre);
  if (fromCentre > radius * 1.02) {
    // The limb: the point of the outline toward the camera's right.
    const ratio = radius / fromCentre;
    scratchForward.copy(camera.position).sub(centre).normalize();
    scratch
      .copy(scratchForward)
      .multiplyScalar(radius * ratio)
      .addScaledVector(scratchRight, radius * Math.sqrt(1 - ratio * ratio))
      .add(centre);
  } else {
    // Inside: where the ray ahead and to the right meets the sphere.
    scratchForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const direction = scratchForward.multiplyScalar(0.8).addScaledVector(scratchRight, 0.45).normalize();
    const o = scratch.copy(camera.position).sub(centre);
    const b = o.dot(direction);
    const c = o.lengthSq() - radius * radius;
    const t = -b + Math.sqrt(Math.max(0, b * b - c));
    scratch.copy(camera.position).addScaledVector(direction, t);
  }
  const onScreen = projectToScreen(scratch, camera, scratch) && Math.abs(scratch.x) <= 0.95 && Math.abs(scratch.y) <= 0.95;
  if (!onScreen) {
    hideLabel(element);
    return;
  }
  if (element.style.display !== 'block') element.style.display = 'block';
  const x = (scratch.x * 0.5 + 0.5) * size.width;
  const y = (-scratch.y * 0.5 + 0.5) * size.height;
  element.style.transform = `translate(${x + 8}px, ${y}px) translateY(-50%)`;
  element.style.opacity = String(Math.min(1, opacity));
}
