import { describe, expect, it, vi } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import type { BodyDefinition } from '@sss/tools/types';

import { ALPHA_CEN_A_PLANETS } from './alphaCenAPlanets.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import { FICTION, FICTION_COLOR, FORTY_ERI_A, fictionBodyId, fictionRecord, realAnchorOf, type FictionRecord } from './fiction.ts';
import { fictionOrbit, placeFiction, resolveAnchor, whenPlaced } from './fictionBodies.ts';
import { allPlanetarySystems, exoPlanetOf, planetarySystemOf } from './planetarySystems.ts';
import { J2000_JD } from './time.ts';
import { length, type Vec3 } from './vec3.ts';

/** A stand-in for Alpha Centauri A's body: its star facts come from the 3D stars, not here. */
const STAR_A = 'star-test-a';
/** Where the stand-in star is: Alpha Centauri's direction is not what is tested. */
const TOWARD_A: Vec3 = { x: -0.48, y: -0.6, z: -0.64 };
/** A stand-in for 40 Eridani A, a catalogue star carrying its Hipparcos number. */
const STAR_40 = 'star-test-40';
const TOWARD_40: Vec3 = { x: 0.6, y: 0.64, z: -0.48 };
const GM_SUN = 1.3271244e11;

vi.mock('./alphaCenBodies.ts', async (original) => ({
  ...(await original<typeof import('./alphaCenBodies.ts')>()),
  alphaCenMember: (id: string) => (id === STAR_A ? 'A' : null),
}));
vi.mock('./planetarySystems.ts', async (original) => ({
  ...(await original<typeof import('./planetarySystems.ts')>()),
  towardStar: (id: string) => (id === STAR_A ? TOWARD_A : id === STAR_40 ? TOWARD_40 : null),
}));
vi.mock('./starBodies.ts', async (original) => ({
  ...(await original<typeof import('./starBodies.ts')>()),
  starBodyFacts: (id: string) => (id === STAR_40 ? { designations: ['HD 26965', FORTY_ERI_A] } : null),
}));

/** The worlds about Alpha Centauri A, which the stand-in A places; Erid and Vulcan wait for 40 Eri A. */
const AT_ALPHA_CEN = FICTION.filter((record) => realAnchorOf(record)?.kind === 'alphaCen');
const AT_40_ERI = FICTION.filter((record) => realAnchorOf(record)?.kind === 'star');

function add40EriA(s: EphemerisStore): void {
  const star: BodyDefinition = { ...getBody('sun'), id: STAR_40, name: '40 Eri A (Keid)', gmKm3S2: 0.78 * GM_SUN, gmBodyOnlyKm3S2: 0.78 * GM_SUN };
  const at = 16.3 * LIGHT_YEAR_KM;
  s.addPropagatedBody(star, null, () => ({
    position: { x: TOWARD_40.x * at, y: TOWARD_40.y * at, z: TOWARD_40.z * at },
    velocity: { x: 0, y: 0, z: 0 },
  }), { exact: true });
}

const AU_KM = 149_597_870.7;
const LIGHT_YEAR_KM = 9.4607304725808e12;

function store(withStar: boolean): EphemerisStore {
  const s = new EphemerisStore({
    manifest: { bodies: [], tables: {} },
    bodies: ['sun'].map((id) => getBody(id)),
    vectors: new Map(),
    elements: new Map(),
    generatedAt: new Date(0),
  } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
  if (withStar) addStar(s);
  return s;
}

function addStar(s: EphemerisStore): void {
  const star: BodyDefinition = { ...getBody('sun'), id: STAR_A, name: 'Rigil Kentaurus', gmKm3S2: 1.1055 * GM_SUN, gmBodyOnlyKm3S2: 1.1055 * GM_SUN };
  const at = 4.37 * LIGHT_YEAR_KM;
  s.addPropagatedBody(star, null, () => ({
    position: { x: TOWARD_A.x * at, y: TOWARD_A.y * at, z: TOWARD_A.z * at },
    velocity: { x: 0, y: 0, z: 0 },
  }), { exact: true });
}

describe('placing fiction', () => {
  it('makes Polyphemus a planet of Alpha Centauri A and Pandora its moon, in fiction’s colour', () => {
    const s = store(true);
    const added = placeFiction(s);
    expect(added).toHaveLength(AT_ALPHA_CEN.length);
    expect(added.slice(0, 2)).toEqual([fictionBodyId('polyphemus'), fictionBodyId('polyphemus-1')]);
    const polyphemus = s.body(fictionBodyId('polyphemus'));
    const pandora = s.body(fictionBodyId('pandora'));
    expect(polyphemus.parent).toBe(STAR_A);
    expect(polyphemus.kind).toBe('planet');
    expect(pandora.parent).toBe(fictionBodyId('polyphemus'));
    expect(pandora.kind).toBe('moon');
    expect(pandora.color).toBe(FICTION_COLOR);
    expect(pandora.radiusEquatorialKm).toBe(5723.5);
  });

  it('places a moon after its planet whatever the order of the records', () => {
    const s = store(true);
    const reversed = [...FICTION].reverse();
    const added = placeFiction(s, reversed);
    expect(added).toHaveLength(AT_ALPHA_CEN.length);
    // Polyphemus first: everything else hangs from it.
    expect(added[0]).toBe(fictionBodyId('polyphemus'));
  });

  it('places nothing until its anchor is a body, and then all of it, once', async () => {
    const s = store(false);
    expect(placeFiction(s)).toEqual([]);
    expect(resolveAnchor(s, { kind: 'alphaCen', member: 'A' })).toBeNull();
    const placed = whenPlaced(s, fictionBodyId('pandora'));
    addStar(s);
    expect(placeFiction(s)).toHaveLength(AT_ALPHA_CEN.length);
    await expect(placed).resolves.toBe(fictionBodyId('pandora'));
    expect(placeFiction(s)).toEqual([]);
  });

  it('puts Erid and Vulcan about 40 Eridani A once that star is a body, Erid at its period’s distance', () => {
    const s = store(true);
    placeFiction(s);
    expect(resolveAnchor(s, { kind: 'star', designation: FORTY_ERI_A })).toBeNull();
    add40EriA(s);
    expect(resolveAnchor(s, { kind: 'star', designation: FORTY_ERI_A })).toBe(STAR_40);
    expect(placeFiction(s).sort()).toEqual(AT_40_ERI.map((record) => fictionBodyId(record.id)).sort());
    const erid = s.body(fictionBodyId('erid'));
    expect(erid.parent).toBe(STAR_40);
    expect(erid.radiusEquatorialKm).toBe(12_835);
    // The canon's 42.245 days about the measured 0.78 Suns: 0.219 AU, not the document's 0.224.
    const orbit = fictionOrbit(fictionRecord('erid')!, 0.78 * GM_SUN);
    expect(orbit.periodDays).toBe(42.245);
    expect(orbit.semiMajorAxisAu).toBeCloseTo(0.2186, 3);
    const state = s.localState(fictionBodyId('erid'), J2000_JD)!;
    // At periastron: a (1 - e).
    expect(length(state.position) / AU_KM).toBeCloseTo(orbit.semiMajorAxisAu * 0.96, 4);
    // Vulcan from Kepler's law about the same mass: about 202 days at 0.62 AU.
    expect(fictionOrbit(fictionRecord('vulcan')!, 0.78 * GM_SUN).periodDays).toBeCloseTo(202, 0);
  });

  it('keeps each world at its orbit’s distance from its parent, a state about it the frame tree carries', () => {
    const s = store(true);
    placeFiction(s);
    for (const jd of [J2000_JD, J2000_JD + 9_000.3]) {
      const planet = s.localState(fictionBodyId('polyphemus'), jd)!;
      const moon = s.localState(fictionBodyId('pandora'), jd)!;
      // Circular stand-ins: exactly their radii, and not flagged approximate.
      expect(length(planet.position) / AU_KM).toBeCloseTo(1.23, 6);
      expect(length(moon.position)).toBeCloseTo(270_000, 0);
      expect(moon.approximate).toBe(false);
    }
  });

  it('puts the Trojans on Polyphemus’ orbit about A, 60 degrees ahead and behind, as it moves', () => {
    const s = store(true);
    placeFiction(s);
    for (const jd of [J2000_JD, J2000_JD + 3_210.7]) {
      const planet = s.localState(fictionBodyId('polyphemus'), jd)!.position;
      for (const [point, sign] of [[4, 1], [5, -1]] as const) {
        const trojan = s.localState(fictionBodyId(`poly-l${point}`), jd)!.position;
        expect(s.body(fictionBodyId(`poly-l${point}`)).parent).toBe(STAR_A);
        expect(length(trojan)).toBeCloseTo(length(planet), 0);
        const cos = (planet.x * trojan.x + planet.y * trojan.y + planet.z * trojan.z) / (length(planet) * length(trojan));
        expect((Math.acos(cos) * 180) / Math.PI).toBeCloseTo(60, 6);
        // Ahead for L4: along the planet's motion.
        const v = s.localState(fictionBodyId('polyphemus'), jd)!.velocity;
        expect(Math.sign(v.x * trojan.x + v.y * trojan.y + v.z * trojan.z)).toBe(sign);
      }
    }
  });

  it('spreads the moons round their orbits: not lined up at J2000', () => {
    const s = store(true);
    placeFiction(s);
    const directions = ['polyphemus-1', 'polyphemus-6', 'polyphemus-10'].map((id) => {
      const p = s.localState(fictionBodyId(id), J2000_JD)!.position;
      return { x: p.x / length(p), y: p.y / length(p), z: p.z / length(p) };
    });
    const [u, v] = directions;
    expect(Math.abs(u!.x * v!.x + u!.y * v!.y + u!.z * v!.z)).toBeLessThan(0.99);
  });

  it('takes the period from Kepler’s third law where the canon gives none', () => {
    const record = fictionRecord('polyphemus')!;
    const orbit = fictionOrbit(record, 1.1055 * GM_SUN);
    // 1.23 AU about 1.1 Suns: sqrt(1.23^3 / 1.106) years.
    expect(orbit.periodDays / 365.25).toBeCloseTo(Math.sqrt(1.23 ** 3 / (1.1055 + 17.15 / 332_946)), 3);
    // Pandora about Polyphemus, a Neptune's mass at 270,000 km: four days or so.
    const pandora = fictionOrbit(fictionRecord('pandora')!, 17.15 * 398_600.4);
    expect(pandora.periodDays).toBeCloseTo((2 * Math.PI * Math.sqrt(270_000 ** 3 / ((17.15 + 0.72) * 398_600.4))) / 86_400, 6);
    expect(pandora.periodDays).toBeGreaterThan(3.5);
    expect(pandora.periodDays).toBeLessThan(4.5);
  });

  it('gives a thing whose canon gives no place an invented orbit, the same every time', () => {
    // Invented where its record gives no distance; one it gives (Star Wars' worlds) is kept.
    const polyphemus = fictionRecord('polyphemus')!;
    const lost: FictionRecord = {
      ...polyphemus,
      id: 'lost-world',
      position: 'invented',
      orbit: { ...polyphemus.orbit, semiMajorAxisKm: { silent: true } },
    };
    expect(fictionOrbit({ ...polyphemus, position: 'invented' }, GM_SUN).semiMajorAxisAu).toBeCloseTo(1.23, 6);
    const a = fictionOrbit(lost, GM_SUN);
    expect(fictionOrbit(lost, GM_SUN)).toEqual(a);
    expect(a.semiMajorAxisAu).not.toBeCloseTo(1.23, 3);
    expect(a.semiMajorAxisAu).toBeGreaterThanOrEqual(0.3);
    expect(a.semiMajorAxisAu).toBeLessThanOrEqual(3);
  });

  it('never enters a real catalogue: no system, no planet list, no planet of a star', () => {
    const s = store(true);
    placeFiction(s);
    for (const record of FICTION) {
      const id = fictionBodyId(record.id);
      expect(exoPlanetOf(id), id).toBeNull();
      expect(planetarySystemOf(id), id).toBeNull();
      expect(ALPHA_CEN_A_PLANETS.some((planet) => planet.id === id), id).toBe(false);
      expect(allPlanetarySystems().some((system) => system.planets.some((planet) => planet.id === id)), id).toBe(false);
    }
  });
});
