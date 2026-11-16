import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  BOW_SHOCK_DRAWN_TO_DEG,
  bowShockRadius,
  DIPOLE_POLE_LATITUDE_DEG,
  DIPOLE_POLE_LONGITUDE_DEG,
  EARTH_RADIUS_KM,
  fieldLineRadius,
  footLatitude,
  INNER_BELT_L,
  KARMAN_LINE_KM,
  MAGNETOPAUSE_ALPHA,
  MAGNETOPAUSE_DRAWN_TO_DEG,
  MAGNETOPAUSE_R0,
  magnetopauseRadius,
  OUTER_BELT_L,
} from '../core/magnetosphere.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { longitudeDirection, poleDirection } from './orientation.ts';
import { hideLabel, makeLabel, placeShellLabel, revolutionGeometry, rimMaterial, smoothRamp, sphereGeometry } from './regionSurface.ts';
import { KM_PER_UNIT, kmToUnits } from './scale.ts';

/**
 * Earth's surroundings as the standard models draw them (core/magnetosphere.ts): the Magnetosphere
 * layer. The magnetopause and the bow shock turned to the Sun at each instant, their noses bodies
 * of their own; the Van Allen belts as the dipole shells that bound them, tipped with the dipole
 * and turning with Earth; and the Kármán line, 100 km over the ellipsoid.
 *
 * Each comes in only where it is seen from outside -- from within the magnetopause it is only a
 * veil over the sky -- and the Kármán line only close to Earth, where 100 km is more than a hair.
 */

const MAGNETOPAUSE_COLOR = '#88b8e8';
const BOW_SHOCK_COLOR = '#c8b090';
const BELT_COLOR = '#c88fd8';
const KARMAN_COLOR = '#9fd0e8';

const DEG = Math.PI / 180;

/** Camera distances from Earth, Earth radii, over which each part comes in and goes. */
const BOUNDARY_RAMP: readonly [number, number, number, number] = [15, 40, 3_000, 10_000];
const BELT_RAMP: readonly [number, number, number, number] = [10, 25, 1_000, 4_000];
const KARMAN_RAMP: readonly [number, number, number, number] = [1.1, 2, 20, 60];
const OPACITY = 0.5;

function ramp(r: number, [inFrom, inTo, outFrom, outTo]: readonly [number, number, number, number]): number {
  return smoothRamp(Math.log(r), Math.log(inFrom), Math.log(inTo)) * (1 - smoothRamp(Math.log(r), Math.log(outFrom), Math.log(outTo)));
}

/** The shell of field line L from foot to foot, about local +x (the dipole axis). */
function fieldLineShell(l: number): THREE.BufferGeometry {
  const foot = footLatitude(l);
  return revolutionGeometry(
    (t) => {
      const lambda = -foot + 2 * foot * t;
      const r = fieldLineRadius(l, lambda);
      return [r * Math.sin(lambda), r * Math.cos(lambda)];
    },
    () => 1,
    96,
    96,
  );
}

const X_AXIS = new THREE.Vector3(1, 0, 0);

export function Magnetosphere({ store, clock, focus }: { store: EphemerisStore; clock: SimClock; focus: BodyId }) {
  const { camera, size, gl } = useThree();
  const visible = useViewStore((state) => state.layers.magnetosphere);
  const labelsOn = useViewStore((state) => state.layers.labels && state.layers.userInterface);

  const parts = useMemo(() => {
    const group = new THREE.Group();
    const sunward = new THREE.Group();
    const dipole = new THREE.Group();
    const polar = new THREE.Group();
    group.add(sunward, dipole, polar);

    const pauseTo = MAGNETOPAUSE_DRAWN_TO_DEG * DEG;
    const pauseMaterial = rimMaterial(MAGNETOPAUSE_COLOR);
    const pause = new THREE.Mesh(
      revolutionGeometry(
        (t) => {
          const theta = t * pauseTo;
          const r = magnetopauseRadius(theta, MAGNETOPAUSE_R0, MAGNETOPAUSE_ALPHA);
          return [r * Math.cos(theta), r * Math.sin(theta)];
        },
        (t) => 1 - smoothRamp(t * MAGNETOPAUSE_DRAWN_TO_DEG, 110, MAGNETOPAUSE_DRAWN_TO_DEG),
        96,
        96,
      ),
      pauseMaterial,
    );
    const shockTo = BOW_SHOCK_DRAWN_TO_DEG * DEG;
    const shockMaterial = rimMaterial(BOW_SHOCK_COLOR);
    const shock = new THREE.Mesh(
      revolutionGeometry(
        (t) => {
          const theta = t * shockTo;
          const r = bowShockRadius(theta);
          return [r * Math.cos(theta), r * Math.sin(theta)];
        },
        (t) => 1 - smoothRamp(t * BOW_SHOCK_DRAWN_TO_DEG, 90, BOW_SHOCK_DRAWN_TO_DEG),
        96,
        96,
      ),
      shockMaterial,
    );
    sunward.add(pause, shock);

    const beltMaterial = rimMaterial(BELT_COLOR);
    const belts = [...INNER_BELT_L, ...OUTER_BELT_L].map((l) => new THREE.Mesh(fieldLineShell(l), beltMaterial));
    dipole.add(...belts);

    const karmanMaterial = rimMaterial(KARMAN_COLOR, 0);
    const karman = new THREE.Mesh(sphereGeometry(48, 192), karmanMaterial);
    polar.add(karman);

    for (const object of [group, sunward, dipole, polar, pause, shock, karman, ...belts]) object.frustumCulled = false;
    return { group, sunward, dipole, polar, pause, shock, belts, karman, pauseMaterial, shockMaterial, beltMaterial, karmanMaterial };
  }, []);

  const labels = useMemo(() => {
    const container = gl.domElement.parentElement;
    return {
      belts: makeLabel(container, 'Van Allen belts · typical', '#c8a8d8'),
      karman: makeLabel(container, 'Kármán line · 100 km', '#a8cce0'),
    };
  }, [gl]);

  useEffect(
    () => () => {
      for (const mesh of [parts.pause, parts.shock, parts.karman, ...parts.belts]) mesh.geometry.dispose();
      for (const material of [parts.pauseMaterial, parts.shockMaterial, parts.beltMaterial, parts.karmanMaterial]) material.dispose();
      labels.belts?.remove();
      labels.karman?.remove();
    },
    [parts, labels],
  );

  const scratch = useMemo(() => ({ sun: new THREE.Vector3(), axis: new THREE.Vector3() }), []);

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const earth = visible && store.tree.has('earth') ? store.stateRelativeTo('earth', focus, jd) : null;
    const sun = earth === null ? null : store.stateRelativeTo('sun', 'earth', jd);
    if (earth === null || sun === null) {
      parts.group.visible = false;
      hideLabel(labels.belts);
      hideLabel(labels.karman);
      return;
    }
    const { group } = parts;
    group.visible = true;
    group.position.set(kmToUnits(earth.position.x), kmToUnits(earth.position.y), kmToUnits(earth.position.z));
    const earthRadiusUnits = kmToUnits(EARTH_RADIUS_KM);
    camera.updateMatrixWorld();
    const cameraRadii = (group.position.distanceTo(camera.position) * KM_PER_UNIT) / EARTH_RADIUS_KM;

    // Turned to the Sun.
    scratch.sun.set(sun.position.x, sun.position.y, sun.position.z).normalize();
    parts.sunward.quaternion.setFromUnitVectors(X_AXIS, scratch.sun);
    parts.sunward.scale.setScalar(earthRadiusUnits);

    // The dipole's axis, through IGRF's pole, with Earth's turn.
    const body = store.body('earth');
    const lat = DIPOLE_POLE_LATITUDE_DEG * DEG;
    const meridian = longitudeDirection(jd, body, DIPOLE_POLE_LONGITUDE_DEG);
    const pole = poleDirection(jd, body);
    scratch.axis
      .set(
        Math.cos(lat) * meridian.x + Math.sin(lat) * pole.x,
        Math.cos(lat) * meridian.y + Math.sin(lat) * pole.y,
        Math.cos(lat) * meridian.z + Math.sin(lat) * pole.z,
      )
      .normalize();
    parts.dipole.quaternion.setFromUnitVectors(X_AXIS, scratch.axis);
    parts.dipole.scale.setScalar(earthRadiusUnits);

    // The Kármán line over the ellipsoid: its axis on the pole.
    parts.polar.quaternion.setFromUnitVectors(X_AXIS, scratch.axis.set(pole.x, pole.y, pole.z));
    parts.polar.scale.set(
      kmToUnits(body.radiusPolarKm + KARMAN_LINE_KM),
      kmToUnits(body.radiusEquatorialKm + KARMAN_LINE_KM),
      kmToUnits(body.radiusEquatorialKm + KARMAN_LINE_KM),
    );

    const boundaries = ramp(cameraRadii, BOUNDARY_RAMP);
    const belts = ramp(cameraRadii, BELT_RAMP);
    const karman = ramp(cameraRadii, KARMAN_RAMP);
    parts.sunward.visible = boundaries > 0;
    parts.dipole.visible = belts > 0;
    parts.polar.visible = karman > 0;
    parts.pauseMaterial.uniforms['uOpacity']!.value = OPACITY * boundaries;
    parts.shockMaterial.uniforms['uOpacity']!.value = OPACITY * boundaries;
    parts.beltMaterial.uniforms['uOpacity']!.value = 0.35 * belts;
    parts.karmanMaterial.uniforms['uOpacity']!.value = 0.8 * karman;

    if (!labelsOn) {
      hideLabel(labels.belts);
      hideLabel(labels.karman);
      return;
    }
    placeShellLabel(labels.belts, group.position, OUTER_BELT_L[1] * earthRadiusUnits, camera, size, belts);
    placeShellLabel(labels.karman, group.position, kmToUnits(body.radiusEquatorialKm + KARMAN_LINE_KM), camera, size, karman);
  });

  return <primitive object={parts.group} />;
}
