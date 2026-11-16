import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import { registerRegion, regionDefinition, regionOf, type Region } from './regions.ts';
import { normalize, scale, type StateVector, type Vec3 } from './vec3.ts';

/**
 * Earth's surroundings, as the standard empirical models draw them for quiet, typical conditions.
 * Every one is a model; none is a surface anyone has seen. Each moves -- the magnetopause by
 * several Earth radii in a storm -- and is drawn at its nominal place.
 *
 *  - **Magnetopause**, where Earth's field stops the solar wind: Shue et al. 1998 (JGR 103,
 *    17691), r = r0 (2 / (1 + cos theta))^alpha about the Sun-Earth line, with
 *    r0 = (10.22 + 1.29 tanh(0.184 (Bz + 8.14))) Dp^(-1/6.6) and
 *    alpha = (0.58 - 0.007 Bz)(1 + 0.024 ln Dp), at the solar wind's typical Dp = 2 nPa and a
 *    northward-neutral Bz = 0: r0 10.25 Earth radii, alpha 0.590.
 *  - **Bow shock**, where the solar wind first slows: Farris et al. 1991 (GRL 18, 1821), the
 *    paraboloid fitted to ISEE 1's 351 crossings, X = a - b (Y^2 + Z^2) along the Sun-Earth line,
 *    a = 13.7 Earth radii at the nose, b = 0.0223 per Earth radius.
 *  - **Van Allen belts**: the trapped particles' two zones as dipole field-line shells, the inner
 *    from L = 1.2 to 2 and the outer from 3 to 7, the slot between; typical extents, which storms
 *    move (Ganushkina et al. 2011, JGR 116, A09234, for the slot at 2 < L < 3). About the dipole
 *    axis of IGRF-13, its northern pole at 80.65 N, 72.68 W in 2020 (Alken et al. 2021, Earth
 *    Planets Space 73, 49); the dipole's 500 km offset from Earth's centre left out.
 *  - **Kármán line**, 100 km up: a convention (the FAI's), not a boundary in the air.
 *
 * The magnetopause and bow shock are drawn along the Sun-Earth line; the solar wind's 4 degree
 * aberration from Earth's orbital motion is left out.
 */

/** Earth's mean radius, km: the unit the models are written in (IUGG). */
export const EARTH_RADIUS_KM = 6371.0;

/** The typical solar wind the models are evaluated at. */
export const NOMINAL_DYNAMIC_PRESSURE_NPA = 2;
export const NOMINAL_BZ_NT = 0;

export function shueStandoff(dynamicPressureNpa: number, bzNt: number): number {
  return (10.22 + 1.29 * Math.tanh(0.184 * (bzNt + 8.14))) * dynamicPressureNpa ** (-1 / 6.6);
}

export function shueFlaring(dynamicPressureNpa: number, bzNt: number): number {
  return (0.58 - 0.007 * bzNt) * (1 + 0.024 * Math.log(dynamicPressureNpa));
}

/** The magnetopause's distance at theta from the subsolar point, Earth radii. */
export function magnetopauseRadius(theta: number, r0: number, alpha: number): number {
  return r0 * (2 / (1 + Math.cos(theta))) ** alpha;
}

export const MAGNETOPAUSE_R0 = shueStandoff(NOMINAL_DYNAMIC_PRESSURE_NPA, NOMINAL_BZ_NT);
export const MAGNETOPAUSE_ALPHA = shueFlaring(NOMINAL_DYNAMIC_PRESSURE_NPA, NOMINAL_BZ_NT);

export const BOW_SHOCK_NOSE = 13.7;
export const BOW_SHOCK_FLARE = 0.0223;

/**
 * The bow shock's distance at theta from the subsolar point, Earth radii: the root of
 * r cos(theta) = a - b r^2 sin^2(theta), written so it holds at the nose too.
 */
export function bowShockRadius(theta: number): number {
  const c = Math.cos(theta);
  const s2 = Math.sin(theta) ** 2;
  return (2 * BOW_SHOCK_NOSE) / (c + Math.sqrt(c * c + 4 * BOW_SHOCK_NOSE * BOW_SHOCK_FLARE * s2));
}

/** How far round from the subsolar point each is drawn, degrees: the fits hold on the day side and flanks. */
export const MAGNETOPAUSE_DRAWN_TO_DEG = 150;
export const BOW_SHOCK_DRAWN_TO_DEG = 125;

/** The belts' L-shell ranges, Earth radii at the magnetic equator. */
export const INNER_BELT_L: readonly [number, number] = [1.2, 2];
export const OUTER_BELT_L: readonly [number, number] = [3, 7];

/** A dipole field line's distance at magnetic latitude lambda: r = L cos^2 lambda. */
export function fieldLineRadius(l: number, lambda: number): number {
  return l * Math.cos(lambda) ** 2;
}

/** Where a field line of shell L meets the ground (r = 1): its magnetic latitude, radians. */
export function footLatitude(l: number): number {
  return Math.acos(Math.sqrt(1 / l));
}

/** IGRF-13's dipole pole in 2020, geographic: Alken et al. 2021, Earth Planets Space 73, 49. */
export const DIPOLE_POLE_LATITUDE_DEG = 80.65;
export const DIPOLE_POLE_LONGITUDE_DEG = -72.68;

export const KARMAN_LINE_KM = 100;

export const MAGNETOPAUSE_ID: BodyId = 'magnetopause';
export const BOW_SHOCK_ID: BodyId = 'bow-shock';

const MAGNETOPAUSE_COLOR = '#88b8e8';
const BOW_SHOCK_COLOR = '#c8b090';

const REGIONS: readonly Region[] = [
  {
    id: MAGNETOPAUSE_ID,
    name: 'Magnetopause',
    layer: 'magnetosphere',
    kindLabel: 'Boundary · modelled',
    measured: false,
    facts: [
      { label: 'What', value: 'Where Earth’s magnetic field holds off the solar wind' },
      { label: 'Nose', value: `${MAGNETOPAUSE_R0.toFixed(2)} Earth radii toward the Sun` },
      { label: 'Model', value: `Shue et al. 1998: 2 nPa, Bz 0; flaring ${MAGNETOPAUSE_ALPHA.toFixed(3)}` },
      { label: 'Moves', value: 'In to about 6 Earth radii in a strong storm' },
    ],
    framingKm: 60 * EARTH_RADIUS_KM,
    parent: 'earth',
    color: MAGNETOPAUSE_COLOR,
  },
  {
    id: BOW_SHOCK_ID,
    name: 'Bow shock',
    layer: 'magnetosphere',
    kindLabel: 'Boundary · modelled',
    measured: false,
    facts: [
      { label: 'What', value: 'Where the solar wind first slows, ahead of the magnetopause' },
      { label: 'Nose', value: `${bowShockRadius(0).toFixed(1)} Earth radii toward the Sun` },
      { label: 'Model', value: 'Farris et al. 1991: paraboloid fitted to 351 ISEE 1 crossings' },
    ],
    framingKm: 80 * EARTH_RADIUS_KM,
    parent: 'earth',
    color: BOW_SHOCK_COLOR,
  },
];

/** The magnetopause's and bow shock's noses made bodies, about Earth, toward the Sun at each instant. */
export function ensureMagnetosphereBodies(store: EphemerisStore): void {
  if (!store.tree.has('earth') || !store.tree.has('sun')) return;
  const missing = REGIONS.filter((region) => !store.isPropagatedBody(region.id));
  if (missing.length === 0) return;
  const noseKm: Record<string, number> = {
    [MAGNETOPAUSE_ID]: MAGNETOPAUSE_R0 * EARTH_RADIUS_KM,
    [BOW_SHOCK_ID]: bowShockRadius(0) * EARTH_RADIUS_KM,
  };
  for (const region of missing) registerRegion(region);
  store.addPropagatedBodies(
    missing.map((region) => ({
      body: regionDefinition(regionOf(region.id)!),
      elements: null,
      state: (jd: number): StateVector | null => {
        const sun = store.stateRelativeTo('sun', 'earth', jd);
        if (sun === null) return null;
        const toward: Vec3 = normalize(sun.position);
        return { position: scale(toward, noseKm[region.id]!), velocity: { x: 0, y: 0, z: 0 } };
      },
      options: { aboutParent: true, exact: true },
    })),
  );
}
