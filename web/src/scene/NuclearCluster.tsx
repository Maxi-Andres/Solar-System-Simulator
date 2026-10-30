import type { BodyId, StarCatalog } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { SGR_A_ID } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { PLACED_STARS, S_STARS, sStarPosition } from '../core/galacticCentreStars.ts';
import { cameraExtinctionV, type NuclearClusterSample } from '../core/nuclearCluster.ts';
import { brightestMagnitude } from '../core/starCatalog.ts';
import type { SimClock } from '../core/time.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { starColor } from './blackbody.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { LENS_VERTEX_GLSL, lensState, lensUniforms } from './lens.ts';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';
import { DISPLAY_FLOOR } from './shading.ts';
import {
  magnitudeToPeakCoefficients,
  PSF_SIGMA_PX,
  STAR_FRAGMENT_SHADER,
  STAR_WING_FRACTION,
} from './starRendering.ts';
import { LIMIT_SLACK, MAX_STAR_SPRITE_PX, splitHigh, splitLow, UNITS_PER_PC } from './stars3dShader.ts';

/**
 * The nuclear star cluster round Sgr A*, drawn as stars: the model's sample
 * (core/nuclearCluster.ts) and the stars measured one by one (core/galacticCentreStars.ts)
 * -- the S-stars moving on their orbits, the young stars of the central parsec and IRS 7
 * where they are seen.
 *
 * Every point is a star of its own brightness, drawn as the 3D stars are (stars3dShader.ts):
 * its magnitude worked out from the camera, m = M_V + 5 log10(d / 10 pc), through the same
 * response, the same limit and the same point spread, so a star here and a catalogue star
 * of the same magnitude look the same. Two things are added:
 *
 * - **the dust in front**, A_V from the camera to the centre (cameraExtinctionV): 30
 *   magnitudes from the Sun, which is why none of this is in the sky from home, and none
 *   from inside the cluster;
 * - **the lens**: near Sgr A* every star is moved to its two images by lensStarAt (lens.ts),
 *   the thin-lens equation for a star at a finite distance -- a star behind the hole bent
 *   round it, one in front of it left where it is.
 *
 * ## Images the lens dims
 *
 * The picture's response is linear in magnitude (starRendering.ts): right for stars seen
 * one by one, and the reason a star five magnitudes fainter still shows. But the lens packs
 * the whole sky's far-side images into a thin ring against the shadow -- a thousand to a
 * pixel, here, where the sky is three hundred thousand stars brighter than Vega -- and
 * summed through that response they came out a solid white ring, where the sky's light,
 * squeezed and spread no brighter than it was (surface brightness is conserved), shows
 * the sky's own dim glow. So an image the lens makes fainter keeps the brightness its
 * star would have, and gives up light in proportion, times mu, as the galaxy's sprites
 * below a pixel give up light rather than size (MilkyWay.tsx); an image it makes brighter
 * is drawn brighter by its magnitude, as the catalogue stars' are. Below the display's
 * darkest step it is not drawn at all.
 *
 * The model's stars are the Nuclear Cluster Model layer; the measured ones are always
 * drawn, as the catalogue's are.
 *
 * ## Precision
 *
 * The sample is float32 parsecs about Sgr A*, at most 16 pc out: 1e-6 pc, 0.2 AU, at the
 * edge. The camera about the hole comes as a float32 pair, as the 3D stars' does about the
 * Sun. The measured stars are placed from the camera in float64 every frame and handed
 * over as offsets.
 */

/** The brightest of the measured stars, M_V: what decides, from afar, whether any could show. */
const BRIGHTEST_MEASURED_V = Math.min(...[...S_STARS, ...PLACED_STARS].map((star) => star.look.absoluteV));

/** The brightest the model's stars are, M_V (nuclearClusterPopulation.ts: the AGB's top). */
const BRIGHTEST_MODEL_V = -1.2;

/**
 * The extinction is worked out again when the camera has moved this share of its distance to
 * the centre, or of a parsec within one: the dust it adds up varies over kiloparsecs.
 */
const EXTINCTION_REFRESH_SHARE = 0.01;

const LOG10_2 = 0.3010299956639812;

/**
 * The vertex shader: the 3D stars' (stars3dShader.ts), with the extinction added and the
 * lens for a star at a finite distance. Positions are parsecs about the point the camera
 * uniforms are taken from: Sgr A* for the sample, the camera itself for the measured stars.
 */
export const CLUSTER_VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uUnitsPerPc;
uniform vec2 uMagnitudeToPeak;
uniform float uMagnitudeLimit;
uniform float uExtinction;
uniform float uFade;
uniform float uSigmaPx;
uniform float uDisplayFloor;
uniform float uPixelRatio;

attribute float absMag;
attribute vec3 starColor;

varying vec3 vColor;
varying float vPeakLinear;
varying float vSizePx;

${LENS_VERTEX_GLSL}

float srgbToLinear(float value) {
  return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4);
}

void main() {
  vec3 rel = (position - uCameraHigh) - uCameraLow;
  float distancePc = max(length(rel), 1e-12);
  float m = absMag + 5.0 * (log2(distancePc) * ${LOG10_2.toFixed(12)} - 1.0) + uExtinction;

  // Where Sgr A* shows it, and how much brighter: lens.ts, for a star at a finite distance.
  // Brighter by its magnitude, as every image is drawn; fainter by its light: see the
  // header, "Images the lens dims".
  float dm;
  bool imaged = lensStarAt(rel, ${PARSEC_KM.toExponential(10)}, dm);
  float lightShare = 1.0;
  if (dm > 0.0) {
    lightShare = exp2(-dm * ${(Math.log2(10) / 2.5).toFixed(10)});
  } else {
    m += dm;
  }

  if (!imaged || m > uMagnitudeLimit + ${LIMIT_SLACK.toFixed(4)}) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vColor = vec3(0.0);
    vPeakLinear = 0.0;
    vSizePx = 1.0;
    return;
  }

  float peak = max(uDisplayFloor, uMagnitudeToPeak.x + uMagnitudeToPeak.y * m);
  vPeakLinear = (peak <= 1.0 ? srgbToLinear(peak) : pow((peak + 0.055) / 1.055, 2.4)) * uFade * lightShare;
  if (vPeakLinear < srgbToLinear(uDisplayFloor)) {
    // An image the lens has dimmed below the darkest step the display shows: nothing to draw.
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vColor = vec3(0.0);
    vPeakLinear = 0.0;
    vSizePx = 1.0;
    return;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);

  float peakOverFloor =
    vPeakLinear / (${(1 + STAR_WING_FRACTION).toFixed(3)} * srgbToLinear(uDisplayFloor));
  float coreRadius = uSigmaPx * sqrt(2.0 * max(0.0, log(max(1.0, peakOverFloor))));
  float wingRadius =
    uSigmaPx * sqrt(max(0.0, 2.0 * peakOverFloor * ${STAR_WING_FRACTION.toFixed(3)} - 1.0));
  vSizePx = min(max(2.0 * max(coreRadius, wingRadius), 1.0), ${MAX_STAR_SPRITE_PX.toFixed(1)});
  gl_PointSize = vSizePx * uPixelRatio;

  vColor = starColor;
}
`;

function clusterUniforms(coefficients: readonly [number, number], limit: number): Record<string, THREE.IUniform> {
  return {
    uCameraHigh: { value: new THREE.Vector3() },
    uCameraLow: { value: new THREE.Vector3() },
    uUnitsPerPc: { value: UNITS_PER_PC },
    uMagnitudeToPeak: { value: new THREE.Vector2(coefficients[0], coefficients[1]) },
    uMagnitudeLimit: { value: limit },
    uExtinction: { value: 0 },
    uFade: { value: 1 },
    uSigmaPx: { value: PSF_SIGMA_PX },
    uDisplayFloor: { value: DISPLAY_FLOOR },
    uPixelRatio: { value: 1 },
    ...lensUniforms(0),
  };
}

function clusterMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: CLUSTER_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
  });
}

/** Galactic-frame parsecs to the scene's axes. */
function galacticToScene(x: number, y: number, z: number, out: Float32Array, offset: number): void {
  const { x: bx, y: by, z: bz } = GALACTIC_BASIS;
  out[offset] = bx.x * x + by.x * y + bz.x * z;
  out[offset + 1] = bx.y * x + by.y * y + bz.y * z;
  out[offset + 2] = bx.z * x + by.z * y + bz.z * z;
}

/** Scene-frame km to Galactic-frame pc. */
function sceneToGalacticPc(v: THREE.Vector3): [number, number, number] {
  const { x: bx, y: by, z: bz } = GALACTIC_BASIS;
  return [
    (bx.x * v.x + bx.y * v.y + bx.z * v.z) / PARSEC_KM,
    (by.x * v.x + by.y * v.y + by.z * v.z) / PARSEC_KM,
    (bz.x * v.x + bz.y * v.y + bz.z * v.z) / PARSEC_KM,
  ];
}

/** The sample as GPU buffers: positions turned to the scene's axes, colours from B-V. */
export function buildSampleGeometry(sample: NuclearClusterSample): THREE.BufferGeometry {
  const positions = new Float32Array(sample.count * 3);
  const colors = new Float32Array(sample.count * 3);
  for (let i = 0; i < sample.count; i += 1) {
    galacticToScene(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!, positions, i * 3);
    const [r, g, b] = starColor(sample.colorIndex[i]!);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('absMag', new THREE.BufferAttribute(sample.absoluteV, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** The measured stars: positions written every frame, magnitudes and colours once. */
function buildMeasuredGeometry(): THREE.BufferGeometry {
  const stars = [...S_STARS, ...PLACED_STARS];
  const positions = new Float32Array(stars.length * 3);
  const magnitudes = new Float32Array(stars.length);
  const colors = new Float32Array(stars.length * 3);
  stars.forEach((star, i) => {
    magnitudes[i] = star.look.absoluteV;
    const [r, g, b] = starColor(star.look.colorIndex);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  });
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('absMag', new THREE.BufferAttribute(magnitudes, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Whether a star of absolute magnitude `absoluteV` could be drawn from `distancePc` behind
 * `extinction`, with the lens's five magnitudes of brightening at most to spare.
 */
function couldShow(absoluteV: number, distancePc: number, extinction: number, limit: number): boolean {
  return absoluteV + 5 * (Math.log10(Math.max(distancePc, 1e-12)) - 1) + extinction - 5 <= limit;
}

export interface NuclearClusterProps {
  readonly catalog: StarCatalog;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The Nuclear Cluster Model layer: the sampled stars. */
  readonly showModel: boolean;
}

const scratchHole = new THREE.Vector3();
const scratchCamera = new THREE.Vector3();
const scratchSun = new THREE.Vector3();
const scratchPc = new THREE.Vector3();

export function NuclearCluster({ catalog, store, clock, focus, showModel }: NuclearClusterProps) {
  const group = useMemo(() => new THREE.Group(), []);
  const coefficients = useMemo(
    () => magnitudeToPeakCoefficients(brightestMagnitude(catalog), catalog.magnitudeLimit),
    [catalog],
  );

  // One set of uniforms for the sample, one for the measured stars (their camera is the
  // origin); each with a twin for the far-side images, sharing every uniform but that.
  const sampleUniforms = useMemo(() => clusterUniforms(coefficients, catalog.magnitudeLimit), [coefficients, catalog]);
  const measuredUniforms = useMemo(() => clusterUniforms(coefficients, catalog.magnitudeLimit), [coefficients, catalog]);
  const materials = useMemo(
    () => ({
      sample: clusterMaterial(sampleUniforms),
      sampleTwin: clusterMaterial({ ...sampleUniforms, uLensImage: { value: 1 } }),
      measured: clusterMaterial(measuredUniforms),
      measuredTwin: clusterMaterial({ ...measuredUniforms, uLensImage: { value: 1 } }),
    }),
    [sampleUniforms, measuredUniforms],
  );

  // Made here, put in the group by the effect below: a memo may run twice (StrictMode), and
  // a second set added here would stay in the group with its positions never written -- every
  // star at the camera, drawn as bright as the sprite allows.
  const measured = useMemo(() => {
    const geometry = buildMeasuredGeometry();
    const points = new THREE.Points(geometry, materials.measured);
    const twin = new THREE.Points(geometry, materials.measuredTwin);
    for (const each of [points, twin]) {
      each.frustumCulled = false;
      each.renderOrder = -1;
    }
    return { geometry, points, twin };
  }, [materials]);
  useEffect(() => {
    group.add(measured.points, measured.twin);
    return () => {
      group.remove(measured.points, measured.twin);
    };
  }, [group, measured]);

  const sample = useRef<{ points: THREE.Points; twin: THREE.Points } | null>(null);
  const asked = useRef(false);
  const worker = useRef<Worker | null>(null);
  const extinction = useRef<{ value: number; cameraKm: THREE.Vector3 | null }>({ value: 0, cameraKm: null });

  useEffect(
    () => () => {
      worker.current?.terminate();
      measured.geometry.dispose();
      sample.current?.points.geometry.dispose();
      for (const material of Object.values(materials)) {
        material.dispose();
      }
    },
    [measured, materials],
  );

  useFrame(({ camera, gl }) => {
    const jd = clock.tdbJulianDay;
    const hole = store.isPropagatedBody(SGR_A_ID) ? store.stateRelativeTo(SGR_A_ID, focus, jd) : null;
    const sun = store.stateRelativeTo('sun', focus, jd);
    if (hole === null || sun === null) {
      group.visible = false;
      return;
    }
    // The camera about the hole, km, float64.
    scratchCamera.set(
      camera.position.x * KM_PER_UNIT - hole.position.x,
      camera.position.y * KM_PER_UNIT - hole.position.y,
      camera.position.z * KM_PER_UNIT - hole.position.z,
    );
    const distancePc = scratchCamera.length() / PARSEC_KM;

    // The dust between, again only once the camera has moved enough to change it.
    const last = extinction.current;
    const refresh = EXTINCTION_REFRESH_SHARE * Math.max(scratchCamera.length(), PARSEC_KM);
    if (last.cameraKm === null || last.cameraKm.distanceTo(scratchCamera) > refresh) {
      scratchSun.set(
        camera.position.x * KM_PER_UNIT - sun.position.x,
        camera.position.y * KM_PER_UNIT - sun.position.y,
        camera.position.z * KM_PER_UNIT - sun.position.z,
      );
      const cameraGalactic = sceneToGalacticPc(scratchSun);
      scratchHole.set(hole.position.x - sun.position.x, hole.position.y - sun.position.y, hole.position.z - sun.position.z);
      last.value = cameraExtinctionV(cameraGalactic, sceneToGalacticPc(scratchHole));
      last.cameraKm = (last.cameraKm ?? new THREE.Vector3()).copy(scratchCamera);
    }
    const limit = catalog.magnitudeLimit;
    const measuredShows = couldShow(BRIGHTEST_MEASURED_V, distancePc - 1, last.value, limit);
    const modelShows = showModel && couldShow(BRIGHTEST_MODEL_V, distancePc - 16, last.value, limit);
    group.visible = measuredShows || modelShows;
    if (!group.visible) {
      return;
    }

    // The sample, from the worker, the first time any of it could show.
    if (modelShows && !asked.current) {
      asked.current = true;
      const made = new Worker(new URL('../core/nuclearCluster.worker.ts', import.meta.url), { type: 'module' });
      worker.current = made;
      made.onmessage = (event: MessageEvent<NuclearClusterSample>) => {
        const geometry = buildSampleGeometry(event.data);
        const points = new THREE.Points(geometry, materials.sample);
        const twin = new THREE.Points(geometry, materials.sampleTwin);
        for (const each of [points, twin]) {
          each.frustumCulled = false;
          each.renderOrder = -1;
          group.add(each);
        }
        sample.current = { points, twin };
        made.terminate();
        worker.current = null;
        renderDemand.request();
      };
      made.postMessage(null);
    }

    // Drawn about the camera: a rotation only, the translation cancelled in float64.
    group.position.copy(camera.position);
    const pixelRatio = gl.getPixelRatio();
    const cameraPc = scratchPc.copy(scratchCamera).multiplyScalar(1 / PARSEC_KM);
    (sampleUniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(cameraPc.x), splitHigh(cameraPc.y), splitHigh(cameraPc.z));
    (sampleUniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(cameraPc.x), splitLow(cameraPc.y), splitLow(cameraPc.z));
    for (const uniforms of [sampleUniforms, measuredUniforms]) {
      uniforms['uExtinction']!.value = last.value;
      uniforms['uPixelRatio']!.value = pixelRatio;
    }

    // The measured stars, from the camera, pc.
    const positions = measured.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    let i = 0;
    for (const star of S_STARS) {
      const at = sStarPosition(star, jd);
      array[i * 3] = (at.x - scratchCamera.x) / PARSEC_KM;
      array[i * 3 + 1] = (at.y - scratchCamera.y) / PARSEC_KM;
      array[i * 3 + 2] = (at.z - scratchCamera.z) / PARSEC_KM;
      i += 1;
    }
    for (const star of PLACED_STARS) {
      array[i * 3] = (star.position.x - scratchCamera.x) / PARSEC_KM;
      array[i * 3 + 1] = (star.position.y - scratchCamera.y) / PARSEC_KM;
      array[i * 3 + 2] = (star.position.z - scratchCamera.z) / PARSEC_KM;
      i += 1;
    }
    positions.needsUpdate = true;
    measured.points.visible = measuredShows;
    measured.twin.visible = measuredShows && lensState.on;
    if (sample.current !== null) {
      sample.current.points.visible = modelShows;
      sample.current.twin.visible = modelShows && lensState.on;
    }
  });

  return <primitive object={group} />;
}
