import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FICTION, FICTION_SHIPS, FICTION_STARS, fictionBodyId, inFictionGalaxy, valueOf } from './fiction.ts';
import { fictionStarPositionKm } from './fictionBodies.ts';
import { idSeed } from './seeded.ts';
import {
  galaxyMapFrame,
  LY_KM,
  mapSquareLy,
  mapSquarePositionKm,
  PC_KM,
  STAR_WARS_GALAXY,
  STAR_WARS_GALAXY_RULE,
  STAR_WARS_STATIONS,
  STAR_WARS_WORLDS,
} from './starWars.ts';
import type { Vec3 } from './vec3.ts';

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

describe('Star Wars’ galaxy map', () => {
  it('reads the canon’s squares: L-11 the centre, 5,000 light years a square, letters east, numbers south', () => {
    expect(mapSquareLy('L-11')).toEqual({ east: 0, north: -0 });
    expect(mapSquareLy('P-6')).toEqual({ east: 20_000, north: 25_000 });
    expect(mapSquareLy('H-16')).toEqual({ east: -20_000, north: -25_000 });
    expect(() => mapSquareLy('Z-99')).toThrow();
  });

  it('lays the map flat on the disc, tipped by the catalogue’s inclination', () => {
    const { east, north, normal } = galaxyMapFrame();
    for (const v of [east, north, normal]) expect(length(v)).toBeCloseTo(1, 12);
    expect(dot(east, north)).toBeCloseTo(0, 12);
    expect(dot(east, normal)).toBeCloseTo(0, 12);
    expect(dot(north, normal)).toBeCloseTo(0, 12);
    // The disc's pole against the line of sight: the catalogue's inclination, whichever side is near.
    const g = STAR_WARS_GALAXY.positionPc;
    const along = { x: g.x, y: g.y, z: g.z };
    const tilt = (Math.acos(Math.abs(dot(normal, along)) / length(along)) * 180) / Math.PI;
    expect(tilt).toBeCloseTo(STAR_WARS_GALAXY.inclinationDeg, 9);
  });

  it('puts Yavin and Endor 32,000 light years from the galaxy’s centre, on opposite sides, in its plane', () => {
    const g = STAR_WARS_GALAXY.positionPc;
    const centre = { x: g.x * PC_KM, y: g.y * PC_KM, z: g.z * PC_KM };
    const yavin = mapSquarePositionKm('P-6');
    const endor = mapSquarePositionKm('H-16');
    const off = (p: Vec3): Vec3 => ({ x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z });
    expect(length(off(yavin)) / LY_KM).toBeCloseTo(Math.hypot(20_000, 25_000), 0);
    expect(length(off(endor)) / LY_KM).toBeCloseTo(Math.hypot(20_000, 25_000), 0);
    expect(dot(off(yavin), off(endor)) / (length(off(yavin)) * length(off(endor)))).toBeCloseTo(-1, 9);
    const { normal } = galaxyMapFrame();
    expect(Math.abs(dot(off(yavin), normal)) / LY_KM).toBeLessThan(1);
    // 480 million light years from the Sun.
    expect(length(yavin) / LY_KM / 1e6).toBeCloseTo(480, -1);
  });

  it('holds Endor II at its separation from Endor I', () => {
    const endorI = FICTION_STARS.find((star) => star.id === 'endor-i')!;
    const endorII = FICTION_STARS.find((star) => star.id === 'endor-ii')!;
    const a = fictionStarPositionKm(endorI)!;
    const b = fictionStarPositionKm(endorII)!;
    const au = length({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }) / 149_597_870.7;
    // To the kilometre is beyond a double out there; to a part in a million of 300 AU is not.
    expect(au).toBeCloseTo(valueOf(endorII.companionOf!.separationAu)!, 3);
  });
});

describe('Star Wars’ galaxy, picked from the catalogue', () => {
  const dir = join(import.meta.dirname, '../../public/data/laniakea');
  const present = existsSync(join(dir, 'galaxies.bin')) && existsSync(join(dir, 'details.bin'));

  it.skipIf(!present)('comes out of Laniakea’s data by its rule and seed', () => {
    const buf = readFileSync(join(dir, 'galaxies.bin'));
    const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const n = f.length / 12;
    const details = readFileSync(join(dir, 'details.bin'));
    const pgc = new Uint32Array(details.buffer.slice(details.byteOffset, details.byteOffset + 4 * n));
    const rule = STAR_WARS_GALAXY_RULE;
    const wantedPc = (rule.diameterLy * LY_KM) / PC_KM;
    const candidates: number[] = [];
    for (let k = 0; k < n; k += 1) {
      const r = 12 * k;
      const t = f[r + 9]!;
      const flags = f[r + 10]!;
      // Own Cosmicflows-4 distance (LANIAKEA_FLAGS.DISTANCE_OWN), a position angle and an inclination.
      if (!(t >= rule.tMin && t < rule.tMax) || (flags & 4) === 0 || pgc[k] === 0) continue;
      if (![f[r + 5]!, f[r + 7]!, f[r + 8]!].every(Number.isFinite)) continue;
      const d25 = (2 * f[r + 5]!) / rule.halfLightPerR25;
      if (Math.abs(d25 / wantedPc - 1) > rule.tolerance) continue;
      candidates.push(k);
    }
    candidates.sort((a, b) => pgc[a]! - pgc[b]!);
    expect(candidates.length).toBe(rule.candidates);
    const k = candidates[idSeed(rule.seedId) % candidates.length]!;
    expect(pgc[k]).toBe(STAR_WARS_GALAXY.pgc);
    expect(f[12 * k]).toBe(STAR_WARS_GALAXY.positionPc.x);
    expect(f[12 * k + 7]).toBeCloseTo(STAR_WARS_GALAXY.positionAngleDeg, 4);
    expect(f[12 * k + 8]).toBeCloseTo(STAR_WARS_GALAXY.inclinationDeg, 4);
  });
});

describe('Star Wars’ bodies', () => {
  it('are all of a galaxy not ours, and nothing else is', () => {
    const ids = [
      ...FICTION_STARS.map((star) => star.id),
      ...STAR_WARS_WORLDS.map((world) => world.id),
      ...STAR_WARS_STATIONS.map((station) => station.id),
    ];
    for (const id of ids) expect(inFictionGalaxy(fictionBodyId(id)), id).toBe(true);
    for (const record of FICTION.filter((r) => r.work.title !== 'Star Wars')) {
      expect(inFictionGalaxy(fictionBodyId(record.id)), record.id).toBe(false);
    }
    for (const ship of FICTION_SHIPS.filter((s) => s.work.title !== 'Star Wars')) {
      expect(inFictionGalaxy(fictionBodyId(ship.id)), ship.id).toBe(false);
    }
    expect(inFictionGalaxy('earth')).toBe(false);
  });

  it('keep the stations clear of their worlds, the second Death Star 3,000 km up', () => {
    for (const station of STAR_WARS_STATIONS) {
      const world = STAR_WARS_WORLDS.find((w) => w.id === station.station!.about)!;
      const radius = valueOf(station.station!.radiusKm)!;
      const clearance = radius - valueOf(world.radiusKm)! - valueOf(station.lengthM)! / 2000;
      expect(clearance, station.id).toBeGreaterThan(2_000);
    }
  });

  it('give the canon’s diameters: 160 km and 200 km', () => {
    expect(STAR_WARS_STATIONS.map((station) => valueOf(station.lengthM))).toEqual([160_000, 200_000]);
  });
});
