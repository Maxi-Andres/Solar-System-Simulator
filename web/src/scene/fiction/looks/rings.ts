import * as THREE from 'three';

import { RING_GLSL } from './ringProfile.ts';

/**
 * A fictional world's rings: a flat annulus in its equator, in its radii, lit by its star.
 *
 * **The photometry is a slab's, not a sheet's** -- see ringMaterial.ts for why a ring lit as
 * Lambert vanishes as the star nears its plane. Single scattering in a slab of normal optical
 * depth tau, lit at mu0 and seen at mu (sines of elevation above the ring plane):
 *
 *   lit face:    mu0 / (mu0 + mu) * (1 - exp(-tau (1/mu + 1/mu0)))
 *   far face:    mu0 / (mu0 - mu) * (exp(-tau / mu0) - exp(-tau / mu))
 *
 * so the dense bands read bright from the lit side and dark from the other, and the sparse
 * ones the other way round -- the contrast reversal Cassini showed. Saturn's own rings are
 * drawn flat (ringMaterial.ts RING_SHADING) because they had to match NASA's renders at every
 * angle; these have nothing to match, and the slab is the better guess. Opacity is the same
 * optical depth along the line of sight, `1 - exp(-tau / mu)`, so the rings thicken toward
 * edge-on as real ones do.
 *
 * **The planet's shadow** falls across them: the ray toward the star from each point of the
 * ring is tested against the unit sphere, softened over a few thousandths of a radius for the
 * penumbra. Their own shadow on the planet is the world shader's (ringProfile.ts).
 */

/** Angular segments: a 256-gon cuts inside its circle by 7.5e-5 of its radius. */
const SEGMENTS = 256;

/** The annulus in the local xz plane (the world's equator; y its pole), radii as given. */
export function ringAnnulus(inner: number, outer: number): THREE.BufferGeometry {
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const angle = (i / SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.set([cos * inner, 0, sin * inner, cos * outer, 0, sin * outer], i * 6);
    if (i < SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outer);
  return geometry;
}

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
    vToCamera = transpose(mat3(modelViewMatrix)) * (-viewPosition.xyz);
    vStar = transpose(mat3(modelMatrix)) * uStarDirection;
    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform float uAmbient;
  uniform float uIrradiance;

  varying vec3 vPosition;
  varying vec3 vToCamera;
  varying vec3 vStar;

  ${RING_GLSL}

  void main() {
    #include <logdepthbuf_fragment>

    float r = length(vPosition.xz);
    float x = ringFraction(r);
    // As many cycles across the ring as leave four pixels a cycle.
    float detail = 0.25 / max(fwidth(x), 1e-6);
    float tau = ringDepthAt(x, detail);
    if (tau <= 1e-4) discard;

    vec3 toStar = normalize(vStar);
    vec3 toCamera = normalize(vToCamera);
    float mu0 = max(abs(toStar.y), 1e-3);
    float mu = max(abs(toCamera.y), 1e-3);

    float single;
    if (toStar.y * toCamera.y > 0.0) {
      single = mu0 / (mu0 + mu) * (1.0 - exp(-tau * (1.0 / mu + 1.0 / mu0)));
    } else if (abs(mu0 - mu) > 1e-3) {
      single = mu0 / (mu0 - mu) * (exp(-tau / mu0) - exp(-tau / mu));
    } else {
      single = tau / mu * exp(-tau / mu);
    }

    // The planet's shadow: does the ray toward the star pass within one radius of the centre?
    vec3 p = vec3(vPosition.x, 0.0, vPosition.z);
    float along = dot(p, toStar);
    float miss = sqrt(max(dot(p, p) - along * along, 0.0));
    float sunlit = along >= 0.0 ? 1.0 : smoothstep(0.996, 1.004, miss);

    // Dense bands clean ice, sparse ones dustier and greyer, as Saturn's B and C rings are.
    float grain = ringNoise(x * 230.0 + 7.0);
    vec3 colour = mix(vec3(0.42, 0.40, 0.38), vec3(0.86, 0.80, 0.70), smoothstep(0.05, 1.2, tau));
    colour *= 0.9 + 0.2 * grain;
    // omega0 P / 4 near 0.65: the B ring's I/F of 0.3 to 0.5 at the geometries Earth sees it.
    vec3 albedo = colour * 0.65;

    float opacity = 1.0 - exp(-tau / mu);
    float direct = (1.0 - uAmbient) * uIrradiance;
    float ambient = uAmbient * uIrradiance;
    vec3 radiance = albedo / PI * (direct * single * sunlit + ambient * opacity);

    // Premultiplied: what the ring sends, over what it lets through from behind.
    gl_FragColor = vec4(radiance, opacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The ring shader's sources, exported so a test can check what they include. */
export const RING_SHADERS = { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER } as const;

/**
 * The rings' material, on the world material's own uniforms for the light and the ring
 * profile -- the same objects, not copies, so the star the scene sets on the world lights the
 * rings too and the rings' shadow on the world is the rings drawn.
 */
export function ringMaterial(world: THREE.ShaderMaterial): THREE.ShaderMaterial {
  const shared = world.uniforms;
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uStarDirection: shared['uStarDirection']!,
      uAmbient: shared['uAmbient']!,
      uIrradiance: shared['uIrradiance']!,
      uRingRadii: shared['uRingRadii']!,
      uRingSeed: shared['uRingSeed']!,
    },
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
