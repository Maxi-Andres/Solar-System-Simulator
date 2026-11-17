import type { BodyId } from '@sss/tools/types';

import { ALPHA_CEN_FRAMING_KM, alphaCenMember, alphaCenView, type AlphaCenKey } from '../../core/alphaCenBodies.ts';
import { BLACK_HOLE_SYSTEMS } from '../../core/blackHoles.ts';
import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import { clusterFramingKm, ensureClusterBody, type GlobularClusterArchive } from '../../core/globularClusters.ts';
import { structureBodyId } from '../../core/laniakea.ts';
import { galaxyBodyId, GIANTS } from '../../core/localGroup.ts';
import { PLANETARY_SYSTEMS, registeredSystem, systemFramingKm, systemView } from '../../core/planetarySystems.ts';
import { ensurePulsarBody, pulsarFramingKm, type PulsarArchive } from '../../core/pulsars.ts';
import { ensureRecordHolders, RECORD_HOLDERS, recordHolderBodyId } from '../../core/recordHolders.ts';
import { renderDemand } from '../../core/renderDemand.ts';
import { namedSatelliteBodyId } from '../../core/satelliteBodies.ts';
import { chipShown, satelliteBodyChip } from '../../core/satelliteGroups.ts';
import type { LazySource } from '../../core/satellites.ts';
import { layersFor } from '../../core/search.ts';
import { SIRIUS_SYSTEM } from '../../core/siriusBodies.ts';
import { starBodyFacts } from '../../core/starBodies.ts';
import { remnantBodyId, SUPERNOVA_REMNANTS } from '../../core/supernovaRemnants.ts';
import { LOCAL_GROUP_VIEW } from '../../scene/LocalGroup.tsx';
import { GALAXY_VIEW } from '../../scene/MilkyWay.tsx';
import {
  GALAXY_FRAMING_KM,
  LANIAKEA_FRAMING_KM,
  LOCAL_GROUP_FRAMING_KM,
  LOCAL_VOLUME_FRAMING_KM,
  NEARBY_UNIVERSE_FRAMING_KM,
  NEIGHBOURHOOD_FRAMING_KM,
  OBSERVABLE_UNIVERSE_FRAMING_KM,
  VIRGO_FRAMING_KM,
} from '../../scene/scale.ts';
import {
  LANIAKEA_VIEW,
  LOCAL_VOLUME_VIEW,
  NEARBY_UNIVERSE_VIEW,
  OBSERVABLE_UNIVERSE_VIEW,
  VIRGO_VIEW,
} from '../../scene/supergalactic.ts';
import { useViewStore, type FramingView, type LayerId } from '../../state/store.ts';

/**
 * "Show me": from a glossary entry to a thing of its kind in the scene -- the About closed and
 * the camera taken there, the way the breadcrumb, the search and "go there" already do it, with
 * the store's own actions (requestFraming, setFocus, setLayer) and the framings they use.
 *
 * Most targets are bodies from the start (the catalogue's, the black holes, the remnants, the
 * Local Group's four giants) or soon after (the stars App.tsx pins once the star names are in,
 * the record-holders on the first idle moment). The rest arrive with a catalogue that loads as
 * the camera passes -- Laniakea's structures past 30 million light years, the Local Volume's
 * galaxies past 3 million, the satellites with their layer -- so for those the camera first
 * takes the breadcrumb's view that loads them, and goes on to the target the moment it is a
 * body, unless the viewer has gone somewhere else meanwhile.
 */

/** The breadcrumb's and the address's views, each from the Sun. */
export const SHOW_ME_VIEWS = {
  neighbourhood: { km: NEIGHBOURHOOD_FRAMING_KM, view: undefined },
  galaxy: { km: GALAXY_FRAMING_KM, view: GALAXY_VIEW },
  'local-group': { km: LOCAL_GROUP_FRAMING_KM, view: LOCAL_GROUP_VIEW },
  'local-volume': { km: LOCAL_VOLUME_FRAMING_KM, view: LOCAL_VOLUME_VIEW },
  'nearby-universe': { km: NEARBY_UNIVERSE_FRAMING_KM, view: NEARBY_UNIVERSE_VIEW },
  'observable-universe': { km: OBSERVABLE_UNIVERSE_FRAMING_KM, view: OBSERVABLE_UNIVERSE_VIEW },
} as const satisfies Record<string, { readonly km: number; readonly view: FramingView | undefined }>;

export type ShowMeView = keyof typeof SHOW_ME_VIEWS;

/** What a "show me" goes to. */
export type ShowMeTarget =
  /** A body there from the start: the catalogue's, a black hole, a remnant, a Local Group giant, a record-holder. */
  | { readonly kind: 'body'; readonly id: BodyId; readonly alsoLayers?: readonly LayerId[] }
  /** A star App.tsx makes a body once the star names are in: one of Alpha Centauri's three, or Sirius B. */
  | { readonly kind: 'star'; readonly star: AlphaCenKey | 'Sirius B' }
  /** One of the breadcrumb's planetary systems, framed with its planets. */
  | { readonly kind: 'system'; readonly key: string }
  /** One of the breadcrumb's views, from the Sun. */
  | { readonly kind: 'view'; readonly view: ShowMeView }
  /** A named structure of Laniakea's catalogue, by its name there; `laniakeaView` frames it as the breadcrumb's Laniakea does. */
  | { readonly kind: 'structure'; readonly name: string; readonly laniakeaView?: boolean }
  /** A galaxy of the Local Volume made a body once it loads (localVolume.ts NAMED_V), by name; `virgoView` frames it as the breadcrumb's Virgo Cluster. */
  | { readonly kind: 'volume-galaxy'; readonly name: string; readonly virgoView?: boolean }
  /** A named satellite, by its id in satellites.json; a body once its layer has loaded. */
  | { readonly kind: 'satellite'; readonly id: string }
  /** A pulsar, by the name it is known by in pulsars.json. */
  | { readonly kind: 'pulsar'; readonly name: string }
  /** A globular cluster, by its designation in globular-clusters.json. */
  | { readonly kind: 'cluster'; readonly name: string };

/** Each glossary entry with something of its kind to show, by the entry's id. */
export const SHOW_ME: Readonly<Record<string, ShowMeTarget>> = {
  sun: { kind: 'body', id: 'sun' },
  planet: { kind: 'body', id: 'jupiter' },
  'dwarf-planet': { kind: 'body', id: 'pluto' },
  moon: { kind: 'body', id: 'moon' },
  asteroid: { kind: 'body', id: 'vesta' },
  // Ceres, and the belt's dots about it.
  'main-belt': { kind: 'body', id: 'ceres', alsoLayers: ['asteroids'] },
  'near-earth': { kind: 'body', id: 'apophis' },
  trojan: { kind: 'body', id: 'eurybates' },
  'kuiper-belt': { kind: 'body', id: 'arrokoth' },
  comet: { kind: 'body', id: '1p-halley' },
  'interstellar-object': { kind: 'body', id: '2i-borisov' },
  spacecraft: { kind: 'body', id: 'voyager-1' },
  satellite: { kind: 'satellite', id: 'iss' },
  star: { kind: 'view', view: 'neighbourhood' },
  'red-dwarf': { kind: 'star', star: 'Proxima' },
  'white-dwarf': { kind: 'star', star: 'Sirius B' },
  'neutron-star': { kind: 'pulsar', name: 'Crab Pulsar' },
  'black-hole': { kind: 'body', id: 'sgr-a-star' },
  'star-system': { kind: 'star', star: 'A' },
  exoplanet: { kind: 'system', key: '51-pegasi' },
  'milky-way': { kind: 'view', view: 'galaxy' },
  'galactic-centre': { kind: 'body', id: 'sgr-a-star' },
  'star-cluster': { kind: 'cluster', name: 'NGC 5139' },
  'supernova-remnant': { kind: 'body', id: 'snr-crab' },
  galaxy: { kind: 'body', id: 'galaxy-m31' },
  spiral: { kind: 'body', id: 'galaxy-m33' },
  elliptical: { kind: 'volume-galaxy', name: 'M87' },
  irregular: { kind: 'body', id: 'galaxy-smc' },
  'satellite-galaxy': { kind: 'body', id: 'galaxy-lmc' },
  'local-group': { kind: 'view', view: 'local-group' },
  'galaxy-cluster': { kind: 'volume-galaxy', name: 'M87', virgoView: true },
  supercluster: { kind: 'structure', name: 'Laniakea Supercluster', laniakeaView: true },
  laniakea: { kind: 'structure', name: 'Laniakea Supercluster', laniakeaView: true },
  'flow-lines': { kind: 'structure', name: 'Laniakea Supercluster', laniakeaView: true },
  void: { kind: 'structure', name: 'Local Void' },
  wall: { kind: 'structure', name: 'CfA2 Great Wall' },
  'cosmic-web': { kind: 'view', view: 'nearby-universe' },
  quasar: { kind: 'body', id: 'far-3c-273' },
  'gamma-ray-burst': { kind: 'body', id: 'far-grb-221009a' },
  'record-holders': { kind: 'body', id: 'far-mom-z14' },
  cmb: { kind: 'view', view: 'observable-universe' },
  'observable-universe': { kind: 'view', view: 'observable-universe' },
};

/** The ids of the bodies made at start outside the catalogue, that a `body` target may name. */
export function startBodyIds(): Set<BodyId> {
  return new Set([
    ...BLACK_HOLE_SYSTEMS.map((system) => system.id),
    ...SUPERNOVA_REMNANTS.map(remnantBodyId),
    ...GIANTS.map(galaxyBodyId),
    ...RECORD_HOLDERS.map(recordHolderBodyId),
  ]);
}

/** The catalogues "show me" may have to load, from the About's own sources. */
export interface ShowMeSources {
  readonly pulsars?: LazySource<PulsarArchive> | null | undefined;
  readonly globularClusters?: LazySource<GlobularClusterArchive> | null | undefined;
}

/** Where the camera ends up: a body, and the framing to take it at (else its own). */
interface Arrival {
  readonly id: BodyId;
  readonly km?: number;
  readonly view?: FramingView | undefined;
}

function hasBody(store: EphemerisStore, id: BodyId): boolean {
  return store.bodies.some((body) => body.id === id);
}

/** The target as a body in the store now, with its framing; null while it is not one yet. */
function arrival(target: ShowMeTarget, store: EphemerisStore): Arrival | null {
  switch (target.kind) {
    case 'body': {
      if (target.id.startsWith('far-')) {
        // The record-holders are made bodies on the first idle moment; the breadcrumb makes them at once if asked first.
        ensureRecordHolders(store);
      }
      if (!hasBody(store, target.id)) return null;
      // A black hole as the breadcrumb frames it: with the star about it.
      const system = BLACK_HOLE_SYSTEMS.find((candidate) => candidate.id === target.id);
      return system === undefined ? { id: target.id } : { id: target.id, km: system.framingKm, view: system.view };
    }
    case 'star': {
      const found = store.bodies.find((body) =>
        target.star === 'Sirius B'
          ? body.name === 'Sirius B' && starBodyFacts(body.id)?.system === SIRIUS_SYSTEM
          : alphaCenMember(body.id) === target.star,
      );
      if (found === undefined) return null;
      // Alpha Centauri A as the breadcrumb's Alpha Centauri: the pair whole.
      return target.star === 'A' ? { id: found.id, km: ALPHA_CEN_FRAMING_KM, view: alphaCenView() } : { id: found.id };
    }
    case 'system': {
      const made = registeredSystem(target.key);
      return made === null
        ? null
        : { id: made.host, km: systemFramingKm(made.system), view: systemView(made.system, made.host) };
    }
    case 'view':
      return { id: 'sun', km: SHOW_ME_VIEWS[target.view].km, view: SHOW_ME_VIEWS[target.view].view };
    case 'structure': {
      const id = structureBodyId({ name: target.name });
      if (!hasBody(store, id)) return null;
      return target.laniakeaView === true ? { id, km: LANIAKEA_FRAMING_KM, view: LANIAKEA_VIEW } : { id };
    }
    case 'volume-galaxy': {
      const found = store.bodies.find((body) => body.kind === 'galaxy' && body.name === target.name);
      if (found === undefined) return null;
      return target.virgoView === true ? { id: found.id, km: VIRGO_FRAMING_KM, view: VIRGO_VIEW } : { id: found.id };
    }
    case 'satellite': {
      const id = namedSatelliteBodyId(target.id);
      return hasBody(store, id) ? { id } : null;
    }
    case 'pulsar':
    case 'cluster':
      // Made from their catalogues: see `fromCatalogue`.
      return null;
  }
}

/** Where to wait, from the Sun or Earth, while what the target needs loads; null to wait where one is. */
function waitingPlace(target: ShowMeTarget): Arrival | null {
  switch (target.kind) {
    case 'structure':
      // Laniakea's catalogue loads once the camera is 30 million light years out.
      return { id: 'sun', km: SHOW_ME_VIEWS['nearby-universe'].km, view: SHOW_ME_VIEWS['nearby-universe'].view };
    case 'volume-galaxy':
      // The Local Volume's, once it is 3 million out.
      return { id: 'sun', km: SHOW_ME_VIEWS['local-volume'].km, view: SHOW_ME_VIEWS['local-volume'].view };
    case 'satellite':
      // The satellites load with their layer, switched on below.
      return { id: 'earth' };
    default:
      return null;
  }
}

/**
 * The layers the target is drawn in, switched on, so the app does not step straight back off it
 * -- and, for one not a body yet, so it is ever loaded: the satellites come only with their layer,
 * and without it "show me" waited at Earth for a Space Station that never came.
 */
export function layersOf(target: ShowMeTarget, store: EphemerisStore, id: BodyId): LayerId[] {
  const layers = hasBody(store, id) ? layersFor(store.body(id)) : [];
  if (target.kind === 'body' && target.alsoLayers !== undefined) layers.push(...target.alsoLayers);
  if (target.kind === 'satellite') layers.push('satellites');
  if (target.kind === 'structure') layers.push('laniakea');
  if (target.kind === 'structure' && target.laniakeaView === true) layers.push('laniakeaBasin', 'flowLines');
  if (target.kind === 'view' && target.view === 'observable-universe') layers.push('observableUniverse');
  if (target.kind === 'view' && target.view === 'nearby-universe') layers.push('sdssGalaxies', 'filaments');
  if (target.kind === 'view' && target.view === 'galaxy') layers.push('milkyWay');
  if (target.kind === 'view' && target.view === 'local-group') layers.push('localGroup');
  if (target.kind === 'view' && target.view === 'neighbourhood') layers.push('starMap');
  return layers;
}

function go(target: ShowMeTarget, store: EphemerisStore, to: Arrival): void {
  const state = useViewStore.getState();
  for (const layer of layersOf(target, store, to.id)) state.setLayer(layer, true);
  // A satellite needs its chip on too, or the app steps straight back to Earth (as search does).
  if (target.kind === 'satellite') {
    const chip = satelliteBodyChip(to.id);
    if (chip >= 0 && !chipShown(state.satelliteChips, chip)) state.toggleSatelliteChip(chip);
  }
  // Asked for before the focus moves, so the camera rig takes it with the new focus.
  if (to.km !== undefined) state.requestFraming(to.km, to.view);
  state.setFocus(to.id);
  renderDemand.request();
}

/** How long to wait for a catalogue before giving up, ms. */
const PATIENCE_MS = 60_000;

/** The wait in progress, if any: a second "show me" ends the first. */
let stopWaiting: (() => void) | null = null;

/** A pulsar or a cluster, made a body from its catalogue as App.tsx's goToPulsar and goToCluster do. */
async function fromCatalogue(target: ShowMeTarget, store: EphemerisStore, sources: ShowMeSources): Promise<Arrival | null> {
  if (target.kind === 'pulsar' && sources.pulsars != null) {
    await sources.pulsars.request();
    const archive = sources.pulsars.value;
    const k = archive === null ? -1 : archive.catalog.pulsars.name.indexOf(target.name);
    if (archive === null || k < 0) return null;
    const id = ensurePulsarBody(store, archive, k);
    return { id, km: pulsarFramingKm(store.body(id).radiusEquatorialKm) };
  }
  if (target.kind === 'cluster' && sources.globularClusters != null) {
    await sources.globularClusters.request();
    const archive = sources.globularClusters.value;
    const k = archive === null ? -1 : archive.catalog.name.indexOf(target.name);
    if (archive === null || k < 0) return null;
    return { id: ensureClusterBody(store, archive, k), km: clusterFramingKm(archive.catalog, k) };
  }
  return null;
}

/**
 * Whether the target can be shown from here: a catalogue it needs is one the About has, and a
 * star or a system that only App.tsx makes -- once the star names are in, which a device without
 * the 3D stars never has -- is made.
 */
export function canShow(target: ShowMeTarget, store: EphemerisStore, sources: ShowMeSources): boolean {
  switch (target.kind) {
    case 'pulsar':
      return sources.pulsars != null;
    case 'cluster':
      return sources.globularClusters != null;
    case 'star':
    case 'system':
      return arrival(target, store) !== null;
    default:
      return true;
  }
}

/** What the target is called in the scene, for the button's title. */
export function showMeLabel(target: ShowMeTarget): string {
  switch (target.kind) {
    case 'body':
      return (
        {
          sun: 'the Sun',
          moon: 'the Moon',
          'sgr-a-star': 'Sagittarius A*',
          'gaia-bh1': 'Gaia BH1',
          'snr-crab': 'the Crab Nebula',
          'galaxy-m31': 'Andromeda',
          'galaxy-m33': 'Triangulum',
          'galaxy-smc': 'the Small Magellanic Cloud',
          'galaxy-lmc': 'the Large Magellanic Cloud',
          '1p-halley': 'Halley’s Comet',
          '2i-borisov': '2I/Borisov',
          'voyager-1': 'Voyager 1',
          'far-3c-273': '3C 273',
          'far-grb-221009a': 'GRB 221009A',
          'far-mom-z14': 'MoM-z14',
        } as Record<string, string>
      )[target.id] ?? target.id.charAt(0).toUpperCase() + target.id.slice(1);
    case 'star':
      return target.star === 'A' ? 'Alpha Centauri' : target.star === 'Proxima' ? 'Proxima Centauri' : 'Sirius B';
    case 'system':
      return PLANETARY_SYSTEMS.find((system) => system.key === target.key)?.name ?? target.key;
    case 'view':
      return {
        neighbourhood: 'the Solar Neighbourhood',
        galaxy: 'the Milky Way',
        'local-group': 'the Local Group',
        'local-volume': 'the Local Volume',
        'nearby-universe': 'the nearby universe',
        'observable-universe': 'the observable universe',
      }[target.view];
    case 'structure':
      return target.laniakeaView === true ? 'Laniakea' : `the ${target.name}`;
    case 'volume-galaxy':
      return target.virgoView === true ? 'the Virgo Cluster' : target.name;
    case 'satellite':
      return target.id === 'iss' ? 'the Space Station' : target.id;
    case 'pulsar':
      return `the ${target.name}`;
    case 'cluster':
      return target.name === 'NGC 5139' ? 'Omega Centauri' : target.name;
  }
}

/**
 * Closes the About and takes the camera to `target`: at once where it is a body, otherwise by
 * way of the view that loads it, going on when it arrives.
 */
export function showMe(target: ShowMeTarget, store: EphemerisStore, sources: ShowMeSources = {}): void {
  stopWaiting?.();
  stopWaiting = null;
  useViewStore.getState().closePanel();

  if (target.kind === 'pulsar' || target.kind === 'cluster') {
    let cancelled = false;
    stopWaiting = () => {
      cancelled = true;
    };
    fromCatalogue(target, store, sources)
      .then((to) => {
        if (!cancelled && to !== null) go(target, store, to);
      })
      .catch((error: unknown) => {
        console.error(`Could not show ${showMeLabel(target)}`, error);
      });
    return;
  }

  const now = arrival(target, store);
  if (now !== null) {
    go(target, store, now);
    return;
  }

  // Not a body yet: wait for it, from the view that loads it.
  const place = waitingPlace(target);
  if (place !== null) go(target, store, place);
  const waitingAt = useViewStore.getState().focus;
  const stop = (): void => {
    unsubscribeStore();
    unsubscribeFocus();
    clearTimeout(timer);
    if (stopWaiting === stop) stopWaiting = null;
  };
  const check = (): void => {
    const to = arrival(target, store);
    if (to !== null) {
      stop();
      go(target, store, to);
    }
  };
  const unsubscribeStore = store.subscribe(check);
  // Gone somewhere else meanwhile: the viewer's choice stands.
  const unsubscribeFocus = useViewStore.subscribe((state) => {
    if (state.focus !== waitingAt) stop();
  });
  const timer = setTimeout(stop, PATIENCE_MS);
  stopWaiting = stop;
  // Loaded already but not yet registered (a planetary system registered with no new body).
  check();
}

/** Ends any wait in progress; for tests. */
export function cancelShowMe(): void {
  stopWaiting?.();
  stopWaiting = null;
}
