import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { formatPeriod, NEUTRON_STAR_COLOR, type PulsarArchive } from '../core/pulsars.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { LazySource } from '../core/satellites.ts';
import { julianYearsSinceJ2000, KM_S_TO_PC_PER_YEAR, PARSEC_KM, STARS3D_FROM_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { nearestMarker, PICK_RADIUS_PX } from './ExoplanetHosts.tsx';
import { KM_PER_UNIT } from './scale.ts';
import { splitHigh, splitLow, UNITS_PER_PC } from './stars3dShader.ts';
import { mapStrength } from './Starfield.tsx';

/**
 * Every pulsar pulsars.json places, and the magnetars, marked (D6a): a small dot in a
 * neutron star's colour, a magnetar's with a ring about it. One Points object for all of
 * them, drawn and picked as the Exoplanet Archive's hosts are (ExoplanetHosts.tsx): float32
 * parsecs about the Sun, the camera split high and low, each on its straight line.
 *
 * **A map**, shown where the map is -- past the Solar Neighbourhood's threshold, full by ten
 * times it (mapStrength) -- and, unlike the hosts' rings, kept with the galaxy in view: the
 * pulsars are spread through the disc, most of them thousands of parsecs out, and from
 * across the galaxy where they are is what there is to see of them. A neutron star is
 * twelve kilometres of nearly dark: no dot here is its light, and the marker is the same
 * size at any distance. The Pulsars layer switches them off.
 *
 * Pointing at one names it and its period; clicking one goes there, the pulsar made a body
 * of its real size (pulsars.ts).
 */

/** The sprite's size, CSS pixels; the dot's radius and a magnetar's ring's. */
const SPRITE_PX = 11;
const DOT_RADIUS_PX = 1.3;
const RING_RADIUS_PX = 4;
/** A press that moves farther than this is a drag, not a click. */
const CLICK_SLOP_PX = 5;

/** The markers' buffers. Vertex k is pulsar k: every entry in pulsars.json is placed. */
interface PulsarMarkers {
  readonly count: number;
  readonly position: Float32Array;
  readonly velocity: Float32Array;
  readonly magnetar: Float32Array;
}

function pulsarMarkers(archive: PulsarArchive): PulsarMarkers {
  const p = archive.catalog.pulsars;
  const position = new Float32Array(p.count * 3);
  const velocity = new Float32Array(p.count * 3);
  const magnetar = new Float32Array(p.count);
  for (let k = 0; k < p.count; k += 1) {
    position.set([p.x[k]!, p.y[k]!, p.z[k]!], k * 3);
    velocity.set([p.vx[k]!, p.vy[k]!, p.vz[k]!], k * 3);
    magnetar[k] = p.magnetar[k] ? 1 : 0;
  }
  return { count: p.count, position, velocity, magnetar };
}

const VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uMotion;
uniform float uUnitsPerPc;
uniform float uPixelRatio;

attribute vec3 velocity;
attribute float magnetar;

varying float vMagnetar;

void main() {
  // As the 3D stars' (stars3dShader.ts): the camera's high part, its low part, the motion.
  vec3 rel = ((position - uCameraHigh) - uCameraLow) + velocity * uMotion;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  gl_PointSize = ${SPRITE_PX.toFixed(1)} * uPixelRatio;
  vMagnetar = magnetar;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;

varying float vMagnetar;

void main() {
  // CSS pixels from the sprite's centre.
  float r = length(gl_PointCoord - 0.5) * ${SPRITE_PX.toFixed(1)};
  float dot = 1.0 - smoothstep(${(DOT_RADIUS_PX - 0.5).toFixed(2)}, ${(DOT_RADIUS_PX + 0.5).toFixed(2)}, r);
  float ring = vMagnetar * (1.0 - smoothstep(0.3, 0.9, abs(r - ${RING_RADIUS_PX.toFixed(2)})));
  // Thousands of them lie along the disc: each faint enough that the arms show through.
  float alpha = max(0.6 * dot, 0.5 * ring) * uFade;
  if (alpha < 0.004) {
    discard;
  }
  gl_FragColor = vec4(uColor, alpha);
}
`;

export interface PulsarsProps {
  readonly source: LazySource<PulsarArchive>;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** A marker clicked: the pulsar's entry in pulsars.json. */
  readonly onPick: (k: number) => void;
}

const noRaycast = (): void => {};

export function Pulsars({ source, store, clock, focus, visible, onPick }: PulsarsProps) {
  const { gl, camera } = useThree();
  const archive = useSyncExternalStore(source.subscribe, () => source.value);
  const groupRef = useRef<THREE.Group>(null);
  const requested = useRef(false);
  const frame = useRef({ fade: 0, cameraPc: new THREE.Vector3(), jd: 0 });
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const markers = useMemo(() => (archive === null ? null : pulsarMarkers(archive)), [archive]);

  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraHigh: { value: new THREE.Vector3() },
      uCameraLow: { value: new THREE.Vector3() },
      uMotion: { value: 0 },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelRatio: { value: 1 },
      // Written to the screen as is, with no conversion in the shader: the hex's own values.
      uColor: { value: new THREE.Color().setStyle(NEUTRON_STAR_COLOR, THREE.LinearSRGBColorSpace) },
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
    geometry.setAttribute('magnetar', new THREE.BufferAttribute(markers.magnetar, 1));
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
    if (!requested.current && Math.hypot(cameraKm.x, cameraKm.y, cameraKm.z) > STARS3D_FROM_KM) {
      requested.current = true;
      void source.request();
    }
    const fade = mapStrength(frameCamera.position.length() * KM_PER_UNIT);
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

  // Pointing and clicking, as the hosts' rings: every marker projected in float64, on the
  // pointer's events only.
  useEffect(() => {
    if (markers === null || archive === null) {
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
      inverse.copy(camera.quaternion).invert();
      const e = camera.projectionMatrix.elements;
      const rect = element.getBoundingClientRect();
      for (let i = 0; i < markers.count; i += 1) {
        const at = (axis: number, originPc: number): number =>
          markers.position[i * 3 + axis]! + markers.velocity[i * 3 + axis]! * motion - originPc;
        scratch.set(at(0, cameraPc.x), at(1, cameraPc.y), at(2, cameraPc.z)).applyQuaternion(inverse);
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
    // Whether the pointer cursor is this layer's to take back: the hosts' rings set it too.
    let pointing = false;
    const setPointing = (on: boolean): void => {
      if (on !== pointing) {
        element.style.cursor = on ? 'pointer' : '';
        pointing = on;
      }
    };
    const onDown = (event: PointerEvent): void => {
      down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event: PointerEvent): void => {
      const start = down;
      down = null;
      if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
        return;
      }
      const k = pick(event);
      if (k !== null) {
        tip.style.display = 'none';
        pickRef.current(k);
      }
    };
    const hover = (): void => {
      pending = false;
      const event = lastMove;
      if (event === null) {
        return;
      }
      const k = down === null ? pick(event) : null;
      setPointing(k !== null);
      if (k === null) {
        tip.style.display = 'none';
        return;
      }
      tip.textContent = pulsarTip(archive, k);
      tip.style.display = 'block';
      tip.style.transform = `translate(${screen[k * 2]! + 10}px, ${screen[k * 2 + 1]! - 22}px)`;
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
      setPointing(false);
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
      setPointing(false);
      tip.remove();
    };
  }, [markers, archive, gl, camera]);

  return <group ref={groupRef} />;
}

/** "Crab Pulsar · 33.4 ms", "SGR 1806-20 · magnetar · 7.56 s". */
export function pulsarTip(archive: PulsarArchive, k: number): string {
  const p = archive.catalog.pulsars;
  const period = p.periodS[k];
  return [p.name[k], p.magnetar[k] ? 'magnetar' : null, period == null ? null : formatPeriod(period)]
    .filter((part) => part !== null)
    .join(' · ');
}

const TIP_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  left: '0',
  display: 'none',
  pointerEvents: 'none',
  color: '#cbd2ff',
  fontSize: '0.66rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};
