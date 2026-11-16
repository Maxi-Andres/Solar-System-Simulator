import { describe, expect, it } from 'vitest';

import { MESSIER as GLOBULAR_MESSIER } from '../../../tools/src/clusters/globularClusters.ts';
import { MESSIER_BY_NGC } from '../../../tools/src/localVolume/localVolume.ts';
import { deepSkyOf } from './deepSky.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import {
  ensureMessierObjects,
  MESSIER,
  MESSIER_MARKS,
  messierFraming,
  messierMarkBodyId,
  messierMarkOf,
  messierRadiusKm,
  messierState,
  messierSynonym,
} from './messier.ts';
import { searchBodies } from './search.ts';
import { SUPERNOVA_REMNANTS, remnantBodyId } from './supernovaRemnants.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const mark = (key: string) => MESSIER_MARKS.find((candidate) => candidate.key === key)!;

/** The nebulae drawn as volumes (nebulae.ts), by key, with their Messier numbers. */
const NEBULA_KEYS: Readonly<Record<string, number>> = {
  lagoon: 8,
  eagle: 16,
  omega: 17,
  trifid: 20,
  dumbbell: 27,
  orion: 42,
  ring: 57,
};

function emptyStore(): EphemerisStore {
  return new EphemerisStore({
    manifest: { bodies: [], tables: {} },
    bodies: [],
    vectors: new Map(),
    elements: new Map(),
    generatedAt: new Date(0),
  } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
}

describe('Messier’s catalogue', () => {
  it('accounts for all 110, once each', () => {
    expect(MESSIER.map((entry) => entry.m)).toEqual(Array.from({ length: 110 }, (_, i) => i + 1));
  });

  it('is 29 globular clusters, 40 galaxies, a remnant, seven nebulae drawn, 31 marked and two skipped', () => {
    const count = (as: string) => MESSIER.filter((entry) => entry.drawn.as === as).length;
    expect(count('globular-cluster')).toBe(29);
    expect(count('galaxy')).toBe(40);
    expect(count('remnant')).toBe(1);
    expect(count('nebula')).toBe(7);
    expect(count('marked')).toBe(31);
    expect(count('skipped')).toBe(2);
    for (const entry of MESSIER) {
      if (entry.drawn.as === 'skipped') expect(entry.drawn.reason.length).toBeGreaterThan(40);
    }
  });

  it('links each globular cluster to the cluster whose Messier name it is', () => {
    for (const entry of MESSIER) {
      if (entry.drawn.as !== 'globular-cluster') continue;
      expect(GLOBULAR_MESSIER[entry.drawn.ngc], `M${entry.m}`).toBe(`M${entry.m}`);
    }
  });

  it('links each galaxy to the one its catalogues name by its number; M102 to NGC 5866, which none does', () => {
    for (const entry of MESSIER) {
      if (entry.drawn.as !== 'galaxy') continue;
      const ngc = Number(entry.drawn.ngc.replace('NGC ', ''));
      if (entry.m === 102) {
        expect(MESSIER_BY_NGC[ngc]).toBeUndefined();
        expect(entry.note).toMatch(/disputed/);
      } else {
        expect(MESSIER_BY_NGC[ngc], `M${entry.m}`).toBe(entry.m);
      }
    }
  });

  it('links M1 to the Crab Nebula and the nebulae to theirs', () => {
    expect(SUPERNOVA_REMNANTS.map(remnantBodyId)).toContain(
      (MESSIER[0]!.drawn as { bodyId: string }).bodyId,
    );
    for (const entry of MESSIER) {
      if (entry.drawn.as !== 'nebula') continue;
      const key = entry.drawn.bodyId.replace('nebula-', '');
      expect(NEBULA_KEYS[key], entry.drawn.bodyId).toBe(entry.m);
    }
  });

  it('marks what it says it marks, each under its own number', () => {
    const listed = MESSIER.flatMap((entry) =>
      entry.drawn.as === 'marked' ? entry.drawn.marks.map((key) => [key, entry.m] as const) : [],
    );
    expect(listed.map(([key]) => key).sort()).toEqual(MESSIER_MARKS.map((m) => m.key).sort());
    for (const [key, m] of listed) expect(mark(key).m).toBe(m);
  });
});

describe('the marks', () => {
  it('are where their distances put them', () => {
    for (const m of MESSIER_MARKS) {
      const p = messierState(m).position;
      expect(Math.hypot(p.x, p.y, p.z) / PARSEC_KM).toBeCloseTo(m.distancePc, 3);
    }
  });

  it('put the Pleiades at 135.5 pc and Praesepe at 184, as Gaia’s parallaxes do', () => {
    expect(mark('m45').distancePc).toBeCloseTo(135.5, 0);
    expect(mark('m44').distancePc).toBeCloseTo(184.4, 0);
    // The Pleiades' half-member radius, 95.5', at that distance: 3.8 pc.
    expect(messierRadiusKm(mark('m45'))! / PARSEC_KM).toBeCloseTo(3.77, 1);
  });

  it('put M40’s two stars 165 pc apart: not a pair', () => {
    expect(mark('m40-a').distancePc - mark('m40-b').distancePc).toBeGreaterThan(160);
  });

  it('become bodies once, found by id and by their Messier numbers', () => {
    const store = emptyStore();
    ensureMessierObjects(store);
    ensureMessierObjects(store);
    for (const m of MESSIER_MARKS) {
      expect(store.isPropagatedBody(messierMarkBodyId(m))).toBe(true);
      expect(messierMarkOf(messierMarkBodyId(m))).toBe(m);
      expect(deepSkyOf(messierMarkBodyId(m))?.label).toBe(m.type);
    }
    expect(store.body('messier-m45').kind).toBe('deep-sky');
    expect(searchBodies(store.bodies, 'M45')[0]?.body.name).toBe('Pleiades');
    expect(searchBodies(store.bodies, 'm44')[0]?.body.name).toBe('Praesepe');
    expect(searchBodies(store.bodies, 'NGC 2682')[0]?.body.name).toBe('M67 (NGC 2682)');
    expect(searchBodies(store.bodies, 'M73').length).toBe(4);
  });

  it('are framed from the Sun’s side, three radii out', () => {
    const framing = messierFraming('messier-m45')!;
    expect(framing.km / PARSEC_KM).toBeCloseTo(3 * 3.77, 0);
    expect(messierFraming('not-a-mark')).toBeNull();
  });
});

describe('a Messier number no catalogue carries', () => {
  it('is looked up by what it is: M102 as NGC 5866', () => {
    expect(messierSynonym('M102')).toBe('NGC 5866');
    expect(messierSynonym('m 102')).toBe('NGC 5866');
    expect(messierSynonym('Messier 102')).toBe('NGC 5866');
    expect(messierSynonym('M10')).toBeNull();
    expect(messierSynonym('M1021')).toBeNull();
  });
});
