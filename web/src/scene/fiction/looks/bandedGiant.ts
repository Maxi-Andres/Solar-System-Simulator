import * as THREE from 'three';

import { seedFraction } from './noise.ts';
import type { Haze, SurfaceLook } from './worldShader.ts';

/**
 * A banded gas giant (Polyphemus): belts and zones along the parallels, torn at their edges by
 * the shear between them, with a few long-lived storms.
 *
 * Made from what Jupiter and Saturn show rather than from any picture of the fictional one.
 * **The bands** are a profile of latitude -- seeded widths and strengths, a bright equatorial
 * zone -- read not at the true latitude but at one displaced by turbulence, so their edges
 * wave and curl. **The turbulence** is noise stretched along the parallels, as the zonal winds
 * stretch every eddy into a streak; the streaks are finest where neighbouring bands shear past
 * each other. **The storms** are ovals where the direction is turned about the storm's centre
 * by an angle that falls off from it, which winds the streaks around it into a vortex, as
 * Jupiter's Great Red Spot winds its neighbours. **Toward the poles** the bands give way to
 * mottled, darker cloud, as on both of the Solar System's giants.
 *
 * The colours come from the world's `tint`: zones paler and nearly white, belts deeper and a
 * little warmer, the bands differing among themselves as Jupiter's do. A giant without a tint
 * is drawn in the pale tan of ammonia cloud.
 *
 * **The light** is Minnaert's, not Lambert's: a cloud deck under haze darkens toward its limb
 * (k = 0.9, about Jupiter's in the visible), which is what makes a giant look round
 * rather than painted. A ring system, when there is one, shadows the bands (ringProfile.ts).
 *
 * Baked into one cube map (surfaceBake.ts); up close, a live octave of streaks goes on past
 * its texels.
 */

/** How many storms are drawn: one great oval and a few small ones. */
export const STORM_COUNT = 4;

export const BANDED_GIANT: SurfaceLook = {
  layers: 1,
  fallback: [0.3, 0.3, 0.3],
  uniforms: (world) => ({
    uStorms: { value: stormPlacements(world.seed) },
  }),
  bake: /* glsl */ `
    uniform vec4 uStorms[${STORM_COUNT}];

    // Bands from pole to pole: Jupiter shows about twenty from the ground.
    const float BAND_CELLS = 22.0;

    /** Turns \`p\` about unit \`axis\` by \`angle\` (Rodrigues). */
    vec3 turnAbout(vec3 p, vec3 axis, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
    }

    float bandHash(float n) {
      return float(lowbias32(uint(int(n) + 4096) ^ uSeedHash)) / 4294967295.0;
    }

    /** Which band a sine of latitude falls in, and how far across it: x the cell, y the fraction. */
    vec2 bandCell(float y) {
      float t = (asin(clamp(y, -1.0, 1.0)) / PI + 0.5) * BAND_CELLS;
      return vec2(floor(t), fract(t));
    }

    /** The bands' brightness at a sine of latitude: 0 a belt, 1 a zone. */
    float bandProfile(float y) {
      // A seeded staircase of bands pole to pole, each step's edge at a seeded place in its cell.
      vec2 cell = bandCell(y);
      // Levels kept off 0 and 1, so the turbulence has room to show inside every band.
      float a = 0.12 + 0.76 * bandHash(cell.x);
      float b = 0.12 + 0.76 * bandHash(cell.x + 1.0);
      float edge = 0.5 + 0.5 * (bandHash(cell.x + 100.0) - 0.5);
      float level = mix(a, b, smoothstep(edge - 0.12, edge + 0.12, cell.y));
      // Narrower bands within the broad ones, as Jupiter's belts split into filaments.
      float fine = (asin(clamp(y, -1.0, 1.0)) / PI + 0.5) * BAND_CELLS * 3.0;
      float within = mix(bandHash(floor(fine) + 300.0), bandHash(floor(fine) + 301.0), smoothstep(0.3, 0.7, fract(fine)));
      level += 0.22 * (within - 0.5);
      // A bright equatorial zone and two dark belts flanking it, as both the Solar System's
      // giants have.
      level = mix(level, 0.85, exp(-pow(y / 0.06, 2.0)));
      level = mix(level, 0.12, 0.7 * exp(-pow((abs(y) - 0.17) / 0.045, 2.0)));
      return level;
    }

    vec4 bakeLayer0(vec3 direction, float footprint) {
      // Storms wind the field around them: turn the direction about each one's centre.
      vec3 p = direction;
      float stormMask = 0.0;
      for (int i = 0; i < ${STORM_COUNT}; i++) {
        vec4 storm = uStorms[i];
        if (storm.w <= 0.0) continue;
        vec3 centre = storm.xyz;
        // Ovals, wider along the parallels than across them.
        vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), centre) + vec3(1e-5, 0.0, 0.0));
        vec3 offset = direction - centre;
        float along = dot(offset, east);
        float across = offset.y;
        float oval = length(vec2(along * 0.55, across)) / storm.w;
        // The great storm winds its surroundings far round; the small ones, only a little,
        // or the fine streaks inside them wind into a bull's-eye.
        float turns = storm.w > 0.06 ? 3.0 : 1.2;
        float swirl = turns * exp(-oval * oval * 1.5) * sign(centre.y + 1e-3);
        p = turnAbout(p, centre, swirl);
        stormMask = max(stormMask, 1.0 - smoothstep(0.55, 1.0, oval));
      }

      // Turbulence: noise stretched along the parallels.
      vec3 stretched = p * vec3(1.0, 5.0, 1.0);
      float streaks = fbm(stretched, 2.2, 7, 0.6, footprint);
      float latitudeWarp = 0.035 * streaks + 0.012 * fbm(p * vec3(1.0, 3.0, 1.0) + 9.0, 6.0, 3, 0.5, footprint);
      float y = p.y + latitudeWarp;
      float band = bandProfile(y);
      // Shear is strongest where the profile changes fastest: finer, stronger streaks there.
      float shear = clamp(abs(bandProfile(y + 0.01) - bandProfile(y - 0.01)) * 25.0, 0.0, 1.0);
      float fine = fbm((p + 0.04 * streaks) * vec3(1.0, 7.0, 1.0), 9.0, 6, 0.62, footprint);
      band = clamp(band + (0.14 + 0.3 * shear) * fine, 0.0, 1.0);

      // Toward the poles, mottled and darker.
      float polar = smoothstep(0.72, 0.9, abs(p.y));
      float mottle = fbm(p * 1.0 + 31.0, 5.0, 5, 0.55, footprint);
      band = mix(band, 0.35 + 0.3 * mottle, polar);

      // Colours from the tint: zones pale, belts deeper and warmer.
      vec3 hue = uTintWeight > 0.0 ? uTint / max(max(uTint.r, max(uTint.g, uTint.b)), 1e-4) : vec3(0.93, 0.82, 0.64);
      // Jupiter's zones reflect about half the light, its belts a quarter (MAP_ALBEDO 0.36 for
      // the whole disc).
      vec3 zone = mix(hue, vec3(1.0), 0.45) * 0.46;
      vec3 belt = hue * hue * vec3(1.0, 0.9, 0.8) * 0.2;
      // The bands differ among themselves in hue as well as brightness.
      float variety = bandHash(bandCell(y).x + 200.0);
      belt = mix(belt, belt * vec3(1.08, 0.95, 0.88), variety);
      vec3 colour = mix(belt, zone, band);
      colour *= mix(1.0, 0.8, polar);
      // Storm interiors a shade apart from their surroundings.
      colour = mix(colour, mix(colour, zone * vec3(1.05, 0.95, 0.9), 0.5), stormMask * 0.6);
      return vec4(encodeAlbedo(colour), 1.0);
    }
  `,
  glsl: /* glsl */ `
    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      Surface s;
      s.albedo = decodeAlbedo(layer0(direction).rgb);
      if (footprint < TEXEL) {
        // Up close, streaks finer than the map, stretched along the parallels as its own are.
        float closer = smoothstep(TEXEL, 0.5 * TEXEL, footprint);
        s.albedo *= 1.0 + 0.12 * closer * fbm(direction * vec3(1.0, 6.0, 1.0), 300.0, 2, 0.5, footprint);
      }
      s.minnaert = 0.9;
      s.normal = direction;
      s.specular = 0.0;
      s.roughness = 1.0;
      s.cloud = 0.0;
      s.cloudAlbedo = vec3(0.0);
      return s;
    }
  `,
};

/**
 * The storms of a giant: one great oval and a few small, at seeded latitudes and longitudes.
 * Centre as a unit direction and size in radii.
 */
export function stormPlacements(seed: number): THREE.Vector4[] {
  const storms: THREE.Vector4[] = [];
  for (let i = 0; i < STORM_COUNT; i += 1) {
    const latitude = (seedFraction(seed, 10 + i) - 0.5) * (i === 0 ? 0.7 : 1.3);
    const longitude = seedFraction(seed, 20 + i) * Math.PI * 2;
    const size = i === 0 ? 0.09 + 0.05 * seedFraction(seed, 30) : 0.025 + 0.025 * seedFraction(seed, 30 + i);
    storms.push(
      new THREE.Vector4(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
        size,
      ),
    );
  }
  return storms;
}

/**
 * A giant's haze: hydrogen's Rayleigh scattering over the cloud deck -- thin, the deck sits
 * under a column of a few tenths of an optical depth in blue -- and stratospheric haze, which
 * is what brightens Jupiter's limb in blue light and softens its edge. The scale height is
 * a giant's 27 km over Jupiter's radius, tripled to show at a whole world's distance.
 */
export const BANDED_GIANT_HAZE: Haze = {
  rayleigh: [0.012, 0.03, 0.07],
  mie: 0.05,
  mieAsymmetry: 0.6,
  scaleHeight: (3 * 27) / 71492,
};
