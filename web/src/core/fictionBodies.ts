import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { alphaCenMember } from './alphaCenBodies.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { GM_EARTH, planetStateAboutStar, type ExoPlanet } from './exoplanets.ts';
import {
  FICTION,
  FICTION_COLOR,
  fictionBodyId,
  fictionRecord,
  inventedOrbit,
  valueOf,
  type FictionAnchor,
  type FictionRecord,
} from './fiction.ts';
import { stateToOsculatingElements } from './kepler.ts';
import { lagrangeState, massRatio } from './lagrange.ts';
import { towardStar } from './planetarySystems.ts';
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
  const invented =
    record.position === 'invented'
      ? inventedOrbit(record.id, { minKm: 0.3 * AU_KM, maxKm: 3 * AU_KM })
      : null;
  const a = invented?.semiMajorAxisKm ?? valueOf(record.orbit.semiMajorAxisKm) ?? AU_KM;
  const mu = gmParentKm3S2 + massEarth * GM_EARTH;
  const given = record.orbit.periodDays === undefined ? null : valueOf(record.orbit.periodDays);
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
