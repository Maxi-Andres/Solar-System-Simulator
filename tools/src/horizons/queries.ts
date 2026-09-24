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

/** Minutes in a day: the unit sub-day steps are counted in. */
export const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;

/** Adds whole minutes to a date, exactly: no fraction of a day is ever formed. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

/**
 * Formats a Date as the 'YYYY-MM-DD HH:MM' string Horizons takes for START/STOP_TIME.
 *
 * To the minute, not the day. The planets never noticed the difference, because every
 * one of their chunk boundaries falls on a midnight; the moons' do not. Phobos splits
 * into pieces fifteen and a half days long, and cutting those to the date made each
 * piece start hours before the previous one ended.
 *
 * Throws on a date that is not a whole minute, rather than silently moving it onto a
 * different sampling grid.
 */
export function toHorizonsDate(date: Date): string {
  if (date.getTime() % MS_PER_MINUTE !== 0) {
    throw new Error(`${date.toISOString()} is not on a whole minute.`);
  }
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * A body's sample spacing in whole minutes.
 *
 * Throws unless it is one. Horizons takes a step as an integer and a unit, and a step
 * that is not a whole number of minutes cannot be written down without rounding it
 * onto a different grid from the one the chunks were planned on.
 */
export function stepMinutes(stepDays: number): number {
  const minutes = stepDays * MINUTES_PER_DAY;
  const whole = Math.round(minutes);
  if (whole < 1 || Math.abs(minutes - whole) > 1e-6) {
    throw new Error(`A step of ${stepDays} days is not a whole number of minutes.`);
  }
  return whole;
}

/**
 * The STEP_SIZE parameter for a body.
 *
 * Whole days are written in days, exactly as they always were, so the planets' queries
 * are unchanged; anything finer is written in minutes -- '15m' for Phobos.
 */
export function stepSize(stepDays: number): string {
  const minutes = stepMinutes(stepDays);
  return minutes % MINUTES_PER_DAY === 0 ? `${minutes / MINUTES_PER_DAY}d` : `${minutes}m`;
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
    STOP_TIME: toHorizonsDate(stop),
    // Per body: see the measurements in catalog.ts for why one step cannot serve
    // both Mercury and Neptune.
    STEP_SIZE: stepSize(body.stepDays),
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
