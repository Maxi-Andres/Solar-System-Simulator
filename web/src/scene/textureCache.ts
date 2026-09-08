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
 * Textures are cached forever once loaded. Ten 2k maps with mipmaps is roughly 110 MB
 * of GPU memory, which is fine for ten bodies and would not be for ten thousand; when
 * phase B brings asteroids this needs an eviction policy, not a bigger cache.
 */

/**
 * Deduplicates concurrent and repeat requests for the same file.
 *
 * Keyed by URL alone, so the first caller's `TextureOptions` are the ones that stick.
 * Fine while every file has one use, which is the case today; a file wanted with two
 * different wrap modes would need the options in the key.
 */
const cache = new Map<string, Promise<THREE.Texture>>();

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
}

export function loadBodyTexture(
  file: string,
  options: TextureOptions = {},
): Promise<THREE.Texture> {
  const url = textureUrl(file);
  const existing = cache.get(url);
  if (existing !== undefined) {
    return existing;
  }

  const pending = new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        // The maps are authored in sRGB; loading them as linear washes every
        // surface out and makes the terminator land in the wrong place.
        texture.colorSpace = THREE.SRGBColorSpace;
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
        cache.delete(url);
        reject(error instanceof Error ? error : new Error(`Could not load ${url}`));
      },
    );
  });

  cache.set(url, pending);
  return pending;
}

/** Drops every cached texture. Exists for tests; the app never needs it. */
export function clearTextureCache(): void {
  cache.clear();
}
