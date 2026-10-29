import type { BodyId, StarCatalog } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { brightestMagnitude } from '../core/starCatalog.ts';
import {
  julianYearsSinceJ2000,
  KM_S_TO_PC_PER_YEAR,
  PARSEC_KM,
  STAR3D,
  STAR3D_FLOATS,
  STARS3D_FROM_KM,
  starState,
  type LoadedStarTier,
  type Stars3dSource,
} from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { angularRadiusPixels, KM_PER_UNIT, meshOpacity, NEIGHBOURHOOD_FROM_KM } from './scale.ts';
import { DISPLAY_FLOOR } from './shading.ts';
import { SUN_COLOR_INDEX } from './solarGlare.ts';
import {
  buildStarAttributes,
  EQUATORIAL_POLE_IN_SCENE,
  yearsSinceEpoch,
} from './starGeometry.ts';
import {
  magnitudeToPeakCoefficients,
  PSF_SIGMA_PX,
  SPHERE_RADIUS,
  STAR_FRAGMENT_SHADER,
  STAR_VERTEX_SHADER,
} from './starRendering.ts';
import { mapDotPeak, splitHigh, splitLow, STAR3D_VERTEX_SHADER, UNITS_PER_PC } from './stars3dShader.ts';
import { galaxyVisibility } from './MilkyWay.tsx';
import { componentState, isProximaRecord, matchComponent, type AlphaCenComponent } from '../core/alphaCentauri.ts';
import { isCatalogueStar, parseStarBodyId, starBodyId } from '../core/starBodies.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';

/**
 * A star Starfield draws apart from its tier, with a fade of its own: Alpha Centauri's
 * three, and any other star with a measured radius (planetarySystems.ts) -- each has a
 * disc, and its point gives way to it as the Sun's does. Keyed by tier and index.
 */
interface DiscStar {
  readonly points: THREE.Points;
  readonly tier: number;
  readonly index: number;
  readonly records: Float32Array;
  /** A or B, placed on their orbit; null for a star on its record's straight line. */
  readonly component: AlphaCenComponent | null;
}

/**
 * The sky: every star in the catalogues, at its real distance where it has one and at
 * infinity where it does not.
 *
 * **Every star here is a real one**, at its own position, moving at its own measured
 * motion, at its own magnitude and in the colour its measured B-V implies. Nothing in this
 * component invents a star.
 *
 * ## Two sets, one sky
 *
 * The **sky at infinity** is the Hipparcos and Tycho-2 catalogue (stars.json): directions,
 * V, B-V and proper motions, on a sphere that follows the camera. It was the whole sky
 * until step D2, and it is still what is drawn for any star whose parallax is too poor to
 * place it -- for those the direction is all that is known, and infinity is the honest
 * place for them.
 *
 * The **3D stars** (stars3d/, step D2) are every star with a usable distance: the sky's own
 * stars that have one, and the Gaia Catalogue of Nearby Stars inside 100 pc. They are
 * drawn where they are, by stars3dShader.ts, and their brightness is worked out from the
 * camera. A sky star that is in 3D is taken off the sphere (its `placed` flag) the moment
 * its tier arrives, so it is never drawn twice -- and since it keeps the sky's direction,
 * V and B-V, from inside the Solar System the hand-over is invisible. Measured in
 * stars3dSky.test.ts.
 *
 * ## The Sun, from far away
 *
 * The Sun is a body, drawn as a sphere with its glare (SolarSystem.tsx). Once that sphere
 * drops below a pixel it is drawn here instead, as the star it then is: a point at the
 * Sun's own place, V = -26.76 from 1 AU, absolute magnitude 4.81 (Willmer 2018), B-V
 * 0.65, by the same arithmetic as every other star -- 0.44 from Alpha Centauri, 4.81 + 5
 * log10(1.338 pc / 10 pc). The hand-over is the body's own fade, run backwards: the point
 * comes in exactly as the sphere goes out (meshOpacity), so nothing is drawn twice and
 * nothing goes missing.
 */

/** The Sun's absolute visual magnitude, M_V = 4.81, and its apparent one from 1 AU, -26.76. Willmer 2018, ApJS 236, 47. */
export const SUN_ABSOLUTE_V = 4.81;

/**
 * Where the map's dots come in, by the camera's distance from its focus: none inside the
 * Solar Neighbourhood's threshold (NEIGHBOURHOOD_FROM_KM, 10,000 AU), all by ten times it.
 * So anywhere a body is being looked at, the sky is the photometric one and nothing else.
 */
export const MAP_FULL_FROM_KM = 10 * NEIGHBOURHOOD_FROM_KM;

/** How strong the map is at a camera distance from its focus, 0 to 1. */
export function mapStrength(cameraFromFocusKm: number): number {
  const t =
    (Math.log(cameraFromFocusKm) - Math.log(NEIGHBOURHOOD_FROM_KM)) /
    (Math.log(MAP_FULL_FROM_KM) - Math.log(NEIGHBOURHOOD_FROM_KM));
  return Math.min(1, Math.max(0, t));
}

export interface StarfieldProps {
  readonly catalog: StarCatalog;
  readonly clock: SimClock;
  readonly store: EphemerisStore;
  readonly focus: BodyId;
  /** The 3D stars; null in a test or a build without them. */
  readonly stars3d: Stars3dSource | null;
  /** The Star Map layer: every star a dot once past the Solar System. */
  readonly showMap: boolean;
  /** Whether the Sun's body is drawn: when it is not, its star is, at any distance. */
  readonly sunShown: boolean;
}

/** The 3D material's uniforms, shared by every tier and the Sun's point. */
function star3dUniforms(coefficients: readonly [number, number], limit: number): Record<string, THREE.IUniform> {
  return {
    uCameraHigh: { value: new THREE.Vector3() },
    uCameraLow: { value: new THREE.Vector3() },
    uMotion: { value: 0 },
    uUnitsPerPc: { value: UNITS_PER_PC },
    uMagnitudeToPeak: { value: new THREE.Vector2(coefficients[0], coefficients[1]) },
    uMagnitudeLimit: { value: limit },
    uMapDotPeak: { value: 0 },
    uFade: { value: 1 },
    uSigmaPx: { value: PSF_SIGMA_PX },
    uDisplayFloor: { value: DISPLAY_FLOOR },
    uPixelRatio: { value: 1 },
  };
}

function star3dMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: STAR3D_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER,
    // As the sky's: light adds, depth is read so a planet can pass in front, never written.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
  });
}

/**
 * One tier as GPU buffers: the file's own floats, interleaved, read in place -- position,
 * velocity and absolute magnitude straight off the record -- and a colour per star from its
 * B-V, through the same Planck-and-CIE path the sky uses (and its cache: the 3D stars
 * repeat the sky's values, so most are already worked out).
 */
export function buildTierGeometry(
  records: Float32Array,
  hidden: readonly number[] = [],
): THREE.BufferGeometry {
  const count = records.length / STAR3D_FLOATS;
  const interleaved = new THREE.InterleavedBuffer(records, STAR3D_FLOATS);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    // A star drawn elsewhere (Alpha Centauri A and B, on their orbit) adds no light here.
    if (hidden.includes(i)) {
      continue;
    }
    const [red, green, blue] = starColor(records[i * STAR3D_FLOATS + STAR3D.bv]!);
    colors[i * 3] = red;
    colors[i * 3 + 1] = green;
    colors[i * 3 + 2] = blue;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, STAR3D.x));
  geometry.setAttribute('velocity', new THREE.InterleavedBufferAttribute(interleaved, 3, STAR3D.vx));
  geometry.setAttribute('absMag', new THREE.InterleavedBufferAttribute(interleaved, 1, STAR3D.Mv));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * One star at the origin of its own Points, not moving: Alpha Centauri A or B, whose
 * place comes through the camera uniforms instead (see pairPoints in Starfield).
 */
function pairGeometry(absoluteMagnitude: number, colorIndex: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(new Float32Array(3), 3));
  geometry.setAttribute('absMag', new THREE.BufferAttribute(new Float32Array([absoluteMagnitude]), 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(new Float32Array(starColor(colorIndex)), 3));
  return geometry;
}

/** The Sun as one star: at the origin of the 3D stars' coordinates, which is the Sun. */
function sunGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(new Float32Array(3), 3));
  geometry.setAttribute('absMag', new THREE.BufferAttribute(new Float32Array([SUN_ABSOLUTE_V]), 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(new Float32Array(starColor(SUN_COLOR_INDEX)), 3));
  return geometry;
}

const scratchCamera = new THREE.Vector3();
const EMPTY_VIEW = { state: 'absent', info: null, tiers: [] as readonly LoadedStarTier[] } as const;
const noSubscribe = (): (() => void) => () => {};

export function Starfield({ catalog, clock, store, focus, stars3d, showMap, sunShown }: StarfieldProps) {
  const skyRef = useRef<THREE.Points>(null);
  const tiersRef = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Points>(null);
  const requested = useRef(false);

  const view = useSyncExternalStore(
    stars3d?.subscribe ?? noSubscribe,
    () => stars3d?.view ?? EMPTY_VIEW,
  );

  // The sky at infinity, with a `placed` flag per row for the stars drawn in 3D.
  const sky = useMemo(() => {
    const attributes = buildStarAttributes(catalog);
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(attributes.positions, 3));
    buffer.setAttribute('properMotion', new THREE.BufferAttribute(attributes.properMotions, 2));
    buffer.setAttribute('magnitude', new THREE.BufferAttribute(attributes.magnitudes, 1));
    buffer.setAttribute('starColor', new THREE.BufferAttribute(attributes.colors, 3));
    const placed = new THREE.BufferAttribute(new Float32Array(attributes.count), 1);
    buffer.setAttribute('placed', placed);
    return { buffer, placed };
  }, [catalog]);

  const coefficients = useMemo(
    () => magnitudeToPeakCoefficients(brightestMagnitude(catalog), catalog.magnitudeLimit),
    [catalog],
  );

  const skyMaterial = useMemo(() => {
    const pole = EQUATORIAL_POLE_IN_SCENE;
    return new THREE.ShaderMaterial({
      uniforms: {
        uSphereRadius: { value: SPHERE_RADIUS },
        uYearsSinceEpoch: { value: 0 },
        uEquatorialPole: { value: new THREE.Vector3(pole.x, pole.y, pole.z) },
        uMagnitudeToPeak: { value: new THREE.Vector2(coefficients[0], coefficients[1]) },
        uSigmaPx: { value: PSF_SIGMA_PX },
        uDisplayFloor: { value: DISPLAY_FLOOR },
        uPixelRatio: { value: 1 },
        uFade: { value: 1 },
      },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      // Stars add: two overlapping profiles are two sources of light, not one
      // occluding the other. Depth is read so a planet can pass in front, and never
      // written, since a point sprite has no depth worth handing to anything else.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      // The exposure has already been chosen and stated. See STAR_FRAGMENT_SHADER.
      toneMapped: false,
    });
  }, [coefficients]);

  // One set of uniforms for every tier; the Sun's point has its own, for its fade.
  const tierUniforms = useMemo(
    () => star3dUniforms(coefficients, catalog.magnitudeLimit),
    [coefficients, catalog.magnitudeLimit],
  );
  const tierMaterial = useMemo(() => star3dMaterial(tierUniforms), [tierUniforms]);
  const sunUniforms = useMemo(
    () => star3dUniforms(coefficients, catalog.magnitudeLimit),
    [coefficients, catalog.magnitudeLimit],
  );
  const sunMaterial = useMemo(() => star3dMaterial(sunUniforms), [sunUniforms]);
  const sunPoint = useMemo(() => sunGeometry(), []);

  // A Points per tier, made once each as it lands, and every sky row it places taken off
  // the sphere in the same step.
  const tierPoints = useMemo(() => new Map<number, THREE.Points>(), [tierMaterial]);

  // Alpha Centauri's three, each its own Points (alphaCentauri.ts): A and B on their orbit
  // rather than their records' straight lines, and all three placed by the camera's
  // offset from the star in float64 -- to the kilometre, not to a float32 position 0.025
  // AU off -- and with a fade of their own, since each now has a disc (D3b) and its point
  // gives way to it as the Sun's does. The tier material's uniforms otherwise.
  const pairPoints = useMemo(() => new Map<string, DiscStar>(), [tierMaterial]);
  // Which tier entries each built tier leaves out, to know when one must be rebuilt.
  const hiddenByTier = useMemo(() => new Map<number, string>(), [tierMaterial]);
  // The other stars with a measured radius, as "tier:index": made bodies at start
  // (planetarySystems.ts), perhaps after their tier has landed -- then it is rebuilt.
  const version = useStoreVersion(store);
  const discStars = useMemo(() => {
    void version;
    const keys = new Set<string>();
    for (const body of store.bodies) {
      const at = isCatalogueStar(body) && body.radiusPublished !== false ? parseStarBodyId(body.id) : null;
      if (at !== null) {
        keys.add(`${at.tier}:${at.index}`);
      }
    }
    return keys;
  }, [store, version]);
  const starCount = useRef(0);
  useEffect(() => {
    const group = tiersRef.current;
    if (group === null) {
      return;
    }
    let changed = false;
    for (const tier of view.tiers) {
      // The stars in this tier drawn on their own: Alpha Centauri's three, by their
      // positions, and the others with a disc.
      const hidden: number[] = [];
      const apart: { i: number; key: string; component: AlphaCenComponent | null }[] = [];
      for (let i = 0; i < tier.tier.count; i += 1) {
        const base = i * STAR3D_FLOATS;
        const at = {
          x: tier.records[base + STAR3D.x]!,
          y: tier.records[base + STAR3D.y]!,
          z: tier.records[base + STAR3D.z]!,
        };
        const component = matchComponent(at);
        const key =
          component ?? (isProximaRecord(at) ? 'Proxima' : discStars.has(`${tier.index}:${i}`) ? `${tier.index}:${i}` : null);
        if (key !== null) {
          hidden.push(i);
          apart.push({ i, key, component });
        }
      }
      const hiddenKey = hidden.join(',');
      const built = tierPoints.get(tier.index);
      if (built !== undefined && hiddenByTier.get(tier.index) === hiddenKey) {
        continue;
      }
      for (const { i, key, component } of apart) {
        if (pairPoints.has(key)) {
          continue;
        }
        const base = i * STAR3D_FLOATS;
        const own = {
          ...tierUniforms,
          uCameraHigh: { value: new THREE.Vector3() },
          uCameraLow: { value: new THREE.Vector3() },
          uFade: { value: 1 },
        };
        const single = new THREE.Points(
          pairGeometry(tier.records[base + STAR3D.Mv]!, tier.records[base + STAR3D.bv]!),
          star3dMaterial(own),
        );
        single.frustumCulled = false;
        single.renderOrder = -1;
        pairPoints.set(key, { points: single, tier: tier.index, index: i, records: tier.records, component });
        group.add(single);
      }
      hiddenByTier.set(tier.index, hiddenKey);
      if (built !== undefined) {
        // A star of it gained a disc after it landed: the same tier, less that star.
        built.geometry.dispose();
        built.geometry = buildTierGeometry(tier.records, hidden);
        continue;
      }
      const points = new THREE.Points(buildTierGeometry(tier.records, hidden), tierMaterial);
      points.frustumCulled = false;
      points.renderOrder = -1;
      tierPoints.set(tier.index, points);
      group.add(points);
      starCount.current += tier.tier.count;
      const placed = sky.placed.array as Float32Array;
      for (let i = 0; i < tier.tier.count; i += 1) {
        const row = tier.records[i * STAR3D_FLOATS + STAR3D.sky]!;
        if (row >= 0 && row < placed.length) {
          placed[row] = 1;
          changed = true;
        }
      }
    }
    if (changed) {
      sky.placed.needsUpdate = true;
    }
  }, [view, tierPoints, pairPoints, hiddenByTier, discStars, tierMaterial, tierUniforms, sky]);

  // Everything made here goes with the component.
  useEffect(
    () => () => {
      for (const points of tierPoints.values()) {
        points.geometry.dispose();
      }
      tierPoints.clear();
      for (const { points } of pairPoints.values()) {
        points.geometry.dispose();
        (points.material as THREE.Material).dispose();
      }
      pairPoints.clear();
      hiddenByTier.clear();
      starCount.current = 0;
      tierMaterial.dispose();
    },
    [tierPoints, pairPoints, hiddenByTier, tierMaterial],
  );
  useEffect(() => () => skyMaterial.dispose(), [skyMaterial]);
  useEffect(() => () => sky.buffer.dispose(), [sky]);
  useEffect(() => () => sunMaterial.dispose(), [sunMaterial]);

  useFrame(({ camera, gl, size }) => {
    const skyPoints = skyRef.current;
    const group = tiersRef.current;
    const sunPoints = sunRef.current;
    if (skyPoints === null || group === null || sunPoints === null) {
      return;
    }
    const jd = clock.tdbJulianDay;
    const pixelRatio = gl.getPixelRatio();

    // The sky at infinity follows the camera, so its stars never leave the frustum and
    // never parallax.
    skyPoints.position.copy(camera.position);
    skyMaterial.uniforms['uYearsSinceEpoch']!.value = yearsSinceEpoch(jd);
    // Read every frame rather than at build time: dragging the window to a display of
    // a different density changes this, and a star is sized in CSS pixels.
    skyMaterial.uniforms['uPixelRatio']!.value = pixelRatio;

    // The camera about the Sun, km, float64: the Sun is wherever the focus is not.
    const sun = store.stateRelativeTo('sun', focus, jd);
    if (sun === null) {
      group.visible = false;
      sunPoints.visible = false;
      return;
    }
    scratchCamera.set(
      camera.position.x * KM_PER_UNIT - sun.position.x,
      camera.position.y * KM_PER_UNIT - sun.position.y,
      camera.position.z * KM_PER_UNIT - sun.position.z,
    );
    const cameraFromSunKm = scratchCamera.length();

    // The sky at infinity holds the stars with no distance, and before the 3D stars land,
    // every star. Drawn as if infinitely far they are right anywhere near the Sun and
    // wrong from across the galaxy, so they go as the galaxy comes (MilkyWay.tsx).
    const skyFade = 1 - galaxyVisibility(cameraFromSunKm);
    skyMaterial.uniforms['uFade']!.value = skyFade;
    skyPoints.visible = skyFade > 0;

    // The 3D stars are asked for once they could make a difference: see STARS3D_FROM_KM.
    // A star in focus asks for itself, through search.
    if (!requested.current && stars3d !== null && cameraFromSunKm > STARS3D_FROM_KM) {
      requested.current = true;
      void stars3d.request();
    }

    // The 3D stars' frame: a rotation only, with the camera's translation cancelled in
    // float64 by putting the objects where the camera is.
    group.position.copy(camera.position);
    sunPoints.position.copy(camera.position);
    const cameraPc = scratchCamera.multiplyScalar(1 / PARSEC_KM);
    const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
    const pixelsPerRadian =
      size.height / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
    const cameraFromFocusKm = camera.position.length() * KM_PER_UNIT;
    const dotPeak = showMap
      ? mapStrength(cameraFromFocusKm) * mapDotPeak(starCount.current, cameraPc.length(), pixelsPerRadian)
      : 0;

    for (const uniforms of [tierUniforms, sunUniforms]) {
      (uniforms['uCameraHigh']!.value as THREE.Vector3).set(
        splitHigh(cameraPc.x),
        splitHigh(cameraPc.y),
        splitHigh(cameraPc.z),
      );
      (uniforms['uCameraLow']!.value as THREE.Vector3).set(
        splitLow(cameraPc.x),
        splitLow(cameraPc.y),
        splitLow(cameraPc.z),
      );
      uniforms['uMotion']!.value = motion;
      uniforms['uPixelRatio']!.value = pixelRatio;
    }
    // The stars drawn on their own: the camera as seen from each, high and low, from
    // float64, and each point fading as its disc comes in -- see pairPoints.
    for (const entry of pairPoints.values()) {
      const star =
        entry.component === null
          ? starState(entry.records, entry.index, jd).position
          : componentState(entry.component, jd).position;
      const uniforms = (entry.points.material as THREE.ShaderMaterial).uniforms;
      const x = (camera.position.x * KM_PER_UNIT - sun.position.x - star.x) / PARSEC_KM;
      const y = (camera.position.y * KM_PER_UNIT - sun.position.y - star.y) / PARSEC_KM;
      const z = (camera.position.z * KM_PER_UNIT - sun.position.z - star.z) / PARSEC_KM;
      (uniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(x), splitHigh(y), splitHigh(z));
      (uniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(x), splitLow(y), splitLow(z));
      // A disc only once the star is a body (search, or the breadcrumb): until then the
      // point is all there is of it.
      const body = starBodyId(entry.tier, entry.index);
      const radiusKm = store.isPropagatedBody(body) ? store.body(body).radiusEquatorialKm : null;
      const pixelRadius =
        radiusKm === null
          ? 0
          : angularRadiusPixels(radiusKm, Math.hypot(x, y, z) * PARSEC_KM, size.height, (camera as THREE.PerspectiveCamera).fov);
      const fade = 1 - meshOpacity(pixelRadius);
      uniforms['uFade']!.value = fade;
      entry.points.visible = fade > 0;
    }

    // The Sun is a star of the map like any other: past 30 pc it is fainter than V 8.
    tierUniforms['uMapDotPeak']!.value = dotPeak;
    sunUniforms['uMapDotPeak']!.value = dotPeak;
    group.visible = tierPoints.size > 0;

    // The Sun's point, as its sphere goes: see the header.
    const sunPixelRadius = angularRadiusPixels(
      store.body('sun').radiusEquatorialKm,
      cameraFromSunKm,
      size.height,
      (camera as THREE.PerspectiveCamera).fov,
    );
    const fade = sunShown ? 1 - meshOpacity(sunPixelRadius) : 1;
    sunUniforms['uFade']!.value = fade;
    sunPoints.visible = fade > 0;
  });

  return (
    <>
      <points
        ref={skyRef}
        geometry={sky.buffer}
        material={skyMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
      <group ref={tiersRef} />
      <points
        ref={sunRef}
        geometry={sunPoint}
        material={sunMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
    </>
  );
}
