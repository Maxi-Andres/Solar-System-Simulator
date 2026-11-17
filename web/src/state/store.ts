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
  | 'lagrangePoints'
  | 'heliosphere'
  | 'magnetosphere'
  | 'starMap'
  | 'exoplanetHosts'
  | 'pulsars'
  | 'globularClusters'
  | 'supernovaRemnants'
  | 'nebulae'
  | 'stellarStreams'
  | 'galacticBubbles'
  | 'localInterstellar'
  | 'messier'
  | 'notableStars'
  | 'milkyWay'
  | 'localGroup'
  | 'laniakea'
  | 'laniakeaBasin'
  | 'shapleyBasin'
  | 'flowLines'
  | 'sdssGalaxies'
  | 'filaments'
  | 'quasars'
  | 'szClusters'
  | 'observableUniverse'
  | 'nuclearCluster'
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
  /** What it is, a few words, shown on hover in the Layers panel. */
  readonly hint: string;
  /** Draws a separator above this entry, grouping the list like NASA Eyes does. */
  readonly startsGroup?: boolean;
}

export const LAYERS: readonly LayerDefinition[] = [
  { id: 'userInterface', label: 'User Interface', hint: 'Panels, names and controls.', pending: null },

  { id: 'planets', label: 'Planets', hint: 'The Sun and the eight planets.', pending: null, startsGroup: true },
  { id: 'dwarfPlanets', label: 'Dwarf Planets', hint: 'Pluto, Eris, Ceres, Haumea, Makemake.', pending: null },
  { id: 'moons', label: 'Moons', hint: 'The major moons.', pending: null },
  // The 437 beyond the major moons. They need Moons on too: they are moons.
  { id: 'smallMoons', label: 'Small Moons', hint: 'Hundreds of small moons of the giants.', pending: null },
  // The named ones -- mission targets, the largest, and Apophis -- and the belt: every
  // asteroid SBDB knows down to its magnitude limit, drawn as dots (see AsteroidBelt).
  { id: 'asteroids', label: 'Asteroids', hint: 'Named asteroids and the belt, from JPL.', pending: null },
  // SBDB's four thousand, each on its own conic -- a third of them open, on parabolas and
  // hyperbolas. Off by default, as the belt is.
  { id: 'comets', label: 'Comets', hint: 'About four thousand comets, from JPL.', pending: null },
  // The Sun-Earth and Earth-Moon Lagrange points, computed at each instant (core/lagrange.ts).
  { id: 'lagrangePoints', label: 'Lagrange Points', hint: 'Computed balance points. Nothing is there to see.', pending: null },
  // The termination shock and heliopause, the Voyagers' four crossings, the Oort cloud
  // (core/heliosphere.ts, scene/Heliosphere.tsx): models fitted to what is measured.
  { id: 'heliosphere', label: 'Heliosphere', hint: 'Where the solar wind ends. A model: invisible in reality.', pending: null },
  // Earth's magnetopause, bow shock, Van Allen belts and Kármán line, as the standard models draw
  // them (core/magnetosphere.ts). Off until asked for: shells about Earth are not a first view.
  { id: 'magnetosphere', label: 'Magnetosphere', hint: "Earth's magnetic shield. A model: invisible in reality.", pending: null },
  // Past the Solar System every star in the catalogue drawn at least as a dot, at its real
  // place: a map, not a view (see stars3dShader.ts). Off, the stars are only what an eye
  // would see from where the camera is.
  { id: 'starMap', label: 'Star Map', hint: 'Every catalogue star as a dot, not just what the eye sees.', pending: null },
  // Every star the NASA Exoplanet Archive lists a planet for, ringed on the map with a dot
  // per planet (scene/ExoplanetHosts.tsx); shown where the map is, past the planets.
  { id: 'exoplanetHosts', label: 'Exoplanet Hosts', hint: 'Stars with known planets.', pending: null },
  // Every pulsar the ATNF catalogue can place and McGill's magnetars (core/pulsars.ts):
  // marked across the map and the galaxy, as the hosts are on the map. Off until asked for:
  // four thousand dots over the galaxy are a map of one kind of object, not a view. A
  // pulsar found by search turns it on.
  { id: 'pulsars', label: 'Pulsars', hint: 'Pulsars and magnetars.', pending: null },
  // The Milky Way's globular clusters (core/globularClusters.ts): marked on the map and the
  // galaxy, and the one the camera is near drawn as stars, a model of its measured light and
  // size. On: a hundred and sixty marks, and what there is to see out of the disc.
  { id: 'globularClusters', label: 'Globular Clusters', hint: 'Old balls of stars around the galaxy.', pending: null },
  // Nine famous supernova remnants (core/supernovaRemnants.ts), each a ring of its real size
  // at its measured distance. On: nine names.
  { id: 'supernovaRemnants', label: 'Supernova Remnants', hint: 'Gas left by exploded stars.', pending: null },
  // Star-forming regions and planetary nebulae (core/nebulae.ts): each a volume of its
  // measured size at its measured distance, in the colours of its lines.
  { id: 'nebulae', label: 'Nebulae', hint: 'Glowing gas clouds where stars form or die.', pending: null },
  // The stellar streams of the halo (core/streams.ts): galstreams' tracks, faint trails.
  { id: 'stellarStreams', label: 'Stellar Streams', hint: 'Remains of torn-apart star clusters and dwarf galaxies.', pending: null },
  // The Fermi and eROSITA bubbles (scene/GalacticBubbles.tsx): faint shells above and below
  // the centre, their outlines on the sky measured, their depth modelled.
  { id: 'galacticBubbles', label: 'Fermi & eROSITA Bubbles', hint: 'Two huge gas lobes above and below the centre. Depth modelled.', pending: null },
  // The Sun's surroundings in the interstellar medium (core/localInterstellar.ts): the Local
  // Bubble, the Radcliffe Wave, the Local Interstellar Cloud.
  { id: 'localInterstellar', label: 'Local Interstellar Medium', hint: 'The gas around the Sun. Shapes partly modelled.', pending: null },
  // The Messier objects drawn as nothing else (core/messier.ts): open clusters and the
  // rest, marked. Off until asked for, as the pulsars are: a catalogue's marks, not a view.
  { id: 'messier', label: 'Messier Objects', hint: 'The Messier catalogue, marked.', pending: null },
  // Named stars, stellar black holes and young clusters the star catalogue does not place
  // (core/notableStars.ts): marks at their measured distances. Off until asked for, as the
  // Messier marks are; a search for one turns it on.
  { id: 'notableStars', label: 'Notable Stars', hint: 'Famous and extreme stars, stellar black holes.', pending: null },
  // Past the catalogue, the galaxy as a model of published structure (core/milkyWay.ts):
  // a glow, never stars. On by default, so the dark past the census is not taken for the
  // edge of the stars.
  { id: 'milkyWay', label: 'Milky Way Model', hint: 'The galaxy beyond the measured stars. A model.', pending: null },
  // The Local Group's galaxies (core/localGroup.ts): each a volume of its measured light,
  // size and shape, past the Milky Way; the dwarfs marked as the camera leaves the disc.
  { id: 'localGroup', label: 'Local Group', hint: 'Andromeda, the Magellanic Clouds and our nearest galaxies.', pending: null },
  // Laniakea and beyond (core/laniakea.ts): 86,899 galaxies out to 700 Mpc, each its light,
  // and the named clusters, superclusters, voids and walls.
  { id: 'laniakea', label: 'Laniakea', hint: 'Our supercluster: 87,000 galaxies, clusters and voids.', pending: null },
  // Laniakea's boundary as the Cosmicflows-4 galaxies' watersheds draw it (Dupuy & Courtois
  // 2023): a faint outline.
  { id: 'laniakeaBasin', label: 'Laniakea Basin', hint: "Laniakea's border, computed from galaxy motions.", pending: null },
  // The groups' reconstruction's answer: the Milky Way's flow ends at Shapley, and Laniakea is
  // part of Shapley's basin. Off, as the other answer is; the About says why both.
  { id: 'shapleyBasin', label: 'Shapley Basin', hint: 'The alternative answer: we belong to Shapley.', pending: null },
  // The Cosmicflows-4 velocity field's streamlines (core/laniakea.ts FlowLines): where the
  // galaxies' flow goes: a few dozen, Laniakea's in its gold, a brightening running down each
  // toward its attractor. Off by default: computed, not seen (see DEFAULT_LAYER_STATE).
  { id: 'flowLines', label: 'Flow Lines', hint: 'Where galaxies flow, computed from their motions.', pending: null },
  // The cosmic web past it (core/cosmicWeb.ts): the 1.8 million galaxies of the SDSS main
  // sample and BOSS, out to 9 billion light years, in the surveys' wedges of the sky.
  { id: 'sdssGalaxies', label: 'SDSS Galaxies', hint: '1.8 million galaxies mapped by SDSS.', pending: null },
  // The filaments found in them: Tempel et al. 2014's and Malavasi et al. 2020's, thin threads.
  { id: 'filaments', label: 'Filaments', hint: 'The threads of the cosmic web, found in the galaxies.', pending: null },
  // The quasars of SDSS DR16Q (core/quasars.ts): 750 thousand, out to z 7, 28 billion light
  // years, in the SDSS's wedges; fetched only past a billion light years.
  { id: 'quasars', label: 'Quasars', hint: '750,000 quasars: bright black holes far away.', pending: null },
  // The Planck SZ clusters (core/quasars.ts): a thousand clusters over the whole sky to z 1,
  // small rings.
  { id: 'szClusters', label: 'SZ Clusters', hint: 'Galaxy clusters found by Planck.', pending: null },
  // The observable universe (G4, scene/cmb.ts, core/recordHolders.ts): the CMB's
  // last-scattering sphere, drawn only from far outside it, and the record-holders.
  { id: 'observableUniverse', label: 'Observable Universe', hint: 'The cosmic microwave background and the farthest objects.', pending: null },
  // The nuclear star cluster round Sgr A* past the stars measured there, as a model of
  // published structure (core/nuclearCluster.ts): stars, each of its own brightness, but
  // none a particular one. A layer of its own, as the galaxy's model is, so the measured
  // S-stars and young stars can be seen without it. On, as the galaxy's model is: the light
  // is real and there to see, only no star of it is a particular one (see DEFAULT_LAYER_STATE).
  { id: 'nuclearCluster', label: 'Nuclear Cluster Model', hint: 'Stars round the central black hole. A model.', pending: null },
  { id: 'constellations', label: 'Constellations', hint: 'Constellation lines.', pending: 'Phase D' },

  { id: 'spacecraft', label: 'Spacecraft', hint: 'Probes and missions, on their real paths.', pending: null, startsGroup: true },
  // Earth's satellites from CelesTrak (Phase C): a hundred named ones as bodies, and tens
  // of thousands more as dots. Off by default: they matter only near Earth, and switched
  // on they download a few megabytes.
  { id: 'satellites', label: 'Satellites', hint: "Earth's satellites.", pending: null },

  // Spacecraft trajectories, from JPL's own samples. A planet's or a moon's trail would
  // be its orbit drawn twice, so the layer is the craft's alone.
  { id: 'trails', label: 'Trails', hint: "Spacecraft's past paths.", pending: null, startsGroup: true },
  { id: 'orbits', label: 'Orbits', hint: 'Orbit lines.', pending: null },
  // Circles about the Sun at 1, 5, 10, 50 and 100 light years: a ruler, not a thing (see
  // distanceRings.ts). On, because they draw nothing until the camera is out among the
  // stars, where they are most of what says how far away anything is.
  { id: 'distanceRings', label: 'Distance Rings', hint: 'Circles 1 to 100 light years from the Sun. A ruler.', pending: null },
  { id: 'labels', label: 'Labels', hint: 'Names.', pending: null },
  { id: 'icons', label: 'Icons', hint: 'Marks and rings.', pending: null },
];

export type LayerState = Record<LayerId, boolean>;

/**
 * What is on at first. Off is anything drawn that is a model's shape or a computation rather
 * than something there to be seen -- the heliosphere's shells, the Lagrange points, the
 * bubbles' depth, the Local Bubble's walls, the basins and flow lines -- so a first look is not taken for a photograph of them
 * (Maxi: "lo que no sea real default no este activado"). Each is a switch away, its hover
 * saying what it is. Kept on: the models of light that is really there to be seen, only not
 * star by star -- the Milky Way's, without which the galaxy past the measured stars is dark
 * and taken for their edge, and the nuclear cluster's, without which the densest place in it
 * is drawn empty round its black hole; and the rings, orbits and marks, which no
 * one takes for objects.
 */
export const DEFAULT_LAYER_STATE: LayerState = {
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
  lagrangePoints: false,
  heliosphere: false,
  magnetosphere: false,
  starMap: true,
  exoplanetHosts: true,
  pulsars: false,
  globularClusters: true,
  supernovaRemnants: true,
  nebulae: true,
  stellarStreams: true,
  galacticBubbles: false,
  localInterstellar: false,
  messier: false,
  notableStars: false,
  milkyWay: true,
  localGroup: true,
  laniakea: true,
  laniakeaBasin: false,
  shapleyBasin: false,
  flowLines: false,
  sdssGalaxies: true,
  filaments: true,
  quasars: true,
  szClusters: true,
  observableUniverse: true,
  nuclearCluster: true,
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

/**
 * A framing a body asks for whenever it is focused, however it is -- a click, the search, the
 * breadcrumb: a supernova remnant's is Earth's view of it (App.tsx). Taken only when nothing
 * else asked for one with the focus.
 */
let focusFraming: ((id: BodyId) => FramingRequest | null) | null = null;

export function setFocusFraming(framing: ((id: BodyId) => FramingRequest | null) | null): void {
  focusFraming = framing;
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
   * Counts the times the focus was chosen again while already the focus, with no framing of
   * its own: the camera rig frames it afresh each time, as it does a new focus. Without it
   * the breadcrumb's Solar System, the Sun already in focus, did nothing -- and from the
   * Observable Universe it left the camera 250 billion light years out, the CMB filling the
   * view under a breadcrumb that read Solar System.
   */
  readonly refocus: number;
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
  /**
   * Whether the camera is in the Solar System (scene/inSolarSystem.ts), kept by
   * SolarSystemWatch: while it is, the nebulae and supernova remnants are not drawn.
   */
  readonly inSolarSystem: boolean;

  readonly setFocus: (id: BodyId) => void;
  readonly toggleLayer: (id: LayerId) => void;
  readonly setInSolarSystem: (inside: boolean) => void;
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
  layers: DEFAULT_LAYER_STATE,
  lighting: PHYSICAL_LIGHTING,
  openPanel: null,
  zoomImpulse: 1,
  framingRequestKm: null,
  framingView: null,
  refocus: 0,
  beltTiers: readStoredInteger(BELT_TIERS_KEY, 1, 1),
  // Masked to the families there are: bits a later version might add are not set by an
  // older stored value, and junk beyond them is dropped.
  beltFamilies: readStoredInteger(BELT_FAMILIES_KEY, ALL_BELT_FAMILIES, 0) & ALL_BELT_FAMILIES,
  satelliteChips: readStoredInteger(SATELLITE_CHIPS_KEY, ALL_SATELLITE_CHIPS, 0) & ALL_SATELLITE_CHIPS,
  inSolarSystem: true,

  setFocus: (id) => {
    const state = get();
    if (id === state.focus) {
      // Chosen again -- the breadcrumb's Solar System with the Sun in focus from 250 billion
      // light years out: framed again, as a new focus is, unless a framing already waits.
      if (state.framingRequestKm !== null) return;
      const own = focusFraming?.(id) ?? null;
      set(own === null ? { refocus: state.refocus + 1 } : { framingRequestKm: own.km, framingView: own.view });
      return;
    }
    const own = state.framingRequestKm === null ? (focusFraming?.(id) ?? null) : null;
    set(own === null ? { focus: id } : { focus: id, framingRequestKm: own.km, framingView: own.view });
  },

  toggleLayer: (id) => {
    set((state) => ({ layers: { ...state.layers, [id]: !state.layers[id] } }));
  },

  setInSolarSystem: (inside) => {
    set({ inSolarSystem: inside });
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
