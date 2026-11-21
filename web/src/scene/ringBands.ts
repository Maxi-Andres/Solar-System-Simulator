import * as THREE from 'three';

import type { RingBand, RingSystem } from '@sss/tools/types';

import { RING_FLAT_RADIANCE_FACTOR } from './ringMaterial.ts';
import { SHADOW_FLOOR, SHADOW_OPACITY_EXPONENT, SHADOW_OPACITY_GAIN } from './ringShadow.ts';

/**
 * Rings drawn from their measurements rather than from a picture: Uranus's and Neptune's.
 *
 * Saturn's rings are a published radial strip, an artist's opacity read as a ring
 * (ringMaterial.ts). Nobody publishes one for Uranus or Neptune, and none is needed: their
 * rings are few, and each is measured -- where it is, how wide, and how much starlight it
 * blocked when a star passed behind it. So the strip is made here, from the catalog's
 * RingBand list, with the same shape Saturn's has -- `u` runs from the inner radius to the
 * outer, and the alpha channel is each radius's face-on opacity -- and from then on it is
 * drawn, and casts its shadow, exactly as Saturn's is.
 *
 * ## Opacity, from optical depth
 *
 * A ring of normal optical depth tau lets through e^-tau of the light that crosses it face-on.
 * A texel `d` km wide that a ring covers `w` km of passes, on average,
 *
 *   1 - (w / d) * (1 - e^-tau),
 *
 * and where rings overlap their passes multiply. One minus that is the texel's opacity. Most
 * of Uranus's rings are a few km wide, under a texel, so this is what keeps them: drawn as a
 * fraction of a texel at their own depth, each blocks what it really blocks, and a lens that
 * blurs it to a texel loses nothing of how much.
 *
 * Each level of the mipmap is the mean of the two texels under it, which is the same sum done
 * coarser -- the mean opacity is the opacity of the mean transmission -- so a ring seen from
 * far off fades, as it should, rather than shimmering in and out between texels.
 *
 * ## Half floats
 *
 * Their dusty rings are optical depth 1e-4 -- an opacity of a ten-thousandth, which eight
 * bits round to nothing. Half floats keep it, and are filterable in WebGL2 without an
 * extension.
 */

/** Texels across the strip: Uranus's 24,360 km at 6 km each, Neptune's 22,060 at 5.4. */
export const RING_STRIP_TEXELS = 4096;

/** A ring's mean normal optical depth: its equivalent depth spread over its width. */
export function bandOpticalDepth(band: RingBand): number {
  return band.equivalentDepthKm / band.widthKm;
}

/** Each texel's face-on opacity, the left edge at the inner radius. */
export function ringStripOpacity(rings: RingSystem, texels = RING_STRIP_TEXELS): Float32Array {
  const out = new Float32Array(texels);
  const span = rings.outerRadiusKm - rings.innerRadiusKm;
  const texel = span / texels;
  for (let i = 0; i < texels; i += 1) {
    const from = rings.innerRadiusKm + i * texel;
    const to = from + texel;
    let passes = 1;
    for (const band of rings.bands) {
      const covered = Math.min(to, band.radiusKm + band.widthKm / 2) - Math.max(from, band.radiusKm - band.widthKm / 2);
      if (covered > 0) {
        passes *= 1 - (covered / texel) * (1 - Math.exp(-bandOpticalDepth(band)));
      }
    }
    out[i] = 1 - passes;
  }
  return out;
}

/** The mipmap chain of a strip: each level the mean of the two texels under it, down to one. */
export function ringStripLevels(base: Float32Array): Float32Array[] {
  const levels = [base];
  let level = base;
  while (level.length > 1) {
    const next = new Float32Array(Math.ceil(level.length / 2));
    for (let i = 0; i < next.length; i += 1) {
      const a = level[2 * i]!;
      const b = level[2 * i + 1] ?? a;
      next[i] = (a + b) / 2;
    }
    levels.push(next);
    level = next;
  }
  return levels;
}

function rgbaHalf(opacity: Float32Array): Uint16Array {
  const out = new Uint16Array(opacity.length * 4);
  const one = THREE.DataUtils.toHalfFloat(1);
  for (let i = 0; i < opacity.length; i += 1) {
    out[i * 4] = one;
    out[i * 4 + 1] = one;
    out[i * 4 + 2] = one;
    out[i * 4 + 3] = THREE.DataUtils.toHalfFloat(opacity[i]!);
  }
  return out;
}

const strips = new Map<RingSystem, THREE.DataTexture>();

/**
 * The strip as a texture: made the first time it is asked for, and kept -- 64 KB with its
 * mipmaps, and the same rings every time.
 */
export function ringStripTexture(rings: RingSystem): THREE.DataTexture {
  const cached = strips.get(rings);
  if (cached !== undefined) {
    return cached;
  }
  const levels = ringStripLevels(ringStripOpacity(rings));
  const texture = new THREE.DataTexture(rgbaHalf(levels[0]!), levels[0]!.length, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mipmaps = levels.map((level) => ({ data: rgbaHalf(level), width: level.length, height: 1 }));
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // u is radius: clamped, as Saturn's map is, so the outer edge never folds onto the inner.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // No anisotropic filtering, unlike Saturn's map. Seen at a slant, a ring a few km wide is
  // finer than a pixel along the slant, and anisotropic filtering, sampling along it a few
  // times rather than averaging all of it, caught it at a few points: dotted lines across the
  // planet. The plain mipmap averages the whole footprint, so a slanted ring is the faint
  // continuous line its average opacity makes.
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  strips.set(rings, texture);
  return texture;
}

/**
 * The particles' reflectivity the Saturn calibration stands for: the dense B ring's radiance
 * factor near opposition, 0.55, which ringMaterial.ts anchors its model at.
 */
export const SATURN_RING_REFLECTIVITY = 0.55;

/**
 * How bright a ring system is drawn, in ringMaterial's flat path: Saturn's calibrated
 * brightness for a picture, and for measured rings the same scaled by how much less their
 * particles reflect. Uranus's and Neptune's, at geometric albedo 0.05, come out at a
 * eleventh of Saturn's -- dark, as their particles are.
 */
export function ringFlatRadianceFactor(rings: RingSystem): number {
  return rings.particleAlbedo === null
    ? RING_FLAT_RADIANCE_FACTOR
    : (RING_FLAT_RADIANCE_FACTOR * rings.particleAlbedo) / SATURN_RING_REFLECTIVITY;
}

/**
 * The ring shadow's three settings (ringShadow.ts). Saturn's correct an artist's opacity
 * toward real optical depths and add back its rings' diffuse light and ringshine; a
 * measured strip is already real optical depth, and dark rings return almost nothing, so its
 * shadow is the plain face-on transmission.
 */
export function ringShadowSettings(rings: RingSystem): { floor: number; exponent: number; gain: number } {
  return rings.texture === null
    ? { floor: 0, exponent: 1, gain: 1 }
    : { floor: SHADOW_FLOOR, exponent: SHADOW_OPACITY_EXPONENT, gain: SHADOW_OPACITY_GAIN };
}
