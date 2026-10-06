import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declutterMarkers, type MarkerCandidate } from './markerDeclutter.ts';

const SIZE = 11;

function marker(id: string, x: number, y: number, depth: number, rank = 0): MarkerCandidate {
  return { id, x, y, depth, rank };
}

describe('declutterMarkers', () => {
  it('hides the one behind when two land on each other', () => {
    const hidden = declutterMarkers(
      [marker('pioneer-11', 260, 364, 5, 2), marker('voyager-1', 264, 368, 3, 2)],
      'sun',
      SIZE,
    );
    expect([...hidden]).toEqual(['pioneer-11']);
  });

  it('leaves markers alone that only come near', () => {
    const hidden = declutterMarkers(
      [marker('pluto', 237, 285, 1), marker('new-horizons', 239, 316, 2, 2)],
      'sun',
      SIZE,
    );
    expect(hidden.size).toBe(0);
  });

  it('never hides the focus, nor a planet behind a spacecraft', () => {
    const pile = [
      marker('jupiter', 240, 250, 9),
      marker('europa-clipper', 242, 252, 1, 2),
      marker('sun', 241, 251, 10),
    ];
    expect([...declutterMarkers(pile, 'sun', SIZE)].sort()).toEqual(['europa-clipper', 'jupiter']);
    expect([...declutterMarkers(pile, 'europa-clipper', SIZE)].sort()).toEqual(['jupiter', 'sun']);
  });

  it('keeps the one already shown while depth flips', () => {
    const a = marker('juice', 300, 200, 1, 2);
    const b = marker('lucy', 304, 203, 2, 2);
    expect([...declutterMarkers([a, b], 'sun', SIZE, new Set(['lucy']))]).toEqual(['juice']);
  });

  it('lets a shown marker stay until another is well inside it', () => {
    // Nine pixels apart: inside a newcomer's eleven, clear of a held marker's 7.7.
    const a = marker('voyager-2', 100, 100, 1, 2);
    const b = marker('pioneer-10', 109, 100, 2, 2);
    expect(declutterMarkers([a, b], 'sun', SIZE).size).toBe(1);
    expect(declutterMarkers([a, b], 'sun', SIZE, new Set(['voyager-2', 'pioneer-10'])).size).toBe(0);
  });
});

describe('a hidden marker takes its label with it', () => {
  it('has the scene decide before the labels read it', async () => {
    // The two share a set the scene fills in its frame and the labels read in theirs, so
    // the scene's frame must run first -- which r3f does in the order they are declared.
    const canvas = await readFile(join(import.meta.dirname, 'SolarSystemCanvas.tsx'), 'utf8');
    expect(canvas.indexOf('<SolarSystem')).toBeGreaterThan(0);
    expect(canvas.indexOf('<SolarSystem')).toBeLessThan(canvas.indexOf('<LabelProjector'));
  });
});
