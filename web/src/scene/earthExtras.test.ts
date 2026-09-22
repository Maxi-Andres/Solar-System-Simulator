import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';

import { blackbodyChromaticity } from './blackbody.ts';
import {
  ALPHA_MAP_HOOK,
  applyCloudDensity,
  applyEarthExtras,
  ASTRONOMICAL_TWILIGHT_DEG,
  cloudDriftDeg,
  cloudDriftDegPerDay,
  cloudOpacity,
  CLOUD_OPTICAL_DEPTH_GAIN,
  CLOUD_SEGMENTS,
  CLOUD_TOP_ALTITUDE_KM,
  CLOUD_ZONAL_WIND_M_PER_S,
  coxMunkSlopeVariance,
  EARTH_EXTRAS_GLSL,
  earthExtrasUniforms,
  EMISSIVE_HOOK,
  MAP_HOOK,
  nightLightFactor,
  NIGHT_LIGHT_COLOR,
  NIGHT_LIGHT_INTENSITY,
  NIGHT_LIGHT_SODIUM,
  NIGHT_LIGHT_TEMPERATURE_K,
  NIGHT_LIGHT_WHITE_FRACTION,
  OCEAN_ROUGHNESS,
  OCEAN_WIND_SPEED_M_PER_S,
  ROUGHNESS_HOOK,
  SURFACE_SATURATION,
  TWILIGHT_COS,
  WATER_IOR,
} from './earthExtras.ts';
import { acesToneMap, DISPLAY_FLOOR, linearToSrgb } from './shading.ts';

/**
 * Earth's night lights, clouds and oceans.
 *
 * Three features that would each look plausible while being wrong, so each is tested
 * against the published number it came from rather than against itself: the end of
 * astronomical twilight, Cox and Munk's slope variance, the refractive index of water,
 * and a blackbody integral. The one constant with no external anchor -- how bright the
 * lights are drawn -- is tested through the renderer's own response model instead, the
 * same way the terminator was.
 */

const earth = getBody('earth');

describe('where the lights switch on', () => {
  it('shows nothing under the Sun and nothing at the terminator', () => {
    // A city at local noon is lit; it just cannot be seen. And sunset is not dark:
    // gating on dot(normal, sun) < 0 alone would put a hard seam exactly here.
    expect(nightLightFactor(1)).toBe(0);
    expect(nightLightFactor(0)).toBe(0);
  });

  it('is fully on once the Sun is 18 degrees down', () => {
    expect(TWILIGHT_COS).toBeCloseTo(Math.sin((ASTRONOMICAL_TWILIGHT_DEG * Math.PI) / 180), 12);
    expect(TWILIGHT_COS).toBeCloseTo(-0.309017, 6);
    expect(nightLightFactor(TWILIGHT_COS)).toBe(1);
    expect(nightLightFactor(-1)).toBe(1);
  });

  it('rises monotonically across the twilight band and nowhere else', () => {
    let previous = -1;
    for (let cos = 1; cos >= -1; cos -= 0.01) {
      const value = nightLightFactor(cos);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = value;
    }
  });

  it('is half lit in the middle of twilight', () => {
    expect(nightLightFactor(TWILIGHT_COS / 2)).toBeCloseTo(0.5, 6);
  });

  it('puts the band about 2000 km wide on Earth', () => {
    // 18 degrees of arc. Worth stating in kilometres because that is what makes it a
    // band rather than an edge: the lights come up over a fifth of a continent.
    const km = (ASTRONOMICAL_TWILIGHT_DEG * -1 * Math.PI * earth.radiusEquatorialKm) / 180;
    expect(km).toBeGreaterThan(1900);
    expect(km).toBeLessThan(2100);
  });
});

describe('how rough the sea is', () => {
  it('reproduces Cox and Munk', () => {
    // sigma^2 = 0.003 + 0.00512 W. The intercept is the slick-water case.
    expect(coxMunkSlopeVariance(0)).toBeCloseTo(0.003, 12);
    expect(coxMunkSlopeVariance(7)).toBeCloseTo(0.03884, 12);
  });

  it('converts slope variance to three.js roughness as an identity, not a fit', () => {
    // alpha^2 is the slope variance, and three.js stores alpha = roughness^2.
    const sigmaSquared = coxMunkSlopeVariance(OCEAN_WIND_SPEED_M_PER_S);
    const alpha = Math.sqrt(sigmaSquared);
    expect(OCEAN_ROUGHNESS ** 2).toBeCloseTo(alpha, 12);
    expect(OCEAN_ROUGHNESS).toBeCloseTo(0.4439, 4);
  });

  it('is insensitive to the wind speed it is evaluated at', () => {
    // A single global wind is a real simplification, and this is why it is a tolerable
    // one: doubling the wind moves the roughness by less than a fifth.
    const calm = coxMunkSlopeVariance(5) ** 0.25;
    const rough = coxMunkSlopeVariance(9) ** 0.25;
    expect(calm).toBeCloseTo(0.411, 3);
    expect(rough).toBeCloseTo(0.471, 3);
    expect(rough - calm).toBeLessThan(0.08);
  });

  it('leaves the sea far smoother than the land', () => {
    // Land keeps roughness 1, which is the whole reason the mask does not have to be
    // careful about coastlines: the two ends of the mix are a mirror and a diffuser.
    expect(OCEAN_ROUGHNESS).toBeLessThan(0.5);
  });

  it('reflects what water reflects, not what a generic dielectric does', () => {
    const reflectance = ((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2;
    expect(reflectance).toBeCloseTo(0.0204, 4);
    // three.js assumes 0.04 -- an IOR of 1.5, which is glass. Left alone the glint
    // would be twice as bright as the sea can make it.
    expect(reflectance).toBeLessThan(0.04 / 1.9);
  });
});

describe('the colour of the lights', () => {
  /**
   * The integral moved out.
   *
   * It lived here, because this is where three numbers had to be shown to be the right
   * three. Step 6f needed the same arithmetic for 25,000 stars, so it became
   * `blackbody.ts` -- and this test now checks the shipped constant against that module
   * rather than against a copy of it, which is the only version of this test that can
   * still fail for a real reason.
   */
  const blackbodyLinearSrgb = blackbodyChromaticity;

  it('starts from high-pressure sodium, computed rather than picked', () => {
    const [r, g, b] = blackbodyLinearSrgb(NIGHT_LIGHT_TEMPERATURE_K);
    expect(r).toBeCloseTo(NIGHT_LIGHT_SODIUM[0], 3);
    expect(g).toBeCloseTo(NIGHT_LIGHT_SODIUM[1], 3);
    expect(b).toBeCloseTo(NIGHT_LIGHT_SODIUM[2], 3);
  });

  it('would be noticeably different for the LEDs replacing them', () => {
    // Not a hypothetical: a composite made today would be wrong tinted like this, and
    // this is how wrong. 4000 K is more than twice as green as sodium.
    const led = blackbodyLinearSrgb(4000);
    expect(led[1]).toBeGreaterThan(2 * NIGHT_LIGHT_SODIUM[1]);
  });

  it('mixes it half way to white, because not every lamp on Earth is sodium', () => {
    // The fix for a first version that rendered every city red: pure sodium assumes the
    // whole world is lit by one technology. Both ends of the mix are physical -- the
    // integral above, and neutral white, which is (1, 1, 1) in linear sRGB by
    // construction -- so only the fraction is assumed.
    for (let channel = 0; channel < 3; channel += 1) {
      const sodium = NIGHT_LIGHT_SODIUM[channel]!;
      expect(NIGHT_LIGHT_COLOR[channel]).toBeCloseTo(
        sodium + (1 - sodium) * NIGHT_LIGHT_WHITE_FRACTION,
        12,
      );
    }
  });

  it('lands on a warm amber rather than a red', () => {
    // The symptom that started this: green at 0.27 of red reads as red on screen. What
    // makes a colour read as amber instead is green getting past about half.
    const [r, g, b] = NIGHT_LIGHT_COLOR;
    expect(r).toBe(1);
    expect(g).toBeGreaterThan(0.6);
    expect(b).toBeGreaterThan(0.45);
    // Still unmistakably warm, though: it is street lighting, not daylight.
    expect(b).toBeLessThan(g);
    expect(g).toBeLessThan(r);
  });
});

describe('how bright the lights are drawn', () => {
  /** The map value, through the emissive term, the tone curve and the sRGB encode. */
  const onScreen = (mapValue: number, nightFactor = 1) =>
    linearToSrgb(acesToneMap(mapValue * NIGHT_LIGHT_INTENSITY * nightFactor));

  it('puts the brightest cores high without clipping them', () => {
    expect(onScreen(1)).toBeGreaterThan(0.75);
    expect(onScreen(1)).toBeLessThan(0.9);
  });

  it('keeps a mid-level city clearly visible', () => {
    // Half the map's range is a suburb or a small city, and it has to read as light
    // rather than as noise.
    expect(onScreen(0.5)).toBeGreaterThan(0.3);
  });

  it('leaves the faintest lit texel above the display floor', () => {
    expect(onScreen(0.02)).toBeGreaterThan(DISPLAY_FLOOR);
  });

  it('adds exactly nothing in daylight', () => {
    // The gate, not the intensity, is what keeps the day side clean: at the sub-solar
    // point the factor is zero and the term vanishes whatever the map says.
    expect(onScreen(1, nightLightFactor(1))).toBe(0);
    expect(onScreen(1, nightLightFactor(0))).toBe(0);
  });
});

describe('the cloud deck', () => {
  const deckRadiusKm = earth.radiusEquatorialKm + CLOUD_TOP_ALTITUDE_KM;

  /**
   * How far a tessellated sphere's flat triangles sag inside the sphere they stand for.
   *
   * The number behind the defect that shipped. The deck was drawn at the planet's own 64
   * segments, which sags 7.7 km, and it floats only 5 km up. While the two grids lined up
   * that was harmless -- the cloud triangle sat 5 km outside the surface triangle
   * everywhere. The drift rotation turns one grid off the other, and then the middle of a
   * cloud facet meets a raised part of the surface, sinks inside the planet, and is depth
   * rejected: one dark vertical stripe per facet.
   */
  const sagKm = (radiusKm: number, segments: number) =>
    radiusKm * (1 - Math.cos(Math.PI / segments));

  it('stands clear of the planet at every drift angle', () => {
    // The real requirement, and it is not "the sag is small": the deck's lowest point has
    // to clear the planet's highest, because the grids are free to sit anywhere relative
    // to each other.
    const deckLowest = deckRadiusKm * Math.cos(Math.PI / CLOUD_SEGMENTS);
    expect(deckLowest).toBeGreaterThan(earth.radiusEquatorialKm);
    expect(deckLowest - earth.radiusEquatorialKm).toBeGreaterThan(4);
  });

  it('would sink into the planet at the tessellation the surface uses', () => {
    // The defect, pinned. 64 segments is what the surface sphere is drawn at and what the
    // deck was drawn at when it came out striped.
    expect(sagKm(deckRadiusKm, 64)).toBeGreaterThan(CLOUD_TOP_ALTITUDE_KM);
    expect(deckRadiusKm * Math.cos(Math.PI / 64)).toBeLessThan(earth.radiusEquatorialKm);
  });

  it('sits a fraction of a percent above the ground', () => {
    // Small enough to be sub-pixel almost always, and not decoration: it is what keeps
    // the cloud tops lit after the ground below them is in shadow.
    const fraction = CLOUD_TOP_ALTITUDE_KM / earth.radiusEquatorialKm;
    expect(fraction).toBeGreaterThan(0.0007);
    expect(fraction).toBeLessThan(0.0009);
  });

  it('drifts westward, because the trade winds do', () => {
    expect(CLOUD_ZONAL_WIND_M_PER_S).toBeLessThan(0);
    expect(cloudDriftDegPerDay(deckRadiusKm)).toBeLessThan(0);
  });

  it('turns the wind speed into a rotation rate and nothing else', () => {
    const metersPerDay = Math.abs(CLOUD_ZONAL_WIND_M_PER_S) * 86400;
    const expected = ((metersPerDay / (deckRadiusKm * 1000)) * 180) / Math.PI;
    expect(Math.abs(cloudDriftDegPerDay(deckRadiusKm))).toBeCloseTo(expected, 12);
    expect(Math.abs(cloudDriftDegPerDay(deckRadiusKm))).toBeCloseTo(4.653, 3);
  });

  it('is invisible at one times and obvious wound forward', () => {
    // Which is the point of having it at all: nobody watching in real time should see
    // the deck move, and nobody running a month per second should see it painted on.
    const perMinute = Math.abs(cloudDriftDeg(2451545 + 1 / 1440, deckRadiusKm));
    expect(perMinute).toBeLessThan(0.005);

    const perMonth = Math.abs(cloudDriftDeg(2451545 + 30, deckRadiusKm));
    expect(perMonth).toBeGreaterThan(120);
  });

  it('measures its drift from J2000, so it is zero there', () => {
    expect(Math.abs(cloudDriftDeg(2451545.0, deckRadiusKm))).toBe(0);
  });

  it('reads its map as an optical depth, so thick cloud goes solid', () => {
    // Clear stays clear, and that end is exact rather than approximate.
    expect(cloudOpacity(0)).toBe(0);
    // The global mean texel, 0.30 in the file. Used raw it drew a haze.
    expect(cloudOpacity(0.3)).toBeGreaterThan(0.6);
    // A dense system reaches nearly solid without ever passing 1.
    expect(cloudOpacity(0.9)).toBeGreaterThan(0.9);
    expect(cloudOpacity(1)).toBeLessThan(1);
  });

  it('is calibrated on solid cloud, not on cloud cover', () => {
    // The gain that matches published global cloud cover -- 67% of the map past opacity
    // 0.5 -- is about 10, and it is the wrong target: cover counts thin cirrus you can
    // see the ground through, so at 10 even a faint texel becomes a veil. What was
    // actually too low was how much of the globe reads as solid cloud, so that is what
    // this matches, and it lands far below the cover-matching value.
    expect(CLOUD_OPTICAL_DEPTH_GAIN).toBeGreaterThan(2);
    expect(CLOUD_OPTICAL_DEPTH_GAIN).toBeLessThan(5);
    // A texel at a tenth of the map's range must stay thin, which is the thing k = 10
    // would destroy: it would put that texel at 63% opaque.
    expect(cloudOpacity(0.1)).toBeLessThan(0.4);
  });

  it('never makes cloud out of nothing', () => {
    // Monotone and bounded: the conversion can only redistribute what the map already
    // says is there, never move a feature or invent one.
    let previous = -1;
    for (let v = 0; v <= 1; v += 0.05) {
      const alpha = cloudOpacity(v);
      expect(alpha).toBeGreaterThan(previous);
      expect(alpha).toBeLessThanOrEqual(1);
      previous = alpha;
    }
    expect(CLOUD_OPTICAL_DEPTH_GAIN).toBeGreaterThan(1);
  });
});

describe('the surface colour correction', () => {
  it('was set against a render that has a sky in it', () => {
    // It was 0.65 for a while, from the ratio measured between the two discs -- their open
    // sea at 0.368 mean saturation against ours at 0.454. That number was real and the
    // conclusion drawn from it was not: the same measurement found no land pixels at all
    // in their frame, because their atmosphere hazes the globe. Chasing it here would have
    // gone on forever, a little more with every screenshot, because saturation was never
    // the missing thing. atmosphere.ts is.
    //
    // 0.7 is a judgement, chosen by eye once the sky existed -- which is the comparison
    // that can actually be about how vivid a map is, because both pictures now contain
    // the same physics.
    expect(SURFACE_SATURATION).toBe(0.7);
  });

  it('leaves the map recognisably Earth rather than washing it out', () => {
    expect(SURFACE_SATURATION).toBeGreaterThan(0.5);
    expect(SURFACE_SATURATION).toBeLessThan(1);
  });

  it('is applied in the shader, not baked into the file', () => {
    // Which is what keeps the credit line and the alignment test meaning something: the
    // image on disk stays the image that was published.
    expect(EARTH_EXTRAS_GLSL).toContain('earthPalette');
    expect(EARTH_EXTRAS_GLSL).toContain('uSurfaceSaturation');
  });

  it('pulls toward luminance rather than toward a fixed grey', () => {
    // Desaturating toward grey 0.5 would change how bright the surface is as well as how
    // colourful. Rec. 709 luminance is the grey that leaves brightness alone.
    expect(EARTH_EXTRAS_GLSL).toContain('0.2126, 0.7152, 0.0722');
  });
});

describe('the shader patch', () => {
  it('depends on two lines three.js still has', () => {
    // Pinned so a three.js upgrade that moves either one fails here rather than
    // silently dropping the feature that hangs off it.
    expect(THREE.ShaderChunk.roughnessmap_fragment).toBeDefined();
    expect(THREE.ShaderChunk.emissivemap_fragment).toBeDefined();
    expect(ROUGHNESS_HOOK).toBe('#include <roughnessmap_fragment>');
    expect(EMISSIVE_HOOK).toBe('#include <emissivemap_fragment>');
    expect(MAP_HOOK).toBe('#include <map_fragment>');
    expect(ALPHA_MAP_HOOK).toBe('#include <alphamap_fragment>');
  });

  it('replaces the alpha map line on the deck rather than following it', () => {
    const material = new THREE.MeshStandardMaterial();
    applyCloudDensity(material, earth.radiusEquatorialKm);

    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>',
      fragmentShader: `#include <common>\nvoid main() { ${ALPHA_MAP_HOOK} }`,
    };
    material.onBeforeCompile!(shader as never, null as never);

    expect(shader.fragmentShader).toContain('exp(-uCloudOpticalDepthGain');
    // The stock line multiplies the map straight into alpha, which is the error.
    expect(shader.fragmentShader).not.toContain(ALPHA_MAP_HOOK);
    expect(shader.uniforms.uCloudOpticalDepthGain).toEqual({
      value: CLOUD_OPTICAL_DEPTH_GAIN,
    });
  });

  it('injects all three terms and its uniforms', () => {
    const material = new THREE.MeshPhysicalMaterial();
    const uniforms = earthExtrasUniforms(earth.radiusEquatorialKm);
    applyEarthExtras(material, uniforms);

    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\nvoid main() { #include <begin_vertex> }',
      fragmentShader:
        `#include <common>\nvoid main() { ${MAP_HOOK} ${ROUGHNESS_HOOK} ${EMISSIVE_HOOK} }`,
    };
    material.onBeforeCompile!(shader as never, null as never);

    expect(shader.fragmentShader).toContain('diffuseColor.rgb = earthPalette(diffuseColor.rgb)');
    expect(shader.fragmentShader).toContain('roughnessFactor = earthRoughness(roughnessFactor)');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += earthNightLights()');
    // After the chunk, never instead of it: the chunk is what declares roughnessFactor.
    expect(shader.fragmentShader.indexOf(ROUGHNESS_HOOK)).toBeLessThan(
      shader.fragmentShader.indexOf('earthRoughness(roughnessFactor)'),
    );
    expect(shader.vertexShader).toContain('vEarthUv = uv');
    expect(shader.uniforms.uSunLocal).toBe(uniforms.uSunLocal);
    expect(shader.uniforms.uOceanRoughness).toBe(uniforms.uOceanRoughness);
  });

  it('fails loudly if three.js moves an injection point', () => {
    const material = new THREE.MeshPhysicalMaterial();
    applyEarthExtras(material, earthExtrasUniforms(earth.radiusEquatorialKm));

    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\nvoid main() {}',
    };
    expect(() => material.onBeforeCompile!(shader as never, null as never)).toThrow(
      /new injection point/,
    );
  });

  it('starts with both features off, because both maps load lazily', () => {
    const uniforms = earthExtrasUniforms(earth.radiusEquatorialKm);
    expect(uniforms.uNightStrength.value).toBe(0);
    expect(uniforms.uWaterStrength.value).toBe(0);
    expect(uniforms.uNightMap.value).toBeNull();
    expect(uniforms.uWaterMask.value).toBeNull();
    // And the shader checks, rather than sampling a null sampler.
    expect(EARTH_EXTRAS_GLSL).toContain('uNightStrength <= 0.0');
    expect(EARTH_EXTRAS_GLSL).toContain('uWaterStrength <= 0.0');
  });

  it('uses its own varyings rather than three.js\'s vUv', () => {
    // vUv only exists when a map is bound, and the surface map arrives over the
    // network. Depending on it would make the shader compile conditionally on timing.
    expect(EARTH_EXTRAS_GLSL).toContain('varying vec2 vEarthUv');
    expect(EARTH_EXTRAS_GLSL).not.toContain('vUv');
  });

  it('gates the lights on the twilight angle, in the shader as in the twin', () => {
    expect(EARTH_EXTRAS_GLSL).toContain('smoothstep(uTwilightCos, 0.0, cosSolarZenith)');
  });
});
