import * as THREE from 'three';

import { linearToSrgb } from './shading.ts';
import { PSF_SIGMA_PX, srgbToLinear, STAR_WING_FRACTION } from './starRendering.ts';

/**
 * One buffer for the diffuse light, and what happens to its light past white.
 *
 * Every glow in the picture -- the galaxies' volumes and points (LocalGroup.tsx), the Clouds'
 * sky volumes (SkyVolume.tsx), the globular clusters' points (GlobularClusters.tsx), the
 * nuclear cluster's glow (nuclearClusterGlow.ts), the Milky Way's own buffer (MilkyWay.tsx) --
 * is a column of light in units of the white column, x = Sigma / columnAt(WHITE_MU). Each used
 * to show its own x through a shoulder, 1 - e^-x, straight onto the screen. That shoulder
 * throws away every bit of light past white: a cluster's or a galaxy's centre a thousand times
 * past white came out a flat white plate with an edge, where a star as bright has a halo that
 * grows with it (starRendering.ts, STAR_WING_FRACTION) -- "a white ball with no glow" (Maxi,
 * 2026-11-11, of the nuclear cluster from afar).
 *
 * So now each writes its linear x, no shoulder, into one half-float buffer (glowLight below,
 * on GLOW_LAYER), and the buffer is laid over the frame once (GlowComposite.tsx):
 *
 * 1. **Below white nothing is spread.** A pixel's light up to WHITE_X, the white column, stays
 *    in its pixel: the models are calibrated against photographs, whose
 *    own point spread is already in them, so spreading that light again would blur it twice.
 * 2. **Past white it spills, by the star's law.** What a pixel holds past WHITE_X -- the light
 *    the shoulder only crushed into its last few display steps -- goes through the stars' own
 *    point spread:
 *    the core and the Lorentzian wing, `1 / (1 + (r / sigma)^2)` at STAR_WING_FRACTION of the
 *    core's peak, PSF_SIGMA_PX wide, normalised so its light over the frame is the light that
 *    went in. The core's share stays where it was (still past white); the wing's is spread
 *    out to the frame's own size as r^-2. Light is conserved: nothing is thrown away, it is
 *    moved (haloShares, haloPyramid).
 * 3. **One shoulder** for the sum of every glow and its halo, its 1 - e^-x linear light; then
 *    **encoded for the display as the stars are** (glowDisplay: the sRGB curve, as
 *    starRendering.ts's stars and shading.ts's bodies), and one dither, half a display step,
 *    among the display values. The shoulder's output went straight to the screen before, as if
 *    it were already a display value: a column a tenth of white showed as 24 of 255 where its
 *    light, encoded as a star's, is 87 -- a galaxy's outskirts, the Small Cloud from beside it
 *    and the faint dwarfs all far darker than the stars about them, which are encoded.
 *
 * The wing is drawn through a pyramid of halvings: level k of it is the light averaged over
 * 2^k pixels, and a sum of such blurs with equal light per octave of radius *is* an r^-2
 * profile (a Lorentzian is a scale mixture of Gaussians). Each level carries the wing's light
 * between radii 2^(k-1) and 2^k pixels, as the Lorentzian integrates there (haloShares).
 *
 * Stars keep their own sprites and their own wings: they are not in this buffer, so no star is
 * haloed twice.
 */

/** The layer the glows are drawn on: only into the glow buffer, never straight onto the frame. */
export const GLOW_LAYER = 5;

/** Half a display step, the least the composite draws: below it a pixel rounds to black. */
export const HALF_DISPLAY_STEP = 0.5 / 255;

/**
 * The faintest light a glow writes, white columns: what is shown, after the shoulder and the
 * encode, as half a display step -- 1.5e-4, the sRGB curve's straight foot, 0.5/255 / 12.92 (the
 * shoulder at so little light is the light itself, a part in ten thousand under it). Below it
 * a lone glow rounds to black; it is gaussianSprite.ts's SPRITE_FLOOR too, where a sprite stops.
 *
 * It was 0.0005 when the shoulder's output went to the screen unencoded, an eighth of a display
 * step there; encoded, 0.0005 is 1.6 steps, and the edge where a sprite stopped showed.
 */
export const GLOW_FLOOR = srgbToLinear(HALF_DISPLAY_STEP);

/**
 * The most light a pixel holds, white columns: under the half float's largest value, 65,504,
 * so a sum of glows cannot overflow to infinity. Light past it is the one thing not spilled:
 * thirty thousand times white is a centre seen from where its halo already fills the frame.
 */
export const GLOW_MAX = 30_000;

/**
 * The light a pixel keeps, white columns: one, the white column itself -- WHITE_MU, 21
 * mag/arcsec^2, is by its definition the light drawn white (LocalGroup.tsx). Below it every glow
 * is shown through the shoulder, as it is; past it the shoulder only squeezed more light into the
 * last few display steps, and the rest now spills (see the header).
 *
 * Tried first at ln 510 = 6.23, where the shoulder is within half a display step of white: the
 * nuclear cluster from a few hundred light years, metered to hold its centre at a few times
 * white, then had almost nothing past it and kept its flat plate -- x from 2 to 6 is 0.86 to
 * 0.998 of white, a plate to the eye, with no light spilled from it.
 */
export const WHITE_X = 1;

/** The fewest and most levels of the halo's pyramid. */
export const HALO_MIN_LEVELS = 1;
export const HALO_MAX_LEVELS = 11;

/**
 * Levels of the pyramid for a buffer `width` by `height` device pixels: halvings until the
 * smaller side is four texels -- the wing reaches across the frame, and no farther.
 */
export function haloLevels(width: number, height: number): number {
  const levels = Math.floor(Math.log2(Math.max(1, Math.min(width, height)))) - 2;
  return Math.min(HALO_MAX_LEVELS, Math.max(HALO_MIN_LEVELS, levels));
}

/**
 * The star's profile's light inside radius `rCss`, in units of pi sigma^2 at unit peak: its
 * Gaussian core, 2 (1 - e^(-r^2 / 2 sigma^2)), and its Lorentzian wing, the integral of
 * w / (1 + (r / sigma)^2) over the disc, w ln(1 + (r / sigma)^2).
 */
function profileLight(rCss: number, sigmaPx: number, wing: number): number {
  const x2 = (rCss / sigmaPx) ** 2;
  return 2 * (1 - Math.exp(-0.5 * x2)) + wing * Math.log1p(x2);
}

/**
 * How the light past white is shared out: `core`, kept in its own pixel, and `levels[k - 1]`,
 * spread by level k of the pyramid. The star's profile, core e^(-r^2 / 2 sigma^2) plus
 * wing STAR_WING_FRACTION / (1 + (r / sigma)^2), integrated (profileLight) out to the reach R,
 * the last level's radius: level k holds its light between 2^(k-1) and 2^k device pixels, the
 * core's share all of it inside the first pixel. They sum to 1.
 */
export function haloShares(
  levelCount: number,
  pixelRatio: number,
  sigmaPx = PSF_SIGMA_PX,
  wing = STAR_WING_FRACTION,
): { readonly core: number; readonly levels: readonly number[] } {
  const inside = (k: number): number => profileLight(2 ** k / pixelRatio, sigmaPx, wing);
  const total = inside(levelCount);
  const core = inside(0) / total;
  const levels: number[] = [];
  for (let k = 1; k <= levelCount; k += 1) {
    levels.push((inside(k) - inside(k - 1)) / total);
  }
  return { core, levels };
}

/** The part of `x` (one pixel's colour) a pixel keeps: all of it up to WHITE_X in its brightest channel, its hue kept. */
export function keptLight(x: readonly [number, number, number]): [number, number, number] {
  const peak = Math.max(x[0], x[1], x[2]);
  const scale = peak > WHITE_X ? WHITE_X / peak : 1;
  return [x[0] * scale, x[1] * scale, x[2] * scale];
}

/**
 * What the screen shows for a pixel's `total` light, white columns, one channel: the shoulder's
 * linear light, 1 - e^-x, encoded for the display by the sRGB curve, 0 to 1 (see the header).
 */
export function glowDisplay(total: number): number {
  return linearToSrgb(1 - Math.exp(-Math.max(0, total)));
}

/** glowDisplay, per channel, in GLSL: for the composite (GlowComposite.tsx) and whatever else shows the buffer. */
export const GLOW_DISPLAY_GLSL = /* glsl */ `
float glowEncode(float v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}
vec3 glowDisplay(vec3 total) {
  vec3 light = vec3(1.0) - exp(-max(total, vec3(0.0)));
  return vec3(glowEncode(light.r), glowEncode(light.g), glowEncode(light.b));
}
`;

/**
 * The GLSL every glow ends with: its linear light into the buffer, no shoulder, no encode, no
 * dither -- all three are the composite's, once. Below GLOW_FLOOR nothing is written.
 */
export const GLOW_OUTPUT_GLSL = /* glsl */ `
vec4 glowLight(vec3 x) {
  if (max(x.r, max(x.g, x.b)) < ${GLOW_FLOOR.toPrecision(6)}) discard;
  return vec4(clamp(x, vec3(0.0), vec3(${GLOW_MAX.toFixed(1)})), 1.0);
}
`;

/** The glows drawn into the buffer, so the composite knows whether there is anything to lay over the frame. */
const members = new Set<THREE.Object3D>();

/** Draws `object` into the glow buffer instead of onto the frame. */
export function drawIntoGlow(object: THREE.Object3D): void {
  object.layers.set(GLOW_LAYER);
  members.add(object);
}

/** Takes `object` out of the glow buffer's list (when it is disposed of). */
export function releaseFromGlow(object: THREE.Object3D): void {
  members.delete(object);
}

/** The Milky Way's own buffer (MilkyWay.tsx), half the canvas each way, added to the glow before its light is spilled and shown. */
export const milkyWayGlow: { texture: THREE.Texture | null; on: boolean } = { texture: null, on: false };

/** Whether any glow would draw this frame: one of them visible, in a scene, or the Milky Way's buffer on. */
export function anyGlow(): boolean {
  if (milkyWayGlow.on && milkyWayGlow.texture !== null) {
    return true;
  }
  for (const object of members) {
    let node: THREE.Object3D | null = object;
    let shown = true;
    let root: THREE.Object3D = object;
    while (node !== null) {
      if (!node.visible) {
        shown = false;
        break;
      }
      root = node;
      node = node.parent;
    }
    if (shown && (root as THREE.Scene).isScene === true) {
      return true;
    }
  }
  return false;
}

/**
 * The halo, worked on the CPU exactly as the GPU passes do (GlowComposite.tsx) -- for one
 * channel, `width` by `height` -- so the tests can hold the shaders' arithmetic to the light
 * it conserves and the profile it draws. Returns the light shown before the shoulder: what a
 * pixel keeps, plus the core's share of its excess, plus the halo -- glowDisplay of it is what
 * the screen shows.
 */
export function haloPyramid(
  input: Float32Array,
  width: number,
  height: number,
  pixelRatio = 1,
): { readonly shown: Float32Array; readonly halo: Float32Array } {
  const count = haloLevels(width, height);
  const shares = haloShares(count, pixelRatio);
  const excess = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    excess[i] = Math.max(0, Math.min(input[i]!, GLOW_MAX) - WHITE_X);
  }
  // Down: level 1 a 2 x 2 box of the excess, by texel fetches; every later level a 4 x 4 box at
  // stride 2 -- on the GPU four bilinear taps on the corners between texels.
  const sizes: [number, number][] = [[width, height]];
  const down: Float32Array[] = [excess];
  for (let k = 1; k <= count; k += 1) {
    const [w0, h0] = sizes[k - 1]!;
    const w = Math.max(1, Math.floor(w0 / 2));
    const h = Math.max(1, Math.floor(h0 / 2));
    const source = down[k - 1]!;
    const out = new Float32Array(w * h);
    const [from, to] = k === 1 ? [0, 1] : [-1, 2];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let sum = 0;
        for (let j = from; j <= to; j += 1) {
          for (let i = from; i <= to; i += 1) {
            const sx = Math.min(w0 - 1, Math.max(0, 2 * x + i));
            const sy = Math.min(h0 - 1, Math.max(0, 2 * y + j));
            sum += source[sy * w0 + sx]!;
          }
        }
        out[y * w + x] = sum / ((to - from + 1) * (to - from + 1));
      }
    }
    sizes.push([w, h]);
    down.push(out);
  }
  // Up: u_K = c_K d_K; u_k = tent(u_(k+1)) + c_k d_k; the halo is tent(u_1) at full size.
  let up = scaled(down[count]!, shares.levels[count - 1]!);
  for (let k = count - 1; k >= 1; k -= 1) {
    const [w, h] = sizes[k]!;
    const [wl, hl] = sizes[k + 1]!;
    const tent = upsample(up, wl, hl, w, h);
    const d = down[k]!;
    const c = shares.levels[k - 1]!;
    for (let i = 0; i < tent.length; i += 1) tent[i] = tent[i]! + c * d[i]!;
    up = tent;
  }
  const [w1, h1] = sizes[1]!;
  const halo = upsample(up, w1, h1, width, height);
  const shown = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const x = Math.min(input[i]!, GLOW_MAX);
    shown[i] = Math.min(x, WHITE_X) + shares.core * excess[i]! + halo[i]!;
  }
  return { shown, halo };
}

function scaled(source: Float32Array, factor: number): Float32Array {
  const out = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 1) out[i] = source[i]! * factor;
  return out;
}

/** A texture sampled bilinearly, clamped at its edges, at texel coordinates (x, y) -- centres at half-integers. */
function bilinear(source: Float32Array, w: number, h: number, x: number, y: number): number {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (i: number, j: number): number =>
    source[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))]!;
  return (
    (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
  );
}

/**
 * The upsampling tent: four bilinear taps half a low texel off each diagonal, averaged. Each
 * tap alone moves the low level's light to the high one unchanged; so does their mean.
 */
function upsample(source: Float32Array, wl: number, hl: number, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const sx = wl / w;
  const sy = hl / h;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const u = (x + 0.5) * sx;
      const v = (y + 0.5) * sy;
      out[y * w + x] =
        0.25 *
        (bilinear(source, wl, hl, u - 0.5, v - 0.5) +
          bilinear(source, wl, hl, u + 0.5, v - 0.5) +
          bilinear(source, wl, hl, u - 0.5, v + 0.5) +
          bilinear(source, wl, hl, u + 0.5, v + 0.5));
    }
  }
  return out;
}
