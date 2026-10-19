import { afterEach, describe, expect, it, vi } from 'vitest';

import { SBDB_QUERY_API_URL } from '../config.ts';
import { beltQuery, fetchBelt, parseSbdbResponse, SBDB_FIELDS, type SbdbRow } from './sbdb.ts';
import sbdbBelt from './__fixtures__/sbdb-belt.json' with { type: 'json' };

/**
 * The reader for SBDB's answer.
 *
 * The fixture is a real response to the belt query (2026-10-19, full precision), cut to
 * 22 of its 83,841 rows and otherwise verbatim -- the envelope still says 83,841. The
 * rows were picked for what they exercise: Ceres, Vesta and Pluto, which the catalog
 * already draws; a main-belt, an inner and an outer main-belt asteroid, a Mars-crosser,
 * one of each NEO class the H < 15 belt has (Eros, Sisyphus, an Aten), Hektor, Chiron,
 * Quaoar, Sedna and an Oort-cloud orbit at e = 0.996; the two hyperbolic rows, the one row
 * with no mean anomaly, the one orbit whose epoch is 1927, and two of equal H.
 */

const byDesignation = (designation: string) =>
  parseSbdbResponse(sbdbBelt).rows.find((row) => row.designation === designation)!;

describe('the query', () => {
  const query = beltQuery(15, 0, 100_000);

  it('asks for asteroids only, brighter than the limit, at full precision', () => {
    expect(query['sb-kind']).toBe('a');
    expect(JSON.parse(query['sb-cdata']!)).toEqual({ AND: ['H|LT|15'] });
    // Without it the API rounds for display: Ceres's a to 2.766 AU, 75,000 km.
    expect(query['full-prec']).toBe('true');
  });

  it('pages in a fixed order: by SPK-ID, which is unique', () => {
    expect(query.sort).toBe('spkid');
    expect(beltQuery(15, 200_000, 100_000)).toMatchObject({
      limit: '100000',
      'limit-from': '200000',
    });
  });

  it('asks for every field it reads, and the frame they are in', () => {
    expect(query.fields!.split(',')).toEqual([...SBDB_FIELDS]);
    expect(SBDB_FIELDS).toContain('equinox');
  });
});

describe('reading the response', () => {
  const page = parseSbdbResponse(sbdbBelt);

  it('reads every row, and the count of the whole query', () => {
    expect(page.rows).toHaveLength(22);
    expect(page.count).toBe(83_841);
  });

  it('gets Ceres right, numbers from strings and all', () => {
    expect(byDesignation('1')).toStrictEqual({
      spkid: 20000001,
      designation: '1',
      aAu: 2.765552595034094,
      // SBDB writes '.07969229514816586', with no leading zero.
      e: 0.07969229514816586,
      iDeg: 10.58802780183462,
      nodeDeg: 80.24862682043221,
      periDeg: 73.29421453021587,
      meanAnomalyDeg: 274.4193463761342,
      epochJd: 2461200.5,
      meanMotionDegPerDay: 0.21430445064843,
      h: 3.34,
      orbitClass: 'MBA',
      equinox: 'J2000',
    });
  });

  it('keeps a designation that is not a number as it is', () => {
    expect(byDesignation('2002 PD153').spkid).toBe(50137782);
  });

  it('leaves a missing value null, never zero', () => {
    // 2002 PD153 has no mean anomaly at all. A zero would be perihelion, a real place.
    expect(byDesignation('2002 PD153').meanAnomalyDeg).toBeNull();
  });

  it('reads exponents and negative semi-major axes as SBDB writes them', () => {
    expect(byDesignation('90377').meanMotionDegPerDay).toBe(7.773948799642578e-5);
    expect(byDesignation('2024 U2').aAu).toBe(-3069.891033711809);
  });

  it('reads columns by name, not by position', () => {
    const order = [...sbdbBelt.fields.keys()].reverse();
    const reversed = {
      ...sbdbBelt,
      fields: order.map((k) => sbdbBelt.fields[k]),
      data: sbdbBelt.data.map((row) => order.map((k) => row[k])),
    };
    expect(parseSbdbResponse(reversed).rows).toStrictEqual(page.rows);
  });

  it('fails on a field it needs and did not get', () => {
    const { fields, data } = sbdbBelt;
    const without = fields.indexOf('ma');
    expect(() =>
      parseSbdbResponse({
        count: 1,
        fields: fields.filter((_, k) => k !== without),
        data: data.slice(0, 1).map((row) => row.filter((_, k) => k !== without)),
      }),
    ).toThrow(/no field "ma"/);
  });

  it('fails on a value that is not a number, rather than guessing', () => {
    const row = [...sbdbBelt.data[0]!];
    row[sbdbBelt.fields.indexOf('e')] = 'n/a';
    expect(() => parseSbdbResponse({ ...sbdbBelt, data: [row] })).toThrow(/"e" is not a number/);
  });

  it('reads a query that matched nothing, which comes back with no data at all', () => {
    expect(parseSbdbResponse({ signature: sbdbBelt.signature, fields: sbdbBelt.fields, count: 0 }))
      .toStrictEqual({ count: 0, rows: [] });
  });
});

describe('paging', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A fake SBDB that pages the fixture's rows, optionally lying about its count. */
  function fakeSbdb(
    countFor: (from: number, call: number) => number = () => sbdbBelt.data.length,
    data: readonly (readonly unknown[])[] = sbdbBelt.data,
  ) {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', async (input: URL) => {
      const url = new URL(input);
      calls.push(url);
      const from = Number(url.searchParams.get('limit-from'));
      const limit = Number(url.searchParams.get('limit'));
      return new Response(
        JSON.stringify({
          ...sbdbBelt,
          count: countFor(from, calls.length),
          data: data.slice(from, from + limit),
        }),
        { status: 200 },
      );
    });
    return calls;
  }

  /** A sink that keeps what it is handed, page by page. */
  function collector() {
    const pages: SbdbRow[][] = [];
    return { pages, add: (rows: readonly SbdbRow[]) => void pages.push([...rows]) };
  }

  it('walks the pages until the count is reached, handing each one over', async () => {
    const calls = fakeSbdb();
    const read = await fetchBelt(collector, 15, 10);
    expect(read.sink.pages.map((page) => page.length)).toEqual([10, 10, 2]);
    expect(read.sink.pages.flat().map((row) => row.spkid)).toEqual(
      sbdbBelt.data.map((row) => row[0]),
    );
    expect(read.count).toBe(22);
    expect(calls.map((url) => url.searchParams.get('limit-from'))).toEqual(['0', '10', '20']);
    expect(calls.every((url) => url.href.startsWith(SBDB_QUERY_API_URL))).toBe(true);
    expect(Date.parse(read.queriedAt)).not.toBeNaN();
  });

  it('asks for the whole catalogue, with no magnitude filter, when the limit is null', async () => {
    const calls = fakeSbdb();
    await fetchBelt(collector, null, 100);
    expect(calls[0]!.searchParams.has('sb-cdata')).toBe(false);
    expect(beltQuery(null, 0, 10)['sb-kind']).toBe('a');
  });

  it('reads again, into a fresh sink, when the count changed under the paging', async () => {
    // The second request -- the first read's second page -- sees one more asteroid.
    fakeSbdb((_, call) => (call === 2 ? 23 : 22));
    const read = await fetchBelt(collector, 15, 10);
    expect(read.sink.pages.flat()).toHaveLength(22);
  });

  it('gives up on a catalogue that will not settle', async () => {
    fakeSbdb((from) => (from === 0 ? 22 : 23));
    await expect(fetchBelt(collector, 15, 10)).rejects.toThrow(/settled belt.*count changed/);
  });

  it('refuses the same asteroid twice across pages', async () => {
    const doubled = [...sbdbBelt.data.slice(0, 21), sbdbBelt.data[0]!];
    fakeSbdb(undefined, doubled);
    await expect(fetchBelt(collector, 15, 10)).rejects.toThrow(/SPK-ID 20000001 twice/);
  });

  it('refuses a rejected query in one request, without retrying a mistake of ours', async () => {
    const fetch = vi.fn(async () => new Response('{"message":"bad field"}', { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchBelt(collector, 15, 10)).rejects.toThrow(/rejected.*HTTP 400.*bad field/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
