import * as THREE from 'three';

import { extinctionUniforms, patchSunlightExtinction } from './atmosphere.ts';
import { J2000_JD } from '../core/time.ts';

/**
 * The three things Earth has that no other body here has data for.
 *
 * City lights on the unlit half, a cloud deck on its own sphere, and oceans that
 * reflect the Sun. Each is a separate published product rather than a style, and each
 * is anchored to a number that can be checked:
 *
 *  - **Where the lights switch on** is the end of astronomical twilight, 18 degrees of
 *    solar depression. That is a definition, not a taste setting, and it is why the
 *    lights appear in a band behind the terminator rather than at it.
 *  - **How rough the ocean is** comes from Cox and Munk's sun-glitter measurements,
 *    which give the sea surface's mean square slope as a function of wind speed. That
 *    is exactly what a microfacet roughness is, so the conversion is an identity
 *    rather than a fit.
 *  - **How high the clouds sit** is a global mean cloud-top height, which is what puts
 *    them fractionally outside the terminator: a cloud catches the Sun after the ground
 *    beneath it is already in shadow, which is what a sunset looks like from orbit.
 *
 * This is deliberately *not* in the catalog. Every field there exists for ten bodies;
 * these exist for one, and adding three nullable fields to `BodyDefinition` so that
 * nine of them can say null is a worse trade than a module named after the body it is
 * about. When the Moon and Titan arrive they will want their own special cases too --
 * Titan's haze is not a cloud map -- and this is the shape that admits that.
 */

/** VIIRS Day/Night Band composite, background removed. Panchromatic, so it is grey. */
export const EARTH_NIGHT_MAP = 'earth-night.jpg';

/** MODIS cloud composite, used as an opacity map on its own sphere. */
export const EARTH_CLOUD_MAP = 'earth-clouds.jpg';

/**
 * Land/water mask: white is water, and the values between are real.
 *
 * It started binary, and that showed: a 2048-wide grid is 20 km to the texel, so a hard
 * step at the coast drew the coastline as the staircase the *grid* makes rather than the
 * one the sea makes, and the roughness jump put a visible blocky edge on the water
 * wherever the Sun caught it.
 *
 * It is now a coverage fraction, and the fraction is recovered rather than invented: the
 * source's own antialiasing already blended its flat ocean colour with the land beside
 * it, so how far a coastal texel sits from that colour *is* how much of it is sea. See
 * CREDITS.md for the numbers -- it also moved the global water fraction from 68.6% to
 * 69.7% against the true 70.8%, so the softer mask is the more accurate one as well.
 */
export const EARTH_WATER_MASK = 'earth-water.png';

const DEG = Math.PI / 180;

/**
 * Solar elevation at which the night lights are fully on, degrees below the horizon.
 *
 * The end of astronomical twilight, which is the published definition of when the sky
 * stops being lit by the Sun at all. Using it means the lights fade in across a band
 * whose width is set by a real number rather than by whatever looked right: at Earth's
 * size the band is 18 degrees of arc, about 2000 km, and it trails the terminator the
 * way dusk does.
 *
 * The naive alternative -- lights wherever `dot(normal, sun) < 0` -- puts a hard edge
 * exactly on the terminator, which is both a visible seam and wrong: cities are not
 * lit at sunset.
 */
export const ASTRONOMICAL_TWILIGHT_DEG = -18;

/** Cosine of the solar zenith angle at that elevation. sin(-18 degrees). */
export const TWILIGHT_COS = Math.sin(ASTRONOMICAL_TWILIGHT_DEG * DEG);

/**
 * Chromaticity of high-pressure sodium, linear sRGB, peak channel normalised to 1.
 *
 * A 2000 K blackbody through Planck's law and the CIE 1931 observer -- computed rather
 * than picked off a swatch, and the test reproduces the integral. That is where sodium
 * street lighting sits, and sodium is the single largest share of what was on the ground
 * in 2012 when this composite was made.
 *
 * On its own it is also **far too orange to be right**, which is what shipping it showed:
 * rendered at full saturation every city goes red. See NIGHT_LIGHT_COLOR.
 */
export const NIGHT_LIGHT_SODIUM: readonly [number, number, number] = [1, 0.2663, 0.0077];

/** The colour temperature that chromaticity comes from. High-pressure sodium. */
export const NIGHT_LIGHT_TEMPERATURE_K = 2000;

/**
 * How much of the light is treated as white rather than as sodium.
 *
 * **The correction to a first version that was too literal.** Taking the sodium
 * chromaticity as the whole answer assumes every lamp on Earth is high-pressure sodium,
 * and in 2012 that was nowhere near true: mercury vapour lit much of Asia, fluorescent
 * and metal halide most large interiors, ports and stadiums, and LEDs had started. All
 * of those are far whiter than sodium, and a city is a mixture of them seen as one
 * pixel.
 *
 * Half is an assumption and is labelled as one. What it is not is a colour knob: the two
 * ends of the mix are both physical -- the sodium chromaticity above, and neutral white,
 * which in linear sRGB is (1, 1, 1) by construction -- and this says how much of each.
 */
export const NIGHT_LIGHT_WHITE_FRACTION = 0.5;

/**
 * Colour the city lights are actually drawn with, linear sRGB.
 *
 * The sodium chromaticity taken half way to white, which lands at a warm amber rather
 * than the red the pure sodium value produced.
 *
 * It is a number with a shelf life either way. Cities are converting to 3000-4000 K
 * LEDs, so the mix keeps moving toward the white end, and a composite made in 2035
 * tinted like this would be wrong in a way a 2012 one is not.
 */
export const NIGHT_LIGHT_COLOR: readonly [number, number, number] = NIGHT_LIGHT_SODIUM.map(
  (channel) => channel + (1 - channel) * NIGHT_LIGHT_WHITE_FRACTION,
) as unknown as readonly [number, number, number];

/**
 * How much of the surface map's colour is kept, 1 being the file as published.
 *
 * The shipped Earth map is an illustrative composite -- NASA imagery with colour and
 * contrast added by its authors -- and it reads more vividly than Earth does.
 *
 * Applied in the shader rather than to the file. That keeps the published image on disk
 * exactly as published, which is what makes the credit line and the alignment test mean
 * anything, and keeps the amount a number somebody can check instead of pixels nobody
 * can.
 *
 * Earth only. The other maps have the same bias and no reference to correct them
 * against, and guessing per body would be worse than leaving them alone.
 *
 * ## Three values, and only the last one was set against the right picture
 *
 * It began at 0.8, went to 0.65, and settled here. The middle step is the instructive
 * one, because it was arrived at by measurement and was still wrong.
 *
 * Measured against NASA Eyes, their open sea sits at 0.368 mean HSV saturation against
 * ours at 0.454, and that ratio said 0.65. The same measurement said why not to use it,
 * if anyone had read it rather than acted on it: classifying their disc by colour turns
 * up **no land pixels at all**, not one where green beats blue, because their whole globe
 * is hazed by an atmosphere. So the ratio was charging the map for something the map was
 * not responsible for, and it would have kept going -- each new screenshot asking for a
 * little more -- because the missing thing was never saturation. It was `atmosphere.ts`.
 *
 * **0.7 is a judgement rather than a measurement, and it is worth being clear which.**
 * With the sky in place, Maxi set it by eye against the reference. That is a fair way to
 * choose it and the earlier ratio was not, for one reason: this comparison is between two
 * pictures that contain the same physics, so what is left to judge really is how vivid
 * the map is. The number happens to land near where the contaminated measurement pointed;
 * it does not inherit its authority from it.
 */
export const SURFACE_SATURATION = 0.7;

/**
 * How bright the lights are rendered, as linear emissive radiance at the brightest
 * texel.
 *
 * **Calibrated, not physical, and the gap is enormous.** A city seen from orbit is
 * something like five orders of magnitude fainter than the same ground at noon. Scaled
 * honestly against the daylit side, every city would tone-map to black and the feature
 * would not exist. So this is the same kind of constant as the ring brightness: the
 * geometry, the timing and the map are real, and the level is chosen.
 *
 * Chosen through the renderer's own response rather than by eye, using the model in
 * `shading.ts`: at 0.6 the brightest cores land near 0.81 on screen, a lit suburb at
 * half the map's value lands near 0.40, and the daylit side is unaffected because the
 * twilight gate has already closed. The test pins those.
 */
export const NIGHT_LIGHT_INTENSITY = 0.6;

/**
 * Mean square slope of the sea surface, from Cox and Munk (1954).
 *
 * They photographed the Sun's glitter pattern on the sea from an aircraft and inverted
 * its width into a slope distribution, which is the measurement this whole feature
 * rests on: sigma^2 = 0.003 + 0.00512 * W for wind speed W in m/s, for the two slope
 * components together.
 *
 * That is the same quantity a microfacet roughness parametrises, which is why this
 * lands in the shader as an identity instead of a fit -- see OCEAN_ROUGHNESS.
 */
export function coxMunkSlopeVariance(windSpeedMetersPerSecond: number): number {
  return 0.003 + 0.00512 * windSpeedMetersPerSecond;
}

/**
 * Wind speed the ocean roughness is evaluated at, m/s.
 *
 * Global mean ocean surface wind, which is near 7 m/s in the scatterometer
 * climatologies. A single number for the whole ocean is a real simplification -- the
 * Southern Ocean runs at twice the doldrums -- but the answer is insensitive to it:
 * 5 m/s and 9 m/s give roughness 0.40 and 0.47, a difference nobody could see.
 */
export const OCEAN_WIND_SPEED_M_PER_S = 7;

/**
 * Microfacet roughness of water, for three.js's GGX.
 *
 * The conversion is the reason to use Cox and Munk at all. For a microfacet surface
 * the slope distribution has total variance alpha^2, so alpha = sigma, and three.js
 * (like Disney and glTF) stores perceptual roughness with alpha = roughness^2. So
 *
 *   roughness = sqrt(alpha) = sigma^(1/2) = (mean square slope)^(1/4)
 *
 * and at 7 m/s that is 0.444. Not a dial: turning it is claiming a different sea
 * state.
 *
 * Land keeps roughness 1, which is right for the usual reason -- a diffuse surface has
 * no preferred reflection direction -- and means the mask does not have to be careful
 * about coastlines to look right.
 */
export const OCEAN_ROUGHNESS = coxMunkSlopeVariance(OCEAN_WIND_SPEED_M_PER_S) ** 0.25;

/**
 * Refractive index of sea water in the visible.
 *
 * Sets how much light the ocean reflects at normal incidence: ((n-1)/(n+1))^2 = 0.020,
 * against the 0.04 three.js assumes for a generic dielectric. Left at the default the
 * glint would be twice as bright as the sea can make it.
 *
 * This is the one reason Earth gets a `MeshPhysicalMaterial` where every other body
 * gets a `MeshStandardMaterial`: `ior` only exists on the physical one. It costs a
 * second shader program and a few more uniforms, for one body.
 */
export const WATER_IOR = 1.333;

/**
 * Height of the cloud sphere above the surface, km.
 *
 * Global mean cloud-top height, which is around 5 km in the MODIS and ISCCP
 * climatologies. One number standing in for a distribution that runs from 1 km of
 * stratocumulus to 15 km of tropical anvil, and it is the right kind of
 * simplification: the deck is drawn from a flat composite that has no height
 * information in it at all, so there is nothing better to use.
 *
 * It is 0.08% of Earth's radius, which is under a pixel almost always. It is not
 * decoration: it is what lets the cloud tops stay lit after the ground has gone into
 * shadow, so the terminator gets a bright fringe instead of a hard edge, and it is
 * what makes the limb read as an atmosphere.
 */
export const CLOUD_TOP_ALTITUDE_KM = 5;

/**
 * How finely the cloud sphere is tessellated.
 *
 * **Four times the planet's own, and it is not about smoothness -- it is what stopped
 * the deck being shredded into vertical strips.**
 *
 * A tessellated sphere's triangles are chords, so they sag inside the sphere they
 * approximate: at 64 segments the sag is R(1 - cos(pi/64)), which on Earth is 7.7 km.
 * That is larger than the 5 km the deck floats at. While both spheres shared a vertex
 * grid it did not matter, because the cloud triangle sat 5 km outside the surface
 * triangle everywhere. The drift rotation broke that: it turns the deck's grid off the
 * planet's, so the middle of a cloud facet now sits against a *different* part of the
 * surface facet -- and 7.7 km of sag beats 5 km of altitude, so it sank inside the
 * planet and was depth-rejected. One dark stripe down the middle of every facet, 64 of
 * them, which is exactly what showed up on screen.
 *
 * At 256 the sag is 0.48 km, so the deck's lowest point stands 4.5 km clear of the
 * planet's highest vertex at any drift angle. It costs 65k triangles on one body.
 *
 * The alternative -- raising the altitude until it beat the sag -- would have meant
 * putting the clouds 10 km up to work around a rendering artifact, which is exactly the
 * kind of quiet lie this project is trying not to tell.
 */
export const CLOUD_SEGMENTS = 256;

/**
 * Converts the cloud composite's value into an opacity, as an optical depth.
 *
 * The map is a measure of how much cloud is in the column, not of how much light gets
 * through it, and using it directly as alpha was reading it as the wrong quantity: the
 * deck came out thin and gauzy where the reference shows solid white weather systems.
 *
 * A slab of optical depth tau passes exp(-tau), so the opacity is 1 - exp(-k * v). Same
 * conversion `ringMaterial.ts` uses on the ring strip, for the same reason -- depths add
 * where opacities do not -- and the shape is what matters: thin cloud stays thin, thick
 * cloud saturates toward solid instead of topping out at whatever the encoder happened
 * to put in the file.
 *
 * `k` is calibrated against NASA's own render rather than derived, because the file does
 * not carry the units a derivation would need -- and it is calibrated against a number
 * read off it rather than by eye. Their close-up of Earth is **17.3% bright cloud** by
 * area of the disc, counting pixels above value 0.8 and under saturation 0.2; ours was
 * 6.6%. Matching that means asking what fraction of the map ends up past opacity 0.8,
 * area-weighted by cos(latitude), and choosing k so it lands on 17.3%. At 3.2 it is
 * 17.4%.
 *
 * **The tempting anchor is the wrong one.** Published global cloud cover is about 67%,
 * and setting k so that 67% of the map passes opacity 0.5 needs k = 10 -- which also
 * turns every faint texel into a veil, because cloud *cover* counts thin cirrus that you
 * can see the ground through. The quantity being matched here is how much of the globe
 * reads as solid cloud, which is the thing that was visibly too low.
 */
export const CLOUD_OPTICAL_DEPTH_GAIN = 3.2;

/** The opacity a cloud texel is drawn at. The twin of the line in the shader. */
export function cloudOpacity(mapValue: number): number {
  return 1 - Math.exp(-CLOUD_OPTICAL_DEPTH_GAIN * mapValue);
}

/**
 * Zonal wind the cloud deck drifts at, m/s. Negative is westward.
 *
 * **The honest reading of this is that a rigid deck cannot be right.** Real zonal winds
 * reverse with latitude -- easterly trades near the equator, westerlies in the
 * mid-latitudes -- and a single rotation applies one sign everywhere. There is no
 * value that makes this correct, only values that are wrong in different places.
 *
 * So it takes the equatorial trade winds, about 6 m/s westward, because that is where
 * the deck is widest on screen and where the eye reads motion. And the thing it is
 * drifting is a *fixed composite*: the pattern was assembled from MODIS passes over
 * weeks in 2001 and is not the weather on the simulated date under any circumstances.
 * The drift makes the deck move; it does not make it true.
 *
 * At 1x the effect is invisible -- 4.7 degrees a day is a quarter of a pixel a minute.
 * Wound forward a month it is a fifth of a turn, which is the point: at speed the
 * clouds visibly slide over the ground instead of being painted on it.
 */
export const CLOUD_ZONAL_WIND_M_PER_S = -6;

/** Seconds in a day, for the wind-to-rotation conversion. */
const SECONDS_PER_DAY = 86400;

/**
 * Cloud drift rate in degrees per day, given the radius the deck sits at, in km.
 *
 * Just the wind speed divided by the circumference. Kept as a function of the radius
 * rather than a constant so that the altitude above is actually used by something.
 */
export function cloudDriftDegPerDay(deckRadiusKm: number): number {
  const metersPerDay = CLOUD_ZONAL_WIND_M_PER_S * SECONDS_PER_DAY;
  return ((metersPerDay / (deckRadiusKm * 1000)) * 180) / Math.PI;
}

/**
 * How far the deck has drifted from its position at J2000, degrees.
 *
 * Signed the same way the body's own rotation is: positive is eastward, a right-hand
 * rotation about the pole, which is the sense `bodyOrientation` builds its basis in.
 */
export function cloudDriftDeg(jdTdb: number, deckRadiusKm: number): number {
  return cloudDriftDegPerDay(deckRadiusKm) * (jdTdb - J2000_JD);
}

/**
 * How much of the night lighting shows at a point, 0 in daylight to 1 in full night.
 *
 * The TypeScript twin of the GLSL below, so the gate can be tested against angles with
 * known answers -- nothing at the sub-solar point, nothing at the terminator, half way
 * up somewhere inside twilight -- rather than inspected on screen.
 *
 * The argument is the cosine of the solar zenith angle, which for a sphere is just the
 * dot product of the surface normal with the direction to the Sun.
 */
export function nightLightFactor(cosSolarZenith: number): number {
  const t = Math.min(1, Math.max(0, (cosSolarZenith - TWILIGHT_COS) / (0 - TWILIGHT_COS)));
  // The same Hermite curve GLSL's smoothstep uses, so the two cannot drift apart.
  return 1 - t * t * (3 - 2 * t);
}

/**
 * GLSL for both patches: the lights on the night side, and the roughness of the sea.
 *
 * Both maps loading is a normal state to be without -- they are fetched only once
 * Earth is worth looking at -- so each has a strength uniform that is zero until its
 * image arrives, and the feature fades in with it rather than appearing between one
 * frame and the next.
 *
 * `vEarthNormal` is the sphere's own parametric normal in the body frame, not the
 * shaded normal: it is the direction the UV grid is built on, so it is the one that
 * agrees with the map. It ignores the 0.34% polar flattening, which moves it by at
 * most 0.19 degrees -- three orders of magnitude below the 18-degree band it feeds.
 */
export const EARTH_EXTRAS_GLSL = /* glsl */ `
uniform sampler2D uNightMap;
uniform sampler2D uWaterMask;
uniform vec3 uSunLocal;
uniform vec3 uNightColor;
uniform float uNightIntensity;
uniform float uNightStrength;
uniform float uTwilightCos;
uniform float uOceanRoughness;
uniform float uWaterStrength;
uniform float uSurfaceSaturation;
varying vec2 vEarthUv;
varying vec3 vEarthNormal;

/** Rec. 709 luminance, which is the right grey to pull a linear colour toward. */
vec3 earthPalette(vec3 colour) {
  float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(grey), colour, uSurfaceSaturation);
}

/** 1 where the Sun is more than 18 degrees below the horizon, 0 where it is up. */
float earthNightFactor() {
  float cosSolarZenith = dot(normalize(vEarthNormal), uSunLocal);
  return 1.0 - smoothstep(uTwilightCos, 0.0, cosSolarZenith);
}

vec3 earthNightLights() {
  if (uNightStrength <= 0.0) {
    return vec3(0.0);
  }
  float lights = texture2D(uNightMap, vEarthUv).r;
  return uNightColor * (lights * uNightIntensity * uNightStrength * earthNightFactor());
}

/** Water is white in the mask, so it mixes toward the sea's roughness. */
float earthRoughness(float landRoughness) {
  if (uWaterStrength <= 0.0) {
    return landRoughness;
  }
  float water = texture2D(uWaterMask, vEarthUv).r * uWaterStrength;
  return mix(landRoughness, uOceanRoughness, water);
}
`;

export interface EarthExtrasUniforms {
  readonly uNightMap: { value: THREE.Texture | null };
  readonly uWaterMask: { value: THREE.Texture | null };
  readonly uSunLocal: { value: THREE.Vector3 };
  readonly uNightColor: { value: THREE.Color };
  readonly uNightIntensity: { value: number };
  readonly uNightStrength: { value: number };
  readonly uTwilightCos: { value: number };
  readonly uOceanRoughness: { value: number };
  readonly uWaterStrength: { value: number };
  readonly uSurfaceSaturation: { value: number };
  /** The air the sunlight came down through. See atmosphere.ts. */
  readonly uBeta: { value: THREE.Vector3 };
  readonly uScaleHeight: { value: number };
}

/** Fresh uniforms for one Earth, with both maps absent and therefore switched off. */
export function earthExtrasUniforms(equatorialRadiusKm: number): EarthExtrasUniforms {
  return {
    ...extinctionUniforms(equatorialRadiusKm),
    uNightMap: { value: null },
    uWaterMask: { value: null },
    uSunLocal: { value: new THREE.Vector3(1, 0, 0) },
    uNightColor: {
      value: new THREE.Color(
        NIGHT_LIGHT_COLOR[0],
        NIGHT_LIGHT_COLOR[1],
        NIGHT_LIGHT_COLOR[2],
      ),
    },
    uNightIntensity: { value: NIGHT_LIGHT_INTENSITY },
    uNightStrength: { value: 0 },
    uTwilightCos: { value: TWILIGHT_COS },
    uOceanRoughness: { value: OCEAN_ROUGHNESS },
    uWaterStrength: { value: 0 },
    uSurfaceSaturation: { value: SURFACE_SATURATION },
  };
}

/**
 * The two lines of three.js's own shader this patch depends on, exported so a test
 * pins them.
 *
 * Same bargain as the ring shadow: reaching into the standard material by string match
 * is the pragmatic alternative to reimplementing the whole lighting model to add one
 * term, and the protection against a three.js upgrade moving the line is to fail
 * loudly here rather than quietly drop the feature.
 */
export const ROUGHNESS_HOOK = '#include <roughnessmap_fragment>';
export const EMISSIVE_HOOK = '#include <emissivemap_fragment>';
export const MAP_HOOK = '#include <map_fragment>';
/** The cloud deck's own, on a different material. */
export const ALPHA_MAP_HOOK = '#include <alphamap_fragment>';

/**
 * Teaches Earth's material about its own night side and its own oceans.
 *
 * The night lights go in as emission, which is what they are -- a city is not
 * reflecting anything -- so they ride the material's existing `totalEmissiveRadiance`
 * and are added after the lighting rather than inside it. That also means they survive
 * the distance fade correctly: emission is multiplied by the same alpha as everything
 * else.
 */
export function applyEarthExtras(
  material: THREE.MeshPhysicalMaterial,
  uniforms: EarthExtrasUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vEarthUv;
        varying vec3 vEarthNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Our own varyings rather than three.js's vUv and vNormal: vUv only exists
        // when a map is bound, and the surface map arrives lazily, so depending on it
        // would mean a shader that compiles or does not depending on the network.
        vEarthUv = uv;
        vEarthNormal = normal;`,
      );

    for (const hook of [MAP_HOOK, ROUGHNESS_HOOK, EMISSIVE_HOOK]) {
      if (!shader.fragmentShader.includes(hook)) {
        throw new Error(`three.js moved ${hook}; Earth's extras need a new injection point.`);
      }
    }

    // The sunlight reaching the ground has crossed an atmosphere on the way down, and
    // near the terminator it has crossed a great deal of it. Applied first, because it
    // changes the colour of the light everything below is computed against.
    patchSunlightExtinction(shader, '0.0');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${EARTH_EXTRAS_GLSL}`)
      .replace(
        MAP_HOOK,
        `${MAP_HOOK}
        // After the surface map has been sampled and before anything is lit, so the
        // whole chain -- terminator, glint, tone curve -- sees the corrected colour.
        diffuseColor.rgb = earthPalette(diffuseColor.rgb);`,
      )
      .replace(
        ROUGHNESS_HOOK,
        `${ROUGHNESS_HOOK}
        // After the chunk, not instead of it: it declares roughnessFactor and applies
        // any roughnessMap, and this narrows that to the sea.
        roughnessFactor = earthRoughness(roughnessFactor);`,
      )
      .replace(
        EMISSIVE_HOOK,
        `${EMISSIVE_HOOK}
        totalEmissiveRadiance += earthNightLights();`,
      );
  };

  // Materials are cached by compiled program; this forces the rebuild.
  material.needsUpdate = true;
}

/**
 * Teaches the cloud deck to read its map as an optical depth rather than as an alpha.
 *
 * A separate, much smaller patch than the surface's, on a separate material: the deck is
 * its own mesh with its own `MeshStandardMaterial`, and all it needs is the one line
 * three.js uses to apply an alpha map, replaced by the exponential. Everything else --
 * the UV plumbing, the `alphaMap` uniform, the lighting -- is stock.
 */
export function applyCloudDensity(
  material: THREE.MeshStandardMaterial,
  equatorialRadiusKm: number,
): void {
  const extinction = extinctionUniforms(equatorialRadiusKm);
  const deckAltitude = CLOUD_TOP_ALTITUDE_KM / equatorialRadiusKm;

  material.onBeforeCompile = (shader) => {
    if (!shader.fragmentShader.includes(ALPHA_MAP_HOOK)) {
      throw new Error(
        `three.js moved ${ALPHA_MAP_HOOK}; the cloud deck needs a new injection point.`,
      );
    }

    // Clouds redden at sunset too, and more visibly than the ground: they are white and
    // bright, so the colour of the light falling on them is the colour they turn. It is
    // the thing the reference render shows most plainly and ours did not have at all.
    Object.assign(shader.uniforms, extinction);
    patchSunlightExtinction(shader, deckAltitude.toFixed(8));

    shader.uniforms.uCloudOpticalDepthGain = { value: CLOUD_OPTICAL_DEPTH_GAIN };

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCloudOpticalDepthGain;')
      .replace(
        ALPHA_MAP_HOOK,
        /* glsl */ `
        #ifdef USE_ALPHAMAP
          // Replaces the chunk rather than following it: the stock line multiplies the
          // map straight into alpha, and reading a column depth as a transparency is
          // the error this exists to correct.
          diffuseColor.a *= 1.0 - exp(-uCloudOpticalDepthGain * texture2D(alphaMap, vAlphaMapUv).g);
        #endif`,
      );
  };

  material.needsUpdate = true;
}
