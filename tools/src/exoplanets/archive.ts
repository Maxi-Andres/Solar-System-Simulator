import { EXOPLANET_ARCHIVE_TABLE, EXOPLANET_ARCHIVE_TAP_URL } from '../config.ts';
import { optionalNumber, optionalText, parseCsvTable, queryTap, type TapService } from '../stars/tap.ts';

/**
 * The NASA Exoplanet Archive's confirmed planets, as its Planetary Systems Composite
 * Parameters table serves them (`pscomppars`; DOI 10.26133/NEA13), operated by Caltech/IPAC
 * for NASA's Exoplanet Exploration Program.
 *
 * One row per planet. Each column is filled from the published solution the Archive
 * judged best for that parameter, and where a planet has none, sometimes calculated from
 * the others -- a radius from the mass by Chen & Kipping 2017, a mass from the radius the
 * other way, a semi-major axis from the period and the star's mass. The Archive says which:
 * every such value's reference link reads "Calculated Value", and `pl_bmassprov` says
 * "M-R relationship" for a mass from a radius. So the table mixes papers, and it says
 * itself that its rows need not be self-consistent: an argument of periastron from one
 * paper beside a transit time from another. What is read here is kept with its reference,
 * so the app can say whose each number is.
 *
 * Column names as the service's own TAP_SCHEMA.columns listed them on 2026-10-29. Not
 * every name is what one would guess: the discovery method is `discoverymethod`, and
 * there is no single reference column (`pl_refname` is the per-solution table's) -- each
 * parameter has its own `_reflink`, and the discovery paper is `disc_refname`.
 */

export const ARCHIVE_SERVICE: TapService = {
  name: 'NASA Exoplanet Archive',
  url: EXOPLANET_ARCHIVE_TAP_URL,
};

/** The acknowledgement the Archive asks of work that uses it, word for word. */
export const ARCHIVE_ACKNOWLEDGEMENT =
  'This research has made use of the NASA Exoplanet Archive, which is operated by the California ' +
  'Institute of Technology, under contract with the National Aeronautics and Space Administration ' +
  'under the Exoplanet Exploration Program.';

/** What is read, in the order asked for. */
export const ARCHIVE_COLUMNS = [
  // The host: its names, where it is, how it moves, and what it is.
  'hostname',
  'gaia_dr3_id',
  'hip_name',
  'hd_name',
  'ra',
  'dec',
  'sy_dist',
  'sy_pmra',
  'sy_pmdec',
  'st_radv',
  'sy_snum',
  'sy_pnum',
  'st_spectype',
  'st_teff',
  'st_rad',
  'st_rad_reflink',
  'st_mass',
  'st_mass_reflink',
  // The planet: who found it, how, and whether it is argued over.
  'pl_name',
  'pl_letter',
  'discoverymethod',
  'disc_year',
  'disc_refname',
  'pl_controv_flag',
  'tran_flag',
  // Its orbit. A `lim` column is 1 or -1 where the value is only a limit.
  'pl_orbper',
  'pl_orbperlim',
  'pl_orbper_reflink',
  'pl_orbsmax',
  'pl_orbsmaxlim',
  'pl_orbeccen',
  'pl_orbeccenlim',
  'pl_orblper',
  'pl_orblper_reflink',
  'pl_orbincl',
  'pl_orbincllim',
  'pl_tranmid',
  'pl_tranmid_reflink',
  'pl_orbtper',
  'pl_orbtper_reflink',
  // Its mass and size.
  'pl_bmasse',
  'pl_bmasselim',
  'pl_bmassprov',
  'pl_bmasse_reflink',
  'pl_rade',
  'pl_radelim',
  'pl_rade_reflink',
] as const;

/**
 * The whole table in one query: 6,451 rows, 7.9 MB of CSV, in four seconds. Ordered, so
 * two runs on the same day write the same file.
 */
export function archiveQuery(): string {
  return `SELECT ${ARCHIVE_COLUMNS.join(', ')} FROM ${EXOPLANET_ARCHIVE_TABLE} ORDER BY hostname, pl_name`;
}

/** One planet, as the Archive gives it: units as its columns', nothing derived. */
export interface ArchiveRow {
  readonly hostname: string;
  /** Gaia DR3 source_id, as a decimal string; null where the Archive gives none. */
  readonly gaiaDr3: string | null;
  /** "HIP 113357", "HIP 28941 A" -- with the component, where the Archive gives one. */
  readonly hip: string | null;
  readonly hd: string | null;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distancePc: number | null;
  readonly pmRaMasYr: number | null;
  readonly pmDecMasYr: number | null;
  readonly rvKmS: number | null;
  readonly stars: number;
  readonly spectralType: string | null;
  readonly teffK: number | null;
  readonly radiusSun: number | null;
  readonly radiusSunRef: string | null;
  readonly massSun: number | null;
  readonly massSunRef: string | null;

  readonly name: string;
  readonly letter: string;
  readonly method: string;
  readonly year: number | null;
  readonly discoveryRef: string | null;
  readonly controversial: boolean;
  readonly transits: boolean;
  readonly periodDays: number | null;
  readonly periodLimit: boolean;
  readonly orbitRef: string | null;
  readonly semiMajorAxisAu: number | null;
  readonly semiMajorAxisLimit: boolean;
  readonly eccentricity: number | null;
  readonly eccentricityLimit: boolean;
  readonly omegaDeg: number | null;
  readonly omegaRef: string | null;
  readonly inclinationDeg: number | null;
  readonly inclinationLimit: boolean;
  readonly transitJd: number | null;
  readonly transitRef: string | null;
  readonly periastronJd: number | null;
  readonly periastronRef: string | null;
  readonly massEarth: number | null;
  readonly massLimit: number;
  readonly massKind: string | null;
  readonly massRef: string | null;
  readonly radiusEarth: number | null;
  readonly radiusLimit: boolean;
  readonly radiusRef: string | null;
  /** The radius's reference link reads "Calculated Value": the Archive's estimate. */
  readonly radiusCalculated: boolean;
}

/**
 * The HTML entities the Archive's reference links were seen to carry, 2026-10-29: the
 * accented letters of authors' names. A numeric one is decoded whatever it is; a named one
 * not here is left as written rather than guessed at.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  aacute: 'á',
  Aacute: 'Á',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  ccedil: 'ç',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  iacute: 'í',
  ntilde: 'ñ',
  oacute: 'ó',
  ograve: 'ò',
  ouml: 'ö',
  Ouml: 'Ö',
  uacute: 'ú',
  uuml: 'ü',
  Uuml: 'Ü',
  yacute: 'ý',
  scaron: 'š',
  Scaron: 'Š',
  plusmn: '±',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

/**
 * A reference link as the words it shows: `<a refstr=AGOL_ET_AL__2021 href=... target=ref>Agol
 * et al. 2021</a>` is "Agol et al. 2021". Null for an empty field.
 */
export function referenceText(link: string | undefined): string | null {
  if (link === undefined || link.trim() === '') {
    return null;
  }
  const shown = />([^<]*)</.exec(link)?.[1] ?? link;
  const text = decodeEntities(shown).replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

/** A limit flag: 1 or -1 where the value is a limit, 0 or empty where it is a value. */
function limitFlag(raw: string | undefined): number {
  const value = raw === undefined || raw === '' ? 0 : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Parses the Archive's CSV, the columns checked rather than trusted. */
export function parseArchiveCsv(csv: string): ArchiveRow[] {
  const table = parseCsvTable(csv, ARCHIVE_COLUMNS);
  return table.rows.map((row) => {
    const text = (column: (typeof ARCHIVE_COLUMNS)[number]): string | null => optionalText(table.at(row, column));
    const label = text('pl_name') ?? '(unnamed)';
    const number = (column: (typeof ARCHIVE_COLUMNS)[number]): number | null =>
      optionalNumber(table.at(row, column), column, label);
    const reference = (column: (typeof ARCHIVE_COLUMNS)[number]): string | null => referenceText(table.at(row, column));
    // A value published only as a limit is not a value: null, with the limit said.
    const unlessLimit = (value: (typeof ARCHIVE_COLUMNS)[number], limit: (typeof ARCHIVE_COLUMNS)[number]) =>
      limitFlag(table.at(row, limit)) !== 0 ? null : number(value);
    const ra = number('ra');
    const dec = number('dec');
    const hostname = text('hostname');
    if (ra === null || dec === null || hostname === null || text('pl_name') === null) {
      throw new Error(`Archive row ${label} has no host, name or position.`);
    }
    const gaia = text('gaia_dr3_id');
    const radiusLink = table.at(row, 'pl_rade_reflink') ?? '';
    return {
      hostname,
      // "Gaia DR3 2635476908753563008" -> the number.
      gaiaDr3: gaia === null ? null : (/^Gaia DR3 (\d+)$/.exec(gaia)?.[1] ?? null),
      hip: text('hip_name'),
      hd: text('hd_name'),
      raDeg: ra,
      decDeg: dec,
      distancePc: number('sy_dist'),
      pmRaMasYr: number('sy_pmra'),
      pmDecMasYr: number('sy_pmdec'),
      rvKmS: number('st_radv'),
      stars: number('sy_snum') ?? 1,
      spectralType: text('st_spectype'),
      teffK: number('st_teff'),
      radiusSun: number('st_rad'),
      radiusSunRef: reference('st_rad_reflink'),
      massSun: number('st_mass'),
      massSunRef: reference('st_mass_reflink'),
      name: label,
      letter: text('pl_letter') ?? '',
      method: text('discoverymethod') ?? '',
      year: number('disc_year'),
      discoveryRef: reference('disc_refname'),
      controversial: number('pl_controv_flag') === 1,
      transits: number('tran_flag') === 1,
      periodDays: unlessLimit('pl_orbper', 'pl_orbperlim'),
      periodLimit: limitFlag(table.at(row, 'pl_orbperlim')) !== 0,
      orbitRef: reference('pl_orbper_reflink'),
      semiMajorAxisAu: unlessLimit('pl_orbsmax', 'pl_orbsmaxlim'),
      semiMajorAxisLimit: limitFlag(table.at(row, 'pl_orbsmaxlim')) !== 0,
      eccentricity: unlessLimit('pl_orbeccen', 'pl_orbeccenlim'),
      eccentricityLimit: limitFlag(table.at(row, 'pl_orbeccenlim')) !== 0,
      omegaDeg: number('pl_orblper'),
      omegaRef: reference('pl_orblper_reflink'),
      inclinationDeg: unlessLimit('pl_orbincl', 'pl_orbincllim'),
      inclinationLimit: limitFlag(table.at(row, 'pl_orbincllim')) !== 0,
      transitJd: number('pl_tranmid'),
      transitRef: reference('pl_tranmid_reflink'),
      periastronJd: number('pl_orbtper'),
      periastronRef: reference('pl_orbtper_reflink'),
      // The mass is kept even as a limit -- it is what the size is estimated from where
      // nothing else is -- with the flag beside it.
      massEarth: number('pl_bmasse'),
      massLimit: limitFlag(table.at(row, 'pl_bmasselim')),
      massKind: text('pl_bmassprov'),
      massRef: reference('pl_bmasse_reflink'),
      radiusEarth: unlessLimit('pl_rade', 'pl_radelim'),
      radiusLimit: limitFlag(table.at(row, 'pl_radelim')) !== 0,
      radiusRef: reference('pl_rade_reflink'),
      radiusCalculated: /CALCULATED_VALUE|Calculated Value/.test(radiusLink),
    };
  });
}

/** Reads the whole table: one query, with tap.ts's retries. */
export async function fetchArchive(): Promise<{ rows: ArchiveRow[]; queriedAt: string }> {
  const queriedAt = new Date().toISOString();
  const csv = await queryTap(ARCHIVE_SERVICE, archiveQuery(), 'exoplanets');
  return { rows: parseArchiveCsv(csv), queriedAt };
}
