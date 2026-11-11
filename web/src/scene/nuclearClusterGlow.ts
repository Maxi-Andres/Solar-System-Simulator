import * as THREE from 'three';

import { CLUSTER_EDGE_PC, FLATTENING, NUKER, SAMPLE_FLOOR_MV, SAMPLE_LIMIT_V } from '../core/nuclearCluster.ts';
import {
  FAINT_TABLE,
  FAINT_TABLE_FROM,
  FAINT_TABLE_SIZE,
  FAINT_TABLE_STEP,
  GLOW_STEPS,
  luminosityDensity,
  POPULATION_COLOUR_INDEX,
} from '../core/nuclearClusterLight.ts';
import { starColor } from './blackbody.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { MIN_SIGMA_PX } from './LocalGroup.tsx';

/**
 * The nuclear star cluster's glow (core/nuclearClusterLight.ts): the light of its stars too
 * faint to be drawn, integrated along each pixel's line of sight through the model, and, once
 * the cluster is too small on the screen for its lines of sight to find it, a point holding
 * that light, as a galaxy's is (LocalGroup.tsx).
 *
 * The volume is a quad over the whole screen, drawn first and added, as the Milky Way's glow
 * is (MilkyWay.tsx): every pixel's ray from the camera through the model's ellipsoid, the
 * luminosity density times the share of it in stars fainter than those drawn at each point
 * (the faint-light table, by the limit there: from the camera, and the sample's from the
 * hole), stepped evenly in v about the ray's nearest approach to the hole as column() is.
 * The black hole's shadow is opaque and drawn after it, so the light behind the hole does not
 * show through; the glow is not lensed -- surface brightness is conserved by a lens, and the
 * glow has no detail for it to bend.
 */

/** The density law in GLSL, normalised to the model's light: L_Sun per cubic parsec. */
const DENSITY_GLSL = /* glsl */ `
float luminosityDensity(float m) {
  float x = max(m, 1e-7) / ${NUKER.breakPc.toFixed(4)};
  return ${(luminosityDensity(NUKER.breakPc) / (2 ** ((NUKER.gamma - NUKER.beta) / NUKER.alpha))).toExponential(8)}
    * pow(x, ${(-NUKER.gamma).toFixed(4)})
    * pow(1.0 + pow(x, ${NUKER.alpha.toFixed(1)}), ${((NUKER.gamma - NUKER.beta) / NUKER.alpha).toFixed(6)});
}
`;

const LOG10_2 = 0.3010299956639812;

export const GLOW_VERTEX = /* glsl */ `
// The view's half-widths, tan of half the field each way; the camera's turn.
uniform vec2 uTanHalf;
uniform mat3 uCameraRotation;
varying vec3 vDirection;
void main() {
  vDirection = uCameraRotation * vec3(position.xy * uTanHalf, -1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uCamera;
uniform vec3 uAxisX;
uniform vec3 uAxisY;
uniform vec3 uAxisZ;
// The colour times the share drawn and the dust's transmission, over the white column.
uniform vec3 uLight;
// The faintest M_V drawn from 10 pc (the picture's limit less the dust and the exposure),
// and the sample's cut from the hole and floor; uSampled 0 until the sample is in.
uniform float uLimitAt10Pc;
uniform float uSampled;
uniform float uFaint[${FAINT_TABLE_SIZE}];
varying vec3 vDirection;

${DENSITY_GLSL}

float log10f(float x) {
  return log2(x) * ${LOG10_2.toFixed(12)};
}

float faintShare(float limit) {
  float t = clamp((limit - ${FAINT_TABLE_FROM.toFixed(3)}) / ${FAINT_TABLE_STEP.toFixed(3)}, 0.0, ${(FAINT_TABLE_SIZE - 1).toFixed(1)});
  int k = min(int(floor(t)), ${FAINT_TABLE_SIZE - 2});
  return mix(uFaint[k], uFaint[k + 1], t - float(k));
}

void main() {
  vec3 u = normalize(vDirection);
  vec3 c = vec3(dot(uCamera, uAxisX), dot(uCamera, uAxisY), dot(uCamera, uAxisZ));
  vec3 d = vec3(dot(u, uAxisX), dot(u, uAxisY), dot(u, uAxisZ));
  // The ellipsoid as a sphere: its minor axis stretched by 1 / q.
  vec3 cs = vec3(c.xy, c.z / ${FLATTENING.toFixed(4)});
  vec3 ds = vec3(d.xy, d.z / ${FLATTENING.toFixed(4)});
  float a = dot(ds, ds);
  float half_ = dot(cs, ds);
  float cc = dot(cs, cs);
  float disc = half_ * half_ - a * (cc - ${(CLUSTER_EDGE_PC * CLUSTER_EDGE_PC).toFixed(4)});
  if (disc <= 0.0) discard;
  float root = sqrt(disc);
  float t0 = max(0.0, (-half_ - root) / a);
  float t1 = (-half_ + root) / a;
  if (t1 <= t0) discard;
  float tStar = -half_ / a;
  float b = max(sqrt(max(cc - half_ * half_ / a, 0.0)), 1e-6);
  float s = b / sqrt(a);
  float v0 = asinh((t0 - tStar) / s);
  float v1 = asinh((t1 - tStar) / s);
  float dv = (v1 - v0) / ${GLOW_STEPS.toFixed(1)};
  float sum = 0.0;
  for (int k = 0; k < ${GLOW_STEPS}; k += 1) {
    float v = v0 + (float(k) + 0.5) * dv;
    float t = tStar + s * sinh(v);
    float radius = length(c + t * d);
    float fromCamera = uLimitAt10Pc - 5.0 * (log10f(max(t, 1e-9)) - 1.0);
    float fromHole = max(${SAMPLE_FLOOR_MV.toFixed(3)}, ${SAMPLE_LIMIT_V.toFixed(3)} - 5.0 * (log10f(max(radius, 1e-9)) - 1.0));
    float limit = uSampled > 0.5 ? min(fromCamera, fromHole) : -100.0;
    sum += luminosityDensity(b * cosh(v)) * faintShare(limit) * s * cosh(v);
  }
  vec3 x = uLight * sum * dv;
  vec3 light = 1.0 - exp(-x);
  if (max(light.r, max(light.g, light.b)) < 0.0005) discard;
  // Half a display step of noise: a faint gradient in 8 bits is otherwise rings.
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(max(light + (n - 0.5) / 255.0, 0.0), 1.0);
}
`;

/** The point, as GlobularClusters.tsx's: a Gaussian of the half-light radius, through the shoulder. */
export const POINT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uCamera;
uniform float uUnitsPerPc;
uniform float uPixelsPerRadian;
uniform float uHalfLightPc;
uniform float uMinSigmaPx;
// The colour times the luminosity drawn as the point, over the white column.
uniform vec3 uLight;
varying vec3 vPeak;
varying float vSigmaPx;
varying float vSizePx;

void main() {
  vec3 rel = -uCamera;
  float distancePc = length(rel);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(rel * uUnitsPerPc, 1.0);
  #include <logdepthbuf_vertex>
  float sigmaPx = max(uMinSigmaPx, uHalfLightPc / distancePc * uPixelsPerRadian / 1.1774);
  float sigmaPc = sigmaPx / uPixelsPerRadian * distancePc;
  vPeak = uLight / (6.2831853 * sigmaPc * sigmaPc);
  vSigmaPx = sigmaPx;
  vSizePx = ceil(6.0 * sigmaPx) + 1.0;
  gl_PointSize = vSizePx;
}
`;

export const POINT_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vPeak;
varying float vSigmaPx;
varying float vSizePx;

void main() {
  #include <logdepthbuf_fragment>
  vec2 offset = (gl_PointCoord - 0.5) * vSizePx;
  vec3 x = vPeak * exp(-0.5 * dot(offset, offset) / (vSigmaPx * vSigmaPx));
  vec3 light = 1.0 - exp(-x);
  if (max(light.r, max(light.g, light.b)) < 0.0005) discard;
  gl_FragColor = vec4(light, 1.0);
}
`;

/** The population's colour, linear, at unit luminance. */
export const GLOW_COLOUR = new THREE.Vector3(...starColor(POPULATION_COLOUR_INDEX));

export interface ClusterGlow {
  readonly volume: THREE.Mesh;
  readonly point: THREE.Points;
  readonly volumeUniforms: Record<string, THREE.IUniform>;
  readonly pointUniforms: Record<string, THREE.IUniform>;
  dispose(): void;
}

export function makeClusterGlow(unitsPerPc: number): ClusterGlow {
  const { x, y, z } = GALACTIC_BASIS;
  const volumeUniforms: Record<string, THREE.IUniform> = {
    uTanHalf: { value: new THREE.Vector2(1, 1) },
    uCameraRotation: { value: new THREE.Matrix3() },
    uCamera: { value: new THREE.Vector3() },
    uAxisX: { value: new THREE.Vector3(x.x, x.y, x.z) },
    uAxisY: { value: new THREE.Vector3(y.x, y.y, y.z) },
    uAxisZ: { value: new THREE.Vector3(z.x, z.y, z.z) },
    uLight: { value: new THREE.Vector3() },
    uLimitAt10Pc: { value: 0 },
    uSampled: { value: 0 },
    uFaint: { value: Array.from(FAINT_TABLE) },
  };
  const volume = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: volumeUniforms,
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      // With the opaque things, first, as the Milky Way's glow (MilkyWay.tsx): the hole's
      // black and anything else opaque is drawn over it.
      transparent: false,
      toneMapped: false,
    }),
  );
  volume.frustumCulled = false;
  volume.renderOrder = -2;
  volume.visible = false;

  const pointUniforms: Record<string, THREE.IUniform> = {
    uCamera: volumeUniforms['uCamera']!,
    uUnitsPerPc: { value: unitsPerPc },
    uPixelsPerRadian: { value: 1 },
    uHalfLightPc: { value: 1 },
    // LocalGroup.tsx's, read here rather than at load: the two modules import each other's
    // neighbours, and at load it may not be there yet.
    uMinSigmaPx: { value: MIN_SIGMA_PX },
    uLight: { value: new THREE.Vector3() },
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const point = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: pointUniforms,
      vertexShader: POINT_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  point.frustumCulled = false;
  point.visible = false;

  return {
    volume,
    point,
    volumeUniforms,
    pointUniforms,
    dispose() {
      volume.geometry.dispose();
      (volume.material as THREE.Material).dispose();
      point.geometry.dispose();
      (point.material as THREE.Material).dispose();
    },
  };
}
