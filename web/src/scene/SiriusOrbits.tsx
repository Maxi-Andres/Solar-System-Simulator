import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  SIRIUS_FRACTION_B,
  SIRIUS_SKY_ORBIT,
  siriusBarycentreState,
  siriusRelativePolylineKm,
} from '../core/sirius.ts';
import type { SimClock } from '../core/time.ts';
import { lineFrom, ramp } from './AlphaCentauriOrbits.tsx';
import { starColor } from './blackbody.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';

/**
 * Sirius A's and B's orbits about their barycentre (sirius.ts): one orbit, B's about A,
 * scaled about the barycentre by each star's share of the mass, as Alpha Centauri's pair's
 * are (AlphaCentauriOrbits.tsx) and shown by the same rule: from a few pixels across until
 * the camera is a dozen of the orbit's radii away.
 */

const SEGMENTS = 512;
const FAR_FULL_RADII = 6;
const FAR_GONE_RADII = 12;
const HIDDEN_PX = 6;
const SHOWN_PX = 18;

/**
 * Their colours: each star's own, as its 3D star is drawn -- B-V 0.009 for A (Hipparcos) and
 * -0.07 for B (Gaia's photometry, transformed).
 */
const COLOR_INDEX_A = 0.009;
const COLOR_INDEX_B = -0.07;

function colorOf(colorIndex: number): THREE.Color {
  const [r, g, b] = starColor(colorIndex);
  const peak = Math.max(r, g, b);
  return new THREE.Color(r / peak, g / peak, b / peak);
}

export interface SiriusOrbitsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
}

export function SiriusOrbits({ store, clock, focus, visible }: SiriusOrbitsProps) {
  const { camera, size } = useThree();
  const group = useMemo(() => new THREE.Group(), []);
  // Put in the group by the effect below, not here: a memo may run twice (StrictMode).
  const pair = useMemo(() => {
    const relative = siriusRelativePolylineKm(SEGMENTS);
    return {
      a: lineFrom(relative, -SIRIUS_FRACTION_B, colorOf(COLOR_INDEX_A)),
      b: lineFrom(relative, 1 - SIRIUS_FRACTION_B, colorOf(COLOR_INDEX_B)),
    };
  }, []);
  useEffect(() => {
    group.add(pair.a, pair.b);
    return () => {
      group.remove(pair.a, pair.b);
      for (const line of [pair.a, pair.b]) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    };
  }, [group, pair]);

  useFrame(() => {
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      group.visible = false;
      return;
    }
    const bary = siriusBarycentreState(clock.tdbJulianDay).position;
    group.visible = true;
    group.position.set(
      (sun.position.x + bary.x) / KM_PER_UNIT,
      (sun.position.y + bary.y) / KM_PER_UNIT,
      (sun.position.z + bary.z) / KM_PER_UNIT,
    );
    const fromCameraKm = group.position.distanceTo(camera.position) * KM_PER_UNIT;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const show = (line: THREE.Line, radiusKm: number): void => {
      const px = angularRadiusPixels(radiusKm, fromCameraKm, size.height, fov);
      const ratio = fromCameraKm / radiusKm;
      const visibility =
        ramp(px, HIDDEN_PX, SHOWN_PX) * ramp(ratio, 0.02, 0.06) * ramp(-ratio, -FAR_GONE_RADII, -FAR_FULL_RADII);
      line.visible = visibility > 0;
      (line.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    };
    show(pair.a, SIRIUS_SKY_ORBIT.semiMajorAxisKm * SIRIUS_FRACTION_B);
    show(pair.b, SIRIUS_SKY_ORBIT.semiMajorAxisKm * (1 - SIRIUS_FRACTION_B));
  });

  return <primitive object={group} />;
}
