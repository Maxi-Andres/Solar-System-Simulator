import { describe, expect, it } from 'vitest';

import { colorIndexToTemperature, surfaceLuminanceRelativeToSun } from './blackbody.ts';
import { LIMB_DARKENING_U, starDiscColor } from './starDisc.ts';

describe('a measured star\'s disc', () => {
  it('has the Sun\'s surface brightness at the Sun\'s temperature, less when cooler', () => {
    expect(surfaceLuminanceRelativeToSun(5772)).toBeCloseTo(1, 12);
    const a = surfaceLuminanceRelativeToSun(colorIndexToTemperature(0.71));
    const b = surfaceLuminanceRelativeToSun(colorIndexToTemperature(0.9));
    const proxima = surfaceLuminanceRelativeToSun(colorIndexToTemperature(1.95));
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThan(a);
    // An M dwarf: a few percent of the Sun's, still past the scene's exposure at 45x.
    expect(proxima).toBeGreaterThan(0.02);
    expect(proxima).toBeLessThan(0.04);
    expect(45 * proxima).toBeGreaterThan(1);
  });

  it('is its blackbody hue at full brightness when overexposed, dimmer only below 1', () => {
    const proxima = starDiscColor(1.95, 1.3);
    expect(Math.max(proxima.r, proxima.g, proxima.b)).toBeCloseTo(1, 12);
    // Orange: red full, blue well down.
    expect(proxima.r).toBeGreaterThan(proxima.g);
    expect(proxima.g).toBeGreaterThan(proxima.b);
    const dim = starDiscColor(1.95, 0.5);
    expect(Math.max(dim.r, dim.g, dim.b)).toBeCloseTo(0.5, 12);
  });

  it('darkens to 40% at the limb, the Sun\'s visible coefficient', () => {
    expect(1 - LIMB_DARKENING_U).toBeCloseTo(0.4, 12);
  });
});
