import { describe, expect, it } from 'vitest';

import { getBody } from '../catalog.ts';
import { parseElements } from './parseElements.ts';
import earthElements from './__fixtures__/earth-elements.json' with { type: 'json' };

const EARTH = getBody('earth');

describe('parseElements', () => {
  it('maps every Horizons column to a named field', () => {
    const elements = parseElements(earthElements.result, EARTH);

    expect(elements).toStrictEqual({
      id: 'earth',
      // Heliocentric, not barycentric: an ellipse needs the dominating mass at its
      // focus. See SUN_CENTER in catalog.ts.
      center: '500@10',
      epochJd: 2461041.5,
      eccentricity: 0.01591429536350342,
      periapsisKm: 147098602.1592249,
      inclinationDeg: 0.003549055731418342,
      ascendingNodeDeg: 177.6179030721728,
      argPeriapsisDeg: 286.3568704502947,
      periapsisTimeJd: 2461045.196355864,
      meanMotionDegPerSec: 0.00001142130337831415,
      meanAnomalyDeg: 356.3524337712979,
      trueAnomalyDeg: 356.2340674073986,
      semiMajorAxisKm: 149477430.1325314,
      apoapsisKm: 151856258.105838,
      periodSec: 31520045.31142557,
    });
  });

  it('describes an orbit that is physically Earth-like', () => {
    const elements = parseElements(earthElements.result, EARTH);
    const au = elements.semiMajorAxisKm / 149_597_870.7;
    const periodDays = elements.periodSec / 86_400;

    // Heliocentric elements land on the textbook values: 1 AU and 365.25 days.
    // The barycentric request that this replaced was off by a visible margin.
    expect(au).toBeCloseTo(1, 2);
    expect(periodDays).toBeCloseTo(365.25, 0);
    expect(elements.eccentricity).toBeLessThan(0.02);
    // Measured against the ecliptic of J2000, so Earth's inclination is ~0.
    expect(elements.inclinationDeg).toBeLessThan(0.01);
  });

  it('keeps periapsis, semi-major axis and apoapsis mutually consistent', () => {
    const elements = parseElements(earthElements.result, EARTH);

    const fromEccentricity = elements.semiMajorAxisKm * (1 - elements.eccentricity);
    expect(elements.periapsisKm).toBeCloseTo(fromEccentricity, 3);

    const meanOfExtremes = (elements.periapsisKm + elements.apoapsisKm) / 2;
    expect(elements.semiMajorAxisKm).toBeCloseTo(meanOfExtremes, 3);
  });

  it('fails loudly if Horizons drops a column', () => {
    const withoutEccentricity = earthElements.result.replace('EC,', 'XX,');

    expect(() => parseElements(withoutEccentricity, EARTH)).toThrow(/no column "EC"/);
  });
});
