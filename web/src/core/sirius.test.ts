import { describe, expect, it } from 'vitest';

import { astrometricState } from './alphaCentauri.ts';
import { matchSirius } from './orbitingStars.ts';
import {
  SIRIUS_A_HIPPARCOS,
  SIRIUS_A_MASS_SUN,
  SIRIUS_B_MASS_SUN,
  SIRIUS_ORBIT,
  SIRIUS_PARALLAX_MAS,
  SIRIUS_SKY_ORBIT,
  SIRIUS_SYSTEM_RADIAL_KM_S,
  siriusAState,
  siriusBarycentreState,
  siriusBState,
  siriusSeparationArcsec,
} from './sirius.ts';
import { J2000_JD } from './time.ts';
import type { Vec3 } from './vec3.ts';

const AU_KM = 149_597_870.7;
const PARSEC_KM = (AU_KM * 648_000) / Math.PI;
const ARCSEC = Math.PI / 180 / 3600;
const YEAR_S = 365.25 * 86_400;

function angleArcsec(a: Vec3, b: Vec3): number {
  const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  return Math.atan2(cross, a.x * b.x + a.y * b.y + a.z * b.z) / ARCSEC;
}

/** A catalogue record as the 3D stars are built (build3d.ts): a straight line from its epoch to J2000, in parsecs. */
function recordAtJ2000(entry: Parameters<typeof astrometricState>[0], epochYear: number): Vec3 {
  const s = astrometricState(entry);
  const dt = (2000 - epochYear) * YEAR_S;
  return {
    x: (s.position.x + s.velocity.x * dt) / PARSEC_KM,
    y: (s.position.y + s.velocity.y * dt) / PARSEC_KM,
    z: (s.position.z + s.velocity.z * dt) / PARSEC_KM,
  };
}

describe('the orbit of Sirius B (Bond et al. 2017)', () => {
  it("obeys Kepler's third law with their masses, to their errors", () => {
    const aAu = SIRIUS_ORBIT.semiMajorAxisArcsec / (SIRIUS_PARALLAX_MAS / 1000);
    const mass = aAu ** 3 / SIRIUS_ORBIT.periodYears ** 2;
    // 3.081 +- 0.025 solar masses.
    expect(Math.abs(mass - (SIRIUS_A_MASS_SUN + SIRIUS_B_MASS_SUN))).toBeLessThan(0.03);
  });

  it("swings A through their measured 2.4761\" about the barycentre", () => {
    const aA = (SIRIUS_ORBIT.semiMajorAxisArcsec * SIRIUS_B_MASS_SUN) / (SIRIUS_A_MASS_SUN + SIRIUS_B_MASS_SUN);
    expect(Math.abs(aA - 2.4761)).toBeLessThan(0.0045);
  });

  it('keeps the barycentre where the two balance, on a straight line, at the system velocity', () => {
    for (const year of [1991.25, 2005, 2026]) {
      const jd = J2000_JD + (year - 2000) * 365.25;
      const a = siriusAState(jd).position;
      const b = siriusBState(jd).position;
      const bary = siriusBarycentreState(jd).position;
      const m = SIRIUS_A_MASS_SUN + SIRIUS_B_MASS_SUN;
      expect(Math.abs((a.x * SIRIUS_A_MASS_SUN + b.x * SIRIUS_B_MASS_SUN) / m - bary.x)).toBeLessThan(1);
    }
    const { position: p, velocity: v } = siriusBarycentreState(J2000_JD);
    const radial = (p.x * v.x + p.y * v.y + p.z * v.z) / Math.hypot(p.x, p.y, p.z);
    expect(radial).toBeCloseTo(SIRIUS_SYSTEM_RADIAL_KM_S, 2);
  });

  it('puts Sirius A where Hipparcos saw it in 1991', () => {
    const a = siriusAState(SIRIUS_A_HIPPARCOS.epochJd).position;
    const hip = astrometricState({ ...SIRIUS_A_HIPPARCOS, parallaxMas: SIRIUS_PARALLAX_MAS, radialVelocityKmS: 0 }).position;
    expect(angleArcsec(a, hip)).toBeLessThan(0.001);
  });

  it('opens to 11" in the 2020s, B near the far end of its orbit', () => {
    const now = siriusSeparationArcsec(J2000_JD + 26 * 365.25);
    expect(now).toBeGreaterThan(10.5);
    expect(now).toBeLessThan(11.6);
    // The widest it gets: a (1 + e) foreshortened by the tilt, never past it.
    expect(now).toBeLessThan(SIRIUS_ORBIT.semiMajorAxisArcsec * (1 + SIRIUS_ORBIT.eccentricity));
    expect(SIRIUS_SKY_ORBIT.periodDays / 365.25).toBeCloseTo(50.1284, 4);
  });
});

describe('the catalogue records', () => {
  // Sirius A: Hipparcos, J1991.25; Sirius B: Gaia DR3 2947050466531873024, J2016.0, its parallax in A's glare.
  const aRecord = recordAtJ2000(
    { ...SIRIUS_A_HIPPARCOS, parallaxMas: 379.21, radialVelocityKmS: 0 },
    1991.25,
  );
  const bRecord = recordAtJ2000(
    {
      raDeg: 101.28662552099249,
      decDeg: -16.720932526023173,
      parallaxMas: 374.4896,
      pmRaMasPerYear: -461.5705,
      pmDecMasPerYear: -914.5196,
      radialVelocityKmS: 0,
    },
    2016,
  );

  it('are each recognised as its own star', () => {
    expect(matchSirius(aRecord)).toBe('Sirius A');
    expect(matchSirius(bRecord)).toBe('Sirius B');
  });

  it('have left the orbit by 3" and 7" by J2000, while the two are 4.5" apart', () => {
    const a = siriusAState(J2000_JD).position;
    const b = siriusBState(J2000_JD).position;
    expect(angleArcsec(aRecord, a)).toBeLessThan(4);
    expect(angleArcsec(bRecord, b)).toBeLessThan(8);
    expect(angleArcsec(a, b)).toBeCloseTo(4.46, 1);
  });

  it('leave every other star alone', () => {
    expect(matchSirius({ x: 2.64, y: 0, z: 0 })).toBeNull();
    expect(matchSirius({ x: aRecord.x * 2, y: aRecord.y * 2, z: aRecord.z * 2 })).toBeNull();
  });
});
