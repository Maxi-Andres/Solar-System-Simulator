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
    // A path that reaches the probe itself has no edge on that side to report: Kepler's
    // file runs its heliocentric drift out past 2200. The probe is then the edge, and
    // the window cuts it down anyway.
    if (response.result.includes('$$SOE')) {
      return at;
    }
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

/** True when Horizons has a state at `at`; see `lastWithData`. */
export type DataProbe = (at: Date) => Promise<boolean>;

/**
 * The last instant, to a day, at which a craft's path really has data.
 *
 * The coverage Horizons states is the span of the trajectory files it has loaded, and
 * inside it there can be stretches no file covers. At the far end that is not a refusal
 * but an answer of another kind -- "Insufficient ephemeris data has been loaded to
 * compute the state of -135 (DART)" -- which DART's stated coverage runs years past its
 * impact into. So when the stated end has no data, the real one is found by bisection:
 * a dozen single-instant questions for a twenty-year span, and none for a craft whose
 * stated end is good.
 *
 * Assumes the data is one run that stops, which is what a craft that ended looks like.
 * A hole in the middle is not this function's to find; it fails later, loudly.
 */
export async function lastWithData(start: Date, stop: Date, hasData: DataProbe): Promise<Date> {
  if (await hasData(stop)) {
    return stop;
  }
  if (!(await hasData(start))) {
    throw new Error(`No data at ${start.toISOString()}, the start of the stated coverage.`);
  }
  const day = 86_400_000;
  let good = start.getTime();
  let bad = stop.getTime();
  while (bad - good > day) {
    const middle = good + Math.floor((bad - good) / 2 / 60_000) * 60_000;
    if (await hasData(new Date(middle))) {
      good = middle;
    } else {
      bad = middle;
    }
  }
  return new Date(good);
}

/** Asks Horizons for one state at `at`, and says whether one came back. */
export function horizonsProbe(body: BodyDefinition): DataProbe {
  return async (instant) => {
    // Down to the whole minute Horizons takes times in: the stated coverage edges carry
    // milliseconds, and the minute before an edge is inside it. The question ends at
    // that minute rather than starting there -- asking for the minute after an edge is
    // refused, and read as no data it cost a needless bisection and up to a day.
    const end = new Date(Math.floor(instant.getTime() / 60_000) * 60_000);
    const at = new Date(end.getTime() - 60_000);
    const response = await callHorizons(
      {
        COMMAND: body.horizonsId,
        OBJ_DATA: 'NO',
        MAKE_EPHEM: 'YES',
        EPHEM_TYPE: 'VECTORS',
        CENTER: body.center,
        START_TIME: toHorizonsDate(at),
        STOP_TIME: toHorizonsDate(new Date(at.getTime() + 60_000)),
        STEP_SIZE: '1m',
      },
      `${body.name} data probe`,
    );
    return response.result.includes('$$SOE');
  };
}
