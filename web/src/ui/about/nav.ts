import { createContext, useContext } from 'react';

/**
 * The About panel's sections, in reading order, and how a link inside one reaches another.
 *
 * Only one section is on screen at a time -- the whole text at once was the problem this
 * structure exists to solve -- so a cross-reference ("see Sources › Exoplanets", a
 * citation's [12]) cannot be a plain anchor: it has to switch the section first and then
 * scroll to the place. `goTo` does both; the panel provides it.
 */

export const SECTION_IDS = ['overview', 'measured', 'estimated', 'physics', 'choices', 'sources'] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export interface AboutNav {
  /** Show `section`, and scroll to the element with id `anchor` in it, or to its top. */
  readonly goTo: (section: SectionId, anchor?: string) => void;
}

export const AboutNavContext = createContext<AboutNav>({ goTo: () => {} });

export function useAboutNav(): AboutNav {
  return useContext(AboutNavContext);
}

/** The DOM id of a subsection, unique across the panel: `about-<section>-<sub>`. */
export function anchorId(section: SectionId, sub: string): string {
  return `about-${section}-${sub}`;
}

/** The id of the About's scrolling region, which every jump scrolls and nothing else does. */
export const SCROLLER_ID = 'about-panel';

/**
 * Scroll the About's own region so the element `id` sits just under its top, and return
 * the element. Not `scrollIntoView`: that scrolls every scrollable ancestor too, and the
 * app's root is one -- a jump used to lift the whole interface off the bottom of the window.
 */
export function scrollToAnchor(id: string, smooth: boolean): HTMLElement | null {
  const target = document.getElementById(id);
  const scroller = document.getElementById(SCROLLER_ID);
  if (target === null || scroller === null) {
    return null;
  }
  const top =
    target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16;
  scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  return target;
}
