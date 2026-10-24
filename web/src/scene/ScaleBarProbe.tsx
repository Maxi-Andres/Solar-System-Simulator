import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import type * as THREE from 'three';

import type { ScaleBarElements } from '../ui/ScaleBar.tsx';
import { KM_PER_UNIT } from './scale.ts';
import { kmPerPixelAt, scaleBarReading } from './scaleBar.ts';

/**
 * Measures the picture for the scale bar, each frame, at the focus's distance -- the
 * camera's distance from the origin, since the floating origin puts the focus there -- and
 * writes what changed into the bar's DOM. See scaleBar.ts.
 *
 * Mounted after CameraRig in effect, though not in order: CameraRig's frame runs first by
 * its priority, so this reads the camera where this frame will draw it.
 */
export function ScaleBarProbe({ elements }: { readonly elements: RefObject<ScaleBarElements | null> }) {
  const { camera, size } = useThree();

  useFrame(() => {
    const parts = elements.current;
    if (parts === null || size.height <= 0) {
      return;
    }
    const distanceKm = camera.position.length() * KM_PER_UNIT;
    const reading = scaleBarReading(
      kmPerPixelAt(distanceKm, (camera as THREE.PerspectiveCamera).fov, size.height),
    );
    // Compared against what the nodes hold rather than a copy kept here, so a bar remounted
    // with the interface is filled on its first frame. Reading them back is a property
    // lookup; only a write goes through the style system.
    const width = `${Math.round(reading.widthPx)}px`;
    const title = `${reading.detail}, at the distance of ${parts.root.dataset['focus'] ?? 'the focus'}`;
    if (parts.label.textContent !== reading.label) {
      parts.label.textContent = reading.label;
    }
    if (parts.bar.style.width !== width) {
      parts.bar.style.width = width;
    }
    if (parts.root.title !== title) {
      parts.root.title = title;
    }
  });

  return null;
}
