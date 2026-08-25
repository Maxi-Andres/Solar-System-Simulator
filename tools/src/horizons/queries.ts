import { OUT_UNITS, REF_PLANE, REF_SYSTEM } from '../config.ts';
import type { BodyDefinition } from '../types.ts';

/** Unix epoch (1970-01-01T00:00:00Z) as a Julian day number. */
const UNIX_EPOCH_JD = 2440587.5;
const MS_PER_DAY = 86_400_000;

/** Converts a JavaScript Date to a Julian day number (UTC-based). */
export function toJulianDay(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Converts a Julian day number back to a Date. */
export function fromJulianDay(jd: number): Date {
  return new Date((jd - UNIX_EPOCH_JD) * MS_PER_DAY);
}

/** Adds whole days to a date. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Formats a Date as the YYYY-MM-DD string Horizons expects for START/STOP_TIME. */
export function toHorizonsDate(date: Date): string {
  const isoDate = date.toISOString().slice(0, 10);
  return isoDate;
}

/**
 * Parameters shared by both request types.
 *
 * MAKE_EPHEM plus OBJ_DATA='NO' keeps the response to the numbers we parse; the
 * object summary block is prose we deliberately do not depend on (see catalog.ts).
 */
function commonParams(body: BodyDefinition): Record<string, string> {
  return {
    COMMAND: body.horizonsId,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    REF_PLANE,
    REF_SYSTEM,
    OUT_UNITS,
    CSV_FORMAT: 'YES',
  };
}

/** Builds the state-vector query for a body over the given window. */
export function vectorQuery(
  body: BodyDefinition,
  start: Date,
  stop: Date,
): Record<string, string> {
  return {
    ...commonParams(body),
    CENTER: body.center,
    EPHEM_TYPE: 'VECTORS',
    START_TIME: toHorizonsDate(start),
    // One extra step past the window. Horizons stops at the last whole step before
    // STOP_TIME, so with a 32-day step the giants ended eight days short of the
    // advertised window — and in that gap they silently fell back to Keplerian
    // propagation while the inner planets were still exact, which showed up as the
    // outer planets jumping off their orbits near the end of the data.
    STOP_TIME: toHorizonsDate(addDays(stop, body.stepDays)),
    // Per body: see the measurements in catalog.ts for why one step cannot serve
    // both Mercury and Neptune.
    STEP_SIZE: `${body.stepDays}d`,
    // Table type 2 is position + velocity; without labels the rows are plain CSV.
    VEC_TABLE: '2',
    VEC_LABELS: 'NO',
  };
}

/** Builds the osculating-elements query for a body at a single epoch. */
export function elementsQuery(body: BodyDefinition, epoch: Date): Record<string, string> {
  return {
    ...commonParams(body),
    // Heliocentric, not barycentric: see SUN_CENTER in catalog.ts.
    CENTER: body.elementsCenter,
    EPHEM_TYPE: 'ELEMENTS',
    // A single explicit instant, rather than a one-step range.
    TLIST: toJulianDay(epoch).toFixed(6),
  };
}
