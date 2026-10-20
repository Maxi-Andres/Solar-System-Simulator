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
    expect(drawn).toEqual([
      'ceres',
      'makemake',
      'eris',
      'bennu',
      'ryugu',
      'didymos',
      'vesta',
      'donaldjohanson',
      'arrokoth',
    ]);
    // The irregular ones from their teams' models, never from their radii.
    const modelled = SMALL_BODIES.filter((body) => body.shapeModel !== undefined);
    expect(modelled.map((body) => body.id)).toEqual([
      'bennu',
      'ryugu',
      'didymos',
      'donaldjohanson',
      'arrokoth',
    ]);
    for (const body of modelled) {
      expect(body.rotation, body.id).not.toBeNull();
      expect(body.textures, body.id).toBeNull();
      expect(body.shapeModel!.albedo, body.id).toBeGreaterThan(0.01);
      expect(body.shapeModel!.albedo, body.id).toBeLessThan(0.5);
    }
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

  it("turn the shaped bodies by their missions' PCKs, as those files give them", () => {
    // bennu_v17.tpc, ryugu_v10.tpc, didymos_system_15.tpc (BODY920065803),
    // donaldjohanson_v12.tpc, nh_arrokoth_002.tpc: pole RA, Dec, W0, W1, W2.
    const pck: Record<string, readonly number[]> = {
      bennu: [85.45864, -60.36468, 150.48977, 2011.143058731885, 2.0e-6],
      ryugu: [96.43112, -66.38741, 274.16225, 1131.98280286, 0],
      didymos: [69.326861266078069, -72.724550395829496, 0, 3823.008849557522, 0],
      donaldjohanson: [324.66115, 50.95721, 293.17865, 34.409504086, 0],
      arrokoth: [319.368582, -25.5875063, 71.9541475, 559.393617318826386509, 0],
    };
    for (const [id, [ra, dec, w0, w1, w2]] of Object.entries(pck)) {
      const rotation = byId(id).rotation!;
      expect(
        [
          rotation.poleRaDeg,
          rotation.poleDecDeg,
          rotation.primeMeridianDeg,
          rotation.rotationRateDegPerDay,
          rotation.primeMeridianAccelDegPerDay2,
        ],
        id,
      ).toEqual([ra, dec, w0, w1, w2]);
      expect(rotation.periodicTerms, id).toEqual([]);
    }
  });

  it('spin the way their published periods say, where one is published', () => {
    // Bennu, Ryugu and Didymos: the PCK's rate is the period, to its last digit.
    for (const id of ['bennu', 'ryugu', 'didymos']) {
      const body = byId(id);
      const hours = (360 / body.rotation!.rotationRateDegPerDay) * 24;
      expect(hours / Math.abs(body.rotationPeriodHours!), id).toBeCloseTo(1, 4);
    }
    // Arrokoth's kernel rate is 15.445 h, 3% off its published 15.92: kept, and said.
    const arrokoth = byId('arrokoth');
    expect((360 / arrokoth.rotation!.rotationRateDegPerDay) * 24).toBeCloseTo(15.445, 3);
    expect(arrokoth.shapeModel!.orientationNote).toMatch(/unknown/);
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
