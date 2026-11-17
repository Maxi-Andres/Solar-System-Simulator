import { describe, expect, it } from 'vitest';

import { notableStarBodyId, notableStarFraming, NOTABLE_STARS } from './notableStars.ts';
import type { StarNameIndex } from './stars3d.ts';
import {
  groupMemberEntries,
  groupNameOf,
  HYADES_BARYCENTRE_GALACTIC,
  icrsFromGalactic,
  memberExtentPc,
  STELLAR_GROUP_MARKS,
  stellarGroupOf,
  URSA_MAJOR_CORE,
} from './stellarGroups.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const mark = (key: string) => STELLAR_GROUP_MARKS.find((entry) => entry.key === key)!;

describe('the star groups', () => {
  it('turn Galactic coordinates to ICRS: the Galactic Centre is at Sgr A*’s place', () => {
    const [x, y, z] = icrsFromGalactic([1, 0, 0]);
    const ra = (Math.atan2(y, x) * 180) / Math.PI + 360;
    const dec = (Math.asin(z) * 180) / Math.PI;
    // l = b = 0 is 17h45m37.2s, -28d56'10" (ESA 1997).
    expect(ra).toBeCloseTo(266.405, 2);
    expect(dec).toBeCloseTo(-28.936, 2);
  });

  it('put the Hyades at Lodieu et al.’s barycentre, 47.03 pc, in Taurus', () => {
    const hyades = mark('hyades');
    expect(hyades.distancePc).toBeCloseTo(Math.hypot(...HYADES_BARYCENTRE_GALACTIC), 6);
    expect(hyades.distancePc).toBeCloseTo(47.03, 2);
    // Its centre lies among its giants, about 4h29m, +17°.
    expect(hyades.raDeg).toBeGreaterThan(65);
    expect(hyades.raDeg).toBeLessThan(69);
    expect(hyades.decDeg).toBeGreaterThan(15);
    expect(hyades.decDeg).toBeLessThan(19);
    expect(hyades.extent?.pc).toBe(9);
  });

  it('put the Ursa Major group at its core stars’ mean, about 25 pc, its radius Merak’s distance from it', () => {
    const group = mark('ursa-major-group');
    expect(group.distancePc).toBeGreaterThan(24.4);
    expect(group.distancePc).toBeLessThan(25.5);
    expect(group.extent?.pc).toBeCloseTo(memberExtentPc(URSA_MAJOR_CORE), 9);
    expect(group.extent?.pc).toBeCloseTo(5.0, 1);
  });

  it('are notable-star marks, framed with all of them in view', () => {
    for (const entry of STELLAR_GROUP_MARKS) {
      expect(NOTABLE_STARS).toContain(entry);
      const framing = notableStarFraming(notableStarBodyId(entry))!;
      expect(framing.km).toBeCloseTo(3 * entry.extent!.pc * PARSEC_KM, -3);
      expect(stellarGroupOf(entry.key)).not.toBeNull();
    }
    expect(stellarGroupOf('luhman-16')).toBeNull();
  });

  it('find their members in the star names by HIP number, and name a member’s group', () => {
    const index = {
      names: {
        count: 3,
        display: ['Merak', 'Dubhe', 'Ain'],
        designations: [['HR 4295', 'HIP 53910'], ['HR 4301', 'HIP 54061'], ['HIP 20889']],
      },
    } as unknown as StarNameIndex;
    expect(groupMemberEntries(index, stellarGroupOf('ursa-major-group')!)).toEqual([0]);
    expect(groupMemberEntries(index, stellarGroupOf('hyades')!)).toEqual([2]);
    expect(groupNameOf(['HIP 53910'])).toBe('Ursa Major moving group');
    expect(groupNameOf(['HIP 54061'])).toBeNull();
    expect(groupNameOf(['HIP 20889'])).toBe('Hyades');
  });
});
