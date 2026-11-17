import { describe, expect, it } from 'vitest';

import { hypervelocityPathKm } from './hypervelocity.ts';
import { PARSEC_KM } from './stars3d.ts';

describe('S5-HVS1’s path back to Sgr A*', () => {
  it('runs from Sgr A* to the star, as far as 1,800 km/s carries it in 4.8 million years', () => {
    const path = hypervelocityPathKm();
    expect(path).not.toBeNull();
    const [centre, star] = path!;
    expect(Math.hypot(centre.x, centre.y, centre.z) / PARSEC_KM).toBeCloseTo(8275.9, -1);
    expect(Math.hypot(star.x, star.y, star.z) / PARSEC_KM).toBeCloseTo(8630, -1);
    const lengthPc = Math.hypot(star.x - centre.x, star.y - centre.y, star.z - centre.z) / PARSEC_KM;
    // Koposov et al.: ejected at 1,798.6 km/s, 4.801 Myr ago -- 8.8 kpc at that speed; the pull
    // since has slowed it to 1,755.
    const flownPc = (1780 * 4.801e6 * 365.25 * 86_400) / PARSEC_KM;
    expect(Math.abs(lengthPc - flownPc) / flownPc).toBeLessThan(0.1);
  });
});
