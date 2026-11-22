import * as THREE from 'three';

import { LIGHTING } from '../../shading.ts';

/**
 * The material a fictional ship's model is drawn with: physically based shading from its own
 * star, each vertex pointing into a small table of finishes.
 *
 * **Why one material.** The model brings eighteen materials; drawn as they are, that is a draw
 * call and a program per material, each lit by the scene's Sun. Here the model's meshes are
 * merged into a few, and each vertex carries only its position, normal, how much of the sky it
 * sees, which finish it is painted with and which section of the ship it belongs to. The
 * finishes themselves -- base colour, metalness, roughness, brushing, glow, wear -- sit in
 * uniform arrays (setShipFinishes). One program, one draw per section, 24 bytes a vertex.
 *
 * **Why its own light.** The scene's one light is the Sun; a ship at tau Ceti is lit by tau
 * Ceti, as the exoplanets are (exoplanetSurface.ts). The light's direction is a uniform, set
 * each frame and turned into view space, where all the shading is done -- the ship's world
 * position is a number in a scene 1e23 km across, which float32 cannot hold to a metre.
 *
 * **Metal.** GGX microfacets with Smith masking and Schlick's Fresnel, anisotropic where the
 * metal is brushed (Burley's form). What a metal shows away from its highlight is what it
 * reflects: here a dark sky with a faint band of galaxy and, on the smoothest parts, its stars --
 * not a grey ambient, which is what makes bare metal read as grey plastic. Fresnel lifts that
 * reflection toward grazing angles, rough surfaces less.
 *
 * **Shadows and occlusion.** The star's shadow comes from a small shadow map of the ship alone
 * (hailMary.ts draws it only when the ship is large on screen and something has moved); how much
 * of the sky each vertex sees was baked into the model file, and dims what it reflects and, a
 * little, what it is lit by.
 */

/** Surface patterns drawn in the shader, coded in a finish's fourth component. */
export const MARKING = { foil: -3, weathered: -5, mottled: -6 } as const;

/** A finish: base colour (linear), metalness, roughness, and the optional rest. */
export interface ShipFinish {
  readonly color: readonly [number, number, number];
  readonly metal: number;
  readonly rough: number;
  /** A MARKING code; absent for plain. */
  readonly pattern?: number;
  /** Brushing, 0 to 1: how much narrower the highlight is across it than along. */
  readonly aniso?: number;
  /** Radiance of a lamp, in its own colour. */
  readonly glow?: number;
}

/** How many finishes the table holds. */
export const SHIP_FINISH_SLOTS = 24;

const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  // x: sky visibility; y: finish index / 255; z: section / 255 (eight bits, normalised).
  attribute vec4 detail;

  uniform vec3 uSurface[${SHIP_FINISH_SLOTS}];
  uniform vec4 uFinish[${SHIP_FINISH_SLOTS}];
  uniform float uAniso[${SHIP_FINISH_SLOTS}];
  uniform mat4 uShadowView[3];
  uniform mat4 uShadowProjection;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vViewPosition;
  varying vec3 vSurface;
  varying vec4 vFinish;
  varying vec4 vDetail;
  varying vec3 vShadow;

  void main() {
    int finish = int(detail.y * 255.0 + 0.5);
    int section = int(detail.z * 255.0 + 0.5);
    vLocal = position;
    vSurface = uSurface[finish];
    vFinish = uFinish[finish];
    vDetail = vec4(detail.x, 1.0, uAniso[finish], float(section));
    vNormal = normalize(normalMatrix * normal);
    // Brushing runs round the ship's long axis.
    vec2 relative = position.xy;
    vec3 around = length(relative) > 1e-4 ? vec3(-relative.y, relative.x, 0.0) : vec3(1.0, 0.0, 0.0);
    vTangent = normalize(mat3(modelViewMatrix) * normalize(around));
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;

    // Where this point falls in the star's shadow map, pushed a few centimetres out along its
    // normal so a surface does not shadow itself.
    vec4 lightView = uShadowView[section] * vec4(position + normal * 0.05, 1.0);
    vec4 lightClip = uShadowProjection * lightView;
    vShadow = vec3(lightClip.xy * 0.5 + 0.5, -lightView.z);

    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <packing>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uLight;
  uniform float uIrradiance;
  uniform float uShadowOn;
  uniform sampler2D uShadowMap;
  uniform float uShadowTexel;
  uniform vec2 uShadowRange;
  uniform vec3 uGalaxyPole;
  uniform float uAmbient;
  uniform vec3 uFillDirection;
  uniform vec3 uFillColor;
  uniform float uFillIrradiance;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vViewPosition;
  varying vec3 vSurface;
  varying vec4 vFinish;
  varying vec4 vDetail;
  varying vec3 vShadow;

  // The broad lobe's share of a bare metal's reflection.
  const float HAZE = 0.35;

  float hash2(vec2 cell) {
    uvec2 c = uvec2(ivec2(floor(cell)) + 32768);
    uint h = c.x * 73856093u ^ c.y * 19349663u;
    h ^= h >> 16u;
    h *= 0x7feb352du;
    h ^= h >> 15u;
    h *= 0x846ca68bu;
    h ^= h >> 16u;
    return float(h) / 4294967295.0;
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  /** The star, a dark sky and a faint galaxy, as a surface of roughness \`rough\` reflects them. */
  vec3 sky(vec3 r, float rough) {
    float band = exp(-pow(dot(r, uGalaxyPole), 2.0) / 0.04);
    vec3 galaxy = vec3(0.9, 0.85, 0.8) * (0.002 + 0.008 * band);
    // Stars only in what is near a mirror; rougher metal sees their average, already above.
    float smooth_ = 1.0 - smoothstep(0.08, 0.22, rough);
    if (smooth_ > 0.0) {
      vec2 cell = vec2(atan(r.z, r.x), asin(clamp(r.y, -1.0, 1.0))) * 120.0;
      float star = step(0.996, hash2(cell)) * hash2(cell + 7.0);
      galaxy += smooth_ * star * 0.4;
    }
    return galaxy;
  }

  /** Lit share of this point in the star's shadow map: four taps, blended bilinearly. */
  float sunlit() {
    if (uShadowOn < 0.5) return 1.0;
    vec2 uv = vShadow.xy;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
    vec2 texel = uv / uShadowTexel - 0.5;
    vec2 base = floor(texel);
    vec2 f = texel - base;
    float depth = vShadow.z - 0.08;
    float span = uShadowRange.y - uShadowRange.x;
    float lit00 = step(depth, uShadowRange.x + span * unpackRGBAToDepth(texture2D(uShadowMap, (base + vec2(0.5, 0.5)) * uShadowTexel)));
    float lit10 = step(depth, uShadowRange.x + span * unpackRGBAToDepth(texture2D(uShadowMap, (base + vec2(1.5, 0.5)) * uShadowTexel)));
    float lit01 = step(depth, uShadowRange.x + span * unpackRGBAToDepth(texture2D(uShadowMap, (base + vec2(0.5, 1.5)) * uShadowTexel)));
    float lit11 = step(depth, uShadowRange.x + span * unpackRGBAToDepth(texture2D(uShadowMap, (base + vec2(1.5, 1.5)) * uShadowTexel)));
    return mix(mix(lit00, lit10, f.x), mix(lit01, lit11, f.x), f.y);
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 albedo = vSurface;
    float metal = vFinish.x;
    float rough = vFinish.y;
    float glow = vFinish.z;
    float pattern = vFinish.w;
    float occlusion = vDetail.x * vDetail.y;
    float aniso = vDetail.z;
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 t = normalize(vTangent - n * dot(vTangent, n));

    vec2 relative = vLocal.xy;
    float radius = max(length(relative), 0.3);
    // Metres round and along the long axis: where wear and foil are laid out.
    vec2 surfaceMetres = vec2(atan(relative.y, relative.x) * radius, vLocal.z);
    vec2 pixelMetres = fwidth(surfaceMetres);

    if (pattern < -5.5) {
      // Mottled: two tones in broad, soft swirls, like paint stirred and left half mixed -- the
      // Blip-A's xenonite. Laid out in the hull's own metres on two slanted planes, so flat
      // panels facing any way all carry it.
      vec2 a = vLocal.xy * 0.09 + vLocal.z * vec2(0.05, -0.07);
      vec2 b = vLocal.yz * 0.07 + vLocal.x * vec2(-0.06, 0.04) + 17.0;
      vec2 swirl = vec2(valueNoise(a * 1.7 + 3.0), valueNoise(b * 1.7 + 9.0)) * 2.4;
      float mix1 = valueNoise(a + swirl) * 0.6 + valueNoise(b - swirl) * 0.4;
      float tone = smoothstep(0.38, 0.62, mix1 + 0.12 * (valueNoise(a * 6.0) - 0.5));
      albedo = mix(albedo, vec3(0.34, 0.27, 0.18), tone);
    } else if (pattern < -4.5) {
      // Weathered paint: faint grime in broad, soft patches, faded out where a pixel spans them.
      float grime = valueNoise(surfaceMetres * vec2(0.45, 0.3)) * valueNoise(surfaceMetres * vec2(1.9, 1.3) + 5.0);
      float grimeShown = 1.0 - smoothstep(0.2, 0.8, max(pixelMetres.x, pixelMetres.y));
      albedo *= 1.0 - (1.0 - metal) * grimeShown * 0.13 * grime;
    } else if (pattern < -2.5) {
      // Foil: crinkled, its normal wandering at a few centimetres and a few millimetres.
      vec2 p = surfaceMetres * vec2(9.0, 7.0);
      vec2 crinkle = vec2(valueNoise(p), valueNoise(p + 31.0)) + 0.5 * vec2(valueNoise(p * 4.1 + 7.0), valueNoise(p * 3.7 + 19.0));
      float shown = 1.0 - smoothstep(0.03, 0.12, max(pixelMetres.x, pixelMetres.y));
      vec3 b = cross(n, t);
      n = normalize(n + shown * 0.45 * ((crinkle.x - 0.75) * t + (crinkle.y - 0.75) * b));
      rough = clamp(rough + 0.15 * (crinkle.x - 0.75), 0.1, 1.0);
    }

    vec3 v = normalize(-vViewPosition);
    vec3 l = uLight;
    vec3 h = normalize(l + v);
    float nl = max(dot(n, l), 0.0);
    float nv = max(dot(n, v), 1e-3);
    float nh = max(dot(n, h), 0.0);
    float vh = max(dot(v, h), 0.0);

    vec3 f0 = mix(vec3(0.04), albedo, metal);
    vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
    // Anisotropic GGX (Burley 2012): narrower across the brushing.
    float a = max(rough * rough, 0.002);
    float ax = max(a * (1.0 + aniso), 0.002);
    float ay = max(a * (1.0 - 0.8 * aniso), 0.002);
    vec3 b = cross(n, t);
    float th = dot(t, h) / ax;
    float bh = dot(b, h) / ay;
    float d = 1.0 / (PI * ax * ay * pow(th * th + bh * bh + nh * nh, 2.0));
    float k = a * 0.5;
    float visibility = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
    // A second, broad lobe on metal: the haze of a worked surface -- rolling, brushing, the
    // oxide -- that scatters part of the light widely (Barla et al.'s "specular haze"). Without
    // it bare aluminium lit from the side reads black but for a streak; with it every plate
    // facing the star carries a soft sheen, as in flight photographs.
    float hazeShare = HAZE * metal;
    float ha = 0.6;
    float ha2 = ha * ha;
    float dHaze = ha2 / (PI * pow(nh * nh * (ha2 - 1.0) + 1.0, 2.0));
    float kHaze = ha * 0.5;
    float visibilityHaze = 0.25 / ((nl * (1.0 - kHaze) + kHaze) * (nv * (1.0 - kHaze) + kHaze));
    vec3 specular = (d * visibility * (1.0 - hazeShare) + dHaze * visibilityHaze * hazeShare) * fresnel;
    vec3 diffuse = (1.0 - metal) * (1.0 - fresnel) * albedo / PI;
    // Occlusion takes a little of the direct light too -- crevices are darker than the sky
    // they would see -- and the shadow map the rest.
    float shadow = sunlit();
    vec3 radiance = (diffuse + specular) * uIrradiance * nl * shadow * mix(1.0, occlusion, 0.35);

    // What the surface reflects of the sky: Fresnel by roughness, dimmed by occlusion.
    vec3 r = reflect(-v, n);
    vec3 fresnelSky = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - nv, 5.0);
    vec3 reflected = mix(sky(r, rough), sky(r, 1.0), hazeShare);
    radiance += (fresnelSky * reflected + diffuse * sky(n, 1.0) * PI) * uIrradiance * occlusion;

    // Planetshine: a nearby world's lit face, a broad source, as Lambert for the diffuse share
    // and through the broad lobe for the metal. Unshadowed: it is wide and soft.
    if (uFillIrradiance > 0.0) {
      float nlFill = max(dot(n, uFillDirection), 0.0);
      vec3 hFill = normalize(uFillDirection + v);
      float nhFill = max(dot(n, hFill), 0.0);
      float dFill = ha2 / (PI * pow(nhFill * nhFill * (ha2 - 1.0) + 1.0, 2.0));
      vec3 fill = diffuse + f0 * dFill * 0.25 / max(nv, 0.2);
      radiance += fill * uFillColor * uFillIrradiance * uIrradiance * nlFill * mix(0.4, 1.0, occlusion);
    }

    // The lighting mode's ambient (shading.ts LIGHTING): none under Natural; under Flood and
    // Shadow the same even light the Solar System's bodies get, so the ship is seen from any side.
    radiance += (diffuse + metal * f0 / PI) * uAmbient * occlusion;

    // The silhouette: grazing angles reflect the sky's faint band at nearly full Fresnel, so an
    // edge on the dark side still separates from black space.
    radiance += pow(1.0 - nv, 5.0) * sky(r, 1.0) * uIrradiance * 2.0 * occlusion;

    // Lamps glow in their own colour.
    radiance += albedo * glow;

    gl_FragColor = vec4(radiance, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The ship shader's sources, exported so a test can check what they include. */
export const SHIP_SHADERS = { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER } as const;

/** The material, its light set by `setShipLight` each frame. */
export function shipMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uLight: { value: new THREE.Vector3(1, 0, 0) },
      uIrradiance: { value: LIGHTING.natural.sun },
      uShadowOn: { value: 0 },
      uShadowMap: { value: null },
      uShadowTexel: { value: 1 / 1024 },
      uShadowRange: { value: new THREE.Vector2(0, 1) },
      uShadowView: { value: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()] },
      uShadowProjection: { value: new THREE.Matrix4() },
      // A galaxy across the sky, tilted: in view space, set with the light.
      uGalaxyPole: { value: new THREE.Vector3(0, 1, 0) },
      uAmbient: { value: LIGHTING.natural.ambient },
      uFillDirection: { value: new THREE.Vector3(0, -1, 0) },
      uFillColor: { value: new THREE.Color(1, 1, 1) },
      uFillIrradiance: { value: 0 },
      uSurface: { value: Array.from({ length: SHIP_FINISH_SLOTS }, () => new THREE.Vector3(0.5, 0.5, 0.5)) },
      uFinish: { value: Array.from({ length: SHIP_FINISH_SLOTS }, () => new THREE.Vector4(0, 0.6, 0, 0)) },
      uAniso: { value: new Array<number>(SHIP_FINISH_SLOTS).fill(0) },
    },
  });
}

const GALAXY_POLE = new THREE.Vector3(0.3, 0.85, 0.43).normalize();
const WHITE = new THREE.Color(1, 1, 1);

/**
 * Light from a nearby world on a ship: the direction to the world (world space), its strength as
 * a share of the star's irradiance (`planetshineStrength`), and its colour.
 */
export interface Planetshine {
  readonly direction: THREE.Vector3;
  readonly strength: number;
  readonly color?: THREE.Color;
}

/**
 * The irradiance a world's lit face sends a nearby ship, as a share of the star's at the ship.
 *
 * A Lambertian sphere of Bond albedo `albedo`, filling `angularRadius` (radians) of the sky
 * and `litFraction` lit as the ship sees it (0 new, 1 full), gives about
 * albedo * litFraction * sin^2(angularRadius): its radiance, albedo * E / pi, times the solid
 * angle it fills, projected (pi sin^2 for a disc face-on), times the share of it that is lit.
 * Adrian from a low orbit, filling half the sky, half lit, albedo 0.5: about 0.2 of the star's
 * light -- why a ship's night side over a bright world is not black.
 */
export function planetshineStrength(albedo: number, litFraction: number, angularRadius: number): number {
  const sine = Math.sin(Math.min(Math.max(angularRadius, 0), Math.PI / 2));
  return albedo * Math.min(Math.max(litFraction, 0), 1) * sine * sine;
}

/** Points the material's light along world-space `toLight`, in `camera`'s view space, with the lighting mode's star and ambient. */
export function setShipLight(
  material: THREE.ShaderMaterial,
  toLight: THREE.Vector3,
  camera: THREE.Camera,
  planetshine?: Planetshine,
  lighting: { readonly sun: number; readonly ambient: number } = LIGHTING.natural,
): void {
  (material.uniforms['uLight']!.value as THREE.Vector3).copy(toLight).transformDirection(camera.matrixWorldInverse);
  material.uniforms['uIrradiance']!.value = lighting.sun;
  material.uniforms['uAmbient']!.value = lighting.ambient;
  if (planetshine === undefined || planetshine.strength <= 0) {
    material.uniforms['uFillIrradiance']!.value = 0;
  } else {
    (material.uniforms['uFillDirection']!.value as THREE.Vector3).copy(planetshine.direction).transformDirection(camera.matrixWorldInverse);
    material.uniforms['uFillIrradiance']!.value = planetshine.strength;
    (material.uniforms['uFillColor']!.value as THREE.Color).copy(planetshine.color ?? WHITE);
  }
  (material.uniforms['uGalaxyPole']!.value as THREE.Vector3).copy(GALAXY_POLE).transformDirection(camera.matrixWorldInverse);
}

/** Fills the material's table of finishes: a vertex of finish index i is painted with `finishes[i]`. */
export function setShipFinishes(material: THREE.ShaderMaterial, finishes: readonly ShipFinish[]): void {
  if (finishes.length > SHIP_FINISH_SLOTS) throw new Error(`a ship has at most ${SHIP_FINISH_SLOTS} finishes`);
  const surface = material.uniforms['uSurface']!.value as THREE.Vector3[];
  const finish = material.uniforms['uFinish']!.value as THREE.Vector4[];
  const aniso = material.uniforms['uAniso']!.value as number[];
  finishes.forEach((look, i) => {
    surface[i]!.set(look.color[0], look.color[1], look.color[2]);
    finish[i]!.set(look.metal, look.rough, look.glow ?? 0, look.pattern ?? 0);
    aniso[i] = look.aniso ?? 0;
  });
}
