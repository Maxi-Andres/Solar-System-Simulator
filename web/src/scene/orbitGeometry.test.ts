import type { OsculatingElements } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { orbitPointsKm, orbitSegmentsFor, propagate } from '../core/kepler.ts';

/**
 * Regression tests for the "the orbit does not pass through the planet" bug.
 *
 * Two independent causes, both fixed here, both easy to reintroduce:
 *   1. Too few polyline segments, so the chord cuts inside the ellipse.
 *   2. Float32 vertices stored relative to the Sun, which cancel catastrophically
 *      when the focused body is at the far end of that same vector.
 *
 * The OrbitLine class itself needs a WebGL context, so these test the arithmetic it
 * depends on, which is where both bugs actually lived.
 */

/** Pluto: the worst case, because its orbit is huge and its body is tiny. */
const PLUTO: OsculatingElements = {
  id: 'pluto',
  center: '500@10',
  epochJd: 2461276.5,
  eccentricity: 0.2489,
  periapsisKm: 4.436e9,
  inclinationDeg: 17.09,
  ascendingNodeDeg: 110.3,
  argPeriapsisDeg: 113.8,
  periapsisTimeJd: 2447892.5,
  meanMotionDegPerSec: 4.5e-8,
  meanAnomalyDeg: 52.3,
  trueAnomalyDeg: 68.1,
  semiMajorAxisKm: 5.906e9,
  apoapsisKm: 7.376e9,
  periodSec: 7.82e9,
};

const PLUTO_RADIUS_KM = 1188.3;
const EARTH_RADIUS_KM = 6378.1366;

/** Perpendicular distance from a point to a line segment, all in km. */
function distanceToSegment(
  p: readonly [number, number, number],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const ab: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap: [number, number, number] = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const lengthSquared = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  if (lengthSquared === 0) {
    return Math.hypot(...ap);
  }
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / lengthSquared));
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
}

/** Sagitta: how far a chord falls inside the arc it spans. */
function sagitta(radiusKm: number, segments: number): number {
  return radiusKm * (1 - Math.cos(Math.PI / segments));
}

describe('orbitSegmentsFor', () => {
  it('keeps the chord error under one body radius', () => {
    const cases: readonly (readonly [number, number])[] = [
      [1.5e8, EARTH_RADIUS_KM],
      [2.3e8, 3396.19],
      [7.8e8, 71492],
      [4.5e9, 24764],
      [7.376e9, PLUTO_RADIUS_KM],
    ];

    for (const [orbitRadius, bodyRadius] of cases) {
      const segments = orbitSegmentsFor(orbitRadius, bodyRadius);
      expect(sagitta(orbitRadius, segments)).toBeLessThanOrEqual(bodyRadius * 1.01);
    }
  });

  it('gives Pluto far more segments than Earth, because it needs them', () => {
    const earth = orbitSegmentsFor(1.5e8, EARTH_RADIUS_KM);
    const pluto = orbitSegmentsFor(7.376e9, PLUTO_RADIUS_KM);

    expect(pluto).toBeGreaterThan(earth * 5);
  });

  it('shows why a fixed 512 segments was the bug', () => {
    // The regression, stated as a number: at 512 segments Pluto's orbit line falls
    // more than ninety Pluto radii inside the true ellipse.
    expect(sagitta(7.376e9, 512) / PLUTO_RADIUS_KM).toBeGreaterThan(90);
    // With the adaptive count it is under one.
    const adaptive = orbitSegmentsFor(7.376e9, PLUTO_RADIUS_KM);
    expect(sagitta(7.376e9, adaptive) / PLUTO_RADIUS_KM).toBeLessThan(1.01);
  });

  it('stays inside its bounds', () => {
    expect(orbitSegmentsFor(1e6, 1e6)).toBeGreaterThanOrEqual(256);
    expect(orbitSegmentsFor(1e15, 1)).toBeLessThanOrEqual(8192);
    // Degenerate inputs must not produce NaN or Infinity.
    expect(orbitSegmentsFor(0, 100)).toBe(256);
    expect(orbitSegmentsFor(100, 0)).toBe(256);
  });
});

describe('orbitPointsKm', () => {
  it('produces float64, not float32', () => {
    const points = orbitPointsKm(PLUTO, 64);

    expect(points).toBeInstanceOf(Float64Array);
    expect(points).toHaveLength(64 * 3);
  });

  it('does not repeat the closing point, since LineLoop closes itself', () => {
    const points = orbitPointsKm(PLUTO, 8);
    const first = [points[0], points[1], points[2]];
    const last = [points[21], points[22], points[23]];

    expect(last).not.toEqual(first);
  });

  it('spans periapsis to apoapsis', () => {
    const points = orbitPointsKm(PLUTO, 2048);
    let closest = Infinity;
    let farthest = 0;

    for (let i = 0; i < points.length; i += 3) {
      const r = Math.hypot(points[i]!, points[i + 1]!, points[i + 2]!);
      closest = Math.min(closest, r);
      farthest = Math.max(farthest, r);
    }

    expect(closest / PLUTO.periapsisKm).toBeCloseTo(1, 2);
    expect(farthest / PLUTO.apoapsisKm).toBeCloseTo(1, 2);
  });

  it('passes through the propagated body position, which is the whole point', () => {
    // Measured to the drawn SEGMENTS, not to the vertices. Distance to a vertex is
    // bounded by half the vertex spacing, which for Pluto is millions of km and says
    // nothing about what is on screen; what the eye sees is the line itself.
    const segments = orbitSegmentsFor(PLUTO.apoapsisKm, PLUTO_RADIUS_KM);
    const points = orbitPointsKm(PLUTO, segments);
    const body = propagate(PLUTO, PLUTO.epochJd);

    let nearest = Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const j = (i + 3) % points.length;
      nearest = Math.min(
        nearest,
        distanceToSegment(
          [body.position.x, body.position.y, body.position.z],
          [points[i]!, points[i + 1]!, points[i + 2]!],
          [points[j]!, points[j + 1]!, points[j + 2]!],
        ),
      );
    }

    // Under two body radii: at that point the line visually goes through Pluto.
    expect(nearest / PLUTO_RADIUS_KM).toBeLessThan(2);
  });

  it('would miss by hundreds of radii at the old fixed 512 segments', () => {
    // The regression this replaced, measured the same honest way.
    const points = orbitPointsKm(PLUTO, 512);
    const body = propagate(PLUTO, PLUTO.epochJd);

    let nearest = Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const j = (i + 3) % points.length;
      nearest = Math.min(
        nearest,
        distanceToSegment(
          [body.position.x, body.position.y, body.position.z],
          [points[i]!, points[i + 1]!, points[i + 2]!],
          [points[j]!, points[j + 1]!, points[j + 2]!],
        ),
      );
    }

    expect(nearest / PLUTO_RADIUS_KM).toBeGreaterThan(20);
  });
});

describe('float32 anchoring', () => {
  it('quantises unacceptably when vertices are stored relative to the Sun', () => {
    // The second bug, as a number. Pluto's orbit in scene units is ~7.4e6, where
    // consecutive float32 values are half a unit apart -- 500 km. Any structure
    // finer than that is simply gone before the GPU does any arithmetic.
    const vertexUnits = 7.376e9 / 1000;
    const ulpUnits = 2 ** (Math.floor(Math.log2(vertexUnits)) - 23);

    expect(ulpUnits * 1000).toBeGreaterThan(400);

    // Two vertices 200 km apart collapse onto the same float32.
    expect(Math.fround(vertexUnits)).toBe(Math.fround(vertexUnits + 0.2));
  });

  it('is precise once vertices are rebased near the focus', () => {
    // What OrbitLine does instead: subtract the anchor in float64, then narrow. The
    // resulting small coordinate survives float32 intact.
    const vertexKm = 7.376e9;
    const anchorKm = -7.376e9 + 5000; // focus is 5000 km from this vertex
    const rebasedUnits = (vertexKm + anchorKm) / 1000;
    const errorKm = Math.abs(Math.fround(rebasedUnits) - rebasedUnits) * 1000;

    expect(errorKm).toBeLessThan(0.001);
  });
});
