import { describe, expect, it } from 'vitest';

import { EROSITA_LOBE, FERMI_LOBE, lobeExtentDeg } from './galacticBubbles.ts';

describe('the Fermi and eROSITA bubbles', () => {
  it('reach, from the Sun, the Fermi bubbles’ measured 50 degrees of latitude and 20 either side in longitude', () => {
    const { latitude, longitude } = lobeExtentDeg(FERMI_LOBE, 120);
    expect(latitude).toBeCloseTo(50, 0);
    expect(longitude).toBeCloseTo(20, 0);
    expect((2 * FERMI_LOBE.alongPc) / 1000).toBeCloseTo(8.6, 1);
  });

  it('are Predehl’s 14-kpc spheres for eROSITA, reaching about 81 degrees of latitude', () => {
    expect(2 * EROSITA_LOBE.alongPc).toBe(14000);
    expect(lobeExtentDeg(EROSITA_LOBE, 120).latitude).toBeGreaterThan(80);
  });
});
