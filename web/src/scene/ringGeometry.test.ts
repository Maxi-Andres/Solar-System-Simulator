import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { getBody } from '@sss/tools/catalog';
import { J2000_JD } from '../core/time.ts';
import { poleDirection } from './orientation.ts';
import { RING_SEGMENTS, ringGeometry, ringRadiusKm } from './ringGeometry.ts';
import { kmToUnits } from './scale.ts';

/**
 * Saturn's rings: the geometry, and whether the texture lands on the right radii.
 *
 * The geometry half is ordinary. The calibration half is the interesting one, and it
 * is the same shape of problem as the 180-degree texture error from 6a: the map is a
 * radial strip and nothing in the file says which radii its edges are. Assume wrongly
 * and the Cassini Division sits somewhere plausible and wrong, with no
 * self-consistency check able to notice.
 *
 * So the catalog's two radii were fitted against surveyed ring boundaries, and these
 * tests re-derive that fit from the shipped image rather than trusting the numbers.
 */

const saturn = getBody('saturn');
const rings = saturn.rings!;

describe('the annulus', () => {
  const geometry = ringGeometry(rings.innerRadiusKm, rings.outerRadiusKm);
  const position = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  const normal = geometry.attributes.normal!;

  it('has two vertices per angular step and closes the circle', () => {
    expect(position.count).toBe((RING_SEGMENTS + 1) * 2);

    // First and last angular steps sit at the same place: theta 0 and 2*pi.
    expect(position.getX(0)).toBeCloseTo(position.getX(RING_SEGMENTS * 2), 6);
    expect(position.getY(0)).toBeCloseTo(position.getY(RING_SEGMENTS * 2), 6);
  });

  it('puts every vertex at the inner or the outer radius, and nowhere between', () => {
    const inner = kmToUnits(rings.innerRadiusKm);
    const outer = kmToUnits(rings.outerRadiusKm);

    for (let i = 0; i < position.count; i += 1) {
      const radius = Math.hypot(position.getX(i), position.getY(i));
      const expected = i % 2 === 0 ? inner : outer;

      // Relative, because the buffer is float32: 69.942 units comes back as
      // 69.94200134, which is 20 metres on a 70,000 km radius.
      expect(Math.abs(radius / expected - 1)).toBeLessThan(1e-6);
      // Flat: the whole ring is in its own z = 0 plane.
      expect(position.getZ(i)).toBe(0);
    }
  });

  it('maps u to radius, which is what a radial strip needs', () => {
    // The failure this guards against is three.js's own RingGeometry, whose planar
    // UVs would draw the Cassini Division as a straight band across the rings rather
    // than as a circle.
    for (let i = 0; i < uv.count; i += 1) {
      expect(uv.getX(i)).toBe(i % 2 === 0 ? 0 : 1);
      // Constant vertically, so v carries nothing.
      expect(uv.getY(i)).toBe(0.5);
    }
  });

  it('faces along its own +z, which the quaternion swings onto the pole', () => {
    for (let i = 0; i < normal.count; i += 1) {
      expect(normal.getX(i)).toBe(0);
      expect(normal.getY(i)).toBe(0);
      expect(normal.getZ(i)).toBe(1);
    }
  });

  it('winds every triangle counter-clockwise seen from +z', () => {
    // A flipped winding would make the front face the back one. With DoubleSide it
    // would still draw, so nothing would look obviously broken -- the lighting would
    // just be subtly wrong on both faces, which is exactly the kind of error that
    // survives a visual check.
    const index = geometry.getIndex()!;
    expect(index.count).toBe(RING_SEGMENTS * 6);

    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      const ax = position.getX(a);
      const ay = position.getY(a);
      const cross =
        (position.getX(b) - ax) * (position.getY(c) - ay) -
        (position.getY(b) - ay) * (position.getX(c) - ax);

      expect(cross, `triangle at ${t}`).toBeGreaterThan(0);
    }
  });

  it('keeps the chord error far below anything visible', () => {
    // A polygon of N sides cuts inside its circle by r * (1 - cos(pi / N)).
    const sagittaKm = rings.outerRadiusKm * (1 - Math.cos(Math.PI / RING_SEGMENTS));

    expect(sagittaKm).toBeLessThan(5);
    // And in units of the thing it sits next to, which is what actually matters.
    expect(sagittaKm / saturn.radiusEquatorialKm).toBeLessThan(1e-4);
  });
});

describe('the rings lie in the equatorial plane', () => {
  it('turns the ring normal onto the IAU pole', () => {
    const pole = poleDirection(J2000_JD, saturn);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(pole.x, pole.y, pole.z),
    );
    const turned = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

    expect(turned.x).toBeCloseTo(pole.x, 9);
    expect(turned.y).toBeCloseTo(pole.y, 9);
    expect(turned.z).toBeCloseTo(pole.z, 9);
  });

  it('tips the ring plane 28 degrees out of the ecliptic, which is why they open and close', () => {
    // Saturn's rings appear edge-on twice per 29.5-year orbit and wide open in
    // between, and this angle is the whole reason. If the ring plane followed the
    // ecliptic instead, they would never change aspect.
    const pole = poleDirection(J2000_JD, saturn);
    const fromEclipticNorth = (Math.acos(pole.z) * 180) / Math.PI;

    expect(fromEclipticNorth).toBeCloseTo(28.05, 1);
  });
});

/** The shipped ring image, read at module scope so the describe body stays sync. */
const png = PNG.sync.read(
  await readFile(join(import.meta.dirname, '../../public/textures', rings.texture)),
);

describe('the texture calibration, re-derived from the shipped image', () => {
  /** Mean alpha of each column: the ring's radial opacity profile. */
  const profile = (() => {
    const columns = new Float64Array(png.width);
    for (let x = 0; x < png.width; x += 1) {
      let total = 0;
      for (let y = 0; y < png.height; y += 1) {
        total += png.data[(y * png.width + x) * 4 + 3]!;
      }
      columns[x] = total / png.height;
    }
    return columns;
  })();

  /** Smoothed derivative, for locating edges. */
  const gradient = (() => {
    const smooth = new Float64Array(png.width);
    for (let x = 0; x < png.width; x += 1) {
      let total = 0;
      let n = 0;
      for (let k = -2; k <= 2; k += 1) {
        const i = x + k;
        if (i >= 0 && i < png.width) {
          total += profile[i]!;
          n += 1;
        }
      }
      smooth[x] = total / n;
    }
    const g = new Float64Array(png.width);
    for (let x = 1; x < png.width - 1; x += 1) {
      g[x] = smooth[x + 1]! - smooth[x - 1]!;
    }
    return g;
  })();

  /** Steepest rise (sign +1) or fall (sign -1) within a fractional window. */
  function edge(fromFraction: number, toFraction: number, sign: 1 | -1): number {
    const from = Math.floor(fromFraction * png.width);
    const to = Math.floor(toFraction * png.width);
    let best = from;
    for (let x = from; x < to; x += 1) {
      if (sign * gradient[x]! > sign * gradient[best]!) {
        best = x;
      }
    }
    return best / png.width;
  }

  it('is a radial strip: alpha varies across it and not down it', () => {
    // The premise of the whole mapping. If this ever failed, the texture would be a
    // picture rather than a strip and the UVs would have to change with it.
    let downColumn = 0;
    for (let x = 0; x < png.width; x += 1) {
      let min = 255;
      let max = 0;
      for (let y = 0; y < png.height; y += 1) {
        const a = png.data[(y * png.width + x) * 4 + 3]!;
        min = Math.min(min, a);
        max = Math.max(max, a);
      }
      downColumn = Math.max(downColumn, max - min);
    }

    // 6 of 255 in the shipped 2k file, from the publisher's own downsampling of an
    // 8k original that measures 0. Two percent of the range, so `v` still carries
    // nothing worth sampling.
    expect(downColumn).toBeLessThan(10);
    // And it does vary radially, or there would be no rings to draw.
    expect(Math.max(...profile) - Math.min(...profile)).toBeGreaterThan(200);
  });

  /**
   * Surveyed radii of the boundaries visible in the alpha profile, in km.
   *
   * These are the features the catalog's two radii were fitted against, so this test
   * re-derives that fit from the file and holds it to the residual it was quoted at.
   */
  const BOUNDARIES: readonly {
    readonly name: string;
    readonly window: readonly [number, number];
    readonly sign: 1 | -1;
    readonly radiusKm: number;
  }[] = [
    { name: 'C ring inner edge', window: [0.03, 0.1], sign: 1, radiusKm: 74658 },
    { name: 'C to B step', window: [0.26, 0.34], sign: 1, radiusKm: 91975 },
    { name: 'B outer / Cassini inner', window: [0.63, 0.7], sign: -1, radiusKm: 117507 },
    { name: 'Cassini outer / A inner', window: [0.7, 0.76], sign: 1, radiusKm: 122340 },
    { name: 'A ring outer edge', window: [0.91, 0.97], sign: -1, radiusKm: 136780 },
  ];

  it('places every surveyed ring boundary within the residual the fit was quoted at', () => {
    const errors = BOUNDARIES.map((boundary) => {
      const u = edge(boundary.window[0], boundary.window[1], boundary.sign);
      return ringRadiusKm(u, rings.innerRadiusKm, rings.outerRadiusKm) - boundary.radiusKm;
    });
    const rms = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);

    // 1365 km measured. Held a little loose so JPEG-free PNG resampling or a
    // publisher re-release does not fail the build over a hundred kilometres.
    expect(rms).toBeLessThan(1600);
    for (const [i, error] of errors.entries()) {
      expect(Math.abs(error), BOUNDARIES[i]!.name).toBeLessThan(2200);
    }
  });

  it('is honest that the residual exceeds the Encke Gap it claims to draw', () => {
    // Not a failure -- a limit, and one the catalog comment and CREDITS.md both
    // state. The gap is 325 km wide and the calibration is good to about 1400, so
    // the divisions are present and roughly placed rather than surveyed. This test
    // exists so that statement cannot quietly become false in either direction.
    const ENCKE_WIDTH_KM = 325;
    const u = (() => {
      let best = Math.floor(0.86 * png.width);
      for (let x = best; x < Math.floor(0.93 * png.width); x += 1) {
        if (profile[x]! < profile[best]!) {
          best = x;
        }
      }
      return best / png.width;
    })();
    const error = Math.abs(
      ringRadiusKm(u, rings.innerRadiusKm, rings.outerRadiusKm) - 133589,
    );

    expect(error).toBeGreaterThan(ENCKE_WIDTH_KM);
    expect(error).toBeLessThan(1600);
  });

  it('leaves the space inside and outside the rings transparent', () => {
    // Saturn's equatorial radius is 60,268 km and the C ring starts at 74,658, so
    // there is real empty space to represent. If the strip were opaque to its edges
    // the ring would render as a solid disc touching the planet.
    expect(profile[0]!).toBeLessThan(5);
    expect(profile[png.width - 1]!).toBeLessThan(20);
  });

  it('starts the rings outside Saturn itself', () => {
    // A ring intersecting the planet would be a modelling error visible from any
    // angle. 69,942 km against an equatorial radius of 60,268.
    expect(rings.innerRadiusKm).toBeGreaterThan(saturn.radiusEquatorialKm);
    expect(rings.outerRadiusKm).toBeGreaterThan(rings.innerRadiusKm);
    // And they really are this large: 2.35 planetary radii across.
    expect(rings.outerRadiusKm / saturn.radiusEquatorialKm).toBeCloseTo(2.35, 1);
  });
});
