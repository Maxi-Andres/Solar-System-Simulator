import type { BodyDefinition, BodyId } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import { propagate } from './kepler.ts';
import { GM_EARTH, orbitPole } from './exoplanets.ts';
import {
  FICTION_COLOR,
  FICTION_SHIPS,
  fictionBodyId,
  valueOf,
  type FictionShipRecord,
} from './fiction.ts';
import { PLANETARY_SYSTEMS, towardStar } from './planetarySystems.ts';
import { add, cross, dot, length, normalize, scale, subtract, type StateVector, type Vec3 } from './vec3.ts';

/**
 * A fictional ship's voyage (fiction.ts FictionVoyage): the Hail Mary's from Earth to τ Ceti, at a
 * constant proper acceleration with a turnover at the midpoint -- real special relativity applied
 * to a fictional trip.
 *
 * **Hyperbolic motion.** A ship that feels a constant acceleration a, seen from the frame it left
 * at rest (Earth's, near enough: the Sun's), covers x(t) = (c²/a)(√(1 + (at/c)²) − 1) in time t at
 * speed v(t) = at / √(1 + (at/c)²), while its own clock reads τ(t) = (c/a) asinh(at/c). It never
 * reaches c. Turned over at the midpoint, it slows the same way, stopping at the destination. Over
 * 11.9 light years at 1.5 g: 13.1 years in Earth's frame, 3.9 aboard, 0.995 c at the turnover
 * (hailMary.test.ts).
 *
 * **The line.** Straight, from where Earth is at launch to where the destination is at arrival, in
 * the Sun's frame -- what the trip is measured in. The destination moves a few kilometres a second
 * over the thirteen years; the aim point is found by iterating to where it will be. Once there, the
 * ship goes round the destination on a circle at the canon's speed, its radius from the
 * destination's mass, GM / v².
 *
 * Neither the turnover nor the arrival is smooth to the kilometre a second at the joins -- the
 * ship stops in the Sun's frame, where the destination is moving at tens -- and nothing is meant by
 * it: the canon's sequence (into orbit about τ Ceti near another ship first, then about Adrian) is
 * simplified to one arrival.
 */

/** km/s. */
export const C_KM_S = 299_792.458;
/** Standard gravity, km/s². */
export const G0_KM_S2 = 9.80665e-3;
const DAY_S = 86_400;
const YEAR_DAYS = 365.25;

/** Where along a constant-thrust trip, at a time since launch. */
export interface TripPoint {
  /** Distance covered from the start, km, Earth's frame. */
  readonly distanceKm: number;
  /** Speed, km/s, Earth's frame; along the line. */
  readonly speedKmS: number;
  /** The ship's own time since launch, s. */
  readonly properS: number;
  readonly phase: 'accelerating' | 'decelerating' | 'arrived';
}

/** A constant-proper-acceleration trip over `distanceKm`, turning over at the midpoint. */
export class ThrustTrip {
  /** Earth-frame duration of each half and of the whole, s. */
  readonly halfS: number;
  readonly totalS: number;
  /** Ship time for the whole, s. */
  readonly properTotalS: number;
  /** The fastest, at the turnover, as a fraction of c. */
  readonly peakBeta: number;

  constructor(
    readonly distanceKm: number,
    readonly accelKmS2: number,
  ) {
    // Half the distance, by x(t) above: √(1 + (at/c)²) = 1 + a(D/2)/c².
    const k = (accelKmS2 * (distanceKm / 2)) / (C_KM_S * C_KM_S);
    const atOverC = Math.sqrt((1 + k) ** 2 - 1);
    this.halfS = (atOverC * C_KM_S) / accelKmS2;
    this.totalS = 2 * this.halfS;
    this.properTotalS = (2 * C_KM_S * Math.asinh(atOverC)) / accelKmS2;
    this.peakBeta = atOverC / Math.sqrt(1 + atOverC * atOverC);
  }

  /** At `tS` seconds after launch, Earth's frame; past the end, at the end. */
  at(tS: number): TripPoint {
    const a = this.accelKmS2;
    const c = C_KM_S;
    if (tS >= this.totalS) {
      return { distanceKm: this.distanceKm, speedKmS: 0, properS: this.properTotalS, phase: 'arrived' };
    }
    const accelerating = tS <= this.halfS;
    // The second half is the first run backwards from the end.
    const u = accelerating ? Math.max(0, tS) : this.totalS - tS;
    const atc = (a * u) / c;
    const root = Math.sqrt(1 + atc * atc);
    const x = ((c * c) / a) * (root - 1);
    const v = (a * u) / root;
    const tau = (c / a) * Math.asinh(atc);
    return accelerating
      ? { distanceKm: x, speedKmS: v, properS: tau, phase: 'accelerating' }
      : { distanceKm: this.distanceKm - x, speedKmS: v, properS: this.properTotalS - tau, phase: 'decelerating' };
  }
}

/** The Lorentz factor of a speed, km/s. */
export function lorentzFactor(speedKmS: number): number {
  const beta = speedKmS / C_KM_S;
  return 1 / Math.sqrt(1 - beta * beta);
}

/** What the panel and the model read of a ship at an instant. */
export interface ShipMoment {
  readonly phase: 'not launched' | 'accelerating' | 'turning over' | 'decelerating' | 'in orbit';
  /** Since launch, Earth's frame and the ship's, days; null before launch. */
  readonly earthDays: number | null;
  readonly shipDays: number | null;
  readonly speedKmS: number;
}

/** How long either side of the midpoint the ship is said to be turning over, days. */
const TURNOVER_DAYS = 0.5;

/** A placed voyage: its trip, its line, and its orbit at the end. */
export class Voyage {
  readonly trip: ThrustTrip;
  readonly launchJd: number;
  readonly arrivalJd: number;
  /** The line's start, the Sun's frame, km; and its unit direction. */
  readonly startKm: Vec3;
  readonly direction: Vec3;
  /** The orbit at the destination: radius km, speed km/s, its pole, and where it starts. */
  readonly orbitRadiusKm: number;
  readonly orbitSpeedKmS: number;
  readonly #u0: Vec3;
  readonly #v0: Vec3;

  constructor(
    readonly record: FictionShipRecord,
    launchJd: number,
    startKm: Vec3,
    endKm: Vec3,
    accelKmS2: number,
    orbit: { readonly radiusKm: number; readonly speedKmS: number; readonly pole: Vec3 },
  ) {
    this.launchJd = launchJd;
    this.startKm = startKm;
    const along = subtract(endKm, startKm);
    this.direction = normalize(along);
    this.trip = new ThrustTrip(length(along), accelKmS2);
    this.arrivalJd = launchJd + this.trip.totalS / DAY_S;
    this.orbitRadiusKm = orbit.radiusKm;
    this.orbitSpeedKmS = orbit.speedKmS;
    // It starts round on the side it came from, going prograde.
    const back = scale(this.direction, -1);
    const inPlane = subtract(back, scale(orbit.pole, dot(back, orbit.pole)));
    this.#u0 = length(inPlane) > 1e-9 ? normalize(inPlane) : normalize(cross(orbit.pole, { x: 1, y: 0, z: 0 }));
    this.#v0 = cross(orbit.pole, this.#u0);
  }

  /** Where it is at `jd` on the line, the Sun's frame, before arrival; and its velocity there. */
  lineState(jd: number): StateVector {
    const point = this.trip.at((jd - this.launchJd) * DAY_S);
    return {
      position: add(this.startKm, scale(this.direction, point.distanceKm)),
      velocity: scale(this.direction, point.speedKmS),
    };
  }

  /**
   * Its offset and velocity about the destination at `jd`, after arrival -- or, `aheadRad` further
   * round, a ship parked on the same orbit's (ParkedShip), at any time.
   */
  orbitOffset(jd: number, aheadRad = 0): StateVector {
    const angle = ((jd - this.arrivalJd) * DAY_S * this.orbitSpeedKmS) / this.orbitRadiusKm + aheadRad;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      position: add(scale(this.#u0, this.orbitRadiusKm * c), scale(this.#v0, this.orbitRadiusKm * s)),
      velocity: add(scale(this.#u0, -this.orbitSpeedKmS * s), scale(this.#v0, this.orbitSpeedKmS * c)),
    };
  }

  moment(jd: number): ShipMoment {
    if (jd < this.launchJd) return { phase: 'not launched', earthDays: null, shipDays: null, speedKmS: 0 };
    const earthDays = jd - this.launchJd;
    if (jd >= this.arrivalJd) {
      const shipDays = this.trip.properTotalS / DAY_S + (jd - this.arrivalJd);
      return { phase: 'in orbit', earthDays, shipDays, speedKmS: this.orbitSpeedKmS };
    }
    const point = this.trip.at(earthDays * DAY_S);
    const fromMidpoint = Math.abs(earthDays * DAY_S - this.trip.halfS) / DAY_S;
    return {
      phase: fromMidpoint <= TURNOVER_DAYS ? 'turning over' : point.phase === 'decelerating' ? 'decelerating' : 'accelerating',
      earthDays,
      shipDays: point.properS / DAY_S,
      speedKmS: point.speedKmS,
    };
  }

  /**
   * Which way its bow points at `jd`, into `out`, and whether its centrifuge is spun up: along the
   * thrust -- toward the destination while it speeds up, back toward Earth once it has turned over
   * to slow down -- and in orbit along its motion, the centrifuge turning.
   */
  pose(jd: number, out: { x: number; y: number; z: number }): { readonly centrifuge: boolean } {
    if (jd >= this.arrivalJd) {
      const angle = ((jd - this.arrivalJd) * DAY_S * this.orbitSpeedKmS) / this.orbitRadiusKm;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      out.x = -this.#u0.x * s + this.#v0.x * c;
      out.y = -this.#u0.y * s + this.#v0.y * c;
      out.z = -this.#u0.z * s + this.#v0.z * c;
      return IN_ORBIT;
    }
    const sign = (jd - this.launchJd) * DAY_S <= this.trip.halfS ? 1 : -1;
    out.x = this.direction.x * sign;
    out.y = this.direction.y * sign;
    out.z = this.direction.z * sign;
    return UNDER_THRUST;
  }
}

const IN_ORBIT = { centrifuge: true } as const;
const UNDER_THRUST = { centrifuge: false } as const;

/**
 * A ship parked on a voyaging one's orbit (fiction.ts FictionParking): the Blip-A, a few hundred
 * metres ahead of where the Hail Mary will be, on the same circle about Adrian -- from 46 years
 * before the Hail Mary arrives, on. The canon has it about τ Ceti when the Hail Mary comes, and
 * both go to Adrian later; as the Hail Mary's arrival is made one, so is its stay: about Adrian
 * throughout. Its trip from Erid is not drawn: the canon does not give it.
 */
export class ParkedShip {
  /** When it is first there, TDB Julian day. */
  readonly fromJd: number;
  readonly #aheadRad: number;

  constructor(
    readonly record: FictionShipRecord,
    readonly companion: Voyage,
    aheadKm: number,
    yearsBefore: number,
  ) {
    this.#aheadRad = aheadKm / companion.orbitRadiusKm;
    this.fromJd = companion.arrivalJd - yearsBefore * YEAR_DAYS;
  }

  /** Its offset and velocity about the world, at `jd`. */
  offset(jd: number): StateVector {
    return this.companion.orbitOffset(jd, this.#aheadRad);
  }

  /** Its bow along its motion round the world, into `out`; it does not spin. */
  pose(jd: number, out: { x: number; y: number; z: number }): { readonly centrifuge: boolean } {
    const v = this.offset(jd).velocity;
    const n = Math.hypot(v.x, v.y, v.z);
    out.x = v.x / n;
    out.y = v.y / n;
    out.z = v.z / n;
    return UNDER_THRUST;
  }
}

/** The voyages placed, by the ship's body id; and the ships parked beside them. */
const voyages = new Map<BodyId, Voyage>();
const parkedShips = new Map<BodyId, ParkedShip>();

export function voyageOf(id: BodyId): Voyage | null {
  return voyages.get(id) ?? null;
}

export function parkedOf(id: BodyId): ParkedShip | null {
  return parkedShips.get(id) ?? null;
}

/**
 * A body's state in the Sun's frame at `jd`, km and km/s; null where the store cannot say. Earth's
 * at the launch may be in a chunk of its table not yet fetched: then its osculating elements,
 * about the Sun, which are within a few thousand kilometres -- nothing, over 11.9 light years.
 */
function heliocentric(store: EphemerisStore, id: BodyId, jd: number): StateVector | null {
  const body = store.stateInRoot(id, jd);
  // Past the Sun's table (2036) the store puts it at the barycentre, as it does for every body
  // placed about it there: the same here, so the two agree.
  const sun = store.stateInRoot('sun', jd);
  if (body !== null) {
    return sun === null
      ? { position: body.position, velocity: body.velocity }
      : { position: subtract(body.position, sun.position), velocity: subtract(body.velocity, sun.velocity) };
  }
  const elements = store.body(id).parent === null ? store.elementsFor(id) : null;
  return elements === null ? null : propagate(elements, jd);
}

/** The ship's body: a marker and its model (SolarSystem.tsx), never a sphere. */
export function shipBodyDefinition(record: FictionShipRecord): BodyDefinition {
  // Half its length, km: what the camera frames it by and the marker hands over to the model at.
  const radiusKm = (valueOf(record.lengthM) ?? 50) / 2000;
  return {
    id: fictionBodyId(record.id),
    name: record.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'spacecraft',
    radiusEquatorialKm: radiusKm,
    radiusPolarKm: radiusKm,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: FICTION_COLOR,
    // Its path is drawn by the Fiction layer (scene/fiction/FictionLayer.tsx), a line, not an orbit.
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
    // Never a sphere: the model stands for it (scene/fiction/fictionHooks.ts).
    radiusPublished: false,
  };
}

/** The real planet record the destination is, for its orbit's pole. */
function realPlanet(id: BodyId) {
  for (const system of PLANETARY_SYSTEMS) {
    const planet = system.planets.find((candidate) => candidate.id === id);
    if (planet !== undefined) return planet;
  }
  return null;
}

/**
 * Makes each ship a body once what its voyage runs between can be placed -- Earth, and the
 * destination with its star -- and returns the ids added. Its state is worked out in the Sun's
 * frame from the line and, after arrival, the destination's own state plus the orbit.
 */
export function placeShips(store: EphemerisStore, ships: readonly FictionShipRecord[] = FICTION_SHIPS): BodyId[] {
  const added: BodyId[] = [];
  for (const record of ships) {
    const id = fictionBodyId(record.id);
    if (store.isPropagatedBody(id)) continue;
    const { voyage } = record;
    if (voyage === undefined) continue;
    if (!store.isPropagatedBody(voyage.to) && !store.bodies.some((body) => body.id === voyage.to)) continue;
    const launchJd = valueOf(voyage.launchJd);
    const accelG = valueOf(voyage.accelerationG);
    const speed = valueOf(voyage.orbitSpeedKmS);
    const massEarth = valueOf(voyage.destinationMassEarth);
    const start = launchJd === null ? null : heliocentric(store, voyage.from, launchJd);
    if (launchJd === null || accelG === null || speed === null || massEarth === null || start === null) continue;
    // The aim point is where the destination will be: found by iterating on the arrival time.
    let arrivalJd = launchJd + 13 * 365.25;
    let end: StateVector | null = null;
    for (let k = 0; k < 4; k += 1) {
      end = heliocentric(store, voyage.to, arrivalJd);
      if (end === null) break;
      const trip = new ThrustTrip(length(subtract(end.position, start.position)), accelG * G0_KM_S2);
      arrivalJd = launchJd + trip.totalS / DAY_S;
    }
    if (end === null) continue;
    const planet = realPlanet(voyage.to);
    const star = store.body(voyage.to).parent;
    const toward = star === null ? null : towardStar(star);
    const pole = planet !== null && toward !== null ? orbitPole(planet, toward, arrivalJd) : { x: 0, y: 0, z: 1 };
    const voyageObject = new Voyage(record, launchJd, start.position, end.position, accelG * G0_KM_S2, {
      radiusKm: (massEarth * GM_EARTH) / (speed * speed),
      speedKmS: speed,
      pole,
    });
    voyages.set(id, voyageObject);
    store.addPropagatedBody(
      shipBodyDefinition(record),
      null,
      (jd) => {
        if (jd < voyageObject.arrivalJd) return voyageObject.lineState(jd);
        const at = heliocentric(store, voyage.to, jd);
        const offset = voyageObject.orbitOffset(jd);
        return at === null
          ? voyageObject.lineState(voyageObject.arrivalJd)
          : { position: add(at.position, offset.position), velocity: add(at.velocity, offset.velocity) };
      },
      // Not before it leaves: a craft has no place before its launch.
      { exact: true, coverage: { startJd: launchJd, stopJd: Number.POSITIVE_INFINITY } },
    );
    added.push(id);
  }
  // Then the ships parked beside them, once their companion's orbit is known.
  for (const record of ships) {
    const id = fictionBodyId(record.id);
    if (record.parked === undefined || store.isPropagatedBody(id)) continue;
    const companion = voyages.get(fictionBodyId(record.parked.beside));
    const aheadKm = valueOf(record.parked.aheadKm);
    const years = valueOf(record.parked.yearsBefore);
    if (companion === undefined || aheadKm === null || years === null) continue;
    const parked = new ParkedShip(record, companion, aheadKm, years);
    parkedShips.set(id, parked);
    const world = companion.record.voyage?.to;
    if (world === undefined) continue;
    store.addPropagatedBody(
      shipBodyDefinition(record),
      null,
      (jd) => {
        const at = heliocentric(store, world, jd);
        const offset = parked.offset(jd);
        // Where the world cannot be said, at its arrival's place: as the companion's fallback.
        return at === null
          ? companion.lineState(companion.arrivalJd)
          : { position: add(at.position, offset.position), velocity: add(at.velocity, offset.velocity) };
      },
      // Not before it came: its trip there is not drawn.
      { exact: true, coverage: { startJd: parked.fromJd, stopJd: Number.POSITIVE_INFINITY } },
    );
    added.push(id);
  }
  return added;
}

/** Days in a year, for the panel's years. */
export const DAYS_PER_YEAR = YEAR_DAYS;
