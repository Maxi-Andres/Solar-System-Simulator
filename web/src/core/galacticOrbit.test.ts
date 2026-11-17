import { describe, expect, it } from 'vitest';

import { SGR_A_DISTANCE_PC } from './blackHoles.ts';
import { circularSpeed, HALO_M200_SUN, HALO_R200_KPC, orbitFrame, sunOrbit, sunVelocityKmS } from './galacticOrbit.ts';

describe('the Sun’s galactic orbit', () => {
  const orbit = sunOrbit();

  it('uses a model whose circular speed at the Sun is the 230 or so km/s measured', () => {
    expect(circularSpeed(SGR_A_DISTANCE_PC / 1000)).toBeGreaterThan(225);
    expect(circularSpeed(SGR_A_DISTANCE_PC / 1000)).toBeLessThan(236);
  });

  it('starts from the measured motion: 251.5 km/s along the rotation, from Sgr A*’s proper motion', () => {
    expect(sunVelocityKmS()[1]).toBeCloseTo(251.5, 0);
  });

  it('puts the plane 25 pc below the Sun and through Sgr A*', () => {
    const frame = orbitFrame();
    const sun = [-frame.centre[0], -frame.centre[1], -frame.centre[2]];
    const height = sun[0]! * frame.z[0] + sun[1]! * frame.z[1] + sun[2]! * frame.z[2];
    expect(height).toBeCloseTo(25, 1);
    // x toward the centre, y along the rotation, as the Galactic axes nearly are.
    expect(frame.x[0]).toBeGreaterThan(0.9999);
    expect(frame.y[1]).toBeGreaterThan(0.9999);
  });

  it('starts at the Sun and goes once round in about 230 million years', () => {
    expect(Math.hypot(...orbit.points[0]!)).toBeLessThan(1e-6);
    expect(orbit.periodMyr).toBeGreaterThan(215);
    expect(orbit.periodMyr).toBeLessThan(250);
  });

  it('keeps the Sun near its radius: a slightly eccentric orbit, the Sun near its inner end', () => {
    expect(orbit.pericentrePc).toBeGreaterThan(7500);
    expect(orbit.pericentrePc).toBeLessThanOrEqual(SGR_A_DISTANCE_PC + 1);
    expect(orbit.apocentrePc).toBeGreaterThan(SGR_A_DISTANCE_PC);
    expect(orbit.apocentrePc).toBeLessThan(11000);
    // A hundred parsecs or so above and below the plane.
    expect(orbit.maxHeightPc).toBeGreaterThan(50);
    expect(orbit.maxHeightPc).toBeLessThan(200);
  });
});

describe('the dark halo’s reach', () => {
  it('is R200 for M200: 200 times the critical density (H0 = 67.7) within it', () => {
    const rhoCrit = 277.5 * 0.677 ** 2; // solar masses per kpc^3
    const r200 = Math.cbrt((3 * HALO_M200_SUN) / (4 * Math.PI * 200 * rhoCrit));
    expect(r200).toBeCloseTo(HALO_R200_KPC, -1);
  });
});
