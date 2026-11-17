import { NEIGHBOURHOOD_FROM_KM } from './scale.ts';

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
