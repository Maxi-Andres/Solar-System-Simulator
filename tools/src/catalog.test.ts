import { describe, expect, it } from 'vitest';

import { CATALOG, getBody, SSB_CENTER, SUN_CENTER } from './catalog.ts';

describe('CATALOG', () => {
  it('covers the Sun, the eight planets and Pluto', () => {
    expect(CATALOG.map((body) => body.id)).toEqual([
      'sun',
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ]);
  });

  it('has unique ids and unique Horizons ids', () => {
    const ids = CATALOG.map((body) => body.id);
    const horizonsIds = CATALOG.map((body) => body.horizonsId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(horizonsIds).size).toBe(horizonsIds.length);
  });

  it('measures every v1 state vector against the barycenter', () => {
    for (const body of CATALOG) {
      expect(body.center).toBe(SSB_CENTER);
      // v1 has no nesting yet, but frames.ts already walks the tree.
      expect(body.parent).toBeNull();
    }
  });

  it('measures every drawn orbit against the Sun, not the barycenter', () => {
    for (const body of CATALOG.filter((candidate) => candidate.drawOrbit)) {
      expect(body.elementsCenter).toBe(SUN_CENTER);
    }
  });

  it('does not try to draw an orbit for the Sun', () => {
    expect(getBody('sun').drawOrbit).toBe(false);
  });

  it('has physically plausible radii', () => {
    for (const body of CATALOG) {
      expect(body.radiusEquatorialKm).toBeGreaterThan(0);
      // A rotating body bulges at the equator; it never bulges at the poles.
      expect(body.radiusPolarKm).toBeLessThanOrEqual(body.radiusEquatorialKm);
      // Flattening stays under 0.1 even for Saturn, the most oblate body here.
      const flattening = 1 - body.radiusPolarKm / body.radiusEquatorialKm;
      expect(flattening).toBeLessThan(0.1);
    }
  });

  it('orders bodies by mass the way the Solar System does', () => {
    const gm = (id: string): number => getBody(id).gmKm3S2;

    expect(gm('sun')).toBeGreaterThan(gm('jupiter'));
    expect(gm('jupiter')).toBeGreaterThan(gm('saturn'));
    expect(gm('saturn')).toBeGreaterThan(gm('neptune'));
    expect(gm('neptune')).toBeGreaterThan(gm('uranus'));
    expect(gm('uranus')).toBeGreaterThan(gm('earth'));
    expect(gm('earth')).toBeGreaterThan(gm('venus'));
    expect(gm('venus')).toBeGreaterThan(gm('mars'));
    expect(gm('mars')).toBeGreaterThan(gm('mercury'));
    expect(gm('mercury')).toBeGreaterThan(gm('pluto'));
  });

  it('marks Venus, Uranus and Pluto as retrograde rotators', () => {
    const retrograde = CATALOG.filter((body) => body.rotationPeriodHours < 0).map(
      (body) => body.id,
    );

    expect(retrograde).toEqual(['venus', 'uranus', 'pluto']);
  });

  it('uses six-digit hex colors, which the renderer and the CSS both accept', () => {
    for (const body of CATALOG) {
      expect(body.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('throws on an unknown id rather than returning undefined', () => {
    expect(() => getBody('planet-x')).toThrow(/Unknown body id: planet-x/);
  });
});
