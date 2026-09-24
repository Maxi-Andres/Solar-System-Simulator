import type { BodyDefinition, TextureSetId } from './types.ts';

/**
 * Body catalog: the Sun, the eight planets, Pluto, and their major moons.
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
  readonly radiusKm: number;
  readonly gmKm3S2: number;
  readonly rotationPeriodHours: number;
  readonly axialTiltDeg: number | null;
  readonly color: string;
}

/**
 * A moon, as the catalog carries it in phase A's first step.
 *
 * Positions and orbits are real from the start; the body itself is deliberately plain.
 * It is a sphere at the IAU **mean** radius, in flat colour, with no rotational
 * elements -- and those three go together. Most of these moons are triaxial rather
 * than oblate (Mimas is 207.8 x 196.7 x 190.6 km, its long axis locked toward Saturn),
 * so drawing the real shape means knowing which way the body faces, and that is the
 * rotation. A spheroid flattened about the wrong axis would be a guess dressed as a
 * measurement. Shape, rotation and surface map arrive together, and are checked
 * against JPL together.
 *
 * Vectors are requested against the planet's body center, not the barycenter: that
 * makes each table the parent-relative state the frame tree sums, and it is what the
 * osculating elements need at their focus.
 */
function moon(spec: MoonSpec): BodyDefinition {
  const center = `500@${spec.parentHorizonsId}`;
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
    radiusEquatorialKm: spec.radiusKm,
    radiusPolarKm: spec.radiusKm,
    gmKm3S2: spec.gmKm3S2,
    gmBodyOnlyKm3S2: spec.gmKm3S2,
    rotationPeriodHours: spec.rotationPeriodHours,
    axialTiltDeg: spec.axialTiltDeg,
    rotation: null,
    color: spec.color,
    drawOrbit: true,
    textures: null,
    rings: null,
  };
}

/**
 * The major moons: the nineteen massive enough to have pulled themselves round, plus
 * Mars's two. Mimas, at 198 km, is the smallest body known to have done so.
 *
 * Sources:
 *   - Horizons ids, GM and mean radius: JPL SSD planetary satellite physical
 *     parameters (ssd.jpl.nasa.gov/sats/phys_par). GM from each system's own
 *     satellite ephemeris -- DE440, MAR097, JUP365, SAT441, URA111, NEP097, PLU060 --
 *     and mean radii from the IAU 2015 report the planets' radii come from.
 *   - Rotation: every one of these is tidally locked, which Horizons states as
 *     "Rotational period = Synchronous", so the period is the sidereal orbital period.
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
    radiusKm: 1737.4,
    gmKm3S2: 4902.800066,
    rotationPeriodHours: 655.7199,
    axialTiltDeg: 6.67,
    color: '#b8b8b8',
  }),
  moon({
    id: 'phobos',
    name: 'Phobos',
    horizonsId: '401',
    parent: 'mars',
    parentHorizonsId: '499',
    stepDays: minutes(15),
    vectorWindow: 'short',
    radiusKm: 11.08,
    gmKm3S2: 0.0007087,
    rotationPeriodHours: 7.6538,
    axialTiltDeg: null,
    color: '#a08a78',
  }),
  moon({
    id: 'deimos',
    name: 'Deimos',
    horizonsId: '402',
    parent: 'mars',
    parentHorizonsId: '499',
    stepDays: minutes(45),
    vectorWindow: 'short',
    radiusKm: 6.2,
    gmKm3S2: 0.0000962,
    rotationPeriodHours: 30.2986,
    axialTiltDeg: null,
    color: '#b8a48c',
  }),
  moon({
    id: 'io',
    name: 'Io',
    horizonsId: '501',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(120),
    vectorWindow: 'short',
    radiusKm: 1821.49,
    gmKm3S2: 5959.91547,
    rotationPeriodHours: 42.4593,
    axialTiltDeg: null,
    color: '#e6d45c',
  }),
  moon({
    id: 'europa',
    name: 'Europa',
    horizonsId: '502',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(240),
    vectorWindow: 'short',
    radiusKm: 1560.8,
    gmKm3S2: 3202.7121,
    rotationPeriodHours: 85.2283,
    axialTiltDeg: null,
    color: '#d2c2a0',
  }),
  moon({
    id: 'ganymede',
    name: 'Ganymede',
    horizonsId: '503',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(480),
    vectorWindow: 'short',
    radiusKm: 2631.2,
    gmKm3S2: 9887.83275,
    rotationPeriodHours: 171.7093,
    axialTiltDeg: null,
    color: '#aca296',
  }),
  moon({
    id: 'callisto',
    name: 'Callisto',
    horizonsId: '504',
    parent: 'jupiter',
    parentHorizonsId: '599',
    stepDays: minutes(960),
    vectorWindow: 'short',
    radiusKm: 2410.3,
    gmKm3S2: 7179.2834,
    rotationPeriodHours: 400.5364,
    axialTiltDeg: null,
    color: '#8a7e70',
  }),
  moon({
    id: 'mimas',
    name: 'Mimas',
    horizonsId: '601',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(45),
    vectorWindow: 'short',
    radiusKm: 198.2,
    gmKm3S2: 2.50349,
    rotationPeriodHours: 22.6181,
    axialTiltDeg: null,
    color: '#c4c4c4',
  }),
  moon({
    id: 'enceladus',
    name: 'Enceladus',
    horizonsId: '602',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(75),
    vectorWindow: 'short',
    radiusKm: 252.1,
    gmKm3S2: 7.21037,
    rotationPeriodHours: 32.8852,
    axialTiltDeg: null,
    color: '#eef2f6',
  }),
  moon({
    id: 'tethys',
    name: 'Tethys',
    horizonsId: '603',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(120),
    vectorWindow: 'short',
    radiusKm: 531.1,
    gmKm3S2: 41.21353,
    rotationPeriodHours: 45.3072,
    axialTiltDeg: null,
    color: '#dcdcd4',
  }),
  moon({
    id: 'dione',
    name: 'Dione',
    horizonsId: '604',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(150),
    vectorWindow: 'short',
    radiusKm: 561.4,
    gmKm3S2: 73.11607,
    rotationPeriodHours: 65.686,
    axialTiltDeg: null,
    color: '#c8c8c0',
  }),
  moon({
    id: 'rhea',
    name: 'Rhea',
    horizonsId: '605',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(240),
    vectorWindow: 'short',
    radiusKm: 763.5,
    gmKm3S2: 153.94175,
    rotationPeriodHours: 108.42,
    axialTiltDeg: null,
    color: '#bcb8b0',
  }),
  moon({
    id: 'titan',
    name: 'Titan',
    horizonsId: '606',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: minutes(960),
    vectorWindow: 'short',
    radiusKm: 2574.76,
    gmKm3S2: 8978.1371,
    rotationPeriodHours: 382.6908,
    axialTiltDeg: null,
    color: '#dca84e',
  }),
  moon({
    id: 'iapetus',
    name: 'Iapetus',
    horizonsId: '608',
    parent: 'saturn',
    parentHorizonsId: '699',
    stepDays: 1.5,
    vectorWindow: 'short',
    radiusKm: 734.3,
    gmKm3S2: 120.51511,
    rotationPeriodHours: 1903.944,
    axialTiltDeg: null,
    color: '#a8987f',
  }),
  moon({
    id: 'miranda',
    name: 'Miranda',
    horizonsId: '705',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(90),
    vectorWindow: 'short',
    radiusKm: 235.8,
    gmKm3S2: 4.3,
    rotationPeriodHours: 33.9235,
    axialTiltDeg: null,
    color: '#b4b4b4',
  }),
  moon({
    id: 'ariel',
    name: 'Ariel',
    horizonsId: '701',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(180),
    vectorWindow: 'short',
    radiusKm: 578.9,
    gmKm3S2: 83.5,
    rotationPeriodHours: 60.4891,
    axialTiltDeg: null,
    color: '#ccc8c2',
  }),
  moon({
    id: 'umbriel',
    name: 'Umbriel',
    horizonsId: '702',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(240),
    vectorWindow: 'short',
    radiusKm: 584.7,
    gmKm3S2: 85.1,
    rotationPeriodHours: 99.4602,
    axialTiltDeg: null,
    color: '#8e8a86',
  }),
  moon({
    id: 'titania',
    name: 'Titania',
    horizonsId: '703',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(480),
    vectorWindow: 'short',
    radiusKm: 788.9,
    gmKm3S2: 226.9,
    rotationPeriodHours: 208.9409,
    axialTiltDeg: null,
    color: '#b6aea6',
  }),
  moon({
    id: 'oberon',
    name: 'Oberon',
    horizonsId: '704',
    parent: 'uranus',
    parentHorizonsId: '799',
    stepDays: minutes(720),
    vectorWindow: 'short',
    radiusKm: 761.4,
    gmKm3S2: 205.3,
    rotationPeriodHours: 323.1177,
    axialTiltDeg: null,
    color: '#a69e96',
  }),
  moon({
    id: 'triton',
    name: 'Triton',
    horizonsId: '801',
    parent: 'neptune',
    parentHorizonsId: '899',
    stepDays: minutes(420),
    vectorWindow: 'short',
    radiusKm: 1352.6,
    gmKm3S2: 1428.49546,
    // Positive although Triton orbits backwards. Locked rotation turns the same way as
    // the orbit, so it is prograde about its own orbital axis -- which is what the sign
    // means here. The retrograde orbit shows up where it belongs, as an inclination
    // over 90 degrees in its elements.
    rotationPeriodHours: 141.0445,
    axialTiltDeg: null,
    color: '#d6cac2',
  }),
  moon({
    id: 'charon',
    name: 'Charon',
    horizonsId: '901',
    parent: 'pluto',
    parentHorizonsId: '999',
    stepDays: minutes(720),
    vectorWindow: 'short',
    radiusKm: 606,
    gmKm3S2: 106.1,
    // Pluto's own day, within seconds: the two are locked to each other.
    rotationPeriodHours: 153.2935,
    axialTiltDeg: null,
    color: '#aca49a',
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
      poleNutation: null,
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
      poleNutation: null,
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
      poleNutation: null,
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
      poleNutation: null,
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
      poleNutation: null,
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
      poleNutation: null,
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
      poleNutation: null,
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
      poleNutation: null,
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
      // The only body here whose periodic term is large enough to see. Leaving it out
      // puts the sub-solar latitude 0.278 deg from JPL's; including it lands within
      // 0.004 deg. Measured against Horizons across 2026, not assumed.
      poleNutation: {
        angleDeg: 357.85,
        rateDegPerCentury: 52.316,
        raSinCoeffDeg: 0.7,
        decCosCoeffDeg: -0.51,
        wSinCoeffDeg: -0.48,
      },
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
      poleNutation: null,
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
  },
  ...MOONS,
];

/** Look up a body by id. Throws rather than returning undefined: ids are ours. */
export function getBody(id: string): BodyDefinition {
  const body = CATALOG.find((candidate) => candidate.id === id);
  if (!body) {
    throw new Error(`Unknown body id: ${id}`);
  }
  return body;
}
