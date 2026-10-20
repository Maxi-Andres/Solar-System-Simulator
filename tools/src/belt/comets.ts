import { AU_KM, COMETS_FILE, SBDB_QUERY_API_URL } from '../config.ts';
import { fromJulianDay } from '../horizons/queries.ts';
import {
  COMET_CLASSES,
  COMET_RECORD_FLOATS,
  type CometClass,
  type CometInfo,
} from '../types.ts';
import { wrapRadians } from './buildBelt.ts';
import { numberOrNull, querySbdb, readSbdbTable, stringOrNull } from './sbdb.ts';

/**
 * The comets, from SBDB's comet rows to the file the app reads: see CometInfo and
 * COMET_RECORD_FLOATS in types.ts for the format.
 *
 * Same source and frame as the belt -- the SBDB Query API, heliocentric ecliptic J2000 --
 * but not the same elements. Of the 4,080 comets SBDB held on 2026-10-19, 1,763 are on
 * parabolic orbits (e = 1 exactly, the orbit fit's assumption for a comet seen too
 * briefly to tell) and 520 on hyperbolic ones, up to e = 6.14 for 3I/ATLAS, C/2025 N1. For
 * those a semi-major axis and a mean anomaly do not exist, so the record carries what every
 * conic has: the perihelion distance q and the time of perihelion tp.
 *
 * **What two-body costs a comet** is more than it costs an asteroid. On top of the
 * planets' pull, which the belt's accuracy statement measures, a comet is pushed by the
 * gas it sheds near the Sun: the non-gravitational forces JPL fits as A1, A2, A3 for the
 * comets well enough observed, and which no conic can follow. Measured against Horizons
 * in the README.
 *
 * **What is left out.** D/ comets, which the IAU designates as no longer existing or lost:
 * a body propagated from its last orbit would be drawn where none is. Rows with an element
 * missing. The famous comets the run draws as bodies of their own, from Horizons' vectors
 * (famousComets.ts): they are `excluded`, as the named asteroids are from the belt, so
 * none is drawn twice. Nothing else: every fragment SBDB designates -- 73P-B, 73P-C and
 * the seventy more of Schwassmann-Wachmann 3 -- is a body with its own orbit, and is kept.
 */

const DEG = Math.PI / 180;

/** The fields asked for. */
export const COMET_FIELDS = [
  'spkid',
  'pdes',
  'full_name',
  'prefix',
  'q',
  'e',
  'i',
  'om',
  'w',
  'tp',
  'epoch',
  'M1',
  'K1',
  'class',
  'equinox',
] as const;

/** One comet as SBDB returned it. Null where SBDB has none. */
export interface CometRow {
  readonly spkid: number;
  /** Primary designation: '1P', '1995 O1', '73P-B'. */
  readonly designation: string;
  /** SBDB's full name, padded as it sends it: "    1P/Halley". */
  readonly fullName: string | null;
  /** P periodic, C non-periodic, D defunct (and X, I, A, which SBDB has none of today). */
  readonly prefix: string | null;
  readonly qAu: number | null;
  readonly e: number | null;
  readonly iDeg: number | null;
  readonly nodeDeg: number | null;
  readonly periDeg: number | null;
  /** Time of perihelion passage, Julian day TDB. */
  readonly tpJd: number | null;
  readonly epochJd: number | null;
  readonly m1: number | null;
  readonly k1: number | null;
  readonly orbitClass: string | null;
  readonly equinox: string | null;
}

/** Every comet, in one request: 4,080 rows are 1.2 MB and come back in 4.5 s. */
export function cometQuery(): Record<string, string> {
  return {
    fields: COMET_FIELDS.join(','),
    'sb-kind': 'c',
    sort: 'spkid',
    'full-prec': 'true',
  };
}

export function parseCometResponse(body: unknown): { count: number; rows: CometRow[] } {
  const table = readSbdbTable(body, COMET_FIELDS);
  const rows = table.rows.map((raw, position): CometRow => {
    const designation = stringOrNull(table.at(raw, 'pdes'));
    const spkid = numberOrNull(table.at(raw, 'spkid'), 'spkid', `comet row ${position}`);
    if (designation === null || spkid === null) {
      throw new Error(`SBDB comet row ${position} has no designation or SPK-ID.`);
    }
    const number = (field: (typeof COMET_FIELDS)[number]) =>
      numberOrNull(table.at(raw, field), field, designation);
    return {
      spkid,
      designation,
      fullName: stringOrNull(table.at(raw, 'full_name')),
      prefix: stringOrNull(table.at(raw, 'prefix')),
      qAu: number('q'),
      e: number('e'),
      iDeg: number('i'),
      nodeDeg: number('om'),
      periDeg: number('w'),
      tpJd: number('tp'),
      epochJd: number('epoch'),
      m1: number('M1'),
      k1: number('K1'),
      orbitClass: stringOrNull(table.at(raw, 'class')),
      equinox: stringOrNull(table.at(raw, 'equinox')),
    };
  });
  return { count: table.count, rows };
}

/** Every comet SBDB has, and when it was asked. */
export async function fetchComets(): Promise<{ rows: CometRow[]; queriedAt: string }> {
  const queriedAt = new Date().toISOString();
  const page = await querySbdb(cometQuery(), 'comets', parseCometResponse);
  // No limit was asked for, so a short answer is a truncated one.
  if (page.rows.length !== page.count || page.count === 0) {
    throw new Error(`SBDB returned ${page.rows.length} comets where it counted ${page.count}.`);
  }
  return { rows: page.rows, queriedAt };
}

/** The comets as written: their description and their records. */
export interface CometBuild {
  readonly info: CometInfo;
  readonly records: Float32Array;
}

export function buildComets(input: {
  readonly rows: readonly CometRow[];
  readonly queriedAt: string;
  readonly referenceJd: number;
  /**
   * SBDB designations of the comets drawn as bodies, left out here: see
   * cometDesignations in famousComets.ts.
   */
  readonly excluded: readonly string[];
}): CometBuild {
  const classIndex = new Map<string, number>(COMET_CLASSES.map((code, index) => [code, index]));
  const unknownClasses = new Map<string, number>();
  let missingElements = 0;
  let defunct = 0;
  const excluded = new Set(input.excluded);
  const excludedFound = new Set<string>();
  const comets: {
    spkid: number;
    m1: number;
    epochJd: number;
    name: string;
    values: number[];
  }[] = [];

  for (const row of input.rows) {
    if (excluded.has(row.designation)) {
      excludedFound.add(row.designation);
      continue;
    }
    if (row.prefix === 'D') {
      defunct += 1;
      continue;
    }
    const { qAu, e, iDeg, nodeDeg, periDeg, tpJd, epochJd } = row;
    if (
      qAu === null ||
      e === null ||
      iDeg === null ||
      nodeDeg === null ||
      periDeg === null ||
      tpJd === null ||
      epochJd === null ||
      !(qAu > 0) ||
      !(e >= 0)
    ) {
      missingElements += 1;
      continue;
    }
    if (row.equinox !== 'J2000') {
      throw new Error(`SBDB gives ${row.designation} in equinox ${String(row.equinox)}, not J2000.`);
    }
    const code = row.orbitClass === null ? undefined : classIndex.get(row.orbitClass);
    if (code === undefined) {
      const key = String(row.orbitClass);
      unknownClasses.set(key, (unknownClasses.get(key) ?? 0) + 1);
      continue;
    }
    comets.push({
      spkid: row.spkid,
      // NaN sorts last below, and is what the record says for "unknown".
      m1: row.m1 ?? NaN,
      epochJd,
      name: (row.fullName ?? row.designation).trim(),
      values: [
        qAu * AU_KM,
        e,
        iDeg * DEG,
        wrapRadians(nodeDeg * DEG),
        wrapRadians(periDeg * DEG),
        // Relative, and subtracted in float64, so float32 keeps minutes of it.
        tpJd - input.referenceJd,
        row.m1 ?? NaN,
        row.k1 ?? NaN,
        code,
      ],
    });
  }

  // As for the belt: a class code SBDB has not documented is not ours to rename.
  if (unknownClasses.size > 0) {
    const seen = [...unknownClasses].map(([code, count]) => `${code} x${count}`).join(', ');
    throw new Error(
      `SBDB returned comet classes the app does not know: ${seen}. Add them to COMET_CLASSES.`,
    );
  }
  if (comets.length === 0) {
    throw new Error('No comet survived the build.');
  }
  // A designation that matched nothing would leave its comet in the cloud and drawn twice
  // -- SBDB renamed it, or the catalog has it wrong. As for the belt, the run stops.
  const missing = [...excluded].filter((designation) => !excludedFound.has(designation));
  if (missing.length > 0) {
    throw new Error(
      `Comets excluded from the cloud but not among SBDB's: ${missing.join(', ')}.`,
    );
  }

  // Brightest first, the comets with no M1 after every comet with one; equal by SPK-ID.
  comets.sort((p, q) => {
    const pKnown = !Number.isNaN(p.m1);
    const qKnown = !Number.isNaN(q.m1);
    if (pKnown !== qKnown) {
      return pKnown ? -1 : 1;
    }
    return (pKnown ? p.m1 - q.m1 : 0) || p.spkid - q.spkid;
  });

  const records = new Float32Array(comets.length * COMET_RECORD_FLOATS);
  const classCounts = new Map<CometClass, number>();
  let minJd = Infinity;
  let maxJd = -Infinity;
  for (const [index, comet] of comets.entries()) {
    records.set(comet.values, index * COMET_RECORD_FLOATS);
    const cometClass = COMET_CLASSES[comet.values[8]!]!;
    classCounts.set(cometClass, (classCounts.get(cometClass) ?? 0) + 1);
    minJd = Math.min(minJd, comet.epochJd);
    maxJd = Math.max(maxJd, comet.epochJd);
  }

  const info: CometInfo = {
    source: {
      name: 'JPL Small-Body Database (SBDB) Query API',
      url: SBDB_QUERY_API_URL,
      queriedAt: input.queriedAt,
    },
    file: COMETS_FILE,
    count: comets.length,
    bytes: records.byteLength,
    recordFloats: COMET_RECORD_FLOATS,
    referenceJd: input.referenceJd,
    elementEpochs: { minJd, maxJd },
    classes: [...COMET_CLASSES],
    classCounts: Object.fromEntries(
      COMET_CLASSES.filter((code) => classCounts.has(code)).map((code) => [
        code,
        classCounts.get(code)!,
      ]),
    ),
    names: comets.map((comet) => comet.name),
    excluded: [...excludedFound].sort(),
    dropped: { missingElements, defunct },
  };
  return { info, records };
}

/** The lines a run logs about its comets. */
export function describeComets(build: CometBuild): string[] {
  const { info } = build;
  const classes = Object.entries(info.classCounts)
    .map(([code, count]) => `${code} ${count}`)
    .join(', ');
  const day = (jd: number) => fromJulianDay(jd).toISOString().slice(0, 10);
  return [
    `[belt] ${info.count} comets, ${(info.bytes / 1e3).toFixed(0)} KB: ${classes}`,
    `[belt] comet elements from ${day(info.elementEpochs.minJd)} to ` +
      `${day(info.elementEpochs.maxJd)}; left out ${info.dropped.defunct} defunct (D/), ` +
      `${info.dropped.missingElements} missing an element, ` +
      `${info.excluded?.length ?? 0} drawn as bodies (${(info.excluded ?? []).join(', ')})`,
  ];
}
