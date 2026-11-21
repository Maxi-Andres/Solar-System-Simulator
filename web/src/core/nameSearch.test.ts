import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BeltInfo, LaniakeaNames } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import type { BeltFetchers } from './belt.ts';
import { indexNames, parseBeltNames, searchNames } from './beltNames.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { indexNames as indexLaniakea } from './laniakea.ts';
import {
  NameSearchClient,
  nameSearchHandler,
  RemoteNames,
  type NamePort,
  type NameSearchReply,
  type NameSearchRequest,
} from './nameSearch.ts';
import { indexSatelliteNames, parseSatelliteNames } from './satellites.ts';

/**
 * The worker's path, run on this thread: the requests go through the same structured clone a
 * worker's would and are answered by the handler the worker runs, so what is tested is the
 * protocol and the indexes, against the real files -- and that every search gives exactly what
 * searchNames gives on the index made here.
 */

const DATA = join(import.meta.dirname, '../../public/data');
const disk: BeltFetchers = {
  json: async (path) => {
    try {
      return JSON.parse(await readFile(join(DATA, path), 'utf8')) as unknown;
    } catch {
      return null;
    }
  },
  binary: async () => null,
};

/** A port that behaves as the worker: each request cloned, handled, and the reply cloned back. */
function inProcessPort(): NamePort {
  const handle = nameSearchHandler(disk);
  const port: NamePort = {
    onmessage: null,
    onerror: null,
    postMessage(request: NameSearchRequest) {
      void handle(structuredClone(request)).then((reply) => {
        port.onmessage?.({ data: structuredClone(reply) } as MessageEvent<NameSearchReply>);
      });
    },
    terminate() {},
  };
  return port;
}

const QUERIES = ['eros', 'e', 'ceres', '2004', 'ngc 4', 'm', 'virgo', 'starlink', 'cosmos 2251', '25544', '1998 067a', 'hi iaka', 'a898 pa', ''];

const beltInfo = (await disk.json('belt/belt.json')) as BeltInfo | null;
const satelliteInfo = (await disk.json('satellites/satellites.json')) as { names: { file: string }; bulk: { count: number } } | null;
const hasData = beltInfo?.names !== undefined && satelliteInfo !== null && (await disk.json('laniakea/names.json')) !== null;

withData(hasData)('the names searched in the worker', () => {
  it('finds exactly what searchNames finds here, for the belt, Laniakea and the satellites, with their rows', async () => {
    const client = new NameSearchClient(inProcessPort);
    const beltPath = `belt/${beltInfo!.names!.file}`;
    const satellitePath = `satellites/${satelliteInfo!.names.file}`;
    const belt = indexNames(beltInfo!, parseBeltNames(await disk.json(beltPath), beltInfo!));
    const satellites = indexSatelliteNames(parseSatelliteNames(await disk.json(satellitePath), satelliteInfo!.bulk.count));
    const laniakea = indexLaniakea((await disk.json('laniakea/names.json')) as LaniakeaNames);

    expect(await client.load({ type: 'load', source: 'belt', url: beltPath, info: beltInfo! })).toBe(belt.names.count);
    await client.load({ type: 'load', source: 'bulk', url: satellitePath, count: satelliteInfo!.bulk.count });
    await client.load({ type: 'load', source: 'laniakea', url: 'laniakea/names.json' });

    for (const query of QUERIES) {
      const fromBelt = await client.search('belt', query, 20);
      expect(fromBelt.matches).toEqual(searchNames(belt, query, 20));
      fromBelt.ks.forEach((k, i) => {
        expect(fromBelt.rows['display']![i]).toBe(belt.names.display[k]);
        expect(fromBelt.rows['designation']![i]).toBe(belt.names.designation[k]);
        expect(fromBelt.rows['tier']![i]).toBe(belt.names.tier[k]);
        expect(fromBelt.rows['index']![i]).toBe(belt.names.index[k]);
        expect(fromBelt.rows['classIndex']![i]).toBe(belt.names.classIndex[k]);
      });

      const fromSatellites = await client.search('bulk', query, 12);
      expect(fromSatellites.matches).toEqual(searchNames(satellites, query, 12));
      const trimmed = query.trim();
      expect(fromSatellites.norad).toBe(/^\d+$/.test(trimmed) ? (satellites.byNorad.get(Number(trimmed)) ?? null) : null);
      fromSatellites.ks.forEach((k, i) => {
        expect(fromSatellites.rows['name']![i]).toBe(satellites.names.name[k]);
        expect(fromSatellites.rows['noradId']![i]).toBe(satellites.names.noradId[k]);
        expect(fromSatellites.rows['ageDays']![i]).toBe(satellites.names.ageDays[k]);
      });

      expect((await client.search('laniakea', query, 8)).matches).toEqual(searchNames(laniakea.search, query, 8));
    }
  });

  it('fills an index’s columns at what was found, and searches here, alike, once the worker fails', async () => {
    const beltPath = `belt/${beltInfo!.names!.file}`;
    const full = indexNames(beltInfo!, parseBeltNames(await disk.json(beltPath), beltInfo!));
    const local = async () => ({ search: full, columns: full.names as never, byNorad: null, count: full.names.count });

    const client = new NameSearchClient(inProcessPort);
    await client.load({ type: 'load', source: 'belt', url: beltPath, info: beltInfo! });
    const columns: Record<string, unknown[]> = { display: [], designation: [], tier: [], index: [], classIndex: [] };
    const remote = new RemoteNames(client, 'belt', columns, local);
    const { matches } = await remote.search('eros', 20);
    expect(matches).toEqual(searchNames(full, 'eros', 20));
    for (const { k } of matches) {
      expect(columns['display']![k]).toBe(full.names.display[k]);
      expect(columns['tier']![k]).toBe(full.names.tier[k]);
    }
    // Nothing filled that was not found.
    expect(Object.keys(columns['display']!).length).toBe(new Set(matches.map(({ k }) => k)).size);

    // A worker that cannot start: the same answers, from the index made here.
    const dead = new NameSearchClient(() => {
      throw new Error('no workers here');
    });
    const fallback = new RemoteNames(dead, 'belt', { display: [], designation: [], tier: [], index: [], classIndex: [] }, local);
    expect((await fallback.search('ceres', 20)).matches).toEqual(searchNames(full, 'ceres', 20));
    expect(dead.broken).toBe(true);
  });
});

describe('the name search client', () => {
  it('refuses everything once its worker has failed, so the callers fall back', async () => {
    let port: NamePort | null = null;
    const client = new NameSearchClient(() => {
      port = { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
      return port;
    });
    const pending = client.search('belt', 'eros', 20);
    (port as NamePort | null)!.onerror?.({ message: 'boom' } as ErrorEvent);
    await expect(pending).rejects.toThrow('boom');
    expect(client.broken).toBe(true);
    await expect(client.search('belt', 'eros', 20)).rejects.toThrow(/failed/);
  });

  it('passes on what the worker could not load', async () => {
    const client = new NameSearchClient(inProcessPort);
    await expect(client.load({ type: 'load', source: 'laniakea', url: 'nowhere/names.json' })).rejects.toThrow('is not there');
    await expect(client.search('belt', 'eros', 20)).rejects.toThrow('not loaded');
  });
});
