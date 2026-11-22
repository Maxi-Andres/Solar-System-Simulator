import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GAIA_BH1, S2_ID, SGR_A_ID } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { PLANETARY_SYSTEMS } from '../core/planetarySystems.ts';
import { addStarRecordBody, type StarEntry } from '../core/starBodies.ts';
import { STAR3D_FLOATS, type Stars3dSource } from '../core/stars3d.ts';
import type { Signal } from '../core/signal.ts';
import type { SimClock } from '../core/time.ts';
import type { LazySource } from '../core/satellites.ts';
import { AU_KM, FOV_DEG, NEPTUNE_ORBIT_AU, SOLAR_SYSTEM_FRAMING_KM, SOLAR_SYSTEM_VIEW } from '../scene/scale.ts';
import { crumbShown, LEVELS, type LevelId } from '../state/levels.ts';
import { useViewStore } from '../state/store.ts';
import { fictionBodyId } from '../core/fiction.ts';
import { BodyPicker, crumbMenuFor, goToLevel, SUN_LEVEL_FRAMINGS, type SunLevel } from './BodyPicker.tsx';

// The breadcrumb's catalogues arrive through useSyncExternalStore, which a server render refuses
// without a server snapshot; the client one serves for both here (as about/sections.test.tsx).
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return {
    ...react,
    useSyncExternalStore: <T,>(subscribe: (onChange: () => void) => () => void, get: () => T) =>
      react.useSyncExternalStore(subscribe, get, get),
  };
});

/**
 * What the focused body's crumb drops down, for every kind of focus there is: the system it
 * is in, or nothing for a place on its own -- never the Solar System's bodies from outside it.
 * The catalogue stars are made bodies through the real path, so the facts Alpha Centauri and
 * the planetary systems are recognised by are the ones the app records.
 */

function body(id: BodyId, kind: BodyDefinition['kind'], parent: BodyId | null = null): BodyDefinition {
  return {
    id,
    name: id,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent,
    kind,
    radiusEquatorialKm: 1,
    radiusPolarKm: 1,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: '#ffffff',
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

// A store that takes the star bodies and keeps nothing, and a record a parsec off the Sun:
// the facts addStarRecordBody records are all that is read here.
const store = {
  isPropagatedBody: () => false,
  addPropagatedBody: () => undefined,
  removePropagatedBody: () => undefined,
} as unknown as EphemerisStore;
const source = {
  record: async () => new Float32Array(STAR3D_FLOATS).fill(1),
} as unknown as Stars3dSource;

async function star(index: number, designations: readonly string[], system: string | null): Promise<BodyDefinition> {
  const entry: StarEntry = { display: designations[0]!, iau: false, designations, system, nearest: null, spectralType: null };
  const id = await addStarRecordBody(store, source, 0, index, entry, '', true);
  return body(id, 'star');
}

const proxima = await star(1, ['Proxima Cen'], 'Alpha Centauri');
const tauCeti = await star(2, [PLANETARY_SYSTEMS.find((system) => system.key === 'tau-ceti')!.hostDesignation], null);
const vega = await star(3, ['alf Lyr'], null);

describe('crumbMenuFor', () => {
  it('drops down the Solar System for anything of the Sun’s', () => {
    for (const focus of [
      body('sun', 'star'),
      body('earth', 'planet'),
      body('moon', 'moon', 'earth'),
      body('pluto', 'dwarf-planet'),
      body('ceres', 'asteroid'),
      body('halley', 'comet'),
      body('voyager-1', 'spacecraft'),
      body('jwst', 'spacecraft', 'earth'),
      body('iss', 'satellite', 'earth'),
    ]) {
      expect(crumbMenuFor(focus), focus.id).toBe('solar-system');
    }
  });

  it('has no list for a galaxy: the Local Group’s, just before it, lists it', () => {
    expect(crumbMenuFor(body('galaxy-smc', 'galaxy'))).toBe('none');
    expect(crumbMenuFor(body('galaxy-draco', 'galaxy'))).toBe('none');
  });

  it('has none for a pulsar, a cluster or a remnant: the Milky Way’s lists them', () => {
    expect(crumbMenuFor(body('pulsar-1', 'neutron-star'))).toBe('none');
    expect(crumbMenuFor(body('globular-cluster-1', 'globular-cluster'))).toBe('none');
    expect(crumbMenuFor(body('remnant-crab', 'supernova-remnant'))).toBe('none');
  });

  it('drops down Alpha Centauri for a fictional world of A, a moon of one too (core/fiction.ts)', () => {
    expect(crumbMenuFor(body(fictionBodyId('polyphemus'), 'planet', 'star-a'))).toBe('alpha-centauri');
    expect(crumbMenuFor(body(fictionBodyId('pandora'), 'moon', fictionBodyId('polyphemus')))).toBe('alpha-centauri');
  });

  it('has none for a star of the neighbourhood on its own: the Solar Neighbourhood’s lists it', () => {
    expect(crumbMenuFor(vega)).toBe('none');
  });

  it('drops down a black hole’s system for it and for the star about it', () => {
    expect(crumbMenuFor(body(SGR_A_ID, 'black-hole'))).toBe('black-hole');
    expect(crumbMenuFor(body(S2_ID, 'star', SGR_A_ID))).toBe('black-hole');
    expect(crumbMenuFor(body(GAIA_BH1.id, 'black-hole'))).toBe('black-hole');
    expect(crumbMenuFor(body(GAIA_BH1.starId, 'star', GAIA_BH1.id))).toBe('black-hole');
  });

  it('drops down Alpha Centauri for its stars and their planets', () => {
    expect(crumbMenuFor(proxima)).toBe('alpha-centauri');
    expect(crumbMenuFor(body('proxima-b', 'planet', proxima.id))).toBe('alpha-centauri');
  });

  it('drops down a planetary system for its star and its planets', () => {
    expect(crumbMenuFor(tauCeti)).toBe('planetary-system');
    expect(crumbMenuFor(body('tau-ceti-g', 'planet', tauCeti.id))).toBe('planetary-system');
  });
});

describe('a level crumb', () => {
  beforeEach(() => {
    useViewStore.setState({ focus: 'earth', selectedLevel: null, framingRequestKm: null, framingView: null });
  });

  it('selects its level, the Sun at its centre the focus, framed as its crumb frames it', () => {
    for (const level of Object.keys(SUN_LEVEL_FRAMINGS) as SunLevel[]) {
      useViewStore.setState({ focus: 'earth', selectedLevel: null });
      goToLevel(level, (id) => useViewStore.getState().setFocus(id));
      const state = useViewStore.getState();
      expect(state.focus, level).toBe('sun');
      expect(state.selectedLevel, level).toBe(level);
      expect(state.consumeFramingRequest(), level).toEqual({
        km: SUN_LEVEL_FRAMINGS[level].km,
        view: SUN_LEVEL_FRAMINGS[level].view ?? null,
      });
    }
  });

  it('selects it with the Sun already in focus too', () => {
    useViewStore.setState({ focus: 'sun' });
    goToLevel('milky-way', (id) => useViewStore.getState().setFocus(id));
    expect(useViewStore.getState().selectedLevel).toBe('milky-way');
  });

  it('is unselected by a body chosen afterwards', () => {
    goToLevel('local-group', (id) => useViewStore.getState().setFocus(id));
    useViewStore.getState().setFocus('jupiter');
    expect(useViewStore.getState().selectedLevel).toBeNull();
  });
});

describe('the Solar System’s framing', () => {
  it('holds Neptune’s orbit whole, half again its radius at the frame’s half-height', () => {
    const halfHeightKm = SOLAR_SYSTEM_FRAMING_KM * Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
    expect(halfHeightKm / (NEPTUNE_ORBIT_AU * AU_KM)).toBeCloseTo(1.5, 6);
    expect(SOLAR_SYSTEM_FRAMING_KM / AU_KM).toBeGreaterThan(180);
    expect(SOLAR_SYSTEM_FRAMING_KM / AU_KM).toBeLessThan(200);
  });

  it('looks from 30 degrees above the ecliptic, ecliptic north up', () => {
    const [x, y, z] = SOLAR_SYSTEM_VIEW.direction;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    expect((Math.asin(z) * 180) / Math.PI).toBeCloseTo(30, 9);
    expect(SOLAR_SYSTEM_VIEW.up).toEqual([0, 0, 1]);
  });
});

describe('the breadcrumb with a level selected', () => {
  const sun = body('sun', 'star');
  const fakeStore = { body: (id: BodyId) => (id === 'sun' ? { ...sun, name: 'Sun' } : body(id, 'planet', 'sun')) } as unknown as EphemerisStore;
  const lazy = { subscribe: () => () => {}, value: null, request: async () => null } as unknown as LazySource<never>;
  const render = (focus: BodyId, selectedLevel: LevelId | null): string =>
    renderToStaticMarkup(
      createElement(BodyPicker, {
        store: fakeStore,
        focus,
        selectedLevel,
        onFocus: () => {},
        visibleKinds: new Set<string>(),
        clock: {} as SimClock,
        readout: {} as Signal,
        alphaCen: null,
        planetSystems: null,
        localVolume: lazy,
        onVolumeGalaxy: () => {},
        laniakea: lazy,
        onLaniakeaGalaxy: () => {},
      }),
    );
  /** The crumb marked current: the text of the element carrying aria-current. */
  const current = (html: string): string | null => {
    const match = /aria-current="location"[^>]*>([^<]*)/.exec(html);
    return match === null ? null : match[1]!.trim();
  };

  it('ends at the Sun, marked, with none selected', () => {
    const html = render('sun', null);
    expect(current(html)).toBe('Sun');
    expect(html).toContain('Solar System');
  });

  it('ends at the level selected, marked, nothing below it shown', () => {
    for (const level of ['milky-way', 'local-group', 'local-volume', 'solar-neighbourhood', 'observable-universe', 'nearby-universe'] as const) {
      const html = render('sun', level);
      expect(current(html), level).toBe(LEVELS[level].name);
      expect(html.match(/aria-current/g)?.length, level).toBe(1);
      for (const below of Object.values(LEVELS).filter((other) => other.tier > LEVELS[level].tier)) {
        expect(html, `${level}: ${below.name}`).not.toContain(`>${below.name}<`);
      }
      expect(html, level).not.toContain('>Sun<');
    }
  });

  it('ends at the Solar System selected, which drops down its bodies', () => {
    const html = render('sun', 'solar-system');
    expect(current(html)).toBe('Solar System');
    expect(html).toMatch(/aria-haspopup="listbox"[^>]*aria-current="location"[^>]*>Solar System/);
    expect(html).not.toContain('>Sun<');
  });

  it('shows crumbs down to the selected tier only', () => {
    expect(crumbShown(6, null)).toBe(true);
    expect(crumbShown(4, 'milky-way')).toBe(true);
    expect(crumbShown(5, 'milky-way')).toBe(false);
    expect(crumbShown(0, 'observable-universe')).toBe(true);
    expect(crumbShown(1, 'observable-universe')).toBe(false);
  });
});
