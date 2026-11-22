import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { whenIdle } from '../core/idle.ts';
import { beginLoading } from '../core/loading.ts';
import { NEBULA_COLOR, NEBULAE, nebulaBodyId, nebulaRadiusKm, nebulaReach, type Nebula } from '../core/nebulae.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { drawIntoGlow, releaseFromGlow } from './glowBuffer.ts';
import {
  hasNebulaGain,
  nebulaGain,
  nebulaMaterial,
  provideNebulaGain,
  type NebulaWorkerAnswer,
  type NebulaWorkerRequest,
} from './nebulaVolume.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { hasRemnantNoise, provideRemnantNoise } from './remnantVolume.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';
// Run in the frame where the layer is mounted, though its chunk arrives later: see lazyLayer.tsx.
import { useFrame } from './lazyLayer.tsx';

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
  /** Its gas, made the first time it could show in view, once its gain and the noise are here. */
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
  // What the gas needs, made in nebula.worker.ts: the noise it is clumped by -- the remnants'
  // worker's if that has made it first -- and each nebula's gain. Until they come the gas is not
  // made; a page with no workers makes them here, as it did before there was one.
  const made = useMemo(
    () => ({
      worker: null as Worker | null,
      // Answers still to come; the worker is let go at none.
      waiting: 0,
      failed: false,
      noiseAsked: false,
      // The gains to ask for, one at a time, the wanted ones first; and the one being worked out.
      queue: [] as string[],
      asking: null as string | null,
      // The nebulae gone toward, whose gas waits on its gain: on the loading line, as the noise is.
      urgent: new Set<string>(),
      loading: null as (() => void) | null,
      // With no worker: the idle warm-up here instead, its cancel.
      cancelIdle: null as (() => void) | null,
      compileTarget: new THREE.WebGLRenderTarget(1, 1),
      frustum: new THREE.Frustum(),
      viewProjection: new THREE.Matrix4(),
      centre: new THREE.Vector3(),
    }),
    [],
  );
  /** The loading line names the nebulae while a gas someone looks at waits on the worker -- never for the idle warm-up. */
  const showLoading = (): void => {
    const busy = !made.failed && ((made.noiseAsked && !hasRemnantNoise()) || made.urgent.size > 0);
    if (busy && made.loading === null) made.loading = beginLoading('the nebulae');
    if (!busy && made.loading !== null) {
      made.loading();
      made.loading = null;
    }
  };
  /** The gains still to work out, here, one nebula an idle moment: what a page without workers does. */
  const warmHere = (): void => {
    if (made.cancelIdle !== null) return;
    const next = (): void => {
      const key = made.queue.shift();
      const nebula = NEBULAE.find((candidate) => candidate.key === key);
      if (nebula === undefined) {
        made.cancelIdle = null;
        return;
      }
      made.cancelIdle = whenIdle(() => {
        nebulaGain(nebula);
        next();
      }, 10_000);
    };
    next();
  };
  const fail = (): void => {
    made.worker?.terminate();
    made.worker = null;
    made.waiting = 0;
    made.failed = true;
    made.asking = null;
    // The gas gone toward makes its own gain when next drawn (nebulaMaterial); the rest, idly.
    made.urgent.clear();
    showLoading();
    warmHere();
    renderDemand.request();
  };
  const ask = (request: NebulaWorkerRequest): boolean => {
    if (made.failed) return false;
    if (made.worker === null) {
      try {
        const worker = new Worker(new URL('./nebula.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<NebulaWorkerAnswer>) => {
          const answer = event.data;
          if (answer.kind === 'noise') {
            provideRemnantNoise(answer.noise);
          } else {
            if (Number.isFinite(answer.gain)) provideNebulaGain(answer.key, answer.gain);
            made.urgent.delete(answer.key);
            made.asking = null;
          }
          made.waiting -= 1;
          askNextGain();
          // Nothing more asked: let it go; a nebula gone toward later asks a new one.
          if (made.waiting <= 0) {
            worker.terminate();
            made.worker = null;
            made.waiting = 0;
          }
          showLoading();
          renderDemand.request();
        };
        worker.onerror = (error) => {
          console.error('The nebulae’s worker failed; making their gas here', error);
          fail();
        };
        made.worker = worker;
      } catch {
        fail();
        return false;
      }
    }
    made.waiting += 1;
    made.worker.postMessage(request);
    return true;
  };
  /** The next gain from the queue, once the one before it is in. */
  const askNextGain = (): void => {
    if (made.failed) return;
    while (made.asking === null && made.queue.length > 0) {
      const key = made.queue.shift()!;
      const nebula = NEBULAE.find((candidate) => candidate.key === key);
      if (nebula === undefined || hasNebulaGain(nebula)) continue;
      made.asking = key;
      ask({ kind: 'gain', key });
    }
  };
  /** A nebula's gain wanted: `urgent` for one gone toward, ahead of the warm-up's. */
  const wantGain = (nebula: Nebula, urgent: boolean): void => {
    if (hasNebulaGain(nebula)) return;
    const at = made.queue.indexOf(nebula.key);
    if (urgent) {
      if (!made.urgent.has(nebula.key)) {
        made.urgent.add(nebula.key);
        showLoading();
      }
      if (at > 0 || (at < 0 && made.asking !== nebula.key)) {
        if (at > 0) made.queue.splice(at, 1);
        made.queue.unshift(nebula.key);
      }
    } else if (at < 0 && made.asking !== nebula.key) {
      made.queue.push(nebula.key);
    }
    if (made.failed) warmHere();
    else askNextGain();
  };
  /** Whether the noise is here; asks the worker for it if not. With no worker it is made when drawn. */
  const noiseReady = (): boolean => {
    if (hasRemnantNoise() || made.failed) return true;
    if (!made.noiseAsked) {
      made.noiseAsked = true;
      if (!ask({ kind: 'noise' })) return true;
      showLoading();
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
  // in the worker, one nebula after another, once the page is first idle, so the faint patch
  // seen from home never waits on it; one gone toward sooner is put first in line.
  useEffect(() => {
    const cancel = whenIdle(() => {
      for (const nebula of NEBULAE) wantGain(nebula, false);
    }, 10_000);
    return () => cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const { ring } of drawn.entries) group.add(ring);
    return () => {
      made.worker?.terminate();
      made.worker = null;
      made.waiting = 0;
      made.noiseAsked = false;
      made.queue.length = 0;
      made.asking = null;
      made.urgent.clear();
      made.cancelIdle?.();
      made.cancelIdle = null;
      made.loading?.();
      made.loading = null;
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
    const sun = visible ? store.sunFromFocus(focus, jd) : null;
    // The view as the last frame drew it -- near enough to tell whether a nebula is in it -- by its
    // four sides only: the far plane is no limit for a volume drawn into the glow buffer.
    made.frustum.setFromProjectionMatrix(made.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const inView = (x: number, y: number, z: number, radius: number): boolean => {
      made.centre.set(x, y, z);
      for (let k = 0; k < 4; k += 1) {
        if (made.frustum.planes[k]!.distanceToPoint(made.centre) < -radius) return false;
      }
      return true;
    };
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
      // Made only once it is in view -- a nebula behind the camera costs nothing until turned to --
      // and its gain and the noise are in from the worker.
      let ready = false;
      if (wanted && entry.gas === null && inView(x, y, z, (radiusKm / KM_PER_UNIT) * reach)) {
        const gainReady = made.failed || hasNebulaGain(nebula);
        if (!gainReady) wantGain(nebula, true);
        ready = noiseReady() && gainReady;
      }
      if (ready) {
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
