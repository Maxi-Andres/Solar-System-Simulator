import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import { COMET, COMET_FLOATS, cometMagnitude, cometPosition, type Comets, type CometSource } from '../core/comets.ts';
import { parseCometBodyId } from '../core/cometBodies.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import type { SimClock } from '../core/time.ts';
import type { Vec3 } from '../core/vec3.ts';
import type { SharedFrame } from './satellites.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * The comets, as one draw call of dots.
 *
 * Placed on the CPU (see comets.ts): each frame the clock or the focus has moved, every
 * comet's conic is solved in float64, rebased on the focus, and written to the buffer as
 * scene units -- 4,000 positions, 48 KB uploaded. Nothing is worked out on a frame where
 * neither moved.
 *
 * Like the belt's dots these are **a legibility convention**: a comet's nucleus is a few
 * kilometres, and even a great comet's coma is far below a pixel from most of where the
 * camera goes. What a dot does say is real: where the comet is, and how bright it is
 * now -- larger and stronger near the Sun, where a comet comes alive, faint far out where
 * it is a bare nucleus (see cometLook). Colour is a pale blue-white so the comets read
 * apart from the grey asteroids; that too is a convention.
 *
 * No crowding rule as the belt has (see beltCrowding.ts): four thousand dots spread from
 * the Sun's surface to thousands of AU never pile up into a blob the way a million in one
 * annulus do.
 */

/** Display colour, before alpha: a pale blue-white. A convention; see the header. */
export const COMET_COLOR: readonly [number, number, number] = [0.62, 0.8, 0.92];

/** Brightest and faintest magnitudes the look runs between; see cometLook. */
export const COMET_BRIGHT_MAG = 6;
export const COMET_FAINT_MAG = 20;
/** Dot diameters in CSS pixels at those two ends. */
export const COMET_BRIGHT_PX = 2;
export const COMET_FAINT_PX = 1;
/** Opacities at those two ends: no comet is drawn fainter than the second. */
export const COMET_BRIGHT_ALPHA = 1;
export const COMET_FAINT_ALPHA = 0.35;

/**
 * How a comet's magnitude at its present distance from the Sun (cometMagnitude) becomes a
 * dot: linear in magnitude between the two ends, clamped. A comet at magnitude 6 -- one
 * near perihelion, or a great comet -- is a full 2-pixel dot; one at 20, a bare nucleus
 * out past Saturn, is the faint 1-pixel floor, so every comet stays on the map.
 */
export function cometLook(magnitude: number): { readonly sizePx: number; readonly alpha: number } {
  const t = Math.min(1, Math.max(0, (COMET_FAINT_MAG - magnitude) / (COMET_FAINT_MAG - COMET_BRIGHT_MAG)));
  return {
    sizePx: COMET_FAINT_PX + (COMET_BRIGHT_PX - COMET_FAINT_PX) * t,
    alpha: COMET_FAINT_ALPHA + (COMET_BRIGHT_ALPHA - COMET_FAINT_ALPHA) * t,
  };
}

const COMET_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute vec2 aLook;
  uniform float uPixelRatio;
  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
    float diameterPx = aLook.x * uPixelRatio;
    vRadiusPx = 0.5 * diameterPx;
    vSpritePx = ceil(diameterPx + 1.0);
    gl_PointSize = vSpritePx;
    vAlpha = aLook.y;
  }
`;

/** The belt's soft disc: each pixel takes the share of the dot over it. */
const COMET_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uColor;
  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;

  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - vec2(0.5)) * vSpritePx;
    float coverage = clamp(vRadiusPx + 0.5 - d, 0.0, 1.0);
    if (coverage <= 0.0) {
      discard;
    }
    gl_FragColor = vec4(uColor, vAlpha * coverage);
  }
`;

interface CometPoints {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly position: THREE.BufferAttribute;
  readonly look: THREE.BufferAttribute;
  /** Heliocentric positions, km, float64: the frame's working copy. */
  readonly helioKm: Float64Array;
  readonly pixelRatio: THREE.IUniform<number>;
  /** What the buffer was last written for: the same again writes nothing. */
  last: { jd: number; x: number; y: number; z: number };
}

function noRaycast(): void {}

function buildCometPoints(comets: Comets): CometPoints {
  const count = comets.info.count;
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  const look = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
  look.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('aLook', look);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const pixelRatio: THREE.IUniform<number> = { value: 1 };
  const material = new THREE.ShaderMaterial({
    vertexShader: COMET_VERTEX_SHADER,
    fragmentShader: COMET_FRAGMENT_SHADER,
    uniforms: {
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
    position,
    look,
    helioKm: new Float64Array(count * 3),
    pixelRatio,
    last: { jd: Number.NaN, x: Number.NaN, y: Number.NaN, z: Number.NaN },
  };
}

/**
 * Every comet's place and look for one instant, into the buffers: positions relative to
 * the focus in scene units, from `sunKm` -- the Sun relative to the focus -- and each
 * comet's size and opacity. The frame loop's one call; allocates nothing.
 */
export function writeComets(
  comets: Comets,
  jd: number,
  sunKm: Vec3,
  mu: number,
  helioKm: Float64Array,
  positions: Float32Array,
  looks: Float32Array,
  /** Comets that are bodies of their own just now: drawn as that, not as a dot too. */
  hidden: ReadonlySet<number> = NO_HIDDEN,
): void {
  const { records } = comets;
  for (let k = 0; k < comets.info.count; k += 1) {
    if (hidden.has(k)) {
      looks[k * 2 + 1] = 0;
      continue;
    }
    const rAu = cometPosition(comets, k, jd, mu, helioKm);
    positions[k * 3] = (helioKm[k * 3]! + sunKm.x) / KM_PER_UNIT;
    positions[k * 3 + 1] = (helioKm[k * 3 + 1]! + sunKm.y) / KM_PER_UNIT;
    positions[k * 3 + 2] = (helioKm[k * 3 + 2]! + sunKm.z) / KM_PER_UNIT;
    const base = k * COMET_FLOATS;
    const magnitude = cometMagnitude(
      records[base + COMET.M1]!,
      records[base + COMET.K1]!,
      rAu,
      comets.fallbackM1,
    );
    // cometLook, inlined: no object a comet a frame.
    const t = Math.min(1, Math.max(0, (COMET_FAINT_MAG - magnitude) / (COMET_FAINT_MAG - COMET_BRIGHT_MAG)));
    looks[k * 2] = COMET_FAINT_PX + (COMET_BRIGHT_PX - COMET_FAINT_PX) * t;
    looks[k * 2 + 1] = COMET_FAINT_ALPHA + (COMET_BRIGHT_ALPHA - COMET_FAINT_ALPHA) * t;
  }
}

const NO_HIDDEN: ReadonlySet<number> = new Set();

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
  const built = useMemo(() => (comets === null ? null : buildCometPoints(comets)), [comets]);
  useEffect(
    () => () => {
      built?.points.geometry.dispose();
      built?.points.material.dispose();
    },
    [built],
  );
  const mu = store.body('sun').gmBodyOnlyKm3S2;
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
  // A change to which are hidden must rewrite the buffer even with the clock still.
  useEffect(() => {
    if (built !== null) {
      built.last.jd = Number.NaN;
    }
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
    sun ??= store.stateRelativeTo('sun', focus, jd)?.position;
    built.points.visible = sun !== undefined;
    if (sun === undefined) {
      return;
    }
    built.pixelRatio.value = gl.getPixelRatio();
    const last = built.last;
    if (last.jd === jd && last.x === sun.x && last.y === sun.y && last.z === sun.z) {
      return;
    }
    last.jd = jd;
    last.x = sun.x;
    last.y = sun.y;
    last.z = sun.z;
    writeComets(
      comets,
      jd,
      sun,
      mu,
      built.helioKm,
      built.position.array as Float32Array,
      built.look.array as Float32Array,
      hidden,
    );
    built.position.needsUpdate = true;
    built.look.needsUpdate = true;
  });

  return built === null ? null : <primitive object={built.points} />;
}
