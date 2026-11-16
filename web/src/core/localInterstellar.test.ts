import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  bubbleRadiusPc,
  bubbleSurface,
  isLocalIsmData,
  LIC_CENTRE_PC,
  licEdgeFromSunPc,
  licRadiusPc,
  licSurface,
  radialSurface,
  type LocalIsmData,
} from './localInterstellar.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'local-ism');
const data = JSON.parse(await readFile(join(DIR, 'local-ism.json'), 'utf8')) as LocalIsmData;

describe('the local interstellar medium’s data', () => {
  it('is committed, whole and credited', async () => {
    expect(isLocalIsmData(data)).toBe(true);
    const credits = await readFile(join(DIR, 'CREDITS.md'), 'utf8');
    for (const file of await readdir(DIR)) {
      if (file === 'CREDITS.md') continue;
      expect(credits, file).toContain(file);
    }
    for (const credit of ['Pelgrims', 'doi:10.7910/DVN/RHPVNC', 'Konietzka', 'doi:10.7910/DVN/F98QHY', 'doi:10.7910/DVN/Q7F4PC', 'CC0']) {
      expect(credits).toContain(credit);
    }
  });

  it('puts the Local Bubble’s wall where Pelgrims et al. find it: 88 to 310 pc, nearest toward the Galactic centre', () => {
    const radii = data.bubble.radiiPc;
    expect(Math.min(...radii)).toBeGreaterThan(60);
    expect(Math.max(...radii)).toBeLessThan(400);
    // Nearer toward the centre than toward l = 240, where it is open toward Canis Major.
    expect(bubbleRadiusPc(data.bubble, 0, 0)).toBeLessThan(bubbleRadiusPc(data.bubble, 240, 0));
    // The grid is read the same at l = 0 and l = 360.
    expect(bubbleRadiusPc(data.bubble, 359.999, 10)).toBeCloseTo(bubbleRadiusPc(data.bubble, 0, 10), 1);
  });

  it('keeps the Radcliffe Wave about 2.7 kpc long, a kiloparsec or so from the Sun at its ends', () => {
    const model = data.wave.model;
    const first = model[0]!;
    const last = model[model.length - 1]!;
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeGreaterThan(2400);
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThan(3000);
    // Its oscillation: within about 200 pc of the plane.
    for (const p of model) expect(Math.abs(p[2])).toBeLessThan(250);
    expect(data.wave.clouds.some((cloud) => cloud.name.startsWith('Orion'))).toBe(true);
  });
});

describe('a radial surface', () => {
  it('is a sphere when its radius is one, its normals pointing out', () => {
    const mesh = radialSurface(() => 1, 24, 13);
    for (let v = 0; v < mesh.positions.length; v += 3) {
      const p = [mesh.positions[v]!, mesh.positions[v + 1]!, mesh.positions[v + 2]!];
      expect(Math.hypot(p[0]!, p[1]!, p[2]!)).toBeCloseTo(1, 5);
      const n = [mesh.normals[v]!, mesh.normals[v + 1]!, mesh.normals[v + 2]!];
      expect(n[0]! * p[0]! + n[1]! * p[1]! + n[2]! * p[2]!).toBeGreaterThan(0.95);
    }
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
  });

  it('makes the Local Bubble’s, closed about the Sun', () => {
    const mesh = bubbleSurface(data.bubble);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.length).toBeGreaterThan(10_000);
  });
});

describe('the Local Interstellar Cloud', () => {
  it('holds the Sun, near its edge', () => {
    const toSun = [-LIC_CENTRE_PC[0], -LIC_CENTRE_PC[1], -LIC_CENTRE_PC[2]] as const;
    const distance = Math.hypot(...toSun);
    const edge = licRadiusPc(...toSun);
    expect(distance).toBeLessThan(edge);
    expect(edge - distance).toBeLessThan(0.5);
  });

  it('gives back the paper’s model distances to its edge (Linsky, Redfield & Tilipman 2019, Table 2)', () => {
    // l, b, d_edge model (pc): a sample across the sky.
    const sight: readonly (readonly [number, number, number])[] = [
      [227.2, -8.9, 0.24], // alpha CMa
      [195.8, -48.1, 0.91], // epsilon Eri
      [213.7, 13.0, 0.38], // alpha CMi
      [173.1, -73.4, 1.18], // tau Cet
      [122.6, -5.1, 2.63], // eta Cas A
      [67.5, 19.2, 0.63], // alpha Lyr
      [168.5, 73.8, 0.32], // CF UMa
      [158.4, 11.9, 2.45], // HR 1925
    ];
    const misses = sight.map(([l, b, d]) => Math.abs(licEdgeFromSunPc(l, b) - d));
    misses.sort((a, b) => a - b);
    expect(misses[Math.floor(misses.length / 2)]).toBeLessThan(0.15);
    expect(Math.max(...misses)).toBeLessThan(0.8);
  });

  it('is a few parsecs across', () => {
    const mesh = licSurface();
    let far = 0;
    for (let v = 0; v < mesh.positions.length; v += 3) {
      far = Math.max(
        far,
        Math.hypot(mesh.positions[v]! - LIC_CENTRE_PC[0], mesh.positions[v + 1]! - LIC_CENTRE_PC[1], mesh.positions[v + 2]! - LIC_CENTRE_PC[2]),
      );
    }
    expect(far).toBeGreaterThan(1);
    expect(far).toBeLessThan(5);
  });
});
