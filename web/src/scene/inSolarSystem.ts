import { CMB_DESCRIPTION_ID, MILKY_WAY_DESCRIPTION_ID } from '../descriptions/subjects.ts';
import { LIGHT_YEAR_KM, NEIGHBOURHOOD_FROM_KM } from './scale.ts';

/**
 * Whether the camera is in the Solar System: within NEIGHBOURHOOD_FROM_KM of the Sun, the
 * 10,000 AU past which the breadcrumb and the scale call the view the Solar Neighbourhood.
 *
 * While it is, what lies out in the galaxy and would only clutter the planets' sky is not drawn:
 * the nebulae and the supernova remnants, their gas, rings and names (Maxi: "si estoy en el
 * sistema solar no quiero ver los remnants ni nebulas"). From the Sun's side they are faint
 * patches anyway; leaving, they come back.
 *
 * Out at LEAVE_SHARE of the boundary, back in at ENTER_SHARE: a camera resting on it does not
 * flicker them on and off.
 */
export const ENTER_SHARE = 0.8;
export const LEAVE_SHARE = 1.25;

export function nextInSolarSystem(wasIn: boolean, cameraFromSunKm: number): boolean {
  return wasIn
    ? cameraFromSunKm < LEAVE_SHARE * NEIGHBOURHOOD_FROM_KM
    : cameraFromSunKm < ENTER_SHARE * NEIGHBOURHOOD_FROM_KM;
}

/**
 * What the view is of, when it is of something that is no body and so has no panel of its own:
 * the Milky Way, seen whole from 20,000 to a million light years out (its breadcrumb frames it
 * from 180,000), and the cosmic microwave background, the wall, from 15 billion out, where it is
 * drawn whole. The Sun's panel then offers that description too (Maxi, 2026-11-20: "toqué Milky
 * Way pero me pone read about the Sun"). Null otherwise.
 */
export const MILKY_WAY_VIEW_FROM_LY = 20_000;
export const MILKY_WAY_VIEW_TO_LY = 1_000_000;
export const CMB_VIEW_FROM_LY = 15e9;

export function viewSubject(cameraFromSunKm: number): string | null {
  const ly = cameraFromSunKm / LIGHT_YEAR_KM;
  if (ly >= CMB_VIEW_FROM_LY) return CMB_DESCRIPTION_ID;
  if (ly >= MILKY_WAY_VIEW_FROM_LY && ly < MILKY_WAY_VIEW_TO_LY) return MILKY_WAY_DESCRIPTION_ID;
  return null;
}
