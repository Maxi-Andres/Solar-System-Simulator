import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { CAMERA_FAR_UNITS, CAMERA_NEAR_UNITS, depthResolution } from './logDepth.ts';
import { kmToUnits } from './scale.ts';

const METRE = kmToUnits(0.001);

describe('the logarithmic depth buffer', () => {
  it('cost three.js 1.5 m of depth resolution near a spacecraft', () => {
    // The defect this module exists for: JWST at 20 m, two parts a few centimetres
    // apart, and a buffer that could not tell them apart.
    // Against the far plane it had then, 1e11 units.
    expect(depthResolution(20 * METRE, false, 1e11) / METRE).toBeCloseTo(1.5, 1);
  });

  it('now resolves a twentieth of a millimetre at 20 m', () => {
    expect(depthResolution(20 * METRE) / METRE).toBeLessThan(1e-4);
  });

  it('keeps the same relative step at every distance past the near plane', () => {
    for (const w of [1e-3, 1, 1e3, 1e8]) {
      expect(depthResolution(w) / w).toBeCloseTo(2.745e-6, 8);
    }
  });

  it('paid 18 % for the light years, and still resolves microns at a metre', () => {
    // Step D1: the far plane from 1e11 units (2,000 AU) to 1e14 (past 3,000 ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const before = (w: number): number => depthResolution(w, true, 1e11);
    expect(depthResolution(METRE) / before(METRE)).toBeCloseTo(66.44 / 56.47, 3);
    expect(before(METRE) / METRE).toBeCloseTo(4.67e-6, 8);
    expect(depthResolution(METRE) / METRE).toBeCloseTo(5.49e-6, 8);
    expect(before(EARTH_RADIUS) / METRE).toBeCloseTo(14.9, 1);
    expect(depthResolution(EARTH_RADIUS) / METRE).toBeCloseTo(17.5, 1);
    expect(before(AU) / METRE / 1000).toBeCloseTo(349, 0);
    expect(depthResolution(AU) / METRE / 1000).toBeCloseTo(411, 0);
  });

  it('never far-clips: the projection’s depth term is exactly one at this range', () => {
    const camera = new THREE.PerspectiveCamera(27, 1.6, CAMERA_NEAR_UNITS, CAMERA_FAR_UNITS);
    camera.updateProjectionMatrix();
    expect(camera.projectionMatrix.elements[10]).toBe(-1);
    expect(Math.fround(camera.projectionMatrix.elements[10]!)).toBe(-1);
  });

  it('is no worse than before at the planets', () => {
    for (const w of [1, 1e3, 1e6]) {
      expect(depthResolution(w)).toBeLessThanOrEqual(depthResolution(w, false) * 1.6);
    }
  });

  it('replaces both of three.js’s chunks, counting from the near plane', () => {
    expect(THREE.ShaderChunk.logdepthbuf_vertex).toContain(`gl_Position.w * ${(1 / CAMERA_NEAR_UNITS).toExponential()}`);
    expect(THREE.ShaderChunk.logdepthbuf_fragment).not.toContain('logDepthBufFC');
  });
});
