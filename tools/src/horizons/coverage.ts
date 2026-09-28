import type { BodyDefinition } from '../types.ts';
import { callHorizons } from './client.ts';
import { toHorizonsDate } from './queries.ts';

/**
 * What span of a spacecraft's path JPL actually has.
 *
 * A planet's ephemeris covers millennia; a spacecraft's starts at launch and stops
 * wherever its latest trajectory file does, and for a mission still flying that end
 * moves every few weeks as navigation publishes a new prediction. So the span is asked
 * for on every run rather than written into the catalog, where it would go stale.
 *
 * Horizons has no query for it. What it does have is a precise refusal: ask for a
 * vector before the first one and it answers
 *
 *   No ephemeris for target "Parker Solar Probe (spacecraft)" prior to A.D.
 *   2018-AUG-12 08:16:23.3431 TDB
 *
 * which is the coverage edge to a tenth of a millisecond. Two such questions, one far
 * in the past and one far in the future, give the span. The sentence is read with one
 * strict pattern, and anything else is a loud failure rather than a guess -- the same
 * reason the object summaries are not parsed anywhere in this generator.
 */

/** Far enough out on either side that no spacecraft's path reaches it. */
const PROBE_BEFORE = new Date(Date.UTC(1900, 0, 1));
const PROBE_AFTER = new Date(Date.UTC(2200, 0, 1));

const MONTHS: Readonly<Record<string, number>> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const LIMIT_PATTERN =
  /No ephemeris for target ".*" (prior to|after) A\.D\. (\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?) TDB/;

/** A coverage edge from Horizons' refusal, or null when the text holds none. */
export function parseCoverageLimit(
  result: string,
): { readonly side: 'start' | 'stop'; readonly date: Date } | null {
  const match = LIMIT_PATTERN.exec(result);
  if (match === null) {
    return null;
  }
  const [, side, year, month, day, hour, minute, second] = match;
  const monthIndex = MONTHS[month!];
  if (monthIndex === undefined) {
    return null;
  }
  const date = new Date(
    Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute)) +
      Math.round(Number(second) * 1000),
  );
  return { side: side === 'prior to' ? 'start' : 'stop', date };
}

/** Both coverage edges of a spacecraft's path. Times are TDB, like every Horizons time. */
export async function fetchCoverage(
  body: BodyDefinition,
): Promise<{ readonly start: Date; readonly stop: Date }> {
  const probe = async (at: Date, side: 'start' | 'stop'): Promise<Date> => {
    const next = new Date(at.getTime() + 86_400_000);
    const response = await callHorizons(
      {
        COMMAND: body.horizonsId,
        OBJ_DATA: 'NO',
        MAKE_EPHEM: 'YES',
        EPHEM_TYPE: 'VECTORS',
        CENTER: body.center,
        START_TIME: toHorizonsDate(at),
        STOP_TIME: toHorizonsDate(next),
        STEP_SIZE: '1d',
      },
      `${body.name} coverage`,
    );
    const limit = parseCoverageLimit(response.result);
    if (limit === null || limit.side !== side) {
      throw new Error(
        `${body.name}: expected Horizons to refuse ${at.toISOString()} with its coverage ` +
          `edge, and it did not. Its answer began: ${response.result.slice(0, 200)}`,
      );
    }
    return limit.date;
  };

  const [start, stop] = await Promise.all([
    probe(PROBE_BEFORE, 'start'),
    probe(PROBE_AFTER, 'stop'),
  ]);
  return { start, stop };
}
