import { cross, dot, normalize, vec3, type Vec3 } from '../core/vec3.ts';
import { equatorialToEcliptic } from './orientation.ts';

/**
 * Where the galaxy is, in the frame the scene is drawn in.
 *
 * **Nothing draws with this today, and that is deliberate rather than an oversight.** It
 * was written to place a photographic Milky Way panorama, which was measured, found to be
 * the wrong instrument for a sky, and taken out again — see `Starfield.tsx`. The frame
 * itself survived that because it is not about the photograph: it is a hundred lines of
 * astronomy checked against objects catalogued in both coordinate systems, and step 6f
 * wants it back the moment anything galactic is drawn again.
 *
 * With it, the plane of the galaxy crosses the ecliptic where it actually crosses it, and
 * Sagittarius is behind the Sun in December the way it is. Without it, a band of light is
 * wallpaper hung at whatever angle a sphere happened to be built at.
 *
 * ## The frame is defined by two directions, and neither is ours to choose
 *
 * The IAU fixes the galactic frame by its pole and its centre, and the ICRS realisation
 * of those is what every modern catalogue uses:
 *
 *   north galactic pole   RA 192.85948   Dec +27.12825
 *   galactic centre       RA 266.40500   Dec -28.93617
 *
 * Everything else here is those two numbers and a cross product.
 *
 * **They are not exactly perpendicular, and that is worth knowing rather than hiding.**
 * Both are quoted to five decimals, which is finer than the definition is consistent to,
 * so the dot product between them is not quite zero — see `GALACTIC_AXIS_RESIDUAL_DEG`.
 * The basis is orthonormalised about the pole, because the pole is the axis the whole
 * frame is named for.
 *
 * ## Two hops, not one
 *
 * Galactic is defined against the equator and the scene is drawn against the ecliptic, so
 * the panorama needs both rotations. `orientation.ts` already owns the second one, which
 * is the same obliquity every planet's axis goes through — if that constant were ever
 * wrong, the sky and the planets would be wrong together rather than drifting apart.
 */

const DEG = Math.PI / 180;

/** Right ascension of the north galactic pole, ICRS, degrees. */
export const GALACTIC_POLE_RA_DEG = 192.85948;
/** Declination of the north galactic pole, ICRS, degrees. */
export const GALACTIC_POLE_DEC_DEG = 27.12825;
/** Right ascension of the galactic centre, l = 0 and b = 0, ICRS, degrees. */
export const GALACTIC_CENTRE_RA_DEG = 266.405;
/** Declination of the galactic centre, ICRS, degrees. */
export const GALACTIC_CENTRE_DEC_DEG = -28.93617;

/** Unit vector for a right ascension and declination, ICRF equatorial. */
export function equatorialDirection(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return vec3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
}

const poleEquatorial = equatorialDirection(GALACTIC_POLE_RA_DEG, GALACTIC_POLE_DEC_DEG);
const centreEquatorial = equatorialDirection(GALACTIC_CENTRE_RA_DEG, GALACTIC_CENTRE_DEC_DEG);

/**
 * How far the published centre is from being perpendicular to the published pole.
 *
 * About a thousandth of a degree. Small enough to ignore and large enough that silently
 * assuming a right angle would be the wrong kind of tidy: the number is here so that a
 * future value quoted to more digits can be checked against it rather than trusted.
 */
export const GALACTIC_AXIS_RESIDUAL_DEG =
  90 - Math.acos(Math.max(-1, Math.min(1, dot(poleEquatorial, centreEquatorial)))) / DEG;

/**
 * The galactic basis, expressed in the scene's ecliptic frame.
 *
 * `x` points at the galactic centre, `z` at the north galactic pole, and `y` completes a
 * right-handed set — so a direction at galactic longitude l and latitude b is
 * `x cos b cos l + y cos b sin l + z sin b`, which is the usual definition and not a
 * convention invented here.
 */
export interface GalacticBasis {
  readonly x: Vec3;
  readonly y: Vec3;
  readonly z: Vec3;
}

function buildBasis(): GalacticBasis {
  const z = normalize(equatorialToEcliptic(poleEquatorial));
  const centre = equatorialToEcliptic(centreEquatorial);
  // Orthonormalised about the pole rather than about the centre: the pole is the axis the
  // frame is named for, and the residual between the two published directions has to be
  // taken out of one of them.
  const along = dot(centre, z);
  const x = normalize(
    vec3(centre.x - along * z.x, centre.y - along * z.y, centre.z - along * z.z),
  );
  return { x, y: cross(z, x), z };
}

export const GALACTIC_BASIS: GalacticBasis = buildBasis();

/** Unit vector for a galactic longitude and latitude, in the scene's ecliptic frame. */
export function galacticDirection(longitudeDeg: number, latitudeDeg: number): Vec3 {
  const l = longitudeDeg * DEG;
  const b = latitudeDeg * DEG;
  const { x, y, z } = GALACTIC_BASIS;
  const cx = Math.cos(b) * Math.cos(l);
  const cy = Math.cos(b) * Math.sin(l);
  const cz = Math.sin(b);
  return vec3(
    x.x * cx + y.x * cy + z.x * cz,
    x.y * cx + y.y * cy + z.y * cz,
    x.z * cx + y.z * cy + z.z * cz,
  );
}

/** Galactic longitude and latitude of a direction. Degrees, longitude in [0, 360). */
export interface Galactic {
  readonly longitudeDeg: number;
  readonly latitudeDeg: number;
}

/**
 * Where a scene direction falls in galactic coordinates.
 *
 * The inverse, and it exists for the same reason `directionToGeographic` does: "this
 * matrix is correct" is not a claim anyone can check, while "Sagittarius A* comes out at
 * the galactic centre" is one that published values settle.
 */
export function directionToGalactic(direction: Vec3): Galactic {
  const { x, y, z } = GALACTIC_BASIS;
  const unit = normalize(direction);
  const cx = dot(unit, x);
  const cy = dot(unit, y);
  const cz = dot(unit, z);
  const longitude = (Math.atan2(cy, cx) / DEG + 360) % 360;
  return { longitudeDeg: longitude, latitudeDeg: Math.asin(Math.max(-1, Math.min(1, cz))) / DEG };
}
