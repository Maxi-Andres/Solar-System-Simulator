import { beforeEach, describe, expect, it } from 'vitest';

import { bodiesDifferingBySet, TEXTURE_SETS } from '@sss/tools/catalog';

import { ALL_SATELLITE_CHIPS } from '../core/satelliteGroups.ts';
import {
  isLayerAvailable,
  LAYER_GROUPS,
  LAYERS,
  LIGHTING_MODES,
  useViewStore,
  type LayerId,
} from './store.ts';

const INITIAL = useViewStore.getState();

beforeEach(() => {
  useViewStore.setState({
    focus: 'sun',
    layers: { ...INITIAL.layers },
    lighting: 'natural',
    openPanel: null,
    reading: null,
    zoomImpulse: 1,
    selectedLevel: null,
  });
});

describe('surface map sets', () => {
  // No picker: it was removed by request, since the true-colour set changes only three
  // bodies. Both sets stay in the catalog, so these guard the files that are still in
  // the repository and the constant that chooses between them.
  it('keeps both sets described, naming what each one is', () => {
    expect(TEXTURE_SETS.map((set) => set.id)).toEqual(['illustrative', 'photometric']);

    const illustrative = TEXTURE_SETS.find((set) => set.id === 'illustrative');
    const photometric = TEXTURE_SETS.find((set) => set.id === 'photometric');

    expect(illustrative?.description).toMatch(/not a measurement/i);
    expect(photometric?.description).toMatch(/Earth, Mars and Neptune/);
  });

  it('differs on exactly three bodies', () => {
    expect(bodiesDifferingBySet()).toEqual(['earth', 'mars', 'neptune']);
  });
});

describe('layer catalog', () => {
  it('has unique ids', () => {
    const ids = LAYERS.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks unimplemented layers with the phase that brings them', () => {
    const pending = LAYERS.filter((layer) => layer.pending !== null).map((layer) => layer.id);

    // These are listed so the panel doubles as a roadmap; if one ships, its entry
    // must lose the badge or the UI lies about what it can do.
    // Comets shipped in step B2c.
    expect(pending).toEqual([
      'constellations',
    ]);
    for (const layer of LAYERS) {
      if (layer.pending !== null) {
        expect(layer.pending).toMatch(/^Phase [A-D]$/);
      }
    }
  });

  it('puts every layer in exactly one group of the panel', () => {
    const grouped = LAYER_GROUPS.flatMap((group) => group.layers);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(LAYERS.map((layer) => layer.id).sort());
    expect(new Set(LAYER_GROUPS.map((group) => group.id)).size).toBe(LAYER_GROUPS.length);
    for (const group of LAYER_GROUPS) {
      expect(group.layers.length, group.id).toBeGreaterThan(0);
    }
  });

  it('opens only the Solar System on a first visit', () => {
    expect(LAYER_GROUPS.filter((group) => group.openByDefault).map((group) => group.id)).toEqual(['solarSystem']);
  });

  it('reports availability consistently with the catalog', () => {
    expect(isLayerAvailable('orbits')).toBe(true);
    expect(isLayerAvailable('labels')).toBe(true);
    expect(isLayerAvailable('comets')).toBe(true);
    expect(isLayerAvailable('constellations')).toBe(false);
  });

  it('defaults to showing exactly what exists today', () => {
    const on = Object.entries(INITIAL.layers)
      .filter(([, enabled]) => enabled)
      .map(([id]) => id as LayerId);

    for (const id of on) {
      expect(isLayerAvailable(id)).toBe(true);
    }
  });

  it('shows the moons from the start, now that they are real', () => {
    expect(isLayerAvailable('moons')).toBe(true);
    expect(INITIAL.layers.moons).toBe(true);
  });

  it('keeps the satellites off until asked for, every group with them', () => {
    expect(isLayerAvailable('satellites')).toBe(true);
    expect(INITIAL.layers.satellites).toBe(false);
    expect(INITIAL.satelliteChips).toBe(ALL_SATELLITE_CHIPS);
  });

  it('shows the spacecraft from the start too', () => {
    expect(isLayerAvailable('spacecraft')).toBe(true);
    expect(INITIAL.layers.spacecraft).toBe(true);
  });
});

describe('lighting modes', () => {
  it('offers the three NASA Eyes modes, natural last', () => {
    expect(LIGHTING_MODES.map((mode) => mode.id)).toEqual(['flood', 'shadow', 'natural']);
  });

  it('says which mode is physical', () => {
    const natural = LIGHTING_MODES.find((mode) => mode.id === 'natural')!;
    const flood = LIGHTING_MODES.find((mode) => mode.id === 'flood')!;

    expect(natural.description).toMatch(/black|space/i);
    expect(flood.description).toMatch(/not physical/i);
  });
});

describe('view store', () => {
  it('toggles a layer', () => {
    useViewStore.getState().toggleLayer('orbits');
    expect(useViewStore.getState().layers.orbits).toBe(false);

    useViewStore.getState().toggleLayer('orbits');
    expect(useViewStore.getState().layers.orbits).toBe(true);
  });

  it('sets a layer explicitly, which is how the UI is restored', () => {
    useViewStore.getState().setLayer('userInterface', false);
    expect(useViewStore.getState().layers.userInterface).toBe(false);

    useViewStore.getState().setLayer('userInterface', true);
    expect(useViewStore.getState().layers.userInterface).toBe(true);
  });

  it('treats panels as mutually exclusive and toggles on repeat', () => {
    useViewStore.getState().togglePanel('layers');
    expect(useViewStore.getState().openPanel).toBe('layers');

    useViewStore.getState().togglePanel('lighting');
    expect(useViewStore.getState().openPanel).toBe('lighting');

    useViewStore.getState().togglePanel('lighting');
    expect(useViewStore.getState().openPanel).toBeNull();
  });

  it('accumulates zoom impulses and clears them once consumed', () => {
    const { nudgeZoom, consumeZoomImpulse } = useViewStore.getState();

    nudgeZoom(2);
    nudgeZoom(3);
    expect(consumeZoomImpulse()).toBe(6);

    // A second read must not zoom again.
    expect(consumeZoomImpulse()).toBe(1);
  });

  it('changes focus', () => {
    useViewStore.getState().setFocus('pluto');
    expect(useViewStore.getState().focus).toBe('pluto');
  });

  // The breadcrumb's Solar System with the Sun already in focus, from the Observable Universe's view:
  // it did nothing, and the CMB stayed on screen under a breadcrumb reading Solar System.
  it('asks for the focus to be framed again when it is chosen again', () => {
    useViewStore.getState().consumeFramingRequest();
    const before = useViewStore.getState().refocus;
    useViewStore.getState().setFocus('sun');
    expect(useViewStore.getState().focus).toBe('sun');
    expect(useViewStore.getState().refocus).toBe(before + 1);
    // A new focus is framed by being new: no count.
    useViewStore.getState().setFocus('earth');
    expect(useViewStore.getState().refocus).toBe(before + 1);
  });

  it('leaves a framing already asked for alone when the focus is chosen again', () => {
    const before = useViewStore.getState().refocus;
    useViewStore.getState().requestFraming(1e9);
    useViewStore.getState().setFocus('sun');
    expect(useViewStore.getState().refocus).toBe(before);
    expect(useViewStore.getState().consumeFramingRequest()).toEqual({ km: 1e9, view: null });
  });
});

// The breadcrumb's levels selected as bodies are (Maxi, 2026-11-20: "toqué Milky Way pero me pone
// read about the Sun"): a level crumb selects its level about its centre, and any body chosen,
// however it is chosen, clears it -- all of them go through setFocus.
describe('the level selected', () => {
  it('is the level a crumb selects, the focus its centre', () => {
    useViewStore.getState().setFocus('sun');
    useViewStore.getState().selectLevel('milky-way');
    expect(useViewStore.getState().selectedLevel).toBe('milky-way');
    expect(useViewStore.getState().focus).toBe('sun');
  });

  it('is cleared by a body chosen', () => {
    useViewStore.getState().selectLevel('local-group');
    useViewStore.getState().setFocus('earth');
    expect(useViewStore.getState().selectedLevel).toBeNull();
  });

  it('is cleared by its centre chosen as a body, as the Sun from the planets’ list', () => {
    useViewStore.getState().consumeFramingRequest();
    useViewStore.getState().setFocus('sun');
    useViewStore.getState().selectLevel('solar-system');
    useViewStore.getState().setFocus('sun');
    expect(useViewStore.getState().selectedLevel).toBeNull();
  });

  it('is cleared with a framing waiting, as a go-there asks for one', () => {
    useViewStore.getState().selectLevel('observable-universe');
    useViewStore.getState().requestFraming(1e9);
    useViewStore.getState().setFocus('sun');
    expect(useViewStore.getState().selectedLevel).toBeNull();
    useViewStore.getState().consumeFramingRequest();
  });

  it('is selected after the focus, so a crumb’s own focus does not clear it', () => {
    useViewStore.getState().setFocus('earth');
    useViewStore.getState().setFocus('sun');
    useViewStore.getState().selectLevel('solar-neighbourhood');
    expect(useViewStore.getState().selectedLevel).toBe('solar-neighbourhood');
  });

  it('takes the place of a description open, with its own panel', () => {
    useViewStore.getState().readAbout(null);
    expect(useViewStore.getState().openPanel).toBe('description');
    useViewStore.getState().selectLevel('milky-way');
    expect(useViewStore.getState().openPanel).toBe('body');
    expect(useViewStore.getState().reading).toBeNull();
  });

  it('leaves the panels as they are otherwise', () => {
    useViewStore.getState().togglePanel('layers');
    useViewStore.getState().selectLevel('milky-way');
    expect(useViewStore.getState().openPanel).toBe('layers');
  });
});
