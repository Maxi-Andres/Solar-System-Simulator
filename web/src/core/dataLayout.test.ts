import type { BodyDefinition, ChunkInfo, Manifest, OsculatingElements, PathTable, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { rebaseVisibleFrame } from '../scene/satellites.ts';
import { EphemerisStore, loadEphemerisData, loadEphemerisStore, startupBodies, type Fetcher } from './ephemerisStore.ts';
import { joinPathPieces, pieceIndexAt } from './pathPieces.ts';

/**
 * The data as the generator lays it out since 2026-11-21 -- every table in chunks, the
 * planets' too, each craft's path in pieces, a craft's reach about its planet in its
 * chunks -- read through the store, from a directory in memory.
 */

const START = 2_461_000.5;
const DAYS = 30;

function body(id: string, parent: string | null, overrides: Partial<BodyDefinition> = {}): BodyDefinition {
  return {
    id,
    name: id,
    horizonsId: id,
    stepDays: 1,
    vectorWindow: 'full',
    center: '500@0',
    elementsCenter: '500@10',
    parent,
    kind: parent === null ? (id === 'sun' ? 'star' : 'planet') : 'moon',
    radiusEquatorialKm: 1000,
    radiusPolarKm: 1000,
    triaxialRadiiKm: null,
    gmKm3S2: 1e5,
    gmBodyOnlyKm3S2: 1e5,
    rotationPeriodHours: 24,
    axialTiltDeg: null,
    rotation: null,
    color: '#ffffff',
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
    ...overrides,
  } as BodyDefinition;
}

/** A body standing still at `at`, a sample a day from `from` for `days` days. */
function still(id: string, at: readonly [number, number, number], from = START, days = DAYS): VectorTable {
  const t = Array.from({ length: days + 1 }, (_, k) => from + k);
  const constant = (value: number) => t.map(() => value);
  return {
    id,
    horizonsId: id,
    center: '500@0',
    count: t.length,
    t,
    x: constant(at[0]),
    y: constant(at[1]),
    z: constant(at[2]),
    vx: constant(0),
    vy: constant(0),
    vz: constant(0),
  };
}

/** `table` cut into pieces of `size` samples sharing their boundaries, as the generator does. */
function cut<T extends VectorTable>(table: T, size: number): T[] {
  const pieces: T[] = [];
  for (let from = 0; from < table.count - 1; from += size - 1) {
    const to = Math.min(from + size - 1, table.count - 1);
    const slice = (column: readonly number[]) => column.slice(from, to + 1);
    const piece = {
      ...table,
      count: to - from + 1,
      t: slice(table.t),
      x: slice(table.x),
      y: slice(table.y),
      z: slice(table.z),
      vx: slice(table.vx),
      vy: slice(table.vy),
      vz: slice(table.vz),
    } as T;
    if ('toleranceKm' in table) {
      const path = table as unknown as PathTable;
      Object.assign(piece, {
        toleranceKm: path.toleranceKm.slice(from, to),
        gaps: path.gaps.filter((gap) => gap >= from && gap < to).map((gap) => gap - from),
      });
    }
    pieces.push(piece);
  }
  return pieces;
}

function infos(pieces: readonly VectorTable[], reach?: (piece: VectorTable) => number): ChunkInfo[] {
  return pieces.map((piece) => ({
    startJd: piece.t[0]!,
    stopJd: piece.t.at(-1)!,
    count: piece.count,
    ...(reach === undefined ? {} : { reachKm: reach(piece) }),
  }));
}

/**
 * A Sun and an Earth in chunks of 11 samples, a Moon about Earth, an orbiter about the Moon
 * whose chunks carry their reach, and a heliocentric probe with a path in pieces.
 */
function directory() {
  const sun = cut(still('sun', [0, 0, 0]), 11);
  const earth = cut(still('earth', [1.5e8, 0, 0]), 11);
  const moon = cut(still('moon', [384_400, 0, 0]), 11);
  const orbiter = cut(still('orbiter', [2000, 0, 0]), 11);
  const probe = cut(still('probe', [0, 2e8, 0]), 11);
  const pathTable: PathTable = {
    ...still('probe', [0, 2e8, 0]),
    toleranceKm: new Array<number>(DAYS).fill(5),
    gaps: [12],
  };
  const pathPieces = cut(pathTable, 8);
  const files: Record<string, unknown> = {
    '/data/manifest.json': {
      generatedAt: '2026-11-21T00:00:00Z',
      window: { startJd: START, stopJd: START + DAYS, startUtc: '', stopUtc: '' },
      bodies: ['sun', 'earth', 'moon', 'orbiter', 'probe'],
      tables: {
        sun: { startJd: START, stopJd: START + DAYS, chunks: infos(sun) },
        earth: { startJd: START, stopJd: START + DAYS, chunks: infos(earth) },
        moon: { startJd: START, stopJd: START + DAYS, chunks: infos(moon) },
        orbiter: { startJd: START, stopJd: START + DAYS, chunks: infos(orbiter, () => 2000) },
        probe: { startJd: START, stopJd: START + DAYS, chunks: infos(probe) },
      },
      paths: {
        probe: { count: pathTable.count, angularTolerance: 1e-4, floorKm: 1, seams: [], chunks: infos(pathPieces) },
      },
      surfaces: {},
      elementsFile: 'elements.json',
    } satisfies Partial<Manifest>,
    '/data/bodies.json': [
      body('sun', null),
      body('earth', null),
      body('moon', 'earth', { vectorWindow: 'short' }),
      body('orbiter', 'moon', { kind: 'spacecraft', vectorWindow: 'mission' }),
      body('probe', null, { kind: 'spacecraft', vectorWindow: 'mission' }),
    ],
    '/data/elements.json': {
      moon: { id: 'moon', eccentricity: 0.05, semiMajorAxisKm: 384_400 } as unknown as OsculatingElements,
    },
  };
  for (const [id, pieces] of Object.entries({ sun, earth, moon, orbiter, probe })) {
    pieces.forEach((piece, index) => {
      files[`/data/vectors/${id}/${index}.json`] = piece;
    });
  }
  pathPieces.forEach((piece, index) => {
    files[`/data/paths/probe/${index}.json`] = piece;
  });
  const asked: string[] = [];
  const fetcher: Fetcher = async (path) => {
    asked.push(path);
    await Promise.resolve();
    if (!(path in files)) throw new Error(`404 ${path}`);
    return structuredClone(files[path]);
  };
  return { fetcher, asked, pathTable, pathPieces };
}

/** Lets every pending fetch land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the planets in chunks', () => {
  it('waits at startup for the chunk of each at the clock, and nothing else', async () => {
    const { fetcher, asked } = directory();
    const jd = START + 15;
    const store = await loadEphemerisStore(fetcher, '/', () => jd);
    expect(startupBodies(store.bodies)).toEqual(['sun', 'earth']);
    // Chunk 1 holds days 10 to 20.
    expect(asked.filter((path) => path.includes('/vectors/'))).toEqual([
      '/data/vectors/sun/1.json',
      '/data/vectors/earth/1.json',
    ]);
    // So the first frame has them, as it had the whole tables.
    expect(store.localState('earth', jd)?.position.x).toBe(1.5e8);
    expect(store.stateRelativeTo('earth', 'sun', jd)?.approximate).toBe(false);
  });

  it('joins every chunk into the whole table when no instant is given', async () => {
    const { fetcher } = directory();
    const store = await loadEphemerisStore(fetcher, '/');
    for (const jd of [START, START + 10, START + 10.5, START + DAYS]) {
      expect(store.localState('sun', jd)?.position.x).toBe(0);
      expect(store.localState('earth', jd)?.position.x).toBe(1.5e8);
    }
    expect(store.loadedSamples('earth', START, START + DAYS)?.count).toBe(DAYS + 1);
  });

  it('still reads a planet shipped whole, as data from before 2026-11-21 has it', async () => {
    const { fetcher } = directory();
    const manifest = (await fetcher('/data/manifest.json')) as Manifest;
    const old: Fetcher = async (path) =>
      path.endsWith('manifest.json')
        ? { ...manifest, tables: { ...manifest.tables, earth: { startJd: START, stopJd: START + DAYS, chunks: null } } }
        : path.endsWith('vectors/earth.json')
          ? still('earth', [1.5e8, 0, 0])
          : fetcher(path);
    const store = await loadEphemerisStore(old, '/', () => START + 3);
    expect(store.localState('earth', START + 25)?.position.x).toBe(1.5e8);
  });
});

describe('a craft about a moon', () => {
  it('says how far out it gets before its chunk is fetched', async () => {
    const { fetcher, asked } = directory();
    const store = await loadEphemerisStore(fetcher, '/', () => START + 1);
    expect(store.reachKm('orbiter', START + 5)).toBe(2000);
    expect(store.reachKm('orbiter', START + DAYS + 1)).toBeNull();
    expect(store.reachKm('probe', START + 5)).toBeNull();
    expect(asked.some((path) => path.includes('orbiter'))).toBe(false);
  });

  it('is not resolved, nor fetched, while it would be hidden on its moon', async () => {
    const { fetcher, asked } = directory();
    const jd = START + 5;
    const store = await loadEphemerisStore(fetcher, '/', () => jd);
    const wanted = new Set(['sun', 'earth', 'moon', 'orbiter']);
    // Far out: the Moon's own orbit is a few pixels, the orbiter's 2,000 km nothing.
    const far = { x: 0, y: 0, z: 1e9 / 1000 };
    const frame = rebaseVisibleFrame(store, 'sun', jd, wanted, far, 1080, 27);
    expect(frame.bodies.has('orbiter')).toBe(false);
    await settle();
    expect(asked.some((path) => path.includes('orbiter'))).toBe(false);
  });

  it('is resolved, a level after its moon, once its orbit opens up', async () => {
    const { fetcher, asked } = directory();
    const jd = START + 5;
    const store = await loadEphemerisStore(fetcher, '/', () => jd);
    const wanted = new Set(['sun', 'earth', 'moon', 'orbiter']);
    // 20,000 km from the Moon, in the frame of Earth in focus: 2,000 km is ~280 px.
    const near = { x: (384_400 + 20_000) / 1000, y: 0, z: 0 };
    // The Moon first: its chunk is fetched, and until it lands the orbiter waits for it.
    rebaseVisibleFrame(store, 'earth', jd, wanted, near, 1080, 27);
    await settle();
    expect(asked).toContain('/data/vectors/moon/0.json');
    expect(asked.some((path) => path.includes('orbiter'))).toBe(false);
    rebaseVisibleFrame(store, 'earth', jd, wanted, near, 1080, 27);
    await settle();
    expect(asked).toContain('/data/vectors/orbiter/0.json');
    const frame = rebaseVisibleFrame(store, 'earth', jd, wanted, near, 1080, 27);
    expect(frame.bodies.get('moon')?.positionKm.x).toBe(384_400);
    expect(frame.bodies.get('orbiter')?.positionKm.x).toBe(386_400);
    expect(frame.approximate).toBe(false);
  });
});

describe('a path in pieces', () => {
  it('fetches only the pieces a stretch is in, and joins them to the path', async () => {
    const { fetcher, asked, pathTable } = directory();
    const store = new EphemerisStore(await loadEphemerisData(fetcher, '/'));
    expect(store.pathInPieces('probe')).toBe(true);
    // Pieces of 8 samples: days 0-7, 7-14, 14-21, 21-28, 28-30.
    expect(store.pathBetween('probe', START + 8, START + 12)).toBeNull();
    await settle();
    expect(asked.filter((path) => path.includes('/paths/'))).toEqual(['/data/paths/probe/1.json']);
    const path = store.pathBetween('probe', START + 8, START + 12)!;
    expect(path.t).toEqual(pathTable.t.slice(7, 15));
    // The gap at interval 12 is interval 5 of the second piece, and back at 5 here.
    expect(path.gaps).toEqual([5]);
    expect(store.pathBetween('probe', START + 9, START + 13)).toBe(path);
  });

  it('asks for the next piece once a stretch is three quarters into its last', async () => {
    const { fetcher, asked } = directory();
    const store = new EphemerisStore(await loadEphemerisData(fetcher, '/'));
    store.pathBetween('probe', START + 1, START + 6);
    await settle();
    expect(asked.filter((path) => path.includes('/paths/')).sort()).toEqual([
      '/data/paths/probe/0.json',
      '/data/paths/probe/1.json',
    ]);
  });

  it('keeps the last join while the start wobbles a piece back and forth', async () => {
    const { fetcher } = directory();
    const store = new EphemerisStore(await loadEphemerisData(fetcher, '/'));
    store.pathBetween('probe', START + 6, START + 16);
    await settle();
    const wide = store.pathBetween('probe', START + 6, START + 16)!;
    expect(wide.t[0]).toBe(START);
    // A start past the first piece, while the stretch ends where it did: the same join.
    expect(store.pathBetween('probe', START + 7.5, START + 16)).toBe(wide);
  });

  it('is nothing outside the path', async () => {
    const { fetcher } = directory();
    const store = new EphemerisStore(await loadEphemerisData(fetcher, '/'));
    expect(store.pathBetween('probe', START - 10, START - 5)).toBeNull();
    expect(store.pathBetween('earth', START, START + 1)).toBeNull();
  });
});

describe('joining path pieces', () => {
  it('gives back the path, gaps renumbered, from pieces cut at any size', () => {
    const { pathTable } = directory();
    for (const size of [2, 3, 8, 31]) {
      expect(joinPathPieces(cut(pathTable, size))).toEqual(pathTable);
    }
  });

  it('finds the piece covering an instant, the later one on a boundary', () => {
    const chunks = infos(directory().pathPieces);
    expect(pieceIndexAt(chunks, START)).toBe(0);
    expect(pieceIndexAt(chunks, START + 7)).toBe(1);
    expect(pieceIndexAt(chunks, START + 29)).toBe(4);
    expect(pieceIndexAt(chunks, START - 1)).toBe(0);
  });
});
