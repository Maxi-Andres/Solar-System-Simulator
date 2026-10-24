import {
  GAIA_ARCHIVE_HIPPARCOS_TABLE,
  GAIA_ARCHIVE_TAP_URL,
  GAIA_ARCHIVE_TYCHO2_TABLE,
  HIPPARCOS_TABLE,
  STAR_MAGNITUDE_LIMIT,
  TYCHO2_TABLE,
  TYCHO_BV_FROM_BT_VT,
  TYCHO_V_FROM_VT,
  VIZIER_TAP_URL,
} from '../config.ts';
import {
  optionalNumber,
  optionalText,
  parseCsvTable,
  readWithFallback,
  type TapRead,
  type TapService,
} from './tap.ts';

export { splitCsvLine } from './tap.ts';

/**
 * Reads the two star catalogues of the sky.
 *
 * VizieR is the CDS Strasbourg mirror of the published astronomical catalogues, and it
 * speaks TAP -- the IVOA's query protocol -- so the requests below are ADQL over HTTP
 * and the answers are CSV. No key, no client library, no scraping. The ESA Gaia Archive
 * holds the same two catalogues as ESA published them and speaks the same protocol, so
 * each catalogue is asked of VizieR first and of the Gaia Archive when VizieR is down
 * (see tap.ts for why there are two doors). The Gaia Archive's columns are renamed in
 * the query to VizieR's, so one parser reads either answer.
 *
 * **Two catalogues, because neither one is a sky on its own.** Hipparcos is complete at
 * the bright end and thins out past magnitude 7.5; Tycho-2 goes to magnitude 11 and is
 * *missing the brightest stars entirely* -- its star mapper saturated on them, so Sirius,
 * Vega and Betelgeuse are simply not in it. Both facts are measured rather than taken on
 * faith; see `config.ts` for the numbers. The union is what a sky needs.
 */

export const VIZIER: TapService = { name: 'VizieR (CDS)', url: VIZIER_TAP_URL };
export const GAIA_ARCHIVE: TapService = { name: 'ESA Gaia Archive', url: GAIA_ARCHIVE_TAP_URL };

/** One star as read, before either catalogue's quirks are resolved. */
export interface CatalogRow {
  /** Hipparcos number, which is also how a Tycho-2 row says "this is already in Hipparcos". */
  readonly hip: number | null;
  /** Position in degrees, at the epoch the catalogue publishes it for. */
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  /** Sexagesimal J2000 fallback, for the Hipparcos rows that have no ICRS solution. */
  readonly raHms: string | null;
  readonly decDms: string | null;
  readonly vMag: number;
  readonly colorIndex: number | null;
  /** Proper motion in RA, already times cos(dec), mas/yr. */
  readonly pmRaMasPerYear: number | null;
  readonly pmDecMasPerYear: number | null;
  /**
   * Identity, carried for the 3D stars (step D2) and not written to stars.json: the
   * Tycho-2 number "TYC1-TYC2-TYC3", the Henry Draper number, Hipparcos's spectral type
   * and its CCDM multiple-system identifier. Null where the catalogue has none, or where
   * a response predates these columns.
   */
  readonly tyc?: string | null;
  readonly hd?: number | null;
  readonly spectralType?: string | null;
  readonly ccdm?: string | null;
  /**
   * Hipparcos field H48: true when Vmag is the combined light of a system's components
   * (70 Ophiuchi), false when it is one component's (Mizar, whose companion Hipparcos
   * resolved but listed under the same number). Null where the catalogue does not say.
   */
  readonly combinedLight?: boolean | null;
  /** Hipparcos field H58: components in this entry, 2 for a resolved pair. */
  readonly components?: number | null;
}

const HIPPARCOS_COLUMNS = [
  'HIP',
  'RAICRS',
  'DEICRS',
  'RAhms',
  'DEdms',
  'Vmag',
  'B-V',
  'pmRA',
  'pmDE',
];
/** Read when present: identity for the 3D stars, nothing the sky itself draws from. */
const HIPPARCOS_IDENTITY_COLUMNS = ['HD', 'SpType', 'CCDM', 'CombMag', 'Ncomp'];

const TYCHO2_COLUMNS = ['HIP', 'RAmdeg', 'DEmdeg', 'pmRA', 'pmDE', 'BTmag', 'VTmag'];
const TYCHO2_IDENTITY_COLUMNS = ['TYC1', 'TYC2', 'TYC3'];

/** The Gaia Archive's names for VizieR's columns, in the same order. */
const GAIA_ARCHIVE_HIPPARCOS_COLUMNS: Readonly<Record<string, string>> = {
  HIP: 'hip',
  RAICRS: 'ra',
  DEICRS: 'de',
  RAhms: 'rahms',
  DEdms: 'dedms',
  Vmag: 'vmag',
  'B-V': 'b_v',
  pmRA: 'pmra',
  pmDE: 'pmde',
  HD: 'hd',
  SpType: 'sptype',
  CCDM: 'ccdm',
  CombMag: 'combmag',
  Ncomp: 'ncomp',
};

const GAIA_ARCHIVE_TYCHO2_COLUMNS: Readonly<Record<string, string>> = {
  HIP: 'hip',
  RAmdeg: 'ra_mdeg',
  DEmdeg: 'de_mdeg',
  pmRA: 'pm_ra',
  pmDE: 'pm_de',
  BTmag: 'bt_mag',
  VTmag: 'vt_mag',
  TYC1: 'tyc1',
  TYC2: 'tyc2',
  TYC3: 'tyc3',
};

const PLAIN_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

function quoted(column: string): string {
  return PLAIN_IDENTIFIER.test(column) ? column : `"${column}"`;
}

/** `native AS "VizieRName"`, so either service's answer has VizieR's header. */
function aliased(columns: Readonly<Record<string, string>>): string {
  return Object.entries(columns)
    .map(([vizier, native]) => `${native} AS "${vizier}"`)
    .join(', ');
}

export function hipparcosQuery(magnitudeLimit: number): string {
  const selected = [...HIPPARCOS_COLUMNS, ...HIPPARCOS_IDENTITY_COLUMNS].map(quoted).join(', ');
  return `SELECT ${selected} FROM "${HIPPARCOS_TABLE}" WHERE Vmag <= ${magnitudeLimit}`;
}

export function gaiaArchiveHipparcosQuery(magnitudeLimit: number): string {
  return (
    `SELECT ${aliased(GAIA_ARCHIVE_HIPPARCOS_COLUMNS)} FROM ${GAIA_ARCHIVE_HIPPARCOS_TABLE} ` +
    `WHERE vmag <= ${magnitudeLimit}`
  );
}

/**
 * Tycho-2, filtered on the *transformed* magnitude rather than on VT.
 *
 * Tycho photometry is its own system: BT and VT, measured through the satellite's own
 * passbands. Johnson V is recovered by the transformation published with the catalogue
 * (ESA SP-1200, Volume 1), and the cut has to be made on that, not on VT -- for a red
 * star the two differ by more than a tenth of a magnitude, which at the faint end of a
 * sky is a visible number of stars.
 */
export function tycho2Query(magnitudeLimit: number): string {
  const selected = [...TYCHO2_COLUMNS, ...TYCHO2_IDENTITY_COLUMNS].map(quoted).join(', ');
  return (
    `SELECT ${selected} FROM "${TYCHO2_TABLE}" ` +
    'WHERE BTmag IS NOT NULL AND VTmag IS NOT NULL ' +
    `AND VTmag - ${TYCHO_V_FROM_VT} * (BTmag - VTmag) <= ${magnitudeLimit}`
  );
}

export function gaiaArchiveTycho2Query(magnitudeLimit: number): string {
  return (
    `SELECT ${aliased(GAIA_ARCHIVE_TYCHO2_COLUMNS)} FROM ${GAIA_ARCHIVE_TYCHO2_TABLE} ` +
    'WHERE bt_mag IS NOT NULL AND vt_mag IS NOT NULL ' +
    `AND vt_mag - ${TYCHO_V_FROM_VT} * (bt_mag - vt_mag) <= ${magnitudeLimit}`
  );
}

export function parseHipparcosCsv(csv: string): CatalogRow[] {
  const table = parseCsvTable(csv, HIPPARCOS_COLUMNS);
  return table.rows.map((row) => {
    const label = `HIP ${table.at(row, 'HIP') ?? '?'}`;
    const vMag = optionalNumber(table.at(row, 'Vmag'), 'Vmag', label);
    if (vMag === null) {
      throw new Error(`${label} has no V magnitude, which the query filtered on.`);
    }
    return {
      hip: optionalNumber(table.at(row, 'HIP'), 'HIP', label),
      raDeg: optionalNumber(table.at(row, 'RAICRS'), 'RAICRS', label),
      decDeg: optionalNumber(table.at(row, 'DEICRS'), 'DEICRS', label),
      raHms: optionalText(table.at(row, 'RAhms')),
      decDms: optionalText(table.at(row, 'DEdms')),
      vMag,
      colorIndex: optionalNumber(table.at(row, 'B-V'), 'B-V', label),
      pmRaMasPerYear: optionalNumber(table.at(row, 'pmRA'), 'pmRA', label),
      pmDecMasPerYear: optionalNumber(table.at(row, 'pmDE'), 'pmDE', label),
      tyc: null,
      hd: optionalNumber(table.at(row, 'HD'), 'HD', label),
      spectralType: optionalText(table.at(row, 'SpType')),
      ccdm: optionalText(table.at(row, 'CCDM')),
      combinedLight: table.has('CombMag') ? table.at(row, 'CombMag') === '*' : null,
      components: optionalNumber(table.at(row, 'Ncomp'), 'Ncomp', label),
    };
  });
}

/**
 * Tycho-2 rows, with BT and VT turned into Johnson V and B-V.
 *
 * The transformation is the catalogue's own, published alongside it:
 *
 *     V    = VT - 0.090 (BT - VT)
 *     B-V  = 0.850 (BT - VT)
 *
 * A first-order fit, quoted as good over -0.25 < BT-VT < 2.0, which covers 97% of the
 * stars inside our magnitude limit. It is a real approximation and the one place the
 * sky's photometry is transformed rather than measured in the system it is drawn in --
 * which is why Hipparcos wins wherever it has the same star.
 *
 * No sexagesimal fallback here: `RAmdeg`/`DEmdeg` are Tycho-2's mean positions **already
 * at J2000**, unlike Hipparcos's, so these rows need no epoch shift at all.
 */
export function parseTycho2Csv(csv: string): CatalogRow[] {
  const table = parseCsvTable(csv, TYCHO2_COLUMNS);
  const rows: CatalogRow[] = [];

  for (const row of table.rows) {
    const label = `TYC row ${rows.length}`;
    const bt = optionalNumber(table.at(row, 'BTmag'), 'BTmag', label);
    const vt = optionalNumber(table.at(row, 'VTmag'), 'VTmag', label);
    if (bt === null || vt === null) {
      // Filtered out by the query; a row without both carries no colour.
      continue;
    }
    const tycParts = TYCHO2_IDENTITY_COLUMNS.map((column) => optionalText(table.at(row, column)));
    rows.push({
      hip: optionalNumber(table.at(row, 'HIP'), 'HIP', label),
      raDeg: optionalNumber(table.at(row, 'RAmdeg'), 'RAmdeg', label),
      decDeg: optionalNumber(table.at(row, 'DEmdeg'), 'DEmdeg', label),
      raHms: null,
      decDms: null,
      vMag: vt - TYCHO_V_FROM_VT * (bt - vt),
      colorIndex: TYCHO_BV_FROM_BT_VT * (bt - vt),
      pmRaMasPerYear: optionalNumber(table.at(row, 'pmRA'), 'pmRA', label),
      pmDecMasPerYear: optionalNumber(table.at(row, 'pmDE'), 'pmDE', label),
      // Leading zeros dropped, as Tycho designations are written: "TYC 1-381-1".
      tyc: tycParts.every((part) => part !== null)
        ? tycParts.map((part) => String(Number(part))).join('-')
        : null,
      hd: null,
      spectralType: null,
      ccdm: null,
    });
  }

  return rows;
}

export async function fetchHipparcos(
  magnitudeLimit = STAR_MAGNITUDE_LIMIT,
): Promise<TapRead<CatalogRow>> {
  return readWithFallback(
    [
      {
        service: VIZIER,
        table: HIPPARCOS_TABLE,
        pages: [hipparcosQuery(magnitudeLimit)],
        parse: parseHipparcosCsv,
      },
      {
        service: GAIA_ARCHIVE,
        table: GAIA_ARCHIVE_HIPPARCOS_TABLE,
        pages: [gaiaArchiveHipparcosQuery(magnitudeLimit)],
        parse: parseHipparcosCsv,
      },
    ],
    'Hipparcos',
  );
}

export async function fetchTycho2(
  magnitudeLimit = STAR_MAGNITUDE_LIMIT,
): Promise<TapRead<CatalogRow>> {
  return readWithFallback(
    [
      {
        service: VIZIER,
        table: TYCHO2_TABLE,
        pages: [tycho2Query(magnitudeLimit)],
        parse: parseTycho2Csv,
      },
      {
        service: GAIA_ARCHIVE,
        table: GAIA_ARCHIVE_TYCHO2_TABLE,
        pages: [gaiaArchiveTycho2Query(magnitudeLimit)],
        parse: parseTycho2Csv,
      },
    ],
    'Tycho-2',
  );
}
