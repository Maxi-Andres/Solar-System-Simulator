import { REGIME_SHIFT, SAT, SATELLITE_FLOATS, TYPE_SHIFT } from '../core/satellites.ts';
import type { Vec3 } from '../core/vec3.ts';
import { CUBIC_START_E, KEPLER_ITERATIONS, solveKeplerF32 } from './beltShader.ts';

/**
 * The satellites' shaders, and the bulk model in float32 TypeScript.
 *
 * The bulk -- tens of thousands of satellites -- is placed by the GPU every frame from
 * SGP4's mean elements, as the asteroid belt is from its osculating ones (see
 * beltShader.ts): the generator's recipe, in the vertex shader, line for line --
 *
 *   M = M0 + dM·Δt + ddM·Δt²      node = node0 + dNode·Δt      peri = peri0 + dPeri·Δt
 *   ex = e·cos(peri)   ey = e·sin(peri) + ay              (J3's long-period term)
 *   e' = |(ex, ey)|    peri' = atan2(ey, ex)    M' = M + peri − peri'
 *   E − e'·sin E = M'
 *   r_TEME = Rz(node)·Rx(i)·Rz(peri')·(a(cos E − e'), a·sqrt(1 − e'²)·sin E, 0)
 *
 * -- then TEME to the J2000 ecliptic by one matrix for the instant (see teme.ts), and
 * Earth's offset from the focus added, split high and low as the belt adds the Sun's.
 * Per frame the CPU sets a dozen uniforms and touches no satellite.
 *
 * **The GLSL and `bulkPositionF32` below are the same lines**, every float32 rounding the
 * GPU makes written out as a Math.fround, so the tests can hold the shader's arithmetic
 * against the float64 model in satelliteBodies.ts and measure what float32 costs. Change
 * one and change the other.
 *
 * What float32 costs, measured in satelliteShader.test.ts on the ISS against the same
 * model in float64: 6 m at the reference instant, 100 m a day out, 300 m at three days.
 * Δt is the product's problem, as it is the belt's: a LEO mean anomaly moves 97 radians a
 * day, so three days out dM·Δt is 290 rad, where a float32 step is 3e-5 rad -- 0.2 km
 * along the orbit. Against the model's own 3 to 8 km from SGP4 in LEO it is a tenth.
 *
 * Kepler's equation as the belt solves it, the same start and the same four Newton steps:
 * the bulk is near-circular but for the transfer and Molniya orbits, up to e = 0.75, and
 * the belt's solver was measured to e = 0.99999.
 */

const f = Math.fround;
const PI_F32 = f(Math.PI);
const PI2_F32 = f(2 * Math.PI);

/**
 * The dots' look, by SATCAT object type -- payload, rocket body, debris, unknown -- as
 * colour, diameter in CSS pixels, and opacity.
 *
 * **A legibility convention, as the belt's dots are.** The ISS is 109 m across: from
 * 1,000 km it is a fifth of a pixel, and a Starlink a fiftieth. A dot says where an object
 * is, never how big. What the look does say is real: a payload is a warm white, a little
 * larger and stronger; the spent stages and fragments that make up most of the catalogue
 * are smaller and dimmer, the debris a muted red -- so a debris cloud reads as one, and
 * the working satellites stand out of it.
 */
export const SATELLITE_TYPE_COLOR: readonly (readonly [number, number, number])[] = [
  [0.96, 0.89, 0.74], // PAY
  [0.64, 0.62, 0.6], // R/B
  [0.76, 0.5, 0.45], // DEB
  [0.64, 0.62, 0.6], // UNK
];
export const SATELLITE_TYPE_SIZE_PX: readonly number[] = [1.6, 1.2, 1, 1];
export const SATELLITE_TYPE_ALPHA: readonly number[] = [0.9, 0.65, 0.55, 0.6];

/** Slots in the per-chip uniform: room for every chip, and spare. */
export const CHIP_SLOTS = 16;

/** Regimes: LEO, MEO, GEO, HEO, as SATELLITE_REGIMES orders them. */
export const REGIME_SLOTS = 4;

/** Uniforms and varyings both vertex shaders share, and the look they end with. */
const SHARED_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform vec3 uEarthHigh;
  uniform vec3 uEarthLow;
  uniform float uUnitsPerKm;
  uniform float uPixelRatio;
  uniform float uChipVisible[${CHIP_SLOTS}];
  uniform float uRegimeCrowding[${REGIME_SLOTS}];
  uniform float uFade;
  uniform vec3 uTypeColor[4];
  uniform float uTypeSize[4];
  uniform float uTypeAlpha[4];

  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;
  varying vec3 vColor;

  // Off the clip volume, before any work: a dot faded out, hidden, or a body just now.
  void clipAway() {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vAlpha = 0.0;
    vRadiusPx = 0.0;
    vSpritePx = 1.0;
    vColor = vec3(0.0);
  }

  // A point \`km\` from Earth's centre, scene frame: Earth's offset added high first, as
  // the belt adds the Sun's (see beltShader.ts), then drawn by its object type and regime.
  void place(vec3 km, int flags, float shown) {
    vec3 fromFocus = (km + uEarthHigh) + uEarthLow;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(fromFocus * uUnitsPerKm, 1.0);
    #include <logdepthbuf_vertex>
    int regime = (flags >> ${REGIME_SHIFT}) & 3;
    int objectType = (flags >> ${TYPE_SHIFT}) & 3;
    float diameterPx = uTypeSize[objectType] * uPixelRatio;
    vRadiusPx = 0.5 * diameterPx;
    vSpritePx = ceil(diameterPx + 1.0);
    gl_PointSize = vSpritePx;
    vAlpha = uTypeAlpha[objectType] * uRegimeCrowding[regime] * shown;
    vColor = uTypeColor[objectType];
  }
`;

/**
 * The bulk's vertex shader. The record arrives as four attributes over one interleaved
 * buffer, straight from the file (see SatelliteSwarm.tsx): `aShape` a (km), e, i;
 * `aAngles` node, perigee and M at the reference; `aRates` their three rates, rad/day;
 * `aExtra` the drag term, J3's ay and the packed flags. `aChip` is the chip it is drawn
 * under, worked out once on load (see satelliteGroups.ts).
 */
export const BULK_VERTEX_SHADER = /* glsl */ `
  ${SHARED_VERTEX}

  attribute vec3 aShape;
  attribute vec3 aAngles;
  attribute vec3 aRates;
  attribute vec3 aExtra;
  attribute float aChip;

  uniform float uDtDays;
  uniform mat3 uTeme;
  // Records that are bodies of their own just now (see satelliteBodies.ts), or -1.
  uniform int uHidden[2];

  // cubicStartF32() in beltShader.ts.
  float cbrtSigned(float x) {
    return sign(x) * pow(abs(x), 1.0 / 3.0);
  }

  float cubicStart(float M, float e) {
    float P = 6.0 * (1.0 - e) / e;
    float Q = 6.0 * M / e;
    float h = 0.5 * Q;
    float p3 = P / 3.0;
    float D = sqrt(h * h + p3 * p3 * p3);
    return clamp(cbrtSigned(D + h) - cbrtSigned(D - h), -PI, PI);
  }

  void main() {
    float shown = uChipVisible[int(clamp(aChip, 0.0, ${(CHIP_SLOTS - 1).toFixed(1)}) + 0.5)] * uFade;
    if (shown <= 0.0 || gl_VertexID == uHidden[0] || gl_VertexID == uHidden[1]) {
      clipAway();
      return;
    }

    // bulkPositionF32(), below, is these lines in TypeScript.
    float dt = uDtDays;
    float a = aShape.x;
    float e0 = aShape.y;
    float peri0 = aAngles.y + aRates.z * dt;
    float M0 = aAngles.z + aRates.x * dt + aExtra.x * (dt * dt);
    float ex = e0 * cos(peri0);
    float ey = e0 * sin(peri0) + aExtra.y;
    float e = sqrt(ex * ex + ey * ey);
    // atan(0, 0) is undefined in GLSL; a perfectly circular orbit keeps its perigee.
    float peri = e > 0.0 ? atan(ey, ex) : peri0;
    float M = mod(M0 + (peri0 - peri) + PI, PI2) - PI;
    float E = e > ${CUBIC_START_E.toFixed(2)} ? cubicStart(M, e) : M + e * sin(M);
    for (int k = 0; k < ${KEPLER_ITERATIONS}; k++) {
      E = E - (E - e * sin(E) - M) / (1.0 - e * cos(E));
    }
    float xp = a * (cos(E) - e);
    float yp = a * sqrt(1.0 - e * e) * sin(E);

    float node = aAngles.x + aRates.y * dt;
    float cosNode = cos(node);
    float sinNode = sin(node);
    float cosPeri = cos(peri);
    float sinPeri = sin(peri);
    float cosI = cos(aShape.z);
    float sinI = sin(aShape.z);
    vec3 teme = vec3(
      (cosNode * cosPeri - sinNode * sinPeri * cosI) * xp +
        (-cosNode * sinPeri - sinNode * cosPeri * cosI) * yp,
      (sinNode * cosPeri + cosNode * sinPeri * cosI) * xp +
        (-sinNode * sinPeri + cosNode * cosPeri * cosI) * yp,
      sinPeri * sinI * xp + cosPeri * sinI * yp
    );
    place(uTeme * teme, int(aExtra.z + 0.5), shown);
  }
`;

/**
 * The SGP4 tier's vertex shader: placed on the CPU, in float64, and handed over as
 * Earth-centred kilometres in the scene frame; `aInfo` is the chip, the packed flags and
 * an opacity that is zero outside the satellite's window.
 */
export const PLACED_VERTEX_SHADER = /* glsl */ `
  ${SHARED_VERTEX}

  attribute vec3 aInfo;

  void main() {
    float shown = uChipVisible[int(clamp(aInfo.x, 0.0, ${(CHIP_SLOTS - 1).toFixed(1)}) + 0.5)] * uFade * aInfo.z;
    if (shown <= 0.0) {
      clipAway();
      return;
    }
    place(position, int(aInfo.y + 0.5), shown);
  }
`;

/** The belt's soft disc, in each dot's own colour. */
export const SATELLITE_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  varying float vRadiusPx;
  varying float vSpritePx;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - vec2(0.5)) * vSpritePx;
    float coverage = clamp(vRadiusPx + 0.5 - d, 0.0, 1.0);
    if (coverage <= 0.0) {
      discard;
    }
    gl_FragColor = vec4(vColor, vAlpha * coverage);
  }
`;

/**
 * Where bulk record `k` is, `dtDays` (UTC) after the reference, relative to whatever
 * `earthKm` is measured from: the vertex shader, line for line, in float32. `matrix` is
 * TEME to the scene, row-major, float64 -- narrowed here as the upload narrows it. Left
 * out, `earthKm` is zero and the answer is Earth-centred.
 */
export function bulkPositionF32(
  records: Float32Array,
  k: number,
  dtDays: number,
  matrix: Float64Array,
  earthKm: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const base = k * SATELLITE_FLOATS;
  const r = (index: number): number => records[base + index]!;
  const dt = f(dtDays);
  const a = r(SAT.a);
  const e0 = r(SAT.e);
  const peri0 = f(r(SAT.peri) + f(r(SAT.dPeri) * dt));
  const M0 = f(f(r(SAT.M) + f(r(SAT.dM) * dt)) + f(r(SAT.ddM) * f(dt * dt)));
  const ex = f(e0 * f(Math.cos(peri0)));
  const ey = f(f(e0 * f(Math.sin(peri0))) + r(SAT.ay));
  const e = f(Math.sqrt(f(f(ex * ex) + f(ey * ey))));
  const peri = e > 0 ? f(Math.atan2(ey, ex)) : peri0;
  const x = f(f(M0 + f(peri0 - peri)) + PI_F32);
  // GLSL's mod(x, y) is x - y·floor(x / y).
  const M = f(f(x - f(PI2_F32 * Math.floor(f(x / PI2_F32)))) - PI_F32);
  const E = solveKeplerF32(M, e);
  const xp = f(a * f(f(Math.cos(E)) - e));
  const yp = f(f(a * f(Math.sqrt(f(1 - f(e * e))))) * f(Math.sin(E)));

  const node = f(r(SAT.node) + f(r(SAT.dNode) * dt));
  const cosNode = f(Math.cos(node));
  const sinNode = f(Math.sin(node));
  const cosPeri = f(Math.cos(peri));
  const sinPeri = f(Math.sin(peri));
  const cosI = f(Math.cos(r(SAT.i)));
  const sinI = f(Math.sin(r(SAT.i)));
  const teme = [
    f(
      f(f(f(cosNode * cosPeri) - f(f(sinNode * sinPeri) * cosI)) * xp) +
        f(f(f(-cosNode * sinPeri) - f(f(sinNode * cosPeri) * cosI)) * yp),
    ),
    f(
      f(f(f(sinNode * cosPeri) + f(f(cosNode * sinPeri) * cosI)) * xp) +
        f(f(f(-sinNode * sinPeri) + f(f(cosNode * cosPeri) * cosI)) * yp),
    ),
    f(f(f(sinPeri * sinI) * xp) + f(f(cosPeri * sinI) * yp)),
  ] as const;
  const m = Array.from(matrix, (value) => f(value));
  const row = (i: number): number =>
    f(f(f(m[i * 3]! * teme[0]) + f(m[i * 3 + 1]! * teme[1])) + f(m[i * 3 + 2]! * teme[2]));

  // The frame loop's split (see SatelliteSwarm), then the shader's high-first sum.
  const high = [f(earthKm.x), f(earthKm.y), f(earthKm.z)] as const;
  return {
    x: f(f(row(0) + high[0]) + f(earthKm.x - high[0])),
    y: f(f(row(1) + high[1]) + f(earthKm.y - high[1])),
    z: f(f(row(2) + high[2]) + f(earthKm.z - high[2])),
  };
}
