import type { BodyId } from '@sss/tools/types';
import { create } from 'zustand';

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
    description: 'Sunlight with a real terminator, plus enough fill to read the night side.',
  },
  {
    id: 'natural',
    label: 'Natural Lighting',
    description: 'Sunlight only. The night side is genuinely black, as it is in space.',
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
  { id: 'moons', label: 'Moons', pending: 'Phase A' },
  { id: 'asteroids', label: 'Asteroids', pending: 'Phase B' },
  { id: 'comets', label: 'Comets', pending: 'Phase B' },
  { id: 'constellations', label: 'Constellations', pending: 'Phase D' },

  { id: 'spacecraft', label: 'Spacecraft', pending: 'Phase A', startsGroup: true },

  { id: 'trails', label: 'Trails', pending: 'Phase A', startsGroup: true },
  { id: 'orbits', label: 'Orbits', pending: null },
  { id: 'labels', label: 'Labels', pending: null },
  { id: 'icons', label: 'Icons', pending: null },
];

export type LayerState = Record<LayerId, boolean>;

const DEFAULT_LAYERS: LayerState = {
  userInterface: true,
  planets: true,
  dwarfPlanets: true,
  moons: false,
  asteroids: false,
  comets: false,
  spacecraft: false,
  constellations: false,
  trails: false,
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

  readonly setFocus: (id: BodyId) => void;
  readonly toggleLayer: (id: LayerId) => void;
  readonly setLayer: (id: LayerId, on: boolean) => void;
  readonly setLighting: (mode: LightingMode) => void;
  readonly togglePanel: (id: PanelId) => void;
  readonly closePanel: () => void;
  readonly nudgeZoom: (factor: number) => void;
  readonly consumeZoomImpulse: () => number;
}

export const useViewStore = create<ViewState>((set, get) => ({
  focus: 'sun',
  layers: DEFAULT_LAYERS,
  lighting: 'shadow',
  openPanel: null,
  zoomImpulse: 1,

  setFocus: (id) => {
    set({ focus: id });
  },

  toggleLayer: (id) => {
    set((state) => ({ layers: { ...state.layers, [id]: !state.layers[id] } }));
  },

  setLayer: (id, on) => {
    set((state) => ({ layers: { ...state.layers, [id]: on } }));
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
