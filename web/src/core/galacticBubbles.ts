import { galacticCentrePc } from './milkyWay.ts';

/**
 * The Fermi and eROSITA bubbles: two pairs of lobes standing out of the Galactic Centre, above and
 * below the disc, drawn as faint shells (scene/GalacticBubbles.tsx).
 *
 * ## Measured
 *
 * Their outlines on the sky, and nothing of their depth:
 *
 * - **Fermi** (gamma rays): "extending 50 degrees above and below the Galactic center, with a width
 *   of about 40 degrees in longitude" (Su, Slatyer & Finkbeiner 2010, ApJ 724, 1044).
 * - **eROSITA** (soft X-rays): about 80° across in longitude and 80-85° in latitude; read as
 *   "spherical thick shells" 14 kpc across, reaching about 14 kpc above and below the centre
 *   (Predehl et al. 2020, Nature 588, 227).
 *
 * ## Modelled
 *
 * That they stand on the Galactic Centre, symmetric about its pole, each lobe touching it at its
 * base. The Fermi lobes as ellipsoids, their two semi-axes fitted so that seen from the Sun they
 * reach 50° in latitude and 20° either side in longitude (FERMI_LOBE: 2.79 kpc across the
 * axis, 4.29 kpc along it, so 8.6 kpc tall -- the "8-9 kpc" usually quoted). The eROSITA lobes as
 * Predehl's spheres, 7 kpc in radius: from the Sun they reach 81° in latitude and 59° in
 * longitude, wider than their measured outline; later work finds them narrower and their height
 * degenerate with their tilt. Neither is light the eye sees: drawn in false colours, the Fermi
 * bubbles violet, the eROSITA bubbles blue, as shells brightest at their rims.
 */

export interface BubbleLobe {
  /** Semi-axes, pc: across the Galaxy's pole, and along it. */
  readonly acrossPc: number;
  readonly alongPc: number;
}

export interface BubblePair {
  readonly key: 'fermi' | 'erosita';
  readonly name: string;
  readonly lobe: BubbleLobe;
  /** Linear light at a shell's rim, white columns, and its hue. */
  readonly colour: readonly [number, number, number];
  readonly reference: string;
}

/** The Fermi lobes' semi-axes, fitted to Su et al.'s 50° and ±20° from R0 = 8.15 kpc (see the header). */
export const FERMI_LOBE: BubbleLobe = { acrossPc: 2787, alongPc: 4288 };
/** The eROSITA lobes: Predehl et al.'s spheres, 14 kpc across. */
export const EROSITA_LOBE: BubbleLobe = { acrossPc: 7000, alongPc: 7000 };

export const BUBBLES: readonly BubblePair[] = [
  {
    key: 'fermi',
    name: 'Fermi bubbles',
    lobe: FERMI_LOBE,
    colour: [0.62, 0.42, 1],
    reference: 'Su, Slatyer & Finkbeiner 2010, ApJ 724, 1044',
  },
  {
    key: 'erosita',
    name: 'eROSITA bubbles',
    lobe: EROSITA_LOBE,
    colour: [0.38, 0.62, 1],
    reference: 'Predehl et al. 2020, Nature 588, 227',
  },
];

/**
 * A lobe's centre about the Sun, galactic Cartesian pc (x toward the centre, z north): above the
 * Galactic Centre by its semi-axis along the pole, north (+1) or south (-1), so its base touches it.
 */
export function lobeCentrePc(lobe: BubbleLobe, side: 1 | -1): [number, number, number] {
  const [x, y, z] = galacticCentrePc();
  return [x, y, z + side * lobe.alongPc];
}

/** The farthest latitude and longitude a lobe reaches seen from the Sun, degrees: for the tests and the About. */
export function lobeExtentDeg(lobe: BubbleLobe, samples = 240): { latitude: number; longitude: number } {
  const [cx, cy, cz] = lobeCentrePc(lobe, 1);
  let latitude = 0;
  let longitude = 0;
  for (let i = 0; i <= samples; i += 1) {
    const u = (i / samples) * Math.PI;
    for (let j = 0; j < 2 * samples; j += 1) {
      const v = (j / samples) * Math.PI;
      const x = cx + lobe.acrossPc * Math.sin(u) * Math.cos(v);
      const y = cy + lobe.acrossPc * Math.sin(u) * Math.sin(v);
      const z = cz + lobe.alongPc * Math.cos(u);
      latitude = Math.max(latitude, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI);
      longitude = Math.max(longitude, Math.abs((Math.atan2(y, x) * 180) / Math.PI));
    }
  }
  return { latitude, longitude };
}
