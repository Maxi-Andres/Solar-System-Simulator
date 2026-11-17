import { describe, expect, it } from 'vitest';

import {
  flybyOfGaia,
  flybyOfNotable,
  flybyPositionKm,
  flybySpanYears,
  lineClosestApproach,
  STELLAR_FLYBYS,
} from './stellarFlybys.ts';
import { NOTABLE_STARS, notableStarBodyId, notableStarOf } from './notableStars.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const flyby = (key: string) => STELLAR_FLYBYS.find((candidate) => candidate.key === key)!;

describe('the stellar flybys', () => {
  it('are both here, each found by its star', () => {
    expect(STELLAR_FLYBYS.map((f) => f.key)).toEqual(['scholz', 'gliese-710']);
    expect(flybyOfNotable('scholz')?.key).toBe('scholz');
    expect(notableStarOf(notableStarBodyId(NOTABLE_STARS.find((star) => star.key === 'scholz')!))?.name).toBe('Scholz’s Star');
    expect(flybyOfGaia('4270814637616488064')?.key).toBe('gliese-710');
    expect(flybyOfGaia(null)).toBeNull();
    expect(flybyOfNotable('luhman-16')).toBeNull();
  });

  it('put Scholz’s Star where Dupuy et al.’s straight line does: 0.333 pc, 80,500 years ago', () => {
    const line = lineClosestApproach(flyby('scholz'));
    // Their own computation, from the same parallax, proper motion and velocity.
    expect(line.distancePc).toBeCloseTo(0.333, 1);
    expect(Math.abs(line.distancePc - 0.333)).toBeLessThan(0.02);
    expect(Math.abs(line.years - -80_500)).toBeLessThan(2_000);
  });

  it('bring Gliese 710 within 0.052 pc in 1.29 million years, as Gaia DR3 does in the Galaxy’s potential', () => {
    const line = lineClosestApproach(flyby('gliese-710'));
    expect(Math.abs(line.distancePc - 0.052)).toBeLessThan(0.004);
    expect(Math.abs(line.years - 1_290_000)).toBeLessThan(30_000);
    // It is 19.08 pc away now.
    const now = flybyPositionKm(flyby('gliese-710'), 0);
    expect(Math.hypot(now.x, now.y, now.z) / PARSEC_KM).toBeCloseTo(19.085, 2);
  });

  it('draw each passage whole, the star on its line now', () => {
    for (const f of STELLAR_FLYBYS) {
      const [from, to] = flybySpanYears(f);
      expect(from).toBeLessThan(0);
      expect(to).toBeGreaterThan(0);
      const closest = lineClosestApproach(f).years;
      expect(closest).toBeGreaterThan(from);
      expect(closest).toBeLessThan(to);
    }
  });
});
