import type { BodyDefinition, Manifest, OsculatingElements, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { labelRank } from '../scene/LabelProjector.tsx';
import { rebaseVisibleFrame } from '../scene/satellites.ts';
import { craftGroup, craftUnavailability } from '../ui/BodyPicker.tsx';
import { EphemerisStore } from './ephemerisStore.ts';

/**
 * How the app treats a body that exists only for part of the window.
 *
 * Synthetic data, so it runs before `pnpm fetch:data`: a Sun and a planet with twenty
 * years of vectors and elements to fall back on, a craft heliocentric for two of those
 * years, and one hung off the planet like JWST is off Earth.
 */

const START = 2_460_000.5;
const STOP = START + 7300;
const LAUNCH = START + 1000;
const END = START + 1730;

function body(id: string, kind: BodyDefinition['kind'], parent: string | null): BodyDefinition {
  const craft = kind === 'spacecraft';
  return {
    id,
    name: id,
    horizonsId: id,
    stepDays: 1,
    vectorWindow: craft ? 'mission' : 'full',
    center: '500@0',
    elementsCenter: '500@10',
    parent,
    kind,
    radiusEquatorialKm: craft ? 0.01 : 6000,
    radiusPolarKm: craft ? 0.01 : 6000,
    triaxialRadiiKm: null,
    gmKm3S2: craft ? 0 : 1,
    gmBodyOnlyKm3S2: craft ? 0 : 1,
    rotationPeriodHours: craft ? null : 24,
    axialTiltDeg: null,
    rotation: null,
    color: '#ffffff',
    drawOrbit: !craft && id !== 'sun',
    textures: null,
    rings: null,
    mission: craft
      ? {
          launchUtc: '2025-01-01T00:00:00Z',
          operator: 'Test',
          endUtc: null,
          shape: {
            model: null,
            metresPerUnit: 1,
            boxM: [10, 5, 2],
            pointsAt: 'sun',
            pointingPart: 'solar-arrays',
            pointingAxis: [0, 0, 1],
            rollAxis: [0, 1, 0],
          },
        }
      : null,
  };
}

/** A body at rest at `x` km, sampled once a day across [from, to]. */
function table(id: string, x: number, from: number, to: number): VectorTable {
  const t: number[] = [];
  for (let jd = from; jd <= to; jd += 1) {
    t.push(jd);
  }
  const constant = (value: number) => t.map(() => value);
  return {
    id,
    horizonsId: id,
    center: '500@0',
    count: t.length,
    t,
    x: constant(x),
    y: constant(0),
    z: constant(0),
    vx: constant(0),
    vy: constant(0),
    vz: constant(0),
  };
}

const PLANET_ELEMENTS: OsculatingElements = {
  id: 'planet',
  center: '500@10',
  epochJd: START,
  eccentricity: 0,
  periapsisKm: 1.5e8,
  inclinationDeg: 0,
  ascendingNodeDeg: 0,
  argPeriapsisDeg: 0,
  periapsisTimeJd: START,
  meanMotionDegPerSec: 360 / (365.25 * 86_400),
  meanAnomalyDeg: 0,
  trueAnomalyDeg: 0,
  semiMajorAxisKm: 1.5e8,
  apoapsisKm: 1.5e8,
  periodSec: 365.25 * 86_400,
};

function makeStore(): EphemerisStore {
  const bodies = [
    body('sun', 'star', null),
    body('planet', 'planet', null),
    body('probe', 'spacecraft', null),
    body('scope', 'spacecraft', 'planet'),
  ];
  const vectors = new Map<string, VectorTable>([
    ['sun', table('sun', 0, START, STOP)],
    ['planet', table('planet', 1.5e8, START, STOP)],
    ['probe', table('probe', 7e7, LAUNCH, END)],
    // 1.5 million km out, as JWST is from Earth.
    ['scope', table('scope', 1.5e6, LAUNCH, END)],
  ]);
  const manifest: Manifest = {
    generatedAt: '2026-09-25T00:00:00Z',
    source: { name: 'test', version: '0', url: '' },
    frame: { center: '500@0', refPlane: 'ECLIPTIC', refSystem: 'ICRF', units: 'KM-S' },
    window: { startJd: START, stopJd: STOP, startUtc: '', stopUtc: '' },
    bodies: bodies.map((entry) => entry.id),
    tables: Object.fromEntries(
      [...vectors].map(([id, entry]) => [
        id,
        { startJd: entry.t[0]!, stopJd: entry.t.at(-1)!, chunks: null },
      ]),
    ),
    paths: {},
  };
  return new EphemerisStore({
    manifest,
    bodies,
    vectors,
    elements: new Map([['planet', PLANET_ELEMENTS]]),
    loadChunk: null,
    loadPath: null,
  });
}

describe('a spacecraft outside its coverage', () => {
  const store = makeStore();

  it('has no state at all, rather than an approximate one', () => {
    expect(store.localState('probe', LAUNCH - 1)).toBeNull();
    expect(store.localState('probe', END + 1)).toBeNull();
    expect(store.localState('probe', (LAUNCH + END) / 2)?.approximate).toBe(false);
  });

  it('does not make the view APPROXIMATE by being absent', () => {
    const everything = store.bodies.map((entry) => entry.id);
    expect(store.isExactAt(LAUNCH - 1, everything)).toBe(true);
    expect(store.isExactAt(END + 1, everything)).toBe(true);
    // A planet past its table still does: it is propagated, and that is approximate.
    expect(store.isExactAt(STOP + 1, everything)).toBe(false);
  });

  it('knows when it exists', () => {
    expect(store.isCoveredAt('probe', LAUNCH - 1)).toBe(false);
    expect(store.isCoveredAt('probe', LAUNCH)).toBe(true);
    expect(store.isCoveredAt('probe', END)).toBe(true);
    expect(store.isCoveredAt('probe', END + 1)).toBe(false);
  });

  it('tells the picker which side of its coverage the clock is on', () => {
    const year = (jd: number) => new Date((jd - 2440587.5) * 86_400_000).getUTCFullYear();
    expect(craftUnavailability(store, 'probe', LAUNCH - 1)).toBe(`from ${year(LAUNCH)}`);
    expect(craftUnavailability(store, 'probe', END + 1)).toBe(`until ${year(END)}`);
    expect(craftUnavailability(store, 'probe', LAUNCH + 1)).toBeNull();
  });
});

describe('a spacecraft hung off a planet', () => {
  const store = makeStore();

  it('is resolved without waiting for an orbit it does not have', () => {
    const everything = new Set(store.bodies.map((entry) => entry.id));
    // Standing at the planet, close enough that 1.5 million km opens up on screen.
    const snapshot = rebaseVisibleFrame(
      store,
      'planet',
      LAUNCH + 10,
      everything,
      { x: 0, y: 0, z: 20_000 },
      1000,
      27,
    );
    expect(snapshot.bodies.get('scope')?.distanceKm).toBeCloseTo(1.5e6, 3);
  });
});

describe('labelRank', () => {
  it('puts natural bodies before moons, and moons before spacecraft', () => {
    expect(labelRank('planet', null)).toBe(0);
    expect(labelRank('star', null)).toBe(0);
    expect(labelRank('moon', 'jupiter')).toBe(1);
    expect(labelRank('spacecraft', null)).toBe(2);
    expect(labelRank('spacecraft', 'earth')).toBe(2);
  });
});

describe('craftGroup', () => {
  const store = makeStore();

  it('lists a craft about the Sun as interplanetary', () => {
    expect(craftGroup(store, store.body('probe'))).toBe('interplanetary');
  });

  it('lists a craft hung off a planet other than Earth with the planets', () => {
    // The fixture's planet is not Earth; JWST, hung off Earth, is near Earth instead.
    expect(craftGroup(store, store.body('scope'))).toBe('planets');
  });

  it('lists Earth’s and the Moon’s craft as near Earth', () => {
    const earthCraft = { ...store.body('scope'), parent: 'earth' };
    const fake = {
      body: (id: string) => (id === 'moon' ? { parent: 'earth' } : { parent: null }),
    } as unknown as EphemerisStore;
    expect(craftGroup(fake, earthCraft)).toBe('near-earth');
    expect(craftGroup(fake, { ...earthCraft, parent: 'moon' })).toBe('near-earth');
  });
});
