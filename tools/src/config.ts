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

/**
 * The window for the fast moons, the ones whose catalog entry says `short`.
 *
 * One year each way, by decision. The fast moons need sub-day spacing -- Phobos a
 * sample every fifteen minutes -- and that makes their data a matter of budget:
 *
 *   window       samples     JSON      requests to Horizons per run
 *   +-1 year     ~200,000    ~17 MB    ~140
 *   +-5 years  ~1,000,000    ~85 MB    ~700
 *   20 years   ~2,000,000   ~170 MB  ~1,400
 *
 * The visitor never pays for any of it, because the tables ship in chunks fetched
 * one instant at a time; what the window costs is the deploy's time and JPL's
 * patience, and the weekly cron re-centres it. Outside it a moon falls back to
 * Keplerian propagation from its elements and is marked approximate, exactly like a
 * planet outside the twenty years.
 */
export const SHORT_WINDOW_YEARS_BACK = 1;
export const SHORT_WINDOW_YEARS_FORWARD = 1;

/**
 * How far a spacecraft's interpolated path may stray from JPL's, km.
 *
 * A spacecraft has no radius to measure against, which is what the planets' and moons'
 * rule -- a hundredth of the body -- is written in. So the rule is absolute, and set by
 * the closest thing anything here is ever seen next to: Europa Clipper will pass 25 km
 * above Europa, and Juice passes 8,640 km above Earth on 2026-09-28. A kilometre is 4%
 * of the first and a fraction of a pixel at every distance the second is framed from.
 *
 * It is the floor, not the rule everywhere: away from every body the tolerance is an
 * angle instead -- SPACECRAFT_ANGULAR_TOLERANCE -- and only near one does it come down
 * to this kilometre. See refine.ts.
 */
export const SPACECRAFT_TOLERANCE_KM = 1;

/**
 * How far a spacecraft may stray from JPL's path, as an angle seen from the nearest body:
 * ten microradians, never less than SPACECRAFT_TOLERANCE_KM.
 *
 * A kilometre everywhere was the first rule, and it chased the wrong thing. JPL's paths
 * for the craft at the Sun-Earth L1 point are stitched from trajectory files that
 * disagree by a few kilometres where they meet, about weekly -- ACE five times in
 * January 2024, by 3 to 33 km, between stretches smooth to 0.3 m an hour. Following
 * each down to a kilometre cost ACE over 400 requests to Horizons before it was stopped,
 * and DSCOVR the same; the whole L1 group would have been thousands per run. So the
 * rule became the one the trails already use, tighter: what the error looks like from
 * where a camera can stand.
 *
 *   where                         nearest body       tolerance
 *   Juice at Earth, 15,000 km     Earth              1 km (the floor)
 *   L1, 1.5 million km            Earth              15 km
 *   Parker at perihelion          Sun, 6.9 M km      69 km
 *   1 AU cruise                   Sun                1,500 km
 *
 * Fifteen kilometres at L1 is about a fortieth of a pixel seen from Earth on a 1080-line
 * screen; and seen from the craft itself there is nothing near enough to compare it
 * with. A seam is still found and published once it is larger than about eight times
 * the local tolerance -- the refinement sees half a jump at the one-minute floor, through
 * an estimate that divides a miss by sixteen and multiplies it by ESTIMATE_MARGIN -- so
 * 120 km at L1 and 8 km at a flyby. Below that it is smoothed over a single minute.
 */
export const SPACECRAFT_ANGULAR_TOLERANCE = 1e-5;

/**
 * The window for a spacecraft in close orbit about another body, months either side of
 * the build: three.
 *
 * Near a body the tolerance is the kilometre floor, and a craft circling Mars every two
 * hours needs a sample every six minutes to hold it. Measured over ten days of 2026:
 *
 *   craft                              samples a year   requests a year
 *   MRO, Odyssey, TGO, LRO, Danuri,    ~88,000 each     ~150 each
 *     Chandrayaan-2
 *   MAVEN                              ~43,000          ~550
 *   Mars Express                       ~29,000          ~440
 *   ARTEMIS P1, P2                     ~10,000 each     ~440 each
 *
 * Twenty years of that would be ten million samples. A year either side, the moons'
 * window, would still be 6,000 requests a run; three months is about 1,500, and covers
 * LIVE and half a year around it. Outside, the craft is absent, as before its launch.
 */
export const CLOSE_ORBIT_WINDOW_MONTHS = 3;

/**
 * The small moons' tolerance: a hundredth of the moon's radius, as for the major moons
 * (step A1), but never finer than a kilometre -- the spacecraft's floor.
 *
 * A hundredth of a radius is ten metres for a 1 km moon, and JPL does not know where such
 * a moon is to within hundreds of kilometres; holding our interpolation to ten metres of
 * its numbers would be precision about nothing. Measured against JPL, 2026-10-13, the
 * strict rule would have cost 26,000 to 66,000 samples a year for each of the forty-one
 * inner moons (Aegaeon, 0.33 km, the worst), ~3.8 million samples in all.
 *
 * Far from the planet the spacecraft's angle takes over (SPACECRAFT_ANGULAR_TOLERANCE,
 * seen from the planet): 200 km for an irregular moon 20 million km out. Held to the
 * kilometre there instead, every small jump between JPL's ephemeris files was refined to
 * two minutes -- Himalia 1,795 samples against 191 -- and opening Jupiter fetched 6 MB.
 */
export const SMALL_MOON_RADIUS_FRACTION = 0.01;

/**
 * The named small bodies' tolerance, km, everywhere along their orbits: the spacecraft's
 * floor, because spacecraft fly beside them -- OSIRIS-REx a kilometre off Bennu, Hayabusa2
 * at Ryugu, Hera arriving at Didymos in December 2026 -- and a craft held to a kilometre
 * beside a body that is not would drift off it on screen by the body's error.
 *
 * Not the small moons' angle: these are not seen from a planet but visited, and none costs
 * much at a kilometre. A body at 1 AU needs a sample every day or two for it, one in the
 * Kuiper belt one every few weeks.
 */
export const SMALL_BODY_TOLERANCE_KM = SPACECRAFT_TOLERANCE_KM;
export const SMALL_MOON_TOLERANCE_FLOOR_KM = 1;

/**
 * A small moon going round in less than this is an inner moon -- Metis, Pan, the ring
 * shepherds, Uranus's and Neptune's inner families -- sampled every few minutes and
 * followed only CLOSE_ORBIT_WINDOW_MONTHS either side of the build. Slower ones, the
 * irregular moons with periods of months to years, take SMALL_MOON_WINDOW_MONTHS.
 * Outside its window a moon is propagated from its elements and flagged approximate,
 * like every moon outside its table.
 */
export const INNER_MOON_PERIOD_DAYS = 5;
export const SMALL_MOON_WINDOW_MONTHS = 12;

/** The finest step the spacecraft refinement may reach, minutes: Horizons' own unit. */
export const SPACECRAFT_MIN_STEP_MINUTES = 1;

/**
 * Largest spacecraft chunk, in samples. Every craft's table is split into chunks of about
 * this size -- one, for the Voyagers -- and fetched as the clock reaches them, like a
 * moon's. None is loaded before the first frame.
 */
export const SPACECRAFT_CHUNK_SAMPLES = 1500;

/**
 * How far a spacecraft's drawn line may stray from its path, as an angle seen from the
 * nearest body, radians. See paths.ts for why it is an angle.
 *
 * A tenth of a milliradian is about a quarter of a pixel at the 27-degree field of view
 * on a 1080-line screen, and the line's total error is at most twice it -- the path's
 * own miss plus the chord the app draws it with. Measured on the run of 2026-10-06:
 *
 *   craft              full table    path   path, gz
 *   Parker               92,979     1,302     59 KB
 *   Europa Clipper       32,409     2,028     89 KB
 *   JWST                  3,796       488     20 KB
 *   Juice                 4,545       255     12 KB
 *   Voyager 1               229         2    < 1 KB
 *
 * A flat 100 km would have been larger -- 2,883 samples for Parker, on the earlier run --
 * and looser where it matters: at Earth during Juice's flyby this asks for 1.5 km.
 */
export const PATH_ANGULAR_TOLERANCE = 1e-4;

/**
 * Rounding applied before serializing, to keep the JSON small.
 *
 * Time carries eight decimals rather than six. At six a sample's instant could be
 * 43 ms off, which Mercury -- at 47 km/s -- turns into 2 km, and Phobos, moving 2.1 km/s
 * against Mars, into 90 m: most of its whole interpolation budget. Horizons prints nine.
 */
export const POSITION_DECIMALS = 3; // km, i.e. 1 mm
export const VELOCITY_DECIMALS = 9; // km/s, i.e. 1 nm/s
export const TIME_DECIMALS = 8; // days, i.e. ~1 ms

/**
 * Politeness settings. JPL publishes no hard rate limit but asks for reasonable
 * use. The planets are about 30 requests per run; the moons add about 140, almost all
 * of them Phobos and the inner Saturnians. Two at a time keeps that polite.
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

/**
 * JPL's Small-Body Database query endpoint, for the asteroid belt.
 *
 * The API is documented at https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html and its
 * filters at https://ssd-api.jpl.nasa.gov/doc/sbdb_filter.html. It answers with
 * osculating elements rather than vectors: one row per asteroid, so the whole belt is a
 * handful of requests where vectors would be one request per body.
 */
export const SBDB_QUERY_API_URL = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';

/**
 * Faintest asteroid the belt asks SBDB for, absolute magnitude H; null for none, which is
 * the whole catalogue (step B2b). B2a took H < 15.
 *
 * Counted against SBDB on 2026-10-19: 1,575,460 asteroids in all, 509 of them with no H.
 * H is brightness at 1 AU from both the Sun and the observer, so for one albedo it is
 * size: D = 1329 km / sqrt(p) * 10^(-H/5) (Fowler & Chillemi 1992), and H = 15 is 3.4 km
 * across at a geometric albedo of 0.15, 5.9 km for a dark one at 0.05; H = 18 is 0.9 and
 * 1.5 km. Whatever the limit, it is a cut on the catalogue, not on the sky.
 */
export const BELT_MAGNITUDE_LIMIT: number | null = null;

/**
 * Where the belt is split into files, H: tiers below 15, 15 to 16, 16 to 17, 17 to 18,
 * and 18 and fainter, each limit inclusive on its faint side's tier. The app loads a
 * prefix of them, so the visitor who never asks for the faint ones never fetches them.
 *
 * Measured against SBDB on 2026-10-19, asteroids brighter than each limit: 83,841 below
 * 15, 207,618 below 16, 487,538 below 17, 942,263 below 18, and 1,575,460 in all. One
 * magnitude per tier, because each fainter magnitude roughly doubles the count -- so each
 * file is about the size of all those before it, and asking for one more tier is asking
 * for about twice the belt. The first is B2a's belt, unchanged.
 */
export const BELT_TIER_LIMITS: readonly number[] = [15, 16, 17, 18];

/**
 * Rows asked for in one SBDB request, so the catalogue is paged rather than one giant
 * response. Measured 2026-10-19: 83,841 rows, thirteen fields at full precision, are
 * 16.1 MB of JSON and come back in 12 s. The whole catalogue is sixteen pages.
 */
export const BELT_PAGE_ROWS = 100_000;

/**
 * Times the whole belt may be read again because SBDB's count changed between two of its
 * pages; see fetchBelt in belt/sbdb.ts.
 */
export const BELT_READ_ATTEMPTS = 3;

/**
 * Timeout for one SBDB request. Longer than Horizons' because one answer is a page of a
 * hundred thousand asteroids: 12 s measured for 84,000 of them, with the database's own query time in front of
 * it, which a busy afternoon at JPL can multiply.
 */
export const SBDB_REQUEST_TIMEOUT_MS = 300_000;

/**
 * The astronomical unit, km: exactly 149,597,870.7, by IAU 2012 Resolution B2. SBDB gives
 * semi-major axes in AU, and this is the conversion JPL's own ephemerides are defined with.
 */
export const AU_KM = 149_597_870.7;

/** The belt's binary file for tier `index`, inside `belt/`; see BeltInfo.tiers. */
export function beltTierFile(index: number): string {
  return `elements-${index}.bin`;
}
