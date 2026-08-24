import type { OsculatingElements } from '@sss/tools/types';

import { SECONDS_PER_DAY } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Keplerian two-body mechanics.
 *
 * Two jobs, both of which need the same machinery:
 *
 *  1. Drawing an orbit line. Sampling the conic gives a clean closed ellipse at any
 *     zoom, which is what NASA Eyes draws and what a 165-year Neptune download could
 *     never provide.
 *  2. Propagating outside the downloaded vector window, so scrubbing to 1850 or 2140
 *     still shows something. That path is approximate and is labelled as such: error
 *     against the real vectors runs from ~100 km at a month out to ~10^5-10^6 km at a
 *     year, depending on the body.
 *
 * Everything here is heliocentric, matching how the elements were requested. See
 * SUN_CENTER in tools/src/catalog.ts for why they are not barycentric.
 */

const DEG_TO_RAD = Math.PI / 180;

/**
 * Solves Kepler's equation M = E - e*sin(E) for the eccentric anomaly E.
 *
 * Newton-Raphson converges in a handful of iterations for planetary eccentricities.
 * The starting guess matters only for very eccentric orbits, where E and M diverge
 * sharply near periapsis; `M + e*sin(M)` handles those without the oscillation a
 * naive `E = M` can produce. Comets in phase B will need this to stay honest at
 * e > 0.9, so the iteration count is generous rather than tuned for planets.
 */
export function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  // Wrap into [-pi, pi]: convergence is fastest near the guess.
  let M = meanAnomalyRad % (2 * Math.PI);
  if (M > Math.PI) {
    M -= 2 * Math.PI;
  } else if (M < -Math.PI) {
    M += 2 * Math.PI;
  }

  let E = M + eccentricity * Math.sin(M);

  for (let i = 0; i < 100; i += 1) {
    const f = E - eccentricity * Math.sin(E) - M;
    const fPrime = 1 - eccentricity * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < 1e-14) {
      break;
    }
  }

  return E;
}

/**
 * Rotates a vector from the perifocal frame into the reference frame.
 *
 * The classic 3-1-3 sequence: argument of periapsis about Z, inclination about the
 * new X, longitude of ascending node about Z again.
 */
function perifocalToReference(
  xPerifocal: number,
  yPerifocal: number,
  elements: OsculatingElements,
): Vec3 {
  const omega = elements.argPeriapsisDeg * DEG_TO_RAD;
  const inclination = elements.inclinationDeg * DEG_TO_RAD;
  const node = elements.ascendingNodeDeg * DEG_TO_RAD;

  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);

  return {
    x:
      (cosNode * cosOmega - sinNode * sinOmega * cosI) * xPerifocal +
      (-cosNode * sinOmega - sinNode * cosOmega * cosI) * yPerifocal,
    y:
      (sinNode * cosOmega + cosNode * sinOmega * cosI) * xPerifocal +
      (-sinNode * sinOmega + cosNode * cosOmega * cosI) * yPerifocal,
    z: sinOmega * sinI * xPerifocal + cosOmega * sinI * yPerifocal,
  };
}

/** Mean anomaly, in radians, at a given TDB Julian day. */
export function meanAnomalyAt(elements: OsculatingElements, jd: number): number {
  const meanMotionDegPerDay = elements.meanMotionDegPerSec * SECONDS_PER_DAY;
  const elapsedDays = jd - elements.epochJd;
  return (elements.meanAnomalyDeg + meanMotionDegPerDay * elapsedDays) * DEG_TO_RAD;
}

/**
 * Propagates the orbit to a TDB Julian day, returning position and velocity.
 *
 * Velocity comes from differentiating the perifocal position analytically rather
 * than from finite differences, so it is exact for the two-body model: the rate of
 * change of eccentric anomaly is n / (1 - e*cos E).
 */
export function propagate(elements: OsculatingElements, jd: number): StateVector {
  const e = elements.eccentricity;
  const a = elements.semiMajorAxisKm;
  const E = solveKepler(meanAnomalyAt(elements, jd), e);

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtOneMinusESquared = Math.sqrt(1 - e * e);

  const xPerifocal = a * (cosE - e);
  const yPerifocal = a * sqrtOneMinusESquared * sinE;

  // Mean motion in rad/s, then dE/dt from the derivative of Kepler's equation.
  const n = elements.meanMotionDegPerSec * DEG_TO_RAD;
  const eDot = n / (1 - e * cosE);

  const vxPerifocal = -a * sinE * eDot;
  const vyPerifocal = a * sqrtOneMinusESquared * cosE * eDot;

  return {
    position: perifocalToReference(xPerifocal, yPerifocal, elements),
    velocity: perifocalToReference(vxPerifocal, vyPerifocal, elements),
  };
}

/**
 * Samples the orbit into a closed polyline, for the orbit line in the scene.
 *
 * Sampled in eccentric anomaly rather than true anomaly or time: E advances
 * uniformly around the ellipse's geometry, so an eccentric orbit gets its points
 * concentrated near periapsis, exactly where the curvature needs them. Sampling in
 * time would do the opposite and leave periapsis visibly faceted.
 *
 * The last point repeats the first, so the caller can draw it as one closed loop.
 */
export function orbitPolyline(elements: OsculatingElements, segments = 512): Vec3[] {
  const e = elements.eccentricity;
  const a = elements.semiMajorAxisKm;
  const sqrtOneMinusESquared = Math.sqrt(1 - e * e);

  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const E = (i / segments) * 2 * Math.PI;
    points.push(
      perifocalToReference(
        a * (Math.cos(E) - e),
        a * sqrtOneMinusESquared * Math.sin(E),
        elements,
      ),
    );
  }
  return points;
}

/** Orbital period in days, from the period Horizons reports in seconds. */
export function periodDays(elements: OsculatingElements): number {
  return elements.periodSec / SECONDS_PER_DAY;
}

/**
 * How many segments an orbit polyline needs before the planet visibly sits off it.
 *
 * A polyline chord cuts inside the true ellipse by the sagitta, r*(1 - cos(pi/N)).
 * With a fixed 512 segments that is a quarter of a body radius for Earth but
 * ninety-three radii for Pluto, whose orbit is huge and whose body is tiny — which
 * is exactly the "orbit doesn't pass through the planet" artefact.
 *
 * Solving the sagitta down to one body radius makes the error scale with what is
 * actually visible: Earth needs 341 segments, Neptune 947, Pluto 4951.
 */
export function orbitSegmentsFor(
  orbitRadiusKm: number,
  bodyRadiusKm: number,
  minimum = 256,
  maximum = 8192,
): number {
  if (orbitRadiusKm <= 0 || bodyRadiusKm <= 0) {
    return minimum;
  }
  const cosine = 1 - bodyRadiusKm / orbitRadiusKm;
  if (cosine <= -1) {
    return minimum;
  }
  const segments = Math.ceil(Math.PI / Math.acos(Math.min(1, cosine)));
  return Math.min(maximum, Math.max(minimum, segments));
}

/**
 * Orbit points as a flat Float64Array of x,y,z triples, in km.
 *
 * Float64 on purpose: the caller rebases these against the focused body before
 * handing them to the GPU. Storing them as float32 up front would bake in ~700 km of
 * quantisation at Pluto's distance, which is glaring once the camera is close enough
 * for that to matter.
 */
export function orbitPointsKm(elements: OsculatingElements, segments: number): Float64Array {
  const points = new Float64Array(segments * 3);
  const e = elements.eccentricity;
  const a = elements.semiMajorAxisKm;
  const sqrtOneMinusESquared = Math.sqrt(1 - e * e);

  for (let i = 0; i < segments; i += 1) {
    const E = (i / segments) * 2 * Math.PI;
    const point = perifocalToReference(
      a * (Math.cos(E) - e),
      a * sqrtOneMinusESquared * Math.sin(E),
      elements,
    );
    points[i * 3] = point.x;
    points[i * 3 + 1] = point.y;
    points[i * 3 + 2] = point.z;
  }

  return points;
}
