import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { drawnFromData } from '../descriptions/generated.ts';
import { descriptionOf } from '../descriptions/index.ts';
import { levelReading } from './LevelFacts.tsx';
import { planetarySystemOf } from '../core/planetarySystems.ts';
import type { Description, DescriptionPhoto, DescriptionPoint } from '../descriptions/types.ts';
import { useViewStore } from '../state/store.ts';
import { useClosing } from './Presence.tsx';
import { fictionEntryOfBody, fictionOfReading } from '../core/fiction.ts';
import { FictionAboutView } from './FictionAboutView.tsx';

/**
 * A body's description (descriptions/): a page over the scene, as the About is, read from the
 * body's panel. What it is; its photographs, each saying whether its colours are what an eye
 * would see; then how it is drawn here, what is measured, what is a model's estimate, what is
 * missing and why, and what it corrects -- every claim numbered to its source at the foot.
 */

const photoUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

// The About's greys (about/prose.tsx), here by value: importing them would bring the About's
// references into this page's chunk.
const TEXT = '#a4a4a4';
const BRIGHT = '#e0e0e0';
const MUTED = '#6a6a6a';
const RULE = '#2a2a2a';
const ACCENT = '#9fc3e0';

const COLOUR_ORDER: Record<DescriptionPhoto['colour'], number> = { true: 0, tinted: 1, false: 2 };

const COLOUR_NOTE: Record<DescriptionPhoto['colour'], string> = {
  true: 'True colour',
  tinted: 'Tinted',
  false: 'False colour',
};

/**
 * The page read from a panel: a fictional thing's "about" (FictionAboutView, its own module and
 * layout), or a real body's description -- never one mixed into the other.
 */
export function DescriptionView({ store }: { store: EphemerisStore }) {
  const focus = useViewStore((state) => state.focus);
  const reading = useViewStore((state) => state.reading);
  // The focused fictional thing's own, or one asked for by name: Adrian's over τ Ceti e, a
  // Petrova line's from its name (core/fiction.ts fictionReadingId).
  const fiction = reading === null ? fictionEntryOfBody(focus) : fictionOfReading(reading);
  return fiction !== null ? <FictionAboutView record={fiction} /> : <BodyDescriptionView store={store} />;
}

function BodyDescriptionView({ store }: { store: EphemerisStore }) {
  const focus = useViewStore((state) => state.focus);
  const reading = useViewStore((state) => state.reading);
  const togglePanel = useViewStore((state) => state.togglePanel);
  const closePanel = useViewStore((state) => state.closePanel);
  const closing = useClosing();
  const description = descriptionOf(reading ?? focus);
  // What is no body (the Milky Way, the CMB) names itself; there is no panel to go back to.
  const subject = description?.subject ?? null;
  const body = store.body(focus);
  const name = subject?.name ?? body.name;
  const kind = subject?.kind ?? body.kind.replace('-', ' ');
  // Back to the panel it was opened from: the focus's, or the level's selected (LevelFacts.tsx).
  const selectedLevel = useViewStore((state) => state.selectedLevel);
  const back = (): void =>
    reading === null || (selectedLevel !== null && levelReading(selectedLevel, planetarySystemOf(focus))?.id === reading)
      ? togglePanel('body')
      : closePanel();
  const [opened, setOpened] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  /**
   * A citation's source, brought into view by scrolling this page's own column and nothing
   * else. scrollIntoView scrolls every ancestor that can scroll -- the app's own frame too,
   * which hides its overflow but still moves -- and it shifted the whole app up out of its
   * window (Maxi, 2026-11-17: "toque el dos y me rompio todo").
   */
  const goToSource = (key: string): void => {
    const box = scroller.current;
    const target = document.getElementById(`source-${key}`);
    if (box === null || target === null) return;
    const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - box.clientHeight / 3;
    box.scrollTo({ top, behavior: 'smooth' });
  };

  // Escape goes back to the body's panel, unless a photo is open: then it closes the photo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (opened !== null) setOpened(null);
      else back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A craft's path says which dates it runs between; a planet's coverage is not quoted. What is
  // no body has nothing worked out from data.
  const generated = useMemo(
    () => (subject === null ? drawnFromData(body, store.coverage(focus)) : []),
    [subject, body, store, focus],
  );
  // True colour first, then tinted, then false: what an eye would see before the conventions.
  const photos = useMemo(
    () => [...(description?.photos ?? [])].sort((a, b) => COLOUR_ORDER[a.colour] - COLOUR_ORDER[b.colour]),
    [description],
  );
  if (description === null) return null;
  const numbers = new Map(description.sources.map((source, index) => [source.key, index + 1]));

  return (
    <div
      className={closing ? 'overlay-exit' : 'overlay-enter'}
      role="dialog"
      aria-label={`About ${name}`}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'rgba(4,4,6,0.96)' }}
    >
      <header
        style={{
          flex: 'none',
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0.9rem 1.2rem 0.8rem',
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        <button type="button" onClick={back} style={BUTTON}>
          BACK
        </button>
      </header>
      <div ref={scroller} className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <article style={{ maxWidth: '46rem', width: '100%', padding: '2.2rem 1rem 7rem', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '0.66rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED }}>
            {kind}
          </div>
          <h1 style={{ margin: '0.3rem 0 1.4rem', fontSize: '1.6rem', fontWeight: 500, color: BRIGHT }}>{name}</h1>
          {description.lead.map((paragraph) => (
            <p key={paragraph} style={PARAGRAPH}>
              {paragraph}
            </p>
          ))}

          <Photos photos={photos} onOpen={setOpened} />

          {description.sections?.map((section) => (
            <Section key={section.title} title={section.title}>
              {section.text?.map((paragraph) => (
                <p key={paragraph} style={PARAGRAPH}>
                  {paragraph}
                </p>
              ))}
              <Points points={section.points} numbers={numbers} onCite={goToSource} />
            </Section>
          ))}

          <Section title="How it is drawn here">
            <Points points={[...generated, ...description.drawnHere]} numbers={numbers} onCite={goToSource} />
          </Section>
          <Section title="Measured">
            <Points points={description.measured} numbers={numbers} onCite={goToSource} />
          </Section>
          <Section title="Estimated, from models">
            <Points points={description.estimated} numbers={numbers} onCite={goToSource} />
          </Section>
          <Section title="Not known, or not drawn">
            <Points points={description.missing} numbers={numbers} onCite={goToSource} />
          </Section>
          <Section title="What people often get wrong">
            <Points points={description.misconceptions} numbers={numbers} onCite={goToSource} />
          </Section>
          <Section title="Sources">
            <Sources description={description} />
          </Section>
        </article>
      </div>
      {opened !== null && (
        <PhotoLarge
          photo={photos[opened]!}
          onClose={() => setOpened(null)}
          onMove={(by) => setOpened((opened + by + photos.length) % photos.length)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2
        style={{
          margin: '2.2rem 0 0.8rem',
          paddingBottom: '0.35rem',
          borderBottom: `1px solid ${RULE}`,
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Points({
  points,
  numbers,
  onCite,
}: {
  points: readonly DescriptionPoint[];
  numbers: ReadonlyMap<string, number>;
  onCite: (key: string) => void;
}) {
  return (
    <ul style={{ margin: '0 0 1.1rem', paddingLeft: '1.1rem' }}>
      {points.map((point) => (
        <li key={point.title} style={{ color: TEXT, fontSize: '0.84rem', lineHeight: 1.7, marginBottom: '0.7rem' }}>
          <strong style={{ color: BRIGHT, fontWeight: 600 }}>{point.title}</strong>
          {'. '}
          {point.text}
          {point.cite !== undefined && point.cite.length > 0 && (
            <span style={{ whiteSpace: 'nowrap', fontSize: '0.92em' }}>
              {' ['}
              {point.cite.map((key, index) => (
                <span key={key}>
                  {index > 0 && ', '}
                  <button
                    type="button"
                    title="Go to this source"
                    onClick={() => onCite(key)}
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: ACCENT, cursor: 'pointer' }}
                  >
                    {numbers.get(key) ?? '?'}
                  </button>
                </span>
              ))}
              {']'}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Sources({ description }: { description: Description }) {
  return (
    <ol style={{ margin: 0, paddingLeft: '1.4rem' }}>
      {description.sources.map((source) => (
        <li key={source.key} id={`source-${source.key}`} style={{ color: TEXT, fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '0.45rem' }}>
          {source.url === undefined ? (
            source.text
          ) : (
            <a href={source.url} target="_blank" rel="noreferrer" style={{ color: TEXT, textDecorationColor: RULE }}>
              {source.text}
            </a>
          )}
        </li>
      ))}
      {description.photos.map((photo) => (
        <li key={photo.file} style={{ color: TEXT, fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '0.45rem' }}>
          Photo: <a href={photo.sourceUrl} target="_blank" rel="noreferrer" style={{ color: TEXT, textDecorationColor: RULE }}>{photo.title}</a>, {photo.credit}. {photo.licence}.
        </li>
      ))}
    </ol>
  );
}

function Photos({ photos, onOpen }: { photos: readonly DescriptionPhoto[]; onOpen: (index: number) => void }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))', gap: '0.8rem', margin: '1.6rem 0 0.4rem' }}>
      {photos.map((photo, index) => (
        <figure key={photo.file} style={{ margin: 0 }}>
          <button
            type="button"
            onClick={() => onOpen(index)}
            title="Open larger"
            style={{ display: 'block', width: '100%', padding: 0, border: `1px solid ${RULE}`, borderRadius: '0.3rem', background: '#000', cursor: 'zoom-in', overflow: 'hidden' }}
          >
            <img
              src={photoUrl(photo.file)}
              alt={photo.title}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              style={{ display: 'block', width: '100%', height: '7.5rem', objectFit: 'cover' }}
            />
          </button>
          <figcaption style={{ marginTop: '0.35rem', fontSize: '0.7rem', lineHeight: 1.45, color: TEXT }}>
            <span style={{ color: photo.colour === 'true' ? '#8fc79a' : '#c9a86a' }}>{COLOUR_NOTE[photo.colour]}</span>
            {' · '}
            {photo.title}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function PhotoLarge({ photo, onClose, onMove }: { photo: DescriptionPhoto; onClose: () => void; onMove: (by: number) => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') onMove(-1);
      if (event.key === 'ArrowRight') onMove(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMove]);
  return (
    <div
      role="dialog"
      aria-label={photo.title}
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', boxSizing: 'border-box', cursor: 'zoom-out' }}
    >
      <img
        src={photoUrl(photo.largeFile)}
        alt={photo.title}
        style={{ maxWidth: '100%', maxHeight: 'calc(100% - 7rem)', objectFit: 'contain' }}
      />
      <div style={{ maxWidth: '46rem', marginTop: '0.9rem', color: TEXT, fontSize: '0.8rem', lineHeight: 1.55, textAlign: 'center' }}>
        <div style={{ color: BRIGHT, marginBottom: '0.25rem' }}>{photo.title}</div>
        <span style={{ color: photo.colour === 'true' ? '#8fc79a' : '#c9a86a' }}>{COLOUR_NOTE[photo.colour]}</span>
        {' · '}
        {photo.caption} <span style={{ color: MUTED }}>{photo.credit}, {photo.date}.</span>
      </div>
    </div>
  );
}

const PARAGRAPH = { color: TEXT, fontSize: '0.92rem', lineHeight: 1.8, margin: '0 0 1.1rem' } as const;

const BUTTON = {
  background: 'rgba(4,4,6,0.8)',
  border: `1px solid ${RULE}`,
  borderRadius: '0.3rem',
  color: '#8a8a8a',
  cursor: 'pointer',
  padding: '0.3rem 0.7rem',
  fontFamily: 'inherit',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
} as const;
