import type { Haze, SurfaceLook } from './worldShader.ts';

/**
 * A jungle moon (Pandora): rainforest from coast to mountain, some ocean, broken cloud.
 *
 * Made from what the canon says -- an Earth-sized moon of a gas giant, nearly all of its land
 * under forest, with seas and a thick, humid atmosphere -- and from how such a world would look
 * from orbit by what Earth shows: forest is dark (albedo under 0.1 even in green), open ocean
 * darker still except where the star glints off it, shallow shelves lighter and greener, and
 * the clouds the brightest thing on the disc by far.
 *
 * **The land** is a domain-warped fractal: the warp bends the coastlines into peninsulas and
 * bays instead of fractal blobs, and the sea level is set so a little over half the surface is
 * land. Ridged noise raises chains of mountains inland, whose relief bends the normal so they
 * shade near the terminator; only the highest turn to bare rock. The forest is not one green:
 * a second fractal mixes a deep blue-green canopy, which is what the canon's forests are, with
 * lighter, yellower stands.
 *
 * **The cloud** is weather systems a few thousand kilometres across, filled with a fractal of
 * smooth swells at large scales and cumulus cells at small ones (`billow`), warped a little and
 * stretched along the parallels as winds stretch real cloud. Its cover is `clouds`, modulated
 * by latitude as Earth's is -- heaviest at the equator and the mid-latitudes, thinnest over the
 * subtropics. It sits on the surface, without the shadow it would cast, and does not move
 * against the ground.
 *
 * Baked into two cube maps (surfaceBake.ts): the ground's albedo with its water, and the cloud
 * with the relief. Up close, past the maps' texels, two octaves of live noise go on adding
 * texture to the land.
 */
export const JUNGLE_MOON: SurfaceLook = {
  layers: 2,
  fallback: [0.03, 0.06, 0.06],
  uniforms: (world) => ({
    uClouds: { value: world.clouds ?? 0 },
  }),
  bake: /* glsl */ `
    uniform float uClouds;

    vec3 continentWarp(vec3 direction) {
      return vec3(
        simplex(direction * 1.6 + vec3(17.0, 0.0, 0.0)),
        simplex(direction * 1.6 + vec3(0.0, 29.0, 0.0)),
        simplex(direction * 1.6 + vec3(0.0, 0.0, 41.0))
      );
    }

    /**
     * Height of the land above the sea, negative under it: the continents' outline from the
     * warped direction, their coasts and terrain from the direction nearly as it is. Warping
     * the fine octaves too drew them out into fans of streaks wherever the warp is steep.
     */
    float landHeight(vec3 direction, vec3 warp, float footprint) {
      float outline = fbm(direction + 0.32 * warp, 1.3, 4, 0.5, footprint);
      float terrain = fbm(direction + 0.02 * warp, 14.0, 6, 0.5, footprint);
      return outline + 0.2 * terrain + 0.06;
    }

    float mountains(vec3 direction, vec3 warp, float land, float footprint) {
      float ridges = ridged(direction + 0.05 * warp + 5.0, 3.0, 8, footprint);
      return smoothstep(0.02, 0.2, land) * ridges * ridges;
    }

    /** The ground: square-rooted albedo, and how much of the texel is open water. */
    vec4 bakeLayer0(vec3 direction, float footprint) {
      vec3 warp = continentWarp(direction);
      float land = landHeight(direction, warp, footprint);
      float peaks = mountains(direction, warp, land, footprint);

      // The forest's two greens, and bare rock only on the highest ground.
      float stands = fbm(direction + 0.04 * warp, 7.0, 6, 0.55, footprint);
      vec3 canopy = mix(vec3(0.020, 0.062, 0.050), vec3(0.055, 0.095, 0.034), smoothstep(-0.3, 0.4, stands));
      // Wetter lowlands darker, near the coasts and in the basins.
      canopy *= mix(0.8, 1.0, smoothstep(0.0, 0.2, land));
      vec3 rock = vec3(0.075, 0.072, 0.060);
      vec3 ground = mix(canopy, rock, smoothstep(0.55, 0.75, peaks + 0.1 * stands));

      // Water: dark in the open, lighter and greener over the shelves.
      float shelf = smoothstep(-0.1, 0.0, land);
      vec3 water = mix(vec3(0.008, 0.020, 0.045), vec3(0.020, 0.065, 0.070), shelf * shelf);
      float isLand = smoothstep(-0.004, 0.004, land);

      // Small polar caps, edged by the fractal so they are not circles.
      float ice = smoothstep(0.955, 0.965, abs(direction.y) + 0.04 * land);

      vec3 albedo = mix(water, ground, isLand);
      albedo = mix(albedo, vec3(0.62, 0.66, 0.70), ice);
      return vec4(encodeAlbedo(tinted(albedo)), (1.0 - isLand) * (1.0 - ice));
    }

    /** The sky and the relief: cloud cover, cloud brightness, mountain height. */
    vec4 bakeLayer1(vec3 direction, float footprint) {
      vec3 warp = continentWarp(direction);
      float land = landHeight(direction, warp, footprint * 4.0);
      float relief = mountains(direction, warp, land, footprint);

      // Weather systems, and the cloud inside them down to the texel.
      vec3 cloudWarp = vec3(
        simplex(direction * 3.1 + vec3(53.0, 0.0, 0.0)),
        simplex(direction * 3.1 + vec3(0.0, 67.0, 0.0)),
        simplex(direction * 3.1 + vec3(0.0, 0.0, 71.0))
      );
      vec3 stretch = vec3(1.0, 1.5, 1.0);
      vec3 cloudAt = (direction + 0.09 * cloudWarp) * stretch;
      float systems = fbm(cloudAt + 13.0, 1.4, 2, 0.5, footprint);
      // Smooth swells at the large scales, cumulus cells at the small -- these warped less, for
      // the same reason as the coasts.
      float billows = 0.8 * fbm(cloudAt, 4.0, 4, 0.55, footprint)
        + 0.3 * fbm((direction + 0.02 * cloudWarp) * stretch + 3.0, 60.0, 3, 0.55, footprint)
        + 0.25 * billow((direction + 0.01 * cloudWarp) * stretch + 7.0, 110.0, 4, 0.6, footprint);
      // Heaviest at the equator and the mid-latitudes, clearest over the subtropics.
      float sinLatitude = direction.y;
      float belt = 0.55 * exp(-pow(sinLatitude / 0.16, 2.0))
        + 0.45 * exp(-pow((abs(sinLatitude) - 0.78) / 0.18, 2.0))
        - 0.35 * exp(-pow((abs(sinLatitude) - 0.42) / 0.14, 2.0));
      float cover = clamp(uClouds + 0.2 * belt, 0.0, 1.0);
      float field = 0.55 * systems + 0.75 * billows;
      // The threshold that leaves about \`cover\` of the field above it.
      float threshold = mix(0.42, -0.42, cover);
      float thickness = smoothstep(threshold, threshold + 0.22, field) * smoothstep(0.0, 0.02, uClouds);
      float brightness = smoothstep(threshold + 0.05, threshold + 0.4, field);
      return vec4(thickness, brightness, relief, 1.0);
    }
  `,
  glsl: /* glsl */ `
    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      vec4 ground = layer0(direction);
      vec4 sky = layer1(direction);
      Surface s;
      s.minnaert = 1.0;
      s.albedo = decodeAlbedo(ground.rgb);
      s.specular = 0.02 * ground.a;
      // Wind-roughened sea: Cox and Munk's slopes at a few metres a second, GGX alpha near 0.25.
      s.roughness = 0.5;
      float height = sky.b;
      if (footprint < TEXEL) {
        float closer = smoothstep(TEXEL, 0.5 * TEXEL, footprint);
        float detail = detailFbm(direction, 700.0, 2, 0.5, footprint) * closer * (1.0 - ground.a);
        s.albedo *= 1.0 + 0.3 * detail;
        height += 0.04 * detail;
      }
      s.normal = bumped(direction, height, 0.02);
      s.cloud = sky.r;
      s.cloudAlbedo = vec3(mix(0.45, 0.8, sky.g));
      return s;
    }
  `,
};

/**
 * Its air: Earth's Rayleigh depths at 680, 550 and 440 nm, with a thin Mie haze for the white
 * of wet air near the limb. The canon makes Pandora's air denser than Earth's; drawn denser it
 * hid the forest under the blue it scatters, and a world described as green from orbit is not.
 * The scale height is Earth's 8.5 km over its radius, doubled so the blue rim reads at the
 * distance a whole world is seen from.
 */
export const JUNGLE_MOON_HAZE: Haze = {
  rayleigh: [0.045, 0.0976, 0.235],
  mie: 0.03,
  mieAsymmetry: 0.75,
  scaleHeight: (2 * 8.5) / 6371,
};
