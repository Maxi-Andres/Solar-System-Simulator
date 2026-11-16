import { useViewStore } from '../../state/store.ts';
import type { SectionId } from './nav.ts';

/**
 * Where the About opens, kept apart from the panel so that what links into it -- the body
 * panel's "what is this?" -- does not pull the whole text into the first download: the panel
 * and its sections are a chunk of their own, fetched the first time it opens (App.tsx).
 */
export const aboutPlace: { section: SectionId; anchor: string | undefined } = {
  // The section the panel opens on: the last one read this session, the overview at first.
  section: 'overview',
  // Where in it to land when it opens, if something outside asked: see openAboutAt.
  anchor: undefined,
};

/**
 * Open the About at `section`, scrolled to `anchor`: how a panel outside it (the body
 * panel's "what is this?") links into it. It takes the place of whatever panel is open.
 */
export function openAboutAt(section: SectionId, anchor?: string): void {
  aboutPlace.section = section;
  aboutPlace.anchor = anchor;
  useViewStore.setState({ openPanel: 'about' });
}
