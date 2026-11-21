import type { BodyId } from '@sss/tools/types';

import { SGR_A_DISTANCE_PC, SGR_A_MASS_SUN } from '../core/blackHoles.ts';
import { ageGyr, LAST_SCATTERING_RADIUS_MPC, mpcToLy, OBSERVABLE_RADIUS_MPC, PLANCK18 } from '../core/cosmology.ts';
import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import { HELIOPAUSE_NOSE_AU, HILLS_CLOUD_INNER_AU, OORT_CLOUD_OUTER_AU } from '../core/heliosphere.ts';
import { GIANTS } from '../core/localGroup.ts';
import { SUN_ABOVE_PLANE_PC } from '../core/milkyWay.ts';
import { hasDescription } from '../descriptions/ids.ts';
import {
  LOCAL_GROUP_EXTENT_KM,
  LOCAL_VOLUME_EXTENT_KM,
  MILKY_WAY_EXTENT_KM,
  NEARBY_UNIVERSE_EXTENT_KM,
  NEIGHBOURHOOD_EXTENT_KM,
} from '../scene/homeName.ts';
import { AU_KM, LIGHT_YEAR_KM, NEPTUNE_ORBIT_AU, PARSEC_KM } from '../scene/scale.ts';
import { LEVELS, type LevelId } from '../state/levels.ts';
import { Panel } from './Panel.tsx';
import { ReadMore } from './ReadMore.tsx';

/**
 * The info panel for a breadcrumb level selected (state/levels.ts): its name, what kind of thing
 * it is, a few figures each with where it is from -- the ones the app itself draws by, wherever
 * it has them -- and the way into its description, where one is written. Live only where a
 * figure moves: Voyager 1's distance, the centre's distance from the Sun.
 */

/** One line of a level's panel. */
export interface LevelFact {
  readonly label: string;
  readonly value: string;
  /** Where it is from, briefly; null where it is the app's own round figure. */
  readonly source: string | null;
}

/** What the panel reads from the ephemerides: km from the Sun, null where there is none. */
export interface LevelLive {
  /** Voyager 1's, for the Solar System. */
  readonly voyager1Km: number | null;
  /** The focus's -- the level's centre: M87 for the Virgo Cluster, the attractor for Laniakea. */
  readonly centreKm: number | null;
}

function grouped(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function kmToLy(km: number): number {
  return km / LIGHT_YEAR_KM;
}

/** Light years, three figures: "326 ly", "27,000 ly", "3.26 million ly", "46.2 billion ly". */
function formatLy(ly: number): string {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} billion ly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e8 ? 0 : ly >= 1e7 ? 1 : 2)} million ly`;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(ly)) - 2);
  return `${grouped(Math.round(ly / step) * step)} ly`;
}

/** Parsecs scaled, for a figure quoted in them: "100 pc", "1 Mpc", "11 Mpc". */
function formatPc(pc: number): string {
  if (pc >= 1e6) return `${grouped(pc / 1e6)} Mpc`;
  if (pc >= 1e3) return `${(pc / 1e3).toFixed(2)} kpc`;
  return `${grouped(pc)} pc`;
}

/** A distance far off: Mpc and light years. */
function formatFar(km: number | null): string {
  if (km === null) return '--';
  const pc = km / PARSEC_KM;
  return `${(pc / 1e6).toFixed(pc >= 1e8 ? 0 : 1)} Mpc, ${formatLy(kmToLy(km))}`;
}

const ANDROMEDA = GIANTS.find((galaxy) => galaxy.key === 'm31')!;

/** A level's lines. Pure, so each level's are tested as they read. */
export function levelFacts(level: LevelId, live: LevelLive): readonly LevelFact[] {
  switch (level) {
    case 'solar-system':
      return [
        { label: 'Planets', value: '8, and 5 dwarf planets', source: 'IAU' },
        { label: 'Neptune’s orbit', value: `${NEPTUNE_ORBIT_AU.toFixed(2)} AU`, source: 'JPL' },
        { label: 'Heliopause', value: `${grouped(HELIOPAUSE_NOSE_AU)} AU, at its nose`, source: 'Voyagers’ crossings' },
        {
          label: 'Oort cloud',
          value: `${grouped(HILLS_CLOUD_INNER_AU)}–${grouped(OORT_CLOUD_OUTER_AU)} AU, inferred`,
          source: 'Dones et al. 2004',
        },
        {
          label: 'Voyager 1 now',
          value: live.voyager1Km === null ? '--' : `${(live.voyager1Km / AU_KM).toFixed(1)} AU`,
          source: 'JPL Horizons',
        },
      ];
    case 'solar-neighbourhood':
      return [
        {
          label: 'Star map complete to',
          value: `${formatPc(NEIGHBOURHOOD_EXTENT_KM / PARSEC_KM)}, ${formatLy(kmToLy(NEIGHBOURHOOD_EXTENT_KM))}`,
          source: 'Gaia GCNS',
        },
        { label: 'Nearest star', value: 'Proxima Centauri, 4.25 ly', source: 'Gaia DR3' },
        { label: 'In', value: 'the Local Arm', source: 'Reid et al. 2019' },
        { label: 'Gas about us', value: 'the Local Bubble, hot and thin', source: null },
      ];
    case 'milky-way':
      return [
        { label: 'Disc', value: `about ${formatLy(2 * kmToLy(MILKY_WAY_EXTENT_KM))} across`, source: null },
        { label: 'Stars', value: 'about 100 billion, estimated', source: null },
        {
          label: 'Centre',
          value: `Sgr A*, ${(SGR_A_MASS_SUN / 1e6).toFixed(1)} million M☉`,
          source: 'GRAVITY 2024',
        },
        {
          label: 'Sun from the centre',
          value: `${formatPc(SGR_A_DISTANCE_PC)}, ${formatLy((SGR_A_DISTANCE_PC * PARSEC_KM) / LIGHT_YEAR_KM)}`,
          source: 'GRAVITY 2024',
        },
        { label: 'Sun above the plane', value: `${SUN_ABOVE_PLANE_PC} pc`, source: 'Bland-Hawthorn & Gerhard 2016' },
      ];
    case 'local-group':
      return [
        {
          label: 'Radius',
          value: `${formatPc(LOCAL_GROUP_EXTENT_KM / PARSEC_KM)}, ${formatLy(kmToLy(LOCAL_GROUP_EXTENT_KM))}`,
          source: 'McConnachie 2012',
        },
        { label: 'Largest', value: 'Andromeda, the Milky Way, Triangulum', source: null },
        {
          label: 'Andromeda',
          value: formatLy((ANDROMEDA.distancePc * PARSEC_KM) / LIGHT_YEAR_KM),
          source: ANDROMEDA.distanceSource.split(',')[0]!,
        },
      ];
    case 'local-volume':
      return [
        {
          label: 'Radius',
          value: `${formatPc(LOCAL_VOLUME_EXTENT_KM / PARSEC_KM)}, ${formatLy(kmToLy(LOCAL_VOLUME_EXTENT_KM))}`,
          source: 'UNGC',
        },
        { label: 'Galaxies listed', value: '869', source: 'Karachentsev et al. 2013' },
        { label: 'Groups', value: 'Sculptor, M81, Centaurus A, IC 342, Canes Venatici', source: null },
        { label: 'Mostly in', value: 'the Local Sheet, a plane', source: null },
      ];
    case 'virgo-cluster':
      return [
        { label: 'Centre', value: 'M87', source: null },
        { label: 'Distance', value: formatFar(live.centreKm), source: null },
        { label: 'Galaxies listed', value: '1,589', source: 'EVCC, Kim et al. 2014' },
        { label: 'Beyond', value: 'the Local Volume’s 11 Mpc', source: null },
      ];
    case 'laniakea':
      return [
        { label: 'Attractor', value: formatFar(live.centreKm), source: 'Dupuy & Courtois 2023' },
        { label: 'Across', value: 'about 160 Mpc, 500 million ly', source: 'Tully et al. 2014' },
        { label: 'Galaxies', value: 'about 100,000', source: 'Tully et al. 2014' },
        { label: 'Mass', value: 'about 10¹⁷ M☉', source: 'Tully et al. 2014' },
      ];
    case 'nearby-universe':
      return [
        {
          label: 'Mapped to',
          value: `${formatPc(NEARBY_UNIVERSE_EXTENT_KM / PARSEC_KM)}, ${formatLy(kmToLy(NEARBY_UNIVERSE_EXTENT_KM))}`,
          source: 'Cosmicflows-4, 2MRS',
        },
        { label: 'Galaxies', value: '86,899', source: 'Cosmicflows-4, 2MRS' },
        { label: 'Farthest supercluster', value: 'Shapley, 190 Mpc', source: null },
      ];
    case 'observable-universe':
      return [
        { label: 'Radius', value: formatLy(mpcToLy(OBSERVABLE_RADIUS_MPC)), source: 'Planck 2018' },
        { label: 'CMB sphere', value: formatLy(mpcToLy(LAST_SCATTERING_RADIUS_MPC)), source: 'Planck 2018' },
        { label: 'Age', value: `${ageGyr().toFixed(1)} billion years`, source: 'Planck 2018' },
        { label: 'CMB today', value: `${PLANCK18.t0K} K`, source: 'Fixsen 2009' },
      ];
  }
}

/** The description a level's panel offers: the first of its own that is written, or null. */
export function levelReading(level: LevelId): { readonly id: BodyId; readonly name: string } | null {
  return LEVELS[level].readAbout.find((candidate) => hasDescription(candidate.id)) ?? null;
}

function distanceFromSun(store: EphemerisStore, id: BodyId, jd: number, distanceMode: DistanceMode): number | null {
  try {
    return store.distanceBetween(id, 'sun', jd, distanceMode);
  } catch {
    // Not a body in this store.
    return null;
  }
}

export function LevelPanel({
  level,
  store,
  focus,
  jd,
  distanceMode,
  onClose,
}: {
  level: LevelId;
  store: EphemerisStore;
  focus: BodyId;
  jd: number;
  distanceMode: DistanceMode;
  onClose: () => void;
}) {
  const { name, kind } = LEVELS[level];
  const live: LevelLive = {
    voyager1Km: level === 'solar-system' ? distanceFromSun(store, 'voyager-1', jd, distanceMode) : null,
    centreKm: level === 'virgo-cluster' || level === 'laniakea' ? distanceFromSun(store, focus, jd, distanceMode) : null,
  };
  const reading = levelReading(level);
  return (
    <Panel title={name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: '#9a9a9a', fontSize: '0.9rem' }}>◎</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>{kind}</span>
      </div>
      {reading !== null && <ReadMore name={reading.name} about={reading.id} />}
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {levelFacts(level, live).map((fact) => (
          <Row key={fact.label} label={fact.label}>
            {fact.value}
            {fact.source !== null && <span style={{ display: 'block', color: '#5e5e5e', fontSize: '0.64rem' }}>{fact.source}</span>}
          </Row>
        ))}
      </dl>
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
