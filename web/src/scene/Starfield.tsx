import type { StarCatalog } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { brightestMagnitude } from '../core/starCatalog.ts';
import type { SimClock } from '../core/time.ts';
import { DISPLAY_FLOOR } from './shading.ts';
import {
  buildStarAttributes,
  EQUATORIAL_POLE_IN_SCENE,
  yearsSinceEpoch,
} from './starGeometry.ts';
import {
  magnitudeToPeakCoefficients,
  PSF_SIGMA_PX,
  SPHERE_RADIUS,
  STAR_FRAGMENT_SHADER,
  STAR_VERTEX_SHADER,
} from './starRendering.ts';

/**
 * The sky, from the ESA Hipparcos catalogue.
 *
 * **Every star here is a real one**, at its own right ascension and declination, moving
 * at its own proper motion, at its own magnitude and in the colour its measured B-V
 * implies. 25,695 of them, down to magnitude 7.5. Nothing in this component invents a
 * star, and with it the last thing on screen that was not real is gone.
 *
 * ## What used to be here, and why neither of them worked
 *
 * **A procedural field**, from v1 through step 6e: 4,000 seeded random points. Honest
 * about being a placeholder, labelled as such in the About panel, and wrong in a way
 * that is measurable -- it put about 120 stars in the reference's own field where the
 * real sky has 781. It was not too crowded. It was three times too empty.
 *
 * **A photographic Milky Way panorama**, briefly, in step 6d. Correctly placed -- the
 * galactic frame in `galactic.ts` is checked against Sgr A*, Andromeda and both
 * Magellanic Clouds -- and still wrong, because a photograph is the wrong instrument
 * for a sky. Measured against the reference: theirs is 90% exactly black with discrete,
 * individually coloured stars, and ours was a continuous grey wash with 31.8% of the
 * sky lit against their 0.9%. A photograph's stars arrive already blurred by an
 * atmosphere and a lens and are then magnified about twice over; no resolution and no
 * exposure turns that back into points.
 *
 * A catalogue is the other instrument, and it is the one the reference is using.
 *
 * ## Where the decisions live
 *
 * Not here. `starRendering.ts` holds the two constants that turn a magnitude into
 * pixels and the reasoning for both; this file is the wiring. The one thing worth
 * knowing while reading it is that the sphere follows the camera every frame, so the
 * stars never parallax -- which for objects light years away is not a trick, it is the
 * correct behaviour at the accuracy a screen can show.
 */

export interface StarfieldProps {
  readonly catalog: StarCatalog;
  readonly clock: SimClock;
}

export function Starfield({ catalog, clock }: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const attributes = buildStarAttributes(catalog);
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(attributes.positions, 3));
    buffer.setAttribute('properMotion', new THREE.BufferAttribute(attributes.properMotions, 2));
    buffer.setAttribute('magnitude', new THREE.BufferAttribute(attributes.magnitudes, 1));
    buffer.setAttribute('starColor', new THREE.BufferAttribute(attributes.colors, 3));
    return buffer;
  }, [catalog]);

  const material = useMemo(() => {
    const coefficients = magnitudeToPeakCoefficients(
      brightestMagnitude(catalog),
      catalog.magnitudeLimit,
    );
    const pole = EQUATORIAL_POLE_IN_SCENE;
    return new THREE.ShaderMaterial({
      uniforms: {
        uSphereRadius: { value: SPHERE_RADIUS },
        uYearsSinceEpoch: { value: 0 },
        uEquatorialPole: { value: new THREE.Vector3(pole.x, pole.y, pole.z) },
        uMagnitudeToPeak: { value: new THREE.Vector2(coefficients[0], coefficients[1]) },
        uSigmaPx: { value: PSF_SIGMA_PX },
        uDisplayFloor: { value: DISPLAY_FLOOR },
        uPixelRatio: { value: 1 },
      },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      // Stars add: two overlapping profiles are two sources of light, not one
      // occluding the other. Depth is read so a planet can pass in front, and never
      // written, since a point sprite has no depth worth handing to anything else.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      // The exposure has already been chosen and stated. See STAR_FRAGMENT_SHADER.
      toneMapped: false,
    });
  }, [catalog]);

  useFrame(({ camera, gl }) => {
    const points = pointsRef.current;
    if (points === null) {
      return;
    }
    // Follow the camera so the stars never leave the frustum and never parallax.
    points.position.copy(camera.position);
    material.uniforms['uYearsSinceEpoch']!.value = yearsSinceEpoch(clock.tdbJulianDay);
    // Read every frame rather than at build time: dragging the window to a display of
    // a different density changes this, and a star is sized in CSS pixels.
    material.uniforms['uPixelRatio']!.value = gl.getPixelRatio();
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-1}
    />
  );
}
