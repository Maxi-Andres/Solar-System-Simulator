import { AU_KM, BELT_FILE, SBDB_QUERY_API_URL } from '../config.ts';
import { fromJulianDay } from '../horizons/queries.ts';
import {
  BELT_CLASSES,
  BELT_RECORD_FLOATS,
  type BeltClass,
  type BeltInfo,
  type BodyDefinition,
} from '../types.ts';
import type { SbdbRow } from './sbdb.ts';

/**
 * The asteroid belt, from SBDB's rows to the file the app reads: see BeltInfo and
 * BELT_RECORD_FLOATS in types.ts for the format.
 *
 * Four things happen here, all in float64, and only the last step rounds to float32:
 *
 * 1. **Units.** AU to km by the IAU's exact astronomical unit (AU_KM), degrees to
 *    radians, deg/day to rad/day.
 * 2. **One epoch for every orbit.** SBDB gives each orbit at its own epoch of
 *    osculation -- 81,892 of the 83,841 at 2026-06-09, the rest anywhere back to 1927.
 *    Each mean anomaly is moved to the common `referenceJd` along its own mean motion,
 *    M_ref = M + n (referenceJd - epoch), so the GPU only ever adds n·Δt to it. Done in
 *    float64 because the step can be large: n·Δt is thousands of degrees for an orbit
 *    whose epoch is decades old, and float32 keeps seven digits.
 * 3. **What is left out.** Open orbits (e >= 1: SBDB's PAA and HYA classes), rows with
 *    an element missing, and the asteroids the catalog already draws as bodies of their
 *    own, from JPL's vectors -- so nothing is drawn twice.
 * 4. **Order.** By H, brightest first, so a prefix of the file is a complete belt down to
 *    some magnitude; ties by SPK-ID, so two runs on the same data write the same bytes.
 *
 * The epoch move is two-body, and so is everything the app does with these elements.
 * That is the accuracy statement, measured against Horizons for the named bodies: within
 * a year of the elements' epoch, 40,000 to 190,000 km for Ceres, Vesta and Eros; ten
 * years out, up to 6.5 million km, about a degree; and Apophis 267 million km off five
 * years on, because its 2029 Earth encounter is exactly what two-body cannot see. A
 * close-approach asteroid is where this drifts most.
 */

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

/**
 * A Horizons major-body id that SBDB also lists as an asteroid, and its SBDB designation.
 *
 * Pluto is the one: Horizons draws it as body 999, from DE441, and SBDB carries it as
 * minor planet 134340 (since the IAU's 2006 reclassification), with an orbit at a 2016
 * epoch. Without this it would be drawn twice, the second time ten years propagated.
 */
const SBDB_DESIGNATION_OF_MAJOR_BODY: Readonly<Record<string, string>> = {
  '999': '134340',
};

/** A Horizons small-body COMMAND: the designation and a semicolon, e.g. '4;' for Vesta. */
const SMALL_BODY_COMMAND = /^(\d+);$/;

/**
 * The SBDB designations of every body in `catalog` that SBDB lists as an asteroid --
 * the named small bodies and Pluto -- which the belt therefore leaves out.
 *
 * A dwarf planet or asteroid whose designation cannot be worked out fails here, rather
 * than being drawn twice: a new small body added under a form this does not know
 * ('DES=2024 YR4;') needs this function taught it first.
 */
export function catalogDesignations(catalog: readonly BodyDefinition[]): string[] {
  const designations: string[] = [];
  for (const body of catalog) {
    const command = SMALL_BODY_COMMAND.exec(body.horizonsId);
    const designation = command?.[1] ?? SBDB_DESIGNATION_OF_MAJOR_BODY[body.horizonsId] ?? null;
    if (designation !== null) {
      designations.push(designation);
    } else if (body.kind === 'asteroid' || body.kind === 'dwarf-planet') {
      throw new Error(
        `${body.id} (Horizons '${body.horizonsId}') has no SBDB designation to leave out of the belt.`,
      );
    }
  }
  return [...new Set(designations)].sort((p, q) => Number(p) - Number(q) || p.localeCompare(q));
}

/** An angle wrapped into [0, 2π): the node and the argument of perihelion. */
export function wrapRadians(angle: number): number {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/**
 * An angle wrapped into [−π, π): the mean anomaly.
 *
 * Centred on perihelion rather than starting at it, because that is where float32's
 * digits are needed. A float32 has a fixed number of significant digits, so an angle near
 * 0 is stored to a tiny fraction of the step one near ±π gets -- and an eccentric orbit
 * turns a small error in M into a large one in position exactly at perihelion, where it
 * moves fastest, while at aphelion, near ±π, the same error barely moves it. Measured on
 * the H < 15 belt of 2026-10-19, against the float64 record at the reference instant:
 *
 *   storage error, km          M in [0, 2π)    M in [−π, π)
 *   main belt, worst                311             300
 *   Quaoar                        2,076             938
 *   Sedna (near perihelion)      60,867             971
 *   2020 MQ53                 4,088,457          14,674
 *   worst of all                (2020 MQ53)     96,018 (2020 M4)
 *
 * 2020 MQ53 has a = 13,940 AU and e = 0.996, fifteen years short of perihelion at M =
 * 359.997 deg: in [0, 2π) that is 6.2831 rad, at float32's coarsest step for the range.
 * What is left for it, and for 2020 M4 (a = 14,513 AU, e = 0.9996), is the other
 * elements' rounding: float32's step in a semi-major axis of 2 x 10^12 km is 262,144 km.
 */
export function wrapMeanAnomaly(angle: number): number {
  const wrapped = wrapRadians(angle);
  return wrapped >= Math.PI ? wrapped - TWO_PI : wrapped;
}

/**
 * A mean anomaly moved from its own epoch to `referenceJd`, radians in [−π, π).
 *
 * Wrapped in degrees first, where both inputs are given, and then again in radians: the
 * product n·Δt is exact to float64's sixteen digits either way, and wrapping before the
 * conversion keeps the number small when it is multiplied by π/180.
 */
export function meanAnomalyAt(
  meanAnomalyDeg: number,
  meanMotionDegPerDay: number,
  epochJd: number,
  referenceJd: number,
): number {
  const turn = (meanAnomalyDeg + meanMotionDegPerDay * (referenceJd - epochJd)) % 360;
  const degrees = turn >= 180 ? turn - 360 : turn < -180 ? turn + 360 : turn;
  return wrapMeanAnomaly(degrees * DEG);
}

/**
 * The largest float32 below π: 3.14159250259 (bits 0x40490fda). π itself rounds to
 * 3.14159274101, *above* π, and −π to the same distance below −π.
 */
export const FLOAT32_BELOW_PI = 3.1415925025939941;

/**
 * The value a mean anomaly is stored as, so that its float32 is still inside [−π, π).
 *
 * Every M within 3.2e-8 rad of ±π -- aphelion -- would round to ±3.14159274, outside the
 * range on either side. Those are written as ±FLOAT32_BELOW_PI instead: under one float32
 * step (2.4e-7 rad there) from the true angle, which is float32's own rounding, at the point of the
 * orbit where an error in M moves the asteroid least.
 */
export function storedMeanAnomaly(radians: number): number {
  const stored = Math.fround(radians);
  if (stored >= Math.PI) {
    return FLOAT32_BELOW_PI;
  }
  if (stored < -Math.PI) {
    return -FLOAT32_BELOW_PI;
  }
  return radians;
}

/** What the build makes: the belt's description, its records, and what the log says. */
export interface BeltBuild {
  readonly info: BeltInfo;
  /** BELT_RECORD_FLOATS per asteroid, in BeltInfo's order. */
  readonly records: Float32Array;
  /** The excluded designations SBDB actually returned inside the magnitude limit. */
  readonly excludedFound: readonly string[];
  /** Orbits whose SBDB epoch is more than STALE_EPOCH_YEARS from `referenceJd`. */
  readonly staleEpochs: number;
}

/**
 * How old an orbit's epoch has to be for the log to count it. Ten years, the planets'
 * window: past it, the drift measured above is a degree and growing.
 */
export const STALE_EPOCH_YEARS = 10;

export interface BuildBeltInput {
  readonly rows: readonly SbdbRow[];
  readonly queriedAt: string;
  /** TDB Julian day every mean anomaly is moved to. */
  readonly referenceJd: number;
  readonly magnitudeLimit: number;
  /** SBDB designations to leave out; see catalogDesignations. */
  readonly excluded: readonly string[];
}

/** A row that passed every check, in the units it is written in. */
interface BeltOrbit {
  readonly spkid: number;
  readonly epochJd: number;
  readonly values: readonly number[];
  readonly h: number;
}

export function buildBelt(input: BuildBeltInput): BeltBuild {
  const { referenceJd } = input;
  const excluded = new Set(input.excluded);
  const classIndex = new Map<string, number>(BELT_CLASSES.map((code, index) => [code, index]));

  const orbits: BeltOrbit[] = [];
  const excludedFound: string[] = [];
  const unknownClasses = new Map<string, number>();
  let notElliptic = 0;
  let missingElements = 0;

  for (const row of input.rows) {
    if (excluded.has(row.designation)) {
      excludedFound.push(row.designation);
      continue;
    }
    const { aAu, e, iDeg, nodeDeg, periDeg, meanAnomalyDeg, epochJd, meanMotionDegPerDay, h } =
      row;
    if (
      aAu === null ||
      e === null ||
      iDeg === null ||
      nodeDeg === null ||
      periDeg === null ||
      meanAnomalyDeg === null ||
      epochJd === null ||
      meanMotionDegPerDay === null ||
      h === null
    ) {
      // One in the H < 15 belt, measured 2026-10-19: 2002 PD153, a TNO whose orbit SBDB
      // gives with e = 0 and no mean anomaly at all. Not guessed at.
      missingElements += 1;
      continue;
    }
    // Open orbits have no mean motion to propagate with: SBDB's two hyperbolic
    // "asteroids" in the H < 15 belt, 2010 LN135 and 2024 U2, both with negative a.
    if (!(e < 1) || !(aAu > 0)) {
      notElliptic += 1;
      continue;
    }
    // The frame, checked rather than assumed: every row so far is J2000, and one that is
    // not would be in a different ecliptic.
    if (row.equinox !== 'J2000') {
      throw new Error(
        `SBDB gives ${row.designation} in equinox ${String(row.equinox)}, not J2000.`,
      );
    }
    const code = row.orbitClass === null ? undefined : classIndex.get(row.orbitClass);
    if (code === undefined) {
      const key = String(row.orbitClass);
      unknownClasses.set(key, (unknownClasses.get(key) ?? 0) + 1);
      continue;
    }
    orbits.push({
      spkid: row.spkid,
      epochJd,
      h,
      values: [
        aAu * AU_KM,
        e,
        iDeg * DEG,
        wrapRadians(nodeDeg * DEG),
        wrapRadians(periDeg * DEG),
        storedMeanAnomaly(meanAnomalyAt(meanAnomalyDeg, meanMotionDegPerDay, epochJd, referenceJd)),
        meanMotionDegPerDay * DEG,
        h,
        code,
      ],
    });
  }

  // Every class SBDB documents for asteroids is in BELT_CLASSES (sbdb_filter.html, "Orbit
  // Classes"). A code outside them means JPL changed its classification, and lumping it
  // into AST -- "orbit not matching any defined class" -- would be saying something
  // false about it. So the run stops and says what it saw.
  if (unknownClasses.size > 0) {
    const seen = [...unknownClasses].map(([code, count]) => `${code} x${count}`).join(', ');
    throw new Error(
      `SBDB returned orbit classes the belt does not know: ${seen}. Add them to BELT_CLASSES.`,
    );
  }
  if (orbits.length === 0) {
    throw new Error('No asteroid survived the belt build.');
  }

  orbits.sort((p, q) => p.h - q.h || p.spkid - q.spkid);

  const records = new Float32Array(orbits.length * BELT_RECORD_FLOATS);
  const classCounts = new Map<BeltClass, number>();
  let minJd = Infinity;
  let maxJd = -Infinity;
  let staleEpochs = 0;
  for (const [index, orbit] of orbits.entries()) {
    records.set(orbit.values, index * BELT_RECORD_FLOATS);
    const orbitClass = BELT_CLASSES[orbit.values[8]!]!;
    classCounts.set(orbitClass, (classCounts.get(orbitClass) ?? 0) + 1);
    minJd = Math.min(minJd, orbit.epochJd);
    maxJd = Math.max(maxJd, orbit.epochJd);
    if (Math.abs(referenceJd - orbit.epochJd) > STALE_EPOCH_YEARS * 365.25) {
      staleEpochs += 1;
    }
  }

  const info: BeltInfo = {
    source: {
      name: 'JPL Small-Body Database (SBDB) Query API',
      url: SBDB_QUERY_API_URL,
      queriedAt: input.queriedAt,
    },
    file: BELT_FILE,
    count: orbits.length,
    recordFloats: BELT_RECORD_FLOATS,
    magnitudeLimit: input.magnitudeLimit,
    referenceJd,
    elementEpochs: { minJd, maxJd },
    classes: [...BELT_CLASSES],
    // In code order, so the file reads the same way the classes do.
    classCounts: Object.fromEntries(
      BELT_CLASSES.filter((code) => classCounts.has(code)).map((code) => [
        code,
        classCounts.get(code)!,
      ]),
    ),
    excluded: [...input.excluded],
    dropped: { notElliptic, missingElements },
  };

  return { info, records, excludedFound, staleEpochs };
}

/**
 * The records as the file holds them: little-endian float32, whatever the machine.
 *
 * Every machine this runs on is little-endian, so this is the Float32Array's own bytes in
 * practice; it is written through a DataView anyway, so the format is the documented one
 * rather than an accident of the build host.
 */
export function beltBytes(records: Float32Array): Uint8Array {
  const bytes = new Uint8Array(records.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < records.length; index += 1) {
    view.setFloat32(index * 4, records[index]!, true);
  }
  return bytes;
}

/** The lines a run logs about its belt. */
export function describeBelt(build: BeltBuild): string[] {
  const { info } = build;
  const classes = Object.entries(info.classCounts)
    .map(([code, count]) => `${code} ${count}`)
    .join(', ');
  const day = (jd: number) => fromJulianDay(jd).toISOString().slice(0, 10);
  return [
    `[belt] ${info.count} asteroids to H < ${info.magnitudeLimit}: ${classes}`,
    `[belt] elements from ${day(info.elementEpochs.minJd)} to ${day(info.elementEpochs.maxJd)}, ` +
      `moved to JD ${info.referenceJd} TDB; ${build.staleEpochs} are more than ` +
      `${STALE_EPOCH_YEARS} years from it`,
    `[belt] left out: ${build.excludedFound.length} drawn as bodies (${build.excludedFound.join(', ')}), ` +
      `${info.dropped.notElliptic} not elliptic, ${info.dropped.missingElements} missing an element`,
  ];
}
