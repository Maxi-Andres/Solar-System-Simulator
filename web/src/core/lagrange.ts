import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import { registerRegion, regionDefinition, regionOf, type Region } from './regions.ts';
import { add, addStates, cross, dot, normalize, scale, subtractStates, type StateVector, type Vec3 } from './vec3.ts';

/**
 * The Lagrange points of the Sun and Earth, and of Earth and the Moon: computed, not seen.
 *
 * Each is where a third, massless body would keep its place against the two that pull it, in the
 * circular restricted three-body problem: the two primaries on circles about their barycentre, the
 * third co-rotating with them. L1, L2 and L3 lie on the line through both, where gravity and the
 * frame's centrifugal pull cancel -- the real roots of
 *
 *     x - (1 - mu) (x + mu) / |x + mu|^3 - mu (x - 1 + mu) / |x - 1 + mu|^3 = 0,
 *
 * x along that line from the barycentre in units of the primaries' separation, the larger at -mu
 * and the smaller at 1 - mu, mu = m2 / (m1 + m2). L4 and L5 are the third corners of the two
 * equilateral triangles on that separation, 60 degrees ahead of the smaller primary and behind.
 *
 * **Placed at each instant** on the real, instantaneous geometry: the separation is the ephemeris
 * distance at that moment, not a mean, and the plane is the one the two move in then (their
 * relative position and velocity), so the points breathe with the Moon's 5% eccentricity and tilt
 * with its orbit. The problem itself is the idealisation, and the panel says so: the real orbits
 * are not circles and the other planets pull too, so a craft "at" L1 flies a halo orbit hundreds
 * of thousands of kilometres about it and corrects it every few months.
 *
 * **The masses** are the catalogue's, JPL's: the Sun's, Earth's and the Moon's GM. The Sun-Earth
 * points take Earth and the Moon together, at their barycentre, as every mission design does --
 * the Moon's pull is what makes "the Earth" there.
 */

/** The ids, and their order in the list: the Sun-Earth five, then Earth-Moon's. */
export const LAGRANGE_SYSTEMS = ['sun-earth', 'earth-moon'] as const;
export type LagrangeSystem = (typeof LAGRANGE_SYSTEMS)[number];
export type LagrangeIndex = 1 | 2 | 3 | 4 | 5;

export function lagrangeBodyId(system: LagrangeSystem, index: LagrangeIndex): BodyId {
  return `${system}-l${index}`;
}

/** f(x) above. */
function collinearBalance(x: number, mu: number): number {
  const a = x + mu;
  const b = x - 1 + mu;
  return x - ((1 - mu) * a) / Math.abs(a) ** 3 - (mu * b) / Math.abs(b) ** 3;
}

function bisect(lo: number, hi: number, mu: number): number {
  let flo = collinearBalance(lo, mu);
  for (let step = 0; step < 200; step += 1) {
    const mid = 0.5 * (lo + hi);
    const fmid = collinearBalance(mid, mu);
    if (fmid === 0 || hi - lo < 1e-15) return mid;
    if (Math.sign(fmid) === Math.sign(flo)) {
      lo = mid;
      flo = fmid;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}

/**
 * L1, L2 and L3 as x above: each bracketed between the poles of f, where it changes sign, and
 * found by bisection to the last bit -- no series in mu, which for the Sun and Earth would be
 * exact enough and for Earth and the Moon (mu 0.0122) off by tens of kilometres.
 */
export function collinearPoints(mu: number): { readonly l1: number; readonly l2: number; readonly l3: number } {
  const eps = 1e-12;
  return {
    l1: bisect(-mu + eps, 1 - mu - eps, mu),
    l2: bisect(1 - mu + eps, 2, mu),
    l3: bisect(-2, -mu - eps, mu),
  };
}

const collinearCache = new Map<number, ReturnType<typeof collinearPoints>>();
function collinearFor(mu: number): ReturnType<typeof collinearPoints> {
  let known = collinearCache.get(mu);
  if (known === undefined) {
    known = collinearPoints(mu);
    collinearCache.set(mu, known);
  }
  return known;
}

/** Rotates v about the unit axis k by angle (Rodrigues). */
function rotate(v: Vec3, k: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/**
 * A Lagrange point's state about the larger primary, km and km/s, from the smaller's state about
 * it and mu. On the line, x + mu of the separation from the larger; L4 and L5 the separation
 * turned 60 degrees forward and back about the pair's orbit normal. The velocity is the
 * secondary's, scaled or turned the same way: the frame the points are fixed in rotates with it.
 */
export function lagrangeState(secondary: StateVector, mu: number, index: LagrangeIndex): StateVector {
  if (index === 4 || index === 5) {
    const normal = normalize(cross(secondary.position, secondary.velocity));
    const angle = ((index === 4 ? 60 : -60) * Math.PI) / 180;
    return { position: rotate(secondary.position, normal, angle), velocity: rotate(secondary.velocity, normal, angle) };
  }
  const points = collinearFor(mu);
  const x = index === 1 ? points.l1 : index === 2 ? points.l2 : points.l3;
  const k = x + mu;
  return { position: scale(secondary.position, k), velocity: scale(secondary.velocity, k) };
}

/** mu for a pair of GMs: the smaller's share. */
export function massRatio(gmLarger: number, gmSmaller: number): number {
  return gmSmaller / (gmLarger + gmSmaller);
}

/** Where each point's distance from its nearer primary lands, as the panel and the About put it. */
export function collinearDistanceFraction(mu: number, index: 1 | 2 | 3): number {
  const points = collinearFor(mu);
  const x = index === 1 ? points.l1 : index === 2 ? points.l2 : points.l3;
  // From the smaller primary for L1 and L2, from the larger for L3.
  return index === 3 ? Math.abs(x + mu) : Math.abs(x - (1 - mu));
}

const COLOR = '#a8c4b0';

interface PointSpec {
  readonly system: LagrangeSystem;
  readonly index: LagrangeIndex;
  readonly there: string;
  readonly framingKm: number;
}

/**
 * What is there, as of November 2026. The craft named are the app's own bodies at the Sun-Earth
 * points; the rest is said as what it is.
 */
const POINTS: readonly PointSpec[] = [
  { system: 'sun-earth', index: 1, there: 'SOHO, ACE, Wind, DSCOVR, Aditya-L1, IMAP: halo and Lissajous orbits about it', framingKm: 4e6 },
  { system: 'sun-earth', index: 2, there: 'JWST, Euclid; Roman on its way. Gaia was, until 2025', framingKm: 4e6 },
  { system: 'sun-earth', index: 3, there: 'Nothing known: always behind the Sun from Earth', framingKm: 1.5e8 },
  { system: 'sun-earth', index: 4, there: 'Earth trojans 2010 TK7 and 2020 XL5 librate about it (Asteroids layer)', framingKm: 6e7 },
  { system: 'sun-earth', index: 5, there: 'No Earth trojan known yet', framingKm: 6e7 },
  { system: 'earth-moon', index: 1, there: 'Nothing stationed; craft have passed', framingKm: 6e5 },
  { system: 'earth-moon', index: 2, there: 'Queqiao, China’s far-side relay, in a halo orbit about it from 2018', framingKm: 6e5 },
  { system: 'earth-moon', index: 3, there: 'Nothing', framingKm: 1.2e6 },
  { system: 'earth-moon', index: 4, there: 'The Kordylewski dust cloud, reported and disputed', framingKm: 1.2e6 },
  { system: 'earth-moon', index: 5, there: 'The Kordylewski dust cloud, reported and disputed', framingKm: 1.2e6 },
];

/** The Sun-Earth L1, L2 and Earth-Moon points move with Earth; Sun-Earth L3 to L5 go round the Sun. */
function parentOf(spec: PointSpec): BodyId | null {
  return spec.system === 'earth-moon' || spec.index <= 2 ? 'earth' : null;
}

function regionFor(spec: PointSpec, muSunEarth: number, muEarthMoon: number): Region {
  const mu = spec.system === 'sun-earth' ? muSunEarth : muEarthMoon;
  const pair = spec.system === 'sun-earth' ? 'Sun–Earth' : 'Earth–Moon';
  const separation = spec.system === 'sun-earth' ? 'the Sun–Earth distance' : 'the Earth–Moon distance';
  const where =
    spec.index === 4 || spec.index === 5
      ? `60° ${spec.index === 4 ? 'ahead of' : 'behind'} ${spec.system === 'sun-earth' ? 'Earth' : 'the Moon'}, on its orbit`
      : spec.index === 3
        ? `opposite ${spec.system === 'sun-earth' ? 'Earth, beyond the Sun' : 'the Moon, beyond Earth'}, ${collinearDistanceFraction(mu, 3).toFixed(4)} of ${separation} out`
        : `${collinearDistanceFraction(mu, spec.index).toFixed(spec.system === 'sun-earth' ? 5 : 4)} of ${separation} ${spec.index === 1 ? 'inside' : 'beyond'} ${spec.system === 'sun-earth' ? 'Earth' : 'the Moon'}`;
  return {
    id: lagrangeBodyId(spec.system, spec.index),
    name: `${pair} L${spec.index}`,
    layer: 'lagrange-point',
    kindLabel: 'Lagrange point · computed',
    measured: false,
    facts: [
      { label: 'Where', value: where },
      { label: 'There', value: spec.there },
      { label: 'Model', value: 'Circular restricted three-body problem, on the instantaneous orbit' },
      { label: 'Mass ratio', value: `μ = ${mu.toPrecision(5)}${spec.system === 'sun-earth' ? ' (Earth and Moon together)' : ''}` },
      { label: 'Masses', value: 'GM of the Sun, Earth and Moon: JPL DE440' },
      {
        label: 'Note',
        value:
          spec.index <= 3
            ? 'Unstable: a craft there orbits it and corrects its path every few weeks to months.'
            : spec.system === 'sun-earth'
              ? 'Stable: things that drift in can stay for millennia.'
              : 'Stable in the problem; the Sun’s pull makes the real points less so.',
      },
    ],
    framingKm: spec.framingKm,
    parent: parentOf(spec),
    color: COLOR,
  };
}

function gmOf(store: EphemerisStore, id: BodyId): number {
  const body = store.body(id);
  return body.gmBodyOnlyKm3S2 > 0 ? body.gmBodyOnlyKm3S2 : body.gmKm3S2;
}

function negate(state: StateVector): StateVector {
  return { position: scale(state.position, -1), velocity: scale(state.velocity, -1) };
}

/**
 * The ten points made bodies (App.tsx), each placed at every instant from the Sun's, Earth's and
 * the Moon's states. Absent at an instant one of those is not known.
 */
export function ensureLagrangePoints(store: EphemerisStore): void {
  if (!store.tree.has('earth') || !store.tree.has('moon') || !store.tree.has('sun')) return;
  const missing = POINTS.filter((spec) => regionOf(lagrangeBodyId(spec.system, spec.index)) === null || !store.isPropagatedBody(lagrangeBodyId(spec.system, spec.index)));
  if (missing.length === 0) return;
  const gmSun = gmOf(store, 'sun');
  const gmEarth = gmOf(store, 'earth');
  const gmMoon = gmOf(store, 'moon');
  const muSunEarth = massRatio(gmSun, gmEarth + gmMoon);
  const muEarthMoon = massRatio(gmEarth, gmMoon);

  const moonAboutEarth = (jd: number): StateVector | null => store.stateRelativeTo('moon', 'earth', jd);
  const earthAboutSun = (jd: number): StateVector | null => {
    const sun = store.sunFromFocus('earth', jd);
    return sun === null ? null : negate(sun);
  };
  // The Earth-Moon barycentre about Earth: the Moon's share of their separation.
  const barycentreAboutEarth = (moon: StateVector): StateVector => ({
    position: scale(moon.position, muEarthMoon),
    velocity: scale(moon.velocity, muEarthMoon),
  });

  const stateFor = (spec: PointSpec) => (jd: number): StateVector | null => {
    const moon = moonAboutEarth(jd);
    if (moon === null) return null;
    if (spec.system === 'earth-moon') return lagrangeState(moon, muEarthMoon, spec.index);
    const earth = earthAboutSun(jd);
    if (earth === null) return null;
    const barycentre = addStates(earth, barycentreAboutEarth(moon));
    const aboutSun = lagrangeState(barycentre, muSunEarth, spec.index);
    return parentOf(spec) === 'earth' ? subtractStates(aboutSun, earth) : aboutSun;
  };

  for (const spec of missing) registerRegion(regionFor(spec, muSunEarth, muEarthMoon));
  store.addPropagatedBodies(
    missing.map((spec) => ({
      body: regionDefinition(regionOf(lagrangeBodyId(spec.system, spec.index))!),
      elements: null,
      state: stateFor(spec),
      options: parentOf(spec) === 'earth' ? { aboutParent: true, exact: true } : { exact: true },
    })),
  );
}
