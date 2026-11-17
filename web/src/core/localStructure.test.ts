import { describe, expect, it } from 'vitest';

import { galaxyPositionPc, GIANTS, RECENT_DWARFS, type LocalGroupGalaxy } from './localGroup.ts';
import {
  COUNCIL_CENTRE_PC,
  COUNCIL_FIT,
  groupingsOf,
  localGroupBarycentrePc,
  SHEET_POLE,
  supergalacticDirection,
  toSheet,
  ZERO_VELOCITY_RADIUS_PC,
} from './localStructure.ts';
import { dot, length } from './vec3.ts';
import { galacticDirection } from '../scene/galactic.ts';
import { SUPERGALACTIC_POLE } from '../scene/supergalactic.ts';

/**
 * The Local Group's surroundings (localStructure.ts): that McCall's Sheet is placed as his
 * Table 1 places Andromeda, that the Council's ring fitted again is his, and that the
 * groupings find their members by any of their names.
 */

const DEG = Math.PI / 180;

describe('the Local Sheet', () => {
  it('is tilted 7.95 degrees to the supergalactic plane', () => {
    expect(Math.acos(dot(SHEET_POLE, SUPERGALACTIC_POLE)) / DEG).toBeCloseTo(7.95, 1);
  });

  it('has the supergalactic frame de Vaucouleurs set: (0, 0) at galactic (137.37, 0)', () => {
    const zero = supergalacticDirection(0, 0);
    expect(dot(zero, galacticDirection(137.37, 0))).toBeCloseTo(1, 9);
  });

  it('places Andromeda where McCall’s Table 1 does, its longitude 292.9 and height 288 kpc', () => {
    // His Andromeda is 778 kpc away, the app's 761: compare directions and the height.
    const [x, y, z] = toSheet(galaxyPositionPc(GIANTS[0]!));
    const longitude = (Math.atan2(y, x) / DEG + 360) % 360;
    expect(longitude).toBeCloseTo(292.9, 0);
    expect(z).toBeCloseTo(0.288, 1);
  });
});

describe('the Council of Giants', () => {
  it('fitted again from McCall’s Table 1 is his ring: 3.746 Mpc, its centre 0.81 Mpc from the Sun', () => {
    expect(COUNCIL_FIT.radius).toBeCloseTo(3.746, 2);
    expect(length(COUNCIL_CENTRE_PC) / 1e6).toBeCloseTo(0.81, 1);
    // His cosmic scatter of the giants about it, 0.48 Mpc once distance errors are taken out.
    expect(COUNCIL_FIT.scatter).toBeGreaterThan(0.4);
    expect(COUNCIL_FIT.scatter).toBeLessThan(0.55);
  });
});

describe('the zero-velocity surface', () => {
  it('is centred 55 % of the way to Andromeda, inside the radius from both', () => {
    const centre = localGroupBarycentrePc();
    const andromeda = galaxyPositionPc(GIANTS[0]!);
    const toAndromeda = Math.hypot(andromeda.x - centre.x, andromeda.y - centre.y, andromeda.z - centre.z);
    expect(toAndromeda).toBeGreaterThan(300_000);
    expect(toAndromeda).toBeLessThan(ZERO_VELOCITY_RADIUS_PC);
    expect(length(centre)).toBeLessThan(ZERO_VELOCITY_RADIUS_PC);
  });
});

describe('groupings', () => {
  const named = (name: string, otherNames: readonly string[] = []): LocalGroupGalaxy => ({ ...RECENT_DWARFS[0]!, name, otherNames });

  it('finds members by name or other name', () => {
    expect(groupingsOf(named('Sextans B')).map((g) => g.name)).toEqual(['NGC 3109 association']);
    expect(groupingsOf(named('M81', ['NGC 3031', "Bode's Galaxy"])).map((g) => g.name)).toEqual(['Council of Giants']);
    expect(groupingsOf(named('Circinus Galaxy')).map((g) => g.name)).toEqual(['Council of Giants']);
    expect(groupingsOf(named('M101', ['NGC 5457']))).toEqual([]);
  });
});
