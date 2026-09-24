import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { useEffect, useRef, useState } from 'react';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { Presence, useClosing } from './Presence.tsx';

/**
 * The breadcrumb, and the list of bodies that drops down from it.
 *
 * It replaced a wall of buttons. Ten planets were already two rows of them; with the
 * moons it became three, and the row that mattered -- the one you were in -- was the
 * hardest to find. Now the breadcrumb is all that stays on screen, saying where you are,
 * and the list is one click away, in the order the Solar System has it: the Sun, then
 * every planet outward, each with its moons folded underneath. The system you are in
 * starts unfolded, because those are the moons you are most likely to want next.
 *
 * Every tier of the breadcrumb is itself a way up: from Io, "Jupiter" goes to Jupiter,
 * "Solar System" to the Sun.
 */

const ACCENT = '#3ddc84';

export interface BodyPickerProps {
  readonly store: EphemerisStore;
  readonly focus: BodyId;
  readonly onFocus: (id: BodyId) => void;
  /** Body kinds switched on in the layers panel; the list shows only those. */
  readonly visibleKinds: ReadonlySet<string>;
}

export function BodyPicker({ store, focus, onFocus, visibleKinds }: BodyPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const focusBody = store.body(focus);
  const parent = focusBody.parent === null ? null : store.body(focusBody.parent);

  // Closes on a click anywhere else and on Escape, like any menu.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id: BodyId): void => {
    onFocus(id);
    setOpen(false);
  };

  return (
    <div ref={root} style={{ position: 'absolute', top: '1rem', left: '1.25rem' }}>
      <nav
        aria-label="Where you are"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          letterSpacing: '0.22em',
          fontSize: '0.78rem',
          textTransform: 'uppercase',
        }}
      >
        <Crumb onClick={() => onFocus('sun')}>Solar System</Crumb>
        <Separator />
        {parent !== null && (
          <>
            <Crumb onClick={() => onFocus(parent.id)}>{parent.name}</Crumb>
            <Separator />
          </>
        )}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{
            ...crumbStyle,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          {focusBody.name}
          <Caret open={open} />
        </button>
      </nav>

      <Presence show={open}>
        <BodyList
          store={store}
          focus={focus}
          visibleKinds={visibleKinds}
          onChoose={choose}
        />
      </Presence>
    </div>
  );
}

const crumbStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '0.15rem 0.1rem',
  margin: 0,
  font: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  color: '#c8c8c8',
  cursor: 'pointer',
  borderRadius: '0.2rem',
};

function Crumb({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={crumbStyle}>
      {children}
    </button>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" style={{ color: '#4a4a4a' }}>
      &rsaquo;
    </span>
  );
}

/** A small chevron that turns when the list is open. */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 160ms ease',
      }}
    >
      <path d="M1.5 3.5 L5 7 L8.5 3.5" fill="none" stroke="#8a8a8a" strokeWidth="1.4" />
    </svg>
  );
}

function BodyList({
  store,
  focus,
  visibleKinds,
  onChoose,
}: {
  store: EphemerisStore;
  focus: BodyId;
  visibleKinds: ReadonlySet<string>;
  onChoose: (id: BodyId) => void;
}) {
  const closing = useClosing();
  const focusBody = store.body(focus);
  const system = focusBody.parent ?? focusBody.id;

  // The system you are in starts unfolded; the rest start folded.
  const [expanded, setExpanded] = useState<ReadonlySet<BodyId>>(() => new Set([system]));

  const primaries = store.bodies.filter(
    (body) => body.parent === null && visibleKinds.has(body.kind),
  );
  const moonsOf = (id: BodyId): BodyDefinition[] =>
    visibleKinds.has('moon') ? store.bodies.filter((body) => body.parent === id) : [];

  const toggle = (id: BodyId): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      role="listbox"
      aria-label="Bodies"
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{
        marginTop: '0.55rem',
        width: '13.5rem',
        maxHeight: '70vh',
        overflowY: 'auto',
        background: 'rgba(14,14,17,0.94)',
        border: '1px solid #262626',
        borderRadius: '0.4rem',
        padding: '0.35rem',
        backdropFilter: 'blur(6px)',
      }}
    >
      {primaries.map((body) => {
        const moons = moonsOf(body.id);
        const open = expanded.has(body.id);
        return (
          <div key={body.id}>
            <Row
              body={body}
              active={body.id === focus}
              inSystem={body.id === system && body.id !== focus}
              onChoose={onChoose}
              trailing={
                moons.length > 0 && (
                  <button
                    type="button"
                    aria-label={`${open ? 'Hide' : 'Show'} the moons of ${body.name}`}
                    aria-expanded={open}
                    onClick={() => toggle(body.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '0.2rem 0.35rem',
                      cursor: 'pointer',
                      color: '#6a6a6a',
                      fontSize: '0.62rem',
                      letterSpacing: '0.04em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      borderRadius: '0.2rem',
                    }}
                  >
                    {moons.length}
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        transform: open ? 'rotate(90deg)' : 'none',
                        transition: 'transform 160ms ease',
                        fontSize: '0.8rem',
                        lineHeight: 1,
                      }}
                    >
                      &rsaquo;
                    </span>
                  </button>
                )
              }
            />
            {open &&
              moons.map((moon) => (
                <Row
                  key={moon.id}
                  body={moon}
                  indent
                  active={moon.id === focus}
                  inSystem={false}
                  onChoose={onChoose}
                  trailing={null}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

function Row({
  body,
  active,
  inSystem,
  indent = false,
  onChoose,
  trailing,
}: {
  body: BodyDefinition;
  active: boolean;
  /** The planet whose moon is in focus: marked, more quietly than the focus itself. */
  inSystem: boolean;
  indent?: boolean;
  onChoose: (id: BodyId) => void;
  trailing: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={() => onChoose(body.id)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textAlign: 'left',
          background: active ? '#1e2a24' : 'transparent',
          border: 'none',
          borderRadius: '0.25rem',
          padding: `0.3rem 0.45rem 0.3rem ${indent ? '1.55rem' : '0.45rem'}`,
          color: active ? ACCENT : inSystem ? '#e8e8e8' : '#a8a8a8',
          fontFamily: 'inherit',
          fontSize: indent ? '0.72rem' : '0.78rem',
          letterSpacing: '0.03em',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: indent ? '0.4rem' : '0.5rem',
            height: indent ? '0.4rem' : '0.5rem',
            borderRadius: '50%',
            // Planets filled, moons as rings, so a moon reads as belonging to the row
            // above it even before the indent does.
            background: indent ? 'transparent' : body.color,
            border: indent ? `1px solid ${body.color}` : 'none',
            flex: 'none',
          }}
        />
        {body.name}
      </button>
      {trailing}
    </div>
  );
}
