import {
  HIPPARCOS_EPOCH_JULIAN_YEAR,
  HIPPARCOS_TABLE,
  STAR_ANGLE_DECIMALS,
  STAR_COLOR_INDEX_DECIMALS,
  STAR_EPOCH_JULIAN_YEAR,
  STAR_MAGNITUDE_DECIMALS,
  STAR_MAGNITUDE_LIMIT,
  STAR_PROPER_MOTION_DECIMALS,
  VIZIER_TAP_URL,
} from '../config.ts';
import type { StarCatalog } from '../types.ts';
import type { HipparcosRow } from './vizier.ts';

/**
 * Turns Hipparcos rows into the columns the renderer reads.
 *
 * Three things happen here and they are all arithmetic on published numbers:
 *
 *  1. **Two kinds of position.** Most stars have an ICRS solution, given at J1991.25 --
 *     the mean epoch of Hipparcos's own observations, not a round number by accident.
 *     A handful have none, because their astrometric solution was flagged as a double
 *     or a problem case, and for those the catalogue still publishes the sexagesimal
 *     J2000 position. Ten stars inside our magnitude limit fall in that second group
 *     and one of them, HIP 55203, is naked-eye at magnitude 3.79, so reading only the
 *     ICRS column would quietly lose a star anybody can see.
 *
 *  2. **Proper motion to J2000.** Everything else in this project is J2000 -- the
 *     obliquity, the IAU pole elements, the galactic frame -- so the ICRS positions are
 *     moved the 8.75 years to meet it. That is up to 62 arcseconds for the fastest star
 *     in the set, which is most of a pixel, and it is free to get right.
 *
 *  3. **Rounding**, against a pixel rather than by habit. See config.ts.
 *
 * Nothing is modelled or invented. A star missing the colour index is dropped rather
 * than given a colour, and the count of those is published in the output.
 */

const DEG = Math.PI / 180;
const MAS_PER_YEAR_TO_RAD = (1 / 3_600_000) * DEG;

/** Years between the catalogue's epoch and the one we publish at. */
export const EPOCH_SHIFT_YEARS = STAR_EPOCH_JULIAN_YEAR - HIPPARCOS_EPOCH_JULIAN_YEAR;

/**
 * Parses Hipparcos's sexagesimal J2000 position, e.g. "11 18 11.24" / "+31 31 50.8".
 *
 * The sign belongs to the whole declination, not just to its degrees, which is the
 * classic way to get a star 62 arcminutes from where it belongs.
 */
export function parseSexagesimalHours(text: string): number {
  const parts = text.trim().split(/\s+/).map(Number);
  const [hours, minutes, seconds] = parts;
  if (parts.length !== 3 || hours === undefined || minutes === undefined || seconds === undefined) {
    throw new Error(`Not a sexagesimal right ascension: "${text}"`);
  }
  if (!parts.every((part) => Number.isFinite(part))) {
    throw new Error(`Right ascension has a non-numeric field: "${text}"`);
  }
  return (hours + minutes / 60 + seconds / 3600) * 15;
}

export function parseSexagesimalDegrees(text: string): number {
  const trimmed = text.trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const parts = trimmed.replace(/^[+-]/, '').split(/\s+/).map(Number);
  const [degrees, minutes, seconds] = parts;
  if (parts.length !== 3 || degrees === undefined || minutes === undefined || seconds === undefined) {
    throw new Error(`Not a sexagesimal declination: "${text}"`);
  }
  if (!parts.every((part) => Number.isFinite(part))) {
    throw new Error(`Declination has a non-numeric field: "${text}"`);
  }
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

/**
 * Moves a position by its proper motion, as a rotation of the unit vector.
 *
 * Written as vectors rather than as `alpha += mu / cos(dec)` for two reasons. It does
 * not blow up near the poles, where that division does; and it is the same expression
 * the vertex shader runs to carry the sky on to the simulation's own date, so the two
 * cannot drift apart.
 *
 * Linear motion on the sphere, which is what a catalogue proper motion is. Over the few
 * centuries this app can reach, the terms it leaves out -- perspective acceleration
 * from radial velocity, mostly -- stay far below the arcsecond.
 */
export function applyProperMotion(
  raDeg: number,
  decDeg: number,
  pmRaMasPerYear: number,
  pmDecMasPerYear: number,
  years: number,
): { raDeg: number; decDeg: number } {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const cosDec = Math.cos(dec);

  const direction = [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)] as const;
  // East is the direction of increasing right ascension; north completes the pair.
  const east = [-Math.sin(ra), Math.cos(ra), 0] as const;
  const north = [
    -Math.sin(dec) * Math.cos(ra),
    -Math.sin(dec) * Math.sin(ra),
    cosDec,
  ] as const;

  const alongEast = pmRaMasPerYear * MAS_PER_YEAR_TO_RAD * years;
  const alongNorth = pmDecMasPerYear * MAS_PER_YEAR_TO_RAD * years;

  const moved = [
    direction[0] + east[0] * alongEast + north[0] * alongNorth,
    direction[1] + east[1] * alongEast + north[1] * alongNorth,
    direction[2] + east[2] * alongEast + north[2] * alongNorth,
  ];
  const norm = Math.hypot(moved[0] as number, moved[1] as number, moved[2] as number);

  const x = (moved[0] as number) / norm;
  const y = (moved[1] as number) / norm;
  const z = (moved[2] as number) / norm;

  return {
    raDeg: ((Math.atan2(y, x) / DEG) + 360) % 360,
    decDeg: Math.asin(Math.max(-1, Math.min(1, z))) / DEG,
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** A star that survived the drop rules, at the published epoch. */
interface ResolvedStar {
  readonly raDeg: number;
  readonly decDeg: number;
  readonly vMag: number;
  readonly colorIndex: number;
  readonly pmRaMasPerYear: number;
  readonly pmDecMasPerYear: number;
}

function resolve(row: HipparcosRow): ResolvedStar | 'no-position' | 'no-color-index' {
  if (row.colorIndex === null) {
    return 'no-color-index';
  }

  const pmRa = row.pmRaMasPerYear ?? 0;
  const pmDec = row.pmDecMasPerYear ?? 0;

  if (row.raIcrsDeg !== null && row.decIcrsDeg !== null) {
    const moved = applyProperMotion(
      row.raIcrsDeg,
      row.decIcrsDeg,
      pmRa,
      pmDec,
      EPOCH_SHIFT_YEARS,
    );
    return {
      raDeg: moved.raDeg,
      decDeg: moved.decDeg,
      vMag: row.vMag,
      colorIndex: row.colorIndex,
      pmRaMasPerYear: pmRa,
      pmDecMasPerYear: pmDec,
    };
  }

  if (row.raHms === null || row.decDms === null) {
    return 'no-position';
  }

  // Already J2000: the sexagesimal columns are the original catalogue position at the
  // standard equinox, so they need no epoch shift. These rows carry no proper motion
  // either, which is why their astrometric solution was flagged in the first place.
  return {
    raDeg: parseSexagesimalHours(row.raHms),
    decDeg: parseSexagesimalDegrees(row.decDms),
    vMag: row.vMag,
    colorIndex: row.colorIndex,
    pmRaMasPerYear: pmRa,
    pmDecMasPerYear: pmDec,
  };
}

export function buildStarCatalog(
  rows: readonly HipparcosRow[],
  queriedAt: string,
  magnitudeLimit = STAR_MAGNITUDE_LIMIT,
): StarCatalog {
  const stars: ResolvedStar[] = [];
  let noPosition = 0;
  let noColorIndex = 0;

  for (const row of rows) {
    if (row.vMag > magnitudeLimit) {
      continue;
    }
    const resolved = resolve(row);
    if (resolved === 'no-position') {
      noPosition += 1;
    } else if (resolved === 'no-color-index') {
      noColorIndex += 1;
    } else {
      stars.push(resolved);
    }
  }

  if (stars.length === 0) {
    throw new Error('Every star was dropped, which means the columns were misread.');
  }

  // Brightest first. Not cosmetic: a Points draw call runs in buffer order, and the
  // brightest stars are the ones that must survive any future decision to load the
  // catalogue in rungs the way the panorama did.
  stars.sort((a, b) => a.vMag - b.vMag);

  return {
    source: {
      name: 'ESA Hipparcos catalogue (ESA 1997), via VizieR TAP at CDS Strasbourg',
      table: HIPPARCOS_TABLE,
      url: VIZIER_TAP_URL,
      queriedAt,
    },
    epoch: `ICRS, J${STAR_EPOCH_JULIAN_YEAR.toFixed(1)}`,
    magnitudeLimit,
    count: stars.length,
    dropped: { noPosition, noColorIndex },
    ra: stars.map((star) => round(star.raDeg, STAR_ANGLE_DECIMALS)),
    dec: stars.map((star) => round(star.decDeg, STAR_ANGLE_DECIMALS)),
    mag: stars.map((star) => round(star.vMag, STAR_MAGNITUDE_DECIMALS)),
    bv: stars.map((star) => round(star.colorIndex, STAR_COLOR_INDEX_DECIMALS)),
    pmRa: stars.map((star) => round(star.pmRaMasPerYear, STAR_PROPER_MOTION_DECIMALS)),
    pmDec: stars.map((star) => round(star.pmDecMasPerYear, STAR_PROPER_MOTION_DECIMALS)),
  };
}
