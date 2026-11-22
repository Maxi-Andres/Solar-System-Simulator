import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { FIELD, indexLaniakea, parseBasins, parseGalaxyRecords, parseLaniakeaInfo } from '../core/laniakea.ts';
import { laniakeaMarkIndex, MarkState, type LaniakeaMarkFolds } from './laniakeaMarks.ts';
import { declutterMarks, type Marks } from './markDeclutter.ts';
import { FoldHosts, systemStrength } from './markFolding.ts';
import { laniakeaFolds, MARK_HOSTS } from './markHosts.ts';

/**
 * Laniakea's marks worked out only where they can be anything (laniakeaMarks.ts) are what the
 * pass over every galaxy gave (the reference below, as Laniakea.tsx had it), and the declutter
 * handed only the candidates leaves every mark as the full declutter does.
 */

const STRIDE = 12;

function referenceStrengths(
  hosts: FoldHosts,
  records: Float32Array,
  folds: LaniakeaMarkFolds,
  reachPc: Float32Array,
  cameraPc: readonly [number, number, number],
  cssPerRadian: number,
  focusIndex: number,
  value: Float32Array,
): void {
  for (let k = 0; k < value.length; k += 1) {
    let s: number;
    if (k === focusIndex) s = 1;
    else if (folds.marks[k]! >= 0) s = hosts.strength[folds.marks[k]!] ?? 0;
    else if (folds.host[k]! >= 0) s = hosts.member(folds.host[k]!, folds.separationPc[k]!);
    else {
      const d = Math.hypot(records[k * STRIDE]! - cameraPc[0], records[k * STRIDE + 1]! - cameraPc[1], records[k * STRIDE + 2]! - cameraPc[2]);
      s = systemStrength((reachPc[k]! / d) * cssPerRadian);
    }
    value[k] = s;
  }
}

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A synthetic sky: groups (hosts present only when near), their members, and field galaxies. */
function synthetic(seed: number) {
  const next = random(seed);
  const hosts = new FoldHosts();
  const count = 6000;
  const records = new Float32Array(count * STRIDE);
  const marks = new Int32Array(count).fill(-1);
  const host = new Int32Array(count).fill(-1);
  const separationPc = new Float32Array(count).fill(Infinity);
  const reachPc = new Float32Array(count);
  let k = 0;
  const put = (x: number, y: number, z: number) => {
    records[k * STRIDE] = x;
    records[k * STRIDE + 1] = y;
    records[k * STRIDE + 2] = z;
    reachPc[k] = 10 * Math.max(1000, next() * 20000);
    return k++;
  };
  while (k < count - 2000) {
    const centre: [number, number, number] = [(next() - 0.5) * 2e8, (next() - 0.5) * 2e8, (next() - 0.5) * 5e7];
    const radius = 2e5 + next() * 2e6;
    const brightest = put(...centre);
    const h = hosts.add(`g${brightest}`, [records[brightest * STRIDE]!, records[brightest * STRIDE + 1]!, records[brightest * STRIDE + 2]!], null, radius, radius);
    marks[brightest] = h;
    const n = 1 + Math.floor(next() * 12);
    for (let i = 0; i < n && k < count - 2000; i += 1) {
      const m = put(centre[0] + (next() - 0.5) * radius, centre[1] + (next() - 0.5) * radius, centre[2] + (next() - 0.5) * radius);
      host[m] = h;
      separationPc[m] = hosts.distancePc(h, [records[m * STRIDE]!, records[m * STRIDE + 1]!, records[m * STRIDE + 2]!]);
    }
  }
  while (k < count) put((next() - 0.5) * 2e8, (next() - 0.5) * 2e8, (next() - 0.5) * 5e7);
  return { hosts, records, folds: { marks, host, separationPc }, reachPc, count, next };
}

function cameraLookingAt(at: readonly [number, number, number], look: readonly [number, number, number]): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 16 / 9, 1, 1e12);
  c.position.set(...at);
  c.lookAt(new THREE.Vector3(...look));
  c.updateProjectionMatrix();
  return c;
}

function marksOf(records: Float32Array, count: number, value: Float32Array): Marks {
  return {
    centres: Array.from({ length: count }, (_, k) => ({ x: records[k * STRIDE]!, y: records[k * STRIDE + 1]!, z: records[k * STRIDE + 2]! })),
    shown: new THREE.BufferAttribute(new Float32Array(count), 1),
    order: Array.from({ length: count }, (_, k) => k),
    body: new Uint8Array(count),
    kept: new Uint8Array(count).fill(1),
    folds: { host: new Int32Array(count), separationPc: new Float32Array(count), value },
  };
}

describe('MarkState', () => {
  it('works out the same strengths as the pass over every galaxy, from near and far', () => {
    const { hosts, records, folds, reachPc, count, next } = synthetic(1);
    const state = new MarkState(laniakeaMarkIndex(records, STRIDE, folds, reachPc));
    const sparse = new Float32Array(count);
    const full = new Float32Array(count);
    let nonzero = 0;
    for (let trial = 0; trial < 80; trial += 1) {
      // From beside a galaxy to far outside them all.
      const near = Math.floor(next() * count);
      const scale = 10 ** (next() * 9);
      const camera: [number, number, number] = [
        records[near * STRIDE]! + (next() - 0.5) * scale,
        records[near * STRIDE + 1]! + (next() - 0.5) * scale,
        records[near * STRIDE + 2]! + (next() - 0.5) * scale,
      ];
      const css = 500 + next() * 1500;
      hosts.update(camera, css, trial % 7 === 0 ? [Math.floor(next() * hosts.count)] : []);
      const focus = trial % 5 === 0 ? Math.floor(next() * count) : -1;
      referenceStrengths(hosts, records, folds, reachPc, camera, css, focus, full);
      state.strengths(hosts, records, STRIDE, reachPc, camera, css, focus, sparse);
      expect(Array.from(sparse)).toEqual(Array.from(full));
      nonzero += full.filter((v) => v !== 0).length;
    }
    // Not a test of nothing: some marks were there.
    expect(nonzero).toBeGreaterThan(100);
  });

  it('with the declutter, leaves every mark as the full passes did, frame after frame', () => {
    const { hosts, records, folds, reachPc, count } = synthetic(2);
    const state = new MarkState(laniakeaMarkIndex(records, STRIDE, folds, reachPc));
    const fullValue = new Float32Array(count);
    const sparseValue = new Float32Array(count);
    const full = marksOf(records, count, fullValue);
    const sparse = { ...marksOf(records, count, sparseValue), centres: full.centres };
    const bodies = [3, 900, 4500];
    for (const b of bodies) {
      full.body[b] = 1;
      sparse.body[b] = 1;
    }
    const target: [number, number, number] = [records[0]!, records[1]!, records[2]!];
    for (let frame = 0; frame < 60; frame += 1) {
      const distance = 3e6 * 1.08 ** frame;
      const angle = frame * 0.11;
      const eye: [number, number, number] = [target[0] + distance * Math.cos(angle), target[1] + distance * Math.sin(angle), target[2] + 0.3 * distance];
      const camera = cameraLookingAt(eye, target);
      const css = 1080 / (2 * Math.tan((50 * Math.PI) / 360));
      hosts.update(eye, css, []);
      const at = new THREE.Vector3(...eye);
      referenceStrengths(hosts, records, folds, reachPc, eye, css, -1, fullValue);
      declutterMarks(full, camera, at, 1920, 1080);
      state.strengths(hosts, records, STRIDE, reachPc, eye, css, -1, sparseValue);
      declutterMarks(sparse, camera, at, 1920, 1080, state.candidates(bodies));
      state.settle(sparse.shown.array as Float32Array, sparse.kept);
      expect(Array.from(sparse.shown.array)).toEqual(Array.from(full.shown.array));
      expect(Array.from(sparse.kept)).toEqual(Array.from(full.kept));
    }
  });

  const dir = join(import.meta.dirname, '../../public/data/laniakea/');
  // The catalogue is built in CI, not kept in the repository: tested where it has been built.
  it.skipIf(!existsSync(dir + 'laniakea.json'))('works out the same strengths for the real catalogue, from Laniakea’s view and nearer', () => {
    const info = parseLaniakeaInfo(JSON.parse(readFileSync(dir + 'laniakea.json', 'utf8')));
    const bytes = readFileSync(dir + 'galaxies.bin');
    const records = parseGalaxyRecords(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), info.galaxies.count);
    const basinBytes = existsSync(dir + 'basins.bin') ? readFileSync(dir + 'basins.bin') : null;
    const basins =
      basinBytes === null ? null : parseBasins(basinBytes.buffer.slice(basinBytes.byteOffset, basinBytes.byteOffset + basinBytes.byteLength), info);
    const c = indexLaniakea(info, records, basins);
    const folds = laniakeaFolds(c);
    const reachPc = new Float32Array(c.count);
    for (let k = 0; k < c.count; k += 1) reachPc[k] = 10 * Math.max(1000, records[k * STRIDE + FIELD.rePc]! || 0);
    const state = new MarkState(laniakeaMarkIndex(records, STRIDE, folds, reachPc));
    const sparse = new Float32Array(c.count);
    const full = new Float32Array(c.count);
    const css = 1080 / (2 * Math.tan((50 * Math.PI) / 360));
    for (const camera of [
      [1.6e8, 2e7, -3e7],
      [3e7, 1e7, 5e6],
      [records[100 * STRIDE]! + 2e6, records[100 * STRIDE + 1]!, records[100 * STRIDE + 2]!],
      [records[5000 * STRIDE]! + 2e5, records[5000 * STRIDE + 1]!, records[5000 * STRIDE + 2]!],
      [1.3e10, 0, 0],
    ] as [number, number, number][]) {
      MARK_HOSTS.update(camera, css, []);
      referenceStrengths(MARK_HOSTS, records, folds, reachPc, camera, css, -1, full);
      state.strengths(MARK_HOSTS, records, STRIDE, reachPc, camera, css, -1, sparse);
      expect(Array.from(sparse)).toEqual(Array.from(full));
    }
  });
});
