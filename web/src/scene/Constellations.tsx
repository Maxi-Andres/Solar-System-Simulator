import type { BodyId, ConstellationCatalog } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import {
  boundarySegments,
  constellationFade,
  constellationLabels,
  figureSegments,
  loadConstellations,
  type ConstellationLabel,
} from '../core/constellations.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { KM_PER_UNIT } from './scale.ts';
import { SceneLabels } from './sceneLabels.ts';
import { yearsSinceEpoch } from './starGeometry.ts';
import { SPHERE_RADIUS } from './starRendering.ts';

/**
 * The Constellations layer (core/constellations.ts): the IAU's 88 as the Sun sees them -- their
 * official boundaries, faint, their traditional figures through the stars, and their names.
 *
 * On the sky at infinity, where the stars with no distance are (starRendering.ts SPHERE_RADIUS):
 * the lines follow the camera, so they never parallax, and a planet passes in front of them.
 * Only near the Sun, fading out between 1,000 and 10,000 AU (constellationFade): from farther
 * the stars no longer line up as these shapes. The figures' stars move by their proper motions,
 * as the sky's do, so a figure still ends on its stars centuries from now.
 */

const FIGURE_COLOUR = new THREE.Color('#5f86b8');
const BOUNDARY_COLOUR = new THREE.Color('#7d6f96');
/** Added light: a line over a star brightens it a little rather than covering it. */
const FIGURE_OPACITY = 0.5;
const BOUNDARY_OPACITY = 0.28;
const LABEL_OPACITY = 0.75;

/** The figures are moved again once the clock has gone this many years from where they were. */
const RECOMPUTE_YEARS = 5;

/** Where a name is projected from, scene units ahead of the camera: any distance gives its direction. */
const LABEL_DISTANCE = 1e6;

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uSphereRadius;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uSphereRadius, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor * uOpacity, 1.0);
}
`;

function lineMaterial(colour: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uColor: { value: colour.clone() }, uOpacity: { value: 0 }, uSphereRadius: { value: SPHERE_RADIUS } },
    // As the stars: light adds, depth is read so a planet passes in front, never written.
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function segments(material: THREE.ShaderMaterial): THREE.LineSegments {
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), material);
  lines.frustumCulled = false;
  return lines;
}

export function Constellations({ store, clock, focus }: { store: EphemerisStore; clock: SimClock; focus: BodyId }) {
  const visible = useViewStore((state) => state.layers.constellations);
  const showLabels = useViewStore((state) => state.layers.labels);
  const { camera, size, gl } = useThree();

  const state = useMemo(() => {
    const figureMaterial = lineMaterial(FIGURE_COLOUR);
    const boundaryMaterial = lineMaterial(BOUNDARY_COLOUR);
    const figures = segments(figureMaterial);
    const boundaries = segments(boundaryMaterial);
    const group = new THREE.Group();
    group.add(boundaries, figures);
    group.visible = false;
    return {
      asked: false,
      catalog: null as ConstellationCatalog | null,
      labels: null as SceneLabels | null,
      names: [] as ConstellationLabel[],
      /** The clock's years from J2000 the figures were last placed for. */
      years: Number.NaN,
      group,
      figures,
      boundaries,
      figureMaterial,
      boundaryMaterial,
      point: new THREE.Vector3(),
    };
  }, []);

  useEffect(
    () => () => {
      state.figures.geometry.dispose();
      state.boundaries.geometry.dispose();
      state.figureMaterial.dispose();
      state.boundaryMaterial.dispose();
      state.labels?.dispose();
      state.labels = null;
    },
    [state],
  );

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const sun = visible ? store.stateRelativeTo('sun', focus, jd) : null;
    const fade =
      sun === null
        ? 0
        : constellationFade(
            Math.hypot(
              camera.position.x * KM_PER_UNIT - sun.position.x,
              camera.position.y * KM_PER_UNIT - sun.position.y,
              camera.position.z * KM_PER_UNIT - sun.position.z,
            ),
          );

    if (fade > 0 && !state.asked) {
      state.asked = true;
      void loadConstellations().then((catalog) => {
        if (catalog === null) return;
        state.catalog = catalog;
        state.boundaries.geometry.setAttribute('position', new THREE.BufferAttribute(boundarySegments(catalog), 3));
        state.names = constellationLabels(catalog);
        state.labels = new SceneLabels(gl.domElement, state.names.map((label) => label.name), 'constellation', 3);
        renderDemand.request();
      });
    }

    const catalog = state.catalog;
    state.group.visible = fade > 0 && catalog !== null;
    if (catalog === null || fade <= 0) {
      state.labels?.hideAll();
      return;
    }

    // The sky at infinity follows the camera: see Starfield.
    state.group.position.copy(camera.position);
    const years = yearsSinceEpoch(jd);
    if (!(Math.abs(years - state.years) < RECOMPUTE_YEARS)) {
      const attribute = state.figures.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (attribute === undefined) {
        state.figures.geometry.setAttribute('position', new THREE.BufferAttribute(figureSegments(catalog, years), 3));
      } else {
        figureSegments(catalog, years, attribute.array as Float32Array);
        attribute.needsUpdate = true;
      }
      state.years = years;
    }
    state.figureMaterial.uniforms['uOpacity']!.value = FIGURE_OPACITY * fade;
    state.boundaryMaterial.uniforms['uOpacity']!.value = BOUNDARY_OPACITY * fade;

    const labels = state.labels;
    if (labels === null) return;
    if (!showLabels) {
      labels.hideAll();
      return;
    }
    camera.updateMatrixWorld();
    state.names.forEach((label, index) => {
      const point = state.point
        .set(label.direction.x, label.direction.y, label.direction.z)
        .multiplyScalar(LABEL_DISTANCE)
        .add(camera.position);
      // The largest and brightest first where two would overlap.
      labels.place(index, point, camera, size, LABEL_OPACITY * fade, 4 - label.rank);
    });
  });

  return <primitive object={state.group} />;
}
