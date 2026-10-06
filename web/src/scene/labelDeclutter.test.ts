import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declutterLabels, type LabelCandidate } from './LabelProjector.tsx';

function label(id: string, x: number, y: number, rank: number, width = 100): LabelCandidate {
  return { id, x, y, offset: 14, width, depth: 1, rank };
}

const ids = (labels: readonly LabelCandidate[]) => labels.map((entry) => entry.id).sort();

describe('declutterLabels', () => {
  it('lets the focused body take the spot, and the other name yield', () => {
    // The screenshot this came from: zoomed out to the Voyagers, focused on Europa
    // Clipper, which sat a few pixels from Jupiter -- and both names were drawn.
    const shown = declutterLabels(
      [label('jupiter', 240, 250, 0), label('europa-clipper', 242, 256, 2)],
      'europa-clipper',
    );
    expect(ids(shown)).toEqual(['europa-clipper']);
  });

  it('keeps the planet otherwise', () => {
    const shown = declutterLabels(
      [label('jupiter', 240, 250, 0), label('europa-clipper', 242, 256, 2)],
      'sun',
    );
    expect(ids(shown)).toEqual(['jupiter']);
  });

  it('hides a name its neighbour’s text would run into', () => {
    // Markers 60 px apart on one line: too far for the marker rule, but the first
    // label's hundred pixels of text reach right over the second.
    const shown = declutterLabels(
      [label('pioneer-11', 260, 364, 2), label('voyager-1', 320, 364, 2)],
      'sun',
    );
    expect(shown).toHaveLength(1);
  });

  it('shows both when the text clears', () => {
    const shown = declutterLabels(
      [label('voyager-2', 150, 355, 2), label('pioneer-11', 260, 364, 2)],
      'sun',
    );
    expect(shown).toHaveLength(2);
  });

  it('stacks rows that are a line apart', () => {
    const shown = declutterLabels(
      [label('pluto', 237, 285, 0), label('new-horizons', 239, 316, 2)],
      'sun',
    );
    expect(shown).toHaveLength(2);
  });
});

describe('declutterLabels, while things move', () => {
  it('keeps the name already on screen when depth would flip the winner', () => {
    // Two craft at the same rank, a few pixels apart. The camera turns and the second
    // becomes the nearer -- by depth alone it would take the spot, and turn back the
    // next frame. The one already shown keeps it.
    const near = { ...label('juice', 300, 200, 2), depth: 1 };
    const far = { ...label('lucy', 304, 203, 2), depth: 2 };
    expect(ids(declutterLabels([near, far], 'sun', new Set(['lucy'])))).toEqual(['lucy']);
    expect(ids(declutterLabels([near, far], 'sun', new Set(['juice'])))).toEqual(['juice']);
  });

  it('needs clear space to appear, but only actual contact to leave', () => {
    // Text boxes two pixels apart: inside a newcomer's padding, clear of a held box.
    const a = label('voyager-2', 100, 100, 2, 100);
    const b = label('pioneer-11', 100 + 100 + 2, 100, 2, 80);
    expect(declutterLabels([a, b], 'sun', new Set(['voyager-2']))).toHaveLength(1);
    expect(declutterLabels([a, b], 'sun', new Set(['voyager-2', 'pioneer-11']))).toHaveLength(2);
  });

  it('still never lets a craft hold a spot against a planet', () => {
    const shown = declutterLabels(
      [label('jupiter', 240, 250, 0), label('europa-clipper', 242, 256, 2)],
      'sun',
      new Set(['europa-clipper']),
    );
    expect(ids(shown)).toEqual(['jupiter']);
  });
});

describe('frame order', () => {
  it('projects the names through this frame’s camera, not last frame’s', async () => {
    const projector = await readFile(join(import.meta.dirname, 'LabelProjector.tsx'), 'utf8');
    const update = projector.indexOf('camera.updateMatrixWorld()');
    expect(update).toBeGreaterThan(0);
    expect(update).toBeLessThan(projector.indexOf('scratch.project(camera)'));
  });

  it('moves the camera before the sky and the labels read it', async () => {
    // Otherwise both use last frame's camera, and zooming out at hundreds of AU slides
    // the star sphere across the screen.
    const rig = await readFile(join(import.meta.dirname, 'CameraRig.tsx'), 'utf8');
    expect(rig).toMatch(/\}, -1\);/);
  });
});
