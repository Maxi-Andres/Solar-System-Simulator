import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import {
  FICTION_COLOR,
  fictionOf,
  valueNote,
  workLine,
  type FictionRecord,
  type FictionValue,
} from '../core/fiction.ts';
import { fictionOrbit } from '../core/fictionBodies.ts';
import { FICTION_ABOUT_NAMES, fictionAboutKey } from '../descriptions/fiction/ids.ts';
import { FictionTag } from './FictionTag.tsx';
import { ReadMore } from './ReadMore.tsx';
import { Panel } from './Panel.tsx';

/**
 * The info panel for a fictional thing (core/fiction.ts): the work it is from, the real thing it
 * is anchored to, then each number with where it is from -- the canon's source, a stand-in, an
 * invention, or "canon silent" -- and a line on what is real about the anchor. Short values, as
 * every panel; what fiction is and how it is placed is the About's (FictionSection.tsx).
 */

const AU_KM = 149_597_870.7;
const LIGHT_YEAR_KM = 9.4607304725808e12;

/** What each kind of note is shown in: an invention in fiction's own colour, a source quietly. */
const NOTE_COLOR = {
  canon: '#8a8a8a',
  // Known only at second hand: warmer than a source, short of an invention.
  unverified: '#d8a05a',
  standIn: FICTION_COLOR,
  invented: FICTION_COLOR,
  silent: '#5e5e5e',
  computed: '#8a8a8a',
} as const;

function formatDistance(km: number): string {
  if (km >= 0.05 * LIGHT_YEAR_KM) return `${(km / LIGHT_YEAR_KM).toFixed(2)} ly`;
  if (km >= 0.1 * AU_KM) return `${(km / AU_KM).toFixed(3)} AU`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatPeriod(days: number): string {
  return days >= 400 ? `${(days / 365.25).toFixed(2)} yr` : `${days.toFixed(days < 10 ? 2 : 1)} d`;
}

export function FictionPanel({
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
  const record = fictionOf(focus);
  if (record === null) {
    return null;
  }
  const body = store.body(focus);
  const parent = body.parent === null ? null : store.body(body.parent);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const fromParent = parent === null ? null : store.distanceBetween(focus, parent.id, jd, distanceMode);
  const orbit = parent === null ? null : fictionOrbit(record, parent.gmBodyOnlyKm3S2);
  const about = fictionAboutKey(record.id);
  return (
    <Panel title={record.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: FICTION_COLOR, fontSize: '0.8rem' }}>△</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {record.kind}
        </span>
        <FictionTag record={record} />
      </div>
      <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: '#c4c4c4' }}>{workLine(record.work)}</div>
      <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: '#8a8a8a' }}>{record.anchorLine}</div>
      {/* Its "about", fiction's own (descriptions/fiction/), as a real body's description is offered. */}
      {about !== null && <ReadMore name={FICTION_ABOUT_NAMES[about]} />}
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="From Sun">{fromSun === null ? '--' : formatDistance(fromSun)}</Row>
        {parent !== null && <Row label={`From ${parent.name}`}>{fromParent === null ? '--' : formatDistance(fromParent)}</Row>}
        <Divider />
        <ValueRow label="Radius" value={record.radiusKm} format={(km) => `${Math.round(km).toLocaleString('en-US')} km`} />
        <ValueRow label="Mass" value={record.massEarth} format={(m) => `${m.toLocaleString('en-US', { maximumSignificantDigits: 4 })} Earths`} />
        {record.position === 'invented' ? (
          <Row
            label="Position"
            note={{ text: 'canon silent · seeded from its id', kind: 'invented', detail: 'The canon gives it no place.' }}
          >
            invented
          </Row>
        ) : (
          <>
            <ValueRow label="Orbit radius" value={record.orbit.semiMajorAxisKm} format={formatDistance} />
            <ValueRow label="Eccentricity" value={record.orbit.eccentricity} format={(e) => e.toFixed(3)} />
          </>
        )}
        {orbit !== null &&
          (record.orbit.periodDays === undefined ? (
            <Row label="Period" note={{ text: 'from Kepler’s third law', kind: 'computed' }}>
              {formatPeriod(orbit.periodDays)}
            </Row>
          ) : (
            <ValueRow label="Period" value={record.orbit.periodDays} format={formatPeriod} />
          ))}
        {record.facts.map((fact) => (
          <ValueRow
            key={fact.label}
            label={fact.label}
            value={fact.value}
            format={(v) => (fact.unit === undefined ? String(v) : `${String(v)} ${fact.unit}`)}
            extra={fact.note}
          />
        ))}
      </dl>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <RealityCheck record={record} />
    </Panel>
  );
}

function RealityCheck({ record }: { record: FictionRecord }) {
  return (
    <div style={{ fontSize: '0.68rem', color: '#a8a8a8', lineHeight: 1.45 }}>
      <span style={{ color: '#5e5e5e', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.6rem' }}>Real · </span>
      {record.realityCheck}
    </div>
  );
}

function ValueRow<T>({
  label,
  value,
  format,
  extra,
}: {
  label: string;
  value: FictionValue<T>;
  format: (value: T) => string;
  /** A line of its own under the value's note: where the canon disagrees with itself. */
  extra?: string | undefined;
}) {
  const note = valueNote(value);
  return (
    <Row label={label} note={note} extra={extra}>
      {'silent' in value ? '—' : format(value.value)}
    </Row>
  );
}

function Row({
  label,
  note,
  extra,
  children,
}: {
  label: string;
  /** Its source or kind of invention, short; `detail`, the full source or why, on hover. */
  note?: { readonly text: string; readonly kind: keyof typeof NOTE_COLOR; readonly detail?: string };
  extra?: string | undefined;
  children: React.ReactNode;
}) {
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
        {note !== undefined && (
          <div title={note.detail} style={{ fontSize: '0.6rem', color: NOTE_COLOR[note.kind], letterSpacing: '0.02em' }}>
            {note.text}
          </div>
        )}
        {extra !== undefined && <div style={{ fontSize: '0.6rem', color: '#8a8a8a' }}>{extra}</div>}
      </dd>
    </>
  );
}

function Divider() {
  return <div style={{ gridColumn: '1 / -1', height: 1, background: '#202020', margin: '0.4rem 0' }} />;
}
