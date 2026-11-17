import { sgrAState } from './blackHoles.ts';
import { NOTABLE_STARS, notableStarState } from './notableStars.ts';
import type { Vec3 } from './vec3.ts';

/**
 * S5-HVS1's path back to where it was thrown from (scene/StellarFlybys.tsx draws it with the
 * Notable Stars): a straight line from Sgr A* to the star. Koposov et al. 2020 (MNRAS 491, 2465)
 * trace its orbit back through the Galaxy's pull and find it crossing the plane within some
 * 0.4 kpc of the centre -- a region of about 50 x 1000 pc that holds Sgr A* -- 4.8 million years
 * ago. A star flung outward from the centre of a nearly round pull keeps to a line: the pull only
 * slows it along it. So the line is its path to the precision it is known, drawn dashed as the
 * computed paths are.
 */

export const S5_HVS1_KEY = 's5-hvs1';

/** The path's two ends about the Sun, scene frame, km: Sgr A*, then the star at J2000. */
export function hypervelocityPathKm(): readonly [Vec3, Vec3] | null {
  const star = NOTABLE_STARS.find((entry) => entry.key === S5_HVS1_KEY);
  if (star === undefined) return null;
  const J2000_JD = 2451545.0;
  return [sgrAState(J2000_JD).position, notableStarState(star)(J2000_JD).position];
}
