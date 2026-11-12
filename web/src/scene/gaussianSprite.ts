import * as THREE from 'three';

import { GLOW_FLOOR, GLOW_OUTPUT_GLSL } from './glowBuffer.ts';

/**
 * A light too small to be drawn as a volume, drawn as a Gaussian on the screen: a globular
 * cluster's (GlobularClusters.tsx), a galaxy's (LocalGroup.tsx), the nuclear cluster's
 * (nuclearClusterGlow.ts). Its column at a distance r pixels from its centre is
 *
 *     x(r) = peak e^(-r^2 / 2 sigma^2)
 *
 * written linear into the glow buffer, which shows it through the soft shoulder 1 - e^-x and
 * spills what is past white into a halo (glowBuffer.ts); it is drawn out to where it has
 * fallen to SPRITE_FLOOR:
 *
 *     r = sigma sqrt(2 ln(peak / SPRITE_FLOOR))
 *
 * -- four sigma for a peak at white, five for one a hundred times past it, six and a half for
 * a million times. A sprite of a fixed six sigma was cut square where its light was far past
 * white: Pal 2 from a few hundred parsecs, a bright square.
 *
 * ## A quad, not a point sprite
 *
 * A GPU point is at most so many pixels across (ALIASED_POINT_SIZE_RANGE: 1024 on the
 * machines this was measured on, 64 on some), and the whole point goes as soon as its centre
 * leaves the frame -- a cluster's light popping out while its wing still lay across the
 * screen. So each light is a quad, two triangles about its centre moved out on the screen by
 * the radius above: no limit to its size, and drawn while any of it is in view. The quad's
 * corners are the geometry's `position`, -1 to 1; each light's own numbers are per instance.
 */

/**
 * The faintest light a sprite draws, white columns: an eighth of a display step -- the glow
 * buffer's own floor (GLOW_FLOOR), so it rounds to black, and the edge where a sprite stops
 * never shows.
 */
export const SPRITE_FLOOR = GLOW_FLOOR;

/** How far out a Gaussian of centre `peak` (columns over white) is drawn, in its sigmas. */
export function spriteRadiusSigmas(peak: number, floor = SPRITE_FLOOR): number {
  return peak > floor ? Math.sqrt(2 * Math.log(peak / floor)) : 0;
}

/**
 * The vertex side: spriteRadiusPx as above (a pixel more, for the last pixel's centre), and
 * spriteCorner, which puts this vertex of the quad that many device pixels from the centre's
 * clip position -- off the screen if the centre is behind the camera or there is nothing to draw.
 */
export const SPRITE_VERTEX_GLSL = /* glsl */ `
uniform vec2 uViewportPx;
varying vec2 vOffsetPx;

float spriteRadiusPx(vec3 peak, float sigmaPx) {
  float p = max(peak.r, max(peak.g, peak.b));
  return p > ${SPRITE_FLOOR.toFixed(6)} ? sigmaPx * sqrt(2.0 * log(p / ${SPRITE_FLOOR.toFixed(6)})) + 1.0 : 0.0;
}

vec4 spriteCorner(vec4 centre, float radiusPx) {
  if (radiusPx <= 0.0 || centre.w <= 0.0) {
    vOffsetPx = vec2(0.0);
    return vec4(2.0, 2.0, 2.0, 1.0);
  }
  vOffsetPx = position.xy * radiusPx;
  return vec4(centre.xy + vOffsetPx * 2.0 / uViewportPx * centre.w, centre.zw);
}
`;

/**
 * The fragment side: the Gaussian at this fragment, linear, into the glow buffer (glowLight
 * cuts it at the floor). The shoulder and the halo are the buffer's, once, over every glow.
 */
export const SPRITE_FRAGMENT_GLSL = /* glsl */ `
varying vec2 vOffsetPx;
${GLOW_OUTPUT_GLSL}

vec4 spriteLight(vec3 peak, float sigmaPx) {
  return glowLight(peak * exp(-0.5 * dot(vOffsetPx, vOffsetPx) / (sigmaPx * sigmaPx)));
}
`;

/** The quad every light is an instance of: its corners, -1 to 1, as `position`. */
export function spriteGeometry(count: number): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.instanceCount = count;
  return geometry;
}
