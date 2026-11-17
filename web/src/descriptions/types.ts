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
  /** 'true': as a camera sees it; 'tinted': one band shown in a colour; 'false': bands mapped to colours. */
  readonly colour: 'true' | 'tinted' | 'false';
  readonly credit: string;
  readonly licence: string;
  readonly date: string;
  readonly sourceUrl: string;
}

export interface Description {
  readonly id: BodyId;
  /** A few plain paragraphs: what it is and why it is worth looking at. */
  readonly lead: readonly string[];
  readonly photos: readonly DescriptionPhoto[];
  /** How this app draws it, besides what is worked out from its data (generated.ts). */
  readonly drawnHere: readonly DescriptionPoint[];
  readonly measured: readonly DescriptionPoint[];
  readonly estimated: readonly DescriptionPoint[];
  /** What is not known, or known but not drawn here, and why. */
  readonly missing: readonly DescriptionPoint[];
  readonly misconceptions: readonly DescriptionPoint[];
  readonly sources: readonly DescriptionSource[];
}
