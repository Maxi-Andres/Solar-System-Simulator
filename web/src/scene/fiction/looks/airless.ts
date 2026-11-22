import * as THREE from 'three';

import { CRATER_GLSL, rayCraterPlacements } from './craters.ts';
import { seedFraction } from './noise.ts';
import type { Haze, SurfaceLook, WorldLook } from './worldShader.ts';

/**
 * Airless worlds: Polyphemus' small moons, bare rock (`barren`) and bare ice (`icy`).
 *
 * **No air, so no haze.** The limb is a hard edge against the sky and nothing scatters light
 * past the terminator. **The light is not Lambert's.** Regolith -- rock or ice ground to powder
 * by impacts -- sends light back toward where it came from, so a full airless world is a flat
 * disc, its limb as bright as its centre, the Moon's famous look; Lommel-Seeliger's law,
 * mu0 / (mu0 + mu), describes it. Minnaert's mu0^k mu^(k-1) with k near one half is the same
 * flat disc and is what the world shader already draws, so it is used here: k = 0.55 for rock
 * (the Moon's is about 0.5 to 0.6 in the visible), 0.7 for bright ice, whose many scatterings
 * make it rounder, as Europa's and Enceladus' discs are. The ground stays bright almost to the
 * terminator and then drops; with the crater rims and walls catching or losing the light
 * there, the terminator is the hard, broken line every airless world shows.
 *
 * **Cheap, because there are thirteen of them** and they are mostly seen as small discs. One
 * cube map of 256 a face, 4.2 MB of video memory with its mipmaps, against 32 MB for one layer
 * of Pandora's: albedo in its colour channels, relief in alpha -- in half floats, because the
 * relief's slope is taken from differences a texel apart, and in eight bits those came out as a
 * speckle of quantisation seen close. Thirteen moons, 55 MB; in bytes it would be half. A crater narrower than the map
 * holds is left out of the bake; up close one octave of small craters, a third of the cost of
 * a baked one, and a little grain are drawn live in their place.
 */

/** Texels a face is baked at: a moon filling a quarter of a 1080-line screen is a texel a pixel. */
export const AIRLESS_FACE_SIZE = 256;

/** The relief encoded in the map's alpha: plus or minus this many radii. */
const HEIGHT_RANGE = 0.03;

/** No air: nothing to scatter, nothing to dim. */
export const NO_HAZE: Haze = { rayleigh: [0, 0, 0], mie: 0, mieAsymmetry: 0, scaleHeight: 0.002 };

/** The uniforms an airless world adds: its ray craters and a hue drawn from its seed. */
function airlessUniforms(world: WorldLook): Record<string, THREE.IUniform> {
  return {
    uRays: { value: rayCraterPlacements(world.seed) },
    uHue: { value: seedFraction(world.seed, 50) },
  };
}

const BAKE_HEAD = /* glsl */ `
  ${CRATER_GLSL}
  uniform float uHue;
  const float HEIGHT_RANGE = ${HEIGHT_RANGE.toFixed(4)};

  vec4 encodeGround(vec3 albedo, float height) {
    return vec4(encodeAlbedo(tinted(albedo)), clamp(0.5 + 0.5 * height / HEIGHT_RANGE, 0.0, 1.0));
  }
`;

/** The surface every airless look draws from its map: albedo, relief, the live detail. */
function airlessSurface(minnaert: number, liveDensity: number): string {
  return /* glsl */ `
    ${CRATER_GLSL}
    const float HEIGHT_RANGE = ${HEIGHT_RANGE.toFixed(4)};
    // Live craters only well inside the map's texel: a world filling the screen does without
    // them, and pays nothing for them.
    const float LIVE_BELOW = 0.2;

    float reliefAt(vec3 d, float lod) {
      return (textureLod(uLayer0, d, lod).a - 0.5) * 2.0 * HEIGHT_RANGE;
    }

    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      vec4 ground = layer0(direction);
      Surface s;
      s.albedo = decodeAlbedo(ground.rgb);

      // The relief's slope by central differences on the sphere, a pixel or a texel apart,
      // whichever is wider, from the mipmap level a pixel spans. Taken from screen derivatives
      // instead, it came in 2x2-pixel blocks; and unfiltered, every rim a few pixels across
      // flipped between lit and dark along the terminator, a jagged, dithered band where the
      // slight tilt of a rim decides everything. Averaged over the pixel, it shades as the
      // pixel's own patch of ground would.
      float spacing = max(footprint, TEXEL);
      float lod = max(log2(footprint / TEXEL), 0.0);
      vec3 east = normalize(cross(abs(direction.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), direction));
      vec3 north = cross(direction, east);
      float dEast = reliefAt(normalize(direction + spacing * east), lod) - reliefAt(normalize(direction - spacing * east), lod);
      float dNorth = reliefAt(normalize(direction + spacing * north), lod) - reliefAt(normalize(direction - spacing * north), lod);
      s.normal = normalize(direction - (dEast * east + dNorth * north) / (2.0 * spacing));

      if (footprint < LIVE_BELOW * TEXEL) {
        // Well past the map's texels, up close: the small craters it could not hold, and a
        // grain of rubble in the albedo. Only craters six pixels and more across are drawn, so
        // their screen-derivative slopes are not blocks.
        float closer = smoothstep(LIVE_BELOW * TEXEL, 0.5 * LIVE_BELOW * TEXEL, footprint);
        vec2 small = craterOctave(direction, 12.0, ${liveDensity.toFixed(2)}, 91u, 2.0 * footprint, false);
        float grain = octaveWeight(200.0, footprint) * simplex(direction * 200.0);
        s.normal = normalize(s.normal + closer * (bumped(direction, small.x, 1.0) - direction));
        s.albedo *= 1.0 + closer * (0.5 * small.y + 0.06 * grain);
      }
      s.minnaert = ${minnaert.toFixed(2)};
      s.specular = 0.0;
      s.roughness = 1.0;
      s.cloud = 0.0;
      s.cloudAlbedo = vec3(0.0);
      return s;
    }
  `;
}

/**
 * Bare rock (`barren`), grey to ochre by seed or tint. Saturated with craters at every size the
 * map holds, as the Moon's highlands and Callisto are; broad darker plains where old lava or
 * dust has smoothed the ground (the Moon's maria, without their outline); fresh craters' bright
 * ejecta and, on some seeds, a rayed crater. Albedo about 0.12, the Moon's.
 */
export const BARREN: SurfaceLook = {
  layers: 1,
  faceSize: AIRLESS_FACE_SIZE,
  halfFloat: true,
  bakeTexelsPerFrame: AIRLESS_FACE_SIZE ** 2,
  fallback: [0.12, 0.115, 0.105],
  uniforms: airlessUniforms,
  bake: /* glsl */ `
    ${BAKE_HEAD}

    vec4 bakeLayer0(vec3 direction, float footprint) {
      vec2 craters = craterOctave(direction, 2.5, 0.6, 1u, footprint, true)
        + craterOctave(direction, 5.0, 0.75, 2u, footprint, true)
        + craterOctave(direction, 10.0, 0.85, 3u, footprint, true)
        + craterOctave(direction, 20.0, 0.9, 4u, footprint, true)
        + craterOctave(direction, 40.0, 0.9, 5u, footprint, true)
        + rayCraters(direction);
      // Plains: lower, darker, with fewer of the large old craters showing through.
      float plains = smoothstep(0.08, 0.3, fbm(direction, 1.1, 4, 0.5, footprint));
      float mottle = fbm(direction, 18.0, 4, 0.55, footprint);
      vec3 rock = mix(vec3(0.125, 0.122, 0.116), vec3(0.175, 0.13, 0.085), uHue);
      vec3 albedo = rock * mix(1.0, 0.62, plains) * (1.0 + 0.12 * mottle);
      albedo *= 1.0 + 0.8 * min(craters.y, 1.6);
      float height = craters.x * mix(1.0, 0.6, plains) - 0.004 * plains
        + 0.003 * fbm(direction, 4.0, 4, 0.5, footprint);
      return encodeGround(albedo, height);
    }
  `,
  glsl: airlessSurface(0.55, 0.75),
};

/**
 * Bare ice (`icy`): bright, about 0.6, and cracked. Long arcs of lineae where the crust has
 * split and refrozen, crossing one another, each a dark band between two low ridges as
 * Europa's double ridges are, and a finer net of fractures; darker mottled patches where the surface has been disrupted.
 * What keeps it from being Europa: lineae in a seeded grey-blue to tan rather than Europa's red
 * brown, ice with a faint blue cast, and more craters, some rayed -- an older surface than
 * Europa's, which has almost none.
 */
export const ICY: SurfaceLook = {
  layers: 1,
  faceSize: AIRLESS_FACE_SIZE,
  halfFloat: true,
  bakeTexelsPerFrame: AIRLESS_FACE_SIZE ** 2,
  fallback: [0.56, 0.6, 0.64],
  uniforms: airlessUniforms,
  bake: /* glsl */ `
    ${BAKE_HEAD}

    /** 1 on a line \`width\` radii wide where \`s\` is zero, 0 off it. */
    float lineOf(float s, float width) {
      return 1.0 - smoothstep(0.0, width, abs(s));
    }

    // Lineae: arcs of circles on the sphere -- great circles and smaller ones, as the
    // stresses of tides crack a floating crust -- each wavering a little and broken into
    // stretches, so they run long and cross rather than closing into loops.
    const int ARCS = 14;

    vec4 bakeLayer0(vec3 direction, float footprint) {
      // A line narrower than the map can hold is drawn at the narrowest it can, fainter by
      // as much: the same darkening across the texel, no aliased dashes.
      float narrowest = 2.0 * footprint;
      float lineae = 0.0;
      float ridges = 0.0;
      for (int i = 0; i < ARCS; i++) {
        vec4 a;
        vec4 b;
        cellRandom(ivec3(i, 17, 5), 777u, a, b);
        vec3 pole = normalize(vec3(a.xyz * 2.0 - 1.0) + 1e-4);
        float offset = (b.x - 0.5) * 1.1;
        float s = dot(direction, pole) - offset
          + 0.025 * simplex(direction * 3.0 + vec3(float(i) * 5.3));
        if (abs(s) > 0.05) continue;
        float stretch = smoothstep(-0.15, 0.15, simplex(direction * 1.4 + vec3(float(i) * 9.1, 3.0, 1.0)) + b.y - 0.35);
        float trueWidth = 0.007 * mix(0.6, 1.8, b.z);
        float w = max(trueWidth, narrowest);
        lineae = max(lineae, stretch * lineOf(s, w) * mix(0.55, 1.0, b.w) * trueWidth / w);
        // Double ridges: a trough down the line's middle, a low ridge either side.
        ridges += stretch * w * 0.12 * (lineOf(s, 2.6 * w) - 1.6 * lineOf(s, 0.8 * w));
      }
      // A finer net of fractures between them.
      float fine = simplex(direction * 14.0 + 9.0);
      float fractures = 0.22 * lineOf(fine, max(0.06, 3.0 * footprint * 14.0));

      vec2 craters = craterOctave(direction, 3.0, 0.3, 1u, footprint, true)
        + craterOctave(direction, 7.0, 0.35, 2u, footprint, true)
        + craterOctave(direction, 16.0, 0.4, 3u, footprint, true)
        + rayCraters(direction);

      vec3 ice = mix(vec3(0.62, 0.66, 0.70), vec3(0.50, 0.55, 0.61), smoothstep(-0.3, 0.5, fbm(direction, 4.0, 5, 0.55, footprint)));
      float disrupted = smoothstep(0.22, 0.42, fbm(direction + 3.0, 1.6, 5, 0.55, footprint));
      ice = mix(ice, ice * vec3(0.72, 0.7, 0.68), disrupted);
      vec3 lines = mix(vec3(0.30, 0.34, 0.40), vec3(0.42, 0.33, 0.25), uHue);
      vec3 albedo = mix(ice, lines, clamp(lineae + fractures, 0.0, 1.0));
      albedo *= 1.0 + 0.25 * min(craters.y, 1.6);
      // Ice relaxes: craters shallower than in rock.
      float height = 0.6 * craters.x + ridges + 0.002 * fbm(direction, 3.0, 4, 0.5, footprint);
      return encodeGround(albedo, height);
    }
  `,
  glsl: airlessSurface(0.7, 0.35),
};
