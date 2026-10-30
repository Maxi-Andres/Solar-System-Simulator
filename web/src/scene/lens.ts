import * as THREE from 'three';

import { IMAGE_SAMPLES } from '../core/schwarzschildLens.ts';

/**
 * What the black holes' lens (BlackHoleLens.tsx) shares with the sky it bends: the uniforms
 * every star shader reads, the GLSL that moves a star to its images, and the hook through
 * which the galaxy's glow is drawn into the lens's cube map.
 *
 * ## Stars: moved, not resampled
 *
 * A star is a point, and the lens maps a point to points: each star is drawn where the hole
 * shows it, at the angle theta from the hole whose ray ends up on the star -- the **primary
 * image**, on the star's own side and outside the Einstein ring -- and drawn a second time,
 * in a second pass, as the **secondary image** on the far side, between the ring and the
 * shadow. (The images that go round the hole once or more crowd the shadow's edge,
 * thousands of times fainter; for the stars they are left out, for the glow they are not.)
 * Each image is brighter or fainter by its magnification, the solid angle the image covers
 * over that of the source: surface brightness is conserved, so the flux of a point goes as
 * the area its image spans. Drawn this way the stars stay sharp at the screen's own
 * resolution, which a picture of the sky resampled through a cube map could not do.
 *
 * Close to the Einstein ring a point's magnification diverges; a real star's image there is
 * an arc, which a point cannot draw. So an image is drawn at most LENS_MU_CAP times (5
 * magnitudes) brighter than its star: a star crossing behind the hole flares, and does not
 * become a blinding spot.
 *
 * ## Stars at a finite distance
 *
 * The catalogue's stars are lensed as if infinitely far behind the hole (lensStar), which
 * from Sgr A* they are. The nuclear star cluster's are not: they are all round it, some in
 * front. lensStarAt takes a star's offset, works out the thin-lens factor D_ls / D_s from
 * the hole's distance -- zero in front of the hole, one far behind it -- and reads the same
 * table scaled by its square root (schwarzschildLens.ts, finiteSourceImage).
 */

/** The brightest an image is drawn, against its star: log10 of 100, five magnitudes. */
export const LENS_MU_CAP_LOG10 = 2;

/** The image table, (theta, log10 mu) pairs; written by BlackHoleLens. */
export const lensImageTexture = (() => {
  const texture = new THREE.DataTexture(
    new Float32Array(IMAGE_SAMPLES * 2),
    IMAGE_SAMPLES,
    1,
    THREE.RGFormat,
    THREE.FloatType,
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

/** The uniforms every star material shares, by reference: BlackHoleLens writes them. */
export const LENS_UNIFORMS = {
  uLensOn: { value: 0 },
  /** The unit direction from the camera to the hole, world axes. */
  uLensHole: { value: new THREE.Vector3(0, 0, -1) },
  uLensImages: { value: lensImageTexture as THREE.Texture },
  /** The image table's mapping: scale s, half-range W, samples. See LensTables. */
  uLensImageMap: { value: new THREE.Vector3(1, 1, IMAGE_SAMPLES) },
  uLensMuCap: { value: LENS_MU_CAP_LOG10 },
  /** The hole's distance from the camera, km: for stars at a finite distance (lensStarAt). */
  uLensHoleKm: { value: 0 },
  /** The shadow's angular radius from the camera, radians: no image is put inside it. */
  uLensShadow: { value: 0 },
};

/**
 * Whether the lens is on this frame: for the second pass's objects, which wait for it. And
 * the bodies the lens draws in their place this frame (BlackHoleLens.tsx): the star about
 * the hole, seen through it, and the hole itself where that star stands in front of it --
 * SolarSystem.tsx leaves their own meshes undrawn.
 */
export const lensState: { on: boolean; drawnByLens: Set<string> } = { on: false, drawnByLens: new Set() };

/** A star material's lens uniforms: the shared ones, and which image this pass draws. */
export function lensUniforms(image: 0 | 1): Record<string, THREE.IUniform> {
  return { ...LENS_UNIFORMS, uLensImage: { value: image } };
}

/**
 * The star shaders' lens. `direction` is the star's offset from the camera, world axes, of
 * any length; it comes back turned to this pass's image, the length kept. `dm` is the
 * image's magnitude change. False for the second image while there is no lens: that pass
 * draws nothing then.
 *
 * The table (schwarzschildLens.ts, buildLensTables) is sampled by hand, two texels and a
 * mix, being float32 and so not filterable everywhere.
 */
export const LENS_VERTEX_GLSL = /* glsl */ `
uniform float uLensOn;
uniform float uLensImage;
uniform vec3 uLensHole;
uniform sampler2D uLensImages;
uniform vec3 uLensImageMap;
uniform float uLensMuCap;

bool lensStar(inout vec3 direction, out float dm) {
  dm = 0.0;
  if (uLensOn < 0.5) {
    return uLensImage < 0.5;
  }
  float len = length(direction);
  vec3 d = direction / max(len, 1e-30);
  float c = dot(d, uLensHole);
  vec3 side = d - c * uLensHole;
  float s = length(side);
  // A star exactly behind the hole has no side: any will do, its images being a ring.
  vec3 across = abs(uLensHole.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 e2 = s > 1e-12 ? side / s : normalize(cross(uLensHole, across));
  // The source's angle from the hole; negative for the image on the far side.
  float y = atan(s, c) * (uLensImage > 0.5 ? -1.0 : 1.0);
  float t = clamp(
    (asinh(y / uLensImageMap.x) + uLensImageMap.y) / (2.0 * uLensImageMap.y) * uLensImageMap.z - 0.5,
    0.0,
    uLensImageMap.z - 1.0
  );
  float k = min(floor(t), uLensImageMap.z - 2.0);
  vec2 v = mix(
    texelFetch(uLensImages, ivec2(int(k), 0), 0).rg,
    texelFetch(uLensImages, ivec2(int(k) + 1, 0), 0).rg,
    t - k
  );
  float theta = max(y, 0.0) + v.x;
  float onSide = uLensImage > 0.5 ? -1.0 : 1.0;
  direction = (cos(theta) * uLensHole + sin(theta) * onSide * e2) * len;
  dm = -2.5 * min(v.y, uLensMuCap);
  return true;
}

uniform float uLensHoleKm;
uniform float uLensShadow;

vec2 lensTableAt(float y) {
  float t = clamp(
    (asinh(y / uLensImageMap.x) + uLensImageMap.y) / (2.0 * uLensImageMap.y) * uLensImageMap.z - 0.5,
    0.0,
    uLensImageMap.z - 1.0
  );
  float k = min(floor(t), uLensImageMap.z - 2.0);
  return mix(
    texelFetch(uLensImages, ivec2(int(k), 0), 0).rg,
    texelFetch(uLensImages, ivec2(int(k) + 1, 0), 0).rg,
    t - k
  );
}

// The same for a star at a finite distance from the hole: \`offset\` from the camera in units
// of kmPerUnit km. The thin-lens equation's factor f = D_ls / D_s, and the table scaled by it
// (schwarzschildLens.ts, sourceDistanceFactor and finiteSourceImage, are these lines). A
// star in front of the hole, f = 0, is drawn where it is and has no second image.
bool lensStarAt(inout vec3 offset, float kmPerUnit, out float dm) {
  dm = 0.0;
  if (uLensOn < 0.5) {
    return uLensImage < 0.5;
  }
  float len = length(offset);
  float along = dot(offset, uLensHole) * uLensHoleKm / kmPerUnit;
  float f = clamp(1.0 - along / max(len * len, 1e-30), 0.0, 1.0);
  if (f <= 1e-6) {
    return uLensImage < 0.5;
  }
  vec3 d = offset / max(len, 1e-30);
  float c = dot(d, uLensHole);
  vec3 side = d - c * uLensHole;
  float s = length(side);
  vec3 across = abs(uLensHole.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 e2 = s > 1e-12 ? side / s : normalize(cross(uLensHole, across));
  float y = atan(s, c);
  float root = sqrt(f);
  float scaled = min(${Math.PI.toFixed(7)}, y / root);
  float theta;
  float onSide;
  vec2 v;
  if (uLensImage > 0.5) {
    v = lensTableAt(-scaled);
    theta = max(root * v.x, uLensShadow * 1.0001);
    onSide = -1.0;
  } else {
    v = lensTableAt(scaled);
    theta = y + root * v.x;
    onSide = 1.0;
  }
  offset = (cos(theta) * uLensHole + sin(theta) * onSide * e2) * len;
  dm = -2.5 * min(v.y, uLensMuCap);
  return true;
}
`;

/**
 * The galaxy's glow, as the lens's cube map needs it: MilkyWay registers a painter that
 * draws its glow -- the same points, the same slabs and dust, this frame's uniforms --
 * through any camera at the main camera's place, into a target of the caller's, its sprite
 * sizes for `pixelsPerRadian`. `visibility` is the glow's this frame (0 when not drawn)
 * and `revision` counts the times what it draws has changed under it (the sample landing).
 */
export interface SkyCapture {
  visibility: number;
  revision: number;
  /** This frame's glow buffer itself, before its shoulder: drawn through the main camera. */
  screen: THREE.Texture | null;
  paint:
    | ((gl: THREE.WebGLRenderer, camera: THREE.Camera, target: THREE.WebGLRenderTarget, pixelsPerRadian: number) => void)
    | null;
}

export const skyCapture: SkyCapture = { visibility: 0, revision: 0, screen: null, paint: null };
