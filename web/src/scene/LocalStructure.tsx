import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import {
  circlePoints,
  COUNCIL_CENTRE_PC,
  COUNCIL_FIT,
  localGroupBarycentrePc,
  SHEET_AXES,
  SHEET_EDGE_PC,
  ZERO_VELOCITY_RADIUS_PC,
} from '../core/localStructure.ts';
import { sphereOutline } from './distanceRings.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';
import { SceneLabels } from './sceneLabels.ts';
// Run in the frame where the layer is mounted, though its chunk arrives later: see lazyLayer.tsx.
import { useFrame } from './lazyLayer.tsx';

/**
 * The Local Structure layer (core/localStructure.ts): three outlines, none of them anything
 * there to see, so faint lines and off at first.
 *
 * - **The zero-velocity surface**: a sphere, so drawn as its outline as seen -- the circle where
 *   the lines of sight graze it (distanceRings.ts sphereOutline), turned each frame to face the
 *   camera, dashed as the census edge is. From inside, from the Milky Way, it has no outline
 *   and nothing is drawn: it is all about.
 * - **The Council of Giants**: McCall's ring, in the Local Sheet's mid-plane, solid.
 * - **The Local Sheet**: its mid-plane's outline out to its giants' 3-sigma edge, dashed.
 *
 * Each in pc about the Sun, the group carried with it by the floating origin. They come in as
 * the camera leaves the Milky Way and go past the nearby universe, where they are a dot.
 */

const SEGMENTS = 256;
const MAX_OPACITY = 0.35;
const COLOUR = '#8fa6c8';
/** The camera's distance from the Sun, pc, over which the Sheet and the ring come in and go. */
const SHEET_FROM_PC = 300_000;
const SHEET_FULL_PC = 1_500_000;
const GONE_FROM_PC = 60_000_000;
const GONE_PC = 300_000_000;
/** Outside the sphere by this many radii its outline starts to show; fully at the next. */
const OUTSIDE_GONE = 1.05;
const OUTSIDE_FULL = 1.5;
/** Dashes round a dashed circle, and the share of each drawn. */
const DASHES = 120;
const DASH_FILL = 0.55;

const NAMES = ['Zero-velocity surface · computed', 'Council of Giants · McCall 2014', 'Local Sheet · McCall 2014'];

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

function logRamp(value: number, gone: number, full: number): number {
  return ramp(Math.log(Math.max(value, 1e-9)), Math.log(gone), Math.log(full));
}

/** A closed line through `points`, measured in dashes when `dashed`. */
function line(points: Float32Array, dashed: boolean): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const material = dashed
    ? new THREE.LineDashedMaterial({ color: COLOUR, transparent: true, opacity: 0, depthWrite: false, dashSize: DASH_FILL, gapSize: 1 - DASH_FILL })
    : new THREE.LineBasicMaterial({ color: COLOUR, transparent: true, opacity: 0, depthWrite: false });
  if (dashed) {
    const count = points.length / 3;
    const distances = new Float32Array(count);
    for (let i = 0; i < count; i += 1) distances[i] = (i / (count - 1)) * DASHES;
    geometry.setAttribute('lineDistance', new THREE.BufferAttribute(distances, 1));
  }
  const made = new THREE.Line(geometry, material);
  made.frustumCulled = false;
  made.visible = false;
  return made;
}

const ORIGIN = { x: 0, y: 0, z: 0 };
const UNIT_X = { x: 1, y: 0, z: 0 };
const UNIT_Y = { x: 0, y: 1, z: 0 };
const AXIS_Z = new THREE.Vector3(0, 0, 1);

export function LocalStructure({ store, clock, focus, visible, showLabels }: FeatureProps) {
  const { camera, size, gl } = useThree();
  const state = useMemo(() => {
    const group = new THREE.Group();
    const barycentre = localGroupBarycentrePc();
    // The surface's outline: a unit circle, placed, turned and sized each frame.
    const surface = line(circlePoints(ORIGIN, UNIT_X, UNIT_Y, 1, SEGMENTS), true);
    const council = line(circlePoints(COUNCIL_CENTRE_PC, SHEET_AXES.x, SHEET_AXES.y, COUNCIL_FIT.radius * 1e6, SEGMENTS), false);
    const sheet = line(circlePoints(COUNCIL_CENTRE_PC, SHEET_AXES.x, SHEET_AXES.y, SHEET_EDGE_PC, SEGMENTS), true);
    group.add(surface, council, sheet);
    return {
      group,
      surface,
      council,
      sheet,
      barycentre: new THREE.Vector3(barycentre.x, barycentre.y, barycentre.z),
      centre: new THREE.Vector3(COUNCIL_CENTRE_PC.x, COUNCIL_CENTRE_PC.y, COUNCIL_CENTRE_PC.z),
      inPlane: [new THREE.Vector3(SHEET_AXES.x.x, SHEET_AXES.x.y, SHEET_AXES.x.z), new THREE.Vector3(SHEET_AXES.y.x, SHEET_AXES.y.y, SHEET_AXES.y.z)] as const,
      labels: null as SceneLabels | null,
      cameraPc: new THREE.Vector3(),
      toward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      point: new THREE.Vector3(),
    };
  }, []);

  useEffect(() => {
    state.labels = new SceneLabels(gl.domElement, NAMES, 'local-structure');
    return () => {
      state.labels?.dispose();
      state.labels = null;
    };
  }, [gl, state]);

  useEffect(
    () => () => {
      for (const made of [state.surface, state.council, state.sheet]) {
        made.geometry.dispose();
        (made.material as THREE.Material).dispose();
      }
    },
    [state],
  );

  useFrame(() => {
    const sun = visible ? store.sunFromFocus(focus, clock.tdbJulianDay) : null;
    const labels = state.labels;
    if (sun === null) {
      state.group.visible = false;
      labels?.hideAll();
      return;
    }
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    state.group.visible = true;
    state.group.position.set(sun.position.x / KM_PER_UNIT, sun.position.y / KM_PER_UNIT, sun.position.z / KM_PER_UNIT);
    state.group.scale.setScalar(unitsPerPc);
    state.group.updateMatrixWorld();
    // The camera about the Sun, pc.
    const cameraPc = state.cameraPc.copy(camera.position).sub(state.group.position).divideScalar(unitsPerPc);
    const fromSunPc = cameraPc.length();
    const away = 1 - logRamp(fromSunPc, GONE_FROM_PC, GONE_PC);
    camera.updateMatrixWorld();
    const cameraUp = state.up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    // The zero-velocity surface's outline, facing the camera.
    const fromCentre = cameraPc.distanceTo(state.barycentre);
    const outline = sphereOutline(ZERO_VELOCITY_RADIUS_PC, fromCentre);
    const surfaceShown = outline === null ? 0 : ramp(fromCentre / ZERO_VELOCITY_RADIUS_PC, OUTSIDE_GONE, OUTSIDE_FULL) * away;
    state.surface.visible = surfaceShown > 0;
    (state.surface.material as THREE.LineDashedMaterial).opacity = MAX_OPACITY * surfaceShown;
    let surfaceTop: THREE.Vector3 | null = null;
    if (outline !== null && surfaceShown > 0) {
      const toward = state.toward.copy(cameraPc).sub(state.barycentre).normalize();
      state.surface.position.copy(state.barycentre).addScaledVector(toward, outline.towardCameraKm);
      state.surface.quaternion.setFromUnitVectors(AXIS_Z, toward);
      state.surface.scale.setScalar(outline.radiusKm);
      // Named over its top as seen.
      const up = cameraUp.clone().addScaledVector(toward, -cameraUp.dot(toward)).normalize();
      surfaceTop = up.multiplyScalar(outline.radiusKm).add(state.surface.position).applyMatrix4(state.group.matrixWorld);
    }

    // The Council's ring and the Sheet's edge.
    const sheetShown = logRamp(fromSunPc, SHEET_FROM_PC, SHEET_FULL_PC) * away;
    for (const made of [state.council, state.sheet]) {
      made.visible = sheetShown > 0;
      (made.material as THREE.LineBasicMaterial).opacity = MAX_OPACITY * sheetShown;
    }

    if (labels === null) return;
    if (!showLabels) {
      labels.hideAll();
      return;
    }
    if (surfaceTop === null) labels.hide(0);
    else labels.place(0, surfaceTop, camera, size, surfaceShown);
    // Each circle named at its point highest on the screen: the camera's up, laid in the Sheet.
    const [ex, ey] = state.inPlane;
    const a = cameraUp.dot(ex);
    const b = cameraUp.dot(ey);
    const n = Math.hypot(a, b) || 1;
    for (const [index, radius] of [[1, COUNCIL_FIT.radius * 1e6], [2, SHEET_EDGE_PC]] as const) {
      const point = state.point
        .copy(state.centre)
        .addScaledVector(ex, (radius * a) / n)
        .addScaledVector(ey, (radius * b) / n)
        .applyMatrix4(state.group.matrixWorld);
      labels.place(index, point, camera, size, sheetShown);
    }
  });

  return <primitive object={state.group} />;
}
