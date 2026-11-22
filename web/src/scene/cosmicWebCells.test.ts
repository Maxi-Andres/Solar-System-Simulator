import { COSMIC_WEB_POSITION_UNIT_PC } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  cellReachPx,
  classifyCells,
  GalaxyCells,
  HAND_GAIN,
  HANDED,
  KEPT,
  listServes,
  NEEDED,
  OVERFLOW_CELL,
  SOON,
  writeList,
  type CellView,
  type SpriteLaw,
} from './cosmicWebCells.ts';
import { FLOOR_THIN } from './crowding.ts';
import { SPRITE_FLOOR } from './gaussianSprite.ts';

const LAW: SpriteLaw = { sigmaPx: 0.7, faintFloor: 0.0215, depthLeast: 0.12 };
const UNITS_PER_PC = 3.0857e10;
const W = 1600;
const H = 900;

let seed = 11;
function random(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

/** A catalogue: `n` galaxies in a few clumps and a wedge, int16 places, bytes by code. */
function catalogue(n: number): { place: Int16Array; bytes: Uint8Array } {
  const place = new Int16Array(n * 4);
  const bytes = new Uint8Array(n * 4);
  for (let g = 0; g < n; g += 1) {
    const clump = g % 5;
    const spread = clump === 0 ? 30000 : 3000;
    const cx = clump * 4000 - 8000;
    for (let a = 0; a < 3; a += 1) place[g * 4 + a] = Math.max(-32767, Math.min(32767, Math.round(cx + (random() - 0.5) * spread)));
    bytes[g * 4] = Math.floor(random() * 256);
    bytes[g * 4 + 1] = Math.floor(random() * 256);
  }
  return { place, bytes };
}

/** Per code: a light spanning dwarfs to giants, a hue's brightest channel about 1. */
const lightOf = Float32Array.from({ length: 256 }, (_, code) => 10 ** (code / 32));
const hueOf = Float32Array.from({ length: 256 }, (_, code) => 0.8 + (code % 7) * 0.1);

const scratchClip = new THREE.Vector4();

/**
 * Whether galaxy `g` can put a pixel on the screen, as CosmicWeb.tsx GALAXY_VERTEX draws it,
 * its faint dot at the most it could be (whole weight, no crowding, thinned to its most).
 */
function drawn(g: number, place: Int16Array, bytes: Uint8Array, view: CellView, camera: THREE.PerspectiveCamera, modelView: THREE.Matrix4): boolean {
  const unit = 32767 * COSMIC_WEB_POSITION_UNIT_PC;
  const rx = (place[g * 4]! / 32767) * unit - view.cameraX;
  const ry = (place[g * 4 + 1]! / 32767) * unit - view.cameraY;
  const rz = (place[g * 4 + 2]! / 32767) * unit - view.cameraZ;
  const d = Math.hypot(rx, ry, rz);
  const sigmaPc = (LAW.sigmaPx / view.pixelsPerRadian) * d;
  const hue = hueOf[bytes[g * 4 + 1]!]!;
  const lit = (hue * lightOf[bytes[g * 4]!]! * view.fade) / (2 * Math.PI * sigmaPc * sigmaPc);
  const depth = Math.min(1, Math.max(LAW.depthLeast, view.depthPc / d));
  const kept = view.floorKept * depth;
  const thinned = kept >= FLOOR_THIN ? kept : kept > 0 ? FLOOR_THIN : 0;
  const peak = Math.max(lit, hue * LAW.faintFloor * thinned * view.fade);
  if (!(peak > SPRITE_FLOOR)) return false;
  const reach = LAW.sigmaPx * Math.sqrt(2 * Math.log(peak / SPRITE_FLOOR)) + 1;
  const clip = scratchClip.set(rx * UNITS_PER_PC, ry * UNITS_PER_PC, rz * UNITS_PER_PC, 1).applyMatrix4(modelView).applyMatrix4(camera.projectionMatrix);
  if (clip.w <= 0) return false;
  return Math.abs(clip.x / clip.w) <= 1 + (2 * reach) / W && Math.abs(clip.y / clip.w) <= 1 + (2 * reach) / H;
}

describe('the SDSS galaxies’ cubes', () => {
  const n = 6000;
  const { place, bytes } = catalogue(n);
  const cells = new GalaxyCells(n);
  // In two landings, as chunks come.
  cells.add(place, bytes, 0, 3500, lightOf, hueOf);
  cells.add(place, bytes, 3500, n, lightOf, hueOf);

  it('bins each galaxy into a cube whose box holds it', () => {
    expect(cells.count).toBeGreaterThan(5);
    for (let g = 0; g < n; g += 1) {
      const c = cells.cellOf[g]!;
      expect(c).toBeLessThan(cells.count);
      for (let a = 0; a < 3; a += 1) {
        const p = place[g * 4 + a]! * COSMIC_WEB_POSITION_UNIT_PC;
        expect(p).toBeGreaterThanOrEqual(cells.box[c * 6 + a]!);
        expect(p).toBeLessThanOrEqual(cells.box[c * 6 + 3 + a]!);
      }
      // Kept as float32, as the GPU works it out; the cull's bound has a part in a thousand to spare.
      expect(hueOf[bytes[g * 4 + 1]!]! * lightOf[bytes[g * 4]!]!).toBeLessThanOrEqual(cells.light[c]! * (1 + 1e-6));
    }
  });

  it('never leaves out a cube holding a galaxy that can draw a pixel, from many views', () => {
    let leftOut = 0;
    let views = 0;
    for (let trial = 0; trial < 60; trial += 1) {
      const camera = new THREE.PerspectiveCamera(30 + random() * 50, W / H, 1e-3, 1e35);
      // Inside the clumps, beside them and far out; looking anywhere.
      const out = 10 ** (6 + random() * 3.5);
      camera.position.set(0, 0, 0);
      camera.lookAt(random() - 0.5, random() - 0.5, random() - 0.5);
      camera.updateMatrixWorld();
      const group = new THREE.Object3D();
      group.updateMatrixWorld();
      const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, group.matrixWorld);
      const view: CellView = {
        cameraX: (random() - 0.5) * out,
        cameraY: (random() - 0.5) * out,
        cameraZ: (random() - 0.5) * out,
        modelView: modelView.elements,
        unitsPerPc: UNITS_PER_PC,
        projection: camera.projectionMatrix.elements,
        widthPx: W,
        heightPx: H,
        pixelsPerRadian: H / (2 * Math.tan((camera.fov * Math.PI) / 360)),
        fade: random() < 0.2 ? 0.3 : 1,
        floorKept: random() < 0.3 ? 0 : random() * 1.2,
        depthPc: 3e7 + random() * 1e9,
      };
      const verdicts = new Uint8Array(cells.count);
      classifyCells(cells, view, LAW, verdicts);
      views += 1;
      for (let g = 0; g < n; g += 1) {
        const v = verdicts[cells.cellOf[g]!]!;
        // Each verdict implies the next.
        if ((v & NEEDED) !== 0) expect(v & SOON).toBe(SOON);
        if ((v & SOON) !== 0) expect(v & HANDED).toBe(HANDED);
        if ((v & HANDED) !== 0) expect(v & KEPT).toBe(KEPT);
        if ((v & NEEDED) === 0) {
          leftOut += 1;
          expect(drawn(g, place, bytes, view, camera, modelView)).toBe(false);
        }
      }
    }
    expect(views).toBe(60);
    // And it leaves out a good share: most galaxies, from most views, draw nothing.
    expect(leftOut).toBeGreaterThan(0.3 * n * views);
  }, 60_000);

  it('writes the handed galaxies in their own order, the overflow cube always', () => {
    const handed = new Uint8Array(cells.count);
    handed[cells.cellOf[3]!] = 1;
    const out = new Float32Array(n);
    const written = writeList(cells.cellOf, n, handed, out);
    let last = -1;
    for (let k = 0; k < written; k += 1) {
      expect(out[k]!).toBeGreaterThan(last);
      expect(handed[cells.cellOf[out[k]!]!]).toBe(1);
      last = out[k]!;
    }
    expect(written).toBe(Array.from(cells.cellOf).filter((c) => c === cells.cellOf[3]).length);
    const overflow = Uint16Array.from([0, OVERFLOW_CELL, 1, OVERFLOW_CELL]);
    expect(Array.from(out.subarray(0, writeList(overflow, 4, new Uint8Array([0, 1]), out)))).toEqual([1, 2, 3]);
  });

  it('hands a cube just under the floor, so a list still covers when it comes over it', () => {
    // One galaxy straight ahead; the camera on its line, at a distance it is under the floor from.
    const one = new GalaxyCells(1);
    one.add(new Int16Array([0, 0, 0, 0]), new Uint8Array([200, 3, 0, 0]), 0, 1, lightOf, hueOf);
    const camera = new THREE.PerspectiveCamera(50, W / H, 1e-3, 1e35);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();
    const viewAt = (distancePc: number): CellView => ({
      cameraX: 0,
      cameraY: 0,
      cameraZ: distancePc,
      modelView: camera.matrixWorldInverse.elements,
      unitsPerPc: UNITS_PER_PC,
      projection: camera.projectionMatrix.elements,
      widthPx: W,
      heightPx: H,
      pixelsPerRadian: H / (2 * Math.tan((50 * Math.PI) / 360)),
      fade: 1,
      floorKept: 0,
      depthPc: 1e9,
    });
    // Where it comes over the floor: its reach goes from none to some.
    let near = 1e3;
    let far = 1e12;
    for (let k = 0; k < 200; k += 1) {
      const mid = Math.sqrt(near * far);
      if (cellReachPx(one.light[0]!, one.hue[0]!, mid, viewAt(mid), LAW) > 0) near = mid;
      else far = mid;
    }
    const verdicts = (distancePc: number): number => {
      const out = new Uint8Array(1);
      classifyCells(one, viewAt(distancePc), LAW, out);
      return out[0]!;
    };
    // A little further than that: draws nothing, but handed, the light's margin.
    const before = verdicts(far * 1.1);
    expect(before & NEEDED).toBe(0);
    expect(before & HANDED).toBe(HANDED);
    // Nearer, over the floor: needed, and the list written from further off holds it.
    const after = verdicts(near * 0.9);
    expect(after & NEEDED).toBe(NEEDED);
    expect(listServes(new Uint8Array([(before & HANDED) !== 0 ? 1 : 0]), new Uint8Array([after]), 1).covers).toBe(true);
    // And far enough out that even HAND_GAIN times its light draws nothing: not handed.
    expect(verdicts(far * Math.sqrt(HAND_GAIN) * 1.1) & HANDED).toBe(0);
  });

  it('serves while it holds every cube needed and none beyond what may be kept', () => {
    const verdicts = new Uint8Array([NEEDED | SOON | HANDED | KEPT, SOON | HANDED | KEPT, HANDED | KEPT, KEPT, 0]);
    expect(listServes(new Uint8Array([1, 1, 0, 0, 0]), verdicts, 5)).toEqual({ covers: true, ahead: true, fits: true });
    // A cube only within the hand margin missing: still serves, and is not written again for it.
    expect(listServes(new Uint8Array([1, 1, 0, 0, 0]), verdicts, 5).ahead).toBe(true);
    expect(listServes(new Uint8Array([1, 0, 1, 0, 0]), verdicts, 5)).toEqual({ covers: true, ahead: false, fits: true });
    expect(listServes(new Uint8Array([0, 1, 1, 1, 0]), verdicts, 5)).toEqual({ covers: false, ahead: false, fits: true });
    expect(listServes(new Uint8Array([1, 1, 1, 1, 1]), verdicts, 5)).toEqual({ covers: true, ahead: true, fits: false });
  });
});
