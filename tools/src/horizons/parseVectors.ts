import type { BodyDefinition, VectorTable } from '../types.ts';
import { numericColumn, parseEphemerisCsv } from './parseCsv.ts';

/**
 * Turns an EPHEM_TYPE=VECTORS report into a column-wise state vector table.
 *
 * Requested with VEC_TABLE='2' (position and velocity) and VEC_LABELS='NO', which
 * yields the columns: JDTDB, Calendar Date (TDB), X, Y, Z, VX, VY, VZ.
 * Positions are km and velocities km/s, in the ecliptic frame of J2000.
 */
export function parseVectors(result: string, body: BodyDefinition): VectorTable {
  const table = parseEphemerisCsv(result);

  const t = numericColumn(table, 'JDTDB');
  const x = numericColumn(table, 'X');
  const y = numericColumn(table, 'Y');
  const z = numericColumn(table, 'Z');
  const vx = numericColumn(table, 'VX');
  const vy = numericColumn(table, 'VY');
  const vz = numericColumn(table, 'VZ');

  // Hermite interpolation binary-searches `t`, so a non-monotonic series would
  // silently return garbage. Catch it here instead.
  for (let i = 1; i < t.length; i += 1) {
    const previous = t[i - 1];
    const current = t[i];
    if (previous === undefined || current === undefined || current <= previous) {
      throw new Error(`${body.id}: JDTDB is not strictly increasing at index ${i}.`);
    }
  }

  return {
    id: body.id,
    horizonsId: body.horizonsId,
    center: body.center,
    count: t.length,
    t,
    x,
    y,
    z,
    vx,
    vy,
    vz,
  };
}
