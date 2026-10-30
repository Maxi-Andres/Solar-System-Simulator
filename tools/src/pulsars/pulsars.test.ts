import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  absoluteError,
  atnfAstrometry,
  atnfDistance,
  atnfSpin,
  atnfTypes,
  eclipticToEquatorial,
  fileFromTar,
  lastDigitUnit,
  parseAtnfDatabase,
  parseAtnfReferences,
  unpackAtnf,
  type AtnfRecord,
} from './atnf.ts';
import { buildPulsars, MCGILL_REFERENCE, separationArcsec } from './buildPulsars.ts';
import { parseMcgillCsv } from './mcgill.ts';

/**
 * Against the catalogues as served on 2026-10-30. __fixtures__/psrcat.db is a verbatim
 * excerpt of ATNF 2.9.0's database -- its header and ten pulsars: the Crab (an independent
 * distance), J0437-4715, J0030+0451 (ecliptic coordinates only; a parallax), J0007+7303 (a
 * distance bounded by its remnant, CTA 1), J0021-0909 and J0048-7317 (YMW16's 25 and 100 kpc
 * ceilings), 47 Tuc C, SGR 1806-20 and SGR J1745-2900 (magnetars), and Lich -- with the
 * entries of psrcat_ref their distances cite. __fixtures__/mcgill-TabO1.csv is McGill's
 * Table 1 whole.
 */

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');
const database = parseAtnfDatabase(fixture('psrcat.db'));
const references = parseAtnfReferences(fixture('psrcat_ref'));
const magnetars = parseMcgillCsv(fixture('mcgill-TabO1.csv'));
const record = (jName: string): AtnfRecord => database.records.find((r) => r.get('PSRJ')?.text === jName)!;

describe('reading psrcat.db', () => {
  it('reads the version and every block', () => {
    expect(database.version).toBe('2.9.0');
    expect(database.records).toHaveLength(10);
  });

  it('makes an uncertainty absolute in units of the last digit, as psrcat does', () => {
    expect(lastDigitUnit('0.6')).toBeCloseTo(0.1, 12);
    expect(lastDigitUnit('2.097E-15')).toBeCloseTo(1e-18, 30);
    expect(lastDigitUnit('55806')).toBe(1);
    expect(absoluteError('0.6', '5')).toBeCloseTo(0.5, 12);
    expect(absoluteError('1.418', '0.044')).toBeCloseTo(0.044, 12);
    const crab = record('J0534+2200');
    expect(crab.get('PSRB')?.text).toBe('B0531+21');
  });

  it('shortens a reference to author, year, journal, volume and page', () => {
    expect(references.get('tri68')).toBe('Trimble 1968, AJ 73, 535');
    expect(references.get('bv21')).toBe('Baumgardt et al. 2021, MNRAS 505, 5957');
    expect(references.get('lvk+23')).toBe('Lin et al. 2023, ApJ 952, 161');
  });

  it('finds one file in a tar, past another', () => {
    const block = (bytes: Uint8Array): Uint8Array => {
      const out = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
      out.set(bytes);
      return out;
    };
    const header = (name: string, size: number): Uint8Array => {
      const h = new Uint8Array(512);
      h.set(new TextEncoder().encode(name));
      h.set(new TextEncoder().encode(`${size.toString(8).padStart(11, '0')}\0`), 124);
      return h;
    };
    const a = new TextEncoder().encode('x'.repeat(700));
    const b = new TextEncoder().encode('#CATALOGUE 9.9\n');
    const tar = new Uint8Array([
      ...header('psrcat_tar/README', a.length),
      ...block(a),
      ...header('psrcat_tar/psrcat.db', b.length),
      ...block(b),
      ...new Uint8Array(1024),
    ]);
    expect(fileFromTar(tar, 'psrcat.db')).toBe('#CATALOGUE 9.9\n');
    expect(() => fileFromTar(tar, 'psrcat_ref')).toThrow(/no psrcat_ref/);
    expect(() => unpackAtnf(gzipSync(tar))).toThrow(/no psrcat_ref/);
  });
});

describe('where each pulsar is', () => {
  it('reads an equatorial position and its motion', () => {
    const sky = atnfAstrometry(record('J0437-4715'))!;
    // 04h37m15.9s -47d15'09": the name says so to the minute.
    expect(sky.raDeg).toBeCloseTo((4 + 37 / 60 + 15.9 / 3600) * 15, 2);
    expect(sky.decDeg).toBeCloseTo(-(47 + 15 / 60 + 9 / 3600), 2);
    expect(sky.pmRaMasYr).toBeCloseTo(121.4, 0);
    expect(sky.pmDecMasYr).toBeCloseTo(-71.5, 0);
  });

  it('turns timing ecliptic coordinates to the equator on the IERS 2003 obliquity', () => {
    const sky = atnfAstrometry(record('J0030+0451'))!;
    // The RAJ and DECJ the ATNF's web form derives for it (2026-10-30): 00:30:27.42750 +- 4
    // and +04:51:39.7116 +- 14 in the last digit.
    expect(separationArcsec(sky.raDeg, sky.decDeg, (27.4275 / 3600 + 30 / 60) * 15, 4 + 51 / 60 + 39.7116 / 3600)).toBeLessThan(0.002);
    // A motion along the ecliptic keeps its size on the equator.
    const moved = eclipticToEquatorial(8.910353563, 1.4456974, -5.523, 3.1);
    expect(Math.hypot(moved.pmRaMasYr, moved.pmDecMasYr)).toBeCloseTo(Math.hypot(-5.523, 3.1), 10);
  });

  it('takes the distance by psrcat’s rule, and says which branch', () => {
    expect(atnfDistance(record('J0534+2200'))).toEqual({ kpc: 2, method: 'independent', ref: 'tri68' });
    const j0030 = atnfDistance(record('J0030+0451'))!;
    expect(j0030.method).toBe('parallax');
    expect(j0030.kpc * 1000).toBeCloseTo(328.9, 0);
    expect(atnfDistance(record('J0024-7204C'))).toEqual({ kpc: 4.52, method: 'independent', ref: 'bv21' });
    // CTA 1's remnant puts J0007+7303 between 1.1 and 1.7 kpc; its YMW16 distance is the
    // model's ceiling, so the midpoint stands.
    expect(atnfDistance(record('J0007+7303'))).toEqual({ kpc: 1.4, method: 'bounded', ref: 'plmg93' });
  });

  it('gives no distance where YMW16 gives only its ceiling', () => {
    expect(record('J0021-0909').get('DIST_DM')?.text).toBe('25.000');
    expect(atnfDistance(record('J0021-0909'))).toBeNull();
    expect(record('J0048-7317').get('DIST_DM')?.text).toBe('100.000');
    expect(atnfDistance(record('J0048-7317'))).toBeNull();
  });

  it('reads the spin and the type', () => {
    const crab = atnfSpin(record('J0534+2200'));
    expect(crab.periodS).toBeCloseTo(0.0333924, 6);
    expect(crab.periodDerivative).toBeCloseTo(4.21e-13, 15);
    expect(atnfTypes(record('J1808-2024'))).toEqual(['AXP', 'NRAD']);
  });
});

describe('the magnetars', () => {
  it('reads McGill’s table with its marks', () => {
    expect(magnetars).toHaveLength(31);
    expect(magnetars.filter((m) => m.candidate)).toHaveLength(6);
    const sgr = magnetars.find((m) => m.name === 'SGR 1806-20')!;
    expect(sgr.distanceKpc).toBe(8.7);
    expect(magnetars.find((m) => m.name === '3XMM J185246.6+003317')!.distanceApproximate).toBe(true);
    expect(magnetars.find((m) => m.name === '3XMM J185246.6+003317')!.periodDerivative).toBeNull();
    expect(magnetars.find((m) => m.name === 'PSR J1846-0258')!.candidate).toBe(false);
  });
});

describe('pulsars.json', () => {
  const catalog = buildPulsars({ atnf: database, atnfReferences: references, magnetars, queriedAt: '2026-10-30T00:00:00Z' });
  const { pulsars } = catalog;
  const at = (name: string): number => pulsars.name.indexOf(name);

  it('places what it can and counts what it cannot', () => {
    // Eight of the ten (two at YMW16's ceiling), and the McGill magnetars the excerpt
    // does not hold that have a distance.
    const mcgillPlaced = magnetars.filter((m) => m.distanceKpc !== null).length - 2;
    expect(catalog.counts.placed).toBe(8 + mcgillPlaced);
    expect(catalog.counts.placed + catalog.counts.unplaced).toBe(catalog.counts.listed);
  });

  it('calls a pulsar by its common name, a magnetar by McGill’s, the rest by PSR J', () => {
    expect(at('Crab Pulsar')).toBeGreaterThanOrEqual(0);
    expect(at('Lich')).toBeGreaterThanOrEqual(0);
    expect(at('PSR J0437-4715')).toBeGreaterThanOrEqual(0);
    const sgr = at('SGR 1806-20');
    expect(pulsars.jName[sgr]).toBe('J1808-2024');
    expect(pulsars.magnetar[sgr]).toBe(true);
    expect(pulsars.distanceMethod[sgr]).toBe('magnetar');
    expect(pulsars.distancePc[sgr]).toBe(8700);
    expect(catalog.references[pulsars.distanceRef[sgr]!]).toBe(MCGILL_REFERENCE);
  });

  it('puts the Crab 2 kpc away, toward Taurus, citing Trimble', () => {
    const k = at('Crab Pulsar');
    expect(Math.hypot(pulsars.x[k]!, pulsars.y[k]!, pulsars.z[k]!)).toBeCloseTo(2000, 0);
    expect(catalog.references[pulsars.distanceRef[k]!]).toBe('Trimble 1968, AJ 73, 535');
    expect(pulsars.remnant[k]).toBe('Crab');
    // Its 120 km/s across the sky at 2 kpc: the proper motion, at the distance.
    expect(Math.hypot(pulsars.vx[k]!, pulsars.vy[k]!, pulsars.vz[k]!)).toBeGreaterThan(100);
  });

  it('keeps a pulsar in a cluster with its cluster', () => {
    const k = at('PSR J0024-7204C');
    expect(pulsars.globularCluster[k]).toBe('47Tuc(NGC104)');
    expect(pulsars.distancePc[k]).toBe(4520);
  });
});
