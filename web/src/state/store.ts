import type { BodyId } from '@sss/tools/types';
import { create } from 'zustand';

import { PHYSICAL_LIGHTING } from '../scene/shading.ts';
import { ALL_BELT_FAMILIES, toggledFamily } from '../core/belt.ts';
import { ALL_SATELLITE_CHIPS, toggledChip } from '../core/satelliteGroups.ts';
import { readStoredInteger, writeStoredInteger } from './persisted.ts';

/**
 * View state.
 *
 * Time lives in the SimClock, not here: it advances every animation frame and
 * pushing that through React would re-render the tree sixty times a second. This
 * store holds only what changes when a person clicks something.
 */

/**
 * How bodies are lit, mirroring the three modes NASA Eyes offers.
 *
 * Only `natural` is physically true. The other two exist because a Solar System
 * viewer has a real problem: half of everything is facing away from the Sun, and an
 * honest render of that is a black disc you cannot identify. Flood lighting trades
 * realism for legibility; the mode is named so nobody mistakes one for the other.
 */
export type LightingMode = 'flood' | 'shadow' | 'natural';

export const LIGHTING_MODES: readonly {
  readonly id: LightingMode;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: 'flood',
    label: 'Flood Lighting',
    description: 'Everything evenly lit. Not physical, but every body is identifiable.',
  },
  {
    id: 'shadow',
    label: 'Shadow Lighting',
    description:
      'Sunlight plus enough fill to read the night side. That fill has a price: on a ' +
      'bright body the dark half never reaches black, so there is no terminator edge, ' +
      'only a gradient.',
  },
  {
    id: 'natural',
    label: 'Natural Lighting',
    description:
      'Sunlight only. The night side is genuinely black and the terminator lands ' +
      'within a few degrees of where the geometry puts it. The default, because it is ' +
      'the only one of the three that is true.',
  },
];

/**
 * Toggleable layers.
 *
 * Several are listed but not yet available. They are shown disabled rather than
 * hidden, so the panel doubles as an honest statement of what this does and does not
 * have yet — and so nothing has to move when they arrive.
 */
export type LayerId =
  | 'userInterface'
  | 'planets'
  | 'dwarfPlanets'
  | 'moons'
  | 'smallMoons'
  | 'asteroids'
  | 'comets'
  | 'starMap'
  | 'exoplanetHosts'
  | 'milkyWay'
  | 'spacecraft'
  | 'satellites'
  | 'constellations'
  | 'trails'
  | 'orbits'
  | 'distanceRings'
  | 'labels'
  | 'icons';

export interface LayerDefinition {
  readonly id: LayerId;
  readonly label: string;
  /** Null when the layer works today; otherwise the phase that brings it. */
  readonly pending: string | null;
  /** Draws a separator above this entry, grouping the list like NASA Eyes does. */
  readonly startsGroup?: boolean;
}

export const LAYERS: readonly LayerDefinition[] = [
  { id: 'userInterface', label: 'User Interface', pending: null },

  { id: 'planets', label: 'Planets', pending: null, startsGroup: true },
  { id: 'dwarfPlanets', label: 'Dwarf Planets', pending: null },
  { id: 'moons', label: 'Moons', pending: null },
  // The 437 beyond the major moons. They need Moons on too: they are moons.
  { id: 'smallMoons', label: 'Small Moons', pending: null },
  // The named ones -- mission targets, the largest, and Apophis -- and the belt: every
  // asteroid SBDB knows down to its magnitude limit, drawn as dots (see AsteroidBelt).
  { id: 'asteroids', label: 'Asteroids', pending: null },
  // SBDB's four thousand, each on its own conic -- a third of them open, on parabolas and
  // hyperbolas. Off by default, as the belt is.
  { id: 'comets', label: 'Comets', pending: null },
  // Past the Solar System every star in the catalogue drawn at least as a dot, at its real
  // place: a map, not a view (see stars3dShader.ts). Off, the stars are only what an eye
  // would see from where the camera is.
  { id: 'starMap', label: 'Star Map', pending: null },
  // Every star the NASA Exoplanet Archive lists a planet for, ringed on the map with a dot
  // per planet (scene/ExoplanetHosts.tsx); shown where the map is, past the planets.
  { id: 'exoplanetHosts', label: 'Exoplanet Hosts', pending: null },
  // Past the catalogue, the galaxy as a model of published structure (core/milkyWay.ts):
  // a glow, never stars. On by default, so the dark past the census is not taken for the
  // edge of the stars.
  { id: 'milkyWay', label: 'Milky Way Model', pending: null },
  { id: 'constellations', label: 'Constellations', pending: 'Phase D' },

  { id: 'spacecraft', label: 'Spacecraft', pending: null, startsGroup: true },
  // Earth's satellites from CelesTrak (Phase C): a hundred named ones as bodies, and tens
  // of thousands more as dots. Off by default: they matter only near Earth, and switched
  // on they download a few megabytes.
  { id: 'satellites', label: 'Satellites', pending: null },

  // Spacecraft trajectories, from JPL's own samples. A planet's or a moon's trail would
  // be its orbit drawn twice, so the layer is the craft's alone.
  { id: 'trails', label: 'Trails', pending: null, startsGroup: true },
  { id: 'orbits', label: 'Orbits', pending: null },
  // Circles about the Sun at 1, 5, 10, 50 and 100 light years: a ruler, not a thing (see
  // distanceRings.ts). On, because they draw nothing until the camera is out among the
  // stars, where they are most of what says how far away anything is.
  { id: 'distanceRings', label: 'Distance Rings', pending: null },
  { id: 'labels', label: 'Labels', pending: null },
  { id: 'icons', label: 'Icons', pending: null },
];

export type LayerState = Record<LayerId, boolean>;

const DEFAULT_LAYERS: LayerState = {
  userInterface: true,
  planets: true,
  dwarfPlanets: true,
  moons: true,
  // Off until asked for: four hundred markers round the giants are not a first view.
  smallMoons: false,
  // Off until asked for too: the belt is a map of positions, not a view (see the note in
  // the Layers panel), and switched on it downloads 3 MB or more. The named asteroids
  // are in this layer with it; a search for one turns it on.
  asteroids: false,
  comets: false,
  starMap: true,
  exoplanetHosts: true,
  milkyWay: true,
  spacecraft: true,
  satellites: false,
  constellations: false,
  trails: true,
  orbits: true,
  distanceRings: true,
  labels: true,
  icons: true,
};

/** A direction to look from, and the camera's up: unit vectors in the scene frame. */
export interface FramingView {
  readonly direction: readonly [number, number, number];
  readonly up: readonly [number, number, number];
}

/** A framing the camera rig has yet to take. */
export interface FramingRequest {
  readonly km: number;
  readonly view: FramingView | null;
}

/** Which slide-over panel is open, if any. */
export type PanelId = 'layers' | 'lighting' | 'body' | 'about' | 'search' | 'readout';

export interface ViewState {
  readonly focus: BodyId;
  readonly layers: LayerState;
  readonly lighting: LightingMode;
  readonly openPanel: PanelId | null;
  /**
   * Pending zoom multiplier from the toolbar buttons.
   *
   * The camera rig consumes this inside its frame loop rather than reacting to a
   * state change, which keeps zoom smooth and out of React's render path.
   */
  readonly zoomImpulse: number;
  /**
   * A distance to frame the focus at, km, waiting for the camera rig; null when none is.
   * The breadcrumb's Solar Neighbourhood sets it: the Sun, framed from light years out,
   * rather than from eight of its radii as any other focus is.
   */
  readonly framingRequestKm: number | null;
  /**
   * With a framing, optionally, where to look from: a unit direction from the focus to
   * the camera, and the camera's up, both in the scene frame. The breadcrumb's Milky Way
   * sets them to look down on the galaxy rather than along the ecliptic, from where its
   * disc is a line.
   */
  readonly framingView: FramingView | null;
  /**
   * How many of the belt's magnitude tiers to load, brightest first: the Asteroids
   * layer's density. One by default -- 84,000 asteroids, 3 MB -- and kept for the viewer
   * between visits, since a choice of fifty-seven megabytes is one to make once. More
   * than the data has is simply all of it; see BeltSource.
   */
  readonly beltTiers: number;
  /**
   * Which of the belt's families are drawn, a bit per entry of BELT_FAMILIES: all by
   * default, and kept for the viewer between visits like the density.
   */
  readonly beltFamilies: number;
  /**
   * Which of the satellites' chips are drawn, a bit per SATELLITE_CHIPS entry: all by
   * default, and kept between visits like the belt's families.
   */
  readonly satelliteChips: number;

  readonly setFocus: (id: BodyId) => void;
  readonly toggleLayer: (id: LayerId) => void;
  readonly setLayer: (id: LayerId, on: boolean) => void;
  readonly setLighting: (mode: LightingMode) => void;
  readonly setBeltTiers: (tiers: number) => void;
  readonly toggleBeltFamily: (index: number) => void;
  readonly toggleSatelliteChip: (index: number) => void;
  readonly togglePanel: (id: PanelId) => void;
  readonly closePanel: () => void;
  readonly nudgeZoom: (factor: number) => void;
  readonly consumeZoomImpulse: () => number;
  readonly requestFraming: (km: number, view?: FramingView) => void;
  readonly consumeFramingRequest: () => FramingRequest | null;
}

/** Where the belt's density is kept between visits; see `beltTiers`. */
export const BELT_TIERS_KEY = 'belt-tiers';

/** Where the belt's families are kept between visits; see `beltFamilies`. */
export const BELT_FAMILIES_KEY = 'belt-families';

/** Where the satellites' chips are kept between visits; see `satelliteChips`. */
export const SATELLITE_CHIPS_KEY = 'satellite-chips';

export const useViewStore = create<ViewState>((set, get) => ({
  focus: 'sun',
  layers: DEFAULT_LAYERS,
  lighting: PHYSICAL_LIGHTING,
  openPanel: null,
  zoomImpulse: 1,
  framingRequestKm: null,
  framingView: null,
  beltTiers: readStoredInteger(BELT_TIERS_KEY, 1, 1),
  // Masked to the families there are: bits a later version might add are not set by an
  // older stored value, and junk beyond them is dropped.
  beltFamilies: readStoredInteger(BELT_FAMILIES_KEY, ALL_BELT_FAMILIES, 0) & ALL_BELT_FAMILIES,
  satelliteChips: readStoredInteger(SATELLITE_CHIPS_KEY, ALL_SATELLITE_CHIPS, 0) & ALL_SATELLITE_CHIPS,

  setFocus: (id) => {
    set({ focus: id });
  },

  toggleLayer: (id) => {
    set((state) => ({ layers: { ...state.layers, [id]: !state.layers[id] } }));
  },

  setLayer: (id, on) => {
    set((state) => ({ layers: { ...state.layers, [id]: on } }));
  },

  setBeltTiers: (tiers) => {
    writeStoredInteger(BELT_TIERS_KEY, tiers);
    set({ beltTiers: tiers });
  },

  toggleBeltFamily: (index) => {
    const beltFamilies = toggledFamily(get().beltFamilies, index);
    writeStoredInteger(BELT_FAMILIES_KEY, beltFamilies);
    set({ beltFamilies });
  },

  toggleSatelliteChip: (index) => {
    const satelliteChips = toggledChip(get().satelliteChips, index);
    writeStoredInteger(SATELLITE_CHIPS_KEY, satelliteChips);
    set({ satelliteChips });
  },

  setLighting: (mode) => {
    set({ lighting: mode });
  },


  togglePanel: (id) => {
    set((state) => ({ openPanel: state.openPanel === id ? null : id }));
  },

  closePanel: () => {
    set({ openPanel: null });
  },

  nudgeZoom: (factor) => {
    set((state) => ({ zoomImpulse: state.zoomImpulse * factor }));
  },

  consumeZoomImpulse: () => {
    const impulse = get().zoomImpulse;
    if (impulse !== 1) {
      set({ zoomImpulse: 1 });
    }
    return impulse;
  },

  requestFraming: (km, view) => {
    set({ framingRequestKm: km, framingView: view ?? null });
  },

  consumeFramingRequest: () => {
    const { framingRequestKm: km, framingView: view } = get();
    if (km === null) {
      return null;
    }
    set({ framingRequestKm: null, framingView: null });
    return { km, view };
  },
}));

/** Layers that are implemented today. */
export function isLayerAvailable(id: LayerId): boolean {
  return LAYERS.find((layer) => layer.id === id)?.pending === null;
}
