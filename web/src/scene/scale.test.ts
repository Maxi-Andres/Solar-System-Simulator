import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  angularRadiusPixels,
  FOCUS_ORBIT_FULL,
  FOCUS_ORBIT_GONE,
  focusOrbitOpacity,
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
  SATELLITE_HIDDEN_PX,
  SATELLITE_SHOWN_PX,
  satelliteOpacity,
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

/**
 * The focused body's own orbit, which stops being drawn once you are close to it.
 *
 * A legibility rule rather than a physical one, and the part worth pinning is what it is
 * tied to: the body's apparent size, not a distance in kilometres. That is what makes it
 * the same rule for Pluto and for Jupiter.
 */
describe('focusOrbitOpacity', () => {
  const HEIGHT_PX = 1080;
  /** On-screen radius of a body seen from a given number of its own radii. */
  const atRadii = (radii: number) => angularRadiusPixels(1, radii, HEIGHT_PX, FOV_DEG);
  /** The fraction of the frame height a body's disc covers, which is the measure used. */
  const covering = (fraction: number) => (fraction * HEIGHT_PX) / 2;

  it('is fully drawn while the body is a small disc among others', () => {
    expect(focusOrbitOpacity(0, HEIGHT_PX)).toBe(1);
    expect(focusOrbitOpacity(covering(FOCUS_ORBIT_FULL), HEIGHT_PX)).toBe(1);
  });

  it('is gone well before the screenshot that reported it', () => {
    // The report was a frame with the body covering 38.7% of the height and its orbit
    // still at full strength, so that measurement is the anchor. It is not the threshold:
    // setting the far end there left it right in character and still too close, and it
    // moved 40% further out again. The orbit is gone by two thirds of that frame's size.
    expect(focusOrbitOpacity(covering(0.387), HEIGHT_PX)).toBe(0);
    expect(focusOrbitOpacity(covering(0.18), HEIGHT_PX)).toBe(0);
    expect(focusOrbitOpacity(covering(FOCUS_ORBIT_GONE), HEIGHT_PX)).toBe(0);
    expect(focusOrbitOpacity(HEIGHT_PX * 5, HEIGHT_PX)).toBe(0);
  });

  it('is already gone by the time the camera has framed the body', () => {
    // This reverses an earlier decision deliberately. `CameraRig` settles at 8 radii,
    // where a body covers about half the frame: close enough to be looking *at* it, which
    // is exactly when its own orbit has stopped being information about it.
    expect(focusOrbitOpacity(atRadii(8), HEIGHT_PX)).toBe(0);
    expect(focusOrbitOpacity(atRadii(1.05), HEIGHT_PX)).toBe(0);
  });

  it('is well on its way out long before that', () => {
    // The correction that mattered, three times over: the fade has to happen while the
    // body is still small, not once it already dominates the frame. At forty of its own
    // radii a body is a small disc with plenty of room around it, and the orbit is already
    // half gone.
    expect(focusOrbitOpacity(atRadii(60), HEIGHT_PX)).toBeLessThan(0.9);
    expect(focusOrbitOpacity(atRadii(40), HEIGHT_PX)).toBeLessThan(0.7);
    expect(focusOrbitOpacity(atRadii(40), HEIGHT_PX)).toBeGreaterThan(0.3);
    expect(focusOrbitOpacity(atRadii(30), HEIGHT_PX)).toBeLessThan(0.35);
  });

  it("is gone by twenty-five of the body's own radii", () => {
    // The distance the threshold was actually asked for in. It is stored as an apparent
    // size, because converting one into the other needs a field of view and this has to
    // survive someone changing that — so this is the test that keeps the two agreeing.
    expect(focusOrbitOpacity(atRadii(25), HEIGHT_PX)).toBe(0);
    expect(focusOrbitOpacity(atRadii(28), HEIGHT_PX)).toBeGreaterThan(0);
  });

  it('takes tens of radii rather than a moment', () => {
    // Count the radii over which it is neither fully there nor fully gone. This is the
    // test the first version failed: it had the whole fade inside a two-radius approach.
    const partial: number[] = [];
    for (let radii = 200; radii >= 1.05; radii -= 0.1) {
      const opacity = focusOrbitOpacity(atRadii(radii), HEIGHT_PX);
      if (opacity > 0.01 && opacity < 0.99) {
        partial.push(radii);
      }
    }

    expect(Math.max(...partial) - Math.min(...partial)).toBeGreaterThan(20);
  });

  it('only ever fades as you approach', () => {
    let previous = 1.0001;
    for (let radii = 200; radii >= 1.05; radii -= 0.25) {
      const opacity = focusOrbitOpacity(atRadii(radii), HEIGHT_PX);
      expect(opacity).toBeLessThanOrEqual(previous + 1e-9);
      expect(opacity).toBeGreaterThanOrEqual(0);
      previous = opacity;
    }
  });

  it('is the same rule at any viewport height', () => {
    // Tied to apparent size, so a taller window does not change when the orbit goes.
    for (const height of [400, 1080, 2160]) {
      expect(
        focusOrbitOpacity(angularRadiusPixels(1, 16, height, FOV_DEG), height),
      ).toBeCloseTo(focusOrbitOpacity(angularRadiusPixels(1, 16, 1080, FOV_DEG), 1080), 6);
    }
  });
});

describe('satelliteOpacity', () => {
  const AU = 149_597_870.7;
  const orbitPx = (orbitKm: number, fromKm: number): number =>
    angularRadiusPixels(orbitKm, fromKm, 1080, FOV_DEG);

  it('fades a moon in between its two thresholds, and nowhere else', () => {
    expect(satelliteOpacity(SATELLITE_HIDDEN_PX)).toBe(0);
    expect(satelliteOpacity(SATELLITE_HIDDEN_PX - 1)).toBe(0);
    expect(satelliteOpacity(SATELLITE_SHOWN_PX)).toBe(1);
    expect(satelliteOpacity(SATELLITE_SHOWN_PX * 10)).toBe(1);
    expect(satelliteOpacity((SATELLITE_HIDDEN_PX + SATELLITE_SHOWN_PX) / 2)).toBeCloseTo(0.5, 9);
  });

  it('keeps the Galileans off Jupiter in a view of the whole planetary system', () => {
    // Callisto, the widest, from 4.2 AU -- about where Earth sees Jupiter from.
    expect(satelliteOpacity(orbitPx(1_882_700, 4.2 * AU))).toBe(0);
    // And the Moon, from the far side of the Sun.
    expect(satelliteOpacity(orbitPx(384_400, 2 * AU))).toBe(0);
  });

  it('opens the system up well before the planet itself stops being a dot', () => {
    // Io's orbit is fully shown from 0.2 AU, where Jupiter is still a sub-pixel point.
    expect(satelliteOpacity(orbitPx(421_800, 0.2 * AU))).toBe(1);
    expect(angularRadiusPixels(71_492, 0.2 * AU, 1080, FOV_DEG)).toBeLessThan(6);
  });

  it('shows every moon when its own planet is in focus at the framing distance', () => {
    // CameraRig settles at eight radii. Phobos, closest to its planet of any moon here
    // at 2.8 Mars radii, is the hardest case.
    expect(satelliteOpacity(orbitPx(9_376, 8 * 3_396.19))).toBe(1);
  });
});
