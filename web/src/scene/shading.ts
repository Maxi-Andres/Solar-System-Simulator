import type { LightingMode } from '../state/store.ts';

/**
 * How bright the render makes a surface, and where the terminator therefore lands.
 *
 * The day/night line is pure geometry: it sits at 90 degrees from the sub-solar point,
 * and ours is correct there to a few thousandths of a degree, pinned against JPL. But
 * geometry is not what a person sees. What they see is that number pushed through a
 * Lambert falloff, an ambient term, ACES tone mapping and an sRGB encode -- and any of
 * those can move the *visible* edge somewhere else entirely.
 *
 * That is not hypothetical. The default lighting mode used to be `shadow`, whose
 * ambient fill of 0.08 meant a bright body's night side never reached black at all: the
 * whole disc stayed lit and the terminator never resolved into an edge. It read exactly
 * as it was reported -- "lit too much" -- while the underlying geometry was fine.
 *
 * So the response is modelled here, in numbers a test can check, instead of being
 * argued about. Note what this is: a *model* of the renderer, mirroring three.js's own
 * ACES implementation and the standard Lambert path. It is not the renderer. It is
 * accurate enough to answer "does the night side ever go black", which is the question
 * that mattered.
 */

/**
 * Sun intensity and ambient fill per lighting mode, as the scene sets them.
 *
 * The sun value is not a taste setting, and it was chosen by measurement. With no
 * ambient the render can only reach the display floor *before* 90 degrees, never after
 * -- past 90 the cosine is negative and the answer is exactly zero. So raising the
 * intensity moves the visible edge toward the geometric one monotonically, and it
 * brightens the image at the same time. There is no trade to make, only a ceiling:
 * push far enough and the lit side flattens into white.
 *
 * At 1.9 the darkest maps faded out 5 degrees early and Earth peaked at 28% grey, which
 * is both wrong and murky. At 5.0 every body's terminator lands within 1.9 degrees of
 * geometric, Earth peaks at 53% and the brightest body, Venus, reaches 87% with
 * highlight headroom to spare. Beyond that the returns are tenths of a degree for real
 * loss of contrast.
 *
 * `shadow` uses the same sun as `natural`, so its lit side is identical, and adds the
 * ambient purely as a floor under the night side. `flood` keeps its old nine-to-one
 * ambient dominance, scaled by the same factor so the three modes sit at a comparable
 * exposure.
 */
export const LIGHTING: Record<LightingMode, { sun: number; ambient: number }> = {
  flood: { sun: 0.39, ambient: 3.55 },
  shadow: { sun: 5.0, ambient: 0.08 },
  natural: { sun: 5.0, ambient: 0 },
};

/** The only mode that is physically true, and therefore the one to open with. */
export const PHYSICAL_LIGHTING: LightingMode = 'natural';

/** Darkest step an 8-bit display can show above black. */
export const DISPLAY_FLOOR = 2 / 255;

/**
 * three.js's ACES filmic curve (RRTAndODTFit), for a neutral grey.
 *
 * The 0.6 divisor is three.js's, not ours: it is the ACES mid-grey reference, and it
 * means the default exposure already multiplies by 1.67 before the curve.
 */
export function acesToneMap(linear: number, exposure = 1): number {
  const v = (linear * exposure) / 0.6;
  const fitted = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  return Math.min(1, Math.max(0, fitted));
}

/** Linear light to an sRGB display value, 0 to 1. */
export function linearToSrgb(linear: number): number {
  return linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
}

/**
 * What the screen shows at a point on a body, given the angle from the sub-solar point.
 *
 * Lambert diffuse over pi, which is what MeshStandardMaterial does at roughness 1 and
 * metalness 0, plus the ambient term, then tone mapping and encoding.
 */
export function renderedBrightness(
  angleFromSubSolarDeg: number,
  linearAlbedo: number,
  mode: LightingMode,
  exposure = 1,
): number {
  const { sun, ambient } = LIGHTING[mode];
  const cosine = Math.cos((angleFromSubSolarDeg * Math.PI) / 180);
  const incident = sun * Math.max(0, cosine) + ambient;
  return linearToSrgb(acesToneMap((linearAlbedo / Math.PI) * incident, exposure));
}

/**
 * Where the terminator appears to be, in degrees from the sub-solar point.
 *
 * The geometric answer is always 90. This returns the angle at which the render
 * actually reaches the display floor, or `null` when it never does -- which is a real
 * outcome, not an error: a mode with enough ambient fill has no visible terminator at
 * all, only a gradient.
 */
export function visibleTerminatorDeg(
  linearAlbedo: number,
  mode: LightingMode,
  exposure = 1,
): number | null {
  if (renderedBrightness(180, linearAlbedo, mode, exposure) > DISPLAY_FLOOR) {
    return null;
  }

  let lit = 0;
  let dark = 180;
  for (let i = 0; i < 60; i += 1) {
    const middle = (lit + dark) / 2;
    if (renderedBrightness(middle, linearAlbedo, mode, exposure) > DISPLAY_FLOOR) {
      lit = middle;
    } else {
      dark = middle;
    }
  }
  return lit;
}

/**
 * Mean linear albedo of each body's surface map.
 *
 * Measured from the shipped images, sRGB mean luminance converted to linear. They span
 * a factor of four, Earth darkest and Venus brightest, which is why the terminator has
 * to be checked across the range rather than on one body.
 */
export const MAP_ALBEDO: Readonly<Record<string, number>> = {
  earth: 0.126,
  pluto: 0.088,
  mars: 0.19,
  neptune: 0.085,
  mercury: 0.211,
  jupiter: 0.36,
  saturn: 0.54,
  uranus: 0.51,
  venus: 0.54,
  sun: 0.34,
};
