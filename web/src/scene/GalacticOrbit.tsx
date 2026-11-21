import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { HALO_R200_KPC, orbitFrame, sunOrbit } from '../core/galacticOrbit.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { GALACTIC_BASIS } from './galactic.ts';
import { drawIntoGlow, GLOW_OUTPUT_GLSL, releaseFromGlow } from './glowBuffer.ts';
import { KM_PER_UNIT } from './scale.ts';
import { SceneLabels } from './sceneLabels.ts';

/**
 * The Sun's Galactic Orbit layer (core/galacticOrbit.ts): one turn of the Sun's path about the
 * centre, computed, dashed as every computed path is (StellarFlybys.tsx); and the dark halo's
 * R200, a model, a faint sphere brightest at its rim as the bubbles are (GalacticBubbles.tsx).
 * Both in the galaxy's frame, parsecs about the Sun, put in the scene by one matrix a frame.
 *
 * The orbit shows once the camera is far enough out for it to be a curve, not a line through the
 * nearby stars; the halo once it is out of the disc's neighbourhood, where it is a sphere seen
 * from outside rather than a faint wash over the whole sky.
 */

const ORBIT_COLOUR = new THREE.Color('#e8c46a');
const ORBIT_OPACITY = 0.55;
/** The camera's distance from the Sun over which the orbit fades in, pc. */
const ORBIT_FADE_PC = [300, 1500] as const;
/** And the halo's. */
const HALO_FADE_PC = [40_000, 120_000] as const;
const HALO_COLOUR = [0.42, 0.42, 0.5] as const;
const RIM_CAP = 4;
const FACE_LIGHT = 0.0015;

const NAMES = ['Sun’s orbit', 'Dark halo (R200)'] as const;

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

function ramp(value: number, [gone, full]: readonly [number, number]): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

export function GalacticOrbit({ store, clock, focus, visible, showLabels }: FeatureProps) {
  const { camera, size, gl } = useThree();
  const built = useMemo(() => {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    const orbit = sunOrbit();
    const points = orbit.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const lineMaterial = new THREE.LineDashedMaterial({
      color: ORBIT_COLOUR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      dashSize: 1,
      gapSize: 1,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    line.computeLineDistances();
    // Some sixty dashes along the turn.
    const distances = line.geometry.getAttribute('lineDistance');
    const length = distances === undefined ? 1 : distances.getX(distances.count - 1);
    lineMaterial.dashSize = length / 120;
    lineMaterial.gapSize = length / 120;
    line.frustumCulled = false;
    const haloGeometry = new THREE.SphereGeometry(1, 96, 48);
    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColour: { value: new THREE.Vector3(...HALO_COLOUR) },
        uFade: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    const { centre } = orbitFrame();
    const radiusPc = HALO_R200_KPC * 1000;
    halo.position.set(...centre);
    halo.scale.setScalar(radiusPc);
    halo.frustumCulled = false;
    group.add(line, halo);
    // Its name a quarter of the way round, where the curve is plain; the halo's at its top.
    const orbitLabel = points[Math.floor(points.length / 4)]!.clone();
    const haloLabel = new THREE.Vector3(centre[0], centre[1], centre[2] + radiusPc);
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    const { x: ex, y: ey, z: ez } = GALACTIC_BASIS;
    const scaled = new THREE.Matrix4()
      .makeBasis(
        new THREE.Vector3(ex.x, ex.y, ex.z),
        new THREE.Vector3(ey.x, ey.y, ey.z),
        new THREE.Vector3(ez.x, ez.y, ez.z),
      )
      .multiply(new THREE.Matrix4().makeScale(unitsPerPc, unitsPerPc, unitsPerPc));
    return {
      group,
      line,
      lineMaterial,
      halo,
      haloMaterial,
      haloGeometry,
      labelsAt: [orbitLabel, haloLabel],
      scaled,
    };
  }, []);
  const labels = useMemo(() => new SceneLabels(gl.domElement, NAMES, 'galactic-orbit'), [gl]);

  useEffect(() => {
    drawIntoGlow(built.halo);
    return () => {
      releaseFromGlow(built.halo);
      built.line.geometry.dispose();
      built.lineMaterial.dispose();
      built.haloGeometry.dispose();
      built.haloMaterial.dispose();
    };
  }, [built]);
  useEffect(() => () => labels.dispose(), [labels]);

  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const sun = visible ? store.sunFromFocus(focus, clock.tdbJulianDay) : null;
    if (sun === null) {
      built.group.visible = false;
      labels.hideAll();
      return;
    }
    const sx = sun.position.x / KM_PER_UNIT;
    const sy = sun.position.y / KM_PER_UNIT;
    const sz = sun.position.z / KM_PER_UNIT;
    const fromSunPc =
      (Math.hypot(camera.position.x - sx, camera.position.y - sy, camera.position.z - sz) * KM_PER_UNIT) / PARSEC_KM;
    const orbitShown = ramp(fromSunPc, ORBIT_FADE_PC);
    const haloShown = ramp(fromSunPc, HALO_FADE_PC);
    built.group.visible = orbitShown > 0 || haloShown > 0;
    if (!built.group.visible) {
      labels.hideAll();
      return;
    }
    built.group.matrix.makeTranslation(sx, sy, sz).multiply(built.scaled);
    built.group.matrixWorldNeedsUpdate = true;
    built.line.visible = orbitShown > 0;
    built.lineMaterial.opacity = ORBIT_OPACITY * orbitShown;
    built.halo.visible = haloShown > 0;
    built.haloMaterial.uniforms.uFade!.value = haloShown;
    [orbitShown, haloShown].forEach((shown, index) => {
      if (!showLabels || shown <= 0) {
        labels.hide(index);
        return;
      }
      point.copy(built.labelsAt[index]!).applyMatrix4(built.group.matrix);
      labels.place(index, point, camera, size, shown);
    });
  });

  return <primitive object={built.group} />;
}
