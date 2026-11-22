import { useEffect, useState, type ReactNode } from 'react';

import { FICTION_COLOR, workLine, type FictionEntry } from '../core/fiction.ts';
import { FICTION_ABOUTS, type FictionPhoto } from '../descriptions/fiction/abouts.ts';
import { FICTION_ABOUT_NAMES, fictionAboutKey } from '../descriptions/fiction/ids.ts';
import { useViewStore } from '../state/store.ts';
import { FictionTag } from './FictionTag.tsx';
import { colourNote, PhotoLarge, Photos, type PhotoNote } from './descriptionPhotos.tsx';
import { useClosing } from './Presence.tsx';

/**
 * A fictional thing's "about" (descriptions/fiction/), on the page a real body's description is
 * read on (DescriptionView.tsx) but laid out for fiction: the FICTION tag at its head, the work,
 * then the story, what the canon gives, what this app invented, and the real science of where it
 * is put. Its pictures (abouts.ts FictionPhoto) are renders from this app, real photographs of the
 * real places, or of the creator: each says which, in the grid and opened large, and the real ones
 * carry their credits at the foot, as a real description's do.
 */

/** What a picture is, before its title: a render, or a real photograph and its colours. */
function photoNote(photo: FictionPhoto): PhotoNote {
  if (photo.origin === 'render') return { text: 'Render · this app', colour: FICTION_COLOR };
  if (photo.origin === 'film') return { text: 'Official image', colour: '#7fb2e8' };
  if (photo.origin === 'creator') return { text: 'Real photograph', colour: '#8fc79a' };
  const colours = colourNote(photo);
  return { text: `Real photograph · ${colours.text}`, colour: colours.colour };
}

// The description page's greys, by value, as it takes them.
const TEXT = '#a4a4a4';
const BRIGHT = '#e0e0e0';
const MUTED = '#6a6a6a';
const RULE = '#2a2a2a';

export function FictionAboutView({ record }: { readonly record: FictionEntry }) {
  const togglePanel = useViewStore((state) => state.togglePanel);
  const closing = useClosing();
  const key = fictionAboutKey(record.id);
  const back = (): void => togglePanel('body');
  const [opened, setOpened] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (opened !== null) setOpened(null);
      else back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (key === null) return null;
  const about = FICTION_ABOUTS[key];
  const name = FICTION_ABOUT_NAMES[key];
  return (
    <div
      className={closing ? 'overlay-exit' : 'overlay-enter'}
      role="dialog"
      aria-label={`About ${name}`}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'rgba(4,4,6,0.96)' }}
    >
      <header style={{ flex: 'none', display: 'flex', justifyContent: 'flex-end', padding: '0.9rem 1.2rem 0.8rem', borderBottom: `1px solid ${RULE}` }}>
        <button type="button" onClick={back} style={BUTTON}>
          BACK
        </button>
      </header>
      <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <article style={{ maxWidth: '46rem', width: '100%', padding: '2.2rem 1rem 7rem', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.66rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED }}>{about.kind}</span>
            <FictionTag record={record} />
          </div>
          <h1 style={{ margin: '0.3rem 0 0.3rem', fontSize: '1.6rem', fontWeight: 500, color: BRIGHT }}>{name}</h1>
          <div style={{ margin: '0 0 1.4rem', fontSize: '0.84rem', color: MUTED }}>{workLine(record.work)}</div>
          <Paragraphs paragraphs={about.story} />
          <Photos photos={about.photos} onOpen={setOpened} note={photoNote} />
          <Section title="What the canon gives">
            <Paragraphs paragraphs={about.canon} />
          </Section>
          <Section title="What this app invented">
            <Paragraphs paragraphs={about.invented} />
          </Section>
          <Section title="The real place">
            <Paragraphs paragraphs={about.reality} />
          </Section>
          {about.photos.some((photo) => photo.origin !== 'render') && (
            <Section title="Pictures">
              <ol style={{ margin: 0, paddingLeft: '1.4rem' }}>
                {about.photos
                  .filter((photo) => photo.origin !== 'render')
                  .map((photo) => (
                    <li key={photo.file} style={{ color: TEXT, fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '0.45rem' }}>
                      Photo:{' '}
                      <a href={photo.sourceUrl} target="_blank" rel="noreferrer" style={{ color: TEXT, textDecorationColor: RULE }}>
                        {photo.title}
                      </a>
                      , {photo.credit}. {photo.licence}.
                    </li>
                  ))}
                <li style={{ color: TEXT, fontSize: '0.78rem', lineHeight: 1.6 }}>
                  The renders are this app’s own, of what it draws.
                  {about.photos.some((photo) => photo.origin === 'film') &&
                    ' The films’ official images are shown small, for illustration, in a non-commercial project, and belong to their studios.'}
                </li>
              </ol>
            </Section>
          )}
        </article>
      </div>
      {opened !== null && (
        <PhotoLarge
          photo={about.photos[opened]!}
          note={photoNote}
          onClose={() => setOpened(null)}
          onMove={(by) => setOpened((opened + by + about.photos.length) % about.photos.length)}
        />
      )}
    </div>
  );
}

function Paragraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} style={PARAGRAPH}>
          {paragraph}
        </p>
      ))}
    </>
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
