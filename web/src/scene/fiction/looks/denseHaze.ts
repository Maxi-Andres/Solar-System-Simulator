import * as THREE from 'three';

import { seedFraction } from './noise.ts';
import type { Haze, SurfaceLook, WorldLook } from './worldShader.ts';

/**
 * A world under a thick atmosphere: no surface, only the top of a deep, churning cloud deck
 * (Adrian, from *Project Hail Mary*), drawn after the general character of the 2026 film's.
 *
 * What the canon gives: a high-gravity planet, its air rich in carbon dioxide with methane in
 * it, its surface hidden (canon notes, section 3). The novel gives no colours; the look is the
 * film's: a dark, turbulent deck in deep greens, lit lime in places, with amber and orange-brown
 * zones, and a bright green limb.
 *
 * **The deck** is turbulence rather than bands. Vortices -- a few broad ones and some sixteen
 * smaller, each turning either way -- roll the sphere about their centres, most at the
 * core and fading outward, so whatever passes near one is rolled into a curl; they turn the
 * cloud a radian or two, not many times over, so the curls stay round rather than wound into
 * combed streaks. Between them the point is warped twice by fractal noise (domain warping),
 * which folds smooth noise into tongues and eddies, and then carried a few steps along curl
 * noise -- the flow round each high and low of a finer noise -- so the streams roll up into
 * small eddies where they meet. On that point, broad regions decide between the green deck and
 * the amber zones; a soft field gives each its dark troughs and lighter streams; a low,
 * separate field lets the bright lime through in a few glowing patches only. Rounded cells --
 * the tops of convection -- are baked as a height, which the surface turns into relief lit by
 * the star: puffs and rolls rather than paint.
 *
 * **The air** above it scatters mostly green and absorbs the rest: methane takes the red, an
 * organic haze -- as Titan's does -- the blue, so the light that comes back along the limb's
 * long paths is a saturated green. Face-on the air is thin enough for the deck's own colours to show, the amber
 * darkened toward brown.
 *
 * Baked at 1,024 a face, 34 MB with mipmaps: the eddies are what the look is, and at 512 they
 * blurred to soft blotches on a world filling the screen. Each texel takes two samples, four
 * where a vortex has drawn the cloud out finer than a texel (where one sample drew
 * stair-steps).
 */

/** Vortices in the table: broad ones first, then the smaller. */
const BROAD_VORTICES = 6;
const SMALL_VORTICES = 16;
const VORTICES = BROAD_VORTICES + SMALL_VORTICES;

/**
 * The world's vortices, from its seed: each a centre on the sphere scaled to its reach (radii)
 * and its turn at the core (radians, either way). Worked out here once, not per texel.
 */
function vortexTable(world: WorldLook): THREE.Vector4[] {
  return Array.from({ length: VORTICES }, (_, i) => {
    const random = (k: number): number => seedFraction(world.seed, 1000 + i * 8 + k);
    const z = 2 * random(0) - 1;
    const a = 2 * Math.PI * random(1);
    const r = Math.sqrt(Math.max(1 - z * z, 0));
    const broad = i < BROAD_VORTICES;
    const reach = (broad ? 0.3 : 0.12) * (0.6 + 0.8 * random(2));
    const turn = (random(3) < 0.5 ? -1 : 1) * (broad ? 1.4 : 2.0) * (0.5 + 0.5 * random(4));
    return new THREE.Vector4(r * Math.cos(a) * reach, z * reach, r * Math.sin(a) * reach, turn);
  });
}

export const DENSE_HAZE: SurfaceLook = {
  layers: 1,
  faceSize: 1024,
  // A costly bake per texel: a sixteenth of the usual texels to start with, then as many as
  // the measured cost fits in the frame's bake budget (surfaceBake.ts).
  bakeTexelsPerFrame: 128 * 128,
  fallback: [0.03, 0.12, 0.02],
  uniforms: (world) => ({ uVortex: { value: vortexTable(world) }, uOne: { value: 1 } }),
  bake: /* glsl */ `
    uniform vec4 uVortex[${VORTICES}];
    // 1, as a uniform: loop counts multiplied by it -- vortices, curl steps, octaves -- are
    // unknown to the compiler, which then keeps the loops as loops. Unrolled, the bake took
    // Direct3D's compiler some five seconds.
    uniform int uOne;

    /** \`p\` turned about \`axis\` by \`angle\` (Rodrigues). */
    vec3 turned(vec3 p, vec3 axis, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
    }

    /** The table's vortices from \`first\`, \`count\` of them: each rolls the point about its centre. */
    vec3 vortices(vec3 p, int first, int count) {
      for (int i = first; i < first + count * uOne; i++) {
        vec4 v = uVortex[i];
        float reach = length(v.xyz);
        vec3 centre = v.xyz / reach;
        vec3 d = p - centre;
        float k = dot(d, d) / (reach * reach);
        if (k < 9.0) p = turned(p, centre, v.w * exp(-k));
      }
      return p;
    }

    /**
     * \`p\` carried a few steps along curl noise of \`frequency\`: the flow round each high and
     * low of the noise, tangent to the sphere, so every hump becomes a little eddy.
     */
    vec3 curled(vec3 p, float frequency, int steps, float reach) {
      const float h = 0.15;
      for (int i = 0; i < steps * uOne; i++) {
        vec3 x = p * frequency + float(i) * 0.37;
        float c = simplex(x);
        vec3 gradient = vec3(simplex(x + vec3(h, 0.0, 0.0)) - c, simplex(x + vec3(0.0, h, 0.0)) - c, simplex(x + vec3(0.0, 0.0, h)) - c) / h;
        p += (reach / frequency) * cross(normalize(p), gradient);
      }
      return p;
    }

    vec3 warpField(vec3 p, float frequency, int octaves, float footprint) {
      // One call in a loop, not three: one copy of the noise for the compiler.
      vec3 w;
      for (int axis = 0; axis < 3 * uOne; axis++) {
        vec3 offset = axis == 0 ? vec3(3.1, 0.0, 0.0) : axis == 1 ? vec3(0.0, 7.3, 0.0) : vec3(0.0, 0.0, 11.7);
        w[axis] = fbm(p + offset, frequency, octaves * uOne, 0.5, footprint);
      }
      return w;
    }

    /**
     * Where a direction's cloud has been carried to: \`broad\` by the broad flow alone, which
     * places the zones; the point returned by all of it, which draws the streams in them.
     */
    vec3 carried(vec3 direction, float footprint, out vec3 broad) {
      vec3 p = vortices(direction, 0, ${BROAD_VORTICES});
      p += 0.2 * warpField(p, 1.3, 3, footprint);
      broad = p;
      p = vortices(normalize(p), ${BROAD_VORTICES}, ${SMALL_VORTICES});
      vec3 q = p + 0.1 * warpField(p + 5.0, 3.5, 4, footprint);
      for (int scale = 0; scale < 2 * uOne; scale++) {
        q = curled(q, scale == 0 ? 6.0 : 14.0, scale == 0 ? 3 : 2, scale == 0 ? 0.4 : 0.12);
      }
      return q;
    }

    /** The deck at a carried point: albedo, and the cells' height in w. */
    vec4 deck(vec3 q, vec3 broad, float footprint) {
      // Zones: the green deck and the amber, broad, their edges drawn out by the streams.
      // The deck's fields, one noise call in a loop: the zones' broad field and their edges' fine
      // one, the streams, the lime's.
      vec4 f;
      for (int k = 0; k < 4 * uOne; k++) {
        vec3 at = k == 0 ? broad + 21.0 : k == 1 ? q + 23.0 : k == 2 ? q + 31.0 : broad + 61.0;
        float frequency = k == 0 ? 1.0 : k == 1 ? 4.0 : k == 2 ? 2.8 : 1.6;
        int octaves = k == 0 ? 3 : k == 1 ? 2 : k == 2 ? 4 : 3;
        f[k] = fbm(at, frequency, octaves * uOne, 0.5, footprint);
      }
      float region = f.x + 0.12 * f.y;
      float amber = smoothstep(-0.12, 0.18, region);
      // The streams: dark troughs and lighter flows, soft-edged.
      float field = f.z;
      float light = clamp(0.42 + 1.0 * field, 0.0, 1.0);
      // The bright lime only where a broad, separate field lets it through.
      float glow = smoothstep(0.02, 0.32, f.w);
      // Convection: rounded cells, finer, a height for the surface's relief and a little shade.
      float cells = billow(q + 51.0, 16.0, 3 * uOne, 0.5, footprint);
      float height = 0.5 + 0.35 * field + 0.25 * cells;
      light *= 0.85 + 0.15 * cells;

      vec3 deepGreen = vec3(0.004, 0.026, 0.003);
      vec3 green = vec3(0.028, 0.16, 0.01);
      vec3 limeGreen = vec3(0.4, 0.75, 0.025);
      vec3 rust = vec3(0.12, 0.028, 0.003);
      vec3 amberLight = vec3(0.9, 0.22, 0.012);
      vec3 greens = mix(deepGreen, green, smoothstep(0.0, 0.6, light));
      greens = mix(greens, limeGreen, glow * smoothstep(0.35, 0.8, light));
      vec3 ambers = mix(rust, amberLight, light * light);
      vec3 albedo = mix(greens, ambers, amber);
      return vec4(albedo, clamp(height, 0.0, 1.0));
    }

    vec4 bakeLayer0(vec3 direction, float footprint) {
      // Two samples a texel on a diagonal; two more on the other where the flow has drawn the
      // cloud out finer than a texel -- the first two carried points far apart. One loop with a
      // count found as it goes, so the compiler keeps one copy of the flow, not four.
      vec3 side = normalize(cross(direction, abs(direction.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 up = cross(side, direction);
      vec4 sum = vec4(0.0);
      vec3 first = vec3(0.0);
      int count = 2;
      for (int i = 0; i < count; i++) {
        vec2 o = i == 0 ? vec2(0.25, 0.25) : i == 1 ? vec2(-0.25, -0.25) : i == 2 ? vec2(0.25, -0.25) : vec2(-0.25, 0.25);
        vec3 broad;
        vec3 q = carried(normalize(direction + footprint * (o.x * side + o.y * up)), footprint, broad);
        sum += deck(q, broad, footprint);
        if (i == 0) first = q;
        if (i == 1 && distance(first, q) > 6.0 * 0.71 * footprint) count = 4;
      }
      sum /= float(count);
      return vec4(encodeAlbedo(tinted(sum.rgb)), sum.a);
    }
  `,
  glsl: /* glsl */ `
    Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3 toStar) {
      // Close, from low orbit, the map's texels are many pixels wide: it is read through a swirl
      // and finer eddies are added live -- three octaves of noise below the texel, swirled with it.
      float close = magnification(footprint);
      vec3 at = detailWarp(direction, close);
      vec4 baked = layer0(at);
      Surface s;
      s.albedo = decodeAlbedo(baked.rgb);
      float fine = 0.0;
      if (close > 0.0) {
        fine = fbm(at + 7.0, 1.2 / TEXEL, 3, 0.55, footprint);
        s.albedo *= 1.0 + close * 0.28 * fine;
      }
      // A cloud deck under haze: flat-ish, its limb darkening softened by the haze above it.
      s.minnaert = 0.85;
      // The convection cells' relief, lit by the star: puffs and rolls, and the live eddies' too.
      s.normal = bumped(direction, baked.a + close * 0.04 * fine, 0.004);
      s.specular = 0.0;
      s.roughness = 1.0;
      s.cloud = 0.0;
      s.cloudAlbedo = vec3(0.0);
      return s;
    }
  `,
};

/**
 * The air above the deck, tuned to the film's limb rather than worked out: a fine haze that
 * scatters most in the green (in the "rayleigh" slot, for its phase function; no gas scatters
 * so), a little grey aerosol, methane's absorption in the red and an organic haze's in the blue.
 * Thin straight down, so the deck's own colours show face-on, the amber a little browned; along
 * the limb's long paths the same air is a dozen times thicker and what it sends back is a
 * saturated lime. The scale height, 0.8 % of the radius, is several times a real one's, so the
 * limb reads wide from orbit.
 */
export const DENSE_HAZE_AIR: Haze = {
  rayleigh: [0.006, 0.06, 0.02],
  mie: 0.03,
  mieAsymmetry: 0.62,
  scaleHeight: 0.008,
  absorption: [0.18, 0.003, 0.28],
};
