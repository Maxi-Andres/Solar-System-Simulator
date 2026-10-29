import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Stars3dNames } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { describeWithData as withData } from './describeWithData.ts';
import { skyOffsetKm } from './exoplanets.ts';
import {
  exoPlanetOf,
  PLANETARY_SYSTEMS,
  systemEntries,
  systemExtentKm,
  systemPlanetOf,
} from './planetarySystems.ts';

const AU_KM = 149_597_870.7;
const NAMES = join(import.meta.dirname, '../../public/data/stars3d/names.json');

async function tryLoad(): Promise<Stars3dNames | null> {
  try {
    return JSON.parse(await readFile(NAMES, 'utf8')) as Stars3dNames;
  } catch {
    return null;
  }
}

const names = await tryLoad();
const describeWithData = withData(names !== null);
const system = (key: string) => PLANETARY_SYSTEMS.find((s) => s.key === key)!;

describe('the planetary systems', () => {
  it("agree with Kepler's third law: each distance is its period's about its star's mass", () => {
    // a^3 = M P^2 in AU, solar masses and years -- to the rounding of the published a.
    for (const s of PLANETARY_SYSTEMS) {
      for (const p of s.planets) {
        const years = p.periodDays / 365.25;
        const a = Math.cbrt(s.hostMassSun * years * years);
        expect(Math.abs(a / p.semiMajorAxisAu - 1), p.name).toBeLessThan(0.012);
      }
    }
  });

  it('gives every planet a unique id, found back by it', () => {
    const ids = PLANETARY_SYSTEMS.flatMap((s) => s.planets.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(systemPlanetOf(id)?.planet.id).toBe(id);
      expect(exoPlanetOf(id)?.id).toBe(id);
    }
    expect(exoPlanetOf('proxima-b')?.id).toBe('proxima-b');
    expect(exoPlanetOf('mars')).toBeNull();
  });

  it("names Tau Ceti's four as the disputed or candidates they are, phase unknown", () => {
    for (const p of system('tau-ceti').planets) {
      expect(p.status).not.toBe('confirmed');
      expect(p.name).toContain(`(${p.status})`);
      expect(p.phase.kind).toBe('unknown');
    }
  });

  it("reaches as far as the outermost planet's apastron", () => {
    expect(systemExtentKm(system('tau-ceti')) / AU_KM).toBeCloseTo(1.334 * 1.16, 6);
    expect(systemExtentKm(system('epsilon-eridani')) / AU_KM).toBeCloseTo(3.53, 6);
  });

  it('puts Epsilon Eridani b where Thompson et al. 2025 predict it on 2025-01-01: SSW, near its widest', () => {
    const b = system('epsilon-eridani').planets[0]!;
    const o = skyOffsetKm(b, 2460676.5);
    const pa = ((Math.atan2(o.east, o.north) * 180) / Math.PI + 360) % 360;
    expect(pa).toBeGreaterThan(170);
    expect(pa).toBeLessThan(215);
    // Its widest on the sky is the full radius, along the node line.
    expect(Math.hypot(o.east, o.north) / (b.semiMajorAxisAu * AU_KM)).toBeGreaterThan(0.95);
  });
});

describeWithData('the planetary systems in the star names', () => {
  it("finds each system's star", () => {
    const entries = systemEntries(names!);
    for (const s of PLANETARY_SYSTEMS) {
      expect(entries.has(s.key), s.name).toBe(true);
    }
  });
});
