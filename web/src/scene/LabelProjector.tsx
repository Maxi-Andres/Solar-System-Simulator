import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { rebaseFrame } from './floatingOrigin.ts';
import { angularRadiusPixels, kmToUnits } from './scale.ts';

/**
 * Projects each body to screen coordinates and positions its HTML label.
 *
 * The labels are real DOM elements living outside the canvas, which keeps text
 * crisp at any device pixel ratio and lets them be styled and clicked like ordinary
 * UI. This component only moves them: it writes transforms directly in the frame
 * loop, so labels track the scene at 60 fps without React re-rendering anything.
 */

/** Gap between a body's edge and its label, in pixels. */
const LABEL_GAP_PX = 14;

/** Labels closer together than this are decluttered. */
const DECLUTTER_PX = 26;

export interface LabelProjectorProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** Label elements, keyed by body id, owned by the overlay outside the canvas. */
  readonly elements: RefObject<Map<BodyId, HTMLElement | null>>;
}

interface Projected {
  readonly id: BodyId;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly offset: number;
}

export function LabelProjector({
  store,
  clock,
  focus,
  visible,
  elements,
}: LabelProjectorProps) {
  const { camera, size } = useThree();
  const scratch = new THREE.Vector3();

  useFrame(() => {
    const map = elements.current;
    if (map === null) {
      return;
    }

    if (!visible) {
      for (const element of map.values()) {
        if (element !== null) {
          element.style.display = 'none';
        }
      }
      return;
    }

    const jd = clock.tdbJulianDay;
    const snapshot = rebaseFrame(store, focus, jd);
    const fov = (camera as THREE.PerspectiveCamera).fov;

    const projected: Projected[] = [];

    for (const body of store.bodies) {
      const rebased = snapshot.bodies.get(body.id);
      if (rebased === undefined) {
        continue;
      }

      scratch.set(
        kmToUnits(rebased.positionKm.x),
        kmToUnits(rebased.positionKm.y),
        kmToUnits(rebased.positionKm.z),
      );

      const distanceUnits = scratch.distanceTo(camera.position);
      scratch.project(camera);

      // z outside [-1, 1] means behind the camera or past the far plane.
      if (scratch.z < -1 || scratch.z > 1) {
        continue;
      }

      // Offset the label past the body's own disc so it never overlaps the sphere.
      const pixelRadius = angularRadiusPixels(
        body.radiusEquatorialKm,
        distanceUnits * 1000,
        size.height,
        fov,
      );

      projected.push({
        id: body.id,
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
        depth: distanceUnits,
        offset: Math.min(pixelRadius, size.height * 0.4) + LABEL_GAP_PX,
      });
    }

    // Declutter: nearest body wins a contested spot. Sorting by depth means the
    // thing you are looking at keeps its name when a distant body drifts behind it.
    projected.sort((a, b) => a.depth - b.depth);

    const placed: Projected[] = [];
    const shown = new Set<BodyId>();

    for (const candidate of projected) {
      const collides = placed.some(
        (other) =>
          Math.abs(other.x - candidate.x) < DECLUTTER_PX &&
          Math.abs(other.y - candidate.y) < DECLUTTER_PX,
      );
      // The focused body always keeps its label; it is the one you asked about.
      if (collides && candidate.id !== focus) {
        continue;
      }
      placed.push(candidate);
      shown.add(candidate.id);

      const element = map.get(candidate.id);
      if (element == null) {
        continue;
      }
      element.style.display = 'block';
      element.style.transform = `translate(${candidate.x + candidate.offset}px, ${
        candidate.y
      }px) translateY(-50%)`;
    }

    for (const [id, element] of map) {
      if (element !== null && !shown.has(id)) {
        element.style.display = 'none';
      }
    }
  });

  return null;
}
