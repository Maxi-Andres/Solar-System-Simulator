import * as THREE from 'three';

/**
 * The logarithmic depth buffer, measured from the near plane instead of from one unit.
 *
 * three.js writes depth as log2(1 + w) / log2(1 + far), with w the distance in scene
 * units. That spreads precision evenly over orders of magnitude -- for w well above one.
 * Below one it does not: log2(1 + w) is nearly w / ln 2 there, a straight line, and the
 * 24-bit buffer's step becomes a fixed distance rather than a fraction of one. With this
 * scene's unit of 1000 km and far plane of 1e11 units, that step is
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
 * Now every distance gets the same relative step, 2^-24 * ln 2 * log2(1e17) = 2.3e-6
 * of itself -- 0.05 mm at 20 metres, 2 km at a light-hour -- and at the planets'
 * distances the buffer behaves exactly as before.
 *
 * Applied by replacing the two shader chunks that compute it, which every built-in
 * material and every custom shader here that includes them picks up. It must run before
 * the first material compiles; importing this module does it.
 */

/** The camera's near plane, scene units: one metre. */
export const CAMERA_NEAR_UNITS = 1e-6;

/** The camera's far plane, scene units: 1e14 km, past the star sphere. */
export const CAMERA_FAR_UNITS = 1e11;

/** The 24-bit depth buffer's smallest step, as a fraction of the buffer's range. */
const DEPTH_STEP = 2 ** -24;

/**
 * The smallest depth difference the buffer resolves at distance `w`, scene units.
 *
 * `fromNear` chooses the formula: true for the one used here, false for three.js's own,
 * kept so the difference can be stated as a number rather than an adjective.
 */
export function depthResolution(w: number, fromNear = true): number {
  const scale = fromNear ? 1 / CAMERA_NEAR_UNITS : 1;
  const range = Math.log2(1 + CAMERA_FAR_UNITS * scale);
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
