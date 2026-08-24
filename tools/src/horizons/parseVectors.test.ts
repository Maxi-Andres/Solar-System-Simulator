import { describe, expect, it } from 'vitest';

import { getBody } from '../catalog.ts';
import { parseVectors } from './parseVectors.ts';
import earthVectors from './__fixtures__/earth-vectors.json' with { type: 'json' };
import sunVectors from './__fixtures__/sun-vectors.json' with { type: 'json' };

const EARTH = getBody('earth');
const SUN = getBody('sun');

describe('parseVectors', () => {
  it('produces aligned columns tagged with the body', () => {
    const table = parseVectors(earthVectors.result, EARTH);

    expect(table.id).toBe('earth');
    expect(table.horizonsId).toBe('399');
    expect(table.center).toBe('500@0');
    expect(table.count).toBe(4);

    for (const column of [table.t, table.x, table.y, table.z, table.vx, table.vy, table.vz]) {
      expect(column).toHaveLength(table.count);
    }
  });

  it('matches the fixture values exactly', () => {
    const table = parseVectors(earthVectors.result, EARTH);

    // 2026-Jan-01 00:00 TDB, Earth relative to the Solar System barycenter.
    expect(table.t[0]).toBe(2461041.5);
    expect(table.x[0]).toBeCloseTo(-26_531_002.41556548, 6);
    expect(table.y[0]).toBeCloseTo(143_946_899.5740296, 6);
    expect(table.z[0]).toBeCloseTo(10_806.81311843544, 6);
    expect(table.vx[0]).toBeCloseTo(-29.77650610770464, 9);
    expect(table.vy[0]).toBeCloseTo(-5.395962660572101, 9);
    expect(table.vz[0]).toBeCloseTo(0.0001753836198843395, 9);
  });

  it('samples one day apart, as requested', () => {
    const table = parseVectors(earthVectors.result, EARTH);

    for (let i = 1; i < table.count; i += 1) {
      expect(table.t[i]! - table.t[i - 1]!).toBeCloseTo(1, 9);
    }
  });

  it('reproduces the official Earth-Sun distance at perihelion', () => {
    // The frame is barycentric, so Earth's own vector is measured against the SSB,
    // which sits up to ~1.5e6 km from the Sun (mostly Jupiter's doing). The real
    // Earth-Sun distance is the difference of the two bodies' vectors.
    const earth = parseVectors(earthVectors.result, EARTH);
    const sun = parseVectors(sunVectors.result, SUN);

    const sunOffset = Math.hypot(sun.x[0]!, sun.y[0]!, sun.z[0]!);
    expect(sunOffset).toBeGreaterThan(500_000);
    expect(sunOffset).toBeLessThan(1_500_000);

    const r = Math.hypot(
      earth.x[0]! - sun.x[0]!,
      earth.y[0]! - sun.y[0]!,
      earth.z[0]! - sun.z[0]!,
    );
    const au = r / 149_597_870.7;

    // Perihelion falls on 3 January 2026, where the textbook value is 0.98329 AU.
    expect(au).toBeCloseTo(0.98333, 4);
  });

  it('puts Earth on the ecliptic plane it defines', () => {
    const table = parseVectors(earthVectors.result, EARTH);

    // The reference plane is the ecliptic of J2000, so Earth's Z is tiny compared
    // with the ~1.5e8 km in-plane distance: a good check that we read the right
    // columns and did not transpose axes.
    for (let i = 0; i < table.count; i += 1) {
      const inPlane = Math.hypot(table.x[i]!, table.y[i]!);
      expect(Math.abs(table.z[i]!) / inPlane).toBeLessThan(1e-3);
    }
  });

  it('rejects a time series that is not strictly increasing', () => {
    const scrambled = earthVectors.result.replace('2461042.500000000', '2461040.500000000');

    expect(() => parseVectors(scrambled, EARTH)).toThrow(/not strictly increasing/);
  });
});
