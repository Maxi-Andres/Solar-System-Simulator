import type { BodyDefinition } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { regionDefinition } from '../core/regions.ts';
import { disposeOwnResources, neverDrawnAsSphere, staleIds } from './bodyHandles.ts';

/** A plain sized body: what a planet or a measured moon looks like to the predicate. */
const SIZED: BodyDefinition = {
  ...regionDefinition({
    id: 'test-body',
    name: 'Test',
    layer: 'lagrange-point',
    kindLabel: '',
    measured: true,
    facts: [],
    framingKm: 1,
    parent: null,
    color: '#ffffff',
  }),
  kind: 'moon',
  radiusEquatorialKm: 1000,
  radiusPolarKm: 1000,
  radiusPublished: true,
  shapeDrawn: true,
};

describe('neverDrawnAsSphere', () => {
  it('keeps the sphere of a body with a measured size', () => {
    expect(neverDrawnAsSphere(SIZED)).toBe(false);
    expect(neverDrawnAsSphere({ ...SIZED, kind: 'planet', radiusPublished: true })).toBe(false);
  });

  it('keeps it for a size estimated from the mass (an exoplanet)', () => {
    expect(neverDrawnAsSphere({ ...SIZED, kind: 'planet', radiusPublished: false, radiusEstimated: true })).toBe(
      false,
    );
  });

  it('drops it for the kinds drawn by renderers of their own', () => {
    for (const kind of ['nebula', 'deep-sky', 'galaxy', 'structure', 'globular-cluster', 'supernova-remnant'] as const) {
      expect(neverDrawnAsSphere({ ...SIZED, kind })).toBe(true);
    }
  });

  it('drops it for a region, an unmeasured body, an undrawn shape and a craft', () => {
    expect(neverDrawnAsSphere({ ...SIZED, kind: 'region' })).toBe(true);
    expect(neverDrawnAsSphere({ ...SIZED, kind: 'asteroid', radiusPublished: false })).toBe(true);
    expect(neverDrawnAsSphere({ ...SIZED, kind: 'asteroid', shapeDrawn: false })).toBe(true);
    expect(neverDrawnAsSphere({ ...SIZED, kind: 'spacecraft', mission: {} as BodyDefinition['mission'] })).toBe(true);
  });
});

describe('staleIds', () => {
  it('lists the cached ids no longer in the store, in cache order', () => {
    expect(staleIds(['sun', 'earth', 'belt-1', 'comet-2'], ['earth', 'sun'])).toEqual(['belt-1', 'comet-2']);
  });

  it('lists none when every cached id is still there, or the cache is empty', () => {
    expect(staleIds(['sun', 'earth'], ['earth', 'sun', 'moon'])).toEqual([]);
    expect(staleIds([], ['sun'])).toEqual([]);
  });
});

describe('disposeOwnResources', () => {
  function disposed(object: THREE.BufferGeometry | THREE.Material | THREE.Texture): () => boolean {
    let fired = false;
    object.addEventListener('dispose', () => {
      fired = true;
    });
    return () => fired;
  }

  it('frees a handle’s own geometry and materials, and never what it shares or its maps', () => {
    const sharedGeometry = new THREE.SphereGeometry(1, 8, 4);
    const sharedMaterial = new THREE.MeshBasicMaterial();
    const ownGeometry = new THREE.PlaneGeometry(1, 1);
    const ownMaterial = new THREE.ShaderMaterial();
    const markerMap = new THREE.Texture();
    const spriteMaterial = new THREE.SpriteMaterial({ map: markerMap });

    const group = new THREE.Group();
    group.add(new THREE.Mesh(sharedGeometry, sharedMaterial));
    group.add(new THREE.Mesh(ownGeometry, ownMaterial));
    const sprite = new THREE.Sprite(spriteMaterial);
    group.add(sprite);

    const checks = {
      sharedGeometry: disposed(sharedGeometry),
      sharedMaterial: disposed(sharedMaterial),
      ownGeometry: disposed(ownGeometry),
      ownMaterial: disposed(ownMaterial),
      spriteMaterial: disposed(spriteMaterial),
      markerMap: disposed(markerMap),
      // three's one quad for every sprite in the page.
      spriteGeometry: disposed(sprite.geometry),
    };
    disposeOwnResources(group, new Set([sharedGeometry, sharedMaterial]));

    expect(checks.ownGeometry()).toBe(true);
    expect(checks.ownMaterial()).toBe(true);
    expect(checks.spriteMaterial()).toBe(true);
    expect(checks.sharedGeometry()).toBe(false);
    expect(checks.sharedMaterial()).toBe(false);
    expect(checks.markerMap()).toBe(false);
    expect(checks.spriteGeometry()).toBe(false);
  });
});
