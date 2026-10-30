/**
 * Light bent by a black hole that does not spin: the exact Schwarzschild null geodesic,
 * worked out once per camera distance into the tables the lens is drawn from
 * (BlackHoleLens.tsx).
 *
 * Every length here is in Schwarzschild radii, r_s = 2GM/c^2, so one table serves Sgr A*
 * and Gaia BH1 alike; only the camera's distance from the hole, r = D / r_s, changes it.
 *
 * ## The orbit of a photon
 *
 * With u = 1/r and b the impact parameter (angular momentum over energy), a photon's path
 * in the hole's equatorial plane obeys
 *
 *     (du/dphi)^2 = 1/b^2 - u^2 (1 - u)              (r_s = 1)
 *
 * or, differentiated, u'' + u = (3/2) u^2 -- the 3GM u^2 / c^2 of the Newtonian orbit
 * equation's relativistic term (Misner, Thorne & Wheeler 1973, section 25.6; Chandrasekhar
 * 1983, The Mathematical Theory of Black Holes, chapter 3). The right side is a cubic,
 * P(u) = u^3 - u^2 + 1/b^2, and the angle swept between two radii is the elliptic integral
 * of 1 / sqrt(P) between them -- computed here in Carlson's symmetric form (DLMF 19.29.4
 * for three real roots; Byrd & Friedman 1971, 239.00, for one real root and a complex
 * pair), not by stepping the equation, so it holds to 1e-12 right up to the edge of the
 * shadow, where the angle swept grows without bound.
 *
 * - **b > b_c = sqrt(27)/2 = 2.598 r_s:** P has three real roots u1 < 0 < u0 <= 2/3 <= u3.
 *   A photon coming in turns at r0 = 1/u0 and leaves again.
 * - **b < b_c:** one real root, negative: nothing stops a photon coming in, and it falls
 *   through the horizon. At b = b_c the photon circles forever at r = 1.5 r_s, the photon
 *   sphere. This is what makes the **shadow**: from far away a black hole is a dark disc of
 *   radius b_c, 2.6 times its horizon, not of its horizon (Synge 1966, MNRAS 131, 463).
 *
 * ## Checked against
 *
 * - the weak field: total deflection 2 r_s/b + (15 pi/16)(r_s/b)^2 + (16/3)(r_s/b)^3
 *   (Keeton & Petters 2005, PRD 72, 104006, written in r_s), which at b = 1000 r_s is
 *   2.002 milliradians -- Einstein's 4GM/(c^2 b) and the next two terms;
 * - the strong field: as b falls to b_c the deflection diverges as
 *   -ln(b/b_c - 1) + ln(216 (7 - 4 sqrt 3)) - pi (Darwin 1959, Proc. R. Soc. A 249, 180;
 *   Bozza 2002, PRD 66, 103001, a = 1, b = -0.4002);
 * - the orbit equation itself, stepped with Runge-Kutta from the camera outward
 *   (schwarzschildLens.test.ts).
 *
 * ## The camera is not at infinity
 *
 * The user can stand a few horizons from the hole, so the camera is treated as what it is:
 * an observer at rest at radius r. A ray it sees at angle theta from the direction of the
 * hole has impact parameter
 *
 *     b = r sin(theta) / sqrt(1 - 1/r)
 *
 * (Synge 1966; Perlick 2004, Living Rev. Relativ. 7, 9, eq. 11 -- the static observer's
 * own measure of angle), and is followed backward from the camera, not from infinity: in
 * toward the hole and out again if it was aimed inward, straight out if not. Where it ends
 * up at infinity is the direction of the sky it shows. The shadow seen from r has angular
 * radius sin(theta_sh) = b_c sqrt(1 - 1/r) / r -- past 90 degrees inside the photon sphere,
 * where only light aimed outward escapes.
 *
 * What the camera sees is the sky as an observer **at rest** sees it: the camera has no
 * velocity about the hole, so there is no aberration or Doppler shift from its motion, and
 * the blueshift a hovering observer would see (a factor 1/sqrt(1 - 1/r): 1.7% at 30 r_s,
 * 73% at the photon sphere) is not drawn.
 *
 * ## The sky is at infinity
 *
 * The sources are taken to be infinitely far behind the hole: the deflection is the whole
 * bend of a ray from the camera to infinity. For a source at a finite distance behind the
 * hole the bend is smaller by about the camera's distance from the hole over the source's.
 * The lens is only drawn while the camera is near enough for it to show (within 10 to 17
 * parsecs of Sgr A*, 5 to 8 AU of Gaia BH1), and the stars and the galaxy's light are
 * kiloparsecs from Sgr A* and parsecs at least from the other two, so that is under 1% at
 * the very edge of Sgr A*'s reach, where the bend is a pixel, and far less anywhere else.
 *
 * ## Except the stars round Sgr A* itself
 *
 * The nuclear star cluster (nuclearCluster.ts) is not kiloparsecs behind the hole: its stars
 * are hundreds of AU to parsecs from it, all round it, while the camera stands AU to parsecs
 * away -- the two distances can be the same, and some stars are in front. For them the
 * thin-lens equation with the source at a finite distance is used -- the one microlensing
 * is worked with, whose Einstein ring for a source at D_s is Paczynski's (1986, ApJ 304, 1):
 *
 *     beta = theta - (D_ls / D_s) alpha(theta)
 *
 * beta the star's angle from the hole as the camera would see it with no hole, theta its
 * image's, alpha the bend, D_s the star's distance from the camera and D_ls the stretch of
 * it past the point where the line of sight comes closest to the hole. Measured along the
 * line to the star, that point is t = D (h . s) / |s|^2 of the way there (h the unit
 * direction to the hole, D its distance, s the star's offset), and the factor is
 * f = D_ls / D_s = 1 - t, held to [0, 1]:
 *
 * - **f = 1** for a star far behind the hole, or anywhere behind the camera -- the sky's
 *   case, the table as it is;
 * - **f = 0** for a star in front of the hole, t >= 1: its light reaches the camera before
 *   it gets near the hole, and it is drawn where it is, once;
 * - a star beside the hole, at its distance d from it: f = d^2 / (d^2 + D^2) -- nearly 1 when
 *   the camera is close in, nearly 0 (and its bend under a pixel) when the camera is far.
 *
 * With the bend's weak-field form alpha = theta_E^2 / theta the equation scales exactly:
 * a source at f is imaged as the table's source at beta / sqrt(f), its angles shrunk by
 * sqrt(f) and its magnification the same (finiteSourceImage) -- the Einstein ring of a
 * source at a finite distance, sqrt(f) times the far sky's. Near the shadow, where the
 * bend is not weak, the scaling is not exact, and it is used there too. Held against the
 * thin-lens equation solved with the exact bend (schwarzschildLens.test.ts): within a
 * thirtieth of a pixel 0.04 pc from the hole, and a pixel and a half at worst for the
 * cluster as it is -- the camera 5 AU out, a star at S2's pericentre distance, 120 AU,
 * behind, its far image in the strong field. (The thin lens itself is an approximation
 * there, a bend taken at one point; at f = 1 none of this applies and the table is exact.)
 * No image is let inside the shadow.
 */

/** The critical impact parameter, r_s: sqrt(27)/2, the shadow's radius seen from afar. */
export const CRITICAL_IMPACT = Math.sqrt(27) / 2;

/** The photon sphere's radius, r_s: 3GM/c^2. */
export const PHOTON_SPHERE = 1.5;

/** Bozza 2002's strong-field coefficient b-bar for Schwarzschild: ln(216 (7 - 4 sqrt 3)) - pi. */
export const STRONG_FIELD_B = Math.log(216 * (7 - 4 * Math.sqrt(3))) - Math.PI;

// ---------------------------------------------------------------------------------------
// Elliptic integrals

/**
 * Carlson's symmetric integral of the first kind, R_F(x, y, z), by duplication (Carlson
 * 1995, Numer. Algorithms 10, 13; DLMF 19.36.1): to about 1e-15.
 */
export function carlsonRF(x: number, y: number, z: number): number {
  let xn = x;
  let yn = y;
  let zn = z;
  const a0 = (xn + yn + zn) / 3;
  let an = a0;
  // (3 r)^(-1/6) times the largest spread, r = 1e-16.
  let q = Math.pow(3e-16, -1 / 6) * Math.max(Math.abs(a0 - xn), Math.abs(a0 - yn), Math.abs(a0 - zn));
  let scale = 1;
  for (let n = 0; n < 60 && q * scale >= Math.abs(an); n += 1) {
    const sx = Math.sqrt(xn);
    const sy = Math.sqrt(yn);
    const sz = Math.sqrt(zn);
    const lambda = sx * sy + sy * sz + sz * sx;
    xn = (xn + lambda) / 4;
    yn = (yn + lambda) / 4;
    zn = (zn + lambda) / 4;
    an = (an + lambda) / 4;
    scale /= 4;
  }
  const X = ((a0 - x) * scale) / an;
  const Y = ((a0 - y) * scale) / an;
  const Z = -X - Y;
  const e2 = X * Y - Z * Z;
  const e3 = X * Y * Z;
  return (1 - e2 / 10 + e3 / 14 + (e2 * e2) / 24 - (3 * e2 * e3) / 44) / Math.sqrt(an);
}

/** Legendre's incomplete integral of the first kind F(phi, k), 0 <= phi <= pi, k < 1. */
export function ellipticF(phi: number, k2: number): number {
  if (phi > Math.PI / 2) {
    return 2 * carlsonRF(0, 1 - k2, 1) - ellipticF(Math.PI - phi, k2);
  }
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return s * carlsonRF(c * c, 1 - k2 * s * s, 1);
}

// ---------------------------------------------------------------------------------------
// The orbit's cubic

/** P(u) = u^3 - u^2 + 1/b^2: (du/dphi)^2 along a photon's orbit, r_s = 1. */
export function orbitCubic(u: number, b: number): number {
  return u * u * u - u * u + 1 / (b * b);
}

/** The three real roots of P for b > b_c: u1 < 0 < u0 (the turning point) <= 2/3 <= u3. */
export function turningRoots(b: number): { readonly u1: number; readonly u0: number; readonly u3: number } {
  const beta = 1 / (b * b);
  // u = v + 1/3 gives v^3 - v/3 + q = 0, solved by the trigonometric form.
  const q = beta - 2 / 27;
  const angle = Math.acos(Math.min(1, Math.max(-1, -13.5 * q))) / 3;
  const u3 = 1 / 3 + (2 / 3) * Math.cos(angle);
  let u0 = 1 / 3 + (2 / 3) * Math.cos(angle - (2 * Math.PI) / 3);
  // Far out u0 is ~1/b, the small difference of two numbers near 1/3: polished by Newton,
  // whose slope 3u^2 - 2u is far from zero there.
  if (u0 < 0.3) {
    for (let k = 0; k < 4; k += 1) {
      u0 -= orbitCubic(u0, b) / (3 * u0 * u0 - 2 * u0);
    }
  }
  return { u1: -beta / (u0 * u3), u0, u3 };
}

/**
 * The angle a photon of impact parameter b > b_c sweeps between u = y and u = x, 0 <= y <=
 * x <= u0: DLMF 19.29.4 with the factors (u - u1), (u0 - u), (u3 - u) and 1.
 */
function sweptReal(b: number, y: number, x: number, roots = turningRoots(b)): number {
  if (!(x > y)) {
    return 0;
  }
  const { u1, u0, u3 } = roots;
  const x1 = Math.sqrt(x - u1);
  const x2 = Math.sqrt(Math.max(0, u0 - x));
  const x3 = Math.sqrt(u3 - x);
  const y1 = Math.sqrt(y - u1);
  const y2 = Math.sqrt(Math.max(0, u0 - y));
  const y3 = Math.sqrt(u3 - y);
  const d = x - y;
  const u12 = (x1 * x2 * y3 + y1 * y2 * x3) / d;
  const u13 = (x1 * x3 * y2 + y1 * y3 * x2) / d;
  const u14 = (x1 * y2 * y3 + y1 * x2 * x3) / d;
  return 2 * carlsonRF(u12 * u12, u13 * u13, u14 * u14);
}

/**
 * The same for b < b_c, where P = (u - u1)((u - m)^2 + n^2) has one real root u1 < 0:
 * Byrd & Friedman 239.00, the integral from u1, taken as a difference.
 */
function sweptComplex(b: number, y: number, x: number): number {
  if (!(x > y)) {
    return 0;
  }
  const beta = 1 / (b * b);
  const q = beta - 2 / 27;
  const root = Math.sqrt(Math.max(0, (q * q) / 4 - 1 / 729));
  const u1 = Math.cbrt(-q / 2 + root) + Math.cbrt(-q / 2 - root) + 1 / 3;
  const m = (1 - u1) / 2;
  const n2 = Math.max(0, -beta / u1 - m * m);
  const A = Math.sqrt((m - u1) * (m - u1) + n2);
  const k2 = (A + m - u1) / (2 * A);
  const phi = (u: number): number => Math.acos(Math.min(1, Math.max(-1, (A - (u - u1)) / (A + (u - u1)))));
  return (ellipticF(phi(x), k2) - ellipticF(phi(y), k2)) / Math.sqrt(A);
}

/** The angle swept between u = y and u = x on an orbit that has no turning point between. */
export function sweptAngle(b: number, y: number, x: number): number {
  return b > CRITICAL_IMPACT ? sweptReal(b, y, x) : sweptComplex(b, y, x);
}

// ---------------------------------------------------------------------------------------
// Deflection

/** The total deflection of a ray from infinity to infinity, radians; b > b_c, in r_s. */
export function totalDeflection(b: number): number {
  const { u0 } = turningRoots(b);
  return 2 * sweptReal(b, 0, u0) - Math.PI;
}

/** The weak-field series to third order (Keeton & Petters 2005), b in r_s. */
export function weakFieldDeflection(b: number): number {
  const x = 1 / b;
  return 2 * x + ((15 * Math.PI) / 16) * x * x + (16 / 3) * x * x * x;
}

/** The strong-field limit (Darwin 1959; Bozza 2002), b just above b_c. */
export function strongFieldDeflection(b: number): number {
  return -Math.log(b / CRITICAL_IMPACT - 1) + STRONG_FIELD_B;
}

/** The impact parameter of the ray a static observer at r sees at angle theta from the hole. */
export function impactParameter(theta: number, r: number): number {
  return (r * Math.sin(theta)) / Math.sqrt(1 - 1 / r);
}

/**
 * The shadow's angular radius seen by a static observer at r, radians (Synge 1966):
 * sin(theta) = b_c sqrt(1 - 1/r) / r, past 90 degrees inside the photon sphere.
 */
export function shadowAngle(r: number): number {
  const s = Math.min(1, (CRITICAL_IMPACT * Math.sqrt(1 - 1 / r)) / r);
  return r > PHOTON_SPHERE ? Math.asin(s) : Math.PI - Math.asin(s);
}

/**
 * The radius of a sphere about the hole that hides exactly the shadow from distance r:
 * one that subtends theta_sh, D sin(theta_sh) = b_c sqrt(1 - 1/r) -- b_c from far away.
 * Inside the photon sphere, where the shadow is more than a hemisphere, no sphere can; the
 * one returned subtends its supplement, and the lens's own black covers the rest.
 */
export function shadowSphereRadius(r: number): number {
  return CRITICAL_IMPACT * Math.sqrt(Math.max(0, 1 - 1 / r));
}

/**
 * Where a ray a static observer at r sees at angle theta from the hole ends up, as the
 * polar angle phi it has swept about the hole by infinity, counted from the camera's own
 * direction from the hole; NaN for a ray that falls in. A straight line would sweep
 * pi - theta.
 */
export function escapeAngle(theta: number, r: number): number {
  const b = impactParameter(theta, r);
  const uCamera = 1 / r;
  const inward = theta < Math.PI / 2;
  if (r > PHOTON_SPHERE) {
    if (inward) {
      if (!(b > CRITICAL_IMPACT)) {
        return NaN;
      }
      // In to the turning point and all the way out again.
      const roots = turningRoots(b);
      return sweptReal(b, 0, roots.u0, roots) + sweptReal(b, Math.min(uCamera, roots.u0), roots.u0, roots);
    }
    return b < 1e-300 ? 0 : sweptAngle(b, 0, uCamera);
  }
  // Inside the photon sphere only light aimed outward, below b_c, gets out.
  if (inward || !(b < CRITICAL_IMPACT)) {
    return NaN;
  }
  return b < 1e-300 ? 0 : sweptComplex(b, 0, uCamera);
}

/**
 * How far the hole turns the ray seen at theta: the sky shown there is the one a straight
 * line would show at theta - deflection, on the same side. Radians; NaN inside the shadow.
 */
export function deflectionSeen(theta: number, r: number): number {
  return escapeAngle(theta, r) - (Math.PI - theta);
}

// ---------------------------------------------------------------------------------------
// The tables

/** How deep toward the shadow's edge the tables go: theta / theta_sh - 1 down to e^-16. */
export const TABLE_X_MIN = -16;

/** How many samples the deflection table has on the CPU, and how many go to the GPU. */
export const DEFLECTION_SAMPLES = 4096;
export const GPU_SAMPLES = 2048;

/** How many samples the image table has. */
export const IMAGE_SAMPLES = 2048;

/** log10 of a magnification is stored within these bounds. */
const LOG_MU_BOUND = 20;

export interface LensTables {
  /** The camera's distance from the hole, r_s. */
  readonly r: number;
  /** The shadow's angular radius from there, radians. */
  readonly shadowAngle: number;
  /** The Einstein ring's: where the point straight behind the hole is seen. */
  readonly einsteinAngle: number;
  /**
   * The deflection seen at theta = theta_sh (1 + e^x), for x from TABLE_X_MIN to xMax
   * (theta = pi), GPU_SAMPLES of them, evenly in x.
   */
  readonly xMax: number;
  readonly deflection: Float32Array;
  /**
   * The images of a source at angle y from the hole's direction -- y in [-pi, pi], negative
   * for the image on the far side -- at IMAGE_SAMPLES points evenly in w = asinh(y / s),
   * cell-centred over [-W, W]: pairs (theta of the image, less y where y > 0; log10 of its
   * magnification). Less the source on the near side, so what is interpolated there is a
   * small smooth quantity -- the deflection, far from the hole -- and not y itself; the
   * far side's images crowd the shadow's edge, and are kept as they are for float32.
   */
  readonly images: Float32Array;
  readonly imageScale: number;
  readonly imageW: number;
}

/**
 * The tables for a camera at r. The deflection is computed exactly at DEFLECTION_SAMPLES
 * points; the images are found from it by inverting theta - deflection(theta), which rises
 * monotonically from minus infinity at the shadow's edge to pi straight away from the hole.
 */
export function buildLensTables(r: number): LensTables {
  const thetaSh = shadowAngle(r);
  const xMax = Math.log((Math.PI - thetaSh) / thetaSh);
  const n = DEFLECTION_SAMPLES;
  const dx = (xMax - TABLE_X_MIN) / (n - 1);
  const thetas = new Float64Array(n);
  const seen = new Float64Array(n);
  const deflections = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    const theta = Math.min(thetaSh * (1 + Math.exp(TABLE_X_MIN + k * dx)), Math.PI);
    const delta = k === n - 1 ? 0 : deflectionSeen(theta, r);
    thetas[k] = theta;
    deflections[k] = delta;
    seen[k] = theta - delta;
  }
  const deflection = new Float32Array(GPU_SAMPLES);
  for (let j = 0; j < GPU_SAMPLES; j += 1) {
    // The GPU's samples, evenly over the same range: every other one of the CPU's.
    const at = (j * (n - 1)) / (GPU_SAMPLES - 1);
    const k = Math.min(n - 2, Math.floor(at));
    const f = at - k;
    deflection[j] = deflections[k]! * (1 - f) + deflections[k + 1]! * f;
  }

  // The image of y: theta where theta - deflection = y, linear in theta between the two
  // samples either side -- in theta and not in x, since far out theta - deflection is
  // nearly theta itself -- and the slope dtheta/dy there.
  const solve = (y: number): { theta: number; slope: number; inside: boolean } => {
    if (y <= seen[0]!) {
      return { theta: thetas[0]!, slope: 0, inside: false };
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (seen[mid]! <= y) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const slope = (thetas[hi]! - thetas[lo]!) / (seen[hi]! - seen[lo]!);
    return { theta: thetas[lo]! + (y - seen[lo]!) * slope, slope, inside: true };
  };

  const einsteinAngle = solve(0).theta;
  const imageScale = Math.max(einsteinAngle / 8, 1e-12);
  const imageW = Math.asinh(Math.PI / imageScale);
  const images = new Float32Array(IMAGE_SAMPLES * 2);
  for (let j = 0; j < IMAGE_SAMPLES; j += 1) {
    const w = -imageW + (2 * imageW * (j + 0.5)) / IMAGE_SAMPLES;
    const y = imageScale * Math.sinh(w);
    const { theta, slope, inside } = solve(y);
    // Solid angle of the image over that of the source: (sin theta dtheta) / (sin y dy).
    const mu = inside ? (Math.sin(theta) / Math.abs(Math.sin(y))) * slope : 0;
    images[j * 2] = theta - Math.max(y, 0);
    images[j * 2 + 1] = mu > 0 ? Math.max(-LOG_MU_BOUND, Math.min(LOG_MU_BOUND, Math.log10(mu))) : -LOG_MU_BOUND;
  }

  return { r, shadowAngle: thetaSh, einsteinAngle, xMax, deflection, images, imageScale, imageW };
}

/** The deflection a table holds at theta, by the GPU's interpolation; NaN inside the shadow. */
export function tableDeflection(tables: LensTables, theta: number): number {
  if (!(theta > tables.shadowAngle)) {
    return NaN;
  }
  const x = Math.log(theta / tables.shadowAngle - 1);
  const t = Math.min(1, Math.max(0, (x - TABLE_X_MIN) / (tables.xMax - TABLE_X_MIN))) * (GPU_SAMPLES - 1);
  const k = Math.min(GPU_SAMPLES - 2, Math.floor(t));
  const f = t - k;
  return tables.deflection[k]! * (1 - f) + tables.deflection[k + 1]! * f;
}

/** Where a table puts the image of a source at y, by the GPU's interpolation: theta and log10 mu. */
export function tableImage(tables: LensTables, y: number): { theta: number; log10Mu: number } {
  const w = Math.asinh(y / tables.imageScale);
  const t = Math.min(IMAGE_SAMPLES - 1, Math.max(0, ((w + tables.imageW) / (2 * tables.imageW)) * IMAGE_SAMPLES - 0.5));
  const k = Math.min(IMAGE_SAMPLES - 2, Math.floor(t));
  const f = t - k;
  return {
    theta: Math.max(y, 0) + tables.images[k * 2]! * (1 - f) + tables.images[(k + 1) * 2]! * f,
    log10Mu: tables.images[k * 2 + 1]! * (1 - f) + tables.images[(k + 1) * 2 + 1]! * f,
  };
}

/**
 * The lens equation's distance factor for a star at a finite distance, D_ls / D_s, from the
 * hole's offset from the camera and the star's, in any one unit: 1 - t, where t is how far
 * along the line of sight to the star it passes closest to the hole, held to [0, 1]. Zero
 * for a star in front of the hole. See the header.
 */
export function sourceDistanceFactor(
  hole: { readonly x: number; readonly y: number; readonly z: number },
  star: { readonly x: number; readonly y: number; readonly z: number },
): number {
  const along = hole.x * star.x + hole.y * star.y + hole.z * star.z;
  const squared = star.x * star.x + star.y * star.y + star.z * star.z;
  return Math.min(1, Math.max(0, 1 - along / Math.max(squared, 1e-300)));
}

/**
 * Where a table puts an image of a star at a finite distance: the source at angle y from
 * the hole (y >= 0), at distance factor f; image 0 on its own side, 1 on the far side. The
 * weak-field scaling of the header: the table's source at y / sqrt(f) -- carried no farther
 * than pi, where every bend is already negligible -- its bend times sqrt(f) for the near
 * image, its angle times sqrt(f) for the far one, which is kept outside the shadow. Its
 * magnification is the table's. Null where there is no image: the far one of a star in
 * front of the hole. As the star shaders do it (lens.ts, lensStarAt).
 */
export function finiteSourceImage(
  tables: LensTables,
  y: number,
  f: number,
  image: 0 | 1,
): { theta: number; log10Mu: number } | null {
  if (!(f > 1e-6)) {
    return image === 0 ? { theta: y, log10Mu: 0 } : null;
  }
  const root = Math.sqrt(f);
  const scaled = Math.min(Math.PI, y / root);
  if (image === 0) {
    const at = tableImage(tables, scaled);
    return { theta: y + root * (at.theta - scaled), log10Mu: at.log10Mu };
  }
  const at = tableImage(tables, -scaled);
  return { theta: Math.max(root * at.theta, tables.shadowAngle * (1 + 1e-4)), log10Mu: at.log10Mu };
}

/**
 * The smallest angle beyond which a table's deflection stays under `limit` radians: past it
 * the lens moves nothing by a visible amount, and the sky is left as it is drawn.
 */
export function deflectionReach(tables: LensTables, limit: number): number {
  for (let k = GPU_SAMPLES - 1; k >= 0; k -= 1) {
    if (tables.deflection[k]! >= limit) {
      const x = TABLE_X_MIN + ((tables.xMax - TABLE_X_MIN) * k) / (GPU_SAMPLES - 1);
      return Math.min(Math.PI, tables.shadowAngle * (1 + Math.exp(x)));
    }
  }
  return tables.shadowAngle;
}

/**
 * The Einstein ring's angular radius for a camera far from the hole, radians: sqrt(2 r_s
 * / D) -- the lens equation's ring for a source at infinity, 4GM/(c^2 D) = theta_E^2.
 */
export function farEinsteinAngle(r: number): number {
  return Math.sqrt(2 / r);
}
