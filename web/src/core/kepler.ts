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
 * Target chord error, as a fraction of the body's own radius.
 *
 * A polyline chord cuts inside the true ellipse by the sagitta, r*(1 - cos(pi/N)).
 * A fixed 512 segments made that a quarter of Earth's radius but ninety-three radii
 * for Pluto, whose orbit is huge and whose body is tiny — the original "the orbit
 * doesn't pass through the planet" artefact.
 *
 * The sagitta falls as 1/N^2, so buying accuracy is cheap: quartering the error only
 * doubles the vertex count. At 0.25 the whole catalog costs about 19,000 vertices,
 * which is nothing for a GPU, and the line reads as passing cleanly through every
 * body. Lower this if it ever needs to be tighter still.
 */
export const ORBIT_SAGITTA_RADII = 0.25;

/**
 * How many segments an orbit polyline needs before the planet visibly sits off it.
 *
 * Solving the sagitta down to a fraction of the body radius makes the resolution
 * follow the physics: Mercury needs 752 segments, Earth 688, Neptune 1904 and Pluto
 * 10,999, because those are the shapes that actually differ.
 */
export function orbitSegmentsFor(
  orbitRadiusKm: number,
  bodyRadiusKm: number,
  sagittaRadii = ORBIT_SAGITTA_RADII,
  minimum = 256,
  maximum = 16384,
): number {
  if (orbitRadiusKm <= 0 || bodyRadiusKm <= 0) {
    return minimum;
  }
  const cosine = 1 - (bodyRadiusKm * sagittaRadii) / orbitRadiusKm;
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

/**
 * Derives the osculating elements from a state vector.
 *
 * The osculating ellipse at an instant is, by definition, the two-body orbit that
 * matches the body's position and velocity right then — so it passes exactly through
 * the body, always. That property is the whole reason this exists.
 *
 * The generator downloads elements at a single epoch, which is fine for the instant
 * it was made and progressively wrong afterwards: perturbations pull the real path
 * off that fixed ellipse. Measured against the drawn line, eight years from the
 * epoch put Neptune 135 body radii off its own orbit and Pluto 4400. Recomputing the
 * ellipse from the current state removes the drift entirely rather than reducing it,
 * because there is no longer a stale epoch to drift from.
 *
 * `mu` is the gravitational parameter of the two-body system, G(M + m). Standard
 * derivation via the angular momentum, eccentricity and node vectors.
 */
export function stateToOsculatingElements(
  state: StateVector,
  mu: number,
  jd: number,
  id: string,
  center: string,
): OsculatingElements | null {
  const { position: r, velocity: v } = state;

  const rMag = Math.hypot(r.x, r.y, r.z);
  const vMag = Math.hypot(v.x, v.y, v.z);
  if (rMag === 0 || !Number.isFinite(rMag) || !Number.isFinite(vMag)) {
    return null;
  }

  // Specific angular momentum, h = r x v. Its direction is the orbit normal.
  const h = {
    x: r.y * v.z - r.z * v.y,
    y: r.z * v.x - r.x * v.z,
    z: r.x * v.y - r.y * v.x,
  };
  const hMag = Math.hypot(h.x, h.y, h.z);
  if (hMag === 0) {
    // Radial trajectory: no orbital plane to speak of.
    return null;
  }

  // Node vector, n = k x h, pointing at the ascending node.
  const n = { x: -h.y, y: h.x, z: 0 };
  const nMag = Math.hypot(n.x, n.y);

  // Eccentricity vector, pointing at periapsis.
  const rDotV = r.x * v.x + r.y * v.y + r.z * v.z;
  const scale = vMag * vMag - mu / rMag;
  const e = {
    x: (scale * r.x - rDotV * v.x) / mu,
    y: (scale * r.y - rDotV * v.y) / mu,
    z: (scale * r.z - rDotV * v.z) / mu,
  };
  const eccentricity = Math.hypot(e.x, e.y, e.z);

  // Semi-major axis from the vis-viva energy.
  const energy = (vMag * vMag) / 2 - mu / rMag;
  if (energy >= 0) {
    // Parabolic or hyperbolic: no closed ellipse to draw. Comets in phase B will
    // need a separate path for this.
    return null;
  }
  const semiMajorAxisKm = -mu / (2 * energy);

  const inclinationRad = Math.acos(clamp(h.z / hMag, -1, 1));

  // Longitude of ascending node. Degenerate for an equatorial orbit, where the node
  // is undefined and zero is the conventional choice.
  const ascendingNodeRad =
    nMag === 0 ? 0 : normalizeAngle(Math.atan2(n.y, n.x));

  // Argument of periapsis, measured from the node in the orbital plane.
  let argPeriapsisRad: number;
  if (nMag === 0) {
    // Equatorial: measure from the reference direction instead.
    argPeriapsisRad = normalizeAngle(Math.atan2(e.y, e.x) * (h.z < 0 ? -1 : 1));
  } else if (eccentricity === 0) {
    argPeriapsisRad = 0;
  } else {
    const nDotE = (n.x * e.x + n.y * e.y) / (nMag * eccentricity);
    argPeriapsisRad = Math.acos(clamp(nDotE, -1, 1));
    if (e.z < 0) {
      argPeriapsisRad = 2 * Math.PI - argPeriapsisRad;
    }
  }

  // True anomaly, then eccentric and mean anomaly.
  let trueAnomalyRad: number;
  if (eccentricity === 0) {
    // Circular: measure position from the node.
    const nDotR = nMag === 0 ? r.x / rMag : (n.x * r.x + n.y * r.y) / (nMag * rMag);
    trueAnomalyRad = Math.acos(clamp(nDotR, -1, 1));
    if (r.z < 0) {
      trueAnomalyRad = 2 * Math.PI - trueAnomalyRad;
    }
  } else {
    const eDotR = (e.x * r.x + e.y * r.y + e.z * r.z) / (eccentricity * rMag);
    trueAnomalyRad = Math.acos(clamp(eDotR, -1, 1));
    if (rDotV < 0) {
      trueAnomalyRad = 2 * Math.PI - trueAnomalyRad;
    }
  }

  const eccentricAnomalyRad = 2 * Math.atan2(
    Math.sqrt(1 - eccentricity) * Math.sin(trueAnomalyRad / 2),
    Math.sqrt(1 + eccentricity) * Math.cos(trueAnomalyRad / 2),
  );
  const meanAnomalyRad = normalizeAngle(
    eccentricAnomalyRad - eccentricity * Math.sin(eccentricAnomalyRad),
  );

  const meanMotionRadPerSec = Math.sqrt(mu / semiMajorAxisKm ** 3);
  const periodSec = (2 * Math.PI) / meanMotionRadPerSec;

  return {
    id,
    center,
    epochJd: jd,
    eccentricity,
    periapsisKm: semiMajorAxisKm * (1 - eccentricity),
    inclinationDeg: inclinationRad / DEG_TO_RAD,
    ascendingNodeDeg: ascendingNodeRad / DEG_TO_RAD,
    argPeriapsisDeg: argPeriapsisRad / DEG_TO_RAD,
    periapsisTimeJd: jd - meanAnomalyRad / meanMotionRadPerSec / SECONDS_PER_DAY,
    meanMotionDegPerSec: meanMotionRadPerSec / DEG_TO_RAD,
    meanAnomalyDeg: meanAnomalyRad / DEG_TO_RAD,
    trueAnomalyDeg: normalizeAngle(trueAnomalyRad) / DEG_TO_RAD,
    semiMajorAxisKm,
    apoapsisKm: semiMajorAxisKm * (1 + eccentricity),
    periodSec,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Wraps an angle into [0, 2*pi). */
function normalizeAngle(radians: number): number {
  const wrapped = radians % (2 * Math.PI);
  return wrapped < 0 ? wrapped + 2 * Math.PI : wrapped;
}
