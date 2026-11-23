/**
 * The page bakeFictionSurfaces.mjs drives: bakes every fictional world's surface with the app's
 * own bake (surfaceBake.ts), from the app's own data, and hands each cube face back raw.
 *
 * window.bakeAll() bakes them one after another and returns what each has; window.readFace()
 * returns one face's texels, base64: RGBA bytes, or RGBA half floats where the bake is in half
 * floats. Nothing here is drawn for anyone: the canvas is only the GL context.
 */
import * as THREE from 'three';

import { FICTION, FICTION_OVERLAYS } from '../../src/core/fiction.ts';
import { fictionWorldMaterial } from '../../src/scene/fiction/fictionLooks.ts';
import { setPrebakedSurfaces } from '../../src/scene/fiction/looks/prebakedSurfaces.ts';
import type { SurfaceBake } from '../../src/scene/fiction/looks/surfaceBake.ts';
import type { SurfaceLook } from '../../src/scene/fiction/looks/worldShader.ts';

// Baked here from the shaders, never from images already made.
setPrebakedSurfaces(false);

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(256, 256, false);

interface Baked {
  readonly id: string;
  readonly key: string;
  readonly faceSize: number;
  readonly layers: readonly { readonly half: boolean; readonly data: boolean }[];
}

const bakes = new Map<string, SurfaceBake>();

async function bakeOne(id: string, look: Parameters<typeof fictionWorldMaterial>[0]): Promise<Baked | null> {
  const material = fictionWorldMaterial(look) as THREE.ShaderMaterial;
  const bake = material.userData['surfaceBake'] as SurfaceBake | undefined;
  const surface = material.userData['surfaceLook'] as SurfaceLook | undefined;
  if (bake === undefined || surface === undefined) {
    material.dispose();
    return null;
  }
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);
  for (let frame = 0; frame < 20000 && !bake.done; frame += 1) {
    renderer.render(scene, camera);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!bake.done) throw new Error(`${id}: the bake did not finish`);
  bakes.set(id, bake);
  const dataLayers = new Set(surface.dataLayers ?? []);
  return {
    id,
    key: material.userData['surfaceKey'] as string,
    faceSize: bake.targets[0]!.width,
    layers: bake.targets.map((target, i) => ({ half: target.texture.type === THREE.HalfFloatType, data: dataLayers.has(i) })),
  };
}

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

declare global {
  interface Window {
    ready: boolean;
    bakeAll(only?: string[]): Promise<Baked[]>;
    readFace(id: string, layer: number, face: number): string;
  }
}

window.bakeAll = async (only) => {
  const worlds = [...FICTION, ...FICTION_OVERLAYS].filter((record) => record.look?.kind === 'world');
  const result: Baked[] = [];
  for (const record of worlds) {
    if (only !== undefined && only.length > 0 && !only.includes(record.id)) continue;
    const baked = await bakeOne(record.id, record.look as Parameters<typeof fictionWorldMaterial>[0]);
    if (baked !== null) result.push(baked);
  }
  return result;
};

window.readFace = (id, layer, face) => {
  const target = bakes.get(id)!.targets[layer]!;
  const size = target.width;
  const half = target.texture.type === THREE.HalfFloatType;
  const buffer = half ? new Uint16Array(size * size * 4) : new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size, size, buffer, face);
  return base64(new Uint8Array(buffer.buffer));
};

window.ready = true;
