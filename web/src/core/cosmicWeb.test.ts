import { COSMIC_WEB_FILAMENT_CATALOGUES, COSMIC_WEB_GALAXY_BYTES, type CosmicWebInfo } from '@sss/tools/types';
import { describe, expect, it, vi } from 'vitest';

import {
  absVOf,
  bvOf,
  cosmicWebSource,
  filamentSegments,
  filamentWeight,
  FILAMENT_WEIGHT_LEAST,
  galaxyChunkBudget,
  parseCosmicWebInfo,
  parseFilaments,
  parseGalaxyChunk,
  surveyOf,
} from './cosmicWeb.ts';
import { cosmicWebFloor, floorReaches, FLOOR_FULL_AT, FLOOR_LEAST, REACH_LEAST_PC } from './cosmicWebFloor.ts';
import { FLOOR_FULL_AT as LANIAKEA_FULL_AT, FLOOR_LEAST as LANIAKEA_LEAST, FLOOR_REACH_PC } from '../scene/Laniakea.tsx';

/** A cosmic-web.json as the data writes it, its numbers small. */
function info(): CosmicWebInfo {
  return {
    positionUnitPc: 100_000,
    galaxies: { bytesPerGalaxy: 9, chunks: [{ file: 'galaxies-0.bin', bytes: 18, count: 2, absVBrightest: -24, absVFaintest: -20 }] },
    filaments: {
      file: 'filaments.bin',
      bytes: 0,
      lines: 2,
      vertices: 6,
      catalogues: [
        { key: 'tempel2014', vertexValue: { min: 0, step: 1 / 254 } },
        { key: 'malavasi2020', vertexValue: { min: -7.8, step: 0.05 } },
      ],
    },
    footprints: { grid: { decBands: 90, raCells: 180, cellDeg2: 2.5 }, surveys: [] },
  } as unknown as CosmicWebInfo;
}

/** filaments.bin for lines of the given vertices (x only, 0.1 Mpc), catalogue and value byte. */
function filamentsBin(lines: { xs: number[]; catalogue: number; code: number }[]): ArrayBuffer {
  const L = lines.length;
  const V = lines.reduce((sum, line) => sum + line.xs.length, 0);
  const buffer = new ArrayBuffer(4 * (L + 1) + 6 * V + 4 * L + V + L);
  const starts = new Uint32Array(buffer, 0, L + 1);
  const positions = new Int16Array(buffer, 4 * (L + 1), 3 * V);
  const bytes = new Uint8Array(buffer);
  let v = 0;
  lines.forEach((line, l) => {
    starts[l] = v;
    for (const x of line.xs) {
      positions[v * 3] = x;
      bytes[4 * (L + 1) + 6 * V + 4 * L + v] = line.code;
      v += 1;
    }
    bytes[4 * (L + 1) + 6 * V + 4 * L + V + l] = line.catalogue;
  });
  starts[L] = v;
  return buffer;
}

const TWO_LINES = [
  { xs: [0, 10, 20], catalogue: 0, code: 254 },
  { xs: [5000, 5100, 5300], catalogue: 1, code: 90 },
];

describe('the cosmic web’s files', () => {
  it('reads cosmic-web.json only in the layout this app was written for', () => {
    expect(parseCosmicWebInfo(info()).galaxies.chunks).toHaveLength(1);
    expect(() => parseCosmicWebInfo({ ...info(), positionUnitPc: 1000 })).toThrow();
    const wrong = info();
    expect(() =>
      parseCosmicWebInfo({ ...wrong, galaxies: { ...wrong.galaxies, chunks: [{ file: '../x.bin', bytes: 18, count: 2 }] } }),
    ).toThrow();
  });

  it('reads filaments.bin column by column', () => {
    const buffer = filamentsBin(TWO_LINES);
    const filaments = parseFilaments(buffer, info().filaments);
    expect([...filaments.starts]).toEqual([0, 3, 6]);
    expect(filaments.positions[3 * 4]).toBe(5100);
    expect([...filaments.catalogues]).toEqual([0, 1]);
    expect(filaments.values[0]).toBe(254);
    expect(() => parseFilaments(buffer.slice(1), info().filaments)).toThrow();
  });

  it('reads a chunk of galaxies as its columns', () => {
    const buffer = new ArrayBuffer(2 * COSMIC_WEB_GALAXY_BYTES);
    new Int16Array(buffer, 0, 6).set([1, 2, 3, -4, -5, -6]);
    new Uint8Array(buffer).set([40, 255, 75, 255, 1, 2 | 4], 12);
    const chunk = parseGalaxyChunk(buffer, 2);
    expect([...chunk.positions]).toEqual([1, 2, 3, -4, -5, -6]);
    expect(absVOf(chunk.absV[0]!)).toBeCloseTo(-24);
    expect(absVOf(chunk.absV[1]!)).toBeNaN();
    expect(bvOf(chunk.bv[0]!)).toBeCloseTo(0.5);
    expect(surveyOf(chunk.flags[0]!)).toBe(0);
    expect(surveyOf(chunk.flags[1]!)).toBe(1);
    expect(() => parseGalaxyChunk(buffer, 3)).toThrow();
  });
});

describe('the filaments drawn', () => {
  it('weighs a vertex by its catalogue’s value, from the least to whole', () => {
    expect(filamentWeight(COSMIC_WEB_FILAMENT_CATALOGUES.tempel2014, 0.05)).toBeCloseTo(FILAMENT_WEIGHT_LEAST);
    expect(filamentWeight(COSMIC_WEB_FILAMENT_CATALOGUES.tempel2014, 0.9)).toBe(1);
    expect(filamentWeight(COSMIC_WEB_FILAMENT_CATALOGUES.malavasi2020, -5)).toBeCloseTo(FILAMENT_WEIGHT_LEAST);
    expect(filamentWeight(COSMIC_WEB_FILAMENT_CATALOGUES.malavasi2020, -3.3)).toBeGreaterThan(FILAMENT_WEIGHT_LEAST);
  });

  it('draws Tempel et al.’s spines as they are and splines Malavasi et al.’s, the catalogue in each segment', () => {
    const segments = filamentSegments(parseFilaments(filamentsBin(TWO_LINES), info().filaments), info().filaments);
    // Two of Tempel's; two steps of Malavasi's at four segments each.
    expect(segments.count).toBe(2 + 8);
    expect([...segments.a.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
    expect(segments.b[3]! >> 8).toBe(0);
    expect(segments.b[2 * 4 + 3]! >> 8).toBe(1);
    // The spline passes through the vertices.
    expect(segments.a[2 * 4]).toBe(5000);
    expect(segments.b[5 * 4]).toBe(5100);
    expect(segments.lengthPc[0]).toBeCloseTo(2e6);
    expect(Math.abs(segments.lengthPc[1]! - 30e6)).toBeLessThan(1e5);
  });
});

describe('the galaxies’ budget', () => {
  it('is every chunk unless the device says it is small', () => {
    expect(galaxyChunkBudget(7)).toBe(7);
    expect(galaxyChunkBudget(7, { memoryGb: 8 })).toBe(7);
    expect(galaxyChunkBudget(7, { memoryGb: 4 })).toBe(4);
    expect(galaxyChunkBudget(7, { memoryGb: 2 })).toBe(2);
    expect(galaxyChunkBudget(7, { coarsePointer: true })).toBe(2);
  });
});

describe('a site built without the cosmic web', () => {
  it('asks for nothing, and has nothing', async () => {
    const fetchers = { json: vi.fn(), binary: vi.fn() };
    const source = cosmicWebSource(fetchers, '/', false);
    await source.filaments.request();
    source.galaxies.request(7);
    await source.info.request();
    expect(fetchers.json).not.toHaveBeenCalled();
    expect(fetchers.binary).not.toHaveBeenCalled();
    expect(source.filaments.value).toBeNull();
    expect(source.galaxies.chunks).toHaveLength(0);
  });
});

describe('the faint dots by their neighbours', () => {
  it('use Laniakea’s rule: whole at its count, its least alone, no reach under its own', () => {
    expect(FLOOR_FULL_AT).toBe(LANIAKEA_FULL_AT);
    expect(FLOOR_LEAST).toBe(LANIAKEA_LEAST);
    expect(REACH_LEAST_PC).toBe(FLOOR_REACH_PC);
  });

  it('give a group’s galaxies their whole dot and one alone in a void its least', () => {
    // A survey's galaxies 300 Mpc out on a grid 40 Mpc apart, past any reach, and a group of twelve among them.
    const positions: number[] = [];
    const surveys: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      for (let j = 0; j < 12; j += 1) {
        for (let k = 0; k < 12; k += 1) {
          positions.push(3000 + i * 400, j * 400, k * 400);
          surveys.push(1);
        }
      }
    }
    const group = positions.length / 3;
    for (let m = 0; m < 12; m += 1) {
      positions.push(3000 + 2200 + (m % 3) * 3, 2200 + Math.floor(m / 3) * 3, 2200);
      surveys.push(1);
    }
    const { weights, halfCountPc } = cosmicWebFloor({
      positions: Int16Array.from(positions),
      surveys: Uint8Array.from(surveys),
      skyShare: [0.2, 0.2],
    });
    expect(weights[group]).toBe(255);
    expect(weights[0]).toBe(Math.round(255 * FLOOR_LEAST));
    expect(halfCountPc).toBeGreaterThan(300e6);
  });

  it('count as a search of every pair would', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = 3000;
    const positions = new Int16Array(n * 3);
    const surveys = new Uint8Array(n);
    for (let g = 0; g < n; g += 1) {
      positions[g * 3] = Math.round(1000 + random() * 3000);
      positions[g * 3 + 1] = Math.round(random() * 3000);
      positions[g * 3 + 2] = Math.round(random() * 3000);
      surveys[g] = random() < 0.3 ? 0 : 1;
    }
    const skyShare = [0.2, 0.3];
    const { weights } = cosmicWebFloor({ positions, surveys, skyShare });
    const distance = new Float32Array(n);
    for (let g = 0; g < n; g += 1) {
      distance[g] = Math.hypot(positions[g * 3]! * 1e5, positions[g * 3 + 1]! * 1e5, positions[g * 3 + 2]! * 1e5);
    }
    const reach = floorReaches(distance, surveys, skyShare);
    for (let g = 0; g < n; g += 37) {
      let found = 0;
      for (let o = 0; o < n; o += 1) {
        if (o === g || surveys[o] !== surveys[g]) continue;
        const dx = (positions[o * 3]! - positions[g * 3]!) * 1e5;
        const dy = (positions[o * 3 + 1]! - positions[g * 3 + 1]!) * 1e5;
        const dz = (positions[o * 3 + 2]! - positions[g * 3 + 2]!) * 1e5;
        if (dx * dx + dy * dy + dz * dz < reach[g]! * reach[g]!) found += 1;
      }
      expect(weights[g], `galaxy ${g}`).toBe(Math.round(255 * (FLOOR_LEAST + (1 - FLOOR_LEAST) * Math.min(1, found / FLOOR_FULL_AT))));
    }
  });
});
