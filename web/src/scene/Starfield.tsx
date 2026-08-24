import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Background starfield.
 *
 * PLACEHOLDER, and worth being explicit about it in a project whose whole premise is
 * real data: these stars are procedurally generated, not a catalog. They are the one
 * thing on screen that is not physically real. Phase D replaces them with Gaia DR3 /
 * Hipparcos positions and magnitudes, at which point Alpha Centauri will actually be
 * where Alpha Centauri is.
 *
 * The generator is seeded, so the sky at least stays the same sky between reloads.
 */

const STAR_COUNT = 4000;

/**
 * Distance to the star sphere, in scene units (1e9 units = 1e12 km).
 *
 * Parked far enough that no body can be beyond it, and translated with the camera
 * each frame so it behaves as if infinitely distant — no parallax, which for objects
 * light years away is the correct behaviour.
 */
const SPHERE_RADIUS = 1e9;

/** Deterministic PRNG (mulberry32) so the sky does not reshuffle on every reload. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const random = seededRandom(0x5eed);
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i += 1) {
      // Uniform on the sphere: inverting the cosine avoids the pole clustering that
      // naive latitude/longitude sampling produces.
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);

      positions[i * 3] = SPHERE_RADIUS * r * Math.cos(theta);
      positions[i * 3 + 1] = SPHERE_RADIUS * u;
      positions[i * 3 + 2] = SPHERE_RADIUS * r * Math.sin(theta);

      // A spread of brightness and a slight blue-white to orange tint, so the field
      // does not read as uniform noise.
      const brightness = 0.35 + random() * 0.65;
      const warmth = random();
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness * (0.92 + warmth * 0.08);
      colors[i * 3 + 2] = brightness * (0.85 + (1 - warmth) * 0.15);
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, []);

  useFrame(({ camera }) => {
    // Follow the camera so the stars never leave the frustum and never parallax.
    pointsRef.current?.position.copy(camera.position);
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <pointsMaterial
        size={1.4}
        sizeAttenuation={false}
        vertexColors
        transparent
        depthWrite={false}
      />
    </points>
  );
}
