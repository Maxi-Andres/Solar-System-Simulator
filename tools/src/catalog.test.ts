import { describe, expect, it } from 'vitest';

import { CATALOG, getBody, SSB_CENTER, SUN_CENTER } from './catalog.ts';
import { stepMinutes } from './horizons/queries.ts';

const primaries = CATALOG.filter((body) => body.kind !== 'moon');
const moons = CATALOG.filter((body) => body.kind === 'moon');

describe('CATALOG', () => {
  it('covers the Sun, the eight planets and Pluto', () => {
    expect(primaries.map((body) => body.id)).toEqual([
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

  it('measures every top-level state vector against the barycenter', () => {
    for (const body of primaries) {
      expect(body.center).toBe(SSB_CENTER);
      expect(body.parent).toBeNull();
    }
  });

  it('measures every planetary orbit against the Sun, not the barycenter', () => {
    for (const body of primaries.filter((candidate) => candidate.drawOrbit)) {
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
      // Flattening stays under 0.1 even for Saturn, the most oblate body pulled round.
      // Phobos and Deimos are not round at all -- 0.30 and 0.35 -- and are exempt.
      if (body.parent !== 'mars') {
        const flattening = 1 - body.radiusPolarKm / body.radiusEquatorialKm;
        expect(flattening, body.id).toBeLessThan(0.1);
      }
    }
  });

  it('carries three radii exactly where the equator is not round, longest first', () => {
    for (const body of CATALOG) {
      const radii = body.triaxialRadiiKm;
      if (radii === null) {
        continue;
      }
      const [a, b, c] = radii;
      // The long axis points at the planet and the short one along the pole, which is
      // what tides do to a locked moon.
      expect(a, body.id).toBeGreaterThan(b);
      expect(b, body.id).toBeGreaterThanOrEqual(c);
      expect(body.radiusEquatorialKm, body.id).toBe(a);
      expect(body.radiusPolarKm, body.id).toBe(c);
    }
    expect(CATALOG.filter((body) => body.triaxialRadiiKm !== null).map((body) => body.id)).toEqual([
      'phobos',
      'deimos',
      'io',
      'europa',
      'mimas',
      'enceladus',
      'tethys',
      'dione',
      'rhea',
      'titan',
      'miranda',
      'ariel',
    ]);
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

  it('marks Venus, Uranus and Pluto as retrograde rotators, and the moons that turn with them', () => {
    const retrograde = CATALOG.filter((body) => body.rotationPeriodHours < 0).map(
      (body) => body.id,
    );

    // Uranus's five turn with Uranus, Charon with Pluto, and Triton against Neptune on
    // its retrograde orbit. Checked against JPL, which reports their longitudes
    // east-positive for exactly this reason: see moonRotation.test.ts.
    expect(retrograde).toEqual([
      'venus',
      'uranus',
      'pluto',
      'miranda',
      'ariel',
      'umbriel',
      'titania',
      'oberon',
      'triton',
      'charon',
    ]);
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

describe('the moons', () => {
  it('are the nineteen round ones and the two of Mars, each under its own planet', () => {
    const byParent = (parent: string): string[] =>
      moons.filter((body) => body.parent === parent).map((body) => body.id);

    expect(byParent('earth')).toEqual(['moon']);
    expect(byParent('mars')).toEqual(['phobos', 'deimos']);
    expect(byParent('jupiter')).toEqual(['io', 'europa', 'ganymede', 'callisto']);
    expect(byParent('saturn')).toEqual([
      'mimas',
      'enceladus',
      'tethys',
      'dione',
      'rhea',
      'titan',
      'iapetus',
    ]);
    expect(byParent('uranus')).toEqual(['miranda', 'ariel', 'umbriel', 'titania', 'oberon']);
    expect(byParent('neptune')).toEqual(['triton']);
    expect(byParent('pluto')).toEqual(['charon']);
    expect(moons).toHaveLength(21);
  });

  it("measure their vectors and their elements against the planet's own center", () => {
    // Not the planet's barycenter, which for Pluto sits 2131 km outside Pluto: the
    // frame tree adds each moon to its parent's body center, so that is what the
    // vectors must be relative to.
    for (const body of moons) {
      const parent = getBody(body.parent!);
      expect(body.center, body.id).toBe(`500@${parent.horizonsId}`);
      expect(body.elementsCenter, body.id).toBe(body.center);
    }
  });

  it('hang only off bodies that are not moons themselves', () => {
    for (const body of moons) {
      expect(getBody(body.parent!).kind, body.id).not.toBe('moon');
    }
  });

  it('are sampled at a whole number of minutes, which is how Horizons is asked', () => {
    for (const body of CATALOG) {
      expect(() => stepMinutes(body.stepDays), body.id).not.toThrow();
    }
  });

  it('take the short window, except the Moon, whose twenty years cost less than Mercury', () => {
    expect(moons.filter((body) => body.vectorWindow === 'full').map((body) => body.id)).toEqual([
      'moon',
    ]);
    // Everything that is not a moon keeps the full window.
    for (const body of primaries) {
      expect(body.vectorWindow, body.id).toBe('full');
    }
  });

  it("weigh what their planets' system masses say they weigh", () => {
    // Two independent publications have to agree here: DE440's system GM for each
    // giant, and the satellite ephemerides' GM for the planet alone and for each moon.
    // The difference between the first two is everything orbiting the planet, and the
    // moons in this catalog are nearly all of it. A mistyped digit in any of the three
    // shows up at once.
    //
    // Mars and Pluto are left out on purpose. Phobos and Deimos weigh less than the
    // uncertainty on Mars's own GM, and the Pluto values here are both of Pluto alone,
    // from two solutions.
    for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
      const planet = getBody(id);
      const satellites = planet.gmKm3S2 - planet.gmBodyOnlyKm3S2;
      const catalogued = moons
        .filter((body) => body.parent === id)
        .reduce((total, body) => total + body.gmKm3S2, 0);

      // Measured: Jupiter 0.009%, Saturn 0.02%, Uranus 0.11%, Neptune 0.10% -- the last
      // two inside the published uncertainty on Ariel's and Neptune's own masses.
      expect(Math.abs(satellites - catalogued) / catalogued, id).toBeLessThan(0.005);
    }
  });

  it('turn at the rate the IAU gives, which is the rate they orbit at', () => {
    // Two independent sources: the period is the sidereal orbital period, and the rate
    // is the IAU's W, read out of the PCK by script. Locked means they agree.
    for (const body of moons) {
      const fromRate = Math.abs(360 / body.rotation!.rotationRateDegPerDay) * 24;
      expect(Math.abs(fromRate / Math.abs(body.rotationPeriodHours) - 1), body.id).toBeLessThan(
        5e-4,
      );
    }
  });

  it('all carry their IAU rotation, and none a surface map yet', () => {
    for (const body of moons) {
      expect(body.rotation, body.id).not.toBeNull();
      expect(body.textures, body.id).toBeNull();
    }
  });
});
