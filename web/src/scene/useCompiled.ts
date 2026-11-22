import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type * as THREE from 'three';

import { renderDemand } from '../core/renderDemand.ts';

/**
 * `object`, once its shaders are compiled -- null until then.
 *
 * A layer switched on builds its objects in the frame it is switched on, and three compiles a
 * material's program the first time it is drawn, then asks where its attributes are, which
 * waits on the main thread for the compile and link to finish. The comets' shader, a conic
 * solved by Laguerre's method through Stumpff's series, held the page for 1.8 s that way on
 * an integrated GPU under Direct3D. `compileAsync` hands the compile to the driver
 * (KHR_parallel_shader_compile, where the browser has it) and asks only once it says it is
 * done, so the page goes on meanwhile and the object comes on screen in the frame after,
 * as ShaderWarmup does for the first frame and the nebulae and remnants for their gas.
 *
 * Compiled for the canvas, as the scene's main pass draws: an object drawn into a render
 * target (the glow buffer) compiles another program, and is not for this. three's compile
 * walks only what is visible, so `object` and everything under it are made so for the call -- a
 * frame may have hidden a part meanwhile -- and put back as they were.
 */
export function useCompiled<T extends THREE.Object3D>(object: T | null): T | null {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const [ready, setReady] = useState<T | null>(null);
  useEffect(() => {
    if (object === null) return;
    let live = true;
    const done = (): void => {
      if (!live) return;
      setReady(object);
      renderDemand.request();
    };
    let compiled: Promise<unknown>;
    const hidden: THREE.Object3D[] = [];
    object.traverse((part) => {
      if (!part.visible) {
        hidden.push(part);
        part.visible = true;
      }
    });
    try {
      compiled = gl.compileAsync(object, camera, scene);
    } catch {
      compiled = Promise.resolve();
    } finally {
      for (const part of hidden) part.visible = false;
    }
    compiled.then(done, done);
    return () => {
      live = false;
    };
  }, [object, gl, camera, scene]);
  return ready === object ? object : null;
}
