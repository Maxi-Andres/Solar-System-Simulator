import { useEffect, useState } from 'react';

import { SimClock, WARP_RATES } from '../core/time.ts';

/**
 * Time controls: LIVE, pause, warp rates in both directions, and a date field.
 *
 * The date field is what turns "watch it move" into "show me a specific moment",
 * which is most of what a Solar System viewer is for. It is a plain
 * datetime-local input: the native picker is better than anything worth hand-rolling
 * here, and it is keyboard accessible for free.
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

  void tick;

  // Leaving the field in sync while paused, without fighting the user's typing.
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
  const running = clock.mode !== 'paused';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        <span
          style={{
            width: '0.55rem',
            height: '0.55rem',
            borderRadius: '50%',
            background: clock.isLive ? '#3ddc84' : '#5a5a5a',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            letterSpacing: '0.22em',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: clock.isLive ? '#3ddc84' : '#8a8a8a',
          }}
        >
          {clock.isLive ? 'LIVE' : clock.mode.toUpperCase()}
        </span>

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
            fontSize: '0.78rem',
            padding: '0.22rem 0.4rem',
            colorScheme: 'dark',
          }}
        />
        <span style={{ color: '#5a5a5a', fontSize: '0.7rem' }}>UTC</span>

        {!exact && (
          <span
            style={{
              color: '#e0a33d',
              fontSize: '0.68rem',
              letterSpacing: '0.1em',
              border: '1px solid #3a2f1a',
              borderRadius: '0.2rem',
              padding: '0.1rem 0.35rem',
            }}
            title="Outside the downloaded ephemeris window: positions are propagated, not interpolated."
          >
            APPROXIMATE
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Transport: rewind, play/pause, fast-forward. Each arrow steps the rate
            one rung up the ladder in its own direction, so tapping it repeatedly
            speeds up the way a media transport does. */}
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
          onClick={() => (running ? clock.pause() : clock.setRate(clock.rate || 1))}
          active={!running}
          title={running ? 'Pause' : 'Resume'}
        >
          <Glyph>
            {running ? (
              <>
                <path d="M9 5v14" strokeWidth="2.4" />
                <path d="M15 5v14" strokeWidth="2.4" />
              </>
            ) : (
              <path d="M7 5l12 7-12 7V5Z" />
            )}
          </Glyph>
        </TimeButton>

        <TimeButton
          onClick={() => stepRate(clock, 1)}
          active={clock.mode === 'warp' && clock.rate > 0}
          title="Fast forward, or go faster if already forward"
        >
          <Glyph>
            <path d="M4 5l7 7-7 7V5Z" />
            <path d="M13 5l7 7-7 7V5Z" />
          </Glyph>
        </TimeButton>

        <span style={{ color: '#3a3a3a', margin: '0 0.15rem' }}>|</span>

        <TimeButton onClick={() => clock.goLive()} active={clock.isLive}>
          LIVE
        </TimeButton>

        <span style={{ color: '#3a3a3a', margin: '0 0.15rem' }}>|</span>

        {RATES.map(([label, rate]) => {
          const active = clock.mode === 'warp' && Math.abs(clock.rate) === rate;
          return (
            <TimeButton
              key={label}
              onClick={() => clock.setRate(reversed ? -rate : rate)}
              active={active}
              title={`${label} of simulated time per real second`}
            >
              {label}/s
            </TimeButton>
          );
        })}
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
        padding: '0.24rem 0.55rem',
        fontSize: '0.68rem',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        borderRadius: '0.2rem',
      }}
    >
      {children}
    </button>
  );
}
