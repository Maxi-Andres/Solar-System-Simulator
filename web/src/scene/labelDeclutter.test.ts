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

describe('declutterLabels, across catalogues', () => {
  it('keeps the brighter galaxy’s name where two would overlap', () => {
    const faint = { ...label('galaxy-ngc-247', 300, 200, 0), importance: 3e9, depth: 1 };
    const bright = { ...label('galaxy-ngc-253', 304, 203, 0), importance: 4e10, depth: 2 };
    expect(ids(declutterLabels([faint, bright], 'sun'))).toEqual(['galaxy-ngc-253']);
    // Held or not: the brighter keeps it, so the two never swap.
    expect(ids(declutterLabels([faint, bright], 'sun', new Set(['galaxy-ngc-247'])))).toEqual(['galaxy-ngc-253']);
  });

  it('lets the Milky Way’s name, written left of its point, push the Large Magellanic Cloud’s aside', () => {
    // The screenshot: "MILKY WAY" right up against "LARGE MAGELLANIC CLOUD", their points 20 px apart.
    const milkyWay = { ...label('board:milky-way-0', 760, 432, 0, 80), offset: -88, importance: Infinity };
    const lmc = { ...label('galaxy-lmc', 742, 438, 0, 190), importance: 3e9 };
    expect(ids(declutterLabels([lmc, milkyWay], 'sun'))).toEqual(['board:milky-way-0']);
    // Unless the Cloud is the focus.
    expect(ids(declutterLabels([lmc, milkyWay], 'galaxy-lmc'))).toEqual(['galaxy-lmc']);
  });

  it('places a name above its point where it is written there, and a name at no mark only by its box', () => {
    // "Galactic Centre" above the centre, Sgr A* to the right of it, a few pixels off: both fit.
    const centre = { ...label('board:milky-way-0', 400, 300, 1, 110), offset: -55, dy: -23, height: 14, marked: false };
    for (const dy of [-3, 0, 3]) {
      expect(declutterLabels([centre, label('sgr-a-star', 402, 300 + dy, 0, 60)], 'sun')).toHaveLength(2);
    }
    // Written on the point, it does collide, and the body's name, a thing to click, keeps it.
    expect(ids(declutterLabels([{ ...centre, dy: 0 }, label('sgr-a-star', 400, 300, 0, 60)], 'sun'))).toEqual(['sgr-a-star']);
  });
});

describe('frame order', () => {
  it('projects the names through this frame’s camera, not last frame’s', async () => {
    const projector = await readFile(join(import.meta.dirname, 'LabelProjector.tsx'), 'utf8');
    const update = projector.indexOf('camera.updateMatrixWorld()');
    expect(update).toBeGreaterThan(0);
    const project = projector.indexOf('projectToScreen(scratch, camera, scratch)');
    expect(project).toBeGreaterThan(0);
    expect(update).toBeLessThan(project);
  });

  it('moves the camera before the sky and the labels read it', async () => {
    // Otherwise both use last frame's camera, and zooming out at hundreds of AU slides
    // the star sphere across the screen.
    const rig = await readFile(join(import.meta.dirname, 'CameraRig.tsx'), 'utf8');
    expect(rig).toMatch(/\}, -1\);/);
  });
});

/**
 * declutterLabels as it was before its grid: every candidate against every label placed.
 * The grid must choose exactly these labels, in exactly this order.
 */
function declutterAgainstAll(candidates: readonly LabelCandidate[], focus: string, held: ReadonlySet<string>): LabelCandidate[] {
  const ordered = [...candidates].sort((a, b) => {
    if ((a.id === focus) !== (b.id === focus)) return a.id === focus ? -1 : 1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if ((a.importance ?? 0) !== (b.importance ?? 0)) return (a.importance ?? 0) > (b.importance ?? 0) ? -1 : 1;
    if (held.has(a.id) !== held.has(b.id)) return held.has(a.id) ? -1 : 1;
    return a.depth - b.depth;
  });
  const placed: LabelCandidate[] = [];
  const half = (label: LabelCandidate) => (label.height ?? 16) / 2;
  const middle = (label: LabelCandidate) => label.y + (label.dy ?? 0);
  for (const candidate of ordered) {
    const holding = held.has(candidate.id);
    const padding = holding ? 0 : 4;
    const markerGap = holding ? 26 * 0.7 : 26;
    const left = candidate.x + candidate.offset - padding;
    const right = candidate.x + candidate.offset + candidate.width + padding;
    const top = middle(candidate) - half(candidate) - padding;
    const bottom = middle(candidate) + half(candidate) + padding;
    const collides = placed.some((other) => {
      const markersTouch =
        candidate.marked !== false &&
        other.marked !== false &&
        Math.abs(other.x - candidate.x) < markerGap &&
        Math.abs(other.y - candidate.y) < markerGap;
      const otherLeft = other.x + other.offset;
      const boxesTouch =
        left < otherLeft + other.width &&
        otherLeft < right &&
        top < middle(other) + half(other) &&
        middle(other) - half(other) < bottom;
      return markersTouch || boxesTouch;
    });
    if (!collides) placed.push(candidate);
  }
  return placed;
}

describe('declutterLabels on its grid', () => {
  /** A fixed pseudo-random sequence, so the same candidates every run. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
  }

  it('chooses exactly the labels testing each against all did, in the same order', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const next = random(seed);
      const count = 50 + Math.floor(next() * 550);
      const candidates: LabelCandidate[] = Array.from({ length: count }, (_, i) => {
        const odd = next();
        return {
          id: `body-${i}`,
          // Mostly on a 1920 x 1080 screen, crowded in places; some well off it, some on cell edges.
          x: odd < 0.05 ? (next() - 0.5) * 1e6 : odd < 0.1 ? Math.round(next() * 30) * 64 : next() * 1920 * (seed % 3 === 0 ? 0.2 : 1),
          y: odd < 0.05 ? (next() - 0.5) * 1e6 : odd < 0.1 ? Math.round(next() * 17) * 64 : next() * 1080 * (seed % 3 === 0 ? 0.2 : 1),
          offset: next() < 0.1 ? -100 * next() : 14 + next() * 40,
          width: 20 + next() * 200,
          depth: next() * 1e6,
          rank: Math.floor(next() * 3),
          ...(next() < 0.2 ? { importance: Math.floor(next() * 4) * 1e9 } : {}),
          ...(next() < 0.1 ? { height: 10 + next() * 20, dy: (next() - 0.5) * 40 } : {}),
          ...(next() < 0.1 ? { marked: false } : {}),
        };
      });
      // A few numbers the grid cannot file.
      if (seed % 5 === 0) {
        candidates.push({ id: 'nan', x: Number.NaN, y: 10, offset: 14, width: 50, depth: 1, rank: 0 });
        candidates.push({ id: 'far', x: 1e12, y: 1e12, offset: 14, width: 50, depth: 1, rank: 0 });
        candidates.push({ id: 'nan-offset', x: 500, y: 500, offset: Number.NaN, width: 50, depth: 0.5, rank: 0 });
        candidates.push({ id: 'wide', x: 0, y: 300, offset: 0, width: Infinity, depth: 2, rank: 1 });
      }
      const held = new Set(candidates.filter(() => next() < 0.3).map((entry) => entry.id));
      const focus = `body-${Math.floor(next() * count)}`;
      const expected = declutterAgainstAll(candidates, focus, held).map((entry) => entry.id);
      expect(declutterLabels(candidates, focus, held).map((entry) => entry.id)).toEqual(expected);
    }
  });
});
