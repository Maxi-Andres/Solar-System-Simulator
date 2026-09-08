import * as THREE from 'three';

/**
 * How a ring scatters light, which is not how a surface does.
 *
 * The first version of the rings used `MeshStandardMaterial`, so their brightness went
 * as `max(0, cos)` between the ring plane's normal and the Sun. That is right for a
 * flat diffuse sheet and wrong for a ring, and in 2026 it is wrong by a factor of
 * eight: Saturn's rings are nearly edge-on to the Sun (sub-solar latitude -7.2 deg, so
 * mu0 = 0.125), and a Lambertian sheet at that incidence returns 13% of full
 * brightness. The rings all but vanished.
 *
 * A ring is not a sheet. It is a slab of separated particles, and as the Sun drops
 * toward its plane the slant path through it lengthens at the same rate the
 * illumination per unit area falls. The two effects cancel, so brightness *saturates*
 * instead of going to zero. That is why Saturn's rings stay visible right up to ring
 * plane crossing.
 *
 * So this uses the standard single-scattering solution for a homogeneous slab
 * (Chandrasekhar), which is the model the ring literature is written in:
 *
 *   reflected:    mu0 / (mu0 + mu) * [1 - exp(-tau * (1/mu + 1/mu0))]
 *   transmitted:  mu0 / (mu0 - mu) * [exp(-tau/mu0) - exp(-tau/mu)]
 *
 * with `mu0` the sine of the solar elevation above the ring plane, `mu` the sine of the
 * viewing elevation, and `tau` the normal optical depth. Two things fall out of it for
 * free, both of them real and both previously missing:
 *
 *  - **The rings no longer fade out near edge-on illumination**, which was the reported
 *    complaint and the reason for this file.
 *  - **The unlit face looks different from the lit face**, and correctly so: the dense B
 *    ring transmits almost nothing and reads dark, while the sparse C ring and the
 *    Cassini Division let light through and read bright. That contrast reversal is one
 *    of the famous sights of the Cassini mission, and it is not something that could be
 *    faked with a brightness multiplier.
 *
 * Opacity comes from the same optical depth: `1 - exp(-tau/mu)`. Looking along the ring
 * makes it more opaque, which the flat alpha channel could not express.
 */

/**
 * Optical depth is read out of the texture's alpha channel as `tau = -ln(1 - alpha)`.
 *
 * That inverts the assumption that the publisher drew alpha as the ring's opacity seen
 * face-on, which is the only reading that makes the C ring faint and the B ring nearly
 * solid. This ceiling stops the densest pixels from sending tau to infinity: alpha
 * 0.995 is already tau = 5.3, opaque to any practical viewing angle.
 */
export const MAX_RING_ALPHA = 0.995;

/**
 * Smallest elevation sine used in the model, about 1.1 degrees.
 *
 * Below this the slant path is so long that the answer has stopped changing, and the
 * projected area of the ring is heading to zero anyway, so the ring disappears for
 * geometric reasons rather than photometric ones. Without the clamp the divisions blow
 * up exactly at ring plane crossing.
 */
export const MIN_ELEVATION_SINE = 0.02;

/**
 * Lumped single-scattering albedo and phase function, `omega0 * P(alpha) / 4`.
 *
 * Unlike everything else here this is a calibration rather than a derivation, and it is
 * worth saying so plainly. The published quantities put it near 0.25 to 0.45 for
 * Saturn's rings — bright, backscattering particles — but those are radiance factors
 * against a specific illumination convention, and this renderer's exposure is set by a
 * tone curve and a sun intensity chosen for the planets. Bridging the two rigorously
 * would mean calibrating the whole scene photometrically, which is a larger project
 * than the rings.
 *
 * So this value makes a well-lit ring read at about the same brightness as Saturn's
 * disc beside it, which is the relationship a photograph shows. What the model
 * contributes is the *geometry* — how brightness varies with solar elevation, viewing
 * elevation and optical depth. That part is physics. This number is scale.
 */
export const RING_SCATTERING_SCALE = 2.0;

/**
 * The rings' colour, sRGB, normalised so its brightest channel is 1.
 *
 * Measured from the dense pixels of the shipped map — those with alpha above 180 —
 * which come out at rgb(113, 105, 102): a slightly warm grey, R > G > B. That is the
 * right direction for ring particles, which are water ice stained by tholins.
 *
 * **The map's own per-pixel RGB is deliberately not used**, and this is the one place
 * where shipped data is being overruled rather than followed, so it deserves the
 * reason. Two of them:
 *
 *  - **The faint bands are blue-violet in the file.** Measured by alpha band, the
 *    material below alpha 120 has blue exceeding red by 8 to 25 counts, against red
 *    exceeding blue by 11 in the dense bands. Saturn's rings are not violet anywhere.
 *    While the rings were eight times too dark the cast was invisible; the moment the
 *    scattering model made them bright it became the most obvious thing about them.
 *  - **It would double-count brightness.** The radial variation now comes from optical
 *    depth through the scattering model, which is where it belongs. Multiplying that by
 *    an artist's shading of the same variation applies it twice.
 *
 * The structure is untouched: every band, the Cassini Division and the Encke Gap all
 * come from the alpha channel, which is the part of the file that is data.
 */
export const RING_TINT_SRGB: readonly [number, number, number] = [1, 0.934, 0.902];

/**
 * The logarithmic depth chunks are not optional here.
 *
 * The renderer runs with `logarithmicDepthBuffer: true`, because the scene spans a
 * near plane of one metre and a far plane past the star sphere. That makes three.js
 * write depth from the *fragment* shader, and a custom material that omits these
 * chunks writes the ordinary interpolated depth instead — a different quantity from
 * the one every other object in the scene is writing. The depth comparison then means
 * nothing, and it failed in the most confusing possible way: the rings were drawn
 * behind Saturn from every angle, including where the near half of the ring plainly
 * passes in front of it.
 */
const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  varying vec2 vRingUv;
  varying vec3 vRingLocal;

  void main() {
    vRingUv = uv;
    // The ring's own frame, where its normal is +z. Keeping the model in this frame
    // means the elevation angles are just the z components of two vectors.
    vRingLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform vec3 uSunLocal;
  uniform vec3 uCameraLocal;
  uniform float uSunIntensity;
  uniform float uAmbient;
  uniform float uFade;
  uniform float uScatteringScale;
  uniform float uMaxAlpha;
  uniform float uMinElevation;

  varying vec2 vRingUv;
  varying vec3 vRingLocal;

  void main() {
    #include <logdepthbuf_fragment>

    vec4 sampled = texture2D(uMap, vRingUv);

    // Normal optical depth, from the alpha the publisher drew face-on.
    float alphaNormal = min(sampled.a, uMaxAlpha);
    float tau = -log(max(1.0 - alphaNormal, 1.0e-4));

    // Sines of the solar and viewing elevations above the ring plane. The ring's
    // normal is +z in this frame, so both are just z components.
    vec3 toCamera = normalize(uCameraLocal - vRingLocal);
    float muSun = abs(uSunLocal.z);
    float muView = abs(toCamera.z);
    bool sameSide = (uSunLocal.z * toCamera.z) > 0.0;

    muSun = max(muSun, uMinElevation);
    muView = max(muView, uMinElevation);

    float scattered;
    if (sameSide) {
      // Reflection: saturates as either elevation falls, rather than vanishing.
      scattered = muSun / (muSun + muView) * (1.0 - exp(-tau * (1.0 / muView + 1.0 / muSun)));
    } else {
      // Transmission through the slab. The mu0 == mu case is a removable singularity
      // whose limit is (tau/mu) * exp(-tau/mu), so blend into it near the pole rather
      // than dividing by zero.
      float separation = muSun - muView;
      float limit = (tau / muView) * exp(-tau / muView);
      float general = muSun / (abs(separation) < 1.0e-3 ? 1.0e-3 : separation)
        * (exp(-tau / muSun) - exp(-tau / muView));
      scattered = mix(limit, general, smoothstep(0.0, 2.0e-3, abs(separation)));
    }

    float brightness = uScatteringScale * max(scattered, 0.0) * uSunIntensity + uAmbient;

    // Apparent opacity grows with the slant path: a ring seen nearly along its plane
    // blocks far more than the same ring seen face-on.
    float opacity = (1.0 - exp(-tau / muView)) * uFade;

    // Tinted, not textured. See RING_TINT: the map's own RGB carries a blue-violet
    // cast in the faint bands that Saturn's rings do not have, and the radial
    // brightness now comes from optical depth instead, which is the physics.
    vec4 diffuseColor = vec4(uTint * brightness, opacity);
    gl_FragColor = diffuseColor;

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * The shader sources, exported for testing.
 *
 * Specifically so a test can assert the logarithmic depth chunks are present. That
 * sounds like testing an implementation detail and is not: omitting them is invisible
 * to every other check, compiles cleanly, renders something plausible, and puts the
 * rings behind the planet from every angle. It is exactly the class of bug that needs a
 * test rather than a careful reader.
 */
export const RING_SHADERS = { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER } as const;

export interface RingMaterialUniforms {
  /** Unit vector from the ring's centre toward the Sun, in the ring's local frame. */
  readonly sunLocal: THREE.Vector3;
  /** Camera position in the ring's local frame, scene units. */
  readonly cameraLocal: THREE.Vector3;
  readonly sunIntensity: number;
  readonly ambient: number;
  /** The marker/mesh cross-fade, so rings appear and disappear with their planet. */
  readonly fade: number;
}

/**
 * A ring material.
 *
 * Deliberately a `ShaderMaterial` rather than a patched `MeshStandardMaterial`: the
 * whole point is a different scattering law, so there is nothing of the standard
 * material's lighting left to keep, and surgical string replacement in its shader would
 * be a version-fragile way to delete all of it. The tone mapping and colour space
 * chunks are included by hand, which is what a ShaderMaterial has to do to sit in the
 * same pipeline as everything else.
 */
export function ringMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uMap: { value: null },
      uTint: { value: new THREE.Color().setRGB(...RING_TINT_SRGB, THREE.SRGBColorSpace) },
      uSunLocal: { value: new THREE.Vector3(0, 0, 1) },
      uCameraLocal: { value: new THREE.Vector3(0, 0, 1) },
      uSunIntensity: { value: 1 },
      uAmbient: { value: 0 },
      uFade: { value: 1 },
      uScatteringScale: { value: RING_SCATTERING_SCALE },
      uMaxAlpha: { value: MAX_RING_ALPHA },
      uMinElevation: { value: MIN_ELEVATION_SINE },
    },
    transparent: true,
    side: THREE.DoubleSide,
    // Depth-tested but not depth-writing, drawn after the sphere: the half of the ring
    // behind the planet is hidden by the planet's own depth while the half in front
    // draws over it. A single flat surface cannot occlude itself.
    depthWrite: false,
  });
}

/**
 * The single-scattering factor, in plain TypeScript.
 *
 * The same arithmetic the shader does, so the model can be tested against its known
 * limits without a GPU -- that it saturates at grazing illumination instead of
 * vanishing, and that a dense slab goes dark in transmission while a sparse one does
 * not. Kept beside the shader so the two cannot drift apart unnoticed.
 */
export function singleScattering(
  opticalDepth: number,
  sunElevationSine: number,
  viewElevationSine: number,
  sameSide: boolean,
): number {
  const muSun = Math.max(Math.abs(sunElevationSine), MIN_ELEVATION_SINE);
  const muView = Math.max(Math.abs(viewElevationSine), MIN_ELEVATION_SINE);
  const tau = opticalDepth;

  if (sameSide) {
    return (muSun / (muSun + muView)) * (1 - Math.exp(-tau * (1 / muView + 1 / muSun)));
  }

  const separation = muSun - muView;
  if (Math.abs(separation) < 1e-3) {
    return (tau / muView) * Math.exp(-tau / muView);
  }
  return (muSun / separation) * (Math.exp(-tau / muSun) - Math.exp(-tau / muView));
}

/** Normal optical depth implied by a face-on opacity. */
export function opticalDepthFromAlpha(alpha: number): number {
  return -Math.log(Math.max(1 - Math.min(alpha, MAX_RING_ALPHA), 1e-4));
}

/** Apparent opacity of a slab of optical depth `tau` seen at elevation sine `mu`. */
export function apparentOpacity(opticalDepth: number, viewElevationSine: number): number {
  return 1 - Math.exp(-opticalDepth / Math.max(Math.abs(viewElevationSine), MIN_ELEVATION_SINE));
}
