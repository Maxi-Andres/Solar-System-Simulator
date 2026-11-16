import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_WIDTH_PC, streamParticles, toScene, widthPc, type StreamsFile, type StreamTrack } from './streams.ts';
import { directionToGalactic } from '../scene/galactic.ts';

const DIR = join(import.meta.dirname, '../../public/streams');
const file = JSON.parse(await readFile(join(DIR, 'tracks.json'), 'utf8')) as StreamsFile;
const byName = (name: string) => file.streams.find((stream) => stream.name === name)!;

/** A track's points' distances from the Sun, pc. */
function distances(stream: StreamTrack): number[] {
  const out: number[] = [];
  for (const piece of stream.pieces) {
    for (let i = 0; i < piece.length; i += 3) out.push(Math.hypot(piece[i]!, piece[i + 1]!, piece[i + 2]!));
  }
  return out;
}

describe('the streams’ asset', () => {
  it('credits every file in web/public/streams', async () => {
    const credits = await readFile(join(DIR, 'CREDITS.md'), 'utf8');
    for (const name of (await readdir(DIR)).filter((entry) => !entry.endsWith('.md'))) {
      expect(credits, name).toContain(`\`${name}\``);
    }
    expect(credits).toContain('Mateu 2023');
    expect(credits).toContain('BSD 3-Clause');
  });

  it('holds the famous ones, each with its paper, and is small', () => {
    for (const name of ['Sagittarius Stream', 'GD-1', 'Palomar 5', 'Orphan–Chenab', 'Monoceros Ring', 'Anticenter Stream', 'Jhelum-a', 'Phoenix']) {
      expect(byName(name), name).toBeDefined();
      expect(byName(name).reference, name).toMatch(/\d{4}/);
    }
    expect(JSON.stringify(file).length).toBeLessThan(100_000);
  });

  it('puts GD-1, the Sagittarius Stream and Palomar 5’s tails where they are', () => {
    // GD-1 7.6 to 11.7 kpc (Ibata et al. 2021); Sagittarius's arms 19 to 52 kpc, as Ramos et al. 2020's RR Lyrae place them.
    expect(Math.min(...distances(byName('GD-1')))).toBeGreaterThan(7000);
    expect(Math.max(...distances(byName('GD-1')))).toBeLessThan(12500);
    expect(Math.min(...distances(byName('Sagittarius Stream')))).toBeGreaterThan(15000);
    expect(Math.max(...distances(byName('Sagittarius Stream')))).toBeLessThan(60000);
    // Palomar 5 itself is at l 0.85, b +45.86 (Harris 1996): its tails' track passes within a few degrees.
    const pal5 = byName('Palomar 5').pieces[0]!;
    let near = Infinity;
    for (let i = 0; i < pal5.length; i += 3) {
      const [x, y, z] = toScene(pal5[i]!, pal5[i + 1]!, pal5[i + 2]!);
      const g = directionToGalactic({ x, y, z });
      const dl = ((g.longitudeDeg - 0.85 + 540) % 360) - 180;
      near = Math.min(near, Math.hypot(dl * Math.cos((g.latitudeDeg * Math.PI) / 180), g.latitudeDeg - 45.86));
    }
    expect(near).toBeLessThan(3);
  });
});

describe('a stream’s particles', () => {
  const stream: StreamTrack = {
    name: 'Test',
    distance: 'track',
    galstreams: 'Test',
    track: 'Test-X',
    reference: 'Someone 2020',
    widthDeg: 1,
    pieces: [[10000, 0, 0, 10000, 1000, 0, 10000, 2000, 0]],
  };

  it('take a width on the sky as parsecs at its distance, and the default where none is given', () => {
    expect(widthPc(stream, 10000)).toBeCloseTo(10000 * Math.tan(Math.PI / 180), 6);
    expect(widthPc({ ...stream, widthDeg: null }, 10000)).toBe(DEFAULT_WIDTH_PC);
  });

  it('are scattered about the track, its name on it', () => {
    const particles = streamParticles({ source: '', licence: '', stepDeg: 1.5, streams: [stream] });
    const count = particles.sigmas.length;
    expect(count).toBeGreaterThan(10);
    expect(particles.positions.length).toBe(count * 3);
    const centre = toScene(10000, 1000, 0);
    let far = 0;
    for (let i = 0; i < count; i += 1) {
      far = Math.max(
        far,
        Math.hypot(particles.positions[i * 3]! - centre[0], particles.positions[i * 3 + 1]! - centre[1], particles.positions[i * 3 + 2]! - centre[2]),
      );
    }
    expect(far).toBeLessThan(1000 + 5 * widthPc(stream, 10000));
    expect(particles.labels).toHaveLength(1);
    expect(particles.labels[0]!.numbered).toBe(false);
  });

  it('are few enough for one cheap draw', () => {
    expect(streamParticles(file).sigmas.length).toBeLessThan(60_000);
  });
});
