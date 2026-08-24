import * as THREE from 'three';

/**
 * The hollow-circle marker used for bodies too small to draw as spheres.
 *
 * Generated on a canvas rather than shipped as a PNG: it is a few lines, it stays
 * crisp at any device pixel ratio, and it keeps the build free of binary assets.
 * Drawn white so a sprite's `color` can tint it per body.
 */

let cached: THREE.Texture | null = null;

export function markerTexture(): THREE.Texture {
  if (cached !== null) {
    return cached;
  }

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Could not get a 2D context for the marker texture.');
  }

  const center = size / 2;
  // Leave a margin so the stroke is not clipped by the texture edge.
  const radius = size * 0.36;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The sprite is drawn at a fixed pixel size, so mipmaps only cost sharpness.
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  cached = texture;
  return texture;
}
