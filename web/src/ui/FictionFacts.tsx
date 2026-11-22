import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import {
  FICTION_COLOR,
  fictionOf,
  fictionReadingId,
  fictionShipOf,
  valueNote,
  workLine,
  type FictionBase,
  type FictionRecord,
  type FictionShipRecord,
  type FictionValue,
} from '../core/fiction.ts';
import { fictionOrbit } from '../core/fictionBodies.ts';
import { C_KM_S, DAYS_PER_YEAR, lorentzFactor, voyageOf } from '../core/hailMary.ts';
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
  // A ship: its voyage, worked out by special relativity (core/hailMary.ts).
  const ship = fictionShipOf(focus);
  if (ship !== null) {
    return <ShipPanel store={store} ship={ship} focus={focus} jd={jd} distanceMode={distanceMode} onClose={onClose} />;
  }
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

/** Years and months, for a span in days: "3 y 9 mo". */
function yearsMonths(days: number): string {
  const months = Math.round((days / DAYS_PER_YEAR) * 12);
  return `${Math.floor(months / 12)} y ${months % 12} mo`;
}

/** A date from a TDB Julian day, to the day: what the panel needs. */
function dateOf(jd: number): string {
  return new Date((jd - 2_440_587.5) * 86_400_000).toISOString().slice(0, 10);
}

const COMPUTED = { text: 'computed · special relativity', kind: 'computed' } as const;

/**
 * A fictional ship's panel: where it is in its voyage now -- the phase, the time since launch on
 * Earth's clock and on its own, its speed and the Lorentz factor, all worked out by special
 * relativity (core/hailMary.ts) and said so -- then the voyage's numbers, each from the canon,
 * quoted, invented or computed.
 */
function ShipPanel({
  store,
  ship,
  focus,
  jd,
  distanceMode,
  onClose,
}: {
  store: EphemerisStore;
  ship: FictionShipRecord;
  focus: BodyId;
  jd: number;
  distanceMode: DistanceMode;
  onClose: () => void;
}) {
  const voyage = voyageOf(focus);
  const moment = voyage?.moment(jd) ?? null;
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const about = fictionAboutKey(ship.id);
  return (
    <Panel title={ship.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: FICTION_COLOR, fontSize: '0.8rem' }}>△</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>ship</span>
        <FictionTag record={ship} />
      </div>
      <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: '#c4c4c4' }}>{workLine(ship.work)}</div>
      <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: '#8a8a8a' }}>{ship.anchorLine}</div>
      {about !== null && <ReadMore name={FICTION_ABOUT_NAMES[about]} />}
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Now">{moment?.phase ?? '--'}</Row>
        {moment !== null && moment.earthDays !== null && moment.shipDays !== null && (
          <>
            <Row label="Since launch, Earth" note={COMPUTED}>{yearsMonths(moment.earthDays)}</Row>
            <Row label="Since launch, aboard" note={COMPUTED}>{yearsMonths(moment.shipDays)}</Row>
            <Row label="Speed" note={COMPUTED}>
              {moment.phase === 'in orbit' ? `${moment.speedKmS.toFixed(1)} km/s` : `${(moment.speedKmS / C_KM_S).toFixed(4)} c`}
            </Row>
            <Row label="Lorentz factor" note={COMPUTED}>{lorentzFactor(moment.speedKmS).toFixed(moment.speedKmS > 0.9 * C_KM_S ? 2 : 4)}</Row>
          </>
        )}
        <Row label="From Sun">{fromSun === null ? '--' : formatDistance(fromSun)}</Row>
        <Divider />
        <ValueRow label="Acceleration" value={ship.voyage.accelerationG} format={(g) => `${g} g`} />
        {voyage !== null && (
          <>
            <Row label="Trip, Earth" note={COMPUTED}>{`${(voyage.trip.totalS / 86_400 / DAYS_PER_YEAR).toFixed(2)} yr`}</Row>
            <ValueRow label="Trip, Earth (canon)" value={ship.voyage.earthYears} format={(years) => `${years} yr`} />
            <Row label="Trip, aboard" note={COMPUTED}>{`${(voyage.trip.properTotalS / 86_400 / DAYS_PER_YEAR).toFixed(2)} yr`}</Row>
            <ValueRow label="Trip, aboard (quoted)" value={ship.voyage.shipYears} format={(years) => yearsMonths(years * DAYS_PER_YEAR)} />
            <Row label="Top speed" note={COMPUTED}>{`${voyage.trip.peakBeta.toFixed(4)} c`}</Row>
          </>
        )}
        <ValueRow label="Launch" value={ship.voyage.launchJd} format={dateOf} />
        {voyage !== null && <Row label="Arrival" note={COMPUTED}>{dateOf(voyage.arrivalJd)}</Row>}
        <ValueRow label="Orbit at Adrian" value={ship.voyage.orbitSpeedKmS} format={(v) => `${v} km/s`} />
        {voyage !== null && (
          <Row label="Its radius" note={{ text: 'GM / v², Adrian’s mass invented', kind: 'computed' }}>
            {`${Math.round(voyage.orbitRadiusKm).toLocaleString('en-US')} km`}
          </Row>
        )}
        <ValueRow label="Length" value={ship.lengthM} format={(m) => `${m} m`} />
        {ship.facts.map((fact) => (
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
      <RealityCheck record={ship} />
    </Panel>
  );
}

/**
 * A fiction drawn over a real body -- Adrian over τ Ceti e (core/fiction.ts overlayOf) -- in the
 * real body's own panel, under everything real and apart from it: shown only while the Fiction
 * layer is on. The real values above it stay as they are; this says so.
 */
export function FictionOverlaySection({ record }: { record: FictionRecord }) {
  const about = fictionAboutKey(record.id);
  return (
    <div style={{ marginTop: '0.8rem', paddingTop: '0.7rem', borderTop: `1px solid ${FICTION_COLOR}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: FICTION_COLOR, fontSize: '0.8rem' }}>△</span>
        <span style={{ fontSize: '0.78rem', color: '#e0e0e0' }}>{record.name}</span>
        <FictionTag record={record} />
      </div>
      <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#c4c4c4' }}>{workLine(record.work)}</div>
      <div style={{ marginTop: '0.2rem', fontSize: '0.68rem', color: '#8a8a8a' }}>
        Orbit, size and period above are the real candidate’s, not the fiction’s.
      </div>
      {about !== null && <ReadMore name={FICTION_ABOUT_NAMES[about]} about={fictionReadingId(record.id)} />}
      <dl style={{ margin: '0.7rem 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <ValueRow label="Mass" value={record.massEarth} format={(m) => `${m} Earths`} />
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
    </div>
  );
}

function RealityCheck({ record }: { record: FictionBase }) {
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
