import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import {
  auroraChanged,
  auroraForecast,
  auroraShownAt,
  OVATION_LATITUDES,
  OVATION_LONGITUDES,
  refreshAurora,
} from '../core/aurora.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { tdbToUtc, type SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { longitudeDirection, poleDirection } from './orientation.ts';
import { smoothRamp } from './regionSurface.ts';
import { KM_PER_UNIT, kmToUnits } from './scale.ts';

/**
 * The auroral ovals (core/aurora.ts): NOAA's OVATION Prime forecast drawn as the green glow of
 * atomic oxygen, 557.7 nm, in a shell 90 to 260 km up that turns with Earth.
 *
 * Each pixel of the shell marches its view ray through the shell (24 samples), and at each one
 * adds the forecast's probability where that sample stands over the ground -- geographic
 * latitude and longitude, the grid's own -- times the light's height profile and the length of
 * the step. So the ovals brighten toward the limb, where the line of sight runs along the layer
 * for a thousand kilometres rather than across it for a hundred, as they do in pictures from
 * orbit.
 *
 * **Choices, each a model and named as one.**
 *  - Brightness follows the forecast's *probability* of seeing aurora, not a radiance: OVATION's
 *    map is of the chance, and its energy flux is not published in this product. So a likely
 *    oval is bright and an unlikely one faint, which is the right order but not a measure. Under
 *    a 5 % chance nothing is drawn: there the forecast says the aurora is too faint to see, and
 *    drawn it glowed over half a hemisphere, brightest at the limb where the path is longest.
 *  - The height profile: none below 90 km, the most at 110, falling by e every 45 km above --
 *    the shape of the green line's emission under electrons of a few keV, not a fit to any night.
 *  - Drawn only over ground in the dark (the Sun 6 degrees or more below the horizon there,
 *    fading in from the horizon): over a sunlit Earth the aurora is there and washed out.
 *  - Only green: the red oxygen line at 630 nm, above 200 km and far fainter, is left out.
 *  - Latitude is geocentric, the grid's degree is wider than the 0.2 degree that differs from
 *    the geodetic one at these heights.
 */

/** The shell's top, km above the ellipsoid. */
const TOP_KM = 260;

/** The green line's height profile; its integral up through the layer, km, normalises it. */
const PEAK_KM = 110;
const FLOOR_KM = 90;
const SCALE_KM = 45;
const COLUMN_KM = (PEAK_KM - FLOOR_KM) / 2 + SCALE_KM;

/**
 * How bright a column of certain aurora seen straight down is, before the curve that keeps the
 * limb from saturating: a choice, not a radiance (see above).
 */
const GAIN = 1.0;

/** The chance below which nothing is drawn, 0 to 1. */
const PROBABILITY_FLOOR = 0.05;

const SAMPLES = 24;

/**
 * 557.7 nm in linear sRGB. Its CIE 1931 colour matching values, (0.50, 0.995, 0.004), through the
 * XYZ-to-sRGB matrix give (0.089, 1.382, -0.171): outside the gamut, blue below zero. Clipped and
 * scaled to the brightest channel, the nearest colour a screen can show.
 */
const GREEN_LINE_LINEAR: readonly [number, number, number] = [0.064, 1, 0];

/** Camera distances from Earth, Earth radii, over which the ovals go: tiny on screen past them. */
const FADE_OUT: readonly [number, number] = [40, 150];

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vLocal;
void main() {
  // Object space is Earth's, in its equatorial radii: the mesh is scaled by it.
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform vec3 uCameraLocal;
uniform vec3 uSunLocal;
uniform vec3 uColor;
uniform float uFlattening;
uniform float uRadiusKm;
uniform float uOpacity;
varying vec3 vLocal;

vec2 raySphere(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return vec2(1.0, -1.0);
  float root = sqrt(discriminant);
  return vec2(-b - root, -b + root);
}

/** The nearest hit on the ellipsoid ahead, or -1: the pole is local +y. */
float rayPlanet(vec3 origin, vec3 direction) {
  vec3 o = vec3(origin.x, origin.y / uFlattening, origin.z);
  vec3 d = vec3(direction.x, direction.y / uFlattening, direction.z);
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float discriminant = b * b - a * c;
  if (discriminant < 0.0) return -1.0;
  float t = (-b - sqrt(discriminant)) / a;
  return t > 0.0 ? t : -1.0;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 origin = uCameraLocal;
  vec3 direction = normalize(vLocal - origin);
  vec2 shell = raySphere(origin, direction, 1.0 + ${TOP_KM.toFixed(1)} / uRadiusKm);
  float near = max(shell.x, 0.0);
  float far = shell.y;
  float ground = rayPlanet(origin, direction);
  if (ground > 0.0) far = min(far, ground);
  if (far <= near) discard;

  float step = (far - near) / ${SAMPLES.toFixed(1)};
  float column = 0.0;
  for (int i = 0; i < ${SAMPLES}; i++) {
    vec3 p = origin + direction * (near + (float(i) + 0.5) * step);
    float radius = length(p);
    vec3 up = p / radius;
    float surface = inversesqrt(up.x * up.x + up.z * up.z + (up.y * up.y) / (uFlattening * uFlattening));
    float heightKm = (radius - surface) * uRadiusKm;
    float emission = smoothstep(${FLOOR_KM.toFixed(1)}, ${PEAK_KM.toFixed(1)}, heightKm)
      * exp(-max(heightKm - ${PEAK_KM.toFixed(1)}, 0.0) / ${SCALE_KM.toFixed(1)});
    if (emission <= 0.0) continue;
    // In the dark: the Sun at least 6 degrees down at the ground beneath, fading in from the horizon.
    float night = smoothstep(0.0, -0.105, dot(up, uSunLocal));
    if (night <= 0.0) continue;
    float lon = atan(-up.z, up.x);
    float lat = asin(clamp(up.y, -1.0, 1.0));
    vec2 uv = vec2(
      lon / (2.0 * PI) + 0.5 / ${OVATION_LONGITUDES.toFixed(1)},
      (lat / PI + 0.5) * (${(OVATION_LATITUDES - 1).toFixed(1)} / ${OVATION_LATITUDES.toFixed(1)}) + 0.5 / ${OVATION_LATITUDES.toFixed(1)}
    );
    float chance = max(texture2D(uMap, uv).r - ${PROBABILITY_FLOOR.toFixed(2)}, 0.0) / ${(1 - PROBABILITY_FLOOR).toFixed(2)};
    column += emission * night * chance * step * uRadiusKm;
  }
  float brightness = 1.0 - exp(-${GAIN.toFixed(2)} * column / ${COLUMN_KM.toFixed(1)});
  if (brightness <= 0.0) discard;
  gl_FragColor = vec4(uColor * brightness * uOpacity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function Aurora({ store, clock, focus }: { store: EphemerisStore; clock: SimClock; focus: BodyId }) {
  const { camera } = useThree();
  const visible = useViewStore((state) => state.layers.aurora);

  const parts = useMemo(() => {
    const texture = new THREE.DataTexture(
      new Uint8Array(OVATION_LONGITUDES * OVATION_LATITUDES),
      OVATION_LONGITUDES,
      OVATION_LATITUDES,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uMap: { value: texture },
        uCameraLocal: { value: new THREE.Vector3() },
        uSunLocal: { value: new THREE.Vector3(1, 0, 0) },
        uColor: { value: new THREE.Vector3(...GREEN_LINE_LINEAR) },
        uFlattening: { value: 1 },
        uRadiusKm: { value: 6378 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    // A little past the shell's top, in Earth radii: the mesh only has to cover where it is on screen.
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1 + (TOP_KM + 10) / 6378, 192, 96), material);
    mesh.frustumCulled = false;
    // After the air (atmosphere.ts, 2): the glow is above nearly all of it, and drawn before the
    // clouds the deck's blending dimmed it in the clouds' pattern.
    mesh.renderOrder = 3;
    mesh.visible = false;
    return { texture, material, mesh, version: -1 };
  }, []);

  useEffect(
    () => () => {
      parts.mesh.geometry.dispose();
      parts.material.dispose();
      parts.texture.dispose();
    },
    [parts],
  );

  // A forecast arriving is news to draw even with the clock paused.
  useEffect(() => auroraChanged.subscribe(() => renderDemand.request()), []);

  const scratch = useMemo(
    () => ({
      basis: new THREE.Matrix4(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3(),
      inverse: new THREE.Quaternion(),
      local: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(() => {
    const { mesh, material } = parts;
    if (!visible) {
      mesh.visible = false;
      return;
    }
    refreshAurora(performance.now());
    const forecast = auroraForecast();
    const jd = clock.tdbJulianDay;
    const earth = forecast !== null && store.tree.has('earth') ? store.stateRelativeTo('earth', focus, jd) : null;
    const sun = earth === null ? null : store.sunFromFocus('earth', jd);
    if (forecast === null || earth === null || sun === null || !auroraShownAt(forecast, tdbToUtc(jd))) {
      mesh.visible = false;
      return;
    }
    if (parts.version !== auroraChanged.count) {
      // Percent to the byte's full range, so the texture reads back the probability as 0 to 1.
      const bytes = parts.texture.image.data as Uint8Array;
      for (let k = 0; k < bytes.length; k += 1) bytes[k] = Math.round(forecast.probability[k]! * 2.55);
      parts.texture.needsUpdate = true;
      parts.version = auroraChanged.count;
    }

    const body = store.body('earth');
    const radiusUnits = kmToUnits(body.radiusEquatorialKm);
    mesh.position.set(kmToUnits(earth.position.x), kmToUnits(earth.position.y), kmToUnits(earth.position.z));
    camera.updateMatrixWorld();
    const cameraRadii = (mesh.position.distanceTo(camera.position) * KM_PER_UNIT) / body.radiusEquatorialKm;
    const fade = 1 - smoothRamp(Math.log(cameraRadii), Math.log(FADE_OUT[0]), Math.log(FADE_OUT[1]));
    if (fade <= 0) {
      mesh.visible = false;
      return;
    }

    // Local +x the Greenwich meridian, +y the pole, +z = x cross y (90 degrees west): the grid's
    // geographic coordinates, turning with Earth.
    const greenwich = longitudeDirection(jd, body, 0);
    const pole = poleDirection(jd, body);
    scratch.x.set(greenwich.x, greenwich.y, greenwich.z);
    scratch.y.set(pole.x, pole.y, pole.z);
    scratch.z.crossVectors(scratch.x, scratch.y);
    scratch.basis.makeBasis(scratch.x, scratch.y, scratch.z);
    mesh.quaternion.setFromRotationMatrix(scratch.basis);
    mesh.scale.setScalar(radiusUnits);
    mesh.visible = true;
    mesh.updateMatrixWorld();

    scratch.inverse.copy(mesh.quaternion).invert();
    material.uniforms['uCameraLocal']!.value.copy(scratch.local.copy(camera.position).sub(mesh.position).applyQuaternion(scratch.inverse).divideScalar(radiusUnits));
    material.uniforms['uSunLocal']!.value.set(sun.position.x, sun.position.y, sun.position.z).normalize().applyQuaternion(scratch.inverse);
    material.uniforms['uFlattening']!.value = body.radiusPolarKm / body.radiusEquatorialKm;
    material.uniforms['uRadiusKm']!.value = body.radiusEquatorialKm;
    material.uniforms['uOpacity']!.value = fade;
    // From inside the shell its far side is what is drawn; from outside, its near side.
    const inside = (scratch.local.length() - 1) * body.radiusEquatorialKm < TOP_KM;
    material.side = inside ? THREE.BackSide : THREE.FrontSide;
  });

  return <primitive object={parts.mesh} />;
}
