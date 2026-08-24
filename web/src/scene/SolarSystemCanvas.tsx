import type { BodyId } from '@sss/tools/types';
import { Canvas } from '@react-three/fiber';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { CameraRig } from './CameraRig.tsx';
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
  const focusBody = store.body(focus);
  const radiusUnits = kmToUnits(focusBody.radiusEquatorialKm);

  return (
    <Canvas
      gl={{
        logarithmicDepthBuffer: true,
        antialias: true,
        // The Sun is genuinely far brighter than anything else in frame, so a
        // filmic curve keeps it from blowing out everything around it.
        toneMapping: 3, // THREE.ACESFilmicToneMapping
      }}
      camera={{ fov: FOV_DEG, near: 1e-6, far: 1e11 }}
      style={{ position: 'absolute', inset: 0, background: '#000' }}
    >
      <Starfield />
      <SolarSystem store={store} clock={clock} focus={focus} showOrbits={showOrbits} />
      <CameraRig
        focusKey={focus}
        // Framing relative to the body's own radius, so switching from the Sun to
        // Pluto -- six orders of magnitude apart -- arrives at the same apparent
        // size instead of burying the camera or losing the body entirely.
        framingDistance={radiusUnits * 8}
        minDistance={radiusUnits * 1.05}
        maxDistance={kmToUnits(2e10)}
      />
    </Canvas>
  );
}
