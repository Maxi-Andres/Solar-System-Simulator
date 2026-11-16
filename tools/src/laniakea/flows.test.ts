import { describe, expect, it } from 'vitest';

import {
  checkVelocityAxes,
  constraint,
  decodeFlows,
  encodeFlows,
  FULL_BELOW_KMS,
  GONE_ABOVE_KMS,
  LINES_PER_BASIN,
  readFitsVectorCube,
  regrid,
  START_SEPARATION_VOXELS,
  traceFlows,
  traceStreamline,
  transposeCube,
  type FlowLine,
  type VectorField,
} from './flows.ts';

/** A field on an n^3 grid from a function of the voxel, x fastest. */
function fieldOf(n: number, v: (i: number, j: number, k: number) => [number, number, number]): VectorField {
  const x = new Float32Array(n ** 3);
  const y = new Float32Array(n ** 3);
  const z = new Float32Array(n ** 3);
  for (let k = 0; k < n; k += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const [a, b, c] = v(i, j, k);
        const at = i + n * (j + n * k);
        x[at] = a;
        y[at] = b;
        z[at] = c;
      }
    }
  }
  return { size: n, x, y, z };
}

/** Infall onto `sink` at `rate` km/s a voxel. */
const infall = (sink: readonly number[], rate: number) => (i: number, j: number, k: number): [number, number, number] => [
  -rate * (i - sink[0]!),
  -rate * (j - sink[1]!),
  -rate * (k - sink[2]!),
];

describe('the streamlines', () => {
  it('comes to rest at a known sink, from any side', () => {
    const sink = [9.3, 12.6, 10.2];
    const field = fieldOf(24, infall(sink, 40));
    for (const seed of [[2, 3, 4], [20, 20, 2], [1, 22, 21], [12, 2, 18]] as const) {
      const trace = traceStreamline(field, [seed[0], seed[1], seed[2]]);
      expect(trace.end).toBe('attractor');
      const n = trace.points.length;
      const end = trace.points.slice(n - 3);
      expect(Math.hypot(end[0]! - sink[0]!, end[1]! - sink[1]!, end[2]! - sink[2]!)).toBeLessThan(0.3);
      // Downstream all the way: ever nearer the sink.
      for (let s = 3; s < n; s += 3) {
        const before = Math.hypot(trace.points[s - 3]! - sink[0]!, trace.points[s - 2]! - sink[1]!, trace.points[s - 1]! - sink[2]!);
        const after = Math.hypot(trace.points[s]! - sink[0]!, trace.points[s + 1]! - sink[1]!, trace.points[s + 2]! - sink[2]!);
        expect(after).toBeLessThanOrEqual(before + 1e-9);
      }
    }
  });

  it('runs off the grid where the flow does', () => {
    const field = fieldOf(16, () => [300, 0, 0]);
    const trace = traceStreamline(field, [3, 8, 8]);
    expect(trace.end).toBe('edge');
    expect(trace.points.at(-3)!).toBeGreaterThan(14.5);
  });

  it('seeds, spaces and tags lines by the basin each ends in, and agrees with a watershed drawn from the same field', () => {
    // Two sinks, each the attractor of its half of the box along x.
    const n = 32;
    const a = [8.4, 16.2, 15.7];
    const b = [23.6, 15.8, 16.3];
    const field = fieldOf(n, (i, j, k) => (i < 16 ? infall(a, 40)(i, j, k) : infall(b, 40)(i, j, k)));
    const labels = new Float64Array(n ** 3);
    for (let k = 0; k < n; k += 1) for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) labels[i + n * (j + n * k)] = i < 16 ? 1 : 2;
    const result = traceFlows({
      velocity: field,
      error: { size: 4, values: new Float64Array(64).fill(20) },
      density: { size: n, values: new Float64Array(n ** 3).fill(1) },
      basins: { size: n, values: labels },
      kept: new Set([1, 2]),
    }, 1);
    expect(result.agreement).toBeGreaterThan(0.95);
    expect(result.lines.length).toBeGreaterThan(10);
    for (const line of result.lines) {
      const start = line.points.slice(0, 3);
      const sink = line.basin === 1 ? a : b;
      expect([1, 2]).toContain(line.basin);
      // Tagged by where it goes: the basin of the sink it runs to.
      const end = line.points.slice(line.points.length - 3);
      expect(end[0]! < 16 ? 1 : 2).toBe(line.basin);
      expect(Math.hypot(end[0]! - sink[0]!, end[1]! - sink[1]!, end[2]! - sink[2]!)).toBeLessThan(Math.hypot(start[0]! - sink[0]!, start[1]! - sink[1]!, start[2]! - sink[2]!));
      expect(line.weights.every((w) => w === 1)).toBe(true);
    }
    // Spaced: no two lines start within the separation of each other's points.
    expect(result.lines.filter((l) => l.end === 'joined').length).toBeGreaterThan(0);
    // A few to a basin, their starts spread: never more than its budget, none starting near another's start.
    for (const basin of [1, 2]) expect(result.lines.filter((l) => l.basin === basin).length).toBeLessThanOrEqual(LINES_PER_BASIN);
    for (const [i, a] of result.lines.entries())
      for (const b of result.lines.slice(i + 1))
        expect(Math.hypot(a.points[0]! - b.points[0]!, a.points[1]! - b.points[1]!, a.points[2]! - b.points[2]!)).toBeGreaterThanOrEqual(START_SEPARATION_VOXELS);
  });

  it('cuts a line where the data stop, and draws none from an unkept basin', () => {
    const n = 32;
    const sink = [16, 16, 16];
    const field = fieldOf(n, infall(sink, 40));
    // The error grows outward from the centre: constrained within ~8 voxels only.
    const m = 8;
    const error = new Float64Array(m ** 3);
    for (let k = 0; k < m; k += 1) for (let j = 0; j < m; j += 1) for (let i = 0; i < m; i += 1) error[i + m * (j + m * k)] = 40 * Math.hypot(i - 4, j - 4, k - 4);
    const labels = new Float64Array(n ** 3).fill(1);
    labels.fill(7, 0, n * n * 4); // The slab k < 4: a basin not kept.
    const result = traceFlows({
      velocity: field,
      error: { size: m, values: error },
      density: { size: n, values: new Float64Array(n ** 3) },
      basins: { size: n, values: labels },
      kept: new Set([1]),
    }, 1);
    expect(result.lines.length).toBeGreaterThan(0);
    for (const line of result.lines) {
      for (let v = 0; v < line.points.length / 3; v += 1) {
        expect(line.points[v * 3 + 2]!).toBeGreaterThan(3.4);
        const e = 40 * Math.hypot(...[0, 1, 2].map((c) => regrid(line.points[v * 3 + c]!, n, m) - 4));
        expect(e).toBeLessThan(GONE_ABOVE_KMS + 15);
      }
    }
  });
});

describe('the velocity cube', () => {
  /** A FITS file of an n^3 x 3 float32 cube, NAXIS1 fastest. */
  function fits(n: number, value: (plane: number, a: number, b: number, c: number) => number): Uint8Array {
    const cards = ['SIMPLE  =                    T', 'BITPIX  =                  -32', 'NAXIS   =                    4', `NAXIS1  = ${String(n).padStart(20)}`, `NAXIS2  = ${String(n).padStart(20)}`, `NAXIS3  = ${String(n).padStart(20)}`, 'NAXIS4  =                    3', 'END'];
    const header = cards.map((c) => c.padEnd(80)).join('').padEnd(2880);
    const bytes = new Uint8Array(2880 + Math.ceil((3 * n ** 3 * 4) / 2880) * 2880);
    bytes.set(new TextEncoder().encode(header));
    const view = new DataView(bytes.buffer, 2880);
    let at = 0;
    for (let p = 0; p < 3; p += 1) for (let c = 0; c < n; c += 1) for (let b = 0; b < n; b += 1) for (let a = 0; a < n; a += 1) view.setFloat32(4 * at++, value(p, a, b, c));
    return bytes;
  }

  it('reads the planes as SGX, SGY, SGZ, the grid NAXIS1 = SGZ, made SGX fastest, in km/s', () => {
    // Plane p holds 100 p + the NAXIS3 index (SGX, slowest in the file).
    const field = readFitsVectorCube(fits(4, (p, _a, _b, c) => 100 * p + c));
    const at = (i: number, j: number, k: number) => i + 4 * (j + 4 * k);
    expect(field.x[at(3, 0, 0)]).toBeCloseTo(3 * 52);
    expect(field.y[at(2, 1, 1)]).toBeCloseTo((100 + 2) * 52);
    expect(field.z[at(1, 3, 2)]).toBeCloseTo((200 + 1) * 52);
  });

  it('transposes a cube\'s first and third axes', () => {
    const values = Float64Array.from({ length: 27 }, (_, i) => i);
    const t = transposeCube(values, 3);
    expect(t[1 + 3 * (2 + 3 * 0)]).toBe(0 + 3 * (2 + 3 * 1));
    expect(transposeCube(t, 3)).toEqual(values);
  });

  it('finds the planes\' order by the divergence\'s correlation with the density', () => {
    const n = 20;
    const w = (2 * Math.PI) / n;
    // v = grad of a potential; delta = - div v (linear theory, f H = 1).
    const potential = (i: number, j: number, k: number) => Math.cos(w * i) + 0.5 * Math.cos(2 * w * j) + 0.3 * Math.sin(w * k);
    const field = fieldOf(n, (i, j, k) => [
      (potential(i + 0.5, j, k) - potential(i - 0.5, j, k)) * 100,
      (potential(i, j + 0.5, k) - potential(i, j - 0.5, k)) * 100,
      (potential(i, j, k + 0.5) - potential(i, j, k - 0.5)) * 100,
    ]);
    const delta = new Float64Array(n ** 3);
    for (let k = 0; k < n; k += 1)
      for (let j = 0; j < n; j += 1)
        for (let i = 0; i < n; i += 1) {
          const at = i + n * (j + n * k);
          delta[at] = -(
            field.x[i + 1 < n ? at + 1 : at]! - field.x[i > 0 ? at - 1 : at]! +
            (field.y[j + 1 < n ? at + n : at]! - field.y[j > 0 ? at - n : at]!) +
            (field.z[k + 1 < n ? at + n * n : at]! - field.z[k > 0 ? at - n * n : at]!)
          );
        }
    expect(checkVelocityAxes(field, { size: n, values: delta })).toBeLessThan(-0.99);
    const swapped: VectorField = { size: n, x: field.z, y: field.y, z: field.x };
    expect(checkVelocityAxes(swapped, { size: n, values: delta })).toBeGreaterThan(-0.9);
  });

  it('fades a line from FULL_BELOW_KMS of error to GONE_ABOVE_KMS', () => {
    expect(constraint(FULL_BELOW_KMS - 1)).toBe(1);
    expect(constraint(GONE_ABOVE_KMS + 1)).toBe(0);
    expect(constraint((FULL_BELOW_KMS + GONE_ABOVE_KMS) / 2)).toBeCloseTo(0.5);
  });
});

describe('flows.bin', () => {
  it('writes its columns as LaniakeaFlows says, and reads them back', () => {
    const lines: FlowLine[] = [
      { points: [64, 64, 64, 65.5, 63.25, 64.125], speeds: [460, 431], weights: [1, 0.5], basin: 1, end: 'attractor' },
      { points: [10, 20, 30, 11, 21, 31, 12, 22, 32], speeds: [100, 90, 80], weights: [0.2, 0.1, 0], basin: 0, end: 'unconstrained' },
    ];
    const { bytes, vertices } = encodeFlows(lines, 128);
    expect(vertices).toBe(5);
    expect(bytes.length).toBe(4 * 3 + 6 * 5 + 2 * 5 + 5 + 2);
    const back = decodeFlows(bytes, 2, 5);
    expect(back.starts).toEqual([0, 2, 5]);
    expect(back.positions.slice(0, 6)).toEqual([0, 0, 0, 1.5, -0.75, 0.125]);
    expect(back.positions.slice(6, 9)).toEqual([-54, -44, -34]);
    expect(back.speeds).toEqual([460, 431, 100, 90, 80]);
    expect(back.weights[1]).toBeCloseTo(0.5, 2);
    expect(back.basins).toEqual([1, 0]);
  });
});
