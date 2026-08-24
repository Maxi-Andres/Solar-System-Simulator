import type { BodyId } from '@sss/tools/types';
import { useState } from 'react';

import type { DistanceMode } from './core/ephemerisStore.ts';
import { WARP_RATES } from './core/time.ts';
import { useSimulation } from './core/useSimulation.ts';
import { SolarSystemCanvas } from './scene/SolarSystemCanvas.tsx';

/**
 * Step 3 -- the 3D scene, with the step 2 readout kept as an overlay panel.
 *
 * The numbers stay on screen deliberately: they are how you check that what the
 * scene draws matches what the ephemerides say. Step 4 turns this panel into proper
 * UI with labels, search and an info panel.
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
  if (km >= 1e6) {
    return `${(km / 1e6).toFixed(2)}M km`;
  }
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
  const [focus, setFocus] = useState<BodyId>('sun');
  const [showOrbits, setShowOrbits] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

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

  // `frame` is what re-renders this component at the readout cadence; the scene
  // itself reads the clock directly in useFrame and does not depend on this.
  void frame;

  const jd = clock.tdbJulianDay;
  const exact = store.isExactAt(jd);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <SolarSystemCanvas store={store} clock={clock} focus={focus} showOrbits={showOrbits} />

      {/* Top-left: focus breadcrumb and body picker. */}
      <div style={{ position: 'absolute', top: '1rem', left: '1.25rem', pointerEvents: 'none' }}>
        <div
          style={{
            letterSpacing: '0.22em',
            fontSize: '0.78rem',
            color: '#c8c8c8',
            textTransform: 'uppercase',
          }}
        >
          Solar System <span style={{ color: '#4a4a4a' }}>&rsaquo;</span>{' '}
          <span style={{ color: '#fff' }}>{store.body(focus).name}</span>
        </div>
        <div
          style={{
            marginTop: '0.6rem',
            display: 'flex',
            gap: '0.3rem',
            flexWrap: 'wrap',
            maxWidth: '30rem',
            pointerEvents: 'auto',
          }}
        >
          {store.bodies.map((body) => (
            <Button key={body.id} onClick={() => setFocus(body.id)} active={focus === body.id}>
              <span style={{ color: body.color, marginRight: '0.35rem' }}>&#9679;</span>
              {body.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Bottom-left: LIVE indicator and time controls. */}
      <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.25rem' }}>
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
          <span
            style={{ color: '#8a8a8a', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}
          >
            {clock.date.toISOString().replace('T', '  ').slice(0, 19)} UTC
          </span>
          {!exact && (
            <span style={{ color: '#e0a33d', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
              APPROXIMATE
            </span>
          )}
        </div>

        <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
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
          <Button onClick={() => setShowOrbits((on) => !on)} active={showOrbits}>
            ORBITS
          </Button>
        </div>
      </div>

      {/* Right: the numeric readout. */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          maxWidth: '34rem',
          background: 'rgba(8,8,10,0.82)',
          border: '1px solid #1e1e1e',
          padding: panelOpen ? '0.9rem 1rem' : '0.5rem 0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ letterSpacing: '0.16em', fontSize: '0.7rem', color: '#8a8a8a' }}>
            EPHEMERIS READOUT
          </span>
          <div style={{ flex: 1 }} />
          {panelOpen && (
            <>
              <Button onClick={() => setDistanceMode('center')} active={distanceMode === 'center'}>
                CENTER
              </Button>
              <Button
                onClick={() => setDistanceMode('surface')}
                active={distanceMode === 'surface'}
              >
                SURFACE
              </Button>
            </>
          )}
          <Button onClick={() => setPanelOpen((open) => !open)} active={false}>
            {panelOpen ? 'HIDE' : 'SHOW'}
          </Button>
        </div>

        {panelOpen && (
          <table
            style={{
              marginTop: '0.75rem',
              borderCollapse: 'collapse',
              fontSize: '0.75rem',
              fontVariantNumeric: 'tabular-nums',
              width: '100%',
            }}
          >
            <thead>
              <tr style={{ color: '#5a5a5a', textAlign: 'right', letterSpacing: '0.06em' }}>
                <th style={{ textAlign: 'left', padding: '0.3rem 0.6rem 0.3rem 0' }}>BODY</th>
                <th style={{ padding: '0.3rem 0.6rem' }}>FROM SUN</th>
                <th style={{ padding: '0.3rem 0.6rem' }}>AU</th>
                <th style={{ padding: '0.3rem 0.6rem' }}>SPEED</th>
                <th style={{ padding: '0.3rem 0.6rem' }}>LIGHT TIME</th>
                <th style={{ padding: '0.3rem 0 0.3rem 0.6rem' }}>FROM {store.body(focus).name.toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              {store.bodies.map((body) => {
                const fromSun = store.distanceBetween(body.id, 'sun', jd, distanceMode);
                const speed = store.speedRelativeTo(body.id, 'sun', jd);
                const lightTime = store.lightTimeSeconds(body.id, 'sun', jd, distanceMode);
                const fromFocus = store.distanceBetween(body.id, focus, jd, distanceMode);

                return (
                  <tr
                    key={body.id}
                    onClick={() => setFocus(body.id)}
                    style={{
                      borderTop: '1px solid #1a1a1a',
                      textAlign: 'right',
                      cursor: 'pointer',
                      background: body.id === focus ? '#12161a' : 'transparent',
                    }}
                  >
                    <td style={{ textAlign: 'left', padding: '0.3rem 0.6rem 0.3rem 0' }}>
                      <span style={{ color: body.color, marginRight: '0.4rem' }}>&#9679;</span>
                      {body.name}
                    </td>
                    <td style={{ padding: '0.3rem 0.6rem', color: '#c8c8c8' }}>
                      {fromSun === null ? '--' : formatKm(fromSun)}
                    </td>
                    <td style={{ padding: '0.3rem 0.6rem', color: '#8a8a8a' }}>
                      {fromSun === null ? '--' : (fromSun / AU_KM).toFixed(3)}
                    </td>
                    <td style={{ padding: '0.3rem 0.6rem', color: '#c8c8c8' }}>
                      {speed === null ? '--' : `${speed.toFixed(2)} km/s`}
                    </td>
                    <td style={{ padding: '0.3rem 0.6rem', color: '#8a8a8a' }}>
                      {lightTime === null || body.id === 'sun' ? '--' : formatLightTime(lightTime)}
                    </td>
                    <td style={{ padding: '0.3rem 0 0.3rem 0.6rem', color: '#8a8a8a' }}>
                      {fromFocus === null ? '--' : formatKm(fromFocus)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {panelOpen && (
          <div style={{ marginTop: '0.7rem', color: '#4a4a4a', fontSize: '0.66rem', lineHeight: 1.6 }}>
            NASA/JPL-Caltech &middot; Horizons {store.manifest.source.version} &middot; DE441
            &middot; generated {store.generatedAt.toISOString().slice(0, 10)}
            <br />
            Real distances and radii. Bodies below ~3 px render as markers.
          </div>
        )}
      </div>
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
        background: active ? '#1e2a24' : 'rgba(0,0,0,0.4)',
        border: `1px solid ${active ? '#3ddc84' : '#2a2a2a'}`,
        color: active ? '#3ddc84' : '#8a8a8a',
        padding: '0.25rem 0.6rem',
        fontSize: '0.68rem',
        letterSpacing: '0.08em',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
