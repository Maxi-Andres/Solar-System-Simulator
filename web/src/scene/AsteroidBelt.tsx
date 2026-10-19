import type { BeltInfo, BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import { RECORD, RECORD_FLOATS, type BeltSource } from '../core/belt.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import type { Vec3 } from '../core/vec3.ts';
import {
  BELT_COLOR,
  BELT_FRAGMENT_SHADER,
  BELT_VERTEX_SHADER,
  FAINT_BINS,
  faintBinAlphas,
} from './beltShader.ts';
import { beltLight, CLASS_SLOTS, writeCrowding, type PopulationLight } from './beltCrowding.ts';
import type { SharedFrame } from './satellites.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * The asteroid belt: every asteroid in the tiers loaded so far, at its real position.
 *
 * Each tier is one `THREE.Points` over that tier's own downloaded bytes: the buffer goes
 * to the GPU as it is, nine floats an asteroid, and the vertex shader solves each orbit
 * for the instant on the clock (see beltShader.ts). All of them share one material, so
 * per frame this component sets four uniforms and allocates nothing -- nothing here
 * scales with the number of asteroids, which is the point: the whole catalogue's 1.6
 * million cost the CPU exactly what B2a's 84,000 did.
 *
 * **One Points per tier, not one buffer grown.** A GPU buffer cannot grow in place, so
 * growing one would mean a new buffer and the whole belt uploaded again at every tier --
 * 57 MB to add the last 23 -- and, on the CPU, the old and new copies both alive while
 * the new one is filled: 80 MB at the peak, for a step whose download is the slow part
 * anyway. Separately, each tier is uploaded once, straight from the bytes it arrived in,
 * and dropping one is disposing one buffer. The price is a draw call per tier, five at
 * most, with no state change between them.
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
  /** The Asteroids layer. Off, nothing is drawn and the GPU's copies are let go. */
  readonly visible: boolean;
  readonly sharedFrame: SharedFrame;
}

/** The belt's one material, and the uniforms the frame loop writes. */
interface BeltMaterial {
  readonly material: THREE.ShaderMaterial;
  readonly referenceJd: number;
  readonly dtDays: THREE.IUniform<number>;
  readonly sunHigh: THREE.Vector3;
  readonly sunLow: THREE.Vector3;
  readonly pixelRatio: THREE.IUniform<number>;
  /** Each faint magnitude's opacity; see faintBinAlphas. Rewritten as tiers arrive. */
  readonly faintAlpha: Float32Array;
  /** Each class's crowding scale and region fade, this frame; see beltCrowding.ts. */
  readonly classCrowding: Float32Array;
  readonly classFade: Float32Array;
  /** Where the camera is from the Sun, km: rewritten each frame, never reallocated. */
  readonly cameraFromSunKm: { x: number; y: number; z: number };
}

/** Nothing here can be clicked: a raycast would walk every asteroid for no answer. */
function noRaycast(): void {}

/**
 * A tier's records as one interleaved buffer, read through three attributes.
 *
 * The file's own order is what makes this work: a, e and i are floats 0 to 2, the three
 * angles 3 to 5, and n, H and the class code 6 to 8 -- the class for the crowding and the
 * fade, which are per population (see beltCrowding.ts).
 */
export function buildBeltGeometry(records: Float32Array): THREE.BufferGeometry {
  const interleaved = new THREE.InterleavedBuffer(records, RECORD_FLOATS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('aShape', new THREE.InterleavedBufferAttribute(interleaved, 3, RECORD.a));
  geometry.setAttribute(
    'aAngles',
    new THREE.InterleavedBufferAttribute(interleaved, 3, RECORD.node),
  );
  geometry.setAttribute('aMotion', new THREE.InterleavedBufferAttribute(interleaved, 3, RECORD.n));
  // There is no `position` for three to count vertices by, so the range says how many.
  geometry.setDrawRange(0, records.length / RECORD_FLOATS);
  // The belt spans the Solar System; its bounds say nothing about whether it is on screen.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return geometry;
}

function buildBeltMaterial(info: BeltInfo): BeltMaterial {
  const dtDays: THREE.IUniform<number> = { value: 0 };
  const pixelRatio: THREE.IUniform<number> = { value: 1 };
  const sunHigh = new THREE.Vector3();
  const sunLow = new THREE.Vector3();
  const faintAlpha = new Float32Array(FAINT_BINS);
  const classCrowding = new Float32Array(CLASS_SLOTS).fill(1);
  const classFade = new Float32Array(CLASS_SLOTS).fill(1);
  const material = new THREE.ShaderMaterial({
    vertexShader: BELT_VERTEX_SHADER,
    fragmentShader: BELT_FRAGMENT_SHADER,
    uniforms: {
      uDtDays: dtDays,
      uSunHigh: { value: sunHigh },
      uSunLow: { value: sunLow },
      uUnitsPerKm: { value: 1 / KM_PER_UNIT },
      uPixelRatio: pixelRatio,
      uFaintAlpha: { value: faintAlpha },
      uClassCrowding: { value: classCrowding },
      uClassFade: { value: classFade },
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
  return {
    material,
    referenceJd: info.referenceJd,
    dtDays,
    sunHigh,
    sunLow,
    pixelRatio,
    faintAlpha,
    classCrowding,
    classFade,
    cameraFromSunKm: { x: 0, y: 0, z: 0 },
  };
}

/**
 * One tier on the GPU, for as long as it is mounted: its buffer is uploaded on its first
 * frame and disposed when the tier is let go, the layer goes off, or the canvas goes.
 */
const BeltTierPoints = memo(function BeltTierPoints({
  records,
  material,
}: {
  readonly records: Float32Array;
  readonly material: THREE.ShaderMaterial;
}) {
  const geometry = useMemo(() => buildBeltGeometry(records), [records]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry} material={material} frustumCulled={false} raycast={noRaycast} />
  );
});

export function AsteroidBelt({
  source,
  store,
  clock,
  focus,
  visible,
  sharedFrame,
}: AsteroidBeltProps) {
  const view = useSyncExternalStore(source.subscribe, () => source.view);
  const info = visible ? view.info : null;
  const built = useMemo(() => (info === null ? null : buildBeltMaterial(info)), [info]);
  useEffect(() => () => built?.material.dispose(), [built]);

  // The faint magnitudes share their light among the dots in hand, so it is worked out
  // again whenever a tier arrives or goes: one pass over the records, ten milliseconds or
  // so for all of them, once per tier rather than per frame.
  const faintAlpha = useMemo(
    () => faintBinAlphas(view.tiers.map((tier) => tier.records)),
    [view.tiers],
  );
  useEffect(() => {
    built?.faintAlpha.set(faintAlpha);
  }, [built, faintAlpha]);
  // How many dots each population has in hand and the light they bring: what the frame
  // loop divides by the screen to see how crowded each one is. Once per tier, likewise.
  const populations = useMemo<PopulationLight | null>(
    () =>
      view.info === null
        ? null
        : beltLight(
            view.tiers.map((tier) => tier.records),
            faintAlpha,
            view.info.classes,
          ),
    [view.info, view.tiers, faintAlpha],
  );

  useFrame(({ gl, camera, size }) => {
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
    // With no Sun to hang it on, the belt is not drawn: the shader would put every
    // asteroid round the focus instead.
    built.material.visible = sun !== undefined;
    if (sun === undefined) {
      return;
    }

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

    // How crowded each population is from here, and how small its region: a few dozen
    // multiplications a frame, none of them per asteroid. They change only when the camera
    // or the Sun moves, and both already ask for the frames they need.
    if (populations !== null) {
      const fromSun = built.cameraFromSunKm;
      fromSun.x = camera.position.x * KM_PER_UNIT - sun.x;
      fromSun.y = camera.position.y * KM_PER_UNIT - sun.y;
      fromSun.z = camera.position.z * KM_PER_UNIT - sun.z;
      writeCrowding(
        built.classCrowding,
        built.classFade,
        populations,
        fromSun,
        (camera as THREE.PerspectiveCamera).fov,
        size.height,
      );
    }
  });

  if (built === null) {
    return null;
  }
  return (
    <>
      {view.tiers.map((tier) => (
        <BeltTierPoints key={tier.index} records={tier.records} material={built.material} />
      ))}
    </>
  );
}
