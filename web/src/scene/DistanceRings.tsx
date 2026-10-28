import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import {
  DISTANCE_RINGS_LY,
  RING_MAX_OPACITY,
  ringVisibility,
} from './distanceRings.ts';
import { KM_PER_UNIT, kmToUnits, LIGHT_YEAR_KM } from './scale.ts';
import { projectToScreen } from './screenProjection.ts';

/**
 * The reference rings about the Sun, and their names. See distanceRings.ts.
 *
 * Every ring is one unit circle, scaled to its radius: the vertices stay small numbers and
 * the scale goes through the object's matrix, in float64 until the very end, so a 100-ly
 * ring is placed to 1e-7 of its radius -- 0.6 AU -- rather than to the float32 step of a
 * vertex written in scene units 9e11 out. Its chords sag R (1 - cos(pi / 1024)), five
 * millionths of the radius: 0.3 AU on the 1-ly ring, invisible against what it measures.
 */

/** Segments in the circle: the sag above, at any radius. */
const SEGMENTS = 1024;

const RING_COLOR = '#8a96a3';

/** Gap between the ring and its name, pixels. */
const LABEL_GAP_PX = 6;

const scratchSun = new THREE.Vector3();
const scratchSide = new THREE.Vector3();
const scratchPoint = new THREE.Vector3();

export interface DistanceRingsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** The labels, by ring index, owned by the overlay outside the canvas. */
  readonly labels: RefObject<(HTMLElement | null)[]>;
}

function unitCircle(): THREE.BufferGeometry {
  const positions = new Float32Array(SEGMENTS * 3);
  for (let index = 0; index < SEGMENTS; index += 1) {
    const angle = (index / SEGMENTS) * 2 * Math.PI;
    positions[index * 3] = Math.cos(angle);
    positions[index * 3 + 1] = Math.sin(angle);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export function DistanceRings({ store, clock, focus, visible, labels }: DistanceRingsProps) {
  const { camera, size } = useThree();

  const rings = useMemo(() => {
    const geometry = unitCircle();
    return DISTANCE_RINGS_LY.map((lightYears) => {
      const material = new THREE.LineBasicMaterial({
        color: RING_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const line = new THREE.LineLoop(geometry, material);
      line.scale.setScalar(kmToUnits(lightYears * LIGHT_YEAR_KM));
      // Its bounding sphere is the unit circle's, scaled; culling it is right, but the
      // sphere is worked out once from the geometry, so it is left to the frame loop.
      line.frustumCulled = false;
      line.visible = false;
      return { lightYears, line, material };
    });
  }, []);

  const group = useMemo(() => {
    const parent = new THREE.Group();
    for (const ring of rings) {
      parent.add(ring.line);
    }
    return parent;
  }, [rings]);

  useEffect(
    () => () => {
      rings[0]?.line.geometry.dispose();
      for (const ring of rings) {
        ring.material.dispose();
      }
    },
    [rings],
  );

  useFrame(() => {
    const elements = labels.current;
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      group.visible = false;
      for (const element of elements) {
        hide(element);
      }
      return;
    }
    group.visible = true;
    group.position.set(kmToUnits(sun.position.x), kmToUnits(sun.position.y), kmToUnits(sun.position.z));

    camera.updateMatrixWorld();
    scratchSun.copy(group.position);
    const cameraFromSunKm = scratchSun.distanceTo(camera.position) * KM_PER_UNIT;
    const fov = (camera as THREE.PerspectiveCamera).fov;

    // Where the names go: the point of each ring toward the camera's right, flattened into
    // the ecliptic -- on the ring, and on the right of it as the camera sees it. Looking
    // straight down the ecliptic's own axis with the camera rolled a quarter turn, right
    // has no part in the plane, and the camera's up stands in.
    scratchSide.set(1, 0, 0).applyQuaternion(camera.quaternion).setZ(0);
    if (scratchSide.lengthSq() < 1e-6) {
      scratchSide.set(0, 1, 0).applyQuaternion(camera.quaternion).setZ(0);
    }
    scratchSide.normalize();

    rings.forEach((ring, index) => {
      const radiusKm = ring.lightYears * LIGHT_YEAR_KM;
      const visibility = ringVisibility(radiusKm, cameraFromSunKm, size.height, fov);
      ring.line.visible = visibility > 0;
      ring.material.opacity = RING_MAX_OPACITY * visibility;

      const element = elements[index] ?? null;
      if (element === null) {
        return;
      }
      if (visibility < 0.5) {
        hide(element);
        return;
      }
      scratchPoint.copy(scratchSide).multiplyScalar(kmToUnits(radiusKm)).add(scratchSun);
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
      const x = (scratchPoint.x * 0.5 + 0.5) * size.width + LABEL_GAP_PX;
      const y = (-scratchPoint.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate(${x}px, ${y}px) translateY(-50%)`;
      element.style.opacity = String(visibility);
    });
  });

  return <primitive object={group} />;
}

function hide(element: HTMLElement | null | undefined): void {
  if (element != null && element.style.display !== 'none') {
    element.style.display = 'none';
  }
}
