import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CATALOG } from '@sss/tools/catalog';
import type { BodyDefinition, CometInfo, Manifest, OsculatingElements, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { osculatingEccentricity } from './cometBodies.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import { propagate } from './kepler.ts';
import { describeBody, layersFor, searchBodies } from './search.ts';

/**
 * The famous comets on JPL's vectors (famousComets.ts in tools/): found by name before
 * anything in the cloud, exact inside their tables, and -- on an open orbit -- neither
 * propagated nor drawn an ellipse outside them.
 */

const MU = 132712440041.279419;
const AU = 149_597_870.7;
const START = 2_460_000.5;
const STOP = START + 7300;
const COMETS = CATALOG.filter((body) => body.kind === 'comet');

describe('finding them', () => {
  const top = (query: string) => searchBodies(CATALOG, query)[0]?.body.id;

  it('by name, by number and by designation', () => {
    expect(top('halley')).toBe('1p-halley');
    expect(top('1P')).toBe('1p-halley');
    expect(top('67P')).toBe('67p-churyumov-gerasimenko');
    expect(top('churyumov')).toBe('67p-churyumov-gerasimenko');
    expect(top('hale bopp')).toBe('c-1995-o1-hale-bopp');
    expect(top('tsuchinshan')).toBe('c-2023-a3-tsuchinshan-atlas');
    // The interstellar two by either name.
    expect(top('2I')).toBe('2i-borisov');
    expect(top('C/2019 Q4')).toBe('2i-borisov');
    expect(top('3I')).toBe('3i-atlas');
    expect(top('2025 N1')).toBe('3i-atlas');
  });

  it('say they are comets, and switch the comet layer on', () => {
    const halley = CATALOG.find((body) => body.id === '1p-halley')!;
    expect(describeBody(halley, null)).toBe('Comet');
    expect(layersFor(halley)).toEqual(['comets']);
  });
});

/** A body at `x` km on the ecliptic, moving `vy` km/s, sampled daily over [from, to]. */
function table(id: string, x: number, vy: number, from: number, to: number): VectorTable {
  const t: number[] = [];
  for (let jd = from; jd <= to; jd += 1) {
    t.push(jd);
  }
  const constant = (value: number) => t.map(() => value);
  return {
    id,
    horizonsId: id,
    center: '500@0',
    count: t.length,
    t,
    x: constant(x),
    y: t.map((jd) => vy * (jd - from) * 86_400),
    z: constant(0),
    vx: constant(0),
    vy: constant(vy),
    vz: constant(0),
  };
}

function elements(id: string, eccentricity: number): OsculatingElements {
  const q = 1.2 * AU;
  const a = q / (1 - eccentricity);
  const n = Math.sqrt(MU / Math.abs(a) ** 3);
  return {
    id,
    center: '500@10',
    epochJd: START,
    eccentricity,
    periapsisKm: q,
    inclinationDeg: 0,
    ascendingNodeDeg: 0,
    argPeriapsisDeg: 0,
    periapsisTimeJd: START,
    meanMotionDegPerSec: (n * 180) / Math.PI,
    meanAnomalyDeg: 0,
    trueAnomalyDeg: 0,
    semiMajorAxisKm: a,
    apoapsisKm: eccentricity < 1 ? a * (1 + eccentricity) : 9.999999999999998e99,
    periodSec: eccentricity < 1 ? (2 * Math.PI) / n : 9.999999999999998e99,
  };
}

function store(): EphemerisStore {
  const halley = COMETS.find((body) => body.id === '1p-halley')!;
  const borisov = COMETS.find((body) => body.id === '2i-borisov')!;
  const sun = { ...halley, id: 'sun', name: 'Sun', kind: 'star', drawOrbit: false, gmKm3S2: MU, gmBodyOnlyKm3S2: MU } as BodyDefinition;
  const bodies = [sun, halley, borisov];
  const vectors = new Map<string, VectorTable>([['sun', table('sun', 0, 0, START, STOP)]]);
  const chunked: Record<string, VectorTable> = {
    '1p-halley': table('1p-halley', 1.2 * AU, 30, START + 100, START + 200),
    '2i-borisov': table('2i-borisov', 2 * AU, 40, START + 100, START + 200),
  };
  const manifest: Manifest = {
    generatedAt: '2026-10-20T00:00:00Z',
    source: { name: 'test', version: '0', url: '' },
    frame: { center: '500@0', refPlane: 'ECLIPTIC', refSystem: 'ICRF', units: 'KM-S' },
    window: { startJd: START, stopJd: STOP, startUtc: '', stopUtc: '' },
    bodies: bodies.map((entry) => entry.id),
    tables: {
      sun: { startJd: START, stopJd: STOP, chunks: null },
      ...Object.fromEntries(
        Object.entries(chunked).map(([id, entry]) => [
          id,
          {
            startJd: entry.t[0]!,
            stopJd: entry.t.at(-1)!,
            chunks: [{ startJd: entry.t[0]!, stopJd: entry.t.at(-1)!, count: entry.count }],
          },
        ]),
      ),
    },
    paths: {},
    surfaces: {},
  };
  return new EphemerisStore({
    manifest,
    bodies,
    vectors,
    // As fetch:data publishes them: every comet's, the hyperbola's too.
    elements: new Map([
      ['1p-halley', elements('1p-halley', 0.967)],
      ['2i-borisov', elements('2i-borisov', 3.356)],
    ]),
    loadChunk: async (id) => chunked[id]!,
    loadPath: null,
  });
}

describe('placing them', () => {
  it('is exact inside their tables, as any body on JPL vectors is', async () => {
    const s = store();
    const jd = START + 150;
    await s.whenLoadedAt(jd);
    for (const id of ['1p-halley', '2i-borisov']) {
      expect(s.localState(id, jd)?.approximate, id).toBe(false);
    }
    expect(s.isExactAt(jd)).toBe(true);
  });

  it('carries a closed orbit on beyond the table, flagged approximate', () => {
    const s = store();
    const jd = START + 1000;
    expect(s.elementsFor('1p-halley')).not.toBeNull();
    const state = s.localState('1p-halley', jd)!;
    expect(state.approximate).toBe(true);
    expect(state.position.x).toBeCloseTo(propagate(s.elementsFor('1p-halley')!, jd).position.x, 3);
    expect(s.isExactAt(jd, ['1p-halley'])).toBe(false);
  });

  it('does not propagate or draw an open one: absent outside its table, like a craft', () => {
    const s = store();
    expect(s.elementsFor('2i-borisov')).toBeNull();
    expect(s.localState('2i-borisov', START + 1000)).toBeNull();
    // Absent is not approximate.
    expect(s.isExactAt(START + 1000, ['2i-borisov'])).toBe(true);
  });
});

describe('the eccentricity of the orbit it is on now', () => {
  it('is the conic through its state', () => {
    // At perihelion q with speed sqrt(mu (1 + e) / q): exactly e, either side of 1.
    const q = 1.36 * AU;
    for (const e of [0, 0.6409, 0.967, 1.0001, 6.1414]) {
      const v = Math.sqrt((MU * (1 + e)) / q);
      const state = { position: { x: q, y: 0, z: 0 }, velocity: { x: 0, y: v, z: 0 } };
      expect(osculatingEccentricity(state, MU), String(e)).toBeCloseTo(e, 9);
    }
  });

  it('agrees with the elements of a propagated ellipse anywhere along it', () => {
    const halley = elements('x', 0.967);
    for (const jd of [START, START + 3000, START + 20000]) {
      expect(osculatingEccentricity(propagate(halley, jd), MU)).toBeCloseTo(0.967, 9);
    }
  });
});

// Against the generated data: a comet drawn as a body is not also in the cloud.
const DATA = join(import.meta.dirname, '../../public/data');
const published = await (async () => {
  try {
    const bodies = JSON.parse(await readFile(join(DATA, 'bodies.json'), 'utf8')) as BodyDefinition[];
    const comets = JSON.parse(await readFile(join(DATA, 'belt', 'comets.json'), 'utf8')) as CometInfo;
    return { bodies, comets };
  } catch {
    return null;
  }
})();

withData(published !== null)('the published comets', () => {
  const { bodies, comets } = published!;
  const famous = bodies.filter((body) => body.kind === 'comet');

  it('leave out of the cloud every comet published as a body', () => {
    // Data from before the famous comets has none of them, and leaves nothing out.
    expect(comets.excluded ?? []).toHaveLength(famous.length);
    for (const body of famous) {
      // SBDB's full name, which the body takes -- the interstellar two are named for both
      // their designations, and their C/ one is SBDB's.
      const sbdbName = body.name.replace(/^\dI\/\w+ \((C\/[^)]+)\)$/, '$1');
      expect(
        comets.names.filter((name) => name === body.name || name.startsWith(`${sbdbName} (`)),
        body.name,
      ).toEqual([]);
    }
  });
});
