import type { BodyId } from '@sss/tools/types';

import { PLANCK18 } from '../core/cosmology.ts';
import { recordHolderDistances, recordHolderKindLabel, recordHolderOf } from '../core/recordHolders.ts';
import { Panel } from './Panel.tsx';

/**
 * The info panel for a record-holder (recordHolders.ts): its redshift and how it was measured,
 * and the three distances a redshift gives -- where it is now, how far its light came, and how
 * far it was when the light left -- with the universe's age then. In Planck 2018's cosmology; the
 * About says what each distance means.
 */

/** "33.86 billion ly", "972 million ly". */
export function formatLy(ly: number): string {
  return ly >= 1e9 ? `${(ly / 1e9).toFixed(2)} billion ly` : `${Math.round(ly / 1e6).toLocaleString('en-US')} million ly`;
}

/** "13.50 billion years", "283 million years". */
export function formatYears(gyr: number): string {
  return gyr >= 1 ? `${gyr.toFixed(2)} billion years` : `${Math.round(gyr * 1000).toLocaleString('en-US')} million years`;
}

/** "z 14.44 ± 0.02", "z 9.4 +0.12 −0.34", "z 0.28". */
export function formatRedshift(z: number, plus: number | null, minus: number | null): string {
  if (plus === null || minus === null) return `${z}`;
  return plus === minus ? `${z} ± ${plus}` : `${z} +${plus} −${minus}`;
}

export function RecordHolderPanel({ focus, onClose }: { focus: BodyId; onClose: () => void }) {
  const holder = recordHolderOf(focus);
  if (holder === null) {
    return null;
  }
  const d = recordHolderDistances(holder);
  return (
    <Panel title={holder.name} onClose={onClose} width="18.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: '#c4b2ec', fontSize: '0.9rem' }}>◯</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {recordHolderKindLabel(holder.kind)}
        </span>
      </div>
      <div style={{ color: '#9a9a9a', fontSize: '0.72rem', marginTop: '0.45rem' }}>{holder.record}</div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {holder.otherNames.length > 0 && <Row label="Also">{holder.otherNames.slice(0, 2).join(' · ')}</Row>}
        <Row label="Redshift">{formatRedshift(holder.z, holder.zPlus, holder.zMinus)}</Row>
        <Row label="">{holder.spectroscopic ? 'Spectroscopic' : 'Photometric only'}</Row>
        <Row label="Measured">{holder.how}</Row>
        <Row label="Now at">{`${formatLy(d.comovingLy)}, comoving`}</Row>
        <Row label="Light left">{`${formatYears(d.lookbackGyr)} ago`}</Row>
        <Row label="Then at">{formatLy(d.properAtEmissionLy)}</Row>
        <Row label="Universe then">{formatYears(d.ageAtEmissionGyr)}</Row>
        <Row label="Cosmology">{`${PLANCK18.name}, H0 ${PLANCK18.h0}`}</Row>
        <Row label="Position">{holder.position}</Row>
        <Row label="Source">{holder.reference}</Row>
      </dl>
      {holder.note !== null && <div style={{ color: '#8a8a8a', fontSize: '0.68rem', marginTop: '0.6rem', lineHeight: 1.45 }}>{holder.note}</div>}
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: '#5e5e5e', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{label}</dt>
      <dd style={{ margin: 0, color: '#c4c4c4', fontSize: '0.72rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </dd>
    </>
  );
}
