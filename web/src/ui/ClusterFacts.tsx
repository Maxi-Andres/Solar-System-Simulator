import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import {
  clusterExtinctionV,
  clusterPopulation,
  clusterSampleRequest,
  clusterStarCount,
  globularClusterOf,
  sampleLimitV,
} from '../core/globularClusters.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { Panel } from './Panel.tsx';
import { formatStarDistance } from './StarFacts.tsx';

/**
 * The info panel for a globular cluster gone to (globularClusters.ts): what is measured of
 * it, a row each, and what its stars are drawn as. The model's reasons are the About's.
 */

function formatCount(n: number): string {
  if (n >= 1e6) {
    return `${Number((n / 1e6).toPrecision(3))} million`;
  }
  return Math.round(n).toLocaleString('en-US');
}

export function ClusterPanel({
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
  const found = globularClusterOf(focus);
  if (found === null) {
    return null;
  }
  const { catalog: c, k } = found;
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const count = clusterStarCount(c, k);
  const extinction = clusterExtinctionV(c, k);
  const population = clusterPopulation(c.feH[k] ?? null);
  const limit = sampleLimitV(clusterSampleRequest(c, k));
  const others = c.otherNames[k]!.filter((name) => name !== body.name);
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>⊙</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          globular cluster
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {[c.name[k]!, ...others].filter((name) => name !== body.name).length > 0 && (
          <Row label="Also">{[c.name[k]!, ...others].filter((name) => name !== body.name).join(' · ')}</Row>
        )}
        <Row label="Distance">{fromSun === null ? '--' : formatStarDistance(fromSun / PARSEC_KM)}</Row>
        <Row label="">{`± ${c.distanceErrorPc[k]} pc`}</Row>
        <Row label="Mass">{`${formatCount(c.massSun[k]!)} M☉`}</Row>
        <Row label="Half-light radius">{`${c.halfLightRadiusPc[k]} pc`}</Row>
        <Row label="Core radius">{`${c.coreRadiusPc[k]} pc`}</Row>
        <Row label="Tidal radius">{`${c.tidalRadiusPc[k]} pc`}</Row>
        <Row label="Central dispersion">{`${c.sigma0KmS[k]} km/s`}</Row>
        <Row label="Escape velocity">{`${c.escapeKmS[k]} km/s`}</Row>
        <Row label="[Fe/H]">{c.feH[k] == null ? 'Not in Harris' : `${c.feH[k]}`}</Row>
        <Row label="Reddening">{extinction === null ? 'Not in Harris: none drawn' : `A_V ${extinction.toFixed(2)} from the Sun`}</Row>
        <Row label="Source">Baumgardt et al.; Harris 2010</Row>
        <Divider />
        <Row label="Stars (model)">{formatCount(count.stars)}</Row>
        <Row label="Counted from">{count.from === 'light' ? `its light, M_V ${count.absoluteV!.toFixed(2)}` : 'its mass'}</Row>
        <Row label="Population">{`12 Gyr, [M/H] ${population.mh}`}</Row>
        <Row label="Drawn">{`brighter than V ${limit.toFixed(1)} from its centre`}</Row>
        <Row label="Shape">Plummer, by its half-mass radius</Row>
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
