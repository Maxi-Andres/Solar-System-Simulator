import type { Haze, SurfaceLook } from './worldShader.ts';

/**
 * A world under a crushing, hot ammonia atmosphere (Erid, from *Project Hail Mary*): from space
 * only the top of its haze, banded by a fast spin.
 *
 * What the canon gives (Weir's Eridian document): 28 atm of air, mostly ammonia and high in
 * metals, 210 degrees C at the ground, little light reaching it, oceans of water at 202 degrees C,
 * volcanism, a field 25 times Earth's, a day of 5.11 hours. How it looks from space it does not
 * say, nor, as far as we could find, does the 2026 film show it (canon notes, section 4). So
 * this is what that physics would show.
 *
 * **No ammonia clouds.** Ammonia cannot condense above 132 degrees C, its critical point, so the
 * white ammonia-ice clouds of Jupiter have no place here. What a hot, ammonia-rich air makes is
 * haze: sunlight breaks ammonia into hydrazine and amines high up, where it is cooler, and they
 * condense into droplets and grains (hydrazine is a candidate for Jupiter's own upper haze);
 * ammonium salts and the metals' compounds add theirs. Such hazes are pale cream to tan, and
 * yellower the more blue and ultraviolet they absorb -- as Titan's tholins and Jupiter's polar
 * hazes are. So the disc is a deck of haze, cream and tan, its contrast low as Saturn's is
 * under its own haze.
 *
 * **Bands.** A day of 5.1 hours on a planet twice Earth's size spins its weather into many narrow
 * bands, more than Jupiter's (10 hours) -- the faster the spin, the narrower the jets. Bands of
 * seeded number and width, their edges rippled by the jets' shear, streaks drawn out along the
 * parallels, a few pale ovals where storms rise through the haze; the poles a little greyer.
 *
 * **The limb.** The air is light (ammonia, 17 g/mol, against Adrian's carbon dioxide at 44) and
 * hot, so for all of Erid's 2.09 g its scale height is about 9.5 km, twice Adrian's in proportion
 * to the radius: a wide, bright limb, cream-yellow. Exaggerated as Adrian's is, so it reads from
 * orbit.
 *
 * **The night side** is dark. The volcanoes' glow would have to come through 28 atmospheres of
 * absorbing, scattering haze -- what reaches space is the planet's own warmth, in the infrared,
 * not light the eye could see. So none is drawn.
 *
 * Baked at 512 a face, 8 MB with mipmaps: a hazy disc with little fine detail to hold.
 */
export const AMMONIA_HAZE: SurfaceLook = {
  layers: 1,
  faceSize: 512,
  fallback: [0.62, 0.55, 0.42],
  uniforms: () => ({}),
  bake: /* glsl */ `
    float seeded(uint n) {
      return float(lowbias32(n ^ uSeedHash)) / 4294967295.0;
    }

    vec4 bakeLayer0(vec3 direction, float footprint) {
      // The jets' shear ripples the bands' edges; everything is drawn out along the parallels.
      vec3 stretch = vec3(1.4, 7.0, 1.4);
      vec3 warp = vec3(
        fbm(direction * stretch + vec3(7.0, 0.0, 0.0), 1.0, 4, 0.5, footprint),
        fbm(direction * stretch + vec3(0.0, 19.0, 0.0), 1.0, 4, 0.5, footprint),
        fbm(direction * stretch + vec3(0.0, 0.0, 29.0), 1.0, 4, 0.5, footprint)
      );
      vec3 p = direction + 0.018 * warp;
      float latitude = asin(clamp(p.y, -1.0, 1.0));
      // Bands: a few sines of seeded count and phase, the narrowest from the fast spin.
      float count = 9.0 + floor(5.0 * seeded(1u));
      float bands = 0.55 * sin(latitude * count + 6.2832 * seeded(2u))
        + 0.3 * sin(latitude * count * 2.3 + 6.2832 * seeded(3u))
        + 0.15 * sin(latitude * count * 4.1 + 6.2832 * seeded(4u));
      // Narrower toward the equator, where the jets are strongest; calmer toward the poles.
      float calm = smoothstep(0.55, 1.2, abs(latitude));
      bands *= 1.0 - 0.6 * calm;
      float streaks = fbm(p * vec3(1.0, 9.0, 1.0) + 3.0, 3.0, 6, 0.55, footprint);
      // Storms: pale ovals, wider than tall, risen through the haze.
      float storms = 0.0;
      for (int i = 0; i < 7; i++) {
        uint n = uint(i) * 5u + 11u;
        float lat = (seeded(n) - 0.5) * 1.6;
        float lon = 6.2832 * seeded(n + 1u);
        vec3 centre = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        vec3 d = direction - centre;
        float size = mix(0.03, 0.08, seeded(n + 2u));
        vec2 e = vec2(length(d.xz) / 1.8, d.y) / size;
        storms += exp(-dot(e, e)) * mix(0.5, 1.0, seeded(n + 3u));
      }
      float shade = 0.5 + 0.5 * bands;
      vec3 zone = vec3(0.8, 0.72, 0.56);
      vec3 belt = vec3(0.6, 0.48, 0.33);
      vec3 albedo = mix(belt, zone, smoothstep(0.2, 0.8, shade + 0.1 * streaks));
      albedo *= 1.0 + 0.06 * streaks;
      albedo = mix(albedo, vec3(0.86, 0.8, 0.66), clamp(storms, 0.0, 1.0) * 0.7);
      // Toward the poles the haze thins over a greyer, deeper layer.
      albedo = mix(albedo, vec3(0.56, 0.54, 0.5), calm * 0.5);
      return vec4(encodeAlbedo(tinted(albedo)), 1.0);
    }
  `,
  glsl: /* glsl */ `
    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      Surface s;
      s.albedo = decodeAlbedo(layer0(direction).rgb);
      // The top of a deep haze: a soft, flat-ish disc, its limb darkening softened.
      s.minnaert = 0.8;
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
 * The air above the haze deck: the haze itself (Mie, forward-scattering, thick), ammonia's own
 * Rayleigh scattering, and the haze's absorption, strongest in the blue -- which yellows every
 * long path through it, so the limb glows cream-yellow. The scale height, 1.6 % of the radius,
 * is twice Adrian's as the physics has it (ammonia light and hot against Erid's 2.09 g), and
 * exaggerated by as much as Adrian's.
 */
export const AMMONIA_HAZE_AIR: Haze = {
  rayleigh: [0.012, 0.022, 0.04],
  mie: 0.45,
  mieAsymmetry: 0.7,
  scaleHeight: 0.016,
  absorption: [0.01, 0.04, 0.16],
};
