import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import {
  CENSUS_EDGE_COLOR,
  CENSUS_EDGE_LY,
  censusEdgeVisibility,
  DISTANCE_RINGS_LY,
  RING_MAX_OPACITY,
  ringVisibility,
  sphereOutline,
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
 *
 * After the rulers comes one more, the edge of the star census (distanceRings.ts): dashed,
 * warm, belonging to the Star Map layer, and turned each frame to face the camera, because
 * it is a sphere's outline and not a circle in the ecliptic. Its label is the last one.
 */

/** Segments in the circle: the sag above, at any radius. */
const SEGMENTS = 1024;

const RING_COLOR = '#8a96a3';

/** Dashes round the census edge, and the share of each that is drawn. */
const CENSUS_DASHES = 180;
const CENSUS_DASH_FILL = 0.55;

/** Gap between the ring and its name, pixels. */
const LABEL_GAP_PX = 6;

const scratchSun = new THREE.Vector3();
const scratchSide = new THREE.Vector3();
const scratchPoint = new THREE.Vector3();
const scratchToward = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const AXIS_Z = new THREE.Vector3(0, 0, 1);

export interface DistanceRingsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The rulers: the Distance Rings layer. */
  readonly visible: boolean;
  /** The census edge: the Star Map layer, with the 3D stars there to have an edge. */
  readonly censusVisible: boolean;
  /** The labels, by ring index -- the rulers, then the census edge -- owned by the overlay. */
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

/**
 * The unit circle again, closed by repeating its first vertex and measured in dashes: a
 * Line rather than a LineLoop, so the closing segment has a length of its own instead of
 * running the dash pattern backwards from the last vertex to the first.
 */
function dashedUnitCircle(): THREE.BufferGeometry {
  const positions = new Float32Array((SEGMENTS + 1) * 3);
  const distances = new Float32Array(SEGMENTS + 1);
  for (let index = 0; index <= SEGMENTS; index += 1) {
    const angle = (index / SEGMENTS) * 2 * Math.PI;
    positions[index * 3] = Math.cos(angle);
    positions[index * 3 + 1] = Math.sin(angle);
    distances[index] = (index / SEGMENTS) * CENSUS_DASHES;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineDistance', new THREE.BufferAttribute(distances, 1));
  return geometry;
}

interface Ring {
  readonly radiusKm: number;
  readonly census: boolean;
  readonly line: THREE.Line;
  readonly material: THREE.LineBasicMaterial;
}

export function DistanceRings({
  store,
  clock,
  focus,
  visible,
  censusVisible,
  labels,
}: DistanceRingsProps) {
  const { camera, size } = useThree();

  const rings = useMemo((): Ring[] => {
    const geometry = unitCircle();
    const rulers = DISTANCE_RINGS_LY.map((lightYears): Ring => {
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
      return { radiusKm: lightYears * LIGHT_YEAR_KM, census: false, line, material };
    });
    const censusMaterial = new THREE.LineDashedMaterial({
      color: CENSUS_EDGE_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      dashSize: CENSUS_DASH_FILL,
      gapSize: 1 - CENSUS_DASH_FILL,
    });
    const censusLine = new THREE.Line(dashedUnitCircle(), censusMaterial);
    censusLine.frustumCulled = false;
    censusLine.visible = false;
    const census: Ring = {
      radiusKm: CENSUS_EDGE_LY * LIGHT_YEAR_KM,
      census: true,
      line: censusLine,
      material: censusMaterial,
    };
    return [...rulers, census];
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
      const geometries = new Set(rings.map((ring) => ring.line.geometry));
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const ring of rings) {
        ring.material.dispose();
      }
    },
    [rings],
  );

  useFrame(() => {
    const elements = labels.current;
    const sun =
      visible || censusVisible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
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

    // Where the rulers' names go: the point of each ring toward the camera's right,
    // flattened into the ecliptic -- on the ring, and on the right of it as the camera sees
    // it. Looking straight down the ecliptic's own axis with the camera rolled a quarter
    // turn, right has no part in the plane, and the camera's up stands in.
    scratchSide.set(1, 0, 0).applyQuaternion(camera.quaternion).setZ(0);
    if (scratchSide.lengthSq() < 1e-6) {
      scratchSide.set(0, 1, 0).applyQuaternion(camera.quaternion).setZ(0);
    }
    scratchSide.normalize();

    rings.forEach((ring, index) => {
      const element = elements[index] ?? null;
      const shown = ring.census ? censusVisible : visible;
      const visibility = !shown
        ? 0
        : ring.census
          ? censusEdgeVisibility(ring.radiusKm, cameraFromSunKm, size.height, fov)
          : ringVisibility(ring.radiusKm, cameraFromSunKm, size.height, fov);
      ring.line.visible = visibility > 0;
      ring.material.opacity = RING_MAX_OPACITY * visibility;
      if (visibility === 0) {
        hide(element);
        return;
      }

      if (ring.census) {
        // Face the camera: the outline's plane is square to the line from the Sun to the
        // camera, a little toward the camera from the Sun. Named over its top as seen --
        // its name is a sentence, and on the right it would run off a wide view.
        const outline = sphereOutline(ring.radiusKm, cameraFromSunKm)!;
        scratchToward.copy(camera.position).sub(scratchSun).normalize();
        ring.line.position.copy(scratchToward).multiplyScalar(kmToUnits(outline.towardCameraKm));
        ring.line.quaternion.setFromUnitVectors(AXIS_Z, scratchToward);
        ring.line.scale.setScalar(kmToUnits(outline.radiusKm));
        scratchUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        scratchUp.addScaledVector(scratchToward, -scratchUp.dot(scratchToward)).normalize();
        scratchPoint
          .copy(scratchUp)
          .multiplyScalar(kmToUnits(outline.radiusKm))
          .add(ring.line.position)
          .add(scratchSun);
      } else {
        scratchPoint.copy(scratchSide).multiplyScalar(kmToUnits(ring.radiusKm)).add(scratchSun);
      }

      if (element === null) {
        return;
      }
      if (visibility < 0.5) {
        hide(element);
        return;
      }
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
      element.style.transform = ring.census
        ? `translate(${x}px, ${y - LABEL_GAP_PX}px) translate(-50%, -100%)`
        : `translate(${x + LABEL_GAP_PX}px, ${y}px) translateY(-50%)`;
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
