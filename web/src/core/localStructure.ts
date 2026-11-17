import { SGR_A_DISTANCE_PC } from './blackHoles.ts';
import { galaxyPositionPc, GIANTS, type LocalGroupGalaxy } from './localGroup.ts';
import { add, cross, dot, normalize, scale, subtract, type Vec3 } from './vec3.ts';
import { galacticDirection } from '../scene/galactic.ts';
import { SUPERGALACTIC_POLE, SUPERGALACTIC_POLE_L_DEG } from '../scene/supergalactic.ts';

/**
 * The Local Group's surroundings as their papers group and fit them (the Local Structure
 * layer, scene/LocalStructure.tsx, and the galaxies' panels). None of it is anything seen: two
 * groupings of galaxies that are drawn, a surface computed from their motions and a plane and a
 * ring fitted to their places -- so the layer is off at first (store.ts DEFAULT_LAYER_STATE).
 *
 * ## Groupings, in the panels
 *
 * - **The NGC 3109 association** (the Antlia–Sextans group): NGC 3109, Antlia, Sextans A and
 *   Sextans B, just beyond the Local Group's bound members (van den Bergh 1999; McConnachie
 *   2012 sect. 5), with Leo P (Bellazzini et al. 2013, A&A 559, L11: the six lie within about
 *   100 kpc of a line 1.07 Mpc long) and Antlia B, a satellite of NGC 3109 (Sand et al. 2015,
 *   ApJ 812, L13). All six are in McConnachie's catalogue, each drawn there; the group is a row
 *   in their panels.
 * - **The Council of Giants** (McCall 2014, MNRAS 440, 405): every giant galaxy (M_Ks -22.5 or
 *   brighter) within 6 Mpc but the Milky Way and Andromeda lies in a ring about the Local
 *   Group -- NGC 253, Maffei 1 and 2, IC 342, M81, M82, M94, M64, NGC 4945, Centaurus A, M83
 *   and the Circinus Galaxy, the twelve his Figure 3 names. A grouping of McCall's, and its
 *   members' panels say so.
 *
 * ## Drawn, in the layer
 *
 * - **The zero-velocity surface**: the sphere inside which the Local Group's pull has halted
 *   the expansion, R0 = 0.96 +- 0.03 Mpc about its barycentre, 0.55 +- 0.05 of the way from the
 *   Milky Way to Andromeda (Karachentsev et al. 2009, MNRAS 393, 1265: the radius from the
 *   Hubble flow of 30 galaxies 0.7 to 3 Mpc out, the barycentre where their scatter about it is
 *   least). Computed, and a sphere by assumption. McConnachie 2012 finds 1.06 +- 0.07 Mpc from
 *   the mean distance of the six outermost members, whose mean velocity is zero.
 * - **The Local Sheet**: McCall's plane through the giants within 6 Mpc, inclined 7.95 deg to
 *   the supergalactic plane, its north pole at supergalactic (L, B) = (241.74, 82.05) deg, the
 *   Sun 129 kpc north of it; the giants scatter 233 kpc about it. Drawn as its mid-plane's
 *   outline out to the giants' 3-sigma edge, 5.2 Mpc from the Council's centre (Tully et al.
 *   2008, ApJ 676, 184, first named it; its dwarfs reach 4.8 to 7.0 Mpc, Fingerhut 2012).
 * - **The Council's ring**: radius 3.746 +- 0.098 Mpc in the Sheet, its centre 0.81 Mpc from
 *   the Sun (McCall 2014). He gives the centre no coordinates: it is fitted again here, as he
 *   did -- the circle nearest the ten (the Maffeis and M81 and M82 each a pair, at their K-band
 *   light's centre) in the Sheet, from his Table 1's positions -- and comes out 3.746 Mpc
 *   across and 0.815 Mpc from the Sun, his numbers (localStructure.test.ts).
 *
 * McCall's Table 1 is in his "rotated Sheet coordinates": x along the Sheet's crossing with the
 * supergalactic plane, turned 107 deg clockwise about the pole; the origin the Sun's foot on
 * the mid-plane. Andromeda there, (0.296, -0.701, 0.288) Mpc, is the app's Andromeda to a few
 * kpc (localStructure.test.ts).
 *
 * arXiv: McCall 2014, 1403.3667; Karachentsev et al. 2009, 0811.4610; Bellazzini et al. 2013,
 * 1310.6365; McConnachie 2012, 1204.1562.
 */

const DEG = Math.PI / 180;
/** Parsecs in a megaparsec. */
const MPC = 1e6;

// ---------------------------------------------------------------------------------------
// Groupings

export interface Grouping {
  readonly name: string;
  /** Whose grouping it is, for the panel. */
  readonly source: string;
  /** Its members, by the names and other names the galaxies carry here. */
  readonly members: readonly string[];
}

export const NGC_3109_ASSOCIATION: Grouping = {
  name: 'NGC 3109 association',
  source: 'Bellazzini et al. 2013; Sand et al. 2015',
  members: ['NGC 3109', 'Antlia', 'Antlia B', 'Sextans A', 'Sextans B', 'Leo P'],
};

export const COUNCIL_OF_GIANTS: Grouping = {
  name: 'Council of Giants',
  source: 'McCall 2014',
  members: [
    'NGC 253',
    'Maffei 1',
    'Maffei 2',
    'IC 342',
    'NGC 3031',
    'NGC 3034',
    'NGC 4736',
    'NGC 4826',
    'NGC 4945',
    'NGC 5128',
    'NGC 5236',
    'Circinus Galaxy',
  ],
};

const normal = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The groupings a galaxy is in, by its name or any of its other names. */
export function groupingsOf(galaxy: LocalGroupGalaxy): readonly Grouping[] {
  const names = new Set([galaxy.name, ...galaxy.otherNames].map(normal));
  return [NGC_3109_ASSOCIATION, COUNCIL_OF_GIANTS].filter((grouping) => grouping.members.some((member) => names.has(normal(member))));
}

// ---------------------------------------------------------------------------------------
// The supergalactic frame and McCall's Sheet

/** The supergalactic frame's zero of longitude: galactic (137.37, 0) (de Vaucouleurs et al. 1991). */
const SG_X = galacticDirection(SUPERGALACTIC_POLE_L_DEG + 90, 0);
const SG_Y = cross(SUPERGALACTIC_POLE, SG_X);

/** A supergalactic (L, B) direction, scene frame. */
export function supergalacticDirection(lDeg: number, bDeg: number): Vec3 {
  const cx = Math.cos(bDeg * DEG) * Math.cos(lDeg * DEG);
  const cy = Math.cos(bDeg * DEG) * Math.sin(lDeg * DEG);
  const cz = Math.sin(bDeg * DEG);
  return add(add(scale(SG_X, cx), scale(SG_Y, cy)), scale(SUPERGALACTIC_POLE, cz));
}

/** The Local Sheet's north pole (McCall 2014). */
export const SHEET_POLE = supergalacticDirection(241.74, 82.05);
/** The Sun's height above the Sheet's mid-plane, pc (McCall 2014). */
export const SUN_ABOVE_SHEET_PC = 129_000;
/** The giants' scatter about it, pc, and their 3-sigma edge from the Council's centre, pc. */
export const SHEET_THICKNESS_PC = 233_000;
export const SHEET_EDGE_PC = 5.2 * MPC;
/** McCall's rotated Sheet coordinates: his x axis turned this far clockwise about the pole. */
const SHEET_ROTATION_DEG = 107;

/** McCall's Sheet axes, scene frame: x and y in the mid-plane (as his Table 1), z its pole. */
export const SHEET_AXES: { readonly x: Vec3; readonly y: Vec3; readonly z: Vec3 } = (() => {
  // The Sheet's crossing with the supergalactic plane, the way his Table 1 places Andromeda.
  const x0 = normalize(cross(SHEET_POLE, SUPERGALACTIC_POLE));
  const y0 = cross(SHEET_POLE, x0);
  const a = SHEET_ROTATION_DEG * DEG;
  const x = normalize(subtract(scale(x0, Math.cos(a)), scale(y0, Math.sin(a))));
  return { x, y: cross(SHEET_POLE, x), z: SHEET_POLE };
})();

/** A point in McCall's Sheet coordinates, Mpc, about the Sun in the scene frame, pc. */
export function fromSheet(xMpc: number, yMpc: number, zMpc: number): Vec3 {
  const { x, y, z } = SHEET_AXES;
  return scale(add(add(scale(x, xMpc), scale(y, yMpc)), scale(z, zMpc - SUN_ABOVE_SHEET_PC / MPC)), MPC);
}

/** And back: a point about the Sun, scene frame, pc, in his Sheet coordinates, Mpc. */
export function toSheet(p: Vec3): readonly [number, number, number] {
  const { x, y, z } = SHEET_AXES;
  return [dot(p, x) / MPC, dot(p, y) / MPC, dot(p, z) / MPC + SUN_ABOVE_SHEET_PC / MPC];
}

// ---------------------------------------------------------------------------------------
// The Council's ring

/**
 * The Council's giants in McCall's Table 1: Sheet X, Y, Z, Mpc, and M_Ks -- the pairs' light
 * weights their centre.
 */
export const COUNCIL_TABLE: readonly { readonly name: string; readonly sheet: readonly [number, number, number]; readonly mKs: number; readonly pair?: string }[] = [
  { name: 'NGC 253', sheet: [-2.382, -2.506, 0.243], mKs: -24.37 },
  { name: 'Maffei 1', sheet: [2.29, -2.352, 0.0], mKs: -24.24, pair: 'Maffei' },
  { name: 'Maffei 2', sheet: [2.406, -2.452, -0.044], mKs: -23.9, pair: 'Maffei' },
  { name: 'IC 342', sheet: [2.758, -1.904, -0.141], mKs: -23.51 },
  { name: 'M81', sheet: [3.709, -0.262, -0.318], mKs: -24.34, pair: 'M81' },
  { name: 'M82', sheet: [3.45, -0.266, -0.257], mKs: -23.82, pair: 'M81' },
  { name: 'M94', sheet: [3.862, 2.325, 0.27], mKs: -23.39 },
  { name: 'M64', sheet: [3.179, 3.842, 0.086], mKs: -23.43 },
  { name: 'NGC 4945', sheet: [-1.72, 2.814, -0.351], mKs: -23.7 },
  { name: 'Centaurus A', sheet: [-1.518, 3.197, -0.125], mKs: -24.95 },
  { name: 'M83', sheet: [-1.096, 4.813, 0.168], mKs: -24.08 },
  { name: 'Circinus', sheet: [-3.193, 2.809, -0.038], mKs: -23.68 },
];

/**
 * The circle nearest the Council's giants in the Sheet's plane, Mpc: its centre in Sheet x, y
 * and its radius -- the mean distance of the ten from the centre that makes their scatter about
 * it least, found by the fixed-point iteration for a geometric circle fit (each step the
 * centroid plus the radius times the mean unit vector toward the points).
 */
export function fitCouncil(): { readonly x: number; readonly y: number; readonly radius: number; readonly scatter: number } {
  const points: [number, number][] = [];
  const pairs = new Map<string, { x: number; y: number; light: number }>();
  for (const giant of COUNCIL_TABLE) {
    if (giant.pair === undefined) {
      points.push([giant.sheet[0], giant.sheet[1]]);
      continue;
    }
    const light = 10 ** (-0.4 * giant.mKs);
    const sum = pairs.get(giant.pair) ?? { x: 0, y: 0, light: 0 };
    pairs.set(giant.pair, { x: sum.x + giant.sheet[0] * light, y: sum.y + giant.sheet[1] * light, light: sum.light + light });
  }
  for (const pair of pairs.values()) points.push([pair.x / pair.light, pair.y / pair.light]);
  const n = points.length;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  let cx = mx;
  let cy = my;
  let radius = 0;
  for (let step = 0; step < 200; step += 1) {
    const d = points.map(([x, y]) => Math.hypot(x - cx, y - cy));
    radius = d.reduce((s, v) => s + v, 0) / n;
    const ux = points.reduce((s, [x], i) => s + (cx - x) / d[i]!, 0) / n;
    const uy = points.reduce((s, [, y], i) => s + (cy - y) / d[i]!, 0) / n;
    cx = mx + radius * ux;
    cy = my + radius * uy;
  }
  const d = points.map(([x, y]) => Math.hypot(x - cx, y - cy));
  radius = d.reduce((s, v) => s + v, 0) / n;
  const scatter = Math.sqrt(d.reduce((s, v) => s + (v - radius) ** 2, 0) / (n - 1));
  return { x: cx, y: cy, radius, scatter };
}

export const COUNCIL_FIT = fitCouncil();
/** The Council's centre, on the Sheet's mid-plane, about the Sun, scene frame, pc. */
export const COUNCIL_CENTRE_PC = fromSheet(COUNCIL_FIT.x, COUNCIL_FIT.y, 0);

// ---------------------------------------------------------------------------------------
// The zero-velocity surface

/** Its radius, pc, and where between the Milky Way and Andromeda its centre lies (Karachentsev et al. 2009). */
export const ZERO_VELOCITY_RADIUS_PC = 960_000;
export const BARYCENTRE_TOWARD_M31 = 0.55;

/** The Local Group's barycentre about the Sun, scene frame, pc: from the Milky Way's centre toward Andromeda's. */
export function localGroupBarycentrePc(): Vec3 {
  const milkyWay = scale(galacticDirection(0, 0), SGR_A_DISTANCE_PC);
  const andromeda = galaxyPositionPc(GIANTS[0]!);
  return add(milkyWay, scale(subtract(andromeda, milkyWay), BARYCENTRE_TOWARD_M31));
}

// ---------------------------------------------------------------------------------------
// As lines

/** A circle of `radius` about `centre` in the plane of the unit vectors u and v: a closed list of x, y, z, pc. */
export function circlePoints(centre: Vec3, u: Vec3, v: Vec3, radius: number, segments: number): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * 2 * Math.PI;
    const p = add(centre, add(scale(u, radius * Math.cos(a)), scale(v, radius * Math.sin(a))));
    out.set([p.x, p.y, p.z], i * 3);
  }
  return out;
}
