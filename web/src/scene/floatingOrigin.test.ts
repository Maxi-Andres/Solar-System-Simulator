import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EphemerisStore,
  loadEphemerisStore,
  type Fetcher,
} from '../core/ephemerisStore.ts';
import { orbitCenterKm, rebaseFrame } from './floatingOrigin.ts';
import { angularRadiusPixels, kmToUnits, markerOpacity } from './scale.ts';

/**
 * Scene-layer tests against the real generated data.
 *
 * There is no renderer here, but everything that decides what the scene looks like
 * — where each body ends up, how large it appears, whether it draws as a mesh or a
 * marker — is pure arithmetic and can be checked exactly. These tests predict what
 * should be on screen; the remaining unknown is only whether WebGL drew it.
 */

const DATA_ROOT = join(import.meta.dirname, '../../public');
const AU_KM = 149_597_870.7;
const HEIGHT_PX = 1080;
const FOV = 50;

const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;

async function tryLoad(): Promise<EphemerisStore | null> {
  try {
    return await loadEphemerisStore(diskFetcher, '/');
  } catch {
    return null;
  }
}

const store = await tryLoad();
const describeWithData = store === null ? describe.skip : describe;

describeWithData('rebaseFrame', () => {
  const s = store!;
  const jd = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

  it('puts the focused body exactly at the origin', () => {
    for (const focus of ['sun', 'earth', 'pluto']) {
      const snapshot = rebaseFrame(s, focus, jd);
      const focused = snapshot.bodies.get(focus)!;

      expect(focused.positionKm.x).toBe(0);
      expect(focused.positionKm.y).toBe(0);
      expect(focused.positionKm.z).toBe(0);
      expect(focused.distanceKm).toBe(0);
    }
  });

  it('includes every body and reports real distances', () => {
    const snapshot = rebaseFrame(s, 'earth', jd);

    expect(snapshot.bodies.size).toBe(10);
    // The Sun from Earth is about 1 AU, whichever way you look at it.
    expect(snapshot.bodies.get('sun')!.distanceKm / AU_KM).toBeCloseTo(1, 1);
  });

  it('changes nothing physical when the focus moves', () => {
    // Earth-Mars separation is a fact about the Solar System, not about the camera.
    const fromEarth = rebaseFrame(s, 'earth', jd).bodies.get('mars')!.distanceKm;
    const fromMars = rebaseFrame(s, 'mars', jd).bodies.get('earth')!.distanceKm;

    expect(fromEarth).toBeCloseTo(fromMars, 6);
  });

  it('reports relative speed, which does depend on the focus', () => {
    const snapshot = rebaseFrame(s, 'earth', jd);

    // Earth relative to itself is stationary...
    expect(snapshot.bodies.get('earth')!.speedKmS).toBe(0);
    // ...and the Sun appears to move at Earth's own orbital speed.
    expect(snapshot.bodies.get('sun')!.speedKmS).toBeGreaterThan(29);
    expect(snapshot.bodies.get('sun')!.speedKmS).toBeLessThan(31);
  });

  it('flags the whole frame when any body is propagated', () => {
    const inside = rebaseFrame(s, 'sun', jd);
    expect(inside.approximate).toBe(false);

    const outside = rebaseFrame(s, 'earth', s.manifest.window.stopJd + 400);
    expect(outside.approximate).toBe(true);
  });

  it('keeps rebased coordinates small enough for float32 near the camera', () => {
    // The precision argument, checked rather than asserted. Focused on Earth, the
    // Moon-scale neighbourhood must survive the float32 round trip to millimetres.
    const snapshot = rebaseFrame(s, 'earth', jd);
    const earth = snapshot.bodies.get('earth')!;
    const units = kmToUnits(earth.distanceKm);

    expect(Math.fround(units)).toBe(units);
  });
});

describeWithData('orbitCenterKm', () => {
  const s = store!;
  const jd = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

  it('returns the Sun\'s rebased position, not the scene origin', () => {
    // Orbits are heliocentric ellipses, so they must be centred on the Sun. With
    // Earth focused, the Sun is ~1 AU away, and centring the orbits at the origin
    // instead would offset every one of them by that much.
    const snapshot = rebaseFrame(s, 'earth', jd);
    const center = orbitCenterKm(snapshot, 'sun')!;

    expect(Math.hypot(center.x, center.y, center.z) / AU_KM).toBeCloseTo(1, 1);
  });

  it('is the origin when the Sun itself is focused', () => {
    const snapshot = rebaseFrame(s, 'sun', jd);
    const center = orbitCenterKm(snapshot, 'sun')!;

    expect(Math.hypot(center.x, center.y, center.z)).toBe(0);
  });

  it('returns null for a body with no data in frame', () => {
    const snapshot = rebaseFrame(s, 'sun', jd);
    expect(orbitCenterKm(snapshot, 'nibiru')).toBeNull();
  });
});

describeWithData('what the scene will actually show', () => {
  const s = store!;
  const jd = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

  it('draws every planet as a marker in the system-wide view', () => {
    // Camera pulled back to see the inner system: ~2 AU out. Every planet is far
    // under a pixel there -- Jupiter, the largest, is 0.28 px -- which is exactly
    // why markers exist at all.
    const cameraDistanceKm = 2 * AU_KM;
    const snapshot = rebaseFrame(s, 'sun', jd);

    for (const body of s.bodies) {
      if (body.id === 'sun') continue;
      const rebased = snapshot.bodies.get(body.id)!;
      const distance = Math.max(rebased.distanceKm, cameraDistanceKm);
      const px = angularRadiusPixels(body.radiusEquatorialKm, distance, HEIGHT_PX, FOV);

      expect(px).toBeLessThan(1);
      expect(markerOpacity(px)).toBe(1);
    }
  });

  it('still shows the Sun as a real disc from 2 AU, because it is one', () => {
    // The Sun is the exception, and correctly so: 695,700 km at 2 AU subtends
    // 0.266 degrees, which is 2.7 px -- inside the cross-fade band, not below it.
    // Forcing it to a marker would be the unphysical choice.
    const px = angularRadiusPixels(695_700, 2 * AU_KM, HEIGHT_PX, FOV);

    expect(px).toBeGreaterThan(2.5);
    expect(px).toBeLessThan(3);
    expect(markerOpacity(px)).toBeGreaterThan(0);
    expect(markerOpacity(px)).toBeLessThan(1);
  });

  it('draws a planet as a mesh once the camera is a few radii away', () => {
    // Framing distance used when focusing a body: 8 radii.
    for (const body of s.bodies) {
      const distance = body.radiusEquatorialKm * 8;
      const px = angularRadiusPixels(body.radiusEquatorialKm, distance, HEIGHT_PX, FOV);

      expect(px).toBeGreaterThan(6);
      expect(markerOpacity(px)).toBe(0);
    }
  });

  it('crosses from marker to mesh at a physically sensible distance', () => {
    // Solve for the distance at which Earth reaches the mesh threshold, and sanity
    // check it against the Moon's orbit: Earth should still be a marker from well
    // beyond the Moon, and a sphere from much closer in.
    const halfFov = Math.tan((FOV * Math.PI) / 360);
    const meshDistanceKm = (6378.1366 * (HEIGHT_PX / (2 * halfFov))) / 6;

    expect(meshDistanceKm).toBeGreaterThan(384_400); // farther than the Moon
    expect(meshDistanceKm).toBeLessThan(5_000_000);

    // Twice that distance halves the pixel radius to 3 px, still mid-fade; the
    // marker only takes over completely past 2.4x, at 2.5 px.
    expect(
      markerOpacity(angularRadiusPixels(6378.1366, meshDistanceKm * 2, HEIGHT_PX, FOV)),
    ).toBeGreaterThan(0.5);
    expect(markerOpacity(angularRadiusPixels(6378.1366, meshDistanceKm * 3, HEIGHT_PX, FOV))).toBe(1);
    expect(markerOpacity(angularRadiusPixels(6378.1366, meshDistanceKm * 0.5, HEIGHT_PX, FOV))).toBe(0);
  });

  it('keeps the Sun the largest thing on screen from Earth', () => {
    const snapshot = rebaseFrame(s, 'earth', jd);
    const sunPx = angularRadiusPixels(
      695_700,
      snapshot.bodies.get('sun')!.distanceKm,
      HEIGHT_PX,
      FOV,
    );

    for (const body of s.bodies) {
      if (body.id === 'sun' || body.id === 'earth') continue;
      const rebased = snapshot.bodies.get(body.id)!;
      const px = angularRadiusPixels(body.radiusEquatorialKm, rebased.distanceKm, HEIGHT_PX, FOV);

      expect(px).toBeLessThan(sunPx);
    }
  });

  it('spans the orders of magnitude the log depth buffer has to cover', () => {
    const snapshot = rebaseFrame(s, 'sun', jd);
    const distances = [...snapshot.bodies.values()]
      .map((b) => b.distanceKm)
      .filter((d) => d > 0);

    const ratio = Math.max(...distances) / Math.min(...distances);
    // Mercury to Pluto is ~100x, and adding a near plane at a metre takes the total
    // range past 1e13 -- far past what a linear depth buffer can hold.
    expect(ratio).toBeGreaterThan(50);
    expect(kmToUnits(Math.max(...distances)) / 1e-6).toBeGreaterThan(1e12);
  });
});
