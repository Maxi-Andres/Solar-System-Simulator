import { describe, expect, it } from 'vitest';

import { drawnRadiusEarth, GM_EARTH } from './exoplanets.ts';
import {
  FICTION_ENTRIES,
  FICTION_SHIPS,
  TAU_CETI_E_ID,
  fictionEntry,
  isFictionBody,
  overlayOf,
  valueNote,
  valueOf,
  valuesOfEntry,
} from './fiction.ts';
import { C_KM_S, G0_KM_S2, lorentzFactor, ParkedShip, ThrustTrip, Voyage } from './hailMary.ts';
import { AFT_REACH_M, BLIP_A_LENGTH_M } from '../scene/fiction/looks/blipA.ts';
import { CENTRIFUGE_CONTROL_ROOM_RADIUS_M } from '../scene/fiction/looks/hailMary.ts';
import { shellRadius } from '../scene/fiction/looks/atmosphereShell.ts';
import { DENSE_HAZE_AIR } from '../scene/fiction/looks/denseHaze.ts';
import { PLANETARY_SYSTEMS } from './planetarySystems.ts';
import { length, subtract } from './vec3.ts';

const LIGHT_YEAR_KM = 9.4607304725808e12;
const YEAR_S = 365.25 * 86_400;

describe('a constant-thrust trip, by special relativity', () => {
  const trip = new ThrustTrip(11.9 * LIGHT_YEAR_KM, 1.5 * G0_KM_S2);

  it('takes 13.1 years in Earth’s frame and 3.9 aboard, at 0.995 c at the turnover', () => {
    expect(trip.totalS / YEAR_S).toBeCloseTo(13.13, 2);
    expect(trip.properTotalS / YEAR_S).toBeCloseTo(3.9, 1);
    expect(trip.peakBeta).toBeCloseTo(0.995, 3);
    // The canon's thirteen years, and the quoted three years and nine months, within a couple of months.
    expect(Math.abs(trip.totalS / YEAR_S - 13)).toBeLessThan(0.2);
    expect(Math.abs(trip.properTotalS / YEAR_S - 3.75)).toBeLessThan(0.2);
  });

  it('starts at rest, turns over halfway at its fastest, and stops at the end', () => {
    expect(trip.at(0)).toEqual({ distanceKm: 0, speedKmS: 0, properS: 0, phase: 'accelerating' });
    const half = trip.at(trip.halfS);
    expect(half.distanceKm / trip.distanceKm).toBeCloseTo(0.5, 9);
    expect(half.speedKmS / C_KM_S).toBeCloseTo(trip.peakBeta, 9);
    expect(half.properS).toBeCloseTo(trip.properTotalS / 2, 3);
    const end = trip.at(trip.totalS);
    expect(end.distanceKm).toBe(trip.distanceKm);
    expect(end.speedKmS).toBe(0);
    expect(end.phase).toBe('arrived');
    // Continuous through the turnover.
    const before = trip.at(trip.halfS - 1);
    const after = trip.at(trip.halfS + 1);
    expect(after.phase).toBe('decelerating');
    expect(Math.abs(after.distanceKm - before.distanceKm)).toBeLessThan(2 * C_KM_S);
    expect(Math.abs(after.speedKmS - before.speedKmS)).toBeLessThan(1e-3);
  });

  it('never reaches light’s speed, and its velocity is the rate of its distance', () => {
    for (const fraction of [0.01, 0.2, 0.45, 0.6, 0.9]) {
      const t = fraction * trip.totalS;
      const point = trip.at(t);
      expect(point.speedKmS).toBeLessThan(C_KM_S);
      const dt = 1_000;
      const rate = (trip.at(t + dt).distanceKm - trip.at(t - dt).distanceKm) / (2 * dt);
      expect(rate / point.speedKmS).toBeCloseTo(1, 6);
    }
  });

  it('feels its acceleration as the proper one: dv/dt = a / γ³', () => {
    const t = 0.25 * trip.totalS;
    const dt = 10;
    const accel = (trip.at(t + dt).speedKmS - trip.at(t - dt).speedKmS) / (2 * dt);
    expect((accel * lorentzFactor(trip.at(t).speedKmS) ** 3) / (1.5 * G0_KM_S2)).toBeCloseTo(1, 5);
  });
});

describe('a voyage', () => {
  const ship = FICTION_SHIPS[0]!;
  const start = { x: 1.5e8, y: 0, z: 0 };
  const end = { x: 1.5e8, y: -6e13, z: 9e13 };
  const launch = 2_461_041.5;
  const voyage = new Voyage(ship, launch, start, end, 1.5 * G0_KM_S2, { radiusKm: 15_064, speedKmS: 12.6, pole: { x: 0, y: 0, z: 1 } });
  const bow = { x: 0, y: 0, z: 0 };

  it('points its bow along the thrust: ahead, then back once turned over; in orbit, along its motion', () => {
    const half = launch + voyage.trip.halfS / 86_400;
    expect(voyage.pose(launch + 10, bow).centrifuge).toBe(false);
    expect(bow.y * voyage.direction.y + bow.z * voyage.direction.z).toBeCloseTo(1, 9);
    voyage.pose(half + 10, bow);
    expect(bow.y * voyage.direction.y + bow.z * voyage.direction.z).toBeCloseTo(-1, 9);
    expect(voyage.pose(voyage.arrivalJd + 1, bow).centrifuge).toBe(true);
    const motion = voyage.orbitOffset(voyage.arrivalJd + 1).velocity;
    expect((bow.x * motion.x + bow.y * motion.y + bow.z * motion.z) / length(motion)).toBeCloseTo(1, 9);
  });

  it('says where it is in its voyage', () => {
    expect(voyage.moment(launch - 1).phase).toBe('not launched');
    expect(voyage.moment(launch + 100).phase).toBe('accelerating');
    expect(voyage.moment(launch + voyage.trip.halfS / 86_400).phase).toBe('turning over');
    expect(voyage.moment(voyage.arrivalJd - 100).phase).toBe('decelerating');
    const there = voyage.moment(voyage.arrivalJd + 3);
    expect(there.phase).toBe('in orbit');
    expect(there.speedKmS).toBe(12.6);
    expect(there.earthDays! - there.shipDays!).toBeCloseTo((voyage.trip.totalS - voyage.trip.properTotalS) / 86_400, 6);
  });

  it('runs its line from start to end, and goes round at its orbit’s radius after', () => {
    expect(length(subtract(voyage.lineState(launch).position, start))).toBeLessThan(1e-6);
    expect(length(subtract(voyage.lineState(voyage.arrivalJd).position, end)) / length(subtract(end, start))).toBeLessThan(1e-9);
    for (const days of [0, 0.3, 2.7]) {
      const offset = voyage.orbitOffset(voyage.arrivalJd + days);
      expect(length(offset.position)).toBeCloseTo(15_064, 6);
      expect(length(offset.velocity)).toBeCloseTo(12.6, 9);
    }
  });
});

describe('Adrian and the Hail Mary', () => {
  it('draw Adrian over the real τ Ceti e, not as a body of its own', () => {
    const adrian = overlayOf(TAU_CETI_E_ID)!;
    expect(adrian.name).toBe('Adrian');
    expect(adrian.anchor).toEqual({ kind: 'overlay', body: TAU_CETI_E_ID });
    expect(isFictionBody(TAU_CETI_E_ID)).toBe(false);
    expect(overlayOf('venus')).toBeNull();
    // Its size and orbit are the real candidate's: none of its own.
    for (const value of [adrian.radiusKm, adrian.orbit.semiMajorAxisKm, adrian.orbit.eccentricity]) {
      expect(valueNote(value).kind).toBe('silent');
    }
  });

  it('use none of the AI-wiki figures for Adrian as values', () => {
    const values = valuesOfEntry(fictionEntry('adrian')!).flatMap((value) => ('value' in value ? [String(value.value)] : []));
    for (const figure of ['3.93', '10318', '1.4', '91']) {
      expect(values.some((value) => value.includes(figure)), figure).toBe(false);
    }
  });

  it('put the ship’s 12.6 km/s orbit above the air drawn about τ Ceti e, by Adrian’s invented mass', () => {
    const real = PLANETARY_SYSTEMS.flatMap((system) => system.planets).find((planet) => planet.id === TAU_CETI_E_ID)!;
    const drawnKm = drawnRadiusEarth(real) * 6371;
    const voyage = FICTION_SHIPS[0]!.voyage!;
    const mass = valueOf(voyage.destinationMassEarth)!;
    const v = valueOf(voyage.orbitSpeedKmS)!;
    const radius = (mass * GM_EARTH) / (v * v);
    // 15,064 km: over 1,000 km above the top of the drawn air, twelve scale heights up.
    expect(radius).toBeCloseTo(15_064, 0);
    expect(radius).toBeGreaterThan(drawnKm * shellRadius(DENSE_HAZE_AIR.scaleHeight) + 1_000);
    // And the ground's gravity 1.8 g, more than Earth's as the canon says.
    expect(mass / (drawnKm / 6371) ** 2).toBeCloseTo(1.83, 2);
    expect(valueNote(voyage.destinationMassEarth).kind).toBe('invented');
    // At the real minimum mass it would be below the ground.
    expect((real.massEarth * GM_EARTH) / (v * v)).toBeLessThan(drawnKm);
  });

  it('mark the quoted 1.5 g and ship time unverified, the thirteen years canon, the launch invented', () => {
    const voyage = FICTION_SHIPS[0]!.voyage!;
    expect(valueNote(voyage.accelerationG).kind).toBe('unverified');
    expect(valueNote(voyage.shipYears).kind).toBe('unverified');
    expect(valueNote(voyage.earthYears).kind).toBe('canon');
    expect(valueNote(voyage.orbitSpeedKmS).kind).toBe('canon');
    expect(valueNote(voyage.launchJd).kind).toBe('invented');
  });

  it('run the Petrova lines from the Sun to Venus and from τ Ceti to Adrian', () => {
    const lines = FICTION_ENTRIES.filter((entry) => entry.kind === 'line');
    expect(lines.map((line) => (line.kind === 'line' ? line.planet : '')).sort()).toEqual([TAU_CETI_E_ID, 'venus'].sort());
  });
});

describe('the Blip-A', () => {
  const hailMary = FICTION_SHIPS.find((ship) => ship.id === 'hail-mary')!;
  const blipA = FICTION_SHIPS.find((ship) => ship.id === 'blip-a')!;
  const voyage = new Voyage(hailMary, 2_461_041.5, { x: 1.5e8, y: 0, z: 0 }, { x: 1.5e8, y: -6e13, z: 9e13 }, 1.5 * G0_KM_S2, {
    radiusKm: 15_064,
    speedKmS: 12.6,
    pole: { x: 0, y: 0, z: 1 },
  });
  const parked = new ParkedShip(blipA, voyage, valueOf(blipA.parked!.aheadKm)!, valueOf(blipA.parked!.yearsBefore)!);

  it('keeps clear of the Hail Mary: its aft fan short of the centrifuge’s reach, with room to spare', () => {
    // Needles along the orbit, the aft fan toward the Hail Mary; its centrifuge 75 m from the centre.
    const gapM = valueOf(blipA.parked!.aheadKm)! * 1000 - AFT_REACH_M - CENTRIFUGE_CONTROL_ROOM_RADIUS_M;
    expect(gapM).toBeGreaterThan(50);
    expect(valueOf(blipA.parked!.aheadKm)! * 1000).toBeLessThanOrEqual(500);
  });

  it('waits on the Hail Mary’s orbit, a few hundred metres ahead, from 46 years before it arrives', () => {
    expect(blipA.parked!.beside).toBe('hail-mary');
    expect(valueNote(blipA.parked!.yearsBefore).kind).toBe('canon');
    expect(valueNote(blipA.parked!.aheadKm).kind).toBe('invented');
    expect((voyage.arrivalJd - parked.fromJd) / 365.25).toBeCloseTo(46, 9);
    for (const days of [-1_000, 0, 3.5]) {
      const jd = voyage.arrivalJd + days;
      const own = parked.offset(jd).position;
      expect(length(own)).toBeCloseTo(15_064, 6);
      // 400 m ahead of the Hail Mary, along the same circle.
      expect(length(subtract(own, voyage.orbitOffset(jd).position))).toBeCloseTo(0.4, 6);
    }
  });

  it('points along its motion and does not spin', () => {
    const bow = { x: 0, y: 0, z: 0 };
    const jd = voyage.arrivalJd + 2;
    expect(parked.pose(jd, bow).centrifuge).toBe(false);
    const v = parked.offset(jd).velocity;
    expect((bow.x * v.x + bow.y * v.y + bow.z * v.z) / length(v)).toBeCloseTo(1, 9);
  });

  it('is as long as its model, 400 m by the film’s stills, invented', () => {
    expect(valueOf(blipA.lengthM)).toBeCloseTo(BLIP_A_LENGTH_M, 6);
    expect(valueNote(blipA.lengthM).kind).toBe('invented');
  });
});
