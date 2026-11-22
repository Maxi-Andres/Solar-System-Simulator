import { fictionRecord } from '../../core/fiction.ts';

/**
 * Which fictional things have an "about" page, without the pages (abouts.ts, read only by the
 * description page's own chunk): the panel only needs to know whether to offer one, and under
 * what name. Apart from the real descriptions (../ids.ts, ../index.ts) on purpose: fiction is
 * never mixed with data, there either.
 */

/** The pages there are: one for each of Avatar's two worlds, one shared by the rest of Polyphemus' family. */
export type FictionAboutKey = 'pandora' | 'polyphemus' | 'polyphemus-family';

/** What each page is called on the way into it ("Read about …"). */
export const FICTION_ABOUT_NAMES: Readonly<Record<FictionAboutKey, string>> = {
  pandora: 'Pandora',
  polyphemus: 'Polyphemus',
  'polyphemus-family': 'Polyphemus’ moons',
};

/**
 * The page a fictional record is read about on: its own, or, for Polyphemus' other moons and its
 * Trojans, the one they share; null for a record with none yet.
 */
export function fictionAboutKey(recordId: string): FictionAboutKey | null {
  if (recordId === 'pandora' || recordId === 'polyphemus') return recordId;
  const anchor = fictionRecord(recordId)?.anchor;
  if (anchor === undefined) return null;
  const of = anchor.kind === 'fiction' ? anchor.id : anchor.kind === 'lagrange' ? anchor.of : null;
  return of === 'polyphemus' ? 'polyphemus-family' : null;
}
