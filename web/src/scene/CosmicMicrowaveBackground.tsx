import type { BodyId, CmbMapInfo } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { SimClock } from '../core/time.ts';
import { cmbLut, cmbVisibility, LAST_SCATTERING_RADIUS_KM, LUT_SIZE, LUT_STEP } from './cmb.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { GLOW_DISPLAY_GLSL } from './glowBuffer.ts';
import { KM_PER_UNIT, kmToUnits } from './scale.ts';
import { projectToScreen } from './screenProjection.ts';

/**
 * The last-scattering sphere (G4): Planck's map of the CMB on a sphere of the CMB's comoving
 * distance about the Sun, drawn once the camera is far outside it (cmb.ts says what is drawn,
 * where and why; the About says it to the reader).
 *
 * Its outer face only: from outside, the sky's mirror image. Drawn first of what is
 * transparent, writing no depth, so what it encloses -- Laniakea's galaxies, the record-holders'
 * marks -- is drawn over it rather than hidden behind its near side: a choice, stated in the
 * About, since from outside a shell of opaque plasma would hide all of it.
 *
 * Its map is loaded only once it is first wanted: 1 MB no one sees from inside.
 */

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vDirection;

void main() {
  // The unit sphere's own point: the direction from the Sun, scene frame.
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>

uniform sampler2D uMap;
uniform mat3 uGalactic;
uniform vec3 uLut[${LUT_SIZE}];
uniform float uCentreTurn;
uniform float uFade;

varying vec3 vDirection;

${GLOW_DISPLAY_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  // Galactic longitude and latitude, as cmb.ts cmbTexCoord: l = 0 in the map's middle, growing left.
  vec3 g = normalize(uGalactic * vDirection);
  float u = fract(0.5 - (atan(g.y, g.x) / (2.0 * PI) - uCentreTurn));
  float v = 0.5 + asin(clamp(g.z, -1.0, 1.0)) / PI;
  // The mip level from a longitude that does not jump where u wraps (l = 180): of the two, the
  // smaller derivative.
  float uShifted = fract(u + 0.5) - 0.5;
  vec2 dx = vec2(dFdx(u), dFdx(v));
  vec2 dy = vec2(dFdy(u), dFdy(v));
  float dxShifted = dFdx(uShifted);
  float dyShifted = dFdy(uShifted);
  if (abs(dxShifted) < abs(dx.x)) dx.x = dxShifted;
  if (abs(dyShifted) < abs(dy.x)) dy.x = dyShifted;
  float level = textureGrad(uMap, vec2(u, v), dx, dy).r * 255.0 / ${LUT_STEP.toFixed(1)};
  float i = clamp(level, 0.0, ${(LUT_SIZE - 1).toFixed(1)} - 0.001);
  int i0 = int(floor(i));
  // Shown as every other glow is (glowBuffer.ts glowDisplay): its linear light, white columns,
  // through the one shoulder and the sRGB encode -- not through the renderer's ACES curve,
  // which no emitter here goes through.
  gl_FragColor = vec4(glowDisplay(mix(uLut[i0], uLut[i0 + 1], fract(i))), uFade);
}
`;

const LABEL_GAP_PX = 8;
const scratchRight = new THREE.Vector3();
const scratchPoint = new THREE.Vector3();

export function CosmicMicrowaveBackground({
  store,
  clock,
  focus,
  visible,
  label,
}: {
  store: EphemerisStore;
  clock: SimClock;
  focus: BodyId;
  visible: boolean;
  label: RefObject<HTMLElement | null>;
}) {
  const { camera, size } = useThree();
  const wanted = useRef(false);

  const material = useMemo(() => {
    const { x, y, z } = GALACTIC_BASIS;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uMap: { value: null },
        uGalactic: { value: new THREE.Matrix3().set(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z) },
        uLut: { value: Array.from({ length: LUT_SIZE }, () => new THREE.Vector3()) },
        uCentreTurn: { value: 0 },
        uFade: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.FrontSide,
    });
  }, []);

  const mesh = useMemo(() => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), material);
    sphere.frustumCulled = false;
    sphere.renderOrder = -1;
    sphere.visible = false;
    return sphere;
  }, [material]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      material.dispose();
      (material.uniforms['uMap']!.value as THREE.Texture | null)?.dispose();
    },
    [mesh, material],
  );

  // The map and its description, once first wanted.
  const load = (): void => {
    wanted.current = true;
    const base = `${import.meta.env.BASE_URL}cmb/`;
    void fetch(`${base}cmb.json`)
      .then((response) => response.json() as Promise<CmbMapInfo>)
      .then((info) => {
        new THREE.TextureLoader().load(`${base}${info.file}`, (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.NoColorSpace;
          texture.anisotropy = 4;
          texture.needsUpdate = true;
          const lut = material.uniforms['uLut']!.value as THREE.Vector3[];
          cmbLut(info).forEach(([r, g, b], i) => lut[i]!.set(r, g, b));
          material.uniforms['uCentreTurn']!.value = info.centreLongitudeDeg / 360;
          material.uniforms['uMap']!.value = texture;
          renderDemand.request();
        });
      })
      .catch((error: unknown) => {
        console.error('Could not load the CMB map', error);
      });
  };

  useFrame(() => {
    const element = label.current;
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      mesh.visible = false;
      hide(element);
      return;
    }
    mesh.position.set(kmToUnits(sun.position.x), kmToUnits(sun.position.y), kmToUnits(sun.position.z));
    const radiusUnits = kmToUnits(LAST_SCATTERING_RADIUS_KM);
    mesh.scale.setScalar(radiusUnits);
    const fade = cmbVisibility(mesh.position.distanceTo(camera.position) * KM_PER_UNIT);
    if (fade > 0 && !wanted.current) {
      load();
    }
    const ready = material.uniforms['uMap']!.value !== null;
    mesh.visible = fade > 0 && ready;
    material.uniforms['uFade']!.value = fade;
    if (element === null) {
      return;
    }
    if (!mesh.visible || fade < 0.5) {
      hide(element);
      return;
    }
    // Its name on its right-hand limb, as the camera sees it.
    camera.updateMatrixWorld();
    scratchRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    scratchPoint.copy(scratchRight).multiplyScalar(radiusUnits).add(mesh.position);
    const onScreen =
      projectToScreen(scratchPoint, camera, scratchPoint) && Math.abs(scratchPoint.x) <= 1 && Math.abs(scratchPoint.y) <= 1;
    if (!onScreen) {
      hide(element);
      return;
    }
    if (element.style.display !== 'block') {
      element.style.display = 'block';
    }
    const x = (scratchPoint.x * 0.5 + 0.5) * size.width;
    const y = (-scratchPoint.y * 0.5 + 0.5) * size.height;
    element.style.transform = `translate(${x + LABEL_GAP_PX}px, ${y}px) translateY(-50%)`;
    element.style.opacity = String(fade);
  });

  return <primitive object={mesh} />;
}

function hide(element: HTMLElement | null | undefined): void {
  if (element != null && element.style.display !== 'none') {
    element.style.display = 'none';
  }
}
