import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  angularRadiusPixels,
  FOV_DEG,
  KM_PER_UNIT,
  kmToUnits,
  markerOpacity,
  MARKER_FADE_OUT_PX,
  MARKER_FULL_PX,
  MESH_FADE_END_PX,
  MESH_FADE_START_PX,
  meshOpacity,
  pixelsToWorldSize,
  toSceneUnits,
  unitsToKm,
} from './scale.ts';

const AU_KM = 149_597_870.7;
const FOV = FOV_DEG;
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
 * tan(fov/2)/(fov/2) -- about 1.9% at this field of view, and 6.9% at the 50 degrees it
 * used to be. Undoing the projection properly is what lets these tests assert real
 * published apparent sizes.
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
    // Earth viewed from the Sun's distance: a tenth of a pixel. Drawing it as a
    // true-scale sphere would render nothing at all.
    //
    // The bound moves with the field of view -- a narrower one magnifies everything, so
    // it was 0.06 px at the 50 degrees this used to be -- and the conclusion does not.
    // Nothing here is within two orders of magnitude of being visible.
    expect(angularRadiusPixels(6378.1366, AU_KM, HEIGHT, FOV)).toBeLessThan(0.15);
    // Pluto from Earth is worse by another two orders of magnitude.
    expect(angularRadiusPixels(1188.3, 5.9e9, HEIGHT, FOV)).toBeLessThan(0.002);
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

/**
 * The field of view, which is the one camera setting that changes what the scene *looks*
 * like rather than what it contains.
 *
 * Reported as a fisheye: a planet filling the frame was being seen from 8,700 km up,
 * because that is where 50 degrees puts you. Nothing about the projection was wrong --
 * which is exactly why this needs a test with numbers in it rather than an opinion.
 */
describe('the field of view', () => {
  /** How far from a planet's centre you stand when it fills the frame, in its radii. */
  const framingDistance = (fovDeg: number) => 1 / Math.sin((fovDeg * Math.PI) / 360);

  /** Fraction of a sphere's surface visible from that distance. */
  const visibleSurface = (fovDeg: number) => (1 - 1 / framingDistance(fovDeg)) / 2;

  it('is the vertical field of a 50 mm lens on 35 mm film', () => {
    // The photographic definition of a normal lens: the focal length that renders
    // perspective without wide-angle exaggeration. A derived value, not a preference.
    const normalLens = (2 * Math.atan(12 / 50) * 180) / Math.PI;

    expect(FOV_DEG).toBeCloseTo(normalLens, 0);
    expect(normalLens).toBeCloseTo(26.99, 2);
  });

  it('stands far enough back that a planet is nearly orthographic', () => {
    // A real image of a planet is taken from far away through a narrow field, so it is
    // very nearly an orthographic projection and shows half the sphere. This is the
    // measure of how close to that the render gets.
    expect(framingDistance(FOV_DEG)).toBeGreaterThan(4);
    expect(visibleSurface(FOV_DEG)).toBeGreaterThan(0.38);
  });

  it('shows a third more of a planet than the wide angle it replaced', () => {
    // The defect, in the units that make it a defect. At 50 degrees a full-frame Earth
    // was seen from 8,700 km and everything past 65 degrees from the sub-camera point
    // was crushed into the rim.
    expect(framingDistance(50)).toBeCloseTo(2.37, 2);
    expect(visibleSurface(50)).toBeCloseTo(0.289, 3);
    expect(visibleSurface(FOV_DEG) / visibleSurface(50)).toBeGreaterThan(1.3);
  });

  it('is still wide enough to navigate with', () => {
    // The trade is real: a narrower field means standing further back to see the same
    // thing, and the zoom range is finite. Past about 15 degrees this stops being a
    // camera and starts being a telescope.
    expect(FOV_DEG).toBeGreaterThan(15);
    expect(FOV_DEG).toBeLessThan(40);
  });
});

/**
 * That the field of view actually reaches the camera.
 *
 * A source-text test, like the favicon one, and for the same reason: this is wiring, and
 * no unit test can reach it -- there is no renderer here to ask what the camera is doing.
 *
 * It exists because the obvious way to set a field of view **does not work and does not
 * complain**. react-three-fiber configures the camera inside `if (!state.camera || ...)`,
 * so the object literal on `<Canvas camera={{ fov }}>` is read exactly once, when the
 * camera does not yet exist, and every later change to it is ignored. The constant was
 * moved from 27 to 90 -- a third of a turn, impossible to miss -- and the picture did not
 * change at all.
 */
describe('the field of view reaches the camera', () => {
  const read = (file: string) => readFile(join(import.meta.dirname, file), 'utf8');

  it('is set imperatively by the rig, not only handed to the Canvas', async () => {
    const canvas = await read('SolarSystemCanvas.tsx');
    const rig = await read('CameraRig.tsx');

    // Still passed to the Canvas, so the very first frame is already right.
    expect(canvas).toMatch(/camera=\{\{\s*fov: FOV_DEG/);
    // And owned by the rig, so every later change to it lands.
    expect(canvas).toContain('fovDeg={FOV_DEG}');
    expect(rig).toContain('perspective.fov = fovDeg');
    expect(rig).toContain('perspective.updateProjectionMatrix()');
  });

  it('reacts to the value rather than only to the camera', async () => {
    // The dependency that makes it a live setting instead of a one-off: without fovDeg
    // in it, editing the constant would again change nothing until a full reload.
    const rig = await read('CameraRig.tsx');

    expect(rig).toMatch(/\}, \[camera, fovDeg\]\)/);
  });

  it('leaves the aspect ratio to react-three-fiber', async () => {
    // Setting camera.manual would take over the frustum entirely, including the aspect
    // handling on resize, which works and is not ours to break.
    const rig = await read('CameraRig.tsx');

    expect(rig).not.toContain('manual = true');
  });
});
