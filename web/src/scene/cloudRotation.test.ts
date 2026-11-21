import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import { J2000_JD } from '../core/time.ts';
import { cloudTopDriftDeg, cloudTopDriftRateDegPerDay, cloudTopMapOffset } from './cloudRotation.ts';

const venus = getBody('venus');

describe('Venus’s cloud tops super-rotate', () => {
  it('drift west over the ground once in about four and a half days', () => {
    const rate = cloudTopDriftRateDegPerDay(venus)!;
    expect(rate).toBeCloseTo(80.86, 1);
    expect(360 / rate).toBeCloseTo(4.45, 2);
  });

  it('go round the stars in 4.37 days, the ground’s slow backward turn added to the wind', () => {
    // Venus's IAU W runs backwards: -1.48 degrees a day, 243 days a turn. The wind blows the
    // same way, so a cloud's angle against the stars is W minus its westward drift.
    const ground = venus.rotation!.rotationRateDegPerDay;
    expect(ground).toBeLessThan(0);
    const cloud = ground - cloudTopDriftRateDegPerDay(venus)!;
    expect(360 / Math.abs(cloud)).toBeCloseTo(4.37, 2);
    // Against the 243 days the map turned in before.
    expect(Math.abs(360 / ground)).toBeGreaterThan(240);
  });

  it('slide the map east by the drift, so each cloud is found further west', () => {
    expect(cloudTopDriftDeg(venus, J2000_JD)).toBe(0);
    const day = cloudTopDriftDeg(venus, J2000_JD + 1)!;
    expect(day).toBeCloseTo(80.86, 1);
    expect(cloudTopMapOffset(day)).toBeCloseTo(day / 360, 12);
    // Wrapped, before J2000 too.
    for (const jd of [J2000_JD - 1000.3, J2000_JD + 9736.5]) {
      const drift = cloudTopDriftDeg(venus, jd)!;
      expect(drift).toBeGreaterThanOrEqual(0);
      expect(drift).toBeLessThan(360);
    }
  });

  it('leave every other body’s map turning with it', () => {
    for (const id of ['earth', 'mars', 'jupiter', 'neptune']) {
      expect(cloudTopDriftDeg(getBody(id), J2000_JD + 10)).toBeNull();
    }
  });
});
