import type { Vec3 } from '../core/vec3.ts';
import type { FramingView } from '../state/store.ts';
import { equatorialDirection, galacticDirection } from './galactic.ts';
import { equatorialToEcliptic } from './orientation.ts';

/**
 * The supergalactic frame, for the breadcrumb's views beyond the Local Group (G2).
 *
 * The galaxies about us out past the Virgo Cluster lie mostly in one plane, the supergalactic
 * plane (de Vaucouleurs 1953): the Local Sheet, the Local Volume's groups and the Virgo
 * Cluster itself, within a few degrees of it. Its north pole is at galactic longitude 47.37
 * and latitude +6.32 degrees (de Vaucouleurs et al. 1991, the Third Reference Catalogue; Lahav
 * et al. 2000, MNRAS 312, 166). Seen from over that pole the Local Volume is face-on, its
 * groups spread about the Sun as on a map, and the Virgo Cluster's depth along our line of
 * sight runs across the frame, not into it.
 */

export const SUPERGALACTIC_POLE_L_DEG = 47.37;
export const SUPERGALACTIC_POLE_B_DEG = 6.32;

/** M87, the Virgo Cluster's centre (NED's position, J2000). */
export const M87_RA_DEG = 187.70593;
export const M87_DEC_DEG = 12.39112;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** The supergalactic pole, scene frame. */
export const SUPERGALACTIC_POLE: Vec3 = galacticDirection(SUPERGALACTIC_POLE_L_DEG, SUPERGALACTIC_POLE_B_DEG);

/**
 * From over the supergalactic pole, turned so that the Virgo Cluster lies to the right of the
 * Sun: the camera's direction from its focus is the pole, its right the way to M87 in the
 * plane, its up their cross product (right x up = direction).
 */
function supergalacticView(): FramingView {
  const d = SUPERGALACTIC_POLE;
  const m87 = equatorialToEcliptic(equatorialDirection(M87_RA_DEG, M87_DEC_DEG));
  const along = m87.x * d.x + m87.y * d.y + m87.z * d.z;
  const r = { x: m87.x - along * d.x, y: m87.y - along * d.y, z: m87.z - along * d.z };
  const n = Math.hypot(r.x, r.y, r.z);
  const right = { x: r.x / n, y: r.y / n, z: r.z / n };
  const up = cross(d, right);
  return { direction: [d.x, d.y, d.z], up: [up.x, up.y, up.z] };
}

/** Where the breadcrumb's Local Volume looks from (scale.ts LOCAL_VOLUME_FRAMING_KM), on the Sun. */
export const LOCAL_VOLUME_VIEW: FramingView = supergalacticView();

/** Where the breadcrumb's Virgo Cluster looks from (scale.ts VIRGO_FRAMING_KM), on M87: the same way, the Sun to the left. */
export const VIRGO_VIEW: FramingView = LOCAL_VOLUME_VIEW;

/** A view from over the supergalactic pole, turned by `degrees` about it (counter-clockwise on the screen). */
export function turnedView(view: FramingView, degrees: number): FramingView {
  const d = { x: view.direction[0], y: view.direction[1], z: view.direction[2] };
  const up = { x: view.up[0], y: view.up[1], z: view.up[2] };
  // right = up x direction.
  const right = cross(up, d);
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { direction: view.direction, up: [c * up.x - s * right.x, c * up.y - s * right.y, c * up.z - s * right.z] };
}

/**
 * Laniakea's turn of the supergalactic view (scale.ts LANIAKEA_FRAMING_KM): 15 degrees, which
 * lays its basin's longest extent, from the Great Attractor out past Pavo-Indus, along the
 * frame's width -- worked out over every 5 degrees for the fewest of its voxels off the frame.
 */
export const LANIAKEA_TURN_DEG = 15;

/** Where the breadcrumb's Laniakea looks from, on its attractor. */
export const LANIAKEA_VIEW: FramingView = turnedView(LOCAL_VOLUME_VIEW, LANIAKEA_TURN_DEG);

/** Where the breadcrumb's Nearby Universe looks from, on the Sun: the same way. */
export const NEARBY_UNIVERSE_VIEW: FramingView = LANIAKEA_VIEW;
