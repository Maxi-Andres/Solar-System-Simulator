import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { COMET_CLASSES, COMET_RECORD_FLOATS, type BeltInfo, type CometInfo, type OsculatingElements } from '@sss/tools/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BeltFetchers } from './belt.ts';
import {
  COMET,
  COMET_FLOATS,
  cometMagnitude,
  cometPosition,
  CometSource,
  checkCometRecords,
  FALLBACK_K1,
  loadComets,
  medianM1,
  parseCometInfo,
  type Comets,
} from './comets.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { propagate } from './kepler.ts';
import { SECONDS_PER_DAY } from './time.ts';
import { COMET_FAINT_ALPHA, cometLook, writeComets } from '../scene/Comets.tsx';

const MU = 1.32712440041e11;
const AU = 149_597_870.7;
const DEG = Math.PI / 180;
const REFERENCE_JD = 2461332.5;

/** Halley-like, a parabola, and 3I/ATLAS-like: q (km), e, i, node, peri, tp, M1, K1, class. */
const ROWS = [
  [0.586 * AU, 0.967, 162.2 * DEG, 59.1 * DEG, 112.3 * DEG, -14000, 5.5, 8, 4],
  [0.9 * AU, 1, 40 * DEG, 10 * DEG, 20 * DEG, 30, Number.NaN, Number.NaN, 5],
  [1.36 * AU, 6.14, 175.1 * DEG, 322.2 * DEG, 128 * DEG, -100, 12, 4, 6],
] as const;

function encode(rows: readonly (readonly number[])[]): ArrayBuffer {
  const buffer = new ArrayBuffer(rows.length * COMET_FLOATS * 4);
  const view = new DataView(buffer);
  rows.flat().forEach((value, k) => view.setFloat32(k * 4, value, true));
  return buffer;
}

const INFO: CometInfo = {
  source: { name: 'JPL Small-Body Database (SBDB) Query API', url: '', queriedAt: '2026-10-19' },
  file: 'comets.bin',
  count: 3,
  bytes: 108,
  recordFloats: 9,
  referenceJd: REFERENCE_JD,
  elementEpochs: { minJd: REFERENCE_JD, maxJd: REFERENCE_JD },
  classes: [...COMET_CLASSES],
  classCounts: { HTC: 1, PAR: 1, HYP: 1 },
  names: ['1P/Halley', 'C/2000 X1', '3I/ATLAS'],
  dropped: { missingElements: 0, defunct: 0 },
};

const BELT = { recordFloats: 9, count: 0, file: 'elements.bin', referenceJd: REFERENCE_JD, magnitudeLimit: 15, comets: { file: 'comets.json', count: 3 } } as unknown as BeltInfo;

function memory(files: Record<string, unknown>): BeltFetchers & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    json: async (path) => {
      asked.push(path);
      return path in files ? files[path] : null;
    },
    binary: async (path) => {
      asked.push(path);
      return path in files ? (files[path] as ArrayBuffer) : null;
    },
  };
}

const FILES = {
  '/data/belt/belt.json': BELT,
  '/data/belt/comets.json': INFO,
  '/data/belt/comets.bin': encode(ROWS),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the comet records', () => {
  it('are as many floats as the generator writes', () => {
    expect(COMET_FLOATS).toBe(COMET_RECORD_FLOATS);
  });

  it('round-trip through the loader, belt.json first', async () => {
    const fetchers = memory(FILES);
    const comets = (await loadComets(fetchers))!;
    expect(fetchers.asked).toEqual(['/data/belt/belt.json', '/data/belt/comets.json', '/data/belt/comets.bin']);
    expect(comets.info.names[2]).toBe('3I/ATLAS');
    expect(comets.records[2 * COMET_FLOATS + COMET.e]).toBe(Math.fround(6.14));
    expect(Number.isNaN(comets.records[COMET_FLOATS + COMET.M1]!)).toBe(true);
  });

  it('are absent, quietly, from data written before the comets', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { comets: _comets, ...old } = BELT as unknown as Record<string, unknown>;
    void _comets;
    expect(await loadComets(memory({ '/data/belt/belt.json': old }))).toBeNull();
    expect(await loadComets(memory({}))).toBeNull();
  });

  it('reject a comets.json that miscounts, and a record on no conic', () => {
    expect(() => parseCometInfo({ ...INFO, bytes: 100 })).toThrow(/bytes/);
    expect(() => parseCometInfo({ ...INFO, names: ['one'] })).toThrow(/name every comet/);
    expect(() => parseCometInfo({ ...INFO, recordFloats: 8 })).toThrow(/8 floats/);
    const bad = new Float32Array(encode(ROWS));
    bad[COMET.q] = 0;
    expect(() => checkCometRecords(bad)).toThrow(/not on a conic/);
  });
});

/** The loaded comets, synchronously, from the in-memory files. */
async function loaded(): Promise<Comets> {
  return (await loadComets(memory(FILES)))!;
}

describe('cometPosition', () => {
  it('turns its conic into the ecliptic exactly as kepler.ts turns an ellipse', async () => {
    // Halley, as osculating elements kepler.ts takes: the same orbit, the same instant.
    const comets = await loaded();
    const r = comets.records;
    const q = r[COMET.q]!;
    const e = r[COMET.e]!;
    const a = q / (1 - e);
    const nRadPerSec = Math.sqrt(MU / a ** 3);
    const tp = REFERENCE_JD + r[COMET.tp]!;
    const elements: OsculatingElements = {
      id: 'halley',
      center: '500@10',
      epochJd: tp,
      eccentricity: e,
      periapsisKm: q,
      inclinationDeg: r[COMET.i]! / DEG,
      ascendingNodeDeg: r[COMET.node]! / DEG,
      argPeriapsisDeg: r[COMET.peri]! / DEG,
      periapsisTimeJd: tp,
      meanMotionDegPerSec: nRadPerSec / DEG,
      meanAnomalyDeg: 0,
      trueAnomalyDeg: 0,
      semiMajorAxisKm: a,
      apoapsisKm: a * (1 + e),
      periodSec: (2 * Math.PI) / nRadPerSec,
    };
    const out = new Float64Array(9);
    for (const jd of [REFERENCE_JD, REFERENCE_JD + 3650, tp + 1]) {
      cometPosition(comets, 0, jd, MU, out);
      const want = propagate(elements, jd).position;
      const miss = Math.hypot(out[0]! - want.x, out[1]! - want.y, out[2]! - want.z);
      expect(miss / Math.hypot(want.x, want.y, want.z)).toBeLessThan(1e-9);
    }
  });

  it('puts the parabola at q on the day of perihelion, and the hyperbola on its way out', async () => {
    const comets = await loaded();
    const out = new Float64Array(9);
    const atPerihelion = cometPosition(comets, 1, REFERENCE_JD + 30, MU, out);
    expect(atPerihelion).toBeCloseTo(0.9, 6);
    // 3I/ATLAS a hundred days after perihelion: well out, and further out ten years on.
    const soon = cometPosition(comets, 2, REFERENCE_JD, MU, out);
    const later = cometPosition(comets, 2, REFERENCE_JD + 3652.5, MU, out);
    expect(soon).toBeGreaterThan(1.36);
    expect(later).toBeGreaterThan(soon * 5);
    expect(Number.isFinite(later)).toBe(true);
  });
});

describe('how bright a comet is drawn', () => {
  it('follows SBDB’s total magnitude at its distance from the Sun', () => {
    expect(cometMagnitude(5.5, 8, 1, 12)).toBeCloseTo(5.5, 12);
    expect(cometMagnitude(5.5, 8, 10, 12)).toBeCloseTo(13.5, 12);
  });

  it('stands a typical comet in for one with no magnitude parameters', () => {
    expect(cometMagnitude(Number.NaN, Number.NaN, 10, 11)).toBeCloseTo(11 + FALLBACK_K1, 12);
    const records = new Float32Array(encode(ROWS));
    // Two of the three have an M1: 5.5 and 12. The median of an even count takes the upper.
    expect(medianM1(records)).toBe(12);
  });

  it('never drops a comet off the map: the faintest is the floor, not nothing', () => {
    expect(cometLook(40).alpha).toBe(COMET_FAINT_ALPHA);
    expect(cometLook(0).alpha).toBe(1);
    expect(cometLook(13).sizePx).toBeCloseTo(1.5, 12);
  });

  it('writes positions relative to the focus, and a look for every comet', async () => {
    const comets = await loaded();
    const sun = { x: 1e8, y: -2e8, z: 3e6 };
    const helio = new Float64Array(9);
    const positions = new Float32Array(9);
    const looks = new Float32Array(6);
    writeComets(comets, REFERENCE_JD, sun, MU, helio, positions, looks);
    for (let k = 0; k < 3; k += 1) {
      expect(positions[k * 3]).toBeCloseTo((helio[k * 3]! + sun.x) / 1000, 0);
      expect(looks[k * 2 + 1]).toBeGreaterThanOrEqual(COMET_FAINT_ALPHA);
    }
  });
});

describe('CometSource', () => {
  it('loads once, and asks for a frame when it has', async () => {
    const settled = vi.fn();
    const load = vi.fn(loaded);
    const source = new CometSource(load, settled);
    await Promise.all([source.request(), source.request()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(source.comets?.info.count).toBe(3);
    expect(settled).toHaveBeenCalledTimes(1);
  });
});

// The generated comets, when there are any.
const DATA_ROOT = join(import.meta.dirname, '../../public');
const disk: BeltFetchers = {
  json: async (path) => {
    try {
      return JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;
    } catch {
      return null;
    }
  },
  binary: async (path) => {
    try {
      const bytes = await readFile(join(DATA_ROOT, path));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } catch {
      return null;
    }
  },
};
vi.spyOn(console, 'info').mockImplementation(() => {});
const generated = await loadComets(disk).catch(() => null);
vi.restoreAllMocks();
const describeWithData = withData(generated !== null);

describeWithData('the generated comets', () => {
  const comets = generated!;

  it('put every comet somewhere finite, a century either way', () => {
    const out = new Float64Array(comets.info.count * 3);
    for (const jd of [comets.info.referenceJd - 36_525, comets.info.referenceJd, comets.info.referenceJd + 36_525]) {
      for (let k = 0; k < comets.info.count; k += 1) {
        const r = cometPosition(comets, k, jd, MU, out);
        if (!Number.isFinite(r) || !(r > 0)) {
          throw new Error(`${comets.info.names[k]} at JD ${jd}: r = ${r}`);
        }
      }
    }
  });

  it('puts Halley where its orbit says, near aphelion now', () => {
    const k = comets.info.names.findIndex((name) => name.startsWith('1P/'));
    expect(k).toBeGreaterThanOrEqual(0);
    const out = new Float64Array(comets.info.count * 3);
    // Halley reached aphelion, 35 AU, in December 2023.
    const r = cometPosition(comets, k, 2460300.5, MU, out);
    expect(r).toBeGreaterThan(34);
    expect(r).toBeLessThan(36);
    expect(SECONDS_PER_DAY).toBe(86_400);
  });
});

describeWithData('a comet made a body', () => {
  it('is placed by its conic, approximate, with an orbit only when it is closed', async () => {
    const { loadEphemerisStore } = await import('./ephemerisStore.ts');
    const { addCometBody, cometState } = await import('./cometBodies.ts');
    const s = await loadEphemerisStore(
      async (path) => JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown,
      '/',
    );
    const comets = generated!;
    const mu = s.body('sun').gmBodyOnlyKm3S2;
    const open = comets.info.names.findIndex((_, k) => comets.records[k * COMET_FLOATS + COMET.e]! > 1);
    const closed = comets.info.names.findIndex((name) => name.startsWith('1P/'));
    const openId = addCometBody(s, comets, open, 'sun');
    const closedId = addCometBody(s, comets, closed, openId);
    const jd = comets.info.referenceJd + 12;
    for (const [id, k] of [[openId, open], [closedId, closed]] as const) {
      const state = s.stateRelativeTo(id, 'sun', jd)!;
      const want = cometState(comets, k, jd, mu).position;
      expect(Math.hypot(state.position.x - want.x, state.position.y - want.y, state.position.z - want.z)).toBeLessThan(1e-3);
      expect(state.approximate).toBe(true);
      expect(s.isExactAt(jd, [id])).toBe(false);
      expect(s.body(id).kind).toBe('comet');
    }
    expect(s.body(openId).drawOrbit).toBe(false);
    expect(s.elementsFor(openId)).toBeNull();
    expect(s.body(closedId).drawOrbit).toBe(true);
    expect(s.elementsFor(closedId)!.eccentricity).toBeCloseTo(0.967, 2);
  });
});
