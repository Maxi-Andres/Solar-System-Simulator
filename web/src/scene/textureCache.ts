import * as THREE from 'three';

/**
 * Lazy loading of the surface maps.
 *
 * The ten 2k maps are 4.3 MB on disk, which is three times the ephemerides and would
 * be an absurd thing to make every visitor download before the first frame -- most of
 * them for bodies that are a few pixels across and will never be approached. So
 * nothing is fetched until a body actually grows large enough on screen for its
 * surface to mean anything, and until then the catalog colour is what shows. A
 * session that only ever looks at the Solar System from outside costs zero bytes here.
 *
 * A texture is kept while anything uses it and freed when the last user hands it back:
 * a 2k map with its mipmaps is about 11 MB of GPU memory, and on a laptop's integrated
 * GPU that is the same RAM the rest of the machine runs in. The scene hands a body's maps
 * back once it has been a speck for a while (see detailRelease.ts), and asks again on the
 * way back in -- from the browser's cache by then, so it costs a decode, not a download.
 */

/**
 * Deduplicates concurrent and repeat requests for the same file.
 *
 * Keyed by URL alone, so the first caller's `TextureOptions` are the ones that stick.
 * Fine while every file has one use, which is the case today; a file wanted with two
 * different wrap modes would need the options in the key.
 */
interface CachedTexture {
  readonly texture: Promise<THREE.Texture>;
  /** Callers that asked for it and have not handed it back. */
  users: number;
}

const cache = new Map<string, CachedTexture>();

/**
 * URL for a texture file, respecting the GitHub Pages base path.
 *
 * `import.meta.env.BASE_URL` is '/' in dev and '/Solar-System-Simulator/' in the
 * published build. Hardcoding '/' works locally and 404s on Pages, which is the
 * single most common way a project site breaks -- the data loader takes the same
 * precaution.
 */
export function textureUrl(file: string): string {
  return `${import.meta.env.BASE_URL}textures/${file}`;
}

export interface TextureOptions {
  /**
   * Maximum anisotropic filtering the GPU supports, from
   * `renderer.capabilities.getMaxAnisotropy()`.
   *
   * Worth passing: a planet is nearly always viewed at a glancing angle somewhere on
   * its limb, which is exactly the case trilinear filtering smears into mush.
   */
  readonly anisotropy?: number;
  /**
   * How the horizontal axis wraps. Defaults to repeating, which is right for an
   * equirectangular map where u is longitude and 360 degrees meets 0.
   *
   * A ring strip must clamp instead: there u is radius, and wrapping it would fold
   * the outer edge of the rings back onto the inner one.
   */
  readonly wrapS?: THREE.Wrapping;
  /**
   * How the file's values are encoded. Defaults to sRGB, which is right for anything
   * that is a picture.
   *
   * A map that is *data* rather than a picture must say so. Earth's land/water mask and
   * its cloud opacities are numbers the shader uses directly, and putting them through
   * an sRGB decode would bend them by up to 2.2 -- a half-water texel would come back
   * as a fifth of one.
   */
  readonly colorSpace?: THREE.ColorSpace;
}

/**
 * A body's map, shared with every other caller that asked for the same file. Each call
 * must be matched by one `releaseBodyTexture` once the map is no longer on screen.
 */
export function loadBodyTexture(
  file: string,
  options: TextureOptions = {},
): Promise<THREE.Texture> {
  const url = textureUrl(file);
  const existing = cache.get(url);
  if (existing !== undefined) {
    existing.users += 1;
    return existing.texture;
  }

  const pending = new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        // The maps are authored in sRGB; loading them as linear washes every
        // surface out and makes the terminator land in the wrong place. Masks pass
        // NoColorSpace, because they are measurements and not pictures.
        texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
        texture.anisotropy = options.anisotropy ?? 1;
        // Equirectangular maps wrap in longitude and must not in latitude.
        texture.wrapS = options.wrapS ?? THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        resolve(texture);
      },
      undefined,
      (error: unknown) => {
        // A failed load must not be cached, or one bad network moment would leave
        // that body flat-coloured for the rest of the session.
        if (cache.get(url) === entry) {
          cache.delete(url);
        }
        reject(error instanceof Error ? error : new Error(`Could not load ${url}`));
      },
    );
  });

  const entry: CachedTexture = { texture: pending, users: 1 };
  cache.set(url, entry);
  return pending;
}

/**
 * Hands back one `loadBodyTexture` of `file`. The last one frees the texture, on the GPU
 * and off it, once it has arrived; a later request fetches it again.
 */
export function releaseBodyTexture(file: string): void {
  const url = textureUrl(file);
  const entry = cache.get(url);
  if (entry === undefined) {
    return;
  }
  entry.users -= 1;
  if (entry.users > 0) {
    return;
  }
  cache.delete(url);
  entry.texture.then(
    (texture) => texture.dispose(),
    () => undefined,
  );
}

/** Callers holding `file`, for tests. */
export function textureUsers(file: string): number {
  return cache.get(textureUrl(file))?.users ?? 0;
}

/** Drops every cached texture. Exists for tests; the app never needs it. */
export function clearTextureCache(): void {
  cache.clear();
}
