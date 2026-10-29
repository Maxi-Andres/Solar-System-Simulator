import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import {
  AB_ORBIT,
  barycentreState,
  isProximaRecord,
  proximaOrbit,
  relativeOrbitPolylineKm,
} from '../core/alphaCentauri.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { orbitPolyline } from '../core/kepler.ts';
import { STAR3D, STAR3D_FLOATS, starState, type Stars3dSource } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { angularRadiusPixels, KM_PER_UNIT } from './scale.ts';

/**
 * The orbits of the Alpha Centauri system (D3a): A and B about their barycentre, and
 * Proxima about the pair. See core/alphaCentauri.ts for where each comes from.
 *
 * A's and B's are one orbit, B's about A, scaled about the barycentre by each star's
 * share: -mB/m for A, mA/m for B. Proxima's is worked out from where its record puts it
 * now and Kervella et al.'s relative velocity, so it passes through the star; it takes
 * 547,000 years to go round, and on it the clock's whole range is a dot.
 *
 * Each is drawn in its star's colour, at the planets' orbit opacity, once it is a few
 * pixels across and until it is wider than the view -- the rule moons' orbits follow.
 */

const SEGMENTS = 512;

/** Camera distances, in the orbit's own radii, past which it fades out and is gone. */
const FAR_FULL_RADII = 6;
const FAR_GONE_RADII = 12;

/** On-screen radius, pixels, below which an orbit is gone and from which it is whole. */
const HIDDEN_PX = 6;
const SHOWN_PX = 18;

/** The pair's colour indices as the 3D stars carry them; Proxima's is read from its record. */
const COLOR_INDEX_A = 0.71;
const COLOR_INDEX_B = 0.9;

function colorOf(colorIndex: number): THREE.Color {
  const [r, g, b] = starColor(colorIndex);
  const peak = Math.max(r, g, b);
  return new THREE.Color(r / peak, g / peak, b / peak);
}

function lineFrom(points: readonly { x: number; y: number; z: number }[], scale: number, color: THREE.Color) {
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    positions[i * 3] = (p.x * scale) / KM_PER_UNIT;
    positions[i * 3 + 1] = (p.y * scale) / KM_PER_UNIT;
    positions[i * 3 + 2] = (p.z * scale) / KM_PER_UNIT;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.visible = false;
  return line;
}

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

export interface AlphaCentauriOrbitsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly stars3d: Stars3dSource | null;
  readonly visible: boolean;
}

const EMPTY = { tiers: [] as readonly { readonly records: Float32Array }[] };
const noSubscribe = (): (() => void) => () => {};

export function AlphaCentauriOrbits({ store, clock, focus, stars3d, visible }: AlphaCentauriOrbitsProps) {
  const { camera, size } = useThree();
  const view = useSyncExternalStore(stars3d?.subscribe ?? noSubscribe, () => stars3d?.view ?? EMPTY);

  const group = useMemo(() => new THREE.Group(), []);
  const pair = useMemo(() => {
    const relative = relativeOrbitPolylineKm(SEGMENTS);
    const a = lineFrom(relative, -AB_ORBIT.massFractionB, colorOf(COLOR_INDEX_A));
    const b = lineFrom(relative, 1 - AB_ORBIT.massFractionB, colorOf(COLOR_INDEX_B));
    group.add(a, b);
    return { a, b };
  }, [group]);

  // Proxima's orbit, once its record is in hand: built once, from the record and the date
  // it was first seen at -- the orbit takes 547,000 years, the clock spans centuries.
  const proxima = useRef<THREE.Line | null>(null);
  useEffect(() => {
    if (proxima.current !== null) {
      return;
    }
    for (const tier of view.tiers) {
      for (let i = 0; i < tier.records.length / STAR3D_FLOATS; i += 1) {
        const base = i * STAR3D_FLOATS;
        const position = { x: tier.records[base + STAR3D.x]!, y: tier.records[base + STAR3D.y]!, z: tier.records[base + STAR3D.z]! };
        if (!isProximaRecord(position)) {
          continue;
        }
        const jd = clock.tdbJulianDay;
        const elements = proximaOrbit(starState(tier.records, i, jd).position, jd);
        if (elements === null) {
          return;
        }
        const line = lineFrom(orbitPolyline(elements, SEGMENTS), 1, colorOf(tier.records[base + STAR3D.bv]!));
        group.add(line);
        proxima.current = line;
        return;
      }
    }
  }, [view, group, clock]);

  useEffect(
    () => () => {
      for (const child of [...group.children]) {
        const line = child as THREE.Line;
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    },
    [group],
  );

  useFrame(() => {
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      group.visible = false;
      return;
    }
    const bary = barycentreState(clock.tdbJulianDay).position;
    group.visible = true;
    group.position.set(
      (sun.position.x + bary.x) / KM_PER_UNIT,
      (sun.position.y + bary.y) / KM_PER_UNIT,
      (sun.position.z + bary.z) / KM_PER_UNIT,
    );
    const fromCameraKm = group.position.distanceTo(camera.position) * KM_PER_UNIT;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const AU = 149_597_870.7;
    const show = (line: THREE.Line | null, radiusKm: number): void => {
      if (line === null) return;
      const px = angularRadiusPixels(radiusKm, fromCameraKm, size.height, fov);
      // Gone below a few pixels, once the camera is well inside it, and from far away:
      // from the Solar System, Proxima's orbit is still five degrees across in Centaurus,
      // a yellow ellipse hanging beside the planets that says nothing there. It shows as
      // the camera comes within a dozen of the orbit's own radii of it.
      const ratio = fromCameraKm / radiusKm;
      const visibility =
        ramp(px, HIDDEN_PX, SHOWN_PX) * ramp(ratio, 0.02, 0.06) * ramp(-ratio, -FAR_GONE_RADII, -FAR_FULL_RADII);
      line.visible = visibility > 0;
      (line.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    };
    // The pair's semi-major axis is 23.5 AU; each star's orbit is its share of it.
    const pairAu = AB_ORBIT.semiMajorAxisArcsec * (1000 / 747.17);
    show(pair.a, pairAu * AB_ORBIT.massFractionB * AU);
    show(pair.b, pairAu * (1 - AB_ORBIT.massFractionB) * AU);
    show(proxima.current, 8_700 * AU);
  });

  return <primitive object={group} />;
}
