import { describe, expect, it } from 'vitest';

import { numericColumn, parseEphemerisCsv } from './parseCsv.ts';
import earthVectors from './__fixtures__/earth-vectors.json' with { type: 'json' };

const SAMPLE = earthVectors.result;

describe('parseEphemerisCsv', () => {
  it('reads the column header and every data row', () => {
    const table = parseEphemerisCsv(SAMPLE);

    expect(table.columns).toEqual([
      'JDTDB',
      'Calendar Date (TDB)',
      'X',
      'Y',
      'Z',
      'VX',
      'VY',
      'VZ',
    ]);
    expect(table.rows).toHaveLength(4);
  });

  it('keeps rows aligned with the header', () => {
    const table = parseEphemerisCsv(SAMPLE);

    for (const row of table.rows) {
      expect(row).toHaveLength(table.columns.length);
    }
  });

  it('throws with an excerpt when the SOE/EOE block is missing', () => {
    expect(() => parseEphemerisCsv('No ephemeris for target "999999" after A.D. 2026')).toThrow(
      /No ephemeris for target/,
    );
  });

  it('throws when the ephemeris block is empty', () => {
    const empty = '   JDTDB, X,\n****\n$$SOE\n$$EOE\n';
    expect(() => parseEphemerisCsv(empty)).toThrow(/empty/);
  });

  it('throws when a row has a different field count than the header', () => {
    const ragged = '   JDTDB, X, Y,\n****\n$$SOE\n1.0, 2.0,\n$$EOE\n';
    expect(() => parseEphemerisCsv(ragged)).toThrow(/fields but the header declares/);
  });
});

describe('numericColumn', () => {
  it('parses scientific notation into finite numbers', () => {
    const table = parseEphemerisCsv(SAMPLE);
    const x = numericColumn(table, 'X');

    expect(x).toHaveLength(4);
    // First sample from the fixture: -2.653100241556548E+07 km.
    expect(x[0]).toBeCloseTo(-26_531_002.41556548, 6);
    expect(x.every(Number.isFinite)).toBe(true);
  });

  it('names the available columns when one is missing', () => {
    const table = parseEphemerisCsv(SAMPLE);

    expect(() => numericColumn(table, 'NOPE')).toThrow(/Available: JDTDB/);
  });

  it('rejects a non-numeric value instead of yielding NaN', () => {
    const bad = '   JDTDB, X,\n****\n$$SOE\n1.0, not-a-number,\n$$EOE\n';
    const table = parseEphemerisCsv(bad);

    expect(() => numericColumn(table, 'X')).toThrow(/not a finite number/);
  });
});
