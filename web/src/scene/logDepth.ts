import * as THREE from 'three';

/**
 * The logarithmic depth buffer, measured from the near plane instead of from one unit.
 *
 * three.js writes depth as log2(1 + w) / log2(1 + far), with w the distance in scene
 * units. That spreads precision evenly over orders of magnitude -- for w well above one.
 * Below one it does not: log2(1 + w) is nearly w / ln 2 there, a straight line, and the
 * 24-bit buffer's step becomes a fixed distance rather than a fraction of one. With this
 * scene's unit of 1000 km and the far plane it had then, 1e11 units, that step is
 *
 *   2^-24 * ln 2 * log2(1e11)  =  1.5e-6 units  =  1.5 metres,
 *
 * everywhere within a thousand kilometres of the camera. A planet never noticed. A
 * spacecraft did: JWST's mirror segments sit centimetres in front of their backing
 * structure, and the two flickered through each other in black jagged patches.
 *
 * So w is divided by the near plane first, making the logarithm count from a metre:
 *
 *   depth = log2(1 + w / near) / log2(1 + far / near)
 *
 * Now every distance gets the same relative step, 2^-24 * ln 2 * log2(1 + far / near) of
 * itself -- 3.0e-6 with the far plane below -- and at the planets' distances the buffer
 * behaves as it did under three's own formula.
 *
 * ## The far plane moved for the light years (step D1), and what it cost
 *
 * It was 1e11 units, 1e14 km -- past the star sphere when the camera stopped at 2,000 AU.
 * The camera now pulls back to 3,000 light years (scale.ts), so it is 1e14 units, 1e17 km
 * or 10,570 ly: the farthest zoom with room for a focus a few hundred light years from
 * the Sun. Three decades more range in the logarithm's denominator, log2(1e20) against
 * log2(1e17), and every step grows by that ratio, 66.44 / 56.47 = 1.18:
 *
 *                     far 1e11 (2,000 AU)    far 1e14 (3,000 ly)
 *   at 1 m              4.67 um                5.49 um
 *   at 20 m (JWST)      0.049 mm               0.058 mm
 *   at Earth's radius   14.9 m                 17.5 m
 *   at 1 AU             349 km                 411 km
 *
 * The near plane stays at a metre. Eighteen percent coarser everywhere, and still a
 * hundred times finer than the centimetres JWST's mirror needed.
 *
 * ## And again for the galaxy (step D2b)
 *
 * The camera now pulls back to 400,000 ly (scale.ts), so the far plane is 1e16 units, 1e19
 * km, 1.06 million light years: the zoom, the far side of the disc behind it, and the sky
 * sphere (starRendering.ts) all inside it. log2(1e22) against log2(1e20): another 10 %,
 * 73.08 / 66.44, on every step -- 6.0 um at a metre, 19.2 m at Earth's radius, 452 km at
 * an AU. Still a hundred times finer than JWST's mirror needs. vFragDepth reaches
 * 1 + 5e21, inside float32, and log2 of it, 72.1, has a float32 step of 7.6e-6 -- a
 * relative distance step of 5.3e-6, coarser than the buffer's own only past 2^64 metres
 * as before. And the projection term is still exactly 1 (far / near = 1e22).
 *
 * Two things that might have broken and did not, checked rather than assumed:
 *
 *  - **Float32 in the shader.** vFragDepth reaches 1 + 2.8e13 * 1e6 = 2.8e19, far inside
 *    float32's range. log2 of it is at most 66.4, whose float32 step, 7.6e-6, is a
 *    relative distance step of 5.3e-6 -- coarser than the buffer's own only beyond
 *    2^64 metres, 1,950 ly, where everything drawn is a point.
 *  - **Beyond the far plane.** Nothing is clipped there: with far / near = 1e20, three's
 *    projection term (far + near) / (far - near) is exactly 1 in float64 and in float32,
 *    so clip-space z never reaches w. A star past it writes a depth over 1, which a
 *    fixed-point depth buffer clamps to 1 -- behind every body, which is where it is.
 *
 * Applied by replacing the two shader chunks that compute it, which every built-in
 * material and every custom shader here that includes them picks up. It must run before
 * the first material compiles; importing this module does it.
 */

/** The camera's near plane, scene units: one metre. */
export const CAMERA_NEAR_UNITS = 1e-6;

/** The camera's far plane, scene units: 1e19 km, 1.06 million ly. See the header. */
export const CAMERA_FAR_UNITS = 1e16;

/** The 24-bit depth buffer's smallest step, as a fraction of the buffer's range. */
const DEPTH_STEP = 2 ** -24;

/**
 * The smallest depth difference the buffer resolves at distance `w`, scene units.
 *
 * `fromNear` chooses the formula: true for the one used here, false for three.js's own,
 * kept so the difference can be stated as a number rather than an adjective. `far` lets
 * the table above be checked against the far plane it replaced.
 */
export function depthResolution(w: number, fromNear = true, far = CAMERA_FAR_UNITS): number {
  const scale = fromNear ? 1 / CAMERA_NEAR_UNITS : 1;
  const range = Math.log2(1 + far * scale);
  // d(log2(1 + s w)) / dw = s / ((1 + s w) ln 2), inverted.
  return (DEPTH_STEP * range * Math.LN2 * (1 + scale * w)) / scale;
}

const SCALE = (1 / CAMERA_NEAR_UNITS).toExponential();
const INVERSE_RANGE = (1 / Math.log2(1 + CAMERA_FAR_UNITS / CAMERA_NEAR_UNITS)).toExponential(12);

THREE.ShaderChunk.logdepthbuf_vertex = /* glsl */ `
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER

	// Measured from the near plane, not from one scene unit: see logDepth.ts.
	vFragDepth = 1.0 + gl_Position.w * ${SCALE};
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );

#endif
`;

THREE.ShaderChunk.logdepthbuf_fragment = /* glsl */ `
#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )

	// Doing a strict comparison with == 1.0 can cause noise artifacts
	// on some platforms. See three.js issue #17623.
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * ${INVERSE_RANGE};

#endif
`;
