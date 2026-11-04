import * as THREE from 'three';

import { remnantShape, type RemnantEmission, type SupernovaRemnant } from '../core/supernovaRemnants.ts';
import { cieX, cieY, cieZ, type Rgb } from './blackbody.ts';

/**
 * A supernova remnant's glowing gas, drawn as a volume (D6e): a model, built from what is
 * measured of it -- its size, its kind of shock, the lines its light is in -- and filled in
 * where nothing is measured, which the About says.
 *
 * ## The shell
 *
 * A remnant's shock sweeps the gas it runs into up into a shell. Behind a strong shock the
 * gas is four times as dense as ahead of it (the Rankine-Hugoniot jump for a monatomic gas,
 * gamma = 5/3), so the gas once spread through the sphere fits, at that density, in a shell
 * one twelfth of its radius thick:
 *
 *   4 pi R^2 * dR * 4 rho = (4/3) pi R^3 rho   =>   dR = R / 12.
 *
 * The shell is drawn with that width (SHELL_FWHM), at the remnant's mean radius, its radius
 * wandering by a tenth either way (SHELL_WANDER): no remnant is a perfect sphere, and the
 * shape of none is measured in 3D but Cas A's and the Crab's (not used).
 *
 * ## Filaments, where the noise puts them
 *
 * A remnant's visible light is not a smooth shell but filaments: sheets of shocked gas seen
 * edge on, and the clouds the shock has hit. Where each one is, is not measured in three
 * dimensions for any of them. They are drawn from noise (remnantNoise): ridges of tileable
 * gradient noise, sharpened, laid on the shell -- a model of a network of filaments, not
 * the remnant's own. Cas A's ejecta are knots, drawn as the noise's peaks.
 *
 * ## Colour, from its spectrum
 *
 * Each kind of remnant shines in its own emission lines (RemnantEmission), and its colour is
 * those lines' colour: each line's wavelength through the CIE 1931 colour-matching functions,
 * weighted by its strength, to linear sRGB (lineColour). Hydrogen's H-alpha is a deep red,
 * doubly ionised oxygen's [O III] 500.7 nm a blue-green, and where both shine -- in a
 * radiative shock -- they are drawn in different filaments, as a narrowband photograph shows
 * them: [O III] comes from the faster shocks, H-alpha from where the gas has cooled.
 *
 * ## Light, not a surface
 *
 * The gas is thin enough to be clear: each pixel adds up the light along its line of sight
 * through the volume (a ray march, the atmosphere's way, atmosphere.ts), with nothing
 * absorbed. A shell so summed is brightest at its edge, where the line of sight runs along
 * it -- limb brightening, why remnants look like rings.
 *
 * Its brightness is a choice (REMNANT_GAIN): drawn as a long exposure shows it. To the eye
 * almost none shows at all.
 */

/** The shell's full width at half its peak, in its radii: R / 12, see the header. */
export const SHELL_FWHM = 1 / 12;
/** How far the shell's radius wanders, either way, in its radii. */
export const SHELL_WANDER = 0.1;
/** The volume drawn: a sphere this many radii across, room for the wandering shell. */
export const VOLUME_RADIUS = 1.25;
/** Light added per radius of path, before the shoulder. */
export const REMNANT_GAIN = 14;
/** Samples along each ray. */
const STEPS = 96;

/** The noise texture's side, voxels, and the gradient lattice's periods in it. */
export const NOISE_SIZE = 64;
const NOISE_PERIODS = [4, 8, 16] as const;

// --- Spectra ---------------------------------------------------------------------------

/** An emission line: wavelength in air, nm, and its strength against the others. */
export type Line = readonly [wavelengthNm: number, strength: number];

/**
 * Hydrogen's two strongest visible lines. H-alpha is about three times H-beta: 2.86 where
 * the gas recombines (case B, Osterbrock & Ferland 2006), a little more behind a Balmer
 * shock, where collisions excite it too (Ghavamian et al. 2001).
 */
const BALMER: readonly Line[] = [
  [656.3, 1],
  [486.1, 1 / 3],
];

/**
 * A cooled shock's red lines: hydrogen's, with [N II] 654.8/658.4 and [S II] 671.6/673.1. A
 * remnant is told from an H II region by [S II] / H-alpha above 0.4 (Mathewson & Clarke 1973);
 * in the evolved remnants Fesen, Blair & Kirshner 1985 measure, it runs 0.4 to over 1. These
 * strengths are typical, not any one remnant's.
 */
const RADIATIVE_RED: readonly Line[] = [
  ...BALMER,
  [658.4, 0.45],
  [654.8, 0.15],
  [671.6, 0.45],
  [673.1, 0.35],
];

/** [O III] 500.7 and 495.9 nm: three to one, fixed by the atom (Storey & Zeippen 2000). */
const OXYGEN_III: readonly Line[] = [
  [500.7, 1],
  [495.9, 1 / 3],
];

/**
 * Cas A's fast-moving knots: its ejecta, oxygen and sulphur with almost no hydrogen
 * (Chevalier & Kirshner 1979) -- [S II], [O I] 630.0/636.4 and [O II] 732.0/733.0 in its red.
 */
const EJECTA_RED: readonly Line[] = [
  [671.6, 0.5],
  [673.1, 0.45],
  [630.0, 0.3],
  [636.4, 0.1],
  [732.0, 0.25],
  [733.0, 0.2],
];

/**
 * The Crab's filaments: hydrogen's lines with [N II], [S II], [O I] and [O III] in the same
 * filaments (Davidson & Fesen 1985), not apart -- so their red and green add, to orange.
 */
const CRAB_FILAMENTS: readonly Line[] = [...RADIATIVE_RED, [630.0, 0.15], [636.4, 0.05], ...OXYGEN_III];

/**
 * A spectrum's colour: its lines through the CIE 1931 functions to linear sRGB, out-of-gamut
 * channels clipped at zero, scaled so the strongest channel is 1 -- a hue, not a brightness.
 */
export function lineColour(lines: readonly Line[]): Rgb {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [wavelength, strength] of lines) {
    x += strength * cieX(wavelength);
    y += strength * cieY(wavelength);
    z += strength * cieZ(wavelength);
  }
  return peakToOne(x, y, z);
}

/**
 * The Crab's synchrotron light: a power law, F_nu proportional to nu^-0.7 in the visible --
 * about -0.6 at its centre, steeper outward (Veron-Cetty & Woltjer 1993) -- so F_lambda
 * proportional to lambda^(0.7 - 2), summed through the same functions.
 */
export function synchrotronColour(index = 0.7): Rgb {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let wavelength = 380; wavelength <= 780; wavelength += 1) {
    const flux = wavelength ** (index - 2);
    x += flux * cieX(wavelength);
    y += flux * cieY(wavelength);
    z += flux * cieZ(wavelength);
  }
  return peakToOne(x, y, z);
}

function peakToOne(x: number, y: number, z: number): Rgb {
  const r = Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z);
  const g = Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z);
  const b = Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z);
  const peak = Math.max(r, g, b);
  return [r / peak, g / peak, b / peak];
}

/** How each kind of remnant is drawn: its two filament colours, the share of the second, its shape. */
export interface RemnantLook {
  /** The colour of most of its filaments, and of the rest, and the share of the rest (0-1). */
  readonly colourA: Rgb;
  readonly colourB: Rgb;
  readonly shareB: number;
  /** The light filling its volume (a pulsar wind nebula's), and how much; 0 for a hollow shell. */
  readonly fillColour: Rgb;
  readonly fill: number;
  /** Knots (1) rather than filaments (0). */
  readonly knots: number;
  /** The shell's width and radius, in its radii: a pulsar wind nebula's filaments fill its outer half. */
  readonly shellFwhm: number;
  readonly shellRadius: number;
}

export function remnantLook(emission: RemnantEmission): RemnantLook {
  const hollow = { fillColour: [0, 0, 0] as Rgb, fill: 0, knots: 0, shellFwhm: SHELL_FWHM, shellRadius: 1 };
  switch (emission) {
    case 'balmer':
      return { ...hollow, colourA: lineColour(BALMER), colourB: lineColour(BALMER), shareB: 0 };
    case 'radiative':
      // [O III] in about a third of the filaments: the photographs' share, not a measurement.
      return { ...hollow, colourA: lineColour(RADIATIVE_RED), colourB: lineColour(OXYGEN_III), shareB: 0.35 };
    case 'oxygen-rich':
      return { ...hollow, colourA: lineColour(EJECTA_RED), colourB: lineColour(OXYGEN_III), shareB: 0.45, knots: 1 };
    case 'pulsar-wind':
      // The filaments are a cage round the synchrotron light, through the outer half of it.
      return {
        colourA: lineColour(CRAB_FILAMENTS),
        colourB: lineColour(CRAB_FILAMENTS),
        shareB: 0,
        fillColour: synchrotronColour(),
        fill: 1,
        knots: 0,
        shellFwhm: 0.3,
        shellRadius: 0.85,
      };
  }
}

// --- Noise ------------------------------------------------------------------------------

/** A deterministic hash of three integers to [0, 1). */
function hash3(i: number, j: number, k: number, seed: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x9e3779b1) ^ Math.imul(seed, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const GRADIENTS = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
] as const;

/** Gradient noise, period `period` lattice cells each way, at a point in cells: about -1 to 1. */
function gradientNoise(x: number, y: number, z: number, period: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(fx);
  const v = fade(fy);
  const w = fade(fz);
  const corner = (di: number, dj: number, dk: number) => {
    const wrap = (n: number) => ((n % period) + period) % period;
    const g = GRADIENTS[Math.floor(hash3(wrap(x0 + di), wrap(y0 + dj), wrap(z0 + dk), seed) * 12)]!;
    return g[0] * (fx - di) + g[1] * (fy - dj) + g[2] * (fz - dk);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), u), lerp(corner(0, 1, 0), corner(1, 1, 0), u), v),
    lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), u), lerp(corner(0, 1, 1), corner(1, 1, 1), u), v),
    w,
  );
}

/**
 * The noise the volume is drawn from: NOISE_SIZE^3 voxels, tiling in every direction, four
 * channels each scaled to 0-255 --
 *
 *   R  smooth: three octaves of gradient noise, for the shell's wandering radius and patchiness;
 *   G  ridged: one minus the noise's magnitude, octave by octave, whose ridges are filaments;
 *   B  another smooth field, which filaments are in the second colour;
 *   A  the finest octave alone, whose peaks are knots.
 */
export function remnantNoise(size = NOISE_SIZE): Uint8Array {
  const n = size * size * size;
  const fields = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  let at = 0;
  for (let k = 0; k < size; k += 1) {
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        let smooth = 0;
        let ridged = 0;
        let other = 0;
        let amplitude = 1;
        for (const period of NOISE_PERIODS) {
          const s = period / size;
          const a = gradientNoise(i * s, j * s, k * s, period, 1);
          smooth += amplitude * a;
          ridged += amplitude * (1 - Math.abs(a)) ** 2;
          other += amplitude * gradientNoise(i * s, j * s, k * s, period, 2);
          amplitude *= 0.5;
        }
        const s = NOISE_PERIODS[NOISE_PERIODS.length - 1]! / size;
        fields[0]![at] = smooth;
        fields[1]![at] = ridged;
        fields[2]![at] = other;
        fields[3]![at] = gradientNoise(i * s, j * s, k * s, NOISE_PERIODS[NOISE_PERIODS.length - 1]!, 3);
        at += 1;
      }
    }
  }
  const out = new Uint8Array(n * 4);
  fields.forEach((field, channel) => {
    let low = Infinity;
    let high = -Infinity;
    for (const value of field) {
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    for (let v = 0; v < n; v += 1) {
      out[v * 4 + channel] = Math.round((255 * (field[v]! - low)) / (high - low));
    }
  });
  return out;
}

let noiseData: Uint8Array | null = null;

/** The noise, made once: about a second's work. */
export function remnantNoiseData(): Uint8Array {
  noiseData ??= remnantNoise();
  return noiseData;
}

let noiseTexture: THREE.Data3DTexture | null = null;

/** The noise as a 3D texture, made once, the first time a remnant's gas is drawn. */
export function remnantNoiseTexture(): THREE.Data3DTexture {
  if (noiseTexture === null) {
    const texture = new THREE.Data3DTexture(remnantNoiseData(), NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    noiseTexture = texture;
  }
  return noiseTexture;
}

// --- Shader -----------------------------------------------------------------------------

export const REMNANT_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uExtent;

  varying vec3 vLocal;

  void main() {
    // The sphere is built at VOLUME_RADIUS and the mesh scaled by the shell's radius, so
    // object space is in shell radii: small numbers however far off the camera is.
    vLocal = position * uExtent;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

export const REMNANT_FRAGMENT_SHADER = /* glsl */ `
  precision highp sampler3D;
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler3D uNoise;
  uniform vec3 uCameraLocal;
  uniform vec3 uSeed;
  uniform vec3 uColourA;
  uniform vec3 uColourB;
  uniform float uShareB;
  uniform vec3 uFillColour;
  uniform float uFill;
  uniform float uKnots;
  uniform float uShellSigma;
  uniform float uShellRadius;
  uniform float uGain;
  uniform float uFade;
  // Its shape: object space (mean radii) to where its shell is the unit sphere; and how far
  // out the drawn volume reaches, in mean radii.
  uniform mat3 uShape;
  uniform float uExtent;

  varying vec3 vLocal;

  const float OUTER = ${VOLUME_RADIUS.toFixed(4)};
  const float WANDER = ${SHELL_WANDER.toFixed(4)};

  vec2 raySphere(vec3 origin, vec3 direction, float radius) {
    float b = dot(origin, direction);
    float c = dot(origin, origin) - radius * radius;
    float d = b * b - c;
    if (d < 0.0) return vec2(1.0, -1.0);
    float root = sqrt(d);
    return vec2(-b - root, -b + root);
  }

  // The light given at a point, in shell radii from the centre.
  vec3 emission(vec3 p) {
    float r = length(uShape * p);
    vec4 broad = texture(uNoise, p * 0.3 + uSeed);
    vec4 fine = texture(uNoise, p * 1.4 + uSeed.yzx);
    vec4 finer = texture(uNoise, p * 3.7 + uSeed.zxy);

    float radius = uShellRadius * (1.0 + WANDER * (2.0 * broad.r - 1.0));
    float d = (r - radius) / uShellSigma;
    float shell = exp(-0.5 * d * d);

    // Filaments: the ridged channel sharpened, finer ridges on top; or knots, the peaks.
    float filaments = 1.6 * pow(fine.g, 9.0) + 1.4 * pow(finer.g, 12.0) * (0.3 + fine.r) + 0.02;
    float knots = smoothstep(0.62, 0.82, finer.a) * (0.5 + fine.r);
    float structure = mix(filaments, knots, uKnots) * (0.3 + 1.4 * broad.g * broad.g);

    float second = smoothstep(0.5 - 0.12, 0.5 + 0.12, broad.b + (uShareB - 0.5));
    vec3 colour = mix(uColourA, uColourB, second * step(0.001, uShareB));
    vec3 light = shell * structure * colour;

    // A pulsar wind nebula's synchrotron light fills it, fading to its edge.
    float inside = clamp(1.0 - r / (radius + uShellSigma), 0.0, 1.0);
    light += uFill * uFillColour * inside * inside * (0.18 + 0.12 * broad.r);
    return light;
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 origin = uCameraLocal;
    vec3 direction = normalize(vLocal - origin);
    vec2 outer = raySphere(origin, direction, OUTER * uExtent);
    float t0 = max(outer.x, 0.0);
    float t1 = outer.y;
    if (t1 <= t0) discard;

    // A hollow shell is marched only through the shell: the hollow inside it skipped.
    // Only for a sphere: a spheroid's hollow is not a sphere, and is marched through.
    float hollowRadius = uFill > 0.0 || uExtent != 1.0 ? 0.0 : uShellRadius * (1.0 - WANDER) - 3.0 * uShellSigma;
    vec2 hollow = raySphere(origin, direction, max(hollowRadius, 0.0));
    float a0 = t0, a1 = t1, b0 = t1, b1 = t1;
    if (hollowRadius > 0.0 && hollow.y > hollow.x && hollow.y > t0) {
      a1 = max(hollow.x, t0);
      b0 = max(hollow.y, t0);
    }
    float lengthA = max(a1 - a0, 0.0);
    float lengthB = max(b1 - b0, 0.0);
    float total = lengthA + lengthB;
    if (total <= 0.0) discard;
    float dt = total / float(${STEPS});

    // Each pixel's samples start at its own offset: banding traded for a fine grain.
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < ${STEPS}; i++) {
      float s = (float(i) + jitter) * dt;
      float t = s < lengthA ? a0 + s : b0 + (s - lengthA);
      sum += emission(origin + direction * t);
    }
    sum *= dt * uGain;
    // A soft shoulder rather than a clip where the limb piles light up.
    gl_FragColor = vec4((1.0 - exp(-sum)) * uFade, 1.0);
  }
`;

/** A seed for a remnant's noise: an offset into the tiling texture from its key, so no two look alike. */
export function remnantSeed(remnant: SupernovaRemnant): THREE.Vector3 {
  let h = 2166136261;
  for (const c of remnant.key) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return new THREE.Vector3(hash3(h, 1, 0, 7), hash3(h, 2, 0, 7), hash3(h, 3, 0, 7));
}

/**
 * Its shape for the shader: the matrix taking object space, in mean radii, to where its shell is
 * the unit sphere -- along its axis divided by that semi-axis, across it by the other -- and how
 * far out it reaches. The identity and 1 for a sphere.
 */
export function remnantShapeUniforms(remnant: SupernovaRemnant): { shape: THREE.Matrix3; extent: number } {
  const shape = remnantShape(remnant);
  if (shape === null) {
    return { shape: new THREE.Matrix3(), extent: 1 };
  }
  const { x, y, z } = shape.axis;
  const outer = [
    [x * x, x * y, x * z],
    [y * x, y * y, y * z],
    [z * x, z * y, z * z],
  ];
  const m = new THREE.Matrix3();
  const e: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const along = outer[row]![col]!;
      e.push(along / shape.along + ((row === col ? 1 : 0) - along) / shape.across);
    }
  }
  m.set(e[0]!, e[1]!, e[2]!, e[3]!, e[4]!, e[5]!, e[6]!, e[7]!, e[8]!);
  return { shape: m, extent: Math.max(shape.along, shape.across) };
}

export function remnantMaterial(remnant: SupernovaRemnant): THREE.ShaderMaterial {
  const look = remnantLook(remnant.emission);
  const { shape, extent } = remnantShapeUniforms(remnant);
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: remnantNoiseTexture() },
      uCameraLocal: { value: new THREE.Vector3() },
      uSeed: { value: remnantSeed(remnant) },
      uColourA: { value: new THREE.Vector3(...look.colourA) },
      uColourB: { value: new THREE.Vector3(...look.colourB) },
      uShareB: { value: look.shareB },
      uFillColour: { value: new THREE.Vector3(...look.fillColour) },
      uFill: { value: look.fill },
      uKnots: { value: look.knots },
      // A Gaussian's FWHM is 2.355 sigma.
      uShellSigma: { value: look.shellFwhm / 2.355 },
      uShellRadius: { value: look.shellRadius },
      uGain: { value: REMNANT_GAIN },
      uFade: { value: 0 },
      uShape: { value: shape },
      uExtent: { value: extent },
    },
    vertexShader: REMNANT_VERTEX_SHADER,
    fragmentShader: REMNANT_FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    // Its back faces: drawn from inside it as from outside.
    side: THREE.BackSide,
    toneMapped: false,
  });
}
