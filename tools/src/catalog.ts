import { MOON_ORIENTATION } from './moonRotation.ts';
import type { BodyDefinition, CraftShape, TextureSetId } from './types.ts';

/**
 * Body catalog: the Sun, the eight planets, Pluto, their major moons, and the
 * interplanetary spacecraft.
 *
 * Physical constants are hard-coded rather than scraped from Horizons' OBJ_DATA
 * block, which is free-form prose and differs per body. These values do not change,
 * so a reviewed constant beats a fragile parser.
 *
 * Sources:
 *   - Radii: IAU WGCCRE 2015 report on cartographic coordinates and rotational
 *     elements (Archinal et al., Celest Mech Dyn Astr 130:22, 2018).
 *   - GM: JPL DE440/DE441 planetary ephemeris. For the giant planets these are
 *     system values (planet + satellites), which is how DE44x publishes them.
 *   - Rotation periods and axial tilts: NASA/JPL planetary fact sheets.
 *   - Moons: see MOONS below, which has its own sources and measurements.
 *
 * A moon is an entry with `parent` set and `center` pointing at the parent's Horizons
 * body center, e.g. Io: parent 'jupiter', center '500@599'. The frame tree does the
 * rest; nothing in the renderer knows which bodies are moons except to decide how
 * much of them to show.
 *
 * The web app does NOT read this file at runtime: it reads `bodies.json`, which the
 * generator writes from it, so the published site and the data it ships can never
 * disagree. The `@sss/tools/catalog` export exists for the web tests, which need the
 * real numbers before any data has been generated. It is pure data with no Node
 * imports, so nothing from the generator can reach the browser bundle through it.
 */

/** Solar System barycenter: the frame every top-level state vector is measured against. */
export const SSB_CENTER = '500@0';

/**
 * Sample spacing per body, in days.
 *
 * Measured, not guessed. Each body's daily ephemeris was downloaded over two years,
 * then decimated and re-interpolated with the same cubic Hermite the app uses, to
 * find the widest spacing that still lands well inside the body's own radius:
 *
 *   body      2d      4d      8d     16d     32d     64d     (error in body radii)
 *   Mercury  0.13    2.07   30.94  440.79       -       -
 *   Venus    0.00    0.01    0.12    1.96   30.97  473.34
 *   Earth    0.00    0.00    0.05    0.67    8.34  100.14
 *   Mars     0.00    0.00    0.01    0.17    2.67   41.82
 *   Jupiter  0.00    0.00    0.01    0.01    0.01    0.02
 *   Saturn   0.00    0.00    0.00    0.01    0.01    0.02
 *   Uranus   0.00    0.00    0.00    0.00    0.01    0.02
 *   Neptune  0.00    0.00    0.01    0.01    0.03    0.02
 *   Pluto    0.07    0.86    5.57    7.83    7.05   12.60
 *
 * Two things fall out of that. The outer planets are enormously oversampled at one
 * day — Neptune's 165-year orbit gets 60,000 samples per revolution — while Mercury,
 * at 47 km/s, genuinely needs every one. And Pluto is limited not by its orbit but by
 * Charon: its body center circles their shared barycenter every 6.4 days, so no
 * spacing wider than a couple of days can follow it.
 *
 * Each value below is one notch safer than the measured limit — and the four giants
 * are two notches, at 32 days rather than the 64 their positions tolerate.
 *
 * Position is not the reason: it is 0.02 body radii either way, and Neptune's
 * interpolated position sits 360 km from JPL's on a 4.47e9 km orbit. Velocity is.
 * The orbit ellipse is now derived from the interpolated state, and Hermite velocity
 * error scales as h^3 where position error scales as h^4. Neptune at 32 days carries
 * 1.34 m/s of velocity error out of 5.47 km/s — 2.4e-4 — and that lands amplified in
 * the eccentricity, because at e = 0.01 the eccentricity vector is the difference of
 * two nearly equal terms and magnifies velocity error by roughly 1/e. Halving the
 * step costs 456 samples across the catalog, under 3%.
 */

/**
 * The Sun's body center, used for osculating elements.
 *
 * State vectors want the barycenter, because it is the inertial origin. Orbital
 * elements want the Sun, because a Keplerian ellipse is defined by the dominating
 * mass at its focus. Asking Horizons for barycentric elements gives numbers that
 * look plausible but are wrong: measured against the barycenter, Mercury's
 * semi-major axis comes out 2% off and its period 3% off, because the barycenter
 * is displaced from the Sun by up to ~1.5e6 km (mostly Jupiter's pull) -- a large
 * fraction of Mercury's own 0.39 AU orbit. Against the Sun's center the same
 * request lands within 0.01%.
 */
export const SUN_CENTER = '500@10';

/**
 * IAU rotational elements, carried in each body's `rotation`: `poleRaDeg`,
 * `poleDecDeg`, `primeMeridianDeg` and `rotationRateDegPerDay`.
 *
 * Source: IAU WGCCRE 2015 report (Archinal et al., Celest Mech Dyn Astr 130:22,
 * 2018) -- the same report the radii come from. They answer two questions a bare
 * rotation period cannot: which way the axis points in inertial space, and which
 * face is turned toward you at a given instant. Both become visible the moment a
 * body carries a texture instead of a flat colour.
 *
 * `W = W0 + Wdot * d`, with d in days from J2000 TDB, measured east along the
 * body's equator from its ascending node on the ICRF equator.
 *
 * Three things about these numbers are worth stating rather than discovering later:
 *
 *  - **Only the constant terms are here.** The report also gives per-century rates
 *    for the pole (Earth: -0.641 deg/century in RA) and periodic terms for several
 *    bodies. Over this project's twenty-year window the pole rates amount to under
 *    0.07 deg, and every periodic term is below 0.01 deg -- except Neptune's, which
 *    reaches 0.7 deg. At 2048 px of texture across 360 deg that is 4 pixels on a
 *    body whose surface is a featureless blue disc, so it is dropped along with the
 *    rest. Documented in the README under Known approximations.
 *  - **The giants rotate by their magnetic field.** Jupiter, Saturn, Uranus and
 *    Neptune have no surface to track, so IAU defines W from the rotation of the
 *    magnetic field (System III). That is the convention every published map of
 *    them is drawn against, so it is the right one to use here.
 *  - **`rotationRateDegPerDay` is not a second copy of `rotationPeriodHours`.**
 *    They agree in magnitude to better than 0.01% and a test pins that. They do not
 *    always agree in sign, and that is not a bug -- see Pluto below.
 */

/**
 * The two selectable surface-map sets, and the honest statement of each.
 *
 * There is no single source that is both complete and photometric. That is not a gap
 * in the search -- it is the state of what has been published. Measured mean
 * saturation, source against source:
 *
 *   body      illustrative (SSS)   NASA alternative   better
 *   Mars                   60.8%              49.4%   NASA
 *   Neptune                67.6%              47.7%   NASA
 *   Earth                  52.6%     64.2% (Blue Marble)   Blue Marble, calibrated
 *   Venus                  44.3%              92.7%   SSS (NASA's is radar, tinted)
 *   Jupiter                14.0%              64.7%   SSS (NASA's is enhanced)
 *   Saturn                 21.4%              68.2%   SSS (NASA's is enhanced)
 *
 * Note Earth: Blue Marble is *more* saturated and still the true-colour answer, because
 * deep ocean and vegetation really are that saturated. Saturation was a useful signal
 * for spotting enhancement, never a definition of truth.
 *
 * So `photometric` differs on three bodies out of ten. Presenting it as a complete
 * true-colour set would be the dishonest move; the UI states the count.
 */
export const TEXTURE_SETS: readonly {
  readonly id: TextureSetId;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: 'illustrative',
    label: 'Illustrative',
    description:
      'Solar System Scope. NASA imagery with colour and contrast added by its ' +
      'authors: complete and vivid, and not a measurement. More saturated than what ' +
      'a camera would record.',
  },
  {
    id: 'photometric',
    label: 'True colour',
    description:
      'A calibrated or mission product wherever one has been published, which is ' +
      'Earth, Mars and Neptune. The other seven keep the illustrative map because no ' +
      'better source exists -- the NASA maps of Venus, Jupiter and Saturn are more ' +
      'enhanced, not less.',
  },
];

/** Bodies whose map actually changes between the two sets. */
export function bodiesDifferingBySet(): readonly string[] {
  return CATALOG.filter(
    (body) =>
      body.textures !== null &&
      body.textures.illustrative.file !== body.textures.photometric.file,
  ).map((body) => body.id);
}

/** A sub-day sample spacing, written the way it is measured. */
function minutes(count: number): number {
  return count / 1440;
}

/** What differs from one moon to the next; everything else follows from it. */
interface MoonSpec {
  readonly id: string;
  readonly name: string;
  readonly horizonsId: string;
  readonly parent: string;
  /** The parent's Horizons body id: the center its vectors and elements are taken at. */
  readonly parentHorizonsId: string;
  readonly stepDays: number;
  readonly vectorWindow: 'full' | 'short';
  readonly gmKm3S2: number;
  readonly rotationPeriodHours: number;
  readonly axialTiltDeg: number | null;
  readonly color: string;
  /**
   * The surface map, or null for a moon drawn in flat colour.
   *
   * One map serves both sets: for no moon is there a calibrated product *and* an
   * illustrative one to choose between, so the choice would be a pretence. Most are
   * greyscale -- clear-filter mission mosaics -- because that is what exists. The origin
   * is measured from the pixels against a named feature, per moon, in
   * textureAlignment.test.ts.
   */
  readonly map: { readonly file: string; readonly longitudeOriginDeg: number } | null;
}

/**
 * A moon: its orbit from JPL, its shape and rotation from the IAU.
 *
 * Shape and rotation come together from moonRotation.ts, and they have to. Most of
 * these moons are triaxial rather than oblate -- Mimas is 207.8 x 196.7 x 190.6 km, its
 * long axis locked toward Saturn -- so drawing the real shape means knowing which way
 * the body faces, and a body stretched along the wrong axis would be a guess dressed as
 * a measurement.
 *
 * `radiusEquatorialKm` is the long axis a, not the mean radius: it is what the camera's
 * closest approach and the marker's size are measured against, and a camera allowed
 * inside Phobos's long end would be inside Phobos.
 *
 * Vectors are requested against the planet's body center, not the barycenter: that
 * makes each table the parent-relative state the frame tree sums, and it is what the
 * osculating elements need at their focus.
 */
function moon(spec: MoonSpec): BodyDefinition {
  const center = `500@${spec.parentHorizonsId}`;
  const orientation = MOON_ORIENTATION[spec.id];
  if (orientation === undefined) {
    throw new Error(`No IAU orientation for ${spec.id}.`);
  }
  const [a, b, c] = orientation.radiiKm;
  return {
    id: spec.id,
    name: spec.name,
    horizonsId: spec.horizonsId,
    stepDays: spec.stepDays,
    vectorWindow: spec.vectorWindow,
    center,
    elementsCenter: center,
    parent: spec.parent,
    kind: 'moon',
    radiusEquatorialKm: a,
    radiusPolarKm: c,
    // A spheroid needs only the two radii above; three are carried only when the
    // equator itself is not round.
    triaxialRadiiKm: a === b ? null : [a, b, c],
    gmKm3S2: spec.gmKm3S2,
    gmBodyOnlyKm3S2: spec.gmKm3S2,
    rotationPeriodHours: spec.rotationPeriodHours,
    axialTiltDeg: spec.axialTiltDeg,
    rotation: orientation.rotation,
    color: spec.color,
    drawOrbit: true,
    textures: spec.map === null ? null : { illustrative: spec.map, photometric: spec.map },
    rings: null,
    mission: null,
  };
}

/**
 * The major moons: the nineteen massive enough to have pulled themselves round, plus
 * Mars's two. Mimas, at 198 km, is the smallest body known to have done so.
 *
 * Sources:
 *   - Horizons ids and GM: JPL SSD planetary satellite physical parameters
 *     (ssd.jpl.nasa.gov/sats/phys_par), GM from each system's own satellite
 *     ephemeris -- DE440, MAR097, JUP365, SAT441, URA111, NEP097, PLU060.
 *   - Shapes: the IAU 2015 triaxial radii, in moonRotation.ts. The error column below
 *     is against the IAU mean radius, R, which the step was chosen by.
 *   - Rotation: every one of these is tidally locked, which Horizons states as
 *     "Rotational period = Synchronous", so the period is the sidereal orbital period.
 *     Negative, as for the planets, where the moon turns backwards against the IAU pole:
 *     Uranus's five, Triton and Charon. The full IAU elements and the shapes are in
 *     moonRotation.ts.
 *   - The Moon's 6.67 deg obliquity: the Horizons physical data sheet.
 *
 * **Sample spacing, measured against JPL.** Each moon's ephemeris was downloaded over
 * three orbits at a fifteenth of the step below, decimated to the step, and
 * re-interpolated with the app's own Hermite. Worst position error:
 *
 *   moon        step   per orbit   error        per year
 *   Moon        1 d       27.3      4.23 km  0.0024 R      365
 *   Phobos     15 m       30.6     0.048 km  0.0044 R   35,064
 *   Deimos     45 m       40.4     0.036 km  0.0057 R   11,688
 *   Io          2 h       21.2      8.62 km  0.0047 R    4,383
 *   Europa      4 h       21.3     14.08 km  0.0090 R    2,192
 *   Ganymede    8 h       21.5     20.68 km  0.0079 R    1,096
 *   Callisto   16 h       25.0     21.94 km  0.0091 R      548
 *   Mimas      45 m       30.2      1.06 km  0.0053 R   11,688
 *   Enceladus  75 m       26.3      2.07 km  0.0082 R    7,013
 *   Tethys      2 h       22.7      4.50 km  0.0085 R    4,383
 *   Dione     150 m       26.3      3.24 km  0.0058 R    3,506
 *   Rhea        4 h       27.1      3.96 km  0.0052 R    2,192
 *   Titan      16 h       23.9     18.84 km  0.0073 R      548
 *   Iapetus   1.5 d       52.9      2.87 km  0.0039 R      244
 *   Miranda    90 m       22.6      2.02 km  0.0086 R    5,844
 *   Ariel       3 h       20.2      4.66 km  0.0081 R    2,922
 *   Umbriel     4 h       24.9      2.90 km  0.0050 R    2,192
 *   Titania     8 h       26.1      3.82 km  0.0048 R    1,096
 *   Oberon     12 h       26.9      4.58 km  0.0060 R      731
 *   Triton      7 h       20.1      8.65 km  0.0064 R    1,252
 *   Charon     12 h       12.8      2.95 km  0.0049 R      731
 *
 * The rule is the planets' own: under a hundredth of the body's radius. What falls
 * out is that about 24 samples an orbit does it for nearly everything, because
 * Hermite error goes as (step x angular rate)^4 and a moon's radius is a similar
 * fraction of its orbit across the whole set. Two need more. Deimos and Phobos are
 * so small against their orbits that 40 and 31 samples are needed to hold 60 m and
 * 50 m. Iapetus needs 53 because the Sun perturbs its distant orbit hard enough to
 * bend it within a revolution. Charon, the other way, gets by on 13: it is large
 * against an orbit only 33 Pluto radii across.
 *
 * That sums to 99,700 samples a year -- six times the entire twenty-year planetary
 * set -- which is why the fast moons carry the short window and ship in chunks. The
 * Moon is the exception: at one sample a day its twenty years cost less than
 * Mercury's, so it takes the full window like a planet.
 */
const MOONS: readonly BodyDefinition[] = [
  moon({
    id: 'moon',
    name: 'Moon',
    horizonsId: '301',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    vectorWindow: 'full',
    gmKm3S2: 4902.800066,
    rotationPeriodHours: 655.7199,
    axialTiltDeg: 6.67,
    color: '#b8b8b8',
    map: { file: 'moon.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'phobos',
    name: 'Phobos',
    horizonsId: '401',
    parent: 'mars',
    parentHorizonsId: '499',
    stepDays: minutes(15),
    vectorWindow: 'short',
    gmKm3S2: 0.0007087,
    rotationPeriodHours: 7.6538,
    axialTiltDeg: null,
    color: '#a08a78',
    map: { file: 'phobos.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'deimos',
    name: 'Deimos',
    horizonsId: '402',
    parent: 'mars',
    parentHorizonsId: '499',
    stepDays: minutes(45),
    vectorWindow: 'short',
    gmKm3S2: 0.0000962,
    rotationPeriodHours: 30.2986,
    axialTiltDeg: null,
    color: '#b8a48c',
    // Left in flat colour on purpose. The one global map (Stooke, from Viking) cannot
    // be placed: its USGS world file puts longitude 0 at the left edge, the author's
    // own guide puts it in the middle, and Deimos's only named craters -- Voltaire and
    // Swift, 1 to 2 km across -- cannot be picked out of it to settle which. Half a turn
    // wrong would look exactly as plausible as right.
    map: null,
  }),
  moon({
    id: 'io',
    name: 'Io',
    horizonsId: '501',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(120),
    vectorWindow: 'short',
    gmKm3S2: 5959.91547,
    rotationPeriodHours: 42.4593,
    axialTiltDeg: null,
    color: '#e6d45c',
    map: { file: 'io.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'europa',
    name: 'Europa',
    horizonsId: '502',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(240),
    vectorWindow: 'short',
    gmKm3S2: 3202.7121,
    rotationPeriodHours: 85.2283,
    axialTiltDeg: null,
    color: '#d2c2a0',
    map: { file: 'europa.jpg', longitudeOriginDeg: 0 },
  }),
  moon({
    id: 'ganymede',
    name: 'Ganymede',
    horizonsId: '503',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(480),
    vectorWindow: 'short',
    gmKm3S2: 9887.83275,
    rotationPeriodHours: 171.7093,
    axialTiltDeg: null,
    color: '#aca296',
    map: { file: 'ganymede.jpg', longitudeOriginDeg: 0 },
  }),
  moon({
    id: 'callisto',
    name: 'Callisto',
    horizonsId: '504',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(960),
    vectorWindow: 'short',
    gmKm3S2: 7179.2834,
    rotationPeriodHours: 400.5364,
    axialTiltDeg: null,
    color: '#8a7e70',
    map: { file: 'callisto.jpg', longitudeOriginDeg: 0 },
  }),
  moon({
    id: 'mimas',
    name: 'Mimas',
    horizonsId: '601',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(45),
    vectorWindow: 'short',
    gmKm3S2: 2.50349,
    rotationPeriodHours: 22.6181,
    axialTiltDeg: null,
    color: '#c4c4c4',
    map: { file: 'mimas.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'enceladus',
    name: 'Enceladus',
    horizonsId: '602',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(75),
    vectorWindow: 'short',
    gmKm3S2: 7.21037,
    rotationPeriodHours: 32.8852,
    axialTiltDeg: null,
    color: '#eef2f6',
    map: { file: 'enceladus.jpg', longitudeOriginDeg: 0 },
  }),
  moon({
    id: 'tethys',
    name: 'Tethys',
    horizonsId: '603',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(120),
    vectorWindow: 'short',
    gmKm3S2: 41.21353,
    rotationPeriodHours: 45.3072,
    axialTiltDeg: null,
    color: '#dcdcd4',
    map: { file: 'tethys.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'dione',
    name: 'Dione',
    horizonsId: '604',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(150),
    vectorWindow: 'short',
    gmKm3S2: 73.11607,
    rotationPeriodHours: 65.686,
    axialTiltDeg: null,
    color: '#c8c8c0',
    map: { file: 'dione.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'rhea',
    name: 'Rhea',
    horizonsId: '605',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(240),
    vectorWindow: 'short',
    gmKm3S2: 153.94175,
    rotationPeriodHours: 108.42,
    axialTiltDeg: null,
    color: '#bcb8b0',
    map: { file: 'rhea.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'titan',
    name: 'Titan',
    horizonsId: '606',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(960),
    vectorWindow: 'short',
    gmKm3S2: 8978.1371,
    rotationPeriodHours: 382.6908,
    axialTiltDeg: null,
    color: '#dca84e',
    map: { file: 'titan.jpg', longitudeOriginDeg: 0 },
  }),
  moon({
    id: 'iapetus',
    name: 'Iapetus',
    horizonsId: '608',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: 1.5,
    vectorWindow: 'short',
    gmKm3S2: 120.51511,
    rotationPeriodHours: 1903.944,
    axialTiltDeg: null,
    color: '#a8987f',
    map: { file: 'iapetus.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'miranda',
    name: 'Miranda',
    horizonsId: '705',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(90),
    vectorWindow: 'short',
    gmKm3S2: 4.3,
    rotationPeriodHours: -33.9235,
    axialTiltDeg: null,
    color: '#b4b4b4',
    map: { file: 'miranda.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'ariel',
    name: 'Ariel',
    horizonsId: '701',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(180),
    vectorWindow: 'short',
    gmKm3S2: 83.5,
    rotationPeriodHours: -60.4891,
    axialTiltDeg: null,
    color: '#ccc8c2',
    map: { file: 'ariel.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'umbriel',
    name: 'Umbriel',
    horizonsId: '702',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(240),
    vectorWindow: 'short',
    gmKm3S2: 85.1,
    rotationPeriodHours: -99.4602,
    axialTiltDeg: null,
    color: '#8e8a86',
    map: { file: 'umbriel.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'titania',
    name: 'Titania',
    horizonsId: '703',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(480),
    vectorWindow: 'short',
    gmKm3S2: 226.9,
    rotationPeriodHours: -208.9409,
    axialTiltDeg: null,
    color: '#b6aea6',
    map: { file: 'titania.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'oberon',
    name: 'Oberon',
    horizonsId: '704',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(720),
    vectorWindow: 'short',
    gmKm3S2: 205.3,
    rotationPeriodHours: -323.1177,
    axialTiltDeg: null,
    color: '#a69e96',
    map: { file: 'oberon.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'triton',
    name: 'Triton',
    horizonsId: '801',
    parent: 'neptune',
    parentHorizonsId: '899',
    stepDays: minutes(420),
    vectorWindow: 'short',
    gmKm3S2: 1428.49546,
    // Negative, like Uranus and its moons: turning backwards against the IAU pole, which
    // is what the sign means across this catalog. A first version made it positive on
    // the grounds that a locked moon turns the way it orbits -- true, and the wrong
    // question. JPL settled it: measured the other way, Triton's sub-Neptune longitude
    // came out 5.5 degrees from Horizons on every date, exactly twice its own value.
    rotationPeriodHours: -141.0445,
    axialTiltDeg: null,
    color: '#d6cac2',
    map: { file: 'triton.jpg', longitudeOriginDeg: 180 },
  }),
  moon({
    id: 'charon',
    name: 'Charon',
    horizonsId: '901',
    parent: 'pluto',
    parentHorizonsId: '999',
    stepDays: minutes(720),
    vectorWindow: 'short',
    gmKm3S2: 106.1,
    // Pluto's own day, within seconds: the two are locked to each other.
    rotationPeriodHours: -153.2935,
    axialTiltDeg: null,
    color: '#aca49a',
    map: { file: 'charon.jpg', longitudeOriginDeg: 180 },
  }),
];

/** What differs from one spacecraft to the next. */
interface SpacecraftSpec {
  readonly id: string;
  readonly name: string;
  readonly horizonsId: string;
  /** Null for a craft in orbit about the Sun; the body id for one tied to a planet. */
  readonly parent: string | null;
  readonly parentHorizonsId: string | null;
  /** The coarse step refinement starts from, days. See `SPACECRAFT` below. */
  readonly stepDays: number;
  /** Largest deployed dimension, metres. */
  readonly spanM: number;
  readonly launchUtc: string;
  readonly operator: string;
  /** See Mission.endUtc: only for a craft that was destroyed. */
  readonly endUtc?: string;
  readonly color: string;
  /** See CraftShape, and SHAPES below for where each one comes from. */
  readonly shape: CraftShape | null;
}

/**
 * A spacecraft: its path from JPL, and nothing drawn that is not known.
 *
 * No orbit line, because a spacecraft does not fly a conic -- its path is gravity
 * assists, burns and hand-overs between trajectory files, and an osculating ellipse
 * through it would be a shape it never follows. No sphere either: the radius stands for
 * the craft's size so the camera can frame it, and there is no model yet to put there.
 */
function spacecraft(spec: SpacecraftSpec): BodyDefinition {
  const center = spec.parentHorizonsId === null ? SSB_CENTER : `500@${spec.parentHorizonsId}`;
  const radiusKm = spec.spanM / 2 / 1000;
  return {
    id: spec.id,
    name: spec.name,
    horizonsId: spec.horizonsId,
    stepDays: spec.stepDays,
    vectorWindow: 'mission',
    center,
    elementsCenter: center,
    parent: spec.parent,
    kind: 'spacecraft',
    radiusEquatorialKm: radiusKm,
    radiusPolarKm: radiusKm,
    triaxialRadiiKm: null,
    // A few thousand kilograms is a GM of 1e-16 km^3/s^2: nothing orbits it, and it
    // bends nothing it passes.
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    color: spec.color,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: {
      launchUtc: spec.launchUtc,
      operator: spec.operator,
      endUtc: spec.endUtc ?? null,
      shape: spec.shape,
    },
  };
}

/**
 * What each craft looks like up close, and which way it faces. See CraftShape.
 *
 * **Models.** NASA's own, from NASA 3D Resources (science.nasa.gov/3d-resources and the
 * nasa/NASA-3D-Resources mirror), compressed for the web -- see web/public/models/
 * CREDITS.md for each file's source and how it was processed. NASA's 3D content is
 * "generally not subject to copyright in the United States" and may be used for
 * "computer graphical simulations and Internet Web pages", with NASA acknowledged as
 * the source. None states its units; every one measures in metres against a published
 * dimension, within 10%:
 *
 *   model            measured                      published
 *   Voyager          dish 3.82 m                   3.7 m high-gain antenna
 *   Pioneer 10       dish 2.88 m                   2.74 m
 *   New Horizons     dish 1.94 m                   2.1 m
 *   Parker           shield mount 2.18 m           2.3 m heat shield
 *   JWST             sunshield 21.0 x 12.9 m       21.2 x 14.2 m
 *   Europa Clipper   span 30.50 m                  30.5 m
 *
 * One model serves both Voyagers, and Pioneer 10's serves Pioneer 11: the pairs were
 * built alike, and no model of the second of either was published.
 *
 * **Axes** were read off the geometry, since no model documents them: each dish's
 * opening side by where its feed sits, Parker's shield by its mounting at -Z, JWST's
 * sunshield by the telescope standing on its +Y side, Clipper's cells by their normals
 * (+Z, all 3,200 of them).
 *
 * **Boxes**, for the three with no model that may be used: Juice's is ESA's, with no
 * licence stated, and Lucy's and Psyche's exist only inside NASA Eyes, with no terms
 * published. Each box is as long as the craft's solar-array span, as wide as one array,
 * and as deep as its body, every figure published:
 *
 *   Lucy     15.82 x 7.28 x 2.00 m   NASA: width, height deployed, depth
 *   Psyche   24.76 x 7.34 x 2.4 m    JPL: flight system long x wide; bus deep
 *   Juice    27.1 x 3.5 x 2.86 m     ESA: across the arrays; one panel's long side
 *                                    (ten 2.5 x 3.5 m panels, five a wing); the
 *                                    smallest side of the stowed craft
 *
 * Juice's full deployed envelope is 16.8 x 27.1 x 13.7 m, but most of that is the
 * 16 m radar antenna and the 10.6 m magnetometer boom; a solid box that size would
 * be a brick with nothing of the craft in it.
 *
 * The boxes face the Sun with their broad side, as the arrays they stand for do.
 */
const SUN_FACING_BOX = {
  pointsAt: 'sun',
  pointingPart: 'solar-arrays',
  pointingAxis: [0, 0, 1],
  rollAxis: [0, 1, 0],
} as const;
const SHAPES = {
  voyager: {
    model: 'voyager.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'earth',
    pointingPart: 'dish',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
  pioneer: {
    model: 'pioneer.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'earth',
    pointingPart: 'dish',
    pointingAxis: [0, 0, -1],
    rollAxis: [0, -1, 0],
  },
  newHorizons: {
    model: 'new-horizons.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'earth',
    pointingPart: 'dish',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
  parker: {
    model: 'parker-solar-probe.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'heat-shield',
    pointingAxis: [0, 0, -1],
    rollAxis: [0, 1, 0],
  },
  jwst: {
    model: 'jwst.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'sunshield',
    pointingAxis: [0, -1, 0],
    rollAxis: [1, 0, 0],
  },
  europaClipper: {
    model: 'europa-clipper.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, 0, 1],
    rollAxis: [0, 1, 0],
  },
  juice: { model: null, metresPerUnit: 1, boxM: [27.1, 3.5, 2.86], ...SUN_FACING_BOX },
  lucy: { model: null, metresPerUnit: 1, boxM: [15.82, 7.28, 2.0], ...SUN_FACING_BOX },
  psyche: { model: null, metresPerUnit: 1, boxM: [24.76, 7.34, 2.4], ...SUN_FACING_BOX },
} as const satisfies Record<string, CraftShape>;

/**
 * The interplanetary spacecraft.
 *
 * Sources:
 *   - Paths: JPL Horizons, each craft's own reconstructed and predicted trajectory.
 *     What Horizons covers is asked each run rather than written here, because it moves:
 *     a mission still flying gets a new predicted trajectory every few weeks.
 *   - Launch instants: the Horizons object summary for each craft, except Voyager 1,
 *     whose summary lists the date of the 6th in its timeline; the launch was
 *     1977-09-05 12:56 UTC, which is also where its trajectory begins.
 *   - Spans: Horizons' summary where it gives one (New Horizons 2.5 m, JWST's
 *     21.197 m sunshield, Europa Clipper 30.5 m, Lucy 14.25 m, Psyche 24.76 m);
 *     otherwise NASA's mission pages (Voyager's 13 m magnetometer boom, Pioneer's
 *     6.6 m one, Parker's 3 m height) and ESA's Juice specifications (27.1 m across
 *     the solar arrays).
 *
 * **Sampling.** Not one step per craft, which is what the planets and moons get: no
 * single step can follow Juice through a year of cruise and through its Earth flyby
 * both. `stepDays` is where the adaptive refinement starts, and it refines down to a
 * minute wherever the interpolation would miss by more than SPACECRAFT_TOLERANCE_KM.
 * The step is only a starting guess, so a wrong one costs requests rather than
 * accuracy. The five coasting out of the Solar System start at 32 days, and there the
 * Voyagers and Pioneers need no refinement at all -- worst estimate 2 m -- so each is
 * one request and 229 samples for twenty years. That matters more than for the others,
 * because a table this small ships whole and is waited for at startup: at eight days
 * the five cost 190 KB compressed, at 32 they cost 58. New Horizons refines only at
 * its trajectory seams. The rest start at one day.
 *
 * Measured over the twenty-year window, 2026-09-25:
 *
 *   craft               samples   refinements   chunks
 *   Voyager 1, 2, Pioneer 10, 11   229 each     0      1
 *   New Horizons             465        53       1
 *   Parker Solar Probe    92,947       120      63
 *   JWST                   3,789        22       3
 *   Juice                  4,545        48       4
 *   Europa Clipper        32,317       285      22
 *   Lucy                   5,035        61       4
 *   Psyche                 3,019       252       3
 *
 * Parker is most of it, and for the reason it exists: twenty-odd perihelia at up to
 * 190 km/s, each needing minutes. Psyche's many short refinements are most likely its
 * electric thrusters switching on and off, each one a kink in the path -- not verified.
 * Against JPL at off-grid instants inside the hardest stretches -- two Earth flybys, a
 * Mars flyby, a perihelion -- the worst miss is 110 m; see spacecraftJpl.test.ts.
 *
 * JWST hangs off Earth rather than the Sun, because that is what it moves with: it
 * circles the Sun-Earth L2 point 1.5 million km beyond Earth, and against Earth its
 * six-month halo orbit is what the samples have to follow.
 */
const SPACECRAFT: readonly BodyDefinition[] = [
  spacecraft({
    id: 'voyager-1',
    shape: SHAPES.voyager,
    name: 'Voyager 1',
    horizonsId: '-31',
    parent: null,
    parentHorizonsId: null,
    stepDays: 32,
    spanM: 13,
    launchUtc: '1977-09-05T12:56:00Z',
    operator: 'NASA',
    color: '#c9b37a',
  }),
  spacecraft({
    id: 'voyager-2',
    shape: SHAPES.voyager,
    name: 'Voyager 2',
    horizonsId: '-32',
    parent: null,
    parentHorizonsId: null,
    stepDays: 32,
    spanM: 13,
    launchUtc: '1977-08-20T14:29:00Z',
    operator: 'NASA',
    color: '#b8a36c',
  }),
  spacecraft({
    id: 'pioneer-10',
    shape: SHAPES.pioneer,
    name: 'Pioneer 10',
    horizonsId: '-23',
    parent: null,
    parentHorizonsId: null,
    stepDays: 32,
    spanM: 6.6,
    launchUtc: '1972-03-03T01:49:00Z',
    operator: 'NASA',
    color: '#a8a8b8',
  }),
  spacecraft({
    id: 'pioneer-11',
    shape: SHAPES.pioneer,
    name: 'Pioneer 11',
    horizonsId: '-24',
    parent: null,
    parentHorizonsId: null,
    stepDays: 32,
    spanM: 6.6,
    launchUtc: '1973-04-06T02:11:00Z',
    operator: 'NASA',
    color: '#9898a8',
  }),
  spacecraft({
    id: 'new-horizons',
    shape: SHAPES.newHorizons,
    name: 'New Horizons',
    horizonsId: '-98',
    parent: null,
    parentHorizonsId: null,
    stepDays: 32,
    spanM: 2.5,
    launchUtc: '2006-01-19T19:00:00Z',
    operator: 'NASA',
    color: '#d8c8a0',
  }),
  spacecraft({
    id: 'parker-solar-probe',
    shape: SHAPES.parker,
    name: 'Parker Solar Probe',
    horizonsId: '-96',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 3,
    launchUtc: '2018-08-12T07:31:00Z',
    operator: 'NASA',
    color: '#e0a060',
  }),
  spacecraft({
    id: 'jwst',
    shape: SHAPES.jwst,
    name: 'James Webb Space Telescope',
    horizonsId: '-170',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 21.197,
    launchUtc: '2021-12-25T12:20:00Z',
    operator: 'NASA / ESA / CSA',
    color: '#e8c860',
  }),
  spacecraft({
    id: 'juice',
    shape: SHAPES.juice,
    name: 'Juice',
    horizonsId: '-28',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 27.1,
    launchUtc: '2023-04-14T12:14:36Z',
    operator: 'ESA',
    color: '#7fb0e0',
  }),
  spacecraft({
    id: 'europa-clipper',
    shape: SHAPES.europaClipper,
    name: 'Europa Clipper',
    horizonsId: '-159',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 30.5,
    launchUtc: '2024-10-14T16:06:00Z',
    operator: 'NASA',
    color: '#80c8c0',
  }),
  spacecraft({
    id: 'lucy',
    shape: SHAPES.lucy,
    name: 'Lucy',
    horizonsId: '-49',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 14.25,
    launchUtc: '2021-10-16T09:34:00Z',
    operator: 'NASA',
    color: '#c0a0d8',
  }),
  spacecraft({
    id: 'psyche',
    shape: SHAPES.psyche,
    name: 'Psyche',
    horizonsId: '-255',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 24.76,
    launchUtc: '2023-10-13T14:19:43Z',
    operator: 'NASA',
    color: '#a0c890',
  }),
];

/**
 * The shapes of the second batch, step A5. Same rules as SHAPES; see web/public/models/
 * CREDITS.md for the files.
 *
 * **Scale.** Four NASA models are in metres (Cassini, Dawn, Kepler, Spitzer, each within
 * 7% of a published dimension). Nine are in arbitrary units and are scaled by one
 * published dimension against the same extent measured in the file:
 *
 *   model        extent in the file        published                       metres/unit
 *   OSIRIS-REx   34.65 along z (arrays)    6.2 m with arrays deployed      0.17893
 *   STEREO       3142.19 along x (arrays)  6.47 m deployed (Horizons)      0.0020591
 *   ACE          1345.30 along z           8.3 m wingspan (Caltech ASC)    0.0061697
 *   DSCOVR       79.7 across the bus (x)   72 in (NOAA: "54 by 72 inches") 0.02296
 *   SOHO         43.27 along x (arrays)    9.5 m span (SOHO fact sheet)    0.21955
 *   Roman        411.92 along x (tube)     12.8 m tall, cover open (SVS)   0.031074
 *   TESS         37.10 along x (arrays)    3.9 m deployed                  0.10512
 *   Wind         3.06 across the drum      2.4 m (Wind CMAD)               0.784
 *   DART         40.34 along x (arrays)    18.3 m: two 8.5 m arrays (APL)  0.4537
 *                                          on a 1.3 m bus, summed
 *
 * Wind's model draws its 100 m wire antennas a few metres long; they are 0.38 mm thick
 * and would not show at any length. DART's is NASA's printable STL, converted to GLB:
 * one untextured mesh, its arrays' cell side not determinable from a closed print
 * shell, so the sign of its pointing axis is a choice.
 *
 * TESS's 3.9 m is the manufacturer's figure as carried by spaceflight101 -- no NASA page
 * states it -- and SOHO's model is longer for its height than the craft is, so it is
 * scaled by its span, the dimension that frames it.
 *
 * **Axes**, read off each model's geometry: Cassini's dish opens to +y; Dawn's and
 * Kepler's cells by their normals, z and x, the sign Dawn's by its dish on +z and
 * Kepler's -- not determinable from geometry alone -- by its cells' majority facing +x;
 * Spitzer's flat solar panel and shield on -z; OSIRIS-REx's dish and arrays face -y;
 * STEREO's arrays face +y, its radio antennas trailing on -y; ACE spins about y (which
 * end faces the Sun is not determinable from the model, and does not show on a spinning
 * craft); DSCOVR's dish and EPIC look along +z, toward Earth; SOHO's arrays lie in xz
 * with the payload rising on +y; Roman's solar-array sunshield is on +y; TESS's
 * cameras look along +y, away from the Sun.
 *
 * **Boxes**, every figure published (L x W x D, metres; the broad face to the Sun):
 *
 *   IMAP           2.4 x 2.4 x 0.9   deck (NASA IMAP blog, 2025-09-24)
 *   Euclid         4.7 x 3.7 x 3.7   4.7 m tall, 3.7 m across (ESA overview)
 *   Artemis I, II  18.9 x 7.9 x 5.0  arrays 18.9 m wide; crew and service modules
 *                                    7.9 m tall, 5 m across (Orion by the numbers)
 *   CAPSTONE       0.61 x 0.34 x 0.34  a 12U CubeSat (NSSDC); its arrays' span is
 *                                    not published, so only the body is drawn
 *   Solar Orbiter  18 x 3.1 x 2.5    18 m across (Mueller et al. 2020, ESA);
 *                                    body 2.5 x 3.1 x 2.7 (ESA factsheet)
 *   BepiColombo    30 x 6.3 x 3.9    ~30 m across the transfer module's wings;
 *                                    the stack 3.9 x 3.6 x 6.3 (ESA factsheet)
 *   Hayabusa2      6 x 4.23 x 1.25   paddles deployed (JAXA)
 *   Hera           11.5 x 2.2 x 1.8  11.5 m across; body 2.2 x 2 x 1.8 (ESA)
 *   LICIACube      0.3 x 0.2 x 0.1   a 6U CubeSat (Horizons)
 *   ESCAPADE       4.88 x 1.65 x 1.09  deployed (Horizons; NASA SVS spec sheet)
 *   Akatsuki       5.1 x 1.4 x 1.0   5.1 m across the paddles; body 1.5 x 1.0 x 1.4
 *                                    (JAXA ISAS)
 *
 * **No shape** for Gaia and Aditya-L1: ESA publishes only Gaia's 10 m across, ISRO only
 * Aditya-L1's 6 m magnetometer boom, and a box needs three dimensions. Their markers
 * stay at any range. ESA's own models of Euclid, Gaia, Solar Orbiter, BepiColombo and
 * Hera exist, with terms that do not say they may be used on a public site.
 */
const BOX = { model: null, metresPerUnit: 1, ...SUN_FACING_BOX } as const;
const MORE_SHAPES = {
  wind: {
    model: 'wind.glb',
    // The drum is 3.06 units across in the file and 2.4 m in the CMAD.
    metresPerUnit: 0.784,
    boxM: null,
    pointsAt: 'ecliptic-south',
    pointingPart: 'spin-axis',
    pointingAxis: [0, 1, 0],
    rollAxis: [1, 0, 0],
  },
  ace: {
    model: 'ace.glb',
    metresPerUnit: 0.0061697,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'spin-axis',
    pointingAxis: [0, 1, 0],
    rollAxis: [1, 0, 0],
  },
  dscovr: {
    model: 'dscovr.glb',
    metresPerUnit: 0.02296,
    boxM: null,
    pointsAt: 'earth',
    pointingPart: 'dish',
    pointingAxis: [0, 0, 1],
    rollAxis: [0, 1, 0],
  },
  soho: {
    model: 'soho.glb',
    metresPerUnit: 0.21955,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
  imap: { ...BOX, boxM: [2.4, 2.4, 0.9], pointingPart: 'spin-axis' },
  euclid: { ...BOX, boxM: [4.7, 3.7, 3.7], pointingPart: 'sunshield' },
  roman: {
    model: 'roman.glb',
    metresPerUnit: 0.031074,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'sunshield',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
  tess: {
    model: 'tess.glb',
    metresPerUnit: 0.10512,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, -1, 0],
    rollAxis: [0, 0, 1],
  },
  orion: { ...BOX, boxM: [18.9, 7.9, 5.0] },
  capstone: { ...BOX, boxM: [0.61, 0.34, 0.34] },
  solarOrbiter: { ...BOX, boxM: [18, 3.1, 2.5], pointingPart: 'heat-shield' },
  stereo: {
    model: 'stereo.glb',
    metresPerUnit: 0.0020591,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
  bepicolombo: { ...BOX, boxM: [30, 6.3, 3.9] },
  osirisApex: {
    model: 'osiris-rex.glb',
    metresPerUnit: 0.17893,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, -1, 0],
    rollAxis: [0, 0, 1],
  },
  hayabusa2: { ...BOX, boxM: [6, 4.23, 1.25] },
  hera: { ...BOX, boxM: [11.5, 2.2, 1.8] },
  dart: {
    model: 'dart.glb',
    // 40.34 units across the arrays in the file; 18.3 m, two 8.5 m ROSA wings on a
    // 1.3 m bus (APL).
    metresPerUnit: 0.4537,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
  liciacube: { ...BOX, boxM: [0.3, 0.2, 0.1] },
  escapade: { ...BOX, boxM: [4.88, 1.65, 1.09] },
  cassini: {
    model: 'cassini.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'earth',
    pointingPart: 'dish',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, -1],
  },
  dawn: {
    model: 'dawn.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, 0, 1],
    rollAxis: [0, 1, 0],
  },
  kepler: {
    model: 'kepler.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [1, 0, 0],
    rollAxis: [0, 1, 0],
  },
  spitzer: {
    model: 'spitzer.glb',
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'sun',
    pointingPart: 'solar-arrays',
    pointingAxis: [0, 0, -1],
    rollAxis: [0, 1, 0],
  },
  akatsuki: { ...BOX, boxM: [5.1, 1.4, 1.0] },
} as const satisfies Record<string, CraftShape>;

/**
 * The second batch of spacecraft, step A5: the missions at the Lagrange points, in deep
 * space and around the Moon, and five that ended inside the window.
 *
 * Sources, for each launch instant, operator and span: the mission's own NASA, ESA,
 * JAXA, ISRO or APL page, its press kit or fact sheet, or its Horizons object summary.
 * The research is recorded in the plan, step A5, with every URL.
 *
 * **Frames.** What a craft moves with is what it hangs off, as JWST does from Earth:
 * the L1 and L2 observatories, TESS and the Artemis flights from Earth; CAPSTONE, in its
 * orbit about the Moon, from the Moon; Cassini from Saturn and Akatsuki from Venus. The
 * rest orbit the Sun.
 *
 * **Sampling** follows SPACECRAFT_ANGULAR_TOLERANCE: a kilometre near a body, an angle
 * away from one. Without that the L1 group alone cost thousands of requests a run,
 * chasing the few-kilometre seams JPL's trajectory files leave about weekly.
 *
 * Left out for now: SWFO-L1 and the Carruthers Geocorona Observatory, both launched with
 * IMAP in 2025, whose dimensions have not been published; and the Tesla Roadster, whose
 * Horizons object is the Falcon upper stage with the car on it, whose size is not
 * published either.
 */
const MORE_SPACECRAFT: readonly BodyDefinition[] = [
  // Near Earth: the Sun-Earth L1 point.
  spacecraft({
    id: 'wind',
    shape: MORE_SHAPES.wind,
    name: 'Wind',
    horizonsId: '-8',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 2.4,
    launchUtc: '1994-11-01T09:31:00Z',
    operator: 'NASA',
    color: '#b8c4d0',
  }),
  spacecraft({
    id: 'ace',
    shape: MORE_SHAPES.ace,
    name: 'ACE',
    horizonsId: '-92',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 8.3,
    launchUtc: '1997-08-25T14:39:00Z',
    operator: 'NASA',
    color: '#c8b890',
  }),
  spacecraft({
    id: 'dscovr',
    shape: MORE_SHAPES.dscovr,
    name: 'DSCOVR',
    horizonsId: '-78',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    // Across the arrays, from the model at its published bus width.
    spanM: 6.1,
    launchUtc: '2015-02-11T23:03:02Z',
    operator: 'NOAA / NASA',
    color: '#90b8d8',
  }),
  spacecraft({
    id: 'soho',
    shape: MORE_SHAPES.soho,
    name: 'SOHO',
    horizonsId: '-21',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 9.5,
    launchUtc: '1995-12-02T08:08:01Z',
    operator: 'ESA / NASA',
    color: '#e0c070',
  }),
  spacecraft({
    id: 'imap',
    shape: MORE_SHAPES.imap,
    name: 'IMAP',
    horizonsId: '-43',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 2.4,
    launchUtc: '2025-09-24T11:30:00Z',
    operator: 'NASA',
    color: '#a8d0b0',
  }),
  spacecraft({
    id: 'aditya-l1',
    shape: null,
    name: 'Aditya-L1',
    horizonsId: '-156',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 6,
    launchUtc: '2023-09-02T06:20:00Z',
    operator: 'ISRO',
    color: '#e8a878',
  }),
  // Near Earth: the Sun-Earth L2 point, and beyond.
  spacecraft({
    id: 'euclid',
    shape: MORE_SHAPES.euclid,
    name: 'Euclid',
    horizonsId: '-680',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 4.7,
    launchUtc: '2023-07-01T15:12:00Z',
    operator: 'ESA',
    color: '#9ab0e8',
  }),
  spacecraft({
    id: 'gaia',
    shape: null,
    name: 'Gaia',
    horizonsId: '-139479',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 10,
    launchUtc: '2013-12-19T09:12:00Z',
    operator: 'ESA',
    color: '#c0a8e0',
  }),
  spacecraft({
    id: 'roman',
    shape: MORE_SHAPES.roman,
    name: 'Roman Space Telescope',
    horizonsId: '-211',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 12.8,
    launchUtc: '2026-08-30T11:26:00Z',
    operator: 'NASA',
    color: '#d8d0a0',
  }),
  spacecraft({
    id: 'tess',
    shape: MORE_SHAPES.tess,
    name: 'TESS',
    horizonsId: '-95',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 3.9,
    launchUtc: '2018-04-18T22:51:00Z',
    operator: 'NASA',
    color: '#88c8c8',
  }),
  // Near Earth: the Moon.
  spacecraft({
    id: 'artemis-1',
    shape: MORE_SHAPES.orion,
    name: 'Artemis I',
    horizonsId: '-1023',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 18.9,
    launchUtc: '2022-11-16T06:47:44Z',
    operator: 'NASA',
    color: '#d0d0d0',
  }),
  spacecraft({
    id: 'artemis-2',
    shape: MORE_SHAPES.orion,
    name: 'Artemis II',
    horizonsId: '-1024',
    parent: 'earth',
    parentHorizonsId: '399',
    stepDays: 1,
    spanM: 18.9,
    launchUtc: '2026-04-01T22:35:00Z',
    operator: 'NASA',
    color: '#e8e8e8',
  }),
  spacecraft({
    id: 'capstone',
    shape: MORE_SHAPES.capstone,
    name: 'CAPSTONE',
    horizonsId: '-1176',
    parent: 'moon',
    parentHorizonsId: '301',
    stepDays: 1,
    spanM: 0.61,
    launchUtc: '2022-06-28T09:55:00Z',
    operator: 'NASA / Advanced Space',
    color: '#b0b8a0',
  }),
  // Interplanetary.
  spacecraft({
    id: 'solar-orbiter',
    shape: MORE_SHAPES.solarOrbiter,
    name: 'Solar Orbiter',
    horizonsId: '-144',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 18,
    launchUtc: '2020-02-10T04:03:00Z',
    operator: 'ESA / NASA',
    color: '#f0b080',
  }),
  spacecraft({
    id: 'stereo-a',
    shape: MORE_SHAPES.stereo,
    name: 'STEREO-A',
    horizonsId: '-234',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 6.47,
    launchUtc: '2006-10-26T00:52:00Z',
    operator: 'NASA',
    color: '#c8a0a0',
  }),
  spacecraft({
    id: 'bepicolombo',
    shape: MORE_SHAPES.bepicolombo,
    name: 'BepiColombo',
    horizonsId: '-121',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 30,
    launchUtc: '2018-10-20T01:45:28Z',
    operator: 'ESA / JAXA',
    color: '#a0b8c8',
  }),
  spacecraft({
    id: 'osiris-apex',
    shape: MORE_SHAPES.osirisApex,
    name: 'OSIRIS-APEX',
    horizonsId: '-64',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 6.2,
    launchUtc: '2016-09-08T23:05:00Z',
    operator: 'NASA',
    color: '#d0b890',
  }),
  spacecraft({
    id: 'hayabusa2',
    shape: MORE_SHAPES.hayabusa2,
    name: 'Hayabusa2',
    horizonsId: '-37',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 6,
    launchUtc: '2014-12-03T04:22:04Z',
    operator: 'JAXA',
    color: '#b8a8c8',
  }),
  spacecraft({
    id: 'hera',
    shape: MORE_SHAPES.hera,
    name: 'Hera',
    horizonsId: '-91',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 11.5,
    launchUtc: '2024-10-07T14:52:00Z',
    operator: 'ESA',
    color: '#a8c8e0',
  }),
  spacecraft({
    id: 'dart',
    shape: MORE_SHAPES.dart,
    name: 'DART',
    horizonsId: '-135',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 18.3,
    launchUtc: '2021-11-24T06:21:02Z',
    // Impact into Dimorphos, from its Horizons summary.
    endUtc: '2022-09-26T23:14:24.183Z',
    operator: 'NASA',
    color: '#c0c0b0',
  }),
  spacecraft({
    id: 'liciacube',
    shape: MORE_SHAPES.liciacube,
    name: 'LICIACube',
    horizonsId: '-210',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 0.3,
    launchUtc: '2021-11-24T06:21:02Z',
    operator: 'ASI',
    color: '#a8b8a8',
  }),
  spacecraft({
    id: 'escapade-blue',
    shape: MORE_SHAPES.escapade,
    name: 'ESCAPADE Blue',
    horizonsId: '-9',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 4.88,
    launchUtc: '2025-11-13T20:55:01Z',
    operator: 'NASA',
    color: '#80a8e0',
  }),
  spacecraft({
    id: 'escapade-gold',
    shape: MORE_SHAPES.escapade,
    name: 'ESCAPADE Gold',
    horizonsId: '-10',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 4.88,
    launchUtc: '2025-11-13T20:55:01Z',
    operator: 'NASA',
    color: '#e0c060',
  }),
  spacecraft({
    id: 'dawn',
    shape: MORE_SHAPES.dawn,
    name: 'Dawn',
    horizonsId: '-203',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 20,
    launchUtc: '2007-09-27T11:34:00Z',
    operator: 'NASA',
    color: '#b0a0d0',
  }),
  spacecraft({
    id: 'kepler',
    shape: MORE_SHAPES.kepler,
    name: 'Kepler',
    horizonsId: '-227',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 4.7,
    launchUtc: '2009-03-07T03:49:57Z',
    operator: 'NASA',
    color: '#a0c0a8',
  }),
  spacecraft({
    id: 'spitzer',
    shape: MORE_SHAPES.spitzer,
    name: 'Spitzer',
    horizonsId: '-79',
    parent: null,
    parentHorizonsId: null,
    stepDays: 1,
    spanM: 4.5,
    launchUtc: '2003-08-25T05:35:39Z',
    operator: 'NASA',
    color: '#d0a8a8',
  }),
  // At other planets.
  spacecraft({
    id: 'cassini',
    shape: MORE_SHAPES.cassini,
    name: 'Cassini',
    horizonsId: '-82',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: 1,
    spanM: 13,
    launchUtc: '1997-10-15T08:43:00Z',
    operator: 'NASA / ESA / ASI',
    color: '#d8c898',
  }),
  spacecraft({
    id: 'akatsuki',
    shape: MORE_SHAPES.akatsuki,
    name: 'Akatsuki',
    horizonsId: '-5',
    parent: 'venus',
    parentHorizonsId: '299',
    stepDays: 1,
    spanM: 5.1,
    launchUtc: '2010-05-20T21:58:22Z',
    operator: 'JAXA',
    color: '#e0b8a0',
  }),
];

export const CATALOG: readonly BodyDefinition[] = [
  {
    id: 'sun',
    name: 'Sun',
    horizonsId: '10',
    // reference for every heliocentric distance, so kept tight
    stepDays: 8,
    vectorWindow: 'full',
    center: SSB_CENTER,
    // Never used: drawOrbit is false, since the Sun's barycentric motion is a
    // wobble rather than an orbit.
    elementsCenter: SSB_CENTER,
    parent: null,
    kind: 'star',
    radiusEquatorialKm: 695700,
    radiusPolarKm: 695700,
    triaxialRadiiKm: null,
    gmKm3S2: 132712440041.279419,
    gmBodyOnlyKm3S2: 132712440041.279419,
    rotationPeriodHours: 609.12,
    axialTiltDeg: 7.25,
    rotation: {
      poleRaDeg: 286.13,
      poleDecDeg: 63.87,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 84.176,
      rotationRateDegPerDay: 14.1844,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#ffd24a',
    // The Sun's motion about the barycenter is a small wobble, not an orbit worth
    // drawing as a conic.
    drawOrbit: false,
    textures: {
      illustrative: { file: 'sun.jpg', longitudeOriginDeg: 180 },
      // Kept: No true-colour global map exists. The photosphere is white in visible light;
      // every published map of it, including this one, is a false-colour convention.
      photometric: { file: 'sun.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'mercury',
    name: 'Mercury',
    horizonsId: '199',
    // fastest body at 47 km/s; anything wider is visibly off
    stepDays: 1,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 2440.53,
    radiusPolarKm: 2438.26,
    triaxialRadiiKm: null,
    gmKm3S2: 22031.868551,
    gmBodyOnlyKm3S2: 22031.868551,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    rotation: {
      poleRaDeg: 281.0103,
      poleDecDeg: 61.4155,
      poleRaRateDegPerCentury: -0.0328,
      poleDecRateDegPerCentury: -0.0049,
      primeMeridianDeg: 329.5988,
      rotationRateDegPerDay: 6.1385108,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#a98cd8',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'mercury.jpg', longitudeOriginDeg: 180 },
      // Kept: The MESSENGER global mosaic is 759 MB and the readily available version is
      // *enhanced* colour, which is further from true than this.
      photometric: { file: 'mercury.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'venus',
    name: 'Venus',
    horizonsId: '299',
    stepDays: 4,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 6051.8,
    radiusPolarKm: 6051.8,
    triaxialRadiiKm: null,
    gmKm3S2: 324858.592,
    gmBodyOnlyKm3S2: 324858.592,
    // Retrograde rotation, hence the negative period.
    rotationPeriodHours: -5832.5,
    axialTiltDeg: 177.36,
    rotation: {
      poleRaDeg: 272.76,
      poleDecDeg: 67.16,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 160.2,
      rotationRateDegPerDay: -1.4813688,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#e8a33d',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'venus.jpg', longitudeOriginDeg: 180 },
      // Kept: NASA's map is the Magellan *radar* mosaic tinted orange -- 93% mean saturation
      // against this one's 44%. Radar is real data and is not what Venus looks like.
      photometric: { file: 'venus.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'earth',
    name: 'Earth',
    horizonsId: '399',
    stepDays: 4,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 6378.1366,
    radiusPolarKm: 6356.7519,
    triaxialRadiiKm: null,
    gmKm3S2: 398600.435507,
    // Already Earth alone: DE440 publishes Earth and the Moon separately.
    gmBodyOnlyKm3S2: 398600.435507,
    rotationPeriodHours: 23.9344695,
    axialTiltDeg: 23.4392911,
    rotation: {
      poleRaDeg: 0.0,
      poleDecDeg: 90.0,
      poleRaRateDegPerCentury: -0.641,
      poleDecRateDegPerCentury: -0.557,
      primeMeridianDeg: 190.147,
      rotationRateDegPerDay: 360.9856235,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#3aa8e0',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'earth.jpg', longitudeOriginDeg: 180 },
      // NASA Blue Marble Next Generation: calibrated MODIS radiance, so true
      // colour by construction rather than by adjustment.
      photometric: { file: 'earth-photometric.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'mars',
    name: 'Mars',
    horizonsId: '499',
    stepDays: 8,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 3396.19,
    radiusPolarKm: 3376.2,
    triaxialRadiiKm: null,
    gmKm3S2: 42828.375816,
    // The planet alone, as Horizons publishes it; the value above includes its moons.
    gmBodyOnlyKm3S2: 42828.375662,
    rotationPeriodHours: 24.622962,
    axialTiltDeg: 25.19,
    rotation: {
      poleRaDeg: 317.68143,
      poleDecDeg: 52.8865,
      poleRaRateDegPerCentury: -0.1061,
      poleDecRateDegPerCentury: -0.0609,
      primeMeridianDeg: 176.63,
      rotationRateDegPerDay: 350.891982443297,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#d96c3f',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'mars.jpg', longitudeOriginDeg: 180 },
      // NASA 3D Resources, Viking-derived. Butterscotch rather than orange-red, which is the
      // colour Mars actually is.
      photometric: { file: 'mars-photometric.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    horizonsId: '599',
    // a 12-year orbit needs nothing finer
    stepDays: 32,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 71492,
    radiusPolarKm: 66854,
    triaxialRadiiKm: null,
    gmKm3S2: 126712764.1,
    // The planet alone, as Horizons publishes it; the value above includes its moons.
    gmBodyOnlyKm3S2: 126686531.9,
    rotationPeriodHours: 9.92496,
    axialTiltDeg: 3.13,
    rotation: {
      poleRaDeg: 268.056595,
      poleDecDeg: 64.495303,
      poleRaRateDegPerCentury: -0.006499,
      poleDecRateDegPerCentury: 0.002413,
      primeMeridianDeg: 284.95,
      rotationRateDegPerDay: 870.536,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#d8a05a',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'jupiter.jpg', longitudeOriginDeg: 180 },
      // Kept: NASA's Cassini map is an enhanced-colour product at 65% saturation against
      // this one's 14%. Ours is already the paler, less processed option.
      photometric: { file: 'jupiter.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'saturn',
    name: 'Saturn',
    horizonsId: '699',
    stepDays: 32,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 60268,
    radiusPolarKm: 54364,
    triaxialRadiiKm: null,
    gmKm3S2: 37940584.8418,
    // The planet alone, as Horizons publishes it; the value above includes its moons.
    gmBodyOnlyKm3S2: 37931206.234,
    rotationPeriodHours: 10.656,
    axialTiltDeg: 26.73,
    rotation: {
      poleRaDeg: 40.589,
      poleDecDeg: 83.537,
      poleRaRateDegPerCentury: -0.036,
      poleDecRateDegPerCentury: -0.004,
      primeMeridianDeg: 38.9,
      rotationRateDegPerDay: 810.7939024,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#e0c060',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'saturn.jpg', longitudeOriginDeg: 180 },
      // Kept: Same as Jupiter: the NASA map is enhanced, at 68% saturation against 21%.
      photometric: { file: 'saturn.jpg', longitudeOriginDeg: 180 },
    },
    /**
     * The radii are the *calibration of the texture*, not a quotation of the ring
     * system, and they were measured rather than guessed.
     *
     * Solar System Scope publishes the ring map as a radial strip and does not say
     * which radii its edges correspond to. So the alpha profile was read off the file
     * and its structural boundaries -- the C ring's inner edge, the C-to-B step, the
     * Cassini Division either side, and the A ring's outer edge -- were fitted by
     * least squares against their surveyed radii, giving
     *
     *   r(u) = 69942 + 71938 * u
     *
     * with an RMS residual of 1365 km, corroborated independently by the Encke Gap
     * landing 747 km from its true 133589 km.
     *
     * Worth being blunt about what that means: 1365 km is *wider than the Encke Gap
     * itself*, which is 325 km. Every division is present and roughly placed, and
     * none is at a surveyed radius. Either the strip is not exactly linear in radius
     * or it was drawn approximately; either way the image cannot support better, and
     * quoting 74658 and 136780 here would look more precise while putting every
     * feature further from where it belongs.
     */
    rings: {
      texture: 'saturn-rings.png',
      innerRadiusKm: 69942,
      outerRadiusKm: 141880,
    },
    mission: null,
  },
  {
    id: 'uranus',
    name: 'Uranus',
    horizonsId: '799',
    stepDays: 32,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 25559,
    radiusPolarKm: 24973,
    triaxialRadiiKm: null,
    gmKm3S2: 5794556.4,
    // The planet alone, as Horizons publishes it; the value above includes its moons.
    gmBodyOnlyKm3S2: 5793950.6103,
    rotationPeriodHours: -17.24,
    axialTiltDeg: 97.77,
    rotation: {
      poleRaDeg: 257.311,
      poleDecDeg: -15.175,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 203.81,
      rotationRateDegPerDay: -501.1600928,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#7fd8d8',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'uranus.jpg', longitudeOriginDeg: 180 },
      // Kept: No global map exists in either set. There is almost nothing to map: it is a
      // featureless disc.
      photometric: { file: 'uranus.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'neptune',
    name: 'Neptune',
    horizonsId: '899',
    stepDays: 32,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 24764,
    radiusPolarKm: 24341,
    triaxialRadiiKm: null,
    gmKm3S2: 6836527.10058,
    // The planet alone, as Horizons publishes it; the value above includes its moons.
    gmBodyOnlyKm3S2: 6835099.97,
    // 16.11 hours is System III, the magnetic field, and it is what a person means by
    // "how long is a day on Neptune" -- so it is what the interface shows. The map turns
    // at the System II rate above instead, because the map is of clouds. The two are a
    // fact about Neptune rather than a disagreement in the catalog; see the note on
    // `primeMeridianDeg`.
    rotationPeriodHours: 16.11,
    axialTiltDeg: 28.32,
    rotation: {
      poleRaDeg: 299.36,
      poleDecDeg: 43.46,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      // **Neptune has two rotations, and the map turns with the wrong one if you take
      // the obvious set.** The IAU publishes System III for it -- the 16.11 hour rotation
      // of the magnetic field, which is the interior -- and that is what the fact sheets
      // quote and what this catalog carried at first: W = 253.18 + 536.3128492 d.
      //
      // But a surface map of Neptune is a map of *clouds*, and clouds do not turn with the
      // magnetic field. For cartography the IAU 2015 report gives **System II**, the
      // rotation of optically observed features: W = 249.978 + 541.1397757 d. Horizons
      // says so in the header of every Neptune ephemeris it prints, and it is the only
      // body of the four giants where the two differ -- Jupiter, Saturn and Uranus are all
      // cartographed in System III.
      //
      // The cost of the wrong one is not subtle: 4.83 deg/day, a full turn every 75 days,
      // which put the Great Dark Spot a quarter of the planet away from where NASA draws
      // it. Measured against Horizons across the whole ephemeris window with the light
      // time taken out, these values land within 0.011 deg and the old ones were 90 deg
      // out on average. See `orientationSky.test.ts`.
      primeMeridianDeg: 249.978,
      rotationRateDegPerDay: 541.1397757,
      primeMeridianAccelDegPerDay2: 0,
      // The only planet whose periodic term is large enough to see. Leaving it out
      // puts the sub-solar latitude 0.278 deg from JPL's; including it lands within
      // 0.004 deg. Measured against Horizons across 2026, not assumed.
      periodicTerms: [
        {
          angleDeg: 357.85,
          rateDegPerCentury: 52.316,
          accelDegPerCentury2: 0,
          raSinCoeffDeg: 0.7,
          decCosCoeffDeg: -0.51,
          wSinCoeffDeg: -0.48,
        },
      ],
    },
    color: '#5a7fd8',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'neptune.jpg', longitudeOriginDeg: 180 },
      // NASA 3D Resources. Pale blue-green, the direction Irwin et al. 2024 established when
      // they reprocessed the contrast-stretched Voyager 2 imagery.
      photometric: { file: 'neptune-photometric.jpg', longitudeOriginDeg: 180 },
    },
    rings: null,
    mission: null,
  },
  {
    id: 'pluto',
    name: 'Pluto',
    horizonsId: '999',
    // limited by Charon, not by its 248-year orbit
    stepDays: 2,
    vectorWindow: 'full',
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'dwarf-planet',
    radiusEquatorialKm: 1188.3,
    radiusPolarKm: 1188.3,
    triaxialRadiiKm: null,
    gmKm3S2: 869.613817,
    // Pluto alone, from PLU060 as Horizons publishes it. The value above is Pluto
    // alone too, from an older solution -- not the system, which would be ~975 -- and
    // the two differ by 0.03%. This one is the current fit, and it is what Charon's
    // orbit is drawn about, plus Charon's own mass.
    gmBodyOnlyKm3S2: 869.326,
    rotationPeriodHours: -153.2928,
    // 119.591, not the 122.53 the NASA fact sheet publishes. That figure comes from
    // Pluto's pre-2009 IAU pole, which sits 2.9 deg from the one adopted since --
    // and 2.9 deg is exactly the gap between the two numbers. The pole below is the
    // current one, and it reproduces JPL's own sub-solar latitude for Pluto to five
    // decimal places, so this is the tilt that matches what is drawn.
    axialTiltDeg: 119.591,
    // The one body where the period's sign and W's sign disagree, and both are
    // right. For planets the IAU north pole is the one north of the invariable
    // plane, so a body turning backwards gets a negative Wdot -- Venus and Uranus.
    // For dwarf planets it is the positive pole by the right-hand rule instead, so
    // Pluto's W always increases. It is still retrograde in the sense the fact
    // sheets mean: its 122.53 deg obliquity tips the axis past its orbit normal, so
    // it spins against its own orbital motion. Both statements describe the same
    // rotation. The texture below is drawn against this same IAU pole, so using it
    // is what puts Sputnik Planitia where Sputnik Planitia is.
    rotation: {
      poleRaDeg: 132.993,
      poleDecDeg: -6.163,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 302.695,
      rotationRateDegPerDay: 56.3625225,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
    color: '#b0a090',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'pluto.jpg', longitudeOriginDeg: 0 },
      // Kept: Already the NASA New Horizons mosaic, so both sets point at the same mission
      // product.
      photometric: { file: 'pluto.jpg', longitudeOriginDeg: 0 },
    },
    rings: null,
    mission: null,
  },
  ...MOONS,
  ...SPACECRAFT,
  ...MORE_SPACECRAFT,
];

/** Look up a body by id. Throws rather than returning undefined: ids are ours. */
export function getBody(id: string): BodyDefinition {
  const body = CATALOG.find((candidate) => candidate.id === id);
  if (!body) {
    throw new Error(`Unknown body id: ${id}`);
  }
  return body;
}
