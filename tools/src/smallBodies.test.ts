import { describe, expect, it } from 'vitest';

import { SSB_CENTER, SUN_CENTER } from './catalog.ts';
import { SMALL_BODY_TOLERANCE_KM } from './config.ts';
import { stepMinutes } from './horizons/queries.ts';
import { SMALL_BODIES } from './smallBodies.ts';

/** Newton's constant, km^3 kg^-1 s^-2 (CODATA 2018). */
const G = 6.6743e-20;

const byId = (id: string) => SMALL_BODIES.find((body) => body.id === id)!;

describe('the named small bodies', () => {
  it('are the four other dwarf planets and the asteroids worth naming', () => {
    expect(
      SMALL_BODIES.filter((body) => body.kind === 'dwarf-planet').map((body) => body.id),
    ).toEqual(['ceres', 'haumea', 'makemake', 'eris']);
    expect(SMALL_BODIES.filter((body) => body.kind === 'asteroid')).toHaveLength(11);
  });

  it('hang from the barycentre, with their ellipses about the Sun', () => {
    for (const body of SMALL_BODIES) {
      expect(body.parent, body.id).toBeNull();
      expect(body.center, body.id).toBe(SSB_CENTER);
      expect(body.elementsCenter, body.id).toBe(SUN_CENTER);
      expect(body.drawOrbit, body.id).toBe(true);
    }
  });

  it('ask Horizons for the small body, not a planet of the same number', () => {
    // '4' alone is Mars's barycentre; '4;' is Vesta.
    for (const body of SMALL_BODIES) {
      expect(body.horizonsId, body.id).toMatch(/^\d+;$/);
    }
  });

  it('are sampled to a kilometre over the full window, starting from whole minutes', () => {
    for (const body of SMALL_BODIES) {
      expect(body.vectorWindow, body.id).toBe('full');
      expect(body.sampling, body.id).toEqual({
        toleranceKm: SMALL_BODY_TOLERANCE_KM,
        windowMonths: null,
      });
      expect(() => stepMinutes(body.stepDays), body.id).not.toThrow();
    }
  });

  it('draw a shape only where one can be drawn honestly', () => {
    const drawn = SMALL_BODIES.filter((body) => body.shapeDrawn !== false).map((body) => body.id);
    expect(drawn).toEqual(['ceres', 'makemake', 'eris', 'vesta']);
    for (const body of SMALL_BODIES.filter((candidate) => candidate.shapeDrawn !== false)) {
      // Anything not a sphere needs its axis, or it would be flattened the wrong way.
      if (body.radiusPolarKm !== body.radiusEquatorialKm) {
        expect(body.rotation, body.id).not.toBeNull();
      }
    }
  });

  it('carry the measured masses, and zero where none is measured', () => {
    expect(byId('ceres').gmKm3S2).toBe(62.6284);
    expect(byId('vesta').gmKm3S2).toBe(17.2882844);
    // Haumea's from its mass, 4.006e21 kg (Ragozzine & Brown 2009).
    expect(byId('haumea').gmKm3S2).toBeCloseTo(4.006e21 * G, 1);
    for (const id of ['makemake', 'apophis', 'arrokoth', 'donaldjohanson', 'eurybates']) {
      expect(byId(id).gmKm3S2, id).toBe(0);
    }
  });

  it('give no single period for the bodies that tumble', () => {
    expect(byId('apophis').rotationPeriodHours).toBeNull();
    expect(byId('donaldjohanson').rotationPeriodHours).toBeNull();
  });

  it("turn Ceres and Vesta at their IAU rates, which are their periods", () => {
    for (const id of ['ceres', 'vesta']) {
      const body = byId(id);
      expect((360 / body.rotation!.rotationRateDegPerDay) * 24, id).toBeCloseTo(
        body.rotationPeriodHours!,
        9,
      );
    }
    expect(byId('ceres').rotationPeriodHours).toBeCloseTo(9.07417, 5);
    expect(byId('vesta').rotationPeriodHours).toBeCloseTo(5.342128, 6);
  });
});
