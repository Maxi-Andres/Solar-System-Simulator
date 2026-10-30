import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';

import { blackHoleSystemOf, SGR_A_ID } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { RING_MAX_OPACITY, ringVisibility } from './distanceRings.ts';
import { AU_KM, KM_PER_UNIT, kmToUnits } from './scale.ts';
import { projectToScreen } from './screenProjection.ts';

/**
 * The Solar System laid over Sgr A* (D5), for scale: circles the size of Mercury's and
 * Earth's orbits, centred on the black hole, drawn while it or S2 is in focus. Its horizon
 * -- 0.085 AU, a fifth of Mercury's orbit -- sits well inside both, and so does its shadow,
 * 0.22 AU. They are drawn flat over the lensed sky, as rulers: not bent by it.
 *
 * **A ruler, not a thing**, in the distance rings' grey and labelled "for scale": nothing
 * of the Solar System is there. Each circle faces the camera, so it is round from any side
 * and reads as a size, not as an orbit in some plane. The radii are the semi-major axes,
 * 0.3871 and 1.0000 AU (JPL's mean elements).
 */

export const HORIZON_SCALE_RINGS: readonly { readonly radiusKm: number; readonly label: string }[] = [
  { radiusKm: 0.3871 * AU_KM, label: "Mercury's orbit · for scale" },
  { radiusKm: 1.0 * AU_KM, label: "Earth's orbit · for scale" },
];

const RING_COLOR = '#8a96a3';
const SEGMENTS = 512;
/** Gap between the ring and its name, pixels. */
const LABEL_GAP_PX = 6;

const scratchRight = new THREE.Vector3();
const scratchPoint = new THREE.Vector3();

export function HorizonScale({
  store,
  clock,
  focus,
  labels,
}: {
  store: EphemerisStore;
  clock: SimClock;
  focus: BodyId;
  /** The rings' names, in HORIZON_SCALE_RINGS order, owned by the overlay. */
  labels: RefObject<(HTMLElement | null)[]>;
}) {
  const { camera, size } = useThree();

  const rings = useMemo(() => {
    const positions = new Float32Array(SEGMENTS * 3);
    for (let index = 0; index < SEGMENTS; index += 1) {
      const angle = (index / SEGMENTS) * 2 * Math.PI;
      positions[index * 3] = Math.cos(angle);
      positions[index * 3 + 1] = Math.sin(angle);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return HORIZON_SCALE_RINGS.map((ring) => {
      const material = new THREE.LineBasicMaterial({
        color: RING_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const line = new THREE.LineLoop(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      return { ...ring, line, material };
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
    const shown = blackHoleSystemOf(focus)?.id === SGR_A_ID;
    const centre = shown ? store.stateRelativeTo(SGR_A_ID, focus, clock.tdbJulianDay) : null;
    if (centre === null) {
      group.visible = false;
      for (const element of elements) {
        hide(element);
      }
      return;
    }
    group.visible = true;
    group.position.set(kmToUnits(centre.position.x), kmToUnits(centre.position.y), kmToUnits(centre.position.z));
    camera.updateMatrixWorld();
    const cameraFromCentreKm = group.position.distanceTo(camera.position) * KM_PER_UNIT;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    // Names on the right of each circle, as the camera sees it.
    scratchRight.set(1, 0, 0).applyQuaternion(camera.quaternion);

    rings.forEach((ring, index) => {
      const element = elements[index] ?? null;
      const visibility = ringVisibility(ring.radiusKm, cameraFromCentreKm, size.height, fov);
      ring.line.visible = visibility > 0;
      ring.material.opacity = RING_MAX_OPACITY * visibility;
      // Square to the view: a circle from any side.
      ring.line.quaternion.copy(camera.quaternion);
      ring.line.scale.setScalar(kmToUnits(ring.radiusKm));
      if (element === null) {
        return;
      }
      if (visibility < 0.5) {
        hide(element);
        return;
      }
      scratchPoint.copy(scratchRight).multiplyScalar(kmToUnits(ring.radiusKm)).add(group.position);
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
      const x = (scratchPoint.x * 0.5 + 0.5) * size.width;
      const y = (-scratchPoint.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate(${x + LABEL_GAP_PX}px, ${y}px) translateY(-50%)`;
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
