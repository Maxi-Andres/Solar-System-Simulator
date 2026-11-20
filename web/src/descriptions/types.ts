import type { BodyId } from '@sss/tools/types';

/**
 * A body's description (Phase E): what it is, in a few paragraphs, and then the honesty layer
 * for this object in this app -- how it is drawn, what of it is measured, what is a model's
 * estimate, what is not known or not drawn, and what the view corrects that people usually
 * believe. Every claim cites a source by key; the panel of figures stays terse, and the detail
 * lives here (Maxi, 2026-11-13: "quiero todo ... siempre todo muy detallado").
 */

export interface DescriptionSource {
  /** The key a point cites it by. */
  readonly key: string;
  /** Authors, year, title, journal: as a reference list sets it. */
  readonly text: string;
  readonly url?: string;
}

/** One entry of a list: a short title, the text, and the sources it rests on. */
export interface DescriptionPoint {
  readonly title: string;
  readonly text: string;
  readonly cite?: readonly string[];
}

/**
 * A photograph of the object, never drawn in the scene (no flat photos there): with what it
 * is -- whether its colours are what an eye would see -- who took it, when, and its licence.
 */
export interface DescriptionPhoto {
  /** Under public/: the thumbnail, and the large one opened on a click. */
  readonly file: string;
  readonly largeFile: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly caption: string;
  /**
   * 'true': as a camera or an eye sees it (black and white included); 'tinted': visible light
   * given a colour it does not have, as a solar filter's orange; 'false': light no eye can see
   * (ultraviolet, infrared, radar) shown in colours, or bands mapped to other colours, or
   * colour enhanced.
   */
  readonly colour: 'true' | 'tinted' | 'false';
  readonly credit: string;
  readonly licence: string;
  readonly date: string;
  readonly sourceUrl: string;
}

export interface DescriptionSection {
  readonly title: string;
  /** Plain paragraphs before the points, if any. */
  readonly text?: readonly string[];
  readonly points: readonly DescriptionPoint[];
}

export interface Description {
  readonly id: BodyId;
  /**
   * For what is no body -- the Milky Way, seen only from inside; the cosmic microwave
   * background -- its name and what it is, for the page's head: it has no body to read them
   * from, and nothing is worked out from its data (generated.ts). Opened by the store's readAbout.
   */
  readonly subject?: { readonly name: string; readonly kind: string };
  /**
   * For a catalogue star, made a body at run time with an id of the record it is
   * (`star-<tier>-<index>`, core/starBodies.ts): the designations it is known by in the star
   * names -- "HIP 27989", "alf CMa B" -- any one of which finds it (descriptionOf). Its `id`
   * is then this description's own, never a body's.
   */
  readonly catalogueStar?: { readonly designations: readonly string[] };
  /** A few plain paragraphs: what it is and why it is worth looking at. */
  readonly lead: readonly string[];
  readonly photos: readonly DescriptionPhoto[];
  /**
   * Something about it that deserves its own heading, after the photos and before how it is
   * drawn: Voyager's Golden Record, its cover read symbol by symbol. Cited as the rest are.
   */
  readonly sections?: readonly DescriptionSection[];
  /** How this app draws it, besides what is worked out from its data (generated.ts). */
  readonly drawnHere: readonly DescriptionPoint[];
  readonly measured: readonly DescriptionPoint[];
  readonly estimated: readonly DescriptionPoint[];
  /** What is not known, or known but not drawn here, and why. */
  readonly missing: readonly DescriptionPoint[];
  readonly misconceptions: readonly DescriptionPoint[];
  readonly sources: readonly DescriptionSource[];
}
