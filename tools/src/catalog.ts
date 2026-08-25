import type { BodyDefinition } from './types.ts';

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
    color: '#ffd24a',
    // The Sun's motion about the barycenter is a small wobble, not an orbit worth
    // drawing as a conic.
    drawOrbit: false,
    texture: null,
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
    color: '#a98cd8',
    drawOrbit: true,
    texture: null,
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
    color: '#e8a33d',
    drawOrbit: true,
    texture: null,
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
    color: '#3aa8e0',
    drawOrbit: true,
    texture: null,
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
    color: '#d96c3f',
    drawOrbit: true,
    texture: null,
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
    color: '#d8a05a',
    drawOrbit: true,
    texture: null,
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
    color: '#e0c060',
    drawOrbit: true,
    texture: null,
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
    color: '#7fd8d8',
    drawOrbit: true,
    texture: null,
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
    color: '#5a7fd8',
    drawOrbit: true,
    texture: null,
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
    axialTiltDeg: 122.53,
    color: '#b0a090',
    drawOrbit: true,
    texture: null,
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
