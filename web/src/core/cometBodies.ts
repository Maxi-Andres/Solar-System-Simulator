import type { BodyDefinition, BodyId, CometClass, OsculatingElements } from '@sss/tools/types';

import { COMET, COMET_FLOATS, type Comets } from './comets.ts';
import { conicPosition, type PerifocalState } from './conic.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import type { StateVector } from './vec3.ts';

/**
 * A comet made into a body the camera can go to, as a belt asteroid is (see
 * beltBodies.ts): chosen from search, added to the store with no table, placed every
 * frame by its own conic -- the universal-variable solution, so a parabola or a hyperbola
 * is as much a body as an ellipse -- and flagged APPROXIMATE for it.
 *
 * Its orbit is drawn for e < 1, as any body's is: the ellipse, from its own state, about
 * the Sun. For a parabola or a hyperbola none is, for now: the orbit line is a closed
 * loop, and an open conic would need a line of its own with somewhere honest to stop.
 *
 * Kind 'comet' is generic on purpose: the famous comets -- Halley, 67P, the interstellar
 * two, eighteen in all (famousComets.ts in tools/) -- are bodies of their own from the
 * start, on JPL's integrated vectors like the named asteroids, and are left out of the
 * cloud. This is only how one with nothing but SBDB elements becomes one.
 */

const DEG = 180 / Math.PI;

export function cometBodyId(k: number): BodyId {
  return `comet-${k}`;
}

export function parseCometBodyId(id: BodyId): number | null {
  const match = /^comet-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** What the info panel says about a comet body. */
export interface CometBodyFacts {
  readonly orbitClass: CometClass;
  readonly perihelionKm: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  /** TDB Julian day of the perihelion the record is about. */
  readonly perihelionJd: number;
  /** SBDB's total-magnitude parameters, or null where it gives none. */
  readonly M1: number | null;
  readonly K1: number | null;
  readonly elementEpochs: { readonly minJd: number; readonly maxJd: number };
}

const facts = new Map<BodyId, CometBodyFacts>();

export function cometBodyFacts(id: BodyId): CometBodyFacts | null {
  return facts.get(id) ?? null;
}

/**
 * The radius a comet body is framed by, km: a typical nucleus. **Not a measurement**:
 * SBDB gives no size for most comets, and the body says so (`radiusPublished: false`).
 */
export const COMET_FRAMING_RADIUS_KM = 2;

/** Comet `k`'s state about the Sun at `jd`: its conic, turned into the ecliptic. */
export function cometState(comets: Comets, k: number, jd: number, mu: number): StateVector {
  const { records, axes, info } = comets;
  const base = k * COMET_FLOATS;
  const perifocal: PerifocalState = { x: 0, y: 0, vx: 0, vy: 0 };
  conicPosition(
    records[base + COMET.q]!,
    records[base + COMET.e]!,
    jd - info.referenceJd - records[base + COMET.tp]!,
    mu,
    perifocal,
  );
  const a = k * 6;
  const P = [axes[a]!, axes[a + 1]!, axes[a + 2]!] as const;
  const Q = [axes[a + 3]!, axes[a + 4]!, axes[a + 5]!] as const;
  return {
    position: {
      x: P[0] * perifocal.x + Q[0] * perifocal.y,
      y: P[1] * perifocal.x + Q[1] * perifocal.y,
      z: P[2] * perifocal.x + Q[2] * perifocal.y,
    },
    velocity: {
      x: P[0] * perifocal.vx + Q[0] * perifocal.vy,
      y: P[1] * perifocal.vx + Q[1] * perifocal.vy,
      z: P[2] * perifocal.vx + Q[2] * perifocal.vy,
    },
  };
}

/**
 * A comet's elements as kepler.ts takes them -- for an ellipse only, which is what an
 * orbit line can draw: epoch at perihelion, where the mean anomaly is zero.
 */
export function cometElements(comets: Comets, k: number, mu: number, id: BodyId): OsculatingElements | null {
  const { records, info } = comets;
  const base = k * COMET_FLOATS;
  const q = records[base + COMET.q]!;
  const e = records[base + COMET.e]!;
  if (!(e < 1)) {
    return null;
  }
  const a = q / (1 - e);
  const n = Math.sqrt(mu / (a * a * a));
  const tp = info.referenceJd + records[base + COMET.tp]!;
  return {
    id,
    center: '500@10',
    epochJd: tp,
    eccentricity: e,
    periapsisKm: q,
    inclinationDeg: records[base + COMET.i]! * DEG,
    ascendingNodeDeg: records[base + COMET.node]! * DEG,
    argPeriapsisDeg: records[base + COMET.peri]! * DEG,
    periapsisTimeJd: tp,
    meanMotionDegPerSec: n * DEG,
    meanAnomalyDeg: 0,
    trueAnomalyDeg: 0,
    semiMajorAxisKm: a,
    apoapsisKm: a * (1 + e),
    periodSec: (2 * Math.PI) / n,
  };
}

/** The body a comet record becomes: a marker, a label, an orbit if it is closed. */
export function cometBodyDefinition(id: BodyId, name: string, closed: boolean): BodyDefinition {
  return {
    id,
    name,
    horizonsId: '',
    center: '500@10',
    elementsCenter: '500@10',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'comet',
    radiusEquatorialKm: COMET_FRAMING_RADIUS_KM,
    radiusPolarKm: COMET_FRAMING_RADIUS_KM,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    // The comet dots' pale blue (see Comets.tsx), as a marker.
    color: '#9ecbe6',
    drawOrbit: closed,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: false,
    shapeDrawn: false,
  };
}

/**
 * The eccentricity of the two-body conic through a state about the Sun right now: below 1
 * an ellipse, above it a hyperbola. For the info panel of a comet on JPL's vectors, whose
 * orbit is drawn only while it is closed and which may not be: the elements published
 * with it are those of the day the data was built.
 *
 *   e = ((v^2 - mu / r) r - (r . v) v) / mu
 */
export function osculatingEccentricity(state: StateVector, mu: number): number {
  const { position: r, velocity: v } = state;
  const rMag = Math.hypot(r.x, r.y, r.z);
  const v2 = v.x * v.x + v.y * v.y + v.z * v.z;
  const rDotV = r.x * v.x + r.y * v.y + r.z * v.z;
  const scale = v2 - mu / rMag;
  return (
    Math.hypot(scale * r.x - rDotV * v.x, scale * r.y - rDotV * v.y, scale * r.z - rDotV * v.z) / mu
  );
}

/** The comet bodies added from search and still in the store: two at most. */
const added = new Set<BodyId>();

/**
 * Makes comet `k` a body in `store` and returns its id. The earlier ones go, unless it is
 * `keep`, the body the camera is on.
 */
export function addCometBody(store: EphemerisStore, comets: Comets, k: number, keep: BodyId): BodyId {
  const id = cometBodyId(k);
  const mu = store.body('sun').gmBodyOnlyKm3S2;
  if (!store.isPropagatedBody(id)) {
    const base = k * COMET_FLOATS;
    const { records, info } = comets;
    const elements = cometElements(comets, k, mu, id);
    const M1 = records[base + COMET.M1]!;
    const K1 = records[base + COMET.K1]!;
    facts.set(id, {
      orbitClass: info.classes[records[base + COMET.class]!] ?? 'COM',
      perihelionKm: records[base + COMET.q]!,
      eccentricity: records[base + COMET.e]!,
      inclinationDeg: records[base + COMET.i]! * DEG,
      perihelionJd: info.referenceJd + records[base + COMET.tp]!,
      M1: Number.isFinite(M1) ? M1 : null,
      K1: Number.isFinite(K1) ? K1 : null,
      elementEpochs: info.elementEpochs,
    });
    store.addPropagatedBody(
      cometBodyDefinition(id, info.names[k]!, elements !== null),
      elements,
      (jd) => cometState(comets, k, jd, mu),
    );
  }
  for (const previous of added) {
    if (previous !== id && previous !== keep) {
      store.removePropagatedBody(previous);
      facts.delete(previous);
      added.delete(previous);
    }
  }
  added.add(id);
  return id;
}
