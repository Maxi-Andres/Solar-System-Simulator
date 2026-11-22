import * as THREE from 'three';

import { compileFor } from './shaderPrecompile.ts';

/**
 * Compiles, for the canvas, the program `mesh` will be drawn with once `map` is on its
 * material -- before it is put there. Resolves when the program is done.
 *
 * A material given a map is another program (USE_MAP), compiled on its first draw: the Sun's,
 * whose map arrives a moment after the first frame, held that frame for half a second on an
 * integrated GPU. shaderPrecompile.ts compiles such a twin in the background, but not always
 * before the map is here; so a body's map is put on its material only once this says its
 * program is made, and until then the body keeps the colour it had -- as it does while the map
 * is downloading. Where the twin made it already, this resolves at once.
 *
 * The material is never touched: a clone with the map is compiled in its place for the
 * moment of the compile's own synchronous part, its compile hook and cache key the material's
 * own, as the background's twins are. The clone is kept as long as the material, so the
 * program stays in three's cache until the material takes it up.
 */
export function compileWithMap(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene,
  mesh: THREE.Mesh,
  map: THREE.Texture,
): Promise<void> {
  const material = mesh.material as THREE.Material & { map?: THREE.Texture | null };
  if (Array.isArray(mesh.material) || !('map' in material) || material.map === map) {
    return Promise.resolve();
  }
  const twin = material.clone() as THREE.Material & { map: THREE.Texture | null };
  twin.onBeforeCompile = material.onBeforeCompile;
  if (Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')) {
    twin.customProgramCacheKey = material.customProgramCacheKey;
  }
  twin.map = map;
  material.addEventListener('dispose', () => twin.dispose());
  mesh.material = twin;
  try {
    return compileFor(gl, camera, scene, [mesh], 'canvas');
  } finally {
    mesh.material = material;
  }
}
