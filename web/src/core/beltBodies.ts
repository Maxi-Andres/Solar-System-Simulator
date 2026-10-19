import type { BeltClass, BodyDefinition, BodyId, OsculatingElements } from '@sss/tools/types';

import { RECORD, type BeltFetchers, type LoadedTier } from './belt.ts';
import { loadBeltRecord, type NameIndex } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { solveKepler } from './kepler.ts';
import { SECONDS_PER_DAY } from './time.ts';

/**
 * A belt asteroid made into a body the camera can go to (step B2c).
 *
 * The belt is dots, drawn by the GPU from elements; the app's focus is a body in the
 * EphemerisStore. So an asteroid chosen from search becomes one: a BodyDefinition from its
 * record, added with its elements and no table (see EphemerisStore.addPropagatedBody).
 * Every frame then places it by two-body propagation of those elements, through the same
 * fallback any body outside its window uses -- and is flagged APPROXIMATE for it, which is
 * exactly what it is. It gets what any small body gets: a marker, a label and its orbit
 * drawn.
 *
 * One at a time, or two: going to another asteroid from search takes the earlier ones
 * away again, except the one the camera is on until it leaves, so there are never more
 * than two -- and AsteroidBelt hides their dots, so none is drawn twice.
 */

const DEG = 180 / Math.PI;

/** The body id a belt record becomes: its tier and its index in the tier's file. */
export function beltBodyId(tier: number, index: number): BodyId {
  return `belt-${tier}-${index}`;
}

/** The tier and index of a belt body id, or null for any other body. */
export function parseBeltBodyId(id: BodyId): { readonly tier: number; readonly index: number } | null {
  const match = /^belt-(\d+)-(\d+)$/.exec(id);
  return match === null ? null : { tier: Number(match[1]), index: Number(match[2]) };
}

/** What the info panel says about a belt body, beyond what every body has. */
export interface BeltBodyFacts {
  readonly name: string;
  /** The provisional designation the name does not show; null if none. */
  readonly designation: string | null;
  readonly orbitClass: BeltClass;
  readonly absoluteMagnitude: number;
  readonly semiMajorAxisKm: number;
  /** The span of the catalogue's element epochs: how old the elements may be. */
  readonly elementEpochs: { readonly minJd: number; readonly maxJd: number };
}

const facts = new Map<BodyId, BeltBodyFacts>();

/** The facts of a belt body, or null for any other. */
export function beltBodyFacts(id: BodyId): BeltBodyFacts | null {
  return facts.get(id) ?? null;
}

/**
 * The record's elements as kepler.ts takes them, at the belt's reference instant.
 *
 * Float32 values widened to float64 and propagated in float64 from there; the shader
 * propagates the same values in float32, so the body and where its dot would be differ
 * by that -- 141 km at most within a year (see beltShader.ts) -- which is why the dot is
 * hidden while it is a body.
 */
export function recordElements(record: Float32Array, referenceJd: number, id: BodyId): OsculatingElements {
  const a = record[RECORD.a]!;
  const e = record[RECORD.e]!;
  const nRadPerDay = record[RECORD.n]!;
  const M = record[RECORD.M]!;
  // True anomaly from the mean, through E; the elements carry both, as Horizons' do.
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return {
    id,
    center: '500@10',
    epochJd: referenceJd,
    eccentricity: e,
    periapsisKm: a * (1 - e),
    inclinationDeg: record[RECORD.i]! * DEG,
    ascendingNodeDeg: record[RECORD.node]! * DEG,
    argPeriapsisDeg: record[RECORD.peri]! * DEG,
    periapsisTimeJd: referenceJd - M / nRadPerDay,
    meanMotionDegPerSec: (nRadPerDay * DEG) / SECONDS_PER_DAY,
    meanAnomalyDeg: M * DEG,
    trueAnomalyDeg: nu * DEG,
    semiMajorAxisKm: a,
    apoapsisKm: a * (1 + e),
    periodSec: ((2 * Math.PI) / nRadPerDay) * SECONDS_PER_DAY,
  };
}

/**
 * A size for the camera to frame by, from H at an albedo of 0.1, km: D = 1329 / sqrt(p) ·
 * 10^(-H/5). **Not a measurement**: nobody has measured these, the albedo alone is a
 * factor of 1.5 either way, and the body says so (`radiusPublished: false`, and no shape
 * drawn). The camera needs some radius to stand off from; this is the honest guess.
 */
export function nominalRadiusKm(H: number): number {
  return (1329 / Math.sqrt(0.1)) * 10 ** (-H / 5) / 2;
}

/** The body a belt record becomes. A marker, an orbit, a label; no shape, no size claimed. */
export function beltBodyDefinition(id: BodyId, name: string, H: number): BodyDefinition {
  const radius = nominalRadiusKm(H);
  return {
    id,
    name,
    horizonsId: '',
    center: '500@10',
    elementsCenter: '500@10',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'asteroid',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    // The belt's own grey, a shade lighter so its marker reads against the dots.
    color: '#b3ada3',
    drawOrbit: true,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: false,
    shapeDrawn: false,
  };
}

/** The belt bodies added from search and still in the store: two at most. */
const added = new Set<BodyId>();

/**
 * Makes name entry `k` a body in `store` and returns its id: reads its record (from its
 * tier if loaded, otherwise its 36 bytes alone), and adds it. The previous one goes,
 * unless it is `keep` -- the body the camera is on.
 */
export async function addBeltBody(
  store: EphemerisStore,
  index: NameIndex,
  k: number,
  fetchers: BeltFetchers,
  loaded: readonly LoadedTier[],
  keep: BodyId,
  basePath = '/',
): Promise<BodyId> {
  const { names, info } = index;
  const tier = names.tier[k]!;
  const recordIndex = names.index[k]!;
  const id = beltBodyId(tier, recordIndex);
  if (!store.isPropagatedBody(id)) {
    const record = await loadBeltRecord(fetchers, info, tier, recordIndex, loaded, basePath);
    const H = record[RECORD.H]!;
    facts.set(id, {
      name: names.display[k]!,
      designation: names.designation[k] ?? null,
      orbitClass: info.classes[names.classIndex[k]!] ?? 'AST',
      absoluteMagnitude: H,
      semiMajorAxisKm: record[RECORD.a]!,
      elementEpochs: info.elementEpochs,
    });
    store.addPropagatedBody(
      beltBodyDefinition(id, names.display[k]!, H),
      recordElements(record, info.referenceJd, id),
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
