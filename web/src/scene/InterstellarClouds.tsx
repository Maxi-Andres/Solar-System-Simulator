import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import {
  CLOUD_COLOUR,
  INTERSTELLAR_CLOUDS,
  interstellarCloudBodyId,
  MAGELLANIC_TRACKS,
  trackPointsKm,
} from '../core/interstellarClouds.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';
// Run in the frame where the layer is mounted, though its chunk arrives later: see lazyLayer.tsx.
import { useFrame } from './lazyLayer.tsx';

/**
 * The Interstellar Clouds layer (core/interstellarClouds.ts). Each cloud a ring of its measured
 * radius about its mark, turned to the camera -- the outline of a sphere that size, as a nebula's
 * from far off (Nebulae.tsx) -- and nothing inside it: a dark cloud's dust dims the light behind
 * it, which a line cannot show and a glow would show wrongly, and a superbubble's hot gas is not
 * light the eye sees. Dashed where the distance is assumed or disputed (Loop I, Barnard 68,
 * Barnard's Loop). The marks and names are the bodies' (regions.ts), as the meteor showers' are.
 *
 * The Magellanic Stream, Bridge and Leading Arm: their H I tracks on the sky, dashed -- placed at
 * a distance no one has measured along them (the module says which) -- their marks and names at
 * their middles, bodies as the clouds are.
 */

const SEGMENTS = 96;
const HIDDEN_PX = 4;
const SHOWN_PX = 14;
/** A track shows once the camera is out of the disc's neighbourhood, pc from the Sun. */
const TRACK_FADE_PC = [2_000, 10_000] as const;
const TRACK_OPACITY = 0.45;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

export function InterstellarClouds({ store, clock, focus, visible, showIcons }: FeatureProps) {
  const { camera, size } = useThree();
  const group = useMemo(() => new THREE.Group(), []);
  // Made here, added by the effect below: a memo may run twice (StrictMode).
  const drawn = useMemo(() => {
    const solid: THREE.Vector3[] = [];
    for (let k = 0; k < SEGMENTS; k += 1) {
      const a = (k / SEGMENTS) * 2 * Math.PI;
      solid.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(solid);
    const rings = INTERSTELLAR_CLOUDS.map((cloud) => {
      const material = cloud.distanceDisputed
        ? new THREE.LineDashedMaterial({
            color: CLOUD_COLOUR[cloud.kind],
            transparent: true,
            opacity: 0,
            depthWrite: false,
            dashSize: 0.06,
            gapSize: 0.06,
          })
        : new THREE.LineBasicMaterial({
            color: CLOUD_COLOUR[cloud.kind],
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
      const ring = new THREE.LineLoop(ringGeometry, material);
      if (cloud.distanceDisputed) ring.computeLineDistances();
      ring.frustumCulled = false;
      ring.visible = false;
      return { cloud, ring, radiusKm: cloud.radiusPc * PARSEC_KM };
    });
    // The tracks, in km about the Sun, put in scene units each frame by the group's scale.
    const tracks = MAGELLANIC_TRACKS.map((track) => {
      const points = trackPointsKm(track).map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const material = new THREE.LineDashedMaterial({
        color: CLOUD_COLOUR.magellanic,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        dashSize: 1,
        gapSize: 1,
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
      line.computeLineDistances();
      const distances = line.geometry.getAttribute('lineDistance');
      const length = distances === undefined ? 1 : distances.getX(distances.count - 1);
      material.dashSize = length / 80;
      material.gapSize = length / 80;
      line.frustumCulled = false;
      line.visible = false;
      return { track, line };
    });
    const trackGroup = new THREE.Group();
    trackGroup.matrixAutoUpdate = false;
    return { ringGeometry, rings, tracks, trackGroup };
  }, []);

  useEffect(() => {
    for (const { ring } of drawn.rings) group.add(ring);
    for (const { line } of drawn.tracks) drawn.trackGroup.add(line);
    group.add(drawn.trackGroup);
    return () => {
      for (const { ring } of drawn.rings) {
        group.remove(ring);
        (ring.material as THREE.Material).dispose();
      }
      for (const { line } of drawn.tracks) {
        drawn.trackGroup.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      group.remove(drawn.trackGroup);
      drawn.ringGeometry.dispose();
    };
  }, [group, drawn]);
  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const sun = visible ? store.sunFromFocus(focus, jd) : null;
    for (const { cloud, ring, radiusKm } of drawn.rings) {
      const state =
        sun === null || !showIcons ? null : store.stateRelativeTo(interstellarCloudBodyId(cloud), focus, jd);
      if (state === null) {
        ring.visible = false;
        continue;
      }
      const x = state.position.x / KM_PER_UNIT;
      const y = state.position.y / KM_PER_UNIT;
      const z = state.position.z / KM_PER_UNIT;
      const fromCameraKm =
        Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z) * KM_PER_UNIT;
      const px = angularRadiusPixels(radiusKm, fromCameraKm, size.height, fov);
      // From where it is some pixels across, until the camera is inside it.
      const visibility = ramp(px, HIDDEN_PX, SHOWN_PX) * ramp(fromCameraKm / radiusKm, 0.6, 1.2);
      ring.visible = visibility > 0;
      if (!ring.visible) continue;
      ring.position.set(x, y, z);
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(radiusKm / KM_PER_UNIT);
      (ring.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    }

    if (sun === null) {
      drawn.trackGroup.visible = false;
      return;
    }
    const sx = sun.position.x / KM_PER_UNIT;
    const sy = sun.position.y / KM_PER_UNIT;
    const sz = sun.position.z / KM_PER_UNIT;
    const fromSunPc =
      (Math.hypot(camera.position.x - sx, camera.position.y - sy, camera.position.z - sz) * KM_PER_UNIT) / PARSEC_KM;
    const shown = ramp(fromSunPc, TRACK_FADE_PC[0], TRACK_FADE_PC[1]);
    drawn.trackGroup.visible = shown > 0;
    if (shown <= 0) return;
    const scale = 1 / KM_PER_UNIT;
    drawn.trackGroup.matrix.makeTranslation(sx, sy, sz).multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    drawn.trackGroup.matrixWorldNeedsUpdate = true;
    for (const { line } of drawn.tracks) {
      line.visible = true;
      (line.material as THREE.LineDashedMaterial).opacity = TRACK_OPACITY * shown;
    }
  });

  return <primitive object={group} />;
}
