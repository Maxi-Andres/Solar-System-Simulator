import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STAR3D_FLAGS } from '../types.ts';
import { build3d } from './build3d.ts';
import { buildSky } from './buildStarCatalog.ts';
import { parsePulkovo } from './pulkovo.ts';
import { parseBrightGaiaCsv, parseGcnsCsv, parseHipparcos2Csv } from './sources3d.ts';
import { parseHipparcosCsv } from './vizier.ts';

/**
 * The Pulkovo radial velocities against real rows: __fixtures__/pulkovo.dat is a verbatim
 * excerpt of CDS III/252 table8.dat (read 2026-10-29 from the CfA mirror), the lines of the
 * stars the other fixtures hold.
 */

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');
const rows = parsePulkovo(fixture('pulkovo.dat'));

describe('the Pulkovo compilation', () => {
  it('reads HIP, radial velocity and its error by the ReadMe byte positions', () => {
    const tauCeti = rows.find((row) => row.hip === 8102)!;
    expect(tauCeti.rvKmS).toBe(-16.8);
    expect(tauCeti.rvErrorKmS).toBe(0.1);
    // Barnard's Star has no HD number: the blank field must not shift the rest.
    expect(rows.find((row) => row.hip === 87937)!.rvKmS).toBe(-110.6);
    expect(rows.find((row) => row.hip === 32349)!.rvKmS).toBe(-5.5);
    expect(rows).toHaveLength(8);
  });
});

describe('radial velocities in the 3D build', () => {
  const sky = buildSky({ hipparcos: parseHipparcosCsv(fixture('hipparcos.csv')), tycho2: [], queriedAt: 'x' });
  const input = {
    sky,
    gcns: parseGcnsCsv(fixture('gcns.csv')),
    hipparcos2: parseHipparcos2Csv(fixture('hipparcos2.csv')),
    brightGaia: parseBrightGaiaCsv(fixture('bright-gaia.csv')),
    sources: [],
    queriedAt: 'test',
  };
  const without = build3d(input);
  const withPulkovo = build3d({ ...input, literatureRv: new Map(rows.map((row) => [row.hip, row.rvKmS])) });
  const index = (build: typeof without, hip: number): number => {
    for (let k = 0; k < build.table.count; k += 1) {
      if (build.table.hip[k] === hip) {
        return k;
      }
    }
    throw new Error(`HIP ${hip} not built`);
  };
  /** The velocity along the line of sight, km/s: the table's velocity, on its position's direction. */
  const radial = (build: typeof without, k: number): number => {
    const { x, y, z, vx, vy, vz } = build.table;
    const r = Math.hypot(x[k]!, y[k]!, z[k]!);
    return (x[k]! * vx[k]! + y[k]! * vy[k]! + z[k]! * vz[k]!) / r;
  };

  it('moves Tau Ceti in three dimensions, at the compilation’s -16.8 km/s, flagged as its', () => {
    const before = index(without, 8102);
    expect(without.table.flags[before]! & STAR3D_FLAGS.RADIAL_VELOCITY).toBe(0);
    const k = index(withPulkovo, 8102);
    const flags = withPulkovo.table.flags[k]!;
    expect(flags & STAR3D_FLAGS.RADIAL_VELOCITY).not.toBe(0);
    expect(flags & STAR3D_FLAGS.LITERATURE_RADIAL_VELOCITY).not.toBe(0);
    expect(radial(withPulkovo, k)).toBeCloseTo(-16.8, 2);
  });

  it("keeps Gaia's own where it has one: Barnard's Star", () => {
    const k = index(withPulkovo, 87937);
    const flags = withPulkovo.table.flags[k]!;
    expect(flags & STAR3D_FLAGS.LITERATURE_RADIAL_VELOCITY).toBe(0);
    expect(radial(withPulkovo, k)).toBeCloseTo(radial(without, index(without, 87937)), 9);
  });

  it('counts the stars it gave one to', () => {
    expect(without.info.counts.literatureRadialVelocity).toBe(0);
    expect(withPulkovo.info.counts.literatureRadialVelocity).toBeGreaterThanOrEqual(6);
    expect(withPulkovo.info.counts.radialVelocity - without.info.counts.radialVelocity).toBe(
      withPulkovo.info.counts.literatureRadialVelocity,
    );
  });
});
