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
 * VizieR's TAP endpoint, run by CDS Strasbourg, and the two star catalogues on it.
 *
 * **Two, because neither is a sky on its own, and both failures are measured here.**
 *
 * `I/239/hip_main` is ESA's Hipparcos, the 1997 astrometric reduction: 118,218 stars
 * with position, proper motion, parallax, Johnson V and B-V. It is the authority at the
 * bright end and it thins out early.
 *
 * `I/259/tyc2` is Tycho-2, 2.5 million stars complete to about magnitude 11, from the
 * same satellite's star mapper. It goes far deeper and **it does not contain the
 * brightest stars at all** -- the mapper saturated on them. Sirius, Vega, Betelgeuse
 * and Alnitak are all absent: Tycho-2 holds 2 stars brighter than magnitude 2 where the
 * sky has 49, and 4,606 brighter than 6 where Hipparcos has 5,044.
 *
 * **How the thinning was measured.** Count stars per unit solid angle within 10 degrees
 * of the galactic plane, against those more than 60 degrees from it. The real sky's
 * ratio must *rise* with depth, because fainter means further and further means more
 * disc. Tycho-2 does exactly that -- 2.31 at magnitude 7, 2.64 at 8.0, 2.87 at 8.5,
 * 3.09 at 9.0. Hipparcos goes the other way: 2.29 at 7.5, 2.22 at 8.0, 2.04 at 8.5,
 * 1.82 at 9.0. A catalogue cannot lose structure by going deeper, so that fall is the
 * survey running out, and it starts before magnitude 7.5.
 *
 * So the sky is the union: **every Hipparcos star, plus every Tycho-2 star Hipparcos
 * does not already have**, matched on the HIP number Tycho-2 carries. Hipparcos wins
 * the overlap because its photometry is Johnson rather than transformed.
 */
export const VIZIER_TAP_URL = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';
export const HIPPARCOS_TABLE = 'I/239/hip_main';
export const TYCHO2_TABLE = 'I/259/tyc2';

/**
 * Tycho photometry to the Johnson system, as published with the catalogue.
 *
 *     V   = VT - 0.090 (BT - VT)
 *     B-V = 0.850 (BT - VT)
 *
 * ESA SP-1200, Volume 1, section 1.3. A first-order fit quoted as good over
 * -0.25 < BT-VT < 2.0, which covers 97.3% of the stars inside our magnitude limit.
 *
 * This is the one place the sky's photometry is transformed rather than measured in the
 * system it is drawn in, and it is why Hipparcos takes the overlap: about two thirds of
 * the stars here keep their directly measured Johnson values, and only the faint third
 * goes through this.
 */
export const TYCHO_V_FROM_VT = 0.09;
export const TYCHO_BV_FROM_BT_VT = 0.85;

/**
 * Faintest star drawn, in V magnitude.
 *
 * **Set from the reference, by measuring both renders pixel by pixel.** The observable
 * is the median distance from a star to its nearest neighbour -- what "their stars are
 * closer together" actually means. NASA Eyes measures **17.4 px**; at magnitude 7.5 this
 * sky measured 26.8.
 *
 * **That gap is two effects, and separating them took solving the plate.** A pixel
 * separation depends on how much sky a pixel covers as much as on how many stars there
 * are, so the two frames were matched star for star, under a transform free to scale and
 * rotate. It solves, and it solves the same way at three sample sizes:
 *
 *     brightest 25   13 inliers   scale 0.8783   rotation -0.67 deg   error 1.49 px
 *     brightest 40   25 inliers   scale 0.8760   rotation -0.66 deg   error 1.95 px
 *     brightest 60   37 inliers   scale 0.8792   rotation -0.65 deg   error 2.88 px
 *
 * Two independent renders agreeing star for star at two pixels is not chance. So their
 * vertical field of view is **30.6 degrees against our 27**, good to about a tenth, and
 *
 *     1.540 (pixels)  =  1.142 (field of view)  x  1.357 (stars per square degree)
 *
 * Only the second factor is this constant's business. Their sky holds **1.84 times the
 * stars per square degree**, which from 25,695 is a target of about 47,300 -- and the
 * union of the two catalogues at magnitude 8.0 holds 46,061, within 3%.
 *
 * The first factor is the camera and is deliberately not chased here: `FOV_DEG` is 27
 * because that is the vertical field of a 50 mm lens on 35 mm film, chosen in step 6c
 * for what it does to a planet filling the frame, and widening it to match would undo
 * that for a 14% change in how tightly the sky reads.
 *
 * Note what the limit is and is not. It is not a claim about the sky, which has no
 * limiting magnitude; it is the exposure this picture is at, and the About panel says
 * so. Magnitude 8 is about four times fainter than an unaided eye at a dark site.
 */
export const STAR_MAGNITUDE_LIMIT = 8;

export const STAR_EPOCH_JULIAN_YEAR = 2000;
export const HIPPARCOS_EPOCH_JULIAN_YEAR = 1991.25;

/**
 * Rounding for the star columns, chosen against one pixel rather than by habit.
 *
 * At the scene's 27 degree field of view a 1080-pixel window is 40 pixels per degree,
 * so one pixel is 90 arcseconds. Three decimals of a degree is 3.6 arcseconds, a 25th
 * of a pixel, and at 60,000 stars that last decimal was costing 90 KB to place stars
 * finer than the screen can resolve. Proper motions are integers of milliarcseconds per
 * year: half a mas/yr accumulates 0.1 arcsecond over two centuries, which is the widest
 * date range the app can reach and still a thousandth of a pixel.
 */
export const STAR_ANGLE_DECIMALS = 3;
export const STAR_MAGNITUDE_DECIMALS = 2;
export const STAR_COLOR_INDEX_DECIMALS = 3;
export const STAR_PROPER_MOTION_DECIMALS = 0;
