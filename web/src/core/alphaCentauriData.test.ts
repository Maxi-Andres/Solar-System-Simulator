import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { componentOffsetArcsec, isProximaRecord, matchComponent, proximaOrbit } from './alphaCentauri.ts';
import { describeWithData as withData } from './describeWithData.ts';
import { STAR3D, STAR3D_FLOATS, starState } from './stars3d.ts';
import { J2000_JD } from './time.ts';

/**
 * Alpha Centauri against the shipped 3D stars: the records the orbit takes over, and
 * Proxima's orbit from Proxima's own record.
 */

const DATA = join(import.meta.dirname, '../../public/data/stars3d');
const AU_KM = 149_597_870.7;

async function tryLoad(): Promise<Float32Array[] | null> {
  try {
    return await Promise.all(
      ['tier-0.bin', 'tier-1.bin', 'tier-2.bin'].map(async (file) => {
        const bytes = await readFile(join(DATA, file));
        return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      }),
    );
  } catch {
    return null;
  }
}

const loaded = await tryLoad();
const describeWithData = withData(loaded !== null);

function position(records: Float32Array, i: number) {
  const base = i * STAR3D_FLOATS;
  return { x: records[base + STAR3D.x]!, y: records[base + STAR3D.y]!, z: records[base + STAR3D.z]! };
}

describeWithData('Alpha Centauri in the 3D stars', () => {
  // A is in the first tier (V -0.01), B in the second (V 1.33), Proxima in the third.
  const tiers = loaded!;

  it('finds exactly one record for A and one for B, and they are the bright pair', () => {
    const found: string[] = [];
    for (const records of tiers) {
      for (let i = 0; i < records.length / STAR3D_FLOATS; i += 1) {
        const component = matchComponent(position(records, i));
        if (component === null) continue;
        found.push(component);
        // Absolute magnitudes 4.4 (A) and 5.7 (B).
        expect(records[i * STAR3D_FLOATS + STAR3D.Mv]!).toBeLessThan(6.2);
      }
    }
    expect(found.sort()).toEqual(['A', 'B']);
  });

  it('has each where the orbit has it on the sky at J2000, to a second of arc', () => {
    for (const records of tiers) {
      for (let i = 0; i < records.length / STAR3D_FLOATS; i += 1) {
        const component = matchComponent(position(records, i));
        if (component === null) continue;
        // Hipparcos 1991 positions run on to 2000 by proper motions that include the
        // orbit's own: under an arcsecond, against 10" between the two.
        expect(componentOffsetArcsec(component, position(records, i))).toBeLessThan(1);
      }
    }
  });

  it("gives Proxima Kervella et al. 2017's orbit, through where Gaia puts it", () => {
    // Proxima: the one record 10,000 to 16,000 AU from the barycentre.
    const found: { records: Float32Array; i: number }[] = [];
    for (const records of tiers) {
      for (let i = 0; i < records.length / STAR3D_FLOATS; i += 1) {
        if (isProximaRecord(position(records, i))) found.push({ records, i });
      }
    }
    expect(found).toHaveLength(1);
    const { records, i } = found[0]!;
    // M5.5V at 1.30 pc: absolute magnitude 15.5.
    expect(records[i * STAR3D_FLOATS + STAR3D.Mv]!).toBeGreaterThan(15);
    // Gaia's position, Kervella et al.'s corrected relative velocity: see proximaOrbit.
    const orbit = proximaOrbit(starState(records, i, J2000_JD).position, J2000_JD)!;
    const a = orbit.semiMajorAxisKm / AU_KM / 1000;
    // Table 3: a 8.7 (+0.7, -0.4) kau, e 0.50 (+0.08, -0.09).
    expect(a).toBeGreaterThan(7.5);
    expect(a).toBeLessThan(10);
    expect(orbit.eccentricity).toBeGreaterThan(0.38);
    expect(orbit.eccentricity).toBeLessThan(0.62);
  });
});
