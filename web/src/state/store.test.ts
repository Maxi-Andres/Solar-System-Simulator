import { beforeEach, describe, expect, it } from 'vitest';

import {
  isLayerAvailable,
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
    lighting: 'shadow',
    openPanel: null,
    zoomImpulse: 1,
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
    expect(pending).toEqual([
      'moons',
      'asteroids',
      'comets',
      'constellations',
      'spacecraft',
      'trails',
    ]);
    for (const layer of LAYERS) {
      if (layer.pending !== null) {
        expect(layer.pending).toMatch(/^Phase [A-D]$/);
      }
    }
  });

  it('reports availability consistently with the catalog', () => {
    expect(isLayerAvailable('orbits')).toBe(true);
    expect(isLayerAvailable('labels')).toBe(true);
    expect(isLayerAvailable('asteroids')).toBe(false);
  });

  it('defaults to showing exactly what exists today', () => {
    const on = Object.entries(INITIAL.layers)
      .filter(([, enabled]) => enabled)
      .map(([id]) => id as LayerId);

    for (const id of on) {
      expect(isLayerAvailable(id)).toBe(true);
    }
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
});
