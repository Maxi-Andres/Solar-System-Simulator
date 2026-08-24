import type { BodyId } from '@sss/tools/types';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, type ComponentRef } from 'react';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { kmToUnits } from './scale.ts';
import { SolarSystem } from './SolarSystem.tsx';
import { Starfield } from './Starfield.tsx';

/**
 * The WebGL canvas and camera rig.
 *
 * Two settings here do the heavy lifting for scale:
 *
 *  - `logarithmicDepthBuffer`. A conventional depth buffer distributes precision by
 *    1/z, so a near plane small enough to stand on Earth's surface would leave
 *    nothing for Neptune. The logarithmic buffer spreads precision evenly in orders
 *    of magnitude, which is exactly the shape of this scene.
 *  - A near plane of 1e-6 units (one metre) and a far plane past the star sphere.
 *    That is a range of 1e17, which only the log buffer makes survivable.
 *
 * The camera always orbits the origin, because the floating origin has already put
 * the focused body there.
 */

/** Vertical field of view, degrees. Kept in sync with the marker sizing maths. */
export const FOV_DEG = 50;

export interface SolarSystemCanvasProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly showOrbits: boolean;
}

export function SolarSystemCanvas({ store, clock, focus, showOrbits }: SolarSystemCanvasProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  const focusBody = store.body(focus);
  // Never let the camera inside the body it is looking at.
  const minDistance = kmToUnits(focusBody.radiusEquatorialKm) * 1.05;

  /**
   * Reframe when the focus changes.
   *
   * Distances differ by six orders of magnitude between the Sun and Pluto, so a
   * fixed camera distance would either bury the camera inside the Sun or leave Pluto
   * a speck. Framing relative to the body's own radius keeps every body arriving at
   * the same apparent size.
   */
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls === null) {
      return;
    }
    const distance = kmToUnits(focusBody.radiusEquatorialKm) * 8;
    controls.object.position.set(distance * 0.4, distance * 0.35, distance);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [focus, focusBody.radiusEquatorialKm]);

  return (
    <Canvas
      gl={{
        logarithmicDepthBuffer: true,
        antialias: true,
        // Physically-correct-ish tone mapping; the Sun is genuinely much brighter
        // than anything else in frame.
        toneMapping: 3, // THREE.ACESFilmicToneMapping
      }}
      camera={{
        fov: FOV_DEG,
        near: 1e-6,
        far: 1e11,
        position: [kmToUnits(2e8), kmToUnits(1.2e8), kmToUnits(3e8)],
      }}
      style={{ position: 'absolute', inset: 0, background: '#000' }}
    >
      <Starfield />
      <SolarSystem store={store} clock={clock} focus={focus} showOrbits={showOrbits} />
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        // Dolly is multiplicative in OrbitControls, which is what makes the wheel
        // behave logarithmically: every notch changes distance by a fixed ratio, so
        // 1e1 km to 1e10 km is a smooth continuum rather than an unusable slider.
        zoomSpeed={1.1}
        rotateSpeed={0.6}
        minDistance={minDistance}
        maxDistance={kmToUnits(2e10)}
      />
    </Canvas>
  );
}
