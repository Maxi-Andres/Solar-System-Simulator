import { getBody } from '@sss/tools/catalog';
import type { Manifest, SurfaceTrack } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { bodyOrientation, directionToGeographic } from '../scene/orientation.ts';
import { meshFramePointKm } from '../scene/surfaceGround.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import { headingDirection, stopIndexAt, surfaceFrame, surfaceState } from './surface.ts';
import { cross, dot, length } from './vec3.ts';

const mars = getBody('mars');
const JD = 2_461_321.5; // 2026-10-08

// Curiosity on sol 5021, from NASA's traverse.
const LAT = -4.82513971;
const LON = 137.3888471;

describe('a place on Mars, in space', () => {
  it('is on the ellipsoid: the equatorial radius at the equator, the polar at the pole', () => {
    expect(length(surfaceFrame(mars, 0, 40, JD).positionKm)).toBeCloseTo(mars.radiusEquatorialKm, 6);
    expect(length(surfaceFrame(mars, 90, 0, JD).positionKm)).toBeCloseTo(mars.radiusPolarKm, 6);
  });

  it('is at the latitude and longitude it was asked for, as the maps read them', () => {
    const { positionKm } = surfaceFrame(mars, LAT, LON, JD);
    const place = directionToGeographic(positionKm, JD, mars);
    expect(place.latitudeDeg).toBeCloseTo(LAT, 9);
    expect(place.longitudeDeg).toBeCloseTo(LON, 9);
  });

  it('stands upright: up, north and east at right angles, east to the right of north', () => {
    const frame = surfaceFrame(mars, 40, LON, JD);
    expect(dot(frame.up, frame.north)).toBeCloseTo(0, 12);
    expect(dot(frame.up, frame.east)).toBeCloseTo(0, 12);
    expect(dot(cross(frame.east, frame.north), frame.up)).toBeCloseTo(1, 12);
    // On a flattened planet "up" leans poleward of the radial, by a third of a degree
    // at 40 degrees on Mars.
    const radial = frame.positionKm;
    const lean = Math.acos(dot(frame.up, radial) / length(radial)) * (180 / Math.PI);
    expect(lean).toBeGreaterThan(0.3);
    expect(lean).toBeLessThan(0.36);
    expect(dot(frame.up, frame.north) < 1e-12 && dot(radial, frame.north) < 0).toBe(true);
  });

  it('heads where the heading says: 90 degrees is east', () => {
    const frame = surfaceFrame(mars, LAT, LON, JD);
    const east = headingDirection(frame, 90);
    expect(dot(east, frame.east)).toBeCloseTo(1, 12);
    expect(dot(headingDirection(frame, null), frame.north)).toBeCloseTo(1, 12);
  });

  it('is carried round by Mars at 240 m/s on the equator', () => {
    const state = surfaceState(mars, 0, LON, JD);
    // 2 pi a / sidereal day: 3396.19 km over 88,642.66 s.
    expect(length(state.velocity)).toBeCloseTo((2 * Math.PI * 3396.19) / 88_642.66, 4);
    expect(dot(state.velocity, state.position)).toBeCloseTo(0, 6);
  });
});

describe('the ground drawn and the craft placed agree', () => {
  it.each([0, 180])('to the millimetre, with the map starting at %i degrees', (origin) => {
    // The patch is built in the mesh's own frame and turned with the mesh; the craft is
    // placed in space. If the two disagreed the rover would float or sink.
    const local = meshFramePointKm(mars, LAT, LON, origin);
    const world = local.clone().applyQuaternion(bodyOrientation(JD, mars, origin));
    const placed = surfaceFrame(mars, LAT, LON, JD).positionKm;
    expect(new THREE.Vector3(placed.x, placed.y, placed.z).distanceTo(world)).toBeLessThan(1e-6);
  });
});

describe('stopIndexAt', () => {
  const track: SurfaceTrack = {
    id: 'rover',
    host: 'mars',
    count: 3,
    t: [10, 20, 30],
    latitudeDeg: [0, 0, 0],
    longitudeDeg: [0, 1, 2],
    headingDeg: [null, null, null],
    sol: [0, 5, 9],
  };

  it('is the last stop begun', () => {
    expect(stopIndexAt(track, 9.9)).toBe(-1);
    expect(stopIndexAt(track, 10)).toBe(0);
    expect(stopIndexAt(track, 19.99)).toBe(0);
    expect(stopIndexAt(track, 20)).toBe(1);
    expect(stopIndexAt(track, 1e9)).toBe(2);
  });
});

describe('a surface craft in the store', () => {
  const rover = getBody('curiosity');
  const LANDING = 2_456_145.72;
  const STOP = JD + 1;
  const track: SurfaceTrack = {
    id: 'curiosity',
    host: 'mars',
    count: 2,
    t: [LANDING, JD - 10],
    latitudeDeg: [-4.5895, LAT],
    longitudeDeg: [137.4416, LON],
    headingDeg: [null, 146.26],
    sol: [0, 5021],
  };
  // Mars, fixed at 1.5 AU: only where the rover is relative to it matters here.
  const marsTable = {
    id: 'mars',
    horizonsId: '499',
    center: '500@0',
    count: 2,
    t: [LANDING - 1, STOP + 1],
    x: [2.2e8, 2.2e8],
    y: [0, 0],
    z: [0, 0],
    vx: [0, 0],
    vy: [0, 0],
    vz: [0, 0],
  };
  const manifest: Manifest = {
    generatedAt: '2026-10-08T00:00:00Z',
    source: { name: 'test', version: '0', url: '' },
    frame: { center: '500@0', refPlane: 'ECLIPTIC', refSystem: 'ICRF', units: 'KM-S' },
    window: { startJd: LANDING - 1, stopJd: STOP + 1, startUtc: '', stopUtc: '' },
    bodies: ['mars', 'curiosity'],
    tables: { mars: { startJd: LANDING - 1, stopJd: STOP + 1, chunks: null } },
    paths: {},
    surfaces: { curiosity: { host: 'mars', startJd: LANDING, stopJd: STOP, count: 2 } },
  };
  const store = new EphemerisStore({
    manifest,
    bodies: [{ ...mars, parent: null }, rover],
    vectors: new Map([['mars', marsTable]]),
    elements: new Map(),
    loadChunk: null,
    loadPath: null,
    loadSurface: async () => track,
  });

  it('stands where its stop says, turned with Mars, with no table of its own', async () => {
    expect(store.localState('curiosity', JD)).toBeNull(); // asked for, not here yet
    await store.whenLoadedAt(JD, ['curiosity']);
    const state = store.localState('curiosity', JD)!;
    const expected = surfaceState(mars, LAT, LON, JD);
    expect(state.position).toEqual(expected.position);
    expect(state.approximate).toBe(false);
    // An hour later Mars has turned it 14.6 degrees further round, at the same place.
    const later = store.localState('curiosity', JD + 1 / 24)!;
    const place = directionToGeographic(later.position, JD + 1 / 24, mars);
    expect(place.longitudeDeg).toBeCloseTo(LON, 9);
  });

  it('is nowhere before touchdown or after the data was built', () => {
    expect(store.isCoveredAt('curiosity', LANDING - 0.01)).toBe(false);
    expect(store.localState('curiosity', LANDING - 0.01)).toBeNull();
    expect(store.localState('curiosity', STOP + 0.01)).toBeNull();
    expect(store.surfaceStopAt('curiosity', JD - 20)?.index).toBe(0);
    expect(store.surfaceStopAt('curiosity', JD)?.index).toBe(1);
  });
});
