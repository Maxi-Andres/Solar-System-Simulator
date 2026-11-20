import { describe, expect, it } from 'vitest';

import { DEFAULT_LAYER_STATE, LAYERS } from '../state/store.ts';
import { nextInSolarSystem } from './inSolarSystem.ts';
import { AU_KM, LIGHT_YEAR_KM } from './scale.ts';

describe('in the Solar System', () => {
  it('holds while the camera is among the planets or at the heliopause', () => {
    for (const km of [1e6, 30 * AU_KM, 500 * AU_KM, 9_000 * AU_KM]) {
      expect(nextInSolarSystem(true, km)).toBe(true);
      expect(nextInSolarSystem(false, km < 8_000 * AU_KM ? km : 1)).toBe(true);
    }
  });

  it('is left past 10,000 AU and not flickered on its edge', () => {
    expect(nextInSolarSystem(true, LIGHT_YEAR_KM)).toBe(false);
    expect(nextInSolarSystem(false, 10_000 * AU_KM)).toBe(false);
    expect(nextInSolarSystem(true, 10_000 * AU_KM)).toBe(true);
  });
});

describe('the layers', () => {
  it('each say in a few words what they are', () => {
    for (const layer of LAYERS) {
      expect(layer.hint.length, layer.id).toBeGreaterThan(3);
      expect(layer.hint.length, layer.id).toBeLessThan(80);
    }
  });

  it('start with the modelled and computed ones off', () => {
    for (const id of ['heliosphere', 'magnetosphere', 'lagrangePoints', 'galacticBubbles', 'localInterstellar', 'galacticOrbit', 'laniakeaBasin', 'shapleyBasin', 'flowLines'] as const) {
      expect(DEFAULT_LAYER_STATE[id], id).toBe(false);
    }
    // Models of light really there, only not star by star: on.
    expect(DEFAULT_LAYER_STATE.milkyWay).toBe(true);
    expect(DEFAULT_LAYER_STATE.nuclearCluster).toBe(true);
  });
});

describe('what the view is of', () => {
  it('is the Milky Way from its breadcrumb framing, the CMB from the far views, nothing at home', async () => {
    const { viewSubject } = await import('./inSolarSystem.ts');
    const { CMB_DESCRIPTION_ID, MILKY_WAY_DESCRIPTION_ID } = await import('../descriptions/subjects.ts');
    expect(viewSubject(30 * AU_KM)).toBeNull();
    expect(viewSubject(180_000 * LIGHT_YEAR_KM)).toBe(MILKY_WAY_DESCRIPTION_ID);
    expect(viewSubject(5e6 * LIGHT_YEAR_KM)).toBeNull();
    expect(viewSubject(36e9 * LIGHT_YEAR_KM)).toBe(CMB_DESCRIPTION_ID);
  });
});
