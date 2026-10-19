import type { BeltClass } from '@sss/tools/types';

import { RECORD, RECORD_FLOATS } from '../core/belt.ts';
import type { Vec3 } from '../core/vec3.ts';
import { angularRadiusPixels, AU_KM, satelliteOpacity } from './scale.ts';
import {
  CLASS_SLOTS,
  CROWDED_BRIGHT_FLOOR,
  DOT_REFERENCE_H,
  dotAlpha,
  dotDiameterPx,
  faintBin,
} from './beltShader.ts';

export { CLASS_SLOTS, CROWDED_BRIGHT_FLOOR };

/**
 * How crowded the belt is on screen, and how much fainter its dots are drawn for it.
 *
 * **A legibility convention, like the dots themselves.** Every dot is at least a device
 * pixel, so how much of the screen the belt lights depends on how many dots land on each
 * pixel -- and that is set by the camera, not by the asteroids. Close in, a pixel holds a
 * fraction of a dot and the belt is a scatter of points. From thirty AU the main belt is
 * an ellipse 400 pixels across holding a million and a half of them, twenty-six to a
 * pixel, and any opacity a single dot can be seen at piles up into a solid blob: the
 * picture Maxi sent, the inner Solar System a white cloud with the Sun lost in it.
 *
 * So each population's dots are drawn fainter as they crowd, by just enough to hold the
 * light on the pixels it covers to a budget (CROWDED_LIGHT_BUDGET). Per frame, on the CPU,
 * one number per population and no work per asteroid: how many dots fall per CSS pixel is
 * the population's count over the screen area of the region it fills -- a thick ring
 * about the Sun, seen from where the camera is (see projectedAreaSr) -- and the light each
 * brings is its mean opacity times its area, worked out once per tier. Where that product
 * is under the budget nothing changes, which is every view from close enough to see
 * individual asteroids; past it, a population's opacity is scaled down to the budget.
 *
 * And a population fades out altogether as its region gets small on screen, by the rule
 * a moon fades by as its orbit closes up on its planet (`satelliteOpacity`): full while
 * the ring's outer radius is 24 pixels or more, gone at 12. From a thousand AU the main
 * belt is a 12-pixel smudge round the Sun -- "the asteroids look bigger than the Sun" --
 * and the smudge says nothing the Sun's own marker does not; the Kuiper belt, fifteen
 * times wider, is still a ring there, and stays. One convention for the app: what sits
 * on top of something else at the scale of a marker is not drawn.
 *
 * Two floors keep it honest. The asteroids bright enough to have been B2a's -- H under
 * 15, the largest -- are never drawn under CROWDED_BRIGHT_FLOOR, so a crowded view still
 * shows them as points rather than averaging them away. And the faint ones have none:
 * at a distance they are the haze, and the haze is what the budget is for.
 */

/**
 * Where a population of the belt lies, for working out how crowded it is on screen.
 *
 * A ring about the Sun in the ecliptic: inner and outer radius, and half its thickness --
 * the height its inclinations lift it to, r·sin(i) for a typical i. These are not fitted;
 * they are the textbook extents, and a factor of two either way moves the dimming by the
 * same factor, which is the precision a legibility rule needs.
 */
export interface BeltPopulation {
  readonly name: string;
  readonly classes: readonly BeltClass[];
  readonly innerAu: number;
  readonly outerAu: number;
  readonly halfThicknessAu: number;
  /**
   * The share of the ring the population actually fills. One for a ring that goes all
   * the way round; the Trojans sit in two clouds 60 degrees either side of Jupiter, a
   * third of their ring between them.
   */
  readonly fill: number;
}

export const BELT_POPULATIONS: readonly BeltPopulation[] = [
  // 2.1 to 3.3 AU between the Kirkwood gaps at the ends, out to 3.5 for the outer belt
  // and its Hildas; median inclination about 7 degrees, so 0.45 AU at 2.7.
  { name: 'main belt', classes: ['MBA', 'IMB', 'OMB', 'AST'], innerAu: 2, outerAu: 3.5, halfThicknessAu: 0.45, fill: 1 },
  // Inside the main belt and crossing into it, inclinations as spread as the belt's.
  { name: 'near-Earth and Mars-crossing', classes: ['MCA', 'APO', 'ATE', 'AMO', 'IEO'], innerAu: 0.7, outerAu: 2.5, halfThicknessAu: 0.4, fill: 1 },
  // At 5.2 AU, inclinations to 40 degrees and typically 15: 1.3 AU.
  { name: 'Jupiter Trojans', classes: ['TJN'], innerAu: 4.8, outerAu: 5.6, halfThicknessAu: 1.3, fill: 1 / 3 },
  // Among the giants, on crossing orbits tilted about 15 degrees.
  { name: 'centaurs', classes: ['CEN'], innerAu: 5.5, outerAu: 30, halfThicknessAu: 4, fill: 1 },
  // The Kuiper belt and the scattered disc past it, about ten degrees thick at 40 AU.
  { name: 'trans-Neptunian', classes: ['TNO', 'PAA', 'HYA'], innerAu: 30, outerAu: 55, halfThicknessAu: 7, fill: 1 },
];

/**
 * The light allowed on the pixels a population covers: mean opacity summed over the dots
 * on one CSS pixel. With blending, n dots of opacity a leave 1 - (1 - a)^n of the colour,
 * so a sum of 0.3 lights a covered pixel to about a quarter of BELT_COLOR -- code 45 of
 * 255 for the mid grey -- which reads as a band with its structure in it. B2a's 84,000
 * seen from Jupiter's distance with the belt across a third of the screen, the view it was
 * tuned at, come to 0.22: under it, so that view is drawn exactly as before.
 */
export const CROWDED_LIGHT_BUDGET = 0.3;


/**
 * The solid angle, in steradians, of a population's ring seen from `cameraFromSunKm`.
 *
 * Its face foreshortened by the sine of the elevation above the ecliptic, plus its edge --
 * the ring's full width by its thickness -- by the cosine, so that seen edge-on it is a
 * thin band and not nothing: without the second term every population would be infinitely
 * crowded exactly in the ecliptic. Small-angle, which is accurate wherever crowding can
 * happen at all: once the camera is near or inside the ring this overstates its area, and
 * so understates the crowding, which is the direction that leaves a close view alone.
 */
export function projectedAreaSr(population: BeltPopulation, cameraFromSunKm: Vec3): number {
  const d = Math.hypot(cameraFromSunKm.x, cameraFromSunKm.y, cameraFromSunKm.z);
  if (!(d > 0)) {
    return Infinity;
  }
  const sinElevation = Math.abs(cameraFromSunKm.z) / d;
  const cosElevation = Math.sqrt(Math.max(0, 1 - sinElevation * sinElevation));
  const inner = population.innerAu * AU_KM;
  const outer = population.outerAu * AU_KM;
  const thickness = population.halfThicknessAu * AU_KM;
  const face = Math.PI * (outer * outer - inner * inner) * sinElevation;
  const edge = 4 * outer * thickness * cosElevation;
  return ((face + edge) * population.fill) / (d * d);
}

/**
 * The opacity scale for a population: one where it is not crowded, and below that just
 * enough to hold its light per covered pixel to the budget.
 *
 * `count` dots, each bringing `meanLight` -- opacity times area in CSS pixels -- spread
 * over `areaSr`, on a screen whose pixels each subtend `pixelSr`.
 */
export function crowdingScale(count: number, meanLight: number, areaSr: number, pixelSr: number): number {
  if (count === 0 || !(meanLight > 0)) {
    return 1;
  }
  const pixels = areaSr / pixelSr;
  const light = (count / pixels) * meanLight;
  return light <= CROWDED_LIGHT_BUDGET ? 1 : CROWDED_LIGHT_BUDGET / light;
}

/** One CSS pixel's solid angle at the centre of the view, steradians. */
export function pixelSolidAngle(fovDeg: number, viewportHeightPx: number): number {
  const side = (fovDeg * Math.PI) / 180 / viewportHeightPx;
  return side * side;
}

/** Each population's dots in hand, and the light they bring together; see beltLight. */
export interface PopulationLight {
  readonly count: Float64Array;
  readonly light: Float64Array;
  /** Population of each class code, or -1 for a code no population claims. */
  readonly populationOfClass: Int8Array;
}

/**
 * Counts each population's loaded dots and sums their light: opacity times the dot's area
 * in CSS pixels. Bright dots by B2a's rule, faint ones by their magnitude's share (see
 * faintBinAlphas), on a disc of one CSS pixel -- the light the single device pixel they
 * are drawn as is scaled to carry. One pass over the records, when the tiers change.
 */
export function beltLight(
  tiers: readonly Float32Array[],
  binAlphas: Float32Array,
  classes: readonly BeltClass[],
  /** One or zero per class code: a hidden family's dots are not on screen to crowd it. */
  classVisible: Float32Array | null = null,
): PopulationLight {
  const populationOfClass = new Int8Array(CLASS_SLOTS).fill(-1);
  classes.forEach((name, code) => {
    const index = BELT_POPULATIONS.findIndex((population) => population.classes.includes(name));
    if (code < CLASS_SLOTS) {
      populationOfClass[code] = index;
    }
  });
  const count = new Float64Array(BELT_POPULATIONS.length);
  const light = new Float64Array(BELT_POPULATIONS.length);
  for (const records of tiers) {
    for (let base = 0; base < records.length; base += RECORD_FLOATS) {
      const code = records[base + RECORD.class]!;
      const population = populationOfClass[code] ?? -1;
      if (population < 0 || classVisible?.[code] === 0) {
        continue;
      }
      const H = records[base + RECORD.H]!;
      const area =
        H >= DOT_REFERENCE_H ? Math.PI / 4 : (Math.PI / 4) * dotDiameterPx(H) ** 2;
      const alpha = H >= DOT_REFERENCE_H ? binAlphas[faintBin(H)]! : dotAlpha(H);
      count[population] = count[population]! + 1;
      light[population] = light[population]! + alpha * area;
    }
  }
  return { count, light, populationOfClass };
}

/**
 * How much of a population is drawn by the size of its region on screen: the moons'
 * rule, on the ring's outer radius in pixels seen from the camera. See the header.
 */
export function regionFade(
  population: BeltPopulation,
  cameraFromSunKm: Vec3,
  fovDeg: number,
  viewportHeightPx: number,
): number {
  const d = Math.hypot(cameraFromSunKm.x, cameraFromSunKm.y, cameraFromSunKm.z);
  return satelliteOpacity(
    angularRadiusPixels(population.outerAu * AU_KM, d, viewportHeightPx, fovDeg),
  );
}

/**
 * This frame's opacity scale and fade for every class code, written into `crowding` and
 * `fade` -- the shader's `uClassCrowding` and `uClassFade` -- without allocating: the
 * frame loop's one call.
 */
export function writeCrowding(
  crowding: Float32Array,
  fade: Float32Array,
  populations: PopulationLight,
  cameraFromSunKm: Vec3,
  fovDeg: number,
  viewportHeightPx: number,
): void {
  const pixelSr = pixelSolidAngle(fovDeg, viewportHeightPx);
  for (let code = 0; code < crowding.length; code += 1) {
    const index = populations.populationOfClass[code] ?? -1;
    if (index < 0) {
      crowding[code] = 1;
      fade[code] = 1;
      continue;
    }
    const population = BELT_POPULATIONS[index]!;
    const count = populations.count[index]!;
    crowding[code] = crowdingScale(
      count,
      count === 0 ? 0 : populations.light[index]! / count,
      projectedAreaSr(population, cameraFromSunKm),
      pixelSr,
    );
    fade[code] = regionFade(population, cameraFromSunKm, fovDeg, viewportHeightPx);
  }
}

/**
 * A dot's opacity after crowding and fade: the shader's last line. A bright dot is held
 * at the floor however crowded -- unless it was fainter than the floor to start with --
 * and the fade takes everything with it.
 */
export function crowdedAlpha(alpha: number, H: number, crowding: number, fade: number): number {
  const crowded =
    H >= DOT_REFERENCE_H ? alpha * crowding : Math.max(alpha * crowding, Math.min(alpha, CROWDED_BRIGHT_FLOOR));
  return crowded * fade;
}
