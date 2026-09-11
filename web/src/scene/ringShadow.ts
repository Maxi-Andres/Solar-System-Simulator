import * as THREE from 'three';

/**
 * The shadow the rings cast back onto the planet.
 *
 * The other half of the pair: `ringMaterial.ts` already blocks the Sun where the planet
 * stands in front of the rings, and this blocks it where the rings stand in front of the
 * planet. Together they are what makes a picture of Saturn read as a solid body and a
 * disc in the same space rather than two sprites in front of each other.
 *
 * ## How
 *
 * For a point on the planet's surface, walk toward the Sun and see whether the ray
 * crosses the ring plane inside the rings. In the body's own frame the ring plane is
 * simply `y = 0` and the pole is `+y`, so the crossing is one division:
 *
 *   t = -P.y / sunLocal.y,  and the crossing point is P + t * sunLocal
 *
 * A negative `t` means the ring plane is behind you as seen from the Sun and cannot
 * shadow anything — which is exactly why the shadow falls on the winter hemisphere and
 * not the summer one, with no special case needed to say so.
 *
 * ## How much light gets through
 *
 * The map's face-on opacity, and it took a wrong turn to land there.
 *
 * The physically exact answer is the slant path: sunlight crosses the rings at the solar
 * elevation, so the beam that survives is `exp(-tau / mu0)`, and at 2026's 7 degrees that
 * path is eight times the thickness. That is what this did first, and it made the shadow
 * **three and a half times too wide** — 10% of Saturn's disc against the 2.8% the
 * reference shows.
 *
 * The reason is worth understanding, because the formula was not the problem. Dividing by
 * `mu0` multiplies the optical depth by eight, and the optical depth here is not a
 * measurement: it is `-ln(1 - alpha)` of an artist's opacity map. Checked against
 * published values, that map gives the C ring tau 0.27 to 0.63 where the real C ring is
 * 0.05 to 0.15 — too dense by about four times. Face-on, a 4x error in a sparse ring is
 * a barely visible difference. Amplified eightfold by the slant path, it turns the C and
 * A rings into near-opaque screens, and their shadows join the B ring's into one broad
 * band. NASA's narrow shadow is the B ring's alone; the sparse rings barely register.
 *
 * So the slant path is applying a precision the data cannot carry, and using the map's
 * alpha directly is both simpler and closer to the truth. It is also what the rings
 * themselves are drawn with, which makes the two consistent: a band that looks half
 * transparent blocks half the light.
 *
 * ## But a ring shadow is not black
 *
 * The unscattered beam is not the only light reaching the shadowed band, and taking it
 * as the whole answer was the first version's mistake: it rendered the shadow at 3% of
 * the lit surface where the reference shows 26%. A solid black stripe also reads as
 * *wider* than it is — the width was right to within a percent of the planet's diameter,
 * and it still looked far too heavy.
 *
 * Two real effects are missing from `exp(-tau / mu0)`, and both push the same way:
 *
 *  - **Diffusely transmitted light.** Photons that scatter inside the rings rather than
 *    being absorbed still come out the other side. It is the same multiple scattering
 *    that makes the unlit face of the rings glow rather than go black.
 *  - **Ringshine.** The lit rings are a large, bright object filling much of the
 *    shadowed band's sky, and they light it.
 *
 * `SHADOW_FLOOR` stands in for both. Like the ring brightness itself it is calibrated
 * against the reference rather than derived — see the constant.
 */

/**
 * Light reaching the deepest part of a ring shadow, as a fraction of full sunlight.
 *
 * Stands in for diffusely transmitted light and ringshine together, neither of which is
 * modelled anywhere else. Calibrated rather than derived: measured off a NASA Eyes
 * close-up, the ring shadow band keeps 26% of the lit surface's brightness on average
 * and 17% at its darkest. Through this renderer's tone curve those are transmissions of
 * 0.120 and 0.077.
 *
 * It started at 0.05, set when the shadow still used the raw map opacity and the densest
 * ring passed only 5% of the beam. Correcting that opacity toward a real optical depth
 * — see SHADOW_OPACITY_EXPONENT — raised what the B ring passes on its own to 12%, which
 * is already most of what this constant was standing in for. Leaving it at 0.05 was
 * counting the same light twice, and the shadow came out at 0.164, lighter than anything
 * measured on the reference.
 *
 * So it is now a small residual on top of a transmission that is doing the work itself.
 * The deepest shadow lands at 0.131, just past the top of the measured range, which is
 * where Maxi asked for it by eye.
 *
 * Deriving it would mean solving for the diffuse field inside the rings and integrating
 * the lit rings as an area light over the planet's sky. Both are worth doing alongside
 * the ring photometry itself; see the note at the top of ringMaterial.ts.
 */
export const SHADOW_FLOOR = 0.012;

/**
 * Exponent correcting the map's opacity toward a real optical depth, for shadowing.
 *
 * The ring map is an artist's opacity: tuned so the rings *read* solid, not so they
 * block the right fraction of light. Checked against published ring optical depths it
 * over-states everything sparse, and the sparse rings are most of the ring system's
 * width — so their shadows joined the B ring's into one broad band, three and a half
 * times wider than the reference.
 *
 * Raising the opacity to a power fixes that, and it is not a fudge: one exponent
 * recovers all four published values from the same map.
 *
 *   region                  map     real    map^2.5
 *   C ring    (tau 0.10)    0.329   0.095   0.062
 *   B ring    (tau 2.00)    0.914   0.865   0.798
 *   Cassini   (tau 0.10)    0.431   0.095   0.122
 *   A ring    (tau 0.50)    0.686   0.393   0.390
 *
 * The A ring lands within a percent and the B ring within eight; the two sparse regions
 * are the right order where the raw map was four times too dense.
 *
 * Applied to shadowing only. The rings are still *drawn* from the raw opacity, because
 * there the map is doing the job it was drawn for.
 */
export const SHADOW_OPACITY_EXPONENT = 2.5;

/**
 * Final depth calibration: a gain on the corrected opacity, clamped at fully opaque.
 *
 * Deliberately a separate knob from the exponent above, because the two do different
 * jobs and the exponent's is anchored. The exponent sets the *shape* of the shadow --
 * which rings block and which do not -- and it is pinned to published optical depths, so
 * turning it to chase a depth would immediately undo the width fix it exists for. This
 * only sets how dark the darkest part gets.
 *
 * The value looks trivially small and is not. Transmission is `1 - blocked`, and at the
 * B ring `blocked` is already 0.880, so the answer is a difference between two nearly
 * equal numbers: a 3% gain on the opacity is a 20% change in the light that gets
 * through. That sensitivity is the reason this is a named constant with its own
 * explanation rather than a digit folded into the exponent, where it would look like
 * part of the physical anchor and quietly poison it.
 *
 * The sparse rings barely notice -- the C ring goes from passing 93.9% to 93.8% -- which
 * is exactly the point: it deepens the dark core without widening the band.
 *
 * Calibrated by eye against NASA Eyes, in two steps of 20% each. The result, 0.105, is
 * inside the 0.077 to 0.120 measured off their close-up, which the first guess was not.
 */
export const SHADOW_OPACITY_GAIN = 1.03;

/**
 * Fraction of sunlight reaching a point on the planet, 0 fully shadowed to 1 unshadowed.
 *
 * The TypeScript twin of the shader below, so the geometry can be tested against cases
 * with obvious answers rather than inspected by eye. `surfacePoint` and the radii are in
 * the same units; `sunDirection` is a unit vector. Both are in the body-fixed frame
 * where the pole is +y.
 */
export function ringShadowTransmission(
  surfacePoint: readonly [number, number, number],
  sunDirection: readonly [number, number, number],
  innerRadius: number,
  outerRadius: number,
  opticalDepthAt: (radius: number) => number,
): number {
  const [px, py, pz] = surfacePoint;
  const [sx, sy, sz] = sunDirection;

  // Sun in the ring plane: the rays never cross it, so nothing is shadowed. Also the
  // division below would be meaningless.
  if (Math.abs(sy) < 1e-6) {
    return 1;
  }

  const t = -py / sy;
  // The ring plane is behind the point as seen from the Sun.
  if (t <= 0) {
    return 1;
  }

  const crossingX = px + t * sx;
  const crossingZ = pz + t * sz;
  const radius = Math.hypot(crossingX, crossingZ);
  if (radius < innerRadius || radius > outerRadius) {
    return 1;
  }

  // Face-on rather than along the slant path: see the note above. The map's optical
  // depth is an artist's opacity, and the slant path amplifies its error eightfold.
  const mapOpacity = 1 - Math.exp(-opticalDepthAt(radius));
  const blocked = Math.min(
    1,
    Math.pow(mapOpacity, SHADOW_OPACITY_EXPONENT) * SHADOW_OPACITY_GAIN,
  );

  return SHADOW_FLOOR + (1 - SHADOW_FLOOR) * (1 - blocked);
}

/**
 * GLSL for the same test, injected into the planet's standard material.
 *
 * `uRingShadowMap` being unset is a normal state, not an error: the ring map loads
 * lazily, so the planet is drawn unshadowed until it arrives. `uRingShadowStrength`
 * carries that, going from 0 to 1 when the texture is ready, which also means the
 * shadow fades in rather than appearing between one frame and the next.
 */
export const RING_SHADOW_GLSL = /* glsl */ `
uniform sampler2D uRingShadowMap;
uniform vec3 uRingShadowSunLocal;
uniform float uRingShadowInner;
uniform float uRingShadowOuter;
uniform float uRingShadowStrength;
uniform float uRingShadowMaxAlpha;
uniform float uRingShadowFloor;
uniform float uRingShadowExponent;
uniform float uRingShadowGain;
varying vec3 vRingShadowPosition;

float ringShadowTransmission() {
  if (uRingShadowStrength <= 0.0) {
    return 1.0;
  }

  float sunY = uRingShadowSunLocal.y;
  if (abs(sunY) < 1.0e-6) {
    return 1.0;
  }

  float t = -vRingShadowPosition.y / sunY;
  if (t <= 0.0) {
    return 1.0;
  }

  vec2 crossing = vRingShadowPosition.xz + t * uRingShadowSunLocal.xz;
  float radius = length(crossing);
  if (radius < uRingShadowInner || radius > uRingShadowOuter) {
    return 1.0;
  }

  float u = (radius - uRingShadowInner) / (uRingShadowOuter - uRingShadowInner);
  float alphaNormal = min(texture2D(uRingShadowMap, vec2(u, 0.5)).a, uRingShadowMaxAlpha);

  // Face-on, not along the slant path, and corrected toward a real optical depth: the
  // map is an artist's opacity and over-states everything sparse. Between them those
  // two were making the shadow three and a half times too wide. See the note at the
  // top of ringShadow.ts.
  float blocked = min(1.0, pow(alphaNormal, uRingShadowExponent) * uRingShadowGain);
  float transmission = uRingShadowFloor + (1.0 - uRingShadowFloor) * (1.0 - blocked);
  return mix(1.0, transmission, uRingShadowStrength);
}
`;

export interface RingShadowUniforms {
  readonly uRingShadowMap: { value: THREE.Texture | null };
  readonly uRingShadowSunLocal: { value: THREE.Vector3 };
  readonly uRingShadowInner: { value: number };
  readonly uRingShadowOuter: { value: number };
  readonly uRingShadowStrength: { value: number };
  readonly uRingShadowMaxAlpha: { value: number };
  readonly uRingShadowFloor: { value: number };
  readonly uRingShadowExponent: { value: number };
  readonly uRingShadowGain: { value: number };
}

/**
 * Teaches a planet's material to be shadowed by its own rings.
 *
 * Patches `MeshStandardMaterial` through `onBeforeCompile`, which is the pragmatic
 * choice and not a free one: it means reaching into three.js's own lighting chunk and
 * replacing a line of it by string match. Written as one narrow, asserted replacement
 * rather than a broad one so that a three.js upgrade that moves the line fails loudly
 * here instead of silently dropping the shadow. A test pins the same string.
 *
 * The alternative was a bespoke material for the planet, which would have meant
 * reimplementing the whole standard lighting model to change one multiplication.
 */
export function applyRingShadow(
  material: THREE.MeshStandardMaterial,
  uniforms: RingShadowUniforms,
  polarFlattening: number,
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRingShadowPosition;
        uniform float uRingShadowFlattening;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // The body-fixed position in real proportions. The mesh carries the polar
        // flattening as a scale, which the raw attribute does not, so it is applied
        // here -- otherwise the shadow would be cast onto a sphere while the planet
        // drawn beneath it is an ellipsoid.
        vRingShadowPosition = vec3(position.x, position.y * uRingShadowFlattening, position.z);`,
      );

    shader.uniforms.uRingShadowFlattening = { value: polarFlattening };

    const LIGHT_HOOK = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
    const lighting = THREE.ShaderChunk.lights_fragment_begin;
    if (!lighting.includes(LIGHT_HOOK)) {
      throw new Error(
        'three.js moved the point light hook; ring shadows need a new injection point.',
      );
    }

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${RING_SHADOW_GLSL}`)
      .replace(
        '#include <lights_fragment_begin>',
        lighting.replace(
          LIGHT_HOOK,
          `${LIGHT_HOOK}
        // The rings, between this point and the Sun. Applied to the direct light only:
        // the ambient fill in the Flood and Shadow modes is a legibility aid, not
        // sunlight, so a ring has no business blocking it.
        directLight.color *= ringShadowTransmission();`,
        ),
      );
  };

  // Materials are cached by their compiled program; changing onBeforeCompile after a
  // material has been used needs this to force a rebuild.
  material.needsUpdate = true;
}

/** The GLSL line the patch depends on, exported so a test can pin it. */
export const POINT_LIGHT_HOOK =
  'getPointLightInfo( pointLight, geometryPosition, directLight );';
