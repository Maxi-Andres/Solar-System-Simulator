import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { flybyPositionKm, flybySpanYears, STELLAR_FLYBYS } from '../core/stellarFlybys.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { lineFrom } from './AlphaCentauriOrbits.tsx';
import { KM_PER_UNIT } from './scale.ts';

/**
 * The two stellar flybys' paths (core/stellarFlybys.ts): each a straight line about the
 * Sun, from the star's measured place and velocity, across its passage -- computed, not
 * watched, since the clock does not reach them. Dashed for that, in the brown of the
 * Notable Stars marks, and shown with them.
 */

const COLOR = new THREE.Color('#c0745a');
const OPACITY = 0.5;

export interface StellarFlybysProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
}

export function StellarFlybys({ store, clock, focus }: StellarFlybysProps) {
  const visible = useViewStore((state) => state.layers.notableStars);
  const group = useMemo(() => new THREE.Group(), []);
  // Put in the group by the effect below, not here: a memo may run twice (StrictMode).
  const lines = useMemo(
    () =>
      STELLAR_FLYBYS.map((flyby) => {
        const [from, to] = flybySpanYears(flyby);
        const line = lineFrom([flybyPositionKm(flyby, from), flybyPositionKm(flyby, to)], 1, COLOR);
        // Dashed: a path worked out, not one a star was seen on.
        const material = new THREE.LineDashedMaterial({
          color: COLOR,
          transparent: true,
          opacity: OPACITY,
          depthWrite: false,
          dashSize: 1,
          gapSize: 1,
        });
        (line.material as THREE.Material).dispose();
        line.material = material;
        line.computeLineDistances();
        // Some forty dashes along each, whatever its length.
        const length = line.geometry.getAttribute('lineDistance')?.getX(1) ?? 1;
        material.dashSize = length / 80;
        material.gapSize = length / 80;
        line.visible = true;
        return line;
      }),
    [],
  );
  useEffect(() => {
    group.add(...lines);
    return () => {
      group.remove(...lines);
      for (const line of lines) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    };
  }, [group, lines]);

  useFrame(() => {
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      group.visible = false;
      return;
    }
    group.visible = true;
    group.position.set(sun.position.x / KM_PER_UNIT, sun.position.y / KM_PER_UNIT, sun.position.z / KM_PER_UNIT);
  });

  return <primitive object={group} />;
}
