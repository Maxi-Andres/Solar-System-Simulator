import type { BodyId, ExoplanetCatalog } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { ExoplanetArchive } from '../core/exoplanetArchive.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { LazySource } from '../core/satellites.ts';
import { julianYearsSinceJ2000, KM_S_TO_PC_PER_YEAR, PARSEC_KM, STARS3D_FROM_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { KM_PER_UNIT } from './scale.ts';
import { splitHigh, splitLow, UNITS_PER_PC } from './stars3dShader.ts';
import { galaxyVisibility } from './MilkyWay.tsx';
import { mapStrength } from './Starfield.tsx';

/**
 * Every star the NASA Exoplanet Archive lists a confirmed planet for, marked on the map
 * (D4b): a faint ring at the star, with a dot on it for each of its planets -- one, two,
 * up to the eight of Kepler-90 -- so how many is seen at a glance and read from nowhere
 * else. One Points object for all 4,800, drawn as the 3D stars are drawn (stars3dShader.ts):
 * float32 parsecs about the Sun, the camera's position split high and low, each host
 * moving on its straight line. A host that is one of the 3D stars has that star's own
 * record here (exoplanets.json), so the ring sits on the point; any other is where the
 * Archive puts it.
 *
 * **A map, like the Star Map's dots**, and shown when the map is: from past the Solar
 * Neighbourhood's threshold, full by ten times it (mapStrength), so it never sits over a
 * planet being looked at. And quieter as the galaxy comes in (galaxyVisibility): from
 * across it four thousand rings are one teal smear along the Kepler field and toward the
 * bulge, where the microlensing planets are, and a smear names nothing. The Exoplanet
 * Hosts layer switches it off.
 *
 * Pointing at a ring names its star and its count; clicking one goes there -- the star made
 * a body, its planets on their orbits (archiveSystems.ts). Picked on the CPU from the same
 * positions, in float64, on a click only: there is no raycast through 4,800 sprites.
 */

/** How much of the rings is left with the whole galaxy in view. */
const GALAXY_FLOOR = 0.25;

/** The sprite's size, CSS pixels: the ring's radius and the planet dots'. */
const SPRITE_PX = 15;
const RING_RADIUS_PX = 4.6;
const DOT_RADIUS_PX = 1.35;
/** How near a click must be to a ring to pick it, CSS pixels. */
export const PICK_RADIUS_PX = 9;
/** A press that moves farther than this is a drag, not a click. */
const CLICK_SLOP_PX = 5;
/** The rings' colour: a quiet teal, apart from any star's blackbody. */
const RING_COLOR = new THREE.Color('#7fc4c0');

/** The markers' buffers, and which host each vertex is. */
export interface HostMarkers {
  readonly count: number;
  /** Parsecs, J2000, scene frame; km/s; planets listed. */
  readonly position: Float32Array;
  readonly velocity: Float32Array;
  readonly planets: Float32Array;
  /** Vertex -> host index in the catalogue. */
  readonly host: Uint32Array;
}

/** One vertex per placed host; a host the Archive could not place has none. */
export function hostMarkers(catalog: ExoplanetCatalog): HostMarkers {
  const { hosts } = catalog;
  const placed: number[] = [];
  for (let h = 0; h < hosts.count; h += 1) {
    if (hosts.x[h] != null && hosts.y[h] != null && hosts.z[h] != null) {
      placed.push(h);
    }
  }
  const position = new Float32Array(placed.length * 3);
  const velocity = new Float32Array(placed.length * 3);
  const planets = new Float32Array(placed.length);
  placed.forEach((h, i) => {
    position[i * 3] = hosts.x[h]!;
    position[i * 3 + 1] = hosts.y[h]!;
    position[i * 3 + 2] = hosts.z[h]!;
    velocity[i * 3] = hosts.vx[h] ?? 0;
    velocity[i * 3 + 1] = hosts.vy[h] ?? 0;
    velocity[i * 3 + 2] = hosts.vz[h] ?? 0;
    planets[i] = hosts.planetCount[h]!;
  });
  return { count: placed.length, position, velocity, planets, host: Uint32Array.from(placed) };
}

/**
 * The marker nearest a point on screen within `radiusPx`, or null: `screen` holds each
 * vertex's CSS-pixel x and y, NaN for one behind the camera.
 */
export function nearestMarker(screen: Float64Array, x: number, y: number, radiusPx: number): number | null {
  let best: number | null = null;
  let bestDistance = radiusPx * radiusPx;
  for (let i = 0; i < screen.length / 2; i += 1) {
    const dx = screen[i * 2]! - x;
    const dy = screen[i * 2 + 1]! - y;
    const d = dx * dx + dy * dy;
    if (d <= bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

const VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uMotion;
uniform float uUnitsPerPc;
uniform float uPixelRatio;

attribute vec3 velocity;
attribute float planets;

varying float vPlanets;

void main() {
  // As the 3D stars' (stars3dShader.ts): the camera's high part, its low part, the motion.
  vec3 rel = ((position - uCameraHigh) - uCameraLow) + velocity * uMotion;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  gl_PointSize = ${SPRITE_PX.toFixed(1)} * uPixelRatio;
  vPlanets = planets;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;

varying float vPlanets;

const float TAU = 6.28318530718;

void main() {
  // CSS pixels from the sprite's centre, y up.
  vec2 p = (gl_PointCoord - 0.5) * vec2(1.0, -1.0) * ${SPRITE_PX.toFixed(1)};
  float r = length(p);
  // The ring: a hairline, faint.
  float ring = 1.0 - smoothstep(0.35, 0.95, abs(r - ${RING_RADIUS_PX.toFixed(2)}));
  // A dot on it for each planet, the first at the top, the rest round clockwise.
  float n = clamp(vPlanets, 1.0, 8.0);
  float step = TAU / n;
  float turn = mod(atan(p.x, p.y) + TAU, TAU);
  float k = floor(turn / step + 0.5);
  float angle = k * step;
  vec2 centre = ${RING_RADIUS_PX.toFixed(2)} * vec2(sin(angle), cos(angle));
  float dot = 1.0 - smoothstep(${(DOT_RADIUS_PX - 0.6).toFixed(2)}, ${(DOT_RADIUS_PX + 0.4).toFixed(2)}, length(p - centre));
  float alpha = max(0.38 * ring, 0.95 * dot) * uFade;
  if (alpha < 0.004) {
    discard;
  }
  gl_FragColor = vec4(uColor, alpha);
}
`;

export interface ExoplanetHostsProps {
  readonly source: LazySource<ExoplanetArchive>;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** A ring clicked: the host's index in the catalogue. */
  readonly onPick: (host: number) => void;
}

const noRaycast = (): void => {};

export function ExoplanetHosts({ source, store, clock, focus, visible, onPick }: ExoplanetHostsProps) {
  const { gl, camera } = useThree();
  const archive = useSyncExternalStore(source.subscribe, () => source.value);
  const groupRef = useRef<THREE.Group>(null);
  const requested = useRef(false);
  // This frame's fade, and the camera about the Sun in parsecs: what picking needs.
  const frame = useRef({ fade: 0, cameraPc: new THREE.Vector3(), jd: 0 });
  // The latest handler, read at the click: the listeners are not rebuilt for a new one.
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const markers = useMemo(() => (archive === null ? null : hostMarkers(archive.catalog)), [archive]);

  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraHigh: { value: new THREE.Vector3() },
      uCameraLow: { value: new THREE.Vector3() },
      uMotion: { value: 0 },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelRatio: { value: 1 },
      uColor: { value: RING_COLOR },
      uFade: { value: 0 },
    }),
    [],
  );
  const points = useMemo(() => {
    if (markers === null) {
      return null;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(markers.position, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(markers.velocity, 3));
    geometry.setAttribute('planets', new THREE.BufferAttribute(markers.planets, 1));
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const object = new THREE.Points(geometry, material);
    object.frustumCulled = false;
    object.raycast = noRaycast;
    return object;
  }, [markers, uniforms]);
  useEffect(() => {
    const group = groupRef.current;
    if (group === null || points === null) {
      return;
    }
    group.add(points);
    renderDemand.request();
    return () => {
      group.remove(points);
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    };
  }, [points]);

  useFrame(({ camera: frameCamera, gl: renderer }) => {
    const group = groupRef.current;
    if (group === null) {
      return;
    }
    const jd = clock.tdbJulianDay;
    const sun = store.stateRelativeTo('sun', focus, jd);
    if (!visible || sun === null) {
      group.visible = false;
      frame.current.fade = 0;
      return;
    }
    const cameraKm = {
      x: frameCamera.position.x * KM_PER_UNIT - sun.position.x,
      y: frameCamera.position.y * KM_PER_UNIT - sun.position.y,
      z: frameCamera.position.z * KM_PER_UNIT - sun.position.z,
    };
    // Asked for once the map could show it, as the 3D stars are (Starfield).
    if (!requested.current && Math.hypot(cameraKm.x, cameraKm.y, cameraKm.z) > STARS3D_FROM_KM) {
      requested.current = true;
      void source.request();
    }
    const fade =
      mapStrength(frameCamera.position.length() * KM_PER_UNIT) *
      (1 - (1 - GALAXY_FLOOR) * galaxyVisibility(Math.hypot(cameraKm.x, cameraKm.y, cameraKm.z)));
    frame.current.fade = fade;
    frame.current.jd = jd;
    group.visible = fade > 0 && points !== null;
    if (!group.visible) {
      return;
    }
    group.position.copy(frameCamera.position);
    const cameraPc = frame.current.cameraPc.set(cameraKm.x, cameraKm.y, cameraKm.z).multiplyScalar(1 / PARSEC_KM);
    (uniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(cameraPc.x), splitHigh(cameraPc.y), splitHigh(cameraPc.z));
    (uniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(cameraPc.x), splitLow(cameraPc.y), splitLow(cameraPc.z));
    uniforms['uMotion']!.value = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
    uniforms['uPixelRatio']!.value = renderer.getPixelRatio();
    uniforms['uFade']!.value = fade;
  });

  // Pointing and clicking: every marker projected through the camera, in float64, when
  // the pointer moves or clicks over the canvas -- never in the frame loop.
  useEffect(() => {
    if (markers === null) {
      return;
    }
    const element = gl.domElement;
    const tip = document.createElement('div');
    Object.assign(tip.style, TIP_STYLE);
    element.parentElement?.appendChild(tip);
    const screen = new Float64Array(markers.count * 2);
    const scratch = new THREE.Vector3();
    const inverse = new THREE.Quaternion();
    const project = (): void => {
      const { cameraPc, jd } = frame.current;
      const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
      camera.updateMatrixWorld();
      // Into the camera's own axes by its rotation alone: the marker is already taken
      // from the camera, and at a thousand parsecs the depth a projection matrix works
      // out with a one-metre near plane is 1 to every digit a double has.
      inverse.copy(camera.quaternion).invert();
      const e = camera.projectionMatrix.elements;
      const rect = element.getBoundingClientRect();
      for (let i = 0; i < markers.count; i += 1) {
        const at = (axis: number, originPc: number): number =>
          markers.position[i * 3 + axis]! + markers.velocity[i * 3 + axis]! * motion - originPc;
        scratch.set(at(0, cameraPc.x), at(1, cameraPc.y), at(2, cameraPc.z)).applyQuaternion(inverse);
        // In front is -z in the camera's axes.
        const depth = -scratch.z;
        screen[i * 2] = depth > 0 ? ((e[0]! * scratch.x) / depth + 1) * 0.5 * rect.width : Number.NaN;
        screen[i * 2 + 1] = depth > 0 ? (1 - (e[5]! * scratch.y) / depth) * 0.5 * rect.height : Number.NaN;
      }
    };
    const pick = (event: PointerEvent): number | null => {
      if (frame.current.fade < 0.2) {
        return null;
      }
      project();
      const rect = element.getBoundingClientRect();
      return nearestMarker(screen, event.clientX - rect.left, event.clientY - rect.top, PICK_RADIUS_PX);
    };
    let down: { x: number; y: number } | null = null;
    let pending = false;
    let lastMove: PointerEvent | null = null;
    const onDown = (event: PointerEvent): void => {
      down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event: PointerEvent): void => {
      const start = down;
      down = null;
      if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
        return;
      }
      const i = pick(event);
      if (i !== null) {
        tip.style.display = 'none';
        pickRef.current(markers.host[i]!);
      }
    };
    const hover = (): void => {
      pending = false;
      const event = lastMove;
      if (event === null || archive === null) {
        return;
      }
      const i = down === null ? pick(event) : null;
      element.style.cursor = i === null ? '' : 'pointer';
      if (i === null) {
        tip.style.display = 'none';
        return;
      }
      const h = markers.host[i]!;
      const count = archive.catalog.hosts.planetCount[h]!;
      tip.textContent = `${archive.catalog.hosts.name[h]} · ${count} planet${count === 1 ? '' : 's'}`;
      tip.style.display = 'block';
      tip.style.transform = `translate(${screen[i * 2]! + 10}px, ${screen[i * 2 + 1]! - 22}px)`;
    };
    const onMove = (event: PointerEvent): void => {
      lastMove = event;
      if (!pending) {
        pending = true;
        requestAnimationFrame(hover);
      }
    };
    const onLeave = (): void => {
      tip.style.display = 'none';
      element.style.cursor = '';
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      element.style.cursor = '';
      tip.remove();
    };
  }, [markers, archive, gl, camera]);

  return <group ref={groupRef} />;
}

const TIP_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  left: '0',
  display: 'none',
  pointerEvents: 'none',
  color: '#9fd6d2',
  fontSize: '0.66rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};
