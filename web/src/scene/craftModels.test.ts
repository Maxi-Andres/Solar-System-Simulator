import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CATALOG } from '@sss/tools/catalog';
import type { CraftShape } from '@sss/tools/types';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { describe, expect, it } from 'vitest';

import { craftOrientation } from './craftModels.ts';

const MODELS = join(import.meta.dirname, '../../public/models');

const shapes = CATALOG.flatMap((body) =>
  body.mission === null || body.mission.shape === null
    ? []
    : [{ id: body.id, shape: body.mission.shape }],
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
  'ace.glb': [921.52, 277.99, 1345.3],
  'dscovr.glb': [266.37, 96.4, 102.54],
  'soho.glb': [43.27, 14.43, 17.34],
  'roman.glb': [411.92, 131.23, 364.08],
  'tess.glb': [37.1, 18.27, 15.97],
  'stereo.glb': [3142.19, 2425.18, 2434.48],
  'osiris-rex.glb': [13.72, 12.01, 34.65],
  'cassini.glb': [17.98, 11.66, 13.11],
  'dawn.glb': [19.7, 2.2, 2.22],
  'kepler.glb': [2.65, 5.01, 2.66],
  'spitzer.glb': [1.62, 4.49, 2.11],
  'wind.glb': [41.62, 52.43, 37.3],
  'dart.glb': [40.34, 4.46, 5.45],
  'mro.glb': [13.18, 4.88, 6.71],
  'maven.glb': [13.13, 5.42, 8.22],
  'odyssey.glb': [5.67, 3.36, 8.22],
  'lro.glb': [5.45, 3.66, 5.51],
  'juno.glb': [17.65, 4.26, 18.54],
  'themis.glb': [6.09, 7.21, 6.09],
};

/**
 * One published dimension per model, and the axis of the file it is measured along:
 * the model's extent there, times its catalog factor, must come out at it. For the
 * metre-scale models this is the check that they are in metres; for the others it is
 * the factor itself. Sources are in SHAPES and MORE_SHAPES.
 */
const PUBLISHED: Record<string, { readonly axis: 0 | 1 | 2; readonly metres: number; readonly within: number }> = {
  'europa-clipper.glb': { axis: 0, metres: 30.5, within: 0.01 },
  'jwst.glb': { axis: 2, metres: 21.197, within: 0.02 },
  'dawn.glb': { axis: 0, metres: 20, within: 0.02 },
  'kepler.glb': { axis: 1, metres: 4.7, within: 0.07 },
  'spitzer.glb': { axis: 1, metres: 4.5, within: 0.01 },
  'ace.glb': { axis: 2, metres: 8.3, within: 0.01 },
  'dscovr.glb': { axis: 0, metres: 6.1, within: 0.01 },
  'soho.glb': { axis: 0, metres: 9.5, within: 0.01 },
  'roman.glb': { axis: 0, metres: 12.8, within: 0.01 },
  'tess.glb': { axis: 0, metres: 3.9, within: 0.01 },
  'stereo.glb': { axis: 0, metres: 6.47, within: 0.01 },
  'osiris-rex.glb': { axis: 2, metres: 6.2, within: 0.01 },
  'dart.glb': { axis: 0, metres: 18.3, within: 0.01 },
  'mro.glb': { axis: 0, metres: 13.6, within: 0.04 },
  'maven.glb': { axis: 0, metres: 11.4, within: 0.01 },
  'odyssey.glb': { axis: 0, metres: 5.7, within: 0.01 },
  'juno.glb': { axis: 2, metres: 20, within: 0.08 },
  // Wind is scaled by its drum, which is not an extent of the file: its booms are.
};

interface MeshoptView {
  readonly buffer: number;
  readonly byteOffset?: number;
  readonly byteLength: number;
  readonly byteStride: number;
  readonly count: number;
  readonly mode: 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES';
  readonly filter?: 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL';
}

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
    readonly primitives: readonly {
      readonly attributes: { readonly POSITION: number };
    }[];
  }[];
  readonly accessors: readonly {
    readonly bufferView: number;
    readonly byteOffset?: number;
    readonly componentType: number;
    readonly normalized?: boolean;
    readonly count: number;
  }[];
  readonly bufferViews: readonly {
    readonly byteOffset?: number;
    readonly byteLength: number;
    readonly byteStride?: number;
    readonly extensions?: { readonly EXT_meshopt_compression?: MeshoptView };
  }[];
}

/** A GLB's JSON and its binary chunk. */
async function readGlb(file: string): Promise<{ gltf: Gltf; bin: Uint8Array }> {
  const bytes = await readFile(join(MODELS, file));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf;
  const binStart = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binStart);
  return {
    gltf,
    bin: new Uint8Array(bytes.buffer, bytes.byteOffset + binStart + 8, binLength),
  };
}

/** A buffer view's bytes, decoded from meshopt where it is compressed, and its stride. */
async function viewBytes(
  gltf: Gltf,
  bin: Uint8Array,
  index: number,
): Promise<{ bytes: Uint8Array; stride: number }> {
  const view = gltf.bufferViews[index]!;
  const meshopt = view.extensions?.EXT_meshopt_compression;
  if (meshopt !== undefined) {
    await MeshoptDecoder.ready;
    const out = new Uint8Array(meshopt.count * meshopt.byteStride);
    const start = meshopt.byteOffset ?? 0;
    MeshoptDecoder.decodeGltfBuffer(
      out,
      meshopt.count,
      meshopt.byteStride,
      bin.subarray(start, start + meshopt.byteLength),
      meshopt.mode,
      meshopt.filter ?? 'NONE',
    );
    return { bytes: out, stride: meshopt.byteStride };
  }
  const start = view.byteOffset ?? 0;
  return {
    bytes: bin.subarray(start, start + view.byteLength),
    stride: view.byteStride ?? 0,
  };
}

/** Bytes per component, and how a normalised one is scaled back to [-1, 1] or [0, 1]. */
const COMPONENTS: Record<
  number,
  { size: number; scale: number; read: (d: DataView, o: number) => number }
> = {
  5120: { size: 1, scale: 127, read: (d, o) => d.getInt8(o) },
  5121: { size: 1, scale: 255, read: (d, o) => d.getUint8(o) },
  5122: { size: 2, scale: 32767, read: (d, o) => d.getInt16(o, true) },
  5123: { size: 2, scale: 65535, read: (d, o) => d.getUint16(o, true) },
  5126: { size: 4, scale: 1, read: (d, o) => d.getFloat32(o, true) },
};

/**
 * The model's bounds in its own frame: every vertex, decoded and dequantised, through
 * its node's world transform. Exact, whatever the nodes do -- an earlier version
 * transformed each primitive's min/max box instead, and a rotated node turned that box
 * into a larger one.
 */
async function extentOf(file: string): Promise<[number, number, number]> {
  const { gltf, bin } = await readGlb(file);
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  const visit = async (index: number, parent: THREE.Matrix4): Promise<void> => {
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
        const component = COMPONENTS[accessor.componentType]!;
        const { bytes, stride } = await viewBytes(gltf, bin, accessor.bufferView);
        const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const step = stride || component.size * 3;
        // A normalised signed integer maps its most negative value to -1 as well.
        const value =
          accessor.normalized === true
            ? (at: number) => Math.max(component.read(data, at) / component.scale, -1)
            : (at: number) => component.read(data, at);
        for (let i = 0; i < accessor.count; i += 1) {
          const at = (accessor.byteOffset ?? 0) + i * step;
          point
            .set(value(at), value(at + component.size), value(at + 2 * component.size))
            .applyMatrix4(world);
          bounds.expandByPoint(point);
        }
      }
    }
    for (const child of node.children ?? []) {
      await visit(child, world);
    }
  };
  for (const root of gltf.scenes[gltf.scene ?? 0]!.nodes) {
    await visit(root, new THREE.Matrix4());
  }
  const size = bounds.getSize(new THREE.Vector3());
  return [size.x, size.y, size.z];
}

describe('the spacecraft models', () => {
  it('gives every craft but two a shape: a model, or a box of positive size', () => {
    // Gaia and Aditya-L1 have no three published dimensions, and keep their markers.
    expect(shapes).toHaveLength(49);
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

  it.each(Object.keys(PUBLISHED))('%s comes out at its published size', async (file) => {
    const { axis, metres, within } = PUBLISHED[file]!;
    const shape = shapes.find(({ shape }) => shape.model === file)!.shape;
    const extent = (await extentOf(file))[axis]! * shape.metresPerUnit;
    expect(Math.abs(extent - metres) / metres).toBeLessThan(within);
  });
});

describe('craftOrientation', () => {
  const shape: CraftShape = {
    model: null,
    metresPerUnit: 1,
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
