import type { BodyDefinition, TextureSetId } from './types.ts';

/**
 * Body catalog for v1: the Sun, the eight planets and Pluto.
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
 *
 * Adding a moon later means one more entry with `parent` set and `center` pointing
 * at the parent's Horizons body center, e.g. Io: parent 'jupiter', center '500@599'.
 *
 * The web app does NOT read this file at runtime: it reads `bodies.json`, which the
 * generator writes from it, so the published site and the data it ships can never
 * disagree. The `@sss/tools/catalog` export exists for the web tests, which need the
 * real numbers before any data has been generated. It is pure data with no Node
 * imports, so nothing from the generator can reach the browser bundle through it.
 */

/** Solar System barycenter: the frame every v1 state vector is measured against. */
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
 * IAU rotational elements: `poleRaDeg`, `poleDecDeg`, `primeMeridianDeg` and
 * `rotationRateDegPerDay`.
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
    (body) => body.textures.illustrative.file !== body.textures.photometric.file,
  ).map((body) => body.id);
}

export const CATALOG: readonly BodyDefinition[] = [
  {
    id: 'sun',
    name: 'Sun',
    horizonsId: '10',
    // reference for every heliocentric distance, so kept tight
    stepDays: 8,
    center: SSB_CENTER,
    // Never used: drawOrbit is false, since the Sun's barycentric motion is a
    // wobble rather than an orbit.
    elementsCenter: SSB_CENTER,
    parent: null,
    kind: 'star',
    radiusEquatorialKm: 695700,
    radiusPolarKm: 695700,
    gmKm3S2: 132712440041.279419,
    rotationPeriodHours: 609.12,
    axialTiltDeg: 7.25,
    poleRaDeg: 286.13,
    poleDecDeg: 63.87,
    poleRaRateDegPerCentury: 0,
    poleDecRateDegPerCentury: 0,
    primeMeridianDeg: 84.176,
    rotationRateDegPerDay: 14.1844,
    poleNutation: null,
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
  },
  {
    id: 'mercury',
    name: 'Mercury',
    horizonsId: '199',
    // fastest body at 47 km/s; anything wider is visibly off
    stepDays: 1,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 2440.53,
    radiusPolarKm: 2438.26,
    gmKm3S2: 22031.868551,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    poleRaDeg: 281.0103,
    poleDecDeg: 61.4155,
    poleRaRateDegPerCentury: -0.0328,
    poleDecRateDegPerCentury: -0.0049,
    primeMeridianDeg: 329.5988,
    rotationRateDegPerDay: 6.1385108,
    poleNutation: null,
    color: '#a98cd8',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'mercury.jpg', longitudeOriginDeg: 180 },
      // Kept: The MESSENGER global mosaic is 759 MB and the readily available version is
      // *enhanced* colour, which is further from true than this.
      photometric: { file: 'mercury.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    horizonsId: '299',
    stepDays: 4,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 6051.8,
    radiusPolarKm: 6051.8,
    gmKm3S2: 324858.592,
    // Retrograde rotation, hence the negative period.
    rotationPeriodHours: -5832.5,
    axialTiltDeg: 177.36,
    poleRaDeg: 272.76,
    poleDecDeg: 67.16,
    poleRaRateDegPerCentury: 0,
    poleDecRateDegPerCentury: 0,
    primeMeridianDeg: 160.2,
    rotationRateDegPerDay: -1.4813688,
    poleNutation: null,
    color: '#e8a33d',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'venus.jpg', longitudeOriginDeg: 180 },
      // Kept: NASA's map is the Magellan *radar* mosaic tinted orange -- 93% mean saturation
      // against this one's 44%. Radar is real data and is not what Venus looks like.
      photometric: { file: 'venus.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    horizonsId: '399',
    stepDays: 4,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 6378.1366,
    radiusPolarKm: 6356.7519,
    gmKm3S2: 398600.435507,
    rotationPeriodHours: 23.9344695,
    axialTiltDeg: 23.4392911,
    poleRaDeg: 0.0,
    poleDecDeg: 90.0,
    poleRaRateDegPerCentury: -0.641,
    poleDecRateDegPerCentury: -0.557,
    primeMeridianDeg: 190.147,
    rotationRateDegPerDay: 360.9856235,
    poleNutation: null,
    color: '#3aa8e0',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'earth.jpg', longitudeOriginDeg: 180 },
      // NASA Blue Marble Next Generation: calibrated MODIS radiance, so true
      // colour by construction rather than by adjustment.
      photometric: { file: 'earth-photometric.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    horizonsId: '499',
    stepDays: 8,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 3396.19,
    radiusPolarKm: 3376.2,
    gmKm3S2: 42828.375816,
    rotationPeriodHours: 24.622962,
    axialTiltDeg: 25.19,
    poleRaDeg: 317.68143,
    poleDecDeg: 52.8865,
    poleRaRateDegPerCentury: -0.1061,
    poleDecRateDegPerCentury: -0.0609,
    primeMeridianDeg: 176.63,
    rotationRateDegPerDay: 350.891982443297,
    poleNutation: null,
    color: '#d96c3f',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'mars.jpg', longitudeOriginDeg: 180 },
      // NASA 3D Resources, Viking-derived. Butterscotch rather than orange-red, which is the
      // colour Mars actually is.
      photometric: { file: 'mars-photometric.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    horizonsId: '599',
    // a 12-year orbit needs nothing finer
    stepDays: 32,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 71492,
    radiusPolarKm: 66854,
    gmKm3S2: 126712764.1,
    rotationPeriodHours: 9.92496,
    axialTiltDeg: 3.13,
    poleRaDeg: 268.056595,
    poleDecDeg: 64.495303,
    poleRaRateDegPerCentury: -0.006499,
    poleDecRateDegPerCentury: 0.002413,
    primeMeridianDeg: 284.95,
    rotationRateDegPerDay: 870.536,
    poleNutation: null,
    color: '#d8a05a',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'jupiter.jpg', longitudeOriginDeg: 180 },
      // Kept: NASA's Cassini map is an enhanced-colour product at 65% saturation against
      // this one's 14%. Ours is already the paler, less processed option.
      photometric: { file: 'jupiter.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    horizonsId: '699',
    stepDays: 32,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 60268,
    radiusPolarKm: 54364,
    gmKm3S2: 37940584.8418,
    rotationPeriodHours: 10.656,
    axialTiltDeg: 26.73,
    poleRaDeg: 40.589,
    poleDecDeg: 83.537,
    poleRaRateDegPerCentury: -0.036,
    poleDecRateDegPerCentury: -0.004,
    primeMeridianDeg: 38.9,
    rotationRateDegPerDay: 810.7939024,
    poleNutation: null,
    color: '#e0c060',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'saturn.jpg', longitudeOriginDeg: 180 },
      // Kept: Same as Jupiter: the NASA map is enhanced, at 68% saturation against 21%.
      photometric: { file: 'saturn.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    horizonsId: '799',
    stepDays: 32,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 25559,
    radiusPolarKm: 24973,
    gmKm3S2: 5794556.4,
    rotationPeriodHours: -17.24,
    axialTiltDeg: 97.77,
    poleRaDeg: 257.311,
    poleDecDeg: -15.175,
    poleRaRateDegPerCentury: 0,
    poleDecRateDegPerCentury: 0,
    primeMeridianDeg: 203.81,
    rotationRateDegPerDay: -501.1600928,
    poleNutation: null,
    color: '#7fd8d8',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'uranus.jpg', longitudeOriginDeg: 180 },
      // Kept: No global map exists in either set. There is almost nothing to map: it is a
      // featureless disc.
      photometric: { file: 'uranus.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    horizonsId: '899',
    stepDays: 32,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'planet',
    radiusEquatorialKm: 24764,
    radiusPolarKm: 24341,
    gmKm3S2: 6836527.10058,
    rotationPeriodHours: 16.11,
    axialTiltDeg: 28.32,
    poleRaDeg: 299.36,
    poleDecDeg: 43.46,
    poleRaRateDegPerCentury: 0,
    poleDecRateDegPerCentury: 0,
    primeMeridianDeg: 253.18,
    rotationRateDegPerDay: 536.3128492,
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
    color: '#5a7fd8',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'neptune.jpg', longitudeOriginDeg: 180 },
      // NASA 3D Resources. Pale blue-green, the direction Irwin et al. 2024 established when
      // they reprocessed the contrast-stretched Voyager 2 imagery.
      photometric: { file: 'neptune-photometric.jpg', longitudeOriginDeg: 180 },
    },
  },
  {
    id: 'pluto',
    name: 'Pluto',
    horizonsId: '999',
    // limited by Charon, not by its 248-year orbit
    stepDays: 2,
    center: SSB_CENTER,
    elementsCenter: SUN_CENTER,
    parent: null,
    kind: 'dwarf-planet',
    radiusEquatorialKm: 1188.3,
    radiusPolarKm: 1188.3,
    gmKm3S2: 869.613817,
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
    poleRaDeg: 132.993,
    poleDecDeg: -6.163,
    poleRaRateDegPerCentury: 0,
    poleDecRateDegPerCentury: 0,
    primeMeridianDeg: 302.695,
    rotationRateDegPerDay: 56.3625225,
    poleNutation: null,
    color: '#b0a090',
    drawOrbit: true,
    textures: {
      illustrative: { file: 'pluto.jpg', longitudeOriginDeg: 0 },
      // Kept: Already the NASA New Horizons mosaic, so both sets point at the same mission
      // product.
      photometric: { file: 'pluto.jpg', longitudeOriginDeg: 0 },
    },
  },
];

/** Look up a body by id. Throws rather than returning undefined: ids are ours. */
export function getBody(id: string): BodyDefinition {
  const body = CATALOG.find((candidate) => candidate.id === id);
  if (!body) {
    throw new Error(`Unknown body id: ${id}`);
  }
  return body;
}
