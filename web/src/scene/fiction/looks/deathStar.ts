import * as THREE from 'three';

import { LIGHTING } from '../../shading.ts';
import { gltfLoader, modelUrl } from '../../craftModels.ts';
import type { FictionObject } from '../fictionLooks.ts';
import type { Planetshine } from './shipMaterial.ts';

/**
 * The Death Stars (Star Wars; core/starWars.ts), drawn from two models given to the project by
 * their authors, friends of Maxi's (models-source/death-star*\/SOURCE.md):
 * - the first, SebastianSosnowski's "Death Star - Star Wars" (Sketchfab, CC BY-NC-ND 4.0), used as
 *   it is -- its geometry and materials unchanged, its 4096-pixel textures re-encoded as 2048-pixel
 *   WebP (a format change, models-source/death-star/build.mjs), 3.0 MB;
 * - the second, N8's "Death Star II" (Sketchfab, CC BY 4.0), half-built as in the film, its
 *   textures the same way at quality 70, 8.8 MB, and its darkest materials lifted (baseFloor).
 *
 * **Drawn with their own textures, lit by their own star.** The scene's one light is a point at the
 * Sun with no falloff (SolarSystem.tsx), right for the Solar System and wrong 480 million light
 * years away. So each of the model's materials becomes a small shader of ours reading the same
 * maps -- colour, normal (perturbed by screen-space derivatives: the files carry no tangents),
 * roughness and metal, the emissive city lights -- lit from the direction `update` is handed each
 * frame (the station's star, SolarSystem.tsx), with the lighting mode's ambient and its world's
 * light on its night side, as the Hail Mary's shader is (shipMaterial.ts).
 *
 * **Its axes.** Normalised to a diameter of 1 about its centre, turned so the superlaser dish
 * looks along +z: the scene points +z at what it aims at (core/hailMary.ts Station.pose).
 */

export type DeathStarDesign = 'death-star' | 'death-star-ii';

interface ModelFrame {
  readonly file: string;
  /** The sphere's centre in the file's units. */
  readonly centre: THREE.Vector3;
  /** Its diameter in the file's units. */
  readonly diameter: number;
  /** The dish's axis in the file's frame, from the centre: turned onto +z. */
  readonly dish: THREE.Vector3;
  /** How bright the city lights are, against the star's light on the day side. */
  readonly emissiveGain: number;
  /**
   * The least a material's base colour factor is drawn at, as a share: a factor f is drawn as
   * floor + (1 - floor) f. The second model's author darkened most of its parts to 0 to 0.17 over
   * one grey texture -- fine under a viewer's all-round light, black under one star. 0 keeps the
   * file's own.
   */
  readonly baseFloor: number;
}

const FRAMES: Readonly<Record<DeathStarDesign, ModelFrame>> = {
  // A sphere of radius 50 at the origin, its pole along +y; the dish (the mesh "misa", Polish for
  // "bowl") centred at (0.09, 16.93, 42.86): 21.5 degrees north, facing +z. Measured from the file.
  'death-star': {
    file: 'fiction/death-star.glb',
    centre: new THREE.Vector3(0, 0, 0),
    diameter: 100,
    dish: new THREE.Vector3(0, 16.93, 42.86).normalize(),
    emissiveGain: 0.6,
    // Used as it is (CC BY-NC-ND): every factor is already 1.
    baseFloor: 0,
  },
  // Bounds (-387.9, -375.0, -390.0) to (358.0, 371.9, 355.6), its equator at y = -1: the middle of
  // the box, and its widest extent. The dish: where the hull's vertices sit well inside the sphere
  // (0.6 to 0.92 of its radius) away from the poles' exposed column -- 50 to 80 degrees from +y,
  // about longitude 0: 30 degrees north, facing +x. Measured from the file.
  'death-star-ii': {
    file: 'fiction/death-star-ii.glb',
    centre: new THREE.Vector3(-14.9, -1.5, -17.2),
    diameter: 746,
    dish: new THREE.Vector3(Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0),
    emissiveGain: 0.6,
    // CC BY: adapted, and said so. The finished hull stays the lightest, the skeleton darker.
    baseFloor: 0.3,
  },
};

const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mvPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uRoughMetal;
  uniform sampler2D uEmissiveMap;
  uniform vec4 uBaseColor;
  uniform vec3 uEmissive;
  uniform vec4 uHas; // map, normal map, rough/metal map, emissive map
  uniform vec2 uRoughMetalFactor;
  uniform float uAlphaTest;
  uniform vec3 uLight;
  uniform float uIrradiance;
  uniform float uAmbient;
  uniform vec3 uFillDirection;
  uniform vec3 uFillColor;
  uniform float uFillIrradiance;
  uniform float uEmissiveGain;
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vNormal;

  // A tangent-space normal map applied without tangents (Mikkelsen 2010, as three's
  // perturbNormal2Arb): the frame from the derivatives of position and texture coordinates.
  vec3 perturb(vec3 position, vec3 normal, vec3 mapNormal, vec2 uv) {
    vec3 q0 = dFdx(position);
    vec3 q1 = dFdy(position);
    vec2 st0 = dFdx(uv);
    vec2 st1 = dFdy(uv);
    vec3 q1perp = cross(q1, normal);
    vec3 q0perp = cross(normal, q0);
    vec3 t = q1perp * st0.x + q0perp * st1.x;
    vec3 b = q1perp * st0.y + q0perp * st1.y;
    float det = max(dot(t, t), dot(b, b));
    float s = det == 0.0 ? 0.0 : inversesqrt(det);
    return normalize(t * (mapNormal.x * s) + b * (mapNormal.y * s) + normal * mapNormal.z);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec4 base = uBaseColor;
    if (uHas.x > 0.5) base *= texture2D(uMap, vUv);
    if (base.a < uAlphaTest) discard;
    vec3 albedo = base.rgb;

    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    if (uHas.y > 0.5) {
      vec3 mapNormal = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
      n = perturb(-vViewPosition, n, mapNormal, vUv);
    }
    float rough = uRoughMetalFactor.x;
    float metal = uRoughMetalFactor.y;
    if (uHas.z > 0.5) {
      vec4 rm = texture2D(uRoughMetal, vUv);
      rough *= rm.g;
      metal *= rm.b;
    }
    rough = clamp(rough, 0.05, 1.0);

    vec3 v = normalize(-vViewPosition);
    vec3 l = uLight;
    vec3 h = normalize(l + v);
    float nl = max(dot(n, l), 0.0);
    float nv = max(dot(n, v), 1e-3);
    float nh = max(dot(n, h), 0.0);
    float vh = max(dot(v, h), 0.0);
    vec3 f0 = mix(vec3(0.04), albedo, metal);
    vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
    float a = rough * rough;
    float a2 = a * a;
    float d = a2 / (PI * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
    float k = a * 0.5;
    float visibility = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
    vec3 diffuse = (1.0 - metal) * (1.0 - fresnel) * albedo / PI;
    vec3 radiance = (diffuse + d * visibility * fresnel) * uIrradiance * nl;

    // Its world's lit face on its night side, Lambert: broad and soft.
    if (uFillIrradiance > 0.0) {
      radiance += diffuse * uFillColor * uFillIrradiance * uIrradiance * max(dot(n, uFillDirection), 0.0);
    }
    // The lighting mode's ambient: none under Natural.
    radiance += (diffuse + metal * f0 / PI) * uAmbient;

    // The city lights, in their own colour: seen on the night side, lost in the day.
    vec3 emissive = uEmissive;
    if (uHas.w > 0.5) emissive *= texture2D(uEmissiveMap, vUv).rgb;
    radiance += emissive * uEmissiveGain * uIrradiance * 0.05;

    gl_FragColor = vec4(radiance, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One of the model's materials, as ours: its maps, lit by `update`. */
function stationMaterial(source: THREE.MeshStandardMaterial, emissiveGain: number, baseFloor: number): THREE.ShaderMaterial {
  const lift = (f: number): number => baseFloor + (1 - baseFloor) * f;
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: source.side,
    uniforms: {
      uMap: { value: source.map },
      uNormalMap: { value: source.normalMap },
      // glTF packs roughness in green and metalness in blue of one texture.
      uRoughMetal: { value: source.roughnessMap ?? source.metalnessMap },
      uEmissiveMap: { value: source.emissiveMap },
      uBaseColor: { value: new THREE.Vector4(lift(source.color.r), lift(source.color.g), lift(source.color.b), source.opacity) },
      uEmissive: { value: source.emissive.clone().multiplyScalar(source.emissiveIntensity) },
      uHas: {
        value: new THREE.Vector4(
          source.map === null ? 0 : 1,
          source.normalMap === null ? 0 : 1,
          source.roughnessMap === null && source.metalnessMap === null ? 0 : 1,
          source.emissiveMap === null ? 0 : 1,
        ),
      },
      uRoughMetalFactor: { value: new THREE.Vector2(source.roughness, source.metalness) },
      uAlphaTest: { value: source.alphaTest },
      uLight: { value: new THREE.Vector3(1, 0, 0) },
      uIrradiance: { value: LIGHTING.natural.sun },
      uAmbient: { value: LIGHTING.natural.ambient },
      uFillDirection: { value: new THREE.Vector3(0, -1, 0) },
      uFillColor: { value: new THREE.Color(1, 1, 1) },
      uFillIrradiance: { value: 0 },
      uEmissiveGain: { value: emissiveGain },
    },
  });
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color(1, 1, 1);

/** A Death Star: its model, fetched on the first update, a unit across with its dish along +z. */
export function createDeathStar(design: DeathStarDesign): FictionObject {
  const frame = FRAMES[design];
  const root = new THREE.Group();
  root.name = design;
  const materials: THREE.ShaderMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  let requested = false;
  let disposed = false;

  const fetchModel = (): void => {
    requested = true;
    gltfLoader()
      .then((loader) => loader.loadAsync(modelUrl(frame.file)))
      .then((gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // The file's centre to the origin, a unit across, the dish onto +z.
        const turn = new THREE.Quaternion().setFromUnitVectors(frame.dish, Z_AXIS);
        const holder = new THREE.Group();
        holder.quaternion.copy(turn);
        holder.scale.setScalar(1 / frame.diameter);
        model.position.copy(frame.centre).negate();
        holder.add(model);
        model.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          const source = mesh.material as THREE.MeshStandardMaterial;
          const material = stationMaterial(source, frame.emissiveGain, frame.baseFloor);
          materials.push(material);
          geometries.push(mesh.geometry);
          mesh.material = material;
          // Its parts are inside the sphere's bounds; the scene's culling is by the whole.
          mesh.frustumCulled = false;
        });
        root.add(holder);
      })
      .catch((error: unknown) => {
        console.error(`Could not load the ${design} model`, error);
      });
  };

  return {
    object: root,
    update(lightDirection: THREE.Vector3, camera: THREE.Camera, planetshine?: Planetshine, lighting = LIGHTING.natural) {
      if (!requested) fetchModel();
      for (const material of materials) {
        const u = material.uniforms;
        (u['uLight']!.value as THREE.Vector3).copy(lightDirection).transformDirection(camera.matrixWorldInverse);
        u['uIrradiance']!.value = lighting.sun;
        u['uAmbient']!.value = lighting.ambient;
        if (planetshine === undefined || planetshine.strength <= 0) {
          u['uFillIrradiance']!.value = 0;
        } else {
          (u['uFillDirection']!.value as THREE.Vector3).copy(planetshine.direction).transformDirection(camera.matrixWorldInverse);
          u['uFillIrradiance']!.value = planetshine.strength;
          (u['uFillColor']!.value as THREE.Color).copy(planetshine.color ?? WHITE);
        }
      }
    },
    dispose() {
      disposed = true;
      for (const material of materials) {
        for (const key of ['uMap', 'uNormalMap', 'uRoughMetal', 'uEmissiveMap']) {
          (material.uniforms[key]!.value as THREE.Texture | null)?.dispose();
        }
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
