import * as THREE from 'three';

import { decodeMapChannel, type FaceOnMap } from '../core/localGroup.ts';

/**
 * A disc's face-on map (core/localGroup.ts FaceOnMap) as the shader reads it: decoded once,
 * here, into what each channel stands for -- the old stars' and the young stars' V light,
 * L_Sun/pc^2, and the dust's optical depth in V, face-on -- in half floats, with a mipmap
 * chain made by averaging those, light and depth, rather than their logarithms.
 *
 * The 8-bit PNG is only how the map travels: decoded in the shader, three powers of ten at
 * each of a ray's 128 steps held a frame of Andromeda filling the screen to 66 ms.
 */

export interface FaceOnLevel {
  readonly width: number;
  readonly data: Float32Array;
}

/**
 * The map's levels, linear: RGBA pixels (as a canvas gives them) through the bounds, each
 * channel times its scale; then halved, two by two, down to one texel.
 */
export function faceOnLevels(
  rgba: Uint8ClampedArray,
  map: FaceOnMap,
  scales: readonly [number, number, number],
): FaceOnLevel[] {
  const n = map.size;
  const bounds = [map.bounds.old, map.bounds.sfr, map.bounds.dust] as const;
  // A lookup per channel: 256 codes.
  const tables = bounds.map((b, c) => Float32Array.from({ length: 256 }, (_, code) => decodeMapChannel(code, b) * scales[c]!));
  const base = new Float32Array(n * n * 4);
  for (let i = 0; i < n * n; i += 1) {
    base[i * 4] = tables[0]![rgba[i * 4]!]!;
    base[i * 4 + 1] = tables[1]![rgba[i * 4 + 1]!]!;
    base[i * 4 + 2] = tables[2]![rgba[i * 4 + 2]!]!;
    base[i * 4 + 3] = 1;
  }
  const levels: FaceOnLevel[] = [{ width: n, data: base }];
  for (let width = n >> 1; width >= 1; width >>= 1) {
    const above = levels[levels.length - 1]!;
    const data = new Float32Array(width * width * 4);
    for (let y = 0; y < width; y += 1) {
      for (let x = 0; x < width; x += 1) {
        for (let c = 0; c < 4; c += 1) {
          const at = (dx: number, dy: number) => above.data[((2 * y + dy) * above.width + 2 * x + dx) * 4 + c]!;
          data[(y * width + x) * 4 + c] = (at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4;
        }
      }
    }
    levels.push({ width, data });
  }
  return levels;
}

/** The levels as a half-float texture, its own mipmaps, linearly filtered between them. */
export function faceOnTexture(levels: readonly FaceOnLevel[]): THREE.DataTexture {
  const half = (level: FaceOnLevel) => {
    const out = new Uint16Array(level.data.length);
    for (let i = 0; i < out.length; i += 1) out[i] = THREE.DataUtils.toHalfFloat(level.data[i]!);
    return out;
  };
  const first = levels[0]!;
  const texture = new THREE.DataTexture(half(first), first.width, first.width, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mipmaps = levels.map((level) => ({ data: half(level), width: level.width, height: level.width })) as never;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A PNG's pixels exactly as stored: no colour management, no premultiplying. */
export async function pngPixels(url: string): Promise<Uint8ClampedArray> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { colorSpace: 'srgb' })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}
