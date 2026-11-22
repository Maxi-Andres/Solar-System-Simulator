import { describe, expect, it } from 'vitest';

import { LIVE_STEP_PX } from '../core/renderDemand.ts';
import * as THREE from 'three';

import { FLOW_REACH_PX, flowPulseWaitMs, pulsePcPerSecond, sphereInView, type FlowPulseBound } from './flowPulse.ts';

/** Laniakea.tsx's: Gyr for a parsec at 1 km/s, and the brightening's Gyr of flow a second. */
const GYR_PER_PC_AT_KMS = 3.0857e13 / 3.15576e16;
const GYR_PER_SECOND = 25;

const bound: FlowPulseBound = {
  centreX: 2e6,
  centreY: -1e6,
  centreZ: 0,
  radiusPc: 2.5e8,
  pcPerSecond: pulsePcPerSecond(1200, GYR_PER_SECOND, GYR_PER_PC_AT_KMS),
};
const PX_PER_RADIAN = 1158;

describe('the flow lines’ brightening', () => {
  it('runs down a line at its flow speed times the Gyr a second', () => {
    // 400 km/s is 1 Mpc in 2.4 Gyr (Laniakea.tsx's header), so 25 Gyr a second is about 10 Mpc.
    expect(pulsePcPerSecond(400, GYR_PER_SECOND, GYR_PER_PC_AT_KMS) / 1e6).toBeCloseTo(10.2, 1);
    // A line's Gyr between two points ds apart at speed v is ds / v * GYR_PER_PC_AT_KMS
    // (flowGeometry); the brightening crosses it in that over the Gyr a second.
    const ds = 3e5;
    const v = 650;
    const seconds = ((ds / v) * GYR_PER_PC_AT_KMS) / GYR_PER_SECOND;
    expect(pulsePcPerSecond(v, GYR_PER_SECOND, GYR_PER_PC_AT_KMS) * seconds).toBeCloseTo(ds, 6);
  });

  it('wants every vsync from among the lines', () => {
    expect(flowPulseWaitMs(bound, 0, 0, 0, PX_PER_RADIAN)).toBe(0);
    expect(flowPulseWaitMs(bound, 1.5e8, 1e8, 0, PX_PER_RADIAN)).toBe(0);
  });

  it('from far out, waits no longer than the brightening takes to move a quarter of a pixel', () => {
    for (const fromPc of [4e9, 1.3e10, 3e10]) {
      const wait = flowPulseWaitMs(bound, fromPc, 0, 0, PX_PER_RADIAN);
      expect(wait).toBeGreaterThan(0);
      // Its fastest point at the sphere's nearest, moving straight across the view.
      const nearest = Math.hypot(fromPc - bound.centreX, bound.centreY) - bound.radiusPc;
      const moved = (bound.pcPerSecond / nearest) * PX_PER_RADIAN * (wait / 1000);
      expect(moved).toBeLessThanOrEqual(LIVE_STEP_PX * (1 + 1e-12));
    }
  });

  it('waits longer the farther, and is every vsync once a quarter pixel is under a frame', () => {
    const near = flowPulseWaitMs(bound, 4e9, 0, 0, PX_PER_RADIAN);
    const far = flowPulseWaitMs(bound, 3e10, 0, 0, PX_PER_RADIAN);
    expect(far).toBeGreaterThan(near);
    expect(flowPulseWaitMs(bound, 1e9, 0, 0, PX_PER_RADIAN)).toBe(0);
  });
});

describe('whether the flow lines are in view', () => {
  const W = 1920;
  const H = 1080;
  const camera = new THREE.PerspectiveCamera(50, W / H, 1e-3, 1e30);
  const e = camera.projectionMatrix.elements;
  // Projected as the GPU would: the device pixel a view-space point lands on, or null behind.
  const pixel = (x: number, y: number, z: number): [number, number] | null => {
    const v = new THREE.Vector4(x, y, z, 1).applyMatrix4(camera.projectionMatrix);
    return v.w > 0 ? [((v.x / v.w + 1) / 2) * W, ((v.y / v.w + 1) / 2) * H] : null;
  };

  it('is false only when every point of the sphere is off the screen by more than the reach', () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let culled = 0;
    for (let trial = 0; trial < 4000; trial += 1) {
      const r = 10 ** (random() * 4);
      const x = (random() - 0.5) * 2e4;
      const y = (random() - 0.5) * 2e4;
      const z = (random() - 0.5) * 2e4;
      if (sphereInView(x, y, z, r, e, W, H, FLOW_REACH_PX)) continue;
      culled += 1;
      // Points over its surface and inside: none may land within the reach of the screen.
      for (let k = 0; k < 200; k += 1) {
        const u = random() * 2 - 1;
        const phi = random() * 2 * Math.PI;
        const s = Math.sqrt(1 - u * u) * r * Math.cbrt(random());
        const p = pixel(x + s * Math.cos(phi), y + s * Math.sin(phi), z + u * r);
        if (p === null) continue;
        expect(p[0] < -FLOW_REACH_PX || p[0] > W + FLOW_REACH_PX || p[1] < -FLOW_REACH_PX || p[1] > H + FLOW_REACH_PX).toBe(true);
      }
    }
    // And it does cull: a good share of spheres scattered about the camera are out of view.
    expect(culled).toBeGreaterThan(1000);
  }, 60_000);

  it('keeps a sphere in front, one about the camera, and one just past the edge within the reach', () => {
    expect(sphereInView(0, 0, -100, 1, e, W, H, FLOW_REACH_PX)).toBe(true);
    expect(sphereInView(0, 0, 0, 1, e, W, H, FLOW_REACH_PX)).toBe(true);
    expect(sphereInView(0, 0, 100, 1, e, W, H, FLOW_REACH_PX)).toBe(false);
    // A point 2 pixels right of the screen's edge, as a tiny sphere: within the reach.
    const z = -1000;
    const xEdge = (-z / e[0]!) * (1 + (2 * 2) / W);
    expect(sphereInView(xEdge, 0, z, 1e-9, e, W, H, FLOW_REACH_PX)).toBe(true);
    const xFar = (-z / e[0]!) * (1 + (2 * 6) / W);
    expect(sphereInView(xFar, 0, z, 1e-9, e, W, H, FLOW_REACH_PX)).toBe(false);
  });
});
