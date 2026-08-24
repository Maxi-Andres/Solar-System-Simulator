import { resolve } from 'node:path';

/** Documented Horizons API endpoint. */
export const HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** Reference frame requested for every ephemeris. */
export const REF_PLANE = 'ECLIPTIC';
export const REF_SYSTEM = 'ICRF';
export const OUT_UNITS = 'KM-S';

/**
 * Vector window, in years around today.
 *
 * One year back covers scrubbing into the recent past; five years forward means a
 * deploy stays useful long after the weekly cron would have refreshed it. At a
 * one-day step that is ~2200 samples per body, roughly 150 KB of JSON each.
 */
export const WINDOW_YEARS_BACK = 1;
export const WINDOW_YEARS_FORWARD = 5;

/**
 * Sample spacing. One day keeps cubic Hermite error at the kilometre level even for
 * Mercury, whose 88-day period is the tightest curve in the v1 catalog.
 */
export const STEP_SIZE = '1d';
export const STEP_DAYS = 1;

/** Rounding applied before serializing, to keep the JSON small. */
export const POSITION_DECIMALS = 3; // km, i.e. 1 mm
export const VELOCITY_DECIMALS = 9; // km/s, i.e. 1 nm/s
export const TIME_DECIMALS = 6; // days, i.e. ~0.09 s

/**
 * Politeness settings. JPL publishes no hard rate limit but asks for reasonable
 * use; 10 bodies times 2 calls is only 20 requests per run, so a small concurrency
 * cap plus retries is plenty.
 */
export const MAX_CONCURRENT_REQUESTS = 2;
export const MAX_RETRIES = 4;
export const RETRY_BASE_DELAY_MS = 1000;
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Output directory: web/public/data, resolved from this file so it works the same
 * whether the script runs from the repo root or from tools/.
 */
export const OUTPUT_DIR = resolve(import.meta.dirname, '../../web/public/data');
