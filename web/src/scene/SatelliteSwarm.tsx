import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  parseBulkSatelliteBodyId,
  parseSgpSatelliteBodyId,
  satrecOf,
  sgp4At,
} from '../core/satelliteBodies.ts';
import { chipShown, SATELLITE_CHIPS } from '../core/satelliteGroups.ts';
import {
  BULK_WINDOW_DAYS,
  NAMED_WINDOW_DAYS,
  SAT,
  SATELLITE_FLOATS,
  type Satellites,
  type SatelliteSource,
} from '../core/satellites.ts';
import { applyMatrix, satelliteInstant } from '../core/teme.ts';
import type { SimClock } from '../core/time.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import type { Vec3 } from '../core/vec3.ts';
import { satelliteLight, writeSatelliteCrowding, type RegimeLight } from './satelliteCrowding.ts';
import {
  BULK_VERTEX_SHADER,
  CHIP_SLOTS,
  PLACED_VERTEX_SHADER,
  REGIME_SLOTS,
  SATELLITE_FRAGMENT_SHADER,
  SATELLITE_TYPE_ALPHA,
  SATELLITE_TYPE_COLOR,
  SATELLITE_TYPE_SIZE_PX,
} from './satelliteShader.ts';
import type { SharedFrame } from './satellites.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * Earth's satellites as dots: the bulk, placed by the GPU from its mean elements, and the
 * few hundred the bulk model cannot follow, placed here by SGP4 (see satellites.ts).
 *
 * **The bulk** is one `THREE.Points` over the downloaded records, the belt's way (see
 * AsteroidBelt): the buffer goes to the GPU as it came, and per frame this sets a dozen
 * uniforms and touches no satellite. **The SGP4 tier** is a second, small Points whose
 * positions are worked out here, each frame the clock has moved and only while Earth's
 * system is open on screen: 393 SGP4 calls in the first run's data, about a millisecond
 * (measured in satelliteBodies.test.ts) -- not worth staggering across frames, which would
 * put each dot up to a few frames behind. Written as Earth-centred kilometres -- small
 * numbers float32 holds to half a metre in LEO and two at GEO -- and moved onto the focus
 * by the shader, as the bulk is. The named satellites are bodies of their own
 * (satelliteBodies.ts) and are in neither.
 *
 * Both are drawn only inside their windows -- the bulk within BULK_WINDOW_DAYS of the
 * data's reference instant, an SGP4 dot within NAMED_WINDOW_DAYS of its own epoch -- and
 * the Layers panel says so. Live, the clock is always inside.
 *
 * The dots are a legibility convention, as the belt's are: constant on screen, a pixel or
 * so; see SATELLITE_TYPE_COLOR. Their positions are not.
 *
 * Mounted always, between SolarSystem and LabelProjector, for the belt's reason: it reads
 * Earth's place from the scene's snapshot before the labels take it.
 */

export interface SatelliteSwarmProps {
  readonly source: SatelliteSource;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The Satellites layer. Off, nothing is drawn and the GPU's copies are let go. */
  readonly visible: boolean;
  /** Which chips are drawn, a bit per SATELLITE_CHIPS entry; see the view store. */
  readonly chips: number;
  readonly sharedFrame: SharedFrame;
}

/** The uniforms both materials share, written once a frame. */
interface SwarmUniforms {
  readonly dtDays: THREE.IUniform<number>;
  readonly teme: THREE.IUniform<THREE.Matrix3>;
  readonly earthHigh: THREE.Vector3;
  readonly earthLow: THREE.Vector3;
  readonly pixelRatio: THREE.IUniform<number>;
  readonly chipVisible: Float32Array;
  readonly regimeCrowding: Float32Array;
  readonly fade: THREE.IUniform<number>;
  readonly hidden: Int32Array;
}

function noRaycast(): void {}

function swarmUniforms(): SwarmUniforms {
  return {
    dtDays: { value: 0 },
    teme: { value: new THREE.Matrix3() },
    earthHigh: new THREE.Vector3(),
    earthLow: new THREE.Vector3(),
    pixelRatio: { value: 1 },
    chipVisible: new Float32Array(CHIP_SLOTS).fill(1),
    regimeCrowding: new Float32Array(REGIME_SLOTS).fill(1),
    fade: { value: 1 },
    hidden: new Int32Array([-1, -1]),
  };
}

function swarmMaterial(vertexShader: string, u: SwarmUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: SATELLITE_FRAGMENT_SHADER,
    uniforms: {
      uDtDays: u.dtDays,
      uTeme: u.teme,
      uEarthHigh: { value: u.earthHigh },
      uEarthLow: { value: u.earthLow },
      uUnitsPerKm: { value: 1 / KM_PER_UNIT },
      uPixelRatio: u.pixelRatio,
      uChipVisible: { value: u.chipVisible },
      uRegimeCrowding: { value: u.regimeCrowding },
      uFade: u.fade,
      uTypeColor: { value: SATELLITE_TYPE_COLOR.map((rgb) => new THREE.Vector3(...rgb)) },
      uTypeSize: { value: Float32Array.from(SATELLITE_TYPE_SIZE_PX) },
      uTypeAlpha: { value: Float32Array.from(SATELLITE_TYPE_ALPHA) },
      uHidden: { value: u.hidden },
    },
    // The belt's blending, for the belt's reasons: over what is behind, depth tested and
    // never written. See AsteroidBelt.
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** The bulk's records as one interleaved buffer read through four attributes, and its chips. */
export function buildBulkGeometry(satellites: Satellites): THREE.BufferGeometry {
  const interleaved = new THREE.InterleavedBuffer(satellites.records, SATELLITE_FLOATS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('aShape', new THREE.InterleavedBufferAttribute(interleaved, 3, SAT.a));
  geometry.setAttribute('aAngles', new THREE.InterleavedBufferAttribute(interleaved, 3, SAT.node));
  geometry.setAttribute('aRates', new THREE.InterleavedBufferAttribute(interleaved, 3, SAT.dM));
  geometry.setAttribute('aExtra', new THREE.InterleavedBufferAttribute(interleaved, 3, SAT.ddM));
  geometry.setAttribute('aChip', new THREE.BufferAttribute(Float32Array.from(satellites.chips), 1));
  geometry.setDrawRange(0, satellites.info.bulk.count);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return geometry;
}

/** The SGP4 tier on the GPU: positions written each frame, and what each dot is. */
interface PlacedTier {
  readonly geometry: THREE.BufferGeometry;
  readonly position: THREE.BufferAttribute;
  readonly info: THREE.BufferAttribute;
  /** SGP4's record per satellite, or null for one it cannot read. */
  readonly satrecs: readonly (ReturnType<typeof satrecOf>)[];
  /** The instant the buffer was last written for, and which were hidden then. */
  lastJd: number;
}

function buildPlacedTier(satellites: Satellites): PlacedTier {
  const count = satellites.sgp4.length;
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  const info = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  info.setUsage(THREE.DynamicDrawUsage);
  satellites.sgp4.forEach((satellite, k) => {
    info.setXYZ(k, satellites.sgp4Chips[k]!, satellite.flags, 0);
  });
  geometry.setAttribute('position', position);
  geometry.setAttribute('aInfo', info);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return {
    geometry,
    position,
    info,
    satrecs: satellites.sgp4.map((satellite) => satrecOf(satellite.omm, satellite.omm.OBJECT_NAME)),
    lastJd: Number.NaN,
  };
}

/**
 * Every SGP4-tier satellite's place at `jdTdb` into the buffers: Earth-centred km in the
 * scene frame, and an opacity of one inside its window and zero outside it, where SGP4
 * cannot place it, or where it is a body of its own just now. Allocates nothing but what
 * satellite.js does per call.
 */
export function writePlacedTier(
  satrecs: readonly (ReturnType<typeof satrecOf>)[],
  jdTdb: number,
  positions: Float32Array,
  info: Float32Array,
  hidden: ReadonlySet<number>,
): void {
  const { jdUtc, matrix } = satelliteInstant(jdTdb);
  for (let k = 0; k < satrecs.length; k += 1) {
    const satrec = satrecs[k];
    let shown = 0;
    if (
      satrec !== null &&
      satrec !== undefined &&
      !hidden.has(Number(satrec.satnum)) &&
      Math.abs(jdUtc - satrec.jdsatepoch) <= NAMED_WINDOW_DAYS
    ) {
      const teme = sgp4At(satrec, jdUtc);
      if (teme !== null) {
        applyMatrix(matrix, teme.position.x, teme.position.y, teme.position.z, scratch, 0);
        positions[k * 3] = scratch[0]!;
        positions[k * 3 + 1] = scratch[1]!;
        positions[k * 3 + 2] = scratch[2]!;
        shown = 1;
      }
    }
    info[k * 3 + 2] = shown;
  }
}

const scratch = new Float64Array(3);
/** Where the camera is from Earth, km: rewritten each frame, never reallocated. */
const cameraFromEarth = { x: 0, y: 0, z: 0 };
const NO_NUMBERS: ReadonlySet<number> = new Set();

export function SatelliteSwarm({ source, store, clock, focus, visible, chips, sharedFrame }: SatelliteSwarmProps) {
  const loaded = useSyncExternalStore(source.subscribe, () => source.value);
  const satellites = visible ? loaded : null;
  const uniforms = useMemo(swarmUniforms, []);
  const bulk = useMemo(() => {
    if (satellites === null) {
      return null;
    }
    const points = new THREE.Points(buildBulkGeometry(satellites), swarmMaterial(BULK_VERTEX_SHADER, uniforms));
    points.frustumCulled = false;
    points.raycast = noRaycast;
    return points;
  }, [satellites, uniforms]);
  const placed = useMemo(() => {
    if (satellites === null || satellites.sgp4.length === 0) {
      return null;
    }
    const tier = buildPlacedTier(satellites);
    const points = new THREE.Points(tier.geometry, swarmMaterial(PLACED_VERTEX_SHADER, uniforms));
    points.frustumCulled = false;
    points.raycast = noRaycast;
    return { tier, points };
  }, [satellites, uniforms]);
  useEffect(
    () => () => {
      bulk?.geometry.dispose();
      bulk?.material.dispose();
    },
    [bulk],
  );
  useEffect(
    () => () => {
      placed?.tier.geometry.dispose();
      placed?.points.material.dispose();
    },
    [placed],
  );

  // One or zero per chip, by whether it is switched on in the Layers panel: multiplied into
  // the fade in the shader, so a hidden chip is clipped before its orbit is solved.
  const chipVisible = useMemo(() => {
    const out = new Float32Array(CHIP_SLOTS);
    SATELLITE_CHIPS.forEach((_, index) => {
      out[index] = chipShown(chips, index) ? 1 : 0;
    });
    return out;
  }, [chips]);
  useEffect(() => {
    uniforms.chipVisible.set(chipVisible);
  }, [uniforms, chipVisible]);
  const regimes = useMemo<RegimeLight | null>(
    () =>
      satellites === null
        ? null
        : satelliteLight(
            satellites.records,
            satellites.chips,
            satellites.sgp4.map((satellite) => satellite.flags),
            satellites.sgp4Chips,
            chipVisible,
          ),
    [satellites, chipVisible],
  );

  // The satellites that are bodies of their own (see satelliteBodies.ts), whose dots are
  // hidden: bulk records by index, SGP4-tier ones by catalogue number.
  const version = useStoreVersion(store);
  const hidden = useMemo(() => {
    void version;
    const bulkRecords: number[] = [];
    const numbers = new Set<number>();
    for (const body of store.bodies) {
      if (!store.isPropagatedBody(body.id)) {
        continue;
      }
      const k = parseBulkSatelliteBodyId(body.id);
      if (k !== null) {
        bulkRecords.push(k);
      }
      const norad = parseSgpSatelliteBodyId(body.id);
      if (norad !== null) {
        numbers.add(norad);
      }
    }
    return { bulkRecords, numbers: numbers.size === 0 ? NO_NUMBERS : numbers };
  }, [store, version]);
  useEffect(() => {
    uniforms.hidden[0] = hidden.bulkRecords[0] ?? -1;
    uniforms.hidden[1] = hidden.bulkRecords[1] ?? -1;
    if (placed !== null) {
      placed.tier.lastJd = Number.NaN;
    }
  }, [uniforms, hidden, placed]);

  useFrame(({ gl, camera, size }) => {
    if (satellites === null || (bulk === null && placed === null)) {
      return;
    }
    const jd = clock.tdbJulianDay;
    const shared = sharedFrame.snapshot;
    let earth: Vec3 | undefined =
      shared !== null && shared.focus === focus && shared.jd === jd
        ? shared.bodies.get('earth')?.positionKm
        : undefined;
    earth ??= store.stateRelativeTo('earth', focus, jd)?.position;
    const instant = satelliteInstant(jd);
    const dt = instant.jdUtc - satellites.info.referenceJdUtc;
    // Without Earth to hang them on the dots would ring the focus instead; outside the
    // window the bulk model is no longer what SGP4 says (see BULK_WINDOW_DAYS).
    const anywhere = earth !== undefined;
    if (bulk !== null) {
      bulk.visible = anywhere && Math.abs(dt) <= BULK_WINDOW_DAYS;
    }
    if (placed !== null) {
      placed.points.visible = anywhere;
    }
    if (earth === undefined) {
      return;
    }

    cameraFromEarth.x = camera.position.x * KM_PER_UNIT - earth.x;
    cameraFromEarth.y = camera.position.y * KM_PER_UNIT - earth.y;
    cameraFromEarth.z = camera.position.z * KM_PER_UNIT - earth.z;
    const fade =
      regimes === null
        ? 0
        : writeSatelliteCrowding(
            uniforms.regimeCrowding,
            regimes,
            cameraFromEarth,
            (camera as THREE.PerspectiveCamera).fov,
            size.height,
          );
    uniforms.fade.value = fade;
    // Faded out, nothing is worked out at all: not a uniform, not an SGP4 call.
    if (fade <= 0) {
      if (bulk !== null) {
        bulk.visible = false;
      }
      if (placed !== null) {
        placed.points.visible = false;
      }
      return;
    }

    uniforms.dtDays.value = dt;
    const m = instant.matrix;
    uniforms.teme.value.set(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[6]!, m[7]!, m[8]!);
    // splitDouble, inlined: no tuple a frame.
    const xHigh = Math.fround(earth.x);
    const yHigh = Math.fround(earth.y);
    const zHigh = Math.fround(earth.z);
    uniforms.earthHigh.set(xHigh, yHigh, zHigh);
    uniforms.earthLow.set(
      Math.fround(earth.x - xHigh),
      Math.fround(earth.y - yHigh),
      Math.fround(earth.z - zHigh),
    );
    uniforms.pixelRatio.value = gl.getPixelRatio();

    if (placed !== null && placed.tier.lastJd !== jd) {
      placed.tier.lastJd = jd;
      writePlacedTier(
        placed.tier.satrecs,
        jd,
        placed.tier.position.array as Float32Array,
        placed.tier.info.array as Float32Array,
        hidden.numbers,
      );
      placed.tier.position.needsUpdate = true;
      placed.tier.info.needsUpdate = true;
    }
  });

  return (
    <>
      {bulk !== null && <primitive object={bulk} />}
      {placed !== null && <primitive object={placed.points} />}
    </>
  );
}
