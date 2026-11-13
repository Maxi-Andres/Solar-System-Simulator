import type { BodyId, LaniakeaLandmark } from '@sss/tools/types';
import { useSyncExternalStore } from 'react';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { basinNamesAt, laniakeaCatalogue, structureKindLabel, structureOf, type LaniakeaCatalogue } from '../core/laniakea.ts';
import { GALACTIC_BASIS } from '../scene/galactic.ts';
import { formatGalaxyDistance } from '../scene/LocalGroup.tsx';
import { LIGHT_YEAR_KM, PARSEC_KM } from '../scene/scale.ts';
import { Panel } from './Panel.tsx';

/**
 * The info panel for a named structure of Laniakea's catalogue (laniakea.ts): a cluster, a
 * supercluster, a basin, an attractor or repeller, a void, a wall. Its numbers, each with how it
 * was had, what is estimated said so; which basin each reconstruction puts it in, both, since
 * they disagree about ours. The reasons are the About's.
 */

function formatLightYears(pc: number): string {
  const ly = (pc * PARSEC_KM) / LIGHT_YEAR_KM;
  return ly >= 1e9 ? `${(ly / 1e9).toFixed(2)} billion ly` : `${Math.round(ly / 1e6).toLocaleString('en-US')} million ly`;
}

function formatMass(m: number): string {
  const exponent = Math.floor(Math.log10(m));
  const mantissa = m / 10 ** exponent;
  const superscript = String(exponent).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
  return mantissa < 1.05 ? `10${superscript} M☉` : `${mantissa.toFixed(1)} × 10${superscript} M☉`;
}

function formatMpc(pc: number): string {
  return pc >= 10e6 ? `${Math.round(pc / 1e6)} Mpc` : `${(pc / 1e6).toFixed(1)} Mpc`;
}

/** A source line's citation alone: what comes before its first colon. */
function citation(source: string): string {
  const cut = source.indexOf(':');
  return cut < 0 ? source : source.slice(0, cut);
}

/** The panel re-renders with the readout's beat (App.tsx OnReadout): nothing to subscribe to. */
const noSubscribe = (): (() => void) => () => {};

export function StructurePanel({
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
  const landmark = structureOf(focus);
  const catalogue = useSyncExternalStore(noSubscribe, laniakeaCatalogue);
  if (landmark === null) {
    return null;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>◯</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {structureKindLabel(landmark.kind)}
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {landmark.otherNames.length > 0 && <Row label="Also">{landmark.otherNames.slice(0, 3).join(' · ')}</Row>}
        <Row label="Distance">{fromSun === null ? '--' : formatGalaxyDistance(fromSun / PARSEC_KM)}</Row>
        <Row label="">{fromSun === null ? '' : formatLightYears(fromSun / PARSEC_KM)}</Row>
        <Row label="Distance from">{`${landmark.distanceMethod}${landmark.distanceEstimated ? ', estimated' : ''}`}</Row>
        <StructureRows landmark={landmark} catalogue={catalogue} />
        <Row label="Source">{citation(landmark.source)}</Row>
      </dl>
    </Panel>
  );
}

function StructureRows({ landmark, catalogue }: { landmark: LaniakeaLandmark; catalogue: LaniakeaCatalogue | null }) {
  const basins = catalogue === null ? null : basinNamesAt(catalogue, [landmark.x, landmark.y, landmark.z]);
  const own = landmark.basin ?? [];
  const volumes = catalogue?.info.basins.basins ?? [];
  const volumeOf = (grid: string, label: number) => volumes.find((b) => b.grid === grid && b.label === label)?.volumeMpc3 ?? null;
  return (
    <>
      {landmark.kind === 'cluster' && landmark.radiusPc !== null && <Row label="Radius">{`${formatMpc(landmark.radiusPc)}, estimated`}</Row>}
      {landmark.kind === 'wall' && landmark.radiusPc !== null && <Row label="Length">{formatMpc(2 * landmark.radiusPc)}</Row>}
      {landmark.kind === 'void' && landmark.extentPc !== null && (
        <Row label="Extent">{`${landmark.extentPc.map((e) => Math.round(e / 1e6)).join(' × ')} Mpc, rough`}</Row>
      )}
      {own.map(({ grid, label }) => {
        const volume = volumeOf(grid, label);
        return volume === null ? null : (
          <Row key={grid} label={grid === 'groupsAttraction' ? 'Volume, groups' : grid === 'galaxiesRepulsion' ? 'Volume' : 'Volume, galaxies'}>
            {`${(volume / 1e6).toFixed(1)} million Mpc³`}
          </Row>
        );
      })}
      {landmark.massSun !== null && <Row label="Mass">{`${formatMass(landmark.massSun)}, estimated`}</Row>}
      {landmark.members !== null && (
        <Row label={landmark.kind === 'supercluster' ? 'Abell clusters' : 'Galaxies'}>{landmark.members.toLocaleString('en-US')}</Row>
      )}
      {basins !== null && (landmark.kind !== 'basin' || landmark.name === 'Laniakea Supercluster') && (
        <>
          <Row label="Basin, galaxies">{basins.galaxies ?? 'None'}</Row>
          <Row label="Basin, groups">{basins.groups ?? 'None'}</Row>
        </>
      )}
      {behindThePlane(landmark, catalogue) && <Row label="">Behind the Milky Way’s plane: few galaxies seen</Row>}
      {landmark.kind === 'wall' && <Row label="Drawn as">A line along it</Row>}
      {landmark.kind === 'void' && <Row label="Drawn as">Ellipsoid of its extents</Row>}
      {landmark.kind === 'basin' && <Row label="Drawn as">{landmark.name === 'Laniakea Supercluster' ? 'Its basin’s outline' : 'Its attractor'}</Row>}
    </>
  );
}

/**
 * Whether it lies in the zone of avoidance, where 2MRS does not look (laniakea.json's
 * zoneOfAvoidance): what is drawn about it there is thin because the Milky Way hides it.
 */
function behindThePlane(landmark: LaniakeaLandmark, catalogue: LaniakeaCatalogue | null): boolean {
  const zone = catalogue?.info.zoneOfAvoidance;
  if (zone === undefined) return false;
  const r = Math.hypot(landmark.x, landmark.y, landmark.z);
  const { x, z } = GALACTIC_BASIS;
  const b = (Math.asin((landmark.x * z.x + landmark.y * z.y + landmark.z * z.z) / r) * 180) / Math.PI;
  const cosL = (landmark.x * x.x + landmark.y * x.y + landmark.z * x.z) / r / Math.cos((b * Math.PI) / 180);
  const nearCentre = cosL > Math.cos((zone.nearCentreLDeg * Math.PI) / 180);
  return Math.abs(b) < (nearCentre ? zone.absBNearCentreDeg : zone.absBDeg);
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
