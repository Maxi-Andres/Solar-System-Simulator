import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { FAR_LANDMARKS, farRingRadiusPc, fieldHalfAngle, isBeam, type FarLandmark } from '../core/farLandmarks.ts';
import { RECORD_HOLDER_COLOR, recordHolderPositionKm, recordHoldersFade } from '../core/recordHolders.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore } from '../state/store.ts';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';

/**
 * What a far landmark's mark cannot say (core/farLandmarks.ts): a deep field's beam, from the
 * Sun out to the farthest galaxy confirmed in it, as wide as the field on the sky -- a line of
 * BEAM_SIGMA_PX until its true width is wider -- brightening toward its end, the depth it
 * reaches, and the CMB dipole's, a line from the Sun to its hot pole on the wall, the way the
 * Sun moves; and a large quasar group's extent, a ring of its characteristic size about its
 * mean place -- a structure's of its diameter, the Cold Spot's of its core on the wall --
 * drawn while it is RING_LEAST_PX or more across. Their marks and names are the
 * record-holders' (recordHolders.ts); these go with them: the Observable Universe layer, and
 * recordHoldersFade.
 */

export const BEAM_SIGMA_PX = 0.6;
/** The beam's strength at the Sun's end and at its far end. */
export const BEAM_NEAR = 0.08;
export const BEAM_FAR = 0.6;
export const RING_LEAST_PX = 4;
export const RING_OPACITY = 0.5;

const BEAM_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec2 uViewportPx;
uniform float uPixelsPerRadian;
uniform float uNearUnits;
uniform float uUnitsPerPc;
// x, y, z of its ends, pc from the camera; w each end's true radius, pc.
attribute vec4 aA;
attribute vec4 aB;
attribute float aStrength;
varying float vAcrossPx;
varying float vSigmaPx;
varying float vLight;

void main() {
  vec4 va = modelViewMatrix * vec4(aA.xyz * uUnitsPerPc, 1.0);
  vec4 vb = modelViewMatrix * vec4(aB.xyz * uUnitsPerPc, 1.0);
  float za = -va.z;
  float zb = -vb.z;
  float t = position.x;
  if (za < uNearUnits && zb < uNearUnits) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vLight = 0.0;
    vAcrossPx = 0.0;
    vSigmaPx = 1.0;
    return;
  }
  float ta = 0.0;
  float tb = 1.0;
  if (za < uNearUnits) { ta = (uNearUnits - za) / (zb - za); va = mix(va, vb, ta); }
  else if (zb < uNearUnits) { tb = 1.0 - (uNearUnits - zb) / (za - zb); vb = mix(vb, va, (uNearUnits - zb) / (za - zb)); }
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uViewportPx;
  d = length(d) > 1e-6 ? normalize(d) : vec2(1.0, 0.0);
  bool atA = t < 0.5;
  vec4 clip = atA ? ca : cb;
  float along = atA ? ta : tb;
  float radiusPc = mix(aA.w, aB.w, along);
  float distancePc = max(length((atA ? va : vb).xyz) / uUnitsPerPc, 1.0);
  float sigmaPx = max(${BEAM_SIGMA_PX.toFixed(2)}, radiusPc / distancePc * uPixelsPerRadian * 0.5);
  float halfPx = 3.0 * sigmaPx + 1.0;
  clip.xy += vec2(-d.y, d.x) * position.y * halfPx / (0.5 * uViewportPx) * clip.w;
  gl_Position = clip;
  vLight = aStrength * mix(${BEAM_NEAR.toFixed(2)}, ${BEAM_FAR.toFixed(2)}, along * along) * ${BEAM_SIGMA_PX.toFixed(2)} / sigmaPx;
  vAcrossPx = position.y * halfPx;
  vSigmaPx = sigmaPx;
  #include <logdepthbuf_vertex>
}
`;

const BEAM_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
varying float vAcrossPx;
varying float vSigmaPx;
varying float vLight;

void main() {
  #include <logdepthbuf_fragment>
  float x = vAcrossPx / vSigmaPx;
  float a = vLight * exp(-0.5 * x * x);
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

const RING_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec2 uViewportPx;
uniform float uPixelsPerRadian;
uniform float uUnitsPerPc;
// Its centre, pc from the camera; w its radius, pc.
attribute vec4 aCentre;
attribute float aStrength;
varying vec2 vOffsetPx;
varying float vRadiusPx;
varying float vLight;

void main() {
  vec4 centre = projectionMatrix * modelViewMatrix * vec4(aCentre.xyz * uUnitsPerPc, 1.0);
  float distancePc = length(aCentre.xyz);
  float radiusPx = atan(aCentre.w, distancePc) * uPixelsPerRadian;
  if (centre.w <= 0.0 || radiusPx < ${RING_LEAST_PX.toFixed(1)} || distancePc < aCentre.w) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vOffsetPx = vec2(0.0);
    vRadiusPx = 1.0;
    vLight = 0.0;
    return;
  }
  vOffsetPx = position.xy * (radiusPx + 2.0);
  vRadiusPx = radiusPx;
  vLight = aStrength * smoothstep(${RING_LEAST_PX.toFixed(1)}, ${(2 * RING_LEAST_PX).toFixed(1)}, radiusPx);
  gl_Position = vec4(centre.xy + vOffsetPx * 2.0 / uViewportPx * centre.w, centre.zw);
  #include <logdepthbuf_vertex>
}
`;

const RING_FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
varying vec2 vOffsetPx;
varying float vRadiusPx;
varying float vLight;

void main() {
  #include <logdepthbuf_fragment>
  float r = length(vOffsetPx);
  float ring = 1.0 - smoothstep(0.0, 1.0, abs(r - vRadiusPx));
  float a = vLight * ring;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

const beams = FAR_LANDMARKS.filter(isBeam);
const groups = FAR_LANDMARKS.filter((l) => farRingRadiusPc(l, 1) !== null);

/** Each landmark's place, pc from the Sun, scene frame. */
function placePc(landmark: FarLandmark): [number, number, number] {
  const p = recordHolderPositionKm(landmark);
  return [p.x / PARSEC_KM, p.y / PARSEC_KM, p.z / PARSEC_KM];
}

export interface FarLandmarksProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
}

const noRaycast = (): void => {};
const scratchSize = new THREE.Vector2();

export function FarLandmarks({ store, clock, focus }: FarLandmarksProps) {
  const visible = useViewStore((s) => s.layers.observableUniverse);
  useEffect(() => renderDemand.request(), [visible]);
  const color = useMemo(() => new THREE.Color().setStyle(RECORD_HOLDER_COLOR, THREE.LinearSRGBColorSpace), []);
  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uPixelsPerRadian: { value: 1 },
      uNearUnits: { value: 1e-6 },
      uUnitsPerPc: { value: UNITS_PER_PC },
      uColor: { value: color },
    }),
    [color],
  );
  const built = useMemo(() => {
    const ends = beams.map(placePc);
    const centres = groups.map(placePc);
    const beamGeometry = new THREE.InstancedBufferGeometry();
    beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    beamGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(beams.length * 4), 4);
    const b = new THREE.InstancedBufferAttribute(new Float32Array(beams.length * 4), 4);
    a.setUsage(THREE.DynamicDrawUsage);
    b.setUsage(THREE.DynamicDrawUsage);
    beamGeometry.setAttribute('aA', a);
    beamGeometry.setAttribute('aB', b);
    beamGeometry.setAttribute('aStrength', new THREE.InstancedBufferAttribute(new Float32Array(beams.length), 1));
    beamGeometry.instanceCount = beams.length;
    const beamMesh = new THREE.Mesh(
      beamGeometry,
      new THREE.ShaderMaterial({ uniforms, vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    const ringGeometry = new THREE.InstancedBufferGeometry();
    ringGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    ringGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const centre = new THREE.InstancedBufferAttribute(new Float32Array(groups.length * 4), 4);
    centre.setUsage(THREE.DynamicDrawUsage);
    ringGeometry.setAttribute('aCentre', centre);
    ringGeometry.setAttribute('aStrength', new THREE.InstancedBufferAttribute(new Float32Array(groups.length), 1));
    ringGeometry.instanceCount = groups.length;
    const ringMesh = new THREE.Mesh(
      ringGeometry,
      new THREE.ShaderMaterial({ uniforms, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    for (const mesh of [beamMesh, ringMesh]) {
      mesh.frustumCulled = false;
      mesh.raycast = noRaycast;
      mesh.renderOrder = 3;
    }
    const group = new THREE.Group();
    group.add(beamMesh, ringMesh);
    group.visible = false;
    return { group, ends, centres, beamGeometry, ringGeometry, beamMesh, ringMesh, a, b, centre };
  }, [uniforms]);
  useEffect(
    () => () => {
      built.beamGeometry.dispose();
      built.ringGeometry.dispose();
      (built.beamMesh.material as THREE.Material).dispose();
      (built.ringMesh.material as THREE.Material).dispose();
    },
    [built],
  );

  useFrame(({ camera, gl: renderer }) => {
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
    const fade = visible && sun !== null ? recordHoldersFade(Math.hypot(camera.position.x * KM_PER_UNIT - sun.position.x, camera.position.y * KM_PER_UNIT - sun.position.y, camera.position.z * KM_PER_UNIT - sun.position.z)) : 0;
    built.group.visible = fade > 0;
    if (sun === null || fade <= 0) return;
    built.group.position.copy(camera.position);
    built.group.updateMatrixWorld();
    // The Sun, pc from the camera.
    const sx = (sun.position.x - camera.position.x * KM_PER_UNIT) / PARSEC_KM;
    const sy = (sun.position.y - camera.position.y * KM_PER_UNIT) / PARSEC_KM;
    const sz = (sun.position.z - camera.position.z * KM_PER_UNIT) / PARSEC_KM;
    const a = built.a.array as Float32Array;
    const b = built.b.array as Float32Array;
    const strength = built.beamGeometry.getAttribute('aStrength').array as Float32Array;
    beams.forEach((landmark, i) => {
      const end = built.ends[i]!;
      a.set([sx, sy, sz, 0], i * 4);
      const extent = landmark.extent;
      const halfAngle = extent.kind === 'field' ? fieldHalfAngle(extent.areaArcmin2) : 0;
      b.set([sx + end[0], sy + end[1], sz + end[2], Math.hypot(end[0], end[1], end[2]) * Math.tan(halfAngle)], i * 4);
      strength[i] = fade;
    });
    built.a.needsUpdate = true;
    built.b.needsUpdate = true;
    built.beamGeometry.getAttribute('aStrength').needsUpdate = true;
    const c = built.centre.array as Float32Array;
    const ringStrength = built.ringGeometry.getAttribute('aStrength').array as Float32Array;
    groups.forEach((landmark, i) => {
      const at = built.centres[i]!;
      const radiusPc = farRingRadiusPc(landmark, Math.hypot(at[0], at[1], at[2])) ?? 0;
      c.set([sx + at[0], sy + at[1], sz + at[2], radiusPc], i * 4);
      ringStrength[i] = fade * RING_OPACITY;
    });
    built.centre.needsUpdate = true;
    built.ringGeometry.getAttribute('aStrength').needsUpdate = true;
    const size = renderer.getDrawingBufferSize(scratchSize);
    (uniforms['uViewportPx']!.value as THREE.Vector2).copy(size);
    uniforms['uPixelsPerRadian']!.value = size.y / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
    uniforms['uNearUnits']!.value = (camera as THREE.PerspectiveCamera).near;
  });

  return <primitive object={built.group} />;
}
