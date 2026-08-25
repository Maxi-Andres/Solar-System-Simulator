import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { DistanceMode } from '../core/ephemerisStore.ts';
import { useViewStore } from '../state/store.ts';
import { Panel } from './Panel.tsx';

/**
 * Facts about the focused body.
 *
 * Every figure here is either a catalog constant with a cited source or a live value
 * computed from the ephemerides — nothing is decorative.
 */

const AU_KM = 149_597_870.7;

export interface InfoPanelProps {
  readonly store: EphemerisStore;
  readonly jd: number;
  readonly distanceMode: DistanceMode;
  readonly tick: number;
}

export function InfoPanel({ store, jd, distanceMode, tick }: InfoPanelProps) {
  const focus = useViewStore((state) => state.focus);
  const closePanel = useViewStore((state) => state.closePanel);
  void tick;

  const body = store.body(focus);
  const elements = store.elementsFor(focus);

  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const speed = store.speedRelativeTo(focus, 'sun', jd);
  const lightTime = store.lightTimeSeconds(focus, 'sun', jd, distanceMode);
  const fromEarth = focus === 'earth' ? null : store.distanceBetween(focus, 'earth', jd, distanceMode);

  const flattening = 1 - body.radiusPolarKm / body.radiusEquatorialKm;

  return (
    <Panel title={body.name} onClose={closePanel} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>&#9679;</span>
        <span
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.1em',
            color: '#5a5a5a',
            textTransform: 'uppercase',
          }}
        >
          {body.kind.replace('-', ' ')}
        </span>
      </div>

      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />

      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Distance from Sun">
          {fromSun === null ? '--' : `${(fromSun / AU_KM).toFixed(4)} AU`}
        </Row>
        <Row label="">
          {fromSun === null ? '' : `${Math.round(fromSun).toLocaleString('en-US')} km`}
        </Row>
        <Row label="Orbital speed">{speed === null ? '--' : `${speed.toFixed(3)} km/s`}</Row>
        <Row label="Light time">
          {lightTime === null || focus === 'sun' ? '--' : formatLightTime(lightTime)}
        </Row>
        {fromEarth !== null && (
          <Row label="From Earth">{`${(fromEarth / AU_KM).toFixed(4)} AU`}</Row>
        )}

        <Divider />

        <Row label="Equatorial radius">
          {`${body.radiusEquatorialKm.toLocaleString('en-US')} km`}
        </Row>
        {flattening > 0.0005 && (
          <Row label="Polar flattening">{`${(flattening * 100).toFixed(2)} %`}</Row>
        )}
        <Row label="GM">{`${body.gmKm3S2.toLocaleString('en-US')} km³/s²`}</Row>
        <Row label="Rotation period">
          {`${Math.abs(body.rotationPeriodHours).toFixed(2)} h${
            body.rotationPeriodHours < 0 ? ' (retrograde)' : ''
          }`}
        </Row>
        <Row label="Axial tilt">{`${body.axialTiltDeg.toFixed(2)}°`}</Row>

        {elements !== null && (
          <>
            <Divider />
            <Row label="Orbital period">
              {`${(elements.periodSec / 86_400 / 365.25).toFixed(3)} yr`}
            </Row>
            <Row label="Eccentricity">{elements.eccentricity.toFixed(5)}</Row>
            <Row label="Inclination">{`${elements.inclinationDeg.toFixed(3)}°`}</Row>
            <Row label="Perihelion">{`${(elements.periapsisKm / AU_KM).toFixed(4)} AU`}</Row>
            <Row label="Aphelion">{`${(elements.apoapsisKm / AU_KM).toFixed(4)} AU`}</Row>
          </>
        )}
      </dl>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: '#5e5e5e', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          color: '#c4c4c4',
          fontSize: '0.72rem',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {children}
      </dd>
    </>
  );
}

function Divider() {
  return (
    <div
      style={{ gridColumn: '1 / -1', height: 1, background: '#202020', margin: '0.4rem 0' }}
    />
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
