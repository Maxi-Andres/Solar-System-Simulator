import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { remnantOf, remnantRadiusKm } from '../core/supernovaRemnants.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { Panel } from './Panel.tsx';
import { formatStarDistance } from './StarFacts.tsx';

/** The info panel for a supernova remnant (supernovaRemnants.ts): short rows, each with its source. */

const TYPES = { S: 'shell', F: 'filled centre (pulsar wind nebula)', C: 'composite' } as const;

export function RemnantPanel({
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
  const remnant = remnantOf(focus);
  if (remnant === null) {
    return null;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const radiusPc = remnantRadiusKm(remnant) / PARSEC_KM;
  const [major, minor] = remnant.sizeArcmin;
  const error =
    remnant.distanceUpPc === null || remnant.distanceDownPc === null
      ? null
      : remnant.distanceUpPc === remnant.distanceDownPc
        ? `± ${remnant.distanceUpPc} pc`
        : `+${remnant.distanceUpPc} −${remnant.distanceDownPc} pc`;
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>◯</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          supernova remnant
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Also">{[remnant.green, ...remnant.otherNames].join(' · ')}</Row>
        {remnant.seenYear !== null && <Row label="Seen to explode">{`AD ${remnant.seenYear}`}</Row>}
        <Row label="Distance">{fromSun === null ? '--' : formatStarDistance(fromSun / PARSEC_KM)}</Row>
        {error !== null && <Row label="">{error}</Row>}
        <Row label="From">{remnant.distanceMethod}</Row>
        <Row label="Source">{remnant.reference}</Row>
        {remnant.note !== null && <Row label="Note">{remnant.note}</Row>}
        <Divider />
        <Row label="Size on the sky">{major === minor ? `${major}′` : `${major}′ × ${minor}′`}</Row>
        <Row label="Radius drawn">{`${radiusPc < 10 ? radiusPc.toFixed(1) : Math.round(radiusPc)} pc, mean`}</Row>
        <Row label="Type">{TYPES[remnant.type]}</Row>
        <Row label="Listed by">Green 2024</Row>
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
