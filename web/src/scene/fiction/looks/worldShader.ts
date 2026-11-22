import * as THREE from 'three';

import type { FictionLook } from '../../../core/fictionLook.ts';
import { LIGHTING } from '../../shading.ts';
import { NOISE_GLSL, seedHash } from './noise.ts';
import { RING_GLSL } from './ringProfile.ts';
import { BAKE_FACE_SIZE, BAKE_TEXELS_PER_FRAME, SurfaceBake } from './surfaceBake.ts';

/**
 * What every fictional world's sphere shares: its frame, its light, its haze; and the two
 * things each look writes -- the noise baked into its cube maps (surfaceBake.ts), and how the
 * baked layers become the ground under a direction.
 *
 * **The frame is the sphere's own.** The scene spans 1e23 km and a world's position in it is
 * a number float32 cannot hold to a metre, so nothing here touches world positions. The
 * sphere's direction comes from the vertex (normalised, so a sphere built at its radius in
 * scene units and one built at radius one and scaled draw the same), the star's direction and
 * the camera's are turned into that frame in the vertex shader, and every angle the lighting
 * needs is a dot product between unit vectors there. Local y is the world's pole, as it is for
 * every body in the scene (orientation.ts), so bands run along latitude and rings lie in the
 * equator.
 *
 * **The light is exoplanetSurface.ts's.** The same protocol -- `userData.starDirection`, a
 * world-space unit vector to the star that the scene sets every frame, and `userData.ambient`,
 * the lighting mode's ambient share -- and the same rule: the day side lit by its star, the
 * night side black under Natural lighting and lifted by the ambient share under Flood and
 * Shadow. What it adds is the house's photometry: a surface of albedo `a` is drawn at
 * `a / pi * E` with E the Solar System's own sun intensity (shading.ts LIGHTING), as the
 * planets are, so an ocean of albedo 0.01 reads as dark as Earth's does beside it.
 *
 * **The haze is single scattering over a thin shell, in closed form.** Earth's atmosphere is
 * ray-marched (atmosphere.ts) because it has to match measurements; these worlds have none to
 * match, and a march costs sixteen samples a pixel. A plane-parallel layer of zenith optical
 * depth tau over a dark ground, lit at mu0 and seen at mu, sends back
 *
 *   L = E / (4 pi) * P(theta) * mu0 / (mu + mu0) * (1 - exp(-tau (ch(mu) + ch(mu0))))
 *
 * with ch the Chapman function standing in for 1/mu so the limb stays finite. It reddens the
 * light reaching the ground near the terminator, blues and brightens the limb, and costs a
 * few exponentials. The halo past the limb is the same air seen edge-on (atmosphereShell.ts),
 * from the same uniforms.
 */

/** The Solar System's sun intensity, from shading.ts: the irradiance every world is lit by. */
export const WORLD_IRRADIANCE = LIGHTING.natural.sun;

/** The haze, shared by a world's surface and its halo. */
export const HAZE_GLSL = /* glsl */ `
  uniform vec3 uRayleighDepth;
  uniform float uMieDepth;
  uniform vec3 uAbsorption;
  uniform float uMieAsymmetry;
  uniform float uScaleHeight;

  /** Air mass toward a direction mu above the horizon, the Chapman function in closed form. */
  float chapman(float mu) {
    float grazing = sqrt(0.5 * PI / uScaleHeight);
    if (mu >= 0.0) return 1.0 / (mu + 1.0 / grazing);
    // Below the horizon the path dips through the denser air under its tangent point.
    return 2.0 * grazing * exp(min(mu * mu / (2.0 * uScaleHeight), 30.0)) - 1.0 / (-mu + 1.0 / grazing);
  }

  /** Optical depth that scatters: Rayleigh and Mie. */
  vec3 hazeDepth() {
    return uRayleighDepth + vec3(uMieDepth);
  }

  /** Optical depth that dims: scattering plus absorption (methane's red bands, say). */
  vec3 hazeExtinction() {
    return hazeDepth() + uAbsorption;
  }

  /** The share of what the air takes that it scatters rather than absorbs. */
  vec3 hazeAlbedo() {
    return hazeDepth() / max(hazeExtinction(), vec3(1e-6));
  }

  /** The air's phase function, Rayleigh and Henyey-Greenstein weighted by their depths. */
  vec3 hazePhase(float cosTheta) {
    float rayleigh = 0.75 * (1.0 + cosTheta * cosTheta);
    float g = uMieAsymmetry;
    float mie = (1.0 - g * g) / pow(max(1.0 + g * g - 2.0 * g * cosTheta, 1e-4), 1.5);
    // A share scattered isotropically, standing in for the light a thick haze scatters many
    // times over: single scattering alone left a forward-scattering haze black at the limb
    // whenever the star was behind the camera.
    mie = mix(mie, 1.0, 0.35);
    return (uRayleighDepth * rayleigh + vec3(uMieDepth * mie)) / max(hazeDepth(), vec3(1e-6));
  }

  /** Sunlight left after the air above a point at \`altitude\` radii, sun at mu0. */
  vec3 sunThroughHaze(float mu0, float altitude) {
    return exp(-hazeExtinction() * exp(-altitude / uScaleHeight) * chapman(mu0));
  }
`;

/** The tint, for the bake: colours leaned toward a world's hue, keeping their brightness. */
export const TINT_GLSL = /* glsl */ `
  uniform vec3 uTint;
  uniform float uTintWeight;

  vec3 tinted(vec3 colour) {
    float luma = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    float tintLuma = max(dot(uTint, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
    return mix(colour, uTint * (luma / tintLuma), uTintWeight);
  }

  /** The baked colour's encoding: its square root, for 8 bits to hold an ocean's darks. */
  vec3 encodeAlbedo(vec3 albedo) {
    return sqrt(clamp(albedo, 0.0, 1.0));
  }
`;

const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform vec3 uStarDirection;

  varying vec3 vPosition;
  varying vec3 vToCamera;
  varying vec3 vStar;

  void main() {
    vPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    // Into the sphere's own frame. For a rotation times a uniform scale the transpose is the
    // inverse up to that scale, which normalising removes.
    vToCamera = transpose(mat3(modelViewMatrix)) * (-viewPosition.xyz);
    vStar = transpose(mat3(modelMatrix)) * uStarDirection;
    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

/** A fictional world's look (core/fictionLook.ts). */
export type WorldLook = Extract<FictionLook, { kind: 'world' }>;

/**
 * A palette's look, in two halves.
 *
 * `bake` defines `vec4 bakeLayerN(vec3 direction, float footprint)` for each of its `layers`,
 * with the noise (noise.ts), `tinted` and `encodeAlbedo` in scope: the cube maps' texels.
 *
 * `glsl` defines `Surface surface(vec3 direction, float footprint, vec3 toCamera, vec3
 * toStar)`, reading the baked layers with `layerN(direction)`; `Surface`, `decodeAlbedo` and
 * `bumped` are declared before it, and the noise is in scope again for detail finer than the
 * maps' texels, seen up close.
 */
export interface SurfaceLook {
  readonly bake: string;
  readonly layers: number;
  /** Baked in half floats (surfaceBake.ts BakeSource). */
  readonly halfFloat?: boolean;
  /** Texels baked a frame, for a bake costlier per texel than most; BAKE_TEXELS_PER_FRAME when absent. */
  readonly bakeTexelsPerFrame?: number;
  /** Texels a cube face is baked at; BAKE_FACE_SIZE when absent. `TEXEL` in `glsl` is its width in radii. */
  readonly faceSize?: number;
  readonly glsl: string;
  /** Linear albedo drawn until the bake is in. */
  readonly fallback: readonly [number, number, number];
  /** Its own uniforms for one world, seen by the bake and the surface: fresh objects every call. */
  uniforms(world: WorldLook): Record<string, THREE.IUniform>;
}

function fragmentShader(look: SurfaceLook): string {
  const layers = Array.from({ length: look.layers }, (_, i) => i);
  return /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  // A baked texel's width in radii, at the middle of a face: finer than this, a look's live
  // noise adds what the maps cannot hold.
  const float TEXEL = 2.0 / ${(look.faceSize ?? BAKE_FACE_SIZE).toFixed(1)};

  uniform float uAmbient;
  uniform float uIrradiance;
  uniform float uBaked;
  uniform vec3 uFallback;
  ${layers.map((i) => `uniform samplerCube uLayer${i};`).join('\n  ')}

  varying vec3 vPosition;
  varying vec3 vToCamera;
  varying vec3 vStar;

  ${NOISE_GLSL}
  ${HAZE_GLSL}
  ${RING_GLSL}

  ${layers.map((i) => `vec4 layer${i}(vec3 d) { return texture(uLayer${i}, d); }`).join('\n  ')}

  vec3 decodeAlbedo(vec3 stored) {
    return stored * stored;
  }

  struct Surface {
    /** Linear albedo of the ground. */
    vec3 albedo;
    /** The ground's normal: the sphere's, or bent by relief. */
    vec3 normal;
    /** Minnaert's exponent: 1 is Lambert, below it a cloud deck's flat, dark-limbed disc. */
    float minnaert;
    /** Specular reflectance at normal incidence and roughness, for water. 0 for none. */
    float specular;
    float roughness;
    /** Cloud over it: albedo and cover 0..1. */
    vec3 cloudAlbedo;
    float cloud;
  };

  /**
   * The normal bent by a relief \`height\` (radii times \`scale\`), from the height's screen
   * derivatives: the surface gradient, nearly free, and smooth because the height is a
   * filtered texture read rather than raw noise.
   */
  vec3 bumped(vec3 direction, float height, float scale) {
    vec3 dpdx = dFdx(direction);
    vec3 dpdy = dFdy(direction);
    vec3 r1 = cross(dpdy, direction);
    vec3 r2 = cross(direction, dpdx);
    float det = dot(dpdx, r1);
    vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
    return abs(det) < 1e-14 ? direction : normalize(abs(det) * direction - scale * gradient);
  }

  /**
   * How far the baked maps are magnified here: 0 while a pixel spans a texel or more, 1 from a
   * quarter of a texel in -- close views from low orbit, where a texel is many pixels wide.
   */
  float magnification(float footprint) {
    return smoothstep(TEXEL, 0.25 * TEXEL, footprint);
  }

  /**
   * The direction a magnified map is read at: swirled by about a texel with smooth noise. Blown
   * up, bilinear filtering draws a map's texel grid as soft squares; read through the swirl, the
   * same texels come out as flowing shapes, and live detail added on top has no grid to fight.
   */
  vec3 detailWarp(vec3 direction, float amount) {
    if (amount <= 0.0) return direction;
    // Two noises along the surface's own east and north: a swirl needs no third.
    vec3 p = direction * (0.45 / TEXEL);
    vec3 east = normalize(cross(abs(direction.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), direction));
    vec3 north = cross(direction, east);
    vec2 w = vec2(simplex(p + 3.1), simplex(p + 17.3));
    return normalize(direction + amount * 1.3 * TEXEL * (w.x * east + w.y * north));
  }

  ${look.glsl}

  /** GGX's distribution and Schlick's Fresnel: the sun's glint on open water. */
  float glint(vec3 n, vec3 toCamera, vec3 toStar, float f0, float roughness) {
    vec3 h = normalize(toCamera + toStar);
    float nh = max(dot(n, h), 0.0);
    float a2 = roughness * roughness * roughness * roughness;
    float d = a2 / (PI * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(h, toCamera), 0.0), 5.0);
    // Smith's visibility, the separable approximation; its 1/(4 n.l n.v) folded in.
    float k = 0.5 * roughness * roughness;
    float nl = max(dot(n, toStar), 0.0);
    float nv = max(dot(n, toCamera), 1e-3);
    float visibility = 1.0 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
    return d * fresnel * visibility * 0.25 * nl;
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 direction = normalize(vPosition);
    vec3 toCamera = normalize(vToCamera);
    vec3 toStar = normalize(vStar);
    // Radii a pixel spans across the surface, for detail octaves to stop at.
    float footprint = max(max(length(dFdx(direction)), length(dFdy(direction))), 1e-6);

    Surface s;
    if (uBaked > 0.5) {
      s = surface(direction, footprint, toCamera, toStar);
    } else {
      // Until the bake is in: the flat stand-in, as a real exoplanet is drawn.
      s = Surface(uFallback, direction, 1.0, 0.0, 1.0, vec3(0.0), 0.0);
    }

    float mu0 = dot(direction, toStar);
    float mu = max(dot(direction, toCamera), 0.0);
    float shade = max(dot(s.normal, toStar), 0.0);
    // Minnaert: mu0^k mu^(k-1), Lambert when k = 1.
    float lambert = s.minnaert >= 1.0
      ? shade
      : pow(shade, s.minnaert) * pow(max(mu, 0.02), s.minnaert - 1.0);

    // What reaches the ground: through the haze over it and the shadow of any ring.
    // Ground tilted toward the star past the terminator still catches light, a little; faded
    // out over a few degrees rather than cut, which drew a hard line of lit rims.
    vec3 sunlight = sunThroughHaze(mu0, 0.0) * ringTransmission(direction, toStar) * smoothstep(-0.08, 0.0, mu0);
    float direct = (1.0 - uAmbient) * uIrradiance;
    float ambient = uAmbient * uIrradiance;

    vec3 ground = s.albedo / PI * (direct * lambert * sunlight + ambient);
    if (s.specular > 0.0) {
      ground += direct * sunlight * glint(s.normal, toCamera, toStar, s.specular, s.roughness);
    }
    // Clouds sit on the sphere, lit as Lambert and unbent by the relief beneath.
    float cloudShade = max(mu0, 0.0);
    vec3 cloud = s.cloudAlbedo / PI * (direct * cloudShade * sunlight + ambient);
    vec3 radiance = mix(ground, cloud, s.cloud);

    // The haze between: what it takes from the ground on the way out and what it adds.
    vec3 depth = hazeExtinction();
    vec3 outward = exp(-depth * chapman(mu));
    float cosTheta = -dot(toCamera, toStar);
    float lit = max(mu0, 0.0);
    vec3 inScattered = direct / (4.0 * PI) * hazePhase(cosTheta) * hazeAlbedo()
      * (lit / (mu + lit + 1e-4))
      * (1.0 - exp(-depth * (chapman(mu) + chapman(mu0))))
      * smoothstep(-0.08, 0.04, mu0);
    radiance = radiance * outward + inScattered;

    gl_FragColor = vec4(radiance, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
}

/** The world shader's sources for a look, exported so a test can check what they include. */
export function worldShaderSources(look: SurfaceLook): { vertex: string; fragment: string; bake: string } {
  return { vertex: VERTEX_SHADER, fragment: fragmentShader(look), bake: `${TINT_GLSL}\n${look.bake}` };
}

/** The haze of a world: zenith optical depths and scale height in radii. */
export interface Haze {
  readonly rayleigh: readonly [number, number, number];
  readonly mie: number;
  readonly mieAsymmetry: number;
  readonly scaleHeight: number;
  /** Zenith absorption optical depth per channel; none when absent. */
  readonly absorption?: readonly [number, number, number];
}

/** What a world's material is made from: its look and the parameters every look shares. */
export interface WorldOptions {
  readonly surface: SurfaceLook;
  readonly world: WorldLook;
  /** How far toward the tint, 0..1, when one is given. */
  readonly tintWeight: number;
  readonly haze: Haze;
}

/**
 * A world's material, lit by its own star through exoplanetSurface.ts's protocol.
 *
 * One program per look, not per world: the seed, the tint, the haze and the rings are uniforms,
 * so every world of a palette shares the shader source three keys its programs by, and the
 * idle-time precompile (shaderPrecompile.ts) builds each look once. Its surface is baked the
 * first time it is drawn (surfaceBake.ts), from inside that draw; disposing the material
 * disposes the bake's maps.
 */
export function worldMaterial(options: WorldOptions): THREE.ShaderMaterial {
  const { surface, world, tintWeight, haze } = options;
  const starDirection = new THREE.Vector3(1, 0, 0);
  const ambient = { value: 0 };
  const sources = worldShaderSources(surface);

  const own: Record<string, THREE.IUniform> = {
    uSeedHash: { value: seedHash(world.seed) },
    uTint: { value: new THREE.Vector3(...(world.tint ?? [1, 1, 1])) },
    uTintWeight: { value: world.tint === undefined ? 0 : tintWeight },
    ...surface.uniforms(world),
  };
  const baked = { value: 0 };
  const bake = new SurfaceBake(
    {
      glsl: sources.bake,
      layers: surface.layers,
      halfFloat: surface.halfFloat === true,
      texelsPerFrame: surface.bakeTexelsPerFrame ?? BAKE_TEXELS_PER_FRAME,
    },
    own,
    () => {
      baked.value = 1;
    },
    surface.faceSize,
  );

  const material = new THREE.ShaderMaterial({
    vertexShader: sources.vertex,
    fragmentShader: sources.fragment,
    uniforms: {
      ...own,
      uStarDirection: { value: starDirection },
      uAmbient: ambient,
      uIrradiance: { value: WORLD_IRRADIANCE },
      uBaked: baked,
      uFallback: { value: new THREE.Vector3(...surface.fallback) },
      ...Object.fromEntries(bake.textures.map((texture, i) => [`uLayer${i}`, { value: texture }])),
      uRayleighDepth: { value: new THREE.Vector3(...haze.rayleigh) },
      uMieDepth: { value: haze.mie },
      uAbsorption: { value: new THREE.Vector3(...(haze.absorption ?? [0, 0, 0])) },
      uMieAsymmetry: { value: haze.mieAsymmetry },
      uScaleHeight: { value: haze.scaleHeight },
      ...ringUniformValues(world.seed, world.rings),
    },
  });
  material.userData['starDirection'] = starDirection;
  material.userData['ambient'] = ambient;
  material.onBeforeRender = (renderer) => {
    if (!bake.done) bake.step(renderer);
  };
  material.addEventListener('dispose', () => bake.dispose());
  return material;
}

/** The ring uniforms a world's shadow and its rings share. Inner and outer 0: no rings. */
export function ringUniformValues(
  seed: number,
  rings: { readonly inner: number; readonly outer: number } | undefined,
): Record<string, THREE.IUniform> {
  return {
    uRingRadii: { value: new THREE.Vector2(rings?.inner ?? 0, rings?.outer ?? 0) },
    uRingSeed: { value: (seedHash(seed ^ 0x5bd1e995) % 10007) / 10007 },
  };
}
