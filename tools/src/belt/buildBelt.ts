import { AU_KM, BELT_NAMES_FILE, beltTierFile, SBDB_QUERY_API_URL } from '../config.ts';
import { fromJulianDay } from '../horizons/queries.ts';
import {
  BELT_CLASSES,
  BELT_RECORD_FLOATS,
  type BeltClass,
  type BeltInfo,
  type BeltNames,
  type BeltTier,
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
 *    osculation -- 81,892 of the 83,841 brighter than H 15 at 2026-06-09, the rest
 *    anywhere back to 1927.
 *    Each mean anomaly is moved to the common `referenceJd` along its own mean motion,
 *    M_ref = M + n (referenceJd - epoch), so the GPU only ever adds n·Δt to it. Done in
 *    float64 because the step can be large: n·Δt is thousands of degrees for an orbit
 *    whose epoch is decades old, and float32 keeps seven digits.
 * 3. **What is left out.** Open orbits (e >= 1: SBDB's PAA and HYA classes), rows with
 *    an element or the magnitude missing, and the asteroids the catalog already draws as
 *    bodies of their own, from JPL's vectors -- so nothing is drawn twice.
 * 4. **Order.** By H, brightest first, so a prefix of the belt is a complete belt down to
 *    some magnitude; ties by SPK-ID, so two runs on the same data write the same bytes.
 *    Then split at BELT_TIER_LIMITS into one file per magnitude tier, so the app can load
 *    such a prefix a file at a time.
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
  return [...new Set(designations)].sort(compareDesignations);
}

/** Numbered designations in numeric order, the rest after them. */
function compareDesignations(p: string, q: string): number {
  return Number(p) - Number(q) || p.localeCompare(q);
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
 * step (2.4e-7 rad there) from the true angle, which is float32's own rounding, at the
 * point of the orbit where an error in M moves the asteroid least.
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

/**
 * The classes whose every member goes in the names index, named or not: the near-Earth
 * asteroids, which people look up by their provisional designations ("2024 YR4"), and the
 * centaurs and trans-Neptunian objects ("2015 BP519"). See BeltNames.
 */
const ALWAYS_NAMED_CLASSES: ReadonlySet<string> = new Set(['APO', 'ATE', 'AMO', 'IEO', 'CEN', 'TNO']);

/**
 * How the app names an asteroid, from SBDB's full name; see BeltNames.display.
 *
 *   "   433 Eros (A898 PA)"   ->  "433 Eros", and "A898 PA" to search on too
 *   "  4596 (1981 QB)"        ->  "4596 (1981 QB)"
 *   "       (2024 YR4)"       ->  "2024 YR4"
 */
export function beltDisplayName(
  fullName: string | null,
  designation: string,
): { readonly display: string; readonly designation: string | null } {
  const trimmed = (fullName ?? designation).trim();
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(trimmed);
  if (match === null) {
    return { display: trimmed, designation: null };
  }
  const head = match[1]!;
  const provisional = match[2]!;
  if (head === '') {
    return { display: provisional, designation: null };
  }
  if (/^\d+$/.test(head)) {
    return { display: trimmed, designation: null };
  }
  return { display: head, designation: provisional };
}

/** One tier as written: its entry in BeltInfo.tiers and its records. */
export interface BuiltTier {
  readonly tier: BeltTier;
  /** BELT_RECORD_FLOATS per asteroid: a view into BeltBuild.records. */
  readonly records: Float32Array;
}

/** What the build makes: the belt's description, its records, and what the log says. */
export interface BeltBuild {
  readonly info: BeltInfo;
  /** Every tier's records one after another, BELT_RECORD_FLOATS per asteroid. */
  readonly records: Float32Array;
  readonly tiers: readonly BuiltTier[];
  /** The search index, and the JSON it is written as -- BeltInfo.names counts its bytes. */
  readonly names: BeltNames;
  readonly namesJson: string;
  /** The excluded designations SBDB actually returned. */
  readonly excludedFound: readonly string[];
  /** Orbits whose SBDB epoch is more than STALE_EPOCH_YEARS from `referenceJd`. */
  readonly staleEpochs: number;
}

/**
 * How old an orbit's epoch has to be for the log to count it. Ten years, the planets'
 * window: past it, the drift measured above is a degree and growing.
 */
export const STALE_EPOCH_YEARS = 10;

/** What a finished belt is told that its pages could not know. */
export interface FinishBeltOptions {
  readonly queriedAt: string;
  /**
   * SBDB designations to leave out: those the run publishes as bodies. Each must be one
   * of the accumulator's `candidates`; see BeltAccumulator.
   */
  readonly excluded: readonly string[];
  /** Where the tiers split, H; see BELT_TIER_LIMITS. */
  readonly tierLimits: readonly number[];
}

/** An orbit packed but not yet placed: its record, and what it is sorted and counted by. */
interface PackedOrbit {
  readonly spkid: number;
  readonly h: number;
  readonly epochJd: number;
  readonly values: readonly number[];
  /** Its names, when it goes in the search index. */
  readonly label: { readonly display: string; readonly designation: string | null } | null;
}

/**
 * The belt, packed as its pages arrive.
 *
 * The whole catalogue is 1.58 million rows, and holding them as parsed objects until the
 * last page is in would cost the better part of a gigabyte. So each row is checked,
 * converted and packed into float32 the moment its page arrives -- 36 bytes, plus its H
 * and SPK-ID in float64 for the sort -- and the page itself is let go.
 *
 * Which asteroids the catalog draws as bodies is only settled once Horizons has answered
 * for them, long after SBDB has. So the pages put every `candidate` -- the catalog's
 * small bodies -- aside rather than in, and `finish` puts back any the run did not
 * publish after all: a small body Horizons failed on stays in the belt rather than
 * vanish from the sky.
 */
export class BeltAccumulator {
  readonly #referenceJd: number;
  readonly #candidates: ReadonlySet<string>;
  readonly #namesBrighterThan: number;
  readonly #classIndex = new Map<string, number>(BELT_CLASSES.map((code, index) => [code, index]));

  #count = 0;
  #records = new Float32Array(0);
  #h = new Float64Array(0);
  #spkid = new Float64Array(0);
  #epochMin = Infinity;
  #epochMax = -Infinity;
  #staleEpochs = 0;
  readonly #setAside: (PackedOrbit & { readonly designation: string })[] = [];
  readonly #unknownClasses = new Map<string, number>();
  #notElliptic = 0;
  #missingElements = 0;
  #noMagnitude = 0;
  // The search index's entries, by the slot their orbit was packed into.
  readonly #nameSlot: number[] = [];
  readonly #nameDisplay: string[] = [];
  readonly #nameDesignation: (string | null)[] = [];

  /**
   * `namesBrighterThan`: every asteroid brighter than this H goes in the search index by
   * its designation, named or not -- tier 0's limit, so everything drawn by default can
   * be found. See BeltNames for the rest of what goes in.
   */
  constructor(options: {
    readonly referenceJd: number;
    readonly candidates: readonly string[];
    readonly namesBrighterThan: number;
  }) {
    this.#referenceJd = options.referenceJd;
    this.#candidates = new Set(options.candidates);
    this.#namesBrighterThan = options.namesBrighterThan;
  }

  /** Room for `more` orbits, doubling, so a catalogue of pages costs a few copies. */
  #reserve(more: number): void {
    const needed = this.#count + more;
    if (needed <= this.#h.length) {
      return;
    }
    const capacity = Math.max(needed, this.#h.length * 2, 1024);
    const records = new Float32Array(capacity * BELT_RECORD_FLOATS);
    records.set(this.#records.subarray(0, this.#count * BELT_RECORD_FLOATS));
    const h = new Float64Array(capacity);
    h.set(this.#h.subarray(0, this.#count));
    const spkid = new Float64Array(capacity);
    spkid.set(this.#spkid.subarray(0, this.#count));
    this.#records = records;
    this.#h = h;
    this.#spkid = spkid;
  }

  #push(orbit: PackedOrbit): void {
    this.#reserve(1);
    if (orbit.label !== null) {
      this.#nameSlot.push(this.#count);
      this.#nameDisplay.push(orbit.label.display);
      this.#nameDesignation.push(orbit.label.designation);
    }
    this.#records.set(orbit.values, this.#count * BELT_RECORD_FLOATS);
    this.#h[this.#count] = orbit.h;
    this.#spkid[this.#count] = orbit.spkid;
    this.#count += 1;
    this.#epochMin = Math.min(this.#epochMin, orbit.epochJd);
    this.#epochMax = Math.max(this.#epochMax, orbit.epochJd);
    if (Math.abs(this.#referenceJd - orbit.epochJd) > STALE_EPOCH_YEARS * 365.25) {
      this.#staleEpochs += 1;
    }
  }

  /** One page of SBDB's rows. */
  add(rows: readonly SbdbRow[]): void {
    this.#reserve(rows.length);
    for (const row of rows) {
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
        meanMotionDegPerDay === null
      ) {
        // An orbit with an element missing is not guessed at: one in the whole catalogue,
        // 2002 PD153, a TNO SBDB gives with e = 0 and no mean anomaly, 2026-10-19.
        this.#missingElements += 1;
        continue;
      }
      if (h === null) {
        // Nor is a magnitude. 509 asteroids have an orbit and no H at all -- 1999 CB130,
        // 1935 UZ -- and H is what orders the belt, sorts it into tiers and sizes each
        // point on screen. How bright a body nobody has measured is, is not ours to pick,
        // so they are counted, apart from the incomplete orbits.
        this.#noMagnitude += 1;
        continue;
      }
      // Open orbits have no mean motion to propagate with: SBDB's parabolic and hyperbolic
      // "asteroids", five in the whole catalogue, 2024 U2 among them.
      if (!(e < 1) || !(aAu > 0)) {
        this.#notElliptic += 1;
        continue;
      }
      // The frame, checked rather than assumed: every row so far is J2000, and one that is
      // not would be in a different ecliptic.
      if (row.equinox !== 'J2000') {
        throw new Error(
          `SBDB gives ${row.designation} in equinox ${String(row.equinox)}, not J2000.`,
        );
      }
      const code = row.orbitClass === null ? undefined : this.#classIndex.get(row.orbitClass);
      if (code === undefined) {
        const key = String(row.orbitClass);
        this.#unknownClasses.set(key, (this.#unknownClasses.get(key) ?? 0) + 1);
        continue;
      }
      const named =
        row.name !== null ||
        ALWAYS_NAMED_CLASSES.has(row.orbitClass!) ||
        h < this.#namesBrighterThan;
      const orbit: PackedOrbit = {
        spkid: row.spkid,
        h,
        epochJd,
        label: named ? beltDisplayName(row.fullName, row.designation) : null,
        values: [
          aAu * AU_KM,
          e,
          iDeg * DEG,
          wrapRadians(nodeDeg * DEG),
          wrapRadians(periDeg * DEG),
          storedMeanAnomaly(
            meanAnomalyAt(meanAnomalyDeg, meanMotionDegPerDay, epochJd, this.#referenceJd),
          ),
          meanMotionDegPerDay * DEG,
          h,
          code,
        ],
      };
      if (this.#candidates.has(row.designation)) {
        this.#setAside.push({ ...orbit, designation: row.designation });
      } else {
        this.#push(orbit);
      }
    }
  }

  /** The belt: sorted, split into tiers and described. */
  finish(options: FinishBeltOptions): BeltBuild {
    // Every class SBDB documents for asteroids is in BELT_CLASSES (sbdb_filter.html,
    // "Orbit Classes"). A code outside them means JPL changed its classification, and
    // lumping it into AST -- "orbit not matching any defined class" -- would be saying
    // something false about it. So the run stops and says what it saw.
    if (this.#unknownClasses.size > 0) {
      const seen = [...this.#unknownClasses]
        .map(([code, count]) => `${code} x${count}`)
        .join(', ');
      throw new Error(
        `SBDB returned orbit classes the belt does not know: ${seen}. Add them to BELT_CLASSES.`,
      );
    }
    const excluded = new Set(options.excluded);
    for (const designation of excluded) {
      if (!this.#candidates.has(designation)) {
        throw new Error(`${designation} is excluded from the belt but was never set aside.`);
      }
    }
    const excludedFound: string[] = [];
    for (const orbit of this.#setAside) {
      if (excluded.has(orbit.designation)) {
        excludedFound.push(orbit.designation);
      } else {
        this.#push(orbit);
      }
    }
    const count = this.#count;
    if (count === 0) {
      throw new Error('No asteroid survived the belt build.');
    }

    // By H, brightest first, and equal H by SPK-ID, so two runs on the same data write the
    // same bytes. An index is sorted rather than the records, which move once, below.
    const h = this.#h;
    const spkid = this.#spkid;
    const order = new Uint32Array(count);
    for (let index = 0; index < count; index += 1) {
      order[index] = index;
    }
    order.sort((p, q) => h[p]! - h[q]! || spkid[p]! - spkid[q]!);

    const packed = this.#records;
    const records = new Float32Array(count * BELT_RECORD_FLOATS);
    const classCounts = new Map<BeltClass, number>();
    for (let index = 0; index < count; index += 1) {
      const from = order[index]! * BELT_RECORD_FLOATS;
      records.set(packed.subarray(from, from + BELT_RECORD_FLOATS), index * BELT_RECORD_FLOATS);
      const orbitClass = BELT_CLASSES[packed[from + 8]!]!;
      classCounts.set(orbitClass, (classCounts.get(orbitClass) ?? 0) + 1);
    }

    // The tiers are runs of the sorted belt: tier k holds limits[k-1] <= H < limits[k],
    // open at both ends. Compared in float64 on SBDB's own H, not on the record's float32.
    const tiers: BuiltTier[] = [];
    let start = 0;
    for (let k = 0; k <= options.tierLimits.length; k += 1) {
      const faintestH = options.tierLimits[k] ?? null;
      let end = start;
      while (end < count && (faintestH === null || h[order[end]!]! < faintestH)) {
        end += 1;
      }
      const tierRecords = records.subarray(start * BELT_RECORD_FLOATS, end * BELT_RECORD_FLOATS);
      tiers.push({
        tier: {
          file: beltTierFile(k),
          count: end - start,
          bytes: tierRecords.byteLength,
          brightestH: k === 0 ? null : options.tierLimits[k - 1]!,
          faintestH,
        },
        records: tierRecords,
      });
      start = end;
    }

    // The search index: each entry's slot, where its orbit was packed, turned into the
    // tier and record its orbit was sorted to.
    const position = new Uint32Array(count);
    for (let index = 0; index < count; index += 1) {
      position[order[index]!] = index;
    }
    const tierStarts = tiers.map(({ records }) => records.byteOffset / 4 / BELT_RECORD_FLOATS);
    const entries = this.#nameSlot.map((slot, k) => ({ k, slot, at: position[slot]! }));
    entries.sort((p, q) => p.at - q.at);
    const tierOf = (at: number): number => {
      let tier = tierStarts.length - 1;
      while (tierStarts[tier]! > at) {
        tier -= 1;
      }
      return tier;
    };
    const names: BeltNames = {
      count: entries.length,
      display: entries.map(({ k }) => this.#nameDisplay[k]!),
      designation: entries.map(({ k }) => this.#nameDesignation[k]!),
      tier: entries.map(({ at }) => tierOf(at)),
      index: entries.map(({ at }) => at - tierStarts[tierOf(at)]!),
      classIndex: entries.map(({ slot }) => packed[slot * BELT_RECORD_FLOATS + 8]!),
    };
    const namesJson = `${JSON.stringify(names)}\n`;

    const info: BeltInfo = {
      source: {
        name: 'JPL Small-Body Database (SBDB) Query API',
        url: SBDB_QUERY_API_URL,
        queriedAt: options.queriedAt,
      },
      file: tiers[0]!.tier.file,
      count,
      tiers: tiers.map((built) => built.tier),
      recordFloats: BELT_RECORD_FLOATS,
      // The faintest H written, as BeltInfo defines it: with no limit on the query, the
      // catalogue's own faintest; with one, the faintest just inside it.
      magnitudeLimit: h[order[count - 1]!]!,
      referenceJd: this.#referenceJd,
      elementEpochs: { minJd: this.#epochMin, maxJd: this.#epochMax },
      classes: [...BELT_CLASSES],
      // In code order, so the file reads the same way the classes do.
      classCounts: Object.fromEntries(
        BELT_CLASSES.filter((code) => classCounts.has(code)).map((code) => [
          code,
          classCounts.get(code)!,
        ]),
      ),
      excluded: [...options.excluded],
      dropped: {
        notElliptic: this.#notElliptic,
        missingElements: this.#missingElements,
        noMagnitude: this.#noMagnitude,
      },
      names: {
        file: BELT_NAMES_FILE,
        count: names.count,
        bytes: Buffer.byteLength(namesJson, 'utf8'),
      },
    };

    return {
      info,
      records,
      tiers,
      names,
      namesJson,
      excludedFound: excludedFound.sort(compareDesignations),
      staleEpochs: this.#staleEpochs,
    };
  }
}

export interface BuildBeltInput extends FinishBeltOptions {
  readonly rows: readonly SbdbRow[];
  /** TDB Julian day every mean anomaly is moved to. */
  readonly referenceJd: number;
}

/** Tier 0's limit: every asteroid in it goes in the search index. */
function firstTierLimit(tierLimits: readonly number[]): number {
  return tierLimits[0] ?? Infinity;
}

/** The belt from rows already in hand: one page, finished at once. */
export function buildBelt(input: BuildBeltInput): BeltBuild {
  const accumulator = new BeltAccumulator({
    referenceJd: input.referenceJd,
    candidates: input.excluded,
    namesBrighterThan: firstTierLimit(input.tierLimits),
  });
  accumulator.add(input.rows);
  return accumulator.finish(input);
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

/** A tier's H range, for the log. */
function describeRange(tier: BeltTier): string {
  if (tier.brightestH === null) {
    return tier.faintestH === null ? 'every H' : `H < ${tier.faintestH}`;
  }
  return tier.faintestH === null
    ? `H >= ${tier.brightestH}`
    : `${tier.brightestH} <= H < ${tier.faintestH}`;
}

/** The lines a run logs about its belt. */
export function describeBelt(build: BeltBuild): string[] {
  const { info } = build;
  const classes = Object.entries(info.classCounts)
    .map(([code, count]) => `${code} ${count}`)
    .join(', ');
  const day = (jd: number) => fromJulianDay(jd).toISOString().slice(0, 10);
  return [
    `[belt] ${info.count} asteroids, the faintest at H ${info.magnitudeLimit}: ${classes}`,
    ...build.tiers.map(
      ({ tier }) =>
        `[belt]   ${tier.file}  ${describeRange(tier).padEnd(13)} ` +
        `${String(tier.count).padStart(8)} asteroids, ${(tier.bytes / 1e6).toFixed(1)} MB`,
    ),
    `[belt] elements from ${day(info.elementEpochs.minJd)} to ${day(info.elementEpochs.maxJd)}, ` +
      `moved to JD ${info.referenceJd} TDB; ${build.staleEpochs} are more than ` +
      `${STALE_EPOCH_YEARS} years from it`,
    `[belt] left out: ${build.excludedFound.length} drawn as bodies (${build.excludedFound.join(', ')}), ` +
      `${info.dropped.notElliptic} not elliptic, ${info.dropped.missingElements} missing an element, ` +
      `${info.dropped.noMagnitude ?? 0} with no H`,
  ];
}
