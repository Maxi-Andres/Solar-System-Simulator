import type { BodyId } from '@sss/tools/types';

import {
  blackHoleSystemOf,
  M87_MASS_SUN,
  M87_REFERENCE,
  relativeSkyOrbit,
  S2_ORBIT,
  S2_SKY_ORBIT,
  S2_STAR,
  schwarzschildRadiusKm,
  SGR_A_DISTANCE_PC,
  SGR_A_MASS_SUN,
  SGR_A_REFERENCE,
  type BlackHoleSystem,
  type SkyOrbit,
} from '../core/blackHoles.ts';
import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { CRITICAL_IMPACT, shadowAngle } from '../core/schwarzschildLens.ts';
import { S_STARS } from '../core/galacticCentreStars.ts';
import { R0_PC } from '../core/milkyWay.ts';
import { SAMPLE_COUNT } from '../core/nuclearCluster.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { Panel } from './Panel.tsx';
import { formatStarDistance } from './StarFacts.tsx';

/**
 * The info panel for a black hole, or for the star on its orbit (blackHoles.ts): short rows,
 * a number and whose it is. Why the shadow and the lensing are drawn as they are, and what
 * is not drawn, is the About's to say.
 */

const AU_KM = 149_597_870.7;

/** Pluto's aphelion, AU: what M87*'s horizon is held against. */
const PLUTO_APHELION_AU = 49.3;

/**
 * The ring the EHT imaged about Sgr A*, microarcseconds across: EHT Collaboration 2022,
 * ApJL 930, L12 -- light from gas just outside the photon sphere, at 1.3 mm, not the
 * shadow's edge itself; the two agree within its error.
 */
const EHT_RING_MICROARCSEC = 51.8;
const EHT_RING_ERROR_MICROARCSEC = 2.3;

/** Sgr A*'s shadow from here, microarcseconds across, at GRAVITY's mass and distance. */
function sgrAShadowMicroarcsec(): number {
  const rs = schwarzschildRadiusKm(SGR_A_MASS_SUN);
  return (2 * shadowAngle((SGR_A_DISTANCE_PC * PARSEC_KM) / rs) * 180 * 3600e6) / Math.PI;
}

export function BlackHolePanel({
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
  const system = blackHoleSystemOf(focus);
  if (system === null) {
    return null;
  }
  const body = store.body(focus);
  const isHole = focus === system.id;
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>{isHole ? '○' : '●'}</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {isHole ? 'black hole' : 'star'}
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Distance">{fromSun === null ? '--' : formatStarDistance(fromSun / PARSEC_KM)}</Row>
        {isHole ? (
          <HoleFacts store={store} system={system} />
        ) : (
          <CompanionFacts store={store} system={system} focus={focus} jd={jd} distanceMode={distanceMode} />
        )}
      </dl>
    </Panel>
  );
}

function HoleFacts({ store, system }: { store: EphemerisStore; system: BlackHoleSystem }) {
  const binary = system.binary;
  const massSun = binary === null ? SGR_A_MASS_SUN : binary.blackHoleMassSun;
  const rs = schwarzschildRadiusKm(massSun);
  // Seen from afar: sqrt(27)/2 horizons (schwarzschildLens.ts).
  const shadow = rs * CRITICAL_IMPACT;
  return (
    <>
      <Row label="Mass">
        {binary === null ? `${(massSun / 1e6).toFixed(3)} million M☉` : `${massSun.toFixed(2)} M☉`}
      </Row>
      <Row label="Horizon radius">
        {rs > 1e6 ? `${(rs / 1e6).toFixed(1)} million km · ${(rs / AU_KM).toFixed(3)} AU` : `${rs.toFixed(1)} km`}
      </Row>
      <Row label="Shadow radius">
        {shadow > 1e6 ? `${(shadow / 1e6).toFixed(1)} million km · ${(shadow / AU_KM).toFixed(3)} AU` : `${shadow.toFixed(1)} km`}
      </Row>
      {binary === null && (
        <>
          <Row label="Shadow from Earth">{`${sgrAShadowMicroarcsec().toFixed(1)} µas across`}</Row>
          <Row label="EHT ring (2022)">{`${EHT_RING_MICROARCSEC} ± ${EHT_RING_ERROR_MICROARCSEC} µas`}</Row>
        </>
      )}
      {binary?.spin == null ? (
        <Row label="Spin">Unmeasured: drawn as none</Row>
      ) : (
        <>
          <Row label="Spin">{binary.spin.text}</Row>
          <Row label="">{`${binary.spin.reference}; drawn as none`}</Row>
        </>
      )}
      <Row label="Lensing">Drawn: Schwarzschild</Row>
      <Row label="Disc">{binary?.accreting === true ? 'X-rays only: not drawn' : 'None in visible light'}</Row>
      {binary !== null && (
        <>
          <Divider />
          <Row label="Star">{store.body(system.companion).name}</Row>
          <OrbitRows orbit={relativeSkyOrbit(binary)} />
          {binary.gaiaDr3 !== null && <Row label="Gaia DR3">{binary.gaiaDr3}</Row>}
          <Row label="Source">{binary.reference}</Row>
        </>
      )}
      {binary === null && (
        <>
          <Row label="Measured from">S2 and three more stars</Row>
          <Row label="Galaxy model's centre">{`${Math.round(SGR_A_DISTANCE_PC - R0_PC)} pc nearer`}</Row>
          <Row label="S-stars">{`${S_STARS.length} on orbits`}</Row>
          <Row label="Nuclear cluster">{`Model: ${SAMPLE_COUNT.toLocaleString('en-US')} stars`}</Row>
          <Row label="Source">{SGR_A_REFERENCE}</Row>
          <Divider />
          <Row label="M87*'s horizon">
            {`${Math.round(schwarzschildRadiusKm(M87_MASS_SUN) / AU_KM)} AU: ${(
              schwarzschildRadiusKm(M87_MASS_SUN) / AU_KM / PLUTO_APHELION_AU
            ).toFixed(1)}× Pluto's farthest`}
          </Row>
          <Row label="">{`not placed: 55 million ly (${M87_REFERENCE.split(',')[0]})`}</Row>
        </>
      )}
    </>
  );
}

function CompanionFacts({
  store,
  system,
  focus,
  jd,
  distanceMode,
}: {
  store: EphemerisStore;
  system: BlackHoleSystem;
  focus: BodyId;
  jd: number;
  distanceMode: DistanceMode;
}) {
  const binary = system.binary;
  const fromHole = store.distanceBetween(focus, system.id, jd, distanceMode);
  const speed = store.speedRelativeTo(focus, system.id, jd);
  const orbit = binary === null ? S2_SKY_ORBIT : relativeSkyOrbit(binary);
  const mass = binary === null ? S2_STAR.massSun : binary.starMassSun;
  const radius = binary === null ? S2_STAR.radiusSun : binary.starRadiusSun;
  const temperature = binary === null ? S2_STAR.temperatureK : binary.starTemperatureK;
  return (
    <>
      <Row label={`From ${system.name}`}>{fromHole === null ? '--' : `${(fromHole / AU_KM).toFixed(2)} AU`}</Row>
      <Row label={`Speed around ${system.name}`}>{speed === null ? '--' : `${speed.toFixed(1)} km/s`}</Row>
      <OrbitRows orbit={orbit} />
      <Divider />
      <Row label="Mass">{`${mass} M☉`}</Row>
      <Row label="Radius">{`${radius} R☉, fitted`}</Row>
      <Row label="Temperature">{`${temperature.toLocaleString('en-US')} K`}</Row>
      <Row label="Source">
        {binary === null ? `${SGR_A_REFERENCE.split(',')[0]}; Habibi et al. 2017` : binary.reference}
      </Row>
      {binary === null && <Row label="Precession">{`Not drawn (12′ per orbit)`}</Row>}
      {binary === null && <Row label="Last periastron">{`${S2_ORBIT.periastronYear.toFixed(2)}`}</Row>}
    </>
  );
}

function OrbitRows({ orbit }: { orbit: SkyOrbit }) {
  const days = orbit.periodDays;
  return (
    <>
      <Row label="Period">{days < 1000 ? `${days.toFixed(1)} days` : `${(days / 365.25).toFixed(2)} years`}</Row>
      <Row label="Separation">{`${(orbit.semiMajorAxisKm / AU_KM).toFixed(orbit.semiMajorAxisKm > 100 * AU_KM ? 0 : 2)} AU`}</Row>
      <Row label="Eccentricity">{orbit.eccentricity.toFixed(3)}</Row>
      <Row label="Closest">{`${((orbit.semiMajorAxisKm * (1 - orbit.eccentricity)) / AU_KM).toFixed(orbit.semiMajorAxisKm > 100 * AU_KM ? 0 : 2)} AU`}</Row>
    </>
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
