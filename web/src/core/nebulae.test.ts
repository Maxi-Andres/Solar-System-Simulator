import { describe, expect, it } from 'vitest';

import { deepSkyOf } from './deepSky.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import {
  ensureNebulae,
  NEBULAE,
  nebulaBodyId,
  nebulaFraming,
  nebulaFrame,
  nebulaOf,
  nebulaRadiusKm,
  nebulaReach,
  nebulaState,
  partAxes,
} from './nebulae.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const byKey = (key: string) => NEBULAE.find((nebula) => nebula.key === key)!;
const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;

describe('the nebulae', () => {
  it('are where their distances put them', () => {
    for (const nebula of NEBULAE) {
      const p = nebulaState(nebula).position;
      expect(Math.hypot(p.x, p.y, p.z) / PARSEC_KM).toBeCloseTo(nebula.distancePc, 3);
    }
  });

  it('take the planetary nebulae’s distances from their central stars’ Gaia parallaxes', () => {
    // The Helix's central star: 5.0124 mas, 5.0294 less the zero-point, so 198.8 pc; the Ring's:
    // 1.2696 mas, 1.2866, so 777.2 pc.
    expect(byKey('helix').distancePc).toBeCloseTo(198.8, 1);
    expect(byKey('ring').distancePc).toBeCloseTo(777.2, 1);
    expect(byKey('ring').distanceUpPc!).toBeGreaterThan(byKey('ring').distanceDownPc!);
  });

  it('are the size their catalogues give: Orion 18.2′ across at 403 pc, 2.1 pc', () => {
    expect((2 * nebulaRadiusKm(byKey('orion'))) / PARSEC_KM).toBeCloseTo(2.13, 1);
    // The Rosette's 104.5' at 1560 pc: 47 pc across.
    expect((2 * nebulaRadiusKm(byKey('rosette'))) / PARSEC_KM).toBeCloseTo(47.4, 0);
  });

  it('turn their parts as their papers say: the Helix’s disk and outer torus nearly perpendicular', () => {
    const helix = byKey('helix');
    const disk = partAxes(helix, helix.parts[0]!);
    const torus = partAxes(helix, helix.parts[2]!);
    const between = (Math.acos(Math.abs(dot(disk.e3, torus.e3))) * 180) / Math.PI;
    expect(between).toBeCloseTo(81, 0);
    // The disk's pole 28 degrees from the line of sight; its north-west side the nearer.
    const { east, north, away } = nebulaFrame(helix);
    expect((Math.acos(-dot(disk.e3, away)) * 180) / Math.PI).toBeCloseTo(28, 3);
    const northWest = { x: north.x - east.x, y: north.y - east.y, z: north.z - east.z };
    // A point on the disk toward the north-west: the disk's plane through it is nearer us.
    const inPlane = { x: northWest.x - dot(northWest, disk.e3) * disk.e3.x, y: northWest.y - dot(northWest, disk.e3) * disk.e3.y, z: northWest.z - dot(northWest, disk.e3) * disk.e3.z };
    expect(dot(inPlane, away)).toBeLessThan(0);
  });

  it('keep each part inside the volume drawn', () => {
    for (const nebula of NEBULAE) {
      const unit = nebula.sizeArcmin[0] / 2;
      for (const p of nebula.parts) {
        if (p.form === 'dust') continue;
        const off = Math.hypot(...p.offsetArcmin) / unit;
        expect(off + Math.max(...p.semiAxesArcmin) / unit).toBeLessThanOrEqual(nebulaReach(nebula));
      }
    }
  });

  it('become bodies once, found by id and by their other names', () => {
    const store = new EphemerisStore({
      manifest: { bodies: [], tables: {} },
      bodies: [],
      vectors: new Map(),
      elements: new Map(),
      generatedAt: new Date(0),
    } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
    ensureNebulae(store);
    ensureNebulae(store);
    for (const nebula of NEBULAE) {
      expect(store.isPropagatedBody(nebulaBodyId(nebula))).toBe(true);
      expect(nebulaOf(nebulaBodyId(nebula))).toBe(nebula);
      expect(nebulaFraming(nebulaBodyId(nebula))).not.toBeNull();
    }
    expect(store.body('nebula-orion').kind).toBe('nebula');
    expect(deepSkyOf('nebula-orion')?.aliases).toContain('M42');
    expect(deepSkyOf('nebula-helix')?.label).toBe('Planetary nebula');
  });
});
