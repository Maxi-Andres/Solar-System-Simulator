import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';

import { renderDemand } from '../core/renderDemand.ts';
import { whenLayersArrived } from './lazyLayer.tsx';

/**
 * The first frame's shaders, compiled before it is drawn and without holding the page.
 *
 * A material's program is compiled the first time something drawn with it is drawn, and
 * three then asks the program where its attributes are -- which waits, on the main thread,
 * for the compile and link to finish. The first frame has a few dozen programs, so it was one
 * task of 0.3 to 1.3 s in which the page could do nothing else. `compileAsync` starts them all
 * at once and asks only once the driver says each is done (KHR_parallel_shader_compile, where
 * the browser has it): they compile side by side, off the main thread, and the frame that
 * follows finds them ready.
 *
 * Only what the first frame draws: what is visible once every component has run its frame --
 * the first frame's own work, its draw held back. Compiling everything mounted instead, the
 * far layers' hidden programs with the rest, kept the first draw waiting several seconds for
 * programs no one would see for minutes.
 *
 * So the renderer's first draw of the scene is not drawn: in its place the compile starts, and
 * every draw is skipped until it is done -- or until MAX_WAIT_MS, whatever is still compiling
 * then finishing as it would have -- when the renderer is given back and a frame asked for.
 *
 * The far layers come in chunks of their own (lazyLayer.tsx), usually before the canvas first
 * renders. One that has not yet when the first draw comes would be missing from the compile,
 * and its programs, if it drew anything, would then compile the old way, holding the page. So
 * the compile waits for them first, draws skipped meanwhile, within the same MAX_WAIT_MS; once
 * they are in, a frame is asked for, in which they have run, and its draw starts the compile.
 */
export const MAX_WAIT_MS = 2500;

export function ShaderWarmup() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const render = gl.render;
    let state: 'first' | 'waiting' | 'ready' | 'compiling' | 'done' = 'first';
    let cancelWait = (): void => undefined;
    const restore = (): void => {
      if (state === 'done') return;
      state = 'done';
      cancelWait();
      gl.render = render;
      renderDemand.request();
    };
    // What the scene draws this frame: `traverse` over the visible only, for compile's walk.
    const visible = {
      traverse: (callback: (object: THREE.Object3D) => void) => scene.traverseVisible(callback),
      traverseVisible: (callback: (object: THREE.Object3D) => void) => scene.traverseVisible(callback),
    } as unknown as THREE.Object3D;
    let timer: ReturnType<typeof setTimeout> | undefined;
    gl.render = (target: THREE.Object3D, camera: THREE.Camera): void => {
      if (state === 'first' && target === scene) {
        state = 'waiting';
        timer = setTimeout(restore, MAX_WAIT_MS);
        cancelWait = whenLayersArrived(() => {
          if (state !== 'waiting') return;
          state = 'ready';
          renderDemand.request();
        });
      }
      if (state === 'ready' && target === scene) {
        state = 'compiling';
        try {
          gl.compileAsync(visible, camera, scene).then(restore, restore);
        } catch {
          restore();
        }
      }
      if (state === 'first') {
        render.call(gl, target, camera);
      }
    };
    return () => {
      clearTimeout(timer);
      restore();
    };
  }, [gl, scene]);

  return null;
}
