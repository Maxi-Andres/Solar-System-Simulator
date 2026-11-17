import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { messierMarkOf, messierRadiusKm } from '../core/messier.ts';
import { notableStarOf } from '../core/notableStars.ts';
import { flybyOfNotable } from '../core/stellarFlybys.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { FlybyFacts } from './FlybyFacts.tsx';
import { Panel } from './Panel.tsx';
import { formatStarDistance } from './StarFacts.tsx';

/**
 * The info panel for a 'deep-sky' mark: a Messier object marked by messier.ts, or a star or
 * black hole marked by notableStars.ts. Short rows, each with its source.
 */
export function DeepSkyPanel({
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
  const mark = messierMarkOf(focus);
  if (mark === null) {
    return <NotableStarPanel store={store} focus={focus} jd={jd} distanceMode={distanceMode} onClose={onClose} />;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const radiusKm = messierRadiusKm(mark);
  const others = mark.aliases.filter((alias) => alias !== mark.name && !alias.startsWith('Messier '));
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>&#9679;</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {mark.type}
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Messier">{`M${mark.m}`}</Row>
        {others.length > 0 && <Row label="Also">{others.join(' · ')}</Row>}
        <Row label="Distance">{fromSun === null ? '--' : formatStarDistance(fromSun / PARSEC_KM)}</Row>
        {mark.distanceErrorPc !== null && <Row label="">{`± ${mark.distanceErrorPc < 10 ? mark.distanceErrorPc.toFixed(1) : Math.round(mark.distanceErrorPc)} pc`}</Row>}
        {mark.parallaxMas !== null && <Row label="Parallax">{`${mark.parallaxMas.toFixed(3)} mas`}</Row>}
        <Row label="From">{mark.distanceMethod}</Row>
        <Row label="Source">{mark.distanceReference}</Row>
        {mark.note !== null && <Row label="Note">{mark.note}</Row>}
        {(radiusKm !== null || mark.members !== null) && <Divider />}
        {radiusKm !== null && mark.radiusArcmin !== null && (
          <Row label="Radius">{`${mark.radiusArcmin.toFixed(1)}′ · ${(radiusKm / PARSEC_KM).toFixed(1)} pc`}</Row>
        )}
        {radiusKm !== null && <Row label="Radius from">{mark.radiusSource}</Row>}
        {mark.members !== null && <Row label="Members">{`${mark.members.toLocaleString('en-US')} (Gaia)`}</Row>}
        <Row label="Drawn">a mark</Row>
      </dl>
    </Panel>
  );
}

function NotableStarPanel({
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
  const star = notableStarOf(focus);
  if (star === null) {
    return null;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const flyby = flybyOfNotable(star.key);
  const pc = (value: number) => (value < 10 ? value.toFixed(2) : String(Math.round(value)));
  const error =
    star.distanceUpPc === null || star.distanceDownPc === null
      ? null
      : Math.abs(star.distanceUpPc - star.distanceDownPc) < 0.05 * star.distanceUpPc
        ? `± ${pc(star.distanceUpPc)} pc`
        : `+${pc(star.distanceUpPc)} −${pc(star.distanceDownPc)} pc`;
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>&#9679;</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {star.type}
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {star.aliases.length > 0 && <Row label="Also">{star.aliases.join(' · ')}</Row>}
        <Row label="Distance">{fromSun === null ? '--' : formatStarDistance(fromSun / PARSEC_KM)}</Row>
        {error !== null && <Row label="">{error}</Row>}
        {star.parallaxMas !== null && <Row label="Parallax">{`${star.parallaxMas} mas`}</Row>}
        <Row label="From">{star.distanceMethod}</Row>
        <Row label="Source">{star.distanceReference}</Row>
        <Row label="Position">{star.positionSource}</Row>
        {star.note !== null && <Row label="Note">{star.note}</Row>}
        {(star.extent !== undefined || star.rows !== undefined) && <Divider />}
        {star.extent !== undefined && (
          <>
            <Row label="Radius">{`${star.extent.pc.toFixed(1)} pc, ${star.extent.label}`}</Row>
            <Row label="Radius from">{star.extent.source}</Row>
          </>
        )}
        {star.rows?.map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
        <Row label="Drawn">
          {star.extent !== undefined
            ? 'its centre; named members marked'
            : star.motion === null
              ? 'a mark'
              : 'a mark, moving as measured'}
        </Row>
        {flyby !== null && <FlybyFacts flyby={flyby} />}
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
