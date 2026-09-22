import { describe, expect, it } from 'vitest';

import { HIPPARCOS_TABLE } from '../config.ts';
import { hipparcosQuery, parseHipparcosCsv, splitCsvLine } from './vizier.ts';

/**
 * The reader for VizieR's CSV.
 *
 * Small tests for a small parser, but the two things they pin are the two things that
 * would be silent if wrong: a column read by position instead of by name, and a null
 * turned into a zero. The first puts every star's colour on its neighbour. The second
 * puts a star at right ascension zero, which is a real place on the sky.
 */

/** A verbatim excerpt of the real response, including a row with missing fields. */
const SAMPLE = `HIP,RAICRS,DEICRS,RAhms,DEdms,Vmag,B-V,pmRA,pmDE
32349,101.28854105,-16.71314306,"06 45 09.25","-16 42 47.3",-1.44,0.009,-546.01,-1223.08
55203,,,"11 18 11.24","+31 31 50.8",3.79,0.606,,
26220,83.81592896,-5.38731536,"05 35 15.82","-05 23 14.3",4.98,,-0.92,0.13
3,0.00500795,38.85928608,"00 00 01.20","+38 51 33.4",6.61,-0.019,5.24,-2.91
`;

describe('the ADQL query', () => {
  it('quotes the column whose name is not an identifier', () => {
    const query = hipparcosQuery(7.5);
    // B-V would parse as a subtraction of two columns without the quotes, which is
    // the kind of error that comes back as an empty result rather than a message.
    expect(query).toContain('"B-V"');
    expect(query).toContain('Vmag');
    expect(query).not.toContain('"Vmag"');
  });

  it('asks the catalogue by its published designation', () => {
    expect(hipparcosQuery(7.5)).toContain(`FROM "${HIPPARCOS_TABLE}"`);
    expect(HIPPARCOS_TABLE).toBe('I/239/hip_main');
  });

  it('filters on magnitude at the source rather than after downloading the sky', () => {
    expect(hipparcosQuery(7.5)).toContain('WHERE Vmag <= 7.5');
  });
});

describe('the CSV splitter', () => {
  it('keeps a quoted field whole', () => {
    expect(splitCsvLine('1,"06 45 08.92","-16 42 58.0",2')).toEqual([
      '1',
      '06 45 08.92',
      '-16 42 58.0',
      '2',
    ]);
  });

  it('leaves an empty field empty rather than dropping it', () => {
    expect(splitCsvLine('1,,,4')).toEqual(['1', '', '', '4']);
  });

  it('unescapes a doubled quote', () => {
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', 'c']);
  });
});

describe('reading the rows', () => {
  const rows = parseHipparcosCsv(SAMPLE);

  it('reads every row', () => {
    expect(rows).toHaveLength(4);
  });

  it('gets Sirius right', () => {
    const sirius = rows[0]!;
    expect(sirius.hip).toBe(32349);
    // The catalogue's own epoch, J1991.25, not J2000. Moving it is the next file's job.
    expect(sirius.raIcrsDeg).toBeCloseTo(101.28854105, 8);
    expect(sirius.decIcrsDeg).toBeCloseTo(-16.71314306, 8);
    expect(sirius.vMag).toBe(-1.44);
    expect(sirius.colorIndex).toBe(0.009);
    expect(sirius.pmRaMasPerYear).toBe(-546.01);
  });

  it('leaves a missing value null instead of zero', () => {
    // HIP 55203 is xi Ursae Majoris: no ICRS solution because it is a known multiple,
    // and naked-eye at magnitude 3.79. Reading only the ICRS column loses it.
    const flagged = rows[1]!;
    expect(flagged.raIcrsDeg).toBeNull();
    expect(flagged.pmRaMasPerYear).toBeNull();
    // The sexagesimal position survives, which is the whole reason it is queried.
    expect(flagged.raHms).toBe('11 18 11.24');
    expect(flagged.decDms).toBe('+31 31 50.8');
  });

  it('refuses a response missing a column instead of reading the wrong one', () => {
    const withoutColor = SAMPLE.replace(',B-V', '');
    expect(() => parseHipparcosCsv(withoutColor)).toThrow(/no column "B-V"/);
  });

  it('refuses a value that is not a number', () => {
    expect(() => parseHipparcosCsv(SAMPLE.replace('-1.44', 'bright'))).toThrow(/Vmag/);
  });
});
