import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  centralDensities,
  CHANNEL_WAVELENGTHS_UM,
  columnAt,
  extinctionCurve,
  faceOnScales,
  GALAXY_COLOR,
  galaxyAxes,
  galaxyBodyId,
  galaxyExtentPc,
  galaxyHalfLightPc,
  galaxyLuminosity,
  galaxyPositionPc,
  GIANTS,
  indexLocalGroup,
  parseFaceOnMap,
  prugnielSimien,
  YOUNG_COLOUR_INDEX,
  type LocalGroupArchive,
  type LocalGroupGalaxy,
} from '../core/localGroup.ts';
import { BULGE_SERSIC_N, type LocalVolumeArchive } from '../core/localVolume.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { LazySource } from '../core/satellites.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { starColor } from './blackbody.ts';
import { nearestMarker, PICK_RADIUS_PX } from './ExoplanetHosts.tsx';
import { SPRITE_FRAGMENT_GLSL, SPRITE_VERTEX_GLSL, spriteGeometry } from './gaussianSprite.ts';
import { drawIntoGlow, GLOW_OUTPUT_GLSL, releaseFromGlow } from './glowBuffer.ts';
import { setMarkerPointer } from './markerPointer.ts';
import type { FramingView } from '../state/store.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { faceOnLevels, faceOnTexture, pngPixels } from './faceOnTexture.ts';
import {
  DISC_VOLUME_FRAGMENT,
  DISC_VOLUME_VERTEX,
  SERSIC_VOLUME_FRAGMENT,
  SERSIC_VOLUME_VERTEX,
  sersicAtlas,
} from './galaxyColumns.ts';
import { dwarfStarsDrawn } from './DwarfStars.tsx';
import { skyVolumesDrawn } from '../core/skyMap.ts';
import { BALMER_HUE, galaxyVisibility } from './MilkyWay.tsx';
import { KM_PER_UNIT, LIGHT_YEAR_KM } from './scale.ts';
import { mapStrength } from './Starfield.tsx';
import { srgbToLinear } from './starRendering.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';

/**
 * The Local Group's galaxies (core/localGroup.ts), drawn as what they are: volumes of light,
 * seen from wherever the camera is.
 *
 * ## Light along a line of sight
 *
 * Each galaxy is a luminosity density in space, rho (solar V luminosities per cubic parsec).
 * What a pixel sees is its integral along the pixel's ray, the column Sigma in L_Sun per
 * square parsec -- a surface brightness, mu = 26.38 - 2.5 log10 Sigma mag/arcsec^2, the same
 * at any distance, as a galaxy's is: from Earth this is the galaxy's measured profile, and
 * from beside it, its side.
 *
 * - **A dwarf, a Plummer ellipsoid**, has that integral in closed form. In the ellipsoid's
 *   own units -- each axis divided by its scale -- the ray is u0 + t v, and with c^2 = 1 +
 *   |u0 x v|^2 / |v|^2, its squared distance of closest approach plus one, and s = t |v| +
 *   u0.v / |v|,
 *
 *     Sigma = rho0 / |v| * [F(inf) - F(s0)],   F(s) = s (2 s^2 + 3 c^2) / (3 c^4 (s^2 + c^2)^(3/2)),
 *
 *   from the camera (s0) to infinity: exact from outside or inside, one evaluation a pixel.
 *   |u0 x v| rather than |u0|^2 - (u0.v)^2/|v|^2: from far off the two terms of the latter
 *   are 10^8 each and their difference is 1, which float32 cannot hold.
 * - **A disc, or the Small Cloud's ellipsoid**, has none: its ray is marched across its box
 *   in DISC_STEPS steps, each a little jittered so the steps do not show as bands, and
 *   Andromeda's bulge across a sphere of its own, finer.
 * - **Andromeda's disc, from its face-on map** (core/localGroup.ts FaceOnMap): its old stars,
 *   young stars and dust where they are, each a sheet of its own height, and its bulge, marched
 *   together in MAP_STEPS steps, the light of each dimmed by the dust before it; each sheet's
 *   column across a step taken exactly, so the thin dust is not missed between steps. The
 *   Large Cloud's glowing gas too, in the young stars' sheet, which is what lights it.
 *
 * Instanced: one draw for the dwarfs, one each for the four. Every box is placed about the
 * camera from float64 positions, as the stars are, the right way round (boxMatrix) so that
 * its inside faces are drawn from within it, and its numbers -- the camera in the galaxy's
 * units -- worked out in float64 each frame and handed over per galaxy.
 *
 * ## How bright
 *
 * One exposure for all of them: a column of WHITE_MU mag/arcsec^2 is drawn at full
 * strength, 1 - e^(-Sigma / Sigma_white) -- a soft shoulder, as the Milky Way's, so a bright
 * centre does not cut off; every glow is written linear into one buffer, the shoulder applied
 * once over their sum, and the light past white spilled into a halo by the stars' own point
 * spread rather than thrown away (glowBuffer.ts). Andromeda's disc is about 20 mag/arcsec^2 seen at its tilt;
 * Fornax's centre 23.4; the faintest dwarfs 28 to 31, and those do not show, as they do not
 * show in any photograph: they were found by counting their stars. Their marks show where
 * they are.
 *
 * The colours are estimated (localGroup.ts colourIndex): B-V through the stars' blackbody.
 *
 * ## Too small for a pixel
 *
 * A volume is seen where a pixel's ray goes through it, so a galaxy smaller than a pixel fell
 * between the rays and was gone: from the Local Group's view, Andromeda itself. A photograph
 * does not lose it, its light lands on the pixel it is in. So as a galaxy's half-light radius
 * (galaxyHalfLightPc) shrinks from RESOLVED_PX to UNRESOLVED_PX pixels its light goes over
 * from its volume to a point: a Gaussian of that radius, never narrower than MIN_SIGMA_PX,
 * holding all of its luminosity (pointPeak), through the same exposure, drawn out to where it
 * fades below a display step however bright (gaussianSprite.ts). From the Local
 * Group's view Andromeda, Triangulum, the Clouds and a dozen more are dots, some forty in all
 * show, and the faintest dwarfs still do not.
 *
 * ## Not round the camera
 *
 * Light nearer the camera than NEAR_SHARE of its distance from a galaxy's centre -- and never
 * nearer than half the galaxy's scale -- is left out, as the Milky Way's model leaves out the
 * points round the camera: there a galaxy is its stars, one by one, which are not drawn, and
 * summed as a glow they would fill the sky white. From inside a disc, what is left is the disc
 * across the sky as a band -- as the Milky Way is from here.
 *
 * ## Near a dwarf
 *
 * Near enough to a dwarf, its brightest stars show one by one (DwarfStars.tsx), and its volume
 * and its point keep only the light of those too faint to: the share DwarfStars works out
 * (dwarfStarsDrawn), so no light is counted twice.
 *
 * ## Beyond the Local Group
 *
 * The Local Volume's and the Virgo Cluster's galaxies (core/localVolume.ts), fetched as the
 * camera passes VOLUME_FROM_LY, are drawn by the same means, instanced: their dwarfs among the
 * Plummer ellipsoids, their discs and ellipticals one draw for each kind (galaxyColumns.ts), a
 * disc's bulge in its own box. A galaxy drawn as a point has no volume drawn at all: its
 * instance is left out that frame, so two thousand galaxies cost what the few resolved do.
 *
 * ## Marks
 *
 * One each, an ellipse; where two would overlap the less luminous goes, as a body's marker
 * behind another's does (markerDeclutter.ts) -- a galaxy made a body first, its own marker
 * standing for it. From the Virgo Cluster's view a thousand marks would be one smudge.
 *
 * ## Where
 *
 * Only once out of the Milky Way's neighbourhood, as the Milky Way's own model
 * (galaxyVisibility): from the Solar System these are the sky's, and the sky is drawn by the
 * stars. The marks come in further out, as the camera leaves the disc (outOfDiscStrength):
 * from among the stars a hundred and forty galaxy marks would be a second sky.
 */

/**
 * Where the breadcrumb's Local Group looks from (scale.ts LOCAL_GROUP_FRAMING_KM): above the
 * Milky Way's north pole, so its disc is seen face-on, turned so that Andromeda lies to the
 * right of the Sun across the frame.
 */
export const LOCAL_GROUP_VIEW: FramingView = (() => {
  const d = GALACTIC_BASIS.z;
  const m31 = galaxyPositionPc(GIANTS[0]!);
  const along = m31.x * d.x + m31.y * d.y + m31.z * d.z;
  const r = { x: m31.x - along * d.x, y: m31.y - along * d.y, z: m31.z - along * d.z };
  const n = Math.hypot(r.x, r.y, r.z);
  const right = { x: r.x / n, y: r.y / n, z: r.z / n };
  // right x up = direction, so up = direction x right.
  const up = [
    d.y * right.z - d.z * right.y,
    d.z * right.x - d.x * right.z,
    d.x * right.y - d.y * right.x,
  ] as const;
  return { direction: [d.x, d.y, d.z], up };
})();

/** The column drawn at full strength, mag/arcsec^2. */
export const WHITE_MU = 21;

/** The share of the camera's distance from a galaxy's centre within which its light is left out. */
export const NEAR_SHARE = 0.3;

/** Steps across a disc's box, and across Andromeda's bulge. */
export const DISC_STEPS = 64;
/** Steps along a ray through a disc drawn from its face-on map, and its bulge. */
export const MAP_STEPS = 48;
/** How far the bulge is drawn, effective radii, and how finely its profile is tabled for it. */
export const BULGE_REACH = 8;
const BULGE_TABLE = 1024;
export const BULGE_STEPS = 32;

/**
 * A galaxy's half-light radius on the screen, device pixels, below which its light is a point
 * alone, and above which its volume alone; between, the one goes over to the other.
 */
export const UNRESOLVED_PX = 1.5;
export const RESOLVED_PX = 4;
/** The narrowest a point's Gaussian is drawn, device pixels: narrower falls between pixels. */
export const MIN_SIGMA_PX = 0.7;

/** The share of a galaxy's light drawn as a point, its half-light radius `halfLightPx` across. */
export function pointShare(halfLightPx: number): number {
  const t = Math.min(1, Math.max(0, (halfLightPx - UNRESOLVED_PX) / (RESOLVED_PX - UNRESOLVED_PX)));
  return 1 - t * t * (3 - 2 * t);
}

/**
 * The column at the centre of a point, L_Sun/pc^2: `luminosity` spread as a Gaussian sigma
 * `sigmaPc` across where the galaxy is -- L / (2 pi sigma^2), so that summed over the screen
 * it is all of the galaxy's light.
 */
export function pointPeak(luminosity: number, sigmaPc: number): number {
  return luminosity / (2 * Math.PI * sigmaPc * sigmaPc);
}

/** Where the dwarfs' marks come in, light years from the Sun: as the camera leaves the disc. */
export const MARKS_FROM_LY = 20_000;
export const MARKS_FULL_LY = 100_000;

/**
 * Where the galaxies beyond the Local Group are fetched, light years from the Sun: three
 * million, past Andromeda, on the way out to the Local Group's own view (8 million).
 */
export const VOLUME_FROM_LY = 3e6;

/** How near a held mark may let another come before it goes, as a share of the mark's size. */
const MARK_HELD_FRACTION = 0.7;

/** The marks: an ellipse, the old sign for a nebula, and its size, CSS pixels. */
const SPRITE_PX = 15;
const CLICK_SLOP_PX = 5;

export function outOfDiscStrength(cameraFromSunKm: number): number {
  const ly = cameraFromSunKm / LIGHT_YEAR_KM;
  const t = (Math.log(ly) - Math.log(MARKS_FROM_LY)) / (Math.log(MARKS_FULL_LY) - Math.log(MARKS_FROM_LY));
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * The column of a Plummer ellipsoid from a camera at u0 (its units) along direction v (its
 * units per parsec), in units of rho0 parsecs: see the header. Here for the tests; the shader
 * has the same lines.
 */
export function plummerColumn(
  u0: readonly [number, number, number],
  v: readonly [number, number, number],
  nearPc = 0,
): number {
  const vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  const cross = [u0[1] * v[2] - u0[2] * v[1], u0[2] * v[0] - u0[0] * v[2], u0[0] * v[1] - u0[1] * v[0]];
  const c2 = 1 + (cross[0]! ** 2 + cross[1]! ** 2 + cross[2]! ** 2) / vv;
  // From the near limit on, not the camera.
  const s0 = (u0[0] * v[0] + u0[1] * v[1] + u0[2] * v[2]) / Math.sqrt(vv) + nearPc * Math.sqrt(vv);
  const f = (s: number) => (s * (2 * s * s + 3 * c2)) / (3 * c2 * c2 * (s * s + c2) ** 1.5);
  return (2 / (3 * c2 * c2) - f(s0)) / Math.sqrt(vv);
}

/**
 * A galaxy's box about the camera, into `out`: its axes, scaled by its half extents
 * (`extent`, pc), at its centre `centre` (pc from the camera) -- the right way round whatever
 * its axes are. A dwarf's -- its major axis, its minor axis, away from the Sun -- are a mirror
 * image of a right-handed set, and three.js turns a mirrored object's faces round by its own
 * matrix alone, not an instance's: the dwarfs' back faces were then their near ones, which
 * from inside a box there are none of, and a dwarf went dark as the camera entered its box.
 * The box is the same box either way round, and the shaders take the galaxy's axes from
 * their own inputs.
 */
export function boxMatrix(
  axes: { readonly u: { x: number; y: number; z: number }; readonly v: { x: number; y: number; z: number }; readonly w: { x: number; y: number; z: number } },
  extent: readonly [number, number, number],
  centre: { readonly x: number; readonly y: number; readonly z: number },
  out: THREE.Matrix4,
): THREE.Matrix4 {
  const { u, v, w } = axes;
  const handed = Math.sign(u.x * (v.y * w.z - v.z * w.y) + u.y * (v.z * w.x - v.x * w.z) + u.z * (v.x * w.y - v.y * w.x)) || 1;
  const a = extent[0] * UNITS_PER_PC;
  const b = extent[1] * UNITS_PER_PC;
  const c = handed * extent[2] * UNITS_PER_PC;
  return out.set(
    u.x * a, v.x * b, w.x * c, centre.x * UNITS_PER_PC,
    u.y * a, v.y * b, w.y * c, centre.y * UNITS_PER_PC,
    u.z * a, v.z * b, w.z * c, centre.z * UNITS_PER_PC,
    0, 0, 0, 1,
  );
}

const COMMON_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vRel;
`;

const DWARF_VERTEX = /* glsl */ `
${COMMON_VERTEX}
attribute vec3 aM0;
attribute vec3 aM1;
attribute vec3 aM2;
attribute vec3 aU0;
attribute vec3 aGlow;
attribute float aNear;
varying float vNear;
varying vec3 vM0;
varying vec3 vM1;
varying vec3 vM2;
varying vec3 vU0;
varying vec3 vGlow;

void main() {
  vec4 rel = instanceMatrix * vec4(position, 1.0);
  vRel = rel.xyz;
  vM0 = aM0;
  vM1 = aM1;
  vM2 = aM2;
  vU0 = aU0;
  vGlow = aGlow;
  vNear = aNear;
  gl_Position = projectionMatrix * modelViewMatrix * rel;
  #include <logdepthbuf_vertex>
}
`;

const DWARF_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}
uniform float uFade;
varying vec3 vRel;
varying vec3 vM0;
varying vec3 vM1;
varying vec3 vM2;
varying vec3 vU0;
varying vec3 vGlow;
varying float vNear;

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vRel);
  vec3 v = vec3(dot(vM0, d), dot(vM1, d), dot(vM2, d));
  float vv = dot(v, v);
  vec3 cr = cross(vU0, v);
  float c2 = 1.0 + dot(cr, cr) / vv;
  // From the near limit on (see the header), not the camera.
  float s0 = dot(vU0, v) / sqrt(vv) + vNear * sqrt(vv);
  float fs = s0 * (2.0 * s0 * s0 + 3.0 * c2) / (3.0 * c2 * c2 * pow(s0 * s0 + c2, 1.5));
  float column = (2.0 / (3.0 * c2 * c2) - fs) / sqrt(vv);
  // vGlow is the colour times rho0 over the white column.
  // Linear, into the glow buffer: its shoulder and dither are the composite's (glowBuffer.ts).
  gl_FragColor = glowLight(vGlow * max(column, 0.0) * uFade);
}
`;

const GIANT_VERTEX = /* glsl */ `
${COMMON_VERTEX}
// The box about the camera: its own matrix, the group's being the camera's place alone.
uniform mat4 uLocal;
void main() {
  vRel = (uLocal * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const GIANT_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}
uniform float uFade;
// The galaxy's axes (rows), the camera in its frame, pc, and its box's half extents, pc.
uniform mat3 uAxes;
uniform vec3 uCamera;
uniform vec3 uExtent;
// 0 a disc: scale length and height; 1 an exponential ellipsoid: its three scale lengths.
uniform int uKind;
uniform vec3 uScale;
uniform vec3 uGlow;
// The bulge: its colour times rho0 over the white column, R_e, and p, b, 1/n.
uniform vec3 uBulgeGlow;
uniform vec4 uBulge;
// Light nearer the camera than this, pc, is left out (see the header).
uniform float uNear;
// 2, a disc from its face-on map (faceOnTexture.ts): the map -- old and young stars' light,
// L_Sun/pc^2, and the dust's V optical depth -- and how far it reaches either side, pc; the
// colours over the white column, the dust's depth in each colour per unit V, and the
// heights, pc, of the old stars' sheet, the young stars' and the dust's.
uniform sampler2D uMap;
uniform float uMapHalf;
uniform vec3 uOldGlow;
uniform vec3 uYoungGlow;
// The glowing gas's Balmer light (the map's alpha, none where there is no map of it), over
// the white column as the stars' are.
uniform vec3 uNebulaGlow;
uniform vec3 uDustTau;
uniform vec3 uHeights;
// The bulge's profile against r / R_e, out to BULGE_REACH: a table, not two powers a step.
uniform sampler2D uBulgeLut;
// A screen pixel's angle, radians, and a texel's size, pc: which of the map's mipmaps to read.
uniform float uPixelAngle;
uniform float uTexelPc;
varying vec3 vRel;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Where the ray from the camera meets the box: entry and exit, pc.
vec2 slab(vec3 o, vec3 d, vec3 halfSize) {
  vec3 inv = 1.0 / d;
  vec3 a = (-halfSize - o) * inv;
  vec3 b = (halfSize - o) * inv;
  vec3 lo = min(a, b);
  vec3 hi = max(a, b);
  return vec2(max(max(lo.x, lo.y), max(lo.z, 0.0)), min(hi.x, min(hi.y, hi.z)));
}

float density(vec3 p) {
  if (uKind == 0) {
    return exp(-length(p.xy) / uScale.x - abs(p.z) / uScale.y);
  }
  return exp(-length(p / uScale));
}

float bulgeAt(vec3 p) {
  float r = max(length(p) / uBulge.x, 0.02);
  return pow(r, -uBulge.y) * exp(-uBulge.z * pow(r, uBulge.w));
}

// The share of a sheet's light -- e^(-|z|/h) / 2h, for the old stars', the young stars' and
// the dust's heights -- below the height z.
vec3 sheetBelow(float z) {
  return 0.5 + 0.5 * sign(z) * (1.0 - exp(-abs(z) / uHeights));
}

// The light along the ray through a mapped disc and its bulge, dimmed by the dust in front of
// it. Each step takes each sheet's column across it exactly -- a sheet is the same profile in z
// all along the step -- and the map where the step crosses the disc's plane, or, if it does
// not, at a jittered point: a thin layer is not missed between steps however long they are.
vec3 marchMapped(vec3 d, float jitter) {
  vec2 span = slab(uCamera, d, uExtent);
  float reach = ${BULGE_REACH.toFixed(1)} * uBulge.x;
  float mid = -dot(uCamera, d);
  float miss2 = dot(uCamera, uCamera) - mid * mid;
  if (uBulge.x > 0.0 && miss2 < reach * reach) {
    float halfChord = sqrt(reach * reach - miss2);
    span = span.y > span.x
      ? vec2(min(span.x, mid - halfChord), max(span.y, mid + halfChord))
      : vec2(mid - halfChord, mid + halfChord);
  }
  span.x = max(span.x, uNear);
  if (span.y <= span.x) return vec3(0.0);
  float dt = (span.y - span.x) / float(${MAP_STEPS});
  bool level = abs(d.z) < 1e-5;
  vec3 light = vec3(0.0);
  vec3 through = vec3(1.0);
  float z0 = uCamera.z + d.z * span.x;
  vec3 below0 = sheetBelow(z0);
  for (int i = 0; i < ${MAP_STEPS}; i++) {
    float t0 = span.x + float(i) * dt;
    float z1 = z0 + d.z * dt;
    vec3 below1 = sheetBelow(z1);
    vec3 column = level ? exp(-abs(z0) / uHeights) / (2.0 * uHeights) * dt : (below1 - below0) / d.z;
    float tj = t0 + jitter * dt;
    vec3 emitted = vec3(0.0);
    if (uBulge.x > 0.0) {
      float r = length(uCamera + d * tj) / uBulge.x;
      if (r < ${BULGE_REACH.toFixed(1)}) {
        emitted = uBulgeGlow * (textureLod(uBulgeLut, vec2(r / ${BULGE_REACH.toFixed(1)}, 0.5), 0.0).r * dt);
      }
    }
    vec3 tau = vec3(0.0);
    float ts = z0 * z1 < 0.0 ? t0 - z0 / d.z : tj;
    vec2 uv = (uCamera.xy + d.xy * ts) / (2.0 * uMapHalf) + 0.5;
    if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
      float lod = max(0.0, log2(ts * uPixelAngle / uTexelPc));
      vec4 m = textureLod(uMap, uv, lod);
      // The gas lies with the young stars that ionise it, in their sheet.
      emitted += uOldGlow * (m.r * column.x) + (uYoungGlow * m.g + uNebulaGlow * m.a) * column.y;
      tau = uDustTau * (m.b * column.z);
    }
    // The step's light, then its dust on all that is behind it.
    light += through * emitted;
    through *= exp(-tau);
    z0 = z1;
    below0 = below1;
  }
  return light;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = uAxes * normalize(vRel);
  float jitter = hash(gl_FragCoord.xy);
  vec3 light = vec3(0.0);
  if (uKind == 2) {
    gl_FragColor = glowLight(marchMapped(d, jitter) * uFade);
    return;
  }
  vec2 span = slab(uCamera, d, uExtent);
  span.x = max(span.x, uNear);
  if (span.y > span.x) {
    float dt = (span.y - span.x) / float(${DISC_STEPS});
    float sum = 0.0;
    for (int i = 0; i < ${DISC_STEPS}; i++) {
      sum += density(uCamera + d * (span.x + (float(i) + jitter) * dt));
    }
    light += uGlow * sum * dt;
  }
  if (uBulge.x > 0.0) {
    // Across a sphere of eight effective radii about the centre.
    float reach = 8.0 * uBulge.x;
    float mid = -dot(uCamera, d);
    float miss2 = dot(uCamera, uCamera) - mid * mid;
    if (miss2 < reach * reach) {
      float halfChord = sqrt(reach * reach - miss2);
      float t0 = max(mid - halfChord, uNear);
      float t1 = mid + halfChord;
      if (t1 > t0) {
        float dt = (t1 - t0) / float(${BULGE_STEPS});
        float sum = 0.0;
        for (int i = 0; i < ${BULGE_STEPS}; i++) {
          float r = max(length(uCamera + d * (t0 + (float(i) + jitter) * dt)) / uBulge.x, 0.02);
          sum += pow(r, -uBulge.y) * exp(-uBulge.z * pow(r, uBulge.w));
        }
        light += uBulgeGlow * sum * dt;
      }
    }
  }
  // Linear, into the glow buffer, as the dwarfs'.
  gl_FragColor = glowLight(light * uFade);
}
`;

/**
 * The least a galaxy's point is drawn at, in white columns: about 40 of 255 at its centre. A
 * choice, not the light (Maxi, 2026-11-11: "me gusta, dejalo así"): on one exposure most dwarfs
 * are far too faint to show at all, and a galaxy at least a faint dot, in its own colour, is
 * where it is. Only its point -- an unresolved galaxy; once it is a few pixels across, its
 * volume is its own light alone.
 */
export const FAINT_GALAXY_FLOOR = 0.17;

const POINT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uFade;
// Where it is, pc; the colour times the luminosity over the white column; the half-light
// radius, pc; the share drawn as a point (pointShare, worked out on the CPU each frame).
attribute vec3 aCentre;
attribute vec3 aLight;
attribute float aHalfLightPc;
attribute float aShare;
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_VERTEX_GLSL}

void main() {
  vec3 rel = aCentre - uCameraPc;
  float distancePc = length(rel);
  float sigmaPx = max(${MIN_SIGMA_PX.toFixed(2)}, aHalfLightPc / distancePc * uPixelsPerRadian / 1.1774);
  float sigmaPc = sigmaPx / uPixelsPerRadian * distancePc;
  // pointPeak: L / (2 pi sigma^2).
  vPeak = aLight * aShare * uFade / (6.2831853 * sigmaPc * sigmaPc);
  // Every galaxy at least a faint dot, its own colour at FAINT_GALAXY_FLOOR whatever its
  // light: a choice, not what a photograph shows.
  vec3 hue = aLight / max(dot(aLight, vec3(0.2126, 0.7152, 0.0722)), 1e-30);
  vPeak = max(vPeak, hue * ${FAINT_GALAXY_FLOOR.toFixed(3)} * aShare * uFade);
  vSigmaPx = sigmaPx;
  // Out to where its light falls below the floor (gaussianSprite.ts): a bright one's wing
  // is not cut square.
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

const MARK_VERTEX = /* glsl */ `
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform float uPixelRatio;
attribute float shown;
varying float vShown;

void main() {
  vShown = shown;
  gl_Position = projectionMatrix * modelViewMatrix * vec4((position - uCameraPc) * uUnitsPerPc, 1.0);
  gl_PointSize = ${SPRITE_PX.toFixed(1)} * uPixelRatio;
}
`;

const MARK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying float vShown;

void main() {
  vec2 q = (gl_PointCoord - 0.5) * ${SPRITE_PX.toFixed(1)};
  // An ellipse twice as wide as tall, tipped, its outline only.
  float c = 0.8;
  float s = 0.6;
  vec2 r = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  float e = length(r / vec2(5.6, 2.6));
  float ring = 1.0 - smoothstep(0.08, 0.22, abs(e - 1.0));
  float alpha = 0.65 * ring * uFade * vShown;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/** The Prugniel-Simien profile, (r/R_e)^-p e^(-b (r/R_e)^(1/n)), at BULGE_TABLE radii out to BULGE_REACH. */
function bulgeTable(ps: { readonly p: number; readonly b: number }, n: number): THREE.DataTexture {
  const data = new Uint16Array(BULGE_TABLE);
  for (let i = 0; i < BULGE_TABLE; i += 1) {
    const r = Math.max(((i + 0.5) / BULGE_TABLE) * BULGE_REACH, 0.02);
    data[i] = THREE.DataUtils.toHalfFloat(r ** -ps.p * Math.exp(-ps.b * r ** (1 / n)));
  }
  const texture = new THREE.DataTexture(data, BULGE_TABLE, 1, THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** The colour of a galaxy's light, linear, times rho0 over the white column. */
function glow(galaxy: LocalGroupGalaxy, rho0: number, colourIndex = galaxy.colourIndex): THREE.Vector3 {
  const [r, g, b] = starColor(colourIndex);
  const scale = rho0 / columnAt(WHITE_MU);
  return new THREE.Vector3(r * scale, g * scale, b * scale);
}

/**
 * The Balmer lines' colour (MilkyWay.tsx BALMER_HUE, H-alpha and H-beta at Case B's 2.86),
 * linear, at unit luminance as starColor's are: so a L_Sun/pc^2 of the lines' light, as the
 * V-band luminosity carrying the same energy, is as bright as a L_Sun/pc^2 of starlight.
 */
export function balmerColour(): readonly [number, number, number] {
  const [r, g, b] = BALMER_HUE.map(srgbToLinear) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / luminance, g / luminance, b / luminance];
}

export interface LocalGroupProps {
  readonly source: LazySource<LocalGroupArchive>;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** The Icons layer: off, the marks go and the galaxies' light stays. */
  readonly showMarks: boolean;
  /** A dwarf's mark clicked: its index in the archive. */
  readonly onPick: (k: number) => void;
  /** The galaxies beyond (localVolume.ts), and a click on one's mark: its index there. */
  readonly volume: LazySource<LocalVolumeArchive>;
  readonly onPickVolume: (k: number) => void;
}

/** A galaxy drawn: the Local Group's `k`, or the Local Volume's. */
interface Entry {
  readonly galaxy: LocalGroupGalaxy;
  readonly k: number;
  readonly volume: boolean;
}

const noRaycast = (): void => {};
const scratchMatrix = new THREE.Matrix4();
const scratchSize = new THREE.Vector2();
const scratchQuaternion = new THREE.Quaternion();
const scratchVector = new THREE.Vector3();

/** The marks as the declutter reads and writes them. */
interface Marks {
  readonly centres: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  readonly shown: THREE.BufferAttribute;
  /** Most luminous first. */
  readonly order: readonly number[];
  /** 1 where the galaxy is a body, whose own marker stands for it. */
  readonly body: Uint8Array;
  /** 1 where the mark kept its place last frame. */
  readonly kept: Uint8Array;
}

/**
 * Which marks show: the bodies' places taken first, then each galaxy's, most luminous first,
 * where no mark already placed lies within a mark's size, SPRITE_PX -- one already shown
 * holding its place unless another comes within MARK_HELD_FRACTION of that, so a pair at the
 * threshold does not swap each frame. `width` and `height` are the canvas's, CSS pixels.
 */
export function declutterMarks(marks: Marks, frameCamera: THREE.Camera, cameraPc: THREE.Vector3, width: number, height: number): void {
  frameCamera.updateMatrixWorld();
  scratchQuaternion.copy(frameCamera.quaternion).invert();
  const e = (frameCamera as THREE.PerspectiveCamera).projectionMatrix.elements;
  const cells = new Map<number, number[]>();
  const cellKey = (cx: number, cy: number) => cx * 100_003 + cy;
  const clear = (x: number, y: number, gap: number): boolean => {
    const cx = Math.floor(x / SPRITE_PX);
    const cy = Math.floor(y / SPRITE_PX);
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const placed = cells.get(cellKey(cx + i, cy + j));
        if (placed === undefined) continue;
        for (let p = 0; p < placed.length; p += 2) {
          if (Math.abs(placed[p]! - x) < gap && Math.abs(placed[p + 1]! - y) < gap) return false;
        }
      }
    }
    return true;
  };
  const place = (x: number, y: number): void => {
    const key = cellKey(Math.floor(x / SPRITE_PX), Math.floor(y / SPRITE_PX));
    const list = cells.get(key);
    if (list === undefined) cells.set(key, [x, y]);
    else list.push(x, y);
  };
  const onScreen = (i: number): readonly [number, number] | null => {
    const centre = marks.centres[i]!;
    scratchVector.set(centre.x - cameraPc.x, centre.y - cameraPc.y, centre.z - cameraPc.z).applyQuaternion(scratchQuaternion);
    const depth = -scratchVector.z;
    if (depth <= 0) return null;
    const x = ((e[0]! * scratchVector.x) / depth + 1) * 0.5 * width;
    const y = (1 - (e[5]! * scratchVector.y) / depth) * 0.5 * height;
    return x < -SPRITE_PX || y < -SPRITE_PX || x > width + SPRITE_PX || y > height + SPRITE_PX ? null : [x, y];
  };
  let changed = false;
  const set = (i: number, keep: boolean): void => {
    marks.kept[i] = keep ? 1 : 0;
    const show = keep && marks.body[i] === 0 ? 1 : 0;
    if (marks.shown.getX(i) !== show) {
      marks.shown.setX(i, show);
      changed = true;
    }
  };
  for (const i of marks.order) {
    if (marks.body[i] === 1) {
      const at = onScreen(i);
      if (at !== null) place(at[0], at[1]);
      set(i, true);
    }
  }
  for (const i of marks.order) {
    if (marks.body[i] === 1) continue;
    const at = onScreen(i);
    if (at === null) {
      // Off the screen: kept, so it comes back as it was.
      set(i, true);
      continue;
    }
    const keep = clear(at[0], at[1], marks.kept[i] === 1 ? SPRITE_PX * MARK_HELD_FRACTION : SPRITE_PX);
    if (keep) place(at[0], at[1]);
    set(i, keep);
  }
  if (changed) {
    marks.shown.needsUpdate = true;
  }
}

export function LocalGroup({ source, store, clock, focus, visible, showMarks, onPick, volume, onPickVolume }: LocalGroupProps) {
  const { gl, camera } = useThree();
  const loaded = useSyncExternalStore(source.subscribe, () => source.value);
  const volumeLoaded = useSyncExternalStore(volume.subscribe, () => volume.value);
  // The four are drawn before the catalogue arrives, from their own numbers.
  const archive = useMemo(() => loaded ?? indexLocalGroup(null), [loaded]);
  // And the galaxies beyond after them, once they arrive.
  const entries = useMemo<readonly Entry[]>(
    () => [
      ...archive.galaxies.map((galaxy, k) => ({ galaxy, k, volume: false })),
      ...(volumeLoaded?.galaxies ?? []).map((galaxy, k) => ({ galaxy, k, volume: true })),
    ],
    [archive, volumeLoaded],
  );
  const version = useStoreVersion(store);
  const group = useMemo(() => new THREE.Group(), []);
  const requested = useRef(false);
  const volumeRequested = useRef(false);
  const frame = useRef({ cameraPc: new THREE.Vector3(), markFade: 0 });
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const pickVolumeRef = useRef(onPickVolume);
  pickVolumeRef.current = onPickVolume;

  // The dwarfs: one instanced box each, with what its shader needs.
  const dwarfUniforms = useMemo(() => ({ uFade: { value: 0 } }), []);
  const dwarfs = useMemo(() => {
    const list = entries.filter(({ galaxy }) => galaxy.model?.kind === 'plummer' && centralDensities(galaxy) !== null);
    const count = list.length;
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const attribute = (name: string) => {
      const value = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      value.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, value);
      return value;
    };
    const m0 = attribute('aM0');
    const m1 = attribute('aM1');
    const m2 = attribute('aM2');
    const u0 = attribute('aU0');
    const glowAttribute = attribute('aGlow');
    const near = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    near.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aNear', near);
    const material = new THREE.ShaderMaterial({
      uniforms: dwarfUniforms,
      vertexShader: DWARF_VERTEX,
      fragmentShader: DWARF_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.raycast = noRaycast;
    drawIntoGlow(mesh);
    // Per galaxy, fixed: its centre, axes over their scales, and its box.
    const fixed = list.map(({ galaxy }) => {
      const model = galaxy.model as Extract<LocalGroupGalaxy['model'], { kind: 'plummer' }>;
      const axes = galaxyAxes(galaxy);
      const extent = galaxyExtentPc(galaxy, columnAt(WHITE_MU))!;
      return {
        key: galaxy.key,
        centre: galaxyPositionPc(galaxy),
        axes,
        scales: [model.majorPc, model.minorPc, model.depthPc] as const,
        extent,
        halfLightPc: galaxyHalfLightPc(galaxy)!,
        glow: glow(galaxy, centralDensities(galaxy)!.main),
      };
    });
    return { mesh, list, fixed, m0, m1, m2, u0, near, glow: glowAttribute };
  }, [entries, dwarfUniforms]);

  // The discs and ellipticals beyond the Local Group: one instanced box for each kind, the
  // Prugniel-Simien tables of every index they need in one atlas, read by both (galaxyColumns.ts).
  const atlas = useMemo(() => {
    const indices = [BULGE_SERSIC_N];
    for (const { galaxy } of entries) {
      if (galaxy.model?.kind === 'sersic') indices.push(galaxy.model.sersicN);
    }
    return sersicAtlas(indices);
  }, [entries]);
  useEffect(() => () => atlas.texture.dispose(), [atlas]);
  const volumeUniforms = useMemo(
    () => ({
      uFade: { value: 0 },
      uSersic: { value: atlas.texture },
      uSersicLayers: { value: atlas.layers },
    }),
    [atlas],
  );
  const instancedVolumes = useMemo(() => {
    const make = (kind: 'disc' | 'sersic') => {
      const list = entries.filter(({ galaxy }) => {
        const model = galaxy.model;
        if (galaxy.giant || model === null || centralDensities(galaxy) === null) {
          return false;
        }
        // A disc's bulge drawn from the atlas's de Vaucouleurs table: every one beyond the Local Group's.
        return kind === 'disc'
          ? model.kind === 'disc' && (model.bulge === null || model.bulge.sersicN === BULGE_SERSIC_N)
          : model.kind === 'sersic';
      });
      const count = list.length;
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const attribute = (name: string, width: number) => {
        const value = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(count, 1) * width), width);
        value.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute(name, value);
        return value;
      };
      const attributes = {
        cam: attribute('aCam', 3),
        extent: attribute('aExtent', 3),
        glow: attribute('aGlow', 3),
        shape: attribute('aShape', 4),
        bulge: attribute('aBulge', 3),
      };
      const material = new THREE.ShaderMaterial({
        uniforms: volumeUniforms,
        vertexShader: kind === 'disc' ? DISC_VOLUME_VERTEX : SERSIC_VOLUME_VERTEX,
        fragmentShader: kind === 'disc' ? DISC_VOLUME_FRAGMENT : SERSIC_VOLUME_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        toneMapped: false,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.raycast = noRaycast;
      drawIntoGlow(mesh);
      const fixed = list.map(({ galaxy }) => {
        const model = galaxy.model!;
        const densities = centralDensities(galaxy)!;
        let axes = galaxyAxes(galaxy);
        // Right-handed, so a corner's place in its frame is its position times the extents:
        // an ellipsoid turned about its own axis is the same ellipsoid.
        const { u, v, w } = axes;
        if (u.x * (v.y * w.z - v.z * w.y) + u.y * (v.z * w.x - v.x * w.z) + u.z * (v.x * w.y - v.y * w.x) < 0) {
          axes = { u, v, w: { x: -w.x, y: -w.y, z: -w.z } };
        }
        const shape: readonly [number, number, number] =
          model.kind === 'disc'
            ? [model.scaleLengthPc, model.scaleHeightPc, 0]
            : model.kind === 'sersic'
              ? [model.majorPc, model.minorPc, model.depthPc]
              : [1, 1, 1];
        const bulge = model.kind === 'disc' ? model.bulge : null;
        const layer = atlas.layerOf(model.kind === 'sersic' ? model.sersicN : BULGE_SERSIC_N);
        return {
          centre: galaxyPositionPc(galaxy),
          axes,
          extent: galaxyExtentPc(galaxy, columnAt(WHITE_MU))!,
          shape,
          bulge:
            bulge === null
              ? ([0, 0, layer] as const)
              : ([bulge.effectiveRadiusPc, densities.bulge / densities.main, layer] as const),
          halfLightPc: galaxyHalfLightPc(galaxy)!,
          glow: glow(galaxy, densities.main),
        };
      });
      return { kind, mesh, list, fixed, attributes };
    };
    return [make('disc'), make('sersic')];
  }, [entries, volumeUniforms, atlas]);

  // The four, each its own box and marcher.
  const giants = useMemo(
    () =>
      GIANTS.flatMap((galaxy) => {
        const model = galaxy.model;
        const densities = centralDensities(galaxy);
        const extent = galaxyExtentPc(galaxy, columnAt(WHITE_MU));
        if (model === null || densities === null || extent === null || model.kind === 'plummer') {
          return [];
        }
        const axes = galaxyAxes(galaxy);
        const bulge = model.kind === 'disc' ? model.bulge : null;
        const ps = bulge === null ? null : prugnielSimien(bulge.sersicN);
        const uniforms = {
          uFade: { value: 0 },
          uLocal: { value: new THREE.Matrix4() },
          uNear: { value: 0 },
          uAxes: {
            value: new THREE.Matrix3().set(
              axes.u.x, axes.u.y, axes.u.z,
              axes.v.x, axes.v.y, axes.v.z,
              axes.w.x, axes.w.y, axes.w.z,
            ),
          },
          uCamera: { value: new THREE.Vector3() },
          uExtent: { value: new THREE.Vector3(...extent) },
          uKind: { value: model.kind === 'disc' ? 0 : 1 },
          uScale: {
            value:
              model.kind === 'disc'
                ? new THREE.Vector3(model.scaleLengthPc, model.scaleHeightPc, 0)
                : new THREE.Vector3(model.majorPc, model.minorPc, model.depthPc),
          },
          uGlow: { value: glow(galaxy, densities.main) },
          // An old bulge's colour, B-V 0.95, redder than its disc.
          uBulgeGlow: { value: bulge === null ? new THREE.Vector3() : glow(galaxy, densities.bulge, 0.95) },
          uBulge: {
            value:
              bulge === null || ps === null
                ? new THREE.Vector4(0, 0, 0, 0)
                : new THREE.Vector4(bulge.effectiveRadiusPc, ps.p, ps.b, 1 / bulge.sersicN),
          },
          // Its face-on map, once loaded (the effect below): until then a smooth disc.
          uMap: { value: null as THREE.Texture | null },
          uBulgeLut: { value: bulge === null || ps === null ? null : bulgeTable(ps, bulge.sersicN) },
          uMapHalf: { value: 1 },
          uOldGlow: { value: new THREE.Vector3() },
          uYoungGlow: { value: new THREE.Vector3() },
          uNebulaGlow: { value: new THREE.Vector3() },
          uDustTau: { value: new THREE.Vector3() },
          uHeights: { value: new THREE.Vector3(1, 1, 1) },
          uPixelAngle: { value: 1e-3 },
          uTexelPc: { value: 1 },
        };
        const material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: GIANT_VERTEX,
          fragmentShader: GIANT_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          toneMapped: false,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
        mesh.frustumCulled = false;
        mesh.raycast = noRaycast;
        drawIntoGlow(mesh);
        const scale = model.kind === 'disc' ? model.scaleLengthPc : model.majorPc;
        return [
          {
            galaxy,
            mesh,
            uniforms,
            axes,
            extent,
            centre: galaxyPositionPc(galaxy),
            scale,
            halfLightPc: galaxyHalfLightPc(galaxy)!,
            glow: uniforms.uGlow.value.clone(),
            bulgeGlow: uniforms.uBulgeGlow.value.clone(),
            // The map's light per unit, set when it loads.
            oldGlow: new THREE.Vector3(),
            youngGlow: new THREE.Vector3(),
            nebulaGlow: new THREE.Vector3(),
          },
        ];
      }),
    [],
  );

  // The face-on maps, asked for with the catalogue: Andromeda's stars and dust from above.
  const [mapsWanted, setMapsWanted] = useState(false);
  useEffect(() => {
    if (!mapsWanted) {
      return;
    }
    let cancelled = false;
    const textures: THREE.Texture[] = [];
    for (const giant of giants) {
      const model = giant.galaxy.model;
      if (model?.kind !== 'disc' || model.faceOnMap === null) {
        continue;
      }
      const base = `${import.meta.env.BASE_URL}galaxies/${model.faceOnMap}`;
      const described = fetch(`${base}.json`).then((response) => response.json()).then(parseFaceOnMap);
      // Its glowing gas, where it has a map of it, fetched alongside its stars'.
      const gas = described.then((map) => (map.nebula === undefined ? null : pngPixels(`${base}-nebula.png`)));
      void Promise.all([described, pngPixels(`${base}.png`), gas])
        .then(([map, pixels, nebula]) => {
          const scales = faceOnScales(giant.galaxy, map);
          if (cancelled || scales === null) {
            return;
          }
          const texture = faceOnTexture(faceOnLevels(pixels, map, [scales.old, scales.young, scales.dustTauV], nebula));
          textures.push(texture);
          const u = giant.uniforms;
          u.uMap.value = texture;
          u.uMapHalf.value = map.halfPc;
          u.uTexelPc.value = (2 * map.halfPc) / map.size;
          // Light per L_Sun/pc^2 now: the map carries the rest.
          giant.oldGlow.copy(glow(giant.galaxy, 1));
          giant.youngGlow.copy(glow(giant.galaxy, 1, YOUNG_COLOUR_INDEX));
          if (nebula !== null) {
            const [r, g, b] = balmerColour();
            giant.nebulaGlow.set(r, g, b).divideScalar(columnAt(WHITE_MU));
          }
          u.uDustTau.value.set(...(CHANNEL_WAVELENGTHS_UM.map((um) => extinctionCurve(um)) as [number, number, number]));
          u.uHeights.value.set(...scales.heightsPc);
          u.uKind.value = 2;
          renderDemand.request();
        })
        .catch(() => {
          // No map: the smooth disc stays.
        });
    }
    return () => {
      cancelled = true;
      for (const texture of textures) texture.dispose();
    };
  }, [mapsWanted, giants]);

  // Every galaxy drawn as a volume, as a point too: its light when too small for a pixel.
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
    const list = entries
      .map(({ galaxy }) => galaxy)
      .filter((galaxy) => centralDensities(galaxy) !== null && galaxyLuminosity(galaxy) !== null);
    const centres = list.map((galaxy) => galaxyPositionPc(galaxy));
    const halfLightPc = list.map((galaxy) => galaxyHalfLightPc(galaxy)!);
    const keys = list.map((galaxy) => galaxy.key);
    const position = new Float32Array(list.length * 3);
    const light = new Float32Array(list.length * 3);
    list.forEach((galaxy, i) => {
      const centre = centres[i]!;
      position.set([centre.x, centre.y, centre.z], i * 3);
      // Its whole light, in the colour of the most of it.
      const g = glow(galaxy, galaxyLuminosity(galaxy)!);
      light.set([g.x, g.y, g.z], i * 3);
    });
    const geometry = spriteGeometry(list.length);
    geometry.setAttribute('aCentre', new THREE.InstancedBufferAttribute(position, 3));
    geometry.setAttribute('aLight', new THREE.InstancedBufferAttribute(light, 3));
    geometry.setAttribute('aHalfLightPc', new THREE.InstancedBufferAttribute(new Float32Array(halfLightPc), 1));
    const share = new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1);
    share.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aShare', share);
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
    return { object, centres, halfLightPc, keys, share };
  }, [entries, pointUniforms]);

  // The dwarfs' marks.
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
    const list = entries.filter(({ galaxy }) => !galaxy.giant);
    const centres = list.map(({ galaxy }) => galaxyPositionPc(galaxy));
    // Parsecs about the Sun: float32 holds 3 Mpc to a fifth of a parsec and the Virgo Cluster
    // to 2 pc, a fraction of a pixel from wherever its marks show.
    const position = new Float32Array(list.length * 3);
    centres.forEach((centre, i) => position.set([centre.x, centre.y, centre.z], i * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    const shown = new THREE.BufferAttribute(new Float32Array(list.length).fill(1), 1);
    shown.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('shown', shown);
    // Decluttered most luminous first (see the header); a galaxy made a body steps aside.
    const order = list
      .map((_, i) => i)
      .sort((a, b) => (galaxyLuminosity(list[b]!.galaxy) ?? 0) - (galaxyLuminosity(list[a]!.galaxy) ?? 0));
    const body = new Uint8Array(list.length);
    const kept = new Uint8Array(list.length).fill(1);
    const points = new THREE.Points(
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
    points.frustumCulled = false;
    points.raycast = noRaycast;
    return { points, list, centres, shown, order, body, kept };
  }, [entries, markUniforms]);

  // A galaxy made a body has its body's mark and name: its own mark steps aside.
  useEffect(() => {
    void version;
    marks.list.forEach(({ galaxy }, i) => {
      marks.body[i] = store.isPropagatedBody(galaxyBodyId(galaxy)) ? 1 : 0;
      marks.shown.setX(i, marks.body[i] === 1 || marks.kept[i] === 0 ? 0 : 1);
    });
    marks.shown.needsUpdate = true;
    renderDemand.request();
  }, [marks, store, version]);

  useEffect(() => {
    group.add(dwarfs.mesh);
    for (const giant of giants) group.add(giant.mesh);
    for (const { mesh } of instancedVolumes) group.add(mesh);
    group.add(points.object);
    group.add(marks.points);
    renderDemand.request();
    return () => {
      const instanced = instancedVolumes.map(({ mesh }) => mesh);
      group.remove(dwarfs.mesh, points.object, marks.points, ...instanced);
      for (const giant of giants) group.remove(giant.mesh);
      for (const object of [dwarfs.mesh, points.object, ...giants.map((giant) => giant.mesh), ...instanced]) releaseFromGlow(object);
      for (const mesh of [dwarfs.mesh, ...instanced]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      points.object.geometry.dispose();
      (points.object.material as THREE.Material).dispose();
      marks.points.geometry.dispose();
      (marks.points.material as THREE.Material).dispose();
    };
  }, [group, dwarfs, giants, instancedVolumes, points, marks]);

  useEffect(
    () => () => {
      for (const giant of giants) {
        giant.mesh.geometry.dispose();
        (giant.mesh.material as THREE.Material).dispose();
      }
    },
    [giants],
  );

  useFrame(({ camera: frameCamera, gl: renderer }) => {
    const jd = clock.tdbJulianDay;
    const sun = store.stateRelativeTo('sun', focus, jd);
    if (sun === null || !visible) {
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
    if (!requested.current && fromSunKm > (MARKS_FROM_LY / 2) * LIGHT_YEAR_KM) {
      requested.current = true;
      void source.request();
      setMapsWanted(true);
    }
    if (!volumeRequested.current && fromSunKm > VOLUME_FROM_LY * LIGHT_YEAR_KM) {
      volumeRequested.current = true;
      void volume.request();
    }
    const fade = galaxyVisibility(fromSunKm);
    const markFade = showMarks
      ? mapStrength(frameCamera.position.length() * KM_PER_UNIT) * outOfDiscStrength(fromSunKm)
      : 0;
    frame.current.markFade = markFade;
    group.visible = fade > 0 || markFade > 0;
    if (!group.visible) {
      return;
    }
    group.position.copy(frameCamera.position);
    group.updateMatrixWorld();
    const fov = (frameCamera as THREE.PerspectiveCamera).fov;
    const pixelsPerRadian = renderer.getDrawingBufferSize(scratchSize).y / (2 * Math.tan((fov * Math.PI) / 360));
    // The share of a galaxy's light that is its volume's; the rest is its point's.
    const volumeShare = (halfLightPc: number, distancePc: number): number =>
      1 - pointShare((halfLightPc / distancePc) * pixelsPerRadian);

    // The dwarfs: each box about the camera, and the camera in each one's units -- those drawn
    // as a volume at all this frame, packed to the front (see the header).
    dwarfUniforms.uFade.value = fade;
    dwarfs.mesh.visible = fade > 0;
    if (fade > 0) {
      let n = 0;
      dwarfs.fixed.forEach(({ key, centre, axes, scales, extent, halfLightPc, glow: g }) => {
        const rx = centre.x - cameraPc.x;
        const ry = centre.y - cameraPc.y;
        const rz = centre.z - cameraPc.z;
        // Less what its stars drawn one by one carry (see the header).
        const share =
          volumeShare(halfLightPc, Math.hypot(rx, ry, rz)) * (key === dwarfStarsDrawn.key ? dwarfStarsDrawn.glowShare : 1);
        if (share <= 0) {
          return;
        }
        dwarfs.m0.setXYZ(n, axes.u.x / scales[0], axes.u.y / scales[0], axes.u.z / scales[0]);
        dwarfs.m1.setXYZ(n, axes.v.x / scales[1], axes.v.y / scales[1], axes.v.z / scales[1]);
        dwarfs.m2.setXYZ(n, axes.w.x / scales[2], axes.w.y / scales[2], axes.w.z / scales[2]);
        dwarfs.glow.setXYZ(n, g.x * share, g.y * share, g.z * share);
        // u0 = the camera minus the centre, along each axis over its scale.
        dwarfs.near.setX(n, Math.max(NEAR_SHARE * Math.hypot(rx, ry, rz), 0.5 * scales[0]));
        dwarfs.u0.setXYZ(
          n,
          -(rx * axes.u.x + ry * axes.u.y + rz * axes.u.z) / scales[0],
          -(rx * axes.v.x + ry * axes.v.y + rz * axes.v.z) / scales[1],
          -(rx * axes.w.x + ry * axes.w.y + rz * axes.w.z) / scales[2],
        );
        dwarfs.mesh.setMatrixAt(n, boxMatrix(axes, extent, { x: rx, y: ry, z: rz }, scratchMatrix));
        n += 1;
      });
      dwarfs.mesh.count = n;
      for (const attribute of [dwarfs.m0, dwarfs.m1, dwarfs.m2, dwarfs.u0, dwarfs.near, dwarfs.glow]) {
        attribute.needsUpdate = true;
      }
      dwarfs.mesh.instanceMatrix.needsUpdate = true;
    }

    // The discs and ellipticals beyond, the same way: the camera in each one's own frame.
    volumeUniforms.uFade.value = fade;
    for (const { mesh, fixed, attributes } of instancedVolumes) {
      mesh.visible = fade > 0;
      if (fade <= 0) {
        continue;
      }
      let n = 0;
      for (const { centre, axes, extent, shape, bulge, halfLightPc, glow: g } of fixed) {
        const rx = centre.x - cameraPc.x;
        const ry = centre.y - cameraPc.y;
        const rz = centre.z - cameraPc.z;
        const distance = Math.hypot(rx, ry, rz);
        const share = volumeShare(halfLightPc, distance);
        if (share <= 0) {
          continue;
        }
        attributes.cam.setXYZ(
          n,
          -(rx * axes.u.x + ry * axes.u.y + rz * axes.u.z),
          -(rx * axes.v.x + ry * axes.v.y + rz * axes.v.z),
          -(rx * axes.w.x + ry * axes.w.y + rz * axes.w.z),
        );
        attributes.extent.setXYZ(n, extent[0], extent[1], extent[2]);
        attributes.glow.setXYZ(n, g.x * share, g.y * share, g.z * share);
        // Light nearer than this is left out (see the header), never nearer than half its scale.
        const near = Math.max(NEAR_SHARE * distance, 0.5 * shape[0]);
        if (shape[2] === 0) {
          // A disc: its scale length and height, and the near limit.
          attributes.shape.setXYZW(n, shape[0], shape[1], near, 0);
        } else {
          attributes.shape.setXYZW(n, shape[0], shape[1], shape[2], near);
        }
        attributes.bulge.setXYZ(n, bulge[0], bulge[1], bulge[2]);
        mesh.setMatrixAt(n, boxMatrix(axes, extent, { x: rx, y: ry, z: rz }, scratchMatrix));
        n += 1;
      }
      mesh.count = n;
      for (const attribute of Object.values(attributes)) {
        attribute.needsUpdate = true;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // The four: each box about the camera, and the camera in its frame.
    const pixelAngle = ((fov * Math.PI) / 180) / renderer.getDrawingBufferSize(scratchSize).y;
    for (const { galaxy, mesh, uniforms, axes, extent, centre, scale, halfLightPc, glow: g, bulgeGlow, oldGlow, youngGlow, nebulaGlow } of giants) {
      // Drawn from its sky map instead (SkyVolume.tsx): its light is not counted twice.
      const drawnElsewhere = skyVolumesDrawn.has(galaxy.key);
      mesh.visible = fade > 0 && !drawnElsewhere;
      uniforms.uFade.value = fade;
      const rx = centre.x - cameraPc.x;
      const ry = centre.y - cameraPc.y;
      const rz = centre.z - cameraPc.z;
      const share = drawnElsewhere ? 0 : volumeShare(halfLightPc, Math.hypot(rx, ry, rz));
      uniforms.uGlow.value.copy(g).multiplyScalar(share);
      uniforms.uBulgeGlow.value.copy(bulgeGlow).multiplyScalar(share);
      uniforms.uOldGlow.value.copy(oldGlow).multiplyScalar(share);
      uniforms.uYoungGlow.value.copy(youngGlow).multiplyScalar(share);
      uniforms.uNebulaGlow.value.copy(nebulaGlow).multiplyScalar(share);
      uniforms.uPixelAngle.value = pixelAngle;
      uniforms.uNear.value = Math.max(NEAR_SHARE * Math.hypot(rx, ry, rz), 0.5 * scale);
      uniforms.uCamera.value.set(
        -(rx * axes.u.x + ry * axes.u.y + rz * axes.u.z),
        -(rx * axes.v.x + ry * axes.v.y + rz * axes.v.z),
        -(rx * axes.w.x + ry * axes.w.y + rz * axes.w.z),
      );
      mesh.matrixAutoUpdate = false;
      boxMatrix(axes, extent, { x: rx, y: ry, z: rz }, mesh.matrix);
      uniforms.uLocal.value.copy(mesh.matrix);
      mesh.matrixWorldNeedsUpdate = true;
    }

    // The points: what the volumes do not draw.
    points.object.visible = fade > 0;
    if (fade > 0) {
      points.centres.forEach((centre, i) => {
        const distancePc = Math.hypot(centre.x - cameraPc.x, centre.y - cameraPc.y, centre.z - cameraPc.z);
        const kept = points.keys[i] === dwarfStarsDrawn.key ? dwarfStarsDrawn.glowShare : 1;
        points.share.setX(i, (1 - volumeShare(points.halfLightPc[i]!, distancePc)) * kept);
      });
      points.share.needsUpdate = true;
      (pointUniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      pointUniforms['uPixelsPerRadian']!.value = pixelsPerRadian;
      renderer.getDrawingBufferSize(pointUniforms['uViewportPx']!.value as THREE.Vector2);
      pointUniforms['uFade']!.value = fade;
    }

    // The marks, about the camera, decluttered.
    marks.points.visible = markFade > 0;
    (markUniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
    markUniforms['uPixelRatio']!.value = renderer.getPixelRatio();
    markUniforms['uFade']!.value = markFade;
    if (markFade > 0) {
      const element = renderer.domElement;
      declutterMarks(marks, frameCamera, cameraPc, element.clientWidth, element.clientHeight);
    }
  });

  // Pointing and clicking a dwarf's mark, as a cluster's.
  useEffect(() => {
    const element = gl.domElement;
    const tip = document.createElement('div');
    Object.assign(tip.style, TIP_STYLE);
    element.parentElement?.appendChild(tip);
    const screen = new Float64Array(marks.list.length * 2);
    const scratch = new THREE.Vector3();
    const inverse = new THREE.Quaternion();
    const project = (): void => {
      const { cameraPc } = frame.current;
      camera.updateMatrixWorld();
      inverse.copy(camera.quaternion).invert();
      const e = camera.projectionMatrix.elements;
      const rect = element.getBoundingClientRect();
      marks.centres.forEach((centre, i) => {
        if (marks.shown.getX(i) === 0) {
          screen[i * 2] = Number.NaN;
          screen[i * 2 + 1] = Number.NaN;
          return;
        }
        scratch.set(centre.x - cameraPc.x, centre.y - cameraPc.y, centre.z - cameraPc.z).applyQuaternion(inverse);
        const depth = -scratch.z;
        screen[i * 2] = depth > 0 ? ((e[0]! * scratch.x) / depth + 1) * 0.5 * rect.width : Number.NaN;
        screen[i * 2 + 1] = depth > 0 ? (1 - (e[5]! * scratch.y) / depth) * 0.5 * rect.height : Number.NaN;
      });
    };
    const pick = (event: PointerEvent): number | null => {
      if (frame.current.markFade < 0.05) {
        return null;
      }
      project();
      const rect = element.getBoundingClientRect();
      return nearestMarker(screen, event.clientX - rect.left, event.clientY - rect.top, PICK_RADIUS_PX);
    };
    let down: { x: number; y: number } | null = null;
    let waiting = false;
    let lastMove: PointerEvent | null = null;
    const setPointing = (on: boolean): void => setMarkerPointer(element, 'local-group', on);
    const onDown = (event: PointerEvent): void => {
      down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const onUp = (event: PointerEvent): void => {
      const start = down;
      down = null;
      if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
        return;
      }
      const i = pick(event);
      if (i !== null) {
        tip.style.display = 'none';
        const entry = marks.list[i]!;
        (entry.volume ? pickVolumeRef.current : pickRef.current)(entry.k);
      }
    };
    const hover = (): void => {
      waiting = false;
      const event = lastMove;
      if (event === null) {
        return;
      }
      const i = down === null ? pick(event) : null;
      setPointing(i !== null);
      if (i === null) {
        tip.style.display = 'none';
        return;
      }
      const { galaxy } = marks.list[i]!;
      tip.textContent = `${galaxy.name} · ${formatGalaxyDistance(galaxy.distancePc)}`;
      tip.style.display = 'block';
      tip.style.transform = `translate(${screen[i * 2]! + 10}px, ${screen[i * 2 + 1]! - 22}px)`;
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
  }, [marks, gl, camera]);

  return <primitive object={group} />;
}

/** A galaxy's distance, as the tip and the panel write it: "147 kpc", "2.08 Mpc". */
export function formatGalaxyDistance(pc: number): string {
  return pc >= 1e6 ? `${(pc / 1e6).toFixed(2)} Mpc` : `${Math.round(pc / 1000)} kpc`;
}

const TIP_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  left: '0',
  display: 'none',
  pointerEvents: 'none',
  color: '#c9d4ff',
  fontSize: '0.66rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};
