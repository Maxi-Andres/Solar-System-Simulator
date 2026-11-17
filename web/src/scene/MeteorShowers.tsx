import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  activeArc,
  isActive,
  jdOfSolarLongitude,
  METEOR_SHOWERS,
  peakJdNear,
  streamPath,
  streamState,
  type MeteorShower,
} from '../core/meteorShowers.ts';
import type { SimClock } from '../core/time.ts';
import { distance, subtract, type Vec3 } from '../core/vec3.ts';
import { useViewStore } from '../state/store.ts';
import { AU_KM, kmToUnits } from './scale.ts';

/**
 * The meteor showers' streams where Earth meets them (core/meteorShowers.ts): the Meteor Showers
 * layer. For each shower, two lines about its crossing, the point on Earth's orbit where Earth is
 * at the shower's maximum:
 *
 *  - **The stream's mean path**, the meteoroids' two-body orbit through the crossing with the
 *    velocity their radiant and speed give, fifty days back and on, fading out an AU or so from
 *    the crossing. Computed from measured numbers; but a real stream is a braid of filaments
 *    shed over centuries, wide and lumpy, and this is its mean line. Beyond the crossing it runs
 *    on round the parent's orbit -- the drawing stops where it stops saying anything about Earth.
 *  - **Earth's path through it**: Earth's orbit over the shower's activity period, IMO's dates --
 *    how wide the stream is where Earth crosses, measured by how long the meteors keep coming.
 *
 * Both brighter while the shower is active by the clock. The radiant's direction is the stream's
 * own: standing at the crossing, the meteoroids come at Earth from it.
 */

const COLOR = new THREE.Color('#e0b878');

/** How far back and on the stream's path is drawn, days, and its step. */
const STREAM_HALF_SPAN_DAYS = 50;
const STREAM_STEP_DAYS = 0.5;

/** The stream fades with distance from the crossing on this scale, km. */
const STREAM_FADE_KM = 0.5 * AU_KM;

/** Earth's path through the stream, sampled every so many days. */
const EARTH_STEP_DAYS = 0.5;

const ACTIVE_OPACITY = 0.9;
const IDLE_OPACITY = 0.45;

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor, uOpacity * vAlpha);
}
`;

function lineMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uColor: { value: COLOR.clone() }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Points about `origin`, km, as a line's geometry in scene units, with an alpha per point. */
function lineGeometry(points: readonly Vec3[], origin: Vec3, alpha: (point: Vec3) => number): THREE.BufferGeometry {
  const positions = new Float32Array(points.length * 3);
  const alphas = new Float32Array(points.length);
  points.forEach((point, k) => {
    const offset = subtract(point, origin);
    positions[3 * k] = kmToUnits(offset.x);
    positions[3 * k + 1] = kmToUnits(offset.y);
    positions[3 * k + 2] = kmToUnits(offset.z);
    alphas[k] = alpha(point);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  return geometry;
}

interface Drawn {
  readonly group: THREE.Group;
  readonly stream: THREE.Line;
  readonly earth: THREE.Line;
  readonly material: THREE.ShaderMaterial;
  /** The maximum the lines were built for, and its crossing about the Sun, km; null before any. */
  peakJd: number | null;
  crossing: Vec3 | null;
}

/** Builds a shower's two lines for the maximum at `peakJd`; false without Earth there. */
function build(drawn: Drawn, shower: MeteorShower, store: EphemerisStore, peakJd: number): boolean {
  const earthAtPeak = store.stateRelativeTo('earth', 'sun', peakJd);
  if (earthAtPeak === null) return false;
  const crossing = earthAtPeak.position;
  const path = streamPath(streamState(shower, earthAtPeak), store.body('sun').gmKm3S2, STREAM_HALF_SPAN_DAYS, STREAM_STEP_DAYS);
  const { fromDeg, toDeg } = activeArc(shower);
  const startJd = jdOfSolarLongitude(fromDeg, peakJd - 0.1);
  const endJd = jdOfSolarLongitude(toDeg, peakJd + 0.1);
  // The nearest instants may fall on the wrong side of the maximum for a long shower: take the
  // ones that bracket it.
  const from = startJd <= peakJd ? startJd : startJd - 365.2422;
  const to = endJd >= peakJd ? endJd : endJd + 365.2422;
  const earthPath: Vec3[] = [];
  for (let jd = from; jd <= to; jd += EARTH_STEP_DAYS) {
    const state = store.stateRelativeTo('earth', 'sun', jd);
    if (state !== null) earthPath.push(state.position);
  }
  drawn.stream.geometry.dispose();
  drawn.earth.geometry.dispose();
  drawn.stream.geometry = lineGeometry(path, crossing, (point) => Math.exp(-((distance(point, crossing) / STREAM_FADE_KM) ** 2)));
  drawn.earth.geometry = lineGeometry(earthPath, crossing, () => 1);
  drawn.peakJd = peakJd;
  drawn.crossing = crossing;
  return true;
}

export function MeteorShowers({ store, clock, focus }: { store: EphemerisStore; clock: SimClock; focus: BodyId }) {
  const visible = useViewStore((state) => state.layers.meteorShowers);

  const parts = useMemo(() => {
    const root = new THREE.Group();
    const drawn = new Map<BodyId, Drawn>();
    for (const shower of METEOR_SHOWERS) {
      const material = lineMaterial();
      const group = new THREE.Group();
      const stream = new THREE.Line(new THREE.BufferGeometry(), material);
      const earth = new THREE.Line(new THREE.BufferGeometry(), material);
      for (const object of [group, stream, earth]) object.frustumCulled = false;
      group.add(stream, earth);
      group.visible = false;
      root.add(group);
      drawn.set(shower.id, { group, stream, earth, material, peakJd: null, crossing: null });
    }
    return { root, drawn };
  }, []);

  useEffect(
    () => () => {
      for (const drawn of parts.drawn.values()) {
        drawn.stream.geometry.dispose();
        drawn.earth.geometry.dispose();
        drawn.material.dispose();
      }
    },
    [parts],
  );

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const sun = visible && store.tree.has('earth') ? store.stateRelativeTo('sun', focus, jd) : null;
    parts.root.visible = sun !== null;
    if (sun === null) return;
    for (const shower of METEOR_SHOWERS) {
      const drawn = parts.drawn.get(shower.id)!;
      const peakJd = peakJdNear(shower, jd);
      // Rebuilt once a year, when the nearest maximum moves on: Earth's orbit barely changes.
      if (drawn.peakJd === null || Math.abs(drawn.peakJd - peakJd) > 1) {
        if (!build(drawn, shower, store, peakJd)) {
          drawn.group.visible = false;
          continue;
        }
      }
      const crossing = drawn.crossing!;
      drawn.group.visible = true;
      drawn.group.position.set(
        kmToUnits(sun.position.x + crossing.x),
        kmToUnits(sun.position.y + crossing.y),
        kmToUnits(sun.position.z + crossing.z),
      );
      drawn.material.uniforms['uOpacity']!.value = isActive(shower, jd) ? ACTIVE_OPACITY : IDLE_OPACITY;
    }
  });

  return <primitive object={parts.root} />;
}
