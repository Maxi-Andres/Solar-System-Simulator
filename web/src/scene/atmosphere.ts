import * as THREE from 'three';

/**
 * Earth's atmosphere: Rayleigh single scattering, ray-marched.
 *
 * **Why this exists rather than another colour constant.** Held against NASA's own
 * render, ours was too saturated, and the obvious response was to keep desaturating the
 * surface map. Measuring the two discs is what stopped that: classifying their pixels by
 * colour finds *no land at all* -- not one pixel where green beats blue -- because their
 * atmosphere hazes the whole globe. The saturation was a symptom. This is the cause, and
 * no amount of turning the map down would have produced it, because the haze is
 * strongest at the limb, reddens near the terminator and disappears at the sub-solar
 * point. A constant cannot do any of that.
 *
 * ## Everything here is derived, and one number proves it
 *
 * The scattering coefficient comes from Rayleigh's own expression,
 *
 *   beta(lambda) = 8 pi^3 (n^2 - 1)^2 / (3 N lambda^4) * King
 *
 * with `n` from the Peck and Reeder dispersion for standard air, `N` Loschmidt's number
 * and `King` the depolarisation correction. Nothing in it was chosen to look right.
 *
 * The check that it is right: multiply by the 8.5 km scale height and the optical depth
 * at the zenith at 550 nm comes out at **0.0976**, against the **0.0973** that is
 * published for Earth. Three parts in a thousand, from constants that never saw a
 * screenshot.
 *
 * **So the brightness of the sky here is not a knob.** The surface is lit as
 * `albedo / pi * irradiance` and the sky as `beta * density * phase * irradiance`, from
 * the same `irradiance` -- the lighting mode's own sun intensity. If the result comes out
 * too bright or too dim, that is evidence about the model, not a number to turn.
 *
 * ## What is not modelled, and it is a real list
 *
 *  - **Mie scattering.** No aerosols, so no white haze low down and no sun glare
 *    spreading around the limb. Rayleigh is the dominant term and the one whose
 *    coefficient is a physical constant rather than a local weather condition; aerosol
 *    loading varies by an order of magnitude with place and season, so it would be the
 *    first fitted parameter in a module that currently has none.
 *  - **Multiple scattering.** Single scattering only, which under-lights the deep blue
 *    end and the twilight band -- the same simplification, and the same direction of
 *    error, as the first ring model.
 *  - **Ozone**, which is what makes a real twilight sky blue rather than brown.
 *  - **Refraction.** Rays are straight, so the Sun sets a little under half a degree
 *    early.
 *
 * ## What it costs
 *
 * 16 samples along the view ray, each with 8 more toward the Sun. That is the honest
 * price of not precomputing lookup tables, and it is paid on one body, only when that
 * body is close enough to be drawn as a sphere.
 */

/** Wavelengths the three channels are evaluated at, nm. sRGB primaries, roughly. */
export const RAYLEIGH_WAVELENGTHS_NM: readonly [number, number, number] = [680, 550, 440];

/**
 * Molecular number density of air at 15 C and 101.325 kPa, per cubic metre.
 *
 * Loschmidt's constant. The one place the "sea level" in every sentence here is actually
 * pinned to a thermodynamic state.
 */
export const MOLECULAR_NUMBER_DENSITY = 2.546899e25;

/**
 * King correction factor for air.
 *
 * Air molecules are not spherical, so scattered light is partly depolarised and the
 * cross-section is about 4.8% higher than Rayleigh's expression for an isotropic
 * scatterer gives. Small, and dropping it would put the zenith optical depth outside
 * agreement with the published value, which is the only reason we would know.
 */
export const KING_CORRECTION = 1.048;

/**
 * Refractive index of standard air, from the Peck and Reeder (1972) dispersion formula.
 *
 * The dispersion matters more than it looks. `n - 1` changes by only 1.8% across the
 * visible, but beta goes as `(n^2 - 1)^2`, and at the precision the published optical
 * depth is quoted to that is the difference between agreeing with it and not: a fixed
 * n = 1.0002926 gives a zenith optical depth of 0.108 where the measurement says 0.0973.
 */
export function airRefractiveIndex(wavelengthNm: number): number {
  const inverseMicronsSquared = (1000 / wavelengthNm) ** 2;
  return (
    1 +
    1e-8 *
      (8060.51 +
        2480990 / (132.274 - inverseMicronsSquared) +
        17455.7 / (39.32957 - inverseMicronsSquared))
  );
}

/** Rayleigh volume scattering coefficient at sea level, per metre. */
export function rayleighCoefficient(wavelengthNm: number): number {
  const n = airRefractiveIndex(wavelengthNm);
  const wavelengthM = wavelengthNm * 1e-9;
  return (
    ((8 * Math.PI ** 3 * (n * n - 1) ** 2) / (3 * MOLECULAR_NUMBER_DENSITY * wavelengthM ** 4)) *
    KING_CORRECTION
  );
}

/**
 * Scale height of the Rayleigh atmosphere, km.
 *
 * The density scale height of the bulk atmosphere. 8.5 km is the value that reproduces
 * the published zenith optical depth with the coefficient above; the 7.6 to 8.5 km range
 * quoted in different places is the difference between a local scale height at the
 * surface and the effective one for a whole column, and it is the latter that belongs
 * here.
 */
export const RAYLEIGH_SCALE_HEIGHT_KM = 8.5;

/**
 * Where the atmosphere is cut off, km above the surface.
 *
 * The Karman line, which is a convention -- but at 100 km the density is e^-11.8 of sea
 * level, eleven millionths, so where exactly the cut falls changes nothing. It is the
 * radius of the shell the whole thing is drawn on, so it also sets how far the halo
 * stands out past the planet: 1.6% of Earth's radius, which is about ten pixels on a
 * planet filling the screen.
 */
export const ATMOSPHERE_TOP_KM = 100;

/** Rayleigh coefficients for the three channels, per metre at sea level. */
export const RAYLEIGH_BETA_PER_M: readonly [number, number, number] =
  RAYLEIGH_WAVELENGTHS_NM.map(rayleighCoefficient) as unknown as readonly [
    number,
    number,
    number,
  ];

/**
 * Published Rayleigh optical thickness of Earth's atmosphere at 550 nm, sea level.
 *
 * Here so the derivation above has something to be wrong against. See the test.
 */
export const PUBLISHED_ZENITH_OPTICAL_DEPTH_550 = 0.0973;

/**
 * The Rayleigh phase function, normalised over the sphere.
 *
 * `(3 / 16 pi) (1 + cos^2 theta)`. Exact rather than fitted, which is what makes it
 * different in kind from the ring phase function that had to be calibrated: Rayleigh
 * scattering off a molecule has a closed form, and a ring particle does not.
 *
 * It is also why the limb is brightest where it is: the function is at its maximum both
 * straight toward the Sun and straight away from it, and only half that at 90 degrees.
 */
export function rayleighPhase(cosTheta: number): number {
  return (3 / (16 * Math.PI)) * (1 + cosTheta * cosTheta);
}

/**
 * Integrated density along a ray, in units of the planet's equatorial radius.
 *
 * The TypeScript twin of the shader's inner loop, and the reason it is worth having is
 * that both of its limits have closed forms to check against:
 *
 *  - Straight down from space, the integral is just the scale height.
 *  - Grazing the surface, it is `sqrt(2 pi R H)` -- the classic result that the
 *    atmosphere is about 70 times thicker along the horizon than overhead, which is
 *    the whole reason a limb is bright and a nadir view is not.
 *
 * `origin` and `direction` are in planet radii, with the planet a unit sphere. Returns 0
 * when the ray misses the atmosphere.
 */
export function integratedDensity(
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
  scaleHeight: number,
  atmosphereRadius: number,
  samples = 512,
): number {
  const [ox, oy, oz] = origin;
  const length = Math.hypot(...direction);
  const dx = direction[0] / length;
  const dy = direction[1] / length;
  const dz = direction[2] / length;

  const b = ox * dx + oy * dy + oz * dz;
  const c = ox * ox + oy * oy + oz * oz - atmosphereRadius * atmosphereRadius;
  const discriminant = b * b - c;
  if (discriminant <= 0) {
    return 0;
  }
  const root = Math.sqrt(discriminant);
  const start = Math.max(-b - root, 0);
  let end = -b + root;
  if (end <= start) {
    return 0;
  }

  // Stop at the ground, where the shader does.
  const groundDiscriminant = b * b - (c + atmosphereRadius * atmosphereRadius - 1);
  if (groundDiscriminant > 0) {
    const ground = -b - Math.sqrt(groundDiscriminant);
    if (ground > start) {
      end = Math.min(end, ground);
    }
  }

  const step = (end - start) / samples;
  let total = 0;
  for (let i = 0; i < samples; i += 1) {
    const t = start + (i + 0.5) * step;
    const altitude = Math.hypot(ox + dx * t, oy + dy * t, oz + dz * t) - 1;
    total += Math.exp(-Math.max(altitude, 0) / scaleHeight) * step;
  }
  return total;
}

/** How many points the view ray is sampled at. */
export const VIEW_SAMPLES = 16;
/** How many points each sample's path to the Sun is sampled at. */
export const SUN_SAMPLES = 8;

const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  varying vec3 vAtmospherePosition;

  void main() {
    // The shell geometry is built at the atmosphere's radius *as a ratio*, and the mesh
    // is scaled by the planet's radius, so object space is already in planet radii.
    // Working there rather than in scene units keeps the ray arithmetic in a range
    // float32 handles well even when the camera is a hundred thousand units away.
    vAtmospherePosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uCameraLocal;
  uniform vec3 uSunLocal;
  uniform vec3 uBeta;
  uniform float uAtmosphereRadius;
  uniform float uScaleHeight;
  uniform float uFlattening;
  uniform float uSunIntensity;
  uniform float uFade;

  varying vec3 vAtmospherePosition;

  /** Entry and exit distances for a ray against a sphere at the origin. x > y = miss. */
  vec2 raySphere(vec3 origin, vec3 direction, float radius) {
    float b = dot(origin, direction);
    float c = dot(origin, origin) - radius * radius;
    float discriminant = b * b - c;
    if (discriminant < 0.0) {
      return vec2(1.0, -1.0);
    }
    float root = sqrt(discriminant);
    return vec2(-b - root, -b + root);
  }

  /**
   * Nearest positive hit against the planet, or -1.
   *
   * The planet is an ellipsoid, and it has to be tested as one: squashing the ray into
   * the space where it is a sphere costs two divisions, and skipping it would leave the
   * atmosphere starting 21 km above the ground at the poles.
   */
  float rayPlanet(vec3 origin, vec3 direction) {
    vec3 o = vec3(origin.x, origin.y / uFlattening, origin.z);
    vec3 d = vec3(direction.x, direction.y / uFlattening, direction.z);
    float a = dot(d, d);
    float b = dot(o, d);
    float c = dot(o, o) - 1.0;
    float discriminant = b * b - a * c;
    if (discriminant < 0.0) {
      return -1.0;
    }
    float t = (-b - sqrt(discriminant)) / a;
    return t > 0.0 ? t : -1.0;
  }

  /** Air density relative to sea level, measured from the ellipsoid rather than a sphere. */
  float airDensity(vec3 p) {
    vec3 u = normalize(p);
    float surface = inversesqrt(u.x * u.x + u.z * u.z + (u.y * u.y) / (uFlattening * uFlattening));
    return exp(-max(length(p) - surface, 0.0) / uScaleHeight);
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec3 origin = uCameraLocal;
    vec3 direction = normalize(vAtmospherePosition - origin);

    vec2 shell = raySphere(origin, direction, uAtmosphereRadius);
    if (shell.y <= shell.x) {
      discard;
    }
    float near = max(shell.x, 0.0);
    float far = shell.y;

    float ground = rayPlanet(origin, direction);
    if (ground > 0.0) {
      far = min(far, ground);
    }
    if (far <= near) {
      discard;
    }

    float step = (far - near) / float(${VIEW_SAMPLES});
    float viewDepth = 0.0;
    vec3 scattered = vec3(0.0);

    for (int i = 0; i < ${VIEW_SAMPLES}; i++) {
      vec3 p = origin + direction * (near + (float(i) + 0.5) * step);
      float density = airDensity(p);
      viewDepth += density * step;

      // Anything the planet stands in front of gets no sunlight, which is what draws the
      // terminator into the sky rather than only onto the ground.
      if (rayPlanet(p, uSunLocal) > 0.0) {
        continue;
      }

      float sunExit = raySphere(p, uSunLocal, uAtmosphereRadius).y;
      float sunStep = sunExit / float(${SUN_SAMPLES});
      float sunDepth = 0.0;
      for (int j = 0; j < ${SUN_SAMPLES}; j++) {
        sunDepth += airDensity(p + uSunLocal * ((float(j) + 0.5) * sunStep)) * sunStep;
      }

      // Wavelength-dependent on both legs, which is the whole of why the band above the
      // terminator goes orange: blue is gone by the time that path is that long.
      scattered += density * exp(-uBeta * (viewDepth + sunDepth)) * step;
    }

    float cosTheta = dot(direction, uSunLocal);
    vec3 inScattered =
      scattered * uBeta * uSunIntensity * (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);

    // What the surface behind loses on the way out. A single luminance figure rather
    // than three, because the blend can only carry one: the wavelength dependence is
    // kept in the light that is added and dropped from the light that is removed.
    vec3 transmittance = exp(-uBeta * viewDepth);
    float opacity = 1.0 - dot(transmittance, vec3(0.2126, 0.7152, 0.0722));

    gl_FragColor = vec4(inScattered * uFade, opacity * uFade);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The shader sources, exported so a test can assert the depth chunks are there. */
export const ATMOSPHERE_SHADERS = {
  vertex: VERTEX_SHADER,
  fragment: FRAGMENT_SHADER,
} as const;

/**
 * The atmosphere's material.
 *
 * Blended as `source + destination * (1 - alpha)`: the light the air scatters toward the
 * camera is added, and what was already drawn is attenuated by what the air absorbed on
 * the way out. Plain additive blending would have been simpler and would say the
 * atmosphere never dims anything, which at the limb -- where the optical depth in blue
 * reaches 17 -- is not a small lie.
 */
export function atmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uCameraLocal: { value: new THREE.Vector3(0, 0, 10) },
      uSunLocal: { value: new THREE.Vector3(1, 0, 0) },
      uBeta: { value: new THREE.Vector3() },
      uAtmosphereRadius: { value: 1 },
      uScaleHeight: { value: 1 },
      uFlattening: { value: 1 },
      uSunIntensity: { value: 1 },
      uFade: { value: 1 },
    },
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    // The near half of the shell, so one pass covers the disc and the halo around it.
    side: THREE.FrontSide,
    // Drawn over the planet and the clouds, writing no depth of its own: it is a volume,
    // and nothing behind it should be occluded by where its shell happens to sit.
    depthWrite: false,
  });
}

/**
 * Fills in everything about the material that depends on which body it is around.
 *
 * Separate from the constructor because the radii have to be expressed as ratios of the
 * planet's own radius, and getting that conversion wrong is silent: the sky would simply
 * be the wrong brightness, with nothing to compare it against.
 */
export function configureAtmosphere(
  material: THREE.ShaderMaterial,
  equatorialRadiusKm: number,
  polarRadiusKm: number,
): void {
  const radiusM = equatorialRadiusKm * 1000;
  material.uniforms.uBeta!.value.set(
    RAYLEIGH_BETA_PER_M[0] * radiusM,
    RAYLEIGH_BETA_PER_M[1] * radiusM,
    RAYLEIGH_BETA_PER_M[2] * radiusM,
  );
  material.uniforms.uAtmosphereRadius!.value = atmosphereRadiusRatio(equatorialRadiusKm);
  material.uniforms.uScaleHeight!.value = RAYLEIGH_SCALE_HEIGHT_KM / equatorialRadiusKm;
  material.uniforms.uFlattening!.value = polarRadiusKm / equatorialRadiusKm;
}

/** Radius of the shell, as a ratio of the planet's equatorial radius. */
export function atmosphereRadiusRatio(equatorialRadiusKm: number): number {
  return 1 + ATMOSPHERE_TOP_KM / equatorialRadiusKm;
}
