import type { Haze, SurfaceLook } from './worldShader.ts';

/**
 * A world under a thick, hazy atmosphere: no surface, only the top of a deep cloud and haze
 * deck (Adrian, from *Project Hail Mary*).
 *
 * What the canon gives: a high-gravity planet, its air rich in carbon dioxide with methane in
 * it, its surface hidden (canon notes, section 3). The "pale green banded" look in circulation
 * comes from an AI-generated wiki and is not followed. What we draw is what such air would show,
 * by the worlds we have seen: Venus, Titan, the giants.
 *
 * **The deck** is warm grey-ochre, lighter and darker by a few per cent -- faint bands along the
 * parallels, the cells of convection, streaks drawn out by the winds, a brighter collar toward
 * each pole -- because a deck under haze shows only that much contrast; Venus in visible light
 * is nearly featureless. **The haze** above it is mostly aerosol (Mie, grey, scattering forward)
 * with carbon dioxide's Rayleigh scattering, and the methane absorbs: its bands at 619, 727 and
 * 890 nm take the red out of every long path through the air, as they turn Uranus and Neptune
 * blue-green. Seen through the whole limb or with the star behind, the haze glows teal rather
 * than Earth's blue, and the terminator's long light paths come out green-grey rather than
 * Earth's sunset orange. The scale height is set generous so the limb is wide and bright.
 *
 * Baked at 512 a face, 8 MB with mipmaps: a planet seen whole, with little fine detail to hold.
 */
export const DENSE_HAZE: SurfaceLook = {
  layers: 1,
  faceSize: 512,
  fallback: [0.5, 0.46, 0.39],
  uniforms: () => ({}),
  bake: /* glsl */ `
    float bandHash(float n) {
      return float(lowbias32(uint(int(n) + 4096) ^ uSeedHash)) / 4294967295.0;
    }

    vec4 bakeLayer0(vec3 direction, float footprint) {
      // Winds stretch everything along the parallels; the warp bends the bands.
      vec3 warp = vec3(
        simplex(direction * vec3(1.5, 4.0, 1.5) + vec3(7.0, 0.0, 0.0)),
        simplex(direction * vec3(1.5, 4.0, 1.5) + vec3(0.0, 19.0, 0.0)),
        simplex(direction * vec3(1.5, 4.0, 1.5) + vec3(0.0, 0.0, 29.0))
      );
      vec3 p = direction + 0.06 * warp;
      float latitude = asin(clamp(p.y, -1.0, 1.0));
      // Faint bands, seeded in number and phase.
      float count = 5.0 + floor(4.0 * bandHash(1.0));
      float bands = sin(latitude * count * 2.0 + 6.2832 * bandHash(2.0)) * 0.5
        + sin(latitude * count * 4.3 + 6.2832 * bandHash(3.0)) * 0.25;
      float streaks = fbm(p * vec3(1.0, 5.0, 1.0), 3.0, 6, 0.55, footprint);
      // Convection cells: domes parted by creases, strongest toward the sub-stellar latitudes.
      float cells = billow(p + 11.0, 9.0, 5, 0.55, footprint);
      float collar = smoothstep(0.62, 0.78, abs(direction.y)) * (1.0 - smoothstep(0.86, 0.96, abs(direction.y)));
      float shade = 1.0 + 0.05 * bands + 0.05 * streaks + 0.035 * cells + 0.06 * collar;
      vec3 deck = vec3(0.6, 0.5, 0.37);
      // Brighter, creamier where the deck stands high; greyer in the troughs.
      vec3 albedo = mix(deck * vec3(0.94, 0.95, 0.98), deck * vec3(1.05, 1.03, 0.98), smoothstep(0.92, 1.08, shade)) * shade;
      return vec4(encodeAlbedo(tinted(albedo)), 1.0);
    }
  `,
  glsl: /* glsl */ `
    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      Surface s;
      s.albedo = decodeAlbedo(layer0(direction).rgb);
      // A cloud deck under haze: flat-ish, its limb darkening softened by the haze above it.
      s.minnaert = 0.85;
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
 * The air above the deck: grey aerosol haze (Mie, forward-scattering) with carbon dioxide's
 * Rayleigh scattering -- 2.5 times air's per molecule, kept low here because the deck is the top
 * of the view -- and methane's absorption, strongest in the red. Thin straight down, so the
 * deck's own warm grey shows through face-on; along the limb's long paths the same air is a
 * dozen times thicker, opaque, and filtered teal. The scale height, 0.8 % of the radius, is
 * several times a real one's, so the limb reads wide from orbit.
 */
export const DENSE_HAZE_AIR: Haze = {
  rayleigh: [0.025, 0.055, 0.12],
  mie: 0.3,
  mieAsymmetry: 0.72,
  scaleHeight: 0.008,
  absorption: [0.09, 0.016, 0.005],
};
