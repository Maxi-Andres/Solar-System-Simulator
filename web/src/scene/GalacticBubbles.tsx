import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { BUBBLES, lobeCentrePc } from '../core/galacticBubbles.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { GALACTIC_BASIS } from './galactic.ts';
import { drawIntoGlow, GLOW_OUTPUT_GLSL, releaseFromGlow } from './glowBuffer.ts';
import { KM_PER_UNIT } from './scale.ts';
import { SceneLabels } from './sceneLabels.ts';

/**
 * The Fermi and eROSITA bubbles (core/galacticBubbles.ts): each lobe a faint shell, brightest at
 * its rim, where the line of sight runs along it -- as a thin shell of glowing gas looks. Built in
 * the galaxy's own frame, parsecs about the Sun, and put in the scene by one matrix a frame.
 *
 * Shown only from out in the galaxy, past FADE_NEAR_PC from the Sun: from home they would lie
 * over the whole sky in a false colour. Their names at the top of each northern lobe.
 */

/** The camera's distance from the Sun at which they start to show, and are whole, pc. */
const FADE_NEAR_PC = 1500;
const FADE_FULL_PC = 5000;
/** The rim's light: a thin shell's path, 1 / |cos|, up to this. */
const RIM_CAP = 4;
/** The light where the shell faces us, white columns. */
const FACE_LIGHT = 0.002;

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = view.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * view;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}
  uniform vec3 uColour;
  uniform float uFade;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    #include <logdepthbuf_fragment>
    float facing = abs(dot(normalize(vNormal), normalize(-vView)));
    float path = min(1.0 / max(facing, 1e-3), ${RIM_CAP.toFixed(1)});
    gl_FragColor = glowLight(uColour * (${FACE_LIGHT} * path * path) * uFade);
  }
`;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

export function GalacticBubbles({ store, clock, focus, visible, showLabels }: FeatureProps) {
  const { camera, size, gl } = useThree();
  const built = useMemo(() => {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    const geometry = new THREE.SphereGeometry(1, 96, 48);
    const materials: THREE.ShaderMaterial[] = [];
    const tops: THREE.Vector3[] = [];
    for (const pair of BUBBLES) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uColour: { value: new THREE.Vector3(...pair.colour) }, uFade: { value: 0 } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      materials.push(material);
      for (const side of [1, -1] as const) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...lobeCentrePc(pair.lobe, side));
        mesh.scale.set(pair.lobe.acrossPc, pair.lobe.acrossPc, pair.lobe.alongPc);
        mesh.frustumCulled = false;
        group.add(mesh);
      }
      const [x, y, z] = lobeCentrePc(pair.lobe, 1);
      tops.push(new THREE.Vector3(x, y, z + pair.lobe.alongPc * 0.85));
    }
    // Galactic pc to the scene's ecliptic frame, in scene units: the basis's columns, scaled.
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    const { x: ex, y: ey, z: ez } = GALACTIC_BASIS;
    const rotation = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(ex.x, ex.y, ex.z),
      new THREE.Vector3(ey.x, ey.y, ey.z),
      new THREE.Vector3(ez.x, ez.y, ez.z),
    );
    const scaled = rotation.multiply(new THREE.Matrix4().makeScale(unitsPerPc, unitsPerPc, unitsPerPc));
    return { group, geometry, materials, tops, scaled };
  }, []);
  const labels = useMemo(() => new SceneLabels(gl.domElement, BUBBLES.map((pair) => pair.name), 'galactic-bubbles'), [gl]);

  useEffect(() => {
    for (const mesh of built.group.children) drawIntoGlow(mesh);
    return () => {
      for (const mesh of built.group.children) releaseFromGlow(mesh);
      built.geometry.dispose();
      for (const material of built.materials) material.dispose();
    };
  }, [built]);
  useEffect(() => () => labels.dispose(), [labels]);

  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const sun = visible ? store.stateRelativeTo('sun', focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      built.group.visible = false;
      labels.hideAll();
      return;
    }
    const sx = sun.position.x / KM_PER_UNIT;
    const sy = sun.position.y / KM_PER_UNIT;
    const sz = sun.position.z / KM_PER_UNIT;
    const fromSunPc = (Math.hypot(camera.position.x - sx, camera.position.y - sy, camera.position.z - sz) * KM_PER_UNIT) / PARSEC_KM;
    const fade = ramp(fromSunPc, FADE_NEAR_PC, FADE_FULL_PC);
    built.group.visible = fade > 0;
    if (fade <= 0) {
      labels.hideAll();
      return;
    }
    built.group.matrix.makeTranslation(sx, sy, sz).multiply(built.scaled);
    built.group.matrixWorldNeedsUpdate = true;
    for (const material of built.materials) material.uniforms.uFade!.value = fade;
    built.tops.forEach((top, index) => {
      if (!showLabels) {
        labels.hide(index);
        return;
      }
      point.copy(top).applyMatrix4(built.group.matrix);
      labels.place(index, point, camera, size, fade);
    });
  });

  return <primitive object={built.group} />;
}
