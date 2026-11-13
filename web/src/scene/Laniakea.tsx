import type { BodyId, LaniakeaLandmark } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  basinAt,
  FIELD,
  FIELD_GALAXY_REACH,
  laniakeaGalaxy,
  laniakeaKey,
  laniakeaNames,
  luminosityOf,
  transformPoint,
  type LaniakeaCatalogue,
  type LaniakeaNameIndex,
} from '../core/laniakea.ts';
import {
  centralDensities,
  columnAt,
  GALAXY_COLOR,
  galaxyAxes,
  galaxyExtentPc,
  galaxyHalfLightPc,
  galaxyPositionPc,
  type LocalGroupGalaxy,
} from '../core/localGroup.ts';
import { BULGE_SERSIC_N, volumeClass } from '../core/localVolume.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { LazySource } from '../core/satellites.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { starColor } from './blackbody.ts';
import { nearestMarker, PICK_RADIUS_PX } from './ExoplanetHosts.tsx';
import { galacticDirection } from './galactic.ts';
import { DISC_VOLUME_FRAGMENT, DISC_VOLUME_VERTEX, SERSIC_VOLUME_FRAGMENT, SERSIC_VOLUME_VERTEX, sersicAtlas } from './galaxyColumns.ts';
import { SPRITE_FRAGMENT_GLSL, SPRITE_VERTEX_GLSL, spriteGeometry } from './gaussianSprite.ts';
import { drawIntoGlow, releaseFromGlow } from './glowBuffer.ts';
import { labelSurface } from './isosurface.ts';
import {
  boxMatrix,
  CLICK_SLOP_PX,
  declutterMarks,
  DWARF_FRAGMENT,
  DWARF_VERTEX,
  FAINT_GALAXY_FLOOR,
  formatGalaxyDistance,
  glow,
  MARK_FRAGMENT,
  MARK_VERTEX,
  MIN_SIGMA_PX,
  NEAR_SHARE,
  pointShare,
  RESOLVED_PX,
  TIP_STYLE,
  UNRESOLVED_PX,
  WHITE_MU,
  type Marks,
} from './LocalGroup.tsx';
import { systemStrength } from './markFolding.ts';
import { laniakeaFolds, MARK_HOSTS, pixelsPerRadian as viewPixelsPerRadian, structuresFade, updateMarkHosts } from './markHosts.ts';
import { setMarkerPointer } from './markerPointer.ts';
import { galaxyVisibility } from './MilkyWay.tsx';
import { KM_PER_UNIT, LIGHT_YEAR_KM } from './scale.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';
import { SUPERGALACTIC_POLE } from './supergalactic.ts';

/**
 * Laniakea and what lies about it (G3, core/laniakea.ts): 86,899 galaxies out to 700 Mpc, the
 * basin of the flow we are in, the voids and walls -- drawn as the Local Volume's are, and at a
 * cost that does not grow with what is far.
 *
 * ## The galaxies: their light
 *
 * **A point each, holding all its light**, one instanced draw for all of them (gaussianSprite.ts),
 * as a galaxy of the Local Volume is once it is under a few pixels (LocalGroup.tsx): a Gaussian of
 * its half-light radius, never narrower than MIN_SIGMA_PX, its whole luminosity in it, through
 * the one exposure, into the glow buffer, coloured by its B-V through the stars' blackbody. Its
 * share as a point -- pointShare of its half-light radius on the screen -- is worked out on the
 * GPU, so the CPU touches none of the 86,899 a frame. Each at least a faint dot in its own colour
 * (LocalGroup.tsx FAINT_GALAXY_FLOOR), as the Local Volume's: one exposure leaves most of them far
 * too faint to see, and the map of where they are is what this catalogue is.
 *
 * **The few the camera is near, volumes**: each frame the galaxies whose half-light radius is
 * over UNRESOLVED_PX on the screen -- a few dozen at most, the camera beside one; from Laniakea's
 * view none -- are made galaxies (laniakea.ts laniakeaGalaxy) and drawn by the Local Volume's
 * instanced paths: a dwarf a Plummer ellipsoid, a disc and its bulge, an elliptical's Sersic
 * columns from the atlas (galaxyColumns.ts), at most VOLUMES_MOST of each kind, the largest on
 * the screen first. Three draws, empty from afar.
 *
 * Where they are is comoving, and how bright is their luminosity there: from the Sun a galaxy
 * at redshift z is brighter here than the sky shows it by 5 log10(1 + z) magnitudes -- 0.06 at
 * Coma, 0.2 at 400 Mpc. The About says so.
 *
 * ## Marks
 *
 * Never 86,899 rings. Each galaxy folds into its group's brightest (markHosts.ts laniakeaFolds),
 * and a group is a mark at all only while its radius is large on the screen -- from
 * SYSTEM_GONE_PX, half of homeName's fold, to SYSTEM_FULL_PX -- and a galaxy of no group only
 * while FIELD_GALAXY_REACH of its half-light radii are: a group far off is its light, and comes
 * in, marks and all, as the camera nears it. A named cluster's galaxies fold into the cluster's
 * mark, a body of its own (laniakea.ts ensureStructureBodies), which with every named structure
 * is marked and named by the scene's bodies' own marks and labels. Decluttered most luminous
 * first, as the Local Volume's (LocalGroup.tsx declutterMarks).
 *
 * ## The basin
 *
 * Laniakea's boundary as the Cosmicflows-4 galaxies' watersheds draw it (Dupuy & Courtois 2023,
 * basins.bin), a surface netted from the grid (isosurface.ts), faint and lit at its rim so it
 * reads as an outline and not a wall: the Basins layer. And the groups' reconstruction's
 * answer beside it, where the Milky Way's flow ends at Shapley and Laniakea is a part of
 * Shapley's basin (Valade et al. 2024 find the data slightly prefer it): the Shapley Basin
 * layer. Neither is drawn as the truth; the About and the panels say both.
 *
 * ## Voids and walls
 *
 * Tully et al. 2019's voids as ellipsoids of their rough extents along the supergalactic axes,
 * outlined as the basin is; the walls as lines along their paths. Faint, with the structures'
 * names, and only once out of the Local Group (markHosts.ts structuresFade).
 */

/** Where the catalogue is fetched, light years from the Sun: past the Local Group's view (8 million), before the Local Volume's (100 million). */
export const LANIAKEA_FROM_LY = 30e6;

/** The most volumes of each kind drawn at once: the largest on the screen first. */
export const VOLUMES_MOST = 192;

/**
 * An outline's opacity where its surface is seen edge-on, and through its face: a basin's, and
 * a void's fainter. Seen face-on a surface is almost nothing, so where a basin wraps round the
 * camera it does not fill the frame; its rim is the line it draws.
 */
export const BASIN_RIM = 0.12;
export const BASIN_FACE = 0.006;
export const VOID_RIM = 0.09;
export const VOID_FACE = 0.003;
/**
 * A basin's outline seen from inside it, its share: from within, its rim wraps the sky in
 * long arcs that say nothing of its shape, so it is drawn this much as strong there.
 */
export const OUTLINE_INSIDE = 0.25;

/**
 * How near the camera a surface fades out, pc: gone within half of it, whole past it. A
 * surface beside the camera is seen edge-on across half the frame, a sweep that says nothing
 * of the basin's shape: a basin's within 60 Mpc, a void's within 10.
 */
export const BASIN_NEAR_PC = 60e6;
export const VOID_NEAR_PC = 10e6;
/**
 * A wall's line fades as the camera comes within this of it, pc, gone at half of it: the CfA2
 * wall's line runs 23 Mpc behind the Coma Cluster, across the frame of any view of it.
 */
export const WALL_NEAR_PC = 50e6;

/** The rim's sharpness: (1 - |n.v|)^RIM_POWER, a thin line where the surface turns away. */
export const RIM_POWER = 5;

/** The colours of Laniakea's outline (its map's gold), Shapley's (a blue apart from it), the voids' and the walls'. */
export const LANIAKEA_OUTLINE_COLOR = '#e8b45a';
export const SHAPLEY_OUTLINE_COLOR = '#6fa8d8';
export const VOID_COLOR = '#8a8f9e';
export const WALL_COLOR = '#d9c38e';

/** The supergalactic axes, scene frame: SGX towards galactic longitude 137.37 in the Galactic plane, SGZ the pole. */
export const SUPERGALACTIC_X = galacticDirection(137.37, 0);
export const SUPERGALACTIC_Z = SUPERGALACTIC_POLE;
export const SUPERGALACTIC_Y = {
  x: SUPERGALACTIC_Z.y * SUPERGALACTIC_X.z - SUPERGALACTIC_Z.z * SUPERGALACTIC_X.y,
  y: SUPERGALACTIC_Z.z * SUPERGALACTIC_X.x - SUPERGALACTIC_Z.x * SUPERGALACTIC_X.z,
  z: SUPERGALACTIC_Z.x * SUPERGALACTIC_X.y - SUPERGALACTIC_Z.y * SUPERGALACTIC_X.x,
};

/**
 * A galaxy's half-light radius on the sky, pc, from its record, as galaxyHalfLightPc reads its
 * model (laniakeaGalaxy): a disc's the record's; an ellipsoid's the geometric mean of its axes.
 * 0 where no size is known: a point always.
 */
export function recordHalfLightPc(records: Float32Array, k: number): number {
  const at = k * 12;
  const re = records[at + FIELD.rePc]!;
  if (!(re > 0)) return 0;
  const t = records[at + FIELD.t]!;
  const absV = records[at + FIELD.absV]!;
  const kind = volumeClass(Number.isNaN(t) ? null : t, null, Number.isNaN(absV) ? null : absV);
  if (kind === 'disc') return re;
  const pa = records[at + FIELD.pa]!;
  const q = records[at + FIELD.q]!;
  const ratio = Number.isNaN(pa) ? 1 : Math.min(1, Math.max(0.05, Number.isNaN(q) ? 1 : q));
  return re * Math.sqrt(ratio);
}

const POINT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uFade;
attribute vec3 aCentre;
attribute vec3 aLight;
attribute float aHalfLightPc;
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_VERTEX_GLSL}

void main() {
  vec3 rel = aCentre - uCameraPc;
  float distancePc = length(rel);
  float halfLightPx = aHalfLightPc / distancePc * uPixelsPerRadian;
  // pointShare (LocalGroup.tsx), here: what its volume does not draw.
  float t = clamp((halfLightPx - ${UNRESOLVED_PX.toFixed(2)}) / ${(RESOLVED_PX - UNRESOLVED_PX).toFixed(2)}, 0.0, 1.0);
  float share = 1.0 - t * t * (3.0 - 2.0 * t);
  float sigmaPx = max(${MIN_SIGMA_PX.toFixed(2)}, halfLightPx / 1.1774);
  float sigmaPc = sigmaPx / uPixelsPerRadian * distancePc;
  vPeak = aLight * share * uFade / (6.2831853 * sigmaPc * sigmaPc);
  vec3 hue = aLight / max(dot(aLight, vec3(0.2126, 0.7152, 0.0722)), 1e-30);
  vPeak = max(vPeak, hue * ${FAINT_GALAXY_FLOOR.toPrecision(6)} * share * uFade);
  vSigmaPx = sigmaPx;
  gl_Position = spriteCorner(projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0), spriteRadiusPx(vPeak, sigmaPx));
  #include <logdepthbuf_vertex>
}
`;

const POINT_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_FRAGMENT_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = spriteLight(vPeak, vSigmaPx);
}
`;

/** An outline: positions and normals in parsecs about the Sun, its rim drawn, its face nearly not. */
const OUTLINE_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
varying vec3 vNormal;
varying vec3 vRel;

void main() {
  vec3 rel = position - uCameraPc;
  vRel = rel;
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const OUTLINE_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRim;
uniform float uFace;
uniform float uNearPc;
varying vec3 vNormal;
varying vec3 vRel;

void main() {
  #include <logdepthbuf_fragment>
  float facing = abs(dot(normalize(vNormal), normalize(vRel)));
  float rim = pow(1.0 - facing, ${RIM_POWER.toFixed(1)});
  float near = smoothstep(0.5 * uNearPc, uNearPc, length(vRel));
  float alpha = uOpacity * near * (uFace + (uRim - uFace) * rim);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const LINE_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4((position - uCameraPc) * uUnitsPerPc, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const LINE_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

/** A basin's surface (isosurface.ts) in parsecs about the Sun, its normals worked out there. */
export function basinGeometry(
  labels: Uint8Array,
  size: readonly [number, number, number],
  label: number,
  voxelToScene: readonly number[],
): THREE.BufferGeometry | null {
  const mesh = labelSurface(labels, size, label);
  if (mesh === null) return null;
  const positions = new Float32Array(mesh.positions.length);
  for (let v = 0; v < mesh.positions.length; v += 3) {
    const p = transformPoint(voxelToScene, [mesh.positions[v]!, mesh.positions[v + 1]!, mesh.positions[v + 2]!]);
    positions.set(p, v);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** A void as an ellipsoid of its extents along the supergalactic axes, in parsecs about the Sun. */
export function voidGeometry(landmark: LaniakeaLandmark): THREE.BufferGeometry | null {
  const extent = landmark.extentPc;
  if (extent === null) return null;
  const sphere = new THREE.SphereGeometry(1, 48, 24);
  const position = sphere.getAttribute('position') as THREE.BufferAttribute;
  const normal = sphere.getAttribute('normal') as THREE.BufferAttribute;
  const [a, b, c] = extent.map((e) => e / 2) as [number, number, number];
  const X = SUPERGALACTIC_X;
  const Y = SUPERGALACTIC_Y;
  const Z = SUPERGALACTIC_Z;
  for (let i = 0; i < position.count; i += 1) {
    const u = position.getX(i) * a;
    const v = position.getY(i) * b;
    const w = position.getZ(i) * c;
    position.setXYZ(i, landmark.x + u * X.x + v * Y.x + w * Z.x, landmark.y + u * X.y + v * Y.y + w * Z.y, landmark.z + u * X.z + v * Y.z + w * Z.z);
    // An ellipsoid's normal: the sphere's divided by its axes.
    const nu = normal.getX(i) / a;
    const nv = normal.getY(i) / b;
    const nw = normal.getZ(i) / c;
    const n = Math.hypot(nu, nv, nw);
    normal.setXYZ(
      i,
      (nu * X.x + nv * Y.x + nw * Z.x) / n,
      (nu * X.y + nv * Y.y + nw * Z.y) / n,
      (nu * X.z + nv * Y.z + nw * Z.z) / n,
    );
  }
  return sphere;
}

export interface LaniakeaProps {
  readonly source: LazySource<LaniakeaCatalogue>;
  readonly names: LazySource<LaniakeaNameIndex>;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The Laniakea layer: the galaxies, the voids and walls. */
  readonly visible: boolean;
  /** The Icons layer: the galaxies' marks. */
  readonly showMarks: boolean;
  /** The Basins layer: Laniakea's outline; and the groups' reconstruction's Shapley basin. */
  readonly showBasin: boolean;
  readonly showShapley: boolean;
  /** A galaxy's mark clicked: its record. */
  readonly onPick: (k: number) => void;
}

const noRaycast = (): void => {};
const scratchMatrix = new THREE.Matrix4();
const scratchSize = new THREE.Vector2();

/** A galaxy drawn as a volume: what its instance needs, worked out once. */
interface VolumeFixed {
  readonly kind: 'plummer' | 'disc' | 'sersic';
  readonly centre: { x: number; y: number; z: number };
  readonly axes: ReturnType<typeof galaxyAxes>;
  readonly extent: readonly [number, number, number];
  readonly shape: readonly [number, number, number];
  readonly bulge: readonly [number, number, number];
  readonly halfLightPc: number;
  readonly glow: THREE.Vector3;
}

function volumeFixed(galaxy: LocalGroupGalaxy, layerOf: (n: number) => number): VolumeFixed | null {
  const model = galaxy.model;
  const densities = centralDensities(galaxy);
  const extent = galaxyExtentPc(galaxy, columnAt(WHITE_MU));
  const halfLightPc = galaxyHalfLightPc(galaxy);
  if (model === null || densities === null || extent === null || halfLightPc === null) return null;
  if (model.kind === 'exponential-ellipsoid') return null;
  let axes = galaxyAxes(galaxy);
  if (model.kind !== 'plummer') {
    // Right-handed, as LocalGroup.tsx's instanced volumes.
    const { u, v, w } = axes;
    if (u.x * (v.y * w.z - v.z * w.y) + u.y * (v.z * w.x - v.x * w.z) + u.z * (v.x * w.y - v.y * w.x) < 0) {
      axes = { u, v, w: { x: -w.x, y: -w.y, z: -w.z } };
    }
  }
  const bulge = model.kind === 'disc' ? model.bulge : null;
  return {
    kind: model.kind,
    centre: galaxyPositionPc(galaxy),
    axes,
    extent,
    shape:
      model.kind === 'disc'
        ? [model.scaleLengthPc, model.scaleHeightPc, 0]
        : [model.majorPc, model.minorPc, model.depthPc],
    bulge:
      bulge === null
        ? [0, 0, layerOf(BULGE_SERSIC_N)]
        : [bulge.effectiveRadiusPc, densities.bulge / densities.main, layerOf(bulge.sersicN)],
    halfLightPc,
    glow: glow(galaxy, densities.main),
  };
}

export function Laniakea({ source, names, store, clock, focus, visible, showMarks, showBasin, showShapley, onPick }: LaniakeaProps) {
  const { gl, camera } = useThree();
  const catalogue = useSyncExternalStore(source.subscribe, () => source.value);
  const nameIndex = useSyncExternalStore(names.subscribe, () => names.value);
  const version = useStoreVersion(store);
  const group = useMemo(() => new THREE.Group(), []);
  const requested = useRef(false);
  const frame = useRef({ cameraPc: new THREE.Vector3(), markFade: 0 });
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const namesRef = useRef(nameIndex);
  namesRef.current = nameIndex;

  // ---- The points: every galaxy, one draw.
  const pointUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraPc: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelsPerRadian: { value: 1 },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uFade: { value: 0 },
    }),
    [],
  );
  const points = useMemo(() => {
    if (catalogue === null) return null;
    const { count, records } = catalogue;
    const centre = new Float32Array(count * 3);
    const light = new Float32Array(count * 3);
    const halfLight = new Float32Array(count);
    const white = columnAt(WHITE_MU);
    for (let k = 0; k < count; k += 1) {
      const at = k * 12;
      centre[k * 3] = records[at]!;
      centre[k * 3 + 1] = records[at + 1]!;
      centre[k * 3 + 2] = records[at + 2]!;
      const bv = records[at + FIELD.bv]!;
      const [r, g, b] = starColor(Number.isNaN(bv) ? 0.8 : bv);
      // No V measured: no light to draw, but its faint dot (FAINT_GALAXY_FLOOR), in its colour.
      const l = luminosityOf(catalogue, k) / white || 1e-20;
      light[k * 3] = r * l;
      light[k * 3 + 1] = g * l;
      light[k * 3 + 2] = b * l;
      halfLight[k] = recordHalfLightPc(records, k);
    }
    const geometry = spriteGeometry(count);
    geometry.setAttribute('aCentre', new THREE.InstancedBufferAttribute(centre, 3));
    geometry.setAttribute('aLight', new THREE.InstancedBufferAttribute(light, 3));
    geometry.setAttribute('aHalfLightPc', new THREE.InstancedBufferAttribute(halfLight, 1));
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
    drawIntoGlow(object);
    return { object, halfLight };
  }, [catalogue, pointUniforms]);

  // ---- The volumes: the few galaxies near enough, three instanced draws.
  const atlas = useMemo(() => sersicAtlas([BULGE_SERSIC_N]), []);
  useEffect(() => () => atlas.texture.dispose(), [atlas]);
  const volumeUniforms = useMemo(
    () => ({ uFade: { value: 0 }, uSersic: { value: atlas.texture }, uSersicLayers: { value: atlas.layers } }),
    [atlas],
  );
  const dwarfUniforms = useMemo(() => ({ uFade: { value: 0 } }), []);
  const volumes = useMemo(() => {
    const instanced = (vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>, attributes: Record<string, number>) => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const made: Record<string, THREE.InstancedBufferAttribute> = {};
      for (const [name, width] of Object.entries(attributes)) {
        const attribute = new THREE.InstancedBufferAttribute(new Float32Array(VOLUMES_MOST * width), width);
        attribute.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute(name, attribute);
        made[name] = attribute;
      }
      const mesh = new THREE.InstancedMesh(
        geometry,
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          toneMapped: false,
        }),
        VOLUMES_MOST,
      );
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.raycast = noRaycast;
      drawIntoGlow(mesh);
      return { mesh, attributes: made };
    };
    const columns = { aCam: 3, aExtent: 3, aGlow: 3, aShape: 4, aBulge: 3 };
    return {
      disc: instanced(DISC_VOLUME_VERTEX, DISC_VOLUME_FRAGMENT, volumeUniforms, columns),
      sersic: instanced(SERSIC_VOLUME_VERTEX, SERSIC_VOLUME_FRAGMENT, volumeUniforms, columns),
      plummer: instanced(DWARF_VERTEX, DWARF_FRAGMENT, dwarfUniforms, { aM0: 3, aM1: 3, aM2: 3, aU0: 3, aGlow: 3, aNear: 1 }),
    };
  }, [volumeUniforms, dwarfUniforms]);
  // Each galaxy made a volume once, kept while the catalogue is.
  const fixedCache = useMemo(() => new Map<number, VolumeFixed | null>(), [catalogue]);

  // ---- The marks.
  const markUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraPc: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color().setStyle(GALAXY_COLOR, THREE.LinearSRGBColorSpace) },
      uFade: { value: 0 },
    }),
    [],
  );
  const marks = useMemo(() => {
    if (catalogue === null) return null;
    const { count, records } = catalogue;
    const position = new Float32Array(count * 3);
    const centres: { x: number; y: number; z: number }[] = [];
    for (let k = 0; k < count; k += 1) {
      position[k * 3] = records[k * 12]!;
      position[k * 3 + 1] = records[k * 12 + 1]!;
      position[k * 3 + 2] = records[k * 12 + 2]!;
      centres.push({ x: records[k * 12]!, y: records[k * 12 + 1]!, z: records[k * 12 + 2]! });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    const shown = new THREE.BufferAttribute(new Float32Array(count), 1);
    shown.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('shown', shown);
    const folds = laniakeaFolds(catalogue);
    const value = new Float32Array(count);
    const object = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: markUniforms,
        vertexShader: MARK_VERTEX,
        fragmentShader: MARK_FRAGMENT,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    object.frustumCulled = false;
    object.raycast = noRaycast;
    // The records are most luminous first: the declutter's order is theirs.
    const order = Array.from({ length: count }, (_, k) => k);
    const set: Marks = {
      centres,
      shown,
      order,
      body: new Uint8Array(count),
      kept: new Uint8Array(count).fill(1),
      folds: { host: folds.host, separationPc: folds.separationPc, value },
    };
    // A galaxy of no group: a place of its own within FIELD_GALAXY_REACH half-light radii.
    const reachPc = new Float32Array(count);
    for (let k = 0; k < count; k += 1) {
      reachPc[k] = FIELD_GALAXY_REACH * Math.max(1000, records[k * 12 + FIELD.rePc]! || 0);
    }
    return { object, set, folds, value, reachPc };
  }, [catalogue, markUniforms]);

  // A galaxy made a body has its body's mark and name: its own steps aside.
  useEffect(() => {
    void version;
    if (marks === null) return;
    marks.set.body.fill(0);
    for (const body of store.bodies) {
      if (body.kind !== 'galaxy' || !body.id.startsWith('galaxy-lk-')) continue;
      const k = Number(body.id.slice('galaxy-lk-'.length));
      if (Number.isInteger(k) && k >= 0 && k < marks.set.body.length) marks.set.body[k] = 1;
    }
    renderDemand.request();
  }, [marks, store, version]);

  // ---- The outlines: Laniakea's basin, Shapley's, the voids; the walls.
  const outlineMaterial = (color: string, rim: number, face: number, nearPc: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uCameraPc: { value: new THREE.Vector3() },
        uUnitsPerPc: { value: UNITS_PER_PC },
        uColor: { value: new THREE.Color().setStyle(color, THREE.LinearSRGBColorSpace) },
        uOpacity: { value: 0 },
        uRim: { value: rim },
        uFace: { value: face },
        uNearPc: { value: nearPc },
      },
      vertexShader: OUTLINE_VERTEX,
      fragmentShader: OUTLINE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  const [basinMeshes, setBasinMeshes] = useState<{ laniakea: THREE.Mesh | null; shapley: THREE.Mesh | null } | null>(null);
  const wantBasins = showBasin || showShapley;
  useEffect(() => {
    if (catalogue === null || catalogue.basins === null || !wantBasins || basinMeshes !== null) return;
    // Netted once, after the frame that asked: a few tens of milliseconds for the two.
    const handle = window.setTimeout(() => {
      const basins = catalogue.basins!;
      const info = catalogue.info.basins;
      const make = (grid: 'galaxiesAttraction' | 'groupsAttraction', name: string, color: string) => {
        const label = info.basins.find((b) => b.grid === grid && b.name === name)?.label;
        const geometry = label === undefined ? null : basinGeometry(basins.grids[grid], basins.size, label, basins.voxelToScene);
        if (geometry === null) return null;
        const mesh = new THREE.Mesh(geometry, outlineMaterial(color, BASIN_RIM, BASIN_FACE, BASIN_NEAR_PC));
        mesh.frustumCulled = false;
        mesh.raycast = noRaycast;
        mesh.renderOrder = 1;
        return mesh;
      };
      setBasinMeshes({
        laniakea: make('galaxiesAttraction', 'Laniakea', LANIAKEA_OUTLINE_COLOR),
        // The groups' reconstruction: the basin the Milky Way's voxel is in there (info.home), Shapley's.
        shapley: make('groupsAttraction', 'Shapley', SHAPLEY_OUTLINE_COLOR),
      });
      renderDemand.request();
    }, 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, wantBasins, basinMeshes]);

  const structures = useMemo(() => {
    if (catalogue === null) return null;
    const voids: THREE.Mesh[] = [];
    const walls: THREE.Line[] = [];
    for (const landmark of catalogue.info.landmarks) {
      if (landmark.kind === 'void') {
        const geometry = voidGeometry(landmark);
        if (geometry === null) continue;
        const mesh = new THREE.Mesh(geometry, outlineMaterial(VOID_COLOR, VOID_RIM, VOID_FACE, VOID_NEAR_PC));
        mesh.frustumCulled = false;
        mesh.raycast = noRaycast;
        voids.push(mesh);
      } else if (landmark.kind === 'wall' && landmark.path !== null && landmark.path.length > 1) {
        // A smooth curve through its points, as the wall is drawn in its papers.
        const curve = new THREE.CatmullRomCurve3(landmark.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
        const line = new THREE.Line(
          geometry,
          new THREE.ShaderMaterial({
            uniforms: {
              uCameraPc: { value: new THREE.Vector3() },
              uUnitsPerPc: { value: UNITS_PER_PC },
              uColor: { value: new THREE.Color().setStyle(WALL_COLOR, THREE.LinearSRGBColorSpace) },
              uOpacity: { value: 0 },
            },
            vertexShader: LINE_VERTEX,
            fragmentShader: LINE_FRAGMENT,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        line.frustumCulled = false;
        line.raycast = noRaycast;
        line.userData['points'] = curve.getPoints(64);
        walls.push(line);
      }
    }
    return { voids, walls };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue]);

  useEffect(() => {
    const objects: THREE.Object3D[] = [volumes.disc.mesh, volumes.sersic.mesh, volumes.plummer.mesh];
    if (points !== null) objects.push(points.object);
    if (marks !== null) objects.push(marks.object);
    if (structures !== null) objects.push(...structures.voids, ...structures.walls);
    if (basinMeshes?.laniakea) objects.push(basinMeshes.laniakea);
    if (basinMeshes?.shapley) objects.push(basinMeshes.shapley);
    group.add(...objects);
    renderDemand.request();
    return () => {
      group.remove(...objects);
    };
  }, [group, volumes, points, marks, structures, basinMeshes]);

  // Disposed with what made them.
  useEffect(() => () => {
    if (points === null) return;
    releaseFromGlow(points.object);
    points.object.geometry.dispose();
    (points.object.material as THREE.Material).dispose();
  }, [points]);
  useEffect(() => () => {
    for (const { mesh } of Object.values(volumes)) {
      releaseFromGlow(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }, [volumes]);
  useEffect(() => () => {
    if (marks === null) return;
    marks.object.geometry.dispose();
    (marks.object.material as THREE.Material).dispose();
  }, [marks]);
  useEffect(() => () => {
    if (structures === null) return;
    for (const object of [...structures.voids, ...structures.walls]) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  }, [structures]);
  useEffect(() => () => {
    for (const mesh of [basinMeshes?.laniakea, basinMeshes?.shapley]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }, [basinMeshes]);

  // Scratch for the frame: the volumes drawn this frame.
  const resolved = useMemo(() => ({ k: [] as number[], px: [] as number[] }), []);

  useFrame(({ camera: frameCamera, gl: renderer }) => {
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
    if (sun === null) {
      group.visible = false;
      frame.current.markFade = 0;
      return;
    }
    const cameraPc = frame.current.cameraPc.set(
      (frameCamera.position.x * KM_PER_UNIT - sun.position.x) / PARSEC_KM,
      (frameCamera.position.y * KM_PER_UNIT - sun.position.y) / PARSEC_KM,
      (frameCamera.position.z * KM_PER_UNIT - sun.position.z) / PARSEC_KM,
    );
    const fromSunKm = cameraPc.length() * PARSEC_KM;
    if (!requested.current && fromSunKm > LANIAKEA_FROM_LY * LIGHT_YEAR_KM) {
      requested.current = true;
      void source.request();
    }
    const fade = visible ? galaxyVisibility(fromSunKm) : 0;
    const structureFade = structuresFade(cameraPc.length());
    const markFade = visible && showMarks ? structureFade : 0;
    frame.current.markFade = markFade;
    group.visible = catalogue !== null && (fade > 0 || structureFade > 0);
    if (!group.visible || catalogue === null) {
      return;
    }
    group.position.copy(frameCamera.position);
    group.updateMatrixWorld();
    const fov = (frameCamera as THREE.PerspectiveCamera).fov;
    const heightPx = renderer.getDrawingBufferSize(scratchSize).y;
    const pixelsPerRadian = heightPx / (2 * Math.tan((fov * Math.PI) / 360));

    // The points.
    if (points !== null) {
      points.object.visible = fade > 0;
      (pointUniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      pointUniforms['uPixelsPerRadian']!.value = pixelsPerRadian;
      renderer.getDrawingBufferSize(pointUniforms['uViewportPx']!.value as THREE.Vector2);
      pointUniforms['uFade']!.value = fade;
    }

    // The volumes: those over UNRESOLVED_PX, the largest first.
    volumeUniforms.uFade.value = fade;
    dwarfUniforms.uFade.value = fade;
    resolved.k.length = 0;
    resolved.px.length = 0;
    if (fade > 0 && points !== null) {
      const { records, count } = catalogue;
      const cx = cameraPc.x;
      const cy = cameraPc.y;
      const cz = cameraPc.z;
      const limit = pixelsPerRadian / UNRESOLVED_PX;
      const halfLight = points.halfLight;
      for (let k = 0; k < count; k += 1) {
        const h = halfLight[k]!;
        if (h === 0) continue;
        const reach = h * limit;
        const dx = records[k * 12]! - cx;
        if (dx > reach || dx < -reach) continue;
        const dy = records[k * 12 + 1]! - cy;
        if (dy > reach || dy < -reach) continue;
        const dz = records[k * 12 + 2]! - cz;
        if (dz > reach || dz < -reach) continue;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < reach * reach) {
          resolved.k.push(k);
          resolved.px.push((h / Math.sqrt(d2)) * pixelsPerRadian);
        }
      }
    }
    const byPx = resolved.k.map((k, i) => [k, resolved.px[i]!] as const).sort((a, b) => b[1] - a[1]);
    const counts = { disc: 0, sersic: 0, plummer: 0 };
    for (const [k] of byPx) {
      let fixed = fixedCache.get(k);
      if (fixed === undefined) {
        fixed = volumeFixed(laniakeaGalaxy(catalogue, k), atlas.layerOf);
        fixedCache.set(k, fixed);
      }
      if (fixed === null || counts[fixed.kind] >= VOLUMES_MOST) continue;
      const rx = fixed.centre.x - cameraPc.x;
      const ry = fixed.centre.y - cameraPc.y;
      const rz = fixed.centre.z - cameraPc.z;
      const distance = Math.hypot(rx, ry, rz);
      const share = 1 - pointShare((fixed.halfLightPc / distance) * pixelsPerRadian);
      if (share <= 0) continue;
      const { u, v, w } = fixed.axes;
      const n = counts[fixed.kind];
      const g = fixed.glow;
      if (fixed.kind === 'plummer') {
        const a = volumes.plummer.attributes;
        const [s0, s1, s2] = fixed.shape;
        a['aM0']!.setXYZ(n, u.x / s0, u.y / s0, u.z / s0);
        a['aM1']!.setXYZ(n, v.x / s1, v.y / s1, v.z / s1);
        a['aM2']!.setXYZ(n, w.x / s2, w.y / s2, w.z / s2);
        a['aGlow']!.setXYZ(n, g.x * share, g.y * share, g.z * share);
        a['aNear']!.setX(n, Math.max(NEAR_SHARE * distance, 0.5 * s0));
        a['aU0']!.setXYZ(
          n,
          -(rx * u.x + ry * u.y + rz * u.z) / s0,
          -(rx * v.x + ry * v.y + rz * v.z) / s1,
          -(rx * w.x + ry * w.y + rz * w.z) / s2,
        );
        volumes.plummer.mesh.setMatrixAt(n, boxMatrix(fixed.axes, fixed.extent, { x: rx, y: ry, z: rz }, scratchMatrix));
      } else {
        const a = volumes[fixed.kind].attributes;
        a['aCam']!.setXYZ(n, -(rx * u.x + ry * u.y + rz * u.z), -(rx * v.x + ry * v.y + rz * v.z), -(rx * w.x + ry * w.y + rz * w.z));
        a['aExtent']!.setXYZ(n, fixed.extent[0], fixed.extent[1], fixed.extent[2]);
        a['aGlow']!.setXYZ(n, g.x * share, g.y * share, g.z * share);
        const near = Math.max(NEAR_SHARE * distance, 0.5 * fixed.shape[0]);
        if (fixed.kind === 'disc') a['aShape']!.setXYZW(n, fixed.shape[0], fixed.shape[1], near, 0);
        else a['aShape']!.setXYZW(n, fixed.shape[0], fixed.shape[1], fixed.shape[2], near);
        a['aBulge']!.setXYZ(n, fixed.bulge[0], fixed.bulge[1], fixed.bulge[2]);
        volumes[fixed.kind].mesh.setMatrixAt(n, boxMatrix(fixed.axes, fixed.extent, { x: rx, y: ry, z: rz }, scratchMatrix));
      }
      counts[fixed.kind] = n + 1;
    }
    for (const kind of ['disc', 'sersic', 'plummer'] as const) {
      const { mesh, attributes } = volumes[kind];
      mesh.count = counts[kind];
      mesh.visible = counts[kind] > 0;
      if (counts[kind] > 0) {
        for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    // The outlines and the walls, faint, with the structures.
    const outline = (object: THREE.Object3D | null | undefined, opacity: number) => {
      if (!object) return;
      object.visible = opacity > 0;
      const uniforms = ((object as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      (uniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      uniforms['uOpacity']!.value = opacity;
    };
    const inside = (grid: 'galaxiesAttraction' | 'groupsAttraction', name: string): number => {
      const basins = catalogue.basins;
      const label = catalogue.info.basins.basins.find((b) => b.grid === grid && b.name === name)?.label;
      return basins !== null && label !== undefined && basinAt(basins, grid, [cameraPc.x, cameraPc.y, cameraPc.z]) === label
        ? OUTLINE_INSIDE
        : 1;
    };
    outline(basinMeshes?.laniakea, showBasin ? structureFade * inside('galaxiesAttraction', 'Laniakea') : 0);
    outline(basinMeshes?.shapley, showShapley ? structureFade * inside('groupsAttraction', 'Shapley') : 0);
    for (const mesh of structures?.voids ?? []) outline(mesh, visible ? structureFade : 0);
    for (const line of structures?.walls ?? []) {
      // Faded as the camera comes near it: beside Coma the CfA2 wall is a line across the frame.
      let nearest = Infinity;
      for (const p of line.userData['points'] as THREE.Vector3[]) {
        nearest = Math.min(nearest, Math.hypot(p.x - cameraPc.x, p.y - cameraPc.y, p.z - cameraPc.z));
      }
      const t = Math.min(1, Math.max(0, (nearest - WALL_NEAR_PC / 2) / (WALL_NEAR_PC / 2)));
      outline(line, visible ? structureFade * 0.45 * t * t * (3 - 2 * t) : 0);
    }

    // The marks: folded into their groups, present only near (see the header), decluttered.
    if (marks !== null) {
      marks.object.visible = markFade > 0;
      (markUniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      markUniforms['uPixelRatio']!.value = renderer.getPixelRatio();
      markUniforms['uFade']!.value = markFade;
      if (markFade > 0) {
        const element = renderer.domElement;
        const cssPerRadian = viewPixelsPerRadian(element.clientHeight, fov);
        updateMarkHosts([cameraPc.x, cameraPc.y, cameraPc.z], cssPerRadian, focus);
        const { records, count } = catalogue;
        const own = marks.folds.marks;
        const host = marks.folds.host;
        const separation = marks.folds.separationPc;
        const value = marks.value;
        const focusIndex = focus.startsWith('galaxy-lk-') ? Number(focus.slice('galaxy-lk-'.length)) : -1;
        for (let k = 0; k < count; k += 1) {
          let s: number;
          if (k === focusIndex) {
            s = 1;
          } else if (own[k]! >= 0) {
            s = MARK_HOSTS.strength[own[k]!] ?? 0;
          } else if (host[k]! >= 0) {
            s = MARK_HOSTS.member(host[k]!, separation[k]!);
          } else {
            const d = Math.hypot(records[k * 12]! - cameraPc.x, records[k * 12 + 1]! - cameraPc.y, records[k * 12 + 2]! - cameraPc.z);
            s = systemStrength((marks.reachPc[k]! / d) * cssPerRadian);
          }
          value[k] = s;
        }
        declutterMarks(marks.set, frameCamera, cameraPc, element.clientWidth, element.clientHeight);
      }
    }
  });

  // Pointing and clicking a galaxy's mark, as the Local Volume's.
  useEffect(() => {
    if (marks === null) return;
    const element = gl.domElement;
    const tip = document.createElement('div');
    Object.assign(tip.style, TIP_STYLE);
    element.parentElement?.appendChild(tip);
    const count = marks.set.centres.length;
    const screen = new Float64Array(count * 2);
    const scratch = new THREE.Vector3();
    const inverse = new THREE.Quaternion();
    const project = (): void => {
      const { cameraPc } = frame.current;
      camera.updateMatrixWorld();
      inverse.copy(camera.quaternion).invert();
      const e = camera.projectionMatrix.elements;
      const rect = element.getBoundingClientRect();
      const shown = marks.set.shown;
      for (let i = 0; i < count; i += 1) {
        if (shown.getX(i) < 0.5) {
          screen[i * 2] = Number.NaN;
          screen[i * 2 + 1] = Number.NaN;
          continue;
        }
        const centre = marks.set.centres[i]!;
        scratch.set(centre.x - cameraPc.x, centre.y - cameraPc.y, centre.z - cameraPc.z).applyQuaternion(inverse);
        const depth = -scratch.z;
        screen[i * 2] = depth > 0 ? ((e[0]! * scratch.x) / depth + 1) * 0.5 * rect.width : Number.NaN;
        screen[i * 2 + 1] = depth > 0 ? (1 - (e[5]! * scratch.y) / depth) * 0.5 * rect.height : Number.NaN;
      }
    };
    const pick = (event: PointerEvent): number | null => {
      if (frame.current.markFade < 0.05) return null;
      project();
      const rect = element.getBoundingClientRect();
      return nearestMarker(screen, event.clientX - rect.left, event.clientY - rect.top, PICK_RADIUS_PX);
    };
    let down: { x: number; y: number } | null = null;
    let waiting = false;
    let lastMove: PointerEvent | null = null;
    const setPointing = (on: boolean): void => setMarkerPointer(element, 'laniakea', on);
    const onDown = (event: PointerEvent): void => {
      down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event: PointerEvent): void => {
      const start = down;
      down = null;
      if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
      const k = pick(event);
      if (k !== null) {
        tip.style.display = 'none';
        pickRef.current(k);
      }
    };
    const hover = (): void => {
      waiting = false;
      const event = lastMove;
      if (event === null) return;
      const k = down === null ? pick(event) : null;
      setPointing(k !== null);
      if (k === null) {
        tip.style.display = 'none';
        return;
      }
      // The names come with the first galaxy pointed at.
      void names.request();
      const name = namesRef.current?.names.name[k] ?? laniakeaNames()?.names.name[k] ?? null;
      const c = marks.set.centres[k]!;
      const distance = formatGalaxyDistance(Math.hypot(c.x, c.y, c.z));
      tip.textContent = name === null ? distance : `${name} · ${distance}`;
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
  }, [marks, gl, camera, names]);

  return <primitive object={group} />;
}

/** A galaxy's body id from its record, as laniakea.ts keys it. */
export function laniakeaBodyId(k: number): BodyId {
  return `galaxy-${laniakeaKey(k)}`;
}
