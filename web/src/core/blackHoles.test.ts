import { describe, expect, it } from 'vitest';

import { directionToGalactic, GALACTIC_BASIS } from '../scene/galactic.ts';
import { colorIndexToTemperature } from '../scene/blackbody.ts';
import {
  BLACK_HOLE_SYSTEMS,
  CYG_X1,
  CYG_X1_CONJUNCTION_JD,
  blackHoleState,
  blackHoleSystemOf,
  colorIndexForTemperature,
  DARK_BINARIES,
  distancePc,
  ensureBlackHoles,
  GAIA_BH1,
  GAIA_BH3,
  julianEpochJd,
  keplerPeriodDays,
  keplerSemiMajorAxisKm,
  M87_DISTANCE_MPC,
  M87_MASS_SUN,
  relativeSkyOrbit,
  S2_ID,
  S2_SKY_ORBIT,
  s2StateAboutSgrA,
  schwarzschildRadiusKm,
  SGR_A_DISTANCE_PC,
  SGR_A_ID,
  SGR_A_MASS_SUN,
  sgrAState,
  skyOrbitState,
  starRadialVelocityKmS,
  starStateAboutBlackHole,
  thieleInnes,
  totalMassSun,
} from './blackHoles.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import { galacticCentrePc } from './milkyWay.ts';
import { J2000_JD } from './time.ts';

const AU_KM = 149_597_870.7;
const PARSEC_KM = (AU_KM * 648_000) / Math.PI;
const LIGHT_YEAR_KM = 299_792.458 * 365.25 * 86_400;
const MAS = Math.PI / (180 * 3600 * 1000);

describe('event horizons', () => {
  it('is 2GM/c^2: 2.953 km per solar mass', () => {
    expect(schwarzschildRadiusKm(1)).toBeCloseTo(2.9533, 4);
  });

  it("puts Sgr A*'s at 12.7 million km, 0.085 AU, 10 microarcseconds: GRAVITY 2018's R_S", () => {
    const rs = schwarzschildRadiusKm(SGR_A_MASS_SUN);
    expect(rs / 1e6).toBeCloseTo(12.7, 1);
    expect(rs / AU_KM).toBeCloseTo(0.085, 3);
    // "R_S ~ 10 microarcsec ~ 0.08 AU" (GRAVITY Collaboration 2018, A&A 615, L15).
    expect((rs / (SGR_A_DISTANCE_PC * PARSEC_KM) / MAS) * 1000).toBeCloseTo(10.3, 1);
    // A fifth of Mercury's orbit: inside it, as the plan says.
    expect(rs / AU_KM / 0.387).toBeLessThan(0.25);
  });

  it("puts Gaia BH1's at 28 km and BH3's at 97 km", () => {
    expect(schwarzschildRadiusKm(GAIA_BH1.blackHoleMassSun)).toBeCloseTo(28.4, 1);
    expect(schwarzschildRadiusKm(GAIA_BH3.blackHoleMassSun)).toBeCloseTo(96.6, 1);
  });

  it("puts M87*'s past Pluto -- and its angular scale at EHT 2019's 3.8 microarcseconds", () => {
    const rsAu = schwarzschildRadiusKm(M87_MASS_SUN) / AU_KM;
    expect(rsAu).toBeCloseTo(128, 0);
    // Pluto's aphelion is 49.3 AU.
    expect(rsAu).toBeGreaterThan(2.5 * 49.3);
    // theta_g = GM / (c^2 D) = r_s / 2D: EHT 2019 Paper I, Table 1, 3.8 +- 0.4 microarcsec.
    const thetaG = schwarzschildRadiusKm(M87_MASS_SUN) / 2 / (M87_DISTANCE_MPC * 1e6 * PARSEC_KM);
    expect((thetaG / MAS) * 1000).toBeCloseTo(3.8, 1);
  });
});

describe('Sgr A*', () => {
  const at = sgrAState(julianEpochJd(2015)).position;

  it('is at GRAVITY 2024 distance, 27,000 light years', () => {
    expect(distancePc(at)).toBeCloseTo(SGR_A_DISTANCE_PC, 1);
    expect(Math.hypot(at.x, at.y, at.z) / LIGHT_YEAR_KM).toBeCloseTo(26_992, -1);
  });

  it('comes out at galactic l = 359.944, b = -0.046, as Sgr A* is catalogued', () => {
    const { longitudeDeg, latitudeDeg } = directionToGalactic(at);
    expect(longitudeDeg).toBeCloseTo(359.944, 3);
    expect(latitudeDeg).toBeCloseTo(-0.046, 3);
  });

  it('moves 6.4 mas a year across the sky: the Sun going round the Galaxy, 250 km/s', () => {
    const later = sgrAState(julianEpochJd(2016)).position;
    // The angle from the cross product: its cosine is 1 to within float64's last digit.
    const cross = Math.hypot(
      at.y * later.z - at.z * later.y,
      at.z * later.x - at.x * later.z,
      at.x * later.y - at.y * later.x,
    );
    const angle = cross / (Math.hypot(at.x, at.y, at.z) * Math.hypot(later.x, later.y, later.z));
    // Gordon et al. 2023: 6.400 +- 0.073 mas/yr.
    expect(angle / MAS).toBeCloseTo(6.4, 2);
    const v = sgrAState(J2000_JD).velocity;
    const tangential = Math.sqrt(Math.max(0, v.x ** 2 + v.y ** 2 + v.z ** 2 - 11.1 ** 2));
    expect(tangential).toBeGreaterThan(245);
    expect(tangential).toBeLessThan(255);
  });

  it("is 126 pc (1.5%) beyond the galaxy model's centre, which keeps Reid et al.'s 8.15 kpc", () => {
    const [cx, cy, cz] = galacticCentrePc();
    const { x, y, z } = GALACTIC_BASIS;
    const model = {
      x: x.x * cx + y.x * cy + z.x * cz,
      y: x.y * cx + y.y * cy + z.y * cz,
      z: x.z * cx + y.z * cy + z.z * cz,
    };
    const sgr = { x: at.x / PARSEC_KM, y: at.y / PARSEC_KM, z: at.z / PARSEC_KM };
    const offset = Math.hypot(sgr.x - model.x, sgr.y - model.y, sgr.z - model.z);
    expect(offset).toBeGreaterThan(120);
    expect(offset).toBeLessThan(132);
    expect(offset / SGR_A_DISTANCE_PC).toBeCloseTo(0.015, 2);
  });
});

describe('S2 on its GRAVITY orbit', () => {
  const orbit = S2_SKY_ORBIT;
  const distanceKm = SGR_A_DISTANCE_PC * PARSEC_KM;

  it('goes round in 16.05 years (Kepler, from the fitted a, mass and distance)', () => {
    expect(orbit.periodDays / 365.25).toBeGreaterThan(16.0);
    expect(orbit.periodDays / 365.25).toBeLessThan(16.1);
  });

  it('passes 120 AU, 1,400 Schwarzschild radii, from Sgr A* (GRAVITY 2018) at 7,700 km/s (2022)', () => {
    const peri = s2StateAboutSgrA(orbit.periastronJd);
    const r = Math.hypot(peri.position.x, peri.position.y, peri.position.z);
    expect(r / AU_KM).toBeCloseTo(120, -1);
    expect(r / schwarzschildRadiusKm(SGR_A_MASS_SUN)).toBeGreaterThan(1350);
    expect(r / schwarzschildRadiusKm(SGR_A_MASS_SUN)).toBeLessThan(1450);
    const speed = Math.hypot(peri.velocity.x, peri.velocity.y, peri.velocity.z);
    expect(Math.abs(speed - 7700)).toBeLessThan(100);
  });

  it('was at periastron on 2018 May 19, as GRAVITY 2018 reports (MJD 58257.67)', () => {
    expect(Math.abs(orbit.periastronJd - (58257.67 + 2400000.5))).toBeLessThan(1);
  });

  it("puts periastron 2 mas east and 11 mas south of Sgr A*, as GRAVITY 2018's Fig. 2", () => {
    const sky = skyOrbitState(orbit, orbit.periastronJd).position;
    expect((sky.east / distanceKm) / MAS).toBeCloseTo(1.9, 0);
    expect((sky.north / distanceKm) / MAS).toBeCloseTo(-10.8, 0);
  });

  it('reaches 0.18 arcsec north at apocentre, at the top of that figure', () => {
    const sky = skyOrbitState(orbit, orbit.periastronJd + orbit.periodDays / 2).position;
    expect((sky.north / distanceKm) / MAS / 1000).toBeCloseTo(0.176, 2);
    expect(Math.abs(sky.east / distanceKm / MAS / 1000)).toBeLessThan(0.05);
  });

  it('recedes at up to 4,000 km/s just before periastron and approaches at 1,900 after', () => {
    let max = -Infinity;
    let min = Infinity;
    for (let k = -2000; k <= 2000; k += 1) {
      const away = skyOrbitState(orbit, orbit.periastronJd + k * 0.05).velocity.away;
      max = Math.max(max, away);
      min = Math.min(min, away);
    }
    expect(Math.abs(max - 3970)).toBeLessThan(80);
    expect(Math.abs(min + 1880)).toBeLessThan(80);
    // Receding before periastron, approaching two months after: Fig. 2's 2018 swing.
    expect(skyOrbitState(orbit, orbit.periastronJd - 10).velocity.away).toBeGreaterThan(2000);
    expect(skyOrbitState(orbit, orbit.periastronJd + 60).velocity.away).toBeLessThan(-500);
  });
});

describe('Gaia BH1 and BH3', () => {
  it("give back El-Badry et al.'s Thiele-Innes constants (their appendix table, joint fit)", () => {
    // a0 = 2.67 mas, the star's orbit about the barycentre, which a dark companion makes the photocentre's.
    const ti = thieleInnes(2.67, GAIA_BH1.inclinationDeg, GAIA_BH1.nodeDeg, GAIA_BH1.argPeriastronDeg);
    expect(Math.abs(ti.A - -0.01)).toBeLessThan(0.05);
    expect(Math.abs(ti.B - 2.62)).toBeLessThan(0.03);
    expect(Math.abs(ti.F - 1.61)).toBeLessThan(0.03);
    expect(Math.abs(ti.G - -0.36)).toBeLessThan(0.05);
  });

  it('have separations Kepler gives from their periods and masses that agree with the papers', () => {
    for (const binary of DARK_BINARIES) {
      const a = keplerSemiMajorAxisKm(binary.periodDays, totalMassSun(binary));
      const starOrbitAu = (a * binary.blackHoleMassSun) / totalMassSun(binary) / AU_KM;
      expect(Math.abs(starOrbitAu / binary.publishedStarOrbitAu - 1)).toBeLessThan(0.01);
      // And on the sky, at the parallax: a0 = a1 * parallax.
      if (binary.publishedStarOrbitMas !== null) {
        expect(Math.abs((starOrbitAu * binary.barycentre.parallaxMas) / binary.publishedStarOrbitMas - 1)).toBeLessThan(0.01);
      }
      expect(keplerPeriodDays(a, totalMassSun(binary))).toBeCloseTo(binary.periodDays, 6);
    }
    // BH1's relative orbit: their 1.40 AU.
    expect(relativeSkyOrbit(GAIA_BH1).semiMajorAxisKm / AU_KM).toBeCloseTo(1.4, 2);
  });

  it("swing BH1's star at K = 67 km/s, as its radial velocities alone give 66.7 +- 0.6", () => {
    let max = -Infinity;
    let min = Infinity;
    for (let k = 0; k < 2000; k += 1) {
      const rv = starRadialVelocityKmS(GAIA_BH1, GAIA_BH1.periastronJd + (k / 2000) * GAIA_BH1.periodDays);
      max = Math.max(max, rv);
      min = Math.min(min, rv);
    }
    expect(Math.abs((max - min) / 2 - 66.7)).toBeLessThan(1.2);
  });

  it("give BH3's star the radial velocities measured from the ground (their appendix table), to 1 km/s", () => {
    const measured: readonly (readonly [number, number])[] = [
      [2459158.5333, -383.2],
      [2460143.4948, -364.05],
      [2460192.4359, -363.15],
      [2460193.4833, -363.24],
    ];
    for (const [jd, rv] of measured) {
      expect(Math.abs(starRadialVelocityKmS(GAIA_BH3, jd) - rv)).toBeLessThan(1);
    }
  });

  it('are at 1,560 and 1,926 light years', () => {
    const ly = (binary: (typeof DARK_BINARIES)[number]) => {
      const p = blackHoleState(binary)(binary.barycentre.epochJd).position;
      return Math.hypot(p.x, p.y, p.z) / LIGHT_YEAR_KM;
    };
    expect(ly(GAIA_BH1)).toBeCloseTo(1561, -1);
    expect(ly(GAIA_BH3)).toBeCloseTo(1926, -1);
  });

  it('keep the barycentre on its straight line: black hole and star balance about it', () => {
    for (const binary of DARK_BINARIES) {
      const jd = binary.periastronJd + 40;
      const hole = blackHoleState(binary)(jd).position;
      const rel = starStateAboutBlackHole(binary, jd).position;
      const star = { x: hole.x + rel.x, y: hole.y + rel.y, z: hole.z + rel.z };
      const m = totalMassSun(binary);
      const bary = {
        x: (hole.x * binary.blackHoleMassSun + star.x * binary.starMassSun) / m,
        y: (hole.y * binary.blackHoleMassSun + star.y * binary.starMassSun) / m,
        z: (hole.z * binary.blackHoleMassSun + star.z * binary.starMassSun) / m,
      };
      const line = blackHoleState({ ...binary, starMassSun: 1e-12 })(jd).position;
      // To the kilometre, at 1.5e16 km: float64's own step there.
      expect(Math.hypot(bary.x - line.x, bary.y - line.y, bary.z - line.z)).toBeLessThan(10);
    }
  });

  it('put each black hole where its system is on the sky, within its wobble', () => {
    for (const binary of DARK_BINARIES) {
      const p = blackHoleState(binary)(binary.barycentre.epochJd).position;
      const ra = binary.barycentre.raDeg * (Math.PI / 180);
      const dec = binary.barycentre.decDeg * (Math.PI / 180);
      const eps = (84381.448 / 3600) * (Math.PI / 180);
      const eq = { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
      const scene = { x: eq.x, y: eq.y * Math.cos(eps) + eq.z * Math.sin(eps), z: -eq.y * Math.sin(eps) + eq.z * Math.cos(eps) };
      // The angle from the cross product: an arccosine of a cosine this near 1 has no digits
      // left below a few mas.
      const cross = Math.hypot(
        p.y * scene.z - p.z * scene.y,
        p.z * scene.x - p.x * scene.z,
        p.x * scene.y - p.y * scene.x,
      );
      const angleMas = Math.atan2(cross, p.x * scene.x + p.y * scene.y + p.z * scene.z) / MAS;
      // The black hole's own wobble about the barycentre: 0.24 mas for BH1, 2.3 for BH3,
      // 0.07 for Cygnus X-1.
      expect(angleMas).toBeLessThan(binary === CYG_X1 ? 0.1 : 3);
    }
  });
});

describe('Cygnus X-1', () => {
  it('swings its supergiant at K = 75 km/s, as Miller-Jones et al. fit (75.21)', () => {
    let max = -Infinity;
    let min = Infinity;
    for (let k = 0; k < 2000; k += 1) {
      const rv = starRadialVelocityKmS(CYG_X1, CYG_X1.periastronJd + (k / 2000) * CYG_X1.periodDays);
      max = Math.max(max, rv);
      min = Math.min(min, rv);
    }
    expect(Math.abs((max - min) / 2 - 75.21)).toBeLessThan(1);
    // About the system's own -7.0 km/s (Gies et al. 2003).
    expect((max + min) / 2).toBeCloseTo(-7.0 + 75.2 * CYG_X1.eccentricity * Math.cos((CYG_X1.argPeriastronDeg * Math.PI) / 180), 0);
  });

  it('has its star in front of the hole at the conjunction Gies et al. timed', () => {
    const rel = starStateAboutBlackHole(CYG_X1, CYG_X1_CONJUNCTION_JD);
    const toward = blackHoleState(CYG_X1)(CYG_X1_CONJUNCTION_JD).position;
    const n = Math.hypot(toward.x, toward.y, toward.z);
    // Its offset from the hole along the line of sight: toward us, all of the projected separation's worth.
    const along = (rel.position.x * toward.x + rel.position.y * toward.y + rel.position.z * toward.z) / n;
    const r = Math.hypot(rel.position.x, rel.position.y, rel.position.z);
    expect(along / r).toBeCloseTo(-Math.sin((27.51 * Math.PI) / 180), 2);
    // Periastron a tenth of a period later: Miller-Jones et al. put it at phase 0.109 of
    // another ephemeris.
    const phase = (CYG_X1.periastronJd - CYG_X1_CONJUNCTION_JD) / CYG_X1.periodDays;
    expect(phase).toBeGreaterThan(0.09);
    expect(phase).toBeLessThan(0.11);
  });

  it('is 2.22 kpc away, its star 0.0838 AU from the barycentre, its horizon 63 km', () => {
    const p = blackHoleState(CYG_X1)(CYG_X1.barycentre.epochJd).position;
    expect(Math.hypot(p.x, p.y, p.z) / PARSEC_KM).toBeCloseTo(2220, -1);
    expect(schwarzschildRadiusKm(CYG_X1.blackHoleMassSun)).toBeCloseTo(62.6, 1);
    expect(relativeSkyOrbit(CYG_X1).semiMajorAxisKm / AU_KM).toBeCloseTo(0.244, 3);
  });
});

describe('the bodies', () => {
  it('are eight, the stars about their black holes, found by id', () => {
    const store = new EphemerisStore({
      manifest: { bodies: [], tables: {} },
      bodies: [],
      vectors: new Map(),
      elements: new Map(),
      generatedAt: new Date(0),
    } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
    ensureBlackHoles(store);
    ensureBlackHoles(store);
    const ids = ['sgr-a-star', 's2', 'gaia-bh1', 'gaia-bh1-star', 'gaia-bh3', 'gaia-bh3-star', 'cyg-x1', 'cyg-x1-star'];
    for (const id of ids) {
      expect(store.isPropagatedBody(id)).toBe(true);
    }
    expect(store.body(S2_ID).parent).toBe(SGR_A_ID);
    expect(store.body(SGR_A_ID).kind).toBe('black-hole');
    expect(store.body(SGR_A_ID).radiusEquatorialKm).toBeCloseTo(schwarzschildRadiusKm(SGR_A_MASS_SUN), 3);
    expect(blackHoleSystemOf('gaia-bh3-star')?.id).toBe('gaia-bh3');
    expect(blackHoleSystemOf('earth')).toBeNull();
    expect(BLACK_HOLE_SYSTEMS).toHaveLength(4);
  });

  it("colour their stars by the scene's own relation, run backwards", () => {
    expect(colorIndexToTemperature(colorIndexForTemperature(5850))).toBeCloseTo(5850, 0);
    expect(colorIndexToTemperature(colorIndexForTemperature(5212))).toBeCloseTo(5212, 0);
  });
});
