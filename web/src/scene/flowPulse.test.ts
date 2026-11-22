import { describe, expect, it } from 'vitest';

import { LIVE_STEP_PX } from '../core/renderDemand.ts';
import { flowPulseWaitMs, pulsePcPerSecond, type FlowPulseBound } from './flowPulse.ts';

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
