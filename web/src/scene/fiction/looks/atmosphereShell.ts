import * as THREE from 'three';

import { sphereGeometry } from '../../sphereGeometry.ts';
import { HAZE_GLSL } from './worldShader.ts';

/**
 * The haze past a fictional world's limb: the same air its surface shader hazes the disc with
 * (worldShader.ts), seen edge-on against the sky.
 *
 * A ray that misses the world passes the surface at a height `z` above it, and the air it
 * crosses is, in closed form, the tangent column `tau exp(-z / H) sqrt(2 pi / H)` (radii). It
 * scatters as much of the star's light toward the camera as that column takes from the
 * background, lit by what is left of the star's light at the tangent point -- reddened when
 * the star is low there, and nothing where the world's own shadow covers the point. One
 * evaluation a pixel, no march.
 *
 * **Drawn on as little as covers it.** The first version was a shell around the world, drawn
 * on its far side; with the world filling the screen that is every pixel of the disc, behind
 * the world and depth-tested away only after the shader had run -- the logarithmic depth is
 * written by the fragment shader, so the GPU cannot reject anything early. It cost 1.1 ms of
 * the 2.8 the world took on an integrated GPU. From outside the air the halo is now a flat
 * annulus facing the camera, in the plane of the limb, from just inside the limb to the top of
 * the air: its vertices are placed where rays of the right impact parameter cross that plane,
 * so it covers the halo and nothing else. The shell stays for a camera inside the air, where
 * the sky is everywhere; each mesh collapses itself in its vertex shader when the other one is
 * the one to draw, so neither needs updating from outside.
 *
 * The fragment shader is the same for both: it works from the ray through the pixel and any
 * point on it, so where the surface it is drawn on lies does not matter.
 */

/** How far the air is drawn above the surface, in scale heights: e^-12 of it is left there. */
const SHELL_SCALE_HEIGHTS = 12;

/** Segments around the annulus: a 256-gon's sides cut inside its circle by 7.5e-5. */
const ANNULUS_SEGMENTS = 256;

/** Where the annulus starts, impact parameter in radii: inside the limb, over the sliver
 * between the world's polygonal outline and its true circle. */
const ANNULUS_INNER = 0.985;

/** The camera's place in the object's frame, radii, from the model-view matrix alone. */
const CAMERA_LOCAL_GLSL = /* glsl */ `
  vec3 cameraLocal() {
    mat3 m = mat3(modelViewMatrix);
    return -(transpose(m) * modelViewMatrix[3].xyz) / dot(m[0], m[0]);
  }
`;

/** Past this distance from the centre, in shell radii, the annulus draws the halo. */
const OUTSIDE = '1.02';

const ANNULUS_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform vec3 uStarDirection;
  uniform float uShellRadius;

  varying vec3 vPosition;
  varying vec3 vToCamera;
  varying vec3 vStar;
  varying vec3 vCamera;

  ${CAMERA_LOCAL_GLSL}

  void main() {
    vec3 camera = cameraLocal();
    vCamera = camera;
    float distance = length(camera);
    // position: x, y around the circle; z 0 on the inner edge and 1 on the outer.
    float b = mix(${ANNULUS_INNER}, uShellRadius, position.z);
    if (distance <= uShellRadius * ${OUTSIDE}) {
      // Inside the air, or nearly: the shell draws the sky.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    } else {
      vec3 axis = camera / distance;
      vec3 u = normalize(cross(abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), axis));
      vec3 v = cross(axis, u);
      // The limb's plane is 1 / D from the centre toward the camera; a ray of impact parameter
      // b crosses it at (D - 1/D) tan(asin(b / D)) from the axis.
      float rho = (distance - 1.0 / distance) * b / sqrt(distance * distance - b * b);
      vec3 p = axis / distance + (u * position.x + v * position.y) * rho;
      vPosition = p;
      vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
      vToCamera = transpose(mat3(modelViewMatrix)) * (-viewPosition.xyz);
      vStar = transpose(mat3(modelMatrix)) * uStarDirection;
      gl_Position = projectionMatrix * viewPosition;
    }
    #include <logdepthbuf_vertex>
  }
`;

const SHELL_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform vec3 uStarDirection;
  uniform float uShellRadius;

  varying vec3 vPosition;
  varying vec3 vToCamera;
  varying vec3 vStar;
  varying vec3 vCamera;

  ${CAMERA_LOCAL_GLSL}

  void main() {
    vCamera = cameraLocal();
    if (length(vCamera) > uShellRadius * ${OUTSIDE}) {
      // Outside the air: the annulus draws the halo.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    } else {
      vPosition = position;
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      vToCamera = transpose(mat3(modelViewMatrix)) * (-viewPosition.xyz);
      vStar = transpose(mat3(modelMatrix)) * uStarDirection;
      gl_Position = projectionMatrix * viewPosition;
    }
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform float uAmbient;
  uniform float uIrradiance;
  uniform float uShellRadius;

  varying vec3 vPosition;
  varying vec3 vToCamera;
  varying vec3 vStar;
  varying vec3 vCamera;

  ${HAZE_GLSL}

  void main() {
    #include <logdepthbuf_fragment>

    vec3 ray = -normalize(vToCamera);
    vec3 toStar = normalize(vStar);
    // The ray's closest approach to the centre.
    vec3 closest = vPosition - dot(vPosition, ray) * ray;
    float b = length(closest);
    float z = max(b - 1.0, 0.0);
    vec3 up = closest / max(b, 1e-6);

    vec3 column;
    if (length(vCamera) > uShellRadius * ${OUTSIDE}) {
      // From outside, the ray crosses all the air about its tangent point: the whole column.
      column = hazeExtinction() * exp(-z / uScaleHeight) * sqrt(2.0 * PI / uScaleHeight);
    } else {
      // From inside, only the air ahead of the camera: from its height, toward the ray's angle
      // above its horizon, the Chapman function the surface's light uses. The whole line's
      // column counted the air behind the camera too -- straight up from the top of the air,
      // the line through the planet, and the sky there as opaque as the limb.
      float height = length(vCamera);
      vec3 cameraUp = vCamera / height;
      float mu = dot(ray, cameraUp);
      column = hazeExtinction() * exp(-max(height - 1.0, 0.0) / uScaleHeight) * chapman(mu);
      if (mu >= 0.0) {
        // Climbing, the ray's air is all near the camera, and is lit there.
        z = max(height - 1.0, 0.0);
        up = cameraUp;
      }
    }
    float muSun = dot(up, toStar);
    // Where the light reaching the camera was scattered: on an opaque tangent path, not at the
    // tangent point but where the path's depth from the camera's side reaches about one -- a few
    // scale heights higher, where the star's light has come through far less air. Lit at the
    // tangent point instead, the halo's foot went dark against the disc's bright limb.
    float columnLuminance = dot(column, vec3(0.2126, 0.7152, 0.0722));
    float zSun = z + uScaleHeight * log(max(0.5 * columnLuminance, 1.0));
    // The world's shadow: the star is below the horizon of a point at z by sqrt(2z), about.
    float dip = sqrt(2.0 * zSun);
    float lit = smoothstep(-dip - 0.02, -dip + 0.02, muSun);
    vec3 sunlight = sunThroughHaze(muSun, zSun) * lit;

    float direct = (1.0 - uAmbient) * uIrradiance;
    vec3 transmitted = exp(-column);
    vec3 radiance = direct / (4.0 * PI) * hazePhase(dot(ray, toStar)) * hazeAlbedo() * (1.0 - transmitted) * sunlight;
    float opacity = 1.0 - dot(transmitted, vec3(0.2126, 0.7152, 0.0722));

    gl_FragColor = vec4(radiance, opacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The halo's shader sources, exported so a test can check what they include. */
export const SHELL_SHADERS = {
  vertex: SHELL_VERTEX,
  annulusVertex: ANNULUS_VERTEX,
  fragment: FRAGMENT_SHADER,
} as const;

/** The top of the air in the world's radii, for a haze of scale height `scaleHeight` radii. */
export function shellRadius(scaleHeight: number): number {
  return 1 + SHELL_SCALE_HEIGHTS * scaleHeight;
}

/** The annulus's template: unit circle in x and y, z 0 inside and 1 outside. */
function annulusGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array((ANNULUS_SEGMENTS + 1) * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i <= ANNULUS_SEGMENTS; i += 1) {
    const angle = (i / ANNULUS_SEGMENTS) * Math.PI * 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    positions.set([x, y, 0, x, y, 1], i * 6);
    if (i < ANNULUS_SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/** The halo's two meshes, the annulus and the shell, on the world material's own uniforms. */
export function atmosphereHalo(world: THREE.ShaderMaterial): THREE.Mesh[] {
  const shared = world.uniforms;
  const radius = shellRadius(shared['uScaleHeight']!.value as number);
  const uniforms = {
    uStarDirection: shared['uStarDirection']!,
    uAmbient: shared['uAmbient']!,
    uIrradiance: shared['uIrradiance']!,
    uRayleighDepth: shared['uRayleighDepth']!,
    uMieDepth: shared['uMieDepth']!,
    uAbsorption: shared['uAbsorption']!,
    uMieAsymmetry: shared['uMieAsymmetry']!,
    uScaleHeight: shared['uScaleHeight']!,
    uShellRadius: { value: radius },
  };
  const material = (vertexShader: string, side: THREE.Side): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side,
      depthWrite: false,
    });

  const annulus = new THREE.Mesh(annulusGeometry(), material(ANNULUS_VERTEX, THREE.DoubleSide));
  // Its vertices are placed in the shader; to three it is the size of the air around the world.
  annulus.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
  annulus.name = 'fiction-halo';
  // Inside the air the far side of the shell is the sky in every direction.
  const shell = new THREE.Mesh(sphereGeometry(radius, 128, 64), material(SHELL_VERTEX, THREE.BackSide));
  shell.name = 'fiction-sky';
  return [annulus, shell];
}
