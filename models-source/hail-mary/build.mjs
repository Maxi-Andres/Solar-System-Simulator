// Builds the Hail Mary asset from the source GLB: bakes node transforms into the meshes, turns
// the ship to our frame (long axis +z, bow forward, stern at z = 0, metres, 40 m long), welds,
// simplifies each primitive to an absolute error bound with its borders locked, bakes ambient
// occlusion into COLOR_0, and writes an uncompressed copy (for comparison renders) and the
// compressed asset. Reads the source as data only.
//
// usage: node build.mjs <source.glb> <outDir> <fullErrorMetres> <lowErrorMetres>
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { weld, prune, dedup, quantize, meshopt, transformMesh, cloneDocument, compactPrimitive, mergeDocuments } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { mat4 } from 'gl-matrix';
import fs from 'node:fs';
import path from 'node:path';

const [source, outDir, fullError = '0.015', lowError = '0.12'] = process.argv.slice(2);
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const SHIP_LENGTH_M = 40;

function triangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) n += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
  return n;
}

/** Bakes every node's world transform and our frame into its mesh; leaves the nodes at identity. */
function toShipFrame(doc) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const bounds = getBounds(scene);
  const lengthAlongY = bounds.max[1] - bounds.min[1];
  const scale = SHIP_LENGTH_M / lengthAlongY;
  // y (the long axis, bow +y) onto +z, stern to z = 0, metres.
  const frame = mat4.create();
  mat4.translate(frame, frame, [0, 0, -bounds.min[1] * scale]);
  mat4.scale(frame, frame, [scale, scale, scale]);
  mat4.rotateX(frame, frame, Math.PI / 2);
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = mat4.multiply(mat4.create(), frame, node.getWorldMatrix());
    transformMesh(mesh, world);
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }
  return { scale, lengthAlongY };
}

/**
 * Simplifies each primitive to an absolute error, in metres; cheap primitives are left alone.
 *
 * Locked: only the vertices on a seam between materials (a position another primitive also
 * has), so neighbouring panels cannot crack apart. Every other border -- the open ends of the
 * thousands of bolts and pipes -- may move within the error, or the simplifier could hardly
 * touch the greebles that hold most of the triangles. `prune` lets components smaller than the
 * error go altogether: detail no pixel would show.
 */
function simplifyTo(doc, errorMetres, { prune = false, keepBelow = 300 } = {}) {
  const prims = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) prims.push(prim);
  // Which primitives each position belongs to, to a tenth of a millimetre.
  const owners = new Map();
  prims.forEach((prim, id) => {
    const p = prim.getAttribute('POSITION').getArray();
    for (let i = 0; i < p.length; i += 3) {
      const key = `${Math.round(p[i] * 1e4)},${Math.round(p[i + 1] * 1e4)},${Math.round(p[i + 2] * 1e4)}`;
      const set = owners.get(key);
      if (set === undefined) owners.set(key, id);
      else if (set !== id) owners.set(key, -1);
    }
  });
  const flags = prune ? ['ErrorAbsolute', 'Prune'] : ['ErrorAbsolute'];
  prims.forEach((prim) => {
    const indices = prim.getIndices().getArray();
    if (indices.length / 3 <= keepBelow) return;
    // The boxed radiator strips are already as simple as they get, and thin: pruning would
    // take them as detail below the error.
    if (prim.getMaterial()?.getName() === RADIATOR_MATERIAL && indices.length <= 7 * 36) return;
    const p = prim.getAttribute('POSITION').getArray();
    const positions = p instanceof Float32Array ? p : new Float32Array(p);
    const lock = new Uint8Array(positions.length / 3);
    for (let i = 0; i < lock.length; i += 1) {
      const key = `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
      if (owners.get(key) === -1) lock[i] = 1;
    }
    const source = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
    const [result] = MeshoptSimplifier.simplifyWithAttributes(source, positions, 3, new Float32Array(lock.length), 1, [0], lock, 0, errorMetres, flags);
    if (process.env.VERBOSE) {
      let locked = 0;
      for (const l of lock) locked += l;
      console.log('   ', prim.getMaterial()?.getName(), 'tris', indices.length / 3, '->', result.length / 3, 'verts', lock.length, 'locked', locked);
    }
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(result)).setBuffer(doc.getRoot().listBuffers()[0]));
    compactPrimitive(prim);
  });
}

/**
 * Removes the connected components (pieces) smaller than `minSize` metres across: bolts, rivets
 * and pipe stubs that would be under a pixel at the distance a level of detail is drawn from.
 */
function removeSmallComponents(doc, minSize, spare = '') {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMaterial()?.getName() === spare) continue;
      const idx = prim.getIndices().getArray();
      const pos = prim.getAttribute('POSITION').getArray();
      const parent = new Int32Array(pos.length / 3).map((_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      for (let i = 0; i < idx.length; i += 3) {
        const a = find(idx[i]);
        parent[find(idx[i + 1])] = a;
        parent[find(idx[i + 2])] = a;
      }
      const boxes = new Map();
      for (let v = 0; v < pos.length / 3; v += 1) {
        const r = find(v);
        let box = boxes.get(r);
        if (!box) boxes.set(r, (box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]));
        for (let a = 0; a < 3; a += 1) { box[a] = Math.min(box[a], pos[v * 3 + a]); box[a + 3] = Math.max(box[a + 3], pos[v * 3 + a]); }
      }
      const keep = [];
      for (let i = 0; i < idx.length; i += 3) {
        const box = boxes.get(find(idx[i]));
        if (Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) >= minSize) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      if (keep.length === 0) { prim.dispose(); continue; }
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)).setBuffer(doc.getRoot().listBuffers()[0]));
      compactPrimitive(prim);
    }
  }
}

/**
 * For the silhouette model: the radiator strips' hundreds of separate tiles, which no
 * simplifier can merge, become one thin box per strip. Strips are told apart by the gaps
 * between their tiles across their width.
 */
function boxRadiators(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    if (prim.getMaterial()?.getName() !== RADIATOR_MATERIAL) continue;
    const pos = prim.getAttribute('POSITION').getArray();
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < pos.length / 3; v += 1) for (let a = 0; a < 3; a += 1) { min[a] = Math.min(min[a], pos[v * 3 + a]); max[a] = Math.max(max[a], pos[v * 3 + a]); }
    const extent = [0, 1, 2].map((a) => max[a] - min[a]);
    const thin = extent.indexOf(Math.min(...extent));
    const long = extent.indexOf(Math.max(...extent));
    const across = 3 - thin - long;
    // Occupancy across the width, in 5 cm bins: runs of filled bins are the strips.
    const bins = new Uint8Array(Math.ceil(extent[across] / 0.05) + 1);
    // Each triangle fills the bins its span covers: the tiles' corners alone would leave the
    // inside of every tile looking like a gap.
    const tri = prim.getIndices().getArray();
    for (let i = 0; i < tri.length; i += 3) {
      const values = [tri[i], tri[i + 1], tri[i + 2]].map((v) => pos[v * 3 + across] - min[across]);
      for (let k = Math.floor(Math.min(...values) / 0.05); k <= Math.floor(Math.max(...values) / 0.05); k += 1) bins[k] = 1;
    }
    const strips = [];
    let start = -1;
    for (let i = 0; i <= bins.length; i += 1) {
      const filled = i < bins.length && bins[i] === 1;
      if (filled && start < 0) start = i;
      if (!filled && start >= 0) {
        // A gap under 60 cm is between tiles of one strip, not between strips.
        const nextFilled = bins.slice(i, i + 12).some((b) => b === 1);
        if (!nextFilled) { strips.push([start, i]); start = -1; }
      }
    }
    const positions = [];
    const indices = [];
    for (const [a, b] of strips) {
      const lo = [...min];
      const hi = [...max];
      lo[across] = min[across] + a * 0.05;
      hi[across] = min[across] + b * 0.05;
      const base = positions.length / 3;
      for (let c = 0; c < 8; c += 1) positions.push(c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]);
      // The box's six faces, wound outward.
      for (const [p, q, r, t] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) {
        indices.push(base + p, base + q, base + r, base + p, base + r, base + t);
      }
    }
    const buffer = doc.getRoot().listBuffers()[0];
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer));
    console.log('radiator strips boxed:', strips.length);
  }
}

const RADIATOR_MATERIAL = 'mat_20';

// --- Ambient occlusion, baked: rays against every triangle, through a uniform grid ----------

function collectTriangles(doc) {
  const tris = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      const a = idx.getArray();
      const p = pos.getArray();
      for (let i = 0; i < a.length; i += 3) {
        const t = new Float64Array(9);
        for (let k = 0; k < 3; k += 1) {
          t[k * 3] = p[a[i + k] * 3];
          t[k * 3 + 1] = p[a[i + k] * 3 + 1];
          t[k * 3 + 2] = p[a[i + k] * 3 + 2];
        }
        tris.push(t);
      }
    }
  }
  return tris;
}

function buildGrid(tris, cell) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let k = 0; k < 9; k += 1) { min[k % 3] = Math.min(min[k % 3], t[k]); max[k % 3] = Math.max(max[k % 3], t[k]); }
  const dims = [0, 1, 2].map((a) => Math.max(1, Math.ceil((max[a] - min[a]) / cell)));
  const cells = new Map();
  tris.forEach((t, i) => {
    const lo = [0, 1, 2].map((a) => Math.floor((Math.min(t[a], t[a + 3], t[a + 6]) - min[a]) / cell));
    const hi = [0, 1, 2].map((a) => Math.floor((Math.max(t[a], t[a + 3], t[a + 6]) - min[a]) / cell));
    for (let x = lo[0]; x <= hi[0]; x += 1) for (let y = lo[1]; y <= hi[1]; y += 1) for (let z = lo[2]; z <= hi[2]; z += 1) {
      const key = (x * dims[1] + y) * dims[2] + z;
      let list = cells.get(key);
      if (!list) cells.set(key, (list = []));
      list.push(i);
    }
  });
  return { min, cell, dims, cells, tris };
}

function rayTriangle(o, d, t) {
  const e1x = t[3] - t[0], e1y = t[4] - t[1], e1z = t[5] - t[2];
  const e2x = t[6] - t[0], e2y = t[7] - t[1], e2z = t[8] - t[2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const sx = o[0] - t[0], sy = o[1] - t[1], sz = o[2] - t[2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return dist > 1e-4 ? dist : Infinity;
}

/** Nearest hit within `reach`, marching the grid cell by cell along the ray. */
function cast(grid, o, d, reach, stamp, seen) {
  const { min, cell, dims, cells, tris } = grid;
  let best = Infinity;
  const steps = Math.ceil(reach / (cell * 0.5));
  let lastKey = -1;
  for (let s = 0; s <= steps; s += 1) {
    const along = s * cell * 0.5;
    if (along > best) break;
    const x = Math.floor((o[0] + d[0] * along - min[0]) / cell);
    const y = Math.floor((o[1] + d[1] * along - min[1]) / cell);
    const z = Math.floor((o[2] + d[2] * along - min[2]) / cell);
    if (x < 0 || y < 0 || z < 0 || x >= dims[0] || y >= dims[1] || z >= dims[2]) continue;
    const key = (x * dims[1] + y) * dims[2] + z;
    if (key === lastKey) continue;
    lastKey = key;
    const list = cells.get(key);
    if (!list) continue;
    for (const i of list) {
      if (seen[i] === stamp) continue;
      seen[i] = stamp;
      const hit = rayTriangle(o, d, tris[i]);
      if (hit < best) best = hit;
    }
  }
  return best <= reach ? best : Infinity;
}

const RAYS = 24;
const HEMISPHERE = Array.from({ length: RAYS }, (_, i) => {
  const r = Math.sqrt((i + 0.5) / RAYS);
  const a = i * 2.399963229728653;
  const x = r * Math.cos(a), y = r * Math.sin(a);
  return [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
});

/** Writes COLOR_0 = sky visibility into every primitive of `doc`, cast against `grid`. */
function bakeOcclusion(doc, grid, reach) {
  const seen = new Int32Array(grid.tris.length);
  let stamp = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION').getArray();
      const nor = prim.getAttribute('NORMAL').getArray();
      const count = pos.length / 3;
      const colours = new Float32Array(count * 4);
      for (let i = 0; i < count; i += 1) {
        const n = [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]];
        const helper = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        let t = [helper[1] * n[2] - helper[2] * n[1], helper[2] * n[0] - helper[0] * n[2], helper[0] * n[1] - helper[1] * n[0]];
        const tl = Math.hypot(...t) || 1;
        t = t.map((v) => v / tl);
        const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
        const o = [pos[i * 3] + n[0] * 0.01, pos[i * 3 + 1] + n[1] * 0.01, pos[i * 3 + 2] + n[2] * 0.01];
        let blocked = 0;
        for (const [x, y, z] of HEMISPHERE) {
          const d = [t[0] * x + b[0] * y + n[0] * z, t[1] * x + b[1] * y + n[1] * z, t[2] * x + b[2] * y + n[2] * z];
          stamp += 1;
          const hit = cast(grid, o, d, reach, stamp, seen);
          if (hit < reach) blocked += 1 - (hit / reach) ** 2;
        }
        const visibility = 1 - blocked / RAYS;
        colours.set([visibility, visibility, visibility, 1], i * 4);
      }
      const accessor = doc.createAccessor().setType('VEC4').setArray(colours).setBuffer(doc.getRoot().listBuffers()[0]);
      prim.setAttribute('COLOR_0', accessor);
    }
  }
}

// --- Normals split at creases ------------------------------------------------------------------

const CREASE_DEGREES = 35;

/**
 * Vertex normals for an indexed, position-welded primitive, split where faces meet at more
 * than `degrees`: smooth across gentle curvature, hard at panel edges and corners. Each
 * corner's normal is the area-weighted mean of the faces about its vertex within the angle of
 * its own face; corners that agree share a new vertex.
 */
function creasePrimitive(doc, prim, degrees, sourceNormals) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();
  const faceCount = idx.length / 3;
  const faceNormals = new Float64Array(faceCount * 3);
  for (let f = 0; f < faceCount; f += 1) {
    const a = idx[f * 3] * 3, b = idx[f * 3 + 1] * 3, c = idx[f * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    // Unnormalised: its length is twice the face's area, the weight.
    faceNormals[f * 3] = uy * vz - uz * vy;
    faceNormals[f * 3 + 1] = uz * vx - ux * vz;
    faceNormals[f * 3 + 2] = ux * vy - uy * vx;
  }
  const vertexFaces = new Map();
  for (let f = 0; f < faceCount; f += 1) for (let k = 0; k < 3; k += 1) {
    const v = idx[f * 3 + k];
    let list = vertexFaces.get(v);
    if (!list) vertexFaces.set(v, (list = []));
    list.push(f);
  }
  const cosLimit = Math.cos((degrees * Math.PI) / 180);
  const unit = (f) => {
    const x = faceNormals[f * 3], y = faceNormals[f * 3 + 1], z = faceNormals[f * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  const outPos = [];
  const outNor = [];
  const outIdx = new Uint32Array(idx.length);
  const made = new Map();
  for (let f = 0; f < faceCount; f += 1) {
    const nf = unit(f);
    for (let k = 0; k < 3; k += 1) {
      const v = idx[f * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (const g of vertexFaces.get(v)) {
        const ng = unit(g);
        if (ng[0] * nf[0] + ng[1] * nf[1] + ng[2] * nf[2] >= cosLimit) {
          sx += faceNormals[g * 3];
          sy += faceNormals[g * 3 + 1];
          sz += faceNormals[g * 3 + 2];
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      let n = [sx / l, sy / l, sz / l];
      // The model's own normal at this point, where it has one facing the same way: simplified
      // vertices are original vertices, and the author's normals carry the curvature the
      // simplified faces no longer have -- a cylinder of a dozen faces shades as round.
      const candidates = sourceNormals?.get(positionKey(pos, v));
      if (candidates !== undefined) {
        let best = TRANSFER_COS;
        for (const c of candidates) {
          const dot = c[0] * nf[0] + c[1] * nf[1] + c[2] * nf[2];
          if (dot > best) {
            best = dot;
            n = c;
          }
        }
      }
      // Corners of one vertex whose normals agree closely share one new vertex.
      const key = `${v}:${Math.round(n[0] * 64)},${Math.round(n[1] * 64)},${Math.round(n[2] * 64)}`;
      let out = made.get(key);
      if (out === undefined) {
        out = outPos.length / 3;
        made.set(key, out);
        outPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
        outNor.push(...n);
      }
      outIdx[f * 3 + k] = out;
    }
  }
  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(outPos)).setBuffer(buffer));
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(outNor)).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(outIdx).setBuffer(buffer));
}

const TRANSFER_COS = Math.cos((50 * Math.PI) / 180);

function positionKey(pos, v) {
  return `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
}

/** The source's own normals, by position: every distinct normal the model gives each point. */
function harvestNormals(doc) {
  const map = new Map();
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')?.getArray();
    const nor = prim.getAttribute('NORMAL')?.getArray();
    if (!pos || !nor) continue;
    for (let v = 0; v < pos.length / 3; v += 1) {
      const key = positionKey(pos, v);
      let list = map.get(key);
      if (!list) map.set(key, (list = []));
      const l = Math.hypot(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]) || 1;
      list.push([nor[v * 3] / l, nor[v * 3 + 1] / l, nor[v * 3 + 2] / l]);
    }
  }
  return map;
}

function creaseAll(doc, degrees, sourceNormals) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) creasePrimitive(doc, prim, degrees, sourceNormals);
}

// ---------------------------------------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });
const original = await io.read(source);
const before = triangles(original);
const frame = toShipFrame(original);
const sourceNormals = harvestNormals(original);
await original.transform(weld());
// Drop TEXCOORD_0 (no textures) and NORMAL, so neither splits vertices: the model's faces are
// split along every edge by their normals, which leaves the simplifier nothing but seams. The
// normals are worked out again after simplifying, split at creases. And drop the fully
// transparent material (alpha 0, masked: drawn as nothing).
for (const mesh of original.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const material = prim.getMaterial();
    if (material && material.getAlphaMode() === 'MASK' && material.getBaseColorFactor()[3] === 0) {
      prim.dispose();
      continue;
    }
    prim.setAttribute('TEXCOORD_0', null);
    prim.setAttribute('NORMAL', null);
  }
}
await original.transform(weld());
await io.write(path.join(outDir, 'frame.glb'), original);

const full = cloneDocument(original);
removeSmallComponents(full, Number(process.env.FULL_MIN ?? 0));
simplifyTo(full, Number(fullError), { prune: true });
creaseAll(full, CREASE_DEGREES, sourceNormals);
await full.transform(prune(), dedup());
const low = cloneDocument(original);
boxRadiators(low);
removeSmallComponents(low, Number(process.env.LOW_MIN ?? 1.2), RADIATOR_MATERIAL);
simplifyTo(low, Number(lowError), { prune: true, keepBelow: 0 });
creaseAll(low, CREASE_DEGREES, sourceNormals);
await low.transform(prune(), dedup());
// The original at full detail, its own normals, for the comparison renders.
const reference = cloneDocument(original);
creaseAll(reference, CREASE_DEGREES, sourceNormals);
await io.write(path.join(outDir, 'reference.glb'), reference);

console.log(JSON.stringify({ before, scale: frame.scale, lengthUnits: frame.lengthAlongY, full: triangles(full), low: triangles(low) }));
for (const mesh of full.getRoot().listMeshes()) {
  console.log('  full', mesh.getName(), mesh.listPrimitives().map((p) => `${p.getMaterial()?.getName()}:${p.getIndices().getCount() / 3}`).join(' '));
}
await io.write(path.join(outDir, 'full.glb'), full);
await io.write(path.join(outDir, 'low.glb'), low);

// Occlusion, against the full model's own triangles, into both levels of detail.
const t0 = Date.now();
const grid = buildGrid(collectTriangles(full), 0.5);
bakeOcclusion(full, grid, 3);
bakeOcclusion(low, grid, 3);
console.log('occlusion baked in', ((Date.now() - t0) / 1000).toFixed(1), 's');

// One file: the full model's three nodes and the silhouette's, named '<node> LOW'.
for (const node of low.getRoot().listNodes()) node.setName(`${node.getName()} LOW`);
for (const mesh of low.getRoot().listMeshes()) mesh.setName(`${mesh.getName()} LOW`);
const asset = cloneDocument(full);
mergeDocuments(asset, low);
// mergeDocuments brings the second scene along; hang its nodes under the first and drop it.
const scenes = asset.getRoot().listScenes();
for (const extra of scenes.slice(1)) {
  for (const child of extra.listChildren()) scenes[0].addChild(child);
  extra.dispose();
}
// Everything in one buffer, then compressed: positions and normals quantised, meshopt.
const buffers = asset.getRoot().listBuffers();
for (const accessor of asset.getRoot().listAccessors()) accessor.setBuffer(buffers[0]);
for (const extra of buffers.slice(1)) extra.dispose();
// The material extension the source used (specular) is not read by our shader: dropped.
for (const ext of asset.getRoot().listExtensionsUsed()) if (ext.extensionName !== 'EXT_meshopt_compression') ext.dispose();
await asset.transform(
  dedup(),
  prune(),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
asset.getRoot().getAsset().generator = 'Solar-System-Simulator build (gltf-transform, meshoptimizer)';
await io.write(path.join(outDir, 'hail-mary.glb'), asset);
console.log('asset bytes', fs.statSync(path.join(outDir, 'hail-mary.glb')).size);
console.log('written');
