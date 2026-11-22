import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  armLabelPoints,
  barLabelPoint,
  galacticCentrePc,
  POPULATIONS,
  type MilkyWaySample,
} from '../core/milkyWay.ts';
import type { SimClock } from '../core/time.ts';
import type { FramingView } from '../state/store.ts';
import { cieX, cieY, cieZ, starColor } from './blackbody.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { homeNames } from './homeName.ts';
import { boxOf, labelBoard } from './labelBoard.ts';
import { KM_PER_UNIT, LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';
import { beginLoading, wantLoading } from '../core/loading.ts';
import { milkyWayAhead } from '../core/prefetch.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { lensState, skyCapture } from './lens.ts';
import { binIntoCubes, reorder, slabRanges, type Cubes } from './milkyWaySlabs.ts';
import { sameView, underFloor, warpBetween, WARP_PX, type GlowView } from './milkyWayView.ts';
import { projectToScreen } from './screenProjection.ts';
import { GLOW_DISPLAY_GLSL, GLOW_FLOOR, milkyWayGlow } from './glowBuffer.ts';
import { ViewMotion } from './viewMotion.ts';
import { srgbToLinear } from './starRendering.ts';
import { splitHigh, splitLow } from './stars3dShader.ts';

/**
 * The Milky Way model of core/milkyWay.ts, drawn as a glow (D2b).
 *
 * Each sampled point is a soft sprite a fixed number of parsecs across, so the picture has
 * a surface brightness -- the same however far back the camera stands, as a galaxy's has
 * -- until a sprite is down to a pixel and a half, past which it keeps that size and gives
 * up light in proportion to the area it no longer covers. Added, not blended over: light
 * from behind light. Its parsecs are its population's, or wider where its population's points
 * are sparse -- the outer disc, round the bulge -- with its light kept, so the sample's grain is
 * not drawn as dots (core/milkyWay.ts spreadRadii).
 *
 * ## Drawn small, then laid over the picture
 *
 * A glow of splats costs its overlap: to read as smooth rather than as grain each pixel
 * wants tens of sprites on it, and at full resolution that was 300 million fragments a
 * frame from mid-distance -- 15 frames a second on the integrated GPU it was measured on.
 * A glow has no detail finer than its sprites, so it is drawn into a buffer at a quarter
 * of the canvas's pixels (GLOW_SCALE each way), in half floats so a hundred faint sprites
 * add up without rounding to nothing, and that buffer is laid over the frame first, under
 * everything else, with every other glow, by the one composite (GlowComposite.tsx): through
 * one soft shoulder (1 - e^-x) and encoded for the display as the stars are, the light past
 * white -- where the bulge piles up -- spilled into a halo by the stars' point spread rather
 * than thrown away (glowBuffer.ts). A quarter of the fragments, and the upsampling's filtering
 * smooths the grain. The colours go in as linear light, as every glow's does: the encode is
 * the composite's.
 *
 * ## Dust, drawn as what it does
 *
 * The dust (sampleDust) is a second set of points that darken instead of shine: each keeps
 * e^-tau of the light already in the buffer where it falls. Dust only dims what is behind
 * it, so the order matters, and a buffer of added light has none. So the galaxy is drawn
 * in DEPTH_SLICES slabs of distance from the camera, far to near, each in its own pass:
 * first that slab's dust, dimming everything already drawn -- the slabs behind it -- and
 * then that slab's light, added on top. The dust on the far side of the galaxy then
 * leaves the bulge alone, and the dust between the camera and the bulge crosses it, as a
 * lane does in every photograph of an edge-on spiral.
 *
 * Two attempts came before, both order-free and both wrong in the same way. A straight
 * multiply dimmed the stars in front of the dust as hard as those behind, and seen edge-on
 * turned the plane to a black bar ("se ve full negro"); the mixed-slab escape fraction,
 * (1 - e^-tau)/tau, fixed the black but still let dust behind the centre darken it, so the
 * bulge looked to sit behind the disc from every side ("la luz del centro se pone atrÃ¡s
 * de todo") -- Maxi, both 2026-10-28.
 *
 * Inside a slab the light is drawn after its own dust, so it is never dimmed by the dust
 * it is mixed with: an error of half a slab's depth, a few kiloparsecs, where the slabs
 * are thinnest -- across the disc.
 *
 * Each slab's pass is handed only the points that can fall in it, cubes of them at a time
 * (milkyWaySlabs.ts), not every point for the vertex shader to turn five in six away.
 *
 * **The slabs' edges are soft.** With hard ones the light just behind an edge took all
 * the dust of the slab in front and the light just in front of it took none, and that
 * step showed: a dark line across the disc where the edge -- a sphere about the camera --
 * cut it, moving as the camera moved (Maxi, 2026-10-28: "siempre sigue a la cÃ¡mara").
 * So a point within SLAB_BLEND of an edge goes into both slabs, its light and its tau
 * shared between them in proportion -- the two shares adding to the whole, and e^-tau
 * multiplying to the whole -- and the step becomes a ramp a slab wide.
 *
 * It fades in as the camera leaves the star catalogue behind, from GALAXY_FROM_LY to
 * GALAXY_FULL_LY from the Sun, and stays out of the neighbourhood of the camera, where a
 * sprite standing for a cloud of a million stars would be a blot rather than a glow.
 *
 * Precision is the 3D stars' (stars3dShader.ts): points are float32 parsecs about the
 * Sun, the group sits at the camera, and the camera about the Sun comes as a float32 pair.
 *
 * ## Drawn when it changes, and smaller while it moves
 *
 * The six slabs of sprites are the dearest thing in the picture -- 25 ms a frame with the galaxy
 * filling the screen, 7 or 8 with it a speck, on the integrated GPU it was measured on -- and the
 * galaxy never changes: only where it is seen from does. So the buffer is drawn only when the
 * view has changed (milkyWayView.ts):
 *
 * - **still**, the buffer from the last drawing is this frame's, bit for bit, and is kept;
 * - **too faint to draw**, from where every sprite is under the buffer's floor, nothing is drawn;
 * - **moving, the galaxy small on screen**, the last drawing is laid where this frame puts it, as
 *   long as no part of the galaxy lands more than half a pixel of the buffer -- one of the
 *   screen's -- from where a fresh one would;
 * - **moving otherwise**, it is drawn into a buffer half as wide and half as tall (MOVING_SCALE),
 *   a quarter of the fragments, its sprites sized for that buffer and capped at the same share of
 *   their light (uMaxSpritePx);
 * - and once the camera has been at rest for a tenth of a second it is drawn in full again
 *   (viewMotion.ts), and kept.
 *
 * While a black hole's lens is on, which reads this buffer as the main camera saw it
 * (BlackHoleLens.tsx), it is always drawn in full for the frame in hand.
 */

/** How many points the model's light is drawn with; each population's size is its own. */
export const GALAXY_POINTS = 200_000;

/** Light each sprite adds at its centre, times its population's gain, before the shoulder. */
export const GALAXY_POINT_PEAK = 0.04;

/**
 * How many slabs of depth the galaxy is drawn in, and how far either side of its centre
 * they reach, pc: the disc's radius and some.
 */
export const DEPTH_SLICES = 6;
export const GALAXY_DEPTH_PC = 20_000;

/**
 * Half the width of the ramp across a slab's edge, in slabs: a point this close to an
 * edge is shared between the slabs either side of it.
 */
export const SLAB_BLEND = 0.35;

/** The dust: how many points, how wide each, and the optical depth each adds at its centre. */
export const DUST_POINTS = 80_000;
export const DUST_RADIUS_PC = 200;
export const DUST_TAU = 0.08;

/**
 * The HII regions' colour: hydrogen's two brightest visible lines, H-alpha at 656.28 nm
 * and H-beta at 486.13 nm, at the Balmer decrement of 2.86 that recombination gives at
 * 10,000 K (Osterbrock & Ferland 2006, Case B) -- through the CIE observer to sRGB, as
 * the stars' blackbodies go. The pink every photograph of a nebula has, worked out.
 */
export const BALMER_DECREMENT = 2.86;

/** The glow buffer's size against the canvas's device pixels, each way. */
export const GLOW_SCALE = 0.5;

/** Smallest sprite, glow-buffer pixels; below the size its parsecs would give, light goes instead. */
const MIN_SPRITE_PX = 1.5;
/**
 * Largest sprite, glow-buffer pixels, for a point at its population's own radius: past it the
 * sprite is drawn this size and the rest of its light is lost -- as near the camera, where the
 * near fade is taking it. A point spread where its population is sparse (spreadRadii) may be as
 * many times larger as it was spread: some 50 pixels across from the breadcrumb's view of the
 * whole galaxy, which cut to 16 lost nine tenths of its light, and the outer disc went dark
 * instead of smooth. The points at their own radius, near the camera, are cut as they were.
 */
const MAX_SPRITE_PX = 16;

/** The buffer drawn while the camera moves, against the full one, each way (see the header). */
export const MOVING_SCALE = 0.5;

/** The model fades in between these camera distances from the Sun, light years. */
export const GALAXY_FROM_LY = 1000;
export const GALAXY_FULL_LY = 5000;

/** The sample is asked of the worker from here, so it is in hand before the fade starts. */
export const GALAXY_SAMPLE_FROM_LY = 500;

/**
 * Below this angle between the line of sight and the galactic plane the arms' names go:
 * edge-on, the arms lie along one line and their names pile on top of each other.
 */
const EDGE_ON_LABELS_DEG = 12;

/**
 * The centre's name as the model's parts are named, and as a galaxy's body is (App.tsx
 * LABEL_STYLE) once the galaxy is a point and its name is the Milky Way's (homeName.ts).
 */
const MODEL_NAME_STYLE: Partial<CSSStyleDeclaration> = {
  color: '#9aa4b4',
  fontStyle: 'italic',
  fontSize: '0.64rem',
  letterSpacing: '0.12em',
  textTransform: 'none',
};
const FOLDED_NAME_STYLE: Partial<CSSStyleDeclaration> = {
  color: '#c0c0c0',
  fontStyle: 'normal',
  fontSize: '0.72rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

/**
 * Home's name from afar -- Milky Way, Local Group, Local Volume, You are here, Nearby Universe:
 * the name the Sun's point folds into (homeName.ts) -- is a way home: clicked, it takes the
 * camera back to the Solar System, as the breadcrumb's Solar System does (Maxi, 2026-11-17:
 * "no podés tocar el you are here para volver"; and from the Nearby Universe, "si toco para
 * volver no me deja"). The Galactic Centre's, a part of the model seen from inside it, is
 * only a name.
 */
export function isHomeName(name: string | null): boolean {
  return name !== null && name !== '' && name !== 'Galactic Centre';
}
const CLICKABLE_STYLE: Partial<CSSStyleDeclaration> = { pointerEvents: 'auto', cursor: 'pointer' };
const UNCLICKABLE_STYLE: Partial<CSSStyleDeclaration> = { pointerEvents: '', cursor: '' };

/** How far left of its point the folded name stands, pixels. */
const CENTRE_LABEL_GAP_PX = 8;
/**
 * How far above its point the Galactic Centre's name stands, pixels: clear of Sgr A*'s name
 * beside it -- by the clear space the labels' declutter keeps about a name (LabelProjector
 * LABEL_PADDING_PX) and as much again for Sgr A* lying a few pixels off the model's centre --
 * so the two are both shown (labelBoard.ts).
 */
const CENTRE_LABEL_ABOVE_PX = 16;

/** Points nearer the camera than this share of its distance from the Sun fade out. */
const NEAR_FADE_SHARE = 0.35;

/**
 * Where the breadcrumb's Milky Way looks from: above the north galactic pole, tipped 20
 * degrees so the disc reads as a disc with a thickness, and turned so the line from the
 * Sun to the centre runs across the frame -- the long way, since the frame is wider than
 * it is tall and the disc reaches 76,000 ly past the centre but only 23,000 behind the
 * Sun. Seen from the north pole the galaxy turns clockwise, as Reid et al. draw it.
 */
export const GALAXY_VIEW: FramingView = (() => {
  const tilt = (20 * Math.PI) / 180;
  const { y, z } = GALACTIC_BASIS;
  const direction = [
    z.x * Math.cos(tilt) - y.x * Math.sin(tilt),
    z.y * Math.cos(tilt) - y.y * Math.sin(tilt),
    z.z * Math.cos(tilt) - y.z * Math.sin(tilt),
  ] as const;
  const up = [
    y.x * Math.cos(tilt) + z.x * Math.sin(tilt),
    y.y * Math.cos(tilt) + z.y * Math.sin(tilt),
    y.z * Math.cos(tilt) + z.z * Math.sin(tilt),
  ] as const;
  return { direction, up };
})();

/** Galaxy visibility, 0 to 1, by the camera's distance from the Sun. */
export function galaxyVisibility(cameraFromSunKm: number): number {
  const ly = cameraFromSunKm / LIGHT_YEAR_KM;
  if (ly <= GALAXY_FROM_LY) return 0;
  if (ly >= GALAXY_FULL_LY) return 1;
  const t = (Math.log(ly) - Math.log(GALAXY_FROM_LY)) / (Math.log(GALAXY_FULL_LY) - Math.log(GALAXY_FROM_LY));
  return t * t * (3 - 2 * t);
}

/**
 * The sprite's profile: a Gaussian of sigma a fifth of the sprite, e^(-r^2 / 2 sigma^2), less
 * its value at the sprite's half-width, 2.5 sigma -- so it goes to nothing at the circle the
 * sprite's square holds, with no edge -- times `scale`, the light the whole Gaussian held over
 * the square over the light this holds: each point's light the same as before.
 */
export const SPRITE_KERNEL = (() => {
  const edge = Math.exp(-0.5 * 2.5 * 2.5);
  // Over the square, in sigmas: (sqrt(2 pi) erf(2.5 / sqrt 2))^2; over the disc, 2 pi (1 - edge - edge 2.5^2 / 2).
  const erf = (x: number): number => {
    // Abramowitz & Stegun 7.1.26, to 1.5e-7.
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return y;
  };
  const square = 2 * Math.PI * erf(2.5 / Math.SQRT2) ** 2;
  const disc = 2 * Math.PI * (1 - edge - edge * 3.125);
  return { edge, scale: square / disc };
})();

const VERTEX_SHADER = /* glsl */ `
uniform vec3 uCameraHigh;
uniform vec3 uCameraLow;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uPeak;
uniform float uNearFadePc;
// MAX_SPRITE_PX in this buffer's pixels: the same share of the sprite's light kept in the
// smaller buffer drawn while the camera moves (see the header).
uniform float uMaxSpritePx;
// This pass's slab: nearest edge and depth of a slab, pc; its index; how many there are.
// Points outside it wait for theirs; points near an edge go into both (see the header).
uniform vec4 uSlab;

attribute vec3 color;
attribute float radiusPc;
// How many times its population's own radius it is drawn at (spreadRadii): its largest size, too.
attribute float spread;

varying vec3 vColor;
varying float vPeak;

void main() {
  vec3 rel = (position - uCameraHigh) - uCameraLow;
  float distancePc = length(rel);
  float u = (distancePc - uSlab.x) / uSlab.y;
  float halfBlend = ${SLAB_BLEND.toFixed(3)};
  float below = uSlab.z < 0.5 ? 1.0 : clamp((u - uSlab.z + halfBlend) / (2.0 * halfBlend), 0.0, 1.0);
  float above = uSlab.z > uSlab.w - 1.5 ? 0.0 : clamp((u - uSlab.z - 1.0 + halfBlend) / (2.0 * halfBlend), 0.0, 1.0);
  float share = below - above;
  if (share <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vPeak = 0.0;
    vColor = vec3(0.0);
    return;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);

  float diameterPx = 2.0 * radiusPc / max(distancePc, 1e-3) * uPixelsPerRadian;
  float drawnPx = clamp(diameterPx, ${MIN_SPRITE_PX.toFixed(1)}, uMaxSpritePx * spread);
  // Below the floor the light goes, not the size: constant flux per point.
  float coverage = min(1.0, (diameterPx * diameterPx) / (drawnPx * drawnPx));
  vPeak = uPeak * share * coverage * smoothstep(0.5 * uNearFadePc, uNearFadePc, distancePc);
  gl_PointSize = drawnPx;
  vColor = color;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
// 0 for light, added; 1 for dust, which keeps e^-tau of what is behind it.
uniform float uDust;

varying vec3 vColor;
varying float vPeak;

void main() {
  vec2 offset = gl_PointCoord - vec2(0.5);
  // A Gaussian reaching the sprite's edge at 2.5 sigma, less its value there, so that it
  // falls to nothing at a circle inside the sprite rather than stopping at the sprite's
  // square at 4 % of its peak (SPRITE_KERNEL); scaled to hold the light it held.
  float r2 = dot(offset, offset) * 25.0;
  float profile = max(exp(-0.5 * r2) - ${SPRITE_KERNEL.edge.toFixed(6)}, 0.0) * ${SPRITE_KERNEL.scale.toFixed(6)};
  // Under the glow buffer's floor, which rounds to black (glowBuffer.ts GLOW_FLOOR): not drawn.
  if (vPeak * profile < ${GLOW_FLOOR.toPrecision(6)}) discard;
  float amount = vPeak * profile;
  gl_FragColor = uDust > 0.5 ? vec4(vec3(1.0 - exp(-amount)), 1.0) : vec4(vColor * amount, 1.0);
}
`;

/**
 * The glow buffer through the soft shoulder and the encode alone, no halo: what the black
 * hole's lens draws into its cube (BlackHoleLens.tsx). On the frame the buffer goes through
 * GlowComposite.tsx.
 */
export const COMPOSITE_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uGlow;
varying vec2 vUv;
${GLOW_DISPLAY_GLSL}
void main() {
  gl_FragColor = vec4(glowDisplay(texture2D(uGlow, vUv).rgb), 1.0);
}
`;

/**
 * A kept drawing laid where this frame puts it (milkyWayView.ts warpBetween): each pixel of the
 * buffer looks up its place in the kept one through the homography, and what falls outside the
 * kept one is dark -- the galaxy was wholly inside it.
 */
const CARRY_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uKept;
uniform mat3 uWarp;
varying vec2 vUv;
void main() {
  vec3 at = uWarp * vec3(vUv, 1.0);
  vec2 uv = at.xy / at.z;
  bool inside = at.z > 0.0 && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  gl_FragColor = inside ? vec4(texture2D(uKept, uv).rgb, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
}
`;

/** The brightest a sprite's profile is, at its centre (FRAGMENT_SHADER). */
const PROFILE_CENTRE = (1 - SPRITE_KERNEL.edge) * SPRITE_KERNEL.scale;

const scratchCamera = new THREE.Vector3();
const scratchClear = new THREE.Color();
const scratchPoint = new THREE.Vector3();

/** Galactic-frame parsecs about the Sun to the scene's ecliptic frame. */
function toEcliptic(x: number, y: number, z: number, out: Float32Array | number[], offset: number): void {
  const { x: ex, y: ey, z: ez } = GALACTIC_BASIS;
  out[offset] = ex.x * x + ey.x * y + ez.x * z;
  out[offset + 1] = ex.y * x + ey.y * y + ez.y * z;
  out[offset + 2] = ex.z * x + ey.z * y + ez.z * z;
}

/**
 * A colour index as a hue of linear light: the blackbody colour, brightest channel 1. Linear,
 * as the glow buffer holds light; the composite encodes it for the display. It was the display
 * hue, encoded, when the composite did not encode -- through the encode now, that would be
 * encoded twice and washed out.
 */
function linearHue(colorIndex: number): [number, number, number] {
  const [r, g, b] = starColor(colorIndex);
  const peak = Math.max(r, g, b);
  return [r / peak, g / peak, b / peak];
}

/** An emission spectrum of lines as a display hue: CIE 1931, then sRGB, brightest channel 1. */
export function emissionHue(lines: readonly (readonly [number, number])[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [wavelengthNm, power] of lines) {
    x += power * cieX(wavelengthNm);
    y += power * cieY(wavelengthNm);
    z += power * cieZ(wavelengthNm);
  }
  const linear = [
    Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z),
    Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z),
    Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z),
  ];
  const peak = Math.max(...linear);
  const encode = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return [encode(linear[0]! / peak), encode(linear[1]! / peak), encode(linear[2]! / peak)];
}

/** Hydrogen's visible recombination light: H-alpha to H-beta at the Balmer decrement. */
export const BALMER_HUE = emissionHue([
  [656.28, BALMER_DECREMENT],
  [486.13, 1],
]);

/**
 * The points as drawn: each at its radius (spreadRadii -- its population's own, or wider where
 * its population is sparse), its colour times its gain taken down by the square of the widening,
 * so that its light, peak times area, is the same however wide it is drawn.
 */
function buildGeometry(sample: MilkyWaySample, spread: Float32Array): { cloud: SlabbedCloud; bounds: GalaxyBounds } {
  const positions = new Float32Array(sample.count * 3);
  const colors = new Float32Array(sample.count * 3);
  const radii = new Float32Array(sample.count);
  const spreads = new Float32Array(sample.count);
  const looks = POPULATIONS.map((population) => {
    const hue = population.colorIndex === null ? BALMER_HUE.map(srgbToLinear) : linearHue(population.colorIndex);
    return { color: hue.map((channel) => channel * population.gain), radius: population.radiusPc };
  });
  for (let i = 0; i < sample.count; i += 1) {
    toEcliptic(sample.positions[i * 3]!, sample.positions[i * 3 + 1]!, sample.positions[i * 3 + 2]!, positions, i * 3);
    const look = looks[sample.populations[i]!]!;
    const radius = Math.max(look.radius, spread[i]!);
    const thinned = (look.radius / radius) ** 2;
    colors[i * 3] = look.color[0]! * thinned;
    colors[i * 3 + 1] = look.color[1]! * thinned;
    colors[i * 3 + 2] = look.color[2]! * thinned;
    radii[i] = radius;
    spreads[i] = radius / look.radius;
  }
  return { cloud: slabbedCloud(positions, colors, radii, spreads), bounds: galaxyBounds(positions, radii) };
}

/**
 * A set of points as drawn, binned into cubes, with the index that hands each slab's pass only
 * the cubes reaching into it (milkyWaySlabs.ts) and each slab's range of it, worked out for
 * `filledFor` -- the slabs and the camera's place -- and again whenever those change.
 */
interface SlabbedCloud {
  readonly geometry: THREE.BufferGeometry;
  readonly cubes: Cubes;
  readonly ranges: Int32Array;
  filledFor: readonly number[] | null;
}

function slabbedCloud(positions: Float32Array, colors: Float32Array, radii: Float32Array, spreads: Float32Array): SlabbedCloud {
  const { order, cubes } = binIntoCubes(positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(reorder(positions, 3, order), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(reorder(colors, 3, order), 3));
  geometry.setAttribute('radiusPc', new THREE.BufferAttribute(reorder(radii, 1, order), 1));
  geometry.setAttribute('spread', new THREE.BufferAttribute(reorder(spreads, 1, order), 1));
  // A cube reaches at most two slabs (milkyWaySlabs.ts CUBE_PC): room for every point three times.
  const index = new THREE.BufferAttribute(new Uint32Array(order.length * 3), 1);
  index.setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(index);
  return { geometry, cubes, ranges: new Int32Array(2 * DEPTH_SLICES), filledFor: null };
}

/** The cloud's index and ranges for these slabs from this place, if they are not already. */
function fillSlabs(cloud: SlabbedCloud, key: readonly number[]): void {
  const last = cloud.filledFor;
  if (last !== null && last.every((value, i) => value === key[i])) return;
  const [nearest, step, x, y, z] = key as [number, number, number, number, number];
  const index = cloud.geometry.getIndex()!;
  const written = slabRanges(cloud.cubes, [x, y, z], nearest, step, DEPTH_SLICES, SLAB_BLEND, index.array as Uint32Array, cloud.ranges);
  index.clearUpdateRanges();
  index.addUpdateRange(0, written);
  index.needsUpdate = true;
  cloud.filledFor = key.slice();
}

/** A sphere holding every point of the light, about the model's centre, and the widest sprite: for milkyWayView.ts. */
interface GalaxyBounds {
  readonly centre: readonly [number, number, number];
  readonly radiusPc: number;
  readonly largestPc: number;
}

function galaxyBounds(positions: Float32Array, radii: Float32Array): GalaxyBounds {
  const centre = LABEL_POINTS[0]! as [number, number, number];
  let farthest = 0;
  for (let i = 0; i < radii.length; i += 1) {
    const d = Math.hypot(positions[i * 3]! - centre[0], positions[i * 3 + 1]! - centre[1], positions[i * 3 + 2]! - centre[2]);
    farthest = Math.max(farthest, d);
  }
  let largest = 0;
  for (let i = 0; i < radii.length; i += 1) largest = Math.max(largest, radii[i]!);
  // A parsec over, for float32's rounding of the positions.
  return { centre, radiusPc: farthest + 1, largestPc: largest };
}

/** The dust's points: grey, so the multiply darkens every channel alike. */
function buildDustGeometry(dust: Float32Array): SlabbedCloud {
  const count = dust.length / 3;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    toEcliptic(dust[i * 3]!, dust[i * 3 + 1]!, dust[i * 3 + 2]!, positions, i * 3);
  }
  return slabbedCloud(
    positions,
    new Float32Array(count * 3).fill(1),
    new Float32Array(count).fill(DUST_RADIUS_PC),
    new Float32Array(count).fill(1),
  );
}

/** The names on the model: the Galactic Centre first, then the arms in SPIRAL_ARMS order, then the bar. */
export const GALAXY_LABELS: readonly string[] = [
  'Galactic Centre',
  ...armLabelPoints().map((arm) => arm.name),
  barLabelPoint().name,
];

const LABEL_POINTS: readonly number[][] = (() => {
  const [cx, cy, cz] = galacticCentrePc();
  const points = [[cx, cy, cz], ...armLabelPoints().map((arm) => arm.position), barLabelPoint().position];
  return points.map(([x, y, z]) => {
    const out = [0, 0, 0];
    toEcliptic(x!, y!, z!, out, 0);
    return out;
  });
})();

export interface MilkyWayProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /** The labels, in GALAXY_LABELS order, owned by the overlay outside the canvas. */
  readonly labels: RefObject<(HTMLElement | null)[]>;
}

export function MilkyWay({ store, clock, focus, visible, labels }: MilkyWayProps) {
  const { camera, size, gl } = useThree();
  const points = useRef<THREE.Points | null>(null);
  const dustPoints = useRef<THREE.Points | null>(null);
  const sampleAsked = useRef(false);
  const worker = useRef<Worker | null>(null);
  // The sample's name on the loading line while the worker makes it (core/loading.ts).
  const sampleLoading = useRef<(() => void) | null>(null);

  // The glow's own scene and buffers: the full one, and the one drawn while the camera moves,
  // which also takes a kept drawing carried over from the full one (see the header).
  const glowScene = useMemo(() => new THREE.Scene(), []);
  const [target, movingTarget] = useMemo(() => {
    const make = (): THREE.WebGLRenderTarget =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
    return [make(), make()] as const;
  }, []);
  // The buffer shown this frame, for the one composite that lays every glow over the frame
  // (GlowComposite.tsx): set each frame to whichever holds it.
  useEffect(() => {
    milkyWayGlow.texture = target.texture;
    return () => {
      milkyWayGlow.texture = null;
      milkyWayGlow.on = false;
    };
  }, [target]);

  // Carrying a kept drawing to this frame's view: a quad over the buffer (CARRY_FRAGMENT_SHADER).
  const carry = useMemo(() => {
    const scene = new THREE.Scene();
    const material = new THREE.ShaderMaterial({
      uniforms: { uKept: { value: null }, uWarp: { value: new THREE.Matrix3() } },
      vertexShader: COMPOSITE_VERTEX_SHADER,
      fragmentShader: CARRY_FRAGMENT_SHADER,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);
    return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad, material };
  }, []);
  useEffect(
    () => () => {
      carry.quad.geometry.dispose();
      carry.material.dispose();
    },
    [carry],
  );

  // The last drawing: what it was drawn from, into which buffer, and whether in full.
  const kept = useRef<{ view: GlowView; into: THREE.WebGLRenderTarget; full: boolean } | null>(null);
  const motion = useMemo(() => new ViewMotion(), []);
  const bounds = useRef<GalaxyBounds | null>(null);

  // The light and the dust share every uniform but their peak.
  const [material, dustMaterial] = useMemo(() => {
    const shared = {
      uCameraHigh: { value: new THREE.Vector3() },
      uCameraLow: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: PARSEC_KM / KM_PER_UNIT },
      uPixelsPerRadian: { value: 1 },
      uNearFadePc: { value: 0 },
      uMaxSpritePx: { value: MAX_SPRITE_PX },
      uSlab: { value: new THREE.Vector4(0, 1e30, 0, 1) },
    };
    const common = { depthWrite: false, transparent: true, toneMapped: false } as const;
    // Light adds.
    const light = new THREE.ShaderMaterial({
      uniforms: { ...shared, uPeak: { value: 0 }, uDust: { value: 0 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      ...common,
    });
    // dst = dst (1 - src) with src = 1 - e^-tau: dust keeps e^-tau of what is behind it.
    const dust = new THREE.ShaderMaterial({
      uniforms: { ...shared, uPeak: { value: 0 }, uDust: { value: 1 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcColorFactor,
      ...common,
    });
    return [light, dust] as const;
  }, []);

  const group = useMemo(() => {
    const made = new THREE.Group();
    glowScene.add(made);
    return made;
  }, [glowScene]);

  useEffect(
    () => () => {
      worker.current?.terminate();
      sampleLoading.current?.();
      points.current?.geometry.dispose();
      dustPoints.current?.geometry.dispose();
      material.dispose();
      dustMaterial.dispose();
      target.dispose();
      movingTarget.dispose();
    },
    [material, dustMaterial, target, movingTarget],
  );

  // This frame's slabs and the camera's place about the Sun, pc: worked out in the frame, read
  // again by the lens's capture.
  const slabs = useRef({ nearest: 0, step: 1, camera: [0, 0, 0] as [number, number, number] });
  // The light's and the dust's points, binned for the slabs (milkyWaySlabs.ts).
  const clouds = useRef<{ light: SlabbedCloud; dust: SlabbedCloud } | null>(null);

  /** The glow into `into`, through `through`, with the uniforms as this frame set them. */
  const drawGlow = (renderer: THREE.WebGLRenderer, through: THREE.Camera, into: THREE.WebGLRenderTarget): void => {
    const previous = renderer.getRenderTarget();
    renderer.getClearColor(scratchClear);
    const clearAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(into);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    const slab = material.uniforms['uSlab']!.value as THREE.Vector4;
    // Each slab's pass is handed only the points that can have a share of it.
    const { nearest, step, camera: at } = slabs.current;
    const key = [nearest, step, at[0], at[1], at[2]];
    const both = clouds.current;
    if (both !== null) {
      fillSlabs(both.light, key);
      fillSlabs(both.dust, key);
    }
    // Each pass draws over the last: the renderer must not clear between them.
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    for (let index = DEPTH_SLICES - 1; index >= 0; index -= 1) {
      slab.set(nearest, step, index, DEPTH_SLICES);
      if (both !== null) {
        for (const cloud of [both.light, both.dust]) {
          cloud.geometry.setDrawRange(cloud.ranges[2 * index]!, cloud.ranges[2 * index + 1]!);
        }
      }
      renderer.render(glowScene, through);
    }
    renderer.autoClear = autoClear;
    renderer.setRenderTarget(previous);
    renderer.setClearColor(scratchClear, clearAlpha);
  };

  // The lens's cube map draws the glow through each of its faces: the same points and
  // slabs, the sprites sized for the face (lens.ts).
  useEffect(() => {
    skyCapture.paint = (renderer, through, into, pixelsPerRadian) => {
      const uniform = material.uniforms['uPixelsPerRadian']!;
      const cap = material.uniforms['uMaxSpritePx']!;
      const keptPixels = uniform.value as number;
      const keptCap = cap.value as number;
      uniform.value = pixelsPerRadian;
      cap.value = MAX_SPRITE_PX;
      drawGlow(renderer, through, into);
      uniform.value = keptPixels;
      cap.value = keptCap;
    };
    skyCapture.screen = target.texture;
    return () => {
      skyCapture.paint = null;
      skyCapture.screen = null;
      skyCapture.visibility = 0;
    };
    // drawGlow reads only what these hold, and the slabs' ref.
  }, [material, target, glowScene]);

  useFrame(() => {
    const elements = labels.current;
    const sun = visible ? store.sunFromFocus(focus, clock.tdbJulianDay) : null;
    const cameraFromSunKm =
      sun === null
        ? 0
        : scratchCamera
            .set(
              camera.position.x * KM_PER_UNIT - sun.position.x,
              camera.position.y * KM_PER_UNIT - sun.position.y,
              camera.position.z * KM_PER_UNIT - sun.position.z,
            )
            .length();
    // The sample, from the worker, once the camera is on its way out -- or before, asked for
    // ahead of it (core/prefetch.ts), off the loading line until the camera gets there.
    const sampleWanted = cameraFromSunKm > GALAXY_SAMPLE_FROM_LY * LIGHT_YEAR_KM;
    if (sampleWanted) wantLoading('the Milky Way');
    if (!sampleAsked.current && (sampleWanted || (sun !== null && milkyWayAhead()))) {
      sampleAsked.current = true;
      const made = new Worker(new URL('../core/milkyWay.worker.ts', import.meta.url), { type: 'module' });
      worker.current = made;
      sampleLoading.current = beginLoading('the Milky Way', !sampleWanted);
      made.onmessage = (event: MessageEvent<{ light: MilkyWaySample; radii: Float32Array; dust: Float32Array }>) => {
        const built = buildGeometry(event.data.light, event.data.radii);
        bounds.current = built.bounds;
        // Whatever was drawn before was drawn without it.
        kept.current = null;
        const builtDust = buildDustGeometry(event.data.dust);
        clouds.current = { light: built.cloud, dust: builtDust };
        const cloud = new THREE.Points(built.cloud.geometry, material);
        cloud.frustumCulled = false;
        // In each slab, after its dust: see the header.
        cloud.renderOrder = 1;
        group.add(cloud);
        points.current = cloud;
        // Before its slab's light, after every slab behind.
        const dust = new THREE.Points(builtDust.geometry, dustMaterial);
        dust.frustumCulled = false;
        dust.renderOrder = 0;
        group.add(dust);
        dustPoints.current = dust;
        made.terminate();
        worker.current = null;
        sampleLoading.current?.();
        skyCapture.revision += 1;
        renderDemand.request();
      };
      made.postMessage({ count: GALAXY_POINTS, dust: DUST_POINTS });
    }

    const visibility = sun === null || points.current === null ? 0 : galaxyVisibility(cameraFromSunKm);
    // For a black hole's lens, which draws this glow again into its own cube (lens.ts).
    skyCapture.visibility = visibility;
    if (visibility === 0) {
      milkyWayGlow.on = false;
      kept.current = null;
      for (const element of elements) {
        hide(element);
      }
      return;
    }

    milkyWayGlow.on = true;
    group.position.copy(camera.position);
    const cameraPc = scratchCamera.multiplyScalar(1 / PARSEC_KM);
    const uniforms = material.uniforms;
    (uniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(cameraPc.x), splitHigh(cameraPc.y), splitHigh(cameraPc.z));
    (uniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(cameraPc.x), splitLow(cameraPc.y), splitLow(cameraPc.z));
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const width = Math.max(1, Math.round(size.width * gl.getPixelRatio() * GLOW_SCALE));
    const height = Math.max(1, Math.round(size.height * gl.getPixelRatio() * GLOW_SCALE));
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height);
      // Its drawing went with its old size.
      if (kept.current?.into === target) kept.current = null;
    }
    const tanHalfFov = Math.tan((fov * Math.PI) / 360);
    const pixelsPerRadian = height / (2 * tanHalfFov);
    uniforms['uPeak']!.value = GALAXY_POINT_PEAK * visibility;
    dustMaterial.uniforms['uPeak']!.value = DUST_TAU * visibility;
    uniforms['uNearFadePc']!.value = NEAR_FADE_SHARE * cameraPc.length();

    // The glow, into its buffer, through this frame's camera (CameraRig ran first).
    // Far to near, slab by slab: see the header. The slabs span the galaxy as seen from
    // here, GALAXY_DEPTH_PC either side of its centre; the first and last run on to
    // nothing and to everything, so no point is left out.
    const centre = LABEL_POINTS[0]!;
    const toCentre = Math.hypot(centre[0]! - cameraPc.x, centre[1]! - cameraPc.y, centre[2]! - cameraPc.z);
    slabs.current.nearest = Math.max(0, toCentre - GALAXY_DEPTH_PC);
    slabs.current.step = (toCentre + GALAXY_DEPTH_PC - slabs.current.nearest) / DEPTH_SLICES;
    slabs.current.camera = [cameraPc.x, cameraPc.y, cameraPc.z];

    // Drawn only when the view has changed, and smaller or carried over while it moves: see
    // the header and milkyWayView.ts.
    camera.updateMatrixWorld();
    const moving = motion.moved(camera);
    const extent = bounds.current!;
    const galaxyDistancePc = Math.hypot(extent.centre[0] - cameraPc.x, extent.centre[1] - cameraPc.y, extent.centre[2] - cameraPc.z);
    const peak = uniforms['uPeak']!.value as number;
    if (underFloor(peak, galaxyDistancePc, extent.radiusPc, extent.largestPc, pixelsPerRadian, MIN_SPRITE_PX, PROFILE_CENTRE, GLOW_FLOOR)) {
      // Every sprite would be discarded: an empty buffer, so none at all.
      milkyWayGlow.on = false;
      kept.current = null;
    } else {
      const view: GlowView = {
        position: [cameraPc.x, cameraPc.y, cameraPc.z],
        world: camera.matrixWorld.elements.slice(),
        projection: camera.projectionMatrix.elements.slice(),
        width,
        height,
        visibility,
      };
      const last = kept.current;
      let shown: THREE.WebGLRenderTarget;
      if (last !== null && last.full && sameView(last.view, view)) {
        shown = last.into;
      } else {
        const warp = moving && !lensState.on && last !== null ? warpBetween(last.view, view, extent.centre, extent.radiusPc) : null;
        if (warp !== null && warp.errorPx <= WARP_PX) {
          // Into the other buffer: the kept drawing stays where it is, for the next frame.
          const into = last!.into === target ? movingTarget : target;
          if (into === movingTarget) sizeMoving(movingTarget, width, height);
          carry.material.uniforms['uKept']!.value = last!.into.texture;
          (carry.material.uniforms['uWarp']!.value as THREE.Matrix3).fromArray(warp.uv).transpose();
          const previous = gl.getRenderTarget();
          gl.setRenderTarget(into);
          gl.render(carry.scene, carry.camera);
          gl.setRenderTarget(previous);
          shown = into;
        } else {
          const full = !moving || lensState.on;
          const into = full ? target : movingTarget;
          if (!full) sizeMoving(movingTarget, width, height);
          uniforms['uPixelsPerRadian']!.value = into.height / (2 * tanHalfFov);
          uniforms['uMaxSpritePx']!.value = (MAX_SPRITE_PX * into.height) / height;
          drawGlow(gl, camera, into);
          kept.current = { view, into, full };
          shown = into;
        }
      }
      milkyWayGlow.texture = shown.texture;
    }

    // The names: the Sun's place plus each label's parsecs, in scene units.
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    // How far out of the plane the camera looks from, as seen from the Sun.
    const pole = GALACTIC_BASIS.z;
    const outOfPlane = Math.abs(
      (scratchCamera.x * pole.x + scratchCamera.y * pole.y + scratchCamera.z * pole.z) / scratchCamera.length(),
    );
    const edgeOn = outOfPlane < Math.sin((EDGE_ON_LABELS_DEG * Math.PI) / 180);
    // From where the galaxy is a point, its centre's name is the galaxy's and the arms go.
    const home = homeNames(scratchCamera.length() * PARSEC_KM, size.height, fov);
    const centreName = home.centre;
    // Named as one thing, the Milky Way; and, sooner, too small for its arms' names.
    const folded = home.galaxyFolded;
    const armsHidden = !home.arms;
    LABEL_POINTS.forEach((point, index) => {
      const element = elements[index] ?? null;
      if (element === null) {
        return;
      }
      if (index === 0 && element.textContent !== centreName) {
        element.textContent = centreName;
        // Named as a galaxy is, as Andromeda beside it is, not as a part of the model.
        Object.assign(element.style, folded ? FOLDED_NAME_STYLE : MODEL_NAME_STYLE);
        Object.assign(element.style, isHomeName(centreName) ? CLICKABLE_STYLE : UNCLICKABLE_STYLE);
      }
      // The Galactic Centre keeps its name from any side; the arms only off the plane.
      if (visibility < 0.5 || (index > 0 && (edgeOn || armsHidden))) {
        hide(element);
        return;
      }
      scratchPoint.set(
        sun!.position.x / KM_PER_UNIT + point[0]! * unitsPerPc,
        sun!.position.y / KM_PER_UNIT + point[1]! * unitsPerPc,
        sun!.position.z / KM_PER_UNIT + point[2]! * unitsPerPc,
      );
      const onScreen =
        projectToScreen(scratchPoint, camera, scratchPoint) &&
        Math.abs(scratchPoint.x) <= 1 &&
        Math.abs(scratchPoint.y) <= 1;
      if (!onScreen) {
        hide(element);
        return;
      }
      if (element.style.display !== 'block') {
        element.style.display = 'block';
      }
      const x = (scratchPoint.x * 0.5 + 0.5) * size.width;
      const y = (-scratchPoint.y * 0.5 + 0.5) * size.height;
      // The Galactic Centre's name over its point, not on it: Sgr A*, a body with a name of
      // its own, is drawn there too -- 126 pc beyond the model's centre, the same point from
      // anywhere its name is shown (blackHoles.ts).
      // Folded, to the left of its point: to the right, the Large Magellanic Cloud's name is.
      element.style.transform =
        index > 0
          ? `translate(${x}px, ${y}px) translate(-50%, -50%)`
          : folded
            ? `translate(${x - CENTRE_LABEL_GAP_PX}px, ${y}px) translate(-100%, -50%)`
            : `translate(${x}px, ${y - CENTRE_LABEL_ABOVE_PX}px) translate(-50%, -100%)`;
      element.style.opacity = String(visibility);
      // Handed to the labels' one declutter pass (labelBoard.ts), which hides it if it loses.
      // Folded, the name of the mark everything near it folds into, before every other name;
      // unfolded, the centre's and the arms' are the model's, after the bodies', at no mark.
      const box = boxOf(element);
      labelBoard.posted.push({
        key: `milky-way-${index}`,
        element,
        x,
        y,
        offset: index > 0 ? -box.width / 2 : folded ? -CENTRE_LABEL_GAP_PX - box.width : -box.width / 2,
        dy: index > 0 || folded ? 0 : -CENTRE_LABEL_ABOVE_PX - box.height / 2,
        width: box.width,
        height: box.height,
        rank: index === 0 && folded ? 0 : 1,
        importance: index === 0 && folded ? Infinity : 0,
        marked: index === 0 && folded,
      });
    });
  });

  return null;
}

function hide(element: HTMLElement | null | undefined): void {
  if (element != null && element.style.display !== 'none') {
    element.style.display = 'none';
  }
}

/** The moving buffer at MOVING_SCALE of the full one, `width` by `height`, each way. */
function sizeMoving(buffer: THREE.WebGLRenderTarget, width: number, height: number): void {
  const w = Math.max(1, Math.round(width * MOVING_SCALE));
  const h = Math.max(1, Math.round(height * MOVING_SCALE));
  if (buffer.width !== w || buffer.height !== h) {
    buffer.setSize(w, h);
  }
}
