import { describe, expect, it } from 'vitest';

import { catalogDesignations } from './belt/buildBelt.ts';
import { CATALOG, getBody } from './catalog.ts';
import { FAR_BODIES, isInterstellar } from './farBodies.ts';
import { MINOR_PLANET_MOONS } from './moons/minorPlanetMoons.ts';

describe('the far bodies', () => {
  it('are asteroids about the Sun, sampled to a kilometre over the whole window', () => {
    for (const body of FAR_BODIES) {
      expect(body.kind, body.id).toBe('asteroid');
      expect(body.parent, body.id).toBeNull();
      expect(body.vectorWindow, body.id).toBe('full');
      expect(body.sampling, body.id).toEqual({ toleranceKm: 1, windowMonths: null });
    }
  });

  it('claim a size only where one was measured', () => {
    const unsized = FAR_BODIES.filter((body) => body.radiusPublished === false).map((body) => body.id);
    expect(unsized.sort()).toEqual(
      ['1i-oumuamua', '2012-vp113', '2017-of201', '2018-ag37', '2018-vg18', '2023-kq14', 'leleakuhonua'].sort(),
    );
    for (const id of unsized) {
      expect(getBody(id).shapeDrawn, id).toBe(false);
    }
    expect(getBody('sedna').radiusEquatorialKm).toBe(497.5);
  });

  it('are left out of the belt, by number or by provisional designation', () => {
    const excluded = catalogDesignations(CATALOG);
    for (const designation of ['90482', '120347', '50000', '20000', '28978', '225088', '90377', '541132', '2012 VP113', '2023 KQ14', '2017 OF201', '2018 VG18', '2018 AG37', '2017 U1']) {
      expect(excluded, designation).toContain(designation);
    }
  });

  it('know an interstellar object by its designation, and only that', () => {
    expect(isInterstellar(getBody('1i-oumuamua'))).toBe(true);
    expect(isInterstellar(getBody('3i-atlas'))).toBe(true);
    expect(isInterstellar(getBody('sedna'))).toBe(false);
    expect(isInterstellar(getBody('1p-halley'))).toBe(false);
  });
});

describe('the moons of the dwarf planets and trans-Neptunians', () => {
  it('hang from a primary the catalog draws about the Sun, measured from its centre', () => {
    for (const moon of MINOR_PLANET_MOONS) {
      const primary = getBody(moon.parent!);
      expect(primary.parent, moon.id).toBeNull();
      expect(primary.sampling, moon.id).toBeDefined();
      // JPL's primary-body centre for the system: 9 and the system's SPK number.
      expect(moon.center, moon.id).toMatch(/^500@9\d{8}$/);
      expect(moon.elementsCenter, moon.id).toBe(moon.center);
      expect(moon.kind, moon.id).toBe('moon');
    }
  });

  it('are each in the catalog once', () => {
    for (const moon of MINOR_PLANET_MOONS) {
      expect(CATALOG.filter((body) => body.id === moon.id || body.horizonsId === moon.horizonsId)).toHaveLength(1);
    }
  });

  it('hold Dimorphos far finer than its 1.2 km orbit', () => {
    const dimorphos = getBody('dimorphos');
    expect(dimorphos.sampling!.toleranceKm).toBeLessThan(0.001);
    expect(dimorphos.parent).toBe('didymos');
  });
});
