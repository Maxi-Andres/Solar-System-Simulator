import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { Comets, CometSource } from '../core/comets.ts';
import { parseCometBodyId } from '../core/cometBodies.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import type { SimClock } from '../core/time.ts';
import type { Vec3 } from '../core/vec3.ts';
import {
  COMET_COLOR,
  COMET_FRAGMENT_SHADER,
  COMET_STATIC_FLOATS,
  COMET_TIME_FLOATS,
  COMET_VERTEX_SHADER,
  cometPerihelia,
  cometStaticBuffer,
  cometTimes,
  REBASE_DAYS,
} from './cometShader.ts';
import type { SharedFrame } from './satellites.ts';
import { KM_PER_UNIT } from './scale.ts';
import { useCompiled } from './useCompiled.ts';

/**
 * The comets, as one draw call of dots.
 *
 * Placed on the GPU, as the belt's asteroids are: each comet's conic -- ellipse, parabola or
 * hyperbola -- is solved in the vertex shader by universal variables, in float32 arranged so
 * that every comet in the catalogue lands within half a part in a million of its distance
 * from the Sun of where conic.ts's float64 puts it (cometShader.ts and its test). Per frame
 * this component sets a few uniforms; once a simulated day it works out each comet's
 * perihelion time relative to the clock again, in float64, and uploads those 32 KB. On no
 * other frame does anything here scale with the number of comets.
 *
 * Like the belt's dots these are **a legibility convention**: a comet's nucleus is a few
 * kilometres, and even a great comet's coma is far below a pixel from most of where the
 * camera goes. What a dot does say is real: where the comet is, and how bright it is
 * now -- larger and stronger near the Sun, where a comet comes alive, faint far out where
 * it is a bare nucleus (cometShader.ts cometLook). Colour is a pale blue-white so the comets read
 * apart from the grey asteroids; that too is a convention.
 *
 * No crowding rule as the belt has (see beltCrowding.ts): four thousand dots spread from
 * the Sun's surface to thousands of AU never pile up into a blob the way a million in one
 * annulus do.
 */

interface CometPoints {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** Each comet's perihelion from the epoch, and whether it is hidden; see cometTimes. */
  readonly time: THREE.BufferAttribute;
  /** cometPerihelia's: what the times are worked out again from. */
  readonly perihelia: Float64Array;
  readonly dtDays: THREE.IUniform<number>;
  readonly sunHigh: THREE.Vector3;
  readonly sunLow: THREE.Vector3;
  readonly pixelRatio: THREE.IUniform<number>;
  /** The instant the perihelion times are counted from, TDB; NaN until the first frame. */
  epochJd: number;
}

function noRaycast(): void {}

/** The comets as one Points: their fixed elements in one buffer, their times in another. */
export function buildCometPoints(comets: Comets, mu: number): CometPoints {
  const count = comets.info.count;
  const geometry = new THREE.BufferGeometry();
  const statics = new THREE.InterleavedBuffer(cometStaticBuffer(comets, mu), COMET_STATIC_FLOATS);
  geometry.setAttribute('aConic', new THREE.InterleavedBufferAttribute(statics, 3, 0));
  geometry.setAttribute('aAxisP', new THREE.InterleavedBufferAttribute(statics, 3, 3));
  geometry.setAttribute('aAxisQ', new THREE.InterleavedBufferAttribute(statics, 3, 6));
  geometry.setAttribute('aMagnitude', new THREE.InterleavedBufferAttribute(statics, 2, 9));
  const time = new THREE.BufferAttribute(new Float32Array(count * COMET_TIME_FLOATS), COMET_TIME_FLOATS);
  time.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aTime', time);
  // There is no `position` for three to count vertices by, so the range says how many.
  geometry.setDrawRange(0, count);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const dtDays: THREE.IUniform<number> = { value: 0 };
  const pixelRatio: THREE.IUniform<number> = { value: 1 };
  const sunHigh = new THREE.Vector3();
  const sunLow = new THREE.Vector3();
  const material = new THREE.ShaderMaterial({
    vertexShader: COMET_VERTEX_SHADER,
    fragmentShader: COMET_FRAGMENT_SHADER,
    uniforms: {
      uDtDays: dtDays,
      uSqrtMu: { value: Math.sqrt(mu) },
      uSunHigh: { value: sunHigh },
      uSunLow: { value: sunLow },
      uUnitsPerKm: { value: 1 / KM_PER_UNIT },
      uPixelRatio: pixelRatio,
      uColor: { value: new THREE.Vector3(...COMET_COLOR) },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.raycast = noRaycast;
  return {
    points,
    time,
    perihelia: cometPerihelia(comets, mu),
    dtDays,
    sunHigh,
    sunLow,
    pixelRatio,
    epochJd: Number.NaN,
  };
}

export interface CometsProps {
  readonly source: CometSource;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The Comets layer. Off, nothing is drawn and the GPU's copy is let go. */
  readonly visible: boolean;
  readonly sharedFrame: SharedFrame;
}

/**
 * Mounted always, between SolarSystem and LabelProjector, for the reason AsteroidBelt is:
 * it reads the scene's snapshot of the Sun before the labels take it.
 */
export function CometField({ source, store, clock, focus, visible, sharedFrame }: CometsProps) {
  const loaded = useSyncExternalStore(source.subscribe, () => source.comets);
  const comets = visible ? loaded : null;
  const mu = store.body('sun').gmBodyOnlyKm3S2;
  const built = useMemo(() => (comets === null ? null : buildCometPoints(comets, mu)), [comets, mu]);
  useEffect(
    () => () => {
      built?.points.geometry.dispose();
      built?.points.material.dispose();
    },
    [built],
  );
  // The comets that are bodies of their own (see cometBodies.ts), whose dots are hidden.
  const version = useStoreVersion(store);
  const hidden = useMemo(() => {
    void version;
    const set = new Set<number>();
    for (const body of store.bodies) {
      const k = store.isPropagatedBody(body.id) ? parseCometBodyId(body.id) : null;
      if (k !== null) {
        set.add(k);
      }
    }
    return set;
  }, [store, version]);
  // Which are hidden, into the second float of each comet's time.
  useEffect(() => {
    if (built === null) {
      return;
    }
    const times = built.time.array as Float32Array;
    for (let k = 0; k < times.length / COMET_TIME_FLOATS; k += 1) {
      times[k * COMET_TIME_FLOATS + 1] = hidden.has(k) ? 1 : 0;
    }
    built.time.needsUpdate = true;
  }, [built, hidden]);

  useFrame(({ gl }) => {
    if (built === null || comets === null) {
      return;
    }
    const jd = clock.tdbJulianDay;
    const shared = sharedFrame.snapshot;
    let sun: Vec3 | undefined =
      shared !== null && shared.focus === focus && shared.jd === jd
        ? shared.bodies.get('sun')?.positionKm
        : undefined;
    sun ??= store.sunFromFocus(focus, jd)?.position;
    // With no Sun to hang them on, the comets are not drawn: the shader would put every one
    // round the focus instead.
    built.points.visible = sun !== undefined;
    if (sun === undefined) {
      return;
    }
    built.pixelRatio.value = gl.getPixelRatio();
    // The perihelion times, counted again from the clock once it is a day from their epoch:
    // the one pass over the comets, in float64 (cometTimes).
    if (!(Math.abs(jd - built.epochJd) <= REBASE_DAYS)) {
      built.epochJd = jd;
      cometTimes(built.perihelia, comets.info.referenceJd, jd, built.time.array as Float32Array);
      built.time.needsUpdate = true;
    }
    built.dtDays.value = jd - built.epochJd;
    // splitDouble, inlined, as the belt does: the Sun added to float32 of the sum.
    const xHigh = Math.fround(sun.x);
    const yHigh = Math.fround(sun.y);
    const zHigh = Math.fround(sun.z);
    built.sunHigh.set(xHigh, yHigh, zHigh);
    built.sunLow.set(Math.fround(sun.x - xHigh), Math.fround(sun.y - yHigh), Math.fround(sun.z - zHigh));
  });

  // On screen once its shader has compiled beside the page (useCompiled.ts): the conic's
  // solve is the slowest program here to compile, and held the page for it otherwise.
  const shown = useCompiled(built === null ? null : built.points);
  return shown === null ? null : <primitive object={shown} />;
}
