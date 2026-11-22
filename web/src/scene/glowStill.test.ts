import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { GlowStill } from './glowStill.ts';

function camera(distance: number): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 16 / 9, 1, 1e12);
  c.position.set(0, 0, distance);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}

function glow(): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFade: { value: 1 },
      uCentre: { value: new THREE.Vector3(1, 2, 3) },
      uTurn: { value: new THREE.Matrix4() },
      uTint: { value: new THREE.Color(1, 0.5, 0.25) },
      uLevels: { value: [0.1, 0.2] },
      uMap: { value: null },
    },
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.updateMatrixWorld();
  return mesh;
}

describe('whether the glows would draw what they drew', () => {
  it('draws the first time, and keeps the buffers while nothing changes', () => {
    const still = new GlowStill();
    const c = camera(10);
    const g = glow();
    expect(still.same(c, 100, 50, false, [g], [])).toBe(false);
    expect(still.same(c, 100, 50, false, [g], [])).toBe(true);
    expect(still.same(c, 100, 50, false, [g], [])).toBe(true);
  });

  it('draws again for any change to the camera, the buffer or the lists', () => {
    const c = camera(10);
    const g = glow();
    const h = glow();
    const changes: [string, (still: GlowStill) => boolean][] = [
      ['camera moved', (s) => s.same(camera(10 + 1e-5), 100, 50, false, [g], [])],
      ['buffer resized', (s) => s.same(c, 101, 50, false, [g], [])],
      ['volumes apart', (s) => s.same(c, 100, 50, true, [g], [])],
      ['another glow', (s) => s.same(c, 100, 50, false, [g, h], [])],
      ['a glow taken', (s) => s.same(c, 100, 50, false, [], [])],
      ['a glow made a volume', (s) => s.same(c, 100, 50, false, [], [g])],
    ];
    for (const [what, change] of changes) {
      const still = new GlowStill();
      still.same(c, 100, 50, false, [g], []);
      expect(change(still), what).toBe(false);
    }
  });

  it('draws again for any change to what a glow draws', () => {
    const c = camera(10);
    const edits: [string, (g: ReturnType<typeof glow>) => void][] = [
      ['a number', (g) => (g.material.uniforms['uFade']!.value = 0.999999)],
      ['a vector', (g) => g.material.uniforms['uCentre']!.value.setZ(3.000001)],
      ['a matrix', (g) => g.material.uniforms['uTurn']!.value.elements.splice(12, 1, 1e-12)],
      ['a colour', (g) => g.material.uniforms['uTint']!.value.setRGB(1, 0.5, 0.26)],
      ['an array', (g) => (g.material.uniforms['uLevels']!.value[1] = 0.3)],
      ['a texture', (g) => (g.material.uniforms['uMap']!.value = new THREE.Texture())],
      ['the material', (g) => (g.material.needsUpdate = true)],
      ['its place', (g) => {
        g.position.x = 1e-6;
        g.updateMatrixWorld();
      }],
      ['its geometry', (g) => g.geometry.setDrawRange(0, 6)],
      ['an attribute', (g) => (g.geometry.getAttribute('position').needsUpdate = true)],
      ['a child drawn with it', (g) => {
        const child = glow();
        g.add(child);
      }],
    ];
    for (const [what, edit] of edits) {
      const still = new GlowStill();
      const g = glow();
      still.same(c, 100, 50, false, [g], []);
      edit(g);
      expect(still.same(c, 100, 50, false, [g], []), what).toBe(false);
      // And then kept again.
      expect(still.same(c, 100, 50, false, [g], []), what).toBe(true);
    }
  });

  it('counts what single precision cannot tell apart as the same, as the GPU would', () => {
    // The camera rig's float64 arithmetic leaves a still camera a part in 10^17 off; no float32 sees it.
    const still = new GlowStill();
    const g = glow();
    still.same(camera(10), 100, 50, false, [g], []);
    g.material.uniforms['uCentre']!.value.setZ(3 + 1e-12);
    expect(still.same(camera(10 * (1 + 1e-16)), 100, 50, false, [g], [])).toBe(true);
  });

  it('a texture updated in place is a change; one drawn into never stays the same', () => {
    const c = camera(10);
    const g = glow();
    const texture = new THREE.Texture();
    g.material.uniforms['uMap']!.value = texture;
    const still = new GlowStill();
    still.same(c, 100, 50, false, [g], []);
    texture.needsUpdate = true;
    expect(still.same(c, 100, 50, false, [g], [])).toBe(false);

    const target = new THREE.WebGLRenderTarget(4, 4);
    g.material.uniforms['uMap']!.value = target.texture;
    still.same(c, 100, 50, false, [g], []);
    expect(still.same(c, 100, 50, false, [g], [])).toBe(false);
  });

  it('never keeps a frame it cannot see into, nor one after it is told to forget', () => {
    const c = camera(10);
    const g = glow();
    g.material.uniforms['uStruct'] = { value: { a: 1 } };
    const still = new GlowStill();
    still.same(c, 100, 50, false, [g], []);
    expect(still.same(c, 100, 50, false, [g], [])).toBe(false);

    const h = glow();
    still.same(c, 100, 50, false, [h], []);
    still.forget();
    expect(still.same(c, 100, 50, false, [h], [])).toBe(false);
  });

  it('a hidden child is not drawn, and is not compared', () => {
    const c = camera(10);
    const g = glow();
    const child = glow();
    child.visible = false;
    g.add(child);
    const still = new GlowStill();
    still.same(c, 100, 50, false, [g], []);
    child.material.uniforms['uFade']!.value = 0.5;
    expect(still.same(c, 100, 50, false, [g], [])).toBe(true);
  });
});

describe('instanced glows', () => {
  function instanced(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), glow().material, 4);
    mesh.count = 2;
    mesh.updateMatrixWorld();
    return mesh;
  }

  it('compares the instances drawn by value: marked changed with the same numbers is the same', () => {
    const c = camera(10);
    const mesh = instanced();
    const still = new GlowStill();
    still.same(c, 100, 50, false, [mesh], []);
    mesh.instanceMatrix.needsUpdate = true;
    expect(still.same(c, 100, 50, false, [mesh], [])).toBe(true);
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(1, 0, 0));
    expect(still.same(c, 100, 50, false, [mesh], [])).toBe(false);
    // One past those drawn changes nothing drawn.
    mesh.setMatrixAt(3, new THREE.Matrix4().makeTranslation(1, 0, 0));
    expect(still.same(c, 100, 50, false, [mesh], [])).toBe(true);
  });

  it('with none drawn, nothing else of it matters', () => {
    const c = camera(10);
    const mesh = instanced();
    mesh.count = 0;
    const still = new GlowStill();
    still.same(c, 100, 50, false, [mesh], []);
    (mesh.material as THREE.ShaderMaterial).uniforms['uFade']!.value = 0.5;
    expect(still.same(c, 100, 50, false, [mesh], [])).toBe(true);
  });
});
