import type { BodyId } from '@sss/tools/types';

/**
 * Markers that land on top of each other: the one behind goes.
 *
 * Zoomed out, the inner planets, a moon or two and the craft near them all collapse onto
 * a few pixels, and their rings drawn over each other read as a smudge rather than as
 * several things. NASA Eyes shows one marker there, and so does this.
 *
 * The precedence is the labels' own (see `declutterLabels`), so that a marker and its
 * name always come and go together: the focused body first, then rank -- a planet is not
 * hidden behind a spacecraft passing in front of it -- then whichever was already on
 * screen, and only then depth, so that among equals it is the one behind that yields.
 * A marker that loses takes its label with it; a name with no marker beside it would be
 * naming nothing.
 */

/** A marker on screen. */
export interface MarkerCandidate {
  readonly id: BodyId;
  /** Centre on screen, pixels. */
  readonly x: number;
  readonly y: number;
  /** Distance from the camera, any unit; only compared. */
  readonly depth: number;
  /** See `labelRank`: lower keeps a contested spot. */
  readonly rank: number;
}

/**
 * How close a held marker may let another come before it goes, as a fraction of the
 * marker size. Below one, so a pair hovering at the threshold does not swap every frame.
 */
const HELD_FRACTION = 0.7;

/**
 * The markers to hide, given each one's centre and the markers' size in pixels.
 *
 * Two collide when their squares overlap. A marker already shown (`held`) only leaves
 * once another is well inside it; a new one needs the full size clear to appear.
 */
export function declutterMarkers(
  candidates: readonly MarkerCandidate[],
  focus: BodyId,
  sizePx: number,
  held: ReadonlySet<BodyId> = new Set(),
): Set<BodyId> {
  const ordered = [...candidates].sort((a, b) => {
    if ((a.id === focus) !== (b.id === focus)) {
      return a.id === focus ? -1 : 1;
    }
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    if (held.has(a.id) !== held.has(b.id)) {
      return held.has(a.id) ? -1 : 1;
    }
    return a.depth - b.depth;
  });

  const placed: MarkerCandidate[] = [];
  const hidden = new Set<BodyId>();
  for (const candidate of ordered) {
    const gap = held.has(candidate.id) ? sizePx * HELD_FRACTION : sizePx;
    const collides = placed.some(
      (other) => Math.abs(other.x - candidate.x) < gap && Math.abs(other.y - candidate.y) < gap,
    );
    if (collides) {
      hidden.add(candidate.id);
    } else {
      placed.push(candidate);
    }
  }
  return hidden;
}
