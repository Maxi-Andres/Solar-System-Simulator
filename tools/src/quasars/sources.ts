/**
 * Where the quasars and the Planck SZ clusters come from, and how VizieR's text is read.
 */

/**
 * SDSS DR16Q (Lyke et al. 2020, ApJS 250, 8; VizieR VII/289): 750,414 quasars, every one with a
 * spectrum, from SDSS-I to IV -- the DR16 quasar-only catalogue. Only the columns used, from the
 * CfA's VizieR mirror (VIZIER_ASU_MIRRORS): about 80 MB of text.
 */
export const DR16Q_TABLE = 'VII/289/dr16q';
export const DR16Q_COLUMNS = ['RAJ2000', 'DEJ2000', 'z', 'r_z', 'QSO', 'PBAL', 'gmag', 'imag', 'e_gmag', 'e_imag', 'Extg', 'Exti', 'iMAG', 'zPCA'] as const;
/** The columns that are text, not numbers. */
export const DR16Q_TEXT_COLUMNS: ReadonlySet<string> = new Set(['r_z']);
export const DR16Q_LEAST_ROWS = 740_000;

/**
 * Richards et al. 2006 (AJ 131, 2766; VizieR J/AJ/131/2766/table4): the i band's K-correction
 * for quasars, every 0.01 in z from 0 to 5.49, normalised to z = 2 -- the continuum's (a power
 * law, alpha_nu = -0.5) and the emission lines' together, from the SDSS composite. What DR16Q's
 * own M_i is made with.
 */
export const RICHARDS_K_TABLE = 'J/AJ/131/2766/table4';
export const RICHARDS_K_COLUMNS = ['z', 'KCorr'] as const;

/**
 * The Planck SZ catalogue (Planck Collaboration 2016, A&A 594, A27; VizieR J/A+A/594/A27/psz2):
 * the union catalogue of the second Planck release's Sunyaev-Zeldovich sources, 1,653 of them,
 * 1,094 with a redshift from an external identification.
 */
export const PSZ2_TABLE = 'J/A+A/594/A27/psz2';
export const PSZ2_COLUMNS = ['Name', 'RAJ2000', 'DEJ2000', 'z', 'MSZ', 'zID', 'MCXC', 'ACT', 'SPT', 'Val'] as const;
export const PSZ2_TEXT_COLUMNS: ReadonlySet<string> = new Set(['Name', 'zID', 'MCXC', 'ACT', 'SPT']);
export const PSZ2_LEAST_ROWS = 1_600;

/** The URL that asks a mirror for a whole table, only `columns` (as cosmicWeb/catalogues.ts asuColumnsUrl). */
export function asuUrl(mirror: string, table: string, columns: readonly string[]): string {
  return `${mirror}?-source=${encodeURIComponent(table).replace(/%2F/g, '/')}&-out.max=unlimited&-out=${columns.map(encodeURIComponent).join(',')}`;
}

/** An ASU-TSV answer's columns: the numbers as Float64Array (NaN blank), the text as strings (trimmed). */
export interface AsuTable {
  readonly rows: number;
  readonly numbers: Readonly<Record<string, Float64Array>>;
  readonly text: Readonly<Record<string, readonly string[]>>;
}

/**
 * One ASU-TSV answer, as cosmicWeb/catalogues.ts parseAsuColumns reads it -- "#" comments, the
 * header, a units line, a line of dashes, a row a line; an "#INFO Error=" line is an error --
 * but with text columns too (`textColumns`), kept as they are. Every other value asked for must
 * be a number or blank.
 */
export function parseAsuTable(text: string, columns: readonly string[], textColumns: ReadonlySet<string> = new Set()): AsuTable {
  const error = /^#INFO\s+Error=(.*)$/m.exec(text);
  if (error !== null) throw new Error(`VizieR answered with an error: ${error[1]!.trim()}`);
  const lines = text.split(/\r?\n/).filter((line) => !line.startsWith('#'));
  const at = lines.findIndex((line) => line.trim() !== '');
  const dashes = at < 0 ? undefined : lines[at + 2];
  if (at < 0 || dashes === undefined || !/^-+(\t-+)*$/.test(dashes.trim())) {
    throw new Error('VizieR answered with no table: the header, units and dashes are not there.');
  }
  const names = lines[at]!.split('\t').map((name) => name.trim());
  const index = columns.map((column) => {
    const i = names.indexOf(column);
    if (i < 0) throw new Error(`VizieR's table has no column "${column}" (it has ${names.join(', ')}).`);
    return i;
  });
  const body = lines.slice(at + 3).filter((line) => line.trim() !== '');
  const numbers: Record<string, Float64Array> = {};
  const strings: Record<string, string[]> = {};
  for (const column of columns) {
    if (textColumns.has(column)) strings[column] = new Array<string>(body.length);
    else numbers[column] = new Float64Array(body.length);
  }
  body.forEach((line, r) => {
    const cells = line.split('\t');
    columns.forEach((column, c) => {
      const cell = (cells[index[c]!] ?? '').trim();
      if (textColumns.has(column)) {
        strings[column]![r] = cell;
        return;
      }
      const value = cell === '' ? Number.NaN : Number(cell);
      if (cell !== '' && !Number.isFinite(value)) throw new Error(`Column ${column} holds "${cell}", not a number.`);
      numbers[column]![r] = value;
    });
  });
  return { rows: body.length, numbers, text: strings };
}

/**
 * The quasar record-holders, as web/src/core/recordHolders.ts has them (a test there holds the
 * two lists equal): each is looked for in DR16Q, to be drawn once or line up.
 */
export const QUASAR_RECORD_HOLDERS: readonly { key: string; name: string; raDeg: number; decDeg: number; z: number }[] = [
  { key: 'uhz1', name: 'UHZ1', raDeg: 3.567070796, decDeg: -30.3778606, z: 10.073 },
  { key: 'eucl-j1729', name: 'EUCL J1729+6410', raDeg: 262.261458, decDeg: 64.171694, z: 7.77 },
  { key: 'j0313-1806', name: 'J0313−1806', raDeg: 48.432667, decDeg: -18.110111, z: 7.6423 },
  { key: 'ton-618', name: 'TON 618', raDeg: 187.1040249, decDeg: 31.4771192, z: 2.219 },
  { key: '3c-273', name: '3C 273', raDeg: 187.2779154, decDeg: 2.0523883, z: 0.158339 },
];

/** The cluster record-holders, as recordHolders.ts has them: PSZ2's of these are left out (drawn as their marks). */
export const CLUSTER_RECORD_HOLDERS: readonly { key: string; name: string; raDeg: number; decDeg: number; z: number }[] = [
  { key: 'el-gordo', name: 'El Gordo', raDeg: 15.71875, decDeg: -49.249444, z: 0.87 },
  { key: 'abell-2744', name: 'Abell 2744', raDeg: 3.58641, decDeg: -30.39997, z: 0.308 },
  { key: 'bullet-cluster', name: 'Bullet Cluster', raDeg: 104.6317, decDeg: -55.9465, z: 0.296 },
  { key: 'saraswati', name: 'Saraswati Supercluster (Abell 2631)', raDeg: 354.41553, decDeg: 0.27137, z: 0.28 },
];
