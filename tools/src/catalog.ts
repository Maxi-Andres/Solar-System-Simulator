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
