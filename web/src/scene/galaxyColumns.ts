import * as THREE from 'three';

import { prugnielSimien, SERSIC_REACH } from '../core/localGroup.ts';
import { GLOW_OUTPUT_GLSL } from './glowBuffer.ts';

/**
 * The columns of light through the galaxies beyond the Local Group (core/localVolume.ts),
 * drawn instanced: two thousand of them, so none may be a march of sixty-four steps as the
 * four big ones are (LocalGroup.tsx). The dwarfs are the Local Group's Plummer ellipsoids, in
 * closed form; these are the other two.
 *
 * ## A disc: piecewise exponential
 *
 * An exponential disc, rho = rho0 e^(-R/h - |z|/h_z), along a ray is e^(-phi(t)) with
 * phi = R(t)/h + |z(t)|/h_z. Its column is taken in DISC_STEPS steps across the disc's box,
 * each step's phi taken as the straight line between its ends -- whose integral is exact,
 * dt (e^(-phi_a) - e^(-phi_b)) / (phi_b - phi_a) -- and the step split where the ray crosses
 * the disc's plane. Then |z| is exactly a straight line in every step, and R is the one
 * thing bent: R = sqrt(b^2 + w^2), a hyperbola in the distance w along the ray's track in the
 * plane from where it passes nearest the axis, b. So the steps are even not in t but in
 * asinh(w / b) -- R = b cosh u -- a fraction of b long where the track turns past the axis,
 * long where R is as straight as the line it is drawn as.
 *
 * - **Face-on** R does not change along the ray: the column is exact, 2 rho0 h_z e^(-R/h).
 * - **Tipped**, the vertical profile is still exact however long the step -- a sheet h_z thick
 *   is not missed -- and R's bend is followed.
 * - **Edge-on** the ray stays at one height, its column finite, and within 2 % of the
 *   integral along any ray at any tilt (galaxyColumns.test.ts).
 *
 * Deterministic: no jitter, so no grain however few steps.
 *
 * ## An elliptical, and a disc's bulge: a table
 *
 * A Prugniel-Simien ellipsoid (localGroup.ts) has no column in closed form, but in its own
 * units -- each axis over its effective radius -- it is a sphere, and along any ray its column
 * is rho0 / |v| T(m_b, s0): m_b how near the ray passes its centre, s0 where along the ray
 * the camera stands (its near limit, as the dwarfs'), T(m, s) = the integral from s on of
 * its density at sqrt(m^2 + s^2). T is tabled once (sersicTable), its log in a half-float
 * texture over m^(1/4) and s^(1/4), and read with one lookup a pixel: from outside, from
 * inside, at any angle. Summed over the sky from afar it holds the profile's light to 0.5 %.
 * One table each Sersic index drawn -- de Vaucouleurs's 4 for the bulges and most ellipticals,
 * the giant Virgo ellipticals' own (localVolume.ts) -- one above the other in one texture
 * (sersicAtlas), each galaxy reading its own.
 */

/** Steps across a disc's box. */
export const DISC_STEPS = 16;

/** The table's size: its columns m_b, its rows s. */
export const SERSIC_TABLE_M = 128;
export const SERSIC_TABLE_S = 128;
/** Its log's floor: e^-60, nothing. */
const LN_FLOOR = -60;

type V3 = readonly [number, number, number];

/** The integral over dt of e^-phi, phi a straight line from pa to pb. */
function expSegment(pa: number, pb: number, dt: number): number {
  const dp = pb - pa;
  if (Math.abs(dp) < 1e-3) {
    return Math.exp(-pa) * (1 - dp / 2 + (dp * dp) / 6) * dt;
  }
  return ((Math.exp(-pa) - Math.exp(-pb)) / dp) * dt;
}

/** Where the ray from `c` along `d` meets the box of half extents `half`: entry and exit, from 0. */
function slab(c: V3, d: V3, half: V3): [number, number] {
  let lo = 0;
  let hi = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const inv = 1 / d[i]!;
    const a = (-half[i]! - c[i]!) * inv;
    const b = (half[i]! - c[i]!) * inv;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  return [lo, hi];
}

/**
 * The column through an exponential disc of scale length `h` and height `hz`, in units of
 * rho0 pc, from the camera `c` (pc, in the disc's frame: x and y in its plane, z its normal)
 * along the unit direction `d`, within its box `extent` and from `near` pc on. The shader's
 * own lines (DISC_COLUMN_GLSL), for the tests.
 */
export function discColumn(c: V3, d: V3, h: number, hz: number, extent: V3, near = 0, steps = DISC_STEPS): number {
  const [enter, exit] = slab(c, d, extent);
  const t0 = Math.max(enter, near);
  const t1 = exit;
  if (!(t1 > t0)) {
    return 0;
  }
  const phi = (t: number) => Math.hypot(c[0] + d[0] * t, c[1] + d[1] * t) / h + Math.abs(c[2] + d[2] * t) / hz;
  const plane = Math.abs(d[2]) > 1e-9 ? -c[2] / d[2] : -1;
  // The track in the plane: its speed, where it passes nearest the axis, and how near.
  const speed = Math.hypot(d[0], d[1]);
  const tilted = speed > 1e-6;
  const nearest = tilted ? -(c[0] * d[0] + c[1] * d[1]) / (speed * speed) : 0;
  const b = tilted ? Math.max(Math.abs(c[0] * d[1] - c[1] * d[0]) / speed, 1e-3 * h) : h;
  const k = speed / b;
  const u0 = Math.asinh(k * (t0 - nearest));
  const u1 = Math.asinh(k * (t1 - nearest));
  let sum = 0;
  let ta = t0;
  let pa = phi(ta);
  for (let i = 1; i <= steps; i += 1) {
    const f = i / steps;
    const tb = i === steps ? t1 : tilted ? nearest + Math.sinh(u0 + (u1 - u0) * f) / k : t0 + (t1 - t0) * f;
    if (plane > ta && plane < tb) {
      const p = phi(plane);
      sum += expSegment(pa, p, plane - ta);
      ta = plane;
      pa = p;
    }
    const pb = phi(tb);
    sum += expSegment(pa, pb, tb - ta);
    ta = tb;
    pa = pb;
  }
  return sum;
}

export const DISC_COLUMN_GLSL = /* glsl */ `
float discPhi(vec3 c, vec3 d, float t, float h, float hz) {
  vec3 p = c + d * t;
  return length(p.xy) / h + abs(p.z) / hz;
}

// asinh, odd by construction: the GPU's own may be log(x + sqrt(x^2 + 1)), which for a large
// negative x is the log of a difference float32 rounds to nothing -- a dark line through a disc
// along the rays whose track passes its axis.
float oddAsinh(float x) {
  float a = abs(x);
  return sign(x) * log(a + sqrt(a * a + 1.0));
}

float expSegment(float pa, float pb, float dt) {
  float dp = pb - pa;
  if (abs(dp) < 1e-3) return exp(-pa) * (1.0 - dp * 0.5 + dp * dp / 6.0) * dt;
  return (exp(-pa) - exp(-pb)) / dp * dt;
}

// The column through an exponential disc, rho0 pc: see galaxyColumns.ts.
float discColumn(vec3 c, vec3 d, float h, float hz, vec3 halfSize, float near) {
  vec3 inv = 1.0 / d;
  vec3 a = (-halfSize - c) * inv;
  vec3 b = (halfSize - c) * inv;
  vec3 lo = min(a, b);
  vec3 hi = max(a, b);
  float t0 = max(max(max(lo.x, lo.y), max(lo.z, 0.0)), near);
  float t1 = min(hi.x, min(hi.y, hi.z));
  if (t1 <= t0) return 0.0;
  float plane = abs(d.z) > 1e-9 ? -c.z / d.z : -1.0;
  // The track in the plane, where it passes nearest the axis and how near: steps even in
  // asinh of the way along it over that.
  float speed = length(d.xy);
  bool tilted = speed > 1e-6;
  float nearest = tilted ? -dot(c.xy, d.xy) / (speed * speed) : 0.0;
  float miss = tilted ? max(abs(c.x * d.y - c.y * d.x) / speed, 1e-3 * h) : h;
  float k = speed / miss;
  float u0 = oddAsinh(k * (t0 - nearest));
  float u1 = oddAsinh(k * (t1 - nearest));
  float sum = 0.0;
  float ta = t0;
  float pa = discPhi(c, d, ta, h, hz);
  for (int i = 1; i <= ${DISC_STEPS}; i++) {
    float f = float(i) / ${DISC_STEPS.toFixed(1)};
    float tb = i == ${DISC_STEPS} ? t1 : (tilted ? nearest + sinh(mix(u0, u1, f)) / k : mix(t0, t1, f));
    if (plane > ta && plane < tb) {
      float p = discPhi(c, d, plane, h, hz);
      sum += expSegment(pa, p, plane - ta);
      ta = plane;
      pa = p;
    }
    float pb = discPhi(c, d, tb, h, hz);
    sum += expSegment(pa, pb, tb - ta);
    ta = tb;
    pa = pb;
  }
  return sum;
}
`;

// ---------------------------------------------------------------------------------------
// The Prugniel-Simien table

/** The table: ln T at each (m, s) node, row-major by s, and the profile's index. */
export interface SersicTable {
  readonly n: number;
  readonly width: number;
  readonly height: number;
  readonly lnColumn: Float32Array;
}

/** The node's m and s: m = REACH x^4, s = +-REACH |2y - 1|^4, x and y from 0 to 1. */
function nodeM(i: number, width: number): number {
  return SERSIC_REACH * (i / (width - 1)) ** 4;
}

function nodeS(j: number, height: number): number {
  const y = 2 * (j / (height - 1)) - 1;
  return Math.sign(y) * SERSIC_REACH * Math.abs(y) ** 4;
}

const tables = new Map<number, SersicTable>();

/**
 * T(m, s) = the integral from s to infinity of rho(sqrt(m^2 + s'^2)) ds', rho = r^-p e^(-b
 * r^(1/n)) in effective radii, at the table's nodes. Each row by a running sum from far out
 * inwards on s' = 2 REACH u^8 -- fine at the cusp, where the density goes as r^-p -- and the
 * nearer half from the farther by symmetry.
 */
export function sersicTable(n: number, width = SERSIC_TABLE_M, height = SERSIC_TABLE_S): SersicTable {
  const cached = tables.get(n);
  if (cached !== undefined && cached.width === width && cached.height === height) {
    return cached;
  }
  const { p, b } = prugnielSimien(n);
  const far = 2 * SERSIC_REACH;
  const samples = 4096;
  // s' and ds'/du at each u, the same for every row.
  const along = new Float64Array(samples + 1);
  const weight = new Float64Array(samples + 1);
  for (let k = 0; k <= samples; k += 1) {
    const u = k / samples;
    along[k] = far * u ** 8;
    weight[k] = (8 * far * u ** 7) / samples;
  }
  const tail = new Float64Array(samples + 1);
  const lnColumn = new Float32Array(width * height);
  for (let i = 0; i < width; i += 1) {
    const m2 = nodeM(i, width) ** 2;
    // r^-p e^(-b r^(1/n)), from ln r: one log and two exponentials a sample.
    const at = (k: number): number => {
      const lnR = 0.5 * Math.log(Math.max(m2 + along[k]! * along[k]!, 1e-18));
      return Math.exp(-p * lnR - b * Math.exp(lnR / n)) * weight[k]!;
    };
    tail[samples] = 0;
    let previous = at(samples);
    for (let k = samples - 1; k >= 0; k -= 1) {
      const here = at(k);
      tail[k] = tail[k + 1]! + 0.5 * (here + previous);
      previous = here;
    }
    // H(s) for s >= 0, by the u it is at.
    const half = (s: number): number => {
      const u = Math.min(1, (s / far) ** (1 / 8)) * samples;
      const k = Math.min(samples - 1, Math.floor(u));
      const f = u - k;
      return tail[k]! * (1 - f) + tail[k + 1]! * f;
    };
    const whole = 2 * tail[0]!;
    for (let j = 0; j < height; j += 1) {
      const s = nodeS(j, height);
      const column = s >= 0 ? half(s) : whole - half(-s);
      lnColumn[j * width + i] = column > 0 ? Math.max(LN_FLOOR, Math.log(column)) : LN_FLOOR;
    }
  }
  const table = { n, width, height, lnColumn };
  tables.set(n, table);
  return table;
}

/**
 * T(m, s) from the table, as the GPU reads it: bilinear in ln T between the nodes about
 * (m^(1/4), s^(1/4)), each node rounded to a half float when `half`.
 */
export function sersicTableColumn(table: SersicTable, m: number, s: number, half = false): number {
  if (m >= SERSIC_REACH) {
    return 0;
  }
  const x = (m / SERSIC_REACH) ** 0.25 * (table.width - 1);
  const y = (0.5 + 0.5 * Math.sign(s) * Math.min(Math.abs(s) / SERSIC_REACH, 1) ** 0.25) * (table.height - 1);
  const i = Math.min(table.width - 2, Math.floor(x));
  const j = Math.min(table.height - 2, Math.floor(y));
  const fx = x - i;
  const fy = y - j;
  const node = (ii: number, jj: number): number => {
    const value = table.lnColumn[jj * table.width + ii]!;
    return half ? THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(value)) : value;
  };
  const ln =
    (node(i, j) * (1 - fx) + node(i + 1, j) * fx) * (1 - fy) + (node(i, j + 1) * (1 - fx) + node(i + 1, j + 1) * fx) * fy;
  return Math.exp(ln);
}

/**
 * Every index's table, one above the other in one texture -- one half-float channel, filtered
 * linearly, never across two tables -- and which layer each index is.
 */
export function sersicAtlas(indices: readonly number[]): {
  readonly texture: THREE.DataTexture;
  readonly layers: number;
  readonly layerOf: (n: number) => number;
} {
  const ns = [...new Set(indices)].sort((a, b) => a - b);
  const layers = ns.map((n) => sersicTable(n));
  const width = SERSIC_TABLE_M;
  const height = SERSIC_TABLE_S;
  const data = new Uint16Array(width * height * Math.max(1, layers.length));
  layers.forEach((table, l) => {
    for (let k = 0; k < width * height; k += 1) {
      data[l * width * height + k] = THREE.DataUtils.toHalfFloat(table.lnColumn[k]!);
    }
  });
  const texture = new THREE.DataTexture(data, width, height * Math.max(1, layers.length), THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, layers: Math.max(1, layers.length), layerOf: (n) => Math.max(0, ns.indexOf(n)) };
}

export const SERSIC_COLUMN_GLSL = /* glsl */ `
uniform sampler2D uSersic;
uniform float uSersicLayers;
// T(m, s) of the table of the index in this layer of the atlas (galaxyColumns.ts), effective radii.
float sersicColumn(float m, float s, float layer) {
  if (m >= ${SERSIC_REACH.toFixed(1)}) return 0.0;
  float x = pow(m / ${SERSIC_REACH.toFixed(1)}, 0.25);
  float y = 0.5 + 0.5 * sign(s) * pow(min(abs(s) / ${SERSIC_REACH.toFixed(1)}, 1.0), 0.25);
  vec2 size = vec2(${SERSIC_TABLE_M.toFixed(1)}, ${SERSIC_TABLE_S.toFixed(1)});
  vec2 texel = vec2(x, y) * (size - 1.0) + 0.5;
  vec2 uv = vec2(texel.x / size.x, (layer * size.y + texel.y) / (size.y * uSersicLayers));
  return exp(textureLod(uSersic, uv, 0.0).r);
}
`;

// ---------------------------------------------------------------------------------------
// The shaders

/**
 * Each galaxy a box about the camera (LocalGroup.tsx boxMatrix), its axes right-handed, so a
 * corner's place in the galaxy's own frame is `position` times its half extents: the ray to
 * it, less the camera, is interpolated across the face exactly.
 */
const VOLUME_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
// The camera in the galaxy's frame, pc; the box's half extents, pc; the colour times rho0
// over the white column, times the share drawn as a volume; the profile's scales and the
// near limit; a disc's bulge: its effective radius, pc, and its rho0 over the disc's; and the
// layer of the atlas its Prugniel-Simien profile is in, the bulge's or the elliptical's.
attribute vec3 aCam;
attribute vec3 aExtent;
attribute vec3 aGlow;
attribute vec4 aShape;
attribute vec3 aBulge;
varying vec3 vDir;
varying vec3 vCam;
varying vec3 vExtent;
varying vec3 vGlow;
varying vec4 vShape;
varying vec3 vBulge;

void main() {
  vec4 rel = instanceMatrix * vec4(position, 1.0);
  vDir = position * aExtent - aCam;
  vCam = aCam;
  vExtent = aExtent;
  vGlow = aGlow;
  vShape = aShape;
  vBulge = aBulge;
  gl_Position = projectionMatrix * modelViewMatrix * rel;
  #include <logdepthbuf_vertex>
}
`;

export const DISC_VOLUME_VERTEX = VOLUME_VERTEX;
export const SERSIC_VOLUME_VERTEX = VOLUME_VERTEX;

const VOLUME_FRAGMENT_HEAD = /* glsl */ `
#include <logdepthbuf_pars_fragment>
${GLOW_OUTPUT_GLSL}
${SERSIC_COLUMN_GLSL}
uniform float uFade;
varying vec3 vDir;
varying vec3 vCam;
varying vec3 vExtent;
varying vec3 vGlow;
varying vec4 vShape;
varying vec3 vBulge;
`;

/** A disc: aShape = (h, h_z, near, 0), its bulge a sphere of effective radius aBulge.x, in layer aBulge.z. */
export const DISC_VOLUME_FRAGMENT = /* glsl */ `
${VOLUME_FRAGMENT_HEAD}
${DISC_COLUMN_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  float column = discColumn(vCam, d, vShape.x, vShape.y, vExtent, vShape.z);
  if (vBulge.x > 0.0) {
    // In the bulge's units, a sphere: |v| = 1 / R_e.
    vec3 c = vCam / vBulge.x;
    float m = length(cross(c, d));
    float s0 = dot(c, d) + vShape.z / vBulge.x;
    column += vBulge.y * vBulge.x * sersicColumn(m, s0, vBulge.z);
  }
  gl_FragColor = glowLight(vGlow * column * uFade);
}
`;

/** An elliptical: aShape = (a, b, c, near), its effective radii; its profile's layer aBulge.z. */
export const SERSIC_VOLUME_FRAGMENT = /* glsl */ `
${VOLUME_FRAGMENT_HEAD}

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  vec3 v = d / vShape.xyz;
  float vl = length(v);
  vec3 u0 = vCam / vShape.xyz;
  float m = length(cross(u0, v)) / vl;
  float s0 = dot(u0, v) / vl + vShape.w * vl;
  gl_FragColor = glowLight(vGlow * (sersicColumn(m, s0, vBulge.z) / vl) * uFade);
}
`;
