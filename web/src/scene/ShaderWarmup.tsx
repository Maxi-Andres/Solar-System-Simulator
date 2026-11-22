import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';

import { whenIdle } from '../core/idle.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { whenLayersArrived } from './lazyLayer.tsx';
import { compileFor, compileMapTwins, drawnIntoGlow, materialsOf, uncompiled, type Pass } from './shaderPrecompile.ts';

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
 *
 * Each program for the pass that draws it (shaderPrecompile.ts): the glows for the glow buffer,
 * where they are drawn, the rest for the canvas.
 *
 * **Then the rest, ahead of being seen.** Once the first frame is drawn, everything else mounted
 * -- the planets' spheres and atmospheres not yet near enough to draw, the far layers' glows,
 * a layer switched off -- is compiled in idle moments, PRECOMPILE_SLICE_MS of the main thread at a
 * time (`uncompiled`), with the twins for the surface maps still to come; and again every
 * PRECOMPILE_EVERY_MS for whatever has been made since. Each was a compile on first sight, 50 ms
 * to a second of a held page as the planet or the galaxy came into view.
 */
export const MAX_WAIT_MS = 2500;

/**
 * The main thread an idle moment gives to compiling ahead, milliseconds: what three does before
 * handing a program to the driver -- its parameters, its source -- object by object until this
 * is spent. Most materials share a program already compiled and cost a fraction of one.
 */
export const PRECOMPILE_SLICE_MS = 8;
/** The most materials looked out per idle moment, of which as many are compiled as the slice allows. */
const PRECOMPILE_SCAN = 256;
/** How often the scene is looked over for what is still to compile, milliseconds. */
export const PRECOMPILE_EVERY_MS = 1500;

export function ShaderWarmup() {
  const { gl, scene, get } = useThree();

  useEffect(() => {
    const render = gl.render;
    let state: 'first' | 'waiting' | 'ready' | 'compiling' | 'done' = 'first';
    let cancelWait = (): void => undefined;
    // What the first frame drew on the canvas: its maps' twins are the first thing compiled after.
    let firstCanvas: THREE.Object3D[] = [];
    const restore = (): void => {
      if (state === 'done') return;
      state = 'done';
      cancelWait();
      gl.render = render;
      renderDemand.request();
      // The first frame's materials' twins at once: the Sun's map is in half a second later.
      if (firstCanvas.length > 0) {
        void compileMapTwins(gl, get().camera, scene, firstCanvas);
        firstCanvas = [];
      }
      schedule(0);
    };
    // What the scene draws this frame, by the pass that draws it.
    const firstFrame = (frameCamera: THREE.Camera): Promise<unknown> => {
      const glow: THREE.Object3D[] = [];
      scene.traverseVisible((object) => {
        if (materialsOf(object).length > 0) (drawnIntoGlow(object) ? glow : firstCanvas).push(object);
      });
      return Promise.all([
        compileFor(gl, frameCamera, scene, firstCanvas, 'canvas'),
        compileFor(gl, frameCamera, scene, glow, 'glow'),
      ]);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    gl.render = (target: THREE.Object3D, frameCamera: THREE.Camera): void => {
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
          firstFrame(frameCamera).then(restore, restore);
        } catch {
          restore();
        }
      }
      if (state === 'first') {
        render.call(gl, target, frameCamera);
      }
    };

    // The rest, in idle moments once the first frame is drawn: see the header.
    let pending: ReturnType<typeof setTimeout> | undefined;
    let cancelIdle = (): void => undefined;
    const pass = (): void => {
      const started = performance.now();
      const { camera } = get();
      const work = uncompiled(scene, PRECOMPILE_SCAN);
      const todo: [THREE.Object3D, Pass][] = [
        ...work.glow.map((object): [THREE.Object3D, Pass] => [object, 'glow']),
        ...work.canvas.map((object): [THREE.Object3D, Pass] => [object, 'canvas']),
      ];
      if (todo.length === 0) {
        schedule(PRECOMPILE_EVERY_MS);
        return;
      }
      // Not waited for: the driver compiles them side by side while the page goes on.
      for (const [object, pass] of todo) {
        if (performance.now() - started > PRECOMPILE_SLICE_MS) break;
        void compileFor(gl, camera, scene, [object], pass);
        if (pass === 'canvas') void compileMapTwins(gl, camera, scene, [object]);
      }
      schedule(0);
    };
    function schedule(ms: number): void {
      clearTimeout(pending);
      cancelIdle();
      pending = setTimeout(() => {
        cancelIdle = whenIdle(pass, PRECOMPILE_EVERY_MS);
      }, ms);
    }

    return () => {
      clearTimeout(timer);
      restore();
      clearTimeout(pending);
      cancelIdle();
    };
  }, [gl, scene, get]);

  return null;
}
