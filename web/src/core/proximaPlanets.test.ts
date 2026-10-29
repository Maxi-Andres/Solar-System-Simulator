import { describe, expect, it } from 'vitest';

import { MASS_PROXIMA_SUN } from './alphaCentauri.ts';
import { planetBodyDefinition, planetFramingKm, planetStateAboutStar, PROXIMA_PLANETS, proximaPlanetOf } from './proximaPlanets.ts';

const AU_KM = 149_597_870.7;
const toward = (() => {
  const v = { x: -0.47, y: -0.36, z: -0.8 };
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
})();
const planet = (key: 'b' | 'c' | 'd') => PROXIMA_PLANETS.find((p) => p.key === key)!;

describe("Proxima's planets", () => {
  it('lists b and d as confirmed and c as a candidate, named so', () => {
    expect(planet('b').status).toBe('confirmed');
    expect(planet('d').status).toBe('confirmed');
    expect(planet('c').status).toBe('candidate');
    expect(planet('c').name).toContain('candidate');
  });

  it('keeps each on a circle of its semi-major axis', () => {
    for (const p of PROXIMA_PLANETS) {
      for (const jd of [2461000, 2461003.7, 2461500]) {
        const { position } = planetStateAboutStar(p, jd, toward);
        expect(Math.hypot(position.x, position.y, position.z) / AU_KM).toBeCloseTo(p.semiMajorAxisAu, 9);
      }
    }
  });

  it('comes back after one period', () => {
    const b = planet('b');
    const now = planetStateAboutStar(b, 2461000, toward).position;
    const later = planetStateAboutStar(b, 2461000 + b.periodDays, toward).position;
    expect(Math.hypot(now.x - later.x, now.y - later.y, now.z - later.z) / AU_KM).toBeLessThan(1e-9);
  });

  it('is between Proxima and the Sun at its inferior conjunction', () => {
    const b = planet('b');
    const { position } = planetStateAboutStar(b, b.epochJd, toward);
    const along = position.x * toward.x + position.y * toward.y + position.z * toward.z;
    expect(along / AU_KM).toBeCloseTo(-b.semiMajorAxisAu, 9);
  });

  it('runs edge-on to the Sun: the orbit\'s plane holds our line of sight', () => {
    const d = planet('d');
    const a = planetStateAboutStar(d, 2461000, toward).position;
    const b = planetStateAboutStar(d, 2461001, toward).position;
    const normal = { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
    const n = Math.hypot(normal.x, normal.y, normal.z);
    expect(Math.abs(normal.x * toward.x + normal.y * toward.y + normal.z * toward.z) / n).toBeLessThan(1e-12);
  });

  it("moves at the speed Kepler's third law gives for Proxima's mass", () => {
    const b = planet('b');
    const { velocity } = planetStateAboutStar(b, 2461000, toward);
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const gm = 1.3271244e11 * MASS_PROXIMA_SUN;
    const circular = Math.sqrt(gm / (b.semiMajorAxisAu * AU_KM));
    // The published period and distance agree with the star's mass to under a percent.
    expect(speed / circular).toBeCloseTo(1, 2);
  });

  it('becomes a marker with no measured radius, orbiting its star', () => {
    const body = planetBodyDefinition(planet('b'), 'star-2-193889');
    expect(body.parent).toBe('star-2-193889');
    expect(body.radiusPublished).toBe(false);
    expect(body.drawOrbit).toBe(true);
    expect(proximaPlanetOf(body.id)?.key).toBe('b');
  });

  it('frames each with its star and its whole orbit in view', () => {
    // 27 degrees of frame: the orbit's diameter must fit in it from where the camera stands.
    for (const p of PROXIMA_PLANETS) {
      const halfHeight = planetFramingKm(p) * Math.tan((13.5 * Math.PI) / 180);
      expect(halfHeight).toBeGreaterThan(1.1 * p.semiMajorAxisAu * AU_KM);
    }
  });
});
