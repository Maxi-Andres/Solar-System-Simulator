import type {
  BeltInfo,
  CometInfo,
  ExoplanetCatalog,
  PulsarCatalog,
  SatelliteInfo,
  StarCatalog,
  Stars3dInfo,
} from '@sss/tools/types';

import type { BeltSource, LoadedTier } from '../../core/belt.ts';
import type { CometSource } from '../../core/comets.ts';
import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import type { ExoplanetArchive } from '../../core/exoplanetArchive.ts';
import type { PulsarArchive } from '../../core/pulsars.ts';
import type { LazySource, SatelliteSource } from '../../core/satellites.ts';
import type { Stars3dSource } from '../../core/stars3d.ts';
import type { AboutData } from './section.ts';

/**
 * Stand-ins for everything the About panel reads, for the tests: a store with a few
 * spacecraft, small bodies and small moons, and every lazily loaded catalogue already in,
 * so each conditional paragraph is rendered. Only the fields the panel reads are filled;
 * the casts say so.
 */

const bodies = [
  { id: 'juice', name: 'Juice', kind: 'spacecraft', parent: null },
  { id: 'psyche', name: 'Psyche', kind: 'spacecraft', parent: null },
  { id: 'voyager-1', name: 'Voyager 1', kind: 'spacecraft', parent: null },
  { id: 'ceres', name: 'Ceres', kind: 'dwarf', parent: null, sampling: {} },
  { id: 'vesta', name: 'Vesta', kind: 'asteroid', parent: null, sampling: {} },
  { id: 'bennu', name: 'Bennu', kind: 'asteroid', parent: null, sampling: {}, shapeModel: {} },
  { id: 'ryugu', name: 'Ryugu', kind: 'asteroid', parent: null, sampling: {}, shapeModel: {} },
  { id: 'toutatis', name: 'Toutatis', kind: 'asteroid', parent: null, sampling: {}, shapeDrawn: false },
];

export const fixtureStore = {
  manifest: {
    window: { startUtc: '2016-10-29T00:00:00Z', stopUtc: '2036-10-29T00:00:00Z' },
    source: { name: 'JPL Horizons', version: '1.2' },
    smallMoons: { jupiter: { count: 87, sized: 20 }, saturn: { count: 267, sized: 40 } },
    paths: {
      psyche: { seams: [{ startJd: 2461375.5, jumpKm: 239_513 }] },
      juice: { seams: [{ startJd: 2461000.5, jumpKm: 12 }] },
    },
  },
  generatedAt: new Date('2026-10-29T00:00:00Z'),
  bodies,
  body: (id: string) => bodies.find((body) => body.id === id)!,
  smallMoonCount: (planet: string) => (planet === 'saturn' ? { count: 267 } : { count: 87 }),
} as unknown as EphemerisStore;

export const fixtureStars = {
  sources: [
    { name: 'Hipparcos', table: 'I/239/hip_main', stars: 9_000, note: '' },
    { name: 'Tycho-2', table: 'I/259/tyc2', stars: 16_723, note: '' },
  ],
  via: 'https://vizier.cds.unistra.fr/TAPVizieR/tap',
  queriedAt: '2026-10-29',
  magnitudeLimit: 7.5,
  count: 25_723,
} as unknown as StarCatalog;

const beltTierList = [
  { file: 'elements-0.bin', count: 83_841, bytes: 0, brightestH: null, faintestH: 15 },
  { file: 'elements-1.bin', count: 123_777, bytes: 0, brightestH: 15, faintestH: 16 },
];

export const fixtureBeltInfo = {
  source: { name: 'JPL Small-Body Database (SBDB) Query API', url: '', queriedAt: '2026-10-19' },
  file: 'elements-0.bin',
  count: 207_618,
  recordFloats: 9,
  magnitudeLimit: 22,
  referenceJd: 2461332.5,
  elementEpochs: { minJd: 2461200.5, maxJd: 2461200.5 },
  classes: [],
  classCounts: {},
  excluded: ['1', '4', '433'],
  dropped: { notElliptic: 0, missingElements: 0 },
  tiers: beltTierList,
} as unknown as BeltInfo;

export const fixtureBeltTiers = [
  {
    index: 0,
    tier: beltTierList[0]!,
    records: new Float32Array(0),
    classCounts: { MBA: 70_000, TJN: 13_841 },
  },
] as unknown as readonly LoadedTier[];

export const fixtureCometInfo = {
  source: { name: 'JPL Small-Body Database (SBDB) Query API', url: '', queriedAt: '2026-10-19' },
  count: 4_012,
  classCounts: { PAR: 1_763, HYP: 520 },
  excluded: ['1P', '2P', '67P'],
} as unknown as CometInfo;

export const fixtureSatelliteInfo = {
  source: { queriedAt: '2026-10-29' },
  count: 31_000,
  credit: 'Orbital data: CelesTrak.',
  accuracy: [
    { regime: 'leo', days: [1, 3, 7], medianKm: [2, 6, 20], p95Km: [8, 25, 90] },
    { regime: 'geo', days: [1, 3, 7], medianKm: [3, 9, 30], p95Km: [9, 30, 100] },
  ],
} as unknown as SatelliteInfo;

export const fixtureStars3dInfo = {
  sources: [
    { name: 'GCNS', table: 'J/A+A/649/A6/table1c', via: 'VizieR', rows: 331_312, note: '' },
    { name: 'Gaia DR3', table: 'gaiadr3.gaia_source', via: 'ESA Gaia Archive', rows: 1, note: '' },
  ],
  queriedAt: '2026-10-29',
  count: 354_000,
  counts: { withinTenParsecs: 540 },
  sky: { atInfinity: 1_200 },
} as unknown as Stars3dInfo;

export const fixtureExoplanetCatalog = {
  source: { queriedAt: '2026-10-29' },
  counts: {
    planets: 6_100,
    hosts: 4_500,
    matchedByGaia: 1_000,
    matchedByHip: 200,
    placedFromArchive: 3_290,
    unplaced: 10,
  },
  omegaCheck: { star: 35, planet: 2, neither: 4 },
} as unknown as ExoplanetCatalog;

export const fixturePulsarCatalog = {
  sources: { atnf: { version: '2.9.0', queriedAt: '2026-10-30' }, mcgill: { queriedAt: '2026-10-30' } },
  counts: {
    listed: 4_510,
    placed: 4_303,
    unplaced: 207,
    byMethod: { independent: 445, parallax: 50, bounded: 29, dm: 3_754, magnetar: 25 },
    magnetars: 26,
    binaries: 578,
    inGlobularClusters: 261,
  },
} as unknown as PulsarCatalog;

const subscribe = (): (() => void) => () => {};

/** The sources AboutPanel takes, each already holding its catalogue. */
export const fixtureSources = {
  store: fixtureStore,
  stars: fixtureStars,
  belt: { subscribe, view: { tiers: fixtureBeltTiers, info: fixtureBeltInfo } } as unknown as BeltSource,
  comets: { subscribe, comets: { info: fixtureCometInfo } } as unknown as CometSource,
  satellites: { subscribe, value: { info: fixtureSatelliteInfo } } as unknown as SatelliteSource,
  stars3d: { subscribe, view: { info: fixtureStars3dInfo } } as unknown as Stars3dSource,
  exoplanets: {
    subscribe,
    value: { catalog: fixtureExoplanetCatalog },
  } as unknown as LazySource<ExoplanetArchive>,
  pulsars: { subscribe, value: { catalog: fixturePulsarCatalog } } as unknown as LazySource<PulsarArchive>,
};

/** The same, gathered as the panel gathers it for its sections. */
export const fixtureData: AboutData = {
  store: fixtureStore,
  stars: fixtureStars,
  beltInfo: fixtureBeltInfo,
  beltTiers: fixtureBeltTiers,
  cometInfo: fixtureCometInfo,
  satelliteInfo: fixtureSatelliteInfo,
  stars3dInfo: fixtureStars3dInfo,
  exoplanetCatalog: fixtureExoplanetCatalog,
  pulsarCatalog: fixturePulsarCatalog,
};
