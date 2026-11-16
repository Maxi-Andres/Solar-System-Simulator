import { closeSync, openSync, readSync } from 'node:fs';

/**
 * Just enough FITS (Pence et al. 2010, A&A 524, A42) to read a HEALPix map: the primary header,
 * then the first extension's -- a binary table -- and one or more of its columns of 4-byte
 * floats, big-endian, as Planck's maps store them (one pixel per row, TFORM '1E').
 *
 * Headers are 80-character cards in 2,880-byte blocks, ending at the card END; the table's data
 * starts at the next block after its header. Nothing else of the format is needed or read.
 */

const BLOCK = 2880;
const CARD = 80;

export interface FitsHeader {
  readonly cards: ReadonlyMap<string, string>;
  /** Where the header after this one, or this one's data, starts, bytes. */
  readonly end: number;
}

function readHeader(fd: number, start: number): FitsHeader {
  const cards = new Map<string, string>();
  const block = Buffer.alloc(BLOCK);
  let at = start;
  for (;;) {
    if (readSync(fd, block, 0, BLOCK, at) !== BLOCK) {
      throw new Error('The FITS file ends inside a header.');
    }
    at += BLOCK;
    for (let i = 0; i < BLOCK; i += CARD) {
      const card = block.toString('latin1', i, i + CARD);
      const key = card.slice(0, 8).trim();
      if (key === 'END') {
        return { cards, end: at };
      }
      if (card.slice(8, 10) === '= ') {
        // The value, up to a comment: a quoted string, or a number or logical.
        const rest = card.slice(10);
        const value = rest.trimStart().startsWith("'")
          ? rest.trimStart().slice(1, rest.trimStart().indexOf("'", 1)).trim()
          : rest.split('/')[0]!.trim();
        cards.set(key, value);
      }
    }
  }
}

export interface HealpixTable {
  readonly header: ReadonlyMap<string, string>;
  readonly nside: number;
  readonly ordering: 'NESTED' | 'RING';
  readonly coordsys: string;
  /** The columns asked for, by name, each one float per pixel; the BAD_DATA value made NaN. */
  readonly columns: ReadonlyMap<string, Float32Array>;
}

/** Reads `names` from the HEALPix binary table that is the file's first extension. */
export function readHealpixColumns(path: string, names: readonly string[]): HealpixTable {
  const fd = openSync(path, 'r');
  try {
    const primary = readHeader(fd, 0);
    if (primary.cards.get('NAXIS') !== '0') {
      throw new Error('Expected an empty primary HDU, as a HEALPix file has.');
    }
    const table = readHeader(fd, primary.end);
    const card = (key: string): string => {
      const value = table.cards.get(key);
      if (value === undefined) throw new Error(`No ${key} in the table's header.`);
      return value;
    };
    if (card('XTENSION') !== 'BINTABLE' || card('PIXTYPE') !== 'HEALPIX') {
      throw new Error('The first extension is not a HEALPix binary table.');
    }
    const rowBytes = Number(card('NAXIS1'));
    const rows = Number(card('NAXIS2'));
    const nside = Number(card('NSIDE'));
    const ordering = card('ORDERING');
    if (ordering !== 'NESTED' && ordering !== 'RING') throw new Error(`Unknown ORDERING ${ordering}.`);
    if (rows !== 12 * nside * nside) {
      throw new Error(`${rows} rows for Nside ${nside}: not one pixel per row.`);
    }
    const bad = table.cards.has('BAD_DATA') ? Number(card('BAD_DATA')) : null;
    // Each column's offset in a row: every field is '1E' in these maps, 4 bytes.
    const fields = Number(card('TFIELDS'));
    const offsets = new Map<string, number>();
    let offset = 0;
    for (let k = 1; k <= fields; k += 1) {
      const form = card(`TFORM${k}`);
      if (form !== '1E') throw new Error(`Column ${k} is ${form}, not one 4-byte float.`);
      offsets.set(card(`TTYPE${k}`), offset);
      offset += 4;
    }
    if (offset !== rowBytes) throw new Error('The columns do not add up to the row.');
    const wanted = names.map((name) => {
      const at = offsets.get(name);
      if (at === undefined) throw new Error(`No column ${name}.`);
      return { name, at, values: new Float32Array(rows) };
    });
    // A million rows at a time.
    const chunkRows = 1 << 20;
    const buffer = Buffer.alloc(chunkRows * rowBytes);
    for (let row = 0; row < rows; row += chunkRows) {
      const n = Math.min(chunkRows, rows - row);
      const bytes = n * rowBytes;
      if (readSync(fd, buffer, 0, bytes, table.end + row * rowBytes) !== bytes) {
        throw new Error('The FITS file ends inside its table.');
      }
      for (const column of wanted) {
        for (let i = 0; i < n; i += 1) {
          const v = buffer.readFloatBE(i * rowBytes + column.at);
          column.values[row + i] = bad !== null && Math.abs(v - bad) <= Math.abs(bad) * 1e-6 ? NaN : v;
        }
      }
    }
    return {
      header: table.cards,
      nside,
      ordering,
      coordsys: table.cards.get('COORDSYS') ?? '',
      columns: new Map(wanted.map((column) => [column.name, column.values])),
    };
  } finally {
    closeSync(fd);
  }
}
