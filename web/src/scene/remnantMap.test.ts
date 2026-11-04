import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { remnantEarthView, remnantShape, SUPERNOVA_REMNANTS } from '../core/supernovaRemnants.ts';
import { depthWeights, mapReach, measuredDepth, pointsInRadii, remnantFrame, remnantRadiusArcmin } from './remnantMap.ts';

/**
 * The remnants drawn from their pictures (remnantMap.ts): that every line of sight from Earth
 * adds up to its pixel, wherever its depth is put; that the measured depths go where their
 * points are; that the Crab's spheroid is Green's 7' by 5' from here; and that every file is
 * there and credited.
 */

const REMNANT_DIR = join(import.meta.dirname, '../../public/remnants');
const files = (await readdir(REMNANT_DIR)).filter((name) => !name.endsWith('.md'));
const credits = await readFile(join(REMNANT_DIR, 'CREDITS.md'), 'utf8');
const byKey = (key: string) => SUPERNOVA_REMNANTS.find((remnant) => remnant.key === key)!;
const SIZE = 24;

/** A column's sum along the line of sight, each weight times its voxel's depth. */
function columnSum(weights: Float32Array, i: number, j: number, channel: number, reach: number, size = SIZE): number {
  let sum = 0;
  for (let k = 0; k < size; k += 1) sum += weights[((k * size + j) * size + i) * 2 + channel]!;
  return (sum * 2 * reach) / size;
}

describe('a remnant drawn from its picture', () => {
  it('puts all of each pixel’s light somewhere along its line of sight, filaments and synchrotron both', () => {
    for (const key of ['crab', 'sn-1006']) {
      const remnant = byKey(key);
      const reach = mapReach(remnant, remnant.map!);
      const weights = depthWeights(remnant, remnantFrame(remnant), reach, SIZE);
      for (const [i, j] of [
        [12, 12],
        [6, 12],
        [12, 17],
        [3, 20],
      ] as const) {
        expect(columnSum(weights, i, j, 0, reach), `${key} ${i},${j}`).toBeCloseTo(1, 5);
        expect(columnSum(weights, i, j, 1, reach), `${key} ${i},${j}`).toBeCloseTo(1, 5);
      }
    }
  });

  it('puts the light at the depths measured, where they are, and the model’s elsewhere', () => {
    const reach = 1.5;
    const model = new Float32Array(SIZE ** 3 * 2).fill(1 / (2 * reach));
    // Twenty points on one line of sight, half a radius towards us.
    const points = new Float32Array(60);
    for (let p = 0; p < 20; p += 1) points.set([0.01, 0.01, -0.5], p * 3);
    const out = measuredDepth(points, model, reach, SIZE);
    const at = (i: number, j: number, k: number) => out[((k * SIZE + j) * SIZE + i) * 2]!;
    expect(columnSum(out, 12, 12, 0, reach)).toBeCloseTo(1, 5);
    let peak = 0;
    for (let k = 1; k < SIZE; k += 1) if (at(12, 12, k) > at(12, 12, peak)) peak = k;
    const depth = ((peak + 0.5) / SIZE) * 2 * reach - reach;
    expect(Math.abs(depth - -0.5)).toBeLessThan((2 * reach) / SIZE);
    // A column far from them keeps the model's.
    expect(at(2, 20, 5)).toBe(model[((5 * SIZE + 20) * SIZE + 2) * 2]);
  });

  it('draws the Crab’s spheroid as Green’s 7′ by 5′ from Earth', () => {
    const crab = byKey('crab');
    const shape = remnantShape(crab)!;
    const sight = remnantEarthView(crab).direction;
    const cos = Math.abs(shape.axis.x * sight[0] + shape.axis.y * sight[1] + shape.axis.z * sight[2]);
    const sin = Math.sqrt(1 - cos * cos);
    const projected = Math.sqrt(shape.along ** 2 * sin * sin + shape.across ** 2 * cos * cos);
    expect(projected / shape.across).toBeCloseTo(7 / 5, 6);
  });

  it('looks from Earth’s side by default, north up', () => {
    for (const remnant of SUPERNOVA_REMNANTS) {
      const { direction, up } = remnantEarthView(remnant);
      const frame = remnantFrame(remnant);
      expect(direction[0] * frame.away.x + direction[1] * frame.away.y + direction[2] * frame.away.z).toBeCloseTo(-1, 9);
      expect(up[0] * frame.north.x + up[1] * frame.north.y + up[2] * frame.north.z).toBeCloseTo(1, 9);
    }
  });

  it('has Cassiopeia A’s 3D points where its shell is: about Green’s centre, at its radius', async () => {
    const casA = byKey('cas-a');
    const bytes = await readFile(join(REMNANT_DIR, casA.map!.points!.file));
    expect(bytes.byteLength % 6).toBe(0);
    const raw = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const points = pointsInRadii(raw, remnantRadiusArcmin(casA));
    const radii: number[] = [];
    let east = 0;
    let north = 0;
    for (let p = 0; p < points.length; p += 3) {
      east += points[p]!;
      north += points[p + 1]!;
      radii.push(Math.hypot(points[p]!, points[p + 1]!, points[p + 2]!));
    }
    const n = points.length / 3;
    // Its ejecta's mean within half a radius of Green's centre: Green gives it to the arcminute
    // (+58 48', the expansion centre is +58 48' 49"), and the jets and knots are not even round it.
    expect(Math.hypot(east / n, north / n)).toBeLessThan(0.5);
    radii.sort((a, b) => a - b);
    // DeLaney's main shell: 4,936 km/s at 0.022"/(km/s), 109" -- Green's 150" radius is the outer shock.
    expect(radii[Math.floor(n / 2)]!).toBeGreaterThan(0.55);
    expect(radii[Math.floor(n / 2)]!).toBeLessThan(1.0);
  });

  it('has every picture it names, and credits every file', async () => {
    const used = new Set<string>();
    for (const remnant of SUPERNOVA_REMNANTS) {
      const map = remnant.map;
      if (map === null) continue;
      used.add(map.file);
      if (map.continuum !== null) used.add(map.continuum.file);
      if (map.points !== null) used.add(map.points.file);
      expect(map.credit.length, remnant.key).toBeGreaterThan(2);
      expect(map.source, remnant.key).toMatch(/^https:\/\//);
      expect(map.reachArcmin, remnant.key).toBeLessThanOrEqual(Math.SQRT2 * map.halfArcmin);
    }
    for (const file of used) expect(files, file).toContain(file);
    for (const file of files) {
      expect(used, `${file} is not used`).toContain(file);
      const row = credits.split('\n').find((line) => line.startsWith(`| \`${file}\``));
      expect(row, `${file} is not credited`).toBeDefined();
      expect(row, file).toMatch(/https?:\/\//);
    }
    const sizes = await Promise.all(files.map(async (file) => (await stat(join(REMNANT_DIR, file))).size));
    expect(sizes.reduce((sum, size) => sum + size, 0) / 1024 / 1024).toBeLessThan(8);
  });
});
