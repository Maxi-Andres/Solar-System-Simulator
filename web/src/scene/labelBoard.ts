/**
 * Names placed by others than LabelProjector, handed to it for its one declutter pass.
 *
 * The Milky Way's model names its centre and its arms itself (MilkyWay.tsx), in elements of
 * its own, and nothing compared them with the bodies' names: "Milky Way" was written over
 * "Large Magellanic Cloud". Now it places them as before and posts each here, with the box its
 * text takes; LabelProjector, whose frame runs after it, declutters them with the bodies' and
 * hides those that lose. Taken each frame, so a frame in which the model posted nothing leaves
 * nothing behind.
 */

export interface BoardLabel {
  /** Unique among the posted names. */
  readonly key: string;
  readonly element: HTMLElement;
  /** Its point on screen, CSS pixels; the box's left edge relative to it, and its centre's height. */
  readonly x: number;
  readonly y: number;
  readonly offset: number;
  readonly dy: number;
  readonly width: number;
  readonly height: number;
  /** As a body's label's (LabelProjector labelRank, LabelCandidate importance). */
  readonly rank: number;
  readonly importance: number;
  /** Whether a mark is at its point. */
  readonly marked: boolean;
}

export const labelBoard = { posted: [] as BoardLabel[] };

/** Measured widths and heights, by element, kept while its text stays the same. */
const sizes = new WeakMap<HTMLElement, { text: string; width: number; height: number }>();

/** An element's box, CSS pixels: measured once per text, as LabelProjector measures its own. */
export function boxOf(element: HTMLElement): { width: number; height: number } {
  const text = element.textContent ?? '';
  const known = sizes.get(element);
  if (known !== undefined && known.text === text) {
    return known;
  }
  const size = { text, width: element.offsetWidth, height: element.offsetHeight };
  if (size.width > 0) {
    sizes.set(element, size);
  }
  return size;
}
