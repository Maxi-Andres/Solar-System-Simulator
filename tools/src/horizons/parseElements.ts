import type { BodyDefinition, OsculatingElements } from '../types.ts';
import { parseEphemerisCsv, singleValue } from './parseCsv.ts';

/**
 * Turns an EPHEM_TYPE=ELEMENTS report into osculating orbital elements.
 *
 * Horizons' column names are terse; the mapping is:
 *   EC eccentricity            QR periapsis distance (km)
 *   IN inclination (deg)       OM longitude of ascending node (deg)
 *   W  argument of periapsis   Tp time of periapsis passage (JD TDB)
 *   N  mean motion (deg/s)     MA mean anomaly (deg)
 *   TA true anomaly (deg)      A  semi-major axis (km)
 *   AD apoapsis distance (km)  PR sidereal period (s)
 *
 * A single epoch is requested via TLIST, so every column holds exactly one row.
 */
export function parseElements(result: string, body: BodyDefinition): OsculatingElements {
  const table = parseEphemerisCsv(result);

  return {
    id: body.id,
    center: body.elementsCenter,
    epochJd: singleValue(table, 'JDTDB'),
    eccentricity: singleValue(table, 'EC'),
    periapsisKm: singleValue(table, 'QR'),
    inclinationDeg: singleValue(table, 'IN'),
    ascendingNodeDeg: singleValue(table, 'OM'),
    argPeriapsisDeg: singleValue(table, 'W'),
    periapsisTimeJd: singleValue(table, 'Tp'),
    meanMotionDegPerSec: singleValue(table, 'N'),
    meanAnomalyDeg: singleValue(table, 'MA'),
    trueAnomalyDeg: singleValue(table, 'TA'),
    semiMajorAxisKm: singleValue(table, 'A'),
    apoapsisKm: singleValue(table, 'AD'),
    periodSec: singleValue(table, 'PR'),
  };
}
