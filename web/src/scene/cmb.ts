import type { CmbMapInfo } from '@sss/tools/types';

import { LAST_SCATTERING_RADIUS_MPC, mpcToKm, PLANCK18, Z_LAST_SCATTERING } from '../core/cosmology.ts';
import type { Vec3 } from '../core/vec3.ts';
import { blackbodyLinearSrgb, cieY, planckSpectralRadiance, type Rgb } from './blackbody.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { LIGHT_YEAR_KM } from './scale.ts';

/**
 * The last-scattering sphere (G4): what the CosmicMicrowaveBackground draws, and how -- kept
 * apart from the component so it can be tested without a renderer.
 *
 * ## Where it is
 *
 * A sphere about the Sun at the comoving distance light from z* = 1089.8 has come, 13,880 Mpc,
 * 45.3 billion ly in Planck 2018's cosmology (cosmology.ts). It is not a thing out there but a
 * time: every direction from here, looked along far enough, ends in the plasma that filled the
 * universe until 380,000 years after the Big Bang, and what reaches us from it is its light,
 * last scattered then. Seen from outside, as the camera here can, only its far half is drawn,
 * its inside -- a bowl behind everything it encloses, bearing the sky as seen from here -- and it
 * is a view no one could have: the sphere is centred on us, and anyone anywhere else has a
 * sphere of their own. From inside it, anywhere nearer than CMB_FROM_LY, it is not drawn at all:
 * there it is the sky's microwave glow, which no eye sees.
 *
 * ## The map on it
 *
 * Planck's 2018 SMICA map (tools/src/cmb/prepareCmb.ts, web/public/cmb/), Galactic: a fragment
 * at direction n from the Sun takes the temperature of the sky in direction n -- n's Galactic
 * longitude and latitude through GALACTIC_BASIS, the same frame the Milky Way is drawn in.
 *
 * ## Its colour, and the exaggeration
 *
 * Today it is a 2.7255 K blackbody, all of its light in the microwaves: to an eye, black. When it
 * was emitted it was (1 + z*) times hotter, 2,973 K, the orange of a candle flame, and that is
 * the colour drawn -- the light as it was when it left. Its anisotropies, the map, are 1e-5 of
 * the temperature: drawn as they are they would be a difference of a thousandth in brightness,
 * invisible. So each point is drawn as a blackbody at 2,973 K x (1 + EXAGGERATION dT / T0): its
 * temperature's departure from the mean made a thousand times larger, its colour and its
 * brightness both that blackbody's -- a hot spot yellower and brighter, a cold one redder and
 * dimmer, as they would be, only more. Its brightness overall is a display level, not the
 * radiance of a 2,973 K surface: that seen from inside would be as bright as a red dwarf's face.
 *
 * Shown as every other glow is (glowBuffer.ts glowDisplay): linear light in white columns, the
 * shoulder 1 - e^-x and the sRGB encode -- not the renderer's ACES curve. Its hue is the
 * blackbody's either way (ACES moved it by a few display steps); what made it read as tan was
 * its level, 0.22 of white: orange that dim is brown. At half of white the mean is a light
 * orange, (201, 159, 99) on the screen, a hot spot a pale yellow and a cold one a deep orange.
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
 * CMB_FULL_LY, smoothly in the logarithm between. From 60 billion ly the sphere, 45.3 in radius,
 * still fills 49 degrees of the sky; from 150 billion, 18: whole in the frame. Never from inside
 * it, so never on the sky of anything nearer -- a galaxy, the Local Group, the Solar System.
 */
export const CMB_FROM_LY = 60e9;
export const CMB_FULL_LY = 150e9;

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

/** The colour a temperature difference dT, uK, is drawn in: linear sRGB. */
export function cmbColour(deltaMicrokelvin: number): Rgb {
  const kelvin = CMB_EMITTED_K * (1 + (EXAGGERATION * deltaMicrokelvin * 1e-6) / CMB_TODAY_K);
  const [r, g, b] = blackbodyLinearSrgb(kelvin);
  const relative = blackbodyLuminance(kelvin) / blackbodyLuminance(CMB_EMITTED_K);
  const k = CMB_DISPLAY_LUMINANCE * relative;
  return [r * k, g * k, b * k];
}

/** Entries of the shader's table: one every LUT_STEP bytes of the map, 0 to 256. */
export const LUT_STEP = 8;
export const LUT_SIZE = 256 / LUT_STEP + 1;

/** The table the shader reads a byte of the map through: its colour every LUT_STEP bytes. */
export function cmbLut(info: Pick<CmbMapInfo, 'zeroLevel' | 'microkelvinPerStep'>): Rgb[] {
  return Array.from({ length: LUT_SIZE }, (_, i) => cmbColour((i * LUT_STEP - info.zeroLevel) * info.microkelvinPerStep));
}
