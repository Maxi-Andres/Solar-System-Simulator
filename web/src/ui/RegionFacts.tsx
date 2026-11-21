import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { regionOf } from '../core/regions.ts';
import { hasDescription } from '../descriptions/ids.ts';
import { Panel } from './Panel.tsx';
import { ReadMore } from './ReadMore.tsx';

/**
 * The info panel for a region (core/regions.ts): a Lagrange point, a boundary's nose, a Voyager
 * crossing. Where it is now, then its rows -- each says whether it is measured, modelled or
 * computed, and from what.
 */

const AU_KM = 149_597_870.7;
const PARSEC_KM = 3.0856775814913673e13;
const LIGHT_YEAR_KM = 9.4607304725808e12;

function formatKm(km: number): string {
  // Out among the stars (an interstellar cloud's, interstellarClouds.ts): light years and parsecs.
  if (km >= 0.1 * PARSEC_KM) {
    const ly = km / LIGHT_YEAR_KM;
    const pc = km / PARSEC_KM;
    const round = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: value < 100 ? 1 : 0 });
    return `${round(ly)} ly · ${round(pc)} pc`;
  }
  return km >= 0.1 * AU_KM ? `${(km / AU_KM).toFixed(km >= 10 * AU_KM ? 1 : 4)} AU` : `${Math.round(km).toLocaleString('en-US')} km`;
}

export function RegionPanel({
  store,
  focus,
  jd,
  distanceMode,
  onClose,
}: {
  store: EphemerisStore;
  focus: BodyId;
  jd: number;
  distanceMode: DistanceMode;
  onClose: () => void;
}) {
  const region = regionOf(focus);
  if (region === null) {
    return null;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const fromEarth = store.distanceBetween(focus, 'earth', jd, distanceMode);
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>{region.measured ? '●' : '○'}</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {region.kindLabel}
        </span>
      </div>
      {hasDescription(focus) && <ReadMore name={body.name} />}
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {region.centredOnSun !== true && (
          <>
            <Row label="From Sun">{fromSun === null ? '--' : formatKm(fromSun)}</Row>
            <Row label="From Earth">{fromEarth === null ? '--' : formatKm(fromEarth)}</Row>
            <Divider />
          </>
        )}
        {[...(region.liveFacts?.(jd) ?? []), ...region.facts].map((fact) => (
          <Row key={fact.label} label={fact.label}>
            {fact.value}
          </Row>
        ))}
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
  return <div style={{ gridColumn: '1 / -1', height: 1, background: '#202020', margin: '0.4rem 0' }} />;
}
