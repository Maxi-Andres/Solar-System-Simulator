import { describe, expect, it } from 'vitest';

import { blur121, labelSurface, surfaceNets } from './isosurface.ts';

/** Every edge of a closed surface is shared by exactly two triangles, once each way. */
function edgeUses(indices: Uint32Array): Map<string, number> {
  const uses = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e += 1) {
      const a = indices[t + e]!;
      const b = indices[t + ((e + 1) % 3)]!;
      const key = `${a}>${b}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  return uses;
}

describe('a basin netted into a surface', () => {
  it('finds a sphere where the field crosses its level, closed and wound one way', () => {
    const n = 24;
    const c = (n - 1) / 2;
    const field = new Float32Array(n * n * n);
    for (let k = 0; k < n; k += 1)
      for (let j = 0; j < n; j += 1)
        for (let i = 0; i < n; i += 1) field[i + n * (j + n * k)] = 8 - Math.hypot(i - c, j - c, k - c);
    const mesh = surfaceNets(field, n, n, n, 0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    for (let v = 0; v < mesh.positions.length; v += 3) {
      const r = Math.hypot(mesh.positions[v]! - c, mesh.positions[v + 1]! - c, mesh.positions[v + 2]! - c);
      expect(Math.abs(r - 8)).toBeLessThan(0.15);
    }
    // Each directed edge once, and its reverse once: closed, and every triangle wound alike.
    const uses = edgeUses(mesh.indices);
    for (const [key, count] of uses) {
      expect(count).toBe(1);
      const [a, b] = key.split('>');
      expect(uses.has(`${b}>${a}`)).toBe(true);
    }
  });

  it('winds its triangles to face out of the inside', () => {
    const n = 12;
    const c = (n - 1) / 2;
    const field = new Float32Array(n * n * n);
    for (let k = 0; k < n; k += 1)
      for (let j = 0; j < n; j += 1)
        for (let i = 0; i < n; i += 1) field[i + n * (j + n * k)] = 3.5 - Math.hypot(i - c, j - c, k - c);
    const { positions, indices } = surfaceNets(field, n, n, n, 0);
    let outward = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const p = [0, 1, 2].map((e) => [0, 1, 2].map((d) => positions[indices[t + e]! * 3 + d]!));
      const u = p[1]!.map((v, d) => v - p[0]![d]!);
      const w = p[2]!.map((v, d) => v - p[0]![d]!);
      const normal = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
      const out = p[0]!.map((v) => v - c);
      if (normal[0]! * out[0]! + normal[1]! * out[1]! + normal[2]! * out[2]! > 0) outward += 1;
    }
    expect(outward).toBe(indices.length / 3);
  });

  it('keeps a field’s light where it was as it blurs, a box of ones its own sum', () => {
    const field = new Float32Array(5 * 5 * 5);
    field[2 + 5 * (2 + 5 * 2)] = 1;
    const blurred = blur121(field, 5, 5, 5);
    expect(blurred.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(blurred[2 + 5 * (2 + 5 * 2)]).toBeCloseTo(0.125, 6);
  });

  it('draws a label’s voxels as a closed blob about their centre, closed at the grid’s edge too', () => {
    const n = 6;
    const labels = new Uint8Array(n * n * n);
    const set = (i: number, j: number, k: number, label: number) => {
      labels[i + n * (j + n * k)] = label;
    };
    // A cube of 3 voxels in a corner (the crop pads outside the grid), and one about (3, 3, 3).
    for (let k = 0; k < 3; k += 1) for (let j = 0; j < 3; j += 1) for (let i = 0; i < 3; i += 1) set(i, j, k, 7);
    const corner = labelSurface(labels, [n, n, n], 7)!;
    expect(corner.indices.length).toBeGreaterThan(0);
    for (const count of edgeUses(corner.indices).values()) expect(count).toBe(1);
    const cube = new Uint8Array(n * n * n);
    for (let k = 1; k < 4; k += 1) for (let j = 1; j < 4; j += 1) for (let i = 1; i < 4; i += 1) cube[i + n * (j + n * k)] = 3;
    const mesh = labelSurface(cube, [n, n, n], 3)!;
    let sx = 0;
    let most = 0;
    for (let v = 0; v < mesh.positions.length; v += 3) {
      sx += mesh.positions[v]!;
      most = Math.max(most, Math.abs(mesh.positions[v]! - 2));
    }
    expect(sx / (mesh.positions.length / 3)).toBeCloseTo(2, 5);
    // Never past half a voxel beyond its outer voxels' centres; a cube this small rounds in.
    expect(most).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(1.5);
    expect(labelSurface(cube, [n, n, n], 9)).toBeNull();
  });
});
