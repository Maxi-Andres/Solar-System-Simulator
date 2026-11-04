import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  REMNANT_COLOR,
  remnantBodyId,
  remnantRadiusKm,
  SUPERNOVA_REMNANTS,
  type SupernovaRemnant,
} from '../core/supernovaRemnants.ts';
import type { SimClock } from '../core/time.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { remnantMapMaterial, remnantMapReach } from './remnantMap.ts';
import { remnantMaterial, VOLUME_RADIUS } from './remnantVolume.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';

/**
 * Each supernova remnant (core/supernovaRemnants.ts): its glowing gas, a volume the camera
 * can fly round and into (remnantVolume.ts), and from far off a ring of its mean radius.
 *
 * The ring is a mark of its size where the gas is too small to see: a circle turned to the
 * camera, in H-alpha's red, drawn as an orbit is from a few pixels across. It gives way to
 * the gas as the gas grows on screen -- the gas shows the size itself -- and the gas is
 * drawn from a few pixels across on, inside it too.
 */

const SEGMENTS = 128;
const HIDDEN_PX = 4;
const SHOWN_PX = 14;
/** The gas fades in between these radii on screen, pixels. */
const GAS_HIDDEN_PX = 3;
const GAS_SHOWN_PX = 12;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

export interface SupernovaRemnantsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** The Icons layer: off, the rings go and the gas stays. */
  readonly showRings: boolean;
}

interface Drawn {
  readonly remnant: SupernovaRemnant;
  readonly ring: THREE.LineLoop;
  readonly radiusKm: number;
  /** Its gas, made the first time it could show: the noise texture is built then. */
  gas: THREE.Mesh | null;
}

export function SupernovaRemnants({ store, clock, focus, visible, showRings }: SupernovaRemnantsProps) {
  const { camera, size } = useThree();
  const group = useMemo(() => new THREE.Group(), []);
  // Made here, added by the effect: a memo may run twice (StrictMode).
  const drawn = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let k = 0; k < SEGMENTS; k += 1) {
      const a = (k / SEGMENTS) * 2 * Math.PI;
      points.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const gasGeometry = new THREE.SphereGeometry(VOLUME_RADIUS, 48, 24);
    const entries: Drawn[] = SUPERNOVA_REMNANTS.map((remnant) => {
      const material = new THREE.LineBasicMaterial({
        color: REMNANT_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const ring = new THREE.LineLoop(ringGeometry, material);
      ring.frustumCulled = false;
      ring.visible = false;
      return { remnant, ring, radiusKm: remnantRadiusKm(remnant), gas: null };
    });
    return { entries, ringGeometry, gasGeometry };
  }, []);
  useEffect(() => {
    for (const { ring } of drawn.entries) group.add(ring);
    return () => {
      for (const entry of drawn.entries) {
        group.remove(entry.ring);
        (entry.ring.material as THREE.Material).dispose();
        if (entry.gas !== null) {
          group.remove(entry.gas);
          const material = entry.gas.material as THREE.ShaderMaterial;
          (material.uniforms.uMap?.value as THREE.Texture | undefined)?.dispose();
          material.dispose();
          entry.gas = null;
        }
      }
      drawn.ringGeometry.dispose();
      drawn.gasGeometry.dispose();
    };
  }, [group, drawn]);

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    for (const entry of drawn.entries) {
      const { remnant, ring, radiusKm } = entry;
      const state = visible ? store.stateRelativeTo(remnantBodyId(remnant), focus, jd) : null;
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

      // The gas: from a few pixels across, inside it too.
      const gasShown = ramp(px, GAS_HIDDEN_PX, GAS_SHOWN_PX);
      if (gasShown > 0 && entry.gas === null) {
        // From its photograph where it has one; otherwise the model of its kind.
        const material =
          remnant.map === null
            ? remnantMaterial(remnant)
            : remnantMapMaterial(remnant, remnant.map, () => renderDemand.request());
        entry.gas = new THREE.Mesh(drawn.gasGeometry, material);
        entry.gas.frustumCulled = false;
        group.add(entry.gas);
      }
      if (entry.gas !== null) {
        const gas = entry.gas;
        gas.visible = gasShown > 0;
        if (gas.visible) {
          const scale = radiusKm / KM_PER_UNIT;
          gas.position.set(x, y, z);
          const uniforms = (gas.material as THREE.ShaderMaterial).uniforms;
          // The sphere reaches out as far as its light; the shader works in mean radii.
          gas.scale.setScalar(
            remnant.map === null
              ? scale * (uniforms.uExtent!.value as number)
              : (scale * remnantMapReach(remnant)) / VOLUME_RADIUS,
          );
          // The camera in the shell's radii, about its centre: worked out here in float64.
          (uniforms.uCameraLocal!.value as THREE.Vector3).set(
            (camera.position.x - x) / scale,
            (camera.position.y - y) / scale,
            (camera.position.z - z) / scale,
          );
          uniforms.uFade!.value = gasShown;
          if (uniforms.uPixelAngle !== undefined) uniforms.uPixelAngle.value = (fov * Math.PI) / 180 / size.height;
        }
      }

      const visibility =
        (showRings ? 1 : 0) *
        ramp(px, HIDDEN_PX, SHOWN_PX) * ramp(fromCameraKm / radiusKm, 0.3, 0.8) * (1 - gasShown);
      ring.visible = visibility > 0;
      if (!ring.visible) {
        continue;
      }
      ring.position.set(x, y, z);
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(radiusKm / KM_PER_UNIT);
      (ring.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    }
  });

  return <primitive object={group} />;
}
