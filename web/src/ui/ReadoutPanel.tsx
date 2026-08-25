import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { useViewStore } from '../state/store.ts';
import { Panel } from './Panel.tsx';

/**
 * The numeric readout for every body at once.
 *
 * Kept from step 2, where it was the only way to see anything. It stays because it
 * is how you check the scene against the ephemerides: if a planet looks wrong, the
 * number next to it says whether the render or the data is at fault.
 */

const AU_KM = 149_597_870.7;

export interface ReadoutPanelProps {
  readonly store: EphemerisStore;
  readonly jd: number;
  readonly distanceMode: DistanceMode;
  readonly onDistanceMode: (mode: DistanceMode) => void;
  readonly tick: number;
}

export function ReadoutPanel({
  store,
  jd,
  distanceMode,
  onDistanceMode,
  tick,
}: ReadoutPanelProps) {
  const focus = useViewStore((state) => state.focus);
  const setFocus = useViewStore((state) => state.setFocus);
  const closePanel = useViewStore((state) => state.closePanel);
  void tick;

  return (
    <Panel title="Ephemeris readout" onClose={closePanel} width="31rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
        <span style={{ color: '#5a5a5a', fontSize: '0.66rem', letterSpacing: '0.12em' }}>
          MEASURE FROM
        </span>
        <ModeButton
          active={distanceMode === 'center'}
          onClick={() => onDistanceMode('center')}
          title="Centre to centre: the raw ephemeris values"
        >
          CENTER
        </ModeButton>
        <ModeButton
          active={distanceMode === 'surface'}
          onClick={() => onDistanceMode('surface')}
          title="Body radii subtracted, which is what NASA Eyes shows"
        >
          SURFACE
        </ModeButton>
      </div>

      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '0.72rem',
          fontVariantNumeric: 'tabular-nums',
          width: '100%',
        }}
      >
        <thead>
          <tr style={{ color: '#5a5a5a', textAlign: 'right', letterSpacing: '0.05em' }}>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem 0.25rem 0' }}>BODY</th>
            <th style={{ padding: '0.25rem 0.5rem' }}>AU</th>
            <th style={{ padding: '0.25rem 0.5rem' }}>SPEED</th>
            <th style={{ padding: '0.25rem 0.5rem' }}>LIGHT TIME</th>
            <th style={{ padding: '0.25rem 0 0.25rem 0.5rem' }}>
              FROM {store.body(focus).name.toUpperCase()}
            </th>
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
                  borderTop: '1px solid #1c1c1c',
                  textAlign: 'right',
                  cursor: 'pointer',
                  background: body.id === focus ? '#12161a' : 'transparent',
                }}
              >
                <td style={{ textAlign: 'left', padding: '0.25rem 0.5rem 0.25rem 0' }}>
                  <span style={{ color: body.color, marginRight: '0.4rem' }}>&#9679;</span>
                  {body.name}
                </td>
                <td style={{ padding: '0.25rem 0.5rem', color: '#c8c8c8' }}>
                  {fromSun === null ? '--' : (fromSun / AU_KM).toFixed(3)}
                </td>
                <td style={{ padding: '0.25rem 0.5rem', color: '#c8c8c8' }}>
                  {speed === null ? '--' : `${speed.toFixed(2)} km/s`}
                </td>
                <td style={{ padding: '0.25rem 0.5rem', color: '#8a8a8a' }}>
                  {lightTime === null || body.id === 'sun' ? '--' : formatLightTime(lightTime)}
                </td>
                <td style={{ padding: '0.25rem 0 0.25rem 0.5rem', color: '#8a8a8a' }}>
                  {fromFocus === null ? '--' : `${(fromFocus / AU_KM).toFixed(3)} AU`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: '0.7rem', color: '#464646', fontSize: '0.64rem', lineHeight: 1.6 }}>
        NASA/JPL-Caltech &middot; Horizons {store.manifest.source.version} &middot; DE441 &middot;
        generated {store.generatedAt.toISOString().slice(0, 10)}
      </div>
    </Panel>
  );
}

function ModeButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
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
        padding: '0.2rem 0.5rem',
        fontSize: '0.64rem',
        letterSpacing: '0.08em',
        cursor: 'pointer',
        fontFamily: 'inherit',
        borderRadius: '0.2rem',
      }}
    >
      {children}
    </button>
  );
}

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
