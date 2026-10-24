/**
 * The data contract between the generator and the web app.
 *
 * Everything here is types only, no runtime code, so `web` can import it directly
 * once step 2 wires up the workspace dependency.
 */

/** Stable slug for a body, used in file names and as a map key everywhere. */
export type BodyId = string;

/** 'satellite' is an Earth satellite from the satellites layer, placed by SGP4; never in bodies.json. */
export type BodyKind = 'star' | 'planet' | 'dwarf-planet' | 'asteroid' | 'comet' | 'moon' | 'spacecraft' | 'satellite';

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
   * The quadratic coefficient of W, degrees per day squared, as a PCK writes it (W2 in
   * W0 + W1 d + W2 d²: half the acceleration). Zero everywhere but Phobos and Bennu.
   *
   * Phobos is spiralling into Mars, so its orbit -- and its locked rotation -- speed up.
   * The term is 9.5e-9 deg/day², which sounds like nothing and is 0.9 degrees by 2026.
   * Bennu is spun up by sunlight, YORP: 2.0e-6, 192 degrees by 2026.
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
 *
 * `mission` is a spacecraft's: the full window cut down to what JPL actually has for
 * the craft, which starts at launch and, for a mission still flying, ends wherever its
 * latest predicted trajectory does. It is sampled adaptively rather than at one step
 * -- see refine.ts -- and shipped whole or chunked by its size.
 *
 * `surface` is a craft on another body's ground, and it has no state vectors at all: it
 * is placed at a latitude and longitude, turned with its host -- see SurfaceTrack.
 */
export type VectorWindow = 'full' | 'short' | 'mission' | 'surface';

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
   *
   * Null for a spacecraft. It is pointed, not spun, and a number here would be
   * invented.
   */
  readonly rotationPeriodHours: number | null;
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
  /** Who flies it and when it left, for a spacecraft; null for a natural body. */
  readonly mission: Mission | null;
  /**
   * For a natural body sampled adaptively, as the spacecraft are, rather than at one
   * step: the small moons, and the named small bodies about the Sun. Absent for every
   * other body. See SMALL_MOONS and SMALL_BODIES in the catalog.
   */
  readonly sampling?: AdaptiveSampling;
  /**
   * False for a body whose size JPL does not publish -- most of the small irregular
   * moons. It is drawn as a marker only, never as a sphere, and its radius fields hold a
   * nominal kilometre that only frames the camera. Absent means published.
   */
  readonly radiusPublished?: boolean;
  /**
   * False for a body whose size is measured but whose shape cannot be drawn yet: an
   * irregular asteroid with no published orientation to hang its dimensions on, or a
   * contact binary no ellipsoid describes. Drawn as a marker only, as a body of unknown
   * size is, while the info panel gives its measured dimensions. Absent means the radii
   * and rotation above are the whole of its shape.
   */
  readonly shapeDrawn?: boolean;
  /**
   * The mission team's shape model, for an irregular body drawn from one instead of from
   * its radii; absent for every other body. See ShapeModel.
   */
  readonly shapeModel?: ShapeModel;
}

/**
 * A body's real shape, as the team that visited it published it: step B1b.
 *
 * The model is drawn in place of the sphere, turned by the body's `rotation` -- which
 * must therefore be the rotation of the very frame the model is published in, the
 * mission's own PCK, or every hill on it lands somewhere else. The radii stay what they
 * were, the measured extents the info panel quotes and the camera frames by.
 *
 * Its surface is the body's measured albedo, or the mission's map draped by each vertex's
 * own latitude and longitude, scaled to that albedo: a dark body looks dark. The map is
 * the shape's, not the body's `textures`, which stay null: it is drawn on nothing else.
 */
export interface ShapeModel {
  /**
   * File under web/public/shapes/: a GLB, meshopt-compressed, of one triangle mesh.
   * Positions in kilometres in the body-fixed frame -- +z the north pole, +x the prime
   * meridian -- vertex normals, and texture coordinates where it has a map: u east from
   * the map's left edge, running past 1 on the facets that straddle it, v = 1 at the
   * north pole, as three.js reads an image.
   */
  readonly file: string;
  /**
   * Triangles in it. Known before the file is fetched, so the size on screen it is
   * drawn from (`shapeShownPx`) is settled from the catalog alone.
   */
  readonly facets: number;
  /** What it is, in the info panel's words: the team, the product and its resolution. */
  readonly product: string;
  /**
   * Where the turning it is drawn with is known only near one time -- a spin phase
   * measured at a flyby and carried forward on an uncertain period, a tumble drawn as a
   * spin -- the panel's words for it; null where the rotation holds throughout.
   */
  readonly orientationNote: string | null;
  /**
   * Geometric albedo, visual: the share of light the surface sends back toward the Sun,
   * and the reflectance it is drawn with. Bennu's is 0.044, as dark as fresh asphalt.
   */
  readonly albedo: number;
  /** The mission's global map draped on it, or null for a body drawn in its albedo alone. */
  readonly map: ShapeMap | null;
}

/**
 * A global map for a shape model: equirectangular, planetocentric, east-positive, in the
 * same body-fixed frame as the model. Its texture coordinates are in the model file,
 * worked out from each vertex's own latitude and longitude, so the two ship together.
 */
export interface ShapeMap {
  /** File under web/public/shapes/. */
  readonly file: string;
  /** Longitude at the image's left edge, degrees east: what the coordinates assume. */
  readonly longitudeOriginDeg: number;
  /**
   * Mean linear reflectance of the image as the file holds it, measured from its pixels.
   * The map is drawn scaled by albedo / this, so it carries the surface's variation and
   * the albedo its level: a mosaic stretched to fill its 8 bits is not the body's
   * brightness.
   */
  readonly meanLinear: number;
}

/**
 * The facts about a spacecraft that are not in its state vectors.
 *
 * Its size is not here: it is `radiusEquatorialKm`, taken for a spacecraft as half its
 * largest deployed dimension, so everything that frames a body by its radius frames a
 * craft by its span. There is no model to draw yet, and no sphere is drawn in its place.
 */
export interface Mission {
  /** Launch instant, ISO 8601 UTC, as the operator published it. */
  readonly launchUtc: string;
  /** The agency responsible for it. */
  readonly operator: string;
  /**
   * The instant the craft stopped existing, ISO 8601 UTC, or null for one that still
   * does -- flying or adrift. Its path is cut there whatever JPL's files hold: DART's
   * run on for years past its impact into Dimorphos.
   */
  readonly endUtc: string | null;
  /**
   * Months either side of the build the craft's path covers, or null for the whole
   * window. Set for the craft in close orbit about another body, whose paths cost too
   * much to follow for twenty years -- see CLOSE_ORBIT_WINDOW_MONTHS.
   */
  readonly windowMonths: number | null;
  /** Where it stands, for a craft on another body's surface; null for one in space. */
  readonly site: SurfaceSite | null;
  /**
   * What is drawn in its place when it is close enough to have a size; null for a craft
   * whose dimensions have not been published, which keeps its marker at any range.
   */
  readonly shape: CraftShape | null;
}

/**
 * How a surface craft's position is known.
 *
 * A rover drives, and NASA publishes where every drive ended: `traverse` names that
 * file. A lander does not move, and its site is a published pair of coordinates.
 */
export type SurfaceSite =
  | {
      readonly kind: 'traverse';
      /** The body it stands on. */
      readonly host: BodyId;
      /** Touchdown, ISO 8601 UTC, spacecraft event time: sol 0 is the local day it falls in. */
      readonly landingUtc: string;
      /** NASA's waypoint file: GeoJSON, one point per drive, with its sol. */
      readonly traverseUrl: string;
    }
  | {
      readonly kind: 'fixed';
      readonly host: BodyId;
      readonly landingUtc: string;
      /** Planetocentric latitude, degrees north. */
      readonly latitudeDeg: number;
      /** East longitude, degrees. */
      readonly longitudeDeg: number;
      /** Which way its front faces, degrees clockwise from north; null where unpublished. */
      readonly headingDeg: number | null;
    };

/**
 * Where a craft on another body's surface stood, stop by stop.
 *
 * Each stop holds from its instant until the next one's: the rover is drawn where a
 * drive ended, never anywhere in between, because the file says where it stopped and
 * not the way it went. A stop's instant is the end of the sol its drive happened in --
 * the file gives the sol, not the hour -- so on a driving sol the rover is drawn at the
 * previous stop until that sol is over.
 *
 * Coordinates are the host's own: planetocentric latitude and east longitude, against
 * the same IAU prime meridian the host's maps are aligned to.
 */
export interface SurfaceTrack {
  readonly id: BodyId;
  readonly host: BodyId;
  readonly count: number;
  /** When each stop begins, Julian day TDB. The first is touchdown. */
  readonly t: readonly number[];
  readonly latitudeDeg: readonly number[];
  readonly longitudeDeg: readonly number[];
  /** Front's heading, degrees clockwise from north; null where unpublished. */
  readonly headingDeg: readonly (number | null)[];
  /** The mission sol each stop began on: 0 for touchdown. */
  readonly sol: readonly number[];
}

/** A surface craft's entry in the manifest: what its track file covers. */
export interface SurfaceInfo {
  readonly host: BodyId;
  /** When the craft is drawn, Julian day TDB: from touchdown, or the window's start. */
  readonly startJd: number;
  /**
   * Until when. A lander that cannot move is known for the whole window. A rover is
   * known only up to the run: after its last reported drive it is drawn where that one
   * ended, until the data was built, and not past it.
   */
  readonly stopJd: number;
  /** Stops in `surface/<id>.json`. */
  readonly count: number;
}

/** How an adaptively sampled natural body is fetched. See BodyDefinition.sampling. */
export interface AdaptiveSampling {
  /** How far the interpolated curve may stray from JPL's, km. */
  readonly toleranceKm: number;
  /**
   * Months either side of the build its table covers; outside it, it is propagated.
   * Null for the planets' full window.
   */
  readonly windowMonths: number | null;
}

/** An axis in a craft's own frame: a unit vector along one of its model axes. */
export type CraftAxis = readonly [number, number, number];

/**
 * How a spacecraft is drawn up close, and which way it faces.
 *
 * Either the agency's own 3D model, in metres, or -- where no model may be used -- a
 * plain box of the craft's published dimensions, which says how big it is and claims
 * nothing about its shape.
 *
 * **Attitude is modelled, not measured.** Where each craft actually points is in JPL's
 * attitude kernels for some of them, as gigabytes of binary, and is published for none
 * of Pioneer, Parker or JWST. What is drawn instead is the rule each one flies by:
 * Voyager, Pioneer and New Horizons keep their dish on Earth; Parker keeps its heat
 * shield on the Sun, JWST its sunshield, and the solar-powered craft their arrays. That
 * fixes one axis. The roll about it is not published for any of them and is set by
 * convention -- `rollAxis` held as near ecliptic north as the pointing allows.
 *
 * **An Earth satellite** flies one of two rules. An Earth observer, a weather or relay
 * satellite and the ISS fly in the local-vertical, local-horizontal frame (LVLH): one
 * side kept on Earth's centre, nadir, and one axis along the orbital velocity, so both
 * axes are known and nothing is left to convention -- `pointsAt: 'nadir'`, `rollAxis`
 * the axis that flies forward. An observatory points inertially at whatever its
 * observing plan says, which no data here carries: it is drawn by its power rule, arrays
 * to the Sun, and `facingNote` says the real pointing is not known.
 */
export interface CraftShape {
  /** File under web/public/models/, or null to draw the box instead. */
  readonly model: string | null;
  /**
   * Whose model it is, where that is not NASA: ESA's are used by its written permission,
   * which asks that "3D models © ESA (European Space Agency)." be shown wherever they
   * are -- see ESA_MODEL_CREDIT in web/src/scene/craftModels.ts. Absent for NASA's and
   * for boxes.
   */
  readonly modelOwner?: 'ESA';
  /**
   * The point of the model, in its own units, that is placed at the craft's position.
   *
   * JPL's position is the craft's centre of mass, and a model's origin is wherever its
   * author left it: BepiColombo's file has its origin 1.7 m outside the craft, and the
   * trail, which ends at the true position, ran 3.7 m beside the body. So each model in
   * space is pinned at the median of its vertices, which lands on the dense body rather
   * than on a boom or an array -- a stand-in for the centre of mass, which no file
   * gives. Absent for a craft on the ground, whose origin is where its wheels or feet
   * touch, and for boxes, which are centred already.
   */
  readonly pivot?: readonly [number, number, number];
  /**
   * Metres per model unit. One for a model authored in metres; otherwise the published
   * dimension over the same extent measured in the file -- see SHAPES in the catalog.
   */
  readonly metresPerUnit: number;
  /**
   * The box: its size along the craft's own x, y and z, metres. Null with a model,
   * which carries its own size.
   */
  readonly boxM: readonly [number, number, number] | null;
  /**
   * What the craft keeps `pointingAxis` on: the Earth, the Sun, or -- for Wind, whose
   * spin axis is held within a degree of it -- the south ecliptic pole. `nadir` is an
   * Earth satellite's LVLH attitude: the axis on Earth's centre and `rollAxis` along its
   * velocity about Earth.
   */
  readonly pointsAt: 'earth' | 'sun' | 'ecliptic-south' | 'zenith' | 'nadir';
  /** What it keeps there, for saying so on screen. */
  readonly pointingPart:
    | 'dish'
    | 'heat-shield'
    | 'sunshield'
    | 'solar-arrays'
    | 'spin-axis'
    | 'deck'
    | 'instruments'
    | 'antennas'
    | 'body-axes';
  /** In the craft's own frame: the dish's boresight, the shield's or the arrays' normal. */
  readonly pointingAxis: CraftAxis;
  /**
   * In the craft's own frame, perpendicular to `pointingAxis`: held toward ecliptic north
   * -- or, for a craft on the ground, its front, along its heading; for `nadir`, the axis
   * that flies forward, along the velocity.
   */
  readonly rollAxis: CraftAxis;
  /**
   * Where the rule stands in for a pointing that is not known -- an observatory turning
   * from target to target on a plan no data here carries -- the panel's words for it.
   * Absent where the rule is how the craft flies.
   */
  readonly facingNote?: string;
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
  /**
   * The drawable trajectory of every spacecraft, keyed by body; nothing else has one.
   * Each entry's samples are in `paths/<id>.json`. See PathTable.
   */
  readonly paths: Readonly<Record<BodyId, PathInfo>>;
  /**
   * Every craft on another body's surface, keyed by body. These have no entry in
   * `tables`: they are placed, not interpolated. See SurfaceTrack.
   */
  readonly surfaces: Readonly<Record<BodyId, SurfaceInfo>>;
  /**
   * How many small moons each planet has, and how many of those have a published size.
   * The moons themselves are not in \`bodies\`, \`tables\` or bodies.json: each planet's
   * are in \`small-moons/<planet>.json\`, fetched only once its system is entered, so the
   * app starts as fast as it did before there were any. Absent in older data.
   */
  readonly smallMoons?: Readonly<Record<BodyId, SmallMoonCount>>;
}

/** A planet's small moons, counted for the manifest. See Manifest.smallMoons. */
export interface SmallMoonCount {
  readonly count: number;
  readonly sized: number;
}

/**
 * One planet's small moons, as `small-moons/<planet>.json`: their definitions, their
 * elements and the index of their chunked tables -- everything the startup files would
 * otherwise carry for them. Their vectors are under `vectors/<id>/`, as every chunked
 * table's are.
 */
export interface SmallMoonBundle {
  readonly bodies: readonly BodyDefinition[];
  readonly elements: Readonly<Record<BodyId, OsculatingElements>>;
  readonly tables: Readonly<Record<BodyId, TableInfo>>;
}

/**
 * Where a spacecraft's path, as JPL publishes it, jumps rather than bends.
 *
 * Horizons stitches a craft's trajectory from a sequence of files, and where one hands
 * over to the next the two need not agree. The step is JPL's, not an interpolation
 * error, and it is kept: the samples on both sides are real. The trajectory line breaks
 * across it rather than drawing a straight stroke the craft never flew.
 */
export interface Seam {
  /** The sample just before the jump, Julian day TDB. */
  readonly startJd: number;
  /** The sample just after it, Julian day TDB: one step-floor later. */
  readonly stopJd: number;
  /**
   * Size of the jump, km: how far the second sample sits from where the first one,
   * moving at the two samples' mean velocity, would have arrived.
   */
  readonly jumpKm: number;
}

/** A spacecraft's drawable trajectory: what is in its path file, and how it was cut. */
export interface PathInfo {
  /**
   * Samples in `paths/<id>.json`; null when there is no such file, and the trail is
   * drawn from the craft's own table instead.
   *
   * A close orbiter goes round thousands of times in its window, so its path cannot be
   * light: MRO's kept 26,739 of its 26,740 samples, Odyssey's 3.4 MB of them, and
   * opening Mars drew a million chords to show two hours of trail. Its trail is one
   * turn, and the table chunk the craft is placed with already holds that turn.
   */
  readonly count: number | null;
  /**
   * The tolerance the path was simplified to, as an angle: radians, seen from the
   * nearest of the Sun, the planets, Pluto and the Moon. See paths.ts.
   */
  readonly angularTolerance: number;
  /** Tolerance never asked for below this, km: the full table's own accuracy. */
  readonly floorKm: number;
  /** Every jump in the craft's path, in time order. */
  readonly seams: readonly Seam[];
}

/**
 * A spacecraft's whole trajectory, light enough to load at once.
 *
 * A subset of the craft's own samples, unchanged -- every one is a JPL state vector --
 * chosen so that Hermite interpolation through the subset stays within a tolerance of
 * the full table everywhere. The full table is what the craft is drawn at; this is only
 * what its line is drawn along, and it is a few kilobytes where the full table of
 * Parker Solar Probe is four megabytes.
 */
export interface PathTable extends VectorTable {
  /**
   * How far the curve through each interval may stray from the full table, km: one
   * entry per interval, `count - 1` of them. Also what the app tessellates it to.
   */
  readonly toleranceKm: readonly number[];
  /**
   * Intervals that span a seam, by index: their two ends are on either side of a jump,
   * and nothing is drawn or interpolated between them.
   */
  readonly gaps: readonly number[];
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

/**
 * Floats per star in a `stars3d/` tier file, little-endian float32, in this order:
 *
 *   0  x     position, parsecs  } heliocentric, at the Julian epoch J2000.0, in the scene's
 *   1  y     position, parsecs  } frame: ICRS rotated about its x axis by the IAU 1976
 *   2  z     position, parsecs  } obliquity, 84381.448" -- the very rotation the sky
 *                                 (starGeometry.ts) puts stars.json through, so a star's
 *                                 direction from the Sun is the sky's to float precision
 *   3  vx    space velocity relative to the Sun, km/s, same frame
 *   4  vy    "
 *   5  vz    "
 *   6  Mv    absolute V magnitude: V + 5 log10(parallax / 100 mas). No extinction
 *            correction, so from the Sun it gives back the apparent V exactly
 *   7  bv    Johnson B-V, as stars.json has it (see flag GAIA_PHOTOMETRY)
 *   8  sky   the star's row in stars.json, or -1 for a star the sky catalogue does not
 *            hold (fainter than its V 8, or missing from it). Exact in float32: < 2^24
 *   9  flags STAR3D_FLAGS bits, an integer held exactly in float32
 *
 * Motion is linear: r(t) = r + v · (t − J2000.0) · STAR3D_KM_S_TO_PC_PER_YEAR, t in Julian
 * years. A star without a measured radial velocity (no RADIAL_VELOCITY flag) has only the
 * tangential part of its motion, from its proper motion and distance; its radial component
 * is 0 -- unknown, not measured as zero.
 *
 * Parsecs and float32: the step at 100 pc is 7.6e-6 pc, 1.6 AU, and at 1.3 pc (Alpha
 * Centauri) 1.2e-7 pc, 0.025 AU -- far inside every parallax's own error.
 */
export const STAR3D_RECORD_FLOATS = 10;

/** km/s to pc per Julian year: 365.25 × 86,400 s / 3.0856775814913673e13 km. */
export const STAR3D_KM_S_TO_PC_PER_YEAR = 1.0227121650537077e-6;

/** The bits of a `stars3d/` record's `flags` float. */
export const STAR3D_FLAGS = {
  /** Gaia DR3 measured its radial velocity, so (vx, vy, vz) is the full space motion. */
  RADIAL_VELOCITY: 1,
  /** Distance from the Hipparcos new reduction (van Leeuwen 2007); else from Gaia DR3. */
  HIPPARCOS_PARALLAX: 2,
  /**
   * Distance from a published system parallax rather than from either catalogue -- for
   * the few stars whose catalogue parallaxes are known to be wrong; Stars3dInfo.overrides
   * lists each, with its reference.
   */
  LITERATURE_PARALLAX: 4,
  /**
   * V and B-V transformed from Gaia's G and BP-RP (Stars3dInfo.photometry says how);
   * else the sky catalogue's own Johnson values (Hipparcos measured, or Tycho-2
   * transformed, as stars.json says per source).
   */
  GAIA_PHOTOMETRY: 8,
  /** In the Gaia Catalogue of Nearby Stars: the volume-complete census within 100 pc. */
  GCNS: 16,
  /**
   * In the GCNS's clean 100-pc sample: the median of its distance posterior, dist_50,
   * inside 100 pc -- the selection the GCNS paper recommends when contamination matters
   * more than completeness (Sect. 3). The catalogue as published also holds the stars
   * that only *may* be inside (1st percentile within 100 pc); about 9% are probably
   * just beyond, and they are drawn where their parallax puts them.
   */
  GCNS_WITHIN_100PC: 32,
} as const;

/** One absolute-magnitude tier of the 3D stars; see Stars3dInfo.tiers. */
export interface Star3dTier {
  /** The records, relative to `stars3d/`: STAR3D_RECORD_FLOATS float32s per star. */
  readonly file: string;
  readonly count: number;
  readonly bytes: number;
  /** Mv range of the tier: brighter limit inclusive, fainter exclusive; null = open. */
  readonly brightestMv: number | null;
  readonly faintestMv: number | null;
  /**
   * The tier's identifiers and parallaxes, relative to `stars3d/`, for an info panel and
   * fetched only for one: `count` × BigUint64 Gaia DR3 source_id (0 = none), then
   * `count` × Uint32 HIP number (0 = none), then `count` × Float32 parallax used, mas,
   * then `count` × Float32 its standard error, mas. Little-endian, entry k for record k.
   */
  readonly details: string;
  readonly detailsBytes: number;
}

/**
 * The stars at their real distances (step D2), as `stars3d/stars3d.json`; the records in
 * the tier files it lists, the search index in `names`. Optional: a data directory
 * without it has a sky at infinity only, as before D2.
 *
 * **Every star with a usable distance, once.** That is the sky catalogue's stars that have
 * a parallax of signal-to-noise `parallaxSnrLimit` or better, from Gaia DR3 or Hipparcos,
 * plus every star of the Gaia Catalogue of Nearby Stars (100 pc) the sky does not already
 * hold. A sky star in 3D carries its stars.json row (`sky`); a sky star without one stays
 * at infinity, drawn as today. So the two files together hold every star exactly once:
 * stars.json rows not named by any record's `sky` at infinity, every record here in 3D.
 *
 * A sky star keeps the sky's direction, V and B-V exactly -- only a distance and a radial
 * velocity are added -- so from the Sun the 3D stars are the same sky. The GCNS stars the
 * sky lacks are fainter than its V 8 from the Sun, which is why it lacks them -- all but
 * a handful that the sky catalogue missed although they are brighter, counted in
 * counts.gaiaOnlyBrighterThanSkyLimit (11 on 2026-10-24: Mizar B, eta Cassiopeiae B and
 * other companions Hipparcos resolved but listed under its primary's number). They are
 * real stars and are kept; seen from the Sun they are the only difference from the sky.
 *
 * Ordered by Mv, brightest (most luminous) first, and split into tiers like the belt, so
 * the most luminous -- the ones seen from farthest -- come in the first file.
 */
export interface Stars3dInfo {
  readonly sources: readonly {
    readonly name: string;
    /** The table as it was read: "J/A+A/649/A6/table1c", "gaiadr3.gaia_source". */
    readonly table: string;
    /** The TAP service it was read through: VizieR or the ESA Gaia Archive. */
    readonly via: string;
    /** Rows read. */
    readonly rows: number;
    readonly note: string;
  }[];
  readonly queriedAt: string;
  /** Julian epoch of the positions: 2000.0. */
  readonly epochJulianYear: number;
  readonly frame: string;
  /**
   * The obliquity of `frame`, arcseconds: 84381.448, IAU 1976 -- JPL's "Ecliptic of
   * J2000.0", the value orientation.ts has and every Horizons table here is rotated by.
   */
  readonly obliquityArcsec: number;
  /** A parallax is used only when parallax / its standard error is at least this. */
  readonly parallaxSnrLimit: number;
  /** How a Gaia star's V and B-V were obtained from G and BP-RP. */
  readonly photometry: string;
  readonly count: number;
  readonly recordFloats: typeof STAR3D_RECORD_FLOATS;
  readonly kmPerSecondToParsecPerYear: number;
  readonly tiers: readonly Star3dTier[];
  /** The sky catalogue (stars.json) against this one. */
  readonly sky: {
    /** stars.json's own count, so a mismatched pair of files can be refused. */
    readonly rows: number;
    /** Rows with a record here, in 3D. */
    readonly placed: number;
    /** Rows left at infinity: no parallax at `parallaxSnrLimit`. */
    readonly atInfinity: number;
  };
  /** Records by where their distance came from, and how many have a radial velocity. */
  readonly counts: {
    readonly gaiaParallax: number;
    readonly hipparcosParallax: number;
    readonly literatureParallax: number;
    readonly radialVelocity: number;
    readonly gcns: number;
    readonly withinTenParsecs: number;
    /**
     * Gaia-only stars brighter than the sky's V 8 from the Sun, so drawn by a renderer
     * that cuts at the sky's limit: stars the sky catalogue missed. Kept, being real; the
     * components of sky entries are not (dropped.gcnsComponentOfSkyEntry).
     */
    readonly gaiaOnlyBrighterThanSkyLimit: number;
  };
  /**
   * How sky stars were matched to Gaia, each star counted once by the first rule that
   * matched it: by HIP number through Gaia DR3's own Hipparcos best-neighbour table, then
   * by position (within `positionalRadiusArcsec` at J2016, with a magnitude check).
   */
  readonly crossMatch: {
    readonly byId: number;
    readonly byPosition: number;
    readonly positionalRadiusArcsec: number;
  };
  /** Catalogue parallaxes replaced by a published one, and why. */
  readonly overrides: readonly {
    readonly star: string;
    readonly parallaxMas: number;
    readonly parallaxErrorMas: number;
    readonly reference: string;
  }[];
  /** Rows read and not written, by reason. */
  readonly dropped: Readonly<Record<string, number>>;
  /** The search index, `stars3d/<file>`; see Stars3dNames. */
  readonly names: {
    readonly file: string;
    readonly count: number;
    readonly bytes: number;
  };
}

/**
 * The 3D stars a search can find by name, `stars3d/names.json`, fetched only when search
 * is opened. Columnar: entry k is `display[k]`, `designations[k]`, ... Every star with an
 * IAU proper name (the WGSN list), every star with a Bayer or Flamsteed designation, and
 * every star of the nearest systems. Ordered by apparent V from the Sun, brightest first.
 */
export interface Stars3dNames {
  readonly count: number;
  /** How the app names it: "Sirius", "Proxima Centauri", "Wolf 359", "61 Cygni A". */
  readonly display: readonly string[];
  /** Whether `display` is an IAU-approved proper name (WGSN). */
  readonly iau: readonly boolean[];
  /**
   * Its other designations, for search to match too: "alf CMa A", "HD 48915",
   * "HIP 32349", "Gaia DR3 2947050466531873024". Never repeats `display`.
   */
  readonly designations: readonly (readonly string[])[];
  /**
   * The system it belongs to where the source says it is multiple ("Alpha Centauri" for
   * A, B and Proxima); null for a star the sources give as single.
   */
  readonly system: readonly (string | null)[];
  /** The system's rank by distance among the nearest systems, 1 the nearest; else null. */
  readonly nearest: readonly (number | null)[];
  /** Spectral type as the source gives it ("A1V", "M5.5Ve"); null where none does. */
  readonly spectralType: readonly (string | null)[];
  /** Which tier file its record is in: an index into Stars3dInfo.tiers. */
  readonly tier: readonly number[];
  /** Its record's index inside that tier's file, counted in records, not floats. */
  readonly index: readonly number[];
}

/**
 * Orbit classes of the asteroid belt file, in the order their codes are written.
 *
 * SBDB's own `class` codes, so a filter can be checked against JPL's definitions
 * (https://ssd.jpl.nasa.gov/sb/orbit_classes.html). The index in this list is the code
 * stored per asteroid; a new class goes at the end, never in between.
 */
export const BELT_CLASSES = [
  'MBA', // Main-belt asteroid
  'IMB', // Inner main-belt
  'OMB', // Outer main-belt
  'MCA', // Mars-crosser
  'APO', // Apollo (NEO)
  'ATE', // Aten (NEO)
  'AMO', // Amor (NEO)
  'IEO', // Atira (NEO, interior to Earth)
  'TJN', // Jupiter Trojan
  'CEN', // Centaur
  'TNO', // Trans-Neptunian object
  'PAA', // Parabolic "asteroid"; never written, elliptic orbits only
  'HYA', // Hyperbolic "asteroid"; never written, elliptic orbits only
  'AST', // Asteroid, other
] as const;

export type BeltClass = (typeof BELT_CLASSES)[number];

/**
 * Floats per asteroid in the belt's binary file, in this order:
 *
 *   0  a      semi-major axis, km
 *   1  e      eccentricity, < 1
 *   2  i      inclination, radians
 *   3  node   longitude of the ascending node, radians
 *   4  peri   argument of perihelion, radians
 *   5  M      mean anomaly at BeltInfo.referenceJd, radians in [−π, π), 0 at perihelion
 *   6  n      mean motion, radians per day
 *   7  H      absolute magnitude
 *   8  class  index into BELT_CLASSES
 *
 * Heliocentric osculating elements, ecliptic and mean equinox of J2000 -- the same
 * plane as every Horizons table here -- so a position is the Sun's plus the two-body
 * ellipse. The mean anomaly is moved from each orbit's own SBDB epoch to the common
 * `referenceJd` in float64 by the generator, so the GPU only ever adds n·Δt to it.
 */
export const BELT_RECORD_FLOATS = 9;

/**
 * The asteroid belt: every asteroid down to an absolute magnitude, as orbital elements
 * rather than vectors. Written to `belt/belt.json`, with the elements in `belt/<file>`
 * as little-endian float32, BELT_RECORD_FLOATS per asteroid, ordered by H (brightest,
 * which is largest, first). Optional: a data directory without it simply has no belt.
 */
/** One magnitude tier of the belt; see BeltInfo.tiers. */
export interface BeltTier {
  /** The binary file of elements, relative to `belt/`. */
  readonly file: string;
  readonly count: number;
  readonly bytes: number;
  /** H range of the tier: brighter limit inclusive, fainter exclusive; null = open. */
  readonly brightestH: number | null;
  readonly faintestH: number | null;
}

export interface BeltInfo {
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly queriedAt: string;
  };
  /**
   * The binary file of the first tier's elements, relative to `belt/`: `tiers[0].file`,
   * kept so data written before tiers existed still reads.
   */
  readonly file: string;
  /** Asteroids in every tier together. */
  readonly count: number;
  /**
   * The belt split by absolute magnitude, brightest first, each its own file of records
   * in the same layout (step B2b). The app loads a prefix of them -- the first alone by
   * default, more when asked -- so the whole catalogue never has to be downloaded to see
   * the largest. Absent in B2a data, which is one tier: `file` and `count`.
   */
  readonly tiers?: readonly BeltTier[];
  readonly recordFloats: typeof BELT_RECORD_FLOATS;
  /** Brightest-first ordering's faintest H included. */
  readonly magnitudeLimit: number;
  /** TDB Julian day every record's mean anomaly is given at. */
  readonly referenceJd: number;
  /** The span of the orbits' own SBDB epochs, TDB Julian days: how old the elements are. */
  readonly elementEpochs: { readonly minJd: number; readonly maxJd: number };
  /** The classes, in code order; see BELT_CLASSES. */
  readonly classes: readonly BeltClass[];
  /** How many of each class were written, keyed by class. */
  readonly classCounts: Readonly<Partial<Record<BeltClass, number>>>;
  /**
   * Asteroids drawn as bodies of their own (see smallBodies.ts), left out here so they
   * are not drawn twice: their SBDB designations.
   */
  readonly excluded: readonly string[];
  /** Rows SBDB returned that were not written, and why. */
  readonly dropped: {
    readonly notElliptic: number;
    readonly missingElements: number;
    /**
     * Rows with no absolute magnitude. H orders the belt, picks the tier and sizes the
     * dot, so one without it has nothing to be drawn from; giving it one would be
     * inventing it. Absent in data written before B2b, where they counted as missing.
     */
    readonly noMagnitude?: number;
  };
  /** The search index of the belt's notable asteroids, `belt/<file>`; see BeltNames. */
  readonly names?: {
    readonly file: string;
    readonly count: number;
    readonly bytes: number;
  };
  /** The comets, `belt/<file>` (their CometInfo); see CometInfo. Absent before B2c. */
  readonly comets?: {
    readonly file: string;
    readonly count: number;
  };
}

/**
 * The belt asteroids a search can find by name, written to `belt/names.json` and fetched
 * only when search is opened (step B2c). Columnar: entry k is `display[k]`,
 * `designation[k]`, ... Not every asteroid -- 1.57 million designations would be tens of
 * megabytes -- but every one people look up by name:
 *
 *   - every asteroid with an IAU name (26,567 in SBDB on 2026-10-19);
 *   - every near-Earth asteroid, class APO, ATE, AMO or IEO, named or not ("2024 YR4");
 *   - every centaur and trans-Neptunian object, CEN and TNO ("2015 BP519");
 *   - every asteroid in tier 0, H < 15, by designation.
 *
 * Ordered by tier and then record index, which is brightness: a search that keeps the
 * index order lists the largest match first.
 */
export interface BeltNames {
  readonly count: number;
  /**
   * How the app names it: "433 Eros" for a numbered asteroid with a name, "4596 (1981 QB)"
   * for a numbered one without, "2024 YR4" for one not numbered yet -- SBDB's own
   * `full_name`, trimmed, with the parentheses dropped when it is the only designation.
   */
  readonly display: readonly string[];
  /**
   * The provisional designation `display` does not already show, for search to match on
   * as well: "A898 PA" for 433 Eros. Null where `display` holds every designation it has.
   */
  readonly designation: readonly (string | null)[];
  /** Which tier file its record is in: an index into BeltInfo.tiers. */
  readonly tier: readonly number[];
  /** Its record's index inside that tier's file, counted in records, not floats. */
  readonly index: readonly number[];
  /** Its orbit class: an index into BELT_CLASSES, as in the record. */
  readonly classIndex: readonly number[];
}

/**
 * Comet orbit classes, in the order their codes are written: SBDB's own, the codes its
 * comet rows carry (https://ssd.jpl.nasa.gov/sb/orbit_classes.html). Every one of them
 * appeared in the 4,080 comets SBDB held on 2026-10-19. A new class goes at the end.
 */
export const COMET_CLASSES = [
  'ETc', // Encke-type (Tj > 3, a < a_Jupiter)
  'JFc', // Jupiter-family (2 < Tj < 3)
  'JFC', // Jupiter-family, classical definition (P < 20 y)
  'CTc', // Chiron-type (Tj > 3, a > a_Jupiter)
  'HTC', // Halley-type, classical definition (20 y < P < 200 y)
  'PAR', // Parabolic orbit, e = 1
  'HYP', // Hyperbolic orbit, e > 1
  'COM', // Comet orbit matching no other class
] as const;

export type CometClass = (typeof COMET_CLASSES)[number];

/**
 * Floats per comet in `belt/comets.bin`, little-endian float32, in this order:
 *
 *   0  q      perihelion distance, km
 *   1  e      eccentricity: < 1 ellipse, exactly 1 parabola, > 1 hyperbola
 *   2  i      inclination, radians
 *   3  node   longitude of the ascending node, radians
 *   4  peri   argument of perihelion, radians
 *   5  tp     time of perihelion passage, days after CometInfo.referenceJd (negative: before)
 *   6  M1     total magnitude parameter; NaN where SBDB has none
 *   7  K1     total magnitude slope; NaN where SBDB has none
 *   8  class  index into COMET_CLASSES
 *
 * Perihelion distance and time rather than a and M, because a and M do not exist for the
 * 2,283 comets on parabolic or hyperbolic orbits, and q and tp do for every conic. A
 * position is the Sun's plus the two-body conic about it, with the Sun's GM as bodies.json
 * gives it: Kepler's equation for e < 1, Barker's for e = 1, the hyperbolic one for e > 1.
 * Same frame as the belt: heliocentric, ecliptic and mean equinox of J2000.
 *
 * tp is relative so float32 can hold it: its step is at most 0.004 days, six minutes, for
 * a perihelion within 180 years of referenceJd, and an hour and a half at the oldest SBDB
 * gives, 2,172 years before it. A comet's brightness is m = M1 + 5 log10(Δ) + K1 log10(r), with
 * Δ and r its distances from the observer and the Sun in AU (SBDB's definition).
 */
export const COMET_RECORD_FLOATS = 9;

/**
 * The comets, as `belt/comets.json`, with their records in `belt/<file>`. Ordered by M1,
 * brightest first, comets with no M1 last; equal M1 by SPK-ID.
 */
export interface CometInfo {
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly queriedAt: string;
  };
  /** The binary file of records, relative to `belt/`. */
  readonly file: string;
  readonly count: number;
  readonly bytes: number;
  readonly recordFloats: typeof COMET_RECORD_FLOATS;
  /** The TDB Julian day every record's `tp` is counted from: the belt's referenceJd. */
  readonly referenceJd: number;
  /** The span of the orbits' own SBDB epochs, TDB Julian days. */
  readonly elementEpochs: { readonly minJd: number; readonly maxJd: number };
  /** The classes, in code order; see COMET_CLASSES. */
  readonly classes: readonly CometClass[];
  readonly classCounts: Readonly<Partial<Record<CometClass, number>>>;
  /**
   * Each comet's name, in record order: SBDB's full name, trimmed -- "1P/Halley",
   * "C/1995 O1 (Hale-Bopp)", "73P/Schwassmann-Wachmann 3-B". Every fragment SBDB
   * designates is its own comet with its own orbit, and is kept.
   */
  readonly names: readonly string[];
  /**
   * Comets drawn as bodies of their own, from Horizons' vectors (famousComets.ts), left
   * out here so they are not drawn twice: their SBDB designations, '1P', '1995 O1'.
   * Absent in data written before them.
   */
  readonly excluded?: readonly string[];
  /** Rows SBDB returned that were not written, and why. */
  readonly dropped: {
    readonly missingElements: number;
    /**
     * D/ comets: those the IAU designates as no longer existing or lost -- Shoemaker-Levy
     * 9's fragments, which hit Jupiter in 1994, among them. Their last orbit propagated
     * to today would put a body where none is.
     */
    readonly defunct: number;
  };
}

/**
 * Earth satellites (Phase C): CelesTrak's GP data -- the US Space Force's catalogue, as
 * the 18th and 19th Space Defense Squadrons publish it on Space-Track and CelesTrak
 * relays it. Written to `satellites/`; optional: a data directory without
 * `satellites/satellites.json` simply has no satellites.
 *
 * Three tiers, and every satellite is in exactly one:
 *
 *   - The named satellites (`named.json`, NamedSatellite[]) carry their whole OMM and are
 *     propagated with full SGP4 in the browser: satellite.js `json2satrec(omm)` reads the
 *     `omm` object as it is.
 *   - The bulk (`bulk.bin`) is a record per satellite for the GPU: SGP4's mean elements at
 *     one reference instant plus SGP4's own secular rates, so a position is Kepler's
 *     ellipse with its node, perigee and mean anomaly drifting -- see
 *     SATELLITE_RECORD_FLOATS.
 *   - The rest (`sgp4.json`, SgpSatellite[]) are the satellites the bulk model cannot
 *     follow: those it would put more than SatelliteInfo.sgp4.thresholdKm from full SGP4
 *     somewhere in the reference ± windowDays -- very eccentric orbits, where the Sun's
 *     and Moon's periodic terms reach a thousand km, and craft under thrust or decaying,
 *     whose drag terms are far from a parabola. Propagated with SGP4, as the named are.
 *
 * **Frame.** Every element here, the OMMs' and the records', is in TEME, the frame SGP4
 * works in (true equator, mean equinox, of date). The scene is ecliptic and mean equinox
 * of J2000, so a TEME position is turned by SatelliteInfo.frame.temeToEclipticJ2000 --
 * precession and nutation from J2000 to the reference instant, then the IAU 1976
 * obliquity -- before Earth's position is added. That holds for SGP4's output too: one
 * matrix for the run, whose error over the window is SatelliteInfo.frame.maxErrorArcsec.
 *
 * **Time.** SGP4 runs on UTC. Every Julian day in this layer is UTC, not TDB as everywhere
 * else in the data: the app's TDB instant must be turned to UTC first (69.184 s in 2026).
 * Skipping it is not small -- a LEO satellite covers 500 km in 69 s.
 */

/**
 * CelesTrak's GP groups this layer is built from, in bit order: bit k of a satellite's
 * group mask is membership of SATELLITE_GROUPS[k]. The codes are CelesTrak's own GROUP=
 * names (https://celestrak.org/NORAD/elements/), so a filter can be checked against its
 * definitions -- except `starlink`, `oneweb` and `kuiper`, read from the object's name
 * ("STARLINK-1007") rather than downloaded a second time: they are most of `active`, and
 * CelesTrak asks for nothing to be fetched twice. A new group goes at the end.
 */
export const SATELLITE_GROUPS = [
  'active', // active payloads: the backbone
  'stations', // space stations and what is docked to them
  'visual', // the hundred or so brightest, rocket bodies among them
  'starlink',
  'oneweb',
  'kuiper',
  'gnss', // GPS, GLONASS, Galileo, BeiDou, QZSS, NavIC
  'geo', // active geosynchronous
  'tdrss', // NASA's Tracking and Data Relay Satellites
  'weather',
  'resource', // Earth resources: Landsat, Sentinel, ...
  'science', // space and Earth science
  'fengyun-1c-debris', // China's 2007 anti-satellite test
  'iridium-33-debris', // the 2009 Iridium 33 / Cosmos 2251 collision, both halves
  'cosmos-2251-debris',
] as const;

export type SatelliteGroup = (typeof SATELLITE_GROUPS)[number];

/**
 * Orbit regimes, in code order, from each object's own mean elements:
 *
 *   leo  apogee below 2,000 km altitude
 *   meo  everything not in another class (the navigation constellations, ~20,000 km)
 *   geo  geosynchronous: 0.9 to 1.1 revolutions a day, eccentricity below 0.25
 *   heo  eccentricity 0.25 or more and not LEO (Molniya, Tundra, transfer orbits)
 */
export const SATELLITE_REGIMES = ['leo', 'meo', 'geo', 'heo'] as const;
export type SatelliteRegime = (typeof SATELLITE_REGIMES)[number];

/**
 * SATCAT object types, in code order: payload, rocket body, debris, unknown -- from
 * CelesTrak's SATCAT where it was read (the active and visual groups), and from the name
 * for the debris groups' members ("FENGYUN 1C DEB").
 */
export const SATELLITE_OBJECT_TYPES = ['PAY', 'R/B', 'DEB', 'UNK'] as const;
export type SatelliteObjectType = (typeof SATELLITE_OBJECT_TYPES)[number];

/**
 * A record's `flags` float is an integer below 2^24, which float32 holds exactly:
 *
 *   bits 0..15   group mask, bit k = SATELLITE_GROUPS[k]
 *   bits 16..17  regime, index into SATELLITE_REGIMES
 *   bits 18..19  object type, index into SATELLITE_OBJECT_TYPES
 *
 * NamedSatellite.flags is packed the same way.
 */
export const SATELLITE_REGIME_SHIFT = 16;
export const SATELLITE_TYPE_SHIFT = 18;

/**
 * Floats per satellite in `satellites/bulk.bin`, little-endian float32, in this order:
 *
 *   0  a      mean semi-major axis, km: SGP4's own -- the Kozai mean motion un-Kozai'd as
 *             sgp4init does, times WGS-72's 6,378.135 km
 *   1  e      mean eccentricity
 *   2  i      mean inclination, radians
 *   3  node   right ascension of the ascending node at SatelliteInfo.referenceJdUtc, rad
 *   4  peri   argument of perigee at referenceJdUtc, rad
 *   5  M      mean anomaly at referenceJdUtc, radians in [−π, π)
 *   6  dM     dM/dt, rad/day: SGP4's secular rate (J2, J2², J4), not the bare mean motion
 *   7  dNode  dnode/dt, rad/day: SGP4's secular rate
 *   8  dPeri  dperi/dt, rad/day: SGP4's secular rate
 *   9  ddM    drag: the coefficient of Δt² in M, rad/day²
 *  10  ay     J3's long-period term: a constant added to the eccentricity vector's
 *             component along the node's normal, e·sin(peri) (SGP4's aycof / (a(1 − e²)))
 *  11  flags  group mask, regime and object type; see SATELLITE_REGIME_SHIFT
 *
 * At UTC Julian day t, with Δt = t − referenceJdUtc in days:
 *
 *   M = M0 + dM·Δt + ddM·Δt²      node = node0 + dNode·Δt      peri = peri0 + dPeri·Δt
 *   ex = e·cos(peri)   ey = e·sin(peri) + ay              (J3, as SGP4 adds it)
 *   e' = sqrt(ex² + ey²)   peri' = atan2(ey, ex)   M' = M + peri − peri'
 *   E − e'·sin E = M'                                     (Kepler's equation, by Newton)
 *   p = (a(cos E − e'), a·sqrt(1 − e'²)·sin E, 0)                      perifocal, km
 *   r_TEME  = Rz(node)·Rx(i)·Rz(peri')·p                          from Earth's centre
 *   r_scene = temeToEclipticJ2000 · r_TEME + Earth's position
 *
 * The J3 step is worth its six operations: without it a LEO satellite is a median 10 km
 * from SGP4, with it 3 km. The angles are moved to referenceJdUtc in float64 by the
 * generator, so float32 carries only Δt-sized products. What the model still leaves out
 * against full SGP4 -- J2's short-period terms, the deep-space lunisolar periodic terms --
 * is measured per regime in SatelliteInfo.accuracy.
 */
export const SATELLITE_RECORD_FLOATS = 12;

/**
 * One satellite's OMM exactly as CelesTrak's GP JSON carries it -- the CCSDS OMM field
 * names (502.0-B-3) -- so satellite.js `json2satrec(omm)` takes it unchanged. Mean
 * elements in TEME for SGP4 (EPHEMERIS_TYPE 0).
 */
export interface SatelliteOmm {
  readonly OBJECT_NAME: string;
  /** COSPAR international designator, "1998-067A". */
  readonly OBJECT_ID: string;
  /** "2026-10-21T04:56:12.345678": UTC, with no zone suffix. */
  readonly EPOCH: string;
  /** Kozai mean motion, revolutions per day. */
  readonly MEAN_MOTION: number;
  readonly ECCENTRICITY: number;
  /** Degrees, as are the three angles after it. */
  readonly INCLINATION: number;
  readonly RA_OF_ASC_NODE: number;
  readonly ARG_OF_PERICENTER: number;
  readonly MEAN_ANOMALY: number;
  readonly EPHEMERIS_TYPE: number;
  readonly CLASSIFICATION_TYPE: string;
  readonly NORAD_CAT_ID: number;
  readonly ELEMENT_SET_NO: number;
  readonly REV_AT_EPOCH: number;
  /** SGP4's drag term, per Earth radius. */
  readonly BSTAR: number;
  /** Half the first derivative of the mean motion, rev/day² (the TLE convention). */
  readonly MEAN_MOTION_DOT: number;
  /** A sixth of its second derivative, rev/day³. */
  readonly MEAN_MOTION_DDOT: number;
}

/** A satellite drawn by name and propagated with full SGP4: one entry of `named.json`. */
export interface NamedSatellite {
  /** Stable slug: 'iss', 'hubble', 'landsat-9'. */
  readonly id: string;
  /** How the app names it: "International Space Station", "Landsat 9". */
  readonly name: string;
  readonly noradId: number;
  /** COSPAR designator, "1998-067A". */
  readonly cosparId: string;
  /** Who flies it, as it names itself: "NASA", "NASA/USGS", "NOAA", "CMSA". */
  readonly operator: string;
  /** Launch date, ISO "YYYY-MM-DD", from CelesTrak's SATCAT; null where it has none. */
  readonly launchDate: string | null;
  /** Group mask, regime and object type, packed as a record's `flags`. */
  readonly flags: number;
  /** What SGP4 does poorly for it, in the info panel's words; null where it is the right model. */
  readonly note: string | null;
  /**
   * Largest deployed dimension, metres, as published: what the body's radius stands for,
   * as a spacecraft's does (Mission's note). Present with `shape`, and only with it; data
   * from before the shapes has neither, and such a satellite stays a marker.
   */
  readonly spanM?: number;
  /** What it is drawn as up close, as a spacecraft is: see CraftShape. */
  readonly shape?: CraftShape;
  readonly omm: SatelliteOmm;
}

/** A satellite of the SGP4 tier, `sgp4.json`: one the bulk model cannot follow. */
export interface SgpSatellite {
  /** Group mask, regime and object type, packed as a record's `flags`. */
  readonly flags: number;
  /** Launch date, ISO "YYYY-MM-DD", from CelesTrak's SATCAT; null where it has none. */
  readonly launchDate: string | null;
  /**
   * The bulk model's largest miss against SGP4 in the window, km: why it is here. Null
   * where SGP4 itself stops inside the window -- the object is re-entering.
   */
  readonly bulkErrorKm: number | null;
  readonly omm: SatelliteOmm;
}

/** The bulk model's error against full SGP4 for one regime; see SatelliteInfo.accuracy. */
export interface SatelliteAccuracy {
  readonly regime: SatelliteRegime;
  /** Satellites measured: a sample of this run's bulk in that regime. */
  readonly count: number;
  /** Days from the reference instant, both signs measured and the worse kept. */
  readonly days: readonly number[];
  /** Median position error at each of `days`, km. */
  readonly medianKm: readonly number[];
  /** 95th-percentile position error at each of `days`, km. */
  readonly p95Km: readonly number[];
}

/**
 * `satellites/satellites.json`: what the layer holds and how to read it. Written last, so
 * a directory that has it has every file it names.
 */
export interface SatelliteInfo {
  readonly source: {
    readonly name: string;
    readonly url: string;
    /** When the GP data was downloaded, ISO UTC. */
    readonly queriedAt: string;
  };
  /** The line to show wherever satellites are drawn. */
  readonly credit: string;
  /** UTC Julian day the records' angles are given at, and the frame matrix is for. */
  readonly referenceJdUtc: number;
  readonly frame: {
    /** The elements' frame, as SGP4 defines it. */
    readonly elements: 'TEME';
    /**
     * TEME at referenceJdUtc to ecliptic and mean equinox of J2000, row-major 3×3:
     * r_scene = m · r_TEME. IAU 1976 precession, IAU 1980 nutation with the equation of
     * the equinoxes, then the IAU 1976 obliquity Horizons' ECLIPTIC frame uses.
     */
    readonly temeToEclipticJ2000: readonly number[];
    /**
     * Largest angle between this one matrix and the exact one for the instant, over
     * referenceJdUtc ± windowDays, arcseconds.
     */
    readonly maxErrorArcsec: number;
    readonly windowDays: number;
  };
  /** SATELLITE_GROUPS, in bit order. */
  readonly groups: readonly SatelliteGroup[];
  /** Satellites in each group, named and bulk together. */
  readonly groupCounts: Readonly<Partial<Record<SatelliteGroup, number>>>;
  /**
   * Groups not read this run, whose bit is therefore never set: CelesTrak refused or
   * failed, and it asks clients to stop at the first error rather than retry.
   */
  readonly groupsMissing: readonly SatelliteGroup[];
  readonly regimes: readonly SatelliteRegime[];
  readonly regimeCounts: Readonly<Partial<Record<SatelliteRegime, number>>>;
  readonly objectTypes: readonly SatelliteObjectType[];
  /** Satellites written, both tiers. */
  readonly count: number;
  /** `named.json`: NamedSatellite[]. */
  readonly named: { readonly file: string; readonly count: number };
  /** `bulk.bin`: SATELLITE_RECORD_FLOATS float32s per satellite. */
  readonly bulk: {
    readonly file: string;
    readonly count: number;
    readonly bytes: number;
    readonly recordFloats: typeof SATELLITE_RECORD_FLOATS;
  };
  /** `bulk-names.json`: SatelliteNames, entry k for bulk record k. */
  readonly names: { readonly file: string };
  /** `sgp4.json`: SgpSatellite[], and the rule that put them there. */
  readonly sgp4: {
    readonly file: string;
    readonly count: number;
    /** A satellite the bulk model misses SGP4 by more than this is here, km. */
    readonly thresholdKm: number;
    /** Over referenceJdUtc ± this many days. */
    readonly windowDays: number;
  };
  /** The span of the element epochs written, UTC Julian days. */
  readonly epochs: { readonly minJdUtc: number; readonly maxJdUtc: number };
  /**
   * Element sets older than this at the reference were dropped as stale, days -- for
   * objects with a perigee below 2,000 km, in drag. Higher ones are kept to CelesTrak's
   * own 30 days.
   */
  readonly maxElementAgeDays: number;
  /** Objects CelesTrak returned that were not written, and why. */
  readonly dropped: {
    /** In drag, and not observed for maxElementAgeDays: almost all of them debris. */
    readonly stale: number;
    /** SGP4 cannot place them at the reference: decayed, or elements outside its range. */
    readonly invalid: number;
    /** Drawn from Horizons as bodies of their own (TESS), so not twice. */
    readonly excluded: number;
  };
  /** The bulk model against full SGP4, measured on this run's own elements. */
  readonly accuracy: readonly SatelliteAccuracy[];
}

/** `satellites/bulk-names.json`, columnar: entry k is bulk record k. */
export interface SatelliteNames {
  /** CelesTrak's OBJECT_NAME: "STARLINK-1007", "COSMOS 2251 DEB". */
  readonly name: readonly string[];
  readonly noradId: readonly number[];
  readonly cosparId: readonly string[];
  /** Element epoch minus referenceJdUtc, days, to 0.01: negative, older than the reference. */
  readonly ageDays: readonly number[];
}
