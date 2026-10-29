import { describe, expect, it } from 'vitest';

import { MASS_PROXIMA_SUN } from './alphaCentauri.ts';
import {
  GM_EARTH,
  planetBodyDefinition,
  planetFramingKm,
  planetStateAboutStar,
  skyAxes,
  skyOffsetKm,
  type ExoPlanet,
} from './exoplanets.ts';
import { PROXIMA_PLANETS, proximaPlanetOf } from './proximaPlanets.ts';

const AU_KM = 149_597_870.7;
const GM_SUN = 1.3271244e11;
const toward = (() => {
  const v = { x: -0.47, y: -0.36, z: -0.8 };
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
})();
type V = { x: number; y: number; z: number };
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
const proxima = (letter: 'b' | 'c' | 'd') => PROXIMA_PLANETS.find((p) => p.id === `proxima-${letter}`)!;

const eccentric: ExoPlanet = {
  id: 'test-eccentric',
  name: 'Test',
  status: 'candidate',
  periodDays: 100,
  semiMajorAxisAu: 0.4,
  eccentricity: 0.3,
  argPeriastronDeg: 40,
  massEarth: 1,
  massIsMinimum: true,
  phase: { kind: 'conjunction', jd: 2461000 },
  inclinationDeg: 60,
  nodeDeg: 120,
  reference: '',
};

describe('the sky axes at a star', () => {
  it('are square to each other and to the line of sight', () => {
    const { east, north, away } = skyAxes(toward);
    expect(dot(east, north)).toBeCloseTo(0, 12);
    expect(dot(east, away)).toBeCloseTo(0, 12);
    expect(dot(north, away)).toBeCloseTo(0, 12);
    expect(Math.hypot(north.x, north.y, north.z)).toBeCloseTo(1, 12);
  });
});

describe('a planet on its orbit', () => {
  it('is as far toward the Sun as its tilt lets it be at inferior conjunction', () => {
    for (const planet of [eccentric, proxima('b')]) {
      const jd = planet.phase.kind === 'conjunction' ? planet.phase.jd : 0;
      const o = skyOffsetKm(planet, jd);
      const r = Math.hypot(o.east, o.north, o.away);
      expect(o.away / r).toBeCloseTo(-Math.sin(((planet.inclinationDeg ?? 90) * Math.PI) / 180), 9);
    }
  });

  it('comes back after one period', () => {
    const now = planetStateAboutStar(eccentric, 2461000.3, toward).position;
    const later = planetStateAboutStar(eccentric, 2461000.3 + eccentric.periodDays, toward).position;
    expect(Math.hypot(now.x - later.x, now.y - later.y, now.z - later.z) / AU_KM).toBeLessThan(1e-9);
  });

  it('keeps its periastron and apastron distances', () => {
    let min = Infinity;
    let max = 0;
    for (let k = 0; k < 2000; k += 1) {
      const p = planetStateAboutStar(eccentric, 2461000 + (k / 2000) * eccentric.periodDays, toward).position;
      const r = Math.hypot(p.x, p.y, p.z) / AU_KM;
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeCloseTo(0.4 * 0.7, 4);
    expect(max).toBeCloseTo(0.4 * 1.3, 4);
  });

  it('crosses the sky at the node given, and runs counterclockwise below 90 degrees of tilt', () => {
    const circle: ExoPlanet = {
      ...eccentric,
      eccentricity: 0,
      argPeriastronDeg: 0,
      phase: { kind: 'conjunction', jd: 0 },
    };
    // A quarter period after inferior conjunction: the ascending node, u = 0.
    const o = skyOffsetKm(circle, circle.periodDays / 4);
    expect(o.away / (circle.semiMajorAxisAu * AU_KM)).toBeCloseTo(0, 9);
    expect((Math.atan2(o.east, o.north) * 180) / Math.PI).toBeCloseTo(120, 6);
    // Moving away from us there, and its position angle growing.
    const next = skyOffsetKm(circle, circle.periodDays / 4 + 1);
    expect(next.away).toBeGreaterThan(0);
    expect(Math.atan2(next.east, next.north)).toBeGreaterThan(Math.atan2(o.east, o.north));
  });

  it('runs edge-on to the Sun with its node east-west when neither is measured', () => {
    const d = proxima('d');
    const a = planetStateAboutStar(d, 2461000, toward).position;
    const b = planetStateAboutStar(d, 2461001, toward).position;
    const normal = { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
    const n = Math.hypot(normal.x, normal.y, normal.z);
    expect(Math.abs(dot(normal, toward)) / n).toBeLessThan(1e-12);
    // The pole is then north-south: the node line, square to it and to us, east-west.
    expect(Math.abs(dot(normal, skyAxes(toward).north)) / n).toBeCloseTo(1, 12);
  });

  it("moves at the speed Kepler's third law gives for its star's mass", () => {
    const b = proxima('b');
    const { velocity } = planetStateAboutStar(b, 2461000, toward);
    const circular = Math.sqrt((GM_SUN * MASS_PROXIMA_SUN) / (b.semiMajorAxisAu * AU_KM));
    // The published period and distance agree with the star's mass to under a percent.
    expect(Math.hypot(velocity.x, velocity.y, velocity.z) / circular).toBeCloseTo(1, 2);
  });
});

describe('the body a planet becomes', () => {
  it('is a marker with no measured radius, orbiting its star, its mass its own', () => {
    const body = planetBodyDefinition(proxima('b'), 'star-2-193889');
    expect(body.parent).toBe('star-2-193889');
    expect(body.radiusPublished).toBe(false);
    expect(body.shapeDrawn).toBe(false);
    expect(body.drawOrbit).toBe(true);
    expect(body.gmKm3S2).toBeCloseTo(1.07 * GM_EARTH, 6);
  });

  it('is grey unless confirmed', () => {
    expect(planetBodyDefinition(proxima('c'), 'x').color).toBe('#7c7c7c');
    expect(planetBodyDefinition({ ...proxima('c'), status: 'disputed' }, 'x').color).toBe('#7c7c7c');
    expect(planetBodyDefinition(proxima('b'), 'x').color).not.toBe('#7c7c7c');
  });

  it('is framed with its star and its whole orbit in view', () => {
    // 27 degrees of frame: the orbit's widest must fit in it from where the camera stands.
    for (const p of [...PROXIMA_PLANETS, eccentric]) {
      const halfHeight = planetFramingKm(p) * Math.tan((13.5 * Math.PI) / 180);
      expect(halfHeight).toBeGreaterThan(1.1 * p.semiMajorAxisAu * (1 + p.eccentricity) * AU_KM);
    }
  });
});

describe("Proxima's planets", () => {
  it('lists b and d as confirmed and c as a candidate, named so', () => {
    expect(proxima('b').status).toBe('confirmed');
    expect(proxima('d').status).toBe('confirmed');
    expect(proxima('c').status).toBe('candidate');
    expect(proxima('c').name).toContain('candidate');
    expect(proximaPlanetOf('proxima-b')?.name).toBe('Proxima Centauri b');
    expect(proximaPlanetOf('earth')).toBeNull();
  });
});
