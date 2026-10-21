import { json2satrec } from 'satellite.js/io';
import { sgp4 } from 'satellite.js/sgp4';
import { describe, expect, it } from 'vitest';

import {
  applyMatrix,
  nutation1980,
  OBLIQUITY_J2000_IAU1976_RAD,
  satelliteInstant,
  temeToEclipticMatrix,
  temeToJ2000Matrix,
} from './teme.ts';
import { ISS_HORIZONS, ISS_OMM } from './satelliteTestFixtures.ts';
import { dateToTdb, tdbToUtc, utcToTdb } from './time.ts';

/**
 * TEME to the scene's frame, held against two independent references: Meeus's worked
 * nutation example, and -- the acceptance test of the whole satellite layer -- JPL
 * Horizons' own International Space Station.
 */

const ARCSEC = Math.PI / (180 * 3600);

/** The ISS through SGP4 and teme.ts at a TDB instant, km, scene frame. */
function issAt(jdTdb: number, matrix: (jd: number) => Float64Array): [number, number, number] {
  const satrec = json2satrec(ISS_OMM as unknown as Parameters<typeof json2satrec>[0]);
  const teme = sgp4(satrec, (tdbToUtc(jdTdb) - satrec.jdsatepoch) * 1440)!;
  const out = new Float64Array(3);
  applyMatrix(matrix(jdTdb), teme.position.x, teme.position.y, teme.position.z, out);
  return [out[0]!, out[1]!, out[2]!];
}

describe('IAU 1980 nutation', () => {
  it("matches Meeus's worked example to a hundredth of an arcsecond", () => {
    // Astronomical Algorithms, example 22.a: 1987 April 10, 0h TD. Meeus sums the 63 terms
    // of his table: dpsi = -3.788", deps = +9.443", mean obliquity 23 26' 27.407".
    const n = nutation1980(2446895.5);
    expect(n.deltaPsi / ARCSEC).toBeCloseTo(-3.788, 2);
    expect(n.deltaEpsilon / ARCSEC).toBeCloseTo(9.443, 2);
    expect(n.meanObliquity / ARCSEC).toBeCloseTo(23 * 3600 + 26 * 60 + 27.407, 2);
  });
});

describe('TEME to J2000', () => {
  it('is a rotation', () => {
    const m = temeToJ2000Matrix(2461334.5);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const dot = m[i * 3]! * m[j * 3]! + m[i * 3 + 1]! * m[j * 3 + 1]! + m[i * 3 + 2]! * m[j * 3 + 2]!;
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 14);
      }
    }
  });

  it('is the identity at J2000 but for nutation', () => {
    // No precession at the epoch itself; what is left is nutation, under 20 arcseconds.
    const m = temeToJ2000Matrix(2451545);
    const offDiagonal = Math.max(Math.abs(m[1]!), Math.abs(m[2]!), Math.abs(m[5]!));
    expect(offDiagonal).toBeLessThan(20 * ARCSEC);
    expect(offDiagonal).toBeGreaterThan(1 * ARCSEC);
  });

  it('tilts the pole by the IAU 1976 precession: 0.15 degrees by 2026', () => {
    // TEME's z, the true pole of date, seen in J2000: its angle from J2000's pole.
    const m = temeToJ2000Matrix(utcToTdb(2461334.5));
    const tilt = Math.acos(m[8]!) / (Math.PI / 180);
    // 2004.3109" a century over 26.8 years is 0.149 degrees in declination; the pole moves
    // by theta, not by zeta + z.
    expect(tilt).toBeGreaterThan(0.145);
    expect(tilt).toBeLessThan(0.155);
  });

  it('uses the obliquity Horizons does for its ecliptic', () => {
    expect(OBLIQUITY_J2000_IAU1976_RAD / ARCSEC).toBe(84381.448);
  });
});

describe('the ISS against JPL Horizons -- the acceptance test', () => {
  it('lands within 10 metres of Horizons from the same element set, over two weeks', () => {
    for (const [jd, x, y, z] of ISS_HORIZONS) {
      const [ax, ay, az] = issAt(jd, (t) => temeToEclipticMatrix(t));
      const metres = Math.hypot(ax - x, ay - y, az - z) * 1000;
      // Measured: 0.7 m at the epoch, 3 to 9 m across the fortnight.
      expect(metres).toBeLessThan(10);
    }
  });

  it('would be 37 to 45 km off without precession and nutation: the test can tell', () => {
    const obliquityOnly = (): Float64Array => {
      const c = Math.cos(OBLIQUITY_J2000_IAU1976_RAD);
      const s = Math.sin(OBLIQUITY_J2000_IAU1976_RAD);
      return Float64Array.of(1, 0, 0, 0, c, s, 0, -s, c);
    };
    for (const [jd, x, y, z] of ISS_HORIZONS.slice(0, 5)) {
      const [ax, ay, az] = issAt(jd, obliquityOnly);
      const km = Math.hypot(ax - x, ay - y, az - z);
      expect(km).toBeGreaterThan(35);
      expect(km).toBeLessThan(46);
    }
  });

  it('would be 500 km off on TDB instead of UTC: the clock is converted', () => {
    // 69.2 s of an orbit at 7.66 km/s. The trap every SGP4 user here could fall into.
    const satrec = json2satrec(ISS_OMM as unknown as Parameters<typeof json2satrec>[0]);
    const [jd, x, y, z] = ISS_HORIZONS[1]!;
    const teme = sgp4(satrec, (jd - satrec.jdsatepoch) * 1440)!;
    const out = new Float64Array(3);
    applyMatrix(temeToEclipticMatrix(jd), teme.position.x, teme.position.y, teme.position.z, out);
    expect(Math.hypot(out[0]! - x, out[1]! - y, out[2]! - z)).toBeGreaterThan(450);
  });
});

describe('satelliteInstant', () => {
  it('works the instant out once and hands back UTC and the matrix', () => {
    const jd = dateToTdb(new Date('2026-10-21T12:00:00Z'));
    const first = satelliteInstant(jd);
    expect((jd - first.jdUtc) * 86_400).toBeCloseTo(69.184, 2);
    const matrix = Float64Array.from(first.matrix);
    expect(satelliteInstant(jd).matrix).toEqual(matrix);
    expect(Array.from(temeToEclipticMatrix(jd))).toEqual(Array.from(matrix));
  });
});
