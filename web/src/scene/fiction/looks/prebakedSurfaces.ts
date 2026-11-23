import * as THREE from 'three';

/**
 * The fictional worlds' surfaces as images, baked ahead of time (web/scripts/bakeFictionSurfaces.mjs)
 * and loaded like any texture, instead of worked out on the GPU the first time a world is drawn
 * -- three or four seconds for Adrian, two to four for the others, the moons in a queue.
 *
 * **What is stored.** For each world, each layer of its bake (surfaceBake.ts), each cube face:
 * - its colour channels as a lossy WebP -- they hold the encoded albedo (worldShader.ts
 *   encodeAlbedo) or, on Pandora's second layer, cloud cover, cloud brightness and relief;
 * - its alpha, where the look uses it: a lossless grayscale WebP where the bake was eight bits
 *   (`byte`), or, where it was half floats for relief (`word`), sixteen bits split over two
 *   channels of a lossless WebP -- eight bits of height lit up close come out as terraces;
 * - and, for a quick first look, a strip of the six faces at 32 texels a side, RGBA PNG.
 *
 * **How they are found.** A manifest (textures/fiction/manifest.json) lists each world by its
 * surface key: a hash of everything its bake depends on -- the look's GLSL, its seed and tint,
 * the face size and layers (worldShader.ts surfaceKey). A look changed since its images were
 * made has a new key, finds nothing, and is baked at run time as before; a test requires images
 * for every world whose look the app draws, so that only happens while a change is in progress.
 *
 * Decoded off the main thread (ImageBitmapLoader), uploaded as plain textures, and written into
 * the cube maps the material already samples by a pass that only copies (surfaceBake.ts).
 */

/** How a layer's alpha is stored. */
export type AlphaStorage = 'none' | 'byte' | 'word';

export interface ManifestEntry {
  readonly id: string;
  readonly key: string;
  readonly faceSize: number;
  readonly layers: readonly { readonly alpha: AlphaStorage }[];
}

export interface Manifest {
  readonly version: 1;
  readonly worlds: Readonly<Record<string, ManifestEntry>>;
}

/** Where the images live, under the site's base. */
export const PREBAKED_FOLDER = 'textures/fiction';

/** File names, the generator's and the loader's alike. */
export const prebakedFiles = {
  colour: (layer: number, face: number): string => `L${layer}-${face}.webp`,
  alpha: (layer: number, face: number): string => `L${layer}-${face}-a.webp`,
  preview: (layer: number): string => `L${layer}-preview.png`,
  /** Texels a side of each face in the preview strip. */
  previewSize: 32,
} as const;

/** One layer's images: six colour faces and, where the look uses alpha, six alpha faces. */
export interface LayerImages {
  readonly colour: readonly ImageBitmap[];
  readonly alpha: readonly ImageBitmap[] | null;
  readonly storage: AlphaStorage;
}

/** A world's images, found: its preview strips first, its faces after. */
export interface SurfaceImageSet {
  readonly entry: ManifestEntry;
  preview(): Promise<{ readonly strip: ImageBitmap; readonly storage: AlphaStorage }[]>;
  faces(): Promise<LayerImages[]>;
}

let enabled = true;

/** Turns the images off: the generator bakes at run time, from the shaders, what it writes out. */
export function setPrebakedSurfaces(on: boolean): void {
  enabled = on;
}

function folderUrl(): string {
  return `${import.meta.env.BASE_URL}${PREBAKED_FOLDER}`;
}

let manifest: Promise<Map<string, ManifestEntry>> | null = null;

function manifestByKey(): Promise<Map<string, ManifestEntry>> {
  manifest ??= fetch(`${folderUrl()}/manifest.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : null))
    .then((data) => new Map(Object.values(data?.worlds ?? {}).map((entry) => [entry.key, entry] as const)))
    .catch(() => new Map<string, ManifestEntry>());
  return manifest;
}

function loadBitmap(url: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    // As the files are: no flip (the generator wrote the GL rows in order), not premultiplied --
    // alpha here is height, not coverage -- no colour conversion: these are data.
    new THREE.ImageBitmapLoader()
      .setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
      .load(url, resolve, undefined, reject);
  });
}

/** The world's baked images by its surface key, or null when it has none (or images are off). */
export async function findSurfaceImages(key: string): Promise<SurfaceImageSet | null> {
  if (!enabled || typeof createImageBitmap === 'undefined') return null;
  const entry = (await manifestByKey()).get(key);
  if (entry === undefined) return null;
  const base = `${folderUrl()}/${entry.id}`;
  return {
    entry,
    preview: () =>
      Promise.all(
        entry.layers.map(async (layer, i) => ({ strip: await loadBitmap(`${base}/${prebakedFiles.preview(i)}`), storage: layer.alpha })),
      ),
    faces: () =>
      Promise.all(
        entry.layers.map(async (layer, i): Promise<LayerImages> => {
          const faces = [0, 1, 2, 3, 4, 5];
          const [colour, alpha] = await Promise.all([
            Promise.all(faces.map((face) => loadBitmap(`${base}/${prebakedFiles.colour(i, face)}`))),
            layer.alpha === 'none' ? Promise.resolve(null) : Promise.all(faces.map((face) => loadBitmap(`${base}/${prebakedFiles.alpha(i, face)}`))),
          ]);
          return { colour, alpha, storage: layer.alpha };
        }),
      ),
  };
}

/** Thirty-two bits of FNV-1a over a string, from a seed: two of them make the surface key. */
function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** A short, stable key for a string: sixty-four bits of hash. */
export function hashKey(text: string): string {
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x9e3779b9);
}
