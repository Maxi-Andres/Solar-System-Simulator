import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import type { GlossaryPhoto } from './glossaryPhotos.ts';
import { BRIGHT, MUTED, RULE } from './prose.tsx';

/**
 * A glossary photograph opened large: centred over a dimmed screen, its credit under it.
 *
 * The larger copy (glossary/large/) is fetched only now, with the small one -- already in hand --
 * stretched in its place until it arrives. It is shown as large as the window allows but never
 * past twice its own pixels, so a small source (Sirius B's is 369 pixels) is not blown up into
 * a blur.
 *
 * A modal dialog: focus moves into it and stays there, Tab cycling through its buttons, and on
 * closing returns to the photo it shows -- the one opened, or the one the arrows have reached.
 * Closed by Escape, by its button, or by a click anywhere off the picture; the arrow keys and the
 * two side buttons step through the photos in the glossary's order.
 */

export interface LightboxPhoto {
  /** The glossary entry it belongs to. */
  readonly term: string;
  readonly photo: GlossaryPhoto;
}

/** The DOM id of a photo's own button in the glossary, where focus goes back to. */
export function photoButtonId(term: string): string {
  return `about-glossary-photo-${term}`;
}

const glossaryUrl = (path: string): string => `${import.meta.env.BASE_URL}glossary/${path}`;

/** The caption's room under the picture, and the side buttons' beside it. */
const CAPTION_REM = 7;
const SIDE_REM = 3.4;

const buttonStyle = {
  background: 'rgba(4,4,6,0.8)',
  border: `1px solid ${RULE}`,
  borderRadius: '0.3rem',
  color: '#8a8a8a',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

export function Lightbox({
  photos,
  index,
  onClose,
  onMove,
}: {
  readonly photos: readonly LightboxPhoto[];
  readonly index: number;
  readonly onClose: () => void;
  readonly onMove: (index: number) => void;
}) {
  const current = photos[index]!;
  const { photo } = current;
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // The photo shown last, for focus to go back to on closing.
  const shown = useRef(current.term);
  shown.current = current.term;
  const [loaded, setLoaded] = useState<string | null>(null);

  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => {
      (document.getElementById(photoButtonId(shown.current)) ?? opener)?.focus();
    };
  }, []);

  // The page under it does not scroll while it is open.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const step = (by: number): void => onMove((index + by + photos.length) % photos.length);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'Tab') {
      // Kept inside: from the last button back to the first, and the other way.
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const at = focusable.indexOf(document.activeElement as HTMLElement);
      if (at < 0) {
        // On the dialog itself, after a click on the picture.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && at === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && at === focusable.length - 1) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const { width, height } = photo.large;
  // As large as the window allows, never past twice its own pixels.
  const boxWidth = `min(calc(100vw - ${2 * SIDE_REM + 1}rem), calc((100vh - ${CAPTION_REM + 2}rem) * ${width / height}), ${2 * width}px)`;
  const isLoaded = loaded === current.term;

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      aria-describedby="about-lightbox-credit"
      // Focusable itself, so a click on the picture keeps the keys here.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.985)',
        padding: '1rem 0',
        boxSizing: 'border-box',
        outline: 'none',
      }}
    >
      <figure
        style={{ margin: 0, width: boxWidth, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${width} / ${height}`,
            background: '#0b0b0e',
            borderRadius: '0.2rem',
            overflow: 'hidden',
          }}
        >
          {/* The small one, already in hand, until the large one is in. */}
          <img
            src={glossaryUrl(photo.file)}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'blur(2px)' }}
          />
          <img
            key={current.term}
            src={glossaryUrl(`large/${photo.file}`)}
            alt={photo.alt}
            width={width}
            height={height}
            decoding="async"
            onLoad={() => setLoaded(current.term)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          />
        </div>
        <figcaption style={{ marginTop: '0.55rem', lineHeight: 1.45, maxHeight: `${CAPTION_REM - 1}rem`, overflow: 'hidden' }}>
          <span style={{ color: BRIGHT, fontSize: '0.8rem' }}>{photo.alt}</span>
          <span style={{ color: MUTED, fontSize: '0.7rem' }}>{`  ${index + 1} / ${photos.length}`}</span>
          <span id="about-lightbox-credit" style={{ display: 'block', color: MUTED, fontSize: '0.7rem' }}>
            {`Credit: ${photo.credit}`}
          </span>
        </figcaption>
      </figure>

      <button
        ref={closeButton}
        type="button"
        onClick={onClose}
        aria-label="Close the photo"
        style={{ ...buttonStyle, position: 'absolute', top: '0.9rem', right: '1.2rem', padding: '0.3rem 0.7rem', fontSize: '0.72rem', letterSpacing: '0.1em' }}
      >
        CLOSE
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            title="Previous photo (←)"
            style={{ ...buttonStyle, position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: `${SIDE_REM - 0.8}rem`, height: '3.2rem', fontSize: '1.3rem' }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            title="Next photo (→)"
            style={{ ...buttonStyle, position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: `${SIDE_REM - 0.8}rem`, height: '3.2rem', fontSize: '1.3rem' }}
          >
            ›
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
