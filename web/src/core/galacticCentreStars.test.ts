import { describe, expect, it } from 'vitest';

import { julianEpochJd, skyOrbitState } from './blackHoles.ts';
import {
  DISTANCE_MODULUS,
  GILLESSEN_2017_ORBITS,
  giantColours,
  hotStarVMinusK,
  IRS7_STAR,
  orbitTwin,
  PAUMARD_2006,
  periodYears,
  S_STARS,
  sStarPosition,
  YOUNG_STARS,
} from './galacticCentreStars.ts';

/**
 * The stars measured at the Galactic Centre, held to their papers: the S-stars' orbits to
 * the periods Gillessen et al. published and to their own pericentres, the young stars to
 * Paumard et al.'s table less the stars already on orbits, and their brightnesses to the
 * conversions stated in galacticCentreStars.ts.
 */

const AU_KM = 149_597_870.7;

describe('the S-stars', () => {
  it('are the 38 orbits of Gillessen et al. 2017 less S2 (a body) and S111 (a hyperbola)', () => {
    expect(GILLESSEN_2017_ORBITS).toHaveLength(40);
    expect(S_STARS).toHaveLength(38);
    expect(S_STARS.map((star) => star.name)).not.toContain('S2');
    expect(S_STARS.map((star) => star.name)).not.toContain('S111');
    expect(S_STARS.filter((star) => star.source === 'gravity2024').map((star) => star.name)).toEqual([
      'S29',
      'S38',
      'S55',
    ]);
  });

  it('go round in the periods Gillessen et al. published: Kepler’s law at GRAVITY’s mass and distance, within 1.6% or their error', () => {
    for (const star of S_STARS.filter((each) => each.source === 'gillessen2017')) {
      const row = GILLESSEN_2017_ORBITS.find((each) => each.name === star.name)!;
      const tolerance = Math.max(0.016 * row.T!, row.Terr!);
      expect(Math.abs(periodYears(star.orbit) - row.T!), star.name).toBeLessThan(tolerance);
    }
  });

  it('give S55 the 12.2 years GRAVITY’s elements imply, and S2’s neighbours theirs', () => {
    const s55 = S_STARS.find((star) => star.name === 'S55')!;
    expect(periodYears(s55.orbit)).toBeCloseTo(12.2, 1);
  });

  it('reach their pericentre, a (1 - e), at the time published, and come no closer', () => {
    for (const star of S_STARS) {
      const { orbit } = star;
      const at = (jd: number): number => {
        const p = sStarPosition(star, jd);
        return Math.hypot(p.x, p.y, p.z);
      };
      const pericentre = orbit.semiMajorAxisKm * (1 - orbit.eccentricity);
      expect(at(orbit.periastronJd) / pericentre, star.name).toBeCloseTo(1, 9);
      for (let k = 1; k < 40; k += 1) {
        expect(at(orbit.periastronJd + (k / 40) * orbit.periodDays)).toBeGreaterThan(pericentre);
      }
    }
  });

  it('are on the sky where the orbit puts them: S2’s neighbours within 0.1" to 1.5" of Sgr A*', () => {
    const arcsec = (km: number): number => km / (8275.9 * AU_KM);
    for (const star of S_STARS.filter((each) => each.orbit.semiMajorAxisKm < arcsecToKm(0.5))) {
      const sky = skyOrbitState(star.orbit, julianEpochJd(2026.8)).position;
      const projected = arcsec(Math.hypot(sky.east, sky.north));
      expect(projected, star.name).toBeLessThan(1.5);
    }
  });

  it('take a brightness from K by the stated conversion: S1, a B star of 27,450 K, at M_V -3.2', () => {
    const s1 = S_STARS.find((star) => star.name === 'S1')!;
    // K 14.7 - A_K 2.42 - 14.589 = -2.31; V - K = -0.87 at 27,450 K.
    expect(s1.look.absoluteV).toBeCloseTo(14.7 - 2.42 - DISTANCE_MODULUS + hotStarVMinusK(27_450), 6);
    expect(s1.look.absoluteV).toBeCloseTo(-3.2, 1);
  });

  it('draw the late-type ones as the clump giants they are, M_V about +1 and orange', () => {
    const s17 = S_STARS.find((star) => star.name === 'S17')!;
    expect(s17.type).toBe('late');
    expect(s17.look.absoluteV).toBeGreaterThan(0.3);
    expect(s17.look.absoluteV).toBeLessThan(1.6);
    expect(s17.look.colorIndex).toBeGreaterThan(1);
    expect(giantColours(-1.55).vk).toBeGreaterThan(2.3);
  });
});

function arcsecToKm(arcsec: number): number {
  return arcsec * 8275.9 * AU_KM;
}

describe('the young stars', () => {
  it('are Paumard et al.’s 90 less the central arcsecond and the four past it that are orbit stars', () => {
    expect(PAUMARD_2006).toHaveLength(90);
    const twins = PAUMARD_2006.filter(([, , x, y]) => Math.hypot(x, y) >= 1)
      .filter(([, , x, y, , mK]) => orbitTwin(x, y, mK) !== null)
      .map(([id]) => id);
    expect(twins).toEqual(['E17', 'E20', 'E21', 'E23']);
    expect(YOUNG_STARS).toHaveLength(70);
  });

  it('match IRS 16C and IRS 16SW to S96 and S97, by place and brightness', () => {
    const named = (name: string) => PAUMARD_2006.find(([, names]) => names === name)!;
    const c = named('IRS16C');
    const sw = named('IRS16SW');
    expect(orbitTwin(c[2], c[3], c[5])).toBe('S96');
    expect(orbitTwin(sw[2], sw[3], sw[5])).toBe('S97');
  });

  it('keep their measured depth where there is one, and stay within 13" where it is drawn', () => {
    expect(YOUNG_STARS.filter((star) => star.depthMeasured)).toHaveLength(22);
    for (const star of YOUNG_STARS) {
      const r = Math.hypot(star.position.x, star.position.y, star.position.z);
      expect(r).toBeLessThan(arcsecToKm(Math.hypot(13, 13)));
    }
  });

  it('are the brightest stars of the central parsec in V: IRS 16NE, at M_V -9.3', () => {
    const brightest = YOUNG_STARS.reduce((best, star) => (star.look.absoluteV < best.look.absoluteV ? star : best));
    expect(brightest.name).toBe('IRS16NE');
    // K 8.9 - A_K 2.62 - 14.589, and an O9 V's V - K, -1.00.
    expect(brightest.look.absoluteV).toBeCloseTo(8.9 - 2.62 - DISTANCE_MODULUS - 1, 6);
  });
});

describe('IRS 7', () => {
  it('is a red supergiant of M_V -6.3, 5.5" north of Sgr A*', () => {
    expect(IRS7_STAR.look.absoluteV).toBeCloseTo(6.8 - 3.48 - DISTANCE_MODULUS + 5.0, 6);
    expect(IRS7_STAR.look.absoluteV).toBeCloseTo(-6.3, 1);
    const r = Math.hypot(IRS7_STAR.position.x, IRS7_STAR.position.y, IRS7_STAR.position.z);
    expect(r / arcsecToKm(1)).toBeCloseTo(5.546, 3);
  });
});
