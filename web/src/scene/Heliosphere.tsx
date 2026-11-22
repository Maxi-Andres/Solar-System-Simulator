import type { BodyId } from '@sss/tools/types';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  HELIOPAUSE_DRAWN_TO_DEG,
  HELIOPAUSE_FADES_FROM_DEG,
  HELIOPAUSE_NOSE_AU,
  heliopauseRadius,
  HILLS_CLOUD_INNER_AU,
  NOSE,
  OORT_CLOUD_INNER_AU,
  OORT_CLOUD_OUTER_AU,
  TERMINATION_SHOCK_AU,
} from '../core/heliosphere.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { hideLabel, makeLabel, placeShellLabel, revolutionGeometry, rimMaterial, smoothRamp, sphereGeometry } from './regionSurface.ts';
import { AU_KM, KM_PER_UNIT, kmToUnits, LIGHT_YEAR_KM } from './scale.ts';
// Run in the frame where the layer is mounted, though its chunk arrives later: see lazyLayer.tsx.
import { useFrame } from './lazyLayer.tsx';

/**
 * The heliosphere's two boundaries and the Oort cloud about the Sun (core/heliosphere.ts says what
 * is measured and what is modelled): the Heliosphere layer.
 *
 * **The boundaries**, faint surfaces brighter where seen edge-on: the termination shock Parker's
 * sphere, the heliopause Parker's surface turned to the interstellar flow, its tail fading out from
 * 110 degrees off the nose, since its length is not known. Shown once the camera is out past the
 * planets -- from inside, a surface on every side is only a veil over the sky. The four places
 * the Voyagers crossed them are bodies, marked and named (heliosphere.ts).
 *
 * **The Oort cloud**, a region and not a thing: no object in it has been seen there. Drawn as two
 * shells of even, faint glow -- the inner (Hills) cloud from 2,000 to 20,000 AU, the outer to
 * 100,000 -- each pixel as bright as the length of its line of sight inside each shell, worked
 * out exactly from the ray's chords through the three spheres. Even, because its real density
 * (falling about as r^-3.5 in the models) is itself inferred, and drawn it would be a glow at
 * 2,000 AU and nothing beyond. From the camera out past 1,000 AU.
 */

const SHOCK_COLOR = '#e0a868';
const PAUSE_COLOR = '#8fb4e8';
const HILLS_COLOR = new THREE.Color('#7f8fb0');
const OORT_COLOR = new THREE.Color('#5d6a8a');

/** Camera's distance from the Sun, AU, over which the boundaries come in. */
const BOUNDARIES_FROM_AU = 20;
const BOUNDARIES_FULL_AU = 60;
const BOUNDARY_OPACITY = 0.4;

/** And over which the Oort cloud does, and goes again far out among the stars. */
const OORT_FROM_AU = 1_000;
const OORT_FULL_AU = 6_000;
const OORT_GONE_LY = 200;
const OORT_FADING_LY = 30;

const OORT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const OORT_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCamera;
uniform float uInner;
uniform float uMiddle;
uniform vec3 uHills;
uniform vec3 uOort;
uniform float uFade;
varying vec3 vLocal;

// The length of the ray from o along d inside a sphere of radius r about the origin, ahead of o.
float chord(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float h = b * b - c;
  if (h <= 0.0) return 0.0;
  h = sqrt(h);
  return max(0.0, -b + h - max(0.0, -b - h));
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vLocal - uCamera);
  float outer = chord(uCamera, d, 1.0);
  float middle = chord(uCamera, d, uMiddle);
  float inner = chord(uCamera, d, uInner);
  // Each shell's column over the longest it can be, its diameter's chord.
  float hills = (middle - inner) / (2.0 * uMiddle);
  float oort = (outer - middle) / 2.0;
  gl_FragColor = vec4(uHills * hills + uOort * oort, uFade);
}
`;

export function Heliosphere({ store, clock, focus }: { store: EphemerisStore; clock: SimClock; focus: BodyId }) {
  const { camera, size, gl } = useThree();
  const visible = useViewStore((state) => state.layers.heliosphere);
  const labelsOn = useViewStore((state) => state.layers.labels && state.layers.userInterface);

  const parts = useMemo(() => {
    const group = new THREE.Group();

    const shockMaterial = rimMaterial(SHOCK_COLOR);
    const shock = new THREE.Mesh(sphereGeometry(), shockMaterial);
    shock.scale.setScalar(kmToUnits(TERMINATION_SHOCK_AU * AU_KM));
    shock.frustumCulled = false;

    // The heliopause in units of its nose distance, along local +x, turned to the nose.
    const drawnTo = (HELIOPAUSE_DRAWN_TO_DEG * Math.PI) / 180;
    const pauseMaterial = rimMaterial(PAUSE_COLOR);
    const pause = new THREE.Mesh(
      revolutionGeometry(
        (t) => {
          const nu = t * drawnTo;
          const r = heliopauseRadius(nu, 1);
          return [r * Math.cos(nu), r * Math.sin(nu)];
        },
        (t) => 1 - smoothRamp((t * HELIOPAUSE_DRAWN_TO_DEG), HELIOPAUSE_FADES_FROM_DEG, HELIOPAUSE_DRAWN_TO_DEG),
        160,
        128,
      ),
      pauseMaterial,
    );
    pause.scale.setScalar(kmToUnits(HELIOPAUSE_NOSE_AU * AU_KM));
    pause.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(NOSE.x, NOSE.y, NOSE.z));
    pause.frustumCulled = false;

    const oortMaterial = new THREE.ShaderMaterial({
      vertexShader: OORT_VERTEX,
      fragmentShader: OORT_FRAGMENT,
      uniforms: {
        uCamera: { value: new THREE.Vector3() },
        uInner: { value: HILLS_CLOUD_INNER_AU / OORT_CLOUD_OUTER_AU },
        uMiddle: { value: OORT_CLOUD_INNER_AU / OORT_CLOUD_OUTER_AU },
        uHills: { value: HILLS_COLOR.clone().multiplyScalar(0.22) },
        uOort: { value: OORT_COLOR.clone().multiplyScalar(0.32) },
        uFade: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const oort = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), oortMaterial);
    oort.scale.setScalar(kmToUnits(OORT_CLOUD_OUTER_AU * AU_KM));
    oort.frustumCulled = false;
    oort.renderOrder = -1;

    group.add(oort, shock, pause);
    return { group, shock, shockMaterial, pause, pauseMaterial, oort, oortMaterial };
  }, []);

  const labels = useMemo(() => {
    const container = gl.domElement.parentElement;
    return {
      oort: makeLabel(container, 'Oort cloud · inferred, never seen', '#8f9bb8'),
      hills: makeLabel(container, 'inner Oort cloud (Hills) · inferred', '#9aa8c4'),
    };
  }, [gl]);

  useEffect(
    () => () => {
      for (const mesh of [parts.shock, parts.pause, parts.oort]) mesh.geometry.dispose();
      parts.shockMaterial.dispose();
      parts.pauseMaterial.dispose();
      parts.oortMaterial.dispose();
      labels.oort?.remove();
      labels.hills?.remove();
    },
    [parts, labels],
  );

  const scratchCamera = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const sun = visible ? store.sunFromFocus(focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      parts.group.visible = false;
      hideLabel(labels.oort);
      hideLabel(labels.hills);
      return;
    }
    const { group } = parts;
    group.visible = true;
    group.position.set(kmToUnits(sun.position.x), kmToUnits(sun.position.y), kmToUnits(sun.position.z));
    camera.updateMatrixWorld();
    const cameraFromSunKm = group.position.distanceTo(camera.position) * KM_PER_UNIT;
    const cameraFromSunAu = cameraFromSunKm / AU_KM;

    const boundaries = smoothRamp(Math.log(cameraFromSunAu), Math.log(BOUNDARIES_FROM_AU), Math.log(BOUNDARIES_FULL_AU));
    parts.shock.visible = boundaries > 0;
    parts.pause.visible = boundaries > 0;
    parts.shockMaterial.uniforms['uOpacity']!.value = BOUNDARY_OPACITY * boundaries;
    parts.pauseMaterial.uniforms['uOpacity']!.value = BOUNDARY_OPACITY * boundaries;

    const cameraFromSunLy = cameraFromSunKm / LIGHT_YEAR_KM;
    const oort =
      smoothRamp(Math.log(cameraFromSunAu), Math.log(OORT_FROM_AU), Math.log(OORT_FULL_AU)) *
      (1 - smoothRamp(Math.log(cameraFromSunLy), Math.log(OORT_FADING_LY), Math.log(OORT_GONE_LY)));
    parts.oort.visible = oort > 0;
    parts.oortMaterial.uniforms['uFade']!.value = oort;
    const outerUnits = kmToUnits(OORT_CLOUD_OUTER_AU * AU_KM);
    // The camera about the Sun, in the cloud's radii: small numbers, in double precision until here.
    scratchCamera.copy(camera.position).sub(group.position).divideScalar(outerUnits);
    (parts.oortMaterial.uniforms['uCamera']!.value as THREE.Vector3).copy(scratchCamera);

    if (!labelsOn) {
      hideLabel(labels.oort);
      hideLabel(labels.hills);
      return;
    }
    placeShellLabel(labels.oort, group.position, outerUnits, camera, size, oort);
    // The inner cloud's name only while the camera is outside it: from within, the two would sit together.
    const middleUnits = kmToUnits(OORT_CLOUD_INNER_AU * AU_KM);
    placeShellLabel(
      labels.hills,
      group.position,
      middleUnits,
      camera,
      size,
      cameraFromSunAu > OORT_CLOUD_INNER_AU * 1.05 ? oort : 0,
    );
  });

  return <primitive object={parts.group} />;
}
