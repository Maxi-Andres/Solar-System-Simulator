import { json2satrec, sgp4, type SatRec } from 'satellite.js';

import { SATELLITE_RECORD_FLOATS, type SatelliteOmm } from '../types.ts';

/**
 * The bulk satellites' records: SGP4's own mean elements at one reference instant, and
 * their rates, for a GPU to propagate as a drifting Kepler ellipse. See
 * SATELLITE_RECORD_FLOATS in types.ts for the layout and the recipe.
 *
 * **Why not the OMM's numbers as they stand.** They are SGP4's mean elements, not
 * classical ones. MEAN_MOTION is Kozai's mean motion, which SGP4 un-Kozais to Brouwer's
 * before it takes a semi-major axis from it (Hoots & Roehrich, Spacetrack Report #3,
 * 1980): Kepler's third law on the published number puts the ISS 0.5 km and Landsat 9
 * 2.9 km from SGP4's own axis (2026-10-21 elements). And every angle moves at SGP4's
 * secular rates, not a fixed ellipse's: the ISS's node regresses 4.95° a day, Landsat 9's
 * advances 0.986° -- that is what Sun-synchronous means -- and a fixed ellipse would put
 * the ISS up to 460 km out of its real plane after one day.
 *
 * **So the elements are taken from SGP4 itself**, satellite.js's port of Vallado's
 * reference code (published with AIAA 2006-6753), never re-derived: sgp4() returns, with
 * every position, the mean elements it computed it from -- secular gravity (J2, J2², J4),
 * drag, and for an orbit of 225 minutes or more the Sun's and Moon's secular terms and the
 * 12- and 24-hour resonances -- before it adds its periodic terms. The record holds those
 * at the reference instant, and rates fitted to them over ±FIT_DAYS: a line for the node
 * and the perigee, a parabola for the mean anomaly, whose Δt² term is drag.
 *
 * Of SGP4's periodic terms one is kept, because it is the largest near Earth and costs a
 * GPU six operations: J3's long-period shift of the eccentricity vector, `ay` in the
 * record. Measured on the 2026-10-21 catalogue it takes a LEO satellite's median miss from
 * 10 km to 3 km. What is still left out -- J2's short-period terms, a few km near Earth,
 * and the Sun's and Moon's periodic terms, about 30 km at GEO -- is measured by
 * measureBulkError against full SGP4; see buildSatellites.ts for the table.
 */

const MINUTES_PER_DAY = 1440;
const TWO_PI = 2 * Math.PI;
/** WGS-72's equatorial radius, km: SGP4's unit of length, as satellite.js has it. */
export const SGP4_EARTH_RADIUS_KM = 6378.135;
/** WGS-72's J3 / J2, as satellite.js has it: what SGP4's long-period terms scale with. */
const J3_OVER_J2 = -0.00000253881 / 0.001082616;

/**
 * Half-width of the fit for the rates, days: three, the width of the window the bulk is
 * meant for. Measured against full SGP4 on every fifth object of the 2026-10-21 catalogue,
 * before the worst went to the SGP4 tier, LEO's 95th-percentile miss at reference ± 1, 3
 * and 7 days:
 *
 *   fit ±1 d    22 km    203 km   1145 km
 *   fit ±3 d     6 km      8 km     99 km
 *   fit ±7 d    11 km     28 km     22 km
 *
 * SGP4's drag is not a parabola in time -- it has t³ and t⁴ terms, and the mean motion of a
 * craft decaying or under thrust changes fast -- so the parabola is best where it was
 * fitted. ±3 is the best inside the window; whatever is still far from SGP4 inside it is
 * taken out of the bulk instead (SATELLITE_SGP4_THRESHOLD_KM).
 */
export const FIT_DAYS = 3;

/** One record's numbers, float64, before they are written as float32. */
export interface BulkElements {
  readonly aKm: number;
  readonly e: number;
  readonly i: number;
  readonly node: number;
  readonly peri: number;
  readonly meanAnomaly: number;
  /** rad/day */
  readonly dM: number;
  readonly dNode: number;
  readonly dPeri: number;
  /** rad/day² */
  readonly ddM: number;
  /** J3's long-period term; see SATELLITE_RECORD_FLOATS. */
  readonly ay: number;
}

/** Wraps an angle into [−π, π). */
export function wrapPi(angle: number): number {
  return angle - TWO_PI * Math.floor((angle + Math.PI) / TWO_PI);
}

/** satellite.js's satellite record for an OMM, or null when SGP4 cannot initialise it. */
export function satrecOf(omm: SatelliteOmm): SatRec | null {
  try {
    const satrec = json2satrec(omm as unknown as Parameters<typeof json2satrec>[0]);
    return satrec.error === 0 ? satrec : null;
  } catch {
    return null;
  }
}

/** SGP4's mean elements at a UTC Julian day, or null where it fails. */
function meanAt(satrec: SatRec, jdUtc: number) {
  const state = sgp4(satrec, (jdUtc - satrec.jdsatepoch) * MINUTES_PER_DAY);
  return state === null || satrec.error !== 0 ? null : state.meanElements;
}

/**
 * The record for one satellite at `referenceJdUtc`, or null where SGP4 itself cannot place
 * it somewhere in the reference ± fitDays -- decayed, or its elements outside what SGP4
 * accepts.
 */
export function bulkElements(
  satrec: SatRec,
  referenceJdUtc: number,
  fitDays = FIT_DAYS,
): BulkElements | null {
  const before = meanAt(satrec, referenceJdUtc - fitDays);
  const at = meanAt(satrec, referenceJdUtc);
  const after = meanAt(satrec, referenceJdUtc + fitDays);
  if (before === null || at === null || after === null) {
    return null;
  }
  // The angles come back reduced mod 2π; each difference is unwrapped against the turns
  // the mean motion predicts. Drag changes that by far less than half a turn in three
  // days for anything SGP4 still places: the fastest-decaying LEO objects drift a few
  // degrees.
  const unwrap = (difference: number, predicted: number) =>
    difference - TWO_PI * Math.round((difference - predicted) / TWO_PI);
  const turn = at.nm * fitDays * MINUTES_PER_DAY;
  const forward = unwrap(after.mm - at.mm, turn);
  const backward = unwrap(at.mm - before.mm, turn);
  const p = at.am * (1 - at.em * at.em);
  return {
    aKm: at.am * SGP4_EARTH_RADIUS_KM,
    e: at.em,
    i: at.im,
    node: wrapPi(at.Om),
    peri: wrapPi(at.om),
    meanAnomaly: wrapPi(at.mm),
    dM: (forward + backward) / (2 * fitDays),
    dNode: unwrap(after.Om - before.Om, 0) / (2 * fitDays),
    dPeri: unwrap(after.om - before.om, 0) / (2 * fitDays),
    ddM: (forward - backward) / (2 * fitDays * fitDays),
    // SGP4's aycof / (a(1 − e²)), a in Earth radii: sgp4.js, "long period periodics".
    ay: (-0.5 * J3_OVER_J2 * Math.sin(at.im)) / p,
  };
}

/** The record's floats, in SATELLITE_RECORD_FLOATS order, float64. */
export function recordValues(elements: BulkElements, flags: number): number[] {
  return [
    elements.aKm,
    elements.e,
    elements.i,
    elements.node,
    elements.peri,
    elements.meanAnomaly,
    elements.dM,
    elements.dNode,
    elements.dPeri,
    elements.ddM,
    elements.ay,
    flags,
  ];
}

/** Writes one record into `out` at record `index`. */
export function packRecord(out: Float32Array, index: number, values: readonly number[]): void {
  if (values.length !== SATELLITE_RECORD_FLOATS) {
    throw new Error(`A satellite record is ${SATELLITE_RECORD_FLOATS} floats, not ${values.length}.`);
  }
  out.set(values, index * SATELLITE_RECORD_FLOATS);
}

/**
 * A record's position, TEME km, `dtDays` after the reference: the recipe in
 * SATELLITE_RECORD_FLOATS, step by step -- in float64, or with `float32` rounded to
 * float32 after every operation, as a GPU does it.
 */
export function recordPosition(
  record: ArrayLike<number>,
  dtDays: number,
  float32 = false,
): [number, number, number] {
  const f = float32 ? Math.fround : (x: number) => x;
  const [a, e, i, node0, peri0, m0, dM, dNode, dPeri, ddM, ay] = Array.from(
    { length: 11 },
    (_, k) => f(record[k]!),
  ) as [number, number, number, number, number, number, number, number, number, number, number];
  const dt = f(dtDays);
  const m = f(f(m0 + f(dM * dt)) + f(f(ddM * dt) * dt));
  const node = f(node0 + f(dNode * dt));
  const peri = f(peri0 + f(dPeri * dt));
  // J3's long-period term, on the eccentricity vector.
  const ex = f(e * f(Math.cos(peri)));
  const ey = f(f(e * f(Math.sin(peri))) + ay);
  const e1 = f(Math.hypot(ex, ey));
  const peri1 = f(Math.atan2(ey, ex));
  // Kepler's equation on M reduced to [−π, π), as a shader does with mod().
  const mr = f(wrapPi(f(f(m + peri) - peri1)));
  let ecc = mr + e1 * Math.sin(mr);
  for (let step = 0; step < 8; step += 1) {
    ecc = f(ecc - f(f(ecc - f(e1 * f(Math.sin(ecc))) - mr) / f(1 - f(e1 * f(Math.cos(ecc))))));
  }
  const px = f(a * f(f(Math.cos(ecc)) - e1));
  const py = f(f(a * f(Math.sqrt(f(1 - f(e1 * e1))))) * f(Math.sin(ecc)));
  const cO = f(Math.cos(node));
  const sO = f(Math.sin(node));
  const ci = f(Math.cos(i));
  const si = f(Math.sin(i));
  const cw = f(Math.cos(peri1));
  const sw = f(Math.sin(peri1));
  // Rz(node)·Rx(i)·Rz(peri')·(px, py, 0).
  const x1 = f(f(cw * px) - f(sw * py));
  const y1 = f(f(sw * px) + f(cw * py));
  const y2 = f(ci * y1);
  const z2 = f(si * y1);
  return [f(f(cO * x1) - f(sO * y2)), f(f(sO * x1) + f(cO * y2)), z2];
}

/** Full SGP4's position, TEME km, at a UTC Julian day; null where it fails. */
export function sgp4Position(satrec: SatRec, jdUtc: number): [number, number, number] | null {
  const state = sgp4(satrec, (jdUtc - satrec.jdsatepoch) * MINUTES_PER_DAY);
  if (state === null || satrec.error !== 0 || typeof state.position !== 'object') {
    return null;
  }
  const { x, y, z } = state.position;
  return [x, y, z];
}

/**
 * The bulk model's miss against full SGP4, km, at each of `days` from the reference --
 * the worse of +d and −d -- or null where SGP4 fails at one of them.
 */
export function measureBulkError(
  satrec: SatRec,
  record: ArrayLike<number>,
  referenceJdUtc: number,
  days: readonly number[],
  float32 = false,
): number[] | null {
  const misses: number[] = [];
  for (const day of days) {
    let worst = 0;
    for (const sign of day === 0 ? [1] : [-1, 1]) {
      const truth = sgp4Position(satrec, referenceJdUtc + sign * day);
      if (truth === null) {
        return null;
      }
      const model = recordPosition(record, sign * day, float32);
      worst = Math.max(worst, Math.hypot(truth[0] - model[0], truth[1] - model[1], truth[2] - model[2]));
    }
    misses.push(worst);
  }
  return misses;
}
