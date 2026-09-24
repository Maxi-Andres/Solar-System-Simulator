import {
  HIPPARCOS_EPOCH_JULIAN_YEAR,
  HIPPARCOS_TABLE,
  STAR_ANGLE_DECIMALS,
  STAR_COLOR_INDEX_DECIMALS,
  STAR_EPOCH_JULIAN_YEAR,
  STAR_MAGNITUDE_DECIMALS,
  STAR_MAGNITUDE_LIMIT,
  STAR_PROPER_MOTION_DECIMALS,
  TYCHO2_TABLE,
  VIZIER_TAP_URL,
} from '../config.ts';
import type { StarCatalog } from '../types.ts';
import type { CatalogRow } from './vizier.ts';

/**
 * Turns two catalogues into the columns the renderer reads.
 *
 * **Hipparcos is authoritative; Tycho-2 fills in what it does not have.** The join is
 * exact rather than positional: every Tycho-2 row carries the HIP number of the star it
 * is, or nothing, so a star is added only when Hipparcos did not supply it. That matters
 * because the overlap is most of the sky, and in the overlap Hipparcos has directly
 * measured Johnson magnitudes where Tycho-2 has transformed ones.
 *
 * Three things then happen, and they are all arithmetic on published numbers:
 *
 *  1. **Two kinds of position, in Hipparcos.** Most stars have an ICRS solution given at
 *     J1991.25 -- the mean epoch of Hipparcos's own observations, not a round number by
 *     accident. A handful have none, because their astrometric solution was flagged as a
 *     double or a problem case, and for those the catalogue still publishes the
 *     sexagesimal J2000 position. Ten stars inside our magnitude limit fall in that
 *     second group and one of them, HIP 55203, is naked-eye at magnitude 3.79, so
 *     reading only the ICRS column would quietly lose a star anybody can see.
 *
 *     Tycho-2 has neither problem: its mean positions are published at J2000 already.
 *
 *  2. **Proper motion to J2000**, for the Hipparcos rows that need it. That is up to 62
 *     arcseconds for the fastest star in the set, which is most of a pixel, and it is
 *     free to get right. The check is Sirius, which lands on its published J2000
 *     position to under a milliarcsecond.
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
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), cosDec] as const;

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
    raDeg: (Math.atan2(y, x) / DEG + 360) % 360,
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

type Resolution = ResolvedStar | 'no-position' | 'no-color-index';

/**
 * Resolves one row to a drawable star.
 *
 * `epochShiftYears` is what separates the two catalogues: Hipparcos publishes at
 * J1991.25 and needs 8.75 years of proper motion applied, Tycho-2 publishes at J2000
 * and needs none.
 */
function resolve(row: CatalogRow, epochShiftYears: number): Resolution {
  if (row.colorIndex === null || !Number.isFinite(row.colorIndex)) {
    return 'no-color-index';
  }

  const pmRa = row.pmRaMasPerYear ?? 0;
  const pmDec = row.pmDecMasPerYear ?? 0;

  if (row.raDeg !== null && row.decDeg !== null) {
    const moved =
      epochShiftYears === 0
        ? { raDeg: row.raDeg, decDeg: row.decDeg }
        : applyProperMotion(row.raDeg, row.decDeg, pmRa, pmDec, epochShiftYears);
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

export interface BuildInput {
  readonly hipparcos: readonly CatalogRow[];
  readonly tycho2: readonly CatalogRow[];
  readonly queriedAt: string;
  readonly magnitudeLimit?: number;
}

export function buildStarCatalog({
  hipparcos,
  tycho2,
  queriedAt,
  magnitudeLimit = STAR_MAGNITUDE_LIMIT,
}: BuildInput): StarCatalog {
  const stars: ResolvedStar[] = [];
  let noPosition = 0;
  let noColorIndex = 0;
  let fromHipparcos = 0;

  /** HIP numbers Hipparcos actually supplied, which is what Tycho-2 defers to. */
  const supplied = new Set<number>();

  for (const row of hipparcos) {
    if (row.vMag > magnitudeLimit) {
      continue;
    }
    const resolved = resolve(row, EPOCH_SHIFT_YEARS);
    if (resolved === 'no-position') {
      noPosition += 1;
    } else if (resolved === 'no-color-index') {
      // Not counted as a loss yet: Tycho-2 may have the same star with a colour, and
      // recovering it there is better than dropping a real star for want of one column.
      noColorIndex += 1;
    } else {
      stars.push(resolved);
      fromHipparcos += 1;
      if (row.hip !== null) {
        supplied.add(row.hip);
      }
    }
  }

  let fromTycho2 = 0;
  for (const row of tycho2) {
    if (row.vMag > magnitudeLimit) {
      continue;
    }
    if (row.hip !== null && supplied.has(row.hip)) {
      continue;
    }
    const resolved = resolve(row, 0);
    if (resolved === 'no-position') {
      noPosition += 1;
    } else if (resolved === 'no-color-index') {
      noColorIndex += 1;
    } else {
      stars.push(resolved);
      fromTycho2 += 1;
      if (row.hip !== null) {
        // A star Hipparcos dropped for want of a colour index, recovered here.
        noColorIndex -= 1;
      }
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
    sources: [
      {
        name: 'ESA Hipparcos catalogue (ESA 1997)',
        table: HIPPARCOS_TABLE,
        stars: fromHipparcos,
        note: 'Johnson V and B-V as measured. Positions at J1991.25, moved to J2000.',
      },
      {
        name: 'Tycho-2 (Hog et al. 2000)',
        table: TYCHO2_TABLE,
        stars: fromTycho2,
        note: 'V and B-V transformed from BT and VT. Positions already at J2000.',
      },
    ],
    via: VIZIER_TAP_URL,
    queriedAt,
    epoch: `ICRS, J${STAR_EPOCH_JULIAN_YEAR.toFixed(1)}`,
    magnitudeLimit,
    count: stars.length,
    dropped: { noPosition, noColorIndex: Math.max(0, noColorIndex) },
    ra: stars.map((star) => round(star.raDeg, STAR_ANGLE_DECIMALS)),
    dec: stars.map((star) => round(star.decDeg, STAR_ANGLE_DECIMALS)),
    mag: stars.map((star) => round(star.vMag, STAR_MAGNITUDE_DECIMALS)),
    bv: stars.map((star) => round(star.colorIndex, STAR_COLOR_INDEX_DECIMALS)),
    pmRa: stars.map((star) => round(star.pmRaMasPerYear, STAR_PROPER_MOTION_DECIMALS)),
    pmDec: stars.map((star) => round(star.pmDecMasPerYear, STAR_PROPER_MOTION_DECIMALS)),
  };
}
