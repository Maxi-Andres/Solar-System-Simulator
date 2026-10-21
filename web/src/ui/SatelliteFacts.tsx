import type { BodyId, SatelliteAccuracy } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { satelliteFacts, satelliteNow } from '../core/satelliteBodies.ts';
import { satelliteBodyChip, SATELLITE_CHIPS } from '../core/satelliteGroups.ts';
import { BULK_WINDOW_DAYS, NAMED_WINDOW_DAYS, REGIME_SHIFT, TYPE_SHIFT } from '../core/satellites.ts';
import { ESA_MODEL_CREDIT } from '../scene/craftModels.ts';
import { facingRule } from './facing.ts';

/**
 * What the info panel says about an Earth satellite (see satelliteBodies.ts): who it is in
 * the catalogue, what it is doing now -- its height, period and inclination from its own
 * model at the clock's instant -- and how far its elements are being carried, with the
 * window it is drawn in. In place of the natural-body facts: a satellite has no radius,
 * mass or rotation the data could quote.
 */

const REGIME_LABELS = ['Low Earth orbit', 'Medium Earth orbit', 'Geosynchronous', 'Highly elliptical'];
const TYPE_LABELS = ['Payload', 'Rocket body', 'Debris', 'Unknown'];

/** A UTC Julian day as "2026-10-21 04:56 UTC". */
function utcDate(jdUtc: number): string {
  return `${new Date((jdUtc - 2440587.5) * 86_400_000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** A TDB Julian day as a calendar date, which is all a window's edge needs. */
function tdbDate(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}

/** The measured bulk-model error for a regime nearest `days` out, as "4 km (95%: 8)". */
export function bulkAccuracyText(
  accuracy: readonly SatelliteAccuracy[],
  regime: string,
  days: number,
): string | null {
  const row = accuracy.find((candidate) => candidate.regime === regime);
  if (row === undefined || row.days.length === 0) {
    return null;
  }
  // The first measured day at or past this one: the error is never quoted for less time
  // than has gone by.
  let at = row.days.findIndex((day) => day >= Math.abs(days));
  if (at < 0) {
    at = row.days.length - 1;
  }
  return `${Math.round(row.medianKm[at]!)} km median, ${Math.round(row.p95Km[at]!)} km at 95%`;
}

export function SatelliteFacts({ id, store, jd }: { readonly id: BodyId; readonly store: EphemerisStore; readonly jd: number }) {
  const facts = satelliteFacts(id);
  if (facts === null) {
    return null;
  }
  const now = satelliteNow(id, jd);
  const coverage = store.coverage(id);
  const flags = facts.flags;
  const regime = (flags >>> REGIME_SHIFT) & 3;
  const type = (flags >>> TYPE_SHIFT) & 3;
  const chip = SATELLITE_CHIPS[satelliteBodyChip(id)];
  // A named satellite with a model or a box: what is on screen up close, and which way it
  // faces -- said, as for a craft, because the facing is a rule and not a measurement.
  const body = store.body(id);
  const shape = body.mission?.shape ?? null;
  const bulk = facts.bulk;
  const accuracy =
    bulk === null || now === null
      ? null
      : bulkAccuracyText(
          bulk.satellites.info.accuracy,
          bulk.satellites.info.regimes[regime] ?? 'leo',
          // Days from the reference instant, which is what the generator measured from.
          now.ageDays + (facts.epochJdUtc - bulk.satellites.info.referenceJdUtc),
        );

  return (
    <>
      <dt style={TERM}>Catalogue</dt>
      <dd style={VALUE}>{`NORAD ${facts.noradId} · ${facts.cosparId}`}</dd>
      {facts.operator !== null && (
        <>
          <dt style={TERM}>Operator</dt>
          <dd style={VALUE}>{facts.operator}</dd>
        </>
      )}
      {facts.launchDate !== null && (
        <>
          <dt style={TERM}>Launched</dt>
          <dd style={VALUE}>{facts.launchDate}</dd>
        </>
      )}
      <dt style={TERM}>Kind</dt>
      <dd style={VALUE}>{`${TYPE_LABELS[type]} · ${chip?.label ?? 'Other'}`}</dd>
      <dt style={TERM}>Orbit</dt>
      <dd style={VALUE}>{REGIME_LABELS[regime]}</dd>
      {now !== null && (
        <>
          <dt style={TERM}>Altitude now</dt>
          <dd style={VALUE}>{`${Math.round(now.heightKm).toLocaleString('en-US')} km`}</dd>
          <dt style={TERM}>Period</dt>
          <dd style={VALUE}>
            {now.periodMinutes < 180
              ? `${now.periodMinutes.toFixed(1)} min`
              : `${(now.periodMinutes / 60).toFixed(2)} h`}
          </dd>
          <dt style={TERM}>Inclination</dt>
          <dd style={VALUE}>{`${now.inclinationDeg.toFixed(2)}°`}</dd>
        </>
      )}
      {shape !== null && (
        <>
          <dt style={TERM}>Span</dt>
          <dd style={VALUE}>{`${(body.radiusEquatorialKm * 2000).toFixed(1)} m`}</dd>
          <dt style={TERM}>Drawn as</dt>
          <dd style={VALUE}>
            {shape.model === null ? 'Box, published size' : `${shape.modelOwner ?? 'NASA'} 3D model`}
          </dd>
          {/* ESA's permission asks for its credit wherever its models are used. */}
          {shape.model !== null && shape.modelOwner === 'ESA' && (
            <>
              <dt style={TERM}>Model</dt>
              <dd style={VALUE}>{ESA_MODEL_CREDIT}</dd>
            </>
          )}
          <dt style={TERM}>Facing (modelled)</dt>
          <dd style={VALUE}>{facingRule(shape)}</dd>
          {shape.facingNote !== undefined && <dd style={NOTE}>{shape.facingNote}</dd>}
        </>
      )}

      <div style={{ gridColumn: '1 / -1', height: 1, background: '#242424', margin: '0.3rem 0' }} />
      <dt style={TERM}>Elements</dt>
      <dd style={VALUE}>{utcDate(facts.epochJdUtc)}</dd>
      {now !== null && (
        <>
          <dt style={TERM}>Carried</dt>
          <dd style={VALUE}>{`${now.ageDays >= 0 ? '+' : '−'}${Math.abs(now.ageDays).toFixed(2)} d from them`}</dd>
        </>
      )}
      {coverage !== null && (
        <>
          <dt style={TERM}>Shown</dt>
          <dd style={VALUE}>{`${tdbDate(coverage.startJd)} to ${tdbDate(coverage.stopJd)}`}</dd>
        </>
      )}
      <dt style={TERM}>Model</dt>
      <dd style={VALUE}>{facts.model === 'sgp4' ? 'SGP4' : 'SGP4 secular terms'}</dd>
      {accuracy !== null && (
        <>
          <dt style={TERM}>Off SGP4 by</dt>
          <dd style={VALUE}>{accuracy}</dd>
        </>
      )}
      <dd style={NOTE}>
        {facts.model === 'sgp4'
          ? `Placed by SGP4 from the US Space Force's element set, as CelesTrak relays it: the model those elements are made for, good to a few kilometres for a day or two and drifting with drag after. Drawn only within ${NAMED_WINDOW_DAYS} days of the elements: the ISS, the worst case here, is 40 km off by then.`
          : `Placed by SGP4's secular terms alone, the model the dots are drawn with, so it is where its dot was; marked approximate for it. Drawn only within ${BULK_WINDOW_DAYS} days of the data, where that model was measured.`}
        {facts.note !== null && ` ${facts.note}`}
      </dd>
    </>
  );
}

const TERM: React.CSSProperties = { color: '#5e5e5e', fontSize: '0.7rem', whiteSpace: 'nowrap' };
const VALUE: React.CSSProperties = {
  margin: 0,
  color: '#c4c4c4',
  fontSize: '0.72rem',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const NOTE: React.CSSProperties = {
  gridColumn: '1 / -1',
  color: '#6a6a6a',
  fontSize: '0.64rem',
  lineHeight: 1.45,
  margin: '0.3rem 0 0',
};
