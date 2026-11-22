import { fictionEntry } from '../../core/fiction.ts';

/**
 * Which fictional things have an "about" page, without the pages (abouts.ts, read only by the
 * description page's own chunk): the panel only needs to know whether to offer one, and under
 * what name. Apart from the real descriptions (../ids.ts, ../index.ts) on purpose: fiction is
 * never mixed with data, there either.
 */

/**
 * The pages there are: one for each of Avatar's two worlds, one shared by the rest of Polyphemus'
 * family; Adrian's, the Hail Mary's, and one for both Petrova lines; Erid's, the Blip-A's and
 * Vulcan's.
 */
export type FictionAboutKey =
  | 'pandora'
  | 'polyphemus'
  | 'polyphemus-family'
  | 'adrian'
  | 'hail-mary'
  | 'petrova'
  | 'erid'
  | 'blip-a'
  | 'vulcan';

/** The records with a page of their own, by the same name. */
const OWN_PAGES: ReadonlySet<string> = new Set(['pandora', 'polyphemus', 'adrian', 'hail-mary', 'erid', 'blip-a', 'vulcan']);

/** What each page is called on the way into it ("Read about …"). */
export const FICTION_ABOUT_NAMES: Readonly<Record<FictionAboutKey, string>> = {
  pandora: 'Pandora',
  polyphemus: 'Polyphemus',
  'polyphemus-family': 'Polyphemus’ moons',
  adrian: 'Adrian',
  'hail-mary': 'Hail Mary',
  petrova: 'Petrova line',
  erid: 'Erid',
  'blip-a': 'Blip-A',
  vulcan: 'Vulcan',
};

/**
 * The page a fictional record is read about on: its own, or, for Polyphemus' other moons and its
 * Trojans, the one they share; null for a record with none yet.
 */
export function fictionAboutKey(recordId: string): FictionAboutKey | null {
  if (OWN_PAGES.has(recordId)) return recordId as FictionAboutKey;
  const entry = fictionEntry(recordId);
  if (entry === null || entry.kind === 'ship') return null;
  if (entry.kind === 'line') return 'petrova';
  const anchor = entry.anchor;
  const of = anchor.kind === 'fiction' ? anchor.id : anchor.kind === 'lagrange' ? anchor.of : null;
  return of === 'polyphemus' ? 'polyphemus-family' : null;
}
