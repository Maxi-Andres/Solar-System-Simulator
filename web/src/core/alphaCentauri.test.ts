import { describe, expect, it } from 'vitest';

import {
  AB_ORBIT,
  barycentreState,
  BARYCENTRE,
  componentState,
  julianYear,
  MASS_A_SUN,
  MASS_B_SUN,
  matchComponent,
  PROXIMA_RELATIVE_VELOCITY,
  proximaKervellaState,
  proximaOrbit,
  relativeOrbitArcsec,
} from './alphaCentauri.ts';
import { J2000_JD } from './time.ts';

const DEG = Math.PI / 180;
const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const AU_KM = 149_597_870.7;

function hms(h: number, m: number, s: number): number {
  return (h + m / 60 + s / 3600) * 15;
}
function dms(d: number, m: number, s: number): number {
  return -(Math.abs(d) + m / 60 + s / 3600);
}

/** B about A on the sky from two ICRS positions, arcseconds east and north. */
function observed(raA: number, decA: number, raB: number, decB: number): { east: number; north: number } {
  return { east: (raB - raA) * Math.cos(decA * DEG) * 3600, north: (decB - decA) * 3600 };
}

/** Julian day of a Julian year. */
function jdOf(year: number): number {
  return J2000_JD + (year - 2000) * 365.25;
}

describe('the orbit of B about A, Kervella et al. 2016', () => {
  it('puts B where Hipparcos measured it in 1991 and NTT/SOFI in 2009 (their Table 2)', () => {
    const cases = [
      { year: 1991.25, obs: observed(hms(14, 39, 40.8985), dms(-60, 50, 6.53), hms(14, 39, 39.3908), dms(-60, 50, 22.097)) },
      { year: 2009.15, obs: observed(hms(14, 39, 31.813), dms(-60, 50, 0.01), hms(14, 39, 30.919), dms(-60, 50, 3.48)) },
    ];
    for (const { year, obs } of cases) {
      const model = relativeOrbitArcsec(year);
      // Tenths of an arcsecond, against positions good to 0.05-0.07".
      expect(Math.abs(model.east - obs.east)).toBeLessThan(0.15);
      expect(Math.abs(model.north - obs.north)).toBeLessThan(0.15);
    }
  });

  it('has B receding from A through the 1990s, as the radial velocities had it', () => {
    const rate = relativeOrbitArcsec(1996).away - relativeOrbitArcsec(1994).away;
    expect(rate).toBeGreaterThan(0);
  });

  it('swings between 11 and 36 AU, the separation every account of the pair gives', () => {
    const distancePc = 1000 / BARYCENTRE.parallaxMas;
    let least = Infinity;
    let most = 0;
    for (let k = 0; k < 2000; k += 1) {
      const { east, north, away } = relativeOrbitArcsec(1955 + (k / 2000) * AB_ORBIT.periodYears);
      const au = Math.hypot(east, north, away) * distancePc;
      least = Math.min(least, au);
      most = Math.max(most, au);
    }
    expect(least).toBeCloseTo(17.592 * distancePc * (1 - 0.5208), 1);
    expect(most).toBeCloseTo(17.592 * distancePc * (1 + 0.5208), 1);
    expect(least).toBeGreaterThan(11);
    expect(most).toBeLessThan(36);
  });
});

describe('the barycentre and the two stars', () => {
  it('is 1.338 pc away and moves 3.7" a year across the sky', () => {
    const now = barycentreState(BARYCENTRE.epochJd);
    const distance = Math.hypot(now.position.x, now.position.y, now.position.z);
    expect(distance / PARSEC_KM).toBeCloseTo(1000 / 747.17, 9);
    const later = barycentreState(BARYCENTRE.epochJd + 365.25);
    const moved = Math.hypot(
      later.position.x - now.position.x,
      later.position.y - now.position.y,
      later.position.z - now.position.z,
    );
    const across = Math.sqrt(moved ** 2 - (22.332 * 365.25 * 86_400) ** 2);
    expect((across / distance / DEG) * 3600).toBeCloseTo(Math.hypot(3619.9, 693.8) / 1000, 3);
  });

  it('keeps A and B about their barycentre, weighted by their masses', () => {
    const jd = jdOf(2026.8);
    const a = componentState('A', jd).position;
    const b = componentState('B', jd).position;
    const bary = barycentreState(jd).position;
    const total = MASS_A_SUN + MASS_B_SUN;
    for (const axis of ['x', 'y', 'z'] as const) {
      const weighted = (MASS_A_SUN * a[axis] + MASS_B_SUN * b[axis]) / total;
      // K16's mass fraction and its masses agree to their published digits.
      expect(Math.abs(weighted - bary[axis]) / AU_KM).toBeLessThan(0.01);
    }
  });

  it('moves B about A at the orbit\'s speed', () => {
    const jd = jdOf(2026.8);
    const a = componentState('A', jd);
    const b = componentState('B', jd);
    const relative = Math.hypot(
      b.velocity.x - a.velocity.x,
      b.velocity.y - a.velocity.y,
      b.velocity.z - a.velocity.z,
    );
    // Vis-viva at their separation, for 2.04 solar masses: a few km/s.
    const separation = Math.hypot(
      b.position.x - a.position.x,
      b.position.y - a.position.y,
      b.position.z - a.position.z,
    );
    const gm = 1.3271244e11 * (MASS_A_SUN + MASS_B_SUN);
    const aKm = 17.592 * (1000 / 747.17) * AU_KM;
    const visViva = Math.sqrt(gm * (2 / separation - 1 / aKm));
    expect(relative / visViva).toBeCloseTo(1, 2);
  });

  it('knows A from B by their directions at J2000, whatever their depths', () => {
    const a = componentState('A', J2000_JD).position;
    const b = componentState('B', J2000_JD).position;
    const pc = (v: { x: number; y: number; z: number }, stretch = 1) => ({
      x: (v.x / PARSEC_KM) * stretch,
      y: (v.y / PARSEC_KM) * stretch,
      z: (v.z / PARSEC_KM) * stretch,
    });
    expect(matchComponent(pc(a))).toBe('A');
    expect(matchComponent(pc(b))).toBe('B');
    // 55 AU nearer or farther changes nothing: it is the direction that tells them apart.
    expect(matchComponent(pc(b, 1.0002))).toBe('B');
    expect(matchComponent({ x: 0, y: 0, z: 1.3 })).toBeNull();
  });

  it('counts Julian years from J2000', () => {
    expect(julianYear(J2000_JD)).toBe(2000);
    expect(julianYear(jdOf(1991.25))).toBeCloseTo(1991.25, 12);
  });
});

describe('Proxima about the pair, from Kervella et al. 2017', () => {
  it('gives back their Table 3 from their own Table 2 inputs', () => {
    const proxima = proximaKervellaState();
    const orbit = proximaOrbit(proxima.position, BARYCENTRE.epochJd)!;
    expect(orbit).not.toBeNull();
    // Table 3: a = 8.7 (+0.7, -0.4) kau, e = 0.50 (+0.08, -0.09), P = 547 (+66, -40) ka.
    const a = orbit.semiMajorAxisKm / AU_KM / 1000;
    expect(a).toBeCloseTo(8.6, 1);
    expect(orbit.eccentricity).toBeCloseTo(0.5, 1);
    const periodKa = orbit.periodSec / (365.25 * 86_400) / 1000;
    expect(periodKa).toBeGreaterThan(507);
    expect(periodKa).toBeLessThan(613);
    // Periastron 4.3 and apastron 13.0 kau.
    expect(a * (1 - orbit.eccentricity)).toBeCloseTo(4.3, 0);
    expect(a * (1 + orbit.eccentricity)).toBeCloseTo(13, 0);
  });

  it('moves Proxima about the pair at 273 m/s, their Sect. 3.2', () => {
    const v = PROXIMA_RELATIVE_VELOCITY;
    expect(Math.hypot(v.x, v.y, v.z) * 1000).toBeCloseTo(273, -1);
  });
});
