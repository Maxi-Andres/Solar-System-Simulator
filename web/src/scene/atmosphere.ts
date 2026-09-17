import * as THREE from 'three';

import { POINT_LIGHT_HOOK } from './ringShadow.ts';

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
 * 16 samples along the view ray, and **nothing along the path to the Sun** -- that one is
 * the Chapman function, in closed form. It began as a second march of 8 samples inside
 * the first, 128 density evaluations for every pixel of Earth on screen, and it was slow
 * enough to notice. Replacing it was not a trade: see `chapmanColumn`, the closed form is
 * *more* accurate than the march was.
 *
 * Paid on one body, and only while that body is close enough to be drawn as a sphere.
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

/**
 * Tessellation of the shell the sky is drawn on.
 *
 * Far coarser than the cloud deck's 256, and for a reason that does not apply here: the
 * deck floats 5 km up and a 64-segment chord sags 7.7 km, so it needed the resolution to
 * stay outside the planet. This shell stands 100 km off the ground, twenty times the sag
 * at 128 segments, so the only thing tessellation buys is a halo edge that is not
 * visibly polygonal -- and the halo is 1.6% of the radius thick, where 128 segments put
 * the scallop at 2% of that.
 */
export const ATMOSPHERE_SEGMENTS = 128;

/**
 * Shape parameter of the `erfcx` approximation below.
 *
 * One free number, fitted -- and fitted against a function, not against a picture, which
 * is a different kind of constant from the ring brightness. The form is pinned at both
 * ends before it is fitted at all: it is exact at zero and has the exact `1/(y sqrt(pi))`
 * tail, so this only sets the shape in between. The textbook choice of 1 leaves 3.5%
 * there; 1.164 minimises the worst relative error over the whole range, at 0.34%.
 */
export const ERFCX_SHAPE = 1.164;

/** The tail coefficient, forced by the asymptote rather than chosen. */
const ERFCX_TAIL = (Math.sqrt(Math.PI) - ERFCX_SHAPE) ** 2;

/**
 * `exp(y^2) erfc(y)`, the scaled complementary error function, for y >= 0.
 *
 * **The obvious approximation is a trap and it is worth recording why.** Abramowitz and
 * Stegun 7.1.26 gives `erfc(y)` as a polynomial times `exp(-y^2)`, so the exponentials
 * appear to cancel exactly and leave a pure polynomial -- which is both cheaper and
 * seductive. It is also useless here: that formula is accurate to 1.5e-7 *absolutely*,
 * and at the y this is called with, `erfc` is around 1e-164. Multiplying by `exp(y^2)`
 * scales the error up with it. Used in the Chapman function below it came out 12% high
 * at the zenith, which was how the problem announced itself.
 *
 * This form has the right asymptote built in instead, so its error is relative
 * throughout: 0.34% at worst, and better than 0.05% wherever y is large.
 */
export function erfcx(y: number): number {
  return 1 / (ERFCX_SHAPE * y + Math.sqrt(ERFCX_TAIL * y * y + 1));
}

/**
 * Column density along a ray leaving the atmosphere, in planet radii.
 *
 * **The Chapman function, and it is what made the sky affordable.** The first version
 * marched eight samples toward the Sun from each of sixteen along the view ray: 128
 * density evaluations for every pixel of Earth on screen, and it showed. This is the
 * same integral in closed form,
 *
 *   C = H exp(-h/H) sqrt(pi x / 2) erfcx(sqrt(x/2) cos(chi))
 *
 * with `x` the radius in scale heights and `chi` the angle from straight up. It is not
 * an optimisation that trades accuracy for speed -- it is **more accurate than the march
 * it replaced**, which was 8.5% low at the zenith where eight samples cannot resolve a
 * density that falls by a factor of e every 8.5 km.
 *
 * Two branches, because a ray can point below the local horizon and still leave: near
 * the terminator the path to the Sun dips and skims over the limb. That case is the
 * whole chord through its lowest point, less the part behind where it started, and it is
 * exactly the geometry that reddens the twilight band -- so it is not an edge case to be
 * clamped away.
 *
 * `altitude` and `scaleHeight` are in planet radii; `cosZenith` is the cosine of the
 * angle between straight up and the ray.
 */
export function chapmanColumn(
  altitude: number,
  cosZenith: number,
  scaleHeight: number,
): number {
  const radius = 1 + altitude;
  const x = radius / scaleHeight;
  const outward = scaleHeight * Math.exp(-altitude / scaleHeight) * Math.sqrt((Math.PI * x) / 2);

  if (cosZenith >= 0) {
    return outward * erfcx(Math.sqrt(0.5 * x) * cosZenith);
  }

  // Written from the radius in planet radii rather than in scale heights: the two differ
  // by a factor of 750, and subtracting one from the other in float32 to recover an
  // altitude would throw away most of the digits that matter.
  const perigeeRadius = radius * Math.sqrt(Math.max(1 - cosZenith * cosZenith, 0));
  const throughPerigee =
    scaleHeight *
    Math.exp(-(perigeeRadius - 1) / scaleHeight) *
    Math.sqrt((Math.PI * (perigeeRadius / scaleHeight)) / 2);

  // erfcx(0) is 1, so the perigee leg needs no call.
  return 2 * throughPerigee - outward * erfcx(Math.sqrt(0.5 * x) * -cosZenith);
}

/**
 * What is left of the sunlight after it has come down through the air, per channel.
 *
 * **The other half of the sky, and the one that was missing.** In-scattering paints the
 * blue on; this takes the same blue back out of the beam that reaches the ground, and
 * without it the model was inconsistent rather than merely incomplete: the air above a
 * point was attenuated and the surface beneath it was lit by pure white sunlight, as if
 * the beam had arrived from space without crossing anything.
 *
 * It is also what a sunset *is*. The same Chapman column, evaluated toward the Sun
 * instead of along the view ray, with no new constant anywhere:
 *
 *   sun elevation   airmass   the light that gets through
 *      90 deg          1.0    rgb(255, 249, 233) at 96%
 *      15 deg          3.8    rgb(255, 232, 181) at 86%
 *       5 deg         10.1    rgb(255, 198, 101) at 66%
 *       0 deg         34.3    rgb(255, 106,   3) at 24%
 *
 * So the ground and the clouds go amber as they approach the terminator, which is the
 * band a reference render shows and ours did not have at all.
 *
 * Below the horizon it returns zero, and the boundary is *strictly* below: at exactly
 * grazing incidence the column is finite and the answer is a deep orange, so cutting at
 * `<= 0` would put a black discontinuity precisely where the sunset is. Past that the
 * Chapman branch for a downward ray would look for a perigee inside the planet and
 * overflow, so the guard is load-bearing rather than tidy.
 */
export function sunlightTransmittance(
  altitude: number,
  cosSolarZenith: number,
  scaleHeight: number,
  betaPerRadius: readonly [number, number, number],
): [number, number, number] {
  if (cosSolarZenith < 0) {
    return [0, 0, 0];
  }
  const column = chapmanColumn(altitude, cosSolarZenith, scaleHeight);
  return [
    Math.exp(-betaPerRadius[0] * column),
    Math.exp(-betaPerRadius[1] * column),
    Math.exp(-betaPerRadius[2] * column),
  ];
}

/**
 * The shared half of the shader: the extinction model, and the uniforms it needs.
 *
 * Injected into three materials -- the sky itself, Earth's surface and its cloud deck --
 * because all three are asking the same question about the same air. Duplicating it per
 * material is how the surface ends up lit by a different atmosphere from the one drawn
 * above it.
 */
export const ATMOSPHERIC_EXTINCTION_GLSL = /* glsl */ `
uniform vec3 uBeta;
uniform float uScaleHeight;

/** exp(y*y) erfc(y). See erfcx in atmosphere.ts for why the textbook form is wrong here. */
float erfcx(float y) {
  return 1.0 / (${ERFCX_SHAPE} * y + sqrt(${ERFCX_TAIL} * y * y + 1.0));
}

/**
 * Column density from a point out of the atmosphere, in planet radii. The Chapman
 * function: the integral an inner loop used to march, in closed form and more accurate
 * than the march was.
 */
float chapmanColumn(float altitude, float cosZenith) {
  float radius = 1.0 + altitude;
  float x = radius / uScaleHeight;
  float outward = uScaleHeight * exp(-altitude / uScaleHeight) * sqrt(PI * x * 0.5);

  if (cosZenith >= 0.0) {
    return outward * erfcx(sqrt(0.5 * x) * cosZenith);
  }

  // The ray points below the local horizon and still leaves, skimming over the limb.
  // That is the twilight geometry, not an edge case.
  float perigeeRadius = radius * sqrt(max(1.0 - cosZenith * cosZenith, 0.0));
  float throughPerigee = uScaleHeight
    * exp(-(perigeeRadius - 1.0) / uScaleHeight)
    * sqrt(PI * (perigeeRadius / uScaleHeight) * 0.5);

  return 2.0 * throughPerigee - outward * erfcx(sqrt(0.5 * x) * -cosZenith);
}

/** What survives of the sunlight coming down to a point, per channel. */
vec3 sunlightTransmittance(float altitude, float cosSolarZenith) {
  // Strictly below, not at: the column at grazing incidence is finite, and cutting it
  // here would put a black discontinuity exactly where the sunset is.
  if (cosSolarZenith < 0.0) {
    return vec3(0.0);
  }
  return exp(-uBeta * chapmanColumn(altitude, cosSolarZenith));
}
`;

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

  ${ATMOSPHERIC_EXTINCTION_GLSL}

  uniform vec3 uCameraLocal;
  uniform vec3 uSunLocal;
  uniform float uAtmosphereRadius;
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

  /** Height above the ellipsoid, in planet radii, given the point and its unit direction. */
  float altitudeAt(vec3 p, vec3 up, float radius) {
    float surface = inversesqrt(
      up.x * up.x + up.z * up.z + (up.y * up.y) / (uFlattening * uFlattening)
    );
    return max(radius - surface, 0.0);
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
      float radius = length(p);
      vec3 up = p / radius;
      float altitude = altitudeAt(p, up, radius);
      float density = exp(-altitude / uScaleHeight);
      viewDepth += density * step;

      // Anything the planet stands in front of gets no sunlight, which is what draws the
      // terminator into the sky rather than only onto the ground.
      if (rayPlanet(p, uSunLocal) > 0.0) {
        continue;
      }

      // One closed form instead of an eight-sample march. Wavelength-dependent on both
      // legs, which is the whole of why the band above the terminator goes orange: blue
      // is gone by the time that path is that long.
      float sunDepth = chapmanColumn(altitude, dot(up, uSunLocal));
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

/** The scattering coefficient in the units the shader works in: per planet radius. */
export function betaPerPlanetRadius(equatorialRadiusKm: number): [number, number, number] {
  const radiusM = equatorialRadiusKm * 1000;
  return [
    RAYLEIGH_BETA_PER_M[0] * radiusM,
    RAYLEIGH_BETA_PER_M[1] * radiusM,
    RAYLEIGH_BETA_PER_M[2] * radiusM,
  ];
}

export interface ExtinctionUniforms {
  readonly uBeta: { value: THREE.Vector3 };
  readonly uScaleHeight: { value: number };
}

/** The two uniforms `ATMOSPHERIC_EXTINCTION_GLSL` needs, for a given body. */
export function extinctionUniforms(equatorialRadiusKm: number): ExtinctionUniforms {
  return {
    uBeta: { value: new THREE.Vector3(...betaPerPlanetRadius(equatorialRadiusKm)) },
    uScaleHeight: { value: RAYLEIGH_SCALE_HEIGHT_KM / equatorialRadiusKm },
  };
}

/**
 * Teaches a lit material that its sunlight arrived through an atmosphere.
 *
 * Patches the direct light only. The ambient fill in the Flood and Shadow modes is a
 * legibility aid rather than sunlight, so it has no business being reddened -- the same
 * line the ring shadow draws, at the same injection point.
 *
 * `altitude` is a GLSL expression in planet radii: `0.0` for the ground, the deck's own
 * height for the clouds. The solar zenith angle comes from three.js's own
 * `geometryNormal` and `directLight.direction`, both already in view space, which avoids
 * handing every material a Sun vector in its own rotating frame -- and gets the cloud
 * deck right for free, since its frame is turned away from the surface's by the drift.
 */
export function patchSunlightExtinction(
  shader: { fragmentShader: string },
  altitude: string,
): void {
  const lighting = THREE.ShaderChunk.lights_fragment_begin;
  if (!lighting.includes(POINT_LIGHT_HOOK)) {
    throw new Error(
      'three.js moved the point light hook; sunlight extinction needs a new injection point.',
    );
  }

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${ATMOSPHERIC_EXTINCTION_GLSL}`)
    .replace(
      '#include <lights_fragment_begin>',
      lighting.replace(
        POINT_LIGHT_HOOK,
        `${POINT_LIGHT_HOOK}
        // The air between here and the Sun. What it takes out of the beam is what the
        // sky above puts back in, and leaving it out lit the ground with sunlight that
        // had crossed no atmosphere at all.
        directLight.color *= sunlightTransmittance(
          ${altitude},
          dot(geometryNormal, directLight.direction)
        );`,
      ),
    );
}
