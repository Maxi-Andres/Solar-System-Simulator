import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { StarCatalog } from '@sss/tools/types';

import type { BeltSource } from '../core/belt.ts';
import type { CometSource } from '../core/comets.ts';
import type { ExoplanetArchive } from '../core/exoplanetArchive.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { LazySource, SatelliteSource } from '../core/satellites.ts';
import type { Stars3dSource } from '../core/stars3d.ts';
import { useViewStore } from '../state/store.ts';
import { AboutNavContext, anchorId, scrollToAnchor, SCROLLER_ID, type AboutNav, type SectionId } from './about/nav.ts';
import { ACCENT, BRIGHT, MUTED, RULE } from './about/prose.tsx';
import type { AboutData, AboutSection } from './about/section.ts';
import { ABOUT_SECTIONS } from './about/sections.ts';
import { useClosing } from './Presence.tsx';

// The text built from the data lives in about/sentences.ts; these names were always
// exported from here, and tests and callers still import them from here.
export {
  beltAccuracySentence,
  beltSentence,
  CLOSE_ORBIT_MONTHS,
  cometAccuracySentence,
  craftCount,
  diameterKm,
  NOTABLE_JUMP_KM,
  satelliteAccuracySentence,
  seamSentence,
  smallBodySentence,
  smallMoonSentence,
  spelled,
} from './about/sentences.ts';

/**
 * The welcome / about screen.
 *
 * Deliberately says what this is and — more importantly — what it is not. A viewer
 * looking at a to-scale Solar System deserves to know which parts are measured and
 * which are approximated, so the honest caveats sit here rather than buried in the
 * source.
 *
 * ## Sections, one at a time
 *
 * It grew into one endless scroll in which nobody could tell whether they were reading a
 * measurement, an estimate or a choice. So it is split by *kind of statement*, not by
 * topic: what is measured, what is not known and how it is filled, the physics, the
 * deliberate choices, the sources -- each its own section in about/, behind a tab, with
 * its subsections listed at its top. A topic (exoplanets, black holes) recurs under the
 * same subsection name in each, so "what is measured about black holes" and "what is
 * chosen about them" are each one tab and one heading away. Citations are numbered
 * against one reference list (about/references.ts) and jump to it; cross-references
 * switch the section and then scroll (about/nav.ts).
 *
 * The section shown is remembered for the session, so closing the panel to look at
 * something and opening it again lands where the reader was.
 *
 * ## Why the scrolling is built by hand
 *
 * This is a long read on a full-bleed dark overlay, and the browser's own furniture
 * does it badly. Two things were wrong and both had the same cause — the close button
 * and the scrollbar were being left to the default behaviour of a scrolling box:
 *
 *  - **Close scrolled away with the text.** It was positioned against the scroll
 *    container, which means it moves with the content, so reading to the end left the
 *    only way out somewhere off the top of the screen. It now sits in the header bar
 *    with the section tabs, a sibling of the scrolling region rather than a child of it,
 *    which is the fix that needs no `position: fixed` and no z-index argument.
 *  - **The scrollbar is gone**, replaced by a ring that fills as you read. A scrollbar
 *    on a page of thin greys is a bright vertical rule down one edge, and it answers
 *    "where am I" without ever answering "is there more".
 */
export function AboutPanel({
  store,
  stars,
  belt,
  comets,
  satellites,
  stars3d = null,
  exoplanets = null,
}: {
  store: EphemerisStore;
  stars: StarCatalog;
  belt: BeltSource;
  comets: CometSource;
  satellites: SatelliteSource;
  stars3d?: Stars3dSource | null;
  exoplanets?: LazySource<ExoplanetArchive> | null;
}) {
  const closePanel = useViewStore((state) => state.closePanel);
  // Described from its own files, so only once they have arrived -- with the Asteroids
  // layer never switched on there is no belt here to describe -- and counted from the
  // tiers in hand, so the numbers follow the density the viewer chose.
  const beltView = useSyncExternalStore(belt.subscribe, () => belt.view);
  const beltInfo = beltView.tiers.length > 0 ? beltView.info : null;
  // The same for the comets: described once they are here.
  const cometInfo = useSyncExternalStore(comets.subscribe, () => comets.comets)?.info ?? null;
  // And the satellites.
  const satelliteInfo = useSyncExternalStore(satellites.subscribe, () => satellites.value)?.info ?? null;
  // And the 3D stars, once stars3d.json is in -- fetched past 50 AU, or by a search.
  const stars3dInfo = useSyncExternalStore(
    stars3d?.subscribe ?? noSubscribe,
    () => stars3d?.view.info ?? null,
  );
  // And the Exoplanet Archive, once exoplanets.json is in: its counts, as read.
  const exoplanetCatalog =
    useSyncExternalStore(exoplanets?.subscribe ?? noSubscribe, () => exoplanets?.value ?? null)?.catalog ?? null;
  const data: AboutData = {
    store,
    stars,
    beltInfo,
    beltTiers: beltView.tiers,
    cometInfo,
    satelliteInfo,
    stars3dInfo,
    exoplanetCatalog,
  };

  const closing = useClosing();
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState<ScrollState>({ progress: 0, scrollable: false });
  // Which section, and where in it to land: `nonce` so a second jump to the same place
  // still scrolls.
  const [place, setPlace] = useState<{ section: SectionId; anchor: string | undefined; nonce: number }>(() => ({
    section: lastSection,
    anchor: undefined,
    nonce: 0,
  }));
  const section = ABOUT_SECTIONS.find((entry) => entry.id === place.section) ?? ABOUT_SECTIONS[0]!;
  const index = ABOUT_SECTIONS.indexOf(section);

  const measure = useCallback(() => {
    const element = scroller.current;
    if (element !== null) {
      setScroll(scrollState(element.scrollTop, element.scrollHeight, element.clientHeight));
    }
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (element === null) {
      return;
    }
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    // Content reflows when the window narrows, which changes both numbers.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  // A new section starts at its top, or at the place a link asked for, once it is drawn.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element === null) {
      return;
    }
    const target = place.anchor === undefined ? null : scrollToAnchor(place.anchor, false);
    if (target === null) {
      element.scrollTop = 0;
    } else {
      // Say which entry the link meant: a reference in a list of forty looks like any other.
      target.classList.remove('about-flash');
      void target.offsetWidth;
      target.classList.add('about-flash');
    }
    measure();
  }, [place, measure]);

  const nav: AboutNav = useMemo(
    () => ({
      goTo: (next, anchor) => {
        lastSection = next;
        setPlace((current) => ({ section: next, anchor, nonce: current.nonce + 1 }));
      },
    }),
    [],
  );

  /** One screenful down, so the ring is a control and not only a readout. */
  const pageDown = () => {
    const element = scroller.current;
    element?.scrollBy({ top: element.clientHeight * 0.85, behavior: 'smooth' });
  };

  const previous = ABOUT_SECTIONS[index - 1];
  const next = ABOUT_SECTIONS[index + 1];

  return (
    <AboutNavContext.Provider value={nav}>
      <div
        className={closing ? 'overlay-exit' : 'overlay-enter'}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          // No backdrop blur over a canvas that redraws every frame; see Panel.tsx.
          background: 'rgba(4,4,6,0.96)',
        }}
      >
        {/*
          Outside the scrolling region, so they stay put. Close was a child of it once,
          which is why it used to disappear as soon as anyone read past the first screen.
        */}
        <header
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            padding: '0.9rem 1.2rem 0',
            borderBottom: `1px solid ${RULE}`,
            // Over the overlay's own 0.96: the breadcrumb under it otherwise shows through the tabs.
            background: 'rgba(4,4,6,0.7)',
          }}
        >
          <SectionTabs current={section.id} onSelect={(id) => nav.goTo(id)} />
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close"
            style={{
              flex: 'none',
              alignSelf: 'flex-start',
              background: 'rgba(4,4,6,0.8)',
              border: `1px solid ${RULE}`,
              borderRadius: '0.3rem',
              color: '#8a8a8a',
              cursor: 'pointer',
              padding: '0.3rem 0.7rem',
              fontFamily: 'inherit',
              fontSize: '0.72rem',
              letterSpacing: '0.1em',
            }}
          >
            CLOSE
          </button>
        </header>

        <div
          ref={scroller}
          className="scroll-hidden"
          role="tabpanel"
          id={SCROLLER_ID}
          aria-labelledby={`about-tab-${section.id}`}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
            // Not the default `stretch`, and this is why the bottom padding kept
            // disappearing: a stretched flex item is sized to the container, so once the
            // text is longer than the window the content spills out of the item and the
            // item's own padding-bottom stays up at the fold instead of following the
            // last line down.
            alignItems: 'flex-start',
          }}
        >
          <div style={{ maxWidth: '46rem', padding: '2.2rem 1rem 7rem', width: '100%', boxSizing: 'border-box' }}>
            <SectionHeading section={section} />
            <section.Body data={data} />
            <SectionFooter
              previous={previous}
              next={next}
              onSelect={(id) => nav.goTo(id)}
            />
          </div>
        </div>

        <ScrollProgress progress={scroll.progress} visible={scroll.scrollable} onClick={pageDown} />
      </div>
    </AboutNavContext.Provider>
  );
}

/** The section the panel opens on: the last one read this session, the overview at first. */
let lastSection: SectionId = 'overview';

/**
 * The tabs: one per section, the current one marked. Arrow keys move between them, as a
 * tab list's should.
 */
function SectionTabs({ current, onSelect }: { current: SectionId; onSelect: (id: SectionId) => void }) {
  const move = (event: React.KeyboardEvent, from: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const target = ABOUT_SECTIONS[(from + step + ABOUT_SECTIONS.length) % ABOUT_SECTIONS.length]!;
    onSelect(target.id);
    document.getElementById(`about-tab-${target.id}`)?.focus();
  };
  return (
    <nav
      role="tablist"
      aria-label="About sections"
      style={{
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.2rem',
      }}
    >
      {ABOUT_SECTIONS.map((entry, position) => {
        const active = entry.id === current;
        return (
          <button
            key={entry.id}
            id={`about-tab-${entry.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={SCROLLER_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(entry.id)}
            onKeyDown={(event) => move(event, position)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
              padding: '0.45rem 0.6rem 0.6rem',
              marginBottom: '-1px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: active ? BRIGHT : MUTED,
            }}
          >
            <span style={{ color: active ? ACCENT : '#4a4a4a', marginRight: '0.4em' }}>{position + 1}</span>
            {entry.tab}
          </button>
        );
      })}
    </nav>
  );
}

/** The heading over a section: the title, what it holds, and its subsections to jump to. */
function SectionHeading({ section }: { section: AboutSection }) {
  const overview = section.id === 'overview';
  return (
    <>
      {overview && (
        <>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              fontWeight: 300,
              textAlign: 'center',
              letterSpacing: '0.02em',
              color: '#f0f0f0',
            }}
          >
            Max&rsquo;s Solar System
          </h1>
          <div style={{ height: 1, background: RULE, margin: '1.1rem 0' }} />
        </>
      )}
      <h2
        style={{
          margin: 0,
          fontSize: overview ? 'clamp(1rem, 2.4vw, 1.3rem)' : 'clamp(1.3rem, 3.2vw, 1.8rem)',
          fontWeight: 300,
          textAlign: 'center',
          color: overview ? '#b8b8b8' : '#f0f0f0',
        }}
      >
        {section.title}
      </h2>
      <p style={{ margin: '0.7rem auto 0', maxWidth: '36rem', textAlign: 'center', color: '#8a8a8a', fontSize: '0.84rem', lineHeight: 1.6 }}>
        {section.blurb}
      </p>
      <SubsectionIndex section={section} />
      <div style={{ height: 1, background: RULE, margin: '1.2rem 0 0' }} />
    </>
  );
}

/** "In this section": the subsections, each a jump to its heading. */
function SubsectionIndex({ section }: { section: AboutSection }) {
  const jump = (sub: string) => scrollToAnchor(anchorId(section.id, sub), true);
  return (
    <nav
      aria-label="In this section"
      style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.35rem', marginTop: '1rem' }}
    >
      {section.subsections.map((sub) => (
        <button
          key={sub.id}
          type="button"
          onClick={() => jump(sub.id)}
          style={{
            background: 'transparent',
            border: `1px solid ${RULE}`,
            borderRadius: '1rem',
            padding: '0.2rem 0.65rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.72rem',
            color: '#9a9a9a',
          }}
        >
          {sub.label}
        </button>
      ))}
    </nav>
  );
}

/** Previous and next, so the whole can still be read straight through. */
function SectionFooter({
  previous,
  next,
  onSelect,
}: {
  previous: AboutSection | undefined;
  next: AboutSection | undefined;
  onSelect: (id: SectionId) => void;
}) {
  const style = {
    background: 'transparent',
    border: `1px solid ${RULE}`,
    borderRadius: '0.3rem',
    padding: '0.5rem 0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    color: '#9a9a9a',
  } as const;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2.5rem', paddingTop: '1.2rem', borderTop: `1px solid ${RULE}` }}>
      {previous === undefined ? (
        <span />
      ) : (
        <button type="button" style={style} onClick={() => onSelect(previous.id)}>
          ← {previous.title}
        </button>
      )}
      {next === undefined ? (
        <span />
      ) : (
        <button type="button" style={{ ...style, color: BRIGHT }} onClick={() => onSelect(next.id)}>
          {next.title} →
        </button>
      )}
    </div>
  );
}

const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * How much of the page is behind you, and that there is a page at all.
 *
 * A ring rather than a bar, at the foot of the column rather than down the edge: on a
 * screen this dark a vertical rule reads as a piece of the design, and a small mark
 * where the text runs out reads as an invitation. It is a button as well as a readout —
 * the arrow is the part that says "there is more", and pressing it acts on that.
 *
 * It fades out over the last stretch rather than at the very end, so it is gone by the
 * time it would be sitting on top of the last paragraph with nothing left to report.
 */
function ScrollProgress({
  progress,
  visible,
  onClick,
}: {
  progress: number;
  visible: boolean;
  onClick: () => void;
}) {
  const opacity = visible ? indicatorOpacity(progress) : 0;

  return (
    // The centring lives on a wrapper rather than on the button, so the button's own
    // transform is free for the press animation every control here shares. A `transform`
    // set inline would beat the stylesheet's and swallow it.
    <div
      style={{
        position: 'absolute',
        bottom: '1.6rem',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity,
        // Untouchable once invisible, so it cannot swallow a click on the text beneath.
        pointerEvents: opacity === 0 ? 'none' : 'auto',
        transition: 'opacity 220ms ease',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="Scroll down"
        aria-hidden={opacity === 0}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '2.6rem',
          height: '2.6rem',
          padding: 0,
          background: 'rgba(4,4,6,0.8)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
          {/* The track, so the ring reads as a fraction of something rather than an arc. */}
          <circle cx="16" cy="16" r={RING_RADIUS} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
          <circle
            cx="16"
            cy="16"
            r={RING_RADIUS}
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            // Start the fill at the top and run it clockwise, the way reading runs.
            transform="rotate(-90 16 16)"
          />
          <polyline
            points="12,14 16,19 20,14"
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export interface ScrollState {
  /** 0 at the top, 1 once the last line is on screen. */
  readonly progress: number;
  /** False when everything already fits, in which case there is nothing to report. */
  readonly scrollable: boolean;
}

/**
 * Where the reader is, from the three numbers a scrolling element exposes.
 *
 * Pulled out of the component because every interesting case here is an edge case and
 * none of them is reachable from a test that has to render a browser: a page that fits,
 * a page one pixel taller than the window, and the rubber-band overscroll that macOS
 * and iOS report as a negative `scrollTop` or as a `scrollTop` past the end.
 */
export function scrollState(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): ScrollState {
  const travel = scrollHeight - clientHeight;
  // A pixel of slack: sub-pixel layout rounding routinely leaves a scrollHeight a
  // fraction taller than the client, and a ring that appears full on a page nobody can
  // scroll is worse than no ring.
  if (travel <= 1) {
    return { progress: 1, scrollable: false };
  }
  return { progress: Math.min(1, Math.max(0, scrollTop / travel)), scrollable: true };
}

/**
 * Fraction of the reading at which the indicator starts getting out of the way.
 *
 * Not at the very end: the last paragraph is the one it would be sitting on top of, and
 * by then it has nothing left to say.
 */
export const INDICATOR_FADE_START = 0.88;

/** How visible the ring is at a given progress, 1 to 0. */
export function indicatorOpacity(progress: number): number {
  if (progress <= INDICATOR_FADE_START) {
    return 1;
  }
  return Math.max(0, 1 - (progress - INDICATOR_FADE_START) / (1 - INDICATOR_FADE_START));
}

const noSubscribe = (): (() => void) => () => {};
