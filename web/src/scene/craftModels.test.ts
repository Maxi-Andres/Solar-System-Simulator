import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CATALOG } from '@sss/tools/catalog';
import type { CraftShape } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { craftOrientation } from './craftModels.ts';

const MODELS = join(import.meta.dirname, '../../public/models');

const shapes = CATALOG.flatMap((body) =>
  body.mission === null ? [] : [{ id: body.id, shape: body.mission.shape }],
);

/**
 * Each model's extent, x by y by z in metres, as measured on NASA's original file before
 * it was compressed (see web/public/models/CREDITS.md). The compressed file must still
 * measure the same: quantisation moves vertices by millimetres, and anything more means
 * the processing changed the model.
 */
const SOURCE_EXTENTS: Record<string, readonly [number, number, number]> = {
  'voyager.glb': [7.75, 11.04, 16.91],
  'pioneer.glb': [4.52, 8.25, 2.54],
  'new-horizons.glb': [2.48, 2.12, 2.98],
  'parker-solar-probe.glb': [5.75, 5.26, 6.61],
  'jwst.glb': [12.87, 11.26, 21.0],
  'europa-clipper.glb': [30.5, 11.25, 18.0],
};

interface Gltf {
  readonly scene?: number;
  readonly scenes: readonly { readonly nodes: readonly number[] }[];
  readonly nodes: readonly {
    readonly children?: readonly number[];
    readonly mesh?: number;
    readonly matrix?: readonly number[];
    readonly translation?: readonly number[];
    readonly rotation?: readonly number[];
    readonly scale?: readonly number[];
  }[];
  readonly meshes: readonly {
    readonly primitives: readonly { readonly attributes: { readonly POSITION: number } }[];
  }[];
  readonly accessors: readonly {
    readonly componentType: number;
    readonly normalized?: boolean;
    readonly min: readonly number[];
    readonly max: readonly number[];
  }[];
}

/** The JSON chunk of a GLB: everything a bounding box needs, without decoding a vertex. */
async function readGltf(file: string): Promise<Gltf> {
  const bytes = await readFile(join(MODELS, file));
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')) as Gltf;
}

/** A normalised integer accessor's stored value, back to the float it stands for. */
function dequantise(value: number, componentType: number, normalized: boolean): number {
  if (!normalized) {
    return value;
  }
  const scale = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[componentType] ?? 1;
  return Math.max(value / scale, -1);
}

/**
 * The model's bounds in its own frame, metres: every primitive's POSITION min and max,
 * dequantised, through its node's world transform. The corners of each box are
 * transformed, which is exact for the translation-and-scale nodes quantisation adds.
 */
async function extentOf(file: string): Promise<[number, number, number]> {
  const gltf = await readGltf(file);
  const bounds = new THREE.Box3();
  const visit = (index: number, parent: THREE.Matrix4): void => {
    const node = gltf.nodes[index]!;
    const local = new THREE.Matrix4();
    if (node.matrix !== undefined) {
      local.fromArray(node.matrix);
    } else {
      const [tx, ty, tz] = node.translation ?? [0, 0, 0];
      const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
      const [sx, sy, sz] = node.scale ?? [1, 1, 1];
      local.compose(
        new THREE.Vector3(tx, ty, tz),
        new THREE.Quaternion(qx, qy, qz, qw),
        new THREE.Vector3(sx, sy, sz),
      );
    }
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh]!.primitives) {
        const accessor = gltf.accessors[primitive.attributes.POSITION]!;
        const normalized = accessor.normalized === true;
        const min = accessor.min.map((v) => dequantise(v, accessor.componentType, normalized));
        const max = accessor.max.map((v) => dequantise(v, accessor.componentType, normalized));
        for (const x of [min[0]!, max[0]!]) {
          for (const y of [min[1]!, max[1]!]) {
            for (const z of [min[2]!, max[2]!]) {
              bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(world));
            }
          }
        }
      }
    }
    for (const child of node.children ?? []) {
      visit(child, world);
    }
  };
  for (const root of gltf.scenes[gltf.scene ?? 0]!.nodes) {
    visit(root, new THREE.Matrix4());
  }
  const size = bounds.getSize(new THREE.Vector3());
  return [size.x, size.y, size.z];
}

describe('the spacecraft models', () => {
  it('gives every craft a shape: a model, or a box of positive size', () => {
    expect(shapes).toHaveLength(11);
    for (const { shape } of shapes) {
      if (shape.model === null) {
        expect(shape.boxM).not.toBeNull();
        for (const side of shape.boxM!) {
          expect(side).toBeGreaterThan(0);
        }
      } else {
        expect(shape.boxM).toBeNull();
      }
    }
  });

  it('points along two perpendicular unit axes', () => {
    for (const { shape } of shapes) {
      const a = new THREE.Vector3(...shape.pointingAxis);
      const b = new THREE.Vector3(...shape.rollAxis);
      expect(a.length()).toBeCloseTo(1, 12);
      expect(b.length()).toBeCloseTo(1, 12);
      expect(a.dot(b)).toBeCloseTo(0, 12);
    }
  });

  it('ships every model it uses, credited, and nothing it does not use', async () => {
    const files = (await readdir(MODELS)).filter((file) => file.endsWith('.glb')).sort();
    const used = [...new Set(shapes.flatMap(({ shape }) => (shape.model === null ? [] : [shape.model])))].sort();
    expect(files).toEqual(used);

    const credits = await readFile(join(MODELS, 'CREDITS.md'), 'utf8');
    for (const file of files) {
      expect(credits).toContain(`\`${file}\``);
    }
  });

  it.each(Object.keys(SOURCE_EXTENTS))('%s still measures what NASA’s file did, in metres', async (file) => {
    const extent = await extentOf(file);
    const expected = SOURCE_EXTENTS[file]!;
    for (let axis = 0; axis < 3; axis += 1) {
      expect(Math.abs(extent[axis]! - expected[axis]!)).toBeLessThan(0.02 * expected[axis]! + 0.01);
    }
  });

  it('is Europa Clipper at its published 30.5 m span', async () => {
    const [span] = await extentOf('europa-clipper.glb');
    expect(span).toBeCloseTo(30.5, 1);
  });
});

describe('craftOrientation', () => {
  const shape: CraftShape = {
    model: null,
    boxM: [1, 1, 1],
    pointsAt: 'earth',
    pointingPart: 'dish',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  };
  const turned = (axis: readonly [number, number, number], q: THREE.Quaternion) =>
    new THREE.Vector3(...axis).applyQuaternion(q);

  it('puts the pointing axis on the target', () => {
    const toEarth = { x: -3, y: 4, z: 0.5 };
    const q = craftOrientation(shape, toEarth);
    const pointing = turned(shape.pointingAxis, q);
    const expected = new THREE.Vector3(toEarth.x, toEarth.y, toEarth.z).normalize();
    expect(pointing.distanceTo(expected)).toBeLessThan(1e-9);
  });

  it('holds the roll axis toward ecliptic north, perpendicular to the pointing', () => {
    const q = craftOrientation(shape, { x: 1, y: 0, z: 0.2 });
    const roll = turned(shape.rollAxis, q);
    expect(roll.dot(turned(shape.pointingAxis, q))).toBeCloseTo(0, 9);
    expect(roll.z).toBeGreaterThan(0.95);
    expect(roll.y).toBeCloseTo(0, 9);
  });

  it('still has an answer with the target straight up the pole', () => {
    const q = craftOrientation(shape, { x: 0, y: 0, z: 1 });
    expect(turned(shape.pointingAxis, q).z).toBeCloseTo(1, 9);
    expect(Number.isFinite(q.w)).toBe(true);
  });

  it('turns a shield toward the Sun the same way, whatever axis it is on', () => {
    const parker: CraftShape = {
      ...shape,
      pointsAt: 'sun',
      pointingPart: 'heat-shield',
      pointingAxis: [0, 0, -1],
      rollAxis: [0, 1, 0],
    };
    const toSun = { x: 0.2, y: -1, z: 0 };
    const q = craftOrientation(parker, toSun);
    const expected = new THREE.Vector3(toSun.x, toSun.y, toSun.z).normalize();
    expect(turned(parker.pointingAxis, q).distanceTo(expected)).toBeLessThan(1e-9);
  });
});
