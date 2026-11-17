import { describe, expect, it } from 'vitest';

import { ALPHA_CEN_A_PLANETS, alphaCenAPlanetOf } from './alphaCenAPlanets.ts';
import { astrometricState } from './alphaCentauri.ts';
import { planetStateAboutStar, skyAxes } from './exoplanets.ts';
import { exoPlanetOf } from './planetarySystems.ts';

const AU_KM = 149_597_870.7;
const s1 = ALPHA_CEN_A_PLANETS[0]!;

/** The direction to alpha Cen A (Hipparcos, J2000), scene frame. */
const toward = (() => {
  const p = astrometricState({
    raDeg: 219.9020583,
    decDeg: -60.8339928,
    parallaxMas: 750.81,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  }).position;
  const n = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / n, y: p.y / n, z: p.z / n };
})();

describe('alpha Centauri A’s candidate, S1', () => {
  it('is a candidate, named so, and found as a planet', () => {
    expect(s1.status).toBe('candidate');
    expect(s1.name).toMatch(/candidate/);
    expect(alphaCenAPlanetOf(s1.id)).toBe(s1);
    expect(exoPlanetOf(s1.id)).toBe(s1);
    expect(alphaCenAPlanetOf('proxima-b')).toBeNull();
  });

  it('keeps the orbit’s own period about the fit’s 1.079 solar masses', () => {
    const years = s1.periodDays / 365.25;
    expect(s1.semiMajorAxisAu ** 3 / years ** 2).toBeCloseTo(1.079, 3);
  });

  it('is where JWST saw it on 2024-08-10: 1.50″ east and 0.17″ north of A, ± 0.13″', () => {
    // MJD 60532, the MIRI epoch (Beichman, Sanghi et al. 2025, Table 2), and their parallax.
    const at = planetStateAboutStar(s1, 2400000.5 + 60532, toward).position;
    const { east, north } = skyAxes(toward);
    const arcsec = (v: { x: number; y: number; z: number }) =>
      ((at.x * v.x + at.y * v.y + at.z * v.z) / AU_KM) * 0.750853;
    expect(Math.abs(arcsec(east) - 1.5)).toBeLessThan(0.13);
    expect(Math.abs(arcsec(north) - 0.17)).toBeLessThan(0.13);
    // As the orbit chosen from their samples puts it.
    expect(arcsec(east)).toBeCloseTo(1.552, 2);
    expect(arcsec(north)).toBeCloseTo(0.187, 2);
  });
});
