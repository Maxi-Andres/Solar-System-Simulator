import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { alphaCenMember } from './alphaCenBodies.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { GM_EARTH, planetStateAboutStar, type ExoPlanet } from './exoplanets.ts';
import {
  FICTION,
  FICTION_ANCHOR_STARS,
  FICTION_COLOR,
  FICTION_STARS,
  type FictionStarRecord,
  fictionBodyId,
  fictionRecord,
  inventedOrbit,
  valueOf,
  type FictionAnchor,
  type FictionRecord,
} from './fiction.ts';
import { stateToOsculatingElements } from './kepler.ts';
import { lagrangeState, massRatio } from './lagrange.ts';
import { registerStarDirection, towardStar } from './planetarySystems.ts';
import { addStarBody, setStarDisc, starBodyDefinition, starBodyFacts } from './starBodies.ts';
import { mapSquarePositionKm } from './starWars.ts';
import { temperatureToColorIndex } from '../scene/blackbody.ts';
import type { StarNameIndex, Stars3dSource } from './stars3d.ts';
import { J2000_JD } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Fiction's worlds made bodies (fiction.ts): each about the real body its canon anchors it to,
 * on the same machinery a real planet of another star runs on -- exoplanets.ts's orbit on the
 * sky's axes at its star, a state about its parent, so the frame tree carries it with the star
 * as the star moves (planetarySystems.ts addPlanets). A moon goes about its planet the same way.
 *
 * Added to the store only, never to a real system's list: planetarySystems.ts, alphaCenAPlanets.ts
 * and the Archive do not know them, so no count, list or statistic of real planets takes one in
 * (fictionBodies.test.ts). Done when the Fiction layer is first switched on (scene/fiction/), so
 * with it off they cost nothing.
 */

const AU_KM = 149_597_870.7;
const DAY_S = 86_400;

/**
 * The body a fictional one goes about, once its anchor is a body; null before. For a Lagrange
 * point, the star the point's planet goes round: a Trojan orbits the star, not the planet.
 */
export function resolveAnchor(store: EphemerisStore, anchor: FictionAnchor): BodyId | null {
  if (anchor.kind === 'alphaCen') {
    return store.bodies.find((body) => alphaCenMember(body.id) === anchor.member)?.id ?? null;
  }
  // An overlay is no body of its own: drawn over the real one (SolarSystem.tsx), never placed.
  if (anchor.kind === 'overlay') return null;
  if (anchor.kind === 'star') return starBodyByDesignation(store, anchor.designation);
  if (anchor.kind === 'fictionStar') {
    const star = fictionBodyId(anchor.id);
    return store.isPropagatedBody(star) ? star : null;
  }
  const id = fictionBodyId(anchor.kind === 'fiction' ? anchor.id : anchor.of);
  if (!store.isPropagatedBody(id)) return null;
  return anchor.kind === 'fiction' ? id : store.body(id).parent;
}

/**
 * The orbit as exoplanets.ts draws one, about a parent of GM `gmParent` (km^3/s^2): the record's
 * values, or for a place the canon does not give, its invented orbit (fiction.ts inventedOrbit),
 * the same every time. The period from Kepler's third law where the record has none.
 */
export function fictionOrbit(record: FictionRecord, gmParentKm3S2: number): ExoPlanet {
  const massEarth = valueOf(record.massEarth) ?? 0;
  // Made up only where the record gives no distance of its own: a place invented for a whole
  // system (Star Wars' galaxy) keeps the orbits its record gives within it.
  const invented =
    record.position === 'invented' && valueOf(record.orbit.semiMajorAxisKm) === null
      ? inventedOrbit(record.id, { minKm: 0.3 * AU_KM, maxKm: 3 * AU_KM })
      : null;
  const mu = gmParentKm3S2 + massEarth * GM_EARTH;
  const given = record.orbit.periodDays === undefined ? null : valueOf(record.orbit.periodDays);
  // Drawn at the period's distance about the parent's mass, where the record asks (FictionOrbit).
  const a =
    invented?.semiMajorAxisKm ??
    (record.orbit.drawnFromPeriod === true && given !== null && gmParentKm3S2 > 0
      ? Math.cbrt((mu * (given * DAY_S) ** 2) / (4 * Math.PI ** 2))
      : null) ??
    valueOf(record.orbit.semiMajorAxisKm) ??
    AU_KM;
  const periodDays = given ?? (2 * Math.PI * Math.sqrt(a ** 3 / mu)) / DAY_S;
  // Periastron that long before J2000 that the mean anomaly then is the record's.
  const meanAnomalyDeg = record.orbit.meanAnomalyDeg === undefined ? 0 : (valueOf(record.orbit.meanAnomalyDeg) ?? 0);
  return {
    id: fictionBodyId(record.id),
    name: record.name,
    // Never drawn or counted as one: exoPlanetOf does not know it. The shape is for the sums.
    status: 'candidate',
    periodDays,
    semiMajorAxisAu: a / AU_KM,
    eccentricity: invented?.eccentricity ?? valueOf(record.orbit.eccentricity) ?? 0,
    argPeriastronDeg: 0,
    massEarth,
    massIsMinimum: false,
    phase: { kind: 'periastron', jd: J2000_JD - (meanAnomalyDeg / 360) * periodDays },
    inclinationDeg: invented?.inclinationDeg ?? valueOf(record.orbit.inclinationDeg),
    nodeDeg: invented?.nodeDeg ?? valueOf(record.orbit.nodeDeg),
    reference: `${record.work.title} (fiction)`,
  };
}

/**
 * The body a fictional world is: a sphere of its radius, drawn in its own look and lit by its
 * star (SolarSystem.tsx), its marker, orbit and label in fiction's colour.
 */
export function fictionBodyDefinition(record: FictionRecord, parent: BodyId): BodyDefinition {
  const radiusKm = valueOf(record.radiusKm) ?? 1;
  const gm = (valueOf(record.massEarth) ?? 0) * GM_EARTH;
  return {
    id: fictionBodyId(record.id),
    name: record.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent,
    // A Trojan is a minor body, as Jupiter's are asteroids; it is shown with the planets all the
    // same (fiction.ts fictionLayerKind).
    kind: record.kind === 'trojan' ? 'asteroid' : record.kind,
    radiusEquatorialKm: radiusKm,
    radiusPolarKm: radiusKm,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: FICTION_COLOR,
    // A Trojan's orbit is its planet's, drawn already.
    drawOrbit: record.kind !== 'trojan',
    textures: null,
    rings: null,
    mission: null,
  };
}

/** The star body carrying `designation` (starBodies.ts), or null while there is none. */
export function starBodyByDesignation(store: EphemerisStore, designation: string): BodyId | null {
  for (const body of store.bodies) {
    if (body.kind === 'star' && starBodyFacts(body.id)?.designations.includes(designation) === true) return body.id;
  }
  return null;
}

/**
 * Makes the stars fiction is anchored to by catalogue bodies, pinned, with their measured mass --
 * 40 Eridani A, for Erid and Vulcan -- and their companions, so they are named in those worlds'
 * skies (fiction.ts FICTION_ANCHOR_STARS). Called once the Fiction layer is on (App.tsx); they stay
 * bodies after, as any star gone to does. A star already a body without its mass -- found by search
 * before the layer was on -- is made again with it, unless the camera is on it: the worlds' orbits
 * are drawn with it.
 */
export async function ensureFictionStars(
  store: EphemerisStore,
  stars3d: Stars3dSource,
  names: StarNameIndex,
  keep: BodyId,
): Promise<void> {
  const entryOf = (designation: string): number | null => {
    const { designations } = names.names;
    for (let k = 0; k < names.names.count; k += 1) {
      if (designations[k]?.includes(designation) === true) return k;
    }
    return null;
  };
  for (const star of FICTION_ANCHOR_STARS) {
    const k = entryOf(star.designation);
    if (k === null) continue;
    const existing = starBodyByDesignation(store, star.designation);
    if (existing !== null && store.body(existing).gmBodyOnlyKm3S2 === 0 && existing !== keep) {
      store.removePropagatedBody(existing);
    }
    await addStarBody(store, stars3d, names, k, keep, true, star.massSun);
    for (const companion of star.companions) {
      const c = entryOf(companion);
      if (c !== null) await addStarBody(store, stars3d, names, c, keep, true);
    }
  }
}

const SOLAR_RADIUS_KM = 695_700;

/**
 * Where a star of the fiction's own is, km from the Sun: its map square laid on its galaxy
 * (starWars.ts), or -- a companion -- that far from its star along the galaxy map's east, held still.
 */
export function fictionStarPositionKm(star: FictionStarRecord): Vec3 | null {
  const square = valueOf(star.mapSquare);
  if (square === null) return null;
  const at = mapSquarePositionKm(square);
  if (star.companionOf === undefined) return at;
  const host = FICTION_STARS.find((other) => other.id === star.companionOf!.id);
  const hostAt = host === undefined ? null : fictionStarPositionKm(host);
  const separation = valueOf(star.companionOf.separationAu);
  if (hostAt === null || separation === null) return null;
  // Off its star by the separation, in a fixed direction: the canon gives none, and any will do.
  const direction = { x: Math.cos(1.1), y: Math.sin(1.1) * 0.6, z: Math.sin(1.1) * 0.8 };
  return {
    x: hostAt.x + direction.x * separation * AU_KM,
    y: hostAt.y + direction.y * separation * AU_KM,
    z: hostAt.z + direction.z * separation * AU_KM,
  };
}

/**
 * Makes the fiction's own stars bodies (fiction.ts FICTION_STARS): each a star like any other --
 * a disc of its radius in its temperature's colour, its mass for its worlds' orbits -- held still
 * where its galaxy and map put it, and its direction registered so its worlds' orbits are laid
 * out against it. Returns the ids added.
 */
export function placeFictionStars(store: EphemerisStore): BodyId[] {
  const added: BodyId[] = [];
  for (const star of FICTION_STARS) {
    const id = fictionBodyId(star.id);
    if (store.isPropagatedBody(id)) continue;
    const position = fictionStarPositionKm(star);
    const temperature = valueOf(star.temperatureK);
    const radius = valueOf(star.radiusSun);
    const mass = valueOf(star.massSun);
    if (position === null || temperature === null || radius === null || mass === null) continue;
    const colorIndex = temperatureToColorIndex(temperature);
    setStarDisc(id, colorIndex, temperature);
    const length = Math.hypot(position.x, position.y, position.z);
    registerStarDirection(id, { x: position.x / length, y: position.y / length, z: position.z / length });
    const state: StateVector = { position, velocity: { x: 0, y: 0, z: 0 } };
    store.addPropagatedBody(
      { ...starBodyDefinition(id, star.name, colorIndex, radius * SOLAR_RADIUS_KM, mass), color: FICTION_COLOR },
      null,
      () => state,
      { exact: true },
    );
    added.push(id);
  }
  return added;
}

/**
 * Resolves with `id` once it is a body: at once if it is, or when the Fiction layer's chunk has
 * placed it -- search switches the layer on and goes to the world the moment it is there.
 */
export function whenPlaced(store: EphemerisStore, id: BodyId): Promise<BodyId> {
  // A body from the start -- Venus, which a Petrova line runs to -- is there already.
  const there = (): boolean => store.isPropagatedBody(id) || store.bodies.some((body) => body.id === id);
  if (there()) return Promise.resolve(id);
  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (!there()) return;
      unsubscribe();
      resolve(id);
    });
  });
}

/**
 * A fictional body's state about its parent at an instant: on its own orbit (exoplanets.ts), or
 * at its planet's L4 or L5 (lagrange.ts) -- the planet's state about the star turned 60 degrees
 * about its orbit's pole. Null for a Lagrange point of a record that is not there.
 */
function stateFunction(record: FictionRecord, gmParent: number, toward: Vec3): ((jd: number) => StateVector) | null {
  const anchor = record.anchor;
  if (anchor.kind !== 'lagrange') {
    const orbit = fictionOrbit(record, gmParent);
    return (jd) => planetStateAboutStar(orbit, jd, toward);
  }
  const planet = fictionRecord(anchor.of);
  if (planet === null) return null;
  const orbit = fictionOrbit(planet, gmParent);
  const mu = massRatio(gmParent, (valueOf(planet.massEarth) ?? 0) * GM_EARTH);
  return (jd) => lagrangeState(planetStateAboutStar(orbit, jd, toward), mu, anchor.point);
}

/** The unit direction from the Sun to the star a body is about: its own, or its nearest ancestor's. */
function towardHost(store: EphemerisStore, id: BodyId): Vec3 | null {
  for (let current: BodyId | null = id; current !== null; current = store.body(current).parent) {
    const toward = towardStar(current);
    if (toward !== null) return toward;
  }
  return null;
}

/**
 * Makes every record whose anchor is a body a body itself, parents before moons, and returns the
 * ids added. A record whose anchor is not a body yet -- Alpha Centauri before its stars are
 * placed -- is left for a later call.
 */
export function placeFiction(store: EphemerisStore, records: readonly FictionRecord[] = FICTION): BodyId[] {
  const added: BodyId[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const record of records) {
      const id = fictionBodyId(record.id);
      if (store.isPropagatedBody(id)) continue;
      const parent = resolveAnchor(store, record.anchor);
      const toward = parent === null ? null : towardHost(store, parent);
      if (parent === null || toward === null) continue;
      const gmParent = store.body(parent).gmBodyOnlyKm3S2;
      const state = stateFunction(record, gmParent, toward);
      if (state === null) continue;
      const mu = gmParent + (valueOf(record.massEarth) ?? 0) * GM_EARTH;
      store.addPropagatedBody(
        fictionBodyDefinition(record, parent),
        // What the orbit line is first drawn from, as a real planet's (planetarySystems.ts).
        stateToOsculatingElements(state(J2000_JD), mu, J2000_JD, id, parent),
        state,
        // Not flagged approximate: there is no better answer it falls back from. The FICTION
        // tag says what it is.
        { aboutParent: true, exact: true },
      );
      added.push(id);
      progress = true;
    }
  }
  return added;
}
