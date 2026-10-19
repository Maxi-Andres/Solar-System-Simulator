import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CATALOG, getBody } from '../catalog.ts';
import { AU_KM, BELT_FILE, SBDB_QUERY_API_URL } from '../config.ts';
import { BELT_CLASSES, BELT_RECORD_FLOATS, type BeltInfo } from '../types.ts';
import { writeBelt } from '../writeOutput.ts';
import {
  beltBytes,
  buildBelt,
  catalogDesignations,
  FLOAT32_BELOW_PI,
  meanAnomalyAt,
  storedMeanAnomaly,
  wrapMeanAnomaly,
  wrapRadians,
} from './buildBelt.ts';
import { parseSbdbResponse, type SbdbRow } from './sbdb.ts';
import sbdbBelt from './__fixtures__/sbdb-belt.json' with { type: 'json' };

/**
 * From SBDB's rows to the belt's file. The fixture is the real response described in
 * sbdb.test.ts: 22 rows, three of them bodies the catalog draws, two hyperbolic and one
 * with no mean anomaly -- so sixteen asteroids are written.
 */

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

/** The run of 2026-10-19: midnight of that UTC date, as the TDB Julian day it is sent as. */
const REFERENCE_JD = 2461332.5;

const ROWS = parseSbdbResponse(sbdbBelt).rows;
const row = (designation: string): SbdbRow => ROWS.find((r) => r.designation === designation)!;

const EXCLUDED = catalogDesignations(CATALOG);

function build(rows: readonly SbdbRow[] = ROWS) {
  return buildBelt({
    rows,
    queriedAt: '2026-10-19T15:24:52.471Z',
    referenceJd: REFERENCE_JD,
    magnitudeLimit: 15,
    excluded: EXCLUDED,
  });
}

const BELT = build();

/** Record `index` of a build, as the nine numbers the file holds. */
function record(records: Float32Array, index: number): number[] {
  return [...records.subarray(index * BELT_RECORD_FLOATS, (index + 1) * BELT_RECORD_FLOATS)];
}

/** The record of one asteroid, found by its semi-major axis -- the record has no name. */
function recordOf(designation: string): number[] {
  const a = Math.fround(row(designation).aAu! * AU_KM);
  for (let index = 0; index < BELT.info.count; index += 1) {
    if (BELT.records[index * BELT_RECORD_FLOATS] === a) {
      return record(BELT.records, index);
    }
  }
  throw new Error(`${designation} is not in the belt.`);
}

/** Heliocentric ecliptic position of a two-body orbit, km, with M given directly. */
function keplerPosition(elements: readonly number[], meanAnomaly: number): [number, number, number] {
  const [a, e, i, node, peri] = elements as [number, number, number, number, number];
  // From ±π for an eccentric orbit, on the side M is on: Newton is safe from there.
  let E = e < 0.8 ? meanAnomaly : meanAnomaly < 0 ? -Math.PI : Math.PI;
  for (let step = 0; step < 50; step += 1) {
    E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  }
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const x1 = Math.cos(peri) * xp - Math.sin(peri) * yp;
  const y1 = Math.sin(peri) * xp + Math.cos(peri) * yp;
  return [
    Math.cos(node) * x1 - Math.sin(node) * Math.cos(i) * y1,
    Math.sin(node) * x1 + Math.cos(node) * Math.cos(i) * y1,
    Math.sin(i) * y1,
  ];
}

describe('what the belt leaves out because the catalog draws it', () => {
  it('is every named small body, by its SBDB number, and Pluto as 134340', () => {
    expect(EXCLUDED).toEqual([
      '1',
      '2',
      '4',
      '16',
      '3548',
      '52246',
      '65803',
      '99942',
      '101955',
      '134340',
      '136108',
      '136199',
      '136472',
      '152830',
      '162173',
      '486958',
    ]);
    // Horizons' 999 is Pluto from DE441; SBDB's asteroid 999 is Zachia, which is not.
    expect(EXCLUDED).not.toContain('999');
  });

  it('refuses a small body whose designation it cannot work out, rather than draw it twice', () => {
    const unknown = { ...getBody('bennu'), id: 'yr4', horizonsId: 'DES=2024 YR4;' };
    expect(() => catalogDesignations([unknown])).toThrow(/no SBDB designation/);
  });

  it('leaves them out of the file, and says which it found', () => {
    expect(BELT.excludedFound).toEqual(['1', '4', '134340']);
    expect(BELT.info.excluded).toEqual(EXCLUDED);
    expect(() => recordOf('1')).toThrow(/not in the belt/);
  });
});

describe('what the belt drops', () => {
  it('counts the open orbits and the incomplete row, and writes the rest', () => {
    expect(BELT.info.dropped).toEqual({ notElliptic: 2, missingElements: 1 });
    expect(BELT.info.count).toBe(22 - 3 - 2 - 1);
  });

  it('keeps an Oort-cloud orbit at e = 0.996: elliptic is elliptic', () => {
    expect(recordOf('2020 MQ53')[1]).toBeCloseTo(0.9961639576683519, 6);
  });

  it('stops on an orbit class it does not know, and names it', () => {
    const odd = { ...row('7'), orbitClass: 'XYZ' };
    expect(() => build([odd])).toThrow(/XYZ x1/);
  });

  it('stops on an orbit in another equinox, which would be another ecliptic', () => {
    const old = { ...row('7'), equinox: 'B1950' };
    expect(() => build([old])).toThrow(/B1950, not J2000/);
  });
});

describe('the units', () => {
  const vesta = row('4');
  const iris = recordOf('7');
  const sbdbIris = row('7');

  it('turns AU into km with the IAU astronomical unit', () => {
    expect(AU_KM).toBe(149_597_870.7);
    expect(iris[0]).toBe(Math.fround(sbdbIris.aAu! * AU_KM));
    expect(iris[0]! / AU_KM).toBeCloseTo(2.385746302646938, 6);
  });

  it('turns degrees into radians and deg/day into rad/day', () => {
    expect(iris[1]).toBe(Math.fround(sbdbIris.e!));
    expect(iris[2]).toBe(Math.fround(sbdbIris.iDeg! * DEG));
    expect(iris[3]).toBe(Math.fround(sbdbIris.nodeDeg! * DEG));
    expect(iris[4]).toBe(Math.fround(sbdbIris.periDeg! * DEG));
    expect(iris[6]).toBe(Math.fround(sbdbIris.meanMotionDegPerDay! * DEG));
    expect(iris[7]).toBe(Math.fround(5.7));
  });

  it("has mean motions that are Kepler's third law about the Sun", () => {
    // Gauss's constant, k = 0.01720209895 rad/day for a in AU (IAU 1976): an independent
    // check that n is per day and a is in AU before conversion. Vesta is massive enough
    // to differ by its own mass, 1.3e-10 of the Sun's -- nothing at this tolerance.
    const k = 0.01720209895;
    for (const asteroid of [vesta, row('7'), row('433'), row('624'), row('90377')]) {
      const n = asteroid.meanMotionDegPerDay! * DEG;
      expect(n / (k / asteroid.aAu! ** 1.5), asteroid.designation).toBeCloseTo(1, 4);
    }
  });
});

/** The SBDB orbit at full precision, propagated to the reference instant: the truth. */
function exactAtReference(designation: string): [number, number, number] {
  const sbdb = row(designation);
  return keplerPosition(
    [sbdb.aAu! * AU_KM, sbdb.e!, sbdb.iDeg! * DEG, sbdb.nodeDeg! * DEG, sbdb.periDeg! * DEG],
    wrapMeanAnomaly(
      (sbdb.meanAnomalyDeg! + sbdb.meanMotionDegPerDay! * (REFERENCE_JD - sbdb.epochJd!)) * DEG,
    ),
  );
}

/** How far the stored record, propagated zero days, is from the truth, km. */
function storageMissKm(designation: string): number {
  const stored = recordOf(designation);
  const drawn = keplerPosition(stored, stored[5]!);
  const truth = exactAtReference(designation);
  return Math.hypot(drawn[0] - truth[0], drawn[1] - truth[1], drawn[2] - truth[2]);
}

describe('the mean anomaly, moved to the reference instant', () => {
  it('adds n times the elapsed days, in float64', () => {
    // Iris: 132 days from its SBDB epoch, 2026-06-09, to the run.
    const iris = row('7');
    const expected = wrapMeanAnomaly((iris.meanAnomalyDeg! + iris.meanMotionDegPerDay! * 132) * DEG);
    expect(meanAnomalyAt(iris.meanAnomalyDeg!, iris.meanMotionDegPerDay!, 2461200.5, REFERENCE_JD))
      .toBeCloseTo(expected, 12);
    expect(recordOf('7')[5]).toBe(Math.fround(expected));
  });

  it('is centred on perihelion: [−π, π), negative on the way in', () => {
    expect(wrapMeanAnomaly(Math.PI)).toBe(-Math.PI);
    expect(wrapMeanAnomaly(-Math.PI)).toBe(-Math.PI);
    expect(wrapMeanAnomaly(TWO_PI - 0.5)).toBeCloseTo(-0.5, 15);
    expect(wrapMeanAnomaly(3 * TWO_PI + 0.25)).toBeCloseTo(0.25, 12);
    // Sedna and 2020 MQ53 are both just short of perihelion, 358.6 and 359.997 degrees.
    expect(recordOf('90377')[5]).toBeLessThan(0);
    expect(recordOf('2020 MQ53')[5]).toBeCloseTo(-0.00333 * DEG, 6);
  });

  it('wraps a century of motion into one turn without losing it', () => {
    // 1927 LA: 36,281 days from its epoch, about 15 turns.
    const lost = row('1927 LA');
    const days = REFERENCE_JD - lost.epochJd!;
    expect(days).toBe(36_281);
    const m = meanAnomalyAt(lost.meanAnomalyDeg!, lost.meanMotionDegPerDay!, lost.epochJd!, REFERENCE_JD);
    expect(m).toBeGreaterThanOrEqual(-Math.PI);
    expect(m).toBeLessThan(Math.PI);
    const turns = (lost.meanAnomalyDeg! + lost.meanMotionDegPerDay! * days) / 360;
    const fraction = turns - Math.floor(turns);
    expect(m / TWO_PI).toBeCloseTo(fraction >= 0.5 ? fraction - 1 : fraction, 10);
  });

  it('moves backwards just as well, for an epoch after the reference', () => {
    expect(meanAnomalyAt(10, 1, 100, 80)).toBeCloseTo(-10 * DEG, 12);
    expect(meanAnomalyAt(10, 1, 100, 95)).toBeCloseTo(5 * DEG, 12);
    // The node and perihelion keep [0, 2π).
    expect(wrapRadians(-0.5)).toBeCloseTo(TWO_PI - 0.5, 15);
  });

  it('puts the asteroid where its own elements, propagated from their epoch, put it', () => {
    // What separates the two is float32's rounding of the record, nothing else.
    expect(storageMissKm('7')).toBeLessThan(100);
    expect(storageMissKm('433')).toBeLessThan(100);
    expect(storageMissKm('624')).toBeLessThan(200);
    expect(storageMissKm('2060')).toBeLessThan(500);
  });

  it('keeps float32 precision at perihelion, where an eccentric orbit needs it', () => {
    // In [0, 2π) these were 2,076 km, 60,867 km and 4.1 million km: an M just short of a
    // full turn stored at float32's coarsest step, where the orbit is most sensitive to it.
    expect(storageMissKm('50000')).toBeLessThan(1_500);
    expect(storageMissKm('90377')).toBeLessThan(1_500);
    // What is left for 2020 MQ53 is its other elements: float32's step in a semi-major
    // axis of 2 x 10^12 km is 262,144 km. Fifteen thousand km at 55 AU from the Sun.
    expect(storageMissKm('2020 MQ53')).toBeLessThan(20_000);
  });

  it('never stores ±π, which float32 rounds outside the range on either side', () => {
    expect(Math.fround(Math.PI)).toBeGreaterThan(Math.PI);
    expect(Math.fround(-Math.PI)).toBeLessThan(-Math.PI);
    expect(Math.fround(FLOAT32_BELOW_PI)).toBe(FLOAT32_BELOW_PI);
    expect(FLOAT32_BELOW_PI).toBeLessThan(Math.PI);
    expect(storedMeanAnomaly(Math.PI - 1e-8)).toBe(FLOAT32_BELOW_PI);
    expect(storedMeanAnomaly(-Math.PI)).toBe(-FLOAT32_BELOW_PI);
    expect(storedMeanAnomaly(-Math.PI + 1e-8)).toBe(-FLOAT32_BELOW_PI);
    expect(storedMeanAnomaly(Math.PI - 1e-6)).toBe(Math.PI - 1e-6);
    expect(storedMeanAnomaly(-0.25)).toBe(-0.25);
    for (const m of [Math.PI - 1e-8, -Math.PI, -Math.PI + 1e-8, 3, -3]) {
      const stored = Math.fround(storedMeanAnomaly(m));
      expect(stored).toBeGreaterThanOrEqual(-Math.PI);
      expect(stored).toBeLessThan(Math.PI);
    }
    for (let index = 0; index < BELT.info.count; index += 1) {
      const m = BELT.records[index * BELT_RECORD_FLOATS + 5]!;
      expect(m).toBeGreaterThanOrEqual(-Math.PI);
      expect(m).toBeLessThan(Math.PI);
    }
  });
});

describe('the file', () => {
  it('holds BELT_RECORD_FLOATS numbers per asteroid', () => {
    expect(BELT_RECORD_FLOATS).toBe(9);
    expect(BELT.records.length).toBe(BELT.info.count * BELT_RECORD_FLOATS);
  });

  it('is ordered by H, brightest first, and equal H by SPK-ID', () => {
    const h = Array.from({ length: BELT.info.count }, (_, index) => record(BELT.records, index)[7]!);
    expect(h).toEqual([...h].sort((p, q) => p - q));
    // Sedna is the brightest asteroid left once Eris, Pluto, Makemake and Haumea are out.
    expect(record(BELT.records, 0)[0]).toBe(Math.fround(row('90377').aAu! * AU_KM));
    // Two of H 10.00: 655 before 1210, by SPK-ID.
    const tied = [row('655'), row('1210')].map((asteroid) => Math.fround(asteroid.aAu! * AU_KM));
    const positions = tied.map((a) =>
      Array.from({ length: BELT.info.count }, (_, index) => record(BELT.records, index)[0]).indexOf(a),
    );
    expect(positions[0]).toBeLessThan(positions[1]!);
    expect(positions[1]! - positions[0]!).toBe(1);
  });

  it('codes each class as its index in BELT_CLASSES', () => {
    expect(recordOf('433')[8]).toBe(BELT_CLASSES.indexOf('AMO'));
    expect(recordOf('1866')[8]).toBe(BELT_CLASSES.indexOf('APO'));
    expect(recordOf('66146')[8]).toBe(BELT_CLASSES.indexOf('ATE'));
    expect(recordOf('624')[8]).toBe(BELT_CLASSES.indexOf('TJN'));
    expect(recordOf('2060')[8]).toBe(BELT_CLASSES.indexOf('CEN'));
    expect(recordOf('90377')[8]).toBe(BELT_CLASSES.indexOf('TNO'));
    // SBDB's own "asteroid, other": a Jupiter-distance orbit too eccentric for a Trojan.
    expect(recordOf('6144')[8]).toBe(BELT_CLASSES.indexOf('AST'));
  });

  it('counts the classes it wrote, in code order', () => {
    expect(BELT.info.classCounts).toEqual({
      MBA: 3,
      IMB: 1,
      OMB: 2,
      MCA: 1,
      APO: 1,
      ATE: 1,
      AMO: 1,
      TJN: 1,
      CEN: 1,
      TNO: 3,
      AST: 1,
    });
    expect(Object.keys(BELT.info.classCounts)).toEqual(
      BELT_CLASSES.filter((code) => code in BELT.info.classCounts),
    );
  });

  it('is little-endian float32, whatever the machine', () => {
    const bytes = beltBytes(BELT.records);
    expect(bytes.byteLength).toBe(BELT.info.count * BELT_RECORD_FLOATS * 4);
    const view = new DataView(bytes.buffer);
    expect(view.getFloat32(0, true)).toBe(BELT.records[0]);
    expect(view.getFloat32(bytes.byteLength - 4, true)).toBe(BELT.records.at(-1));
  });

  it('describes itself as BeltInfo says', () => {
    const expected: Omit<BeltInfo, 'classCounts' | 'excluded' | 'dropped' | 'count'> = {
      source: {
        name: 'JPL Small-Body Database (SBDB) Query API',
        url: SBDB_QUERY_API_URL,
        queriedAt: '2026-10-19T15:24:52.471Z',
      },
      file: BELT_FILE,
      recordFloats: BELT_RECORD_FLOATS,
      magnitudeLimit: 15,
      referenceJd: REFERENCE_JD,
      // 1927 LA's epoch to the 2026-06-09 most orbits share. Pluto's 2016 one is not
      // here: Pluto is not written.
      elementEpochs: { minJd: 2425051.5, maxJd: 2461200.5 },
      classes: [...BELT_CLASSES],
    };
    expect(BELT.info).toMatchObject(expected);
  });
});

describe('writing it', () => {
  it('replaces belt/ and leaves the rest of the data directory alone', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'belt-'));
    try {
      await writeFile(join(directory, 'manifest.json'), '{}');
      await writeBelt(BELT, directory);
      await writeBelt(BELT, directory);
      expect((await readdir(directory)).sort()).toEqual(['belt', 'manifest.json']);
      expect((await readdir(join(directory, 'belt'))).sort()).toEqual(['belt.json', BELT_FILE]);
      const info = JSON.parse(await readFile(join(directory, 'belt', 'belt.json'), 'utf8'));
      expect(info).toEqual(BELT.info);
      const bytes = await readFile(join(directory, 'belt', BELT_FILE));
      expect(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)).toEqual(
        BELT.records,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
