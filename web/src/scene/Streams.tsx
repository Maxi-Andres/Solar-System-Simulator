import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { loadStreams, streamParticles, type StreamParticles } from '../core/streams.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { starColor } from './blackbody.ts';
import type { FeatureProps } from './GalaxyFeatures.tsx';
import { drawIntoGlow, GLOW_FLOOR, GLOW_OUTPUT_GLSL, releaseFromGlow } from './glowBuffer.ts';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';
import { SceneLabels } from './sceneLabels.ts';

/**
 * The halo's stellar streams (core/streams.ts): each a faint trail of light along its measured
 * track, a few thousand points scattered across its width, drawn into the glow buffer
 * (glowBuffer.ts) in one draw.
 *
 * Each point is a Gaussian of its size in parsecs, at its distance from the camera: a band's
 * surface brightness is the same from any distance, as a real one's is, until a point is
 * smaller than a pixel -- then its light is kept and spread over the pixel, so a stream far off
 * fades as it narrows, not to a hard line. How bright each stream is against the others is not
 * drawn from anything measured -- galstreams holds no stream's luminosity -- so each is as bright
 * along its length as the next, a wide one dimmer across (STREAM_REF_SIGMA_PC).
 *
 * Shown from out in the galaxy: from among the nearby stars every stream lies across the whole
 * sky, tens of kiloparsecs off, and would be a veil over it. They come in between FADE_FROM_PC
 * and FADE_FULL_PC from the Sun, and are fetched only then.
 */

/** The camera's distance from the Sun over which the streams come in, pc. */
const FADE_FROM_PC = 300;
const FADE_FULL_PC = 2500;
/** And past which they go, pc: from beyond the Local Group they are nothing. */
const FADE_OUT_FROM_PC = 800_000;
const FADE_OUT_GONE_PC = 3_000_000;
/** A point's peak light, white columns: faint, a trail not a road (core/streams.ts, "How bright"). */
export const STREAM_GAIN = 0.018;
/** A point's sigma is never drawn under this, pixels; below it its light is kept, spread. */
const MIN_SIGMA_PX = 1.0;
/**
 * A thin stream's particle sigma, pc (GD-1's, about 40): a wider one's light is spread thinner --
 * by the square root of its width over this, so Sagittarius's three kiloparsecs are dimmer across
 * than GD-1's hundred but not lost. How many stars each holds is not in galstreams.
 */
const STREAM_REF_SIGMA_PC = 40;
/**
 * The colour: an old, metal-poor population's light, B−V about 0.7 -- the halo's turn-off stars
 * and giants (Ibata et al. 2021 select streams' members on such a colour-magnitude locus).
 */
const STREAM_COLOUR_BV = 0.7;
/** A stream's name is shown once it is this long on the screen, pixels; a numbered candidate's, longer. */
const NAMED_PX = 140;
const NUMBERED_PX = 320;

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute float sigmaPc;

  uniform float uUnitsPerPc;
  uniform float uPxPerRadian;
  uniform float uMaxPointPx;
  uniform float uPeak;
  uniform float uRefSigmaPc;

  varying float vSigmaPx;
  varying float vSizePx;
  varying float vPeak;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    #include <logdepthbuf_vertex>
    float distancePc = max(length(view.xyz) / uUnitsPerPc, 1e-3);
    float sigmaPx = sigmaPc / distancePc * uPxPerRadian;
    float drawn = clamp(sigmaPx, ${MIN_SIGMA_PX.toFixed(2)}, uMaxPointPx / 6.0);
    // Below a pixel its light kept: spread over the drawn sigma, the peak falls as the area grows.
    // A wide stream's light spread over its width: dimmer across, as the square root of how
    // much wider than a thin one's it is (STREAM_REF_SIGMA_PC) -- a choice, see the header.
    float peak = uPeak * sqrt(min(1.0, uRefSigmaPc / sigmaPc)) * min(1.0, (sigmaPx * sigmaPx) / (drawn * drawn));
    vSigmaPx = drawn;
    vPeak = peak;
    // Out to where it falls to the glow's floor: no wider than the GPU's largest point.
    float reach = peak > ${GLOW_FLOOR.toPrecision(6)} ? drawn * sqrt(2.0 * log(peak / ${GLOW_FLOOR.toPrecision(6)})) + 1.0 : 0.0;
    vSizePx = min(2.0 * reach, uMaxPointPx);
    gl_PointSize = vSizePx;
    if (vSizePx <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}

  uniform vec3 uColour;

  varying float vSigmaPx;
  varying float vSizePx;
  varying float vPeak;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 offset = (gl_PointCoord - 0.5) * vSizePx;
    float r2 = dot(offset, offset);
    gl_FragColor = glowLight(uColour * vPeak * exp(-0.5 * r2 / (vSigmaPx * vSigmaPx)));
  }
`;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

function logRamp(value: number, gone: number, full: number): number {
  return ramp(Math.log(Math.max(value, 1e-9)), Math.log(gone), Math.log(full));
}

export function Streams({ store, clock, focus, visible, showLabels }: FeatureProps) {
  const { camera, size, gl } = useThree();
  const state = useMemo(
    () => ({
      asked: false,
      particles: null as StreamParticles | null,
      points: null as THREE.Points | null,
      labels: null as SceneLabels | null,
      material: new THREE.ShaderMaterial({
        uniforms: {
          uUnitsPerPc: { value: PARSEC_KM / KM_PER_UNIT },
          uPxPerRadian: { value: 1000 },
          uMaxPointPx: { value: 64 },
          uPeak: { value: 0 },
          uRefSigmaPc: { value: STREAM_REF_SIGMA_PC },
          uColour: { value: new THREE.Vector3(...starColor(STREAM_COLOUR_BV)) },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
      group: new THREE.Group(),
      scratch: new THREE.Vector3(),
      end: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    const range = gl.getContext().getParameter(gl.getContext().ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    state.material.uniforms.uMaxPointPx!.value = Math.min(range?.[1] ?? 64, 256);
  }, [gl, state]);

  useEffect(
    () => () => {
      if (state.points !== null) {
        releaseFromGlow(state.points);
        state.points.geometry.dispose();
        state.group.remove(state.points);
        state.points = null;
      }
      state.labels?.dispose();
      state.labels = null;
      state.material.dispose();
    },
    [state],
  );

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const sun = visible ? store.stateRelativeTo('sun', focus, jd) : null;
    const unitsPerPc = PARSEC_KM / KM_PER_UNIT;
    let fade = 0;
    if (sun !== null) {
      const sx = sun.position.x / KM_PER_UNIT;
      const sy = sun.position.y / KM_PER_UNIT;
      const sz = sun.position.z / KM_PER_UNIT;
      const fromSunPc = Math.hypot(camera.position.x - sx, camera.position.y - sy, camera.position.z - sz) / unitsPerPc;
      fade = logRamp(fromSunPc, FADE_FROM_PC, FADE_FULL_PC) * (1 - logRamp(fromSunPc, FADE_OUT_FROM_PC, FADE_OUT_GONE_PC));
      state.group.position.set(sx, sy, sz);
    }
    if (fade > 0 && !state.asked) {
      state.asked = true;
      void loadStreams().then((file) => {
        if (file === null) return;
        const particles = streamParticles(file);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3));
        geometry.setAttribute('sigmaPc', new THREE.BufferAttribute(particles.sigmas, 1));
        const points = new THREE.Points(geometry, state.material);
        points.frustumCulled = false;
        drawIntoGlow(points);
        state.group.add(points);
        state.points = points;
        state.particles = particles;
        state.labels = new SceneLabels(
          gl.domElement,
          particles.labels.map((label) => label.name),
          'stream',
        );
        renderDemand.request();
      });
    }
    const points = state.points;
    if (points !== null) {
      points.visible = fade > 0;
      state.group.scale.setScalar(unitsPerPc);
      const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
      state.material.uniforms.uPxPerRadian!.value = size.height / fov;
      state.material.uniforms.uPeak!.value = STREAM_GAIN * fade;
    }

    const labels = state.labels;
    const particles = state.particles;
    if (labels === null || particles === null) return;
    if (!showLabels || fade < 0.5) {
      labels.hideAll();
      return;
    }
    state.group.updateMatrixWorld();
    const pxPerRadian = size.height / (((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180);
    particles.labels.forEach((label, index) => {
      // How long it is on the screen, roughly: its two ends' angle apart from the camera.
      const a = state.scratch.set(...label.ends[0]).applyMatrix4(state.group.matrixWorld).sub(camera.position);
      const b = state.end.set(...label.ends[1]).applyMatrix4(state.group.matrixWorld).sub(camera.position);
      const lengthPx = a.angleTo(b) * pxPerRadian;
      const wanted = label.numbered ? NUMBERED_PX : NAMED_PX;
      const opacity = 0.85 * fade * ramp(lengthPx, wanted * 0.6, wanted);
      const at = state.scratch.set(...label.at).applyMatrix4(state.group.matrixWorld);
      labels.place(index, at, camera, size, opacity);
    });
  });

  return <primitive object={state.group} />;
}
