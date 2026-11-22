import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { drawIntoGlow } from './glowBuffer.ts';
import { askedFor, compiledFor, compileFor, compileMapTwins, drawnIntoGlow, uncompiled } from './shaderPrecompile.ts';

/**
 * A stand-in for the renderer: compile records what it was given, with the render target set at
 * the time, and every program is ready at once.
 */
function fakeRenderer() {
  const calls: { materials: THREE.Material[]; target: unknown; map: (THREE.Texture | null)[]; keys: string[] }[] = [];
  let target: unknown = null;
  const gl = {
    compile: (scene: THREE.Object3D) => {
      const materials = new Set<THREE.Material>();
      const map: (THREE.Texture | null)[] = [];
      const keys: string[] = [];
      scene.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial;
        materials.add(material);
        map.push(material.map ?? material.alphaMap ?? null);
        keys.push(material.customProgramCacheKey());
      });
      calls.push({ materials: [...materials], target, map, keys });
      return materials;
    },
    properties: { get: () => ({ currentProgram: { isReady: () => true } }) },
    extensions: { get: () => ({}) },
    getRenderTarget: () => target,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, calls };
}

const camera = new THREE.PerspectiveCamera();

describe('compiling ahead', () => {
  it('compiles a glow into a render target and the rest for the canvas, and marks them done', async () => {
    const { gl, calls } = fakeRenderer();
    const scene = new THREE.Scene();
    const body = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial());
    const halo = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial());
    drawIntoGlow(halo);
    scene.add(body, halo);
    expect(drawnIntoGlow(halo)).toBe(true);
    expect(drawnIntoGlow(body)).toBe(false);

    const work = uncompiled(scene, 10);
    expect(work.canvas).toEqual([body]);
    expect(work.glow).toEqual([halo]);
    const done = Promise.all([
      compileFor(gl, camera, scene, work.canvas, 'canvas'),
      compileFor(gl, camera, scene, work.glow, 'glow'),
    ]);
    expect(askedFor(halo.material, 'glow')).toBe(true);
    await done;
    expect(compiledFor(halo.material, 'glow')).toBe(true);
    expect(compiledFor(halo.material, 'canvas')).toBe(false);
    expect(calls[0]!.target).toBeNull();
    expect(calls[1]!.target).not.toBeNull();
    // And the render target put back as it was.
    expect(gl.getRenderTarget()).toBeNull();
    // Nothing left to do.
    expect(uncompiled(scene, 10)).toEqual({ canvas: [], glow: [] });
  });

  it('takes the visible first, at most a batch at a time', () => {
    const scene = new THREE.Scene();
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    hidden.visible = false;
    const shown = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    scene.add(hidden, shown);
    expect(uncompiled(scene, 1).canvas).toEqual([shown]);
    expect(uncompiled(scene, 2).canvas).toEqual([shown, hidden]);
  });

  it('compiles a twin with a map for a material that may get one, and leaves the material as it was', async () => {
    const { gl, calls } = fakeRenderer();
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    material.onBeforeCompile = () => undefined;
    material.customProgramCacheKey = () => 'patched';
    const body = new THREE.Mesh(new THREE.SphereGeometry(), material);
    scene.add(body);
    await compileMapTwins(gl, camera, scene, [body]);
    expect(body.material).toBe(material);
    expect(material.map).toBeNull();
    expect(material.transparent).toBe(false);
    // Itself see-through, with a map, and with a map see-through: each with the material's key.
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.map[0] !== null)).toEqual([false, true, true]);
    expect(calls.every((call) => call.keys[0] === 'patched')).toBe(true);
    // Once per material.
    await compileMapTwins(gl, camera, scene, [body]);
    expect(calls).toHaveLength(3);
  });

  it('a transparent standard material gets an alpha map twin too; a shader material none', async () => {
    const { gl, calls } = fakeRenderer();
    const scene = new THREE.Scene();
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial({ transparent: true }));
    const custom = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.ShaderMaterial());
    scene.add(clouds, custom);
    await compileMapTwins(gl, camera, scene, [clouds, custom]);
    // Opaque; a map, opaque or not; an alpha map, opaque or not. The shader material: none.
    expect(calls).toHaveLength(5);
  });
});
