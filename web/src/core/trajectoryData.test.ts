import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PathTable, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { loadEphemerisStore, type EphemerisStore, type Fetcher } from './ephemerisStore.ts';
import { interpolateState } from './hermite.ts';

/**
 * Every spacecraft's path file, against the full table it was cut from.
 *
 * The generator checks this as it builds; this checks what was actually written --
 * after rounding, and through the app's own interpolator rather than the generator's.
 */

const DATA_ROOT = join(import.meta.dirname, '../../public');

const read = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;
const diskFetcher: Fetcher = read;

async function tryLoad(): Promise<EphemerisStore | null> {
  try {
    const store = await loadEphemerisStore(diskFetcher, '/');
    return Object.keys(store.manifest.paths).length > 0 ? store : null;
  } catch {
    return null;
  }
}

const store = await tryLoad();
const describeWithData = store === null ? describe.skip : describe;

/** A craft's whole table, its chunks joined on their shared boundary samples. */
async function fullTable(s: EphemerisStore, id: string): Promise<VectorTable> {
  const chunks = s.manifest.tables[id]!.chunks;
  if (chunks === null) {
    return (await read(`data/vectors/${id}.json`)) as VectorTable;
  }
  const parts = await Promise.all(
    chunks.map(async (_, index) => (await read(`data/vectors/${id}/${index}.json`)) as VectorTable),
  );
  const columns = ['t', 'x', 'y', 'z', 'vx', 'vy', 'vz'] as const;
  const joined = Object.fromEntries(columns.map((column) => [column, [] as number[]]));
  for (const [index, part] of parts.entries()) {
    for (const column of columns) {
      joined[column]!.push(...part[column].slice(index === 0 ? 0 : 1));
    }
  }
  return { ...parts[0]!, ...joined, count: joined.t!.length } as VectorTable;
}

describeWithData('spacecraft paths, as written', () => {
  const s = store!;
  const crafts = Object.keys(s.manifest.paths);
  // What the tolerance is measured from: every body with a full-window table.
  const references = s.bodies
    .filter((body) => body.vectorWindow === 'full')
    .map((body) => body.id);

  it.each(crafts)('%s: every sample is JPL’s, unchanged', async (id) => {
    const full = await fullTable(s, id);
    const path = (await read(`data/paths/${id}.json`)) as PathTable;
    let k = 0;
    for (let i = 0; i < path.count; i += 1) {
      while (full.t[k]! < path.t[i]!) {
        k += 1;
      }
      expect(full.t[k]).toBe(path.t[i]);
      expect([full.x[k], full.y[k], full.z[k], full.vx[k]]).toEqual([
        path.x[i],
        path.y[i],
        path.z[i],
        path.vx[i],
      ]);
    }
    expect(path.t[0]).toBe(full.t[0]);
    expect(path.t.at(-1)).toBe(full.t.at(-1));
  });

  it.each(crafts)('%s: breaks exactly at the published seams', async (id) => {
    const path = (await read(`data/paths/${id}.json`)) as PathTable;
    const seams = s.pathInfo(id)!.seams;
    expect(path.gaps.map((i) => [path.t[i], path.t[i + 1]])).toEqual(
      seams.map((seam) => [seam.startJd, seam.stopJd]),
    );
  });

  it.each(crafts)(
    '%s: stays within its angle of the full table, seen from the nearest body',
    async (id) => {
      const info = s.pathInfo(id)!;
      const full = await fullTable(s, id);
      const path = (await read(`data/paths/${id}.json`)) as PathTable;
      const body = s.body(id);
      const gapStarts = new Set(path.gaps.map((i) => path.t[i]));

      let worst = 0;
      let gapIndex = 0;
      for (let k = 0; k < full.count; k += 1) {
        const jd = full.t[k]!;
        // Inside a seam there is nothing to compare: the path does not interpolate it.
        while (gapIndex < path.gaps.length && path.t[path.gaps[gapIndex]! + 1]! < jd) {
          gapIndex += 1;
        }
        if (gapStarts.has(jd)) {
          continue;
        }
        const drawn = interpolateState(path, jd)!.position;
        const miss = Math.hypot(drawn.x - full.x[k]!, drawn.y - full.y[k]!, drawn.z - full.z[k]!);

        const origin = body.parent === null ? null : s.stateInRoot(body.parent, jd)!.position;
        const px = full.x[k]! + (origin?.x ?? 0);
        const py = full.y[k]! + (origin?.y ?? 0);
        const pz = full.z[k]! + (origin?.z ?? 0);
        let nearest = Infinity;
        for (const reference of references) {
          const at = s.stateInRoot(reference, jd)!.position;
          nearest = Math.min(nearest, Math.hypot(px - at.x, py - at.y, pz - at.z));
        }
        const tolerance = Math.max(info.floorKm, info.angularTolerance * nearest);
        worst = Math.max(worst, miss / tolerance);
      }
      // Plus the files' own rounding: a sample's instant is kept to 1e-8 day, 0.43 ms,
      // and at BepiColombo's 48 km/s about the Sun in Mercury orbit that is 21 m between
      // where the instant says the craft was and where the position says. Against the
      // one-kilometre floor that is 2%; the generator checked before rounding.
      expect(worst).toBeLessThanOrEqual(1.025);
    },
    60_000,
  );
});
