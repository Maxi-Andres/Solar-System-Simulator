import { describe, expect, it } from 'vitest';

import { J2000_JD } from '../core/time.ts';
import {
  angularRadiusPixels,
  KM_PER_UNIT,
  kmToUnits,
  markerOpacity,
  MARKER_FADE_OUT_PX,
  MARKER_FULL_PX,
  MESH_FADE_END_PX,
  MESH_FADE_START_PX,
  meshOpacity,
  pixelsToWorldSize,
  rotationAngle,
  toSceneUnits,
  unitsToKm,
} from './scale.ts';

const AU_KM = 149_597_870.7;
const FOV = 50;
const HEIGHT = 1080;

describe('scene units', () => {
  it('round-trips kilometres', () => {
    expect(unitsToKm(kmToUnits(123_456.789))).toBeCloseTo(123_456.789, 9);
  });

  it('keeps familiar distances in a readable range', () => {
    expect(kmToUnits(6378.1366)).toBeCloseTo(6.3781366, 6); // Earth radius
    expect(kmToUnits(AU_KM)).toBeCloseTo(149_597.8707, 3); // 1 AU
    expect(kmToUnits(5.9e9)).toBeCloseTo(5.9e6, 0); // Pluto's distance
  });

  it('converts vectors componentwise', () => {
    expect(toSceneUnits({ x: 1000, y: -2000, z: 500 })).toEqual([1, -2, 0.5]);
  });

  it('leaves float32 enough precision at Pluto for the error to stay sub-pixel', () => {
    // The floating-origin argument, made concrete. At Pluto's distance a float32
    // quantises position in steps of ~0.5 units; that is only acceptable because
    // the body is 5.9e9 km away, where half a scene unit is far below one pixel.
    const plutoUnits = kmToUnits(5.9e9);
    const ulpUnits = Math.abs(plutoUnits) * 2 ** -23;
    const ulpKm = ulpUnits * KM_PER_UNIT;

    expect(ulpKm).toBeGreaterThan(100); // it really is hundreds of km
    // ...and yet its on-screen size is nothing.
    expect(angularRadiusPixels(ulpKm, 5.9e9, HEIGHT, FOV)).toBeLessThan(0.01);
  });
});

/**
 * Recovers the angular diameter, in degrees, from a pixel radius.
 *
 * Perspective projection is linear in the TANGENT of the angle, not in the angle
 * itself, so dividing pixels by viewport height and scaling by the FOV is wrong by
 * tan(fov/2)/(fov/2) -- about 6.9% at a 50 degree FOV. Undoing the projection
 * properly is what lets these tests assert real published apparent sizes.
 */
function pixelsToAngularDiameterDeg(pixels: number): number {
  const halfFovRad = (FOV * Math.PI) / 360;
  const tangent = (pixels * 2 * Math.tan(halfFovRad)) / HEIGHT;
  return (2 * Math.atan(tangent) * 180) / Math.PI;
}

describe('angularRadiusPixels', () => {
  it('matches the Sun\'s known apparent size from Earth', () => {
    // The Sun subtends 0.533 degrees from Earth. This is the check that calibrates
    // the whole adaptive-scale chain against something real and published.
    const pixels = angularRadiusPixels(695_700, AU_KM, HEIGHT, FOV);

    expect(pixelsToAngularDiameterDeg(pixels)).toBeCloseTo(0.533, 3);
  });

  it('matches the Moon\'s known apparent size from Earth', () => {
    // The Moon is famously almost exactly the Sun's apparent size: 0.518 degrees at
    // its mean distance, which is why total eclipses work at all.
    const pixels = angularRadiusPixels(1737.4, 384_400, HEIGHT, FOV);

    expect(pixelsToAngularDiameterDeg(pixels)).toBeCloseTo(0.518, 3);
  });

  it('agrees with the apparent size of Jupiter from Earth near opposition', () => {
    // Jupiter spans about 47 arcseconds at ~4.2 AU.
    const pixels = angularRadiusPixels(71_492, 4.2 * AU_KM, HEIGHT, FOV);

    expect(pixelsToAngularDiameterDeg(pixels) * 3600).toBeCloseTo(47, 0);
  });

  it('falls off inversely with distance', () => {
    const near = angularRadiusPixels(6378, 1e6, HEIGHT, FOV);
    const far = angularRadiusPixels(6378, 2e6, HEIGHT, FOV);

    expect(near / far).toBeCloseTo(2, 6);
  });

  it('scales with viewport height', () => {
    const small = angularRadiusPixels(6378, 1e6, 540, FOV);
    const large = angularRadiusPixels(6378, 1e6, 1080, FOV);

    expect(large / small).toBeCloseTo(2, 6);
  });

  it('explains why markers are needed at all', () => {
    // Earth viewed from the Sun's distance: comfortably sub-pixel. Drawing it as a
    // true-scale sphere would render nothing at all.
    expect(angularRadiusPixels(6378.1366, AU_KM, HEIGHT, FOV)).toBeLessThan(0.06);
    // Pluto from Earth is worse by another two orders of magnitude.
    expect(angularRadiusPixels(1188.3, 5.9e9, HEIGHT, FOV)).toBeLessThan(0.001);
  });

  it('treats a zero distance as filling the view', () => {
    expect(angularRadiusPixels(6378, 0, HEIGHT, FOV)).toBe(Infinity);
  });
});

describe('marker and mesh opacity', () => {
  it('draws the ring fully around a small sphere', () => {
    expect(markerOpacity(0.01)).toBe(1);
    expect(markerOpacity(MARKER_FULL_PX)).toBe(1);
  });

  it('drops the ring once the sphere outgrows it', () => {
    expect(markerOpacity(MARKER_FADE_OUT_PX)).toBe(0);
    expect(markerOpacity(500)).toBe(0);
  });

  it('keeps the sphere fully drawn while it is still visible', () => {
    // The regression: the sphere used to vanish at 2.5 px, while still a 5 px wide
    // disc. It must stay solid there now.
    expect(meshOpacity(2.5)).toBe(1);
    expect(meshOpacity(MESH_FADE_START_PX)).toBe(1);
    expect(meshOpacity(50)).toBe(1);
  });

  it('only fades the sphere once it is essentially sub-pixel', () => {
    expect(meshOpacity(MESH_FADE_END_PX)).toBe(0);
    expect(meshOpacity(0)).toBe(0);
    expect(meshOpacity(0.9)).toBeGreaterThan(0);
    expect(meshOpacity(0.9)).toBeLessThan(1);
  });

  it('overlaps: both are visible together across a wide band', () => {
    // This is what removes the pop. Between the ring being full and the sphere
    // starting to fade, you see a dot inside a ring -- exactly the NASA Eyes look.
    for (const px of [0.5, 1, 2, 3, 4]) {
      expect(markerOpacity(px)).toBeGreaterThan(0);
      expect(meshOpacity(px)).toBeGreaterThan(0);
    }
  });

  it('never leaves nothing on screen at any size', () => {
    // The actual bug: at some distances the sphere was gone and the marker had not
    // taken over. Sweeping every scale, something must always be drawn.
    for (let px = 0; px <= 40; px += 0.05) {
      expect(markerOpacity(px) + meshOpacity(px)).toBeGreaterThan(0.05);
    }
  });

  it('moves monotonically, so nothing flickers as you approach', () => {
    let ring = markerOpacity(0);
    let sphere = meshOpacity(0);
    for (let px = 0; px <= 20; px += 0.05) {
      const nextRing = markerOpacity(px);
      const nextSphere = meshOpacity(px);
      expect(nextRing).toBeLessThanOrEqual(ring + 1e-9);
      expect(nextSphere).toBeGreaterThanOrEqual(sphere - 1e-9);
      ring = nextRing;
      sphere = nextSphere;
    }
  });

  it('stays inside [0, 1]', () => {
    for (let px = 0; px <= 40; px += 0.25) {
      for (const value of [markerOpacity(px), meshOpacity(px)]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('pixelsToWorldSize', () => {
  it('inverts angularRadiusPixels', () => {
    const distanceUnits = kmToUnits(4e8);
    const worldSize = pixelsToWorldSize(20, distanceUnits, HEIGHT, FOV);

    // pixelsToWorldSize returns a full size; angularRadiusPixels takes a radius.
    const backToPixels = angularRadiusPixels(
      unitsToKm(worldSize / 2),
      unitsToKm(distanceUnits),
      HEIGHT,
      FOV,
    );

    expect(backToPixels).toBeCloseTo(10, 6);
  });

  it('grows linearly with distance, keeping on-screen size constant', () => {
    const near = pixelsToWorldSize(11, 100, HEIGHT, FOV);
    const far = pixelsToWorldSize(11, 1000, HEIGHT, FOV);

    expect(far / near).toBeCloseTo(10, 9);
  });
});

describe('rotationAngle', () => {
  it('completes one turn per rotation period', () => {
    const oneDay = rotationAngle(J2000_JD + 1, J2000_JD, 24);

    expect(oneDay).toBeCloseTo(2 * Math.PI, 12);
  });

  it('turns Earth once per sidereal day, not once per solar day', () => {
    // 23h 56m 4s, so after 24 hours Earth has over-rotated by about 1 degree.
    const afterOneSolarDay = rotationAngle(J2000_JD + 1, J2000_JD, 23.9344695);
    const extraDegrees = ((afterOneSolarDay - 2 * Math.PI) * 180) / Math.PI;

    expect(extraDegrees).toBeCloseTo(0.986, 2);
  });

  it('runs backwards for retrograde rotators', () => {
    // Venus: -5832.5 hours.
    expect(rotationAngle(J2000_JD + 100, J2000_JD, -5832.5)).toBeLessThan(0);
    expect(rotationAngle(J2000_JD + 100, J2000_JD, 23.93)).toBeGreaterThan(0);
  });

  it('is zero at the epoch and reverses with time', () => {
    expect(rotationAngle(J2000_JD, J2000_JD, 24)).toBe(0);
    expect(rotationAngle(J2000_JD - 1, J2000_JD, 24)).toBeCloseTo(-2 * Math.PI, 12);
  });

  it('does not divide by zero for a non-rotating body', () => {
    expect(rotationAngle(J2000_JD + 500, J2000_JD, 0)).toBe(0);
  });
});
