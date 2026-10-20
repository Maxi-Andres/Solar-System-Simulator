import { describe, expect, it } from 'vitest';

import { AU_KM, COMETS_FILE } from '../config.ts';
import { CATALOG } from '../catalog.ts';
import { cometDesignations } from '../famousComets.ts';
import { COMET_CLASSES, COMET_RECORD_FLOATS } from '../types.ts';
import { buildComets, cometQuery, COMET_FIELDS, describeComets, parseCometResponse } from './comets.ts';
import sbdbComets from './__fixtures__/sbdb-comets.json' with { type: 'json' };

/**
 * The comets. The fixture is a real SBDB response to the comet query (2026-10-19, full
 * precision), cut to 16 of its 4,080 rows: Halley, Encke, Pons-Brooks, 67P, Hale-Bopp,
 * Hyakutake, 39P/Oterma (Chiron-type), 126P/IRAS (classical Jupiter-family); 73P and two
 * of its fragments; C/-146 P1, a parabola from 146 BC; the two interstellar comets on
 * hyperbolic orbits, 2I/Borisov (C/2019 Q4) and 3I/ATLAS (C/2025 N1); C/1984 A1, with no
 * magnitude; and D/1993 F2-A, a fragment of Shoemaker-Levy 9, which hit Jupiter in 1994.
 */

const DEG = Math.PI / 180;
const REFERENCE_JD = 2461332.5;
const ROWS = parseCometResponse(sbdbComets).rows;
const row = (designation: string) => ROWS.find((r) => r.designation === designation)!;
const BUILD = buildComets({
  rows: ROWS,
  queriedAt: '2026-10-19T16:00:00.000Z',
  referenceJd: REFERENCE_JD,
  excluded: [],
});
const NAMES = BUILD.info.names;
const recordOf = (name: string): number[] => {
  const index = NAMES.indexOf(name);
  if (index < 0) {
    throw new Error(`${name} is not among the comets.`);
  }
  return [...BUILD.records.subarray(index * COMET_RECORD_FLOATS, (index + 1) * COMET_RECORD_FLOATS)];
};

/** Heliocentric position on a two-body conic from q, e and tp, km: any eccentricity. */
function conicPosition(record: readonly number[], daysFromReference: number): number[] {
  const [q, e, i, node, peri, tp] = record as [number, number, number, number, number, number];
  const gm = 132712440041.279419 * 86_400 ** 2; // km^3/day^2, the Sun's, as bodies.json
  const t = daysFromReference - tp;
  let nu: number;
  if (Math.abs(e - 1) < 1e-12) {
    // Barker: tan(nu/2) from the cubic, closed form.
    const w = 3 * Math.sqrt(gm / (2 * q ** 3)) * t;
    const y = Math.cbrt(w + Math.sqrt(w * w + 1));
    nu = 2 * Math.atan(y - 1 / y);
  } else if (e < 1) {
    const a = q / (1 - e);
    const m = Math.sqrt(gm / a ** 3) * t;
    let E = e < 0.8 ? m : Math.PI;
    for (let step = 0; step < 100; step += 1) {
      E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    }
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  } else {
    const a = q / (e - 1);
    const m = Math.sqrt(gm / a ** 3) * t;
    let H = Math.asinh(m / e);
    for (let step = 0; step < 100; step += 1) {
      H -= (e * Math.sinh(H) - H - m) / (e * Math.cosh(H) - 1);
    }
    nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
  }
  const r = (q * (1 + e)) / (1 + e * Math.cos(nu));
  const u = peri + nu;
  return [
    r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(i)),
    r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(i)),
    r * Math.sin(u) * Math.sin(i),
  ];
}

describe('the comet query', () => {
  it('asks for every comet, at full precision, for the fields it reads', () => {
    const query = cometQuery();
    expect(query['sb-kind']).toBe('c');
    expect(query['full-prec']).toBe('true');
    expect(query['sb-cdata']).toBeUndefined();
    expect(query.fields!.split(',')).toEqual([...COMET_FIELDS]);
  });
});

describe('reading the comets', () => {
  it('reads every row, and leaves a missing magnitude null', () => {
    expect(ROWS).toHaveLength(16);
    expect(row('1984 A1').m1).toBeNull();
    expect(row('1984 A1').k1).toBeNull();
    expect(row('1P')).toMatchObject({
      prefix: 'P',
      qAu: 0.5748638313743413,
      e: 0.9679359956953211,
      tpJd: 2446469.973616146677,
      m1: 5.5,
      k1: 8,
      orbitClass: 'HTC',
    });
  });
});

describe('building them', () => {
  it('keeps parabolic and hyperbolic orbits, which the belt cannot hold', () => {
    expect(recordOf('C/-146 P1')[1]).toBe(1);
    expect(recordOf('C/2025 N1 (ATLAS)')[1]).toBeCloseTo(6.141351449317625, 6);
    expect(recordOf('C/2019 Q4 (Borisov)')[8]).toBe(COMET_CLASSES.indexOf('HYP'));
  });

  it('leaves out a D/ comet, which no longer exists, and counts it', () => {
    expect(BUILD.info.dropped).toEqual({ missingElements: 0, defunct: 1 });
    expect(NAMES).not.toContain('D/1993 F2-A (Shoemaker-Levy 9)');
    expect(BUILD.info.count).toBe(15);
  });

  it('keeps every fragment SBDB designates, each with its own orbit', () => {
    expect(NAMES.filter((name) => name.startsWith('73P/'))).toEqual(
      expect.arrayContaining([
        '73P/Schwassmann-Wachmann 3',
        '73P/Schwassmann-Wachmann 3-B',
        '73P/Schwassmann-Wachmann 3-C',
      ]),
    );
    expect(recordOf('73P/Schwassmann-Wachmann 3-B')[0]).not.toBe(
      recordOf('73P/Schwassmann-Wachmann 3-C')[0],
    );
  });

  it('converts q to km and the angles to radians', () => {
    const halley = recordOf('1P/Halley');
    expect(halley[0]).toBe(Math.fround(0.5748638313743413 * AU_KM));
    expect(halley[2]).toBe(Math.fround(162.1905300439129 * DEG));
    expect(halley[3]).toBe(Math.fround(59.09894720612437 * DEG));
    expect(halley[4]).toBe(Math.fround(112.2414314637764 * DEG));
  });

  it('counts tp in days from the reference, subtracted before float32 rounds it', () => {
    // Halley's 1986 perihelion, 40.6 years before the reference.
    const days = 2446469.973616146677 - REFERENCE_JD;
    expect(recordOf('1P/Halley')[5]).toBe(Math.fround(days));
    // Float32 keeps it to half its step there, 2^-11 days: 42 seconds.
    expect(Math.abs(recordOf('1P/Halley')[5]! - days)).toBeLessThanOrEqual(2 ** -11);
    // And the oldest, 146 BC, to half of an hour and a half.
    const old = row('-146 P1').tpJd! - REFERENCE_JD;
    expect(Math.abs(recordOf('C/-146 P1')[5]! - old)).toBeLessThanOrEqual(2 ** -5);
  });

  it('writes NaN where SBDB has no magnitude, and nothing in its place', () => {
    const bradfield = recordOf('C/1984 A1 (Bradfield 1)');
    expect(bradfield[6]).toBeNaN();
    expect(bradfield[7]).toBeNaN();
    expect(recordOf('1P/Halley').slice(6, 8)).toEqual([5.5, 8]);
  });

  it('is ordered by M1, brightest first, the comets with no M1 last', () => {
    const m1 = Array.from({ length: BUILD.info.count }, (_, k) => BUILD.records[k * 9 + 6]!);
    const known = m1.filter((value) => !Number.isNaN(value));
    expect(known).toEqual([...known].sort((p, q) => p - q));
    expect(m1.slice(known.length).every(Number.isNaN)).toBe(true);
    expect(NAMES[0]).toBe('C/1995 O1 (Hale-Bopp)');
  });

  it('describes itself as CometInfo says', () => {
    expect(BUILD.info).toMatchObject({
      file: COMETS_FILE,
      count: 15,
      bytes: 15 * COMET_RECORD_FLOATS * 4,
      recordFloats: COMET_RECORD_FLOATS,
      referenceJd: REFERENCE_JD,
      classes: [...COMET_CLASSES],
      classCounts: { ETc: 1, JFc: 4, JFC: 1, CTc: 1, HTC: 3, PAR: 1, HYP: 2, COM: 2 },
    });
    expect(BUILD.records.length).toBe(15 * COMET_RECORD_FLOATS);
  });

  it('stops on a comet class it does not know', () => {
    expect(() =>
      buildComets({
        rows: [{ ...row('1P'), orbitClass: 'XYZ' }],
        queriedAt: '',
        referenceJd: REFERENCE_JD,
        excluded: [],
      }),
    ).toThrow(/XYZ x1/);
  });

  it('puts every comet at its perihelion distance at its perihelion time', () => {
    // Any conic: an ellipse, the parabola, a hyperbola.
    for (const name of ['1P/Halley', 'C/-146 P1', 'C/2025 N1 (ATLAS)', 'C/1995 O1 (Hale-Bopp)']) {
      const record = recordOf(name);
      const [x, y, z] = conicPosition(record, record[5]!);
      expect(Math.hypot(x!, y!, z!) / record[0]!, name).toBeCloseTo(1, 6);
    }
  });

  it('leaves out the comets drawn as bodies, by their SBDB designations', () => {
    // The catalog's famous comets that are in the fixture: Halley, Encke, Pons-Brooks,
    // 67P, Hale-Bopp and the two interstellar ones. The rest of the catalog's are not in
    // these sixteen rows, so they are asked of a build that has them all below.
    const inFixture = cometDesignations(CATALOG).filter((designation) =>
      ROWS.some((candidate) => candidate.designation === designation),
    );
    expect(inFixture).toEqual(['12P', '1995 O1', '1P', '2019 Q4', '2025 N1', '2P', '67P']);
    const build = buildComets({
      rows: ROWS,
      queriedAt: '',
      referenceJd: REFERENCE_JD,
      excluded: inFixture,
    });
    expect(build.info.count).toBe(15 - inFixture.length);
    expect(build.info.excluded).toEqual(inFixture);
    for (const name of ['1P/Halley', 'C/2019 Q4 (Borisov)', 'C/2025 N1 (ATLAS)', 'C/1995 O1 (Hale-Bopp)']) {
      expect(build.info.names, name).not.toContain(name);
    }
    // Fragments are not the comet: 73P is not excluded, and neither are its pieces.
    expect(build.info.names).toContain('73P/Schwassmann-Wachmann 3-B');
    expect(describeComets(build)[1]).toMatch(/7 drawn as bodies \(12P, 1995 O1, 1P, /);
  });

  it('stops on an excluded comet SBDB does not have, rather than draw it twice', () => {
    expect(() =>
      buildComets({ rows: ROWS, queriedAt: '', referenceJd: REFERENCE_JD, excluded: ['1P', '9P'] }),
    ).toThrow(/9P/);
  });
});
