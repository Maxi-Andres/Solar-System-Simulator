import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { whenIdle } from '../core/idle.ts';
import { beginLoading } from '../core/loading.ts';
import { NEBULA_COLOR, NEBULAE, nebulaBodyId, nebulaRadiusKm, nebulaReach, type Nebula } from '../core/nebulae.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { drawIntoGlow, releaseFromGlow } from './glowBuffer.ts';
import { hasNebulaGain, nebulaGain, nebulaMaterial } from './nebulaVolume.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { hasRemnantNoise, provideRemnantNoise } from './remnantVolume.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';

/**
 * The nebulae (core/nebulae.ts): each one's glowing gas, a volume the camera can fly round and
 * into (nebulaVolume.ts), and from far off a ring of its size, as a supernova remnant's
 * (SupernovaRemnants.tsx): a mark where the gas is too small to see, giving way to the gas as it
 * grows on screen. Their names are the bodies' (nebulae.ts ensureNebulae).
 */

const SEGMENTS = 96;
const HIDDEN_PX = 4;
const SHOWN_PX = 14;
/** The gas fades in between these radii on screen, pixels. */
const GAS_HIDDEN_PX = 3;
const GAS_SHOWN_PX = 12;
/**
 * A long exposure's brightness is shown only once the camera has gone toward a nebula: from
 * where it is FAR_RATIO times nearer than the Sun is, full by NEAR_RATIO. From the Sun's side --
 * the Solar System, the nearby stars -- it is FROM_HOME of that, a faint patch on the sky, as
 * the few seen by eye are; its size on the sky the same either way.
 */
const FAR_RATIO = 1.5;
const NEAR_RATIO = 6;
const FROM_HOME = 0.04;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

/** How much of a long exposure's brightness a nebula is drawn at, by how near the camera has come (see FROM_HOME). */
export function exposureShare(sunToNebulaKm: number, cameraToNebulaKm: number): number {
  const ratio = sunToNebulaKm / Math.max(cameraToNebulaKm, 1e-9);
  const t = ramp(Math.log(ratio), Math.log(FAR_RATIO), Math.log(NEAR_RATIO));
  return FROM_HOME + (1 - FROM_HOME) * t * t * (3 - 2 * t);
}

interface Drawn {
  readonly nebula: Nebula;
  readonly ring: THREE.LineLoop;
  readonly radiusKm: number;
  readonly reach: number;
  /** Its gas, made the first time it could show once the noise is here. */
  gas: THREE.Mesh | null;
}

export function Nebulae({ store, clock, focus, visible, showIcons }: FeatureProps) {
  const { camera, size, gl, scene } = useThree();
  const group = useMemo(() => new THREE.Group(), []);
  // Made here, added by the effect: a memo may run twice (StrictMode).
  const drawn = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let k = 0; k < SEGMENTS; k += 1) {
      const a = (k / SEGMENTS) * 2 * Math.PI;
      points.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const gasGeometry = new THREE.SphereGeometry(1, 48, 24);
    const entries: Drawn[] = NEBULAE.map((nebula) => {
      const material = new THREE.LineBasicMaterial({
        color: NEBULA_COLOR[nebula.kind],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const ring = new THREE.LineLoop(ringGeometry, material);
      ring.frustumCulled = false;
      ring.visible = false;
      return { nebula, ring, radiusKm: nebulaRadiusKm(nebula), reach: nebulaReach(nebula), gas: null };
    });
    return { entries, ringGeometry, gasGeometry };
  }, []);
  // The noise the gas is clumped by: the remnants' worker's if it has made it, or this layer's own
  // worker's (nebulaNoise.worker.ts); with no workers, made here when first wanted.
  const made = useMemo(
    () => ({
      worker: null as Worker | null,
      loading: null as (() => void) | null,
      failed: false,
      compileTarget: new THREE.WebGLRenderTarget(1, 1),
    }),
    [],
  );
  const noiseReady = (): boolean => {
    if (hasRemnantNoise() || made.failed) return true;
    if (made.worker === null) {
      try {
        const worker = new Worker(new URL('./nebulaNoise.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<Uint8Array>) => {
          provideRemnantNoise(event.data);
          worker.terminate();
          made.worker = null;
          made.loading?.();
          renderDemand.request();
        };
        worker.onerror = (error) => {
          console.error('The nebulae’s noise worker failed; making it here', error);
          worker.terminate();
          made.worker = null;
          made.failed = true;
          made.loading?.();
          renderDemand.request();
        };
        made.worker = worker;
        made.loading = beginLoading('the nebulae');
        worker.postMessage(null);
      } catch {
        made.failed = true;
        return true;
      }
    }
    return false;
  };
  /** Into the glow once its shader is compiled beside the page, as the remnants' gas is. */
  const show = (entry: Drawn, mesh: THREE.Mesh): void => {
    const add = (): void => {
      if (entry.gas !== mesh) return;
      drawIntoGlow(mesh);
      group.add(mesh);
      renderDemand.request();
    };
    const previous = gl.getRenderTarget();
    let compiled: Promise<unknown>;
    try {
      gl.setRenderTarget(made.compileTarget);
      compiled = gl.compileAsync(mesh, camera, scene);
    } catch {
      compiled = Promise.resolve();
    } finally {
      gl.setRenderTarget(previous);
    }
    compiled.then(add, add);
  };

  // Each nebula's brightness scale -- a few hundred thousand samples of its parts -- worked out
  // one nebula at a time while the page is idle, long after the first view, so its gas never
  // waits on it; one shown sooner works its own out then (nebulaVolume.ts nebulaGain).
  useEffect(() => {
    let cancel: () => void = () => {};
    const warm = (index: number): void => {
      const nebula = NEBULAE[index];
      if (nebula === undefined) return;
      cancel = whenIdle(() => {
        nebulaGain(nebula);
        warm(index + 1);
      }, 10_000);
    };
    warm(0);
    return () => cancel();
  }, []);

  useEffect(() => {
    for (const { ring } of drawn.entries) group.add(ring);
    return () => {
      made.worker?.terminate();
      made.worker = null;
      made.loading?.();
      made.compileTarget.dispose();
      for (const entry of drawn.entries) {
        group.remove(entry.ring);
        (entry.ring.material as THREE.Material).dispose();
        if (entry.gas !== null) {
          group.remove(entry.gas);
          releaseFromGlow(entry.gas);
          (entry.gas.material as THREE.Material).dispose();
          entry.gas = null;
        }
      }
      drawn.ringGeometry.dispose();
      drawn.gasGeometry.dispose();
    };
  }, [group, drawn, made]);

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const sun = visible ? store.stateRelativeTo('sun', focus, jd) : null;
    for (const entry of drawn.entries) {
      const { nebula, ring, radiusKm, reach } = entry;
      const state = visible ? store.stateRelativeTo(nebulaBodyId(nebula), focus, jd) : null;
      if (state === null) {
        ring.visible = false;
        if (entry.gas !== null) entry.gas.visible = false;
        continue;
      }
      const x = state.position.x / KM_PER_UNIT;
      const y = state.position.y / KM_PER_UNIT;
      const z = state.position.z / KM_PER_UNIT;
      const fromCameraKm = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z) * KM_PER_UNIT;
      const px = angularRadiusPixels(radiusKm, fromCameraKm, size.height, fov);
      const sunToNebulaKm =
        sun === null
          ? fromCameraKm
          : Math.hypot(state.position.x - sun.position.x, state.position.y - sun.position.y, state.position.z - sun.position.z);

      // The gas: from a few pixels across, inside it too.
      const gasShown = ramp(px, GAS_HIDDEN_PX, GAS_SHOWN_PX);
      const share = exposureShare(sunToNebulaKm, fromCameraKm);
      // Seen from home, its faint patch waits for the idle warm-up's gain; gone toward, not.
      const wanted = gasShown > 0 && (share > FROM_HOME || hasNebulaGain(nebula));
      if (wanted && entry.gas === null && noiseReady()) {
        const mesh = new THREE.Mesh(drawn.gasGeometry, nebulaMaterial(nebula));
        mesh.frustumCulled = false;
        // The rays start at the camera that draws it -- the glow pass's, as it is when it draws --
        // in nebula radii about its centre, from the matrices in float64. A start even a little
        // off the true eye makes each ray depend on where its pixel falls on the sphere's flat
        // triangles, and from inside the volume the triangles show.
        const eye = new THREE.Vector3();
        const gasUniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
        const cameraLocal = gasUniforms.uCameraLocal!.value as THREE.Vector3;
        const viewport = gasUniforms.uViewport!.value as THREE.Vector4;
        const projection = gasUniforms.uProjection!.value as THREE.Vector4;
        const viewToLocal = gasUniforms.uViewToLocal!.value as THREE.Matrix3;
        const viewToLocal4 = new THREE.Matrix4();
        mesh.onBeforeRender = (renderer, _scene, renderCamera) => {
          eye.setFromMatrixPosition(renderCamera.matrixWorld);
          cameraLocal.copy(mesh.worldToLocal(eye)).multiplyScalar(reach);
          // Its pixels' rays (nebulaVolume.ts): the projection's terms, and view space turned
          // into the sphere's own, in float64.
          const p = renderCamera.projectionMatrix.elements;
          projection.set(p[0]!, p[5]!, p[8]!, p[9]!);
          viewToLocal.setFromMatrix4(viewToLocal4.copy(mesh.matrixWorld).invert().multiply(renderCamera.matrixWorld));
          renderer.getCurrentViewport(viewport);
        };
        entry.gas = mesh;
        show(entry, entry.gas);
      }
      if (entry.gas !== null) {
        const gas = entry.gas;
        gas.visible = gasShown > 0;
        if (gas.visible) {
          const scale = radiusKm / KM_PER_UNIT;
          gas.position.set(x, y, z);
          gas.scale.setScalar(scale * reach);
          const uniforms = (gas.material as THREE.ShaderMaterial).uniforms;
          uniforms.uFade!.value = gasShown * share;
        }
      }

      const visibility =
        (showIcons ? 1 : 0) * ramp(px, HIDDEN_PX, SHOWN_PX) * ramp(fromCameraKm / radiusKm, 0.3, 0.8) * (1 - gasShown);
      ring.visible = visibility > 0;
      if (!ring.visible) continue;
      ring.position.set(x, y, z);
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(radiusKm / KM_PER_UNIT);
      (ring.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    }
  });

  return <primitive object={group} />;
}
