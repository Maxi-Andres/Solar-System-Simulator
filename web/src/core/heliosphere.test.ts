import { describe, expect, it } from 'vitest';

import {
  angleFromNose,
  CROSSINGS,
  HELIOPAUSE_NOSE_AU,
  heliopauseRadius,
  NOSE,
  TERMINATION_SHOCK_AU,
} from './heliosphere.ts';
import {
  bowShockRadius,
  fieldLineRadius,
  footLatitude,
  MAGNETOPAUSE_ALPHA,
  MAGNETOPAUSE_R0,
  magnetopauseRadius,
} from './magnetosphere.ts';

describe('the heliosphere', () => {
  it('holds the crossings at the papers’ distances', () => {
    for (const crossing of CROSSINGS) {
      const r = Math.hypot(crossing.positionAu.x, crossing.positionAu.y, crossing.positionAu.z);
      expect(Math.abs(r - crossing.publishedAu)).toBeLessThan(0.06);
    }
  });

  it('points the nose upwind, into the interstellar flow', () => {
    expect(Math.hypot(NOSE.x, NOSE.y, NOSE.z)).toBeCloseTo(1, 12);
    // Voyager 1 left about 30 degrees from the nose, Voyager 2 about 50.
    const v1 = CROSSINGS.find((c) => c.craft === 'Voyager 1' && c.boundary === 'heliopause')!;
    const v2 = CROSSINGS.find((c) => c.craft === 'Voyager 2' && c.boundary === 'heliopause')!;
    expect((angleFromNose(v1.positionAu) * 180) / Math.PI).toBeCloseTo(29.9, 0);
    expect((angleFromNose(v2.positionAu) * 180) / Math.PI).toBeCloseTo(52.6, 0);
  });

  it('fits Parker’s heliopause within 7 AU of both crossings', () => {
    expect(HELIOPAUSE_NOSE_AU).toBeCloseTo(111.7, 0);
    for (const crossing of CROSSINGS.filter((c) => c.boundary === 'heliopause')) {
      const r = Math.hypot(crossing.positionAu.x, crossing.positionAu.y, crossing.positionAu.z);
      expect(Math.abs(heliopauseRadius(angleFromNose(crossing.positionAu), HELIOPAUSE_NOSE_AU) - r)).toBeLessThan(7);
    }
    // Its tail tends to a cylinder of twice the nose distance.
    const nu = (179 * Math.PI) / 180;
    expect(heliopauseRadius(nu, 1) * Math.sin(nu)).toBeCloseTo(2, 2);
  });

  it('puts the termination shock between the crossings, inside the heliopause', () => {
    expect(TERMINATION_SHOCK_AU).toBeCloseTo(88.85, 1);
    expect(TERMINATION_SHOCK_AU).toBeLessThan(HELIOPAUSE_NOSE_AU);
  });
});

describe('the magnetosphere', () => {
  it('evaluates Shue et al. 1998 at 2 nPa and Bz 0', () => {
    expect(MAGNETOPAUSE_R0).toBeCloseTo(10.25, 2);
    expect(MAGNETOPAUSE_ALPHA).toBeCloseTo(0.5897, 3);
    // At the terminator, r0 2^alpha.
    expect(magnetopauseRadius(Math.PI / 2, MAGNETOPAUSE_R0, MAGNETOPAUSE_ALPHA)).toBeCloseTo(
      MAGNETOPAUSE_R0 * 2 ** MAGNETOPAUSE_ALPHA,
      9,
    );
  });

  it('puts the bow shock 13.7 Earth radii out, ahead of the magnetopause, on Farris et al.’s paraboloid', () => {
    expect(bowShockRadius(0)).toBeCloseTo(13.7, 9);
    expect(bowShockRadius(0)).toBeGreaterThan(MAGNETOPAUSE_R0);
    // Over the terminator, sqrt(a / b); and every point on X = a - b (Y^2 + Z^2).
    expect(bowShockRadius(Math.PI / 2)).toBeCloseTo(Math.sqrt(13.7 / 0.0223), 9);
    for (const deg of [20, 60, 100, 125]) {
      const theta = (deg * Math.PI) / 180;
      const r = bowShockRadius(theta);
      expect(r * Math.cos(theta)).toBeCloseTo(13.7 - 0.0223 * (r * Math.sin(theta)) ** 2, 9);
    }
  });

  it('runs a dipole field line from the equator to the ground', () => {
    expect(fieldLineRadius(4, 0)).toBe(4);
    expect(fieldLineRadius(4, footLatitude(4))).toBeCloseTo(1, 12);
  });
});
