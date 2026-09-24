import { DISPLAY_FLOOR } from './shading.ts';
import { srgbToLinear } from './starRendering.ts';

/**
 * The glare around the Sun.
 *
 * **What was missing, in Maxi's words: "es una esfera perfecta, en la realidad cuando lo
 * miras tiene como brillo".** He is describing something real and specific. A textured
 * sphere lit to the right brightness is still not what looking at the Sun is like,
 * because most of what you see around the Sun is not coming from the Sun's direction at
 * all -- it is the Sun's light scattered sideways inside whatever is doing the looking.
 *
 * ## The profile is a measurement of the human eye
 *
 * Scattered light in the eye -- off the cornea, the lens, the retina itself -- spreads a
 * bright source into a veil across the visual field. That veil has been measured for a
 * century, and the standard description is the CIE disability-glare equation
 * (CIE 135/1-1999, from Vos and van den Berg):
 *
 *     L_veil / E_glare  =  10 / theta^3  +  5 / theta^2        theta in degrees
 *
 * Two terms, two published coefficients, valid from about a tenth of a degree out to
 * thirty. The cube term is scatter in the cornea and lens and dominates close in; the
 * square term is the wider scatter and carries the far field. They cross at two degrees.
 *
 * **This is the same physics as the star sizes in `starRendering.ts`, and it is the part
 * a Gaussian could not do.** A Gaussian point spread falls off so fast that even the
 * Sun -- fourteen orders of magnitude brighter than the faintest star drawn -- would
 * spread over four pixels. Real optics and real eyes have power-law wings instead, which
 * is why a bright star in a photograph has a halo and why the Sun has one here.
 *
 * ## What follows from physics, and what is chosen
 *
 * The veil scales with the *illuminance* the source delivers, so it follows the inverse
 * square law: fly from Earth to Mercury and the glare gets 6.7 times brighter on its own,
 * because the Sun is 6.7 times brighter there. Nothing is animated to make that happen.
 * Its colour is the Sun's own, from the same Planck-and-CIE path the stars use, because
 * scattered sunlight is still sunlight.
 *
 * What is chosen is `GLARE_AT_ONE_DEGREE`, the one constant: how bright the veil reads a
 * degree off the Sun, at Earth's distance. There is nothing to derive it from, because
 * the render has no absolute exposure to anchor to -- the same reason the ring brightness
 * and the city lights are stated rather than computed. It is named here and in the About
 * panel, and everything else about the glare follows from it.
 *
 * ## The disc is overexposed, and the veil is drawn outside it
 *
 * The veil is added outside the photosphere only, because the disc is already clipped --
 * see `SUN_OVEREXPOSURE`. An earlier version kept the map readable and said so; Maxi
 * looked at it beside the reference and released that constraint himself: *"que la luz
 * tape la textura, no pasa nada, tiene que ser medio encandecente"*. He is right, and it
 * is also the physical answer.
 */

/**
 * How far past full scale the Sun's disc is drawn.
 *
 * **The Sun is not a lit surface, and drawing its map as though it were is the one thing
 * about it that was never physical.** Its photosphere radiates sigma T^4 over pi, which
 * at 5,772 K is 2.0e7 watts per square metre per steradian. The sunlit Earth this scene's
 * exposure is set for returns albedo times the solar constant over pi, about 130. So the
 * disc is **154,000 times brighter than the brightest thing the exposure can hold**, and
 * a correct render of it is a flat white circle with nothing in it at all.
 *
 * 45 is therefore not an exaggeration but a heavy *under*-exposure -- three and a half
 * thousand times under -- chosen to keep the last of the photosphere's structure alive in
 * the blue channel, which is the only one with headroom left.
 *
 * **And it is measured.** Pushing this texture and its catalog tint through the
 * renderer's own response at 45 gives a disc averaging **255, 249, 60**. Reading NASA's
 * render of the Sun pixel by pixel gives **255, 249, 59**. One code value per channel,
 * from a factor that was picked to clip red everywhere rather than to match a colour.
 *
 * Red clips across 100% of the map at this exposure, green averages 249, and what is left
 * of the granulation is in the blue.
 */
export const SUN_OVEREXPOSURE = 45;

/** The photosphere's radiance, W/m^2/sr: sigma T^4 over pi at 5,772 K. */
export const PHOTOSPHERE_RADIANCE = (5.670374419e-8 * 5772 ** 4) / Math.PI;

/** What the exposure is actually set for: sunlit Earth at 1 AU, albedo 0.3. */
export const SUNLIT_EARTH_RADIANCE = (0.3 * 1361) / Math.PI;

/**
 * The Sun's Johnson colour index, B-V = 0.65.
 *
 * Its own measured colour, and the reason `blackbody.ts` returns 5,778 K for it against
 * a measured effective temperature of 5,772. Lives here rather than in the catalog
 * because the glare is the only thing that asks for it.
 */
export const SUN_COLOR_INDEX = 0.65;

/** Coefficients of the CIE disability-glare equation. Not ours. */
export const GLARE_CUBE_COEFFICIENT = 10;
export const GLARE_SQUARE_COEFFICIENT = 5;

/**
 * Inner limit of the published fit, in degrees.
 *
 * Inside a tenth of a degree the equation runs away -- it describes a point source, and
 * the Sun is a disc a third of a degree wide -- so it is never evaluated closer than
 * this. In practice the disc itself masks everything inside its own limb anyway.
 */
export const GLARE_MIN_DEG = 0.1;

/**
 * Veiling luminance per unit illuminance, at an angle from the source.
 *
 * The CIE equation as published. Its value at one degree is 15, which is the number worth
 * remembering: one degree off the Sun, the veil is fifteen times the illuminance the Sun
 * delivers, in candela per square metre per lux.
 */
export function glareSpread(angleDeg: number): number {
  const theta = Math.max(GLARE_MIN_DEG, angleDeg);
  return (
    GLARE_CUBE_COEFFICIENT / (theta * theta * theta) + GLARE_SQUARE_COEFFICIENT / (theta * theta)
  );
}

/** One astronomical unit in kilometres. Exact by the IAU's definition, not measured. */
export const AU_KM = 149_597_870.7;

/** The Sun's angular radius from one astronomical unit, degrees. 695,700 km over 1 AU. */
export const SUN_ANGULAR_RADIUS_AT_1AU_DEG = (Math.atan(695_700 / AU_KM) * 180) / Math.PI;

/**
 * Mean luminance of the Sun's map once the catalog tint is on it, before exposure.
 *
 * Measured off `sun.jpg` and `#ffd24a` rather than asserted; the test re-derives it from
 * the file. It exists so the glare can be tied to the disc instead of floating free.
 */
export const SUN_MAP_LUMINANCE = 0.326;

/**
 * The luminance the Sun's disc is actually drawn at, in the renderer's linear units.
 *
 * **This is what the glare is scaled by, and tying the two together is the whole point.**
 * An earlier version anchored the veil independently -- a chosen display value one degree
 * off the Sun -- and it worked until the disc was overexposed by 45. Then the glare did
 * not follow: it stayed where it was while the thing casting it got forty-five times
 * brighter, so the halo went from plausible to invisible beside its own source. Maxi saw
 * it immediately: *"hay como un borde negro el cual no brilla"*.
 *
 * With the veil derived from the disc there is no constant left to get out of step. Change
 * the exposure and the glare follows, because that is what glare does.
 */
export const SUN_DRAWN_LUMINANCE = SUN_MAP_LUMINANCE * SUN_OVEREXPOSURE;

/**
 * Brightness scale of the veil: the illuminance the disc delivers to the camera.
 *
 * A disc of radiance L subtending an angular radius theta_R delivers
 * `E = L * pi * sin^2(theta_R)` -- the projected solid angle, which is the same thing the
 * inverse square law is, written without assuming the source is a point. Multiply by
 * `glareSpread` for linear light.
 *
 * Written this way rather than as `1/d^2` because it stays right when you are close
 * enough that the Sun is not a point any more, which is exactly where the old version
 * was worst.
 */
export function glareLevel(radiusKm: number, distanceKm: number): number {
  const sinRadius = Math.min(1, radiusKm / Math.max(1, distanceKm));
  return SUN_DRAWN_LUMINANCE * Math.PI * sinRadius * sinRadius;
}

/** Linear light of the veil at an angle. What the shader computes. */
export function glareLinear(angleDeg: number, radiusKm: number, distanceKm: number): number {
  return Math.min(1, glareLevel(radiusKm, distanceKm) * glareSpread(angleDeg));
}

/**
 * Largest half-angle the billboard is allowed to cover, degrees.
 *
 * A quad at the source's own distance can only ever span less than 90 degrees, and its
 * width is the tangent of that angle -- which runs away at 90 and comes back *negative*
 * past it. Fly close enough to the Sun and the unclamped solve asks for 133 degrees, so
 * the quad would be built inside out.
 *
 * 70 degrees is past the corner of the frame at any field of view this camera uses, so
 * the cut is never on screen: at 27 degrees vertical the quad's edge sits 4,500 pixels
 * out from the middle of a 790-pixel frame.
 */
export const GLARE_MAX_DEG = 70;

/**
 * How far the veil reaches before it drops below the darkest step a display can show.
 *
 * Solved rather than guessed, so the quad carrying the glare is exactly as large as it
 * needs to be: a bigger one costs fill rate on fragments that round to black, a smaller
 * one cuts the halo off with a visible straight edge.
 */
export function glareRadiusDeg(radiusKm: number, distanceKm: number): number {
  const floorLinear = srgbToLinear(DISPLAY_FLOOR);
  const level = glareLevel(radiusKm, distanceKm);
  if (level * glareSpread(GLARE_MIN_DEG) <= floorLinear) {
    return 0;
  }

  let inside = GLARE_MIN_DEG;
  let outside = GLARE_MAX_DEG;
  if (level * glareSpread(GLARE_MAX_DEG) > floorLinear) {
    return GLARE_MAX_DEG;
  }
  for (let step = 0; step < 60; step += 1) {
    const middle = (inside + outside) / 2;
    if (level * glareSpread(middle) > floorLinear) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return inside;
}

/**
 * The quad's half-width in world units, at the Sun's own distance.
 *
 * A billboard at the source's distance, so the angle a fragment sits at is its offset
 * over that distance -- which is what keeps the shader to four lines instead of a
 * projection.
 */
export function glareWorldRadius(distanceUnits: number, radiusDeg: number): number {
  return distanceUnits * Math.tan((radiusDeg * Math.PI) / 180);
}

/** The Sun's angular radius at a distance, degrees. The inner edge of the veil. */
export function sunAngularRadiusDeg(radiusKm: number, distanceKm: number): number {
  return (Math.atan(radiusKm / Math.max(1, distanceKm)) * 180) / Math.PI;
}

/** A plain billboard; the scene has already turned the quad to face the camera. */
export const SOLAR_GLARE_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The fragment shader.
 *
 * `uv` runs 0 to 1 across the quad, and the angle a fragment sits at is the **arctangent**
 * of its offset over the distance to the Sun -- not that offset scaled linearly.
 *
 * **That distinction shipped wrong once and is worth the comment.** The first version
 * took the angle as the fraction across the quad times its half-angle, which is right
 * only while everything is small. Close to the Sun the quad spans fifty degrees, where
 * the two differ by 40%, and the disc mask below then cut a hole out to 1.4 times the
 * Sun's radius: a black ring around the Sun with the halo starting outside it. It was
 * visible immediately and measurable afterwards -- the radial profile of the frame went
 * 0.129 at the limb, 0.009 ten pixels out, and did not peak until 1.3 radii.
 *
 * The inner cut is the photosphere: the veil reaches full strength at the limb and fades
 * inward over the last tenth of the disc, which is already clipped white there anyway. A
 * smoothstep rather than a branch, because every fragment near the disc would take both
 * sides of the branch anyway.
 */
export const SOLAR_GLARE_FRAGMENT_SHADER = /* glsl */ `
uniform float uLevel;
uniform float uTanRadius;
uniform float uSunRadiusDeg;
uniform vec3 uColor;

varying vec2 vUv;

float linearToSrgb(float value) {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * pow(value, 1.0 / 2.4) - 0.055;
}

void main() {
  vec2 offset = (vUv - 0.5) * 2.0;
  float radius = length(offset);
  if (radius > 1.0) {
    discard;
  }

  float angleDeg = max(${GLARE_MIN_DEG.toFixed(2)}, degrees(atan(radius * uTanRadius)));
  float veil = uLevel * (
    ${GLARE_CUBE_COEFFICIENT.toFixed(1)} / (angleDeg * angleDeg * angleDeg) +
    ${GLARE_SQUARE_COEFFICIENT.toFixed(1)} / (angleDeg * angleDeg)
  );

  // Full strength from the limb outward, fading inward across the last tenth of the
  // disc. It used to run the other way -- zero at the limb, full a tenth of a radius
  // past it -- which left a black band exactly where the halo should be brightest, and
  // the radial profile of the frame showed it: 69 at the limb, 29 ten pixels out, and
  // no halo until 1.07 radii.
  veil *= smoothstep(uSunRadiusDeg * 0.9, uSunRadiusDeg, angleDeg);

  vec3 linear = uColor * min(1.0, veil);
  gl_FragColor = vec4(
    linearToSrgb(linear.r),
    linearToSrgb(linear.g),
    linearToSrgb(linear.b),
    1.0
  );
}
`;
