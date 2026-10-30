import {
  componentState,
  MASS_A_SUN,
  MASS_B_SUN,
  matchComponent,
  RADIUS_A_SUN,
  RADIUS_B_SUN,
  BARYCENTRE,
  type AlphaCenComponent,
} from './alphaCentauri.ts';
import {
  SIRIUS_A_MASS_SUN,
  SIRIUS_A_RADIUS_SUN,
  SIRIUS_B_MASS_SUN,
  SIRIUS_B_RADIUS_SUN,
  SIRIUS_PARALLAX_MAS,
  siriusAState,
  siriusBState,
} from './sirius.ts';
import { J2000_JD } from './time.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * The 3D stars that follow a measured orbit instead of their catalogue's straight line:
 * Alpha Centauri A and B (alphaCentauri.ts), and Sirius A and its white dwarf, Sirius B
 * (sirius.ts). For each the
 * catalogue's record is only how the star is recognised; where it is drawn, as a point and
 * as a body, and how it moves, is the orbit's.
 */
export type OrbitingStar = AlphaCenComponent | 'Sirius A' | 'Sirius B';

const ARCSEC = Math.PI / 180 / 3600;

/**
 * How near a Sirius record must be to its star on the orbit at J2000, arcseconds. Each record
 * is a straight line from one epoch's motion -- A's from Hipparcos in 1991, three years before
 * periastron; B's from Gaia in 2016 -- and by J2000 the orbit has curved 3.3" from A's and
 * 7.3" from B's, while the two are 4.5" apart (orbitingStars.test.ts). So a record is taken
 * as whichever of the two it is nearer, within this. Nothing else bright is near.
 */
export const SIRIUS_MATCH_ARCSEC = 15;

/**
 * How far a Sirius record may be from the system's distance, parsecs: Gaia's parallax for B,
 * 374.5 mas in A's glare, puts it 0.03 pc beyond the 378.9 mas of the orbit's papers.
 */
const SIRIUS_DEPTH_PC = 0.06;

let siriusAtJ2000: { readonly a: Vec3; readonly b: Vec3 } | null = null;

function unit(p: Vec3): Vec3 {
  const n = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / n, y: p.y / n, z: p.z / n };
}

function angleArcsec(d: Vec3, p: Vec3, length: number): number {
  const cross = Math.hypot(d.y * p.z - d.z * p.y, d.z * p.x - d.x * p.z, d.x * p.y - d.y * p.x);
  return Math.atan2(cross / length, (d.x * p.x + d.y * p.y + d.z * p.z) / length) / ARCSEC;
}

/** Which of Sirius A and B a record is, its J2000 position in parsecs about the Sun, or null. */
export function matchSirius(positionPcAtJ2000: Vec3): 'Sirius A' | 'Sirius B' | null {
  const length = Math.hypot(positionPcAtJ2000.x, positionPcAtJ2000.y, positionPcAtJ2000.z);
  if (Math.abs(length - 1000 / SIRIUS_PARALLAX_MAS) > SIRIUS_DEPTH_PC) {
    return null;
  }
  siriusAtJ2000 ??= { a: unit(siriusAState(J2000_JD).position), b: unit(siriusBState(J2000_JD).position) };
  const toA = angleArcsec(siriusAtJ2000.a, positionPcAtJ2000, length);
  const toB = angleArcsec(siriusAtJ2000.b, positionPcAtJ2000, length);
  if (Math.min(toA, toB) > SIRIUS_MATCH_ARCSEC) {
    return null;
  }
  return toA <= toB ? 'Sirius A' : 'Sirius B';
}

/** Which orbiting star a record is, or null for any other. */
export function matchOrbitingStar(positionPcAtJ2000: Vec3): OrbitingStar | null {
  return matchComponent(positionPcAtJ2000) ?? matchSirius(positionPcAtJ2000);
}

/** An orbiting star about the Sun, scene frame, km and km/s. */
export function orbitingStarState(star: OrbitingStar, jdTdb: number): StateVector {
  return star === 'Sirius A' ? siriusAState(jdTdb) : star === 'Sirius B' ? siriusBState(jdTdb) : componentState(star, jdTdb);
}

/**
 * The parallax it is placed at, mas, and whose: the pair's one system parallax, not its
 * record's -- Gaia's for Sirius B is 4 mas short in Sirius A's glare.
 */
export function orbitingStarParallax(star: OrbitingStar): { readonly mas: number; readonly source: string } {
  return star === 'Sirius A' || star === 'Sirius B'
    ? { mas: SIRIUS_PARALLAX_MAS, source: 'Bond et al. 2017' }
    : { mas: BARYCENTRE.parallaxMas, source: 'Kervella et al. 2016' };
}

/** Its measured radius and mass, solar units. */
export function orbitingStarSize(star: OrbitingStar): { readonly radiusSun: number; readonly massSun: number } {
  switch (star) {
    case 'A':
      return { radiusSun: RADIUS_A_SUN, massSun: MASS_A_SUN };
    case 'B':
      return { radiusSun: RADIUS_B_SUN, massSun: MASS_B_SUN };
    case 'Sirius A':
      return { radiusSun: SIRIUS_A_RADIUS_SUN, massSun: SIRIUS_A_MASS_SUN };
    case 'Sirius B':
      return { radiusSun: SIRIUS_B_RADIUS_SUN, massSun: SIRIUS_B_MASS_SUN };
  }
}
