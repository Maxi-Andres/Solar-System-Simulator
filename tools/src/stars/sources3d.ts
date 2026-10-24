import {
  GAIA_DR3_GAIA_ARCHIVE_TABLE,
  GAIA_DR3_VIZIER_TABLE,
  GAIA_HIPPARCOS2_CROSSMATCH_TABLE,
  GCNS_GAIA_ARCHIVE_TABLE,
  GCNS_VIZIER_TABLE,
  HIPPARCOS2_GAIA_ARCHIVE_TABLE,
  HIPPARCOS2_VIZIER_TABLE,
  STAR3D_BRIGHT_GAIA_LIMIT,
  STAR3D_PARALLAX_SNR,
} from '../config.ts';
import {
  gaiaSourceIdPages,
  optionalNumber,
  parseCsvTable,
  readWithFallback,
  type TapRead,
  type TapService,
} from './tap.ts';
import { GAIA_ARCHIVE, VIZIER } from './vizier.ts';

/**
 * The three catalogues the 3D stars are read from, each from either of two services.
 *
 * Here the order is the other way round from the sky's: the **ESA Gaia Archive first**,
 * VizieR second. It is Gaia's home, and the only service with what makes the read cheap
 * and exact -- Gaia DR3's own Hipparcos cross-match table, and DR3's radial velocities
 * joined to the nearby-stars census in the same query. VizieR holds every table needed
 * to do without both, at the cost noted on each fallback below.
 *
 * Every query renames its columns to one set of names, so one parser per dataset reads
 * either service's answer. Gaia tables are read in twelve pages by source_id (see
 * gaiaSourceIdPages): each well under the Gaia Archive's one-minute limit for a
 * synchronous query -- the bright set in one piece took 56 s of it -- and each held in
 * memory alone while it is parsed.
 *
 * Numbers missing from a row are NaN here rather than null, and the big catalogue is held
 * in typed columns rather than an object per star (see GcnsTable): the machines this runs
 * on are not generous with memory.
 */

/**
 * The Gaia Catalogue of Nearby Stars, with DR3's radial velocities, column by column.
 *
 * Typed arrays rather than an object per star: 331,312 objects of fourteen numbers held
 * 126 MB of heap; these columns hold 30. Entry k of every column is star k. Missing
 * values are NaN, and 0 in the integer columns.
 */
export interface GcnsTable {
  readonly count: number;
  /** Gaia DR3 source_id -- EDR3's, which DR3 kept unchanged: 64 bits. */
  readonly sourceId: BigUint64Array;
  /** ICRS position at Gaia's epoch, J2016.0, degrees. */
  readonly raDeg: Float64Array;
  readonly decDeg: Float64Array;
  readonly parallaxMas: Float64Array;
  readonly parallaxErrorMas: Float64Array;
  readonly pmRaMasPerYear: Float64Array;
  readonly pmDecMasPerYear: Float64Array;
  /** Gaia G, BP and RP magnitudes. */
  readonly g: Float32Array;
  readonly bp: Float32Array;
  readonly rp: Float32Array;
  /** Median of the GCNS distance posterior, parsecs (published in kpc). */
  readonly dist50Pc: Float32Array;
  /** Gaia DR3 radial velocity and its error, km/s. */
  readonly rvKmS: Float32Array;
  readonly rvErrorKmS: Float32Array;
  /** HIP number by Gaia DR3's own cross-match; 0 where none, or where it was not read. */
  readonly hip: Uint32Array;
}

const GCNS_FLOAT64 = [
  'raDeg',
  'decDeg',
  'parallaxMas',
  'parallaxErrorMas',
  'pmRaMasPerYear',
  'pmDecMasPerYear',
] as const;
const GCNS_FLOAT32 = ['g', 'bp', 'rp', 'dist50Pc', 'rvKmS', 'rvErrorKmS'] as const;

/** An empty table with room for `count` stars. */
export function allocateGcns(count: number): GcnsTable {
  return {
    count,
    sourceId: new BigUint64Array(count),
    raDeg: new Float64Array(count),
    decDeg: new Float64Array(count),
    parallaxMas: new Float64Array(count),
    parallaxErrorMas: new Float64Array(count),
    pmRaMasPerYear: new Float64Array(count),
    pmDecMasPerYear: new Float64Array(count),
    g: new Float32Array(count),
    bp: new Float32Array(count),
    rp: new Float32Array(count),
    dist50Pc: new Float32Array(count),
    rvKmS: new Float32Array(count),
    rvErrorKmS: new Float32Array(count),
    hip: new Uint32Array(count),
  };
}

/** Copies the first `count` stars of each table, in order, into one. */
export function concatGcns(pages: readonly GcnsTable[], counts = pages.map((page) => page.count)): GcnsTable {
  const table = allocateGcns(counts.reduce((total, count) => total + count, 0));
  let offset = 0;
  pages.forEach((page, index) => {
    const count = counts[index]!;
    table.sourceId.set(page.sourceId.subarray(0, count), offset);
    table.hip.set(page.hip.subarray(0, count), offset);
    for (const column of GCNS_FLOAT64) {
      table[column].set(page[column].subarray(0, count), offset);
    }
    for (const column of GCNS_FLOAT32) {
      table[column].set(page[column].subarray(0, count), offset);
    }
    offset += count;
  });
  return table;
}

/** One Hipparcos star's parallax in the new reduction. */
export interface Hipparcos2Row {
  readonly hip: number;
  readonly parallaxMas: number;
  readonly parallaxErrorMas: number;
  /** The reduction's solution type: 5 a single star, others a binary or worse. */
  readonly solutionType: number;
}

/** One bright Gaia DR3 source, for matching the sky catalogue to Gaia. */
export interface BrightGaiaRow {
  readonly sourceId: string;
  /** ICRS position at J2016.0, degrees. */
  readonly raDeg: number;
  readonly decDeg: number;
  /** NaN for a two-parameter solution, which has no parallax or proper motion. */
  readonly parallaxMas: number;
  readonly parallaxErrorMas: number;
  readonly pmRaMasPerYear: number;
  readonly pmDecMasPerYear: number;
  readonly ruwe: number;
  readonly rvKmS: number;
  readonly rvErrorKmS: number;
  readonly g: number;
  /** HIP number by Gaia DR3's cross-match; 0 where none or not read (VizieR). */
  readonly hip: number;
}

function numberOrNaN(value: number | null): number {
  return value === null ? Number.NaN : value;
}

/** A required identifier column: a source_id must be there and must be digits. */
function sourceIdOf(raw: string | undefined, label: string): string {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new Error(`${label}: source_id is not an integer: "${raw ?? ''}"`);
  }
  return raw;
}

function requiredNumber(raw: string | undefined, column: string, label: string): number {
  const value = optionalNumber(raw, column, label);
  if (value === null) {
    throw new Error(`${label}: column "${column}" is empty, and the query required it.`);
  }
  return value;
}

/** `native AS "name"` for each pair, so both services answer with the same header. */
function select(columns: Readonly<Record<string, string>>): string {
  return Object.entries(columns)
    .map(([name, native]) => `${native} AS "${name}"`)
    .join(', ');
}

// ---------------------------------------------------------------- GCNS

const GCNS_COLUMNS = [
  'source_id',
  'ra',
  'dec',
  'parallax',
  'parallax_error',
  'pmra',
  'pmdec',
  'g',
  'bp',
  'rp',
  'dist_50',
];

/**
 * The GCNS on the Gaia Archive, with Gaia DR3's radial velocity and HIP cross-match
 * joined in. LEFT joins: a star with neither keeps its row.
 *
 * **The catalogue as the authors published it, uncut.** Its own selection is p >= 0.38
 * on their random-forest probability that the astrometry is reliable (the optimum of
 * their ROC: sensitivity 0.9986, specificity 0.9991) and a 1st-percentile distance
 * within 100 pc (paper, Sect. 2.1 and 2.3). That keeps the stars that only *may* be
 * inside -- about 9% are probably just beyond, which for a census is contamination and
 * for a map is not: each is drawn where its own parallax puts it. The paper's clean
 * sample (dist_50 < 100 pc, Sect. 3) is published as a flag instead, so the app can
 * draw the 100-pc boundary honestly.
 */
export function gcnsGaiaArchivePages(): string[] {
  const columns = select({
    source_id: 'c.source_id',
    ra: 'c.ra',
    dec: 'c.dec',
    parallax: 'c.parallax',
    parallax_error: 'c.parallax_error',
    pmra: 'c.pmra',
    pmdec: 'c.pmdec',
    g: 'c.phot_g_mean_mag',
    bp: 'c.phot_bp_mean_mag',
    rp: 'c.phot_rp_mean_mag',
    dist_50: 'c.dist_50',
    rv: 's.radial_velocity',
    rv_error: 's.radial_velocity_error',
    hip: 'x.original_ext_source_id',
  });
  return gaiaSourceIdPages('c.source_id').map(
    (range) =>
      `SELECT ${columns} FROM ${GCNS_GAIA_ARCHIVE_TABLE} AS c ` +
      `LEFT OUTER JOIN ${GAIA_DR3_GAIA_ARCHIVE_TABLE} AS s ON s.source_id = c.source_id ` +
      `LEFT OUTER JOIN ${GAIA_HIPPARCOS2_CROSSMATCH_TABLE} AS x ON x.source_id = c.source_id ` +
      `WHERE ${range}`,
  );
}

/**
 * The same catalogue on VizieR, as its authors deposited it at CDS. No join: the radial
 * velocities come in a second read (gaiaDr3VizierRvPages), and the HIP numbers not at
 * all -- names are then matched by Gaia id and position instead (see names3d.ts).
 */
export function gcnsVizierPages(): string[] {
  const columns = select({
    source_id: 'GaiaEDR3',
    // Quoted: VizieR resolves names without regard to case, and this table also has the
    // Gunn g magnitude, "gmag", which an unquoted Gmag is ambiguous with.
    ra: 'RA_ICRS',
    dec: 'DE_ICRS',
    parallax: 'Plx',
    parallax_error: 'e_Plx',
    pmra: 'pmRA',
    pmdec: 'pmDE',
    g: '"Gmag"',
    bp: '"BPmag"',
    rp: '"RPmag"',
    dist_50: 'Dist50',
  });
  return gaiaSourceIdPages('GaiaEDR3').map(
    (range) => `SELECT ${columns} FROM "${GCNS_VIZIER_TABLE}" WHERE ${range}`,
  );
}

/**
 * Gaia DR3's radial velocities for every source with a parallax over 8 mas -- the
 * sample the GCNS itself was selected from, so it holds every GCNS star DR3 measured.
 */
export function gaiaDr3VizierRvPages(): string[] {
  const columns = select({ source_id: 'Source', rv: 'RV', rv_error: 'e_RV' });
  return gaiaSourceIdPages('Source').map(
    (range) =>
      `SELECT ${columns} FROM "${GAIA_DR3_VIZIER_TABLE}" ` +
      `WHERE Plx > 8 AND RV IS NOT NULL AND ${range}`,
  );
}

/** One page of the GCNS as a table; a source the join returned twice is kept once. */
export function parseGcnsCsv(csv: string): GcnsTable {
  const parsed = parseCsvTable(csv, GCNS_COLUMNS);
  const table = allocateGcns(parsed.rows.length);
  const seen = new Set<string>();
  let k = 0;
  for (const row of parsed.rows) {
    const sourceId = sourceIdOf(parsed.at(row, 'source_id'), 'GCNS');
    // A source two Hipparcos entries both chose as their best neighbour comes back
    // twice from the join; it is one star.
    if (seen.has(sourceId)) {
      continue;
    }
    seen.add(sourceId);
    const label = `GCNS ${sourceId}`;
    const number = (column: string): number =>
      numberOrNaN(optionalNumber(parsed.at(row, column), column, label));
    table.sourceId[k] = BigInt(sourceId);
    table.raDeg[k] = requiredNumber(parsed.at(row, 'ra'), 'ra', label);
    table.decDeg[k] = requiredNumber(parsed.at(row, 'dec'), 'dec', label);
    table.parallaxMas[k] = requiredNumber(parsed.at(row, 'parallax'), 'parallax', label);
    table.parallaxErrorMas[k] = requiredNumber(parsed.at(row, 'parallax_error'), 'parallax_error', label);
    table.pmRaMasPerYear[k] = requiredNumber(parsed.at(row, 'pmra'), 'pmra', label);
    table.pmDecMasPerYear[k] = requiredNumber(parsed.at(row, 'pmdec'), 'pmdec', label);
    table.g[k] = number('g');
    table.bp[k] = number('bp');
    table.rp[k] = number('rp');
    table.dist50Pc[k] = number('dist_50') * 1000;
    table.rvKmS[k] = parsed.has('rv') ? number('rv') : Number.NaN;
    table.rvErrorKmS[k] = parsed.has('rv_error') ? number('rv_error') : Number.NaN;
    table.hip[k] = parsed.has('hip') ? (optionalNumber(parsed.at(row, 'hip'), 'hip', label) ?? 0) : 0;
    k += 1;
  }
  return k === table.count ? table : concatGcns([table], [k]);
}

export interface RadialVelocityRow {
  readonly sourceId: string;
  readonly rvKmS: number;
  readonly rvErrorKmS: number;
}

export function parseRadialVelocityCsv(csv: string): RadialVelocityRow[] {
  const table = parseCsvTable(csv, ['source_id', 'rv', 'rv_error']);
  return table.rows.map((row) => {
    const sourceId = sourceIdOf(table.at(row, 'source_id'), 'Gaia DR3 RV');
    const label = `Gaia DR3 ${sourceId}`;
    return {
      sourceId,
      rvKmS: requiredNumber(table.at(row, 'rv'), 'rv', label),
      rvErrorKmS: numberOrNaN(optionalNumber(table.at(row, 'rv_error'), 'rv_error', label)),
    };
  });
}

export interface GcnsRead {
  readonly table: GcnsTable;
  readonly service: TapService;
  readonly tableName: string;
  /** Where the radial velocities came from: joined in, or read on their own from VizieR. */
  readonly radialVelocities: { readonly table: string; readonly via: string; readonly rows: number };
}

function countFinite(values: Float32Array): number {
  let count = 0;
  for (const value of values) {
    if (Number.isFinite(value)) {
      count += 1;
    }
  }
  return count;
}

/**
 * The GCNS, with radial velocities, from whichever service answers.
 *
 * On the VizieR route the velocities are a second read of Gaia DR3 (288,288 stars with
 * a parallax over 8 mas and a radial velocity), merged by source_id as each page comes.
 * If that second read fails the run does not: the stars keep their proper motions, are
 * flagged as having no radial velocity, and the output's sources say so.
 */
export async function fetchGcns(): Promise<GcnsRead> {
  const read = await readWithFallback<GcnsTable>(
    [
      {
        service: GAIA_ARCHIVE,
        table: `${GCNS_GAIA_ARCHIVE_TABLE} + ${GAIA_DR3_GAIA_ARCHIVE_TABLE}`,
        pages: gcnsGaiaArchivePages(),
        parse: (csv) => [parseGcnsCsv(csv)],
      },
      {
        service: VIZIER,
        table: GCNS_VIZIER_TABLE,
        pages: gcnsVizierPages(),
        parse: (csv) => [parseGcnsCsv(csv)],
      },
    ],
    'GCNS',
  );
  const table = concatGcns(read.rows);
  const base = { table, service: read.service, tableName: read.table };
  if (read.service === GAIA_ARCHIVE) {
    return {
      ...base,
      radialVelocities: {
        table: GAIA_DR3_GAIA_ARCHIVE_TABLE,
        via: GAIA_ARCHIVE.url,
        rows: countFinite(table.rvKmS),
      },
    };
  }

  try {
    const position = new Map<bigint, number>();
    table.sourceId.forEach((id, index) => position.set(id, index));
    await readWithFallback(
      [
        {
          service: VIZIER,
          table: GAIA_DR3_VIZIER_TABLE,
          pages: gaiaDr3VizierRvPages(),
          parse: (csv) => {
            for (const row of parseRadialVelocityCsv(csv)) {
              const index = position.get(BigInt(row.sourceId));
              if (index !== undefined) {
                table.rvKmS[index] = row.rvKmS;
                table.rvErrorKmS[index] = row.rvErrorKmS;
              }
            }
            return [];
          },
        },
      ],
      'Gaia DR3 radial velocities',
    );
    return {
      ...base,
      radialVelocities: { table: GAIA_DR3_VIZIER_TABLE, via: VIZIER.url, rows: countFinite(table.rvKmS) },
    };
  } catch (error) {
    // A page that failed may follow pages already merged: wipe them, so the stars have
    // all of DR3's velocities or none -- never a sample of them.
    table.rvKmS.fill(Number.NaN);
    table.rvErrorKmS.fill(Number.NaN);
    console.error(
      `[stars] Gaia DR3 radial velocities: FAILED, proper motions only (${String(error).slice(0, 300)})`,
    );
    return { ...base, radialVelocities: { table: 'none', via: 'none', rows: 0 } };
  }
}

// ---------------------------------------------------------------- Hipparcos-2

/**
 * The new reduction's parallaxes, only those at the signal-to-noise a distance is taken
 * from (60,240 of 117,955 stars at S/N 5). Nothing else of it is used: the sky's
 * positions, proper motions and photometry stay the 1997 catalogue's, so a sky star does
 * not move by a hair when it gains a distance.
 */
export function hipparcos2GaiaArchiveQuery(): string {
  return (
    `SELECT ${select({ hip: 'hip', plx: 'plx', e_plx: 'e_plx', sn: 'sn' })} ` +
    `FROM ${HIPPARCOS2_GAIA_ARCHIVE_TABLE} WHERE plx >= ${STAR3D_PARALLAX_SNR} * e_plx`
  );
}

export function hipparcos2VizierQuery(): string {
  return (
    `SELECT ${select({ hip: 'HIP', plx: 'Plx', e_plx: 'e_Plx', sn: 'Sn' })} ` +
    `FROM "${HIPPARCOS2_VIZIER_TABLE}" WHERE Plx >= ${STAR3D_PARALLAX_SNR} * e_Plx`
  );
}

export function parseHipparcos2Csv(csv: string): Hipparcos2Row[] {
  const table = parseCsvTable(csv, ['hip', 'plx', 'e_plx', 'sn']);
  return table.rows.map((row) => {
    const label = `HIP2 ${table.at(row, 'hip') ?? '?'}`;
    return {
      hip: requiredNumber(table.at(row, 'hip'), 'hip', label),
      parallaxMas: requiredNumber(table.at(row, 'plx'), 'plx', label),
      parallaxErrorMas: requiredNumber(table.at(row, 'e_plx'), 'e_plx', label),
      solutionType: numberOrNaN(optionalNumber(table.at(row, 'sn'), 'sn', label)),
    };
  });
}

export async function fetchHipparcos2(): Promise<TapRead<Hipparcos2Row>> {
  return readWithFallback(
    [
      {
        service: GAIA_ARCHIVE,
        table: HIPPARCOS2_GAIA_ARCHIVE_TABLE,
        pages: [hipparcos2GaiaArchiveQuery()],
        parse: parseHipparcos2Csv,
      },
      {
        service: VIZIER,
        table: HIPPARCOS2_VIZIER_TABLE,
        pages: [hipparcos2VizierQuery()],
        parse: parseHipparcos2Csv,
      },
    ],
    'Hipparcos-2',
  );
}

// ---------------------------------------------------------------- bright Gaia DR3

const BRIGHT_COLUMNS = [
  'source_id',
  'ra',
  'dec',
  'parallax',
  'parallax_error',
  'pmra',
  'pmdec',
  'ruwe',
  'rv',
  'rv_error',
  'g',
];

/**
 * Every Gaia DR3 source brighter than G 9, with the HIP number DR3's own cross-match
 * gives it -- the sky stars' Gaia counterparts, by identifier where Hipparcos has the
 * star and by position for the Tycho-2 rest.
 */
export function brightGaiaArchivePages(): string[] {
  const columns = select({
    source_id: 's.source_id',
    ra: 's.ra',
    dec: 's.dec',
    parallax: 's.parallax',
    parallax_error: 's.parallax_error',
    pmra: 's.pmra',
    pmdec: 's.pmdec',
    ruwe: 's.ruwe',
    rv: 's.radial_velocity',
    rv_error: 's.radial_velocity_error',
    g: 's.phot_g_mean_mag',
    hip: 'x.original_ext_source_id',
  });
  return gaiaSourceIdPages('s.source_id').map(
    (range) =>
      `SELECT ${columns} FROM ${GAIA_DR3_GAIA_ARCHIVE_TABLE} AS s ` +
      `LEFT OUTER JOIN ${GAIA_HIPPARCOS2_CROSSMATCH_TABLE} AS x ON x.source_id = s.source_id ` +
      `WHERE s.phot_g_mean_mag < ${STAR3D_BRIGHT_GAIA_LIMIT} AND ${range}`,
  );
}

export function parseBrightGaiaCsv(csv: string): BrightGaiaRow[] {
  const table = parseCsvTable(csv, BRIGHT_COLUMNS);
  return table.rows.map((row) => {
    const sourceId = sourceIdOf(table.at(row, 'source_id'), 'Gaia DR3');
    const label = `Gaia DR3 ${sourceId}`;
    const number = (column: string): number =>
      numberOrNaN(optionalNumber(table.at(row, column), column, label));
    return {
      sourceId,
      raDeg: requiredNumber(table.at(row, 'ra'), 'ra', label),
      decDeg: requiredNumber(table.at(row, 'dec'), 'dec', label),
      parallaxMas: number('parallax'),
      parallaxErrorMas: number('parallax_error'),
      pmRaMasPerYear: number('pmra'),
      pmDecMasPerYear: number('pmdec'),
      ruwe: number('ruwe'),
      rvKmS: number('rv'),
      rvErrorKmS: number('rv_error'),
      g: number('g'),
      hip: table.has('hip') ? (optionalNumber(table.at(row, 'hip'), 'hip', label) ?? 0) : 0,
    };
  });
}

/**
 * The bright Gaia set, or null when the Gaia Archive cannot deliver it. Then build3d
 * matches the sky to the GCNS's own bright stars instead: the sky stars within 100 pc
 * keep their Gaia parallaxes and radial velocities, those beyond fall back to Hipparcos-2
 * or to infinity. Measured on 2026-10-24 with the Gaia Archive made unreachable: 31,858
 * sky stars placed instead of 43,210. The run goes on; the output's sources say what was
 * missing.
 *
 * **No VizieR route, on purpose.** VizieR's DR3 (I/355/gaiadr3) has no index on G that a
 * page of this query can use: on 2026-10-24 every page outran its 90-second timeout six
 * times over, so the route cost ten minutes to fail and never delivered. Better to go
 * straight to the census stand-in.
 */
export async function fetchBrightGaia(
  keep: (row: BrightGaiaRow) => boolean = () => true,
): Promise<TapRead<BrightGaiaRow> | null> {
  // Filtered page by page: of 177,000 bright sources only those that could be a sky
  // star's counterpart are kept, and the rest never accumulate.
  const parse = (csv: string): BrightGaiaRow[] => parseBrightGaiaCsv(csv).filter(keep);
  try {
    return await readWithFallback(
      [
        {
          service: GAIA_ARCHIVE,
          table: `${GAIA_DR3_GAIA_ARCHIVE_TABLE} + ${GAIA_HIPPARCOS2_CROSSMATCH_TABLE}`,
          pages: brightGaiaArchivePages(),
          parse,
        },
      ],
      'bright Gaia DR3',
    );
  } catch (error) {
    console.error(
      `[stars] bright Gaia DR3: FAILED, the census stands in for it (${String(error).slice(0, 300)})`,
    );
    return null;
  }
}
