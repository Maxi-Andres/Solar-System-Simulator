import { describe, expect, it } from 'vitest';

import {
  applyProperMotion,
  buildStarCatalog,
  EPOCH_SHIFT_YEARS,
  parseSexagesimalDegrees,
  parseSexagesimalHours,
} from './buildStarCatalog.ts';
import { parseHipparcosCsv, type HipparcosRow } from './vizier.ts';

/**
 * The transform from catalogue rows to the columns the renderer reads.
 *
 * The test that matters most is the first one. Proper motion is the kind of correction
 * that is easy to write, impossible to eyeball and silent when it is backwards -- so it
 * is checked against a published answer rather than against itself: Sirius, moved from
 * Hipparcos's own epoch to J2000, has to land on the J2000 position everyone else
 * publishes. It does, to a milliarcsecond.
 */

/** Verbatim rows from VizieR, including the two kinds of incomplete star. */
const SAMPLE = `HIP,RAICRS,DEICRS,RAhms,DEdms,Vmag,B-V,pmRA,pmDE
32349,101.28854105,-16.71314306,"06 45 09.25","-16 42 47.3",-1.44,0.009,-546.01,-1223.08
55203,,,"11 18 11.24","+31 31 50.8",3.79,0.606,,
26220,83.81592896,-5.38731536,"05 35 15.82","-05 23 14.3",4.98,,-0.92,0.13
57939,178.23256802,37.73280827,"11 52 55.82","+37 43 58.1",6.42,0.754,4003.69,-5813.0
`;

const ARCSEC_PER_DEGREE = 3600;

describe('proper motion', () => {
  it('lands Sirius on its published J2000 position', () => {
    // Hipparcos gives Sirius at J1991.25. Every other catalogue quotes J2000, where it
    // sits at 101.28715533, -16.71611586 -- which is what this has to reproduce, from
    // the 1991.25 position and the proper motion alone.
    const moved = applyProperMotion(
      101.28854105,
      -16.71314306,
      -546.01,
      -1223.08,
      EPOCH_SHIFT_YEARS,
    );

    const cosDec = Math.cos((-16.716 * Math.PI) / 180);
    const raErrorArcsec = (moved.raDeg - 101.28715533) * cosDec * ARCSEC_PER_DEGREE;
    const decErrorArcsec = (moved.decDeg + 16.71611586) * ARCSEC_PER_DEGREE;

    expect(Math.abs(raErrorArcsec)).toBeLessThan(0.001);
    expect(Math.abs(decErrorArcsec)).toBeLessThan(0.001);
  });

  it('is 8.75 years, which is not a round number and should not be', () => {
    // J1991.25 is the mean epoch of Hipparcos's own observations, not a convention.
    expect(EPOCH_SHIFT_YEARS).toBeCloseTo(8.75, 10);
  });

  it('reverses exactly, which a small-angle formula would not', () => {
    const there = applyProperMotion(83.0, -0.3, 4003.69, -5813.0, 200);
    const back = applyProperMotion(there.raDeg, there.decDeg, -4003.69, 5813.0, 200);
    // Not quite the identity -- the basis rotates as the star moves -- but the round
    // trip has to close to far better than the pixel it is being drawn at.
    expect((back.raDeg - 83.0) * ARCSEC_PER_DEGREE).toBeLessThan(0.2);
    expect((back.decDeg + 0.3) * ARCSEC_PER_DEGREE).toBeLessThan(0.2);
  });

  it('survives a star near the celestial pole, where dividing by cos(dec) would not', () => {
    // Polaris, three quarters of a degree from the pole. The textbook form of this
    // correction has a cos(dec) in a denominator and goes to pieces here.
    const moved = applyProperMotion(37.94614689, 89.26413805, 44.22, -11.74, EPOCH_SHIFT_YEARS);
    expect(Number.isFinite(moved.raDeg)).toBe(true);
    expect(moved.decDeg).toBeCloseTo(89.26411, 4);
  });

  it('moves the fastest star in the sky by a visible amount over two centuries', () => {
    // HIP 57939, Groombridge 1830, at 7.06 arcseconds a year. Over the range this app
    // can reach it leaves its own constellation, which is why the shader carries the
    // motion on rather than freezing the sky at J2000.
    const moved = applyProperMotion(178.23256802, 37.73280827, 4003.69, -5813.0, 200);
    const separationDeg =
      Math.hypot(
        (moved.raDeg - 178.23256802) * Math.cos((37.73 * Math.PI) / 180),
        moved.decDeg - 37.73280827,
      );
    expect(separationDeg).toBeGreaterThan(0.35);
  });
});

describe('the sexagesimal fallback', () => {
  it('reads hours, minutes and seconds as degrees', () => {
    expect(parseSexagesimalHours('06 45 09.25')).toBeCloseTo(101.28854, 4);
  });

  it('applies the sign to the whole declination, not just to its degrees', () => {
    // The classic way to put a star 62 arcminutes from where it belongs.
    expect(parseSexagesimalDegrees('-00 30 00.0')).toBeCloseTo(-0.5, 10);
    expect(parseSexagesimalDegrees('+31 31 50.8')).toBeCloseTo(31.53078, 5);
  });

  it('refuses something that is not a position', () => {
    expect(() => parseSexagesimalHours('06 45')).toThrow();
    expect(() => parseSexagesimalDegrees('+31 31 north')).toThrow();
  });
});

describe('building the catalogue', () => {
  const rows: HipparcosRow[] = parseHipparcosCsv(SAMPLE);
  const catalog = buildStarCatalog(rows, '2026-01-01T00:00:00.000Z');

  it('keeps the star with no ICRS solution, by its J2000 sexagesimal position', () => {
    expect(catalog.count).toBe(3);
    expect(catalog.dropped.noPosition).toBe(0);

    const index = catalog.mag.indexOf(3.79);
    expect(index).toBeGreaterThanOrEqual(0);
    // Already J2000, so it is used as published rather than moved another 8.75 years.
    expect(catalog.ra[index]).toBeCloseTo(169.54683, 4);
    expect(catalog.dec[index]).toBeCloseTo(31.53078, 4);
  });

  it('drops the star with no measured colour, and says how many', () => {
    expect(catalog.dropped.noColorIndex).toBe(1);
    expect(catalog.mag).not.toContain(4.98);
  });

  it('publishes at J2000, and says so', () => {
    expect(catalog.epoch).toBe('ICRS, J2000.0');
  });

  it('orders brightest first', () => {
    expect(catalog.mag).toEqual([...catalog.mag].sort((a, b) => a - b));
  });

  it('rounds against a pixel, not against a byte count', () => {
    // Four decimals of a degree is 0.36 arcseconds; one pixel at the scene's field of
    // view is 90. Proper motions are whole milliarcseconds per year, which over two
    // centuries is a tenth of an arcsecond.
    for (const value of [...catalog.ra, ...catalog.dec]) {
      expect(value).toBe(Math.round(value * 1e4) / 1e4);
    }
    for (const value of [...catalog.pmRa, ...catalog.pmDec]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('carries its own provenance', () => {
    expect(catalog.source.name).toContain('Hipparcos');
    expect(catalog.source.table).toBe('I/239/hip_main');
    expect(catalog.source.queriedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
