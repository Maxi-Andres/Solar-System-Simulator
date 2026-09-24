/**
 * The data contract between the generator and the web app.
 *
 * Everything here is types only, no runtime code, so `web` can import it directly
 * once step 2 wires up the workspace dependency.
 */

/** Stable slug for a body, used in file names and as a map key everywhere. */
export type BodyId = string;

export type BodyKind = 'star' | 'planet' | 'dwarf-planet' | 'moon' | 'spacecraft';

/**
 * Which surface-map set a body is being drawn with.
 *
 * `illustrative` is the Solar System Scope set: NASA imagery with colour and contrast
 * added by its authors. Complete, vivid, and not a measurement.
 *
 * `photometric` prefers a calibrated or mission product wherever one exists. It only
 * differs for three bodies, which is not a shortcoming of the effort but the actual
 * state of what has been published -- Venus, Jupiter and Saturn have NASA maps that
 * are *more* enhanced than the illustrative ones, and Mercury, Uranus and the Sun have
 * no true-colour global map at all. Where no better source exists a body keeps its
 * illustrative map, and the UI says how many bodies actually change.
 */
export type TextureSetId = 'illustrative' | 'photometric';

/** One surface map: the file, and where its left edge sits in longitude. */
export interface TextureVariant {
  /** File name under web/public/textures/. */
  readonly file: string;
  /**
   * Which longitude sits at the LEFT edge of the image, in degrees east.
   *
   * Not a detail, and not a constant: it differs by publisher, and getting it wrong
   * turns the body 180 degrees without changing anything a self-consistency check
   * could notice. Solar System Scope, NASA Blue Marble and the NASA 3D Resources maps
   * all centre on the prime meridian, so their left edge is 180 W; NASA's Pluto
   * mosaic starts at 0. Every value here is measured from the pixels in
   * textureAlignment.test.ts rather than taken on trust.
   */
  readonly longitudeOriginDeg: number;
}

/**
 * A ring system, drawn as a flat annulus in the body's equatorial plane.
 *
 * The texture is a *radial strip*: its horizontal axis runs from the inner radius to
 * the outer one and it is constant vertically, so `u` maps linearly to radius and `v`
 * is meaningless. That is why the two radii below are not decoration -- they are the
 * calibration of the image, and getting them wrong slides every gap to the wrong
 * place.
 */
export interface RingSystem {
  /** File name under web/public/textures/. Needs an alpha channel. */
  readonly texture: string;
  /** Radius at the left edge of the image, km. */
  readonly innerRadiusKm: number;
  /** Radius at the right edge of the image, km. */
  readonly outerRadiusKm: number;
}

/**
 * One trigonometric term of the IAU rotational elements.
 *
 * `N = angleDeg + rateDegPerCentury * T + accelDegPerCentury2 * T^2`, with T in Julian
 * centuries from J2000, and then alpha0 += raSinCoeffDeg * sin(N),
 * delta0 += decCosCoeffDeg * cos(N), W += wSinCoeffDeg * sin(N).
 *
 * That is exactly the form NAIF's text PCK carries the IAU 2015 report in, where each
 * planetary system shares a list of angles and each body weights them. Here every term
 * carries its own angle, so a body's entry reads on its own. The quadratic term exists
 * for Mars's system alone: the angle driving Phobos's largest libration accelerates,
 * because Phobos is spiralling in.
 */
export interface PeriodicTerm {
  readonly angleDeg: number;
  readonly rateDegPerCentury: number;
  readonly accelDegPerCentury2: number;
  readonly raSinCoeffDeg: number;
  readonly decCosCoeffDeg: number;
  readonly wSinCoeffDeg: number;
}

/**
 * The IAU rotational elements: where a body's axis points, and which face it turns
 * toward you at a given instant.
 *
 * Source: IAU WGCCRE 2015 report (Archinal et al., Celest Mech Dyn Astr 130:22, 2018).
 * Without them a textured sphere spins about an arbitrary axis from an arbitrary
 * starting angle, which looks fine and is fiction.
 */
export interface RotationalElements {
  /** Right ascension of the north pole, ICRF equatorial frame, degrees at J2000. */
  readonly poleRaDeg: number;
  /** Declination of the north pole, ICRF equatorial frame, degrees at J2000. */
  readonly poleDecDeg: number;
  /**
   * Rates of change of the pole direction, degrees per Julian century.
   *
   * Precession, mostly. Small enough to look droppable and not droppable: Earth's
   * declination rate alone moves its pole 0.145 degrees by 2026, which is ten times
   * every other residual in the sub-solar comparison against JPL. Zero for the bodies
   * the IAU report gives no rate for.
   */
  readonly poleRaRateDegPerCentury: number;
  readonly poleDecRateDegPerCentury: number;
  /** Prime meridian angle W at J2000, degrees, measured east from the node. */
  readonly primeMeridianDeg: number;
  /**
   * dW/dt in degrees per day.
   *
   * Negative where W decreases with time. That is not the same statement as a
   * negative `rotationPeriodHours` -- see the note above Pluto in catalog.ts.
   */
  readonly rotationRateDegPerDay: number;
  /**
   * d²W/dt², degrees per day squared. Zero everywhere but Phobos.
   *
   * Phobos is spiralling into Mars, so its orbit -- and its locked rotation -- speed up.
   * The term is 9.5e-9 deg/day², which sounds like nothing and is 0.9 degrees by 2026.
   */
  readonly primeMeridianAccelDegPerDay2: number;
  /**
   * The periodic terms, or empty where none matters.
   *
   * For the planets the IAU report gives several, and almost all are under 0.01 degrees
   * and are dropped. Neptune's is not: it swings its pole by up to 0.7 degrees, and
   * leaving it out puts the sub-solar latitude 0.28 degrees from JPL's own value where
   * including it lands within 0.004.
   *
   * For the moons they are carried whole, because several are anything but small:
   * Triton's pole swings by 32 degrees, and Mimas's W by 45 -- that one is the
   * Mimas-Tethys resonance, dragging Mimas along its orbit and its face with it.
   */
  readonly periodicTerms: readonly PeriodicTerm[];
}

/**
 * How much of the shared time window a body's state vectors cover.
 *
 * `full` is the planetary window, twenty years around the run. `short` is a much
 * narrower one for the fast moons, and it is a budget rather than a preference:
 * Phobos circles Mars every 7.65 hours and needs a sample every fifteen minutes to
 * stay inside its own radius, which over twenty years would be 700,000 samples for
 * one body. See SHORT_WINDOW_YEARS in config.ts for the numbers.
 *
 * It also decides how the table is shipped. A `full` table is one file, loaded at
 * startup. A `short` one is split into chunks the app fetches only for the instant
 * it is showing, because a year of every fast moon is ten times the whole planetary
 * set.
 */
export type VectorWindow = 'full' | 'short';

/**
 * A body in the catalog.
 *
 * `parent` is what makes the whole thing extensible: v1 hangs everything off the
 * Solar System barycenter, but a moon declares its planet and its ephemerides get
 * requested relative to that planet's center. Position resolution walks this tree.
 */
export interface BodyDefinition {
  readonly id: BodyId;
  readonly name: string;
  /** Horizons COMMAND value, e.g. '399' for Earth. */
  readonly horizonsId: string;
  /**
   * Horizons CENTER for the state vectors: the inertial frame positions live in.
   * Top-level bodies use the Solar System barycenter; a moon uses its planet's body
   * center, so its vectors are exactly the parent-relative states the frame tree sums.
   */
  readonly center: string;
  /**
   * Horizons CENTER for the osculating elements, which is a different question.
   * An ellipse needs the dominating mass at its focus, so planets take the Sun's
   * body center, not the barycenter -- see catalog.ts for why that matters. A moon
   * takes its planet's, which is the same as its vector center.
   */
  readonly elementsCenter: string;
  /**
   * Sample spacing for the state vectors, in days.
   *
   * Chosen per body from measured interpolation error, not set globally. A single
   * step cannot serve both Mercury and Neptune: at one day Neptune is sampled 60,000
   * times per orbit for no benefit, while Mercury genuinely needs it. See catalog.ts
   * for the measurements.
   *
   * Below a day it must be a whole number of minutes, because that is the unit the
   * request is written in; see `stepSize` in queries.ts.
   */
  readonly stepDays: number;
  /** See VectorWindow. */
  readonly vectorWindow: VectorWindow;
  /** Parent body id, or null when the parent is the Solar System barycenter. */
  readonly parent: BodyId | null;
  readonly kind: BodyKind;
  readonly radiusEquatorialKm: number;
  readonly radiusPolarKm: number;
  /**
   * Gravitational parameter, km^3/s^2.
   *
   * For the giant planets this is the *system* value, planet plus satellites, which is
   * how DE44x publishes them and what the Sun actually pulls on.
   */
  readonly gmKm3S2: number;
  /**
   * Gravitational parameter of the body alone, without its satellites, km^3/s^2.
   *
   * What a moon actually orbits. Using the system value instead would count the moon
   * as pulling on itself: for Io that is a 2.1e-4 error in mu, which bends the drawn
   * osculating ellipse about 175 km off Io's path on the far side -- a tenth of Io.
   * Equal to `gmKm3S2` for every body whose published value is already its own.
   */
  readonly gmBodyOnlyKm3S2: number;
  /**
   * Sidereal rotation period in hours; negative means retrograde.
   *
   * For a moon it equals the orbital period, because every moon in the catalog is
   * locked to its planet. The IAU rates below say the same thing independently.
   */
  readonly rotationPeriodHours: number;
  /**
   * Axial tilt in degrees, relative to the body's orbital plane.
   *
   * Null where no published figure has been sourced yet, which is most moons: theirs
   * are Cassini states, fractions of a degree, and they arrive with the rotational
   * elements rather than ahead of them.
   */
  readonly axialTiltDeg: number | null;
  /**
   * The IAU rotational elements, or null for a body that has none.
   *
   * Every body in the catalog has them today; the type allows null so that one added
   * without them is drawn unturned rather than turned by an invented axis.
   */
  readonly rotation: RotationalElements | null;
  /**
   * Three radii for a body that is not a spheroid, or null for one that is.
   *
   * `[a, b, c]`: a along the prime meridian, b ninety degrees east of it, c along the
   * pole. For a locked moon the prime meridian faces the planet, so a is the long axis
   * the tides stretched toward it -- Mimas is 207.8 x 196.7 x 190.6 km. Where this is
   * set, `radiusEquatorialKm` is a and `radiusPolarKm` is c.
   *
   * Source: IAU 2015, as carried in NAIF's pck00011.tpc.
   */
  readonly triaxialRadiiKm: readonly [number, number, number] | null;
  /** Hex color used for the orbit line, the marker and the label. */
  readonly color: string;
  /** The Sun has no meaningful orbit to draw around the barycenter. */
  readonly drawOrbit: boolean;
  /**
   * Surface maps, one per selectable set, or null for a body drawn in flat colour.
   *
   * Two sets exist because there is no single source that is both complete and
   * photometric, and pretending otherwise would be the dishonest option. See
   * TEXTURE_SETS in catalog.ts. Null for the moons until their maps are sourced and
   * credited, which comes with their rotation: a map without an orientation is a
   * picture of the right place turned the wrong way.
   */
  readonly textures: Readonly<Record<TextureSetId, TextureVariant>> | null;
  /** Ring system, or null for the bodies here that have none worth drawing. */
  readonly rings: RingSystem | null;
}


/**
 * State vectors for one body, stored column-wise.
 *
 * Parallel arrays rather than an array of objects: it roughly halves the JSON, and
 * it is what the interpolator wants anyway (index into `t`, read the same index out
 * of the other six).
 */
export interface VectorTable {
  readonly id: BodyId;
  readonly horizonsId: string;
  readonly center: string;
  readonly count: number;
  /** Julian day numbers, TDB. */
  readonly t: readonly number[];
  /** Position components, km. */
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly z: readonly number[];
  /** Velocity components, km/s. */
  readonly vx: readonly number[];
  readonly vy: readonly number[];
  readonly vz: readonly number[];
}

/**
 * Osculating orbital elements at a single epoch.
 *
 * Used for two things: drawing the orbit as a conic, and propagating outside the
 * downloaded vector window (approximate, but it makes any date reachable).
 */
export interface OsculatingElements {
  readonly id: BodyId;
  readonly center: string;
  /** Epoch of the elements, Julian day number, TDB. */
  readonly epochJd: number;
  readonly eccentricity: number;
  readonly periapsisKm: number;
  readonly inclinationDeg: number;
  readonly ascendingNodeDeg: number;
  readonly argPeriapsisDeg: number;
  /** Time of periapsis passage, Julian day number, TDB. */
  readonly periapsisTimeJd: number;
  readonly meanMotionDegPerSec: number;
  readonly meanAnomalyDeg: number;
  readonly trueAnomalyDeg: number;
  readonly semiMajorAxisKm: number;
  readonly apoapsisKm: number;
  readonly periodSec: number;
}

/** Reference frame every ephemeris in a given run shares. */
export interface FrameInfo {
  readonly center: string;
  readonly refPlane: string;
  readonly refSystem: string;
  readonly units: string;
}

/**
 * The time span covered by the downloaded vector tables.
 *
 * No step size here: it varies per body. Each body's spacing lives in the catalog,
 * and its actual sample times are in its own table.
 */
export interface WindowInfo {
  readonly startJd: number;
  readonly stopJd: number;
  readonly startUtc: string;
  readonly stopUtc: string;
}

/**
 * Written to data/manifest.json. The web app reads this first: it tells it which
 * bodies exist, which window has exact vectors, and how stale the data is.
 */
export interface Manifest {
  readonly generatedAt: string;
  readonly source: {
    readonly name: string;
    readonly version: string;
    readonly url: string;
  };
  readonly frame: FrameInfo;
  /**
   * The span every `full`-window body can answer for exactly.
   *
   * The short-window moons are left out of it on purpose: including them would shrink
   * the window the planets are exact over from twenty years to two. Their own spans
   * are in `tables`.
   */
  readonly window: WindowInfo;
  readonly bodies: readonly BodyId[];
  /** What each body's vectors actually cover, and how they are split. */
  readonly tables: Readonly<Record<BodyId, TableInfo>>;
}

/**
 * The coverage of one body's state vectors.
 *
 * `chunks` is null for a table shipped whole, as `vectors/<id>.json`. Otherwise the
 * table is split into `vectors/<id>/<index>.json`, one file per entry here, in time
 * order. Neighbouring chunks share their boundary sample, so every instant inside a
 * chunk can be interpolated from that chunk alone.
 */
export interface TableInfo {
  readonly startJd: number;
  readonly stopJd: number;
  readonly chunks: readonly ChunkInfo[] | null;
}

/** One file of a chunked vector table. */
export interface ChunkInfo {
  readonly startJd: number;
  readonly stopJd: number;
  readonly count: number;
}

/**
 * The star catalogue, stored column-wise like the vector tables and for the same
 * reason: 25,000 stars as an array of objects is twice the bytes for nothing.
 *
 * Every column is a measurement. Nothing here is modelled, fitted or invented -- the
 * decisions about how a magnitude becomes a pixel live in the renderer, where they can
 * be read as numbers, and not in the data.
 */
export interface StarCatalog {
  /**
   * Where the stars came from, in the order they were taken.
   *
   * Two, because neither catalogue is a sky on its own: Hipparcos has the bright stars
   * Tycho-2's star mapper saturated on, and Tycho-2 has the faint ones Hipparcos never
   * completed. The split is published rather than hidden, because the second entry's
   * photometry is transformed and the first entry's is not.
   */
  readonly sources: readonly {
    readonly name: string;
    readonly table: string;
    readonly stars: number;
    readonly note: string;
  }[];
  /** The service both were read through. */
  readonly via: string;
  readonly queriedAt: string;
  /** Equinox and epoch of `ra`/`dec`. ICRS, positions moved to J2000. */
  readonly epoch: string;
  /** Faintest V magnitude included. */
  readonly magnitudeLimit: number;
  readonly count: number;
  /**
   * Stars inside the magnitude limit that were left out, and why.
   *
   * Published rather than swallowed. A star with no measured colour index has nothing
   * to be drawn from, and inventing one is the single thing this project does not do --
   * so it is dropped, and the count says how many.
   */
  readonly dropped: {
    readonly noPosition: number;
    readonly noColorIndex: number;
  };
  /** Right ascension, degrees, ICRS at J2000. */
  readonly ra: readonly number[];
  /** Declination, degrees, ICRS at J2000. */
  readonly dec: readonly number[];
  /** Johnson V magnitude. */
  readonly mag: readonly number[];
  /** Johnson B-V colour index. */
  readonly bv: readonly number[];
  /** Proper motion in right ascension, already multiplied by cos(dec). mas/yr. */
  readonly pmRa: readonly number[];
  /** Proper motion in declination, mas/yr. */
  readonly pmDec: readonly number[];
}
