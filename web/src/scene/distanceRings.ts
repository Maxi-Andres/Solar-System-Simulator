import { angularRadiusPixels, LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';

/**
 * Reference rings: circles about the Sun at round distances in light years.
 *
 * **A legibility convention, and named as one.** Nothing is at these distances; a ring is
 * a ruler laid on the picture, so that "Sirius is 8.6 light years away" can be read off
 * it rather than taken on trust. They lie in the ecliptic -- the plane every orbit in the
 * scene is drawn in -- so zooming out from the planets the rings carry on the plane the
 * orbits made, rather than tipping into a new one. The galactic plane would be the other
 * candidate, and at a hundred parsecs, inside a disc about three hundred thick, it is no
 * more physical a choice.
 *
 * Each fades in by its size on screen, as a moon's orbit does, and out once the camera is
 * deep inside it: from the inner Solar System the 1-ly ring is a line along the horizon
 * 60,000 AU away, which says nothing about where anything is.
 */

/** The rings, light years: the scale of the nearest stars, then of the 100-pc census. */
export const DISTANCE_RINGS_LY: readonly number[] = [1, 5, 10, 50, 100];

/** Below this on-screen radius a ring is gone: it would be a smudge round the Sun. */
export const RING_HIDDEN_PX = 16;
/** And fully drawn from this one. */
export const RING_SHOWN_PX = 48;

/**
 * Inside a ring, by the camera's distance from the Sun over the ring's radius: fully drawn
 * down to a tenth of the radius, gone at a thirtieth. For the 1-ly ring, gone inside
 * 2,100 AU -- so nothing changes anywhere the camera could go before the light years --
 * and fully drawn from 6,300 AU.
 */
export const RING_INSIDE_FULL = 0.1;
export const RING_INSIDE_GONE = 1 / 30;

/** The most opaque a ring is drawn: a ruler, under everything that is real. */
export const RING_MAX_OPACITY = 0.5;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

/** How visible a ring is, 0 to 1, before RING_MAX_OPACITY. */
export function ringVisibility(
  radiusKm: number,
  cameraFromSunKm: number,
  viewportHeightPx: number,
  fovDeg: number,
): number {
  const radiusPx = angularRadiusPixels(radiusKm, cameraFromSunKm, viewportHeightPx, fovDeg);
  return (
    ramp(radiusPx, RING_HIDDEN_PX, RING_SHOWN_PX) *
    ramp(cameraFromSunKm / radiusKm, RING_INSIDE_GONE, RING_INSIDE_FULL)
  );
}

/** A ring's label: "1 ly", "100 ly". */
export function ringLabel(lightYears: number): string {
  return `${lightYears} ly`;
}

/**
 * The edge of the star catalogue, and a ring that says so.
 *
 * Inside 100 parsecs the 3D stars are the Gaia Catalogue of Nearby Stars: close to every
 * star there is, down to the faintest red dwarfs, which is why that sphere glows. Past it
 * only the naked-eye stars are placed. Seen from outside, the census is a bright ball
 * with the Sun in the middle and darkness around it -- which reads as the Sun sitting in
 * a cluster at the edge of the stars, and is neither. The stars carry on at the same
 * density for thousands of light years; the darkness is where the catalogue stops
 * (Maxi, 2026-10-28: "no es que no haya, ¿no?").
 *
 * So the edge is drawn, dashed and in the census's own warm colour rather than the
 * rulers' grey, and named for what it is. It belongs to the Star Map layer, not to the
 * Distance Rings: it is a fact about the data being shown, and it should be there
 * whenever that ball is.
 */
export const CENSUS_EDGE_PC = 100;

/** The census edge in light years: 326.156. */
export const CENSUS_EDGE_LY = (CENSUS_EDGE_PC * PARSEC_KM) / LIGHT_YEAR_KM;

/** The warm brown of the ball of red dwarfs it bounds, a little lifted. */
export const CENSUS_EDGE_COLOR = '#b0916c';

export const CENSUS_EDGE_LABEL = `${Math.round(CENSUS_EDGE_LY)} ly · end of the star catalogue — the stars go on`;

/**
 * The census as it is seen: a sphere's outline, not a circle in the ecliptic.
 *
 * Every ruler lies flat in the ecliptic, but the census is a ball, and from above the
 * plane an ecliptic circle of its radius would cut across the glow rather than round it.
 * Its edge on screen is the circle where the lines of sight graze the sphere: for a
 * sphere of radius R seen from D, centred R^2 / D toward the camera from the Sun, of
 * radius R sqrt(1 - R^2 / D^2), and filling asin(R / D) of the view. Null from inside,
 * where there is no outline to draw.
 */
export function sphereOutline(
  radiusKm: number,
  cameraFromCentreKm: number,
): { readonly towardCameraKm: number; readonly radiusKm: number } | null {
  const ratio = radiusKm / cameraFromCentreKm;
  if (!(ratio < 1)) {
    return null;
  }
  return {
    towardCameraKm: radiusKm * ratio,
    radiusKm: radiusKm * Math.sqrt(1 - ratio * ratio),
  };
}

/** Outside the census by this many of its radii, its edge starts to show; fully at the next. */
export const CENSUS_OUTSIDE_GONE = 1.05;
export const CENSUS_OUTSIDE_FULL = 1.5;

/**
 * How visible the census edge is, 0 to 1: by its size on screen, as a ruler's, and by how
 * far outside the sphere the camera is -- right at the surface the outline is the whole
 * sky, and says nothing.
 */
export function censusEdgeVisibility(
  radiusKm: number,
  cameraFromSunKm: number,
  viewportHeightPx: number,
  fovDeg: number,
): number {
  const outline = sphereOutline(radiusKm, cameraFromSunKm);
  if (outline === null) {
    return 0;
  }
  const radiusPx = angularRadiusPixels(
    outline.radiusKm,
    cameraFromSunKm - outline.towardCameraKm,
    viewportHeightPx,
    fovDeg,
  );
  return (
    ramp(radiusPx, RING_HIDDEN_PX, RING_SHOWN_PX) *
    ramp(cameraFromSunKm / radiusKm, CENSUS_OUTSIDE_GONE, CENSUS_OUTSIDE_FULL)
  );
}
