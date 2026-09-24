import { DISPLAY_FLOOR, linearToSrgb } from './shading.ts';

/**
 * How a magnitude becomes pixels.
 *
 * Everything the sky is drawn from is a measurement: positions and proper motions from
 * Hipparcos, brightness from its V magnitudes, colour from its B-V. This file holds the
 * part that is **not** a measurement, which is how those numbers reach a screen, and it
 * keeps that part down to two constants so both can be argued with.
 *
 * ## Why there has to be a choice at all
 *
 * The scene spans about thirteen orders of magnitude, from the Sun at magnitude -26.7
 * to the faintest star drawn here at +7.5. A screen has about three. So there is no
 * such thing as rendering the sky "at true brightness": every image of space is
 * choosing which three of the thirteen to show. A long exposure takes the bottom three
 * and fills with stars; a photograph of a sunlit planet takes the top three and the sky
 * goes black. Both are the same sky.
 *
 * **The only dishonest version is the one that does not say which it picked.** So:
 *
 * ## 1. The exposure -- the limiting magnitude, and it is measured
 *
 * Which stars exist on screen is set by `magnitudeLimit` in the data, not here, and
 * that number was measured against NASA Eyes rather than chosen: counting discrete
 * stars in its own frame gives 781 in about 27 x 49 degrees, which over the whole sky
 * is around 25,000 stars, and Hipparcos holds 25,723 down to magnitude 7.5. The About
 * panel names it, because that number *is* the statement of what exposure the picture
 * is at.
 *
 * ## 2. The response -- linear in magnitude, which is linear in the eye
 *
 * A star's peak brightness on screen runs linearly from white at the brightest star in
 * the catalogue to `FAINTEST_PEAK` at the limit.
 *
 * Linear *in magnitude*, not in flux, and that is a claim worth defending. The
 * magnitude scale is not an arbitrary logarithm: it was built from the naked-eye
 * classes of antiquity and then fixed by Pogson at a hundredfold per five magnitudes
 * precisely because that is how the eye's response divides the sky into even steps. So
 * mapping magnitude linearly onto display brightness is modelling a person looking up.
 * Mapping *flux* linearly would model a photon counter, and a photon counter shown on a
 * screen is an almost empty sky with three white dots in it.
 *
 * What the compression costs is stated plainly: Sirius is 3,767 times the flux of a
 * star at the limit, and here it is fifty times the brightness.
 *
 * ## 3. The instrument -- one Gaussian
 *
 * No star is resolved by anything; every one of them is a point source, and what gives
 * a star a size in any image is the point spread of the instrument that recorded it.
 * So each star is drawn as a Gaussian, and its apparent size is not a separate setting:
 * it falls out of where that Gaussian drops below the darkest step the display can
 * show. Bright stars are bigger because their tails stay above that level further out,
 * which is the real reason bright stars look bigger in a photograph.
 *
 * ## What the first version got wrong, because it is instructive
 *
 * `PSF_SIGMA_PX` was first *solved* rather than chosen, from a figure this project had
 * been carrying since step 6d: the reference paints 0.9% of its pixels above a display
 * value of 0.05. Reproducing that fraction from this catalogue takes a sigma of 1.32
 * pixels, which shipped -- and side by side against the reference at the same view it
 * was plainly wrong. Every star came out a soft disc six to ten pixels across where the
 * reference draws points of one to five. Maxi's report was one line: *"en el de la NASA
 * como que tienen mas resolucion"*.
 *
 * **The solve was sound and the number it was solved from was not comparable.** That
 * 0.9% was measured on a different frame at a different zoom, and a coverage fraction is
 * exactly the kind of statistic that survives being wrong: a thousand small points and a
 * hundred fat discs can paint the same fraction of a frame. A direct comparison at the
 * same view beats it, so the sizes below come from that instead, and the coverage is now
 * reported rather than targeted.
 *
 * The thing worth keeping from it: the sky between the stars stays black, which was the
 * whole reason the photographic panorama came out. That number is still checked.
 */

/**
 * Display value of the faintest star drawn: 5 code values out of 255.
 *
 * **A chosen number, and the choice is what the words "limiting magnitude" already
 * mean.** A limiting magnitude is the brightness at which a star stops being visible, so
 * the star at that limit belongs at the threshold of visibility and not comfortably
 * above it -- here, two and a half times the darkest step a display can show.
 *
 * The first version put it at 0.12, which is fifteen times the floor, on the reasoning
 * that the faintest stars would otherwise vanish. They do not vanish; they become faint,
 * which is what they are. What 0.12 actually did was flatten the sky: with the response
 * linear in magnitude, a magnitude 7 star and a magnitude 2 star came out within a
 * factor of two of each other and at nearly the same size, so the whole field read as
 * one texture of identical dots instead of a sky with a few bright stars in it.
 *
 * At 0.02 the brightest-to-faintest range on screen is fifty to one, against 3,767 to
 * one in the sky. That ratio is the honest one-line summary of what this picture does.
 */
export const FAINTEST_PEAK = 0.02;

/**
 * Width of the point spread function, in CSS pixels.
 *
 * Sub-pixel, which is the point: a star is a point source and the instrument here is a
 * screen, not a lens with atmosphere in front of it.
 *
 * **Measured off the reference rather than matched by eye.** Both frames were taken at
 * the same view and read pixel by pixel: every blob above the display floor, its area,
 * and its peak. NASA Eyes draws stars with a median equivalent diameter of **2.26 px**
 * and a 90th percentile of 2.99. At 0.54 this catalogue renders 2.27 and 3.05.
 *
 * In CSS pixels rather than device pixels, so a star covers the same angle on a dense
 * display as on a coarse one instead of shrinking to a speck.
 */
export const PSF_SIGMA_PX = 0.54;

/**
 * Share of a star's light that goes into the wings of the point spread rather than the
 * core.
 *
 * **A Gaussian has no wings, and that was the last thing on the sky that was visibly
 * wrong.** Held against the reference, their brightest star spreads over **13.5 pixels**
 * and saturates; a Gaussian at this sigma tops out at 4.2 however bright the star is,
 * because exp(-r^2) falls off faster than any amount of flux can push out. It is the same
 * finding the Sun's glare closed -- see `solarGlare.ts` -- and the same physics: every
 * real optical system, and the eye itself, scatters a few percent of a source's light
 * into a power-law halo.
 *
 * The profile here is a core plus a Lorentzian tail, `1 / (1 + (r/sigma)^2)`, whose wings
 * fall as `r^-2` -- the far-field term of the CIE disability-glare equation the Sun uses.
 * Since it is a fixed *share* of each star's light, it scales with the star and needs no
 * per-star setting: what changes is how far out it stays above the display floor, and
 * that goes as the square root of brightness instead of its logarithm.
 *
 * **0.1 is solved from the reference, not chosen.** At that share the brightest star in
 * the catalogue draws **13.2 pixels** across against their measured 13.5, while the
 * median star stays at 2.46 and the 90th percentile at 3.17 -- both untouched, because a
 * faint star's wings never clear the floor at all. One constant, one measurement, and the
 * rest of the sky exactly as it was.
 */
export const STAR_WING_FRACTION = 0.1;

/**
 * The point spread, normalised so its centre is exactly 1.
 *
 * Normalised rather than left at `1 + STAR_WING_FRACTION`, so adding the wings does not
 * quietly brighten every star in the sky by ten percent and undo the response calibrated
 * against the reference's own peak distribution.
 */
export function starProfile(radiusPx: number, sigmaPx = PSF_SIGMA_PX): number {
  const x = radiusPx / sigmaPx;
  return (
    (Math.exp(-0.5 * x * x) + STAR_WING_FRACTION / (1 + x * x)) / (1 + STAR_WING_FRACTION)
  );
}

/**
 * Distance to the star sphere, in scene units (1e9 units = 1e12 km).
 *
 * Parked far enough that no body can be beyond it, and translated with the camera each
 * frame so it behaves as if infinitely distant. That is not a shortcut: the nearest
 * star in this catalogue has a parallax of 0.742 arcseconds, which at the scene's field
 * of view is under a hundredth of a pixel from one side of Earth's orbit to the other.
 * Real distances, and with them real parallax, belong to phase D.
 */
export const SPHERE_RADIUS = 1e9;

/** Milliarcseconds per year to radians per year, the units the shader wants. */
export const MAS_PER_YEAR_TO_RAD = (1 / 3_600_000) * (Math.PI / 180);

/**
 * The response as a line: peak display value = `intercept + slope * magnitude`.
 *
 * Returned as coefficients because that is what the vertex shader needs -- one vec2 and
 * a multiply-add per star, instead of branching per vertex.
 */
export function magnitudeToPeakCoefficients(
  brightestMagnitude: number,
  limitMagnitude: number,
  faintestPeak = FAINTEST_PEAK,
): readonly [number, number] {
  const span = limitMagnitude - brightestMagnitude;
  if (span <= 0) {
    throw new Error('The star catalogue has no magnitude range to map.');
  }
  const slope = (faintestPeak - 1) / span;
  return [1 - slope * brightestMagnitude, slope];
}

/** Peak display value for one star, clamped to what a display can actually show. */
export function peakDisplayValue(
  magnitude: number,
  coefficients: readonly [number, number],
): number {
  const [intercept, slope] = coefficients;
  return Math.min(1, Math.max(DISPLAY_FLOOR, intercept + slope * magnitude));
}

/** sRGB display value to linear light. The inverse of `linearToSrgb` in shading.ts. */
export function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * Radius, in CSS pixels, at which a star's profile falls to a given display value.
 *
 * Evaluated in **linear light**, because a point spread function spreads energy, not code
 * values. Solved rather than inverted: the core and the wings cross over somewhere in the
 * middle for a bright star, and neither closed form is right on both sides of that.
 * Returns 0 when the star never reaches the level at all.
 */
export function profileRadiusPx(
  peakDisplay: number,
  displayLevel: number,
  sigmaPx = PSF_SIGMA_PX,
): number {
  const peakLinear = srgbToLinear(peakDisplay);
  const levelLinear = srgbToLinear(displayLevel);
  if (peakLinear * starProfile(0, sigmaPx) <= levelLinear) {
    return 0;
  }

  let inside = 0;
  let outside = sigmaPx * 400;
  for (let step = 0; step < 60; step += 1) {
    const middle = (inside + outside) / 2;
    if (peakLinear * starProfile(middle, sigmaPx) > levelLinear) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return inside;
}

/**
 * Sprite size for a star, in CSS pixels.
 *
 * Sized to contain everything above the display floor and no more: a larger sprite
 * costs fill rate for fragments that round to black, a smaller one cuts the star off
 * with a visible square edge. One pixel minimum, since a point with no size draws
 * nothing at all.
 */
export function spriteDiameterPx(peakDisplay: number, sigmaPx = PSF_SIGMA_PX): number {
  return Math.max(1, 2 * profileRadiusPx(peakDisplay, DISPLAY_FLOOR, sigmaPx));
}

/** Display value at a distance from a star's centre, following the same profile. */
export function profileDisplayValue(
  radiusPx: number,
  peakDisplay: number,
  sigmaPx = PSF_SIGMA_PX,
): number {
  return linearToSrgb(srgbToLinear(peakDisplay) * starProfile(radiusPx, sigmaPx));
}

/**
 * Median distance from a star to its nearest neighbour, in pixels, for a uniform sky.
 *
 * **The observable behind "their stars are closer together".** For points scattered at
 * random with density lambda, the distance to the nearest one has the distribution
 * 1 - exp(-pi lambda r^2), so the median is sqrt(ln 2 / (pi lambda)) -- no simulation
 * needed, and no dependence on the field of view, which is what makes it the right thing
 * to hold two screenshots against when the two cameras cannot be shown to match.
 *
 * It is the catalogue's separation, not the render's. A rendered frame comes out a third
 * sparser, because a star whose profile lands between pixel centres does not clear the
 * display floor at all -- that factor is measured, not assumed, and pinned in the test.
 */
export function medianNearestNeighbourPx(starCount: number, pixelsPerDegree: number): number {
  const perPixel = starCount / (41_253 * pixelsPerDegree * pixelsPerDegree);
  return Math.sqrt(Math.LN2 / (Math.PI * perPixel));
}

/**
 * How much sparser a rendered frame is than the catalogue behind it.
 *
 * Measured rather than modelled: in a 910-pixel frame at 27 degrees, a magnitude 7.5
 * catalogue's median separation computes to 20.06 px and the render measured 26.8.
 * Sub-pixel sampling is the whole of it -- sigma is half a pixel, so whether a star
 * clears the display floor depends on how close its centre falls to a pixel's.
 */
export const RENDER_SPARSITY = 1.336;

/**
 * Fraction of the whole sky this catalogue paints above a given display value.
 *
 * The measurement the reference is held against. Each star contributes the disc inside
 * which its profile stays above the level, and the pixel scale comes from the field of
 * view, so the answer is comparable with a number counted off a screenshot.
 */
export function skyCoverageFraction(
  magnitudes: readonly number[],
  coefficients: readonly [number, number],
  displayLevel: number,
  pixelsPerDegree: number,
  sigmaPx = PSF_SIGMA_PX,
): number {
  const skyPixels = 41_253 * pixelsPerDegree * pixelsPerDegree;
  let painted = 0;
  for (const magnitude of magnitudes) {
    const radius = profileRadiusPx(peakDisplayValue(magnitude, coefficients), displayLevel, sigmaPx);
    painted += Math.PI * radius * radius;
  }
  return painted / skyPixels;
}

/**
 * The vertex shader.
 *
 * Two things happen per star, and both are astronomy rather than graphics:
 *
 * **Proper motion.** The catalogue is published at J2000 and the simulation runs at
 * whatever date the clock says, which this app lets you take to 1800 or 2200. Over two
 * centuries the fastest star in the set moves 0.39 degrees -- fifteen pixels, and
 * visibly out of its constellation. So the position is carried forward here, as a
 * rotation of the unit vector rather than as `ra += mu / cos(dec)`, which blows up near
 * the poles. `buildStarCatalog.ts` runs the same expression to move the catalogue from
 * its own epoch to J2000, so the two cannot drift apart.
 *
 * **The response**, from the header above. One multiply-add for the peak, then the
 * sprite size that peak implies.
 */
export const STAR_VERTEX_SHADER = /* glsl */ `
uniform float uSphereRadius;
uniform float uYearsSinceEpoch;
uniform vec3 uEquatorialPole;
uniform vec2 uMagnitudeToPeak;
uniform float uSigmaPx;
uniform float uDisplayFloor;
uniform float uPixelRatio;

attribute vec2 properMotion;
attribute float magnitude;
attribute vec3 starColor;

varying vec3 vColor;
varying float vPeakLinear;
varying float vSizePx;

float srgbToLinear(float value) {
  return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4);
}

void main() {
  vec3 direction = normalize(position);

  // East is the direction of increasing right ascension. The guard is for a star
  // sitting exactly on the celestial pole, where that cross product has no direction;
  // Polaris is three quarters of a degree away, so this is insurance rather than a
  // case that fires.
  vec3 sideways = cross(uEquatorialPole, direction);
  float sidewaysLength = length(sideways);
  vec3 east = sidewaysLength > 1e-6 ? sideways / sidewaysLength : vec3(1.0, 0.0, 0.0);
  vec3 north = cross(direction, east);

  direction = normalize(
    direction + (east * properMotion.x + north * properMotion.y) * uYearsSinceEpoch
  );

  gl_Position = projectionMatrix * modelViewMatrix * vec4(direction * uSphereRadius, 1.0);

  float peak = clamp(uMagnitudeToPeak.x + uMagnitudeToPeak.y * magnitude, uDisplayFloor, 1.0);
  vPeakLinear = srgbToLinear(peak);

  // How far the profile reaches, in units of the peak over the display floor. The two
  // terms are solved separately and the larger wins: for a faint star the core is the
  // whole of it, and for a bright one the wings are.
  //
  // max() before each square root: the clamp above guarantees these are non-negative in
  // exact arithmetic, and float rounding is enough to make one of them -1e-8, whose
  // square root is NaN -- one star at a time.
  float peakOverFloor =
    vPeakLinear / (${(1 + STAR_WING_FRACTION).toFixed(3)} * srgbToLinear(uDisplayFloor));
  float coreRadius = uSigmaPx * sqrt(2.0 * max(0.0, log(max(1.0, peakOverFloor))));
  // The wing term at half the floor rather than at it, so the sprite is a shade wider
  // than the visible halo and the two terms summing cannot leave a square edge on it.
  float wingRadius =
    uSigmaPx * sqrt(max(0.0, 2.0 * peakOverFloor * ${STAR_WING_FRACTION.toFixed(3)} - 1.0));
  vSizePx = max(2.0 * max(coreRadius, wingRadius), 1.0);
  gl_PointSize = vSizePx * uPixelRatio;

  vColor = starColor;
}
`;

/**
 * The fragment shader.
 *
 * The profile is evaluated in linear light and the colour multiplies it there, because
 * `starColor` arrives at unit luminance: a red star and a blue star of the same
 * magnitude come out equally bright, which is what a magnitude means.
 *
 * The encode happens here rather than through the renderer's tone mapping, and that is
 * deliberate. ACES maps *scene radiance* to a display, and it is the right curve for a
 * lit planet. A star field is not scene radiance -- it is an exposure choice over
 * thirteen orders of magnitude, already made above -- so running it through a second
 * curve would compress a decision that has already been taken and stated. The material
 * sets `toneMapped = false` to say so.
 */
export const STAR_FRAGMENT_SHADER = /* glsl */ `
uniform float uSigmaPx;

varying vec3 vColor;
varying float vPeakLinear;
varying float vSizePx;

float linearToSrgb(float value) {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * pow(value, 1.0 / 2.4) - 0.055;
}

void main() {
  float radiusPx = distance(gl_PointCoord, vec2(0.5)) * vSizePx;
  float x = radiusPx / uSigmaPx;
  // Core plus a Lorentzian tail, normalised so the centre is exactly 1. The tail is what
  // a Gaussian cannot do: it falls as r^-2, so a bright star keeps a halo where an
  // exponential has already reached zero. See STAR_WING_FRACTION.
  float profile =
    (exp(-0.5 * x * x) + ${STAR_WING_FRACTION.toFixed(3)} / (1.0 + x * x)) / ${(1 + STAR_WING_FRACTION).toFixed(3)};
  float luminance = vPeakLinear * profile;
  vec3 linear = vColor * luminance;
  gl_FragColor = vec4(
    linearToSrgb(linear.r),
    linearToSrgb(linear.g),
    linearToSrgb(linear.b),
    1.0
  );
}
`;
