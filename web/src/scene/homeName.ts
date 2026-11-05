import { angularRadiusPixels, LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';

/**
 * What the Sun's point is called from where the camera is: the level of the breadcrumb that
 * is a point from there, as each level folds into the one above it.
 *
 * - Near, the Sun, or the Solar System once its 50 AU are a few pixels (LabelProjector's
 *   fold, which this leaves alone: `'own'`).
 * - Out past SOLAR_SYSTEM_NAMED_TO_KM, nothing: among a neighbourhood of stars the Solar
 *   System is one more of them, and naming it there named the middle of the picture.
 * - Once the Solar Neighbourhood -- the 100-parsec census the star map is complete to -- is
 *   FOLD_PX across, the Solar Neighbourhood: a place in the galaxy.
 * - Once the Milky Way's disc is MILKY_WAY_FOLD_PX across, nothing on the Sun: the galaxy is
 *   one thing among the Local Group's, and its centre's name is the Milky Way (`centre`). The
 *   names of what is in it -- Sgr A*, its pulsars, clusters and remnants -- fold into it
 *   (`galaxyFolded`), as a planet's into the Solar System's; its arms' go sooner, under
 *   ARM_NAMES_FROM_PX, where they would lie on top of each other (Maxi, 2026-11-05: at a
 *   hundred and fifty pixels "deberia poner milky way").
 *
 * By the camera's distance from the Sun, for both: from where the galaxy folds, 5 million
 * light years, its centre and the Sun are the same point.
 */

/** A level folds into a point when its extent is under this many pixels: LabelProjector's. */
export const FOLD_PX = 24;
/** Past this distance from the Sun the Solar System is not named: three neighbourhood framings. */
export const SOLAR_SYSTEM_NAMED_TO_KM = 150 * LIGHT_YEAR_KM;
/** The Solar Neighbourhood's extent: the Gaia census's 100 parsecs. */
export const NEIGHBOURHOOD_EXTENT_KM = 100 * PARSEC_KM;
/** The Milky Way's: its disc's radius, 50,000 light years. */
export const MILKY_WAY_EXTENT_KM = 50_000 * LIGHT_YEAR_KM;
/** Its disc's radius on screen, pixels, below which it is named as one thing, and its arms' names go. */
export const MILKY_WAY_FOLD_PX = 160;
export const ARM_NAMES_FROM_PX = 320;

export interface HomeNames {
  /** The Sun's label: its own (or the Solar System's fold), another name, or none. */
  readonly sun: 'own' | 'none' | 'Solar Neighbourhood';
  /** The Galactic Centre's label. */
  readonly centre: 'Galactic Centre' | 'Milky Way';
  /** The arms' names shown; the names of what is in the galaxy folded into its own. */
  readonly arms: boolean;
  readonly galaxyFolded: boolean;
}

export function homeNames(cameraFromSunKm: number, viewportHeightPx: number, fovDeg: number): HomeNames {
  const px = (extentKm: number) => angularRadiusPixels(extentKm, cameraFromSunKm, viewportHeightPx, fovDeg);
  const galaxyPx = px(MILKY_WAY_EXTENT_KM);
  if (galaxyPx < MILKY_WAY_FOLD_PX) {
    return { sun: 'none', centre: 'Milky Way', arms: false, galaxyFolded: true };
  }
  const arms = galaxyPx >= ARM_NAMES_FROM_PX;
  if (px(NEIGHBOURHOOD_EXTENT_KM) < FOLD_PX) {
    return { sun: 'Solar Neighbourhood', centre: 'Galactic Centre', arms, galaxyFolded: false };
  }
  if (cameraFromSunKm > SOLAR_SYSTEM_NAMED_TO_KM) {
    return { sun: 'none', centre: 'Galactic Centre', arms, galaxyFolded: false };
  }
  return { sun: 'own', centre: 'Galactic Centre', arms, galaxyFolded: false };
}
