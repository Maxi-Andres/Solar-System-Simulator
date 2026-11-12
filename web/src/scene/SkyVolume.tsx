import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  CHANNEL_WAVELENGTHS_UM,
  columnAt,
  extinctionCurve,
  galaxyHalfLightPc,
  GIANTS,
  YOUNG_COLOUR_INDEX,
} from '../core/localGroup.ts';
import { renderDemand } from '../core/renderDemand.ts';
import {
  COMPACT_SIGMA_PC,
  depthTexels,
  parseSkyMap,
  SKY_STEPS,
  skyBox,
  skyFrame,
  skyScales,
  skyVolumesDrawn,
  smoothLevel,
  type SkyFrame,
} from '../core/skyMap.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { faceOnLevels, faceOnTexture, pngPixels } from './faceOnTexture.ts';
import { balmerColour, MARKS_FROM_LY, NEAR_SHARE, pointShare, WHITE_MU } from './LocalGroup.tsx';
import { drawIntoGlow, GLOW_OUTPUT_GLSL, releaseFromGlow } from './glowBuffer.ts';
import { galaxyVisibility } from './MilkyWay.tsx';
import { KM_PER_UNIT, LIGHT_YEAR_KM } from './scale.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';

/**
 * A galaxy drawn from its sky map (core/skyMap.ts): the Small Magellanic Cloud, a cloud deeper
 * along our line of sight than it is wide, not a disc.
 *
 * Its maps are what is seen of it from Earth -- old stars, star formation, dust and glowing gas,
 * each a column on the sky -- and how deep each kind of star lies along each direction. Each
 * point of the sky map is spread along its line of sight by the profile of its place: the old
 * stars' light by the old stars' (from RR Lyrae), a Gaussian, the young stars', their gas's and
 * the dust by the young stars' (from Cepheids), a Laplace -- a sharp core with long wings, as
 * their stars lie. So from Earth the column along every line of sight is the
 * map, and the cloud is its photographs; from beside it, it is a cigar pointing at the Sun --
 * its old stars 3 kpc either side of their mean along it, against some 2 across -- its young
 * stars nearer us in the north-east. That spread is the population's, not each thing's: what
 * is compact on the map -- HII regions, clusters, knots of dust -- is split from the large-scale
 * light and lies at the population's mean distance, as deep as it is wide (core/skyMap.ts, Two
 * scales), so from beside the cloud NGC 346 is a blob, not a tube pointing at the Sun.
 *
 * ## Drawn
 *
 * As the Local Group's other volumes (LocalGroup.tsx): a box about the camera, back faces, its
 * ray marched front to back in SKY_STEPS (core/skyMap.ts) steps -- over only its stretch within
 * the maps' circle as seen from the Sun (coneSpan), where all of the light is. Each step's ends
 * find their direction from the Sun -- the point in the map's frame (east, north, away about
 * its centre) with the Sun referencePc behind, so every number is a few tens of kiloparsecs,
 * which float32 holds to 0.004 pc -- and read the depth grid there. Between them the step takes
 * a Gaussian population's column by the trapezoid, a Laplace's exactly, its cumulative across
 * the step (laplaceAcross), and each compact layer's exactly too, the Gaussian's
 * cumulative across the step (gaussianAcross), as marchMapped takes its sheets': a layer 150 pc
 * deep is not missed between steps of 500. The large-scale part of the map is read at a
 * jittered point of the step; the compact part, where a layer is near, where that layer's light
 * in the step is centred (gaussianCentroid), the old stars' and the young stars' each at its
 * own. Each kind's light times its column, dimmed by the dust in front: its own step's dust by
 * half, as for light and dust mixed evenly through the step.
 *
 * The same exposure, shoulder, near limit and hand-off to a point when it is too small for a
 * pixel as the others; its smooth exponential ellipsoid in LocalGroup.tsx stands aside once the
 * maps are loaded (skyVolumesDrawn), its point staying.
 */

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 uLocal;
varying vec3 vRel;
void main() {
  vRel = (uLocal * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uFade;
// The map's frame (rows: east, north, away), the camera in it about the centre, pc, and the box.
uniform mat3 uAxes;
uniform vec3 uCamera;
uniform vec3 uBoxCentre;
uniform vec3 uBoxHalf;
// The map's distance: the Sun is this far behind its centre, along away.
uniform float uReferencePc;
// Light nearer the camera than this, pc, is left out (LocalGroup.tsx).
uniform float uNear;
// The sky map (faceOnTexture.ts): old and young stars' light, L_Sun/pc^2, the dust's V optical
// depth, the gas's Balmer light; and its half side on the tangent plane, xi = east / away.
uniform sampler2D uSky;
uniform float uSkyHalf;
// Its large-scale part: its mipmaps from the smooth one down (core/skyMap.ts smoothLevel), the
// same as uSky's, but a texture of their own, 32 texels a side, a read of which costs next to
// nothing.
uniform sampler2D uSmooth;
// The depth grid (skyMap.ts depthTexels): old mean less uReferencePc, old sigma, young the
// same, kpc; and its half side.
uniform sampler2D uDepth;
uniform float uDepthHalf;
// Each population's profile shape (core/skyMap.ts DepthShape), old and young: 1 a Laplace, 0 a
// Gaussian.
uniform vec2 uLaplace;
uniform vec3 uOldGlow;
uniform vec3 uYoungGlow;
uniform vec3 uNebulaGlow;
uniform vec3 uDustTau;
// A screen pixel's angle, and a texel's on the tangent plane, radians: which mipmap to read.
uniform float uPixelAngle;
uniform float uTexelAngle;
// The mipmap read as the map's large-scale part (core/skyMap.ts smoothLevel).
uniform float uSmoothLod;
varying vec3 vRel;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 slab(vec3 o, vec3 d, vec3 halfSize) {
  vec3 inv = 1.0 / d;
  vec3 a = (-halfSize - o) * inv;
  vec3 b = (halfSize - o) * inv;
  vec3 lo = min(a, b);
  vec3 hi = max(a, b);
  return vec2(max(max(lo.x, lo.y), max(lo.z, 0.0)), min(hi.x, min(hi.y, hi.z)));
}

// The stretch of the ray from o along d within the maps' circle seen from the Sun, inside span
// (core/skyMap.ts coneSpan); empty if none.
vec2 cone(vec3 o, vec3 d, vec2 span) {
  float r2 = uSkyHalf * uSkyHalf;
  float a = dot(d.xy, d.xy) - r2 * d.z * d.z;
  float b = dot(o.xy, d.xy) - r2 * o.z * d.z;
  float c = dot(o.xy, o.xy) - r2 * o.z * o.z;
  float disc = b * b - a * c;
  if (disc < 0.0) return a > 0.0 ? vec2(1.0, 0.0) : span;
  if (abs(a) <= 1e-12) return span;
  float s = sqrt(disc);
  vec2 t = vec2((-b - s) / a, (-b + s) / a);
  float t1 = min(t.x, t.y);
  float t2 = max(t.x, t.y);
  if (a > 0.0) return o.z + d.z * 0.5 * (t1 + t2) > 0.0 ? vec2(max(span.x, t1), min(span.y, t2)) : vec2(1.0, 0.0);
  return d.z > 0.0 ? vec2(max(span.x, t2), span.y) : vec2(span.x, min(span.y, t1));
}

// Where the point t of the ray reads the maps, uv, and which of their mipmaps: averaged over the
// pixel's footprint as seen from the Sun, or, if longer, over its sweep across the tangent plane
// along a stretch of the ray -- from beside the cloud a step crosses tens of texels, and read at
// one point they would be noise. For the map, the stretch along; for its large scale, the
// whole step. Past the maps' circle, uv -1: nothing there.
vec4 onMaps(vec3 q0, vec3 d, float t, float along, float whole) {
  vec3 q = q0 + d * t;
  // Its standard coordinates: its direction from the Sun on the tangent plane.
  vec2 st = q.xy / q.z;
  // The maps end in a circle short of their edge (tools/galaxies/prepare.py): nothing past it.
  if (dot(st, st) >= uSkyHalf * uSkyHalf) return vec4(-1.0);
  float footprint = t * uPixelAngle / length(q);
  float rate = length(d.xy * q.z - q.xy * d.z) / (q.z * q.z);
  return vec4(
    st / (2.0 * uSkyHalf) + 0.5,
    log2(max(footprint, rate * along) / uTexelAngle),
    log2(max(footprint, rate * whole) / uTexelAngle) - uSmoothLod
  );
}

// The unit Gaussian's tail past a >= 0, each of two, its density there given (core/skyMap.ts
// normalTail): 0.5 erfc(a / sqrt 2), and e^(-a^2 / 2) / 2 is phi(a) sqrt(pi / 2).
vec2 tail(vec2 a, vec2 phi) {
  vec2 t = 1.0 / (1.0 + ${(0.3275911 / Math.SQRT2).toFixed(9)} * a);
  return 1.2533141 * phi * t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
}

// Where along the step a layer's light from x0 to x1 is centred, a share of it, or the jitter
// if the step runs along it (core/skyMap.ts gaussianCentroid); its cumulative across given.
float layerCentre(float x0, float x1, float phi0, float phi1, float across, float jitter) {
  float dx = x1 - x0;
  if (abs(dx) < 0.01 || abs(across) < 1e-7) return jitter;
  return clamp(((phi0 - phi1) / across - x0) / dx, 0.0, 1.0);
}

// A point's place in each profile along its line of sight from the Sun: where it lies in the
// old stars' profile and the young's, and in the old stars' compact layer and the young's, in
// their sigmas; and the populations' inverse sigmas, per pc.
vec4 profiles(vec3 q, out vec2 inverse) {
  vec4 depth = texture(uDepth, q.xy / q.z / (2.0 * uDepthHalf) + 0.5) * 1000.0;
  vec4 off = vec4(length(q) - uReferencePc) - depth.xzxz;
  inverse = 1.0 / depth.yw;
  return vec4(off.xy * inverse, off.zw * ${(1 / COMPACT_SIGMA_PC).toFixed(9)});
}

// The populations' columns across a step, per unit of the map, from their places x and inverse
// sigmas at its ends. A Gaussian's by the trapezoid of its densities per pc, which for one
// sampled under a sigma apart is its integral to a ten-thousandth (skyMap.test.ts); a
// Laplace's, its core a cusp the trapezoid would cut, exactly (core/skyMap.ts laplaceAcross):
// the difference of its cumulative at the ends over dx -- across the cusp, one less its two
// tails, e^(-sqrt 2 |x|) / 2; to one side, the nearer end's tail times 1 - e^(-sqrt 2 |dx|);
// for a sliver, a hundredth or less, their series, so nothing is lost to rounding -- times the
// step over the mean sigma.
vec2 populations(vec2 x0, vec2 x1, vec2 inverse0, vec2 inverse1, float dt) {
  vec2 gaussian = 0.19947114 * (exp(-0.5 * x0 * x0) * inverse0 + exp(-0.5 * x1 * x1) * inverse1) * dt;
  vec2 a = abs(x0);
  vec2 b = abs(x1);
  vec2 width = abs(x1 - x0);
  bvec2 sliver = lessThan(width, vec2(0.01));
  vec2 safe = max(width, vec2(1e-6));
  vec2 across = mix(
    (1.0 - 0.5 * exp(-1.41421356 * a) - 0.5 * exp(-1.41421356 * b)) / safe,
    0.70710678 + (-0.5 * (a * a + b * b) + 0.23570226 * (a * a * a + b * b * b)) / safe,
    sliver
  );
  vec2 u = 1.41421356 * width;
  vec2 side = 0.5 * exp(-1.41421356 * min(a, b)) * mix((1.0 - exp(-u)) / safe, 1.41421356 * (1.0 - 0.5 * u + u * u / 6.0), sliver);
  vec2 mean = mix(across, side, equal(step(0.0, x0), step(0.0, x1)));
  vec2 laplace = mean * dt * 0.5 * (inverse0 + inverse1);
  return mix(gaussian, laplace, greaterThan(uLaplace, vec2(0.5)));
}

${GLOW_OUTPUT_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = uAxes * normalize(vRel);
  vec2 span = slab(uCamera - uBoxCentre, d, uBoxHalf);
  span.x = max(span.x, uNear);
  // The camera about the Sun.
  vec3 q0 = uCamera + vec3(0.0, 0.0, uReferencePc);
  // Only where the maps are: past the cloud's edge, nothing to march.
  span = cone(q0, d, span);
  if (span.y <= span.x) discard;
  float jitter = hash(gl_FragCoord.xy);
  float dt = (span.y - span.x) / float(${SKY_STEPS});
  vec3 light = vec3(0.0);
  vec3 through = vec3(1.0);
  vec2 inverse0;
  vec2 inverse1;
  vec4 p0 = profiles(q0 + d * span.x, inverse0);
  for (int i = 0; i < ${SKY_STEPS}; i++) {
    float t0 = span.x + float(i) * dt;
    vec4 p1 = profiles(q0 + d * (t0 + dt), inverse1);
    // Each profile's column across the step, per unit of the map: the populations', kiloparsecs
    // deep, each by its shape (populations).
    vec4 g = vec4(populations(p0.xy, p1.xy, inverse0, inverse1, dt), 0.0, 0.0);
    vec2 x0 = p0.zw;
    vec2 x1 = p1.zw;
    vec2 dx = x1 - x0;
    // The compact layers', 150 pc deep, only where one is within four sigmas of the step or
    // crossed in it -- elsewhere a step holds under 3e-5 of a layer's light, and every sum in
    // the march costs. Exactly, x straight along the step: the difference of the Gaussian's
    // cumulative at its ends -- of the two tails when both are on one side, so nothing is lost
    // to rounding near one -- over its dx (core/skyMap.ts gaussianAcross); the ends within a
    // hundredth, the trapezoid. And where each layer's light in the step is centred, a share of
    // it (gaussianCentroid), and its stretch, some two of its sigmas: there each is read.
    bvec2 nearby = lessThan(min(abs(x0), abs(x1)) * step(0.0, x0 * x1), vec2(4.0));
    vec2 centre = vec2(jitter);
    vec2 stretch = vec2(dt);
    if (any(nearby)) {
      vec2 phi0 = 0.39894228 * exp(-0.5 * x0 * x0);
      vec2 phi1 = 0.39894228 * exp(-0.5 * x1 * x1);
      vec2 tail0 = tail(abs(x0), phi0);
      vec2 tail1 = tail(abs(x1), phi1);
      vec2 s0 = step(0.0, x0) * 2.0 - 1.0;
      vec2 s1 = step(0.0, x1) * 2.0 - 1.0;
      vec2 across = mix(s1 * (1.0 - tail0 - tail1), s1 * (tail0 - tail1), equal(s0, s1));
      vec2 compactMean = mix(across / dx, 0.5 * (phi0 + phi1), lessThan(abs(dx), vec2(0.01)));
      g.zw = compactMean * (dt * ${(1 / COMPACT_SIGMA_PC).toFixed(9)});
      centre = vec2(
        layerCentre(x0.x, x1.x, phi0.x, phi1.x, across.x, jitter),
        layerCentre(x0.y, x1.y, phi0.y, phi1.y, across.y, jitter)
      );
      stretch = dt * min(vec2(1.0), 2.0 / max(abs(dx), vec2(1e-6)));
    }
    p0 = p1;
    inverse0 = inverse1;
    // Less than a hundred-thousandth of any column: the map is not read.
    if (max(max(g.x, g.y), max(g.z, g.w)) < 1e-5) continue;
    // Its two scales (core/skyMap.ts twoScales). The large-scale part, spread through all of the
    // step, read at a jittered point of it, averaged over the step; the compact part, what
    // stands above the large scale -- the large scale read again there, as from beside the
    // cloud the jittered point is a third of a degree away -- where its layer's light is
    // centred, averaged over the layer: the old stars' at theirs, the young stars', their gas's
    // and the dust's at theirs. Seen from the Sun the reads are one, and the two sum to the map.
    vec4 at = onMaps(q0, d, t0 + jitter * dt, dt, dt);
    vec4 large = vec4(0.0);
    if (at.x >= 0.0) {
      large = min(textureLod(uSmooth, at.xy, max(0.0, at.w)), textureLod(uSky, at.xy, max(0.0, at.z)));
    }
    vec4 compact = vec4(0.0);
    if (nearby.y) {
      at = onMaps(q0, d, t0 + centre.y * dt, stretch.y, dt);
      if (at.x >= 0.0) {
        compact = max(textureLod(uSky, at.xy, max(0.0, at.z)) - textureLod(uSmooth, at.xy, max(0.0, at.w)), 0.0);
      }
    }
    compact.r = 0.0;
    if (nearby.x) {
      at = onMaps(q0, d, t0 + centre.x * dt, stretch.x, dt);
      if (at.x >= 0.0) {
        compact.r = max(textureLod(uSky, at.xy, max(0.0, at.z)).r - textureLod(uSmooth, at.xy, max(0.0, at.w)).r, 0.0);
      }
    }
    vec3 emitted = uOldGlow * (large.r * g.x + compact.r * g.z)
      + (uYoungGlow * large.g + uNebulaGlow * large.a) * g.y
      + (uYoungGlow * compact.g + uNebulaGlow * compact.a) * g.w;
    // The step's dust: half of it in front of its own light, all of it in front of what is behind.
    vec3 dimmed = exp(-0.5 * uDustTau * (large.b * g.y + compact.b * g.w));
    light += through * dimmed * emitted;
    through *= dimmed * dimmed;
  }
  // Linear, into the glow buffer: the shoulder, the halo past white and the dither are the
  // composite's, once over every glow (glowBuffer.ts).
  gl_FragColor = glowLight(light * uFade);
}
`;

/** A colour, linear, at unit luminance, over the white column: light per L_Sun/pc^2. */
function perColumn([r, g, b]: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(r, g, b).divideScalar(columnAt(WHITE_MU));
}

export interface SkyVolumeProps {
  /** The giant drawn (core/localGroup.ts GIANTS), whose maps are galaxies/<key>.png and .json. */
  readonly galaxyKey: string;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
}

const noRaycast = (): void => {};
const scratchSize = new THREE.Vector2();

export function SkyVolume({ galaxyKey, store, clock, focus, visible }: SkyVolumeProps) {
  const galaxy = useMemo(() => GIANTS.find((g) => g.key === galaxyKey) ?? null, [galaxyKey]);
  const group = useMemo(() => new THREE.Group(), []);
  const uniforms = useMemo(
    () => ({
      uFade: { value: 0 },
      uLocal: { value: new THREE.Matrix4() },
      uAxes: { value: new THREE.Matrix3() },
      uCamera: { value: new THREE.Vector3() },
      uBoxCentre: { value: new THREE.Vector3() },
      uBoxHalf: { value: new THREE.Vector3(1, 1, 1) },
      uReferencePc: { value: 1 },
      uNear: { value: 0 },
      uSky: { value: null as THREE.Texture | null },
      uSmooth: { value: null as THREE.Texture | null },
      uSkyHalf: { value: 1 },
      uDepth: { value: null as THREE.Texture | null },
      uDepthHalf: { value: 1 },
      uLaplace: { value: new THREE.Vector2() },
      uOldGlow: { value: new THREE.Vector3() },
      uYoungGlow: { value: new THREE.Vector3() },
      uNebulaGlow: { value: new THREE.Vector3() },
      uDustTau: { value: new THREE.Vector3() },
      uPixelAngle: { value: 1e-3 },
      uTexelAngle: { value: 1e-3 },
      uSmoothLod: { value: 0 },
    }),
    [],
  );
  const mesh = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    box.frustumCulled = false;
    box.raycast = noRaycast;
    box.matrixAutoUpdate = false;
    box.visible = false;
    drawIntoGlow(box);
    return box;
  }, [uniforms]);
  // What the loaded maps fix: the frame, the box, the light per unit before the hand-off to a point.
  const loaded = useRef<{
    frame: SkyFrame;
    box: ReturnType<typeof skyBox>;
    oldGlow: THREE.Vector3;
    youngGlow: THREE.Vector3;
    nebulaGlow: THREE.Vector3;
  } | null>(null);
  const requested = useRef(false);
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    group.add(mesh);
    return () => {
      group.remove(mesh);
      releaseFromGlow(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [group, mesh]);

  // The maps, asked for with the Local Group's catalogue and the discs' maps.
  useEffect(() => {
    if (!wanted || galaxy === null) {
      return;
    }
    let cancelled = false;
    const textures: THREE.Texture[] = [];
    const base = `${import.meta.env.BASE_URL}galaxies/${galaxy.key}`;
    const described = fetch(`${base}.json`).then((response) => response.json()).then(parseSkyMap);
    const gas = described.then((map) => (map.nebula === undefined ? null : pngPixels(`${base}-nebula.png`)));
    void Promise.all([described, pngPixels(`${base}.png`), gas])
      .then(([map, pixels, nebula]) => {
        const scales = skyScales(galaxy, map);
        if (cancelled || scales === null) {
          return;
        }
        const levels = faceOnLevels(pixels, map, scales, nebula);
        const sky = faceOnTexture(levels);
        const smooth = faceOnTexture(levels.slice(smoothLevel(map)));
        const m = map.depth.size;
        const half = new Uint16Array(m * m * 4);
        depthTexels(map.depth, map.referencePc).forEach((v, k) => {
          half[k] = THREE.DataUtils.toHalfFloat(v);
        });
        const depth = new THREE.DataTexture(half, m, m, THREE.RGBAFormat, THREE.HalfFloatType);
        depth.minFilter = THREE.LinearFilter;
        depth.magFilter = THREE.LinearFilter;
        depth.wrapS = THREE.ClampToEdgeWrapping;
        depth.wrapT = THREE.ClampToEdgeWrapping;
        depth.colorSpace = THREE.NoColorSpace;
        depth.needsUpdate = true;
        textures.push(sky, smooth, depth);
        const frame = skyFrame(map);
        const box = skyBox(map);
        const { east, north, away } = frame;
        uniforms.uAxes.value.set(east.x, east.y, east.z, north.x, north.y, north.z, away.x, away.y, away.z);
        uniforms.uBoxCentre.value.set(box.centre.x, box.centre.y, box.centre.z);
        uniforms.uBoxHalf.value.set(box.half.x, box.half.y, box.half.z);
        uniforms.uReferencePc.value = map.referencePc;
        uniforms.uSky.value = sky;
        uniforms.uSmooth.value = smooth;
        uniforms.uSkyHalf.value = (map.halfDeg * Math.PI) / 180;
        uniforms.uTexelAngle.value = (2 * map.halfDeg * Math.PI) / 180 / map.size;
        uniforms.uSmoothLod.value = smoothLevel(map);
        uniforms.uDepth.value = depth;
        uniforms.uDepthHalf.value = (map.depth.halfDeg * Math.PI) / 180;
        uniforms.uLaplace.value.set(Number(map.depth.old.shape === 'laplace'), Number(map.depth.young.shape === 'laplace'));
        uniforms.uDustTau.value.set(...(CHANNEL_WAVELENGTHS_UM.map((um) => extinctionCurve(um)) as [number, number, number]));
        loaded.current = {
          frame,
          box,
          oldGlow: perColumn(starColor(galaxy.colourIndex)),
          youngGlow: perColumn(starColor(YOUNG_COLOUR_INDEX)),
          nebulaGlow: nebula === null ? new THREE.Vector3() : perColumn(balmerColour()),
        };
        skyVolumesDrawn.add(galaxy.key);
        renderDemand.request();
      })
      .catch(() => {
        // No map: the smooth ellipsoid in LocalGroup.tsx stays.
      });
    return () => {
      cancelled = true;
      skyVolumesDrawn.delete(galaxy.key);
      loaded.current = null;
      mesh.visible = false;
      uniforms.uSky.value = null;
      uniforms.uSmooth.value = null;
      uniforms.uDepth.value = null;
      for (const texture of textures) texture.dispose();
    };
  }, [wanted, galaxy, uniforms, mesh]);

  useFrame(({ camera, gl }) => {
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
    if (sun === null || !visible || galaxy === null) {
      group.visible = false;
      return;
    }
    const cx = (camera.position.x * KM_PER_UNIT - sun.position.x) / PARSEC_KM;
    const cy = (camera.position.y * KM_PER_UNIT - sun.position.y) / PARSEC_KM;
    const cz = (camera.position.z * KM_PER_UNIT - sun.position.z) / PARSEC_KM;
    const fromSunKm = Math.hypot(cx, cy, cz) * PARSEC_KM;
    if (!requested.current && fromSunKm > (MARKS_FROM_LY / 2) * LIGHT_YEAR_KM) {
      requested.current = true;
      setWanted(true);
    }
    const fade = galaxyVisibility(fromSunKm);
    const maps = loaded.current;
    group.visible = fade > 0 && maps !== null;
    if (maps === null || fade <= 0) {
      return;
    }
    const { frame, box } = maps;
    // The map's centre about the camera, pc, in float64.
    const rx = frame.centrePc.x - cx;
    const ry = frame.centrePc.y - cy;
    const rz = frame.centrePc.z - cz;
    const distancePc = Math.hypot(rx, ry, rz);
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const heightPx = gl.getDrawingBufferSize(scratchSize).y;
    const pixelsPerRadian = heightPx / (2 * Math.tan((fov * Math.PI) / 360));
    // Its volume's share of its light; the rest is its point's (LocalGroup.tsx).
    const share = 1 - pointShare((galaxyHalfLightPc(galaxy)! / distancePc) * pixelsPerRadian);
    mesh.visible = share > 0;
    if (share <= 0) {
      return;
    }
    group.position.copy(camera.position);
    group.updateMatrixWorld();
    uniforms.uFade.value = fade;
    uniforms.uOldGlow.value.copy(maps.oldGlow).multiplyScalar(share);
    uniforms.uYoungGlow.value.copy(maps.youngGlow).multiplyScalar(share);
    uniforms.uNebulaGlow.value.copy(maps.nebulaGlow).multiplyScalar(share);
    uniforms.uPixelAngle.value = ((fov * Math.PI) / 180) / heightPx;
    // The near limit as the others': a share of the camera's distance from the centre, never
    // less than half the galaxy's scale.
    const model = galaxy.model;
    const scale = model !== null && model.kind !== 'disc' ? model.majorPc : 0;
    uniforms.uNear.value = Math.max(NEAR_SHARE * distancePc, 0.5 * scale);
    const { east, north, away } = frame;
    uniforms.uCamera.value.set(
      -(rx * east.x + ry * east.y + rz * east.z),
      -(rx * north.x + ry * north.y + rz * north.z),
      -(rx * away.x + ry * away.y + rz * away.z),
    );
    // The box about the camera: its axes the frame's, its sides the box's, its centre off the map's.
    const c = box.centre;
    const s = UNITS_PER_PC;
    mesh.matrix.makeBasis(
      new THREE.Vector3(east.x, east.y, east.z).multiplyScalar(box.half.x * s),
      new THREE.Vector3(north.x, north.y, north.z).multiplyScalar(box.half.y * s),
      new THREE.Vector3(away.x, away.y, away.z).multiplyScalar(box.half.z * s),
    );
    mesh.matrix.setPosition(
      (rx + c.x * east.x + c.y * north.x + c.z * away.x) * s,
      (ry + c.x * east.y + c.y * north.y + c.z * away.y) * s,
      (rz + c.x * east.z + c.y * north.z + c.z * away.z) * s,
    );
    uniforms.uLocal.value.copy(mesh.matrix);
    mesh.matrixWorldNeedsUpdate = true;
  });

  return <primitive object={group} />;
}
