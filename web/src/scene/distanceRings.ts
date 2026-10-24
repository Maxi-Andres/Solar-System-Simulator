import { angularRadiusPixels } from './scale.ts';

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
