/**
 * Which bodies need a sphere of their own, and what to free once a body is gone.
 *
 * Every body in the catalog gets a handle in SolarSystem.tsx: a group with a mesh and a
 * marker. Hundreds of them are never drawn as spheres -- a nebula, a galaxy, a landing
 * site, a star with no measured radius, a craft -- and a 64-segment sphere and a lit
 * material each was ~90 KB of geometry and a material apiece for nothing. Those share one
 * placeholder geometry and material instead; their marker is their own, as it is drawn.
 *
 * And bodies come and go: a searched asteroid, a comet, a satellite or a catalogue star
 * past its turn in the LRU (beltBodies.ts, cometBodies.ts, satelliteBodies.ts,
 * starBodies.ts) is taken out of the store, and its handle's geometry, materials and
 * maps went with it only once these were freed.
 */
import type { BodyDefinition, BodyId } from '@sss/tools/types';
import * as THREE from 'three';

/**
 * Kinds drawn by a renderer of their own, never as the body's sphere: a cluster's stars
 * (GlobularClusters.tsx), a galaxy's light (LocalGroup.tsx), a nebula's or a remnant's
 * volume, a deep-sky object's or a structure's mark.
 */
export const NOT_A_SPHERE_KINDS: ReadonlySet<string> = new Set([
  'globular-cluster',
  'supernova-remnant',
  'nebula',
  'deep-sky',
  'galaxy',
  'structure',
  'region',
]);

/**
 * True for a body whose sphere is never shown, whatever the camera does: one of the kinds
 * above; a craft, which hands over to its model or box; a body drawn from its shape model;
 * and one whose size nobody has measured or whose shape is not drawn (a marker at any
 * range). Mirrors `sized` and the kind test in SolarSystem.tsx's frame loop.
 */
export function neverDrawnAsSphere(definition: BodyDefinition): boolean {
  if (NOT_A_SPHERE_KINDS.has(definition.kind)) {
    return true;
  }
  if (definition.mission !== null || (definition.shapeModel ?? null) !== null) {
    return true;
  }
  const sized =
    (definition.radiusPublished !== false || definition.radiusEstimated === true) &&
    definition.shapeDrawn !== false;
  return !sized;
}

/** The ids held in `cached` that are no longer among `current`: the handles to free. */
export function staleIds(cached: Iterable<BodyId>, current: Iterable<BodyId>): BodyId[] {
  const live = new Set(current);
  const stale: BodyId[] = [];
  for (const id of cached) {
    if (!live.has(id)) {
      stale.push(id);
    }
  }
  return stale;
}

/**
 * Frees the geometry and materials of everything under `root`, except what is in
 * `shared`. Textures are left alone: a body's maps are counted users of the texture
 * cache (textureCache.ts) and handed back there, and a marker's is shared by every body.
 * Nor is a sprite's geometry: three gives every sprite in the page the same quad.
 */
export function disposeOwnResources(
  root: THREE.Object3D,
  shared: ReadonlySet<THREE.BufferGeometry | THREE.Material>,
): void {
  root.traverse((node) => {
    const drawn = node as THREE.Mesh;
    if (drawn.geometry !== undefined && !(node as THREE.Sprite).isSprite && !shared.has(drawn.geometry)) {
      drawn.geometry.dispose();
    }
    if (drawn.material === undefined) {
      return;
    }
    const materials = Array.isArray(drawn.material) ? drawn.material : [drawn.material];
    for (const material of materials) {
      if (!shared.has(material)) {
        material.dispose();
      }
    }
  });
}
