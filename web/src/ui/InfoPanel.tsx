import type { CraftShape, Seam } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { DistanceMode } from '../core/ephemerisStore.ts';
import { useViewStore } from '../state/store.ts';
import { Panel } from './Panel.tsx';

/**
 * Facts about the focused body.
 *
 * Every figure here is either a catalog constant with a cited source or a live value
 * computed from the ephemerides — nothing is decorative.
 */

const AU_KM = 149_597_870.7;

export interface InfoPanelProps {
  readonly store: EphemerisStore;
  readonly jd: number;
  readonly distanceMode: DistanceMode;
  readonly tick: number;
}

export function InfoPanel({ store, jd, distanceMode, tick }: InfoPanelProps) {
  const focus = useViewStore((state) => state.focus);
  const closePanel = useViewStore((state) => state.closePanel);
  void tick;

  const body = store.body(focus);

  // What the body orbits. A moon's orbital speed, period and apsides are about its
  // planet; quoting its speed against the Sun would mostly be the planet's.
  const primary = store.body(body.parent ?? 'sun');
  const isCraft = body.kind === 'spacecraft';
  // JWST: a spacecraft that moves with a planet rather than on its own about the Sun.
  const hasPrimary = body.parent !== null;

  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const fromPrimary = hasPrimary ? store.distanceBetween(focus, primary.id, jd, distanceMode) : null;
  const speed = store.speedRelativeTo(focus, primary.id, jd);
  const lightTime = store.lightTimeSeconds(focus, 'sun', jd, distanceMode);
  const fromEarth = focus === 'earth' ? null : store.distanceBetween(focus, 'earth', jd, distanceMode);

  return (
    <Panel title={body.name} onClose={closePanel} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>&#9679;</span>
        <span
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.1em',
            color: '#5a5a5a',
            textTransform: 'uppercase',
          }}
        >
          {body.kind.replace('-', ' ')}
        </span>
      </div>

      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />

      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        <Row label="Distance from Sun">
          {fromSun === null ? '--' : `${(fromSun / AU_KM).toFixed(4)} AU`}
        </Row>
        <Row label="">
          {fromSun === null ? '' : `${Math.round(fromSun).toLocaleString('en-US')} km`}
        </Row>
        {hasPrimary && (
          <Row label={`From ${primary.name}`}>
            {fromPrimary === null ? '--' : `${Math.round(fromPrimary).toLocaleString('en-US')} km`}
          </Row>
        )}
        <Row
          label={
            hasPrimary
              ? `Speed around ${primary.name}`
              : isCraft
                ? 'Speed (Sun)'
                : 'Orbital speed'
          }
        >
          {speed === null ? '--' : `${speed.toFixed(3)} km/s`}
        </Row>
        <Row label="Light time">
          {lightTime === null || focus === 'sun' ? '--' : formatLightTime(lightTime)}
        </Row>
        {fromEarth !== null && !(hasPrimary && primary.id === 'earth') && (
          <Row label="From Earth">{`${(fromEarth / AU_KM).toFixed(4)} AU`}</Row>
        )}

        <Divider />

        {isCraft ? (
          <CraftFacts store={store} jd={jd} distanceMode={distanceMode} />
        ) : (
          <NaturalFacts store={store} />
        )}
      </dl>
    </Panel>
  );
}

/**
 * What a spacecraft is, and how long it has been out there.
 *
 * The signal time is to Earth, not the Sun: it is the number that matters for a craft,
 * how long a command takes to reach it. Geometric, like every light time here.
 */
function CraftFacts({
  store,
  jd,
  distanceMode,
}: {
  store: EphemerisStore;
  jd: number;
  distanceMode: DistanceMode;
}) {
  const focus = useViewStore((state) => state.focus);
  const body = store.body(focus);
  const mission = body.mission;
  const signal = store.lightTimeSeconds(focus, 'earth', jd, distanceMode);
  const coverage = store.coverage(focus);
  // Days since launch. The clock runs in TDB and the launch is UTC; the 69 s between
  // them is invisible at this precision.
  const launchJd = mission === null ? null : Date.parse(mission.launchUtc) / 86_400_000 + 2440587.5;
  const elapsedDays = launchJd === null ? null : jd - launchJd;
  // The largest place JPL's path jumps, so a craft seen teleporting has a reason on screen.
  const largestSeam = (store.pathInfo(focus)?.seams ?? []).reduce<Seam | null>(
    (largest, seam) => (largest === null || seam.jumpKm > largest.jumpKm ? seam : largest),
    null,
  );
  // A craft on the ground: where it stands, from NASA's traverse.
  const site = mission?.site ?? null;
  const stop = site === null ? null : store.surfaceStopAt(focus, jd);

  return (
    <>
      <Row label="Signal time to Earth">{signal === null ? '--' : formatLightTime(signal)}</Row>
      {/* The largest deployed dimension, which is what the radius stands for. */}
      <Row label="Span">{`${(body.radiusEquatorialKm * 2000).toFixed(1)} m`}</Row>
      {mission !== null && (
        <>
          <Row label="Operator">{mission.operator}</Row>
          <Row label="Launched">{mission.launchUtc.slice(0, 10)}</Row>
          {/* Only for a craft that was destroyed; data from before the field has none. */}
          {typeof mission.endUtc === 'string' && (
            <Row label="Ended">{mission.endUtc.slice(0, 10)}</Row>
          )}
          {/* What is on screen up close, and which way it faces: said, because the
              facing is a rule and not a measurement. Data from before the shapes has
              none at all, and says nothing. */}
          {mission.shape === null && (
            <Row label="Drawn as">Marker: no published dimensions</Row>
          )}
          {mission.shape !== null && mission.shape !== undefined && (
            <>
              <Row label="Drawn as">
                {mission.shape.model === null ? 'Box, published size' : 'NASA 3D model'}
              </Row>
              {site === null && (
                <Row label="Facing (modelled)">{facingRule(mission.shape)}</Row>
              )}
            </>
          )}
        </>
      )}
      {site !== null && (
        <>
          <Row label="Landed">{site.landingUtc.slice(0, 10)}</Row>
          {stop !== null && (
            <>
              <Row label="Stands at">
                {formatLatLon(stop.track.latitudeDeg[stop.index]!, stop.track.longitudeDeg[stop.index]!)}
              </Row>
              <Row label="Heading">
                {stop.track.headingDeg[stop.index] === null
                  ? 'Unpublished; drawn north'
                  : `${Math.round(stop.track.headingDeg[stop.index]!)}° from north (NASA)`}
              </Row>
              {stop.index > 0 && (
                <Row label="Last drive">
                  {`Sol ${stop.track.sol[stop.index]!}, ended by ${formatTdbDate(stop.track.t[stop.index]!)}`}
                </Row>
              )}
            </>
          )}
        </>
      )}
      {elapsedDays !== null && elapsedDays >= 0 && (
        <Row label="Mission time">
          {elapsedDays < 365.25
            ? `${Math.floor(elapsedDays)} d`
            : `${(elapsedDays / 365.25).toFixed(2)} yr`}
        </Row>
      )}
      {coverage !== null && (
        <Row label={site === null ? 'JPL path until' : 'Position known until'}>
          {formatTdbDate(coverage.stopJd)}
        </Row>
      )}
      {largestSeam !== null && (
        <Row label="Largest path jump">
          {`${Math.round(largestSeam.jumpKm).toLocaleString('en-US')} km, ${formatTdbDate(largestSeam.startJd)}`}
        </Row>
      )}
    </>
  );
}

function NaturalFacts({ store }: { store: EphemerisStore }) {
  const focus = useViewStore((state) => state.focus);
  const body = store.body(focus);
  const elements = store.elementsFor(focus);
  const isMoon = body.parent !== null;
  const flattening = 1 - body.radiusPolarKm / body.radiusEquatorialKm;
  const periodDays = elements === null ? null : elements.periodSec / 86_400;
  const rotationHours = body.rotationPeriodHours;

  return (
    <>
      {body.triaxialRadiiKm === null ? (
        <>
          <Row label="Equatorial radius">
            {`${body.radiusEquatorialKm.toLocaleString('en-US')} km`}
          </Row>
          {flattening > 0.0005 && (
            <Row label="Polar flattening">{`${(flattening * 100).toFixed(2)} %`}</Row>
          )}
        </>
      ) : (
        // Three radii, long axis first: the one that points at the planet.
        <Row label="Radii">
          {`${body.triaxialRadiiKm.map((radius) => radius.toLocaleString('en-US')).join(' × ')} km`}
        </Row>
      )}
      <Row label="GM">{`${body.gmKm3S2.toLocaleString('en-US')} km³/s²`}</Row>
      {rotationHours !== null && (
        <Row label="Rotation period">
          {`${Math.abs(rotationHours).toFixed(2)} h${
            isMoon
              ? rotationHours < 0
                ? ' (synchronous, retrograde)'
                : ' (synchronous)'
              : rotationHours < 0
                ? ' (retrograde)'
                : ''
          }`}
        </Row>
      )}
      {body.axialTiltDeg !== null && (
        <Row label="Axial tilt">{`${body.axialTiltDeg.toFixed(2)}°`}</Row>
      )}

      {elements !== null && periodDays !== null && (
        <>
          <Divider />
          <Row label="Orbital period">
            {isMoon ? `${periodDays.toFixed(3)} d` : `${(periodDays / 365.25).toFixed(3)} yr`}
          </Row>
          <Row label="Eccentricity">{elements.eccentricity.toFixed(5)}</Row>
          {/* Against the ecliptic, like every element here -- which for a moon is not
              the plane it orbits in. Io is 2.2 degrees out by this measure and 0.04
              from Jupiter's equator. Labelled, rather than quietly converted. */}
          <Row label={isMoon ? 'Inclination (ecliptic)' : 'Inclination'}>
            {`${elements.inclinationDeg.toFixed(3)}°`}
          </Row>
          {isMoon ? (
            <>
              <Row label="Periapsis">
                {`${Math.round(elements.periapsisKm).toLocaleString('en-US')} km`}
              </Row>
              <Row label="Apoapsis">
                {`${Math.round(elements.apoapsisKm).toLocaleString('en-US')} km`}
              </Row>
            </>
          ) : (
            <>
              <Row label="Perihelion">{`${(elements.periapsisKm / AU_KM).toFixed(4)} AU`}</Row>
              <Row label="Aphelion">{`${(elements.apoapsisKm / AU_KM).toFixed(4)} AU`}</Row>
            </>
          )}
        </>
      )}
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
  return (
    <div
      style={{ gridColumn: '1 / -1', height: 1, background: '#202020', margin: '0.4rem 0' }}
    />
  );
}

/** A craft's pointing rule, in words. See CraftShape. */
function facingRule(shape: CraftShape): string {
  const part = {
    dish: 'Dish',
    'heat-shield': 'Heat shield',
    sunshield: 'Sunshield',
    'solar-arrays': 'Solar arrays',
    'spin-axis': 'Spin axis',
    deck: 'Deck',
  }[shape.pointingPart];
  const target = {
    earth: 'Earth',
    sun: 'Sun',
    'ecliptic-south': 'ecliptic south',
    zenith: 'zenith',
  }[shape.pointsAt];
  return `${part} to ${target}`;
}

/** A place on a body, as maps write it: "4.825° S, 137.389° E". */
function formatLatLon(latitudeDeg: number, longitudeDeg: number): string {
  const east = ((longitudeDeg % 360) + 360) % 360;
  const lat = `${Math.abs(latitudeDeg).toFixed(3)}° ${latitudeDeg < 0 ? 'S' : 'N'}`;
  return `${lat}, ${east.toFixed(3)}° E`;
}

/** A TDB Julian day as a calendar date, which is all a coverage edge needs. */
function formatTdbDate(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}

function formatLightTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ${Math.round(seconds % 60)} sec`;
  }
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
