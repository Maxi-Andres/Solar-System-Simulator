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

/**
 * VizieR's TAP endpoint, run by CDS Strasbourg, and the Hipparcos table on it.
 *
 * `I/239/hip_main` is ESA's own catalogue, the 1997 astrometric reduction: position,
 * proper motion, parallax, V magnitude and B-V for 118,218 stars. It is the source the
 * sky is drawn from, and none of it is ours.
 */
export const VIZIER_TAP_URL = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';
export const HIPPARCOS_TABLE = 'I/239/hip_main';

/**
 * Faintest star drawn, in V magnitude.
 *
 * **Set by where Hipparcos stops being complete, measured from the catalogue itself.**
 * Count the stars within 10 degrees of the galactic plane against those more than 60
 * degrees from it, per unit solid angle, and the ratio holds at 2.2 to 2.3 all the way
 * from magnitude 6.5 to 8.0 -- then falls: 2.14 at 8.25, 2.04 at 8.5, 1.82 at 9.0. That
 * fall is not the sky thinning out. It is the survey losing stars in the crowded plane
 * first, which is exactly what its published completeness limit says it does, and a sky
 * drawn past it would be visibly emptiest where the Milky Way is.
 *
 * So 8.0, and 41,349 stars with a measured colour index.
 *
 * **The reference draws fainter than this, and the honest answer is that our source runs
 * out first.** Measured off a NASA Eyes frame pixel by pixel: 1,245 discrete stars in a
 * 1,584 square degree field, which after our own 64% detection rate implies a catalogue
 * of about 50,000 -- magnitude 8.2 or so. Hipparcos cannot supply that completely.
 * Reaching it would mean Tycho-2, whose magnitudes are photographic and need
 * transforming, and that is a different step.
 */
export const STAR_MAGNITUDE_LIMIT = 8;

/**
 * Epoch the published star positions are moved to, as a Julian year.
 *
 * Hipparcos gives positions at J1991.25, the mean epoch of its own observations. The
 * rest of this project is J2000 -- the obliquity, the IAU pole elements, the galactic
 * frame -- so the catalogue is moved there once, at generation time, and the app moves
 * it on from there with the same proper motions.
 */
export const STAR_EPOCH_JULIAN_YEAR = 2000;
export const HIPPARCOS_EPOCH_JULIAN_YEAR = 1991.25;

/**
 * Rounding for the star columns, chosen against one pixel rather than by habit.
 *
 * At the scene's 27 degree field of view a 1080-pixel window is 40 pixels per degree,
 * so one pixel is 90 arcseconds. Four decimals of a degree is 0.36 arcseconds, 250
 * times finer than that. Proper motions are integers of milliarcseconds per year: half
 * a mas/yr accumulates 0.1 arcsecond over two centuries, which is the widest date range
 * the app can reach and still a thousandth of a pixel.
 */
export const STAR_ANGLE_DECIMALS = 4;
export const STAR_MAGNITUDE_DECIMALS = 2;
export const STAR_COLOR_INDEX_DECIMALS = 3;
export const STAR_PROPER_MOTION_DECIMALS = 0;
