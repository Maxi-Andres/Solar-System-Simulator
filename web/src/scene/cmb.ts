import type { CmbMapInfo } from '@sss/tools/types';

import { LAST_SCATTERING_RADIUS_MPC, mpcToKm, PLANCK18, Z_LAST_SCATTERING } from '../core/cosmology.ts';
import type { Vec3 } from '../core/vec3.ts';
import { blackbodyLinearSrgb, cieY, planckSpectralRadiance, type Rgb } from './blackbody.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { SCALE_BAR_MAX_PX } from './scaleBar.ts';
import { FOV_DEG, LIGHT_YEAR_KM } from './scale.ts';

/**
 * The last-scattering sphere (G4): what the CosmicMicrowaveBackground draws, and how -- kept
 * apart from the component so it can be tested without a renderer.
 *
 * ## Where it is, and where it is seen from
 *
 * A sphere about the Sun at the comoving distance light from z* = 1089.8 has come, 13,880 Mpc,
 * 45.3 billion ly in Planck 2018's cosmology (cosmology.ts). It is not a thing out there but a
 * time: every direction from here, looked along far enough, ends in the plasma that filled the
 * universe until 380,000 years after the Big Bang, and what reaches us from it is its light,
 * last scattered then. Every observer anywhere is at the centre of a sphere of their own, so
 * there is no outside to see it from: the camera never leaves it (scale.ts MAX_VIEW_DISTANCE_KM,
 * 40 billion ly from the Sun at most), and it is drawn as what it is, the wall of the sky all
 * about -- its inside, every way the camera turns, behind everything it encloses. Until G4b it
 * came into view only from far outside (60 billion ly, whole from 150): a ball no one could see.
 *
 * Drawn only far out (cmbVisibility): none of it nearer than CMB_FROM_LY to the Sun, all of it
 * from CMB_FULL_LY. Nearer, at the Solar System's, the galaxy's, the Local Group's and
 * Laniakea's scales, it is the sky's microwave glow, which no eye sees, and a wall there would
 * be a backdrop to views it has nothing to do with.
 *
 * ## The map on it
 *
 * Planck's 2018 SMICA map (tools/src/cmb/prepareCmb.ts, web/public/cmb/), Galactic: a fragment
 * at direction n from the Sun takes the temperature of the sky in direction n -- n's Galactic
 * longitude and latitude through GALACTIC_BASIS, the same frame the Milky Way is drawn in. Seen
 * from inside, that is the sky as seen from here, not its mirror image: the Cold Spot lies
 * toward Eridanus, where it is in the sky, and the map's own coldest patch there (cmb.test.ts).
 *
 * ## Its colours: two, a choice (the Layers panel's chips, the view store's cmbColours)
 *
 * **True colour**, the default. Today it is a 2.7255 K blackbody, all of its light in the
 * microwaves: to an eye, black. When it was emitted it was (1 + z*) times hotter, 2,973 K, the
 * orange of a candle flame, and that is the colour drawn -- the light as it was when it left.
 * Its anisotropies, the map, are 1e-5 of the temperature: drawn as they are they would be a
 * difference of a thousandth in brightness, invisible. So each point is drawn as a blackbody at
 * 2,973 K x (1 + EXAGGERATION dT / T0): its temperature's departure from the mean made a
 * thousand times larger, its colour and its brightness both that blackbody's -- a hot spot
 * yellower and brighter, a cold one redder and dimmer, as they would be, only more. Its
 * brightness overall is a display level, not the radiance of a 2,973 K surface: that seen from
 * inside would be as bright as a red dwarf's face.
 *
 * Shown as every other glow is (glowBuffer.ts glowDisplay): linear light in white columns, the
 * shoulder 1 - e^-x and the sRGB encode -- not the renderer's ACES curve. Its hue is the
 * blackbody's either way (ACES moved it by a few display steps); what made it read as tan was
 * its level, 0.22 of white: orange that dim is brown. At half of white the mean is a light
 * orange, (201, 159, 99) on the screen, a hot spot a pale yellow and a cold one a deep orange.
 *
 * **Planck map**: false colour, the scale Planck's own maps of it are published in -- the
 * Planck Collaboration's "parchment" colour table (PLANCK_PARCHMENT), dark blue through cyan to
 * a pale cream at the mean, then orange, red and a dark red, over -300 to +300 uK
 * (PLANCK_RANGE_UK): the picture of the CMB everyone has seen. Its colours are display colours,
 * written to the screen as they are, through no curve. Nothing in them is light: the CMB's is
 * microwaves, and the colours stand for differences of a few hundred millionths of a degree.
 */

/** The CMB's temperature today, K (Fixsen 2009), and at emission. */
export const CMB_TODAY_K = PLANCK18.t0K;
export const CMB_EMITTED_K = CMB_TODAY_K * (1 + Z_LAST_SCATTERING);

/** How many times larger the temperature's anisotropies are drawn than they are. */
export const EXAGGERATION = 1000;

/** The sphere's radius, km. */
export const LAST_SCATTERING_RADIUS_KM = mpcToKm(LAST_SCATTERING_RADIUS_MPC);

/**
 * When it is drawn, light years from the Sun: none of it nearer than CMB_FROM_LY, all of it from
 * CMB_FULL_LY, smoothly in the logarithm between. It comes in only once the scale bar reads a
 * billion light years (Maxi, 2026-11-20: "quiero que recién aparezca en 1 billón") -- on a
 * 1080-pixel screen, where the bar's 120 pixels first reach 10^9 ly, 18.7 billion out -- so on
 * the sky of no galaxy, group, supercluster or of the mapped universe, only of the views where the
 * whole of the observable universe is the subject; whole by 30 billion, before the Observable
 * Universe's own framing at 36 and the camera's limit at 40.
 */
export const CMB_FROM_LY = (1e9 * 1080) / (SCALE_BAR_MAX_PX * 2 * Math.tan((FOV_DEG * Math.PI) / 360));
export const CMB_FULL_LY = 30e9;

export function cmbVisibility(cameraFromSunKm: number): number {
  const ly = cameraFromSunKm / LIGHT_YEAR_KM;
  if (!(ly > CMB_FROM_LY)) return 0;
  const t = Math.min(1, (Math.log(ly) - Math.log(CMB_FROM_LY)) / (Math.log(CMB_FULL_LY) - Math.log(CMB_FROM_LY)));
  return t * t * (3 - 2 * t);
}

/**
 * Where on the map a direction (scene frame, from the Sun) falls: u from the left, v from the
 * BOTTOM, as a texture is sampled (three.js flips the picture's rows). The map's middle is l = 0,
 * l growing to the left (cmb.json). The shader does the same.
 */
export function cmbTexCoord(direction: Vec3, info: Pick<CmbMapInfo, 'centreLongitudeDeg'> = { centreLongitudeDeg: 0 }): [number, number] {
  const { x, y, z } = GALACTIC_BASIS;
  const n = Math.hypot(direction.x, direction.y, direction.z);
  const gx = (direction.x * x.x + direction.y * x.y + direction.z * x.z) / n;
  const gy = (direction.x * y.x + direction.y * y.y + direction.z * y.z) / n;
  const gz = (direction.x * z.x + direction.y * z.y + direction.z * z.z) / n;
  const l = Math.atan2(gy, gx) / (2 * Math.PI) - info.centreLongitudeDeg / 360;
  const b = Math.asin(Math.max(-1, Math.min(1, gz)));
  const u = 0.5 - l;
  return [u - Math.floor(u), 0.5 + b / Math.PI];
}

/** Visible luminance of a blackbody, relative units: Planck's law through the CIE Y curve. */
export function blackbodyLuminance(kelvin: number): number {
  let y = 0;
  for (let nm = 360; nm <= 830; nm += 1) {
    y += planckSpectralRadiance(nm, kelvin) * cieY(nm);
  }
  return y;
}

/** The mean's display luminance, white columns, linear: a level, chosen (see the header). */
export const CMB_DISPLAY_LUMINANCE = 0.5;

/** The colour a temperature difference dT, uK, is drawn in, in true colour: linear sRGB. */
export function cmbColour(deltaMicrokelvin: number): Rgb {
  const kelvin = CMB_EMITTED_K * (1 + (EXAGGERATION * deltaMicrokelvin * 1e-6) / CMB_TODAY_K);
  const [r, g, b] = blackbodyLinearSrgb(kelvin);
  const relative = blackbodyLuminance(kelvin) / blackbodyLuminance(CMB_EMITTED_K);
  const k = CMB_DISPLAY_LUMINANCE * relative;
  return [r * k, g * k, b * k];
}

/**
 * The Planck Collaboration's colour table for its maps, Planck_Parchment_RGB.txt: 256 sRGB
 * entries, piecewise linear between these six -- the entry's index, 0 to 255, and its colour,
 * 0 to 255 a channel. Read off the table as a member of the collaboration, Andrea Zonca,
 * distributes it (github.com/zonca/paperplots, data/Planck_Parchment_RGB.txt): every entry
 * between two of these is their linear mix, to a step of rounding.
 */
export const PLANCK_PARCHMENT: readonly (readonly [number, readonly [number, number, number]])[] = [
  [0, [0, 0, 255]],
  [85, [0, 221, 255]],
  [127, [255, 237, 217]],
  [170, [255, 180, 0]],
  [212, [255, 75, 0]],
  [255, [100, 0, 0]],
];

/** The temperature differences the table spans, uK: its first entry -PLANCK_RANGE_UK, its last +PLANCK_RANGE_UK, as Planck's figures of the map. */
export const PLANCK_RANGE_UK = 300;

/**
 * The colour a temperature difference dT, uK, is drawn in as Planck's map: display sRGB, 0 to 1,
 * the table's ends past its range.
 */
export function planckColour(deltaMicrokelvin: number): Rgb {
  const index = Math.min(255, Math.max(0, ((deltaMicrokelvin + PLANCK_RANGE_UK) / (2 * PLANCK_RANGE_UK)) * 255));
  let k = 1;
  while (k < PLANCK_PARCHMENT.length - 1 && PLANCK_PARCHMENT[k]![0] < index) k += 1;
  const [i0, c0] = PLANCK_PARCHMENT[k - 1]!;
  const [i1, c1] = PLANCK_PARCHMENT[k]!;
  const t = (index - i0) / (i1 - i0);
  const channel = (c: 0 | 1 | 2): number => (c0[c] + (c1[c] - c0[c]) * t) / 255;
  return [channel(0), channel(1), channel(2)];
}

/** How the map is coloured: its light as it left, or Planck's false colour (see the header). */
export type CmbColours = 'true' | 'planck';

/** Entries of the shader's table: one every LUT_STEP bytes of the map, 0 to 256. */
export const LUT_STEP = 8;
export const LUT_SIZE = 256 / LUT_STEP + 1;

/**
 * The table the shader reads a byte of the map through: its colour every LUT_STEP bytes -- in
 * true colour linear light, for the glows' display curve; as Planck's map, display sRGB.
 */
export function cmbLut(info: Pick<CmbMapInfo, 'zeroLevel' | 'microkelvinPerStep'>, colours: CmbColours = 'true'): Rgb[] {
  const colour = colours === 'planck' ? planckColour : cmbColour;
  return Array.from({ length: LUT_SIZE }, (_, i) => colour((i * LUT_STEP - info.zeroLevel) * info.microkelvinPerStep));
}
