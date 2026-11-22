import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { grownCapacity, MARKER_STRIDE, MarkerInstances } from './markerInstances.ts';

const WHITE = new THREE.Color(1, 1, 1);

/** The markers written this frame, one row of MARKER_STRIDE floats each. */
function written(batch: MarkerInstances): number[][] {
  const geometry = batch.mesh.geometry;
  const array = (geometry.getAttribute('aView') as THREE.InterleavedBufferAttribute).data.array as Float32Array;
  const rows: number[][] = [];
  for (let k = 0; k < geometry.instanceCount; k += 1) {
    rows.push([...array.subarray(k * MARKER_STRIDE, (k + 1) * MARKER_STRIDE)]);
  }
  return rows;
}

function batch(): MarkerInstances {
  return new MarkerInstances(new THREE.Texture(), new THREE.Texture(), new THREE.Texture());
}

describe('grownCapacity', () => {
  it('keeps a buffer that holds enough, and doubles one that does not until it does', () => {
    expect(grownCapacity(10, 256)).toBe(256);
    expect(grownCapacity(256, 256)).toBe(256);
    expect(grownCapacity(257, 256)).toBe(512);
    expect(grownCapacity(1500, 256)).toBe(2048);
    expect(grownCapacity(3, 0)).toBe(4);
  });
});

describe('MarkerInstances', () => {
  it('writes each marker’s centre, size, colour, opacity and shape, farthest first', () => {
    const markers = batch();
    markers.begin();
    markers.stage('near', { x: 1, y: 2, z: -10 }, 0.5, new THREE.Color(0.25, 0.5, 0.75), 0.8, 'circle');
    markers.stage('far', { x: -3, y: 4, z: -1000 }, 50, WHITE, 1, 'diamond');
    markers.stage('middle', { x: 0, y: 0, z: -100 }, 5, WHITE, 0.5, 'circle');

    expect(markers.commit(() => true)).toBe(3);
    const rows = written(markers);
    expect(rows.map((row) => row[2])).toEqual([-1000, -100, -10]);
    expect(rows[0]).toEqual([-3, 4, -1000, 50, 1, 1, 1, 1, 1]);
    expect(rows[2]).toEqual([1, 2, -10, 0.5, 0.25, 0.5, 0.75, Math.fround(0.8), 0]);
    expect(markers.mesh.visible).toBe(true);
  });

  it('numbers each shape for the map the shader picks: fiction’s triangle the third (core/fiction.ts)', () => {
    const markers = batch();
    markers.begin();
    markers.stage('circle', { x: 0, y: 0, z: -3 }, 1, WHITE, 1, 'circle');
    markers.stage('diamond', { x: 0, y: 0, z: -2 }, 1, WHITE, 1, 'diamond');
    markers.stage('triangle', { x: 0, y: 0, z: -1 }, 1, WHITE, 1, 'triangle');
    markers.commit(() => true);
    expect(written(markers).map((row) => row[8])).toEqual([0, 1, 2]);
    expect(Object.keys(markers.mesh.material.uniforms).sort()).toEqual(['uCircle', 'uDiamond', 'uTriangle']);
  });

  it('draws only the markers kept, and none at all when none are', () => {
    const markers = batch();
    markers.begin();
    markers.stage('a', { x: 0, y: 0, z: -1 }, 1, WHITE, 1, 'circle');
    markers.stage('b', { x: 0, y: 0, z: -2 }, 1, WHITE, 1, 'circle');
    expect(markers.commit((id) => id !== 'b')).toBe(1);
    expect(written(markers)[0]![2]).toBe(-1);

    markers.begin();
    markers.stage('a', { x: 0, y: 0, z: -1 }, 1, WHITE, 1, 'circle');
    expect(markers.commit(() => false)).toBe(0);
    expect(markers.mesh.geometry.instanceCount).toBe(0);
    expect(markers.mesh.visible).toBe(false);
  });

  it('forgets a body that is no longer staged: no slot is held for it', () => {
    const markers = batch();
    markers.begin();
    markers.stage('kept', { x: 0, y: 0, z: -1 }, 1, WHITE, 1, 'circle');
    markers.stage('removed', { x: 0, y: 0, z: -2 }, 1, WHITE, 1, 'circle');
    markers.commit(() => true);

    markers.begin();
    markers.stage('kept', { x: 0, y: 0, z: -1 }, 1, WHITE, 1, 'circle');
    expect(markers.commit(() => true)).toBe(1);
    expect(written(markers)).toHaveLength(1);
  });

  it('grows into a new geometry when a frame has more markers than the buffer holds, freeing the old', () => {
    const markers = batch();
    const first = markers.mesh.geometry;
    let freed = false;
    first.addEventListener('dispose', () => {
      freed = true;
    });
    markers.begin();
    for (let i = 0; i < 600; i += 1) {
      markers.stage(`body-${i}`, { x: i, y: 0, z: -1 - i }, 1, WHITE, 1, 'circle');
    }
    expect(markers.commit(() => true)).toBe(600);

    expect(markers.mesh.geometry).not.toBe(first);
    expect(freed).toBe(true);
    const rows = written(markers);
    expect(rows).toHaveLength(600);
    // Farthest first, every one of them.
    expect(rows[0]![0]).toBe(599);
    expect(rows[599]![0]).toBe(0);
  });

  it('is drawn over everything, after the rest, and never culled or picked by its own bounds', () => {
    const markers = batch();
    expect(markers.mesh.renderOrder).toBe(10);
    expect(markers.mesh.frustumCulled).toBe(false);
    expect(markers.mesh.material.depthTest).toBe(false);
    expect(markers.mesh.material.depthWrite).toBe(false);
    expect(markers.mesh.material.transparent).toBe(true);
    const hits: THREE.Intersection[] = [];
    markers.mesh.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
  });

  it('takes the logarithmic depth buffer as every shader here does (logDepth.ts)', () => {
    const { vertexShader, fragmentShader } = batch().mesh.material;
    expect(vertexShader).toContain('#include <logdepthbuf_vertex>');
    expect(fragmentShader).toContain('#include <logdepthbuf_fragment>');
    // And the renderer's tone curve and encoding, as on a sprite.
    expect(fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(fragmentShader).toContain('#include <colorspace_fragment>');
  });
});
