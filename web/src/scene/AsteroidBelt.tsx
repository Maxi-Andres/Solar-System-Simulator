import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import { RECORD, RECORD_FLOATS, type Belt, type BeltSource } from '../core/belt.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import type { Vec3 } from '../core/vec3.ts';
import { BELT_COLOR, BELT_FRAGMENT_SHADER, BELT_VERTEX_SHADER } from './beltShader.ts';
import type { SharedFrame } from './satellites.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * The asteroid belt: every asteroid in SBDB down to the file's magnitude limit, at its
 * real position, as one draw call.
 *
 * One `THREE.Points` over the file's own bytes: the downloaded buffer goes to the GPU as
 * it is, nine floats an asteroid, and the vertex shader solves each orbit for the instant
 * on the clock (see beltShader.ts). Per frame this component sets four uniforms and
 * allocates nothing -- nothing here scales with the number of asteroids, which is the
 * point: B2b's hundreds of thousands cost the CPU exactly what B2a's 84,000 do.
 *
 * The dots are a legibility convention, as the planets' markers are: constant on screen,
 * a pixel or so, because no asteroid here is anywhere near a pixel at its real size.
 * Their positions are not a convention -- each is its own osculating orbit, propagated.
 *
 * **Where it sits in the frame.** Mounted between SolarSystem and LabelProjector, and
 * mounted always, even with nothing to draw: react-three-fiber runs frame callbacks in
 * the order they were registered, and this one reads the snapshot SolarSystem leaves in
 * `sharedFrame` before LabelProjector takes it (see SharedFrame). Registered later -- by
 * mounting only once the belt arrived -- it would run after the labels and find nothing.
 * It would still be right then, working out the Sun's offset itself; it would just do it
 * twice.
 */

export interface AsteroidBeltProps {
  readonly source: BeltSource;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The Asteroids layer. Off, nothing is drawn and the GPU's copy is let go. */
  readonly visible: boolean;
  readonly sharedFrame: SharedFrame;
}

/** The belt's GPU objects, and the uniforms the frame loop writes. */
interface BeltPoints {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly referenceJd: number;
  readonly dtDays: THREE.IUniform<number>;
  readonly sunHigh: THREE.Vector3;
  readonly sunLow: THREE.Vector3;
  readonly pixelRatio: THREE.IUniform<number>;
}

/** Nothing here can be clicked: a raycast would walk 84,000 points for no answer. */
function noRaycast(): void {}

/**
 * The records as one interleaved buffer, read through three attributes.
 *
 * The file's own order is what makes this work: a, e and i are floats 0 to 2, the three
 * angles 3 to 5, n and H 6 and 7. The class code, float 8, rides along unread -- it is
 * in the stride either way, and a filter by class will want it on the GPU.
 */
export function buildBeltGeometry(belt: Belt): THREE.BufferGeometry {
  const interleaved = new THREE.InterleavedBuffer(belt.records, RECORD_FLOATS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('aShape', new THREE.InterleavedBufferAttribute(interleaved, 3, RECORD.a));
  geometry.setAttribute(
    'aAngles',
    new THREE.InterleavedBufferAttribute(interleaved, 3, RECORD.node),
  );
  geometry.setAttribute('aMotion', new THREE.InterleavedBufferAttribute(interleaved, 2, RECORD.n));
  // There is no `position` for three to count vertices by, so the range says how many.
  geometry.setDrawRange(0, belt.info.count);
  // The belt spans the Solar System; its bounds say nothing about whether it is on screen.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return geometry;
}

function buildBeltPoints(belt: Belt): BeltPoints {
  const dtDays: THREE.IUniform<number> = { value: 0 };
  const pixelRatio: THREE.IUniform<number> = { value: 1 };
  const sunHigh = new THREE.Vector3();
  const sunLow = new THREE.Vector3();
  const material = new THREE.ShaderMaterial({
    vertexShader: BELT_VERTEX_SHADER,
    fragmentShader: BELT_FRAGMENT_SHADER,
    uniforms: {
      uDtDays: dtDays,
      uSunHigh: { value: sunHigh },
      uSunLow: { value: sunLow },
      uUnitsPerKm: { value: 1 / KM_PER_UNIT },
      uPixelRatio: pixelRatio,
      uFaintH: { value: belt.info.magnitudeLimit },
      uColor: { value: new THREE.Vector3(...BELT_COLOR) },
    },
    // Blended over what is behind, not added to it: see DOT_FAINT_ALPHA. Depth is tested,
    // so a planet in front hides the asteroids behind it, and never written -- a dot has
    // no surface to hide anything with, and writing it would make the dots occlude each
    // other in whatever order the buffer happens to be in.
    transparent: true,
    depthWrite: false,
    // The colour is already a display value; see BELT_COLOR.
    toneMapped: false,
  });
  const points = new THREE.Points(buildBeltGeometry(belt), material);
  points.frustumCulled = false;
  points.raycast = noRaycast;
  return { points, referenceJd: belt.info.referenceJd, dtDays, sunHigh, sunLow, pixelRatio };
}

export function AsteroidBelt({
  source,
  store,
  clock,
  focus,
  visible,
  sharedFrame,
}: AsteroidBeltProps) {
  const belt = useSyncExternalStore(source.subscribe, () => source.belt);
  const shown = visible ? belt : null;
  const built = useMemo(() => (shown === null ? null : buildBeltPoints(shown)), [shown]);

  // The GPU's copy goes with the layer, or with the canvas. 3 MB for B2a; the decoded
  // records stay in BeltSource, so switching the layer back on is an upload, not a fetch.
  useEffect(
    () => () => {
      built?.points.geometry.dispose();
      built?.points.material.dispose();
    },
    [built],
  );

  useFrame(({ gl }) => {
    if (built === null) {
      return;
    }
    const jd = clock.tdbJulianDay;
    // The scene's snapshot, when it ran this frame for this focus and instant; read and
    // left for the labels, which take it. Otherwise worked out here, as they would.
    const shared = sharedFrame.snapshot;
    let sun: Vec3 | undefined =
      shared !== null && shared.focus === focus && shared.jd === jd
        ? shared.bodies.get('sun')?.positionKm
        : undefined;
    sun ??= store.stateRelativeTo('sun', focus, jd)?.position;
    if (sun === undefined) {
      built.points.visible = false;
      return;
    }
    built.points.visible = true;

    // Float64 here, narrowed once by the upload: to 21 seconds at ten years out, which the
    // shader then multiplies by n in float32. beltShader.test.ts measures what that costs.
    built.dtDays.value = jd - built.referenceJd;
    // splitDouble, inlined: no tuple a frame.
    const xHigh = Math.fround(sun.x);
    const yHigh = Math.fround(sun.y);
    const zHigh = Math.fround(sun.z);
    built.sunHigh.set(xHigh, yHigh, zHigh);
    built.sunLow.set(Math.fround(sun.x - xHigh), Math.fround(sun.y - yHigh), Math.fround(sun.z - zHigh));
    // A dot is sized in CSS pixels, and the window can move to a screen of another density.
    built.pixelRatio.value = gl.getPixelRatio();
  });

  return built === null ? null : <primitive object={built.points} />;
}
