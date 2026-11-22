import * as THREE from 'three';

/**
 * The hollow markers used for bodies too small to draw: a circle for a natural body,
 * a diamond for a spacecraft, a triangle for a fictional thing (core/fiction.ts) -- a shape
 * nothing real is drawn with, so fiction is told from data before its label is read.
 *
 * Shapes apart because they are different kinds of thing and the eye should know
 * which is which before reading a label -- NASA Eyes draws its craft differently from
 * its planets for the same reason. A spacecraft's marker is never replaced by a mesh,
 * so the diamond is all of it there is to see until a model exists.
 *
 * Generated on a canvas rather than shipped as a PNG: it is a few lines, it stays
 * crisp at any device pixel ratio, and it keeps the build free of binary assets.
 * Drawn white so a sprite's `color` can tint it per body.
 */

export type MarkerShape = 'circle' | 'diamond' | 'triangle';

const cached = new Map<MarkerShape, THREE.Texture>();

export function markerTexture(shape: MarkerShape = 'circle'): THREE.Texture {
  const existing = cached.get(shape);
  if (existing !== undefined) {
    return existing;
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
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(center, center, radius, 0, Math.PI * 2);
  } else if (shape === 'triangle') {
    // Point up, its centroid on the centre, its corners a little farther out than the
    // diamond's, for the area its narrow corners leave empty -- and no farther, or the mitred
    // top would be cut off at the texture's edge.
    const reach = radius * 1.2;
    for (let k = 0; k < 3; k += 1) {
      const angle = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
      const x = center + reach * Math.cos(angle);
      const y = center + reach * Math.sin(angle);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    // Corner to corner a little wider than the circle's diameter, so the two read as
    // the same size rather than the diamond looking smaller for its empty corners.
    const reach = radius * 1.15;
    ctx.moveTo(center, center - reach);
    ctx.lineTo(center + reach, center);
    ctx.lineTo(center, center + reach);
    ctx.lineTo(center - reach, center);
    ctx.closePath();
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The sprite is drawn at a fixed pixel size, so mipmaps only cost sharpness.
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  cached.set(shape, texture);
  return texture;
}
