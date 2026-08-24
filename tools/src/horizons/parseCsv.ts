/**
 * Extracts the CSV ephemeris table out of a Horizons plain-text report.
 *
 * The report wraps the data in $$SOE / $$EOE markers, and the column header is the
 * last line above $$SOE that mentions JDTDB:
 *
 *              JDTDB,            Calendar Date (TDB),      X,      Y,  ...
 *     *******************************************************************
 *     $$SOE
 *     2461041.500000000, A.D. 2026-Jan-01 00:00:00.0000, -2.65E+07, ...
 *     $$EOE
 *
 * Columns are read by name rather than by position, so a Horizons format change
 * fails loudly on a missing column instead of silently shifting X into Y.
 */

const START_MARKER = '$$SOE';
const END_MARKER = '$$EOE';

export interface EphemerisTable {
  /** Column names, in file order, e.g. ['JDTDB', 'Calendar Date (TDB)', 'X', ...]. */
  readonly columns: readonly string[];
  /** One entry per sample; each is the row's fields, aligned with `columns`. */
  readonly rows: readonly (readonly string[])[];
}

/** Splits a CSV line and drops the trailing empty field Horizons always appends. */
function splitRow(line: string): string[] {
  const fields = line.split(',').map((field) => field.trim());
  while (fields.length > 0 && fields[fields.length - 1] === '') {
    fields.pop();
  }
  return fields;
}

export function parseEphemerisCsv(result: string): EphemerisTable {
  const startIndex = result.indexOf(START_MARKER);
  const endIndex = result.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    // Horizons reports "No ephemeris for target" and similar as prose in `result`,
    // so surface a trimmed excerpt: it is usually the actual explanation.
    const excerpt = result.trim().slice(0, 500);
    throw new Error(`Horizons response contained no ${START_MARKER}/${END_MARKER} block.\n${excerpt}`);
  }

  const header = result
    .slice(0, startIndex)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('JDTDB'))
    .at(-1);

  if (header === undefined) {
    throw new Error('Could not find the JDTDB column header in the Horizons response.');
  }

  const columns = splitRow(header);

  const rows = result
    .slice(startIndex + START_MARKER.length, endIndex)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(splitRow);

  if (rows.length === 0) {
    throw new Error('The Horizons ephemeris block was empty.');
  }

  for (const [index, row] of rows.entries()) {
    if (row.length !== columns.length) {
      throw new Error(
        `Row ${index} has ${row.length} fields but the header declares ${columns.length}.`,
      );
    }
  }

  return { columns, rows };
}

/**
 * Reads one column as numbers.
 *
 * Throws on an unknown column name or an unparseable value, which is what we want:
 * a silent NaN would travel all the way into the renderer as a vanished planet.
 */
export function numericColumn(table: EphemerisTable, name: string): number[] {
  const index = table.columns.indexOf(name);
  if (index === -1) {
    throw new Error(
      `Horizons response has no column "${name}". Available: ${table.columns.join(', ')}`,
    );
  }

  return table.rows.map((row, rowIndex) => {
    const raw = row[index];
    if (raw === undefined) {
      throw new Error(`Row ${rowIndex} is missing column "${name}".`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Column "${name}" row ${rowIndex} is not a finite number: "${raw}"`);
    }
    return value;
  });
}

/** Reads a column that is expected to hold exactly one value. */
export function singleValue(table: EphemerisTable, name: string): number {
  const values = numericColumn(table, name);
  const value = values[0];
  if (value === undefined) {
    throw new Error(`Column "${name}" had no rows.`);
  }
  return value;
}
