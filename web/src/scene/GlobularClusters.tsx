import type { BodyId, StarCatalog } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { clusterLuminosity, populationColourIndex, unresolvedShare } from '../core/globularClusterLight.ts';
import {
  CLUSTER_COLOR,
  clusterDisplayName,
  clusterExtinctionV,
  clusterPopulation,
  clusterSampleRequest,
  type ClusterSample,
  type GlobularClusterArchive,
} from '../core/globularClusters.ts';
import { columnAt } from '../core/localGroup.ts';
import { dustColumn } from '../core/nuclearCluster.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { LazySource } from '../core/satellites.ts';
import { brightestMagnitude } from '../core/starCatalog.ts';
import { julianYearsSinceJ2000, KM_S_TO_PC_PER_YEAR, PARSEC_KM, STARS3D_FROM_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { nearestMarker, PICK_RADIUS_PX } from './ExoplanetHosts.tsx';
import { SPRITE_FRAGMENT_GLSL, SPRITE_VERTEX_GLSL, spriteGeometry } from './gaussianSprite.ts';
import { lensState } from './lens.ts';
import { MIN_SIGMA_PX, WHITE_MU } from './LocalGroup.tsx';
import { galaxyVisibility } from './MilkyWay.tsx';
import { clusterMaterial, clusterUniforms, sceneToGalacticPc } from './NuclearCluster.tsx';
import { KM_PER_UNIT } from './scale.ts';
import { magnitudeToPeakCoefficients } from './starRendering.ts';
import { splitHigh, splitLow, UNITS_PER_PC } from './stars3dShader.ts';
import { setMarkerPointer } from './markerPointer.ts';
import { mapStrength } from './Starfield.tsx';

/**
 * The globular clusters (core/globularClusters.ts): every one marked -- a ring with a dot in
 * it, the old astronomers' sign for a cluster -- on the map and with the galaxy in view, as
 * the pulsars are; and the one the camera is near drawn as its stars, a sample of the model
 * built from its measured light and size, each star of its own brightness, through the
 * nuclear cluster's shader (NuclearCluster.tsx): the same response, limit and point spread
 * as every star, the dust in front of it added, the lens near Sgr A*.
 *
 * ## Which cluster is drawn
 *
 * The nearest whose brightest stars could show from the camera -- an AGB star of M_V -3, at
 * the near side of the cluster's tidal radius, behind the cluster's extinction from the Sun
 * at most. One at a time: a second, if the camera could see two, is a mark only. Sampled in
 * a worker when it first could show, kept until another takes its place.
 *
 * ## The dust in front
 *
 * From the Sun, A_V = 3.1 E(B-V) (Harris); from anywhere else, that times the share of the
 * Sun's dust column to the cluster that lies between the camera and it, in the galaxy model's
 * dust disc -- as the nuclear cluster's (nuclearCluster.ts cameraExtinctionV). A cluster
 * Harris gives no reddening for is drawn with none, and its panel says so.
 *
 * ## Its light from far off
 *
 * Where its stars are not drawn, each cluster is its light taken whole
 * (core/globularClusterLight.ts): a point, as a galaxy too small for a pixel is
 * (LocalGroup.tsx), on the galaxies' exposure -- a Gaussian of its half-light radius, never
 * narrower than MIN_SIGMA_PX, holding all its luminosity, its column over WHITE_MU's, drawn out to
 * where it fades below a display step however far past white its centre is (gaussianSprite.ts). So from
 * outside the Milky Way 47 Tuc and Omega Cen are where they are with the marks off, as they
 * are in a photograph, on the exposure the Clouds beside them are drawn with.
 *
 * - **Dimmed by the dust in front**, as its stars are: its A_V from the Sun times the share of
 *   that dust column between the camera and it, worked out again as the camera moves. Grey,
 *   as the stars' is: the reddening is not drawn.
 * - **Giving way to its stars**: for the cluster whose stars are drawn the point holds only
 *   the light of those too faint to be -- fainter than the picture's limit from the camera, or
 *   than the sample's limit at its half-light radius (unresolvedShare) -- so no light is
 *   drawn twice; nearer than POINT_NEAR_FULL half-light radii it fades, gone by
 *   POINT_NEAR_FROM, where the light round the camera is its stars.
 * - **Where**: as the galaxies' light, once out of the Sun's neighbourhood (galaxyVisibility).
 *   From the Solar System the sky is the star catalogues', Hipparcos and Tycho-2, which hold
 *   single stars and not a cluster's light taken whole -- as they hold no galaxy's.
 * - The Icons layer does not touch it: it is the cluster's light, not a mark.
 */

/** The brightest a cluster's stars are, M_V: the 12 Gyr populations' AGB tip. */
const BRIGHTEST_V = -3;
/** The marker's size, CSS pixels: the ring's radius and the dot's. */
const SPRITE_PX = 13;
const RING_RADIUS_PX = 4.2;
const DOT_RADIUS_PX = 1.1;
const CLICK_SLOP_PX = 5;
/** The extinction is worked out again when the camera has moved this share of its distance to the cluster. */
const EXTINCTION_REFRESH_SHARE = 0.01;
/** The points' dust is worked out again when the camera has moved this share of its distance to the nearest cluster. */
const POINT_DUST_REFRESH_SHARE = 0.05;
/** The point fades between these distances from the cluster's centre, half-light radii (see the header). */
export const POINT_NEAR_FROM = 4;
export const POINT_NEAR_FULL = 10;
/** A Gaussian's half-light radius in units of its sigma: sqrt(2 ln 2). */
export const HALF_LIGHT_SIGMAS = Math.sqrt(2 * Math.LN2);

const VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uMotion;
uniform float uUnitsPerPc;
uniform float uPixelRatio;

attribute vec3 velocity;

void main() {
  vec3 rel = ((position - uCameraHigh) - uCameraLow) + velocity * uMotion;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  gl_PointSize = ${SPRITE_PX.toFixed(1)} * uPixelRatio;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;

void main() {
  float r = length(gl_PointCoord - 0.5) * ${SPRITE_PX.toFixed(1)};
  float ring = 1.0 - smoothstep(0.35, 0.95, abs(r - ${RING_RADIUS_PX.toFixed(2)}));
  float dot = 1.0 - smoothstep(${(DOT_RADIUS_PX - 0.5).toFixed(2)}, ${(DOT_RADIUS_PX + 0.5).toFixed(2)}, r);
  float alpha = max(0.6 * ring, 0.8 * dot) * uFade;
  if (alpha < 0.004) {
    discard;
  }
  gl_FragColor = vec4(uColor, alpha);
}
`;

const POINT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uMotion;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
attribute vec3 aCentre;
attribute vec3 aVelocity;
// The colour times the luminosity over the white column; the half-light radius, pc; the
// share drawn (the fade, the dust, the stars' handover: worked out on the CPU each frame).
attribute vec3 aLight;
attribute float aHalfLightPc;
attribute float aShare;
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_VERTEX_GLSL}

void main() {
  vec3 rel = ((aCentre - uCameraHigh) - uCameraLow) + aVelocity * uMotion;
  float distancePc = length(rel);
  float sigmaPx = max(${MIN_SIGMA_PX.toFixed(2)}, aHalfLightPc / distancePc * uPixelsPerRadian / ${HALF_LIGHT_SIGMAS.toFixed(4)});
  float sigmaPc = sigmaPx / uPixelsPerRadian * distancePc;
  // LocalGroup.tsx pointPeak: L / (2 pi sigma^2).
  vPeak = aLight * aShare / (6.2831853 * sigmaPc * sigmaPc);
  vSigmaPx = sigmaPx;
  // Out to where its light falls below the floor, however far past white its centre is.
  gl_Position = spriteCorner(projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0), spriteRadiusPx(vPeak, sigmaPx));
  #include <logdepthbuf_vertex>
}
`;

/** As LocalGroup.tsx's points': the Gaussian, through the galaxies' soft shoulder. */
const POINT_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_FRAGMENT_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(spriteLight(vPeak, vSigmaPx), 1.0);
}
`;

/** 0 to 1 across [from, to], smoothly. */
function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export interface GlobularClustersProps {
  readonly source: LazySource<GlobularClusterArchive>;
  readonly catalog: StarCatalog;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** The Icons layer: off, the marks go and the cluster's stars stay. */
  readonly showMarks: boolean;
  readonly onPick: (k: number) => void;
}

const noRaycast = (): void => {};
const scratchCamera = new THREE.Vector3();
const scratchSun = new THREE.Vector3();
const scratchCluster = new THREE.Vector3();

export function GlobularClusters({
  source,
  catalog,
  store,
  clock,
  focus,
  visible,
  showMarks,
  onPick,
}: GlobularClustersProps) {
  const { gl, camera } = useThree();
  const archive = useSyncExternalStore(source.subscribe, () => source.value);
  const markersRef = useRef<THREE.Group>(null);
  const starsGroup = useMemo(() => new THREE.Group(), []);
  const lightGroup = useMemo(() => new THREE.Group(), []);
  const requested = useRef(false);
  const frame = useRef({ fade: 0, cameraPc: new THREE.Vector3(), jd: 0 });
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // The marks.
  const markerUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraHigh: { value: new THREE.Vector3() },
      uCameraLow: { value: new THREE.Vector3() },
      uMotion: { value: 0 },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color().setStyle(CLUSTER_COLOR, THREE.LinearSRGBColorSpace) },
      uFade: { value: 0 },
    }),
    [],
  );
  const markers = useMemo(() => {
    if (archive === null) {
      return null;
    }
    const c = archive.catalog;
    const position = new Float32Array(c.count * 3);
    const velocity = new Float32Array(c.count * 3);
    for (let k = 0; k < c.count; k += 1) {
      position.set([c.x[k]!, c.y[k]!, c.z[k]!], k * 3);
      velocity.set([c.vx[k]!, c.vy[k]!, c.vz[k]!], k * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocity, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: markerUniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    points.frustumCulled = false;
    points.raycast = noRaycast;
    return { points, position, velocity, count: c.count };
  }, [archive, markerUniforms]);
  useEffect(() => {
    const group = markersRef.current;
    if (group === null || markers === null) {
      return;
    }
    group.add(markers.points);
    renderDemand.request();
    return () => {
      group.remove(markers.points);
      markers.points.geometry.dispose();
      (markers.points.material as THREE.Material).dispose();
    };
  }, [markers]);

  // Each cluster's light, as a point (see the header).
  const pointUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraHigh: markerUniforms['uCameraHigh']!,
      uCameraLow: markerUniforms['uCameraLow']!,
      uMotion: markerUniforms['uMotion']!,
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelsPerRadian: { value: 1 },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
    }),
    [markerUniforms],
  );
  const points = useMemo(() => {
    if (archive === null || markers === null) {
      return null;
    }
    const c = archive.catalog;
    const white = columnAt(WHITE_MU);
    const light = new Float32Array(c.count * 3);
    const populations = [];
    for (let k = 0; k < c.count; k += 1) {
      const population = clusterPopulation(c.feH[k] ?? null);
      populations.push(population);
      // Its whole light, in its population's colour, over the white column.
      const [r, g, b] = starColor(populationColourIndex(population));
      const scale = clusterLuminosity(c, k).luminosity / white;
      light.set([r * scale, g * scale, b * scale], k * 3);
    }
    const geometry = spriteGeometry(c.count);
    geometry.setAttribute('aCentre', new THREE.InstancedBufferAttribute(markers.position, 3));
    geometry.setAttribute('aVelocity', new THREE.InstancedBufferAttribute(markers.velocity, 3));
    geometry.setAttribute('aLight', new THREE.InstancedBufferAttribute(light, 3));
    geometry.setAttribute('aHalfLightPc', new THREE.InstancedBufferAttribute(Float32Array.from(c.halfLightRadiusPc), 1));
    const share = new THREE.InstancedBufferAttribute(new Float32Array(c.count), 1);
    share.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aShare', share);
    const object = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: pointUniforms,
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    object.frustumCulled = false;
    object.raycast = noRaycast;
    return {
      object,
      share,
      populations,
      distancePc: new Float64Array(c.count),
      // A_V from the camera, and the share of the light it lets through.
      extinction: new Float64Array(c.count),
      transmission: new Float64Array(c.count).fill(1),
      dustFrom: null as THREE.Vector3 | null,
    };
  }, [archive, markers, pointUniforms]);
  useEffect(() => {
    if (points === null) {
      return;
    }
    lightGroup.add(points.object);
    renderDemand.request();
    return () => {
      lightGroup.remove(points.object);
      points.object.geometry.dispose();
      (points.object.material as THREE.Material).dispose();
    };
  }, [points, lightGroup]);

  // The stars of the cluster the camera is near.
  const coefficients = useMemo(
    () => magnitudeToPeakCoefficients(brightestMagnitude(catalog), catalog.magnitudeLimit),
    [catalog],
  );
  const starUniforms = useMemo(() => clusterUniforms(coefficients, catalog.magnitudeLimit), [coefficients, catalog]);
  const materials = useMemo(
    () => ({ stars: clusterMaterial(starUniforms), twin: clusterMaterial({ ...starUniforms, uLensImage: { value: 1 } }) }),
    [starUniforms],
  );
  const drawn = useRef<{ k: number; points: THREE.Points; twin: THREE.Points; limitV: number } | null>(null);
  const pending = useRef<number | null>(null);
  const worker = useRef<Worker | null>(null);
  const extinction = useRef<{ k: number; value: number; cameraKm: THREE.Vector3 | null }>({ k: -1, value: 0, cameraKm: null });

  useEffect(
    () => () => {
      worker.current?.terminate();
      drawn.current?.points.geometry.dispose();
      materials.stars.dispose();
      materials.twin.dispose();
    },
    [materials],
  );

  useFrame(({ camera: frameCamera, gl: renderer }) => {
    const markersGroup = markersRef.current;
    const jd = clock.tdbJulianDay;
    const sun = store.stateRelativeTo('sun', focus, jd);
    if (markersGroup === null || sun === null || !visible) {
      if (markersGroup !== null) markersGroup.visible = false;
      starsGroup.visible = false;
      lightGroup.visible = false;
      frame.current.fade = 0;
      return;
    }
    scratchSun.set(
      frameCamera.position.x * KM_PER_UNIT - sun.position.x,
      frameCamera.position.y * KM_PER_UNIT - sun.position.y,
      frameCamera.position.z * KM_PER_UNIT - sun.position.z,
    );
    if (!requested.current && scratchSun.length() > STARS3D_FROM_KM) {
      requested.current = true;
      void source.request();
    }
    if (archive === null || markers === null || points === null) {
      markersGroup.visible = false;
      starsGroup.visible = false;
      lightGroup.visible = false;
      return;
    }
    const c = archive.catalog;
    const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
    const cameraPc = frame.current.cameraPc.copy(scratchSun).multiplyScalar(1 / PARSEC_KM);
    const pixelRatio = renderer.getPixelRatio();

    // The marks, as the pulsars'.
    const fade = showMarks ? mapStrength(frameCamera.position.length() * KM_PER_UNIT) : 0;
    frame.current.fade = fade;
    frame.current.jd = jd;
    markersGroup.visible = fade > 0;
    markersGroup.position.copy(frameCamera.position);
    (markerUniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(cameraPc.x), splitHigh(cameraPc.y), splitHigh(cameraPc.z));
    (markerUniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(cameraPc.x), splitLow(cameraPc.y), splitLow(cameraPc.z));
    markerUniforms['uMotion']!.value = motion;
    markerUniforms['uPixelRatio']!.value = pixelRatio;
    markerUniforms['uFade']!.value = fade;

    // Which cluster's stars, if any, could show.
    let best = -1;
    let bestPc = Infinity;
    for (let k = 0; k < c.count; k += 1) {
      const dx = c.x[k]! + c.vx[k]! * motion - cameraPc.x;
      const dy = c.y[k]! + c.vy[k]! * motion - cameraPc.y;
      const dz = c.z[k]! + c.vz[k]! * motion - cameraPc.z;
      const d = Math.hypot(dx, dy, dz);
      points.distancePc[k] = d;
      const near = Math.max(1e-3, d - c.tidalRadiusPc[k]!);
      const could = BRIGHTEST_V + 5 * (Math.log10(near) - 1) <= catalog.magnitudeLimit;
      if (could && d < bestPc) {
        best = k;
        bestPc = d;
      }
    }
    if (best >= 0 && drawn.current?.k !== best && pending.current !== best) {
      pending.current = best;
      worker.current?.terminate();
      const made = new Worker(new URL('../core/globularClusters.worker.ts', import.meta.url), { type: 'module' });
      worker.current = made;
      const k = best;
      made.onmessage = (event: MessageEvent<ClusterSample>) => {
        const sample = event.data;
        const colors = new Float32Array(sample.count * 3);
        for (let i = 0; i < sample.count; i += 1) {
          const [r, g, b] = starColor(sample.colorIndex[i]!);
          colors.set([r, g, b], i * 3);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(sample.positions, 3));
        geometry.setAttribute('absMag', new THREE.BufferAttribute(sample.absoluteV, 1));
        geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
        const old = drawn.current;
        if (old !== null) {
          starsGroup.remove(old.points, old.twin);
          old.points.geometry.dispose();
        }
        const points = new THREE.Points(geometry, materials.stars);
        const twin = new THREE.Points(geometry, materials.twin);
        for (const each of [points, twin]) {
          each.frustumCulled = false;
          each.renderOrder = -1;
          starsGroup.add(each);
        }
        drawn.current = { k, points, twin, limitV: sample.limitV };
        pending.current = null;
        made.terminate();
        worker.current = null;
        renderDemand.request();
      };
      made.postMessage(clusterSampleRequest(c, k));
    }

    const current = drawn.current;
    starsGroup.visible = current !== null && current.k === best;

    // Each cluster's light as a point: what its stars, where drawn, do not hold.
    const lightFade = galaxyVisibility(scratchSun.length());
    lightGroup.visible = lightFade > 0;
    if (lightGroup.visible) {
      lightGroup.position.copy(frameCamera.position);
      const viewport = renderer.getDrawingBufferSize(pointUniforms['uViewportPx']!.value as THREE.Vector2);
      const pixelsPerRadian = viewport.y / (2 * Math.tan(((frameCamera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
      pointUniforms['uPixelsPerRadian']!.value = pixelsPerRadian;
      // The dust between, again once the camera has moved enough to change it.
      let nearestPc = Infinity;
      for (let k = 0; k < c.count; k += 1) nearestPc = Math.min(nearestPc, points.distancePc[k]!);
      if (points.dustFrom === null || points.dustFrom.distanceTo(cameraPc) > POINT_DUST_REFRESH_SHARE * nearestPc) {
        const cameraGalactic = sceneToGalacticPc(scratchSun);
        for (let k = 0; k < c.count; k += 1) {
          const fromSun = clusterExtinctionV(c, k);
          let value = 0;
          if (fromSun !== null && fromSun > 0) {
            scratchCluster.set(c.x[k]! + c.vx[k]! * motion, c.y[k]! + c.vy[k]! * motion, c.z[k]! + c.vz[k]! * motion);
            const centre = sceneToGalacticPc(scratchCluster.multiplyScalar(PARSEC_KM));
            const share = dustColumn(cameraGalactic, centre) / Math.max(dustColumn([0, 0, 0], centre), 1e-30);
            value = fromSun * Math.min(1, share);
          }
          points.extinction[k] = value;
          points.transmission[k] = 10 ** (-0.4 * value);
        }
        points.dustFrom = (points.dustFrom ?? new THREE.Vector3()).copy(cameraPc);
      }
      const resolved = starsGroup.visible ? current : null;
      for (let k = 0; k < c.count; k += 1) {
        const d = points.distancePc[k]!;
        const halfLight = c.halfLightRadiusPc[k]!;
        let share = lightFade * points.transmission[k]! * smoothstep(POINT_NEAR_FROM, POINT_NEAR_FULL, d / halfLight);
        if (resolved !== null && resolved.k === k && share > 0) {
          // Only the light of its stars too faint to be drawn.
          const fromCamera = catalog.magnitudeLimit - 5 * (Math.log10(d) - 1) - points.extinction[k]!;
          const fromSample = resolved.limitV - 5 * (Math.log10(halfLight) - 1);
          share *= unresolvedShare(points.populations[k]!, Math.min(fromCamera, fromSample));
        }
        points.share.setX(k, share);
      }
      points.share.needsUpdate = true;
    }

    if (current === null || !starsGroup.visible) {
      return;
    }
    // The camera about the cluster's centre, pc, float64; the group at the camera.
    const k = current.k;
    scratchCluster.set(c.x[k]! + c.vx[k]! * motion, c.y[k]! + c.vy[k]! * motion, c.z[k]! + c.vz[k]! * motion);
    scratchCamera.copy(cameraPc).sub(scratchCluster);
    starsGroup.position.copy(frameCamera.position);
    (starUniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(scratchCamera.x), splitHigh(scratchCamera.y), splitHigh(scratchCamera.z));
    (starUniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(scratchCamera.x), splitLow(scratchCamera.y), splitLow(scratchCamera.z));
    starUniforms['uPixelRatio']!.value = pixelRatio;

    // The dust between, again only once the camera has moved enough to change it.
    const last = extinction.current;
    const cameraKm = scratchCamera.clone().multiplyScalar(PARSEC_KM);
    const refresh = EXTINCTION_REFRESH_SHARE * Math.max(cameraKm.length(), PARSEC_KM);
    if (last.k !== k || last.cameraKm === null || last.cameraKm.distanceTo(cameraKm) > refresh) {
      const fromSun = clusterExtinctionV(c, k);
      if (fromSun === null || fromSun === 0) {
        last.value = 0;
      } else {
        const centre = sceneToGalacticPc(scratchCluster.clone().multiplyScalar(PARSEC_KM));
        const cameraGalactic = sceneToGalacticPc(scratchSun);
        const share = dustColumn(cameraGalactic, centre) / Math.max(dustColumn([0, 0, 0], centre), 1e-30);
        last.value = fromSun * Math.min(1, share);
      }
      last.k = k;
      last.cameraKm = cameraKm;
    }
    starUniforms['uExtinction']!.value = last.value;
    current.twin.visible = lensState.on;
  });

  // Pointing and clicking, as the pulsars'.
  useEffect(() => {
    if (markers === null || archive === null) {
      return;
    }
    const element = gl.domElement;
    const tip = document.createElement('div');
    Object.assign(tip.style, TIP_STYLE);
    element.parentElement?.appendChild(tip);
    const screen = new Float64Array(markers.count * 2);
    const scratch = new THREE.Vector3();
    const inverse = new THREE.Quaternion();
    const project = (): void => {
      const { cameraPc, jd } = frame.current;
      const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
      camera.updateMatrixWorld();
      inverse.copy(camera.quaternion).invert();
      const e = camera.projectionMatrix.elements;
      const rect = element.getBoundingClientRect();
      for (let i = 0; i < markers.count; i += 1) {
        const at = (axis: number, originPc: number): number =>
          markers.position[i * 3 + axis]! + markers.velocity[i * 3 + axis]! * motion - originPc;
        scratch.set(at(0, cameraPc.x), at(1, cameraPc.y), at(2, cameraPc.z)).applyQuaternion(inverse);
        const depth = -scratch.z;
        screen[i * 2] = depth > 0 ? ((e[0]! * scratch.x) / depth + 1) * 0.5 * rect.width : Number.NaN;
        screen[i * 2 + 1] = depth > 0 ? (1 - (e[5]! * scratch.y) / depth) * 0.5 * rect.height : Number.NaN;
      }
    };
    const pick = (event: PointerEvent): number | null => {
      // Any mark drawn can be picked: a faint one too.
      if (frame.current.fade < 0.05) {
        return null;
      }
      project();
      const rect = element.getBoundingClientRect();
      return nearestMarker(screen, event.clientX - rect.left, event.clientY - rect.top, PICK_RADIUS_PX);
    };
    let down: { x: number; y: number } | null = null;
    let waiting = false;
    let lastMove: PointerEvent | null = null;
    const setPointing = (on: boolean): void => setMarkerPointer(element, 'globular-clusters', on);
    const onDown = (event: PointerEvent): void => {
      down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event: PointerEvent): void => {
      const start = down;
      down = null;
      if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
        return;
      }
      const k = pick(event);
      if (k !== null) {
        tip.style.display = 'none';
        pickRef.current(k);
      }
    };
    const hover = (): void => {
      waiting = false;
      const event = lastMove;
      if (event === null) {
        return;
      }
      const k = down === null ? pick(event) : null;
      setPointing(k !== null);
      if (k === null) {
        tip.style.display = 'none';
        return;
      }
      const c = archive.catalog;
      tip.textContent = `${clusterDisplayName(c, k)} · ${(c.distancePc[k]! / 1000).toFixed(1)} kpc`;
      tip.style.display = 'block';
      tip.style.transform = `translate(${screen[k * 2]! + 10}px, ${screen[k * 2 + 1]! - 22}px)`;
    };
    const onMove = (event: PointerEvent): void => {
      lastMove = event;
      if (!waiting) {
        waiting = true;
        requestAnimationFrame(hover);
      }
    };
    const onLeave = (): void => {
      tip.style.display = 'none';
      setPointing(false);
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      setPointing(false);
      tip.remove();
    };
  }, [markers, archive, gl, camera]);

  return (
    <>
      <group ref={markersRef} />
      <primitive object={starsGroup} />
      <primitive object={lightGroup} />
    </>
  );
}

const TIP_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  left: '0',
  display: 'none',
  pointerEvents: 'none',
  color: '#f2dcae',
  fontSize: '0.66rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};
