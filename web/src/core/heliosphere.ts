import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import { registerRegion, regionDefinition, regionOf, type Region } from './regions.ts';
import { normalize, scale, type StateVector, type Vec3 } from './vec3.ts';

/**
 * The heliosphere's two boundaries, and the Oort cloud beyond them.
 *
 * ## What is measured: four points
 *
 * The termination shock, where the solar wind drops from supersonic to subsonic, and the
 * heliopause, where it meets the interstellar medium, have each been crossed twice -- by the
 * Voyagers, once each. Those four crossings are the whole of what is measured of either surface;
 * each is drawn as a point of its own, where the craft was that day. The positions are JPL
 * Horizons' (heliocentric, ecliptic J2000, AU), asked for each date on 2026-11-16; their
 * distances are the papers' to the tenth:
 *
 *   crossing                      date                 AU      paper
 *   Voyager 1, termination shock  2004-12-16           94.0    Stone et al. 2005, Science 309, 2017
 *   Voyager 2, termination shock  2007-08-30 .. 09-01  83.7    Stone et al. 2008, Nature 454, 71
 *   Voyager 1, heliopause         2012-08-25          121.6    Stone et al. 2013, Science 341, 150
 *   Voyager 2, heliopause         2018-11-05          119.0    Stone et al. 2019, Nat. Astron. 3, 1013
 *
 * ## What is modelled: the surfaces between them
 *
 * Parker's (1961, ApJ 134, 20) picture, the simplest that has both, with its one free size
 * fitted to the crossings:
 *
 *  - **The heliopause** as the surface of a steady source in a uniform flow -- the solar wind
 *    blowing out, the interstellar medium flowing past -- whose dividing surface is
 *    r = a / cos(nu / 2), nu the angle from the nose: a at the nose, the tail a cylinder 2a in
 *    radius. Its axis is the interstellar flow's, measured from the neutral helium IBEX sampled:
 *    the gas arrives from ecliptic longitude 255.7 deg, latitude 5.1 deg (McComas et al. 2015,
 *    ApJS 220, 22). a is the least-squares fit to the two crossings, 111.7 AU; Voyager 1 crossed
 *    6 AU outside the model and Voyager 2 6 AU inside, which is the asymmetry the model leaves
 *    out -- the interstellar magnetic field's push on the south (Opher et al. 2015).
 *  - **The termination shock** as Parker's sphere: with the heliosheath's pressure the same all
 *    round, the solar wind's ram pressure, falling as 1/r^2, meets it at one distance. Its radius
 *    is the crossings' mean, 88.9 AU; they are 5.2 AU either side of it.
 *
 * What the tail is like is not known: a long comet's tail in the classical models, two lobes in
 * Opher et al.'s (2015 ApJL 800, L28; 2020 Nat. Astron. 4, 675), a near sphere in Dialynas et
 * al.'s reading of the energetic neutral atoms (2017, Nat. Astron. 1, 0115). So the heliopause
 * is drawn to 150 deg from the nose and fades from 110, and the About says why.
 *
 * Both boundaries move with the solar cycle by several AU; the crossings were each one instant.
 */

const DEG = Math.PI / 180;
export const AU_KM = 149_597_870.7;

/** The interstellar flow's upwind direction, ecliptic J2000: McComas et al. 2015, ApJS 220, 22. */
export const UPWIND_LONGITUDE_DEG = 255.7;
export const UPWIND_LATITUDE_DEG = 5.1;

export function eclipticDirection(longitudeDeg: number, latitudeDeg: number): Vec3 {
  const l = longitudeDeg * DEG;
  const b = latitudeDeg * DEG;
  return { x: Math.cos(b) * Math.cos(l), y: Math.cos(b) * Math.sin(l), z: Math.sin(b) };
}

/** The heliosphere's nose: where the interstellar gas comes from. */
export const NOSE: Vec3 = eclipticDirection(UPWIND_LONGITUDE_DEG, UPWIND_LATITUDE_DEG);

export type Boundary = 'termination-shock' | 'heliopause';

export interface Crossing {
  readonly craft: 'Voyager 1' | 'Voyager 2';
  readonly boundary: Boundary;
  readonly date: string;
  /** Heliocentric, ecliptic J2000, AU: JPL Horizons, the craft at 00:00 TDB that day. */
  readonly positionAu: Vec3;
  /** The paper's distance, AU. */
  readonly publishedAu: number;
  readonly reference: string;
}

export const CROSSINGS: readonly Crossing[] = [
  {
    craft: 'Voyager 1',
    boundary: 'termination-shock',
    date: '2004-12-16',
    positionAu: { x: -22.60333732579714, y: -73.9120950653824, z: 53.53877925278283 },
    publishedAu: 94.0,
    reference: 'Stone et al. 2005, Science 309, 2017',
  },
  {
    craft: 'Voyager 2',
    boundary: 'termination-shock',
    // Crossed at least five times between 30 August and 1 September, the shock moving past it.
    date: '2007-08-31',
    positionAu: { x: 22.7847279025141, y: -67.51524373003804, z: -43.85126674455844 },
    publishedAu: 83.7,
    reference: 'Stone et al. 2008, Nature 454, 71',
  },
  {
    craft: 'Voyager 1',
    boundary: 'heliopause',
    date: '2012-08-25',
    positionAu: { x: -26.00241375675, y: -96.22264322683775, z: 69.65805007736833 },
    publishedAu: 121.6,
    reference: 'Stone et al. 2013, Science 341, 150',
  },
  {
    craft: 'Voyager 2',
    boundary: 'heliopause',
    date: '2018-11-05',
    positionAu: { x: 32.84406348757506, y: -89.86010721456468, z: -70.79240760844591 },
    publishedAu: 119.0,
    reference: 'Stone et al. 2019, Nat. Astron. 3, 1013',
  },
];

function lengthOf(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** A direction's angle from the nose, radians. */
export function angleFromNose(direction: Vec3): number {
  const u = normalize(direction);
  return Math.acos(Math.max(-1, Math.min(1, u.x * NOSE.x + u.y * NOSE.y + u.z * NOSE.z)));
}

/** Parker's heliopause: its distance at nu from the nose, for a nose distance a. */
export function heliopauseRadius(nu: number, a: number): number {
  return a / Math.cos(nu / 2);
}

/** a fitted to the crossings by least squares in distance: sum (r_i - a / c_i)^2, c_i = cos(nu_i / 2). */
export function fitHeliopauseNose(crossings: readonly Crossing[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const crossing of crossings.filter((c) => c.boundary === 'heliopause')) {
    const c = Math.cos(angleFromNose(crossing.positionAu) / 2);
    numerator += lengthOf(crossing.positionAu) / c;
    denominator += 1 / (c * c);
  }
  return numerator / denominator;
}

/** The termination shock's radius: Parker's sphere, at the crossings' mean distance. */
export function fitTerminationShock(crossings: readonly Crossing[]): number {
  const shock = crossings.filter((c) => c.boundary === 'termination-shock');
  return shock.reduce((sum, c) => sum + lengthOf(c.positionAu), 0) / shock.length;
}

export const HELIOPAUSE_NOSE_AU = fitHeliopauseNose(CROSSINGS);
export const TERMINATION_SHOCK_AU = fitTerminationShock(CROSSINGS);

/** How far round from the nose the heliopause is drawn, and where it starts to fade: the tail is unknown. */
export const HELIOPAUSE_DRAWN_TO_DEG = 150;
export const HELIOPAUSE_FADES_FROM_DEG = 110;

/**
 * The Oort cloud: inferred from the orbits of long-period comets, never seen -- no body in it has
 * been observed there. Oort (1950, BAN 11, 91) placed it from the comets' original semi-major
 * axes; the inner, denser part was proposed by Hills (1981, AJ 86, 1730). The radii are the
 * review's round figures (Dones et al. 2004, "Oort cloud formation and dynamics", in Comets II,
 * 153-174): inner cloud from about 2,000 to 20,000 AU, outer to about 100,000 AU, where the
 * galaxy's tide strips what goes further.
 */
export const HILLS_CLOUD_INNER_AU = 2_000;
export const OORT_CLOUD_INNER_AU = 20_000;
export const OORT_CLOUD_OUTER_AU = 100_000;

/** The regions' ids. */
export const TERMINATION_SHOCK_ID: BodyId = 'termination-shock';
export const HELIOPAUSE_ID: BodyId = 'heliopause';
export const OORT_CLOUD_ID: BodyId = 'oort-cloud';

/** A light year, km (IAU: a Julian year at c). */
const LIGHT_YEAR_KM = 299_792.458 * 365.25 * 86_400;

export function crossingBodyId(crossing: Pick<Crossing, 'craft' | 'boundary'>): BodyId {
  return `${crossing.craft.toLowerCase().replace(' ', '-')}-${crossing.boundary}-crossing`;
}

const SHOCK_COLOR = '#e0a868';
const PAUSE_COLOR = '#8fb4e8';

function crossingRegion(crossing: Crossing): Region {
  const r = lengthOf(crossing.positionAu);
  const nu = angleFromNose(crossing.positionAu);
  const model = crossing.boundary === 'heliopause' ? heliopauseRadius(nu, HELIOPAUSE_NOSE_AU) : TERMINATION_SHOCK_AU;
  const off = r - model;
  return {
    id: crossingBodyId(crossing),
    name: `${crossing.craft} · ${crossing.boundary === 'heliopause' ? 'heliopause' : 'termination shock'}`,
    layer: 'heliosphere',
    kindLabel: 'Crossing · measured',
    measured: true,
    facts: [
      { label: 'Crossed', value: crossing.date },
      { label: 'Distance', value: `${crossing.publishedAu.toFixed(1)} AU from the Sun` },
      { label: 'From the nose', value: `${(nu / DEG).toFixed(1)}°` },
      { label: 'Model there', value: `${model.toFixed(1)} AU, ${Math.abs(off).toFixed(1)} AU ${off > 0 ? 'nearer the Sun' : 'farther out'}` },
      { label: 'Source', value: crossing.reference },
      { label: 'Position', value: `${crossing.craft} that day, JPL Horizons` },
    ],
    framingKm: 60 * AU_KM,
    parent: null,
    color: crossing.boundary === 'heliopause' ? PAUSE_COLOR : SHOCK_COLOR,
  };
}

const BOUNDARY_REGIONS: readonly Region[] = [
  {
    id: TERMINATION_SHOCK_ID,
    name: 'Termination shock',
    layer: 'heliosphere',
    kindLabel: 'Boundary · modelled',
    measured: false,
    facts: [
      { label: 'What', value: 'Where the solar wind slows from supersonic to subsonic' },
      { label: 'Measured', value: 'Two crossings: Voyager 1 at 94.0 AU, Voyager 2 at 83.7 AU' },
      { label: 'Drawn', value: `A sphere of ${TERMINATION_SHOCK_AU.toFixed(1)} AU, their mean (Parker 1961)` },
      { label: 'Not known', value: 'Its shape away from the two crossings; it moves with the solar cycle' },
    ],
    framingKm: 400 * AU_KM,
    parent: null,
    color: SHOCK_COLOR,
  },
  {
    id: HELIOPAUSE_ID,
    name: 'Heliopause',
    layer: 'heliosphere',
    kindLabel: 'Boundary · modelled',
    measured: false,
    facts: [
      { label: 'What', value: 'Where the solar wind meets the interstellar medium' },
      { label: 'Measured', value: 'Two crossings: Voyager 1 at 121.6 AU, Voyager 2 at 119.0 AU' },
      { label: 'Drawn', value: `Parker’s 1961 surface, r = a / cos(ν/2), a = ${HELIOPAUSE_NOSE_AU.toFixed(1)} AU fitted to them` },
      { label: 'Nose', value: `Toward ecliptic ${UPWIND_LONGITUDE_DEG}°, ${UPWIND_LATITUDE_DEG}°: the interstellar flow (IBEX, McComas et al. 2015)` },
      { label: 'Not known', value: 'The tail: long, two-lobed or short, as models disagree; drawn fading' },
    ],
    framingKm: 400 * AU_KM,
    parent: null,
    color: PAUSE_COLOR,
  },
  {
    id: OORT_CLOUD_ID,
    name: 'Oort cloud',
    layer: 'heliosphere',
    kindLabel: 'Region · inferred, never seen',
    measured: false,
    facts: [
      { label: 'What', value: 'The reservoir the long-period comets fall in from' },
      { label: 'Seen', value: 'No object in it: inferred from the comets’ orbits (Oort 1950)' },
      { label: 'Inner (Hills)', value: `About ${HILLS_CLOUD_INNER_AU.toLocaleString('en-US')} to ${OORT_CLOUD_INNER_AU.toLocaleString('en-US')} AU (Hills 1981)` },
      { label: 'Outer', value: `To about ${OORT_CLOUD_OUTER_AU.toLocaleString('en-US')} AU, ${(OORT_CLOUD_OUTER_AU * AU_KM / LIGHT_YEAR_KM).toFixed(1)} light years` },
      { label: 'Radii', value: 'Round figures of the models (Dones et al. 2004)' },
      { label: 'Drawn', value: 'Two shells of even glow: its density is itself a model' },
    ],
    framingKm: 6 * LIGHT_YEAR_KM,
    parent: null,
    color: '#7f8fb0',
    centredOnSun: true,
  },
];

function constantState(positionKm: Vec3): (jd: number) => StateVector {
  const state: StateVector = { position: positionKm, velocity: { x: 0, y: 0, z: 0 } };
  return () => state;
}

/** The two boundaries' noses, the four crossings and the Oort cloud made bodies, about the Sun (App.tsx). */
export function ensureHeliosphereBodies(store: EphemerisStore): void {
  const entries: { region: Region; positionKm: Vec3 }[] = [
    { region: BOUNDARY_REGIONS[0]!, positionKm: scale(NOSE, TERMINATION_SHOCK_AU * AU_KM) },
    { region: BOUNDARY_REGIONS[1]!, positionKm: scale(NOSE, HELIOPAUSE_NOSE_AU * AU_KM) },
    { region: BOUNDARY_REGIONS[2]!, positionKm: { x: 0, y: 0, z: 0 } },
    ...CROSSINGS.map((crossing) => ({ region: crossingRegion(crossing), positionKm: scale(crossing.positionAu, AU_KM) })),
  ];
  const missing = entries.filter((entry) => !store.isPropagatedBody(entry.region.id));
  if (missing.length === 0) return;
  for (const { region } of missing) registerRegion(region);
  store.addPropagatedBodies(
    missing.map(({ region, positionKm }) => ({
      body: regionDefinition(regionOf(region.id)!),
      elements: null,
      state: constantState(positionKm),
      options: { exact: true },
    })),
  );
}
