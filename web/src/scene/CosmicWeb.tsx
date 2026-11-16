import { COSMIC_WEB_FILAMENT_CATALOGUES, COSMIC_WEB_POSITION_UNIT_PC, type BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import {
  bvOf,
  absVOf,
  deviceChunkBudget,
  FILAMENTS_FROM_PC,
  GALAXIES_FROM_PC,
  surveyOf,
  type CosmicWebSource,
  type FilamentSegments,
} from '../core/cosmicWeb.ts';
import type { FloorAnswer, FloorRequest } from '../core/cosmicWebFloor.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { columnAt } from '../core/localGroup.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { FLOOR_THIN_GLSL, floorShown, lineKept } from './crowding.ts';
import { SPRITE_FRAGMENT_GLSL, SPRITE_VERTEX_GLSL, spriteGeometry } from './gaussianSprite.ts';
import { drawIntoGlow, releaseFromGlow } from './glowBuffer.ts';
import { FAINT_GALAXY_FLOOR, MIN_SIGMA_PX, WHITE_MU } from './LocalGroup.tsx';
import { structuresFade } from './markHosts.ts';
import { CELL_PX, CROWDING_SAMPLE, crowdingGrid, measureCrowding, type CrowdingGrid } from './screenCrowding.ts';
import { galaxyVisibility } from './MilkyWay.tsx';
import { KM_PER_UNIT } from './scale.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';

/**
 * The cosmic web past Laniakea's catalogue (core/cosmicWeb.ts): the SDSS's galaxies and the
 * filaments found in them, two layers.
 *
 * ## The galaxies
 *
 * 1.8 million, drawn as Laniakea's are (Laniakea.tsx POINT_VERTEX): each a Gaussian point
 * holding its luminosity, through the one exposure, into the glow buffer, coloured by its B-V
 * through the stars' blackbody, and at least a faint dot (FAINT_GALAXY_FLOOR) in its colour,
 * weighed by its neighbours (core/cosmicWebFloor.ts), dimmed where the dots crowd on the screen
 * (screenCrowding.ts) and gone as the camera leaves the web (crowding.ts floorShown). None has a
 * size: each is a point at any distance, as Laniakea's galaxies with no D25 are. One instanced
 * draw; 12 bytes a galaxy on the GPU -- its place as four 16-bit integers and its absolute V,
 * B-V, flags and dot as four bytes, read as normalised (formats every GPU reads natively, so
 * nothing is converted on upload) -- 22 MB for all of them. A galaxy's light and colour are
 * looked up in a 256 x 2 table by its bytes.
 *
 * Streamed: the chunks come most luminous first (core/cosmicWeb.ts CosmicWebGalaxies); a chunk
 * is drawn once its galaxies' dots are weighed, in a worker, and every dot is weighed again then.
 *
 * Laniakea's catalogue holds none of these (the data dropped every galaxy it draws), so nothing
 * is hidden where both are: within 700 Mpc the SDSS's northern wedge is the fuller map, the
 * rest of the sky Laniakea's alone. The About says why the far map is wedges.
 *
 * ## The filaments
 *
 * Threads, as the flow lines are (Laniakea.tsx FLOW_VERTEX), but 20,183 of them in one instanced
 * draw: each segment a quad pushed apart on the screen across it, a Gaussian across of
 * FILAMENT_SIGMA_PX with a fainter halo -- a thin line with a soft glow, the same width from any
 * distance. Tempel et al.'s brighter, by their visit map; Malavasi et al.'s fainter, coarser, by
 * their ridge's density (core/cosmicWeb.ts filamentWeight). Within a few times its radius as
 * catalogued (0.5 h^-1 Mpc, Tempel's) a filament widens to it, as dim per unit length as it was
 * thin, and goes as the camera enters it. Dimmer the farther they are than what the camera looks
 * at (to FILAMENT_DEPTH_LEAST): depth in a web that is otherwise flat. And dimmed as they crowd,
 * gone as the camera leaves the web (crowding.ts lineKept). No animation: a filament does not
 * flow.
 */

/** The filaments' colour: a muted violet, apart from the flow lines' gold, grey-blue and blue. Malavasi et al.'s a cooler shade. */
export const TEMPEL_COLOR = '#b4a4e2';
export const MALAVASI_COLOR = '#9a94d6';
/** Their strength at the line's centre, whole weight: Tempel et al.'s, and Malavasi et al.'s fainter. */
export const TEMPEL_BASE = 1.0;
export const MALAVASI_BASE = 1.0;
/**
 * How far apart on the screen each catalogue's lines are whole (crowding.ts lineKept): Tempel et
 * al.'s, dense spines over the SDSS's densest volume, a tangle closer than 6 pixels from Laniakea's
 * own view; Malavasi et al.'s, a coarser skeleton, read as a web to 3, as the BOSS volume is seen
 * from tens of billions of light years. A choice, by eye.
 */
export const TEMPEL_FULL_SEPARATION_PX = 6;
export const MALAVASI_FULL_SEPARATION_PX = 3;
/** The line's Gaussian across, pixels, and its halo: HALO_SHARE of the light in one HALO_WIDTH times as wide. */
export const FILAMENT_SIGMA_PX = 0.6;
export const HALO_SHARE = 0.3;
export const HALO_WIDTH = 3;
/** A filament's radius as catalogued, pc: Tempel et al.'s cylinders, 0.5 h^-1 Mpc (h 0.746, the scene's). Malavasi et al.'s ridges have none. */
export const TEMPEL_RADIUS_PC = 0.5e6 / 0.746;
/** Gone within this of the camera, pc: inside a filament of Tempel's; within a few of Malavasi's 2 Mpc steps. */
export const TEMPEL_NEAR_PC = 1.5e6;
export const MALAVASI_NEAR_PC = 6e6;
/**
 * A filament (or a faint dot) farther from the camera than twice what the camera looks at dims
 * as that distance over its own, down to FILAMENT_DEPTH_LEAST: from inside the SDSS's volume the
 * near filaments are the web and the 600 Mpc of them behind a faint fur, not a tangle as bright;
 * from outside, the whole of a survey is within it. What it looks at is taken as no nearer than
 * FILAMENT_DEPTH_FROM_PC.
 */
export const FILAMENT_DEPTH_LEAST = 0.12;
export const FILAMENT_DEPTH_FROM_PC = 30e6;

const UNIT = 32767 * COSMIC_WEB_POSITION_UNIT_PC;
/** The whole sky, square degrees. */
const SKY_DEG2 = (4 * 180 * 180) / Math.PI;

/** A galaxy: its place and its bytes, read as normalised (see the header), into the glow. */
const GALAXY_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uFade;
uniform float uFloorKept;
uniform float uDepthPc;
uniform sampler2D uTable;
// Each dot's share kept where it lies on the screen (screenCrowding.ts).
uniform sampler2D uCrowding;
attribute vec4 aPlace;
attribute vec4 aBytes;
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_VERTEX_GLSL}
${FLOOR_THIN_GLSL}

void main() {
  vec3 rel = aPlace.xyz * ${UNIT.toExponential(6)} - uCameraPc;
  float distancePc = length(rel);
  ivec4 b = ivec4(floor(aBytes * 255.0 + 0.5));
  // Row 0 its colour by B-V, row 1 its light (white columns) by absolute V.
  vec3 hue = texelFetch(uTable, ivec2(b.y, 0), 0).rgb;
  float light = texelFetch(uTable, ivec2(b.x, 1), 0).r;
  float sigmaPx = ${MIN_SIGMA_PX.toFixed(2)};
  float sigmaPc = sigmaPx / uPixelsPerRadian * distancePc;
  vec4 centre = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  float local = centre.w > 0.0 ? textureLod(uCrowding, clamp(centre.xy / centre.w * 0.5 + 0.5, 0.0, 1.0), 0.0).r : 1.0;
  vPeak = hue * light * uFade / (6.2831853 * sigmaPc * sigmaPc);
  // Its faint dot dimmer the farther it is than what the camera looks at, as the filaments are.
  float depth = clamp(uDepthPc / distancePc, ${FILAMENT_DEPTH_LEAST.toFixed(2)}, 1.0);
  // Fewer dots, not fainter, once each is under FLOOR_THIN of itself (crowding.ts).
  vPeak = max(vPeak, hue * ${FAINT_GALAXY_FLOOR.toPrecision(6)} * aBytes.w * floorThinned(uFloorKept * local * depth, gl_InstanceID) * uFade);
  vSigmaPx = sigmaPx;
  gl_Position = spriteCorner(centre, spriteRadiusPx(vPeak, sigmaPx));
  #include <logdepthbuf_vertex>
}
`;

const GALAXY_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vPeak;
varying float vSigmaPx;
${SPRITE_FRAGMENT_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = spriteLight(vPeak, vSigmaPx);
}
`;

/**
 * A segment of a filament, a quad: `position.x` 0 at its start and 1 at its end, `position.y`
 * -1 to 1 across. Both ends taken to the camera's near plane if behind it, projected, and the
 * quad pushed apart across the line between them on the screen.
 */
const FILAMENT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCameraPc;
uniform float uUnitsPerPc;
uniform vec2 uViewportPx;
uniform float uPixelsPerRadian;
uniform float uNearUnits;
uniform vec2 uOpacity;
uniform vec2 uRadiusPc;
uniform vec2 uNearPc;
uniform float uDepthPc;
uniform vec3 uColor0;
uniform vec3 uColor1;
attribute vec4 aA;
attribute vec4 aB;
varying float vAcrossPx;
varying float vSigmaPx;
varying vec3 vLight;

void main() {
  vec3 a = aA.xyz * ${UNIT.toExponential(6)} - uCameraPc;
  vec3 b = aB.xyz * ${UNIT.toExponential(6)} - uCameraPc;
  float bw = floor(aB.w * 32767.0 + 0.5);
  float catalogue = floor(bw / 256.0);
  float weight = mix(floor(aA.w * 32767.0 + 0.5), mod(bw, 256.0), position.x) / 255.0;
  vec4 va = modelViewMatrix * vec4(a * uUnitsPerPc, 1.0);
  vec4 vb = modelViewMatrix * vec4(b * uUnitsPerPc, 1.0);
  float za = -va.z;
  float zb = -vb.z;
  if (za < uNearUnits && zb < uNearUnits) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vLight = vec3(0.0);
    vAcrossPx = 0.0;
    vSigmaPx = 1.0;
    return;
  }
  if (za < uNearUnits) va = mix(va, vb, (uNearUnits - za) / (zb - za));
  else if (zb < uNearUnits) vb = mix(vb, va, (uNearUnits - zb) / (za - zb));
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uViewportPx;
  d = length(d) > 1e-6 ? normalize(d) : vec2(1.0, 0.0);
  bool atA = position.x < 0.5;
  vec4 clip = atA ? ca : cb;
  float distancePc = max(length((atA ? va : vb).xyz) / uUnitsPerPc, 1.0);
  bool tempel = catalogue < 0.5;
  float radiusPc = tempel ? uRadiusPc.x : uRadiusPc.y;
  // As wide as its radius once that is wider than the line, and as much dimmer.
  float sigmaPx = max(${FILAMENT_SIGMA_PX.toFixed(2)}, radiusPc / distancePc * uPixelsPerRadian);
  float halfPx = ${(3 * HALO_WIDTH).toFixed(1)} * sigmaPx + 1.0;
  clip.xy += vec2(-d.y, d.x) * position.y * halfPx / (0.5 * uViewportPx) * clip.w;
  gl_Position = clip;
  float nearPc = tempel ? uNearPc.x : uNearPc.y;
  float near = smoothstep(0.5 * nearPc, nearPc, distancePc);
  float depth = clamp(uDepthPc / distancePc, ${FILAMENT_DEPTH_LEAST.toFixed(2)}, 1.0);
  float strength = (tempel ? uOpacity.x : uOpacity.y) * weight * near * depth * ${FILAMENT_SIGMA_PX.toFixed(2)} / sigmaPx;
  vLight = (tempel ? uColor0 : uColor1) * strength;
  vAcrossPx = position.y * halfPx;
  vSigmaPx = sigmaPx;
  #include <logdepthbuf_vertex>
}
`;

const FILAMENT_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying float vAcrossPx;
varying float vSigmaPx;
varying vec3 vLight;

void main() {
  #include <logdepthbuf_fragment>
  float x = vAcrossPx / vSigmaPx;
  float profile = ${(1 - HALO_SHARE).toFixed(3)} * exp(-0.5 * x * x)
    + ${HALO_SHARE.toFixed(3)} / ${HALO_WIDTH.toFixed(1)} * exp(-0.5 * x * x / ${(HALO_WIDTH * HALO_WIDTH).toFixed(1)});
  vec3 c = vLight * profile;
  if (max(c.r, max(c.g, c.b)) < 0.002) discard;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** A galaxy's light and colour by its bytes: row 0 its colour (blackbody of its B-V, unknown as 0.8, Laniakea's), row 1 its light in white columns (unknown: none). */
export function galaxyTable(): THREE.DataTexture {
  const data = new Float32Array(256 * 2 * 4);
  const white = columnAt(WHITE_MU);
  for (let code = 0; code < 256; code += 1) {
    const bv = bvOf(code);
    const [r, g, b] = starColor(Number.isNaN(bv) ? 0.8 : bv);
    // The hue normalised to its luminance, as Laniakea.tsx's floor's: the light carries the rest.
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data.set([r / y, g / y, b / y, 1], code * 4);
    const absV = absVOf(code);
    data[(256 + code) * 4] = Number.isNaN(absV) ? 0 : 10 ** (-0.4 * (absV - SUN_ABSOLUTE_V)) / white;
  }
  const texture = new THREE.DataTexture(data, 256, 2, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The Sun's absolute V, as Laniakea's (core/laniakea.ts). */
const SUN_ABSOLUTE_V = 4.81;

export interface CosmicWebProps {
  readonly source: CosmicWebSource;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The SDSS Galaxies layer. */
  readonly showGalaxies: boolean;
  /** The Filaments layer. */
  readonly showFilaments: boolean;
}

const noRaycast = (): void => {};
const scratchSize = new THREE.Vector2();
const scratchMatrix = new THREE.Matrix3();

export function CosmicWeb({ source, store, clock, focus, showGalaxies, showFilaments }: CosmicWebProps) {
  const info = useSyncExternalStore(source.info.subscribe, () => source.info.value);
  const filamentData = useSyncExternalStore(source.filaments.subscribe, () => source.filaments.value);
  const chunks = useSyncExternalStore(source.galaxies.subscribe, () => source.galaxies.chunks);
  const group = useMemo(() => new THREE.Group(), []);
  const cameraPc = useMemo(() => new THREE.Vector3(), []);
  // Each asked for once: past its distance, or when its layer is switched on.
  const asked = useRef({ galaxies: false, filaments: false });
  const firstLayers = useRef({ showGalaxies, showFilaments });
  useEffect(() => {
    if (showGalaxies && !firstLayers.current.showGalaxies) asked.current.galaxies = true;
    if (showFilaments && !firstLayers.current.showFilaments) asked.current.filaments = true;
    firstLayers.current = { showGalaxies: showGalaxies || firstLayers.current.showGalaxies, showFilaments: showFilaments || firstLayers.current.showFilaments };
  }, [showGalaxies, showFilaments]);

  // ---- The galaxies: one instanced draw, the chunks copied in as they land.
  const budget = useMemo(() => (info === null ? 0 : deviceChunkBudget(info.galaxies.chunks.length)), [info]);
  const galaxyUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraPc: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uPixelsPerRadian: { value: 1 },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uFade: { value: 0 },
      uFloorKept: { value: 1 },
      uDepthPc: { value: FILAMENT_DEPTH_FROM_PC },
      uTable: { value: null },
      uCrowding: { value: null },
    }),
    [],
  );
  const galaxies = useMemo(() => {
    if (info === null || budget === 0) return null;
    const capacity = info.galaxies.chunks.slice(0, budget).reduce((sum, chunk) => sum + chunk.count, 0);
    const place = new Int16Array(capacity * 4);
    const bytes = new Uint8Array(capacity * 4);
    const geometry = spriteGeometry(0);
    const placeAttribute = new THREE.InstancedBufferAttribute(place, 4, true);
    const bytesAttribute = new THREE.InstancedBufferAttribute(bytes, 4, true);
    geometry.setAttribute('aPlace', placeAttribute);
    geometry.setAttribute('aBytes', bytesAttribute);
    const table = galaxyTable();
    galaxyUniforms['uTable']!.value = table;
    const object = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: galaxyUniforms,
        vertexShader: GALAXY_VERTEX,
        fragmentShader: GALAXY_FRAGMENT,
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
    return { object, geometry, place, bytes, placeAttribute, bytesAttribute, table, capacity, copied: 0, chunksCopied: 0 };
  }, [info, budget, galaxyUniforms]);
  useEffect(
    () => () => {
      if (galaxies === null) return;
      releaseFromGlow(galaxies.object);
      galaxies.geometry.dispose();
      (galaxies.object.material as THREE.Material).dispose();
      galaxies.table.dispose();
    },
    [galaxies],
  );
  // The dots: weighed in a worker for every galaxy copied, again as each chunk lands; drawn to there.
  const [halfCountPc, setHalfCountPc] = useState(0);
  const drawn = useRef(0);
  const weighRef = useRef<() => void>(() => {});
  const crowding = useRef<{ sample: Float32Array; grid: CrowdingGrid | null; texture: THREE.DataTexture | null }>({
    sample: new Float32Array(0),
    grid: null,
    texture: null,
  });
  useEffect(
    () => () => {
      crowding.current.texture?.dispose();
      crowding.current.texture = null;
      crowding.current.grid = null;
    },
    [],
  );
  useEffect(() => {
    if (galaxies === null || info === null) return;
    const worker = new Worker(new URL('../core/cosmicWebFloor.worker.ts', import.meta.url), { type: 'module' });
    const skyShare = [0, 1].map((survey) => {
      const footprints = info.footprints.surveys.filter((f) => f.of === 'galaxies' && (survey === 0 ? /main/i.test(f.name) : /BOSS/.test(f.name)));
      return footprints.reduce((sum, f) => sum + f.areaDeg2, 0) / SKY_DEG2;
    });
    let busy = false;
    let again = false;
    let id = 0;
    const weigh = () => {
      if (busy) {
        again = true;
        return;
      }
      const n = galaxies.copied;
      if (n === 0) return;
      busy = true;
      const positions = new Int16Array(n * 3);
      const surveys = new Uint8Array(n);
      for (let g = 0; g < n; g += 1) {
        positions[g * 3] = galaxies.place[g * 4]!;
        positions[g * 3 + 1] = galaxies.place[g * 4 + 1]!;
        positions[g * 3 + 2] = galaxies.place[g * 4 + 2]!;
        surveys[g] = surveyOf(galaxies.bytes[g * 4 + 2]!);
      }
      id += 1;
      const request: FloorRequest = { id, positions, surveys, skyShare };
      worker.postMessage(request, [positions.buffer, surveys.buffer]);
    };
    worker.onmessage = (event: MessageEvent<FloorAnswer>) => {
      const { weights, halfCountPc: half } = event.data;
      for (let g = 0; g < weights.length; g += 1) galaxies.bytes[g * 4 + 3] = weights[g]!;
      galaxies.bytesAttribute.clearUpdateRanges();
      galaxies.bytesAttribute.needsUpdate = true;
      galaxies.geometry.instanceCount = weights.length;
      drawn.current = weights.length;
      // The crowding's sample: every so many of the galaxies drawn, the same each frame.
      const n = Math.min(CROWDING_SAMPLE, weights.length);
      const stride = weights.length / n;
      const sample = new Float32Array(n * 3);
      for (let k = 0; k < n; k += 1) {
        const g = Math.floor(k * stride) * 4;
        sample[k * 3] = galaxies.place[g]! * COSMIC_WEB_POSITION_UNIT_PC;
        sample[k * 3 + 1] = galaxies.place[g + 1]! * COSMIC_WEB_POSITION_UNIT_PC;
        sample[k * 3 + 2] = galaxies.place[g + 2]! * COSMIC_WEB_POSITION_UNIT_PC;
      }
      crowding.current.sample = sample;
      setHalfCountPc(half);
      busy = false;
      renderDemand.request();
      if (again) {
        again = false;
        weigh();
      }
    };
    weighRef.current = weigh;
    return () => {
      weighRef.current = () => {};
      worker.terminate();
    };
  }, [galaxies, info]);
  // Each chunk copied in as it lands, then the dots weighed.
  useEffect(() => {
    if (galaxies === null) return;
    let added = false;
    while (galaxies.chunksCopied < Math.min(chunks.length, budget)) {
      const chunk = chunks[galaxies.chunksCopied]!;
      const from = galaxies.copied;
      for (let g = 0; g < chunk.count; g += 1) {
        const at = (from + g) * 4;
        galaxies.place[at] = chunk.positions[g * 3]!;
        galaxies.place[at + 1] = chunk.positions[g * 3 + 1]!;
        galaxies.place[at + 2] = chunk.positions[g * 3 + 2]!;
        galaxies.bytes[at] = chunk.absV[g]!;
        galaxies.bytes[at + 1] = chunk.bv[g]!;
        galaxies.bytes[at + 2] = chunk.flags[g]!;
      }
      galaxies.placeAttribute.addUpdateRange(from * 4, chunk.count * 4);
      galaxies.placeAttribute.needsUpdate = true;
      galaxies.copied += chunk.count;
      galaxies.chunksCopied += 1;
      added = true;
    }
    if (added) weighRef.current();
  }, [galaxies, chunks, budget]);

  // ---- The filaments: one instanced draw of segments.
  // Made in a worker: a few hundred milliseconds the frame should not wait on.
  const [segments, setSegments] = useState<FilamentSegments | null>(null);
  useEffect(() => {
    if (info === null || filamentData === null) return;
    const worker = new Worker(new URL('../core/cosmicWebSegments.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<FilamentSegments>) => {
      setSegments(event.data);
      worker.terminate();
      renderDemand.request();
    };
    worker.postMessage({ filaments: filamentData, info: info.filaments });
    return () => worker.terminate();
  }, [info, filamentData]);
  const filamentUniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uCameraPc: { value: new THREE.Vector3() },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uPixelsPerRadian: { value: 1 },
      uNearUnits: { value: 1e-6 },
      uOpacity: { value: new THREE.Vector2() },
      uRadiusPc: { value: new THREE.Vector2(TEMPEL_RADIUS_PC, 0) },
      uNearPc: { value: new THREE.Vector2(TEMPEL_NEAR_PC, MALAVASI_NEAR_PC) },
      uDepthPc: { value: FILAMENT_DEPTH_FROM_PC },
      uColor0: { value: new THREE.Color().setStyle(TEMPEL_COLOR, THREE.LinearSRGBColorSpace) },
      uColor1: { value: new THREE.Color().setStyle(MALAVASI_COLOR, THREE.LinearSRGBColorSpace) },
    }),
    [],
  );
  const filaments = useMemo(() => {
    if (segments === null) return null;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('aA', new THREE.InstancedBufferAttribute(segments.a, 4, true));
    geometry.setAttribute('aB', new THREE.InstancedBufferAttribute(segments.b, 4, true));
    geometry.instanceCount = segments.count;
    const object = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: filamentUniforms,
        vertexShader: FILAMENT_VERTEX,
        fragmentShader: FILAMENT_FRAGMENT,
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
    object.visible = false;
    return object;
  }, [segments, filamentUniforms]);
  useEffect(
    () => () => {
      if (filaments === null) return;
      filaments.geometry.dispose();
      (filaments.material as THREE.Material).dispose();
    },
    [filaments],
  );
  // Each catalogue's share of the sky, for the crowding.
  const filamentSky = useMemo(() => {
    if (info === null) return [1, 1];
    const share = (pattern: RegExp) =>
      (info.footprints.surveys.find((f) => f.of === 'filaments' && pattern.test(f.name))?.areaDeg2 ?? SKY_DEG2) / SKY_DEG2;
    return [share(/Tempel/), share(/Malavasi/)];
  }, [info]);

  useEffect(() => {
    const objects: THREE.Object3D[] = [];
    if (galaxies !== null) objects.push(galaxies.object);
    if (filaments !== null) objects.push(filaments);
    if (objects.length === 0) return;
    group.add(...objects);
    renderDemand.request();
    return () => {
      group.remove(...objects);
    };
  }, [group, galaxies, filaments]);

  useFrame(({ camera, gl: renderer }) => {
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
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
    // Asked for once each: past their distance, or switched on.
    if (showFilaments && !asked.current.filaments && fromSunPc > FILAMENTS_FROM_PC) asked.current.filaments = true;
    if (showGalaxies && !asked.current.galaxies && fromSunPc > GALAXIES_FROM_PC) asked.current.galaxies = true;
    if (asked.current.filaments) void source.filaments.request();
    if (asked.current.galaxies && source.galaxies.chunks.length < Math.max(1, budget)) source.galaxies.request(Math.max(1, budget));

    const galaxyFade = showGalaxies ? galaxyVisibility(fromSunPc * PARSEC_KM) : 0;
    const filamentFade = showFilaments ? structuresFade(fromSunPc) : 0;
    group.visible = (galaxies !== null && drawn.current > 0 && galaxyFade > 0) || (filaments !== null && filamentFade > 0);
    if (!group.visible) return;
    group.position.copy(camera.position);
    group.updateMatrixWorld();
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const heightPx = renderer.getDrawingBufferSize(scratchSize).y;
    const pixelsPerRadian = heightPx / (2 * Math.tan((fov * Math.PI) / 360));

    if (galaxies !== null) {
      galaxies.object.visible = drawn.current > 0 && galaxyFade > 0;
      (galaxyUniforms['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      galaxyUniforms['uPixelsPerRadian']!.value = pixelsPerRadian;
      renderer.getDrawingBufferSize(galaxyUniforms['uViewportPx']!.value as THREE.Vector2);
      galaxyUniforms['uFade']!.value = galaxyFade;
      galaxyUniforms['uDepthPc']!.value = Math.max(FILAMENT_DEPTH_FROM_PC, (2 * camera.position.length() * KM_PER_UNIT) / PARSEC_KM);
      const kept = floorShown(halfCountPc, fromSunPc, pixelsPerRadian);
      galaxyUniforms['uFloorKept']!.value = kept;
      // Where on the screen the dots crowd (screenCrowding.ts): measured while they are drawn at all.
      const c = crowding.current;
      const size = renderer.getDrawingBufferSize(scratchSize);
      if (c.grid === null || c.texture === null || c.texture.image.width !== Math.ceil(size.x / CELL_PX) || c.texture.image.height !== Math.ceil(size.y / CELL_PX)) {
        c.texture?.dispose();
        c.grid = crowdingGrid(size.x, size.y);
        c.texture = new THREE.DataTexture(c.grid.kept, c.grid.cols, c.grid.rows, THREE.RedFormat, THREE.UnsignedByteType);
        c.texture.minFilter = THREE.LinearFilter;
        c.texture.magFilter = THREE.LinearFilter;
        c.texture.unpackAlignment = 1;
        galaxyUniforms['uCrowding']!.value = c.texture;
      }
      if (kept > 0 && galaxyFade > 0 && c.sample.length > 0) {
        camera.updateMatrixWorld();
        scratchMatrix.setFromMatrix4(camera.matrixWorldInverse);
        const e = camera.projectionMatrix.elements;
        measureCrowding(c.grid, c.sample, c.sample.length / 3, drawn.current / (c.sample.length / 3), cameraPc, scratchMatrix.elements, e[0]!, e[5]!, size.x, size.y);
        c.texture.needsUpdate = true;
      }
    }

    if (filaments !== null && segments !== null) {
      filaments.visible = filamentFade > 0;
      const u = filamentUniforms;
      (u['uCameraPc']!.value as THREE.Vector3).copy(cameraPc);
      renderer.getDrawingBufferSize(u['uViewportPx']!.value as THREE.Vector2);
      u['uPixelsPerRadian']!.value = pixelsPerRadian;
      u['uNearUnits']!.value = (camera as THREE.PerspectiveCamera).near;
      // The scene is about the focus (floatingOrigin.ts): the camera's distance from what it looks at.
      u['uDepthPc']!.value = Math.max(FILAMENT_DEPTH_FROM_PC, (2 * camera.position.length() * KM_PER_UNIT) / PARSEC_KM);
      const kept = (catalogue: number, fullPx: number) =>
        lineKept(segments.halfLengthRadiusPc[catalogue]!, segments.lengthPc[catalogue]! / 2, filamentSky[catalogue]!, fromSunPc, pixelsPerRadian, fullPx);
      (u['uOpacity']!.value as THREE.Vector2).set(
        filamentFade * TEMPEL_BASE * kept(COSMIC_WEB_FILAMENT_CATALOGUES.tempel2014, TEMPEL_FULL_SEPARATION_PX),
        filamentFade * MALAVASI_BASE * kept(COSMIC_WEB_FILAMENT_CATALOGUES.malavasi2020, MALAVASI_FULL_SEPARATION_PX),
      );
    }
  });

  return <primitive object={group} />;
}
