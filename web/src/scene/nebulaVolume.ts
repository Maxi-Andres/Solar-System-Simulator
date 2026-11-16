import * as THREE from 'three';

import { nebulaFrame, nebulaReach, partAxes, type Nebula, type NebulaPart } from '../core/nebulae.ts';
import type { Vec3 } from '../core/vec3.ts';
import type { Rgb } from './blackbody.ts';
import { GLOW_OUTPUT_GLSL } from './glowBuffer.ts';
import { lineColour, remnantNoiseTexture, type Line } from './remnantVolume.ts';

/**
 * A nebula's glowing gas, drawn as a volume (core/nebulae.ts): the camera can fly round it and
 * into it, as round a supernova remnant (remnantVolume.ts), whose noise and ray march it shares.
 *
 * ## Its parts
 *
 * Each nebula is a few parts (NebulaPart), each an ellipsoid of its own axes: a **cloud** of gas
 * densest at its middle, (1 - r^2)^1.5; a **shell** at its surface, a Gaussian of its width,
 * brighter round its equator by its `equator`; a **bowl**, a shell's far half, open toward Earth;
 * a **ring**, a torus; and **dust**, which gives no light and dims what lies behind it.
 *
 * ## Clumps and filaments, where the noise puts them
 *
 * Inside those outlines the gas is clumped: a star-forming region's into filaments and knots by
 * the remnants' ridged noise, sharply; a planetary nebula's only a little. Where each clump is,
 * is not measured: it is the model's, not the nebula's own.
 *
 * ## Colour, from its spectrum
 *
 * Two colours, each the lines' through the CIE functions (remnantVolume.ts lineColour): the red of
 * hydrogen's H-alpha and H-beta with nitrogen's and sulphur's lines beside them, at an H II
 * region's strengths; and the teal of doubly ionised oxygen's [O III] 500.7/495.9 nm with H-beta.
 * [O III] is where the ultraviolet is hardest: toward a region's middle, on a shell's inner side
 * -- the ionisation stratification every planetary nebula shows. How much of each is the part's
 * `oxygen`, read off narrowband photographs, not measured fluxes.
 *
 * ## Light
 *
 * Each pixel sums the light along its line of sight, front to back, the dust ahead dimming what
 * is behind (e^-tau): the Horsehead is a dark pillar against IC 434's glow from Earth's side.
 * The brightness is a choice: each nebula scaled so its brightest line of sight from Earth comes
 * to NEBULA_PEAK white columns -- a long exposure's look, as every photograph of them is. To the
 * eye almost none shows.
 */

/** The red: H-alpha and H-beta at case B (2.86 : 1), [N II] 658.4/654.8 and [S II] 671.6/673.1 at an H II region's strengths. */
export const HYDROGEN_RED: readonly Line[] = [
  [656.3, 1],
  [486.1, 1 / 2.86],
  [658.4, 0.3],
  [654.8, 0.1],
  [671.6, 0.08],
  [673.1, 0.06],
];

/** The teal: [O III] 500.7 and 495.9 nm, three to one, with H-beta. */
export const OXYGEN_TEAL: readonly Line[] = [
  [500.7, 1],
  [495.9, 1 / 3],
  [486.1, 0.15],
];

export const MAX_PARTS = 4;
/** The brightest line of sight from Earth, white columns, before the clumps. */
export const NEBULA_PEAK = 2.2;
/** How much the dust dims, per nebula radius of path, for its `light` of 1 and its smallest semi-axis. */
const DUST_PER_RADIUS = 2.5;
const STEPS = 96;

const FORM_ID: Record<NebulaPart['form'], number> = { cloud: 0, shell: 1, bowl: 2, ring: 3, dust: 4 };

/** One part made ready for the shader: its matrix to its unit sphere, its centre, its numbers. */
export interface PreparedPart {
  /** Rows: e1, e2, e3 each over its semi-axis, in nebula radii. */
  readonly rows: readonly [Vec3, Vec3, Vec3];
  readonly offset: Vec3;
  readonly form: number;
  /** A Gaussian's sigma, for a shell's or ring's width, in its radii. */
  readonly sigma: number;
  readonly equator: number;
  /** Its light, or for dust, how much it dims per nebula radius. */
  readonly strength: number;
  readonly oxygen: number;
}

export function prepareParts(nebula: Nebula): PreparedPart[] {
  const unit = nebula.sizeArcmin[0] / 2;
  return nebula.parts.slice(0, MAX_PARTS).map((p) => {
    const { e1, e2, e3, offset } = partAxes(nebula, p);
    const [a, b, c] = p.semiAxesArcmin.map((s) => s / unit) as [number, number, number];
    const scale = (e: Vec3, s: number): Vec3 => ({ x: e.x / s, y: e.y / s, z: e.z / s });
    return {
      rows: [scale(e1, a), scale(e2, b), scale(e3, c)],
      offset,
      form: FORM_ID[p.form],
      sigma: p.width / 2.355,
      equator: p.equator,
      strength: p.form === 'dust' ? (p.light * DUST_PER_RADIUS) / Math.min(a, b, c) : p.light,
      oxygen: p.oxygen,
    };
  });
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * The light and the dust at a point, in nebula radii from its centre, as the shader has them but
 * without the clumps: [light, dust]. For the brightness's scale and the tests.
 */
export function partsAt(parts: readonly PreparedPart[], p: Vec3, away: Vec3): [number, number] {
  let light = 0;
  let dust = 0;
  for (const part of parts) {
    const d = { x: p.x - part.offset.x, y: p.y - part.offset.y, z: p.z - part.offset.z };
    const q = part.rows.map((row) => row.x * d.x + row.y * d.y + row.z * d.z) as [number, number, number];
    const r = Math.hypot(q[0], q[1], q[2]);
    switch (part.form) {
      case 4:
        dust += part.strength * smoothstep(1, 0.6, r);
        break;
      case 0:
        light += part.strength * Math.max(0, 1 - r * r) ** 1.5;
        break;
      case 1:
      case 2: {
        const t = (r - 1) / part.sigma;
        const pole = q[2] / Math.max(r, 1e-3);
        let e = Math.exp(-0.5 * t * t) * (1 + part.equator * Math.exp(-(pole * pole) / (2 * 0.3 * 0.3)));
        if (part.form === 2) {
          const n = Math.max(Math.hypot(d.x, d.y, d.z), 1e-6);
          e *= smoothstep(-0.2, 0.3, (d.x * away.x + d.y * away.y + d.z * away.z) / n);
        }
        light += part.strength * e;
        break;
      }
      case 3: {
        const rho = Math.hypot(q[0], q[1]);
        const t = Math.hypot(rho - 1, q[2]) / part.sigma;
        light += part.strength * Math.exp(-0.5 * t * t);
        break;
      }
    }
  }
  return [light, dust];
}

/**
 * The column of light along the brightest lines of sight from Earth, without the clumps: rays
 * through a grid across the nebula, the dust in front dimming as in the shader. Its gain is
 * NEBULA_PEAK over this.
 */
export function brightestColumn(nebula: Nebula, parts = prepareParts(nebula), grid = 25, steps = 160): number {
  const { east, north, away } = nebulaFrame(nebula);
  const reach = nebulaReach(nebula);
  const dt = (2 * reach) / steps;
  let best = 0;
  for (let j = 0; j < grid; j += 1) {
    for (let i = 0; i < grid; i += 1) {
      const x = ((i + 0.5) / grid) * 2 - 1;
      const y = ((j + 0.5) / grid) * 2 - 1;
      let sum = 0;
      let transmitted = 1;
      for (let k = 0; k < steps; k += 1) {
        // From the near side (toward Earth) outward, as a ray from Earth runs.
        const z = -reach + (k + 0.5) * dt;
        const p = {
          x: (east.x * x + north.x * y) * reach + away.x * z,
          y: (east.y * x + north.y * y) * reach + away.y * z,
          z: (east.z * x + north.z * y) * reach + away.z * z,
        };
        const [light, dust] = partsAt(parts, p, away);
        sum += transmitted * light * dt;
        transmitted *= Math.exp(-dust * dt);
      }
      best = Math.max(best, sum);
    }
  }
  return best;
}

export const NEBULA_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uReach;
  varying vec3 vLocal;

  void main() {
    // The sphere is the unit sphere scaled to the reach: object space here in nebula radii.
    vLocal = position * uReach;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

export const NEBULA_FRAGMENT_SHADER = /* glsl */ `
  precision highp sampler3D;
  #include <common>
  #include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}

  uniform sampler3D uNoise;
  uniform vec3 uSeed;
  uniform vec3 uCameraLocal;
  // Each ray's direction from its pixel alone, so the sphere's flat triangles never enter into
  // it: the viewport the pixel is in; the projection's x and y terms (P00, P11, P20, P21); and
  // view space's axes in object space.
  uniform vec4 uViewport;
  uniform vec4 uProjection;
  uniform mat3 uViewToLocal;
  uniform vec3 uAway;
  uniform float uReach;
  uniform int uCount;
  uniform mat3 uAxes[${MAX_PARTS}];
  uniform vec3 uOffset[${MAX_PARTS}];
  // form, sigma, equator, strength
  uniform vec4 uForm[${MAX_PARTS}];
  uniform float uOxygen[${MAX_PARTS}];
  uniform vec3 uRed;
  uniform vec3 uTeal;
  // How clumped: a star-forming region's 1, a planetary nebula's less.
  uniform float uClumps;
  // The noise's scale: cells of about a fifth of the smallest part across.
  uniform float uNoiseScale;
  uniform float uGain;
  uniform float uFade;

  varying vec3 vLocal;

  vec2 raySphere(vec3 origin, vec3 direction, float radius) {
    float b = dot(origin, direction);
    float c = dot(origin, origin) - radius * radius;
    float d = b * b - c;
    if (d < 0.0) return vec2(1.0, -1.0);
    float root = sqrt(d);
    return vec2(-b - root, -b + root);
  }

  // Light (rgb) and dust (a) at a point, nebula radii from its centre.
  vec4 emission(vec3 p) {
    vec4 broad = texture(uNoise, p * (0.35 * uNoiseScale) + uSeed);
    vec4 fine = texture(uNoise, p * (1.3 * uNoiseScale) + uSeed.yzx);
    vec4 finer = texture(uNoise, p * (3.4 * uNoiseScale) + uSeed.zxy);
    vec3 light = vec3(0.0);
    float dust = 0.0;
    for (int i = 0; i < ${MAX_PARTS}; i++) {
      if (i >= uCount) break;
      vec4 f = uForm[i];
      vec3 d = p - uOffset[i];
      vec3 q = uAxes[i] * d;
      float r = length(q);
      int form = int(f.x + 0.5);
      if (form == 4) {
        // Dust: ragged at its edge, thicker in places.
        dust += f.w * smoothstep(1.0, 0.6, r + 0.25 * (broad.r - 0.5)) * (0.6 + 0.8 * fine.r);
        continue;
      }
      float e = 0.0;
      float inner = 0.0;
      if (form == 0) {
        float s = clamp(1.0 - r * r, 0.0, 1.0);
        e = s * sqrt(s);
        inner = clamp(1.0 - r, 0.0, 1.0);
      } else if (form == 3) {
        float rho = length(q.xy);
        float t = length(vec2(rho - 1.0, q.z)) / f.y;
        e = exp(-0.5 * t * t);
        inner = smoothstep(1.0 + f.y, 1.0 - 1.5 * f.y, rho);
      } else {
        // The shell's radius wanders a little, as no shell is smooth.
        float t = (r - 1.0 - 0.08 * (broad.g - 0.5)) / f.y;
        float pole = q.z / max(r, 1e-3);
        e = exp(-0.5 * t * t) * (1.0 + f.z * exp(-pole * pole / 0.18));
        if (form == 2) e *= smoothstep(-0.2, 0.3, dot(normalize(d), uAway));
        inner = smoothstep(1.0 + f.y, 1.0 - 1.5 * f.y, r);
      }
      float oxygen = clamp(uOxygen[i] * (0.4 + 1.2 * inner), 0.0, 1.0);
      light += f.w * e * mix(uRed, uTeal, oxygen);
    }
    // Clumps and filaments: the ridged channel sharpened, finer ridges on top -- a model.
    float clumps = 0.25 + 1.6 * pow(fine.g, 4.0) + 1.1 * pow(finer.g, 6.0) * (0.4 + broad.r);
    float structure = mix(0.85 + 0.3 * fine.g, clumps * (0.4 + 1.2 * broad.r), uClumps);
    return vec4(light * structure, dust);
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 origin = uCameraLocal;
    vec2 ndc = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw * 2.0 - 1.0;
    vec3 view = vec3((ndc.x + uProjection.z) / uProjection.x, (ndc.y + uProjection.w) / uProjection.y, -1.0);
    vec3 direction = normalize(uViewToLocal * view);
    vec2 outer = raySphere(origin, direction, uReach);
    float t0 = max(outer.x, 0.0);
    float t1 = outer.y;
    if (t1 <= t0) discard;
    float dt = (t1 - t0) / float(${STEPS});

    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 sum = vec3(0.0);
    float transmitted = 1.0;
    for (int i = 0; i < ${STEPS}; i++) {
      vec4 here = emission(origin + direction * (t0 + (float(i) + jitter) * dt));
      sum += transmitted * here.rgb * dt;
      transmitted *= exp(-here.a * dt);
      if (transmitted < 0.01) break;
    }
    gl_FragColor = glowLight(sum * uGain * uFade);
  }
`;

/** A seed for a nebula's noise: an offset into the tiling texture from its key, so no two look alike. */
function nebulaSeed(nebula: Nebula): THREE.Vector3 {
  let h = 2166136261;
  for (const c of nebula.key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const unit = (k: number) => (((Math.imul(h, k) >>> 0) % 10007) / 10007);
  return new THREE.Vector3(unit(0x9e3779b1), unit(0x85ebca6b), unit(0xc2b2ae35));
}

const gains = new Map<string, number>();

/** Whether a nebula's gain is worked out already: it costs a few hundred thousand samples. */
export function hasNebulaGain(nebula: Nebula): boolean {
  return gains.has(nebula.key);
}

/** NEBULA_PEAK over its brightest column: worked out once a nebula, the first time it is drawn. */
export function nebulaGain(nebula: Nebula): number {
  let gain = gains.get(nebula.key);
  if (gain === undefined) {
    gain = NEBULA_PEAK / Math.max(brightestColumn(nebula), 1e-6);
    gains.set(nebula.key, gain);
  }
  return gain;
}

const vec = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);
const colourOf = (rgb: Rgb) => new THREE.Vector3(...rgb);

export function nebulaMaterial(nebula: Nebula): THREE.ShaderMaterial {
  const parts = prepareParts(nebula);
  const unit = nebula.sizeArcmin[0] / 2;
  const smallest = Math.min(...nebula.parts.filter((p) => p.form !== 'dust').map((p) => Math.min(...p.semiAxesArcmin) / unit));
  const axes = Array.from({ length: MAX_PARTS }, (_, i) => {
    const m = new THREE.Matrix3();
    const part = parts[i];
    if (part !== undefined) {
      const [a, b, c] = part.rows;
      m.set(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    return m;
  });
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: remnantNoiseTexture() },
      uSeed: { value: nebulaSeed(nebula) },
      uCameraLocal: { value: new THREE.Vector3() },
      uViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
      uProjection: { value: new THREE.Vector4(1, 1, 0, 0) },
      uViewToLocal: { value: new THREE.Matrix3() },
      uAway: { value: vec(nebulaFrame(nebula).away) },
      uReach: { value: nebulaReach(nebula) },
      uCount: { value: parts.length },
      uAxes: { value: axes },
      uOffset: { value: Array.from({ length: MAX_PARTS }, (_, i) => vec(parts[i]?.offset ?? { x: 0, y: 0, z: 0 })) },
      uForm: {
        value: Array.from({ length: MAX_PARTS }, (_, i) => {
          const part = parts[i];
          return part === undefined ? new THREE.Vector4() : new THREE.Vector4(part.form, part.sigma, part.equator, part.strength);
        }),
      },
      uOxygen: { value: Array.from({ length: MAX_PARTS }, (_, i) => parts[i]?.oxygen ?? 0) },
      uRed: { value: colourOf(lineColour(HYDROGEN_RED)) },
      uTeal: { value: colourOf(lineColour(OXYGEN_TEAL)) },
      uClumps: { value: nebula.kind === 'planetary' ? 0.35 : 1 },
      uNoiseScale: { value: Math.min(4, 1 / Math.max(smallest, 0.05)) },
      uGain: { value: nebulaGain(nebula) },
      uFade: { value: 0 },
    },
    vertexShader: NEBULA_VERTEX_SHADER,
    fragmentShader: NEBULA_FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  });
}
