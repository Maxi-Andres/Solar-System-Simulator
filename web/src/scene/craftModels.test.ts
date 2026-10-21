import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CATALOG } from '@sss/tools/catalog';
import { NAMED_SATELLITES } from '@sss/tools/satellites/named';
import type { CraftShape } from '@sss/tools/types';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { describe, expect, it, vi } from 'vitest';

import {
  countTriangles,
  craftModelTriangles,
  craftOrientation,
  ESA_MODEL_CREDIT,
  loadCraftModel,
  PLANET_SPHERE_TRIANGLES,
  releaseCraftModel,
  SHAPE_KEEP_FRACTION,
  SHAPE_SHOWN_PX,
  shapeShownPx,
  shapeVisible,
} from './craftModels.ts';
import { MARKER_FULL_PX, MESH_FADE_START_PX } from './scale.ts';

/**
 * The loader, for the one test that loads through `loadCraftModel`: a scene of a box, a
 * box instanced three times and a cloud of points, which records every walk over it.
 * The tests that measure the real files read them directly and never get here.
 */
const loadedScenes: { walks: number }[] = [];
function modelScene(): THREE.Object3D {
  const scene = new THREE.Group();
  const record = { walks: 0 };
  loadedScenes.push(record);
  const traverse = scene.traverse.bind(scene);
  scene.traverse = (callback) => {
    record.walks += 1;
    traverse(callback);
  };
  const material = new THREE.MeshStandardMaterial();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  scene.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 3));
  scene.add(new THREE.Points(new THREE.BoxGeometry(), new THREE.PointsMaterial()));
  return scene;
}
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder() {
      return this;
    }
    loadAsync() {
      return Promise.resolve({ scene: modelScene() });
    }
  },
}));

const MODELS = join(import.meta.dirname, '../../public/models');

const craftShapes = CATALOG.flatMap((body) =>
  body.mission === null || body.mission.shape === null
    ? []
    : [{ id: body.id, shape: body.mission.shape }],
);

/** The named Earth satellites' shapes, as named.json carries them: see named.ts. */
const satelliteShapes = NAMED_SATELLITES.flatMap((entry) =>
  entry.look === null ? [] : [{ id: `sat-${entry.id}`, shape: entry.look.shape as CraftShape }],
);

const shapes = [...craftShapes, ...satelliteShapes];

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
  'curiosity.glb': [2.78, 2.22, 3.95],
  // Posed, mast raised: NASA's file stands 1.85 m tall with it stowed.
  'perseverance.glb': [2.71, 2.23, 3.11],
  'insight.glb': [6.14, 2.19, 4.35],
  'juice.glb': [16.6, 13.63, 26.76],
  'solar-orbiter.glb': [674.1, 1406.6, 1790.8],
  'bepicolombo.glb': [2998.5, 837.8, 616.5],
  'hera.glb': [2.15, 2.16, 11.45],
  'euclid.glb': [339.1, 529.5, 340.6],
  'gaia.glb': [197.46, 79.24, 197.44],
  'mars-express.glb': [1226.48, 1063.23, 4273.08],
  'exomars-tgo.glb': [5.76, 4.95, 17.69],
  'lucy.glb': [15.6, 7.07, 3.214],
  'psyche.glb': [24.737, 4.944, 7.338],
  'imap.glb': [5.311, 1.425, 2.834],
  'escapade.glb': [4.888, 2.732, 1.126],
  'capstone.glb': [1.426, 0.529, 0.33],
  'orion.glb': [17.63, 7.256, 11.283],
  'hayabusa2.glb': [4.241, 2.746, 5.999],
  'danuri.glb': [6.301, 2.793, 2.809],
  // The named Earth satellites' (satellites/looks.ts), measured on each source file.
  'iss.glb': [111.988, 68.784, 58.627],
  'hubble.glb': [11.067, 16.727, 12.361],
  'chandra.glb': [13.78, 5.138, 19.507],
  'xmm-newton.glb': [15.923, 4.364, 10.099],
  'swift.glb': [39.915, 29.44, 28.262],
  'fermi.glb': [8.546, 12.098, 62.308],
  'sdo.glb': [37.017, 30.747, 37.035],
  'mms.glb': [14.512, 8.51, 14.512],
  'smile.glb': [4.846, 3.521, 9.821],
  'terra.glb': [13621.761, 10276.638, 26053.829],
  'aqua.glb': [9.399, 17.777, 5.079],
  'aura.glb': [8.733, 18.7, 3.435],
  'landsat-8.glb': [4.97, 10.037, 12.259],
  'grace-fo.glb': [2.027, 1.0, 3.254],
  'smap.glb': [6.421, 9.516, 6.185],
  'icesat-2.glb': [3.796, 2.482, 10.056],
  'oco-2.glb': [7.627, 15.416, 39.865],
  'gpm.glb': [189.62, 268.404, 431.896],
  'sentinel-6.glb': [5.133, 2.324, 4.371],
  'cryosat-2.glb': [2.571, 1.911, 4.744],
  'suomi-npp.glb': [2.569, 4.183, 8.959],
  'goes-r.glb': [8.247, 12.097, 15.261],
  'tdrs-gen1.glb': [94.44, 21.242, 75.448],
  'tdrs-gen2.glb': [21.121, 5.759, 13.11],
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
  'curiosity.glb': { axis: 0, metres: 2.7, within: 0.04 },
  'perseverance.glb': { axis: 0, metres: 2.7, within: 0.01 },
  'insight.glb': { axis: 0, metres: 6, within: 0.03 },
  'juice.glb': { axis: 2, metres: 27.1, within: 0.02 },
  'solar-orbiter.glb': { axis: 2, metres: 18, within: 0.01 },
  'bepicolombo.glb': { axis: 0, metres: 30, within: 0.01 },
  'hera.glb': { axis: 2, metres: 11.5, within: 0.01 },
  // ESA's file, in centimetres like its siblings, is 13% taller than ESA's 4.7 m: its
  // antenna hangs below the body. Kept as ESA made it.
  'euclid.glb': { axis: 1, metres: 4.7, within: 0.14 },
  'gaia.glb': { axis: 0, metres: 10.2, within: 0.001 },
  'mars-express.glb': { axis: 0, metres: 12, within: 0.025 },
  'exomars-tgo.glb': { axis: 2, metres: 17.5, within: 0.015 },
  'lucy.glb': { axis: 0, metres: 15.82, within: 0.02 },
  'psyche.glb': { axis: 0, metres: 24.76, within: 0.01 },
  'escapade.glb': { axis: 0, metres: 4.88, within: 0.01 },
  'hayabusa2.glb': { axis: 2, metres: 6, within: 0.01 },
  'danuri.glb': { axis: 0, metres: 6.3, within: 0.01 },
  // The named Earth satellites'; sources in satellites/looks.ts.
  'iss.glb': { axis: 0, metres: 109, within: 0.03 },
  'chandra.glb': { axis: 2, metres: 19.5, within: 0.01 },
  'xmm-newton.glb': { axis: 0, metres: 16, within: 0.01 },
  'swift.glb': { axis: 1, metres: 5.64, within: 0.001 },
  'fermi.glb': { axis: 2, metres: 15, within: 0.001 },
  'sdo.glb': { axis: 2, metres: 6.25, within: 0.001 },
  'smile.glb': { axis: 2, metres: 9.8, within: 0.01 },
  'terra.glb': { axis: 0, metres: 6.8, within: 0.001 },
  'aqua.glb': { axis: 1, metres: 16.7, within: 0.07 },
  'aura.glb': { axis: 1, metres: 17.37, within: 0.08 },
  'grace-fo.glb': { axis: 2, metres: 3.123, within: 0.05 },
  'smap.glb': { axis: 1, metres: 9.7, within: 0.02 },
  'icesat-2.glb': { axis: 2, metres: 10, within: 0.01 },
  'oco-2.glb': { axis: 2, metres: 9, within: 0.001 },
  'gpm.glb': { axis: 2, metres: 11.6, within: 0.001 },
  'sentinel-6.glb': { axis: 0, metres: 5.13, within: 0.01 },
  'cryosat-2.glb': { axis: 2, metres: 4.6, within: 0.04 },
  'tdrs-gen1.glb': { axis: 0, metres: 17.4, within: 0.001 },
  'tdrs-gen2.glb': { axis: 0, metres: 21, within: 0.01 },
  // IMAP's box is its boom; CAPSTONE's arrays are unpublished; Orion's span is the
  // diagonal of its X of wings, 19.34 m, along no one axis of the file.
  // Wind is scaled by its drum, which is not an extent of the file: its booms are; so is
  // MMS. Hubble's file is longer than the telescope by its open aperture door: see below.
  // Landsat's, Suomi NPP's and GOES-R's overall sizes are unpublished.
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
    readonly extensions?: {
      readonly EXT_mesh_gpu_instancing?: { readonly attributes: Record<string, number> };
    };
  }[];
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: { readonly POSITION: number };
      readonly indices?: number;
      readonly mode?: number;
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
  const size = (await boundsOf(file)).getSize(new THREE.Vector3());
  return [size.x, size.y, size.z];
}

/** The same bounds, as a box. */
async function boundsOf(file: string): Promise<THREE.Box3> {
  const bounds = new THREE.Box3();
  await forEachVertex(file, (point) => bounds.expandByPoint(point));
  return bounds;
}

/** The median of every vertex, axis by axis: where the dense body of the craft is. */
async function medianOf(file: string): Promise<[number, number, number]> {
  const axes: [number[], number[], number[]] = [[], [], []];
  await forEachVertex(file, (point) => {
    axes[0].push(point.x);
    axes[1].push(point.y);
    axes[2].push(point.z);
  });
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1]!;
  return [median(axes[0]), median(axes[1]), median(axes[2])];
}

/** Every vertex of the model, decoded, dequantised and through its node's transform. */
async function forEachVertex(
  file: string,
  visitPoint: (point: THREE.Vector3) => void,
): Promise<void> {
  const { gltf, bin } = await readGlb(file);
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
          visitPoint(point);
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
}

describe('the spacecraft models', () => {
  it('gives every craft but two a shape: a model, or a box of positive size', () => {
    // Aditya-L1 has no three published dimensions, and keeps its marker.
    expect(craftShapes).toHaveLength(53);
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

  it.each(shapes.filter(({ shape }) => shape.model !== null))(
    '$id is placed by the dense body of its model, not where its file’s origin fell',
    async ({ id, shape }) => {
      // The trail ends at the craft's centre of mass; the model must sit on it. See
      // CraftShape.pivot. A craft on the ground stands on its origin instead.
      const onGround = shape.pointsAt === 'zenith';
      expect(shape.pivot === undefined, id).toBe(onGround);
      if (onGround) {
        return;
      }
      const median = await medianOf(shape.model!);
      const span = Math.max(...(await extentOf(shape.model!)));
      for (let axis = 0; axis < 3; axis += 1) {
        expect(Math.abs(shape.pivot![axis]! - median[axis]!), id).toBeLessThan(0.002 * span);
      }
    },
    60_000,
  );

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

  it.each(['curiosity.glb', 'perseverance.glb', 'insight.glb'])(
    '%s stands on its origin, which is placed on the ground',
    async (file) => {
      // Wheels or feet at y = 0, give or take InSight's 2.8 cm of seismometer below them.
      expect(Math.abs((await boundsOf(file)).min.y)).toBeLessThan(0.03);
    },
  );

  it('hubble.glb is as long as Hubble, aft bulkhead to the light shield’s rim', async () => {
    // The tube's wall, between 1.9 and 2.4 m off the optical axis (y): its length is
    // NASA's 13.3 m within 3%, the aperture door, open above it, left out.
    let low = Infinity;
    let high = -Infinity;
    await forEachVertex('hubble.glb', (point) => {
      const r = Math.hypot(point.x, point.z);
      if (r > 1.9 && r < 2.4) {
        low = Math.min(low, point.y);
        high = Math.max(high, point.y);
      }
    });
    expect(Math.abs(high - low - 13.3) / 13.3).toBeLessThan(0.03);
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

  it('flies the ISS in LVLH: +Z to Earth, +X along its velocity', () => {
    // NASA's ISS axes on the model: +X the modules' forward end, Harmony, at model +z; +Z
    // nadir, the side away from the truss, at model -y. See satellites/shapes.ts.
    const iss = satelliteShapes.find(({ id }) => id === 'sat-iss')!.shape;
    expect(iss.pointsAt).toBe('nadir');
    const toEarth = { x: -6000, y: 2500, z: 1800 };
    const velocity = { x: 1.2, y: 4.1, z: -5.9 };
    const q = craftOrientation(iss, toEarth, new THREE.Quaternion(), velocity);
    const nadir = new THREE.Vector3(toEarth.x, toEarth.y, toEarth.z).normalize();
    expect(turned(iss.pointingAxis, q).distanceTo(nadir)).toBeLessThan(1e-9);
    // Forward is the velocity with its radial part taken out: the local horizontal.
    const v = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const horizontal = v.addScaledVector(nadir, -v.dot(nadir)).normalize();
    expect(turned(iss.rollAxis, q).distanceTo(horizontal)).toBeLessThan(1e-9);
    expect(turned([0, -1, 0], q).distanceTo(nadir)).toBeLessThan(1e-9);
    expect(turned([0, 0, 1], q).distanceTo(horizontal)).toBeLessThan(1e-9);
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

/**
 * Triangles a model file draws, from its JSON alone: every primitive of every node in
 * the scene, times the node's instances. The same count `countTriangles` makes of the
 * loaded scene, since the loader turns each primitive into one mesh and each instanced
 * node into one InstancedMesh. Every primitive in these files is a triangle list.
 */
async function trianglesOf(file: string): Promise<number> {
  const { gltf } = await readGlb(file);
  let triangles = 0;
  const visit = (index: number): void => {
    const node = gltf.nodes[index]!;
    if (node.mesh !== undefined) {
      const instancing = node.extensions?.EXT_mesh_gpu_instancing;
      const copies =
        instancing === undefined
          ? 1
          : gltf.accessors[Object.values(instancing.attributes)[0]!]!.count;
      for (const primitive of gltf.meshes[node.mesh]!.primitives) {
        expect(primitive.mode ?? 4, file).toBe(4);
        const corners = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION]!.count;
        triangles += (corners / 3) * copies;
      }
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const root of gltf.scenes[gltf.scene ?? 0]!.nodes) {
    visit(root);
  }
  return triangles;
}

/**
 * The heaviest models and a few light ones, as measured on the files; the numbers
 * craftModels.ts reasons with. A re-export that changed them should be looked at.
 */
const TRIANGLES: Record<string, number> = {
  'juice.glb': 959_923,
  'icesat-2.glb': 751_736,
  'gpm.glb': 282_774,
  'sdo.glb': 272_770,
  'iss.glb': 247_547,
  'xmm-newton.glb': 17_178,
  'grace-fo.glb': 3_652,
  'hera.glb': 479_908,
  'dart.glb': 446_397,
  'hayabusa2.glb': 207_891,
  'europa-clipper.glb': 203_662,
  'perseverance.glb': 199_471,
  'osiris-rex.glb': 184_407,
  'insight.glb': 178_079,
  'euclid.glb': 136_061,
  'orion.glb': 112_517,
  'bepicolombo.glb': 111_536,
  'danuri.glb': 66_949,
  'imap.glb': 66_405,
  'voyager.glb': 20_390,
  'juno.glb': 17_124,
  'solar-orbiter.glb': 9_596,
  'capstone.glb': 5_025,
};

describe('when a shape is worth its triangles', () => {
  it('measures the yardstick on a planet’s own sphere, 64 segments by 32', () => {
    const sphere = new THREE.SphereGeometry(1, 64, 32);
    expect(sphere.index!.count / 3).toBe(PLANET_SPHERE_TRIANGLES);
    // Drawn whole down to the same radius as the lightest shape.
    expect(SHAPE_SHOWN_PX).toBe(MESH_FADE_START_PX);
  });

  it.each(Object.keys(TRIANGLES))('%s draws the triangles the reasoning uses', async (file) => {
    expect(await trianglesOf(file)).toBe(TRIANGLES[file]);
  });

  it('draws a sphere’s worth of triangles from where the sphere is drawn', () => {
    expect(shapeShownPx(PLANET_SPHERE_TRIANGLES)).toBeCloseTo(MESH_FADE_START_PX, 12);
    // Four times the triangles, twice the radius: the same triangles per pixel.
    expect(shapeShownPx(4 * PLANET_SPHERE_TRIANGLES)).toBeCloseTo(2 * MESH_FADE_START_PX, 12);
  });

  it('draws a light model early and a heavy one only from where the marker fades', () => {
    expect(shapeShownPx(TRIANGLES['capstone.glb']!)).toBeCloseTo(1.69, 2);
    expect(shapeShownPx(TRIANGLES['solar-orbiter.glb']!)).toBeCloseTo(2.33, 2);
    expect(shapeShownPx(TRIANGLES['voyager.glb']!)).toBeCloseTo(3.4, 2);
    // The ISS's 247,547 are drawn from 4 px too, where it is 4,900 triangles a pixel: never
    // at a speck while the marker stands in for it.
    for (const file of ['juice.glb', 'orion.glb', 'europa-clipper.glb', 'perseverance.glb', 'iss.glb', 'icesat-2.glb']) {
      expect(shapeShownPx(TRIANGLES[file]!), file).toBe(MARKER_FULL_PX);
    }
  });

  it('never waits past the marker’s fade, nor draws below the floor', () => {
    expect(shapeShownPx(1e9)).toBe(MARKER_FULL_PX);
    // A box of a craft with no model: 12 triangles.
    expect(shapeShownPx(12)).toBe(SHAPE_SHOWN_PX);
    expect(shapeShownPx(0)).toBe(SHAPE_SHOWN_PX);
  });

  it('holds a shape it is drawing a little below where it started drawing it', () => {
    const shownPx = MARKER_FULL_PX;
    const keptPx = shownPx * SHAPE_KEEP_FRACTION;
    // Growing: drawn only past the threshold.
    expect(shapeVisible(shownPx - 0.01, shownPx, false)).toBe(false);
    expect(shapeVisible(shownPx + 0.01, shownPx, false)).toBe(true);
    // Shrinking: kept through the band, so it does not blink at the edge.
    expect(shapeVisible(shownPx - 0.01, shownPx, true)).toBe(true);
    expect(shapeVisible(keptPx + 0.01, shownPx, true)).toBe(true);
    expect(shapeVisible(keptPx - 0.01, shownPx, true)).toBe(false);
    // Both edges where the marker is fully drawn over it.
    expect(keptPx).toBeLessThan(MARKER_FULL_PX);
  });

  it('counts triangles in every mesh and every instance, and nothing else', () => {
    const material = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    root.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 3));
    // Unindexed: three corners a triangle all the same.
    root.add(new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(), material));
    root.add(new THREE.Points(new THREE.BoxGeometry(), new THREE.PointsMaterial()));
    root.add(new THREE.LineSegments(new THREE.BoxGeometry(), new THREE.LineBasicMaterial()));
    expect(countTriangles(root)).toBe(12 + 36 + 12);
  });

  it('counts a file once as it loads, for every copy, and forgets it with the file', async () => {
    loadedScenes.length = 0;
    const file = 'counted.glb';
    expect(craftModelTriangles(file)).toBe(0);
    await Promise.all([loadCraftModel(file), loadCraftModel(file)]);
    expect(loadedScenes).toHaveLength(1);
    // Ready the moment a copy is in hand; one walk of the scene, for both copies.
    expect(craftModelTriangles(file)).toBe(12 + 36);
    expect(loadedScenes[0]!.walks).toBe(1);
    releaseCraftModel(file);
    releaseCraftModel(file);
    expect(craftModelTriangles(file)).toBe(0);
  });
});

describe('ESA’s models, by its written permission', () => {
  const esa = shapes.filter(({ shape }) => shape.modelOwner === 'ESA');

  it('are every ESA craft here, each drawn with ESA’s own model', () => {
    // The first permission named six; the second covers ESA's models generally. Of the
    // named Earth satellites, Sentinel-2 has no ESA model published and Envisat's is not
    // to scale: both are boxes.
    expect(esa.map(({ id }) => id).sort()).toEqual(
      [
        'bepicolombo', 'euclid', 'exomars-tgo', 'gaia', 'hera', 'juice', 'mars-express',
        'solar-orbiter', 'sat-xmm-newton', 'sat-smile', 'sat-cryosat-2',
      ].sort(),
    );
  });

  it('carry the credit ESA asked for, word for word, wherever they are used', async () => {
    expect(ESA_MODEL_CREDIT).toBe('3D models © ESA (European Space Agency).');
    const info = await readFile(join(import.meta.dirname, '../ui/InfoPanel.tsx'), 'utf8');
    const about = await readFile(join(import.meta.dirname, '../ui/AboutPanel.tsx'), 'utf8');
    // An Earth satellite's panel is its own: XMM-Newton, SMILE and CryoSat-2 are ESA's.
    const satellite = await readFile(join(import.meta.dirname, '../ui/SatelliteFacts.tsx'), 'utf8');
    expect(info).toContain('ESA_MODEL_CREDIT');
    expect(about).toContain('ESA_MODEL_CREDIT');
    expect(satellite).toContain('ESA_MODEL_CREDIT');
  });

  it('are recorded as ESA’s, by permission, in the credits', async () => {
    const credits = await readFile(join(MODELS, 'CREDITS.md'), 'utf8');
    expect(credits).toContain(ESA_MODEL_CREDIT);
    for (const { id, shape } of esa) {
      const file = shape.model!;
      const row = credits.split(/\r?\n/).find((line) => line.startsWith('| `' + file + '`'));
      expect(row, id).toContain('ESA, by permission');
    }
  });
});
