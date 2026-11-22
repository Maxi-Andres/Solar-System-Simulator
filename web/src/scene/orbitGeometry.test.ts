import type { OsculatingElements } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import * as THREE from 'three';

import {
  ORBIT_CLOSE_IN_HALVINGS,
  ORBIT_SAGITTA_RADII,
  orbitAnomalies,
  orbitPointsKm,
  orbitSegmentsFor,
  propagate,
  stateToOsculatingElements,
} from '../core/kepler.ts';
import {
  ellipseShiftKm,
  OrbitLine,
  orbitLinePointsKm,
  ORBIT_UNSEEN_PX,
  orbitUnseenKm,
  refinementAnomaly,
} from './orbitGeometry.ts';

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
      expect(sagitta(orbitRadius, segments)).toBeLessThanOrEqual(
        bodyRadius * ORBIT_SAGITTA_RADII * 1.01,
      );
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
    // With the adaptive count it is a quarter of a radius.
    const adaptive = orbitSegmentsFor(7.376e9, PLUTO_RADIUS_KM);
    expect(sagitta(7.376e9, adaptive) / PLUTO_RADIUS_KM).toBeLessThan(
      ORBIT_SAGITTA_RADII * 1.01,
    );
  });

  it('stays inside its bounds', () => {
    expect(orbitSegmentsFor(1e6, 1e6)).toBeGreaterThanOrEqual(256);
    expect(orbitSegmentsFor(1e15, 1)).toBeLessThanOrEqual(16384);
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

    // Under half a body radius: the line visually goes through Pluto.
    expect(nearest / PLUTO_RADIUS_KM).toBeLessThan(0.5);
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

describe('the refinement at a body no uniform line can hold', () => {
  const GM_SUN = 1.32712440041e11;
  const a = 1.3794e8;
  /** An Apophis-like orbit, 170 m of asteroid on it: elements as the app derives them. */
  const seed: OsculatingElements = {
    ...PLUTO,
    id: 'apophis',
    eccentricity: 0.1914,
    inclinationDeg: 3.34,
    ascendingNodeDeg: 203.9,
    argPeriapsisDeg: 126.6,
    semiMajorAxisKm: a,
    periapsisKm: a * (1 - 0.1914),
    apoapsisKm: a * (1 + 0.1914),
    meanMotionDegPerSec: (Math.sqrt(GM_SUN / a ** 3) * 180) / Math.PI,
    meanAnomalyDeg: 100,
  };
  const RADIUS_KM = 0.17;
  const at = (days: number) => {
    const jd = seed.epochJd + days;
    const state = propagate(seed, jd);
    return { state, elements: stateToOsculatingElements(state, GM_SUN, jd, 'apophis', '500@10')! };
  };
  const missInRadii = (points: Float64Array, p: { x: number; y: number; z: number }): number => {
    let nearest = Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const j = (i + 3) % points.length;
      nearest = Math.min(
        nearest,
        distanceToSegment(
          [p.x, p.y, p.z],
          [points[i]!, points[i + 1]!, points[i + 2]!],
          [points[j]!, points[j + 1]!, points[j + 2]!],
        ),
      );
    }
    return nearest / RADIUS_KM;
  };

  it('is needed: the capped uniform line misses by more than a radius', () => {
    const { state, elements } = at(0);
    expect(orbitSegmentsFor(elements.apoapsisKm, RADIUS_KM)).toBe(16384);
    const uniform = orbitPointsKm(elements, 16384);
    expect(missInRadii(uniform, state.position)).toBeGreaterThan(1);
  });

  it('puts a vertex on the body, closing in on it from both sides in order', () => {
    const anomalies = orbitAnomalies(16384, 1.234);
    expect(anomalies.length).toBe(16384 + 2 * ORBIT_CLOSE_IN_HALVINGS + 1);
    expect(anomalies).toContain(1.234);
    for (let i = 1; i < anomalies.length; i += 1) {
      expect(anomalies[i]!).toBeGreaterThan(anomalies[i - 1]!);
    }
    expect(anomalies[0]).toBe(0);
    expect(orbitAnomalies(512)).toHaveLength(512);
  });

  it('holds the body on its line, where the uniform grid could not', () => {
    for (const days of [0, 17.3, 101.9, 250]) {
      const { state, elements } = at(days);
      const refined = orbitLinePointsKm(elements, RADIUS_KM);
      expect(missInRadii(refined, state.position)).toBeLessThan(1e-3);
    }
  });

  it('leaves every planet and Pluto on its uniform grid', () => {
    expect(refinementAnomaly(PLUTO, PLUTO_RADIUS_KM)).toBeNull();
    expect(orbitLinePointsKm(PLUTO, PLUTO_RADIUS_KM)).toEqual(
      orbitPointsKm(PLUTO, orbitSegmentsFor(PLUTO.apoapsisKm, PLUTO_RADIUS_KM)),
    );
  });

  it('is re-centred once the body has moved far enough along to sag off it, and not before', () => {
    const line = new OrbitLine(at(0).elements, RADIUS_KM, '#ffffff');
    const sun = { x: 0, y: 0, z: 0 };
    const version = (): number =>
      (line.line.geometry.getAttribute('position') as THREE.BufferAttribute).version;
    line.setElements(at(0).elements);
    line.update(sun, 1);
    const built = version();

    // Ten seconds along: two micro-radians of eccentric anomaly, well inside the
    // 4.9e-5 the refinement is good for. The same line.
    line.setElements(at(10 / 86_400).elements);
    line.update(sun, 1);
    expect(version()).toBe(built);

    // Ten minutes along, 1.4e-4 rad and nearly three times the limit: rebuilt round
    // where the body now is.
    const later = at(600 / 86_400);
    line.setElements(later.elements);
    line.update(sun, 1);
    expect(version()).toBeGreaterThan(built);
    line.dispose();
  });
});

describe('orbitPointsKm, refilled', () => {
  /** The points as they were made before the rotation was hoisted: one call a point. */
  function reference(elements: OsculatingElements, segments: number): Float64Array {
    const rad = Math.PI / 180;
    const w = elements.argPeriapsisDeg * rad;
    const i = elements.inclinationDeg * rad;
    const n = elements.ascendingNodeDeg * rad;
    const e = elements.eccentricity;
    const a = elements.semiMajorAxisKm;
    const out = new Float64Array(segments * 3);
    for (let k = 0; k < segments; k += 1) {
      const E = k * ((2 * Math.PI) / segments);
      const x = a * (Math.cos(E) - e);
      const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      const ci = Math.cos(i);
      const si = Math.sin(i);
      const cn = Math.cos(n);
      const sn = Math.sin(n);
      out[k * 3] = (cn * cw - sn * sw * ci) * x + (-cn * sw - sn * cw * ci) * y;
      out[k * 3 + 1] = (sn * cw + cn * sw * ci) * x + (-sn * sw + cn * cw * ci) * y;
      out[k * 3 + 2] = sw * si * x + cw * si * y;
    }
    return out;
  }

  it('makes the same points to the bit, into the buffer it is given', () => {
    const expected = reference(PLUTO, 2048);
    const buffer = new Float64Array(2048 * 3);
    const points = orbitPointsKm(PLUTO, 2048, null, buffer);
    expect(points).toBe(buffer);
    for (let k = 0; k < expected.length; k += 1) {
      expect(Object.is(points[k], expected[k])).toBe(true);
    }
    // A buffer of the wrong length is not written: a new one is made.
    const short = new Float64Array(3);
    expect(orbitPointsKm(PLUTO, 2048, null, short)).not.toBe(short);
  });
});

describe('how near an orbit line comes, and what may move unseen there', () => {
  const ppr = 2290; // 1080 px over 27 degrees

  it('is what a quarter of a pixel spans where the line comes nearest', () => {
    expect(orbitUnseenKm(7.5e9, ppr)).toBeCloseTo((7.5e9 * ORBIT_UNSEEN_PX) / ppr, -3);
    expect(orbitUnseenKm(0, ppr)).toBe(0);
  });

  it('measures the line against the camera, never farther than it is', () => {
    const line = new OrbitLine(PLUTO, PLUTO_RADIUS_KM, '#ffffff');
    const points = orbitLinePointsKm(PLUTO, PLUTO_RADIUS_KM);
    const trueNearest = (x: number, y: number, z: number): number => {
      let best = Infinity;
      for (let k = 0; k < points.length; k += 3) {
        best = Math.min(best, Math.hypot(points[k]! - x, points[k + 1]! - y, points[k + 2]! - z));
      }
      return best;
    };
    // From far above the Solar System, from the Sun, and from beside Pluto itself.
    for (const [x, y, z] of [
      [0, 0, 5e10],
      [0, 0, 0],
      [points[0]! + 10_000, points[1]!, points[2]!],
    ] as const) {
      const nearest = line.nearestKm(x, y, z);
      expect(nearest).toBeLessThanOrEqual(trueNearest(x, y, z));
      expect(nearest).toBeGreaterThan(trueNearest(x, y, z) * 0.5 - 1e7);
    }
    // Kept while the camera moves a little, and still a bound.
    const far = line.nearestKm(0, 0, 5e10);
    const moved = line.nearestKm(1e9, 0, 5e10);
    expect(moved).toBeLessThan(far);
    expect(moved).toBeLessThanOrEqual(trueNearest(1e9, 0, 5e10));
    line.dispose();
  });

  it('keeps a line seen from afar until its shift shows', () => {
    const line = new OrbitLine(PLUTO, PLUTO_RADIUS_KM, '#ffffff');
    const version = (): number =>
      (line.line.geometry.getAttribute('position') as THREE.BufferAttribute).version;
    const sun = { x: 0, y: 0, z: 0 };
    line.update(sun, 1);
    const built = version();
    // Charon's pull moves Pluto's osculating ellipse by thousands of km: a hundred radii.
    const shifted = { ...PLUTO, semiMajorAxisKm: PLUTO.semiMajorAxisKm + 100 * PLUTO_RADIUS_KM };
    const unseen = orbitUnseenKm(line.nearestKm(0, 0, 5e10), ppr);
    expect(unseen).toBeGreaterThan(100 * PLUTO_RADIUS_KM);
    line.setElements(shifted, unseen);
    line.update(sun, 1, unseen);
    expect(version()).toBe(built);
    // From nearby the same shift is rebuilt.
    line.setElements(shifted, 0);
    line.update(sun, 1, 0);
    expect(version()).toBeGreaterThan(built);
    line.dispose();
  });
});

describe('ellipseShiftKm', () => {
  /** How far the farthest point of either curve is from the other, sampled densely. */
  function hausdorff(a: OsculatingElements, b: OsculatingElements): number {
    const pa = orbitPointsKm(a, 4096);
    const pb = orbitPointsKm(b, 4096);
    const oneWay = (from: Float64Array, to: Float64Array): number => {
      let worst = 0;
      for (let i = 0; i < from.length; i += 3 * 8) {
        let best = Infinity;
        for (let j = 0; j < to.length; j += 3) {
          best = Math.min(best, Math.hypot(from[i]! - to[j]!, from[i + 1]! - to[j + 1]!, from[i + 2]! - to[j + 2]!));
        }
        worst = Math.max(worst, best);
      }
      return worst;
    };
    return Math.max(oneWay(pa, pb), oneWay(pb, pa));
  }

  it('bounds how far the curve really moves, for every kind of change', () => {
    const changes: Partial<OsculatingElements>[] = [
      { semiMajorAxisKm: PLUTO.semiMajorAxisKm * 1.001 },
      { eccentricity: PLUTO.eccentricity + 0.002 },
      { inclinationDeg: PLUTO.inclinationDeg + 0.3 },
      { ascendingNodeDeg: PLUTO.ascendingNodeDeg + 0.3 },
      { argPeriapsisDeg: PLUTO.argPeriapsisDeg + 0.3 },
      { argPeriapsisDeg: PLUTO.argPeriapsisDeg + 0.2, ascendingNodeDeg: PLUTO.ascendingNodeDeg - 0.1, eccentricity: 0.25 },
    ];
    // The grid's own chord sag, which the sampled distance carries.
    const sag = PLUTO.apoapsisKm * (1 - Math.cos(Math.PI / 4096));
    for (const change of changes) {
      const to = { ...PLUTO, ...change };
      expect(ellipseShiftKm(PLUTO, to) + sag).toBeGreaterThanOrEqual(hausdorff(PLUTO, to));
    }
  });

  it('sees that turning a near-circle, or trading node for periapsis in its plane, moves little', () => {
    const circle = { ...PLUTO, eccentricity: 0.007, inclinationDeg: 0 };
    const turned = { ...circle, argPeriapsisDeg: circle.argPeriapsisDeg + 1 };
    // a·dtheta, the old guess, would be a hundred million km.
    expect(ellipseShiftKm(circle, turned)).toBeLessThan(circle.semiMajorAxisKm * 0.007 * 0.02 * 3);
    const traded = { ...circle, ascendingNodeDeg: circle.ascendingNodeDeg + 30, argPeriapsisDeg: circle.argPeriapsisDeg - 30 };
    expect(ellipseShiftKm(circle, traded)).toBeLessThan(1);
  });
});
