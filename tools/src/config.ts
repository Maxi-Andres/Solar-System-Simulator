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
 * Ten years each way. The window moves with every run, so the past edge advances
 * too — a year of weekly deploys and a one-year window would no longer be able to
 * show where the planets were today. Ten years back keeps that reachable.
 *
 * This costs nothing, because sample spacing became per-body at the same time: 20
 * years of coverage is now 16,900 samples across the catalog, against 21,900 for the
 * six-year window that used one day for everything. More than three times the span,
 * for less data.
 */
export const WINDOW_YEARS_BACK = 10;
export const WINDOW_YEARS_FORWARD = 10;

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

/**
 * Retry budget.
 *
 * Four attempts spread over seven seconds was not enough: CI failed with Horizons
 * returning 503 on Mercury four times in a row. Six attempts with exponential backoff
 * and jitter spans about a minute, which is the right order for a service that is
 * briefly busy rather than down. Jitter matters because GitHub Actions runners share
 * outbound addresses — without it, everyone retrying in lockstep is part of the load.
 */
export const MAX_RETRIES = 6;
export const RETRY_BASE_DELAY_MS = 2000;
export const RETRY_MAX_DELAY_MS = 45_000;
export const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Largest number of samples to ask for in one request.
 *
 * Mercury over the full twenty years at a one-day step is 7307 samples — a 1.4 MB
 * response taking three seconds, twenty-eight times Neptune's. That was reliably the
 * first request to be refused when Horizons was busy. Splitting the window into
 * chunks keeps every request small; the pieces are stitched back together locally.
 */
export const MAX_SAMPLES_PER_REQUEST = 1500;

/**
 * Output directory: web/public/data, resolved from this file so it works the same
 * whether the script runs from the repo root or from tools/.
 */
export const OUTPUT_DIR = resolve(import.meta.dirname, '../../web/public/data');
