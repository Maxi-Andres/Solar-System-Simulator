import { VIZIER_ASU_MIRRORS } from '../config.ts';
import { download } from '../pulsars/fetchPulsars.ts';

/**
 * VizieR tables as its ASU interface serves them: tab-separated text, the whole table in one
 * answer, no ADQL. The Local Volume's tables are small (the largest, EVCC's, 360 KB), so they
 * are asked for whole, every column, and read here as rows of text keyed by column name.
 *
 * ## The answer
 *
 * Comment lines start with "#": the server, the query, and the table's description column by
 * column (read by nobody here). Then the header -- the column names, tab-separated -- a line of
 * units, a line of dashes, and one line a row, each value padded with spaces to its column's
 * width; a value not given is blank. A query VizieR could not answer still comes back as 200,
 * with an "#INFO Error=..." line and no table: that is an error, so the next mirror is tried.
 */

export type AsuRow = Readonly<Record<string, string>>;

/** One ASU-TSV answer's rows. Throws on VizieR's in-band error, or on an answer with no table. */
export function parseAsuTsv(text: string, required: readonly string[] = []): AsuRow[] {
  const lines = text.split(/\r?\n/);
  const error = lines.find((line) => /^#INFO\s+Error=/.test(line));
  if (error !== undefined) {
    throw new Error(`VizieR answered with an error: ${error.replace(/^#INFO\s+Error=/, '').trim()}`);
  }
  // The units line may be blank (a table of numbers without units), so lines are counted
  // from the header, and only the rows after the dashes have blank lines dropped.
  const content = lines.filter((line) => !line.startsWith('#'));
  const at = content.findIndex((line) => line.trim() !== '');
  const header = at < 0 ? undefined : content[at];
  const dashes = at < 0 ? undefined : content[at + 2];
  if (header === undefined || dashes === undefined || !/^-+(\t-+)*$/.test(dashes.trim())) {
    throw new Error('VizieR answered with no table: the header, units and dashes are not there.');
  }
  const body = [header, '', dashes, ...content.slice(at + 3).filter((line) => line.trim() !== '')];
  const names = header.split('\t').map((name) => name.trim());
  for (const column of required) {
    if (!names.includes(column)) {
      throw new Error(`VizieR's table has no column "${column}" (it has ${names.join(', ')}).`);
    }
  }
  return body.slice(3).map((line) => {
    const cells = line.split('\t');
    const row: Record<string, string> = {};
    names.forEach((name, i) => {
      row[name] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

/** A blank cell is not measured; anything else must be a number. */
export function asuNumber(row: AsuRow, column: string): number | null {
  const text = row[column] ?? '';
  if (text === '') {
    return null;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error(`Column ${column} holds "${text}", not a number.`);
  }
  return value;
}

/** The URL that asks a mirror for a whole table, every column. */
export function asuUrl(mirror: string, table: string): string {
  return `${mirror}?-source=${table}&-out.max=unlimited&-out.all`;
}

/**
 * A whole table, from the first mirror that answers with one; each mirror retried with the
 * project's backoff (download()) before the next is tried. `minimumRows` guards against a
 * mirror that answers with part of a table.
 */
export async function readVizierTable(
  table: string,
  label: string,
  required: readonly string[],
  minimumRows: number,
): Promise<{ rows: AsuRow[]; url: string }> {
  const failures: string[] = [];
  for (const mirror of VIZIER_ASU_MIRRORS) {
    const url = asuUrl(mirror, table);
    try {
      const rows = parseAsuTsv(new TextDecoder('latin1').decode(await download(url, label)), required);
      if (rows.length < minimumRows) {
        throw new Error(`only ${rows.length} rows, where the table has at least ${minimumRows}`);
      }
      return { rows, url };
    } catch (error) {
      failures.push(`${mirror}: ${String(error).slice(0, 300)}`);
      console.warn(`[local-volume] ${label}: ${mirror} failed (${String(error).slice(0, 200)}); trying the next mirror.`);
    }
  }
  throw new Error(`Could not read ${label} (${table}) from any VizieR mirror:\n  ${failures.join('\n  ')}`);
}
