import * as THREE from 'three';

/**
 * Noise for the live detail a world adds close up, below its baked map's texel, read from a small
 * tiling 3D texture instead of computed: a texture read where simplex noise was some fifty
 * instructions -- on the integrated GPU measured, a close view of Adrian filling the screen went
 * from 5.4 ms back toward 3.
 *
 * **The texture.** 64 texels a side, RGBA, four independent channels of smooth value noise, each
 * periodic over 16 lattice cells, so the texture tiles seamlessly; each cell is four texels,
 * between which the GPU's trilinear filtering interpolates, over values themselves interpolated
 * with a quintic fade. 1 MB, with mipmaps a little more. Made once, the first time a world asks
 * for it, in some tens of milliseconds.
 *
 * **No tiling to see.** One period is 16 cycles of the noise; every octave is turned (noise.ts's
 * OCTAVE_TURN) and offset, and the octaves' scales are 2.03 apart, not 2, so their periods never
 * line up into a repeat.
 */

/** Texels a side, and lattice cells per period: four texels a cell. */
const SIZE = 64;
const CELLS = 16;

/** The GLSL: `detailNoise(p)` (four channels, -1..1, a cycle a unit) and `detailFbm`. Needs noise.ts's NOISE_GLSL. */
export const DETAIL_NOISE_GLSL = /* glsl */ `
  uniform highp sampler3D uDetailNoise;

  /** Four independent channels of smooth noise, -1 to 1, about a cycle a unit of \`p\`. */
  vec4 detailNoise(vec3 p) {
    return texture(uDetailNoise, p * ${(1 / CELLS).toFixed(6)}) * 2.0 - 1.0;
  }

  /**
   * Fractal sum of the texture's noise, as noise.ts's fbm is of simplex noise: octaves from
   * \`frequency\`, each 2.03 times the last and turned, those finer than the pixel left out.
   */
  float detailFbm(vec3 p, float frequency, int octaves, float gain, float footprint) {
    float sum = 0.0;
    float amplitude = 1.0;
    float total = 0.0;
    vec3 q = p * frequency;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      total += amplitude;
      float weight = octaveWeight(frequency, footprint);
      if (weight > 0.0) sum += amplitude * weight * detailNoise(q).b;
      q = OCTAVE_TURN * q * 2.03 + vec3(19.1, 7.3, 31.7);
      frequency *= 2.03;
      amplitude *= gain;
    }
    return sum / total;
  }
`;

/** A small seeded generator (mulberry32). */
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The texture's texels: four channels of periodic value noise, quintic between lattice points. */
export function detailNoiseData(): Uint8Array {
  const random = generator(1234567);
  const lattice = new Float32Array(CELLS * CELLS * CELLS * 4);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = random();
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const at = (x: number, y: number, z: number, c: number): number =>
    lattice[((((z % CELLS) * CELLS + (y % CELLS)) * CELLS + (x % CELLS)) << 2) + c]!;
  const data = new Uint8Array(SIZE * SIZE * SIZE * 4);
  const step = CELLS / SIZE;
  for (let z = 0; z < SIZE; z += 1) {
    const fz = z * step;
    const z0 = Math.floor(fz);
    const wz = fade(fz - z0);
    for (let y = 0; y < SIZE; y += 1) {
      const fy = y * step;
      const y0 = Math.floor(fy);
      const wy = fade(fy - y0);
      for (let x = 0; x < SIZE; x += 1) {
        const fx = x * step;
        const x0 = Math.floor(fx);
        const wx = fade(fx - x0);
        for (let c = 0; c < 4; c += 1) {
          const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
          const v = lerp(
            lerp(lerp(at(x0, y0, z0, c), at(x0 + 1, y0, z0, c), wx), lerp(at(x0, y0 + 1, z0, c), at(x0 + 1, y0 + 1, z0, c), wx), wy),
            lerp(lerp(at(x0, y0, z0 + 1, c), at(x0 + 1, y0, z0 + 1, c), wx), lerp(at(x0, y0 + 1, z0 + 1, c), at(x0 + 1, y0 + 1, z0 + 1, c), wx), wy),
            wz,
          );
          // Value noise bunches near the middle: stretched so its spread is about simplex noise's.
          const stretched = 0.5 + (v - 0.5) * 1.6;
          data[(((z * SIZE + y) * SIZE + x) << 2) + c] = Math.round(Math.min(Math.max(stretched, 0), 1) * 255);
        }
      }
    }
  }
  return data;
}

let shared: THREE.Data3DTexture | null = null;

/** The one texture every world's material reads its close-up detail from. */
export function detailNoiseTexture(): THREE.Data3DTexture {
  if (shared === null) {
    const texture = new THREE.Data3DTexture(detailNoiseData(), SIZE, SIZE, SIZE);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.NoColorSpace;
    texture.name = 'fiction-detail-noise';
    texture.needsUpdate = true;
    shared = texture;
  }
  return shared;
}
