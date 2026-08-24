import { useState } from 'react';

import type { DistanceMode } from './core/ephemerisStore.ts';
import { useSimulation } from './core/useSimulation.ts';
import { WARP_RATES } from './core/time.ts';

/**
 * Step 2 -- a live readout of the compute core.
 *
 * No 3D yet; that is step 3, where these same numbers become positions in a scene.
 * Showing them as text first makes the physics reviewable: the distances and speeds
 * below are real values interpolated from JPL's DE441 ephemeris at the current
 * instant, not a simulation of an orbit.
 */

const AU_KM = 149_597_870.7;

const RATE_OPTIONS: readonly (readonly [string, number])[] = [
  ['1 s/s', WARP_RATES.realTime],
  ['1 h/s', WARP_RATES.hourPerSecond],
  ['1 d/s', WARP_RATES.dayPerSecond],
  ['1 mo/s', WARP_RATES.monthPerSecond],
  ['1 yr/s', WARP_RATES.yearPerSecond],
];

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

/** Light time as NASA Eyes writes it: "8 min 22 sec". */
function formatLightTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ${Math.round(seconds % 60)} sec`;
  }
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function App() {
  const { store, clock, error, frame } = useSimulation();
  const [distanceMode, setDistanceMode] = useState<DistanceMode>('center');

  if (error !== null) {
    return (
      <Centered>
        <p style={{ color: '#e06c5a', maxWidth: '32rem', textAlign: 'center' }}>{error}</p>
        <p style={{ color: '#6a6a6a', fontSize: '0.8rem' }}>
          Run <code>pnpm fetch:data</code> to generate the ephemerides.
        </p>
      </Centered>
    );
  }

  if (store === null) {
    return (
      <Centered>
        <p style={{ letterSpacing: '0.2em', color: '#6a6a6a' }}>LOADING EPHEMERIDES</p>
      </Centered>
    );
  }

  // `frame` is unused directly but is what re-renders this component on each tick.
  void frame;

  const jd = clock.tdbJulianDay;
  const exact = store.isExactAt(jd);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '2rem 1.5rem' }}>
      <header style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              width: '0.55rem',
              height: '0.55rem',
              borderRadius: '50%',
              background: clock.isLive ? '#3ddc84' : '#5a5a5a',
            }}
          />
          <span
            style={{
              letterSpacing: '0.22em',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: clock.isLive ? '#3ddc84' : '#8a8a8a',
            }}
          >
            {clock.isLive ? 'LIVE' : clock.mode.toUpperCase()}
          </span>
          <span style={{ color: '#8a8a8a', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
            {clock.date.toISOString().replace('T', '  ').slice(0, 19)} UTC
          </span>
          {!exact && (
            <span style={{ color: '#e0a33d', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
              APPROXIMATE &middot; outside the ephemeris window
            </span>
          )}
        </div>

        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Button onClick={() => clock.goLive()} active={clock.isLive}>
            LIVE
          </Button>
          <Button onClick={() => clock.pause()} active={clock.mode === 'paused'}>
            PAUSE
          </Button>
          {RATE_OPTIONS.map(([label, rate]) => (
            <Button
              key={label}
              onClick={() => clock.setRate(rate)}
              active={clock.mode === 'warp' && clock.rate === rate}
            >
              {label}
            </Button>
          ))}
          <Button onClick={() => clock.setRate(-WARP_RATES.dayPerSecond)} active={clock.rate < 0}>
            &minus;1 d/s
          </Button>
        </div>

        <div
          style={{
            marginTop: '0.7rem',
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#5a5a5a', fontSize: '0.68rem', letterSpacing: '0.12em' }}>
            MEASURE FROM
          </span>
          <Button onClick={() => setDistanceMode('center')} active={distanceMode === 'center'}>
            CENTER
          </Button>
          <Button onClick={() => setDistanceMode('surface')} active={distanceMode === 'surface'}>
            SURFACE
          </Button>
          <span style={{ color: '#5a5a5a', fontSize: '0.68rem' }}>
            {distanceMode === 'surface'
              ? 'body radii subtracted — matches NASA Eyes'
              : 'centre to centre — raw ephemeris values'}
          </span>
        </div>
      </header>

      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '0.82rem',
          fontVariantNumeric: 'tabular-nums',
          width: '100%',
          maxWidth: '56rem',
        }}
      >
        <thead>
          <tr style={{ color: '#6a6a6a', textAlign: 'right', letterSpacing: '0.08em' }}>
            <th style={{ textAlign: 'left', padding: '0.4rem 0.75rem 0.4rem 0' }}>BODY</th>
            <th style={{ padding: '0.4rem 0.75rem' }}>DIST. FROM SUN</th>
            <th style={{ padding: '0.4rem 0.75rem' }}>AU</th>
            <th style={{ padding: '0.4rem 0.75rem' }}>ORBITAL SPEED</th>
            <th style={{ padding: '0.4rem 0.75rem' }}>LIGHT TIME</th>
            <th style={{ padding: '0.4rem 0.75rem' }}>DIST. FROM EARTH</th>
          </tr>
        </thead>
        <tbody>
          {store.bodies.map((body) => {
            const fromSun = store.distanceBetween(body.id, 'sun', jd, distanceMode);
            const speed = store.speedRelativeTo(body.id, 'sun', jd);
            const lightTime = store.lightTimeSeconds(body.id, 'sun', jd, distanceMode);
            const fromEarth = store.distanceBetween(body.id, 'earth', jd, distanceMode);

            return (
              <tr key={body.id} style={{ borderTop: '1px solid #1e1e1e', textAlign: 'right' }}>
                <td style={{ textAlign: 'left', padding: '0.4rem 0.75rem 0.4rem 0' }}>
                  <span style={{ color: body.color, marginRight: '0.5rem' }}>&#9679;</span>
                  {body.name}
                </td>
                <td style={{ padding: '0.4rem 0.75rem', color: '#c8c8c8' }}>
                  {fromSun === null ? '--' : formatKm(fromSun)}
                </td>
                <td style={{ padding: '0.4rem 0.75rem', color: '#8a8a8a' }}>
                  {fromSun === null ? '--' : (fromSun / AU_KM).toFixed(4)}
                </td>
                <td style={{ padding: '0.4rem 0.75rem', color: '#c8c8c8' }}>
                  {speed === null ? '--' : `${speed.toFixed(3)} km/s`}
                </td>
                <td style={{ padding: '0.4rem 0.75rem', color: '#8a8a8a' }}>
                  {lightTime === null || body.id === 'sun' ? '--' : formatLightTime(lightTime)}
                </td>
                <td style={{ padding: '0.4rem 0.75rem', color: '#8a8a8a' }}>
                  {fromEarth === null ? '--' : formatKm(fromEarth)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer style={{ marginTop: '1.75rem', color: '#4a4a4a', fontSize: '0.72rem', lineHeight: 1.7 }}>
        <div>
          Ephemerides: NASA/JPL-Caltech, Horizons {store.manifest.source.version} &middot; DE441
          &middot; generated {store.generatedAt.toISOString().slice(0, 10)}
        </div>
        <div>
          Exact window {store.manifest.window.startUtc.slice(0, 10)} to{' '}
          {store.manifest.window.stopUtc.slice(0, 10)} &middot; barycentric, ecliptic J2000
        </div>
      </footer>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.9rem',
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? '#1e2a24' : 'transparent',
        border: `1px solid ${active ? '#3ddc84' : '#2a2a2a'}`,
        color: active ? '#3ddc84' : '#8a8a8a',
        padding: '0.3rem 0.7rem',
        fontSize: '0.72rem',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
