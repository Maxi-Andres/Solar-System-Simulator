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
} from '../core/supernovaRemnants.ts';
import type { SimClock } from '../core/time.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';

/**
 * Each supernova remnant's ring (core/supernovaRemnants.ts): a circle of its mean radius at its
 * place, turned to the camera, in H-alpha's red. A mark of its size, drawn as an orbit is
 * drawn -- from a few pixels across, and gone once the camera is well inside it, where a
 * circle round the view says nothing.
 */

const SEGMENTS = 128;
const HIDDEN_PX = 4;
const SHOWN_PX = 14;

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
}

export function SupernovaRemnants({ store, clock, focus, visible }: SupernovaRemnantsProps) {
  const { camera, size } = useThree();
  const group = useMemo(() => new THREE.Group(), []);
  // Made here, added by the effect: a memo may run twice (StrictMode).
  const rings = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let k = 0; k < SEGMENTS; k += 1) {
      const a = (k / SEGMENTS) * 2 * Math.PI;
      points.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return SUPERNOVA_REMNANTS.map((remnant) => {
      const material = new THREE.LineBasicMaterial({
        color: REMNANT_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const line = new THREE.LineLoop(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      return { remnant, line, radiusKm: remnantRadiusKm(remnant) };
    });
  }, []);
  useEffect(() => {
    for (const { line } of rings) group.add(line);
    return () => {
      for (const { line } of rings) {
        group.remove(line);
        (line.material as THREE.Material).dispose();
      }
      rings[0]?.line.geometry.dispose();
    };
  }, [group, rings]);

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    for (const { remnant, line, radiusKm } of rings) {
      const state = visible ? store.stateRelativeTo(remnantBodyId(remnant), focus, jd) : null;
      if (state === null) {
        line.visible = false;
        continue;
      }
      line.position.set(state.position.x / KM_PER_UNIT, state.position.y / KM_PER_UNIT, state.position.z / KM_PER_UNIT);
      const fromCameraKm = line.position.distanceTo(camera.position) * KM_PER_UNIT;
      const px = angularRadiusPixels(radiusKm, fromCameraKm, size.height, fov);
      const visibility = ramp(px, HIDDEN_PX, SHOWN_PX) * ramp(fromCameraKm / radiusKm, 0.3, 0.8);
      line.visible = visibility > 0;
      if (!line.visible) {
        continue;
      }
      line.quaternion.copy(camera.quaternion);
      line.scale.setScalar(radiusKm / KM_PER_UNIT);
      (line.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    }
  });

  return <primitive object={group} />;
}
