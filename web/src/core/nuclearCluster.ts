import { DUST_DISC, planeHeightPc, R0_PC } from './milkyWay.ts';
import { DWARF_ROWS, EVOLVED_ROWS, LF_STEP, STARS_PER_SOLAR_MASS, type LuminosityRow } from './nuclearClusterPopulation.ts';

/**
 * The Milky Way's nuclear star cluster round Sgr A*, as a model: tens of millions of stars
 * within a few parsecs of the black hole, of which a sample -- every one a star of its own
 * brightness -- is drawn about it (NuclearCluster.tsx).
 *
 * **A model, and drawn as one.** What is measured of the cluster is its shape and its
 * light: how its stars thin out from the black hole, how flattened it is, how much mass it
 * holds, and the luminosity function of the stars bright enough to count. No star of the
 * model is a particular star; the stars that *are* measured -- the S-stars on their
 * orbits, the young massive stars of the central parsec, IRS 7 -- are drawn as measured,
 * on top of it (galacticCentreStars.ts).
 *
 * ## Its shape: Schödel et al. 2018 and 2014
 *
 * - **Density**: the 3D Nuker law Schödel et al. 2018 (A&A 609, A27; arXiv 1701.03817,
 *   section 4.4) fit to the cluster's diffuse light, the light of the stars too faint to
 *   resolve -- the mean of their eighteen fits:
 *
 *       rho(r) = rho_b 2^((beta - gamma)/alpha) (r/r_b)^-gamma [1 + (r/r_b)^alpha]^((gamma - beta)/alpha)
 *
 *   with r_b = 3.1 pc, gamma = 1.13, beta = 3.5 and alpha = 10 (fixed in the fit): a cusp
 *   rising as r^-1.13 into the black hole, inside a break at about its radius of
 *   influence, and falling as r^-3.5 outside it. Their star counts (Gallego-Cano et al.
 *   2018, A&A 609, A26) give a steeper cusp for the faint stars, 1.41 +- 0.06, and the
 *   diffuse light's is taken because it is the light of the stars this sample is mostly
 *   of; the two papers say so of each other.
 * - **Mass**: 1.0 +- 0.1 million solar masses inside 1 pc, their section 4.5 -- which with
 *   this law puts 1.35e4 inside 0.1 pc and 180 inside 0.01 pc, as they give, and 7.6
 *   million inside 3 pc against their 7.8 (nuclearCluster.test.ts).
 * - **Extent**: the law falls off slowly, and carried to infinity it holds 38 million; the
 *   cluster's whole mass is 2.5 +- 0.4 million (Schödel et al. 2014, A&A 566, A47; arXiv
 *   1403.6657). So the model stops where it has gathered that: 15 pc out. Beyond it the
 *   nuclear stellar disc and the bulge take over, and those are the galaxy model's.
 * - **Flattening**: q = 0.71 +- 0.02, the minor axis along the Galactic pole (Schödel et
 *   al. 2014). The density is a function of the ellipsoidal radius m, m^2 = x^2 + y^2 +
 *   (z / q)^2, so "inside 1 pc" means inside the ellipsoid of semi-major axis 1 pc. Their
 *   innermost component is rounder, q = 0.9; one q is used throughout.
 * - **Centre**: Sgr A*, within the 0.2 pc Schödel et al. 2014 find between them.
 *
 * ## Its stars
 *
 * The population of nuclearClusterPopulation.ts: old, slightly metal-rich, from PARSEC
 * isochrones at the ages Schödel et al. 2020 measured, 3.15 living stars a solar mass --
 * so 79 million living stars in the 25 million solar masses, as the model counts them.
 * The mass of the papers is taken as the mass of living stars: their light-to-mass
 * conversions leave remnants out, and so does this.
 *
 * ## Which of them are drawn: those bright as seen from the black hole
 *
 * Seventy-nine million points cannot be drawn, and most of them could not be seen: a red
 * dwarf a parsec away is fainter than anything this picture shows. So the sample is every
 * star of the model that, **seen from Sgr A***, is brighter than SAMPLE_LIMIT_V:
 *
 *     M_V + 5 log10(r / 10 pc) < V_lim
 *
 * -- the dwarfs close in, the giants far out, as an eye at the centre would rank them. For
 * a camera near the black hole, where it is taken, it is the sky's brightest stars,
 * complete; a camera parsecs from it stands among stars this sample left out as too faint
 * from the hole, and sees fewer than there are near it. The cut is in the About, with the
 * number it leaves.
 *
 * ## What is not modelled
 *
 * - **Motion.** The sampled stars stand still: their orbits are not known, only the
 *   cluster's velocity dispersion -- about 100 km/s, a hundredth of a parsec a century.
 * - **Dust inside the cluster** -- the minispiral, the circumnuclear disc -- is not drawn
 *   and dims nothing.
 * - **Binaries**, folded into single stars by the IMF; **remnants**, dark.
 *
 * ## The dust between
 *
 * From the Sun the cluster is behind about 30 magnitudes of extinction in visible light
 * (A_V; Genzel, Eisenhauer & Gillessen 2010, Rev. Mod. Phys. 82, 3121; Fritz et al. 2011,
 * ApJ 737, 73 have 30 to 44 for the laws they try), and invisible; from inside it there is
 * none. Between, it is the model's: the share of the Sun's column of dust that lies between
 * the camera and the centre, in the dust disc the galaxy is drawn with (Drimmel & Spergel
 * 2001; milkyWay.ts), times A_V (cameraExtinctionV). The whole cluster takes the same,
 * worked out to its centre.
 */

/** Schödel et al. 2018, section 4.4: the mean of their 3D Nuker fits. */
export const NUKER = { breakPc: 3.1, gamma: 1.13, beta: 3.5, alpha: 10 } as const;

/** Schödel et al. 2018, section 4.5: the stellar mass inside 1 pc, solar masses. */
export const MASS_WITHIN_1PC = 1.0e6;

/** Schödel et al. 2014: the cluster's whole mass, solar masses, and its flattening. */
export const CLUSTER_MASS = 2.5e7;
export const FLATTENING = 0.71;

/** A_V in front of the Galactic Centre seen from the Sun: "about 30" (Genzel et al. 2010). */
export const CENTRE_EXTINCTION_V = 30;

/**
 * The cut: every star of the model brighter than this from Sgr A*, V -- 171,739 of them
 * (nuclearCluster.test.ts). **A budget, not a measurement**: the sky from the centre holds
 * millions of stars down to the picture's own limit, V 8, which no point renderer can
 * draw, and this is where it stops. At V 0 there were 363,000, and seen from inside the
 * cluster's core the picture fell to 10 frames a second on the machine it was measured on,
 * against 15 to 20 at this cut and 40 to 50 near the black hole.
 */
export const SAMPLE_LIMIT_V = -1;

/** How many stars that leaves: what sampleNuclearCluster() returns, held to it by the test. */
export const SAMPLE_COUNT = 171_739;

/** Where the sampling starts, pc from the black hole: inside it the model holds a twentieth of a star. */
export const INNER_RADIUS_PC = 1e-4;

/** The Nuker law, without its normalisation, at ellipsoidal radius m (pc). */
export function nukerShape(m: number): number {
  const x = m / NUKER.breakPc;
  return x ** -NUKER.gamma * (1 + x ** NUKER.alpha) ** ((NUKER.gamma - NUKER.beta) / NUKER.alpha);
}

/**
 * The mass inside each ellipsoidal radius, tabulated once: log-spaced radii from 1e-6 to
 * 1e4 pc, the integral of 4 pi q m^2 rho(m) by the trapezoid rule in ln m, and analytic
 * below the first, where rho is the pure cusp. Normalised to MASS_WITHIN_1PC.
 */
const MASS_TABLE = (() => {
  const n = 4000;
  const lo = Math.log(1e-6);
  const hi = Math.log(1e4);
  const step = (hi - lo) / (n - 1);
  const radii = new Float64Array(n);
  const cumulative = new Float64Array(n);
  const integrand = (m: number): number => 4 * Math.PI * FLATTENING * m ** 3 * nukerShape(m);
  radii[0] = Math.exp(lo);
  // Inside the first radius: 4 pi q r_b^gamma m^(3 - gamma) / (3 - gamma).
  cumulative[0] =
    (4 * Math.PI * FLATTENING * NUKER.breakPc ** NUKER.gamma * radii[0] ** (3 - NUKER.gamma)) / (3 - NUKER.gamma);
  for (let k = 1; k < n; k += 1) {
    radii[k] = Math.exp(lo + k * step);
    cumulative[k] = cumulative[k - 1]! + 0.5 * step * (integrand(radii[k - 1]!) + integrand(radii[k]!));
  }
  const at1 = interpolate(radii, cumulative, 1);
  for (let k = 0; k < n; k += 1) {
    cumulative[k] = (cumulative[k]! / at1) * MASS_WITHIN_1PC;
  }
  return { radii, cumulative, densityScale: MASS_WITHIN_1PC / at1 };
})();

function interpolate(xs: Float64Array, ys: Float64Array, x: number): number {
  if (x <= xs[0]!) {
    return ys[0]! * (x / xs[0]!) ** (3 - NUKER.gamma);
  }
  let lo = 0;
  let hi = xs.length - 1;
  if (x >= xs[hi]!) {
    return ys[hi]!;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const f = Math.log(x / xs[lo]!) / Math.log(xs[hi]! / xs[lo]!);
  return ys[lo]! + (ys[hi]! - ys[lo]!) * f;
}

/** The stellar mass inside ellipsoidal radius m, solar masses. */
export function massWithin(m: number): number {
  return interpolate(MASS_TABLE.radii, MASS_TABLE.cumulative, m);
}

/** The stellar mass density at ellipsoidal radius m, solar masses per cubic parsec. */
export function massDensity(m: number): number {
  return MASS_TABLE.densityScale * nukerShape(m);
}

/** Where the model stops: the ellipsoidal radius holding CLUSTER_MASS, pc (about 15). */
export const CLUSTER_EDGE_PC = (() => {
  let lo = 1;
  let hi = 1e4;
  for (let k = 0; k < 100; k += 1) {
    const mid = Math.sqrt(lo * hi);
    if (massWithin(mid) < CLUSTER_MASS) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
})();

// ---------------------------------------------------------------------------------------
// The luminosity function

/** Both kinds of row, by magnitude, with the running share brighter than each row's end. */
const ROWS: readonly LuminosityRow[] = [...DWARF_ROWS, ...EVOLVED_ROWS].sort((a, b) => a[0] - b[0]);
const ROW_CUMULATIVE: Float64Array = (() => {
  const cumulative = new Float64Array(ROWS.length);
  let sum = 0;
  ROWS.forEach((row, index) => {
    sum += row[1];
    cumulative[index] = sum;
  });
  // The shares were rounded to five figures: renormalised to one.
  for (let k = 0; k < cumulative.length; k += 1) {
    cumulative[k] = cumulative[k]! / sum;
  }
  return cumulative;
})();
const ROW_SHARE_TOTAL = ROWS.reduce((sum, row) => sum + row[1], 0);

/** The share of the living stars brighter than M_V = limit. */
export function shareBrighterThan(limit: number): number {
  let share = 0;
  for (const row of ROWS) {
    if (row[0] >= limit) break;
    share += row[1] * Math.min(1, (limit - row[0]) / LF_STEP);
  }
  return share / ROW_SHARE_TOTAL;
}

/** The faintest M_V a star at r pc from the black hole may have and still be sampled. */
export function sampleMagnitudeLimit(radiusPc: number, limitV = SAMPLE_LIMIT_V): number {
  return limitV - 5 * (Math.log10(radiusPc) - 1);
}

/**
 * How many stars the sample should hold, by the integral the sampler draws from: over
 * ellipsoidal shells, the living stars in each times the share of them bright enough at
 * the shell's distance -- taken at q m, the nearest a point of the shell comes, which is
 * what the sampler draws from before it tests each star at its own distance. An upper
 * bound on what comes back.
 */
export function candidateCount(limitV = SAMPLE_LIMIT_V, edgePc = CLUSTER_EDGE_PC): number {
  return shells(limitV, edgePc).reduce((sum, shell) => sum + shell.candidates, 0);
}

interface Shell {
  readonly inner: number;
  readonly outer: number;
  readonly magnitudeLimit: number;
  readonly candidates: number;
}

const SHELLS = 600;

function shells(limitV: number, edgePc: number): Shell[] {
  const out: Shell[] = [];
  const lo = Math.log(INNER_RADIUS_PC);
  const hi = Math.log(edgePc);
  for (let k = 0; k < SHELLS; k += 1) {
    const inner = Math.exp(lo + ((hi - lo) * k) / SHELLS);
    const outer = Math.exp(lo + ((hi - lo) * (k + 1)) / SHELLS);
    const stars = (massWithin(outer) - massWithin(inner)) * STARS_PER_SOLAR_MASS;
    const magnitudeLimit = sampleMagnitudeLimit(FLATTENING * inner, limitV);
    out.push({ inner, outer, magnitudeLimit, candidates: stars * shareBrighterThan(magnitudeLimit) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// The sample

/**
 * A sample of the model: positions about Sgr A*, pc, on the Galactic axes (x toward the
 * centre from the Sun, y toward l = 90, z toward the north Galactic pole); absolute visual
 * magnitudes; B-V.
 */
export interface NuclearClusterSample {
  readonly positions: Float32Array;
  readonly absoluteV: Float32Array;
  readonly colorIndex: Float32Array;
  readonly count: number;
}

/** mulberry32, as the galaxy model's: the same cluster on every load. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Poisson count, seeded: Knuth's product below 30, a rounded normal above. */
function poisson(mean: number, random: () => number): number {
  if (mean < 30) {
    const limit = Math.exp(-mean);
    let k = 0;
    let p = random();
    while (p > limit) {
      k += 1;
      p *= random();
    }
    return k;
  }
  const u = 1 - random();
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal));
}

/** A magnitude drawn from the luminosity function, no fainter than `limit`; its row too. */
function drawStar(limit: number, random: () => number): { mv: number; row: LuminosityRow } {
  const share = shareBrighterThan(limit);
  const target = random() * share;
  let low = 0;
  let high = ROWS.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (ROW_CUMULATIVE[mid]! < target) low = mid + 1;
    else high = mid;
  }
  const row = ROWS[low]!;
  const top = Math.min(row[0] + LF_STEP, limit);
  return { mv: row[0] + random() * Math.max(0, top - row[0]), row };
}

/**
 * Samples the model: every star brighter than `limitV` from the black hole, deterministic
 * for a seed. Shell by shell in ellipsoidal radius, a Poisson number of candidates is drawn
 * at the shell's most generous magnitude limit; each is put at a radius in the shell by
 * the mass profile, in a random direction on the ellipsoid, given a magnitude from the
 * luminosity function, and kept if, at its own distance from the hole, it is bright enough.
 * `edgePc` stops it short of the cluster's edge, for the tests.
 */
export function sampleNuclearCluster(
  limitV = SAMPLE_LIMIT_V,
  seed = 20261030,
  edgePc = CLUSTER_EDGE_PC,
): NuclearClusterSample {
  const random = generator(seed);
  const positions: number[] = [];
  const absoluteV: number[] = [];
  const colorIndex: number[] = [];
  for (const shell of shells(limitV, edgePc)) {
    const count = poisson(shell.candidates, random);
    // Radii within the shell by m^3 rho(m) per unit ln m, by rejection against its larger end.
    const weight = (m: number): number => m ** 3 * nukerShape(m);
    const peak = Math.max(weight(shell.inner), weight(shell.outer)) * 1.0001;
    for (let k = 0; k < count; k += 1) {
      let m = shell.inner;
      for (let tries = 0; tries < 100; tries += 1) {
        m = shell.inner * (shell.outer / shell.inner) ** random();
        if (random() * peak <= weight(m)) break;
      }
      const cz = 2 * random() - 1;
      const phi = 2 * Math.PI * random();
      const s = Math.sqrt(1 - cz * cz);
      const x = m * s * Math.cos(phi);
      const y = m * s * Math.sin(phi);
      const z = m * cz * FLATTENING;
      const star = drawStar(shell.magnitudeLimit, random);
      if (star.mv >= sampleMagnitudeLimit(Math.hypot(x, y, z), limitV)) {
        continue;
      }
      positions.push(x, y, z);
      absoluteV.push(star.mv);
      colorIndex.push(star.row[2]);
    }
  }
  return {
    positions: Float32Array.from(positions),
    absoluteV: Float32Array.from(absoluteV),
    colorIndex: Float32Array.from(colorIndex),
    count: absoluteV.length,
  };
}

// ---------------------------------------------------------------------------------------
// The dust between

/**
 * The dust disc of Drimmel & Spergel 2001 as milkyWay.ts samples it, as a density, about
 * the Sun in the Galactic frame, pc; unnormalised. Exponential in Galactocentric radius
 * with their hole inside half the Sun's radius, sech^2 in height over the plane with its
 * flare -- a surface density spread through its own thickness, as the points are.
 */
export function dustDensity(x: number, y: number, z: number): number {
  const radius = Math.hypot(R0_PC - x, y);
  const halfSun = 0.5 * R0_PC;
  const surface =
    radius >= halfSun
      ? Math.exp(-radius / DUST_DISC.scaleLengthPc)
      : Math.exp(-halfSun / DUST_DISC.scaleLengthPc) * Math.exp(-(((radius / R0_PC - 0.5) / 0.25) ** 2));
  const scale = DUST_DISC.scaleHeightPc + Math.max(0, radius / 1000 - DUST_DISC.flareFromKpc) * DUST_DISC.flarePcPerKpc;
  const height = (z - planeHeightPc(x)) / scale;
  const sech = 1 / Math.cosh(height);
  return (surface * sech * sech) / (2 * scale);
}

/** The dust column along a straight line between two points, Galactic frame, pc. */
export function dustColumn(from: readonly [number, number, number], to: readonly [number, number, number], steps = 400): number {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  // Simpson's rule, an even number of steps.
  const n = steps + (steps % 2);
  let sum = 0;
  for (let k = 0; k <= n; k += 1) {
    const f = k / n;
    const value = dustDensity(
      from[0] + (to[0] - from[0]) * f,
      from[1] + (to[1] - from[1]) * f,
      from[2] + (to[2] - from[2]) * f,
    );
    sum += (k === 0 || k === n ? 1 : k % 2 === 1 ? 4 : 2) * value;
  }
  return (sum * length) / (3 * n);
}

/**
 * The visual extinction in front of the cluster from a camera, magnitudes: A_V from the
 * Sun times the camera's dust column to the centre over the Sun's (see the header). Both
 * points about the Sun, Galactic frame, pc.
 */
export function cameraExtinctionV(
  camera: readonly [number, number, number],
  centre: readonly [number, number, number],
): number {
  const fromSun = dustColumn([0, 0, 0], centre);
  return (CENTRE_EXTINCTION_V * dustColumn(camera, centre)) / fromSun;
}
