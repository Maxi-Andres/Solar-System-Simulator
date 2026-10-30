import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BLACK_HOLE_SYSTEMS } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  buildLensTables,
  deflectionReach,
  farEinsteinAngle,
  GPU_SAMPLES,
  TABLE_X_MIN,
  type LensTables,
} from '../core/schwarzschildLens.ts';
import type { SimClock } from '../core/time.ts';
import { lensImageTexture, lensState, LENS_UNIFORMS, skyCapture } from './lens.ts';
import { CAMERA_FAR_UNITS, CAMERA_NEAR_UNITS } from './logDepth.ts';
import { COMPOSITE_FRAGMENT_SHADER, COMPOSITE_VERTEX_SHADER } from './MilkyWay.tsx';
import { KM_PER_UNIT } from './scale.ts';
import { starDiscExposure, starDiscColorIndex } from '../core/starBodies.ts';
import { SUN_OVEREXPOSURE } from './solarGlare.ts';
import { LIMB_DARKENING_U, starDiscColor } from './starDisc.ts';

/**
 * The black holes' gravitational lensing, drawn (schwarzschildLens.ts for the physics).
 *
 * Near a black hole everything behind it is seen bent round it: the sky shows twice, once
 * outside the Einstein ring and once, turned over and squeezed, between the ring and the
 * shadow, and again and again ever thinner against the shadow's edge. Here that is drawn
 * from the exact Schwarzschild deflection, for a camera at its real distance from the hole
 * -- a few horizons or some parsecs -- and the black in the middle is the **shadow**,
 * sqrt(27)/2 = 2.6 horizons across from afar, not the horizon itself.
 *
 * ## What is bent, and how
 *
 * - **The stars** are moved: each is drawn at its two images, brighter or fainter by their
 *   magnification, in the star shaders themselves (lens.ts). They stay sharp.
 * - **The galaxy's glow** is resampled. Per pixel, the ray's deflection comes from the
 *   table and the glow is read in the direction the ray ends up in: from this frame's own
 *   glow buffer where that direction is on screen and the images are not crowded, and
 *   otherwise from a cube map of the glow drawn about the camera -- the same points and
 *   dust, through six 90-degree faces, mipmapped so the crowded images near the shadow
 *   average rather than sparkle. Every image of the glow comes out of that: the Einstein
 *   ring, the rings inside it, and the black where the ray falls in. Where the lens moves
 *   the sky by less than half a pixel it fades out, and by a tenth, the glow is left as
 *   it is drawn.
 * - **The stars round Sgr A*** -- the nuclear star cluster's, model and measured
 *   (NuclearCluster.tsx) -- are moved the same way, by the lens equation for a source at a
 *   finite distance: a star a parsec behind the hole is bent less than the far sky, one
 *   in front of it not at all (schwarzschildLens.ts, finiteSourceImage).
 * - **The star about the hole** -- S2, the stars of Gaia BH1, BH3 and Cygnus X-1 -- is drawn
 *   through it, as a sphere: per pixel the ray is bent by the same exact deflection where it
 *   passes the hole, then followed in a straight line to the star, whose limb-darkened disc
 *   it lands on or misses (STAR_FRAGMENT_SHADER). A ray that meets the star before it reaches
 *   the hole is not bent. So a star behind the hole is seen wrapped round its shadow, the
 *   two images and the Einstein ring a star's light makes, and one in front of the hole
 *   hides it. Treating the bend as happening at the ray's closest approach puts the ray a
 *   few horizons off where it is in truth -- tens to thousands of kilometres against stars
 *   of hundreds of thousands to millions. The star's own mesh is not drawn meanwhile.
 * - **Nothing else.** The lines drawn over a hole are drawn where they are, unbent; so is
 *   any other body seen past it.
 *
 * ## What it costs
 *
 * The tables are rebuilt when the camera's distance from the hole changes, 3 to 7
 * milliseconds of arithmetic. The cube is drawn only when what it holds would change: the
 * first time (about 20 ms), then when the camera has moved a ten-thousandth of its
 * distance from the Sun (where the glow's parallax could start to show), the glow
 * brightened or dimmed, or a century of simulated time went by -- orbiting the hole,
 * turning the camera, zooming in and out redraw nothing. Each frame adds one full-screen
 * pass and a second pass over the stars. And the lens is only on at all while its Einstein
 * ring is half a pixel or more in radius: by the window's height, within 10 to 17 parsecs
 * of Sgr A* and 5 to 8 AU of Gaia BH1.
 *
 * ## No disc
 *
 * There is no accretion disc to draw. Sgr A* is quiescent and, from here, behind some 30
 * magnitudes of dust in visible light (Genzel, Eisenhauer & Gillessen 2010, Rev. Mod.
 * Phys. 82, 3121); what the EHT imaged is radio light, at 1.3 mm. Gaia BH1 and BH3 were
 * found because they are dark: their stars' orbits are all that shows of them. So what is
 * drawn round each hole is the sky behind it, and nothing of its own.
 */

/** The lens turns on when its Einstein ring's radius is this many CSS pixels. */
export const LENS_ACTIVE_PX = 0.5;

/** Below this deflection, pixels, the sky is left as it is; the cube's glow fades in to it. */
const FADE_FROM_PX = 0.1;
const FADE_FULL_PX = 0.5;

/** The cube map's face, pixels: 11 pixels a degree, about half the glow buffer's own. */
const CUBE_SIZE = 1024;

/** The tables are rebuilt when the camera's distance from the hole changes by this share. */
const REBUILD_SHARE = 2e-4;

/** The cube is drawn again when the camera has moved this share of its distance from the Sun. */
const RECAPTURE_SHARE = 1e-4;

/** Or when the glow's visibility has changed by this much, or this many days have passed. */
const RECAPTURE_VISIBILITY = 0.02;
const RECAPTURE_DAYS = 36_525;

const OVERLAY_VERTEX_SHADER = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Per pixel: the angle theta from the hole, the deflection there from the table, and the
 * sky the ray ends up on -- turned by the deflection toward the hole, in the plane of the
 * hole and the pixel. Black where it falls in. The cube is sampled before any branch, so
 * its derivatives -- which pick the mip level where the images crowd -- are defined.
 */
const OVERLAY_FRAGMENT_SHADER = /* glsl */ `
uniform samplerCube uSky;
uniform sampler2D uScreenGlow;
uniform sampler2D uDeflection;
// theta_sh, the table's first and last x, its samples.
uniform vec4 uMap;
uniform vec3 uHole;
uniform mat3 uViewToWorld;
uniform vec2 uTanHalf;
uniform float uReach;
uniform float uPixelAngle;
uniform float uGlow;

varying vec2 vNdc;

void main() {
  vec3 d = normalize(uViewToWorld * vec3(vNdc * uTanHalf, -1.0));
  float c = dot(d, uHole);
  vec3 side = d - c * uHole;
  float s = length(side);
  vec3 e2 = side / max(s, 1e-30);
  float theta = atan(s, c);
  float x = log(max(theta / uMap.x - 1.0, 1e-30));
  float t = clamp((x - uMap.y) / (uMap.z - uMap.y), 0.0, 1.0) * (uMap.w - 1.0);
  float k = min(floor(t), uMap.w - 2.0);
  float delta = mix(
    texelFetch(uDeflection, ivec2(int(k), 0), 0).r,
    texelFetch(uDeflection, ivec2(int(k) + 1, 0), 0).r,
    t - k
  );
  float seen = theta - delta;
  vec3 source = cos(seen) * uHole + sin(seen) * e2;
  vec3 cubeSky = textureCube(uSky, source).rgb;
  // The same direction in this frame's own glow buffer, where it is on screen: sharper
  // than the cube, whose faces have half its pixels to the degree.
  vec3 view = transpose(uViewToWorld) * source;
  vec2 ndc = view.xy / max(-view.z, 1e-6) / uTanHalf;
  vec3 screenSky = vec3(1.0) - exp(-texture2D(uScreenGlow, ndc * 0.5 + 0.5).rgb);
  // How much sky one pixel spans, in pixels: where the images crowd, more than one, and the
  // buffer, which has no mipmaps, would sparkle -- the cube's mipmaps average it instead.
  float spread = length(fwidth(source)) / uPixelAngle;
  float inFrame = view.z < 0.0 ? 1.0 - smoothstep(0.9, 1.0, max(abs(ndc.x), abs(ndc.y))) : 0.0;
  vec3 sky = mix(cubeSky, screenSky, inFrame * (1.0 - smoothstep(1.5, 3.0, spread)));
  if (theta <= uMap.x || x < uMap.y) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  if (uGlow < 0.5 || theta > uReach) {
    discard;
  }
  float alpha = smoothstep(${FADE_FROM_PX.toFixed(2)}, ${FADE_FULL_PX.toFixed(2)}, delta / uPixelAngle);
  gl_FragColor = vec4(sky, alpha);
}
`;

/**
 * The star about the hole, seen through it (see the header): drawn after the stars (-1), so
 * it hides those behind it, and before the bodies. Lengths in the star's own radii, about
 * the camera, so a sphere millions of kilometres off keeps its digits in float32.
 */
const STAR_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uDeflection;
uniform vec4 uMap;
uniform vec3 uHole;
uniform mat3 uViewToWorld;
uniform vec2 uTanHalf;
uniform vec3 uStarCentre;
uniform float uHoleDistance;
uniform vec3 uStarColor;

varying vec2 vNdc;

// Where a ray from o along dir first meets the star, or -1.
float hitStar(vec3 o, vec3 dir) {
  vec3 oc = o - uStarCentre;
  float b = dot(oc, dir);
  float h = b * b - (dot(oc, oc) - 1.0);
  if (h < 0.0) {
    return -1.0;
  }
  float root = sqrt(h);
  float t = -b - root;
  return t > 0.0 ? t : -b + root;
}

// Its disc there, limb-darkened as the stars' discs are (starDisc.ts).
vec4 starAt(vec3 p, vec3 dir) {
  float mu = clamp(-dot(normalize(p - uStarCentre), dir), 0.0, 1.0);
  return linearToOutputTexel(vec4(uStarColor * (1.0 - ${LIMB_DARKENING_U.toFixed(2)} * (1.0 - mu)), 1.0));
}

void main() {
  vec3 d = normalize(uViewToWorld * vec3(vNdc * uTanHalf, -1.0));
  float c = dot(d, uHole);
  // How far along the ray it passes the hole: a star met before that is in front of it.
  float closest = uHoleDistance * c;
  float front = hitStar(vec3(0.0), d);
  if (front > 0.0 && front < closest) {
    gl_FragColor = starAt(d * front, d);
    return;
  }
  vec3 side = d - c * uHole;
  float s = length(side);
  vec3 e2 = side / max(s, 1e-30);
  float theta = atan(s, c);
  float x = log(max(theta / uMap.x - 1.0, 1e-30));
  if (theta <= uMap.x || x < uMap.y) {
    discard;
  }
  float t = clamp((x - uMap.y) / (uMap.z - uMap.y), 0.0, 1.0) * (uMap.w - 1.0);
  float k = min(floor(t), uMap.w - 2.0);
  float delta = mix(
    texelFetch(uDeflection, ivec2(int(k), 0), 0).r,
    texelFetch(uDeflection, ivec2(int(k) + 1, 0), 0).r,
    t - k
  );
  float seen = theta - delta;
  vec3 bent = cos(seen) * uHole + sin(seen) * e2;
  // Bent where it passes the hole, then straight on.
  vec3 at = d * max(closest, 0.0);
  float far = hitStar(at, bent);
  if (far <= 0.0) {
    discard;
  }
  gl_FragColor = starAt(at + bent * far, bent);
}
`;

/** Below this radius on screen, pixels, the star is left to its own mesh and marker. */
const STAR_LENSED_FROM_PX = 2;

const scratchHole = new THREE.Vector3();
const scratchStar = new THREE.Vector3();
const scratchSunCamera = new THREE.Vector3();

interface Capture {
  readonly hole: BodyId;
  readonly revision: number;
  readonly visibility: number;
  readonly jd: number;
  readonly cameraFromSunKm: THREE.Vector3;
}

export function BlackHoleLens({ store, clock, focus }: { store: EphemerisStore; clock: SimClock; focus: BodyId }) {
  const { camera, gl, size } = useThree();

  const deflectionTexture = useMemo(() => {
    const texture = new THREE.DataTexture(new Float32Array(GPU_SAMPLES), GPU_SAMPLES, 1, THREE.RedFormat, THREE.FloatType);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }, []);

  // The glow about the camera: a cube, its faces drawn through a half-float buffer of the
  // glow's own and laid in with the glow's own shoulder (MilkyWay.tsx).
  const capture = useMemo(() => {
    const cube = new THREE.WebGLCubeRenderTarget(CUBE_SIZE, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const cubeCamera = new THREE.CubeCamera(CAMERA_NEAR_UNITS, CAMERA_FAR_UNITS, cube);
    const glow = new THREE.WebGLRenderTarget(CUBE_SIZE, CUBE_SIZE, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uGlow: { value: glow.texture } },
        vertexShader: COMPOSITE_VERTEX_SHADER,
        fragmentShader: COMPOSITE_FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    return { cube, cubeCamera, glow, quad, scene, camera: new THREE.OrthographicCamera() };
  }, []);

  const overlay = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          uSky: { value: capture.cube.texture },
          uScreenGlow: { value: null as THREE.Texture | null },
          uDeflection: { value: deflectionTexture },
          uMap: { value: new THREE.Vector4(1, TABLE_X_MIN, 1, GPU_SAMPLES) },
          uHole: { value: new THREE.Vector3(0, 0, -1) },
          uViewToWorld: { value: new THREE.Matrix3() },
          uTanHalf: { value: new THREE.Vector2(1, 1) },
          uReach: { value: 0 },
          uPixelAngle: { value: 1e-3 },
          uGlow: { value: 0 },
        },
        vertexShader: OVERLAY_VERTEX_SHADER,
        fragmentShader: OVERLAY_FRAGMENT_SHADER,
        // In place of the glow beneath it, by its alpha: drawn with the opaque things, after
        // the glow (-2) and before every body, and before the stars, which are moved in
        // their own shaders and add over it.
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        transparent: false,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -1.5;
    mesh.visible = false;
    return mesh;
  }, [capture, deflectionTexture]);

  const starOverlay = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          uDeflection: { value: deflectionTexture },
          uMap: { value: new THREE.Vector4(1, TABLE_X_MIN, 1, GPU_SAMPLES) },
          uHole: { value: new THREE.Vector3(0, 0, -1) },
          uViewToWorld: { value: new THREE.Matrix3() },
          uTanHalf: { value: new THREE.Vector2(1, 1) },
          uStarCentre: { value: new THREE.Vector3() },
          uHoleDistance: { value: 1 },
          uStarColor: { value: new THREE.Color() },
        },
        vertexShader: OVERLAY_VERTEX_SHADER,
        fragmentShader: STAR_FRAGMENT_SHADER,
        transparent: false,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -0.5;
    mesh.visible = false;
    return mesh;
  }, [deflectionTexture]);

  useEffect(
    () => () => {
      starOverlay.geometry.dispose();
      (starOverlay.material as THREE.Material).dispose();
      lensState.drawnByLens.clear();
    },
    [starOverlay],
  );

  useEffect(
    () => () => {
      deflectionTexture.dispose();
      capture.cube.dispose();
      capture.glow.dispose();
      capture.quad.geometry.dispose();
      (capture.quad.material as THREE.Material).dispose();
      overlay.geometry.dispose();
      (overlay.material as THREE.Material).dispose();
      LENS_UNIFORMS.uLensOn.value = 0;
      lensState.on = false;
    },
    [deflectionTexture, capture, overlay],
  );

  const tables = useRef<LensTables | null>(null);
  const captured = useRef<Capture | null>(null);
  const hole = useRef<BodyId | null>(null);

  // Before the stars and the glow, after the camera rig (-1): which hole, if any, and its
  // tables and uniforms for this frame.
  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const pixelsPerRadian = size.height / (2 * Math.tan((fov * Math.PI) / 360));
    let best: { id: BodyId; r: number; px: number; km: number } | null = null;
    for (const system of BLACK_HOLE_SYSTEMS) {
      if (!store.isPropagatedBody(system.id)) {
        continue;
      }
      const state = store.stateRelativeTo(system.id, focus, jd);
      if (state === null) {
        continue;
      }
      const distanceKm = scratchHole
        .set(
          state.position.x - camera.position.x * KM_PER_UNIT,
          state.position.y - camera.position.y * KM_PER_UNIT,
          state.position.z - camera.position.z * KM_PER_UNIT,
        )
        .length();
      const r = distanceKm / store.body(system.id).radiusEquatorialKm;
      const px = (r > 10 ? farEinsteinAngle(r) : 1) * pixelsPerRadian;
      if (px >= LENS_ACTIVE_PX && (best === null || px > best.px)) {
        best = { id: system.id, r, px, km: distanceKm };
        LENS_UNIFORMS.uLensHole.value.copy(scratchHole).normalize();
      }
    }
    lensState.drawnByLens.clear();
    starOverlay.visible = false;
    if (best === null) {
      LENS_UNIFORMS.uLensOn.value = 0;
      lensState.on = false;
      overlay.visible = false;
      hole.current = null;
      return;
    }
    // When the hole moves, the place from which the glow was captured goes with it.
    if (hole.current !== best.id) {
      hole.current = best.id;
      captured.current = null;
    }
    let built = tables.current;
    if (built === null || Math.abs(Math.log(best.r / built.r)) > REBUILD_SHARE) {
      const made = buildLensTables(best.r);
      built = made;
      tables.current = made;
      (lensImageTexture.image.data as Float32Array).set(made.images);
      lensImageTexture.needsUpdate = true;
      (deflectionTexture.image.data as Float32Array).set(made.deflection);
      deflectionTexture.needsUpdate = true;
      LENS_UNIFORMS.uLensImageMap.value.set(made.imageScale, made.imageW, made.images.length / 2);
    }
    // For the stars at a finite distance from it: the cluster's (lens.ts, lensStarAt).
    LENS_UNIFORMS.uLensHoleKm.value = best.km;
    LENS_UNIFORMS.uLensShadow.value = built.shadowAngle;
    LENS_UNIFORMS.uLensOn.value = 1;
    lensState.on = true;

    // The star about the hole, through it, once it is a few pixels across.
    const system = BLACK_HOLE_SYSTEMS.find((candidate) => candidate.id === best.id);
    const star = system === undefined ? null : store.stateRelativeTo(system.companion, focus, jd);
    if (system !== undefined && star !== null) {
      const radiusKm = store.body(system.companion).radiusEquatorialKm;
      scratchStar.set(
        star.position.x - camera.position.x * KM_PER_UNIT,
        star.position.y - camera.position.y * KM_PER_UNIT,
        star.position.z - camera.position.z * KM_PER_UNIT,
      );
      const starKm = scratchStar.length();
      if (starKm > radiusKm && (radiusKm / starKm) * pixelsPerRadian >= STAR_LENSED_FROM_PX) {
        const uniforms = (starOverlay.material as THREE.ShaderMaterial).uniforms;
        (uniforms['uStarCentre']!.value as THREE.Vector3).copy(scratchStar).multiplyScalar(1 / radiusKm);
        uniforms['uHoleDistance']!.value = best.km / radiusKm;
        (uniforms['uStarColor']!.value as THREE.Color).copy(
          starDiscColor(starDiscColorIndex(system.companion), SUN_OVEREXPOSURE * starDiscExposure(system.companion)),
        );
        starOverlay.visible = true;
        lensState.drawnByLens.add(system.companion);
        // And the hole, where the star stands between it and the camera: its black sphere,
        // drawn after, would otherwise show through the star.
        const toHole = LENS_UNIFORMS.uLensHole.value;
        const along = scratchStar.dot(toHole);
        const miss = Math.sqrt(Math.max(0, scratchStar.lengthSq() - along * along));
        if (miss < radiusKm && along - Math.sqrt(radiusKm * radiusKm - miss * miss) < best.km) {
          lensState.drawnByLens.add(system.id);
        }
      }
    }
  }, -0.5);

  // After the glow has set this frame's uniforms (mounted after MilkyWay): the cube, if it
  // must be drawn again, and the overlay's uniforms.
  useFrame(() => {
    const made = tables.current;
    if (!lensState.on || made === null || hole.current === null) {
      return;
    }
    const camera3 = camera as THREE.PerspectiveCamera;
    camera3.updateMatrixWorld();
    const uniforms = (overlay.material as THREE.ShaderMaterial).uniforms;
    const pixelAngle = (2 * Math.tan((camera3.fov * Math.PI) / 360)) / size.height;
    (uniforms['uMap']!.value as THREE.Vector4).set(made.shadowAngle, TABLE_X_MIN, made.xMax, GPU_SAMPLES);
    (uniforms['uHole']!.value as THREE.Vector3).copy(LENS_UNIFORMS.uLensHole.value);
    (uniforms['uViewToWorld']!.value as THREE.Matrix3).setFromMatrix4(camera3.matrixWorld);
    const tanHalf = Math.tan((camera3.fov * Math.PI) / 360);
    (uniforms['uTanHalf']!.value as THREE.Vector2).set(tanHalf * camera3.aspect, tanHalf);
    uniforms['uPixelAngle']!.value = pixelAngle;
    uniforms['uReach']!.value = deflectionReach(made, FADE_FROM_PX * pixelAngle);
    overlay.visible = true;
    const starUniforms = (starOverlay.material as THREE.ShaderMaterial).uniforms;
    (starUniforms['uMap']!.value as THREE.Vector4).copy(uniforms['uMap']!.value as THREE.Vector4);
    (starUniforms['uHole']!.value as THREE.Vector3).copy(uniforms['uHole']!.value as THREE.Vector3);
    (starUniforms['uViewToWorld']!.value as THREE.Matrix3).copy(uniforms['uViewToWorld']!.value as THREE.Matrix3);
    (starUniforms['uTanHalf']!.value as THREE.Vector2).copy(uniforms['uTanHalf']!.value as THREE.Vector2);

    const visibility = skyCapture.paint === null || skyCapture.screen === null ? 0 : skyCapture.visibility;
    uniforms['uGlow']!.value = visibility > 0 ? 1 : 0;
    uniforms['uScreenGlow']!.value = skyCapture.screen;
    if (visibility === 0) {
      return;
    }
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
    if (sun === null) {
      uniforms['uGlow']!.value = 0;
      return;
    }
    scratchSunCamera.set(
      camera3.position.x * KM_PER_UNIT - sun.position.x,
      camera3.position.y * KM_PER_UNIT - sun.position.y,
      camera3.position.z * KM_PER_UNIT - sun.position.z,
    );
    const last = captured.current;
    const stale =
      last === null ||
      last.hole !== hole.current ||
      last.revision !== skyCapture.revision ||
      Math.abs(last.visibility - visibility) > RECAPTURE_VISIBILITY ||
      Math.abs(last.jd - clock.tdbJulianDay) > RECAPTURE_DAYS ||
      last.cameraFromSunKm.distanceTo(scratchSunCamera) > RECAPTURE_SHARE * scratchSunCamera.length();
    if (!stale) {
      return;
    }
    drawCube(gl, camera3, capture);
    captured.current = {
      hole: hole.current,
      revision: skyCapture.revision,
      visibility,
      jd: clock.tdbJulianDay,
      cameraFromSunKm: scratchSunCamera.clone(),
    };
  });

  return (
    <>
      <primitive object={overlay} />
      <primitive object={starOverlay} />
    </>
  );
}

/** The glow into the cube, face by face, from where the camera stands. */
function drawCube(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  capture: {
    cube: THREE.WebGLCubeRenderTarget;
    cubeCamera: THREE.CubeCamera;
    glow: THREE.WebGLRenderTarget;
    scene: THREE.Scene;
    camera: THREE.Camera;
  },
): void {
  const paint = skyCapture.paint;
  if (paint === null) {
    return;
  }
  const { cube, cubeCamera } = capture;
  if (cubeCamera.coordinateSystem !== gl.coordinateSystem) {
    cubeCamera.coordinateSystem = gl.coordinateSystem;
    cubeCamera.updateCoordinateSystem();
  }
  cubeCamera.position.copy(camera.position);
  cubeCamera.updateMatrixWorld();
  const previous = gl.getRenderTarget();
  const previousFace = gl.getActiveCubeFace();
  const previousLevel = gl.getActiveMipmapLevel();
  const autoClear = gl.autoClear;
  gl.autoClear = true;
  cube.texture.generateMipmaps = false;
  cubeCamera.children.forEach((face, index) => {
    // A 90-degree face: CUBE_SIZE / (2 tan 45) pixels a radian.
    paint(gl, face as THREE.Camera, capture.glow, CUBE_SIZE / 2);
    // The mipmaps once, with the last face.
    cube.texture.generateMipmaps = index === 5;
    gl.setRenderTarget(cube, index);
    gl.render(capture.scene, capture.camera);
  });
  gl.setRenderTarget(previous, previousFace, previousLevel);
  gl.autoClear = autoClear;
}
