import type { BodyId } from '@sss/tools/types';
import { create } from 'zustand';

import { PHYSICAL_LIGHTING } from '../scene/shading.ts';
import { ALL_BELT_FAMILIES, toggledFamily } from '../core/belt.ts';
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
  | 'spacecraft'
  | 'constellations'
  | 'trails'
  | 'orbits'
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
  { id: 'constellations', label: 'Constellations', pending: 'Phase D' },

  { id: 'spacecraft', label: 'Spacecraft', pending: null, startsGroup: true },

  // Spacecraft trajectories, from JPL's own samples. A planet's or a moon's trail would
  // be its orbit drawn twice, so the layer is the craft's alone.
  { id: 'trails', label: 'Trails', pending: null, startsGroup: true },
  { id: 'orbits', label: 'Orbits', pending: null },
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
  spacecraft: true,
  constellations: false,
  trails: true,
  orbits: true,
  labels: true,
  icons: true,
};

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

  readonly setFocus: (id: BodyId) => void;
  readonly toggleLayer: (id: LayerId) => void;
  readonly setLayer: (id: LayerId, on: boolean) => void;
  readonly setLighting: (mode: LightingMode) => void;
  readonly setBeltTiers: (tiers: number) => void;
  readonly toggleBeltFamily: (index: number) => void;
  readonly togglePanel: (id: PanelId) => void;
  readonly closePanel: () => void;
  readonly nudgeZoom: (factor: number) => void;
  readonly consumeZoomImpulse: () => number;
}

/** Where the belt's density is kept between visits; see `beltTiers`. */
export const BELT_TIERS_KEY = 'belt-tiers';

/** Where the belt's families are kept between visits; see `beltFamilies`. */
export const BELT_FAMILIES_KEY = 'belt-families';

export const useViewStore = create<ViewState>((set, get) => ({
  focus: 'sun',
  layers: DEFAULT_LAYERS,
  lighting: PHYSICAL_LIGHTING,
  openPanel: null,
  zoomImpulse: 1,
  beltTiers: readStoredInteger(BELT_TIERS_KEY, 1, 1),
  // Masked to the families there are: bits a later version might add are not set by an
  // older stored value, and junk beyond them is dropped.
  beltFamilies: readStoredInteger(BELT_FAMILIES_KEY, ALL_BELT_FAMILIES, 0) & ALL_BELT_FAMILIES,

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
}));

/** Layers that are implemented today. */
export function isLayerAvailable(id: LayerId): boolean {
  return LAYERS.find((layer) => layer.id === id)?.pending === null;
}
