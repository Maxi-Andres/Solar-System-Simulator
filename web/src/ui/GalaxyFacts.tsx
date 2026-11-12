import type { BodyId } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import {
  absoluteMagnitude,
  catalogueShape,
  centralDensities,
  galaxyLuminosity,
  galaxyOf,
  localGroupCatalog,
  surfaceBrightness,
  type LocalGroupGalaxy,
  UNDRAWN_REASONS,
} from '../core/localGroup.ts';
import { groupLabel, localVolumeCatalog, regionOf } from '../core/localVolume.ts';
import { formatGalaxyDistance } from '../scene/LocalGroup.tsx';
import { LIGHT_YEAR_KM, PARSEC_KM } from '../scene/scale.ts';
import { Panel } from './Panel.tsx';

/**
 * The info panel for a galaxy of the Local Group (localGroup.ts), or one beyond it
 * (localVolume.ts): what is measured of it, a row each, what was estimated marked so, and what
 * its light is drawn as. The model's reasons are the About's.
 */

function formatLuminosity(l: number): string {
  if (l >= 1e9) {
    return `${Number((l / 1e9).toPrecision(3))} billion L☉`;
  }
  if (l >= 1e6) {
    return `${Number((l / 1e6).toPrecision(3))} million L☉`;
  }
  return `${Number(l.toPrecision(3)).toLocaleString('en-US')} L☉`;
}

function formatLightYears(pc: number): string {
  const ly = (pc * PARSEC_KM) / LIGHT_YEAR_KM;
  return ly >= 1e6 ? `${(ly / 1e6).toFixed(2)} million ly` : `${Math.round(ly / 1000).toLocaleString('en-US')},000 ly`;
}

function shapeText(galaxy: LocalGroupGalaxy): string {
  const model = galaxy.model;
  if (model === null) {
    return 'Not measured: its mark only';
  }
  switch (model.kind) {
    case 'plummer':
      return 'Plummer ellipsoid';
    case 'disc':
      return model.bulge === null ? 'Exponential disc' : 'Exponential disc and bulge';
    case 'exponential-ellipsoid':
      return 'Exponential ellipsoid';
    case 'sersic':
      return model.sersicN === 4 ? 'de Vaucouleurs ellipsoid' : `Sérsic ellipsoid, n ${model.sersicN}`;
  }
}

/** A Local Volume galaxy's HI mass: "320 million M☉", "2.1 billion M☉". */
function formatMass(logSun: number): string {
  const m = 10 ** logSun;
  return m >= 1e9 ? `${Number((m / 1e9).toPrecision(2))} billion M☉` : `${Number((m / 1e6).toPrecision(2))} million M☉`;
}

/** An angle on the sky and what it is at the galaxy's distance: "4.2′ · 3.1 kpc". */
function formatSize(arcmin: number, distancePc: number): string {
  const pc = Math.tan((arcmin / 60) * (Math.PI / 180)) * distancePc;
  const at = pc >= 1000 ? `${(pc / 1000).toFixed(1)} kpc` : `${Math.round(pc)} pc`;
  return `${Number(arcmin.toPrecision(3))}′ · ${at}`;
}

export function GalaxyPanel({
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
  const galaxy = galaxyOf(focus);
  if (galaxy === null) {
    return null;
  }
  if (galaxy.volumeIndex !== undefined) {
    return <VolumePanel store={store} focus={focus} jd={jd} distanceMode={distanceMode} onClose={onClose} galaxy={galaxy} />;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const c = localGroupCatalog();
  const k = galaxy.catalogueIndex;
  const at = <T,>(column: readonly T[] | undefined): T | null => (c === null || k === null || column === undefined ? null : (column[k] ?? null));
  const luminosity = galaxyLuminosity(galaxy);
  const absolute = absoluteMagnitude(galaxy);
  const model = galaxy.model;
  const densities = centralDensities(galaxy);
  const shape = c === null || k === null ? null : catalogueShape(c, k);
  const rh = shape?.halfLightArcmin ?? null;
  const ellipticity = shape?.ellipticity ?? null;
  const pa = shape?.positionAngleDeg ?? null;
  const undrawn = c === null || k === null || model !== null ? undefined : UNDRAWN_REASONS[c.catalogueName[k]!];
  const muV0 = at(c?.muV0);
  const vh = at(c?.radialVelocityKmS);
  const sigma = at(c?.sigmaStarsKmS);
  const hi = at(c?.hiMassMillionSun);
  const feH = at(c?.feH);
  const pmRa = at(c?.pmRaMasYr);
  const pmDec = at(c?.pmDecMasYr);
  const up = galaxy.distanceUpPc;
  const down = galaxy.distanceDownPc;
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>⬭</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {galaxy.ambiguous ? 'galaxy or star cluster' : 'galaxy'}
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {galaxy.otherNames.length > 0 && <Row label="Also">{galaxy.otherNames.join(' · ')}</Row>}
        <Row label="Distance">{fromSun === null ? '--' : formatGalaxyDistance(fromSun / PARSEC_KM)}</Row>
        <Row label="">{fromSun === null ? '' : formatLightYears(fromSun / PARSEC_KM)}</Row>
        {up !== null && down !== null && (
          <Row label="">
            {Math.abs(up - down) < 0.05 * up ? `± ${formatGalaxyDistance(up)}` : `+${formatGalaxyDistance(up)} −${formatGalaxyDistance(down)}`}
          </Row>
        )}
        <Row label="Distance from">{galaxy.distanceSource}</Row>
        <Row label="V">{galaxy.vMag === null ? 'Not measured' : `${galaxy.vMag.toFixed(2)}, dereddened`}</Row>
        {absolute !== null && <Row label="M_V">{absolute.toFixed(2)}</Row>}
        {luminosity !== null && <Row label="Luminosity">{formatLuminosity(luminosity)}</Row>}
        {rh !== null && (
          <Row label="Half-light radius">{`${Number(rh.toFixed(2))}′ · ${Math.round(Math.tan((rh / 60) * (Math.PI / 180)) * galaxy.distancePc)} pc`}</Row>
        )}
        {ellipticity !== null && <Row label="Ellipticity">{ellipticity.toFixed(2)}</Row>}
        {pa !== null && <Row label="Position angle">{`${pa}°`}</Row>}
        {model?.kind === 'disc' && (
          <>
            <Row label="Scale length">{`${(model.scaleLengthPc / 1000).toFixed(1)} kpc`}</Row>
            <Row label="Inclination">{`${model.inclinationDeg}°`}</Row>
            <Row label="Position angle">{`${model.positionAngleDeg}°`}</Row>
          </>
        )}
        {muV0 !== null && <Row label="Centre">{`${muV0} mag/″²`}</Row>}
        {vh !== null && <Row label="Radial velocity">{`${vh} km/s`}</Row>}
        {sigma !== null && <Row label="Stars' dispersion">{`${sigma} km/s`}</Row>}
        {hi !== null && <Row label="Gas (HI)">{`${hi} million M☉`}</Row>}
        {feH !== null && <Row label="[Fe/H]">{`${feH}`}</Row>}
        {pmRa !== null && pmDec !== null && <Row label="Proper motion">{`${pmRa}, ${pmDec} mas/yr`}</Row>}
        <Row label="Source">{galaxy.shapeSource}</Row>
        <Divider />
        <Row label="Drawn as">{shapeText(galaxy)}</Row>
        {undrawn !== undefined && <Row label="">{undrawn}</Row>}
        {densities !== null && model?.kind === 'plummer' && (
          <Row label="Centre, drawn">
            {/* A Plummer ellipsoid's column through its centre along its depth axis: (4/3) rho0 c. */}
            {`${surfaceBrightness((4 / 3) * densities.main * model.depthPc).toFixed(1)} mag/″²`}
          </Row>
        )}
        <Row label="Colour">{`B−V ${galaxy.colourIndex.toFixed(2)}, estimated`}</Row>
      </dl>
    </Panel>
  );
}

/** A galaxy beyond the Local Group: its catalogue's values, and what was estimated said so. */
function VolumePanel({
  store,
  focus,
  jd,
  distanceMode,
  onClose,
  galaxy,
}: {
  store: EphemerisStore;
  focus: BodyId;
  jd: number;
  distanceMode: DistanceMode;
  onClose: () => void;
  galaxy: LocalGroupGalaxy;
}) {
  const c = localVolumeCatalog();
  const k = galaxy.volumeIndex!;
  if (c === null) {
    return null;
  }
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const luminosity = galaxyLuminosity(galaxy);
  const absolute = absoluteMagnitude(galaxy);
  const model = galaxy.model;
  const error = c.distanceErrorPc[k] ?? null;
  const t = c.tType[k] ?? null;
  const morphology = c.morphology[k] ?? null;
  const diameter = c.diameterArcmin[k] ?? null;
  const rh = c.halfLightArcmin[k] ?? null;
  const q = c.axisRatio[k] ?? null;
  const inclination = c.inclinationDeg[k] ?? null;
  const pa = c.positionAngleDeg[k] ?? null;
  const vh = c.radialVelocityKmS[k] ?? null;
  const hi = c.logHiMassSun[k] ?? null;
  const est = (estimated: boolean) => (estimated ? ', estimated' : '');
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>⬭</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          galaxy
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {galaxy.otherNames.length > 0 && <Row label="Also">{galaxy.otherNames.slice(0, 4).join(' · ')}</Row>}
        <Row label="In">{groupLabel(c.group[k] ?? null, regionOf(c, k))}</Row>
        <Row label="Distance">{fromSun === null ? '--' : formatGalaxyDistance(fromSun / PARSEC_KM)}</Row>
        <Row label="">{fromSun === null ? '' : formatLightYears(fromSun / PARSEC_KM)}</Row>
        {error !== null && <Row label="">{`± ${formatGalaxyDistance(error)}`}</Row>}
        <Row label="Distance from">{galaxy.distanceSource}</Row>
        <Row label="V">{galaxy.vMag === null ? 'Not measured' : `${galaxy.vMag.toFixed(2)}, dereddened`}</Row>
        {absolute !== null && <Row label="M_V">{absolute.toFixed(2)}</Row>}
        {luminosity !== null && <Row label="Luminosity">{formatLuminosity(luminosity)}</Row>}
        {(morphology !== null || t !== null) && (
          <Row label="Type">{[morphology, t === null ? null : `T ${t}`].filter((part) => part !== null).join(' · ')}</Row>
        )}
        {diameter !== null && <Row label="Holmberg diameter">{formatSize(diameter, galaxy.distancePc)}</Row>}
        {rh !== null && (
          <Row label="Half-light radius">{`${formatSize(rh, galaxy.distancePc)}${est(c.halfLightEstimated[k] ?? false)}`}</Row>
        )}
        {q !== null && <Row label="Axis ratio">{q.toFixed(2)}</Row>}
        {inclination !== null && <Row label="Inclination">{`${Math.round(inclination)}°`}</Row>}
        <Row label="Position angle">{pa === null ? 'Not measured' : `${Math.round(pa)}°`}</Row>
        {vh !== null && <Row label="Radial velocity">{`${Math.round(vh)} km/s`}</Row>}
        {hi !== null && <Row label="Gas (HI)">{formatMass(hi)}</Row>}
        <Row label="Source">{galaxy.shapeSource}</Row>
        <Divider />
        <Row label="Drawn as">{shapeText(galaxy)}</Row>
        {model?.kind === 'disc' && (
          <>
            <Row label="Scale length">{`${(model.scaleLengthPc / 1000).toFixed(2)} kpc`}</Row>
            <Row label="Inclination">
              {pa === null ? '0°, facing us' : `${Math.round(model.inclinationDeg)}°${inclination === null ? ', from its axis ratio' : ''}`}
            </Row>
            {model.bulge !== null && <Row label="Bulge">{`${Math.round(model.bulge.share * 100)}% of its light, estimated`}</Row>}
          </>
        )}
        {(model?.kind === 'plummer' || model?.kind === 'sersic') && (
          <Row label={model.kind === 'plummer' ? 'Half-light radius' : 'Effective radius'}>
            {model.majorPc >= 1000 ? `${(model.majorPc / 1000).toFixed(2)} kpc` : `${Math.round(model.majorPc)} pc`}
          </Row>
        )}
        {model !== null && pa === null && <Row label="">Orientation not measured: drawn round</Row>}
        {model === null && <Row label="">No size measured: its mark only</Row>}
        <Row label="Colour">{`B−V ${galaxy.colourIndex.toFixed(2)}${c.colourIndex[k] == null || c.colourEstimated[k] ? ', estimated' : ''}`}</Row>
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
