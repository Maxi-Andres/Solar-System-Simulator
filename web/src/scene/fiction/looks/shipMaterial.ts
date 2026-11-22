import * as THREE from 'three';

import { LIGHTING } from '../../shading.ts';

/**
 * The one material every part of a fictional ship is drawn with: physically based shading
 * from its own star, the surface's metal, paint, foil and wear carried per vertex.
 *
 * **Why one material.** A ship of a few hundred parts drawn with a material per kind of surface
 * is a draw call and a program per kind, each compiled before it can be seen. Here the parts
 * are merged into a few meshes, and what each vertex is made of rides on the vertex: base
 * colour, metalness, roughness, brushing, glow, how its plates are laid out, its markings, how
 * much of the sky it sees. One program, one draw per mesh.
 *
 * **Why its own light.** The scene's one light is the Sun; a ship at tau Ceti is lit by tau
 * Ceti, as the exoplanets are (exoplanetSurface.ts). The light's direction is a uniform, set
 * each frame and turned into view space, where all the shading is done -- the ship's world
 * position is a number in a scene 1e23 km across, which float32 cannot hold to a metre.
 *
 * **Metal.** GGX microfacets with Smith masking and Schlick's Fresnel, anisotropic where the
 * metal is brushed (Burley's form): a brushed plate's highlight is a streak across the brushing,
 * and turning the view slides it from plate to plate, because the plates are brushed in
 * different directions. What a metal shows away from its highlight is what it reflects: here a
 * dark sky with a faint band of galaxy and, on the smoothest parts, its stars -- not a grey
 * ambient, which is what made bare metal read as grey plastic. Fresnel lifts that reflection
 * toward grazing angles, rough surfaces less (the "roughness-aware" Schlick of split-sum
 * lighting).
 *
 * **Plates are drawn, not modelled.** Each part's plates are laid out in the shader on its own
 * cylinder, around and along its axis in metres: rows of varied height, plates of varied width
 * staggered from row to row like brickwork, now and then one split in two or set in a different
 * temper, welds along some row joints. Seams and welds fade out where a pixel spans several,
 * so nothing shimmers.
 *
 * **Shadows and occlusion.** The star's shadow comes from a small shadow map of the ship alone
 * (hailMary.ts draws it only when the ship is large on screen and something has moved); how much
 * of the sky each vertex sees is worked out once, when the ship is built (shipOcclusion.ts), and
 * dims what it reflects and, a little, what it is lit by -- crevices, the gaps between the
 * tanks, under the faring.
 */

/** Markings, coded in a finish's plate size. */
export const MARKING = { hazard: -1, stencil: -2, foil: -3 } as const;

/** The characters a stencil can spell, in the order of their codes (0 is a space). */
export const STENCIL_CHARACTERS = ' 0123456789ABCEFHILMNORSTUY-';

/**
 * A 3 x 5 pixel font, rows top to bottom, three bits a row (4 = left), for the characters
 * above. Plain block capitals, as stencils are.
 */
const FONT: readonly number[][] = [
  [0, 0, 0, 0, 0], // space
  [7, 5, 5, 5, 7], // 0
  [2, 6, 2, 2, 7], // 1
  [7, 1, 7, 4, 7], // 2
  [7, 1, 7, 1, 7], // 3
  [5, 5, 7, 1, 1], // 4
  [7, 4, 7, 1, 7], // 5
  [7, 4, 7, 5, 7], // 6
  [7, 1, 1, 1, 1], // 7
  [7, 5, 7, 5, 7], // 8
  [7, 5, 7, 1, 7], // 9
  [2, 5, 7, 5, 5], // A
  [6, 5, 6, 5, 6], // B
  [7, 4, 4, 4, 7], // C
  [7, 4, 6, 4, 7], // E
  [7, 4, 6, 4, 4], // F
  [5, 5, 7, 5, 5], // H
  [7, 2, 2, 2, 7], // I
  [4, 4, 4, 4, 7], // L
  [5, 7, 7, 5, 5], // M
  [6, 5, 5, 5, 5], // N
  [7, 5, 5, 5, 7], // O
  [6, 5, 6, 5, 5], // R
  [7, 4, 7, 1, 7], // S
  [7, 2, 2, 2, 2], // T
  [5, 5, 5, 5, 7], // U
  [5, 5, 2, 2, 2], // Y
  [0, 0, 7, 0, 0], // -
];

/** The font as one integer per character, fifteen bits, for the shader. */
const FONT_BITS = FONT.map((rows) => rows.reduce((bits, row) => (bits << 3) | row, 0));

/** A label of up to eight characters as two floats of four six-bit codes each. */
export function encodeLabel(text: string): [number, number] {
  const codes = Array.from({ length: 8 }, (_, i) => Math.max(0, STENCIL_CHARACTERS.indexOf(text[i] ?? ' ')));
  const pack = (part: number[]): number => part.reduce((value, code) => value * 64 + code, 0);
  return [pack(codes.slice(0, 4)), pack(codes.slice(4, 8))];
}

const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute vec3 surface;
  attribute vec4 finish;
  attribute vec2 axis;
  attribute vec4 detail;
  attribute vec2 label;

  uniform mat4 uShadowView[3];
  uniform mat4 uShadowProjection;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vViewPosition;
  varying vec3 vSurface;
  varying vec4 vFinish;
  varying vec2 vAxis;
  varying vec4 vDetail;
  varying vec2 vUv;
  varying vec2 vLabel;
  varying vec3 vShadow;

  void main() {
    vLocal = position;
    vSurface = surface;
    vFinish = finish;
    vAxis = axis;
    vDetail = detail;
    vUv = uv;
    vLabel = label;
    vNormal = normalize(normalMatrix * normal);
    // Brushing runs round each part's own axis.
    vec2 relative = position.xy - axis;
    vec3 around = length(relative) > 1e-4 ? vec3(-relative.y, relative.x, 0.0) : vec3(1.0, 0.0, 0.0);
    vTangent = normalize(mat3(modelViewMatrix) * normalize(around));
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;

    // Where this point falls in the star's shadow map, pushed a few centimetres out along its
    // normal so a surface does not shadow itself.
    int section = int(detail.w + 0.5);
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
  uniform float uDriveGlow;
  uniform float uShadowOn;
  uniform sampler2D uShadowMap;
  uniform float uShadowTexel;
  uniform vec2 uShadowRange;
  uniform vec3 uGalaxyPole;
  uniform vec3 uFillDirection;
  uniform vec3 uFillColor;
  uniform float uFillIrradiance;
  uniform int uFont[${FONT_BITS.length}];

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vViewPosition;
  varying vec3 vSurface;
  varying vec4 vFinish;
  varying vec2 vAxis;
  varying vec4 vDetail;
  varying vec2 vUv;
  varying vec2 vLabel;
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

  /** 1 on a line \`width\` wide at 0 of \`d\`, antialiased by \`pixel\`, faded when sub-pixel. */
  float line(float d, float width, float pixel) {
    float shown = 1.0 - smoothstep(0.3, 1.0, pixel / max(width, 1e-5) * 0.25);
    return (1.0 - smoothstep(width, width + pixel, abs(d))) * shown + (1.0 - shown) * min(width / max(pixel, 1e-5), 1.0) * 0.5;
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

  /** Whether stencil pixel (column, row) of character \`code\` is painted. */
  float glyph(int code, int column, int row) {
    if (code <= 0 || column < 0 || column > 2 || row < 0 || row > 4) return 0.0;
    int bits = uFont[code];
    int shift = (4 - row) * 3 + (2 - column);
    return float((bits >> shift) & 1);
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

    vec2 relative = vLocal.xy - vAxis;
    float radius = max(length(relative), 0.3);
    // Metres round and along the part's own axis.
    vec2 surfaceMetres = vec2(atan(relative.y, relative.x) * radius, vLocal.z);
    vec2 pixelMetres = fwidth(surfaceMetres);

    if (pattern > 0.0) {
      // Rows of varied height: a row joint every 1.4 m, each kept or dropped by its hash.
      float rowPitch = 1.4 * pattern;
      float rowCoordinate = surfaceMetres.y / rowPitch;
      float row = floor(rowCoordinate);
      float rowFraction = rowCoordinate - row;
      // Now and then a row runs on into the one above it -- no joint between them -- so the
      // rows are not all one height; the merged pair is laid out as one row.
      float merged = step(hash2(vec2(row, 3.0)), 0.35);
      float rowSeamDistance = min(merged > 0.5 ? 1.0 : rowFraction, 1.0 - rowFraction) * rowPitch;
      float layoutRow = row - merged;
      // Plates in the row: varied width, the joints staggered from row to row.
      float plateWidth = rowPitch * mix(0.8, 1.7, hash2(vec2(layoutRow, 11.0)));
      float plateCoordinate = surfaceMetres.x / plateWidth + hash2(vec2(layoutRow, 5.0));
      float plate = floor(plateCoordinate);
      float plateFraction = plateCoordinate - plate;
      float plateSeamDistance = min(plateFraction, 1.0 - plateFraction) * plateWidth;
      // A few plates split once more.
      float split = step(0.8, hash2(vec2(plate, layoutRow + 41.0)));
      if (split > 0.5) plateSeamDistance = min(plateSeamDistance, abs(plateFraction - 0.5) * plateWidth);
      float seam = max(line(rowSeamDistance, 0.006, pixelMetres.y), line(plateSeamDistance, 0.006, pixelMetres.x));
      // Welds: a bead along every fourth row joint, wider and duller than a seam.
      float weld = step(hash2(vec2(row, 29.0)), 0.25) * line(rowSeamDistance, 0.02, pixelMetres.y);

      float temper = hash2(vec2(plate, layoutRow));
      float temper2 = hash2(vec2(plate + 13.0, layoutRow + 7.0));
      albedo *= 0.96 + 0.06 * temper;
      // One plate in twelve from another batch: a shade darker, duller.
      float odd = step(0.92, temper2);
      albedo *= mix(1.0, 0.86, odd);
      rough = clamp(rough + (temper2 - 0.5) * 0.12 + odd * 0.12, 0.05, 1.0);
      // Brushed round the axis, or along it on about a third of the plates.
      if (temper > 0.8) t = normalize(cross(n, t));
      albedo *= 1.0 - 0.5 * seam - 0.15 * weld;
      rough = mix(rough, 0.75, weld);
      aniso *= 1.0 - weld;
      occlusion *= 1.0 - 0.35 * seam;
    } else if (pattern < -2.5) {
      // Foil: crinkled, its normal wandering at a few centimetres and a few millimetres.
      vec2 p = surfaceMetres * vec2(9.0, 7.0);
      vec2 crinkle = vec2(valueNoise(p), valueNoise(p + 31.0)) + 0.5 * vec2(valueNoise(p * 4.1 + 7.0), valueNoise(p * 3.7 + 19.0));
      float shown = 1.0 - smoothstep(0.03, 0.12, max(pixelMetres.x, pixelMetres.y));
      vec3 b = cross(n, t);
      n = normalize(n + shown * 0.45 * ((crinkle.x - 0.75) * t + (crinkle.y - 0.75) * b));
      rough = clamp(rough + 0.15 * (crinkle.x - 0.75), 0.1, 1.0);
    } else if (pattern < -1.5) {
      // A stencil: up to eight characters across the decal's face, black paint.
      vec2 cell = vUv * vec2(8.0 * 4.0, 7.0);
      int index = int(floor(cell.x / 4.0));
      float packed = index < 4 ? vLabel.x : vLabel.y;
      int slot = index < 4 ? index : index - 4;
      int code = int(mod(floor(packed / pow(64.0, float(3 - slot))), 64.0));
      float painted = glyph(code, int(floor(mod(cell.x, 4.0))), int(floor(6.0 - cell.y)));
      albedo = mix(albedo, vec3(0.03), painted);
      metal = mix(metal, 0.0, painted);
      rough = mix(rough, 0.6, painted);
    } else if (pattern < -0.5) {
      // Hazard stripes: yellow and black paint, diagonal, 15 cm.
      float stripe = step(0.5, fract((surfaceMetres.x + surfaceMetres.y) / 0.3));
      albedo = mix(vec3(0.75, 0.5, 0.02), vec3(0.025), stripe);
      metal = 0.0;
      rough = 0.55;
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

    // The silhouette: grazing angles reflect the sky's faint band at nearly full Fresnel, so an
    // edge on the dark side still separates from black space.
    radiance += pow(1.0 - nv, 5.0) * sky(r, 1.0) * uIrradiance * 2.0 * occlusion;

    // Lights glow in their own colour; the drive plates' warmth (negative) is a dull red.
    radiance += glow > 0.0 ? albedo * glow : vec3(1.0, 0.22, 0.06) * (-glow * uDriveGlow);

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
      uDriveGlow: { value: 1 },
      uShadowOn: { value: 0 },
      uShadowMap: { value: null },
      uShadowTexel: { value: 1 / 1024 },
      uShadowRange: { value: new THREE.Vector2(0, 1) },
      uShadowView: { value: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()] },
      uShadowProjection: { value: new THREE.Matrix4() },
      // A galaxy across the sky, tilted: in view space, set with the light.
      uGalaxyPole: { value: new THREE.Vector3(0, 1, 0) },
      uFillDirection: { value: new THREE.Vector3(0, -1, 0) },
      uFillColor: { value: new THREE.Color(1, 1, 1) },
      uFillIrradiance: { value: 0 },
      uFont: { value: FONT_BITS },
    },
  });
}

const GALAXY_POLE = new THREE.Vector3(0.3, 0.85, 0.43).normalize();
const WHITE = new THREE.Color(1, 1, 1);

/** Points the material's light along world-space `toLight`, in `camera`'s view space. */
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

export function setShipLight(material: THREE.ShaderMaterial, toLight: THREE.Vector3, camera: THREE.Camera, planetshine?: Planetshine): void {
  (material.uniforms['uLight']!.value as THREE.Vector3).copy(toLight).transformDirection(camera.matrixWorldInverse);
  if (planetshine === undefined || planetshine.strength <= 0) {
    material.uniforms['uFillIrradiance']!.value = 0;
  } else {
    (material.uniforms['uFillDirection']!.value as THREE.Vector3).copy(planetshine.direction).transformDirection(camera.matrixWorldInverse);
    material.uniforms['uFillIrradiance']!.value = planetshine.strength;
    (material.uniforms['uFillColor']!.value as THREE.Color).copy(planetshine.color ?? WHITE);
  }
  (material.uniforms['uGalaxyPole']!.value as THREE.Vector3).copy(GALAXY_POLE).transformDirection(camera.matrixWorldInverse);
}

/** What a part is made of. */
export interface Finish {
  /** Base colour, linear. */
  readonly color: readonly [number, number, number];
  readonly metal: number;
  readonly rough: number;
  /** Radiance of a light (positive), or of the drive plates' heat at full drive (negative). */
  readonly glow?: number;
  /** Plate size as a factor of the default; or a MARKING code; 0 or absent for neither. */
  readonly plates?: number;
  /** Brushing, 0 to 1: how much narrower the highlight is across it than along. */
  readonly aniso?: number;
  /** A fixed occlusion for small recessed parts the sky-visibility pass does not resolve. */
  readonly cavity?: number;
}

/** Options for a part beyond its finish. */
export interface PartOptions {
  /** The axis its plates and brushing run round, (x, y) in metres. */
  readonly axis?: readonly [number, number];
  /** Whether the part takes part in the sky-visibility pass (large surfaces); default true. */
  readonly occluded?: boolean;
  /** A stencil's text. */
  readonly label?: string;
}

/**
 * Builds merged geometry from parts, each with its finish. Everything is made non-indexed and
 * concatenated: one geometry, one draw. `section` says which of the ship's moving parts it is,
 * for the shadow map's per-section transforms.
 */
export class PartBuilder {
  #positions: number[] = [];
  #normals: number[] = [];
  #uvs: number[] = [];
  #surface: number[] = [];
  #finish: number[] = [];
  #axis: number[] = [];
  #detail: number[] = [];
  #label: number[] = [];
  /** Vertex ranges, [start, end), that the sky-visibility pass computes. */
  readonly occludedRanges: [number, number][] = [];
  readonly #normalMatrix = new THREE.Matrix3();
  readonly #v = new THREE.Vector3();

  constructor(readonly section: number) {}

  /** Adds `geometry` placed by `matrix`. */
  add(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, finish: Finish, options: PartOptions = {}): void {
    const flat = geometry.index === null ? geometry : geometry.toNonIndexed();
    const position = flat.getAttribute('position');
    const normal = flat.getAttribute('normal');
    const uv = flat.getAttribute('uv');
    const axis = options.axis ?? [0, 0];
    const label: [number, number] = options.label === undefined ? [0, 0] : encodeLabel(options.label);
    this.#normalMatrix.getNormalMatrix(matrix);
    const start = this.#positions.length / 3;
    const metal = finish.metal;
    const rough = finish.rough;
    const glow = finish.glow ?? 0;
    const plates = finish.plates ?? 0;
    const cavity = finish.cavity ?? 1;
    const aniso = finish.aniso ?? 0;
    for (let i = 0; i < position.count; i += 1) {
      this.#v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.#positions.push(this.#v.x, this.#v.y, this.#v.z);
      this.#v.fromBufferAttribute(normal, i).applyMatrix3(this.#normalMatrix).normalize();
      this.#normals.push(this.#v.x, this.#v.y, this.#v.z);
      this.#uvs.push(uv === undefined ? 0 : uv.getX(i), uv === undefined ? 0 : uv.getY(i));
      this.#surface.push(finish.color[0], finish.color[1], finish.color[2]);
      this.#finish.push(metal, rough, glow, plates);
      this.#axis.push(axis[0], axis[1]);
      this.#detail.push(1, cavity, aniso, this.section);
      this.#label.push(label[0], label[1]);
    }
    if (options.occluded !== false) this.occludedRanges.push([start, this.#positions.length / 3]);
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  }

  get triangles(): number {
    return this.#positions.length / 9;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.#positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.#normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.#uvs, 2));
    geometry.setAttribute('surface', new THREE.Float32BufferAttribute(this.#surface, 3));
    geometry.setAttribute('finish', new THREE.Float32BufferAttribute(this.#finish, 4));
    geometry.setAttribute('axis', new THREE.Float32BufferAttribute(this.#axis, 2));
    geometry.setAttribute('detail', new THREE.Float32BufferAttribute(this.#detail, 4));
    geometry.setAttribute('label', new THREE.Float32BufferAttribute(this.#label, 2));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
