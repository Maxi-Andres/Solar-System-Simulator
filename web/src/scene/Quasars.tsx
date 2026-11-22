import { QUASAR_ABS_V, QUASAR_FLAGS, QUASAR_POSITION_UNIT_PC } from '@sss/tools/quasars';
import type { BodyId } from '@sss/tools/types';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { columnAt } from '../core/localGroup.ts';
import {
  deviceQuasarBudget,
  QUASARS_FROM_PC,
  quasarAbsVOf,
  quasarBvOf,
  quasarDot,
  sharedQuasarSource,
  type QuasarSource,
} from '../core/quasars.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { starColor } from './blackbody.ts';
import { floorSeparationPx, floorShown } from './crowding.ts';
import { SPRITE_FRAGMENT_GLSL, SPRITE_VERTEX_GLSL, spriteGeometry } from './gaussianSprite.ts';
import { drawIntoGlow, releaseFromGlow } from './glowBuffer.ts';
import { FAINT_GALAXY_FLOOR, MIN_SIGMA_PX, WHITE_MU } from './LocalGroup.tsx';
import { KM_PER_UNIT, LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';
import { CELL_PX, CROWDING_SAMPLE, crowdingGrid, measureCrowding, type CrowdingGrid } from './screenCrowding.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';
// Run in the frame where the layer is mounted, though its chunk arrives later: see lazyLayer.tsx.
import { useFrame } from './lazyLayer.tsx';

/**
 * The quasars (core/quasars.ts) and the Planck SZ clusters, two layers.
 *
 * ## The quasars
 *
 * 750 thousand, drawn as the cosmic web's galaxies are (CosmicWeb.tsx): each a Gaussian point
 * holding its luminosity, through the one exposure, into the glow buffer, coloured by its B-V
 * through the stars' blackbody, and at least a faint dot (FAINT_GALAXY_FLOOR) in its colour. Its
 * light is its own -- the luminosity its magnitude, the K-correction and the luminosity
 * distance say it had (tools/src/quasars/quasars.ts) -- over the distance squared from wherever
 * the camera is, as everything in the scene: from the Sun that is (1 + z)^2 brighter than the
 * sky shows it, the stretching of its light in energy and in time, which the scene draws for
 * nothing, being the universe now and not the light on its way. At billions of light years it
 * is far under one exposure; within tens of millions of one it outshines any galaxy.
 *
 * The dot is weighed by the quasar's luminosity (core/quasars.ts quasarDot), not by its
 * neighbours as a galaxy's is: quasars are a hundred megaparsecs apart, and a count of
 * neighbours there is noise. The catalogue is flux-limited, so the far shells are all luminous
 * ones, and say so.
 *
 * The dots crowd as the galaxies' do (crowding.ts, screenCrowding.ts), by the same kind of rule
 * with the quasars' own numbers, since they are what is left to see past the galaxies: each
 * patch of the screen no brighter than its dots QUASAR_PATCH_SEPARATION_PX apart, measured cell
 * by cell -- a pixel, where the galaxies' is two, so the wedges' summed light stays a visible
 * patch from billions of light years out; fewer dots rather than fainter ones under
 * QUASAR_FLOOR_THIN; gone as the catalogue shrinks to QUASAR_SPECK_GONE_PX -- but never by the
 * camera's distance alone, as the galaxies' maps go (crowding.ts MAP_GONE_LY): the quasars reach
 * 28 billion light years, and are the map of the far universe the camera is out there to see.
 * The camera never leaves them far behind: it stays inside the CMB's sphere, 40 billion ly from
 * the Sun at most (scale.ts MAX_VIEW_DISTANCE_KM). (When it could go on to 400 billion, outside
 * the sphere, they faded from 200 to 800.) Dimmer the farther they are
 * behind what the camera looks at. Gone near the Sun, too: fading in from QUASARS_FROM_LY to
 * QUASARS_FULL_LY, where the nearest of them are.
 *
 * ## The SZ clusters
 *
 * A thousand clusters over the whole sky to z 1, each a small ring -- a mark, not a light: what
 * Planck saw of them is the shadow their hot gas casts on the CMB. Its size by its mass, between
 * CLUSTER_RING_PX and twice that. Dimmed as they crowd, as a catalogue's dots are (ringsKept).
 */

/** The camera's distance from the Sun, light years: no quasars nearer than the first, all from the second. */
export const QUASARS_FROM_LY = 1e9;
export const QUASARS_FULL_LY = 3e9;
/** The least a dot far behind what the camera looks at is dimmed to, and the nearest that point is taken as, pc (as CosmicWeb.tsx's). */
export const QUASAR_DEPTH_LEAST = 0.2;
export const QUASAR_DEPTH_FROM_PC = 30e6;
/** An SZ cluster's ring, device pixels: its radius at 10^14 solar masses and under, and the most. */
export const CLUSTER_RING_PX = 3;
export const CLUSTER_RING_MOST_PX = 6;
export const CLUSTER_COLOR = '#e3a77a';
export const CLUSTER_OPACITY = 0.25;

/** A crowded patch holds the light of its dots this far apart, device pixels (crowding.ts's galaxies: 2). */
export const QUASAR_PATCH_SEPARATION_PX = 1;
/** A dot kept less than this is drawn at it or not at all (crowding.ts FLOOR_THIN, 1/12, for the galaxies). */
export const QUASAR_FLOOR_THIN = 1 / 24;
/** The catalogue's half-count radius on the screen, device pixels: whole above the first, gone under the second (crowding.ts's: 24 and 12). */
export const QUASAR_SPECK_FULL_PX = 12;
export const QUASAR_SPECK_GONE_PX = 6;

const LIGHT_YEAR_PC = LIGHT_YEAR_KM / PARSEC_KM;

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** How much of the quasars' floor is drawn at all, 1 to 0: crowding.ts floorShown's speck rule with the quasars' numbers, and no distance fade (see above). */
export function quasarFloorShown(halfCountPc: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  if (!(halfCountPc > 0) || cameraFromSunPc <= halfCountPc) return 1;
  const radiusPx = Math.atan(halfCountPc / cameraFromSunPc) * pixelsPerRadian;
  return smooth((radiusPx - QUASAR_SPECK_GONE_PX) / (QUASAR_SPECK_FULL_PX - QUASAR_SPECK_GONE_PX));
}

/**
 * Each cell's share of a dot kept, again, from the counts measureCrowding left in `grid`
 * (screenCrowding.ts), with QUASAR_PATCH_SEPARATION_PX for its CROWDED_SEPARATION_PX: the same
 * rule, the cells about each averaged, the patch brighter.
 */
export function holdQuasarPatch(grid: CrowdingGrid, perSample: number, widthPx: number, heightPx: number): void {
  const { cols, rows, counts, kept } = grid;
  const cellArea = (widthPx / cols) * (heightPx / rows);
  const full2 = QUASAR_PATCH_SEPARATION_PX * QUASAR_PATCH_SEPARATION_PX;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let n = 0;
      let cells = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          n += counts[rr * cols + cc]!;
          cells += 1;
        }
      }
      const density = (n * perSample) / (cells * cellArea);
      kept[r * cols + c] = Math.round(255 * Math.min(1, 1 / Math.max(1e-12, density * full2)));
    }
  }
}

/** crowding.ts FLOOR_THIN_GLSL at QUASAR_FLOOR_THIN: the same hash, so the same dots frame to frame. */
const QUASAR_THIN_GLSL = /* glsl */ `
float quasarThinned(float kept, int index) {
  if (kept >= ${QUASAR_FLOOR_THIN.toFixed(6)}) return kept;
  uint h = uint(index) * 2654435761u;
  h ^= h >> 15u;
  h *= 2246822519u;
  h ^= h >> 13u;
  return float(h & 0xffffffu) / 16777216.0 < kept / ${QUASAR_FLOOR_THIN.toFixed(6)} ? ${QUASAR_FLOOR_THIN.toFixed(6)} : 0.0;
}
`;
const UNIT = 32767 * QUASAR_POSITION_UNIT_PC;
const SUN_ABSOLUTE_V = 4.81;

/**
 * How much of the clusters' rings is drawn, 1 to 0: crowding.ts's rule for a catalogue's dots,
 * but whole while the rings are RINGS_FULL_SEPARATION_PX apart -- two of their widths -- since a
 * ring overlapping the next says less than a dot on the next does.
 */
export const RINGS_FULL_SEPARATION_PX = 4 * CLUSTER_RING_PX;

export function ringsKept(halfCountPc: number, count: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  const separationPx = floorSeparationPx(halfCountPc, count, cameraFromSunPc, pixelsPerRadian);
  return Math.min(1, (separationPx / RINGS_FULL_SEPARATION_PX) ** 2) * floorShown(halfCountPc, cameraFromSunPc, pixelsPerRadian);
}

/** How much of the quasars is drawn, 0 to 1, by the camera's distance from the Sun, pc: smoothly in the logarithm. */
export function quasarsFade(cameraFromSunPc: number): number {
  const ly = cameraFromSunPc / LIGHT_YEAR_PC;
  if (!(ly > QUASARS_FROM_LY)) return 0;
  const t = Math.min(1, (Math.log(ly) - Math.log(QUASARS_FROM_LY)) / (Math.log(QUASARS_FULL_LY) - Math.log(QUASARS_FROM_LY)));
  return t * t * (3 - 2 * t);
}

const QUASAR_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uFade;
uniform float uFloorKept;
uniform float uDepthPc;
uniform sampler2D uTable;
uniform sampler2D uCrowding;
attribute vec4 aPlace;
attribute vec4 aBytes;
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_VERTEX_GLSL}
${QUASAR_THIN_GLSL}

void main() {
  vec3 rel = aPlace.xyz * ${UNIT.toExponential(6)} - uCameraPc;
  float distancePc = length(rel);
  ivec4 b = ivec4(floor(aBytes * 255.0 + 0.5));
  vec3 hue = texelFetch(uTable, ivec2(b.y, 0), 0).rgb;
  float light = texelFetch(uTable, ivec2(b.x, 1), 0).r;
  float sigmaPx = ${MIN_SIGMA_PX.toFixed(2)};
  float sigmaPc = sigmaPx / uPixelsPerRadian * distancePc;
  vec4 centre = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  float local = centre.w > 0.0 ? textureLod(uCrowding, clamp(centre.xy / centre.w * 0.5 + 0.5, 0.0, 1.0), 0.0).r : 1.0;
  vPeak = hue * light * uFade / (6.2831853 * sigmaPc * sigmaPc);
  float depth = clamp(uDepthPc / distancePc, ${QUASAR_DEPTH_LEAST.toFixed(2)}, 1.0);
  vPeak = max(vPeak, hue * ${FAINT_GALAXY_FLOOR.toPrecision(6)} * aBytes.w * quasarThinned(uFloorKept * local * depth, gl_InstanceID) * uFade);
  vSigmaPx = sigmaPx;
  gl_Position = spriteCorner(centre, spriteRadiusPx(vPeak, sigmaPx));
  #include <logdepthbuf_vertex>
}
`;

const QUASAR_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_FRAGMENT_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = spriteLight(vPeak, vSigmaPx);
}
`;

/** A cluster's ring: a quad of its radius plus a pixel, the ring a pixel and a half wide at its edge. */
const CLUSTER_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform vec2 uViewportPx;
attribute vec3 aPlace;
attribute float aRadiusPx;
varying vec2 vOffsetPx;
varying float vRadiusPx;

void main() {
  vec3 rel = aPlace - uCameraPc;
  vec4 centre = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  if (centre.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vOffsetPx = vec2(0.0);
    vRadiusPx = 1.0;
    return;
  }
  float extent = aRadiusPx + 1.5;
  vOffsetPx = position.xy * extent;
  vRadiusPx = aRadiusPx;
  gl_Position = vec4(centre.xy + vOffsetPx * 2.0 / uViewportPx * centre.w, centre.zw);
  #include <logdepthbuf_vertex>
}
`;

const CLUSTER_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vOffsetPx;
varying float vRadiusPx;

void main() {
  #include <logdepthbuf_fragment>
  float r = length(vOffsetPx);
  float ring = 1.0 - smoothstep(0.0, 0.9, abs(r - vRadiusPx + 0.4));
  if (ring <= 0.01) discard;
  gl_FragColor = vec4(uColor * ring * uOpacity, 1.0);
}
`;

/** A quasar's light and colour by its bytes: row 0 its colour (blackbody of its B-V, unknown as the composite's), row 1 its light in white columns. */
export function quasarTable(): THREE.DataTexture {
  const data = new Float32Array(256 * 2 * 4);
  const white = columnAt(WHITE_MU);
  for (let code = 0; code < 256; code += 1) {
    const bv = quasarBvOf(code);
    const [r, g, b] = starColor(Number.isNaN(bv) ? 0.234 : bv);
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data.set([r / y, g / y, b / y, 1], code * 4);
    const absV = quasarAbsVOf(code);
    data[(256 + code) * 4] = Number.isNaN(absV) ? 0 : 10 ** (-0.4 * (absV - SUN_ABSOLUTE_V)) / white;
  }
  const texture = new THREE.DataTexture(data, 256, 2, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface QuasarsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The source; the app's shared one when not given. */
  readonly source?: QuasarSource;
}

const noRaycast = (): void => {};
const scratchSize = new THREE.Vector2();
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
const scratchMatrix = new THREE.Matrix3();

export function Quasars({ store, clock, focus, source: given }: QuasarsProps) {
  const source = useMemo(() => given ?? sharedQuasarSource(), [given]);
  // The Quasars and SZ Clusters layers, read from the store: nothing above the scene needs them.
  const showQuasars = useViewStore((s) => s.layers.quasars);
  const showClusters = useViewStore((s) => s.layers.szClusters);
  const info = useSyncExternalStore(source.info.subscribe, () => source.info.value);
  const chunks = useSyncExternalStore(source.quasars.subscribe, () => source.quasars.chunks);
  const clusterData = useSyncExternalStore(source.clusters.subscribe, () => source.clusters.value);
  const group = useMemo(() => new THREE.Group(), []);
  const cameraPc = useMemo(() => new THREE.Vector3(), []);
  // Asked for once: past QUASARS_FROM_PC with a layer on, or a layer switched on.
  const asked = useRef(false);
  const firstLayers = useRef({ showQuasars, showClusters });
  useEffect(() => {
    if ((showQuasars && !firstLayers.current.showQuasars) || (showClusters && !firstLayers.current.showClusters)) asked.current = true;
    firstLayers.current = { showQuasars: showQuasars || firstLayers.current.showQuasars, showClusters: showClusters || firstLayers.current.showClusters };
    renderDemand.request();
  }, [showQuasars, showClusters]);

  // ---- The quasars: one instanced draw, the chunks copied in as they land.
  const budget = useMemo(() => (info === null ? 0 : deviceQuasarBudget(info.quasars.chunks.length)), [info]);
  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraPc: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelsPerRadian: { value: 1 },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uFade: { value: 0 },
      uFloorKept: { value: 1 },
      uDepthPc: { value: QUASAR_DEPTH_FROM_PC },
      uTable: { value: null },
      uCrowding: { value: null },
    }),
    [],
  );
  const quasars = useMemo(() => {
    if (info === null || budget === 0) return null;
    const capacity = info.quasars.chunks.slice(0, budget).reduce((sum, chunk) => sum + chunk.count, 0);
    const place = new Int16Array(capacity * 4);
    const bytes = new Uint8Array(capacity * 4);
    const geometry = spriteGeometry(0);
    const placeAttribute = new THREE.InstancedBufferAttribute(place, 4, true);
    const bytesAttribute = new THREE.InstancedBufferAttribute(bytes, 4, true);
    geometry.setAttribute('aPlace', placeAttribute);
    geometry.setAttribute('aBytes', bytesAttribute);
    const table = quasarTable();
    uniforms['uTable']!.value = table;
    const object = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: QUASAR_VERTEX,
        fragmentShader: QUASAR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    object.frustumCulled = false;
    object.raycast = noRaycast;
    object.visible = false;
    drawIntoGlow(object);
    return { object, geometry, place, bytes, placeAttribute, bytesAttribute, table, copied: 0, chunksCopied: 0 };
  }, [info, budget, uniforms]);
  useEffect(
    () => () => {
      if (quasars === null) return;
      releaseFromGlow(quasars.object);
      quasars.geometry.dispose();
      (quasars.object.material as THREE.Material).dispose();
      quasars.table.dispose();
    },
    [quasars],
  );
  // `uploaded`: what the texture last took, to give it only a grid that differs (see the frame).
  const crowding = useRef<{ sample: Float32Array; grid: CrowdingGrid | null; texture: THREE.DataTexture | null; uploaded: Uint8Array | null }>({
    sample: new Float32Array(0),
    grid: null,
    texture: null,
    uploaded: null,
  });
  useEffect(
    () => () => {
      crowding.current.texture?.dispose();
      crowding.current.texture = null;
      crowding.current.grid = null;
      crowding.current.uploaded = null;
    },
    [],
  );
  // Each chunk copied in as it lands: the dots weighed by luminosity as they are copied, the crowding's sample taken again.
  useEffect(() => {
    if (quasars === null || info === null) return;
    let added = false;
    while (quasars.chunksCopied < Math.min(chunks.length, budget)) {
      const chunk = chunks[quasars.chunksCopied]!;
      const from = quasars.copied;
      for (let q = 0; q < chunk.count; q += 1) {
        const at = (from + q) * 4;
        // A record-holder (TON 618) is its mark (recordHolders.ts): its dot not drawn, no light and no floor.
        const holder = (chunk.flags[q]! & QUASAR_FLAGS.RECORD_HOLDER) !== 0;
        quasars.place[at] = chunk.positions[q * 3]!;
        quasars.place[at + 1] = chunk.positions[q * 3 + 1]!;
        quasars.place[at + 2] = chunk.positions[q * 3 + 2]!;
        quasars.bytes[at] = holder ? QUASAR_ABS_V.unknown : chunk.absV[q]!;
        quasars.bytes[at + 1] = chunk.bv[q]!;
        quasars.bytes[at + 2] = chunk.flags[q]!;
        quasars.bytes[at + 3] = holder ? 0 : Math.round(255 * quasarDot(quasarAbsVOf(chunk.absV[q]!), info.quasars.absVPercentiles));
      }
      quasars.placeAttribute.addUpdateRange(from * 4, chunk.count * 4);
      quasars.placeAttribute.needsUpdate = true;
      quasars.bytesAttribute.addUpdateRange(from * 4, chunk.count * 4);
      quasars.bytesAttribute.needsUpdate = true;
      quasars.copied += chunk.count;
      quasars.chunksCopied += 1;
      added = true;
    }
    if (!added) return;
    quasars.geometry.instanceCount = quasars.copied;
    const n = Math.min(CROWDING_SAMPLE, quasars.copied);
    const stride = quasars.copied / n;
    const sample = new Float32Array(n * 3);
    for (let k = 0; k < n; k += 1) {
      const g = Math.floor(k * stride) * 4;
      sample[k * 3] = quasars.place[g]! * QUASAR_POSITION_UNIT_PC;
      sample[k * 3 + 1] = quasars.place[g + 1]! * QUASAR_POSITION_UNIT_PC;
      sample[k * 3 + 2] = quasars.place[g + 2]! * QUASAR_POSITION_UNIT_PC;
    }
    crowding.current.sample = sample;
    renderDemand.request();
  }, [quasars, chunks, budget, info]);

  // ---- The SZ clusters: one instanced draw of rings.
  const clusterUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraPc: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uColor: { value: new THREE.Color().setStyle(CLUSTER_COLOR, THREE.LinearSRGBColorSpace) },
      uOpacity: { value: 0 },
    }),
    [],
  );
  const clusters = useMemo(() => {
    if (clusterData === null) return null;
    const geometry = spriteGeometry(clusterData.count);
    const radius = new Float32Array(clusterData.count);
    for (let c = 0; c < clusterData.count; c += 1) {
      const m = clusterData.mass[c]!;
      // 10^14 and under the least, 10^15 and over the most, in the logarithm between.
      const t = Number.isFinite(m) ? Math.min(1, Math.max(0, Math.log10(m))) : 0;
      radius[c] = CLUSTER_RING_PX + (CLUSTER_RING_MOST_PX - CLUSTER_RING_PX) * t;
    }
    geometry.setAttribute('aPlace', new THREE.InstancedBufferAttribute(clusterData.positions, 3));
    geometry.setAttribute('aRadiusPx', new THREE.InstancedBufferAttribute(radius, 1));
    const object = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: clusterUniforms,
        vertexShader: CLUSTER_VERTEX,
        fragmentShader: CLUSTER_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    object.frustumCulled = false;
    object.raycast = noRaycast;
    object.renderOrder = 3;
    object.visible = false;
    // Their median distance from the Sun, for the crowding.
    const distances = new Float64Array(clusterData.count);
    for (let c = 0; c < clusterData.count; c += 1) {
      distances[c] = Math.hypot(clusterData.positions[c * 3]!, clusterData.positions[c * 3 + 1]!, clusterData.positions[c * 3 + 2]!);
    }
    distances.sort();
    return { object, geometry, halfCountPc: distances[clusterData.count >> 1] ?? 0 };
  }, [clusterData, clusterUniforms]);
  useEffect(
    () => () => {
      if (clusters === null) return;
      clusters.geometry.dispose();
      (clusters.object.material as THREE.Material).dispose();
    },
    [clusters],
  );

  useEffect(() => {
    const objects: THREE.Object3D[] = [];
    if (quasars !== null) objects.push(quasars.object);
    if (clusters !== null) objects.push(clusters.object);
    if (objects.length === 0) return;
    group.add(...objects);
    renderDemand.request();
    return () => {
      group.remove(...objects);
    };
  }, [group, quasars, clusters]);

  useFrame(({ camera, gl: renderer }) => {
    const sun = store.sunFromFocus(focus, clock.tdbJulianDay);
    if (sun === null) {
      group.visible = false;
      return;
    }
    cameraPc.set(
      (camera.position.x * KM_PER_UNIT - sun.position.x) / PARSEC_KM,
      (camera.position.y * KM_PER_UNIT - sun.position.y) / PARSEC_KM,
      (camera.position.z * KM_PER_UNIT - sun.position.z) / PARSEC_KM,
    );
    const fromSunPc = cameraPc.length();
    if (!asked.current && (showQuasars || showClusters) && fromSunPc > QUASARS_FROM_PC) asked.current = true;
    if (asked.current) {
      if (showQuasars && source.quasars.chunks.length < Math.max(1, budget)) source.quasars.request(Math.max(1, budget));
      if (showClusters) void source.clusters.request();
      if (!showQuasars) void source.info.request();
    }

    const fade = quasarsFade(fromSunPc);
    const quasarFade = showQuasars ? fade : 0;
    const clusterFade = showClusters ? fade : 0;
    group.visible = (quasars !== null && quasars.copied > 0 && quasarFade > 0) || (clusters !== null && clusterFade > 0);
    if (!group.visible) return;
    group.position.copy(camera.position);
    group.updateMatrixWorld();
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const size = renderer.getDrawingBufferSize(scratchSize);
    const pixelsPerRadian = size.y / (2 * Math.tan((fov * Math.PI) / 360));
    // The scene is about the focus (floatingOrigin.ts): the camera's distance from what it looks at.
    const depthPc = Math.max(QUASAR_DEPTH_FROM_PC, (2 * camera.position.length() * KM_PER_UNIT) / PARSEC_KM);

    if (quasars !== null && info !== null) {
      quasars.object.visible = quasars.copied > 0 && quasarFade > 0;
      (uniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      uniforms['uPixelsPerRadian']!.value = pixelsPerRadian;
      (uniforms['uViewportPx']!.value as THREE.Vector2).copy(size);
      uniforms['uFade']!.value = quasarFade;
      uniforms['uDepthPc']!.value = depthPc;
      const kept = quasarFloorShown(info.quasars.halfCountPc, fromSunPc, pixelsPerRadian);
      uniforms['uFloorKept']!.value = kept;
      const c = crowding.current;
      if (c.grid === null || c.texture === null || c.texture.image.width !== Math.ceil(size.x / CELL_PX) || c.texture.image.height !== Math.ceil(size.y / CELL_PX)) {
        c.texture?.dispose();
        c.grid = crowdingGrid(size.x, size.y);
        c.texture = new THREE.DataTexture(c.grid.kept, c.grid.cols, c.grid.rows, THREE.RedFormat, THREE.UnsignedByteType);
        c.texture.minFilter = THREE.LinearFilter;
        c.texture.magFilter = THREE.LinearFilter;
        c.texture.unpackAlignment = 1;
        c.uploaded = null;
        uniforms['uCrowding']!.value = c.texture;
      }
      if (kept > 0 && quasarFade > 0 && c.sample.length > 0) {
        camera.updateMatrixWorld();
        scratchMatrix.setFromMatrix4(camera.matrixWorldInverse);
        const e = camera.projectionMatrix.elements;
        const perSample = quasars.copied / (c.sample.length / 3);
        measureCrowding(c.grid, c.sample, c.sample.length / 3, perSample, cameraPc, scratchMatrix.elements, e[0]!, e[5]!, size.x, size.y);
        // The counts kept, the shares made again with the quasars' brighter patch.
        holdQuasarPatch(c.grid, perSample, size.x, size.y);
        // Uploaded only when it differs from what the texture holds: a new version every frame
        // tells the glow pass (glowStill.ts) the quasars changed, and it draws them all again --
        // from far out most of the GPU's frame, the same picture as before (CosmicWeb.tsx, same rule).
        if (c.uploaded === null || !sameBytes(c.uploaded, c.grid.kept)) {
          c.uploaded = c.grid.kept.slice();
          c.texture.needsUpdate = true;
        }
      }
    }

    if (clusters !== null && clusterData !== null) {
      clusters.object.visible = clusterFade > 0;
      (clusterUniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      (clusterUniforms['uViewportPx']!.value as THREE.Vector2).copy(size);
      clusterUniforms['uOpacity']!.value = CLUSTER_OPACITY * clusterFade * ringsKept(clusters.halfCountPc, clusterData.count, fromSunPc, pixelsPerRadian);
    }
  });

  return <primitive object={group} />;
}
