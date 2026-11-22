import { useEffect } from 'react';

import type { DescriptionPhoto } from '../descriptions/types.ts';

/**
 * The photographs of a description page (DescriptionView.tsx) and of a fictional thing's about
 * (FictionAboutView.tsx): a grid of thumbnails, each with a note of what it is before its title,
 * and one opened large with its caption and credit. A real body's note says whether its colours
 * are an eye's; fiction's says whether a picture is a render from this app or a real photograph.
 */

const photoUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const TEXT = '#a4a4a4';
const BRIGHT = '#e0e0e0';
const MUTED = '#6a6a6a';
const RULE = '#2a2a2a';

/** What a photo's note says before its title, and in what colour. */
export interface PhotoNote {
  readonly text: string;
  readonly colour: string;
}

const COLOUR_NOTE: Record<DescriptionPhoto['colour'], string> = {
  true: 'True colour',
  tinted: 'Tinted',
  false: 'False colour',
};

/** A real photograph's note: whether its colours are what an eye would see. */
export function colourNote(photo: DescriptionPhoto): PhotoNote {
  return { text: COLOUR_NOTE[photo.colour], colour: photo.colour === 'true' ? '#8fc79a' : '#c9a86a' };
}

export function Photos<P extends DescriptionPhoto>({
  photos,
  onOpen,
  note = colourNote,
}: {
  photos: readonly P[];
  onOpen: (index: number) => void;
  note?: (photo: P) => PhotoNote;
}) {
  if (photos.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))', gap: '0.8rem', margin: '1.6rem 0 0.4rem' }}>
      {photos.map((photo, index) => {
        const said = note(photo);
        return (
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
              <span style={{ color: said.colour }}>{said.text}</span>
              {' · '}
              {photo.title}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function PhotoLarge<P extends DescriptionPhoto>({
  photo,
  onClose,
  onMove,
  note = colourNote,
}: {
  photo: P;
  onClose: () => void;
  onMove: (by: number) => void;
  note?: (photo: P) => PhotoNote;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') onMove(-1);
      if (event.key === 'ArrowRight') onMove(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMove]);
  const said = note(photo);
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
        <span style={{ color: said.colour }}>{said.text}</span>
        {' · '}
        {photo.caption} <span style={{ color: MUTED }}>{photo.credit}, {photo.date}.</span>
      </div>
    </div>
  );
}
