import type { Haze, SurfaceLook } from './worldShader.ts';

/**
 * A hot desert world under thin air (Vulcan, from *Star Trek*): red-ochre plains, rocky
 * mountain ranges, dry basins, almost no open water.
 *
 * What the canon gives: a hot desert world with rocky mountains under a hazy, reddish sky
 * ("Amok Time", the Gol plains, the Forge), its air thinner than Earth's; from orbit in *Star
 * Trek* (2009) an arid world of tan and ochre with little visible water (canon notes, section
 * 5). Drawn from that character only, after real deserts and Mars: nothing traced.
 *
 * **The ground.** Broad uplands and basins from low-frequency noise; across the uplands, ranges
 * of ridged noise -- long chains with spurs, as folded mountains run -- of darker, browner rock
 * with paler, dust-free crests; plains of red-ochre and tan between them, banded where wind has
 * laid out sand seas of a rustier red; the low basins old dry seas, floored with pale salt and
 * darker sediment rings; in the lowest of all, here and there, a little remaining water, dark.
 * The relief is baked as a height and lights the ranges with the star.
 *
 * **The air** is thin and dusty: a little Rayleigh scattering, iron-rich dust (Mie) that absorbs
 * the blue as Mars's does, so its haze and limb are a pale reddish tan -- a modest limb, the
 * scale height a third of Adrian's.
 *
 * Baked at 512 a face in half floats (the relief), 17 MB with mipmaps.
 */

/** The relief in the map's alpha: 0 to this many radii above the lowest ground. */
const HEIGHT_RANGE = 0.02;

/** Below this share of the height range, in the lowest basins, ground is under water. */
const WATER_BELOW = 0.012;

export const ARID: SurfaceLook = {
  layers: 1,
  faceSize: 512,
  halfFloat: true,
  fallback: [0.4, 0.24, 0.14],
  uniforms: () => ({}),
  bake: /* glsl */ `
    const float HEIGHT_RANGE = ${HEIGHT_RANGE.toFixed(4)};

    vec4 bakeLayer0(vec3 direction, float footprint) {
      vec3 warp = vec3(
        fbm(direction + vec3(5.2, 0.0, 0.0), 1.6, 4, 0.5, footprint),
        fbm(direction + vec3(0.0, 9.1, 0.0), 1.6, 4, 0.5, footprint),
        fbm(direction + vec3(0.0, 0.0, 13.3), 1.6, 4, 0.5, footprint)
      );
      vec3 p = direction + 0.12 * warp;
      // Uplands and basins.
      float land = fbm(p, 1.1, 6, 0.5, footprint);
      // Ranges where the ridged field runs high, on the uplands.
      float rangeMask = smoothstep(-0.2, 0.2, fbm(p + 17.0, 1.4, 4, 0.5, footprint)) * smoothstep(-0.3, 0.05, land);
      float ridges = ridged(p + 3.0, 3.2, 7, footprint);
      float mountains = rangeMask * smoothstep(0.2, 0.8, ridges);
      float basin = smoothstep(-0.12, -0.35, land);
      float height = clamp(0.35 + 0.45 * land + 0.55 * mountains, 0.0, 1.0);

      // Plains: red-ochre to tan, with sand seas laid out by the wind.
      float tone = fbm(p * vec3(1.0, 1.6, 1.0) + 7.0, 3.0, 6, 0.55, footprint);
      vec3 ochre = vec3(0.4, 0.16, 0.06);
      vec3 tan = vec3(0.5, 0.33, 0.17);
      vec3 plains = mix(ochre, tan, smoothstep(-0.3, 0.4, tone));
      float dunes = smoothstep(0.05, 0.4, fbm(p + 29.0, 2.2, 4, 0.5, footprint)) * (1.0 - rangeMask);
      float duneRipples = 0.5 + 0.5 * sin(dot(p, vec3(40.0, 13.0, 31.0)) + 6.0 * fbm(p + 31.0, 8.0, 3, 0.5, footprint));
      plains = mix(plains, vec3(0.55, 0.22, 0.08) * (0.9 + 0.15 * duneRipples), dunes * 0.8);
      // Mountains: darker, browner rock; crests paler where wind keeps them clear of dust.
      vec3 rock = mix(vec3(0.13, 0.08, 0.05), vec3(0.36, 0.26, 0.19), smoothstep(0.8, 1.0, ridges));
      vec3 albedo = mix(plains, rock, mountains);
      // Dry seas: pale salt in the middle, dark sediment rings around it.
      float salt = smoothstep(-0.38, -0.5, land);
      vec3 seabed = mix(vec3(0.26, 0.15, 0.09), vec3(0.62, 0.52, 0.4), salt);
      albedo = mix(albedo, seabed, basin);
      // Grain everywhere.
      albedo *= 1.0 + 0.1 * fbm(p + 41.0, 24.0, 4, 0.5, footprint);
      // The last of the water, in the very lowest ground.
      float water = smoothstep(-0.52, -0.56, land);
      albedo = mix(albedo, vec3(0.02, 0.04, 0.06), water);
      if (water > 0.5) height = 0.0;
      return vec4(encodeAlbedo(tinted(albedo)), max(height, water > 0.5 ? 0.0 : ${WATER_BELOW.toFixed(3)} * 1.5));
    }
  `,
  glsl: /* glsl */ `
    const float HEIGHT_RANGE = ${HEIGHT_RANGE.toFixed(4)};

    float reliefAt(vec3 d, float lod) {
      return textureLod(uLayer0, d, lod).a * HEIGHT_RANGE;
    }

    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      // Close, from low orbit, the map is read through a gentle swirl and grain is added live
      // below its texel: rock and sand, not a blur.
      float close = magnification(footprint);
      vec4 ground = layer0(detailWarp(direction, 0.6 * close));
      Surface s;
      s.albedo = decodeAlbedo(ground.rgb);
      float fine = 0.0;
      if (close > 0.0) {
        fine = fbm(direction + 13.0, 1.5 / TEXEL, 3, 0.5, footprint);
        s.albedo *= 1.0 + close * 0.2 * fine;
      }
      // The relief's slope by central differences a pixel or a texel apart, from the mipmap
      // level a pixel spans (as airless.ts does, and for the same reasons).
      float spacing = max(footprint, TEXEL);
      float lod = max(log2(footprint / TEXEL), 0.0);
      vec3 east = normalize(cross(abs(direction.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), direction));
      vec3 north = cross(direction, east);
      float dEast = reliefAt(normalize(direction + spacing * east), lod) - reliefAt(normalize(direction - spacing * east), lod);
      float dNorth = reliefAt(normalize(direction + spacing * north), lod) - reliefAt(normalize(direction - spacing * north), lod);
      s.normal = normalize(direction - (dEast * east + dNorth * north) / (2.0 * spacing));
      if (close > 0.0) s.normal = normalize(s.normal + close * (bumped(direction, fine * TEXEL * 0.1, 1.0) - direction));
      bool wet = ground.a < ${WATER_BELOW.toFixed(3)};
      // Rock and sand: Lambert, a little darker at the limb than the Moon's dust.
      s.minnaert = 0.9;
      s.specular = wet ? 0.02 : 0.0;
      s.roughness = 0.12;
      if (wet) s.normal = direction;
      s.cloud = 0.0;
      s.cloudAlbedo = vec3(0.0);
      return s;
    }
  `,
};

/**
 * Thin, dusty air: Rayleigh scattering a tenth of Earth's in the blue (Earth's zenith depths are about
 * 0.05, 0.1, 0.25 in red, green and blue), iron-rich dust that scatters forward and absorbs the
 * blue. Its limb is a narrow band of pale reddish tan.
 */
export const ARID_AIR: Haze = {
  rayleigh: [0.006, 0.009, 0.014],
  mie: 0.035,
  mieAsymmetry: 0.75,
  scaleHeight: 0.0028,
  absorption: [0.0, 0.02, 0.07],
};
