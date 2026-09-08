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
 * A single trigonometric term correcting the IAU rotational elements.
 *
 * `N = angleDeg + rateDegPerCentury * T`, with T in Julian centuries from J2000, and
 * then alpha0 += raSinCoeffDeg * sin(N), delta0 += decCosCoeffDeg * cos(N),
 * W += wSinCoeffDeg * sin(N). That is exactly the shape the report publishes for
 * Neptune; a body needing several terms would need this to become a list.
 */
export interface PoleNutation {
  readonly angleDeg: number;
  readonly rateDegPerCentury: number;
  readonly raSinCoeffDeg: number;
  readonly decCosCoeffDeg: number;
  readonly wSinCoeffDeg: number;
}

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
   * Top-level bodies use the Solar System barycenter.
   */
  readonly center: string;
  /**
   * Horizons CENTER for the osculating elements, which is a different question.
   * An ellipse needs the dominating mass at its focus, so planets take the Sun's
   * body center, not the barycenter -- see catalog.ts for why that matters.
   */
  readonly elementsCenter: string;
  /**
   * Sample spacing for the state vectors, in days.
   *
   * Chosen per body from measured interpolation error, not set globally. A single
   * step cannot serve both Mercury and Neptune: at one day Neptune is sampled 60,000
   * times per orbit for no benefit, while Mercury genuinely needs it. See catalog.ts
   * for the measurements.
   */
  readonly stepDays: number;
  /** Parent body id, or null when the parent is the Solar System barycenter. */
  readonly parent: BodyId | null;
  readonly kind: BodyKind;
  readonly radiusEquatorialKm: number;
  readonly radiusPolarKm: number;
  /** Gravitational parameter, km^3/s^2. Informational in v1. */
  readonly gmKm3S2: number;
  /** Sidereal rotation period in hours; negative means retrograde. */
  readonly rotationPeriodHours: number;
  /** Axial tilt in degrees, relative to the body's orbital plane. */
  readonly axialTiltDeg: number;
  /**
   * Right ascension of the north pole, ICRF equatorial frame, degrees at J2000.
   *
   * This and the three fields below are the IAU rotational elements: together they
   * say where the body's axis points and which way its prime meridian faces at any
   * instant. Without them a textured sphere spins about an arbitrary axis from an
   * arbitrary starting angle, which looks fine and is fiction.
   */
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
   * The one periodic term large enough to matter, or null where there is none.
   *
   * The IAU report gives trigonometric corrections to the pole and to W for several
   * bodies. Almost all are under 0.01 degrees and are dropped. Neptune's is not: it
   * swings its pole by up to 0.7 degrees, and leaving it out puts the sub-solar
   * latitude 0.28 degrees from JPL's own value where including it lands within
   * 0.004. See catalog.ts.
   */
  readonly poleNutation: PoleNutation | null;
  /** Hex color used for the orbit line, the marker and the label. */
  readonly color: string;
  /** The Sun has no meaningful orbit to draw around the barycenter. */
  readonly drawOrbit: boolean;
  /**
   * Surface maps, one per selectable set. Never null: every body has both.
   *
   * Two sets exist because there is no single source that is both complete and
   * photometric, and pretending otherwise would be the dishonest option. See
   * TEXTURE_SETS below.
   */
  readonly textures: Readonly<Record<TextureSetId, TextureVariant>>;
  /** Ring system, or null for the nine bodies here that have none worth drawing. */
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
  readonly window: WindowInfo;
  readonly bodies: readonly BodyId[];
}
