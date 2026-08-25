import { useEffect, useState } from 'react';

import { SimClock, WARP_RATES } from '../core/time.ts';

/**
 * Time controls.
 *
 *   ● LIVE   2026-08-25 10:25:30 UTC
 *   ‹ [⏸] [▶]  [◀◀] [▶▶]   [1s/s  1min/s  1hr/s  1day/s ...]
 *
 * The LIVE indicator and the date sit on top, since they are the answer to "what am
 * I looking at". Everything else folds behind a single chevron, so the bar reduces
 * to two lines when the scene matters more than the controls. Collapsed, it still
 * reports what time is doing — "paused", "1 day/s", "-1 mo/s" — so hiding the
 * controls never costs you that.
 *
 * Pause and play are separate buttons rather than one toggle, and **play always
 * means the same thing: run forward at real time**, one simulated second per real
 * second, from wherever you are.
 *
 * That is deliberately the simplest possible rule. A toggle has to guess what
 * "resume" means, and the guess was wrong in the case that matters: rewind four
 * months to find a moment, and a toggle resumes at the stored negative rate, flinging
 * you backwards again. Remembering the last forward rate fixes the direction but not
 * the surprise — press play after rewinding at a month per second and you shoot
 * forward at a month per second. Real time is the one answer that is never
 * surprising. The rate ladder and fast-forward are there when you want speed.
 *
 * Rewind is the only control that ever runs time backwards.
 */

export const RATES: readonly (readonly [string, number])[] = [
  ['1 s', WARP_RATES.realTime],
  ['1 min', 60],
  ['1 hr', WARP_RATES.hourPerSecond],
  ['1 day', WARP_RATES.dayPerSecond],
  ['1 wk', WARP_RATES.weekPerSecond],
  ['1 mo', WARP_RATES.monthPerSecond],
  ['1 yr', WARP_RATES.yearPerSecond],
];

export interface TimeControlsProps {
  readonly clock: SimClock;
  readonly exact: boolean;
  /** Bumped by the parent each readout tick, so the display keeps up. */
  readonly tick: number;
}

export function TimeControls({ clock, exact, tick }: TimeControlsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);

  // Keep the field in sync while the clock runs, without fighting typing.
  useEffect(() => {
    if (!editing) {
      setDraft(clock.date.toISOString().slice(0, 19));
    }
  }, [editing, clock, tick]);

  const applyDate = (value: string): void => {
    const parsed = new Date(`${value}Z`);
    if (!Number.isNaN(parsed.getTime())) {
      clock.setDate(parsed);
    }
  };

  const reversed = clock.mode === 'warp' && clock.rate < 0;
  const paused = clock.mode === 'paused';
  const forward = clock.mode !== 'paused' && !reversed;
  const activeRate = RATES.find(
    ([, rate]) => clock.mode === 'warp' && Math.abs(clock.rate) === rate,
  );

  const summary = paused
    ? 'paused'
    : activeRate === undefined
      ? 'real time'
      : `${reversed ? '−' : ''}${activeRate[0]}/s`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Top row: state and date. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
        <span
          style={{
            width: '0.55rem',
            height: '0.55rem',
            borderRadius: '50%',
            background: clock.isLive ? '#3ddc84' : '#5a5a5a',
            flexShrink: 0,
          }}
        />
        <button
          type="button"
          onClick={() => clock.goLive()}
          title="Jump back to the current time"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            letterSpacing: '0.22em',
            fontWeight: 700,
            fontSize: '0.82rem',
            fontFamily: 'inherit',
            color: clock.isLive ? '#3ddc84' : '#8a8a8a',
            cursor: 'pointer',
          }}
        >
          LIVE
        </button>

        <input
          type="datetime-local"
          step="1"
          value={draft}
          onFocus={() => setEditing(true)}
          onBlur={(event) => {
            setEditing(false);
            applyDate(event.target.value);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            applyDate(event.target.value);
          }}
          style={{
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid #2a2a2a',
            borderRadius: '0.25rem',
            color: '#c8c8c8',
            fontFamily: 'inherit',
            fontSize: '0.76rem',
            padding: '0.2rem 0.35rem',
            colorScheme: 'dark',
          }}
        />

        {!exact && (
          <span
            style={{
              color: '#e0a33d',
              fontSize: '0.66rem',
              letterSpacing: '0.1em',
              border: '1px solid #3a2f1a',
              borderRadius: '0.2rem',
              padding: '0.08rem 0.3rem',
            }}
            title="Outside the downloaded ephemeris window: positions are propagated, not interpolated."
          >
            APPROXIMATE
          </span>
        )}
      </div>

      {/* Bottom row: one chevron folds all of it away. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          title={open ? 'Hide time controls' : 'Show time controls'}
          aria-label={open ? 'Hide time controls' : 'Show time controls'}
          aria-expanded={open}
          style={{
            display: 'grid',
            placeItems: 'center',
            width: '1.15rem',
            height: '1.55rem',
            background: 'transparent',
            border: 'none',
            color: '#5a5a5a',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)' }}
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        {open ? (
          <>
            {/* Pause and play: two buttons, no ambiguity about what resume means. */}
            <div style={{ display: 'flex', gap: '0.28rem' }}>
              <TimeButton onClick={() => clock.pause()} active={paused} title="Pause">
                <Glyph>
                  <path d="M9 5v14" strokeWidth="2.4" />
                  <path d="M15 5v14" strokeWidth="2.4" />
                </Glyph>
              </TimeButton>

              <TimeButton
                onClick={() => clock.setRate(WARP_RATES.realTime)}
                active={forward && Math.abs(clock.rate) === WARP_RATES.realTime}
                title="Play forward from here, at real time"
              >
                <Glyph>
                  <path d="M7 5l12 7-12 7V5Z" />
                </Glyph>
              </TimeButton>
            </div>

            {/* Rewind and fast-forward: each press steps one rung up the ladder. */}
            <div style={{ display: 'flex', gap: '0.28rem' }}>
              <TimeButton
                onClick={() => stepRate(clock, -1)}
                active={reversed}
                title="Rewind, or go faster if already rewinding"
              >
                <Glyph>
                  <path d="M11 5 4 12l7 7V5Z" />
                  <path d="M20 5l-7 7 7 7V5Z" />
                </Glyph>
              </TimeButton>

              <TimeButton
                onClick={() => stepRate(clock, 1)}
                active={forward && clock.mode === 'warp' && Math.abs(clock.rate) !== WARP_RATES.realTime}
                title="Fast forward, or go faster if already forward"
              >
                <Glyph>
                  <path d="M4 5l7 7-7 7V5Z" />
                  <path d="M13 5l7 7-7 7V5Z" />
                </Glyph>
              </TimeButton>
            </div>

            <div style={{ display: 'flex', gap: '0.28rem', flexWrap: 'wrap' }}>
              {RATES.map(([label, rate]) => (
                <TimeButton
                  key={label}
                  onClick={() => clock.setRate(reversed ? -rate : rate)}
                  active={clock.mode === 'warp' && Math.abs(clock.rate) === rate}
                  title={`${label} of simulated time per real second`}
                >
                  {label}/s
                </TimeButton>
              ))}
            </div>
          </>
        ) : (
          <span
            style={{
              color: '#5a5a5a',
              fontSize: '0.7rem',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}
          </span>
        )}
      </div>
    </div>
  );
}

/** Filled triangles and bars for the transport controls. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Moves the warp rate one rung along the ladder, in the given direction.
 *
 * Pressing the arrow that opposes the current direction flips it at the same speed
 * rather than jumping to the slowest rate, which is what makes scrubbing back and
 * forth over an event feel controllable.
 */
export function stepRate(clock: SimClock, direction: 1 | -1): void {
  const ladder = RATES.map(([, rate]) => rate);
  const current = clock.mode === 'warp' ? clock.rate : 0;
  const magnitude = Math.abs(current);
  const currentDirection = Math.sign(current);

  if (current === 0 || currentDirection !== direction) {
    // Starting, or reversing: keep the speed, change the sign.
    clock.setRate(direction * (magnitude || ladder[0]!));
    return;
  }

  const index = ladder.findIndex((rate) => rate >= magnitude - 1e-9);
  const next = ladder[Math.min(index + 1, ladder.length - 1)]!;
  clock.setRate(direction * next);
}

function TimeButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        background: active ? '#1e2a24' : 'rgba(0,0,0,0.4)',
        border: `1px solid ${active ? '#3ddc84' : '#2a2a2a'}`,
        color: active ? '#3ddc84' : '#8a8a8a',
        padding: '0.24rem 0.5rem',
        fontSize: '0.68rem',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        borderRadius: '0.2rem',
        display: 'grid',
        placeItems: 'center',
        minHeight: '1.55rem',
      }}
    >
      {children}
    </button>
  );
}
