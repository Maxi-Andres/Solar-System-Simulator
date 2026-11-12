import * as THREE from 'three';

import { GLOW_OUTPUT_GLSL } from './glowBuffer.ts';

import { skyAxes } from '../core/exoplanets.ts';
import {
  remnantRadiusKm,
  remnantShape,
  remnantState,
  type RemnantMap,
  type SupernovaRemnant,
} from '../core/supernovaRemnants.ts';
import type { Vec3 } from '../core/vec3.ts';
import { PARSEC_KM } from './scale.ts';
import {
  NOISE_SIZE,
  remnantLook,
  remnantNoiseData,
  remnantNoiseTexture,
  remnantSeed,
  SHELL_FWHM,
  VOLUME_RADIUS,
} from './remnantVolume.ts';

/**
 * A supernova remnant drawn from a photograph of it, in 3D (D6e).
 *
 * A photograph is a measurement: how much light, of what colour, comes from each point of the
 * sky. It says nothing of how deep along the line of sight that light is. So each point's light
 * is spread along its line of sight through the remnant -- the light measured, its depth a
 * model -- and the sum along every line of sight from Earth is exactly the photograph's pixel.
 * Seen from the Sun the volume is the photograph; from anywhere else it is the photograph's
 * light at a modelled depth, and the camera can fly round it and into it.
 *
 * ## The depth: where along each line of sight
 *
 * A weight along each line of sight (depthWeights), summing to one, on a grid DEPTH_SIZE^3
 * in the remnant's sky frame -- east, north, away from Earth -- coarser than the photograph,
 * which keeps its own resolution across the sky:
 *
 * - **filament light**, at the shell: where the line of sight crosses the remnant's shell
 *   (a sphere of its mean radius, or the spheroid of its measured axis), the shell's width
 *   stretched along a grazing line;
 * - **synchrotron light** (a pulsar wind nebula's, the Crab's), through the depth of its
 *   spheroid, most at its middle -- the wind fills it.
 *
 * Each is broken by noise into clumps along the line of sight, so that from the side the light
 * is gas and not streaks: where along the line the clumps are is not measured. And a filament is
 * on the near side of the shell or the far one, not both -- which, the noise decides, a patch at a
 * time: lit on both, each would be seen twice from anywhere but Earth, its two copies apart.
 *
 * ## The two lights, from the photograph's colours
 *
 * For the Crab the photograph holds both: the synchrotron's smooth blue and the filaments'
 * lines. Its preparation (web/public/remnants/CREDITS.md) finds the synchrotron's colour in
 * the photograph itself -- the bluest bright pixels at its middle -- and takes from each pixel
 * the most of that colour it holds (a second, grey map); the rest is the filaments'.
 *
 * ## Where the depth is measured
 *
 * Cassiopeia A's is: DeLaney et al. 2010 mapped its ejecta in 3D from the Doppler shifts of their
 * lines -- in free expansion a knot's velocity along the line of sight is its depth -- and their
 * surfaces are published as points (RemnantPoints). Where those points are, each line of sight's
 * light is put at their depths (measuredDepth), smoothed over a couple of voxels; where there
 * are none the shell above stands in.
 *
 * ## A picture in light the eye does not see
 *
 * Where no photograph shows the whole remnant in visible light (Tycho's, SN 1006, Puppis A) or
 * the one that does is in red and near-infrared filters (Cassiopeia A's), the picture gives only
 * where the light is and how much: it is a grey map, drawn in the colour of the remnant's own
 * visible lines (remnantVolume.ts) -- for Tycho's and SN 1006 the outer shock in X-rays, which is
 * where their Balmer filaments are.
 *
 * ## The photograph
 *
 * Prepared before it is drawn: reprojected north up and centred on Green's centre, its stars
 * taken out -- the star catalogue draws them, at their own distances -- its sky background
 * taken off, and what lies beyond the remnant faded out. Its brightness is its makers' stretch
 * of a long exposure; to the eye almost none of this shows.
 */

/** The maps' side, pixels (tools/remnants/prepare.py). */
export const MAP_PIXELS = 1024;
/** The depth grid's side, voxels. */
export const DEPTH_SIZE = 96;
const STEPS = 128;
/** How deep the synchrotron light reaches, as a share of the spheroid's half-depth: its sigma. */
const FILL_DEPTH = 0.45;
/**
 * The most a shell's light is spread along a grazing line of sight, mean radii: past this its
 * filaments would be drawn as streaks from the side.
 */
const MAX_WIDTH = 0.06;
/** The clumps' frequency: noise cells of about a tenth of a radius. */
const CLUMP_SCALE = 2.4;

export interface RemnantFrame {
  readonly east: Vec3;
  readonly north: Vec3;
  readonly away: Vec3;
}

export function remnantFrame(remnant: SupernovaRemnant): RemnantFrame {
  const at = remnantState(remnant).position;
  const n = Math.hypot(at.x, at.y, at.z);
  return skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
}

/** The remnant's mean radius, arcminutes. */
export function remnantRadiusArcmin(remnant: SupernovaRemnant): number {
  return (Math.atan(remnantRadiusKm(remnant) / (remnant.distancePc * PARSEC_KM)) * 180 * 60) / Math.PI;
}

/** How far the drawn volume reaches from the centre, in mean radii: the map's light, or the spheroid. */
export function mapReach(remnant: SupernovaRemnant, map: RemnantMap): number {
  const shape = remnantShape(remnant);
  return Math.max(VOLUME_RADIUS * (shape === null ? 1 : Math.max(shape.along, shape.across)), map.reachArcmin / remnantRadiusArcmin(remnant));
}

/**
 * The shape in the sky frame: the matrix taking (east, north, away), in mean radii, to where the
 * shell is the unit sphere.
 */
function skyShape(remnant: SupernovaRemnant, frame: RemnantFrame): number[] {
  const shape = remnantShape(remnant);
  if (shape === null) {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  const axis = [dot(shape.axis, frame.east), dot(shape.axis, frame.north), dot(shape.axis, frame.away)];
  const m: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const along = axis[row]! * axis[col]!;
      m.push(along / shape.along + ((row === col ? 1 : 0) - along) / shape.across);
    }
  }
  return m;
}

function gauss(x: number, mean: number, sigma: number): number {
  const t = (x - mean) / sigma;
  return Math.exp(-0.5 * t * t) / sigma;
}

/**
 * The depth weights: DEPTH_SIZE^3 pairs -- filament light's, synchrotron light's -- on a grid
 * reaching `reach` mean radii from the centre each way along east, north and away (x, y, z, z
 * fastest... see `index`), each column along z summing, times its voxel's depth, to one.
 */
export function depthWeights(remnant: SupernovaRemnant, frame: RemnantFrame, reach: number, size = DEPTH_SIZE): Float32Array {
  const m = skyShape(remnant, frame);
  const noise = remnantNoiseData();
  const seed = remnantSeed(remnant);
  const out = new Float32Array(size * size * size * 2);
  const dz = (2 * reach) / size;
  const sigma = SHELL_FWHM / 2.355;
  // The noise, trilinear, at a point in mean radii: clumps a few tenths of a radius across.
  const sample = (x: number, y: number, z: number, channel: number) => {
    const fx = (x * CLUMP_SCALE + seed.x * 7) * (NOISE_SIZE / 4);
    const fy = (y * CLUMP_SCALE + seed.y * 7) * (NOISE_SIZE / 4);
    const fz = (z * CLUMP_SCALE + seed.z * 7) * (NOISE_SIZE / 4);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const z0 = Math.floor(fz);
    let sum = 0;
    for (let c = 0; c < 8; c += 1) {
      const dx = c & 1;
      const dy = (c >> 1) & 1;
      const dzz = (c >> 2) & 1;
      const w = (dx ? fx - x0 : 1 - fx + x0) * (dy ? fy - y0 : 1 - fy + y0) * (dzz ? fz - z0 : 1 - fz + z0);
      const i = (((x0 + dx) % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
      const j = (((y0 + dy) % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
      const k = (((z0 + dzz) % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
      sum += w * noise[((k * NOISE_SIZE + j) * NOISE_SIZE + i) * 4 + channel]!;
    }
    return sum / 255;
  };
  const lineColumn = new Float32Array(size);
  const fillColumn = new Float32Array(size);
  for (let j = 0; j < size; j += 1) {
    const north = ((j + 0.5) / size) * 2 * reach - reach;
    for (let i = 0; i < size; i += 1) {
      const east = ((i + 0.5) / size) * 2 * reach - reach;
      // The line of sight against the shell: |M (s + z away)| = 1.
      const a0 = [m[0]! * east + m[1]! * north, m[3]! * east + m[4]! * north, m[6]! * east + m[7]! * north];
      const ad = [m[2]!, m[5]!, m[8]!];
      const A = ad[0]! ** 2 + ad[1]! ** 2 + ad[2]! ** 2;
      const B = a0[0]! * ad[0]! + a0[1]! * ad[1]! + a0[2]! * ad[2]!;
      const C = a0[0]! ** 2 + a0[1]! ** 2 + a0[2]! ** 2 - 1;
      const disc = B * B - A * C;
      const mid = -B / A;
      const half = disc > 0 ? Math.sqrt(disc) / A : 0;
      // A grazing line of sight crosses the shell's width over a longer stretch; one past the shell
      // (light the picture shows beyond its mean radius) is put where it grazes a sphere of its own.
      const width = disc > 0 ? Math.min(Math.max(sigma / Math.max(half, 1e-3), sigma), MAX_WIDTH) : sigma;
      // Near (+1) or far (-1), a patch at a time, a narrow band between.
      const split = Math.tanh(6 * (2 * sample(east, north, 0, 2) - 1));
      let lineSum = 0;
      let fillSum = 0;
      for (let k = 0; k < size; k += 1) {
        const z = ((k + 0.5) / size) * 2 * reach - reach;
        const clumps = 0.05 + sample(east, north, z, 1) ** 4;
        const line =
          (0.5 * (1 + split) * gauss(z, mid + half, width) + 0.5 * (1 - split) * gauss(z, mid - half, width)) * clumps;
        const fill = gauss(z, mid, FILL_DEPTH * half + sigma) * (0.1 + sample(east, north, z, 0) ** 2);
        lineColumn[k] = line;
        fillColumn[k] = fill;
        lineSum += line * dz;
        fillSum += fill * dz;
      }
      for (let k = 0; k < size; k += 1) {
        const at = ((k * size + j) * size + i) * 2;
        out[at] = lineSum > 0 ? lineColumn[k]! / lineSum : 0;
        out[at + 1] = fillSum > 0 ? fillColumn[k]! / fillSum : 0;
      }
    }
  }
  return out;
}

/** Every point's place in mean radii, from the file's 1/4096 arcminutes. */
export function pointsInRadii(raw: Int16Array, radiusArcmin: number): Float32Array {
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw[i]! / 4096 / radiusArcmin;
  return out;
}

/**
 * The depth weights where the gas is mapped in 3D: the points binned on the grid (trilinear),
 * smoothed by a 5-voxel binomial each way, and each column normalised as depthWeights' are --
 * blended into the model's where a column holds fewer than MEASURED_POINTS, and left the
 * model's where it holds none. The synchrotron channel is the model's.
 */
const MEASURED_POINTS = 2;
export function measuredDepth(points: Float32Array, model: Float32Array, reach: number, size = DEPTH_SIZE): Float32Array {
  const grid = new Float32Array(size * size * size);
  const cell = (2 * reach) / size;
  for (let p = 0; p + 2 < points.length; p += 3) {
    const fx = (points[p]! + reach) / cell - 0.5;
    const fy = (points[p + 1]! + reach) / cell - 0.5;
    const fz = (points[p + 2]! + reach) / cell - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const z0 = Math.floor(fz);
    for (let c = 0; c < 8; c += 1) {
      const x = x0 + (c & 1);
      const y = y0 + ((c >> 1) & 1);
      const z = z0 + ((c >> 2) & 1);
      if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) continue;
      const w =
        (c & 1 ? fx - x0 : 1 - fx + x0) * ((c >> 1) & 1 ? fy - y0 : 1 - fy + y0) * ((c >> 2) & 1 ? fz - z0 : 1 - fz + z0);
      const at = (z * size + y) * size + x;
      grid[at] = grid[at]! + w;
    }
  }
  const kernel = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  const blurred = new Float32Array(grid.length);
  for (const stride of [1, size, size * size]) {
    blurred.fill(0);
    for (let at = 0; at < grid.length; at += 1) {
      const along = Math.floor(at / stride) % size;
      for (let t = -2; t <= 2; t += 1) {
        const to = along + t;
        if (to < 0 || to >= size) continue;
        blurred[at + t * stride] = blurred[at + t * stride]! + grid[at]! * kernel[t + 2]!;
      }
    }
    grid.set(blurred);
  }
  const out = new Float32Array(model);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      let count = 0;
      for (let k = 0; k < size; k += 1) count += grid[(k * size + j) * size + i]!;
      if (count <= 0) continue;
      const measured = Math.min(1, count / MEASURED_POINTS);
      for (let k = 0; k < size; k += 1) {
        const at = ((k * size + j) * size + i) * 2;
        out[at] = measured * (grid[(k * size + j) * size + i]! / (count * cell)) + (1 - measured) * model[at]!;
      }
    }
  }
  return out;
}

export const REMNANT_MAP_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uReach;
  varying vec3 vLocal;

  void main() {
    // The sphere is built at VOLUME_RADIUS and scaled to reach; object space here in mean radii.
    vLocal = position * (uReach / ${VOLUME_RADIUS.toFixed(4)});
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

export const REMNANT_MAP_FRAGMENT_SHADER = /* glsl */ `
  precision highp sampler3D;
  #include <common>
  #include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}

  uniform sampler2D uMap;
  uniform sampler2D uContinuum;
  uniform sampler3D uDepth;
  uniform vec3 uCameraLocal;
  uniform vec3 uEast;
  uniform vec3 uNorth;
  uniform vec3 uAway;
  // The map's half-width and the depth grid's, in mean radii.
  uniform float uMapHalf;
  uniform float uReach;
  // The synchrotron's colour in the photograph, and whether it has any.
  uniform vec3 uSynchrotron;
  uniform float uHasContinuum;
  // A grey map's colours, its lines' (remnantVolume.ts): the second in a share of the gas, by
  // noise, as the model draws them; a photograph has its own.
  uniform float uLines;
  uniform vec3 uColourA;
  uniform vec3 uColourB;
  uniform float uShareB;
  uniform sampler3D uNoise;
  uniform vec3 uSeed;
  uniform float uFade;
  // A screen pixel's angle, radians, and a map pixel's width in mean radii: a sample's level of
  // detail is worked out from them, as a texture fetched along a ray has no derivatives to give one.
  uniform float uPixelAngle;
  uniform float uMapTexel;

  varying vec3 vLocal;

  vec2 raySphere(vec3 origin, vec3 direction, float radius) {
    float b = dot(origin, direction);
    float c = dot(origin, origin) - radius * radius;
    float d = b * b - c;
    if (d < 0.0) return vec2(1.0, -1.0);
    float root = sqrt(d);
    return vec2(-b - root, -b + root);
  }

  // The light at a point: its line of sight's light from the map, times the share of it at this
  // depth -- weights summing to one along every line of sight from Earth.
  vec3 emission(vec3 p, float lod) {
    vec3 sky = vec3(dot(p, uEast), dot(p, uNorth), dot(p, uAway));
    vec2 uv = vec2(0.5 - 0.5 * sky.x / uMapHalf, 0.5 + 0.5 * sky.y / uMapHalf);
    if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec3(0.0);
    vec3 tint = vec3(1.0);
    if (uLines > 0.5) {
      float second = smoothstep(0.3, 0.7, texture(uNoise, p * 0.8 + uSeed).b + (uShareB - 0.5));
      tint = mix(uColourA, uColourB, second * step(0.001, uShareB));
    }
    vec3 shown = min(textureLod(uMap, uv, lod).rgb * tint, vec3(0.97));
    // What the column must add to, for 1 - e^-sum to give back the photograph's pixel.
    vec3 column = -log(1.0 - shown);
    vec2 weights = texture(uDepth, sky / (2.0 * uReach) + 0.5).rg;
    if (uHasContinuum < 0.5) return column * weights.r;
    vec3 continuum = textureLod(uContinuum, uv, lod).r * uSynchrotron;
    vec3 share = clamp(continuum / max(shown, vec3(1e-4)), 0.0, 1.0);
    return column * mix(vec3(weights.r), vec3(weights.g), share);
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 origin = uCameraLocal;
    vec3 direction = normalize(vLocal - origin);
    vec2 outer = raySphere(origin, direction, uReach);
    float t0 = max(outer.x, 0.0);
    float t1 = outer.y;
    if (t1 <= t0) discard;
    float dt = (t1 - t0) / float(${STEPS});

    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < ${STEPS}; i++) {
      float t = t0 + (float(i) + jitter) * dt;
      sum += emission(origin + direction * t, max(log2(t * uPixelAngle / uMapTexel), 0.0));
    }
    sum *= dt;
    // Linear, into the glow buffer: one shoulder over every glow, the light past white spilled (glowBuffer.ts).
    gl_FragColor = glowLight(sum * uFade);
  }
`;

function remnantUrl(file: string): string {
  return `${import.meta.env.BASE_URL}remnants/${file}`;
}

function loadTexture(file: string, onLoad: () => void): THREE.Texture {
  const texture = new THREE.TextureLoader().load(remnantUrl(file), onLoad);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** How far the volume reaches, in mean radii, for the mesh's scale. */
export function remnantMapReach(remnant: SupernovaRemnant): number {
  return remnant.map === null ? VOLUME_RADIUS : mapReach(remnant, remnant.map);
}

export function remnantMapMaterial(remnant: SupernovaRemnant, map: RemnantMap, onLoad: () => void): THREE.ShaderMaterial {
  const frame = remnantFrame(remnant);
  const reach = mapReach(remnant, map);
  const weights = depthWeights(remnant, frame, reach);
  // Half floats: filterable in WebGL2 without an extension, as 32-bit floats are not.
  const half = new Uint16Array(weights.length);
  const toHalf = (from: Float32Array) => {
    for (let i = 0; i < from.length; i += 1) half[i] = THREE.DataUtils.toHalfFloat(from[i]!);
  };
  toHalf(weights);
  const depth = new THREE.Data3DTexture(half, DEPTH_SIZE, DEPTH_SIZE, DEPTH_SIZE);
  depth.format = THREE.RGFormat;
  depth.type = THREE.HalfFloatType;
  depth.minFilter = THREE.LinearFilter;
  depth.magFilter = THREE.LinearFilter;
  depth.wrapS = THREE.ClampToEdgeWrapping;
  depth.wrapT = THREE.ClampToEdgeWrapping;
  depth.wrapR = THREE.ClampToEdgeWrapping;
  depth.needsUpdate = true;
  if (map.points !== null) {
    // The measured depths, once they come: until then the model's.
    void fetch(remnantUrl(map.points.file))
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
      .then((buffer) => {
        const points = pointsInRadii(new Int16Array(buffer), remnantRadiusArcmin(remnant));
        toHalf(measuredDepth(points, weights, reach));
        depth.needsUpdate = true;
        onLoad();
      })
      .catch(() => undefined);
  }
  const synchrotron = map.continuum?.colour ?? [0, 0, 0];
  const look = remnantLook(remnant.emission);
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: loadTexture(map.file, onLoad) },
      uContinuum: { value: map.continuum === null ? null : loadTexture(map.continuum.file, onLoad) },
      uDepth: { value: depth },
      uCameraLocal: { value: new THREE.Vector3() },
      uEast: { value: new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z) },
      uNorth: { value: new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z) },
      uAway: { value: new THREE.Vector3(frame.away.x, frame.away.y, frame.away.z) },
      uMapHalf: { value: map.halfArcmin / remnantRadiusArcmin(remnant) },
      uReach: { value: reach },
      uSynchrotron: { value: new THREE.Vector3(...synchrotron) },
      uHasContinuum: { value: map.continuum === null ? 0 : 1 },
      uLines: { value: map.colour === 'lines' ? 1 : 0 },
      uColourA: { value: new THREE.Vector3(...look.colourA) },
      uColourB: { value: new THREE.Vector3(...look.colourB) },
      uShareB: { value: look.shareB },
      uNoise: { value: remnantNoiseTexture() },
      uSeed: { value: remnantSeed(remnant) },
      uFade: { value: 0 },
      uPixelAngle: { value: 0.001 },
      uMapTexel: { value: (2 * map.halfArcmin) / remnantRadiusArcmin(remnant) / MAP_PIXELS },
    },
    vertexShader: REMNANT_MAP_VERTEX_SHADER,
    fragmentShader: REMNANT_MAP_FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  });
}
