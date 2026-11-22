import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { declutterMarks, GALAXY_MARK_PX, MARK_HELD_FRACTION, type Marks } from './markDeclutter.ts';

/**
 * The declutter (markDeclutter.ts) gives what it gave before it was made cheap: the reference
 * below is the pass as it was (LocalGroup.tsx), a map of arrays and a projection through three's
 * Vector3, and every test runs both over the same frames and asks for the same marks, bit for bit.
 */

function referenceDeclutter(marks: Marks, frameCamera: THREE.Camera, cameraPc: THREE.Vector3, width: number, height: number): void {
  const SPRITE_PX = GALAXY_MARK_PX;
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  frameCamera.updateMatrixWorld();
  q.copy(frameCamera.quaternion).invert();
  const e = (frameCamera as THREE.PerspectiveCamera).projectionMatrix.elements;
  const cells = new Map<number, number[]>();
  const cellKey = (cx: number, cy: number) => cx * 100_003 + cy;
  const clear = (x: number, y: number, gap: number): boolean => {
    const cx = Math.floor(x / SPRITE_PX);
    const cy = Math.floor(y / SPRITE_PX);
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const placed = cells.get(cellKey(cx + i, cy + j));
        if (placed === undefined) continue;
        for (let p = 0; p < placed.length; p += 2) {
          if (Math.abs(placed[p]! - x) < gap && Math.abs(placed[p + 1]! - y) < gap) return false;
        }
      }
    }
    return true;
  };
  const place = (x: number, y: number): void => {
    const key = cellKey(Math.floor(x / SPRITE_PX), Math.floor(y / SPRITE_PX));
    const list = cells.get(key);
    if (list === undefined) cells.set(key, [x, y]);
    else list.push(x, y);
  };
  const onScreen = (i: number): readonly [number, number] | null => {
    const centre = marks.centres[i]!;
    v.set(centre.x - cameraPc.x, centre.y - cameraPc.y, centre.z - cameraPc.z).applyQuaternion(q);
    const depth = -v.z;
    if (depth <= 0) return null;
    const x = ((e[0]! * v.x) / depth + 1) * 0.5 * width;
    const y = (1 - (e[5]! * v.y) / depth) * 0.5 * height;
    return x < -SPRITE_PX || y < -SPRITE_PX || x > width + SPRITE_PX || y > height + SPRITE_PX ? null : [x, y];
  };
  let changed = false;
  const set = (i: number, keep: boolean): void => {
    marks.kept[i] = keep ? 1 : 0;
    const show = keep && marks.body[i] === 0 ? marks.folds.value[i]! : 0;
    const was = marks.shown.getX(i);
    if (was !== show && (Math.abs(was - show) > 1 / 512 || show === 0 || show === 1)) {
      marks.shown.setX(i, show);
      changed = true;
    }
  };
  for (const i of marks.order) {
    if (marks.body[i] === 1) {
      const at = onScreen(i);
      if (at !== null) place(at[0], at[1]);
      set(i, true);
    }
  }
  for (const i of marks.order) {
    if (marks.body[i] === 1) continue;
    if (marks.folds.value[i] === 0) {
      marks.kept[i] = 1;
      if (marks.shown.getX(i) !== 0) {
        marks.shown.setX(i, 0);
        changed = true;
      }
      continue;
    }
    const at = onScreen(i);
    if (at === null) {
      set(i, true);
      continue;
    }
    const keep = clear(at[0], at[1], marks.kept[i] === 1 ? SPRITE_PX * MARK_HELD_FRACTION : SPRITE_PX);
    if (keep) place(at[0], at[1]);
    set(i, keep);
  }
  if (changed) marks.shown.needsUpdate = true;
}

/** A seeded generator, so a failure can be run again. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeMarks(count: number, next: () => number): Marks {
  const centres = Array.from({ length: count }, () => ({ x: (next() - 0.5) * 200, y: (next() - 0.5) * 200, z: (next() - 0.5) * 200 }));
  const value = new Float32Array(count);
  for (let i = 0; i < count; i += 1) value[i] = next() < 0.3 ? 0 : next() < 0.5 ? 1 : next();
  const body = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) body[i] = next() < 0.03 ? 1 : 0;
  const order = Array.from({ length: count }, (_, i) => i).sort(() => next() - 0.5);
  return {
    centres,
    shown: new THREE.BufferAttribute(new Float32Array(count), 1),
    order,
    body,
    kept: new Uint8Array(count).fill(1),
    folds: { host: new Int32Array(count), separationPc: new Float32Array(count), value },
  };
}

function cloneMarks(m: Marks): Marks {
  return {
    centres: m.centres,
    shown: new THREE.BufferAttribute(Float32Array.from(m.shown.array as Float32Array), 1),
    order: m.order,
    body: Uint8Array.from(m.body),
    kept: Uint8Array.from(m.kept),
    folds: { host: m.folds.host, separationPc: m.folds.separationPc, value: Float32Array.from(m.folds.value) },
  };
}

function camera(at: THREE.Vector3, lookAt: THREE.Vector3): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1e6);
  c.position.copy(at);
  c.lookAt(lookAt);
  c.updateProjectionMatrix();
  return c;
}

describe('declutterMarks', () => {
  it('shows the same marks as the pass it replaced, frame after frame, as the camera moves', () => {
    const next = random(7);
    const a = makeMarks(3000, next);
    const b = cloneMarks(a);
    for (let frame = 0; frame < 40; frame += 1) {
      const angle = frame * 0.05;
      const eye = new THREE.Vector3(300 * Math.cos(angle), 40, 300 * Math.sin(angle));
      const cam = camera(eye, new THREE.Vector3(0, 0, 0));
      // The folds change as they would while the camera moves.
      for (let i = 0; i < 50; i += 1) {
        const k = Math.floor(next() * a.folds.value.length);
        const v = next() < 0.4 ? 0 : next();
        a.folds.value[k] = v;
        b.folds.value[k] = v;
      }
      referenceDeclutter(a, cam, eye, 1280, 720);
      declutterMarks(b, cam, eye, 1280, 720);
      expect(Array.from(b.shown.array)).toEqual(Array.from(a.shown.array));
      expect(Array.from(b.kept)).toEqual(Array.from(a.kept));
    }
  });

  it('given the marks that could change, leaves the rest as a full pass would', () => {
    const next = random(11);
    const a = makeMarks(2000, next);
    // Laniakea's: the declutter order is the index order.
    const ordered = { ...a, order: Array.from({ length: 2000 }, (_, i) => i) };
    const b = cloneMarks(ordered);
    let dirty: number[] = [];
    for (let frame = 0; frame < 30; frame += 1) {
      const eye = new THREE.Vector3(250 * Math.cos(frame * 0.07), -30, 250 * Math.sin(frame * 0.07));
      const cam = camera(eye, new THREE.Vector3(10, 0, 0));
      for (let i = 0; i < 80; i += 1) {
        const k = Math.floor(next() * 2000);
        const v = next() < 0.6 ? 0 : next();
        ordered.folds.value[k] = v;
        b.folds.value[k] = v;
      }
      // The candidates: marks not folded away, bodies, and those left shown or not kept.
      const set = new Set<number>(dirty);
      for (let i = 0; i < 2000; i += 1) if (b.folds.value[i] !== 0 || b.body[i] === 1) set.add(i);
      const list = Int32Array.from([...set].sort((x, y) => x - y));
      referenceDeclutter(ordered, cam, eye, 1280, 720);
      declutterMarks(b, cam, eye, 1280, 720, { list, count: list.length });
      expect(Array.from(b.shown.array)).toEqual(Array.from(ordered.shown.array));
      expect(Array.from(b.kept)).toEqual(Array.from(ordered.kept));
      dirty = [...list].filter((i) => b.shown.getX(i) !== 0 || b.kept[i] === 0);
    }
  });

  it('flags the buffer for upload only when a mark changed', () => {
    const next = random(3);
    const marks = makeMarks(200, next);
    const eye = new THREE.Vector3(0, 0, 300);
    const cam = camera(eye, new THREE.Vector3(0, 0, 0));
    declutterMarks(marks, cam, eye, 800, 600);
    const version = marks.shown.version;
    declutterMarks(marks, cam, eye, 800, 600);
    expect(marks.shown.version).toBe(version);
  });
});
