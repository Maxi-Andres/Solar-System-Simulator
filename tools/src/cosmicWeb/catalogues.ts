import { readHeader } from '../localGroup/nearbyGalaxies.ts';

/**
 * The cosmic web's catalogues as they come: VizieR's tab-separated text, read into columns;
 * DisPerSE's ASCII skeletons; and the BOSS galaxies' FITS binary table, read into columns.
 * Each table here has hundreds of thousands of rows, so nothing is held a row an object.
 */

// ---------------------------------------------------------------------------------------
// VizieR's ASU-TSV, into columns

/**
 * One ASU-TSV answer's `columns`, each a Float64Array (NaN where blank). The answer is as
 * localVolume/asu.ts describes it -- "#" comments, the header, a units line, a line of dashes,
 * a row a line -- and a query VizieR could not answer, which still comes back as 200 with an
 * "#INFO Error=" line, is an error. Every value asked for must be a number or blank.
 */
export function parseAsuColumns(text: string, columns: readonly string[]): { rows: number; values: Record<string, Float64Array> } {
  const error = /^#INFO\s+Error=(.*)$/m.exec(text);
  if (error !== null) {
    throw new Error(`VizieR answered with an error: ${error[1]!.trim()}`);
  }
  const lines = text.split(/\r?\n/).filter((line) => !line.startsWith('#'));
  const at = lines.findIndex((line) => line.trim() !== '');
  const dashes = at < 0 ? undefined : lines[at + 2];
  if (at < 0 || dashes === undefined || !/^-+(\t-+)*$/.test(dashes.trim())) {
    throw new Error('VizieR answered with no table: the header, units and dashes are not there.');
  }
  const names = lines[at]!.split('\t').map((name) => name.trim());
  const index = columns.map((column) => {
    const i = names.indexOf(column);
    if (i < 0) {
      throw new Error(`VizieR's table has no column "${column}" (it has ${names.join(', ')}).`);
    }
    return i;
  });
  const body = lines.slice(at + 3).filter((line) => line.trim() !== '');
  const values: Record<string, Float64Array> = {};
  for (const column of columns) values[column] = new Float64Array(body.length);
  body.forEach((line, r) => {
    const cells = line.split('\t');
    columns.forEach((column, c) => {
      const cell = (cells[index[c]!] ?? '').trim();
      const value = cell === '' ? Number.NaN : Number(cell);
      if (cell !== '' && !Number.isFinite(value)) {
        throw new Error(`Column ${column} holds "${cell}", not a number.`);
      }
      values[column]![r] = value;
    });
  });
  return { rows: body.length, values };
}

/** The URL that asks a mirror for a whole table, only `columns`. */
export function asuColumnsUrl(mirror: string, table: string, columns: readonly string[]): string {
  return `${mirror}?-source=${encodeURIComponent(table).replace(/%2F/g, '/')}&-out.max=unlimited&-out=${columns.map(encodeURIComponent).join(',')}`;
}

// ---------------------------------------------------------------------------------------
// Tempel et al. 2014: the SDSS filaments and their galaxies

/** One of table2's filament points: its filament, place (Tempel's frame, h^-1 Mpc) and the visit map. */
export interface TempelPoints {
  readonly count: number;
  readonly filament: Int32Array;
  readonly point: Int32Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  readonly distance: Float64Array;
  readonly visitMap: Float64Array;
}

export const TEMPEL_POINT_COLUMNS = ['ID', 'IDpt', 'x', 'y', 'z', 'D', 'vmap'] as const;
export const TEMPEL_FILAMENT_COLUMNS = ['ID', 'Npts', 'Len', 'Ng.5', 'Ng1'] as const;
export const TEMPEL_GALAXY_COLUMNS = ['IDgal', 'Ngal', 'z', 'RAJ2000', 'DEJ2000', 'Dcor', 'umag', 'gmag', 'rmag', 'imag', 'zmag', 'Dfil', 'IDpt'] as const;

/**
 * table2's points, sorted by filament and along it. VizieR serves them so -- each
 * filament's points numbered on along its spine, half an h^-1 Mpc apart (Tempel et al.'s
 * Appendix A) -- and the sort makes sure.
 */
export function readTempelPoints(values: Record<string, Float64Array>, rows: number): TempelPoints {
  const order = Array.from({ length: rows }, (_, i) => i).sort((a, b) => values.ID![a]! - values.ID![b]! || values.IDpt![a]! - values.IDpt![b]!);
  const take = (column: string) => Float64Array.from(order, (i) => values[column]![i]!);
  for (const column of TEMPEL_POINT_COLUMNS) {
    if (values[column]!.some((v) => Number.isNaN(v))) {
      throw new Error(`Tempel et al.'s filament points: a blank ${column}.`);
    }
  }
  return {
    count: rows,
    filament: Int32Array.from(order, (i) => values.ID![i]!),
    point: Int32Array.from(order, (i) => values.IDpt![i]!),
    x: take('x'),
    y: take('y'),
    z: take('z'),
    distance: take('D'),
    visitMap: take('vmap'),
  };
}

// ---------------------------------------------------------------------------------------
// DisPerSE's skeletons: the NDskl ASCII format

/**
 * A DisPerSE skeleton (Sousbie 2011, MNRAS 414, 350; the format as DisPerSE's documentation
 * gives it, "NDskl_ascii"):
 *
 *   ANDSKEL / ndims / a comment / BBOX [x0,...] [dx,...]
 *   [CRITICAL POINTS] n, then for each: "type x y z value pairID boundary", the number of
 *     filaments it ends, and a line "destination filamentID" for each
 *   [FILAMENTS] n, then for each: "cpA cpB nSamp" and nSamp lines of x y z, cpA's first
 *   [CRITICAL POINTS DATA] the number of fields, their names, a line of values a point
 *   [FILAMENTS DATA] the number of fields, their names, a line of values a sampling point
 *
 * type is the critical point's index (0 a minimum ... ndims a maximum), ndims + 1 a
 * bifurcation; boundary is non-zero for a point DisPerSE tags as on the sample's boundary.
 */
export interface Skeleton {
  readonly ndims: number;
  readonly criticalPoints: { readonly type: Int8Array; readonly boundary: Uint8Array; readonly count: number };
  readonly filaments: {
    readonly count: number;
    readonly cpA: Int32Array;
    readonly cpB: Int32Array;
    /** Each filament's first sampling point, and one past the last's. */
    readonly first: Uint32Array;
  };
  /** The sampling points, x y z interleaved. */
  readonly points: Float64Array;
  /** The [FILAMENTS DATA] fields, a value a sampling point. */
  readonly pointFields: Readonly<Record<string, Float64Array>>;
}

export function parseNdskl(text: string): Skeleton {
  const lines = text.split(/\r?\n/);
  let at = 0;
  const next = (): string => {
    const line = lines[at];
    if (line === undefined) throw new Error('The skeleton ends early.');
    at += 1;
    return line.trim();
  };
  const numbers = (line: string) => line.split(/\s+/).map(Number);
  if (next() !== 'ANDSKEL') {
    throw new Error('Not a DisPerSE ASCII skeleton: it does not start with ANDSKEL.');
  }
  const ndims = Number(next());
  if (ndims !== 3) throw new Error(`A skeleton of ${ndims} dimensions, not 3.`);
  const seek = (section: string) => {
    while (at < lines.length && lines[at]!.trim() !== section) at += 1;
    if (at >= lines.length) throw new Error(`The skeleton has no ${section}.`);
    at += 1;
  };

  seek('[CRITICAL POINTS]');
  const cpCount = Number(next());
  const type = new Int8Array(cpCount);
  const boundary = new Uint8Array(cpCount);
  for (let c = 0; c < cpCount; c += 1) {
    const row = numbers(next());
    if (row.length < 7) throw new Error(`Critical point ${c}: "${row.join(' ')}" is not "type x y z value pair boundary".`);
    type[c] = row[0]!;
    boundary[c] = row[6]! === 0 ? 0 : 1;
    const ends = Number(next());
    at += ends;
  }

  seek('[FILAMENTS]');
  const count = Number(next());
  const cpA = new Int32Array(count);
  const cpB = new Int32Array(count);
  const first = new Uint32Array(count + 1);
  const coordinates: number[] = [];
  for (let f = 0; f < count; f += 1) {
    const [a, b, n] = numbers(next());
    cpA[f] = a!;
    cpB[f] = b!;
    first[f] = coordinates.length / 3;
    for (let k = 0; k < n!; k += 1) {
      const p = numbers(next());
      if (p.length !== 3 || p.some((v) => !Number.isFinite(v))) throw new Error(`Filament ${f}: a sampling point "${p.join(' ')}" is not x y z.`);
      coordinates.push(p[0]!, p[1]!, p[2]!);
    }
  }
  first[count] = coordinates.length / 3;
  const samples = first[count]!;

  seek('[FILAMENTS DATA]');
  const fieldCount = Number(next());
  const names = Array.from({ length: fieldCount }, () => next());
  const pointFields: Record<string, Float64Array> = {};
  for (const name of names) pointFields[name] = new Float64Array(samples);
  for (let s = 0; s < samples; s += 1) {
    const row = numbers(next());
    if (row.length !== fieldCount) throw new Error(`Sampling point ${s}'s data has ${row.length} fields, not ${fieldCount}.`);
    names.forEach((name, i) => {
      pointFields[name]![s] = row[i]!;
    });
  }
  return { ndims, criticalPoints: { type, boundary, count: cpCount }, filaments: { count, cpA, cpB, first }, points: Float64Array.from(coordinates), pointFields };
}

// ---------------------------------------------------------------------------------------
// FITS binary tables, into columns

const FORM_BYTES: Readonly<Record<string, number>> = { A: 1, L: 1, B: 1, I: 2, J: 4, K: 8, E: 4, D: 8 };

/**
 * The `wanted` columns of a FITS file's first binary table (localGroup/nearbyGalaxies.ts
 * reads headers the same way), each as a Float64Array of rows x repeat values, a row's
 * repeat values together (MODELFLUX's u g r i z). Numeric columns only.
 */
export function readFitsColumns(bytes: Uint8Array, wanted: readonly string[]): { rows: number; columns: Record<string, { repeat: number; values: Float64Array }> } {
  if (new TextDecoder('latin1').decode(bytes.subarray(0, 9)) !== 'SIMPLE  =') {
    throw new Error('Not a FITS file: it does not start with SIMPLE.');
  }
  let at = 0;
  for (;;) {
    const { cards, dataAt } = readHeader(bytes, at);
    if (cards.get('XTENSION') === 'BINTABLE') {
      return readColumns(bytes, cards, dataAt, wanted);
    }
    const axes = Number(cards.get('NAXIS') ?? 0);
    let size = axes === 0 ? 0 : Math.abs(Number(cards.get('BITPIX'))) / 8;
    for (let n = 1; n <= axes; n += 1) size *= Number(cards.get(`NAXIS${n}`));
    size += Number(cards.get('PCOUNT') ?? 0);
    at = dataAt + Math.ceil(size / 2880) * 2880;
    if (at >= bytes.length) throw new Error('The FITS file has no binary table.');
  }
}

function readColumns(bytes: Uint8Array, cards: Map<string, string>, at: number, wanted: readonly string[]) {
  const rowBytes = Number(cards.get('NAXIS1'));
  const rows = Number(cards.get('NAXIS2'));
  const fields = Number(cards.get('TFIELDS'));
  if (at + rowBytes * rows > bytes.length) {
    throw new Error(`The FITS table should hold ${rows} rows of ${rowBytes} bytes, and the file is shorter.`);
  }
  const layout = new Map<string, { type: string; repeat: number; offset: number }>();
  let offset = 0;
  for (let n = 1; n <= fields; n += 1) {
    const form = /^(\d*)([A-Z])$/.exec(cards.get(`TFORM${n}`) ?? '');
    if (form === null || FORM_BYTES[form[2]!] === undefined) {
      throw new Error(`Column ${n} of the FITS table has a format this reader does not know: ${cards.get(`TFORM${n}`)}.`);
    }
    const repeat = form[1] === '' ? 1 : Number(form[1]);
    layout.set((cards.get(`TTYPE${n}`) ?? `col${n}`).trim().toUpperCase(), { type: form[2]!, repeat, offset });
    offset += repeat * FORM_BYTES[form[2]!]!;
  }
  if (offset !== rowBytes) {
    throw new Error(`The FITS table's columns add up to ${offset} bytes a row, not its ${rowBytes}.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const columns: Record<string, { repeat: number; values: Float64Array }> = {};
  for (const name of wanted) {
    const column = layout.get(name.toUpperCase());
    if (column === undefined) {
      throw new Error(`The FITS table has no column ${name} (it has ${[...layout.keys()].join(', ')}).`);
    }
    const read: (p: number) => number = {
      B: (p: number) => view.getUint8(p),
      I: (p: number) => view.getInt16(p, false),
      J: (p: number) => view.getInt32(p, false),
      K: (p: number) => Number(view.getBigInt64(p, false)),
      E: (p: number) => view.getFloat32(p, false),
      D: (p: number) => view.getFloat64(p, false),
    }[column.type] ?? (() => {
      throw new Error(`Column ${name} is of type ${column.type}, not a number.`);
    });
    const size = FORM_BYTES[column.type]!;
    const values = new Float64Array(rows * column.repeat);
    for (let r = 0; r < rows; r += 1) {
      const base = at + r * rowBytes + column.offset;
      for (let k = 0; k < column.repeat; k += 1) values[r * column.repeat + k] = read(base + k * size);
    }
    columns[name] = { repeat: column.repeat, values };
  }
  return { rows, columns };
}
