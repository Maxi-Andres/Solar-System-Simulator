import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  epochJdUtc,
  GP_GROUPS_FETCHED,
  parseCsv,
  parseGpCsv,
  parseSatcatCsv,
  readCelestrak,
  SATCAT_GROUPS_FETCHED,
} from './celestrak.ts';

/**
 * CelesTrak's CSV and the client's manners. The fixtures are real responses of 2026-10-21,
 * cut to a few rows: see satellites.test.ts for which.
 */

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const fixture = (file: string) => readFile(join(FIXTURES, file), 'utf8');

describe('the CSV reader', () => {
  it('reads quoted fields, doubled quotes and both line endings', () => {
    expect(parseCsv('A,B\r\n"x, y","say ""hi"""\n1,2')).toEqual([
      ['A', 'B'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ]);
  });

  it('reads the GP CSV as CelesTrak JSON would carry it', async () => {
    const rows = parseGpCsv(await fixture('gp-active.csv'), 'active');
    const iss = rows.find((row) => row.NORAD_CAT_ID === 25544)!;
    expect(iss.OBJECT_NAME).toBe('ISS (ZARYA)');
    expect(iss.OBJECT_ID).toBe('1998-067A');
    // Kept as written, microseconds and all.
    expect(iss.EPOCH).toBe('2026-10-21T01:08:59.469792');
    expect(iss.MEAN_MOTION).toBeCloseTo(15.48967427, 8);
    expect(typeof iss.BSTAR).toBe('number');
    expect(iss.EPHEMERIS_TYPE).toBe(0);
    // A six-digit catalogue number, which the TLE format cannot carry.
    expect(rows.some((row) => row.NORAD_CAT_ID === 100686)).toBe(true);
  });

  it('reads ".0024489" and ".60406552E-3" as CSV writes them', () => {
    const header =
      'OBJECT_NAME,OBJECT_ID,EPOCH,MEAN_MOTION,ECCENTRICITY,INCLINATION,RA_OF_ASC_NODE,ARG_OF_PERICENTER,MEAN_ANOMALY,EPHEMERIS_TYPE,CLASSIFICATION_TYPE,NORAD_CAT_ID,ELEMENT_SET_NO,REV_AT_EPOCH,BSTAR,MEAN_MOTION_DOT,MEAN_MOTION_DDOT';
    const row =
      'CALSPHERE 1,1964-063C,2026-10-21T03:33:41.785056,13.76738394,.0024489,90.2213,74.6872,270.0458,263.9396,0,U,900,999,8875,.60406552E-3,.603E-5,0';
    const [omm] = parseGpCsv(`${header}\n${row}\n`, 'test');
    expect(omm!.ECCENTRICITY).toBe(0.0024489);
    expect(omm!.BSTAR).toBeCloseTo(6.0406552e-4, 12);
  });

  it('fails on a blank element rather than reading it as zero', () => {
    const header =
      'OBJECT_NAME,OBJECT_ID,EPOCH,MEAN_MOTION,ECCENTRICITY,INCLINATION,RA_OF_ASC_NODE,ARG_OF_PERICENTER,MEAN_ANOMALY,EPHEMERIS_TYPE,CLASSIFICATION_TYPE,NORAD_CAT_ID,ELEMENT_SET_NO,REV_AT_EPOCH,BSTAR,MEAN_MOTION_DOT,MEAN_MOTION_DDOT';
    const row = 'X,1964-063C,2026-10-21T03:33:41.785056,13.7,,90,74,270,263,0,U,900,999,8875,0,0,0';
    expect(() => parseGpCsv(`${header}\n${row}\n`, 'test')).toThrow(/ECCENTRICITY/);
  });

  it('reads the SATCAT', async () => {
    const rows = parseSatcatCsv(await fixture('satcat-visual.csv'), 'visual');
    expect(rows.find((row) => row.noradId === 25544)).toEqual({
      noradId: 25544,
      objectType: 'PAY',
      launchDate: '1998-11-20',
      owner: 'ISS',
    });
    expect(rows.find((row) => row.noradId === 2802)!.objectType).toBe('R/B');
  });

  it('turns an epoch into a UTC Julian day to the microsecond', () => {
    expect(epochJdUtc('2000-01-01T12:00:00')).toBe(2451545);
    const jd = epochJdUtc('2026-10-21T01:08:59.469792');
    const seconds = (jd - epochJdUtc('2026-10-21T00:00:00')) * 86_400;
    expect(seconds).toBeCloseTo(3600 + 8 * 60 + 59.469792, 4);
  });
});

describe('the CelesTrak client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const csvFor = async (url: string): Promise<string> => {
    const parsed = new URL(url);
    const group = parsed.searchParams.get('GROUP')!;
    const kind = parsed.pathname.includes('satcat') ? 'satcat' : 'gp';
    try {
      return await fixture(`${kind}-${group}.csv`);
    } catch {
      // A group with no fixture answers with just the header: an empty group.
      return (await fixture(`${kind}-active.csv`)).split('\n')[0]!;
    }
  };

  it('asks for each group once, in CSV, one at a time', async () => {
    let inFlight = 0;
    let most = 0;
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: URL) => {
      urls.push(url.toString());
      inFlight += 1;
      most = Math.max(most, inFlight);
      const body = await csvFor(url.toString());
      inFlight -= 1;
      return new Response(body, { status: 200 });
    });
    const read = await readCelestrak();
    expect(read.failure).toBeNull();
    expect(read.missing).toEqual([]);
    expect(urls).toHaveLength(GP_GROUPS_FETCHED.length + SATCAT_GROUPS_FETCHED.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.includes('FORMAT=csv'))).toBe(true);
    expect(most).toBe(1);
    expect(read.gp.get('active')!.length).toBe(14);
    expect(read.satcat.get(25544)!.launchDate).toBe('1998-11-20');
  });

  it('stops at the first refusal and never retries it', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: URL) => {
      urls.push(url.toString());
      if (url.searchParams.get('GROUP') === 'gnss') {
        return new Response('GP data has not updated since your last successful download', { status: 403 });
      }
      return new Response(await csvFor(url.toString()), { status: 200 });
    });
    const read = await readCelestrak();
    // active, stations, visual, then gnss refused: nothing after it is asked for.
    expect(urls).toHaveLength(4);
    expect(read.failure).toMatch(/HTTP 403.*has not updated/);
    expect(read.missing).toEqual(GP_GROUPS_FETCHED.slice(3));
    expect(read.gp.has('visual')).toBe(true);
    expect(read.satcat.size).toBe(0);
  });

  it('stops on a server error too, as the policy asks', async () => {
    const fetch = vi.fn(async () => new Response('busy', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    const read = await readCelestrak();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(read.gp.size).toBe(0);
    expect(read.missing).toEqual([...GP_GROUPS_FETCHED]);
  });

  it('answers from the cache inside the update interval, and fills it otherwise', async () => {
    const cache = await mkdtemp(join(tmpdir(), 'sss-celestrak-'));
    try {
      await writeFile(join(cache, 'gp-active.csv'), await fixture('gp-active.csv'), 'utf8');
      const urls: string[] = [];
      vi.stubGlobal('fetch', async (url: URL) => {
        urls.push(url.toString());
        return new Response(await csvFor(url.toString()), { status: 200 });
      });
      const first = await readCelestrak(cache);
      expect(urls.some((url) => url.includes('GROUP=active') && url.includes('gp.php'))).toBe(false);
      expect(first.gp.get('active')!.length).toBe(14);
      const asked = urls.length;
      await readCelestrak(cache);
      expect(urls.length).toBe(asked);
    } finally {
      await rm(cache, { recursive: true, force: true });
    }
  });
});
