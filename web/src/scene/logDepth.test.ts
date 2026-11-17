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
      expect(depthResolution(w) / w).toBeCloseTo(3.8428e-6, 8);
    }
  });

  it('paid 18 % for the light years, and still resolves microns at a metre', () => {
    // Step D1: the far plane from 1e11 units (2,000 AU) to 1e14 (past 3,000 ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const before = (w: number): number => depthResolution(w, true, 1e11);
    const d1 = (w: number): number => depthResolution(w, true, 1e14);
    expect(d1(METRE) / before(METRE)).toBeCloseTo(66.44 / 56.47, 3);
    expect(before(METRE) / METRE).toBeCloseTo(4.67e-6, 8);
    expect(d1(METRE) / METRE).toBeCloseTo(5.49e-6, 8);
    expect(before(EARTH_RADIUS) / METRE).toBeCloseTo(14.9, 1);
    expect(d1(EARTH_RADIUS) / METRE).toBeCloseTo(17.5, 1);
    expect(before(AU) / METRE / 1000).toBeCloseTo(349, 0);
    expect(d1(AU) / METRE / 1000).toBeCloseTo(411, 0);
  });

  it('paid 10 % more for the galaxy, as logDepth.ts states', () => {
    // Step D2b: the far plane from 1e14 units to 1e16 (past 400,000 ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const d1 = (w: number): number => depthResolution(w, true, 1e14);
    const d2 = (w: number): number => depthResolution(w, true, 1e16);
    expect(d2(METRE) / d1(METRE)).toBeCloseTo(73.08 / 66.44, 3);
    expect(d2(METRE) / METRE).toBeCloseTo(6.04e-6, 8);
    expect(d2(EARTH_RADIUS) / METRE).toBeCloseTo(19.3, 1);
    expect(d2(AU) / METRE / 1000).toBeCloseTo(452, 0);
  });

  it('paid 9 % more for the Local Group, as logDepth.ts states', () => {
    // Step G1: the far plane from 1e16 units to 1e18 (past 40 million ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const d2 = (w: number): number => depthResolution(w, true, 1e16);
    const d3 = (w: number): number => depthResolution(w, true, 1e18);
    expect(d3(METRE) / d2(METRE)).toBeCloseTo(79.73 / 73.08, 3);
    expect(d3(METRE) / METRE).toBeCloseTo(6.59e-6, 7);
    expect(d3(EARTH_RADIUS) / METRE).toBeCloseTo(21, 0);
    expect(d3(AU) / METRE / 1000).toBeCloseTo(490, -1);
  });

  it('paid 4 % more for the Local Volume and the Virgo Cluster, as logDepth.ts states', () => {
    // Step G2: the far plane from 1e18 units to 1e19 (past 200 million ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const d3 = (w: number): number => depthResolution(w, true, 1e18);
    const d4 = (w: number): number => depthResolution(w, true, 1e19);
    expect(d4(METRE) / d3(METRE)).toBeCloseTo(83.05 / 79.73, 3);
    expect(d4(METRE) / METRE).toBeCloseTo(6.87e-6, 7);
    expect(d4(EARTH_RADIUS) / METRE).toBeCloseTo(22, 0);
    expect(d4(AU) / METRE / 1000).toBeCloseTo(510, -1);
  });

  it('paid 4 % more for Laniakea, as logDepth.ts states', () => {
    // Step G3: the far plane from 1e19 units to 1e20 (10.6 billion ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const d4 = (w: number): number => depthResolution(w, true, 1e19);
    const d5 = (w: number): number => depthResolution(w, true, 1e20);
    expect(d5(METRE) / d4(METRE)).toBeCloseTo(86.37 / 83.05, 3);
    expect(d5(METRE) / METRE).toBeCloseTo(7.15e-6, 7);
    expect(d5(EARTH_RADIUS) / METRE).toBeCloseTo(23, 0);
    expect(d5(AU) / METRE / 1000).toBeCloseTo(530, -1);
  });

  it('paid 8 % more for the observable universe, as logDepth.ts states', () => {
    // Step G4: the far plane from 1e20 units to 1e22 (1,057 billion ly).
    const AU = 149_597.870_7;
    const EARTH_RADIUS = 6.378_137;
    const d5 = (w: number): number => depthResolution(w, true, 1e20);
    expect(CAMERA_FAR_UNITS).toBe(1e22);
    expect(depthResolution(METRE) / d5(METRE)).toBeCloseTo(93.01 / 86.37, 3);
    expect(depthResolution(METRE) / METRE).toBeCloseTo(7.7e-6, 7);
    expect(depthResolution(20 * METRE) / METRE).toBeCloseTo(8.1e-5, 6);
    expect(depthResolution(EARTH_RADIUS) / METRE).toBeCloseTo(25, 0);
    expect(depthResolution(AU) / METRE / 1000).toBeCloseTo(575, 0);
    // The buffer's own relative step, against float32's in the logarithm past 2^64 near planes.
    expect(depthResolution(1e6) / 1e6).toBeCloseTo(3.84e-6, 8);
    expect(2 ** -17 * Math.LN2).toBeGreaterThan(depthResolution(1e6) / 1e6);
  });

  it('holds the farthest place the camera can see from the farthest it can stand', () => {
    // The camera 40 billion ly from the Sun at most, inside the CMB's sphere (scale.ts), and the
    // observable universe's far side 46.2 billion ly beyond the Sun the other way.
    const LY_KM = 299_792.458 * 365.25 * 86_400;
    const farthestKm = 40e9 * LY_KM + 46.2e9 * LY_KM;
    expect(kmToUnits(farthestKm)).toBeLessThan(CAMERA_FAR_UNITS);
    // And in float32, the logarithm the fragment writes still steps finer than the buffer.
    const w = kmToUnits(farthestKm) / CAMERA_NEAR_UNITS;
    expect(Number.isFinite(Math.fround(w))).toBe(true);
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
