import * as THREE from 'three';

/**
 * ## Which shading this file actually uses, and why it is the simple one
 *
 * **`RING_SHADING` is `'flat'`.** The rings are drawn at a constant brightness,
 * independent of where the camera is and where the Sun is. Everything below it in this
 * file is a physically-derived scattering model that is *not* currently switched on.
 *
 * That was a deliberate call, made by Maxi after four rounds of trying to get the
 * physical model to look right, and the reasoning is worth having in full because the
 * decision should be revisited.
 *
 * **What kept going wrong.** Each round fixed a real error and revealed the next one:
 * alpha applied twice from the wrong channel; a Lambert term that is wrong for a slab
 * of particles; a radiometric scale that was guessed rather than derived; no multiple
 * scattering, so the shadowed face went black and the lit face ran away; a phase
 * function pinned at its opposition value when a polar view of the rings is actually
 * 83 degrees of phase. Every one of those was genuinely wrong and genuinely fixed. The
 * rings still looked wrong from some angles.
 *
 * **What the last measurement showed.** Ring brightness as a fraction of Saturn's,
 * measured off matched screenshots:
 *
 *   | view | NASA Eyes | this model |
 *   |---|---|---|
 *   | from above the pole | 0.106 | 0.078 |
 *   | from near the ring plane | 0.060 | **0.214** |
 *
 * NASA Eyes' rings do not brighten when seen edge-on. If anything they dim slightly.
 * Ours brightened by a factor of 3.6, because the model correctly predicts that a slab
 * of particles seen more edge-on returns more light per unit projected area — and that
 * prediction, however correct in isolation, is not what the reference does and not what
 * the reference is trying to show.
 *
 * **So the remaining gap is not a bug to find.** It is that a believable ring needs
 * more than single scattering plus an H-function: a real particle phase curve rather
 * than a single Henyey-Greenstein lobe (ours peaks 14x at opposition, which is what
 * makes the brightness swing so violently with camera position), a proper multiple
 * scattering solution rather than a semi-infinite approximation used on a finite slab,
 * and the ring's finite vertical thickness. That is a research problem, not an
 * afternoon.
 *
 * **The trade being made.** This project's first principle is that what you see is
 * measured. A constant-brightness ring breaks that principle, and it is the only place
 * in the renderer that does so knowingly. It is worth it here because the alternative
 * on offer was not "realistic" but "wrong in a different way at every camera angle",
 * and because the rings were blocking everything else.
 *
 * **Future work, in the order it should be attempted.** Keep the geometry, which is
 * right: real radii, the real equatorial plane, the real oblate shadow. Replace the
 * photometry with a measured phase curve for ring particles and a finite-slab multiple
 * scattering solution, and validate against Cassini radiance factors at several phase
 * angles rather than against two screenshots. Flipping `RING_SHADING` back to
 * `'scattering'` restores everything below, which is tested and correct as far as it
 * goes; it is the starting point, not something to rebuild.
 *
 * ---
 *
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
 *
 * ## Single scattering alone was not enough either
 *
 * Shipped with only the terms above, the rings were reported as near-black viewed
 * edge-on from one side and white from the other. Measured, the lit-to-unlit ratio ran
 * from 3 looking straight down at the rings to **12,000** looking along them, with the
 * lit face reaching a radiance factor of 0.95 — brighter than Saturn's own disc.
 *
 * Both ends were artefacts of leaving multiple scattering out:
 *
 *  - **The lit face ran away** because the effective `omega0 * P / 4` had been fitted at
 *    one geometry, where multiple scattering was quietly doing part of the work. Used at
 *    grazing view, where single scattering saturates, that inflated value overshoots.
 *  - **The unlit face collapsed to zero** because single scattering says a slab of
 *    optical depth 1.2 lit at 7 degrees extinguishes the beam completely. It does — but
 *    the light does not vanish, it diffuses. Ring particles are water ice with a
 *    single-scattering albedo near 0.95, so photons scatter many times and a good
 *    fraction leaves through the far side. That is precisely why the unlit face of
 *    Saturn's rings is dim rather than black.
 *
 * So the model now carries Hapke's two-term form, which is what the ring photometry
 * literature uses:
 *
 *   I/F = (omega0 / 4) * [ P(g) * single + (H(mu) * H(mu0) - 1) * saturation ]
 *
 * The first term is the directional single scattering above, strongly asymmetric between
 * the two faces. The second is the multiply-scattered field, built from Chandrasekhar's
 * H-function, which is nearly symmetric because diffuse light has lost its sense of
 * direction. Adding them bounds the lit face and lifts the unlit one off zero, from one
 * principle rather than two patches.
 *
 * ## And the phase function is not a constant
 *
 * The last thing wrong was `P(g)`, which was fixed at its opposition value. That is
 * wrong here by a factor of five, because this simulator is not normally viewed from
 * near opposition: with the Sun 7 degrees above the ring plane in 2026, looking down at
 * the rings from above puts the Sun and camera 83 degrees apart. It is a side-lit ring
 * being given a back-lit particle's brightness.
 *
 * It is now a real Henyey-Greenstein function of the actual per-fragment phase angle,
 * which the shader already had both vectors for. Verified against a NASA Eyes screenshot
 * of the same instant and viewpoint, measured pixel by pixel.
 */

/**
 * Optical depth is read out of the texture's alpha channel as `tau = -ln(1 - alpha)`.
 *
 * That inverts the assumption that the publisher drew alpha as the ring's opacity seen
 * face-on, which is the only reading that makes the C ring faint and the B ring nearly
 * solid. This ceiling stops the densest pixels from sending tau to infinity: alpha
 * 0.995 is already tau = 5.3, opaque to any practical viewing angle.
 */
/**
 * Which shading path the shader is built with. See the note at the top of this file.
 *
 * `'flat'` draws the rings at a constant brightness. `'scattering'` uses the physical
 * model in the rest of this file. Read at module scope, so the unused path is not even
 * compiled into the shader.
 */
export const RING_SHADING: 'flat' | 'scattering' = 'flat';

/**
 * Ring brightness in the flat path, as a radiance factor, *before* the map's opacity.
 *
 * The displayed brightness of a band is this times its opacity, so the ring's mean comes
 * out around 0.014 — the map's mean alpha is 0.71. That sits between the two figures
 * measured off NASA Eyes at matched viewpoints: 0.0135 from above the pole and 0.0085
 * from near the ring plane. Their two views differ by 1.8x, so no constant reproduces
 * both.
 *
 * Raised from 0.011 after a close-up comparison showed ours too dark: NASA's rings mean
 * 23.7 of 255 where ours meant 17.3.
 */
export const RING_FLAT_RADIANCE_FACTOR = 0.02;

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
 * Single-scattering albedo of a ring particle, and the asymmetry of its phase function.
 *
 * These two are fitted **together**, because they trade off against each other, and the
 * fit has two anchors:
 *
 *  1. The dense B ring reaching a radiance factor near 0.55 at opposition with the rings
 *     well open, which is where published ring photometry sits.
 *  2. A NASA Eyes screenshot of Saturn at this same instant and viewpoint, measured
 *     pixel by pixel: its rings read 20/255 against a planet at 139/255. Inverting this
 *     renderer's own tone curve puts that at a radiance factor of 0.0144.
 *
 * A grid search over both parameters lands on omega0 = 0.55 and g = -0.55, which hits
 * 0.504 and 0.0141 — both anchors at once, from one pair of numbers.
 *
 * The first version used 0.95, on the reasoning that ring particles are water ice and
 * water ice is bright. That is the albedo of *pristine* ice in a laboratory. Real ring
 * particles are contaminated, and the published range for them is 0.5 to 0.7, so 0.55
 * is where it should have started. Being wrong here mattered twice over: it set the
 * brightness directly, and it inflated the multiple-scattering term, which is
 * proportional to how much light a particle re-emits.
 *
 * Worth being clear about the status of this: the geometry — how brightness varies with
 * solar elevation, viewing elevation, optical depth and phase angle — is physics, and
 * every one of those dependencies is derived. These two numbers are a two-parameter fit
 * against one literature value and one measured screenshot, and a better anchor on
 * either would move them.
 */
export const RING_SINGLE_SCATTERING_ALBEDO = 0.55;

/**
 * Henyey-Greenstein asymmetry parameter. Negative is backscattering.
 *
 * Fitted jointly with the albedo above; see that comment for the two anchors. -0.55 is
 * strongly backscattering, which is what ring particles are, and it gives P(0) = 7.65
 * against P(83 degrees) = 0.555 — a factor of fourteen between opposition and the
 * side-lit geometry a polar view actually sits at.
 *
 * That this parameter exists at all is the fix for the last thing making the rings too
 * bright. The phase function used to be a constant 3.0, which is its value near
 * *opposition*, applied at every phase angle. I had written that off in a comment as an
 * approximation worth "tens of percent at large phase". It was a factor of five, and the
 * reason is a geometry that is easy to overlook: with the Sun 7 degrees above the ring
 * plane in 2026, looking down at the rings from above puts the Sun and the camera 83
 * degrees apart. A polar view of the rings is a *high* phase angle, exactly when the
 * rings are most likely to be looked at that way.
 */
export const RING_ASYMMETRY = -0.55;

/**
 * Henyey-Greenstein phase function, as a function of the cosine of the *phase* angle.
 *
 * Phase angle is the Sun-ring-observer angle, so `cosPhase = 1` is opposition and the
 * particle is looking straight back at the Sun. In terms of the scattering angle that
 * HG is normally written with, `cos(theta) = -cosPhase`, which is where the sign in the
 * denominator comes from.
 *
 * Applied to the single-scattering term only. Multiply-scattered light has bounced
 * enough times to be effectively isotropic, so giving it a phase function would be
 * attributing a direction to light that has lost one — and it is the reason the rings
 * do not go dark at high phase, only dimmer.
 */
export function henyeyGreenstein(cosPhase: number, asymmetry = RING_ASYMMETRY): number {
  const g = asymmetry;
  return (1 - g * g) / Math.pow(1 + g * g + 2 * g * cosPhase, 1.5);
}

/** The phase function at opposition, which is the brightness the anchor is set at. */
export const RING_PHASE_AT_OPPOSITION = henyeyGreenstein(1);

/**
 * Radiance factor to rendered radiance.
 *
 * This is the conversion the first version got wrong, by a factor of six. It used a
 * constant picked so that "a well-lit ring reads about as bright as Saturn's disc",
 * which is not a calibration but a guess, and it rendered the lit face at 104% of
 * Saturn's own peak brightness: the rings outshone the planet.
 *
 * The conversion is not a matter of taste at all. `MeshStandardMaterial` outputs
 * `irradiance * albedo / PI`, so the planets render radiance `L = I_sun * cos(theta) *
 * albedo / PI`. Radiance factor is defined by `L = (I/F) * E / PI` with `E` the
 * irradiance. So a material that computes a radiance factor must divide by PI, and
 * that is the whole of this constant.
 */
export const RADIANCE_FACTOR_TO_RADIANCE = 1 / Math.PI;

/**
 * The rings' colour, sRGB, normalised so its brightest channel is 1.
 *
 * **Neutral, to match the reference.** Measured off a NASA Eyes close-up, their rings
 * are rgb(23.7, 23.7, 23.7) — grey to within a tenth of a count. Ours was rendering at
 * rgb(17.3, 13.1, 9.9), blue seven counts under red, which reads as brown rather than
 * as grey ring material.
 *
 * The warmth was not invented: the dense bands of the shipped map really do measure
 * rgb(113, 105, 102), and real ring particles are ice stained by tholins, so a slight
 * red bias is the physically right direction. At the low brightness the rings are drawn
 * at, though, that same small bias lands squarely in brown — a warm hue is far more
 * visible in shadow than in light. Matching the reference wins here; the rings are grey.
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
export const RING_TINT_SRGB: readonly [number, number, number] = [1, 1, 1];

/**
 * Softness of the shadow edge, as a fraction of Saturn's equatorial radius.
 *
 * The real penumbra is narrow but not zero: the Sun's angular radius at Saturn is about
 * 0.0275 degrees, so a hundred thousand kilometres beyond the terminator the shadow
 * edge is blurred over roughly 48 km — 0.0008 of a Saturn radius. This is a few times
 * wider, which costs nothing in realism at any zoom the app reaches and stops the edge
 * from aliasing into a staircase across the ring.
 */
export const SHADOW_SOFTNESS = 0.004;

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

/**
 * The radiance factor, which is the one part of the shader the two paths disagree on.
 *
 * Selected at module scope rather than branched at runtime, so the unused path is not
 * compiled and there is no uniform to get out of sync with the constant.
 */
const RADIANCE_FACTOR_BY_PATH = {
  flat: /* glsl */ `
    // Flat: constant brightness, independent of camera and Sun. See the note at the
    // top of this file for why the physical model below is switched off.
    float radianceFactor = uFlatRadianceFactor;
`,
  scattering: /* glsl */ `
    // Phase angle: the Sun-ring-observer angle, which both of these vectors are
    // already to hand for. Only the directional term gets it; the diffuse field has
    // scattered too many times to have a direction left.
    float cosPhase = dot(uSunLocal, toCamera);
    float phase = henyeyGreenstein(cosPhase);

    // Hapke's two-term radiance factor.
    float radianceFactor =
      uAlbedo * 0.25 * (phase * max(scattered, 0.0) + max(multiple, 0.0));
`,
} as const;

/** Both radiance-factor paths, so a test can check the inactive one too. */
export const RING_RADIANCE_FACTOR_GLSL = RADIANCE_FACTOR_BY_PATH;

/**
 * Opacity, which is the other thing the two paths disagree on — and the reason the flat
 * rings first came out with no visible band structure at all.
 *
 * With a constant brightness, *all* of the ring's structure has to arrive through
 * opacity. The scattering path's slant-path opacity, `1 - exp(-tau/mu)`, saturates to 1
 * for every band as the view goes edge-on, which erased that structure exactly where it
 * was being looked at: measured against a NASA close-up, their bands span a 5.1x
 * brightness range and ours spanned 1.7x.
 *
 * The flat path uses the map's face-on alpha instead. It carries a 7.4x range from p5
 * to p95, which is more than enough, and it does not depend on the camera — which is
 * the whole premise of this path.
 */
const OPACITY_BY_PATH = {
  flat: /* glsl */ `
    // Straight from the map: view-independent, and the only thing carrying the bands.
    float opacity = alphaNormal * uFade;
`,
  scattering: /* glsl */ `
    // Apparent opacity grows with the slant path: a ring seen nearly along its plane
    // blocks far more than the same ring seen face-on.
    float opacity = (1.0 - exp(-tau / muView)) * uFade;
`,
} as const;

export const RING_OPACITY_GLSL = OPACITY_BY_PATH;

const FRAGMENT_SHADER_TEMPLATE = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform vec3 uSunLocal;
  uniform vec3 uCameraLocal;
  uniform float uSunIntensity;
  uniform float uAmbient;
  uniform float uFade;
  uniform float uAlbedo;
  uniform float uAsymmetry;
  uniform float uFlatRadianceFactor;
  uniform float uMaxAlpha;
  uniform float uMinElevation;
  uniform float uEquatorialRadius;
  uniform float uPolarRadius;
  uniform float uShadowSoftness;

  /**
   * Henyey-Greenstein phase function of the cosine of the phase angle.
   *
   * cosPhase = 1 is opposition. Ring particles backscatter, so this peaks there and
   * falls away steeply -- by a factor of five at the 83 degrees a polar view of the
   * rings actually sits at in 2026.
   */
  float henyeyGreenstein(float cosPhase) {
    float g = uAsymmetry;
    float denominator = 1.0 + g * g + 2.0 * g * cosPhase;
    return (1.0 - g * g) * pow(max(denominator, 1.0e-4), -1.5);
  }

  /**
   * Chandrasekhar's H-function, in the standard rational approximation.
   *
   * H(x) = (1 + 2x) / (1 + 2x * sqrt(1 - omega0)). It is the isotropic-scattering
   * escape function, and its whole job here is to be *bounded*: H(0) = 1, so the
   * multiple-scattering term cannot run away at grazing angles the way an unbounded
   * fit does.
   */
  float chandrasekharH(float mu) {
    return (1.0 + 2.0 * mu) / (1.0 + 2.0 * mu * sqrt(1.0 - uAlbedo));
  }

  /**
   * How much of the Sun reaches a point on the ring, 0 in full shadow to 1 in full sun.
   *
   * The planet is an oblate ellipsoid centred on the ring, with its polar axis along
   * the ring's normal, so in this frame it is x^2/a^2 + y^2/a^2 + z^2/c^2 = 1. Scaling
   * the coordinates by (a, a, c) turns it into the unit sphere, and the question becomes
   * whether the ray from the ring point toward the Sun passes within one unit of the
   * origin while heading toward it. Two dot products and a square root.
   */
  float sunlitFraction(vec3 ringPoint, vec3 toSun) {
    vec3 p = vec3(ringPoint.xy / uEquatorialRadius, ringPoint.z / uPolarRadius);
    vec3 s = vec3(toSun.xy / uEquatorialRadius, toSun.z / uPolarRadius);

    float along = dot(p, s);
    // Closest approach is at -along/dot(s,s), so a positive value here means the
    // planet lies behind the point as seen from the Sun and cannot occlude it.
    if (along >= 0.0) {
      return 1.0;
    }

    float perpendicularSquared = dot(p, p) - along * along / dot(s, s);
    float perpendicular = sqrt(max(perpendicularSquared, 0.0));

    return smoothstep(1.0 - uShadowSoftness, 1.0 + uShadowSoftness, perpendicular);
  }

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

    // Common to both terms: the fraction of the slant column that actually scatters.
    // This is what keeps a gap a gap and the thin C ring thin.
    float saturation = 1.0 - exp(-tau * (1.0 / muView + 1.0 / muSun));
    float projection = muSun / (muSun + muView);

    float scattered;
    if (sameSide) {
      // Reflection: saturates as either elevation falls, rather than vanishing.
      scattered = projection * saturation;
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

    // The multiply-scattered field. Nearly the same from either face, because light
    // that has bounced several times no longer remembers which way it came in -- and
    // that is exactly what stops the unlit face rendering black.
    float multiple =
      (chandrasekharH(muView) * chandrasekharH(muSun) - 1.0) * projection * saturation;

    RADIANCE_FACTOR

    // Saturn's shadow, the single most recognisable thing about a photograph of the
    // rings. It falls on the scattered light only: the ambient fill is a legibility aid
    // rather than sunlight, so it has no business being occluded by a planet.
    float sunlit = sunlitFraction(vRingLocal, uSunLocal);

    float brightness = radianceFactor * RECIPROCAL_PI * uSunIntensity * sunlit + uAmbient;

    OPACITY

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
const FRAGMENT_SHADER = FRAGMENT_SHADER_TEMPLATE.replace(
  '    RADIANCE_FACTOR',
  RADIANCE_FACTOR_BY_PATH[RING_SHADING],
).replace('    OPACITY', OPACITY_BY_PATH[RING_SHADING]);

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
      uAlbedo: { value: RING_SINGLE_SCATTERING_ALBEDO },
      uAsymmetry: { value: RING_ASYMMETRY },
      uFlatRadianceFactor: { value: RING_FLAT_RADIANCE_FACTOR },
      uMaxAlpha: { value: MAX_RING_ALPHA },
      uMinElevation: { value: MIN_ELEVATION_SINE },
      uEquatorialRadius: { value: 1 },
      uPolarRadius: { value: 1 },
      uShadowSoftness: { value: SHADOW_SOFTNESS },
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

/**
 * Chandrasekhar's H-function, in the standard rational approximation.
 *
 * The escape function for isotropic multiple scattering. Two properties earn it its
 * place: it is bounded, with H(0) = 1, and it grows with the single-scattering albedo,
 * so a bright material diffuses more light than a dark one. Both are what the model
 * needed and neither is true of a fitted constant.
 */
export function chandrasekharH(mu: number, albedo = RING_SINGLE_SCATTERING_ALBEDO): number {
  return (1 + 2 * mu) / (1 + 2 * mu * Math.sqrt(1 - albedo));
}

/**
 * The multiply-scattered contribution, in the same geometry factor units as
 * `singleScattering`.
 *
 * Deliberately the same for both faces of the ring: light that has scattered several
 * times has lost any memory of which side it entered from. That symmetry is the whole
 * reason the unlit face stops being black.
 */
export function multipleScattering(
  opticalDepth: number,
  sunElevationSine: number,
  viewElevationSine: number,
  albedo = RING_SINGLE_SCATTERING_ALBEDO,
): number {
  const muSun = Math.max(Math.abs(sunElevationSine), MIN_ELEVATION_SINE);
  const muView = Math.max(Math.abs(viewElevationSine), MIN_ELEVATION_SINE);
  const saturation = 1 - Math.exp(-opticalDepth * (1 / muView + 1 / muSun));

  return (
    (chandrasekharH(muView, albedo) * chandrasekharH(muSun, albedo) - 1) *
    (muSun / (muSun + muView)) *
    saturation
  );
}

/**
 * The ring's radiance factor: what a photometrist would measure, and what the shader
 * computes.
 *
 * Hapke's two-term form. Exported so the model can be checked against published ring
 * photometry in the units that photometry is published in, which is the only way the
 * absolute brightness can be held to anything.
 */
export function ringRadianceFactor(
  opticalDepth: number,
  sunElevationSine: number,
  viewElevationSine: number,
  sameSide: boolean,
  cosPhase = 1,
  albedo = RING_SINGLE_SCATTERING_ALBEDO,
): number {
  const single = Math.max(
    singleScattering(opticalDepth, sunElevationSine, viewElevationSine, sameSide),
    0,
  );
  const multiple = Math.max(
    multipleScattering(opticalDepth, sunElevationSine, viewElevationSine, albedo),
    0,
  );

  return albedo * 0.25 * (henyeyGreenstein(cosPhase) * single + multiple);
}

/**
 * Cosine of the phase angle for a ring seen from directly above, with the Sun at a
 * given elevation above the ring plane.
 *
 * The geometry the screenshots that drove this were taken at, and worth having by name
 * because it is so counter-intuitive: a polar view of the rings is a *high* phase angle
 * whenever the Sun is near their plane, which is when the rings are most likely to be
 * looked at that way.
 */
export function cosPhaseFromAbove(sunElevationSine: number): number {
  return sunElevationSine;
}

/** Normal optical depth implied by a face-on opacity. */
export function opticalDepthFromAlpha(alpha: number): number {
  return -Math.log(Math.max(1 - Math.min(alpha, MAX_RING_ALPHA), 1e-4));
}

/** Apparent opacity of a slab of optical depth `tau` seen at elevation sine `mu`. */
export function apparentOpacity(opticalDepth: number, viewElevationSine: number): number {
  return 1 - Math.exp(-opticalDepth / Math.max(Math.abs(viewElevationSine), MIN_ELEVATION_SINE));
}

/**
 * The same shadow test, in plain TypeScript.
 *
 * Paired with the shader for the same reason `singleScattering` is: a shadow is easy to
 * get subtly wrong — inverted, offset, or the wrong shape on an oblate planet — and
 * every one of those failures looks like a plausible shadow. Testable against the cases
 * whose answers are obvious: the anti-solar point is dark, the sub-solar point is lit,
 * and the shadow is as wide as the planet.
 *
 * `ringPoint` and `toSun` are in the ring's local frame, where the ring lies in z = 0
 * and the planet's polar axis is +z. Radii in the same units as `ringPoint`.
 */
export function sunlitFraction(
  ringPoint: readonly [number, number, number],
  toSun: readonly [number, number, number],
  equatorialRadius: number,
  polarRadius: number,
  softness = SHADOW_SOFTNESS,
): number {
  const p: [number, number, number] = [
    ringPoint[0] / equatorialRadius,
    ringPoint[1] / equatorialRadius,
    ringPoint[2] / polarRadius,
  ];
  const s: [number, number, number] = [
    toSun[0] / equatorialRadius,
    toSun[1] / equatorialRadius,
    toSun[2] / polarRadius,
  ];

  const dot = (a: typeof p, b: typeof p) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const along = dot(p, s);
  if (along >= 0) {
    return 1;
  }

  const perpendicular = Math.sqrt(Math.max(dot(p, p) - (along * along) / dot(s, s), 0));
  // smoothstep, matching the shader.
  const t = Math.min(
    1,
    Math.max(0, (perpendicular - (1 - softness)) / (2 * softness)),
  );
  return t * t * (3 - 2 * t);
}
