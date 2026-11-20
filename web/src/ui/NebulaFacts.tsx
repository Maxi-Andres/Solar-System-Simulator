import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { nebulaKindLabel, nebulaOf, nebulaRadiusKm } from '../core/nebulae.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { descriptionOf } from '../descriptions/index.ts';
import { Panel } from './Panel.tsx';
import { ReadMore } from './ReadMore.tsx';
import { formatStarDistance } from './StarFacts.tsx';

/** The info panel for a nebula (nebulae.ts): short rows, each with its source. */

function arcmin(value: number): string {
  return value < 1 ? `${Math.round(value * 60)}″` : `${Number(value.toFixed(1))}′`;
}

export function NebulaPanel({
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
  const nebula = nebulaOf(focus);
  if (nebula === null) {
    return null;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const radiusPc = nebulaRadiusKm(nebula) / PARSEC_KM;
  const [major, minor] = nebula.sizeArcmin;
  const error =
    nebula.distanceUpPc === null || nebula.distanceDownPc === null
      ? null
      : nebula.distanceUpPc === nebula.distanceDownPc
        ? `± ${nebula.distanceUpPc} pc`
        : `+${nebula.distanceUpPc} −${nebula.distanceDownPc} pc`;
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>◯</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {nebulaKindLabel(nebula.kind).toLowerCase()}
        </span>
      </div>
      {descriptionOf(focus) !== null && <ReadMore name={body.name} />}
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Also">{nebula.otherNames.join(' · ')}</Row>
        <Row label="Distance">{fromSun === null ? '--' : formatStarDistance(fromSun / PARSEC_KM)}</Row>
        {error !== null && <Row label="">{error}</Row>}
        <Row label="From">{nebula.distanceMethod}</Row>
        <Row label="Source">{nebula.reference}</Row>
        {nebula.note !== null && <Row label="Note">{nebula.note}</Row>}
        <Divider />
        <Row label="Size on the sky">{major === minor ? arcmin(major) : `${arcmin(major)} × ${arcmin(minor)}`}</Row>
        <Row label="Radius drawn">{`${radiusPc < 10 ? radiusPc.toFixed(2) : Math.round(radiusPc)} pc`}</Row>
        <Row label="Size from">{nebula.sizeReference}</Row>
        <Row label="3D shape">{nebula.shapeReference ?? 'an estimate'}</Row>
        <Row label="Modelled">{nebula.modelled}</Row>
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
