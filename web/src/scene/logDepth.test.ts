import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { CAMERA_NEAR_UNITS, depthResolution } from './logDepth.ts';
import { kmToUnits } from './scale.ts';

const METRE = kmToUnits(0.001);

describe('the logarithmic depth buffer', () => {
  it('cost three.js 1.5 m of depth resolution near a spacecraft', () => {
    // The defect this module exists for: JWST at 20 m, two parts a few centimetres
    // apart, and a buffer that could not tell them apart.
    expect(depthResolution(20 * METRE, false) / METRE).toBeCloseTo(1.5, 1);
  });

  it('now resolves a twentieth of a millimetre at 20 m', () => {
    expect(depthResolution(20 * METRE) / METRE).toBeLessThan(1e-4);
  });

  it('keeps the same relative step at every distance past the near plane', () => {
    for (const w of [1e-3, 1, 1e3, 1e8]) {
      expect(depthResolution(w) / w).toBeCloseTo(2.3e-6, 7);
    }
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
