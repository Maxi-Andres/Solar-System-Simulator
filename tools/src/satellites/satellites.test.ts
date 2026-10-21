import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';

import {
  SATELLITE_GROUPS,
  SATELLITE_OBJECT_TYPES,
  SATELLITE_RECORD_FLOATS,
  SATELLITE_REGIME_SHIFT,
  SATELLITE_REGIMES,
  SATELLITE_TYPE_SHIFT,
  type SatelliteGroup,
  type SatelliteInfo,
  type SatelliteOmm,
} from '../types.ts';
import { writeSatellites } from '../writeOutput.ts';
import { buildSatellites, referenceFor } from './buildSatellites.ts';
import { parseGpCsv, parseSatcatCsv, type CelestrakRead, type SatcatRow } from './celestrak.ts';
import {
  angleBetween,
  ARCSEC,
  centuriesTt,
  frameDrift,
  type Matrix3,
  nutation,
  temeToEclipticJ2000,
  temeToJ2000,
  todToJ2000,
} from './frames.ts';
import { bulkElements, measureBulkError, recordValues, satrecOf } from './meanElements.ts';

/**
 * The satellites, end to end, on real data. The fixtures are CelesTrak's responses of
 * 2026-10-21, cut to the rows that exercise each rule:
 *
 *   active   ISS, Tiangong, Hubble, STARLINK-3005 (an ordinary Starlink), STARLINK-1297 and
 *            STARLINK-1972 (one manoeuvring, one re-entering), GOES-19 (GEO), NAVSTAR 43
 *            (GPS, MEO), BeiDou-2 IGSO-1 (inclined GEO), MMS 1 and Chandra (very
 *            eccentric), TESS (drawn from Horizons), COSMOS 2460 (GLONASS, 29-day-old
 *            elements), O3B MPOWER F11 (catalogue number 100686, on a transfer orbit,
 *            14-day-old elements)
 *   stations ISS, Tiangong
 *   visual   ISS, an SL-8 rocket body
 *   fengyun-1c-debris  one fragment observed that day, one last seen 2026-09-21
 *
 * and the SATCAT rows for the active and visual ones.
 */

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const fixture = (file: string) => readFile(join(FIXTURES, file), 'utf8');

/** The instant the fixtures were downloaded, to the minute. */
const REFERENCE = referenceFor('2026-10-21T13:43:53.767Z');

async function fixtureRead(): Promise<CelestrakRead> {
  const gp = new Map<SatelliteGroup, SatelliteOmm[]>();
  for (const group of ['active', 'stations', 'visual', 'fengyun-1c-debris'] as const) {
    gp.set(group, parseGpCsv(await fixture(`gp-${group}.csv`), group));
  }
  const satcat = new Map<number, SatcatRow>();
  for (const group of ['active', 'visual']) {
    for (const row of parseSatcatCsv(await fixture(`satcat-${group}.csv`), group)) {
      satcat.set(row.noradId, row);
    }
  }
  return { gp, satcat, missing: [], failure: null, queriedAt: '2026-10-21T13:43:53.767Z', requests: 0, bytes: 0 };
}

const BUILD = buildSatellites({ read: await fixtureRead(), referenceJdUtc: REFERENCE });

const decode = (flags: number) => ({
  groups: SATELLITE_GROUPS.filter((_, bit) => (flags & (1 << bit)) !== 0),
  regime: SATELLITE_REGIMES[Math.floor(flags / 2 ** SATELLITE_REGIME_SHIFT) % 4],
  type: SATELLITE_OBJECT_TYPES[Math.floor(flags / 2 ** SATELLITE_TYPE_SHIFT) % 4],
});

const activeRows = parseGpCsv(await fixture('gp-active.csv'), 'active');
const omm = (noradId: number) => activeRows.find((row) => row.NORAD_CAT_ID === noradId)!;

describe('TEME to the ecliptic of J2000', () => {
  it('has IAU 1980 nutation right: Meeus, Astronomical Algorithms, example 22.a', () => {
    // 1987 April 10, 0h TD: Δψ = −3.788", Δε = +9.443" from the full 106-term series.
    const { dPsi, dEps } = nutation((2446895.5 - 2451545) / 36525);
    expect(dPsi / ARCSEC).toBeCloseTo(-3.788, 2);
    expect(dEps / ARCSEC).toBeCloseTo(9.443, 2);
  });

  it('agrees with an independent IAU 2006/2000B reduction to the models’ own difference', () => {
    // astronomy-engine's precession and nutation are the newer IAU models; the 1976/1980
    // pair SGP4's TEME is defined by differs from them by up to a few tenths of an
    // arcsecond -- 4 m at LEO. A wrong sign or order would be degrees.
    for (const iso of ['2016-03-01T00:00:00Z', '2026-10-21T13:43:00Z', '2036-10-21T00:00:00Z']) {
      const date = new Date(iso);
      const rot = Astronomy.Rotation_EQD_EQJ(date).rot;
      // astronomy-engine stores the transpose of a row-major matrix.
      const theirs: Matrix3 = [
        rot[0]![0]!, rot[1]![0]!, rot[2]![0]!,
        rot[0]![1]!, rot[1]![1]!, rot[2]![1]!,
        rot[0]![2]!, rot[1]![2]!, rot[2]![2]!,
      ];
      const jd = date.getTime() / 86_400_000 + 2440587.5;
      expect(angleBetween(todToJ2000(jd), theirs) / ARCSEC).toBeLessThan(0.3);
    }
  });

  it('is 0.37° of precession by 2026, and one matrix holds to a few arcseconds a month', () => {
    const identity: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    expect(angleBetween(identity, temeToJ2000(REFERENCE)) / ARCSEC).toBeCloseTo(1349, -1);
    expect(centuriesTt(REFERENCE)).toBeCloseTo(0.268, 3);
    expect(frameDrift(REFERENCE, 1)).toBeLessThan(0.2);
    expect(frameDrift(REFERENCE, 30)).toBeLessThan(5);
  });

  it('is published as the run measured it', () => {
    expect(BUILD.info.frame.temeToEclipticJ2000).toEqual([...temeToEclipticJ2000(REFERENCE)]);
    expect(BUILD.info.frame.maxErrorArcsec).toBeLessThan(5);
  });
});

describe('a bulk record', () => {
  const record = (noradId: number) => {
    const satrec = satrecOf(omm(noradId))!;
    return { satrec, values: recordValues(bulkElements(satrec, REFERENCE)!, 0) };
  };

  it('follows SGP4 to a few kilometres in low orbit, through the window', () => {
    for (const noradId of [25544, 48881]) {
      const { satrec, values } = record(noradId);
      const misses = measureBulkError(satrec, values, REFERENCE, [0, 1 / 24, 1, 3], true)!;
      expect(Math.max(...misses)).toBeLessThan(15);
    }
  });

  it('owes most of that to the J3 term', () => {
    const { satrec, values } = record(48881);
    const without = [...values];
    without[10] = 0;
    const withJ3 = Math.max(...measureBulkError(satrec, values, REFERENCE, [0, 1, 3])!);
    const withoutJ3 = Math.max(...measureBulkError(satrec, without, REFERENCE, [0, 1, 3])!);
    expect(withJ3).toBeLessThan(withoutJ3 / 2);
  });

  it('loses under half a kilometre to float32 in the window', () => {
    const { satrec, values } = record(25544);
    const f64 = measureBulkError(satrec, values, REFERENCE, [3])![0]!;
    const f32 = measureBulkError(satrec, Float32Array.from(values), REFERENCE, [3], true)![0]!;
    expect(Math.abs(f32 - f64)).toBeLessThan(0.5);
  });

  it('follows SGP4 at MEO and GEO to its deep-space periodic terms', () => {
    for (const noradId of [24876, 60133]) {
      const { satrec, values } = record(noradId);
      expect(Math.max(...measureBulkError(satrec, values, REFERENCE, [0, 1, 3], true)!)).toBeLessThan(50);
    }
  });
});

describe('the layer', () => {
  const named = (id: string) => BUILD.named.find((satellite) => satellite.id === id)!;
  const bulkIndex = (noradId: number) => BUILD.names.noradId.indexOf(noradId);
  const inSgp4 = (noradId: number) => BUILD.sgp4.some((satellite) => satellite.omm.NORAD_CAT_ID === noradId);

  it('names the named, with the SATCAT launch date and every group they are in', () => {
    const iss = named('iss');
    expect(iss.name).toBe('International Space Station');
    expect(iss.launchDate).toBe('1998-11-20');
    expect(iss.cosparId).toBe('1998-067A');
    expect(iss.omm.OBJECT_NAME).toBe('ISS (ZARYA)');
    expect(decode(iss.flags)).toEqual({ groups: ['active', 'stations', 'visual'], regime: 'leo', type: 'PAY' });
    expect(decode(named('goes-19').flags).regime).toBe('geo');
    expect(decode(named('chandra').flags).regime).toBe('heo');
    expect(named('chandra').note).not.toBeNull();
    for (const id of ['hubble', 'tiangong', 'mms-1']) {
      expect(named(id)).toBeDefined();
    }
  });

  it('carries each named satellite’s look, a model or a box, into named.json', () => {
    // Every one of the list has a published span and a shape: see looks.ts.
    for (const satellite of BUILD.named) {
      expect(satellite.spanM, satellite.id).toBeGreaterThan(0);
      expect(satellite.shape, satellite.id).toBeDefined();
    }
    expect(named('iss').spanM).toBe(109);
    expect(named('iss').shape?.model).toBe('iss.glb');
    expect(named('iss').shape?.pointsAt).toBe('nadir');
    expect(named('tiangong').shape?.model).toBeNull();
    expect(named('tiangong').shape?.boxM).toEqual([16.6, 55.7, 4.2]);
  });

  it('puts every other satellite in exactly one of the bulk and the SGP4 tier', () => {
    const named = new Set(BUILD.named.map((satellite) => satellite.noradId));
    const bulk = new Set(BUILD.names.noradId);
    const sgp4 = new Set(BUILD.sgp4.map((satellite) => satellite.omm.NORAD_CAT_ID));
    expect(named.size + bulk.size + sgp4.size).toBe(BUILD.info.count);
    for (const id of bulk) {
      expect(named.has(id) || sgp4.has(id)).toBe(false);
    }
  });

  it('keeps an ordinary Starlink in the bulk, and gives it its constellation by name', () => {
    const index = bulkIndex(48881);
    expect(index).toBeGreaterThanOrEqual(0);
    const flags = BUILD.bulk[index * SATELLITE_RECORD_FLOATS + 11]!;
    expect(decode(flags)).toEqual({ groups: ['active', 'starlink'], regime: 'leo', type: 'PAY' });
    expect(BUILD.names.name[index]).toBe('STARLINK-3005');
    expect(BUILD.names.ageDays[index]).toBeLessThan(0);
  });

  it('hands SGP4 what the bulk cannot follow: under thrust, re-entering, very eccentric', () => {
    expect(inSgp4(45395)).toBe(true); // STARLINK-1297, thousands of km off the parabola
    const reentering = BUILD.sgp4.find((satellite) => satellite.omm.NORAD_CAT_ID === 47627)!;
    expect(reentering.bulkErrorKm).toBeNull(); // SGP4 itself stops inside the window
    expect(inSgp4(36828)).toBe(true); // BeiDou-2 IGSO-1
    const thrusting = BUILD.sgp4.find((satellite) => satellite.omm.NORAD_CAT_ID === 45395)!;
    expect(thrusting.bulkErrorKm!).toBeGreaterThan(BUILD.info.sgp4.thresholdKm);
  });

  it('drops what is stale in drag, keeps what is stale above it, and leaves TESS to Horizons', () => {
    expect(BUILD.info.dropped).toEqual({ stale: 2, invalid: 0, excluded: 1 });
    // The fragment last seen a month ago, and O3B MPOWER F11 dipping to 760 km: gone.
    expect(bulkIndex(37049)).toBe(-1);
    expect(bulkIndex(100686)).toBe(-1);
    // GLONASS at 19,000 km with 29-day-old elements: kept, in medium orbit.
    expect(decode(BUILD.bulk[bulkIndex(36402) * SATELLITE_RECORD_FLOATS + 11]!).regime).toBe('meo');
    expect(bulkIndex(43435)).toBe(-1);
    expect(inSgp4(43435)).toBe(false);
  });

  it('types debris and rocket bodies', () => {
    const fragment = BUILD.bulk[bulkIndex(30004) * SATELLITE_RECORD_FLOATS + 11]!;
    expect(decode(fragment)).toEqual({ groups: ['fengyun-1c-debris'], regime: 'leo', type: 'DEB' });
    const stage = BUILD.bulk[bulkIndex(2802) * SATELLITE_RECORD_FLOATS + 11]!;
    expect(decode(stage).type).toBe('R/B');
  });

  it('measures and publishes the bulk against SGP4', () => {
    const leo = BUILD.info.accuracy.find((row) => row.regime === 'leo')!;
    expect(leo.days).toEqual([0, 0.0417, 1, 3, 7]);
    expect(leo.medianKm[0]!).toBeLessThan(10);
    expect(BUILD.info.bulk.count * SATELLITE_RECORD_FLOATS).toBe(BUILD.bulk.length);
    expect(BUILD.names.name).toHaveLength(BUILD.info.bulk.count);
  });

  it('writes satellites/ and only that, with satellites.json describing it', async () => {
    const out = await mkdtemp(join(tmpdir(), 'sss-satellites-'));
    try {
      await writeSatellites(BUILD, out);
      expect(await readdir(out)).toEqual(['satellites']);
      const files = (await readdir(join(out, 'satellites'))).sort();
      expect(files).toEqual(['bulk-names.json', 'bulk.bin', 'named.json', 'satellites.json', 'sgp4.json']);
      const info = JSON.parse(await readFile(join(out, 'satellites', 'satellites.json'), 'utf8')) as SatelliteInfo;
      const bytes = await readFile(join(out, 'satellites', info.bulk.file));
      expect(bytes.byteLength).toBe(info.bulk.bytes);
      // Little-endian float32, as the contract says: the first record's a is the first float.
      expect(bytes.readFloatLE(0)).toBe(BUILD.bulk[0]);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
