import type { BodyId, CmbMapInfo } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { beginLoading } from '../core/loading.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { cmbLut, cmbVisibility, LAST_SCATTERING_RADIUS_KM, LUT_SIZE, LUT_STEP, type CmbColours } from './cmb.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { GLOW_DISPLAY_GLSL } from './glowBuffer.ts';
import { KM_PER_UNIT, kmToUnits } from './scale.ts';

/**
 * The last-scattering sphere (G4): Planck's map of the CMB on a sphere of the CMB's comoving
 * distance about the Sun, the wall of the sky all about once the camera is far out -- seen from
 * inside, as it only can be: the camera never leaves it (cmb.ts says what is drawn, where and
 * why; the About says it to the reader).
 *
 * Its inside faces (BackSide), which from inside are all of it, every way the camera turns.
 * Drawn first of what is transparent, writing no depth, so everything it encloses -- the
 * quasars' wedges, the deep fields' beams, the record-holders' marks -- is drawn over it. (Its
 * outside faces, drawn when the camera could stand outside it, were an opaque screen in front
 * of all of that.)
 *
 * Its colours are the view store's cmbColours, true colour or Planck's map: a switch swaps the
 * shader's table and how it is shown, not the map.
 *
 * Its map is loaded only once it is first wanted: 1 MB no one sees at nearer scales.
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
// 1: the table is Planck's map's display colours, written as they are; 0: true colour, linear light.
uniform float uDisplayed;

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
  vec3 colour = mix(uLut[i0], uLut[i0 + 1], fract(i));
  // True colour is shown as every other glow is (glowBuffer.ts glowDisplay): its linear light,
  // white columns, through the one shoulder and the sRGB encode -- not through the renderer's
  // ACES curve, which no emitter here goes through. Planck's colours are display colours already.
  gl_FragColor = vec4(uDisplayed > 0.5 ? colour : glowDisplay(colour), uFade);
}
`;

/**
 * Where its name is, as a fraction of the view from its left and from its top. From inside, the
 * wall is behind everything on the screen and has no edge to name it at: the name stands low on
 * the right, on the wall, clear of the Sun in the middle and of the scale bar at the bottom left.
 */
const LABEL_AT = { x: 0.78, y: 0.86 } as const;

/**
 * How bright the wall is drawn, of its full colours, in either mode: from inside it fills the
 * whole view, and at full strength the names and the quasars in front of it could not be read
 * (Maxi, 2026-11-17: "bajalo un poco"). A backdrop, as the sky behind a photograph's subject.
 */
export const CMB_WALL_LEVEL = 0.45;

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
  const colours = useViewStore((state) => state.cmbColours);
  /** The map's description once loaded: what the table is made from, whichever colours. */
  const info = useRef<CmbMapInfo | null>(null);

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
        uDisplayed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      // Its inside: from inside, all of it, behind what it encloses.
      side: THREE.BackSide,
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

  /** The table and how it is shown, for the colours chosen: no reload of the map. */
  const applyColours = (chosen: CmbColours): void => {
    if (info.current === null) {
      return;
    }
    const lut = material.uniforms['uLut']!.value as THREE.Vector3[];
    cmbLut(info.current, chosen).forEach(([r, g, b], i) => lut[i]!.set(r, g, b));
    material.uniforms['uDisplayed']!.value = chosen === 'planck' ? 1 : 0;
  };

  useEffect(() => {
    applyColours(colours);
    renderDemand.request();
    // applyColours reads only the material and the loaded description, both stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colours, material]);

  // The map and its description, once first wanted.
  const load = (): void => {
    wanted.current = true;
    const base = `${import.meta.env.BASE_URL}cmb/`;
    // Its name on the loading line until the map is in, or has failed (core/loading.ts).
    const end = beginLoading('the cosmic microwave background');
    void fetch(`${base}cmb.json`)
      .then((response) => response.json() as Promise<CmbMapInfo>)
      .then((loaded) => {
        new THREE.TextureLoader().load(`${base}${loaded.file}`, (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.NoColorSpace;
          texture.anisotropy = 4;
          texture.needsUpdate = true;
          info.current = loaded;
          applyColours(useViewStore.getState().cmbColours);
          material.uniforms['uCentreTurn']!.value = loaded.centreLongitudeDeg / 360;
          material.uniforms['uMap']!.value = texture;
          end();
          renderDemand.request();
        }, undefined, (error: unknown) => {
          end();
          console.error('Could not load the CMB map', error);
        });
      })
      .catch((error: unknown) => {
        end();
        console.error('Could not load the CMB map', error);
      });
  };

  useFrame(() => {
    const element = label.current;
    const sun = visible ? store.sunFromFocus(focus, clock.tdbJulianDay) : null;
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
    material.uniforms['uFade']!.value = fade * CMB_WALL_LEVEL;
    if (element === null) {
      return;
    }
    if (!mesh.visible || fade < 0.5) {
      hide(element);
      return;
    }
    if (element.style.display !== 'block') {
      element.style.display = 'block';
    }
    element.style.transform = `translate(${LABEL_AT.x * size.width}px, ${LABEL_AT.y * size.height}px) translate(-50%, -50%)`;
    element.style.opacity = String(fade);
  });

  return <primitive object={mesh} />;
}

function hide(element: HTMLElement | null | undefined): void {
  if (element != null && element.style.display !== 'none') {
    element.style.display = 'none';
  }
}
