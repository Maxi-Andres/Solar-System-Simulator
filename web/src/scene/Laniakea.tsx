import { LANIAKEA_FLAGS, type BodyId, type LaniakeaLandmark } from '@sss/tools/types';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import { basinChipShown, basinOutlines, type BasinOutline } from '../core/basinChips.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  basinAt,
  FIELD,
  structureOf,
  FIELD_GALAXY_REACH,
  laniakeaGalaxy,
  laniakeaNames,
  luminosityOf,
  transformPoint,
  type BasinGrids,
  type FlowLines,
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
import { FLOOR_THIN_GLSL, floorKept, halfCountRadiusPc } from './crowding.ts';
import { nearestMarker, PICK_RADIUS_PX } from './ExoplanetHosts.tsx';
import { galacticDirection } from './galactic.ts';
import { DISC_VOLUME_FRAGMENT, DISC_VOLUME_VERTEX, SERSIC_VOLUME_FRAGMENT, SERSIC_VOLUME_VERTEX, sersicAtlas } from './galaxyColumns.ts';
import { SPRITE_FRAGMENT_GLSL, SPRITE_VERTEX_GLSL, spriteGeometry } from './gaussianSprite.ts';
import { drawIntoGlow, releaseFromGlow } from './glowBuffer.ts';
import { homeNames } from './homeName.ts';
import { basinPartsAhead, basinPartsGeometry, type BasinParts, type BasinRequest } from './laniakeaBasins.ts';
import {
  boxMatrix,
  CLICK_SLOP_PX,
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
} from './LocalGroup.tsx';
import { MarkState, laniakeaMarkIndex } from './laniakeaMarks.ts';
import { declutterMarks, type Marks } from './markDeclutter.ts';
import { cellCandidates, pointCells } from './pointCells.ts';
import { GALACTIC_CENTRE_SCENE_PC, laniakeaFolds, MARK_HOSTS, pixelsPerRadian as viewPixelsPerRadian, structuresFade, updateMarkHosts } from './markHosts.ts';
import { setMarkerPointer } from './markerPointer.ts';
import { galaxyVisibility } from './MilkyWay.tsx';
import { KM_PER_UNIT, LIGHT_YEAR_KM } from './scale.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';
import { SUPERGALACTIC_POLE } from './supergalactic.ts';
// Run in the frame where the layer is mounted, though its chunk arrives later: see lazyLayer.tsx.
import { useFrame } from './lazyLayer.tsx';

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
 * first, as the Local Volume's (markDeclutter.ts).
 *
 * ## The basins
 *
 * Every basin of attraction as the Cosmicflows-4 galaxies' watersheds draw it (Dupuy & Courtois
 * 2023, basins.bin) -- Laniakea's and its neighbours' -- each a smoothed surface netted from the
 * grid (isosurface.ts) in its own hue (core/basinChips.ts), faint and lit at its rim so it reads
 * as an outline and not a wall, and its inside a faint glow marched through the blurred grid
 * (FILL_FRAGMENT), so the basin reads as a region and not as crossed sheets: the Basins of
 * Attraction layer, a chip a basin. From inside, both weaker, and nothing within BASIN_NEAR_PC
 * of the camera. And the groups' reconstruction's answer, where the Milky Way's flow ends at
 * Shapley and Laniakea is a part of Shapley's basin (Valade et al. 2024 find the data slightly
 * prefer it): a chip of its own, off at first. Neither is drawn as the truth; the About and the
 * panels say both. Each basin is named and marked at its attractor by its structure body.
 *
 * ## Where the galaxies flow
 *
 * The velocity field's streamlines (core/laniakea.ts FlowLines, tools/src/laniakea/flows.ts): a
 * few dozen ribbons a few pixels wide, splined, tapering to their attractor, a brightening
 * running down each at the field's speed sped up FLOW_GYR_PER_SECOND times: the Flow Lines layer.
 *
 * ## Voids and walls
 *
 * Tully et al. 2019's voids as soft shells of their rough extents along the supergalactic axes,
 * no rim (VOID_FRAGMENT); a wall as its galaxies (the records' WALL_ flags), their dots tinted,
 * brighter while it is the focus, its path a faint hint. Faint, with the structures' names, and
 * only once out of the Local Group (markHosts.ts structuresFade).
 *
 * ## Home
 *
 * "You are here": the Milky Way's mark, two rings, once the Local Volume is a speck
 * (homeName.ts HERE_FOLD_PX), where its name is too.
 */

/** Where the catalogue is fetched, light years from the Sun: past the Local Group's view (8 million), before the Local Volume's (100 million). */
export const LANIAKEA_FROM_LY = 30e6;

/** The most volumes of each kind drawn at once: the largest on the screen first. */
export const VOLUMES_MOST = 192;

/**
 * An outline's opacity where its surface is seen edge-on, and through its face: a basin's.
 * Seen face-on a surface is almost nothing, so where a basin wraps round the camera it does
 * not fill the frame; its rim is the line it draws.
 */
export const BASIN_RIM = 0.12;
export const BASIN_FACE = 0.006;
/**
 * A basin's outline seen from inside it, its share: from within, its rim wraps the sky in
 * long arcs that say nothing of its shape, so it is drawn this much as strong there.
 */
export const OUTLINE_INSIDE = 0.25;

/**
 * How near the camera a surface fades out, pc: gone within half of it, whole past it. A
 * surface beside the camera is seen edge-on across half the frame, a sweep that says nothing
 * of the basin's shape: a basin's within 60 Mpc.
 */
export const BASIN_NEAR_PC = 60e6;
/**
 * A wall's line fades as the camera comes within this of it, pc, gone at half of it: the CfA2
 * wall's line runs 23 Mpc behind the Coma Cluster, across the frame of any view of it.
 */
export const WALL_NEAR_PC = 50e6;

/** The rim's sharpness: (1 - |n.v|)^RIM_POWER, a thin line where the surface turns away. */
export const RIM_POWER = 5;

/** Laniakea's hue (its map's gold) and Shapley's (a blue apart from it), as their outlines' (core/basinChips.ts), for their flow lines; the voids' and the walls'. */
export const LANIAKEA_OUTLINE_COLOR = '#e8b45a';
export const SHAPLEY_OUTLINE_COLOR = '#6fa8d8';
export const VOID_COLOR = '#8a8f9e';
export const WALL_COLOR = '#d9c38e';

/**
 * The flow lines (core/laniakea.ts FlowLines), a few dozen: each a ribbon FLOW_WIDTH_PX wide on
 * the screen, Laniakea's wider and in its outline's gold, any other basin's narrower in a muted
 * grey-blue (Shapley's in its blue); narrowing over its last FLOW_TAPER_PC to its end, the way it
 * flows. A gentle brightening runs down each, one every FLOW_PULSE_GYR of flow, at
 * FLOW_GYR_PER_SECOND of flow a second -- not time as it passes: at 400 km/s a galaxy goes 1 Mpc
 * in 2.4 Gyr, and the brightening 10 Mpc a second. Gone within FLOW_NEAR_PC of the camera.
 */
export const FLOW_OTHER_COLOR = '#7f8899';
export const FLOW_WIDTH_PX = 1.8;
export const FLOW_LANIAKEA_WIDTH_PX = 2.8;
export const FLOW_TAPER_PC = 25e6;
export const FLOW_BASE = 0.32;
export const FLOW_OTHER_BASE = 0.26;
export const FLOW_PULSE = 0.35;
export const FLOW_PULSE_GYR = 80;
export const FLOW_GYR_PER_SECOND = 25;
export const FLOW_NEAR_PC = 8e6;
/** Gyr for a parsec at 1 km/s: a parsec in km over a Gyr in seconds. */
export const GYR_PER_PC_AT_KMS = 3.0857e13 / 3.15576e16;

/**
 * A basin's fill: the steps of the march, the glow a voxel of the basin adds (so a ray through
 * Laniakea's middle, 20 voxels, is about 0.08), and its share from inside the basin, where it
 * is everywhere about the camera.
 */
export const FILL_STEPS = 48;
export const FILL_DENSITY = 0.004;
export const FILL_INSIDE = 0.35;

/** A void's shell begins at this share of its radius; its strength, and from inside it. */
export const VOID_SHELL_FROM = 0.55;
export const VOID_SHELL = 0.07;
export const VOID_INSIDE = 0.4;

/** A wall's line, now a hint under its galaxies (the Laniakea layer's dots, tinted). */
export const WALL_LINE_OPACITY = 0.12;
/** A wall's galaxies' dot, times the faint floor: always, and while the wall is the focus. */
export const WALL_TINT = 0.8;
export const WALL_TINT_FOCUSED = 12;

/** "You are here": its mark's size, pixels, and colour, the folded home name's neutral white (MilkyWay.tsx). */
export const HERE_PX = 18;
export const HERE_COLOR = '#c0c0c0';

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
uniform vec2 uWallTint;
uniform vec3 uWallColor;
attribute vec3 aCentre;
attribute vec3 aLight;
attribute float aHalfLightPc;
attribute float aWall;
attribute float aFloor;
// The floor kept as the catalogue crowds on the screen (crowding.ts floorKept): a patch no brighter
// as they close up, fewer dots once each is under FLOOR_THIN; none once a speck or from far off.
uniform float uFloorKept;
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_VERTEX_GLSL}
${FLOOR_THIN_GLSL}

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
  float kept = floorThinned(uFloorKept, gl_InstanceID);
  vPeak = max(vPeak, hue * ${FAINT_GALAXY_FLOOR.toPrecision(6)} * aFloor * kept * share * uFade);
  // A wall's galaxy (aWall: 1 the Sloan Great Wall's, 2 the CfA2's): its dot tinted, brighter while the wall is the focus.
  float tint = max(mod(aWall, 2.0) * uWallTint.x, step(1.5, aWall) * uWallTint.y);
  vPeak += uWallColor * ${FAINT_GALAXY_FLOOR.toPrecision(6)} * tint * kept * share * uFade;
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

/**
 * A flow line as a ribbon: each vertex twice, either side of the line, pushed apart on the screen
 * across the line's direction there (from the vertices before and after it), so it is as wide in
 * pixels from any distance; its Gyr down the line, its weight, its colour and its width.
 */
const FLOW_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform vec2 uViewportPx;
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aGyr;
attribute float aWeight;
attribute vec3 aColor;
attribute float aWidthPx;
attribute float aToEndPc;
varying float vGyr;
varying float vWeight;
varying vec3 vColor;
varying float vDistancePc;
varying float vSide;

vec2 screen(vec4 clip) {
  return clip.xy / max(clip.w, 1e-20) * 0.5 * uViewportPx;
}

void main() {
  mat4 m = projectionMatrix * modelViewMatrix;
  vec3 rel = position - uCameraPc;
  vec4 clip = m * vec4(rel * uUnitsPerPc, 1.0);
  vec2 a = screen(m * vec4((aPrev - uCameraPc) * uUnitsPerPc, 1.0));
  vec2 b = screen(m * vec4((aNext - uCameraPc) * uUnitsPerPc, 1.0));
  vec2 dir = b - a;
  dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
  // Narrowing to its end, the way it flows.
  float taper = mix(0.15, 1.0, smoothstep(0.0, ${FLOW_TAPER_PC.toExponential(3)}, aToEndPc));
  vec2 offset = vec2(-dir.y, dir.x) * aSide * 0.5 * aWidthPx * taper;
  clip.xy += offset / (0.5 * uViewportPx) * clip.w;
  gl_Position = clip;
  vGyr = aGyr;
  vWeight = aWeight;
  vColor = aColor;
  vDistancePc = length(rel);
  vSide = aSide;
  #include <logdepthbuf_vertex>
}
`;

const FLOW_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uOpacity;
uniform float uClockGyr;
uniform float uNearPc;
varying float vGyr;
varying float vWeight;
varying vec3 vColor;
varying float vDistancePc;
varying float vSide;

void main() {
  #include <logdepthbuf_fragment>
  // A broad brightening, its front where the pattern wraps, which moves downstream.
  float u = fract((vGyr - uClockGyr) / ${FLOW_PULSE_GYR.toFixed(1)});
  float pulse = u * u * u;
  float near = smoothstep(0.5 * uNearPc, uNearPc, vDistancePc);
  float across = 1.0 - vSide * vSide;
  float alpha = uOpacity * vWeight * near * across * (1.0 + ${(FLOW_PULSE / FLOW_BASE).toFixed(3)} * pulse);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

/**
 * A basin's inside, marched: the box of its blurred field (isosurface.ts labelVolume), drawn by
 * its back faces so it is there from inside too; along each ray from the camera, or from where
 * the ray enters the box, to the face, the field summed, and drawn as that much of a glow --
 * thin where the ray grazes the basin, thicker through it. Nothing within uNearVoxels of the
 * camera counts: from inside, the basin about it is not a fog over the galaxies.
 */
const FILL_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform mat4 uVoxelToScene;
uniform vec3 uOrigin;
uniform vec3 uSize;
varying vec3 vVoxel;

void main() {
  vVoxel = uOrigin - 0.5 + position * uSize;
  vec3 scene = (uVoxelToScene * vec4(vVoxel, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4((scene - uCameraPc) * uUnitsPerPc, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FILL_FRAGMENT = /* glsl */ `
precision highp sampler3D;
#include <logdepthbuf_pars_fragment>
uniform sampler3D uField;
uniform vec3 uCameraVoxel;
uniform vec3 uOrigin;
uniform vec3 uSize;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDensity;
uniform float uNearVoxels;
varying vec3 vVoxel;

void main() {
  #include <logdepthbuf_fragment>
  vec3 lo = uOrigin - 0.5;
  vec3 hi = lo + uSize;
  vec3 ray = vVoxel - uCameraVoxel;
  float far = length(ray);
  vec3 dir = ray / far;
  vec3 inv = 1.0 / dir;
  vec3 t0 = (lo - uCameraVoxel) * inv;
  vec3 t1 = (hi - uCameraVoxel) * inv;
  vec3 tmin = min(t0, t1);
  float enter = max(0.0, max(tmin.x, max(tmin.y, tmin.z)));
  const int STEPS = ${FILL_STEPS};
  float dt = max(far - enter, 0.0) / float(STEPS);
  // A step's start moved by a fixed draw per pixel: no bands where the steps line up.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float sum = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float t = enter + (float(i) + jitter) * dt;
    vec3 p = uCameraVoxel + dir * t;
    float f = texture(uField, (p - lo) / uSize).r;
    sum += f * smoothstep(0.5 * uNearVoxels, uNearVoxels, t);
  }
  float alpha = uOpacity * (1.0 - exp(-uDensity * sum * dt));
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/**
 * A void, as its shell: in the unit sphere of its ellipsoid, a ray's path through the shell
 * between VOID_SHELL_FROM of its radius and its edge summed, rising and falling smoothly --
 * an underdense region's soft boundary, with no rim and nothing at its middle.
 */
const VOID_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uCameraPc;
uniform vec3 uCentre;
uniform mat3 uToUnit;
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vRel;

float shell(float r) {
  return smoothstep(${VOID_SHELL_FROM.toFixed(2)}, 0.88, r) * (1.0 - smoothstep(0.88, 1.0, r));
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 o = uToUnit * (uCameraPc - uCentre);
  vec3 d = uToUnit * vRel;
  // Where the ray from the camera enters the unit sphere, as a share of the way to this face.
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float disc = max(b * b - a * c, 0.0);
  float enter = max(0.0, (-b - sqrt(disc)) / a);
  float len = sqrt(a);
  float sum = 0.0;
  const int STEPS = 24;
  float dt = (1.0 - enter) / float(STEPS);
  for (int i = 0; i < STEPS; i++) {
    float t = enter + (float(i) + 0.5) * dt;
    sum += shell(length(o + d * t));
  }
  float alpha = uOpacity * sum * dt * len;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/** "You are here": two rings, one in the other, in the marks' own neutral white: a mark like the others, doubled. */
const HERE_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform float uPixelRatio;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4((position - uCameraPc) * uUnitsPerPc, 1.0);
  gl_PointSize = ${HERE_PX.toFixed(1)} * uPixelRatio;
  #include <logdepthbuf_vertex>
}
`;

const HERE_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uFade;

void main() {
  #include <logdepthbuf_fragment>
  float r = length(gl_PointCoord - 0.5) * ${HERE_PX.toFixed(1)};
  float outer = 1.0 - smoothstep(0.5, 1.2, abs(r - ${(HERE_PX / 2 - 2).toFixed(1)}));
  float inner = 1.0 - smoothstep(0.5, 1.2, abs(r - ${(HERE_PX / 4).toFixed(1)}));
  float alpha = uFade * 0.75 * max(outer, inner);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/**
 * The faint dot every galaxy is given (FAINT_GALAXY_FLOOR: a map aid, not its light), weighted by
 * its neighbours: the galaxies within FLOOR_REACH_PC, FLOOR_FULL_AT of them for the whole dot,
 * FLOOR_LEAST of it alone. In a group or along a filament a galaxy keeps its dot; alone in a void
 * it is fainter, so the web the catalogue holds shows instead of an even dust. Its light -- the
 * sprite of its luminosity -- is never touched. A flux-limited survey thins with distance, so
 * far off fewer are counted about any galaxy, and the far map's dots fade with it.
 */
export const FLOOR_REACH_PC = 4e6;
export const FLOOR_FULL_AT = 8;
export const FLOOR_LEAST = 0.15;
/** Galaxies weighed a tick: some tens of milliseconds. */
export const FLOOR_SLICE = 6000;

/** The galaxies by cell of FLOOR_REACH_PC, for floorWeights: a cell's key its indices packed small. */
export function floorGrid(records: Float32Array, count: number): Map<number, number[]> {
  const grid = new Map<number, number[]>();
  for (let k = 0; k < count; k += 1) {
    const at = k * 12;
    const id = floorCell(Math.floor(records[at]! / FLOOR_REACH_PC), Math.floor(records[at + 1]! / FLOOR_REACH_PC), Math.floor(records[at + 2]! / FLOOR_REACH_PC));
    const list = grid.get(id);
    if (list === undefined) grid.set(id, [k]);
    else list.push(k);
  }
  return grid;
}

/** A cell's key: within 512 cells of the Sun's (2 Gpc) along each axis, packed into a small integer. */
const floorCell = (i: number, j: number, k: number) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);

/** The weights of galaxies `from` to `to` into `out` (see FLOOR_REACH_PC): done a slice at a time. */
export function floorWeights(records: Float32Array, grid: ReadonlyMap<number, readonly number[]>, out: Float32Array, from: number, to: number): void {
  const reach2 = FLOOR_REACH_PC * FLOOR_REACH_PC;
  for (let k = from; k < to; k += 1) {
    const at = k * 12;
    const x = records[at]!;
    const y = records[at + 1]!;
    const z = records[at + 2]!;
    const ci = Math.floor(x / FLOOR_REACH_PC);
    const cj = Math.floor(y / FLOOR_REACH_PC);
    const ck = Math.floor(z / FLOOR_REACH_PC);
    let n = 0;
    for (let dk = -1; dk <= 1 && n < FLOOR_FULL_AT; dk += 1) {
      for (let dj = -1; dj <= 1 && n < FLOOR_FULL_AT; dj += 1) {
        for (let di = -1; di <= 1 && n < FLOOR_FULL_AT; di += 1) {
          const list = grid.get(floorCell(ci + di, cj + dj, ck + dk));
          if (list === undefined) continue;
          for (const j of list) {
            if (j === k) continue;
            const dx = records[j * 12]! - x;
            const dy = records[j * 12 + 1]! - y;
            const dz = records[j * 12 + 2]! - z;
            if (dx * dx + dy * dy + dz * dz < reach2 && (n += 1) >= FLOOR_FULL_AT) break;
          }
        }
      }
    }
    out[k] = FLOOR_LEAST + (1 - FLOOR_LEAST) * Math.min(1, n / FLOOR_FULL_AT);
  }
}

/** How many points of a line's spline there are to each of its vertices. */
export const FLOW_SPLINE = 3;

/**
 * The flow lines as ribbons about the Sun, pc (FLOW_VERTEX): each line a centripetal Catmull-Rom
 * spline through its vertices, FLOW_SPLINE points to a vertex, its speed and weight interpolated
 * along it; with its Gyr down the line, its distance to its end, and its basin's colour, opacity
 * and width.
 */
export function flowGeometry(
  flows: FlowLines,
  styleOf: (basin: number) => { color: THREE.Color; opacity: number; widthPx: number },
): THREE.BufferGeometry {
  const { starts, positions, speeds, weights, basins } = flows;
  const pos: number[] = [];
  const prev: number[] = [];
  const next: number[] = [];
  const side: number[] = [];
  const gyr: number[] = [];
  const weight: number[] = [];
  const color: number[] = [];
  const width: number[] = [];
  const toEnd: number[] = [];
  const index: number[] = [];
  for (let l = 0; l < flows.lines; l += 1) {
    const first = starts[l]!;
    const count = starts[l + 1]! - first;
    if (count < 2) continue;
    const style = styleOf(basins[l]!);
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: count }, (_, i) => new THREE.Vector3(positions[(first + i) * 3]!, positions[(first + i) * 3 + 1]!, positions[(first + i) * 3 + 2]!)),
      false,
      'centripetal',
    );
    const n = (count - 1) * FLOW_SPLINE + 1;
    const pts: THREE.Vector3[] = [];
    const sp: number[] = [];
    const wt: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1);
      pts.push(curve.getPoint(t));
      const f = t * (count - 1);
      const i0 = Math.min(count - 2, Math.floor(f));
      const k = f - i0;
      sp.push(speeds[first + i0]! * (1 - k) + speeds[first + i0 + 1]! * k);
      wt.push(weights[first + i0]! * (1 - k) + weights[first + i0 + 1]! * k);
    }
    // Gyr down the line, at the speed between each pair of points (the slower weighing more).
    const along = [0];
    const dist = [0];
    for (let i = 1; i < n; i += 1) {
      const ds = pts[i]!.distanceTo(pts[i - 1]!);
      const speed = Math.max(5, 2 / (1 / Math.max(1, sp[i]!) + 1 / Math.max(1, sp[i - 1]!)));
      along.push(along[i - 1]! + (ds / speed) * GYR_PER_PC_AT_KMS);
      dist.push(dist[i - 1]! + ds);
    }
    const base = pos.length / 3;
    for (let i = 0; i < n; i += 1) {
      const p = pts[i]!;
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(n - 1, i + 1)]!;
      for (const s of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        prev.push(a.x, a.y, a.z);
        next.push(b.x, b.y, b.z);
        side.push(s);
        gyr.push(along[i]!);
        weight.push(wt[i]! * style.opacity);
        color.push(style.color.r, style.color.g, style.color.b);
        width.push(style.widthPx);
        toEnd.push(dist[n - 1]! - dist[i]!);
      }
      if (i > 0) {
        const v = base + 2 * i;
        index.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  const attribute = (values: number[], size: number) => new THREE.BufferAttribute(new Float32Array(values), size);
  geometry.setAttribute('position', attribute(pos, 3));
  geometry.setAttribute('aPrev', attribute(prev, 3));
  geometry.setAttribute('aNext', attribute(next, 3));
  geometry.setAttribute('aSide', attribute(side, 1));
  geometry.setAttribute('aGyr', attribute(gyr, 1));
  geometry.setAttribute('aWeight', attribute(weight, 1));
  geometry.setAttribute('aColor', attribute(color, 3));
  geometry.setAttribute('aWidthPx', attribute(width, 1));
  geometry.setAttribute('aToEndPc', attribute(toEnd, 1));
  geometry.setIndex(index);
  return geometry;
}

/** A unit cube, 0 to 1 along each axis: the box a basin's fill is marched in. */
export function unitBox(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0.5, 0.5, 0.5);
  return box;
}

/** A basin drawn: its outline, its fill and the fill's field. */
export interface BasinObjects {
  readonly outline: THREE.Mesh;
  readonly fill: THREE.Mesh;
  readonly texture: THREE.Data3DTexture;
}

/** A basin's label in its grid, for laniakeaBasins.ts to net; null where the catalogue has no grids. */
export function basinRequest(catalogue: LaniakeaCatalogue, outline: Pick<BasinOutline, 'grid' | 'label'>): BasinRequest | null {
  const basins = catalogue.basins;
  if (basins === null) return null;
  return { labels: basins.grids[outline.grid], size: basins.size, label: outline.label, voxelToScene: basins.voxelToScene };
}

/** A basin's outline (laniakeaBasins.ts basinGeometry) and its fill (FILL_FRAGMENT), in `color`, from its parts. */
export function basinObjectsFor(
  basins: BasinGrids,
  parts: BasinParts,
  color: string,
  outlineMaterial: (color: string, rim: number, face: number, nearPc: number) => THREE.ShaderMaterial,
): BasinObjects {
  const { volume } = parts;
  const outline = new THREE.Mesh(basinPartsGeometry(parts), outlineMaterial(color, BASIN_RIM, BASIN_FACE, BASIN_NEAR_PC));
  outline.frustumCulled = false;
  outline.raycast = noRaycast;
  outline.renderOrder = 1;
  const [sx, sy, sz] = volume.size;
  const texture = new THREE.Data3DTexture(volume.data, sx, sy, sz);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  const fill = new THREE.Mesh(
    unitBox(),
    new THREE.ShaderMaterial({
      uniforms: {
        uCameraPc: { value: new THREE.Vector3() },
        uUnitsPerPc: { value: UNITS_PER_PC },
        uVoxelToScene: { value: new THREE.Matrix4().fromArray(basins.voxelToScene) },
        uOrigin: { value: new THREE.Vector3(...volume.origin) },
        uSize: { value: new THREE.Vector3(sx, sy, sz) },
        uField: { value: texture },
        uCameraVoxel: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color().setStyle(color, THREE.LinearSRGBColorSpace) },
        uOpacity: { value: 0 },
        uDensity: { value: FILL_DENSITY },
        uNearVoxels: { value: BASIN_NEAR_PC / basins.voxelPc },
      },
      vertexShader: FILL_VERTEX,
      fragmentShader: FILL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    }),
  );
  fill.frustumCulled = false;
  fill.raycast = noRaycast;
  fill.renderOrder = 1;
  return { outline, fill, texture };
}

/** A basin's meshes and field let go. */
function disposeBasin(basin: BasinObjects | null | undefined): void {
  if (!basin) return;
  for (const mesh of [basin.outline, basin.fill]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  basin.texture.dispose();
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
  /** The Basins of Attraction layer, and which of its basins are on (core/basinChips.ts). */
  readonly showBasins: boolean;
  readonly basinChips: number;
  /** The Flow Lines layer: the velocity field's streamlines, flowing. */
  readonly showFlows: boolean;
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

export function Laniakea({ source, names, store, clock, focus, visible, showMarks, showBasins, basinChips, showFlows, onPick }: LaniakeaProps) {
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
      uFloorKept: { value: 1 },
      uWallTint: { value: new THREE.Vector2(WALL_TINT, WALL_TINT) },
      uWallColor: { value: new THREE.Color().setStyle(WALL_COLOR, THREE.LinearSRGBColorSpace) },
    }),
    [],
  );
  const points = useMemo(() => {
    if (catalogue === null) return null;
    const { count, records } = catalogue;
    const centre = new Float32Array(count * 3);
    const light = new Float32Array(count * 3);
    const halfLight = new Float32Array(count);
    const wall = new Float32Array(count);
    // Whole until weighed: a few hundred milliseconds, done after, a slice a tick (below).
    const floor = new Float32Array(count).fill(1);
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
      const flags = records[at + FIELD.flags]!;
      wall[k] = (flags & LANIAKEA_FLAGS.WALL_SLOAN ? 1 : 0) + (flags & LANIAKEA_FLAGS.WALL_CFA2 ? 2 : 0);
    }
    const geometry = spriteGeometry(count);
    geometry.setAttribute('aCentre', new THREE.InstancedBufferAttribute(centre, 3));
    geometry.setAttribute('aLight', new THREE.InstancedBufferAttribute(light, 3));
    geometry.setAttribute('aHalfLightPc', new THREE.InstancedBufferAttribute(halfLight, 1));
    geometry.setAttribute('aWall', new THREE.InstancedBufferAttribute(wall, 1));
    const floorAttribute = new THREE.InstancedBufferAttribute(floor, 1);
    geometry.setAttribute('aFloor', floorAttribute);
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
    // The galaxies that have a size, in cells by it, so a frame looks for those large enough on
    // the screen to be volumes only where there could be one (pointCells.ts).
    const sized: number[] = [];
    for (let k = 0; k < count; k += 1) if (halfLight[k]! > 0) sized.push(k);
    const cells = pointCells(records, 12, sized, count, (k) => halfLight[k]!);
    return {
      object,
      halfLight,
      floor,
      floorAttribute,
      halfCountPc: halfCountRadiusPc(centre, count),
      cells,
      near: new Int32Array(sized.length),
    };
  }, [catalogue, pointUniforms]);

  // Each galaxy's faint dot weighed by its neighbours (floorWeights), FLOOR_SLICE galaxies a tick.
  useEffect(() => {
    if (catalogue === null || points === null) return;
    const grid = floorGrid(catalogue.records, catalogue.count);
    const weighed = new Float32Array(catalogue.count);
    let from = 0;
    let handle = 0;
    const step = () => {
      const to = Math.min(catalogue.count, from + FLOOR_SLICE);
      floorWeights(catalogue.records, grid, weighed, from, to);
      from = to;
      if (from < catalogue.count) {
        handle = window.setTimeout(step, 0);
        return;
      }
      points.floor.set(weighed);
      points.floorAttribute.needsUpdate = true;
      renderDemand.request();
    };
    handle = window.setTimeout(step, 0);
    return () => window.clearTimeout(handle);
  }, [catalogue, points]);

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
    // Only the marks that can be anything are worked out each frame (laniakeaMarks.ts): their
    // index made the first frame they are wanted, not with everything else as the catalogue lands.
    return { object, set, folds, value, reachPc, state: null as MarkState | null, bodies: [] as number[] };
  }, [catalogue, markUniforms]);

  // A galaxy made a body has its body's mark and name: its own steps aside.
  useEffect(() => {
    void version;
    if (marks === null) return;
    marks.set.body.fill(0);
    marks.bodies.length = 0;
    for (const body of store.bodies) {
      if (body.kind !== 'galaxy' || !body.id.startsWith('galaxy-lk-')) continue;
      const k = Number(body.id.slice('galaxy-lk-'.length));
      if (Number.isInteger(k) && k >= 0 && k < marks.set.body.length && marks.set.body[k] === 0) {
        marks.set.body[k] = 1;
        marks.bodies.push(k);
      }
    }
    renderDemand.request();
  }, [marks, store, version]);

  // ---- The outlines and fills: Laniakea's basin, Shapley's; the voids; the walls.
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
  // Each basin netted and its field made once, in a worker (laniakeaBasins.ts), the first time
  // its layer is on: 100 to 200 ms a basin, which between frames held one back as long.
  // The layer's basins, each with its chip and hue (core/basinChips.ts).
  const outlines = useMemo(() => (catalogue === null ? [] : basinOutlines(catalogue.info)), [catalogue]);
  const [basinObjects, setBasinObjects] = useState<Readonly<Record<string, BasinObjects | null>>>({});
  // The basins asked for, under a token a new catalogue -- or unmounting -- replaces, so an
  // answer for an old one is dropped; netted one after another, one worker at a time.
  const basinsAsked = useRef({ token: {}, keys: new Set<string>(), queue: Promise.resolve() as Promise<unknown> });
  useEffect(() => {
    if (catalogue === null || catalogue.basins === null || !showBasins) return;
    const basins = catalogue.basins;
    const asked = basinsAsked.current;
    const wanted = outlines.filter((o) => basinChipShown(basinChips, o.chip) && !(o.key in basinObjects) && !asked.keys.has(o.key));
    for (const outline of wanted) {
      asked.keys.add(outline.key);
      const request = basinRequest(catalogue, outline);
      asked.queue = asked.queue.then(() =>
        (request === null ? Promise.resolve(null) : basinPartsAhead(request)).then((parts) => {
          if (basinsAsked.current.token !== asked.token) return;
          const made = parts === null ? null : basinObjectsFor(basins, parts, outline.color, outlineMaterial);
          setBasinObjects((before) => ({ ...before, [outline.key]: made }));
          renderDemand.request();
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, outlines, showBasins, basinChips, basinObjects]);

  const structures = useMemo(() => {
    if (catalogue === null) return null;
    const voids: THREE.Mesh[] = [];
    const walls: THREE.Line[] = [];
    for (const landmark of catalogue.info.landmarks) {
      if (landmark.kind === 'void') {
        const geometry = voidGeometry(landmark);
        if (geometry === null || landmark.extentPc === null) continue;
        // Its shell marched in its own unit sphere: the map from the scene there.
        const [a, b, c] = landmark.extentPc.map((e) => e / 2) as [number, number, number];
        const X = SUPERGALACTIC_X;
        const Y = SUPERGALACTIC_Y;
        const Z = SUPERGALACTIC_Z;
        const toUnit = new THREE.Matrix3().set(X.x / a, X.y / a, X.z / a, Y.x / b, Y.y / b, Y.z / b, Z.x / c, Z.y / c, Z.z / c);
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.ShaderMaterial({
            uniforms: {
              uCameraPc: { value: new THREE.Vector3() },
              uUnitsPerPc: { value: UNITS_PER_PC },
              uCentre: { value: new THREE.Vector3(landmark.x, landmark.y, landmark.z) },
              uToUnit: { value: toUnit },
              uColor: { value: new THREE.Color().setStyle(VOID_COLOR, THREE.LinearSRGBColorSpace) },
              uOpacity: { value: 0 },
            },
            vertexShader: OUTLINE_VERTEX,
            fragmentShader: VOID_FRAGMENT,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            toneMapped: false,
          }),
        );
        mesh.frustumCulled = false;
        mesh.raycast = noRaycast;
        mesh.userData['landmark'] = landmark;
        voids.push(mesh);
      } else if (landmark.kind === 'wall' && landmark.path !== null && landmark.path.length > 1) {
        // A smooth curve through its points, as the wall is drawn in its papers: a hint now, its galaxies the wall.
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
        line.userData['landmark'] = landmark;
        walls.push(line);
      }
    }
    return { voids, walls };
  }, [catalogue]);

  // ---- The flow lines: one draw of segments, a dash running down each.
  const flows = useMemo(() => {
    const lines = catalogue?.flows ?? null;
    if (catalogue === null || lines === null) return null;
    const named = new Map(catalogue.info.basins.basins.filter((b) => b.grid === 'galaxiesAttraction').map((b) => [b.label, b.name]));
    const colours = {
      Laniakea: new THREE.Color().setStyle(LANIAKEA_OUTLINE_COLOR, THREE.LinearSRGBColorSpace),
      Shapley: new THREE.Color().setStyle(SHAPLEY_OUTLINE_COLOR, THREE.LinearSRGBColorSpace),
      other: new THREE.Color().setStyle(FLOW_OTHER_COLOR, THREE.LinearSRGBColorSpace),
    };
    const styleOf = (basin: number) => {
      const name = named.get(basin);
      return name === 'Laniakea'
        ? { color: colours.Laniakea, opacity: FLOW_BASE, widthPx: FLOW_LANIAKEA_WIDTH_PX }
        : { color: name === 'Shapley' ? colours.Shapley : colours.other, opacity: FLOW_OTHER_BASE, widthPx: FLOW_WIDTH_PX };
    };
    const object = new THREE.Mesh(
      flowGeometry(lines, styleOf),
      new THREE.ShaderMaterial({
        uniforms: {
          uCameraPc: { value: new THREE.Vector3() },
          uUnitsPerPc: { value: UNITS_PER_PC },
          uViewportPx: { value: new THREE.Vector2(1, 1) },
          uOpacity: { value: 0 },
          uClockGyr: { value: 0 },
          uNearPc: { value: FLOW_NEAR_PC },
        },
        vertexShader: FLOW_VERTEX,
        fragmentShader: FLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    object.frustumCulled = false;
    object.raycast = noRaycast;
    object.renderOrder = 2;
    return object;
  }, [catalogue]);

  // ---- "You are here": the Milky Way's mark once home is a speck (homeName.ts).
  const here = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GALACTIC_CENTRE_SCENE_PC), 3));
    const object = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          uCameraPc: { value: new THREE.Vector3() },
          uUnitsPerPc: { value: UNITS_PER_PC },
          uPixelRatio: { value: 1 },
          uColor: { value: new THREE.Color().setStyle(HERE_COLOR, THREE.LinearSRGBColorSpace) },
          uFade: { value: 0 },
        },
        vertexShader: HERE_VERTEX,
        fragmentShader: HERE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    );
    object.frustumCulled = false;
    object.raycast = noRaycast;
    object.renderOrder = 5;
    return object;
  }, []);

  useEffect(() => {
    const objects: THREE.Object3D[] = [volumes.disc.mesh, volumes.sersic.mesh, volumes.plummer.mesh, here];
    if (points !== null) objects.push(points.object);
    if (marks !== null) objects.push(marks.object);
    if (structures !== null) objects.push(...structures.voids, ...structures.walls);
    if (flows !== null) objects.push(flows);
    for (const basin of Object.values(basinObjects)) {
      if (basin) objects.push(basin.outline, basin.fill);
    }
    group.add(...objects);
    renderDemand.request();
    return () => {
      group.remove(...objects);
    };
  }, [group, volumes, points, marks, structures, basinObjects, flows, here]);

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
    if (flows === null) return;
    flows.geometry.dispose();
    (flows.material as THREE.Material).dispose();
  }, [flows]);
  useEffect(() => () => {
    here.geometry.dispose();
    (here.material as THREE.Material).dispose();
  }, [here]);
  // A catalogue read anew drops the basins made from the old one.
  useEffect(
    () => () => {
      basinsAsked.current = { token: {}, keys: new Set(), queue: Promise.resolve() };
      setBasinObjects({});
    },
    [catalogue],
  );
  // A basin disposed once it is dropped -- with the catalogue, or unmounting -- and not as the
  // next is added beside it.
  const basinsHeld = useRef<Readonly<Record<string, BasinObjects | null>>>({});
  useEffect(() => {
    for (const [key, basin] of Object.entries(basinsHeld.current)) {
      if (basinObjects[key] !== basin) disposeBasin(basin);
    }
    basinsHeld.current = basinObjects;
  }, [basinObjects]);
  useEffect(
    () => () => {
      for (const basin of Object.values(basinsHeld.current)) disposeBasin(basin);
      basinsHeld.current = {};
    },
    [],
  );

  // Scratch for the frame: the volumes drawn this frame.
  const resolved = useMemo(() => ({ k: [] as number[], px: [] as number[] }), []);

  useFrame(({ camera: frameCamera, gl: renderer }) => {
    const sun = store.sunFromFocus(focus, clock.tdbJulianDay);
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
      pointUniforms['uFloorKept']!.value = floorKept(points.halfCountPc, catalogue.count, cameraPc.length(), pixelsPerRadian);
    }

    // The volumes: those over UNRESOLVED_PX, the largest first.
    volumeUniforms.uFade.value = fade;
    dwarfUniforms.uFade.value = fade;
    resolved.k.length = 0;
    resolved.px.length = 0;
    if (fade > 0 && points !== null) {
      const { records } = catalogue;
      const cx = cameraPc.x;
      const cy = cameraPc.y;
      const cz = cameraPc.z;
      const limit = pixelsPerRadian / UNRESOLVED_PX;
      const halfLight = points.halfLight;
      // Only the galaxies in cells that could hold one large enough (pointCells.ts).
      const near = points.near;
      const found = cellCandidates(points.cells, [cx, cy, cz], limit, near);
      for (let i = 0; i < found; i += 1) {
        const k = near[i]!;
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
    // In the records' order first, as a pass over all of them found them, so equals keep theirs.
    const byPx = resolved.k
      .map((k, i) => [k, resolved.px[i]!] as const)
      .sort((a, b) => a[0] - b[0])
      .sort((a, b) => b[1] - a[1]);
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

    // The outlines and fills, the voids and the walls, faint, with the structures.
    const setUniforms = (object: THREE.Object3D | null | undefined, opacity: number) => {
      if (!object) return;
      object.visible = opacity > 0;
      const uniforms = ((object as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      (uniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      uniforms['uOpacity']!.value = opacity;
    };
    const basin = (objects: BasinObjects | null | undefined, shown: boolean, outline: BasinOutline) => {
      if (!objects) return;
      const within = catalogue.basins !== null && basinAt(catalogue.basins, outline.grid, [cameraPc.x, cameraPc.y, cameraPc.z]) === outline.label;
      setUniforms(objects.outline, shown ? structureFade * (within ? OUTLINE_INSIDE : 1) : 0);
      setUniforms(objects.fill, shown ? structureFade * (within ? FILL_INSIDE : 1) : 0);
      if (shown && catalogue.basins !== null) {
        const [x, y, z] = transformPoint(catalogue.basins.sceneToVoxel, [cameraPc.x, cameraPc.y, cameraPc.z]);
        const uniforms = (objects.fill.material as THREE.ShaderMaterial).uniforms;
        (uniforms['uCameraVoxel']!.value as THREE.Vector3).set(x, y, z);
      }
    };
    for (const outline of outlines) basin(basinObjects[outline.key], showBasins && basinChipShown(basinChips, outline.chip), outline);
    for (const mesh of structures?.voids ?? []) {
      const landmark = mesh.userData['landmark'] as LaniakeaLandmark;
      // From inside, its shell is all about the camera: fainter.
      const [a, b, c] = (landmark.extentPc ?? [1, 1, 1]).map((e) => e / 2) as [number, number, number];
      const dx = cameraPc.x - landmark.x;
      const dy = cameraPc.y - landmark.y;
      const dz = cameraPc.z - landmark.z;
      const u = (dx * SUPERGALACTIC_X.x + dy * SUPERGALACTIC_X.y + dz * SUPERGALACTIC_X.z) / a;
      const v = (dx * SUPERGALACTIC_Y.x + dy * SUPERGALACTIC_Y.y + dz * SUPERGALACTIC_Y.z) / b;
      const w = (dx * SUPERGALACTIC_Z.x + dy * SUPERGALACTIC_Z.y + dz * SUPERGALACTIC_Z.z) / c;
      const within = u * u + v * v + w * w < 1;
      // A disputed void (the KBC Void, about us) only while it is chosen: not drawn as if established.
      const shown = visible && (landmark.status?.label !== 'disputed' || structureOf(focus) === landmark);
      setUniforms(mesh, shown ? structureFade * VOID_SHELL * (within ? VOID_INSIDE : 1) : 0);
    }
    const focusedWall = structureOf(focus)?.kind === 'wall' ? structureOf(focus)!.name : null;
    for (const line of structures?.walls ?? []) {
      // Faded as the camera comes near it: beside Coma the CfA2 wall is a line across the frame.
      let nearest = Infinity;
      for (const p of line.userData['points'] as THREE.Vector3[]) {
        nearest = Math.min(nearest, Math.hypot(p.x - cameraPc.x, p.y - cameraPc.y, p.z - cameraPc.z));
      }
      const t = Math.min(1, Math.max(0, (nearest - WALL_NEAR_PC / 2) / (WALL_NEAR_PC / 2)));
      setUniforms(line, visible ? structureFade * WALL_LINE_OPACITY * t * t * (3 - 2 * t) : 0);
    }
    // A wall's galaxies: their dots tinted, brighter while it is the focus.
    (pointUniforms['uWallTint']!.value as THREE.Vector2).set(
      focusedWall === 'Sloan Great Wall' ? WALL_TINT_FOCUSED : WALL_TINT,
      focusedWall === 'CfA2 Great Wall' ? WALL_TINT_FOCUSED : WALL_TINT,
    );

    // The flow lines: a dash down each, at FLOW_GYR_PER_SECOND of flow a second of the wall clock.
    if (flows !== null) {
      const opacity = showFlows ? structureFade : 0;
      setUniforms(flows, opacity);
      if (opacity > 0) {
        const uniforms = (flows.material as THREE.ShaderMaterial).uniforms;
        uniforms['uClockGyr']!.value = ((performance.now() / 1000) * FLOW_GYR_PER_SECOND) % (FLOW_PULSE_GYR * 1000);
        renderer.getDrawingBufferSize(uniforms['uViewportPx']!.value as THREE.Vector2);
        // Moving, so a frame is wanted while they are shown.
        renderDemand.request(2);
      }
    }

    // "You are here", once home is a speck (homeName.ts): with the marks.
    {
      const element = renderer.domElement;
      const home = homeNames(cameraPc.length() * PARSEC_KM, element.clientHeight, fov);
      const uniforms = (here.material as THREE.ShaderMaterial).uniforms;
      here.visible = home.here === true && showMarks;
      (uniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      uniforms['uPixelRatio']!.value = renderer.getPixelRatio();
      uniforms['uFade']!.value = here.visible ? 1 : 0;
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
        const focusIndex = focus.startsWith('galaxy-lk-') ? Number(focus.slice('galaxy-lk-'.length)) : -1;
        // Each mark's strength: the focus whole; a group's brightest its host's; a member its
        // fold into it; a galaxy of no group by its reach on the screen -- worked out only for
        // those that can be other than 0, the rest 0 (laniakeaMarks.ts).
        const state = (marks.state ??= new MarkState(laniakeaMarkIndex(catalogue.records, 12, marks.folds, marks.reachPc)));
        state.strengths(MARK_HOSTS, catalogue.records, 12, marks.reachPc, [cameraPc.x, cameraPc.y, cameraPc.z], cssPerRadian, focusIndex, marks.value);
        declutterMarks(marks.set, frameCamera, cameraPc, element.clientWidth, element.clientHeight, state.candidates(marks.bodies));
        state.settle(marks.set.shown.array as Float32Array, marks.set.kept);
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
