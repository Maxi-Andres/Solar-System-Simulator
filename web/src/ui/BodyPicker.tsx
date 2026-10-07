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
 *
 * The spacecraft come last, in a section of their own rather than folded under the
 * bodies they happen to be near. One that does not exist at the clock's instant -- not
 * launched yet, or past the end of its trajectory -- is listed but cannot be chosen,
 * and says which: there is nowhere to put the camera.
 */

const ACCENT = '#3ddc84';

export interface BodyPickerProps {
  readonly store: EphemerisStore;
  readonly focus: BodyId;
  readonly onFocus: (id: BodyId) => void;
  /** Body kinds switched on in the layers panel; the list shows only those. */
  readonly visibleKinds: ReadonlySet<string>;
  /** The clock's instant, TDB: a spacecraft can only be chosen while it exists. */
  readonly jd: number;
}

export function BodyPicker({ store, focus, onFocus, visibleKinds, jd }: BodyPickerProps) {
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
          jd={jd}
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

/** Why a spacecraft cannot be chosen right now, or null when it can. */
export function craftUnavailability(store: EphemerisStore, id: BodyId, jd: number): string | null {
  const span = store.coverage(id);
  if (span === null) {
    return 'no data';
  }
  if (jd < span.startJd) {
    return `from ${calendarYear(span.startJd)}`;
  }
  if (jd > span.stopJd) {
    return `until ${calendarYear(span.stopJd)}`;
  }
  return null;
}

/** Where a spacecraft is, for grouping the list: what it moves with. */
export type CraftGroup = 'interplanetary' | 'near-earth' | 'planets';

/** The groups in the order they are listed, with their headings. */
export const CRAFT_GROUPS: readonly { readonly id: CraftGroup; readonly label: string }[] = [
  { id: 'interplanetary', label: 'Interplanetary' },
  { id: 'near-earth', label: 'Near Earth' },
  { id: 'planets', label: 'At other planets' },
];

/**
 * Which group a craft is listed under, from what it hangs off in the frame tree: nothing
 * for one in orbit about the Sun, Earth or the Moon for one that moves with Earth -- the
 * Lagrange-point observatories, the lunar missions -- and another planet otherwise.
 */
export function craftGroup(store: EphemerisStore, body: BodyDefinition): CraftGroup {
  if (body.parent === null) {
    return 'interplanetary';
  }
  const nearEarth = body.parent === 'earth' || store.body(body.parent).parent === 'earth';
  return nearEarth ? 'near-earth' : 'planets';
}

/** The calendar year a Julian day falls in, near enough for a label. */
function calendarYear(jd: number): number {
  return new Date((jd - 2440587.5) * 86_400_000).getUTCFullYear();
}

function BodyList({
  store,
  focus,
  visibleKinds,
  jd,
  onChoose,
}: {
  store: EphemerisStore;
  focus: BodyId;
  visibleKinds: ReadonlySet<string>;
  jd: number;
  onChoose: (id: BodyId) => void;
}) {
  const closing = useClosing();
  const focusBody = store.body(focus);
  const system = focusBody.parent ?? focusBody.id;

  // The system you are in starts unfolded, and so does the focused craft's group; the
  // rest start folded. Group keys share the set, prefixed so no body id can collide.
  const [expanded, setExpanded] = useState<ReadonlySet<BodyId>>(() =>
    focusBody.kind === 'spacecraft'
      ? new Set([system, `craft:${craftGroup(store, focusBody)}`])
      : new Set([system]),
  );

  const primaries = store.bodies.filter(
    (body) => body.parent === null && body.kind !== 'spacecraft' && visibleKinds.has(body.kind),
  );
  // Moons only: JWST hangs off Earth in the frame tree, and is listed with the craft.
  const moonsOf = (id: BodyId): BodyDefinition[] =>
    visibleKinds.has('moon')
      ? store.bodies.filter((body) => body.parent === id && body.kind === 'moon')
      : [];
  const craft = visibleKinds.has('spacecraft')
    ? store.bodies.filter((body) => body.kind === 'spacecraft')
    : [];

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
      {craft.length > 0 && (
        <>
          <div
            style={{
              margin: '0.45rem 0.45rem 0.2rem',
              paddingTop: '0.45rem',
              borderTop: '1px solid #242424',
              color: '#5a5a5a',
              fontSize: '0.6rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Spacecraft
          </div>
          {CRAFT_GROUPS.map((group) => {
            const members = craft.filter((body) => craftGroup(store, body) === group.id);
            if (members.length === 0) {
              return null;
            }
            const key = `craft:${group.id}`;
            const unfolded = expanded.has(key);
            return (
              <div key={key}>
                <button
                  type="button"
                  aria-expanded={unfolded}
                  aria-label={`${unfolded ? 'Hide' : 'Show'} ${group.label.toLowerCase()} spacecraft`}
                  onClick={() => toggle(key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0.25rem',
                    padding: '0.3rem 0.45rem',
                    cursor: 'pointer',
                    color: '#8a8a8a',
                    fontFamily: 'inherit',
                    fontSize: '0.7rem',
                    letterSpacing: '0.04em',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1 }}>{group.label}</span>
                  <span style={{ color: '#5a5a5a', fontSize: '0.62rem' }}>{members.length}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      transform: unfolded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 160ms ease',
                      fontSize: '0.8rem',
                      lineHeight: 1,
                      color: '#6a6a6a',
                    }}
                  >
                    &rsaquo;
                  </span>
                </button>
                {unfolded &&
                  members.map((body) => (
                    <Row
                      key={body.id}
                      body={body}
                      indent
                      active={body.id === focus}
                      inSystem={false}
                      onChoose={onChoose}
                      unavailable={craftUnavailability(store, body.id, jd)}
                      trailing={null}
                    />
                  ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Row({
  body,
  active,
  inSystem,
  indent = false,
  unavailable = null,
  onChoose,
  trailing,
}: {
  body: BodyDefinition;
  active: boolean;
  /** The planet whose moon is in focus: marked, more quietly than the focus itself. */
  inSystem: boolean;
  indent?: boolean;
  /** Why this row cannot be chosen at the clock's instant, or null when it can. */
  unavailable?: string | null;
  onChoose: (id: BodyId) => void;
  trailing: React.ReactNode;
}) {
  const craft = body.kind === 'spacecraft';
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        role="option"
        aria-selected={active}
        aria-disabled={unavailable !== null}
        disabled={unavailable !== null}
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
          color: active
            ? ACCENT
            : unavailable !== null
              ? '#4e4e4e'
              : inSystem
                ? '#e8e8e8'
                : '#a8a8a8',
          fontFamily: 'inherit',
          fontSize: indent || craft ? '0.72rem' : '0.78rem',
          letterSpacing: '0.03em',
          cursor: unavailable === null ? 'pointer' : 'default',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: indent || craft ? '0.4rem' : '0.5rem',
            height: indent || craft ? '0.4rem' : '0.5rem',
            // Planets filled, moons as rings, so a moon reads as belonging to the row
            // above it even before the indent does. A spacecraft is a diamond, as its
            // marker is in the scene.
            borderRadius: craft ? 0 : '50%',
            transform: craft ? 'rotate(45deg)' : 'none',
            background: indent || craft ? 'transparent' : body.color,
            border: indent || craft ? `1px solid ${body.color}` : 'none',
            opacity: unavailable === null ? 1 : 0.4,
            flex: 'none',
          }}
        />
        <span style={{ flex: 1 }}>{body.name}</span>
        {unavailable !== null && (
          <span style={{ fontSize: '0.6rem', color: '#4e4e4e', letterSpacing: '0.04em' }}>
            {unavailable}
          </span>
        )}
      </button>
      {trailing}
    </div>
  );
}
