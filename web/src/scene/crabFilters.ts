import { cieX, cieY, cieZ, type Rgb } from './blackbody.ts';
import { CRAB_FILAMENTS, type Line } from './remnantVolume.ts';

/**
 * The Crab in the colours of its own light, unmixed from the three filters ESO's picture was
 * taken through.
 *
 * The picture the Crab is drawn from (eso9948f, VLT FORS2, 10 November 1999) is a composite of
 * three exposures, each put in a colour that is not its own (ESO's caption):
 *
 *   red    [S II], 673 nm, 6 nm wide      -- sulphur's two red lines, 671.6 and 673.1 nm
 *   green  R, 657 nm, 150 nm wide         -- H-alpha with [N II], [S II] and [O I], 582-732 nm
 *   blue   B, 429 nm, 88 nm wide          -- mostly the synchrotron light, 385-473 nm
 *
 * So hydrogen's deep red H-alpha is drawn green, and [O III]'s blue-green 500.7 nm, which is
 * in none of the three, is not in the picture at all. Drawn as it was, the Crab's filaments
 * were orange and green and its synchrotron light cyan.
 *
 * ## Unmixing it
 *
 * Each pixel's synchrotron share is already known (crab-continuum.png: how much of the
 * synchrotron's colour in the picture it holds). What is left is its filaments' lines:
 *
 * - **red** is [S II] alone;
 * - **green** is everything the R filter passes: [S II] again, and H-alpha, [N II] and [O I];
 *   so green less red is H-alpha's group.
 *
 * Two scales make the channels comparable, and both are set by the light itself, not by eye:
 *
 * - **Green against blue, from the synchrotron.** Its spectrum is a power law, F_nu
 *   proportional to nu^-0.7 (Veron-Cetty & Woltjer 1993), so how much of it each filter
 *   passes is known; the picture's synchrotron colour gives how its makers scaled each
 *   channel. Green comes out at 0.834 of what the power law says against blue.
 * - **Red against green, from the filaments' spectrum.** The synchrotron cannot do this one:
 *   in the 6 nm filter it is so faint that the picture's red holds more of its makers'
 *   stretch than of it. So the red is scaled so that, over the whole picture, [S II] is the
 *   share of the R filter's lines that the Crab's filaments give it (CRAB_FILAMENTS in
 *   remnantVolume.ts, after Davidson & Fesen 1985): 0.8 of 2.6. Pixel by pixel it then
 *   varies as the picture says -- more sulphur in the cooler gas, less where it is more
 *   ionised.
 *
 * Then each line is drawn its own colour, through the eye (the CIE 1931 functions, as every
 * line here is, the strengths energy fluxes as the CIE functions take them): [S II] a deep
 * red; H-alpha's group -- H-alpha, [N II] and [O I], with H-beta riding along -- a red with a
 * touch of blue, pink; and the synchrotron light its own bluish white.
 *
 * ## [O III], which the picture does not have
 *
 * The filaments' spectrum (CRAB_FILAMENTS) has [O III] 500.7 nm as strong as H-alpha, and to
 * the eye a line at 500.7 nm is four times as bright as one at 656 -- so riding on each
 * filament at that ratio, as the first version had it, it outshone their reds and turned them
 * a pale teal, where every broadband colour photograph of the Crab has them red to pink.
 * The ratio was not the error; where the [O III] is, was. Hubble's narrow-band images show
 * that only about 10% of the Crab's [O III] 500.7 comes from compact structures, against 80% of
 * its [O I] (Sankrit et al. 1998): [O III] is a diffuse glow through the nebula and a skin
 * round it, not the filaments' colour. So 10% of it rides on the filaments, and 90% is
 * spread as their light is spread over OXYGEN_DIFFUSE_LEVELS mipmap levels -- about a
 * quarter of an arcminute -- a faint teal haze under the bright synchrotron, the red
 * filaments drawn over it. How far it is spread is a choice; that it is spread is measured.
 *
 * One gain over all of it keeps the picture's whole light the same, so the Crab is as bright as
 * it was drawn before, in its own colours.
 */

/** The three filters: centre and full width, nm (ESO, eso9948f). */
export const CRAB_FILTERS = {
  red: { centreNm: 673, widthNm: 6 },
  green: { centreNm: 657, widthNm: 150 },
  blue: { centreNm: 429, widthNm: 88 },
} as const;

/** The synchrotron's spectral index in the visible: F_nu proportional to nu^-alpha. */
export const SYNCHROTRON_INDEX = 0.7;

/** The picture's synchrotron colour, linear: supernovaRemnants.ts, the Crab's `continuum.colour`. */
export const PHOTO_SYNCHROTRON: Rgb = [0.0749, 0.8143, 1];

/**
 * Red's scale against green, from the picture's own sums (see the header): the picture's red
 * over [S II]'s share of its green, both after the synchrotron is taken off. Worked out from
 * crab.png and crab-continuum.png, and checked against them in crabFilters.test.ts.
 */
export const CRAB_SULPHUR_SCALE = 6.775;

/** The gain keeping the picture's mean luminance; worked out and checked the same way. */
export const CRAB_TRUE_COLOUR_GAIN = 1.0587;

/** The visible range summed over, nm, 1 nm apart: blackbody.ts's. */
const FROM_NM = 360;
const TO_NM = 830;

const synchrotronFlux = (nm: number) => nm ** (SYNCHROTRON_INDEX - 2);

/** How much of the synchrotron's light a filter passes: F_lambda summed over its width. */
export function synchrotronInFilter(filter: { centreNm: number; widthNm: number }): number {
  let sum = 0;
  for (let nm = FROM_NM; nm <= TO_NM; nm += 1) {
    if (nm >= filter.centreNm - filter.widthNm / 2 && nm <= filter.centreNm + filter.widthNm / 2) {
      sum += synchrotronFlux(nm);
    }
  }
  return sum;
}

/** Green's scale against blue, from the synchrotron: the picture's ratio over the power law's. */
export function greenScale(): number {
  return PHOTO_SYNCHROTRON[1] / (synchrotronInFilter(CRAB_FILTERS.green) / synchrotronInFilter(CRAB_FILTERS.blue));
}

function toLinearSrgb(x: number, y: number, z: number): Rgb {
  return [
    Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z),
    Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z),
    Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z),
  ];
}

/** Lines through the eye to linear sRGB, unscaled: the strengths are fluxes. */
export function linesLinearSrgb(lines: readonly Line[]): Rgb {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [nm, strength] of lines) {
    x += strength * cieX(nm);
    y += strength * cieY(nm);
    z += strength * cieZ(nm);
  }
  return toLinearSrgb(x, y, z);
}

const inFilter = (nm: number, filter: { centreNm: number; widthNm: number }) =>
  Math.abs(nm - filter.centreNm) <= filter.widthNm / 2;

/** [S II]'s lines, H-alpha's group (with H-beta), and [O III]. */
const SULPHUR = CRAB_FILAMENTS.filter(([nm]) => inFilter(nm, CRAB_FILTERS.red));
const OXYGEN = CRAB_FILAMENTS.filter(([nm]) => nm > 490 && nm < 510);
const RED_GROUP = CRAB_FILAMENTS.filter((line) => !SULPHUR.includes(line) && !OXYGEN.includes(line));
const total = (lines: readonly Line[]) => lines.reduce((sum, [, strength]) => sum + strength, 0);
/** H-alpha's group as the R filter passes it: H-alpha, [N II], [O I] (H-beta is outside it). */
const RED_IN_GREEN = total(RED_GROUP.filter(([nm]) => inFilter(nm, CRAB_FILTERS.green)));

/** [S II]'s share of the lines the R filter passes, by the filaments' spectrum. */
export const SULPHUR_SHARE_OF_GREEN = total(SULPHUR) / (total(SULPHUR) + RED_IN_GREEN);

/** The share of [O III] 500.7 in compact structures, the filaments (Sankrit et al. 1998). */
export const OXYGEN_COMPACT_SHARE = 0.1;

/**
 * How many mipmap levels coarser than the filaments the rest of the [O III] is spread at: five,
 * 32 of the map's 0.47-arcsecond pixels, about 15 arcseconds. A choice.
 */
export const OXYGEN_DIFFUSE_LEVELS = 5;

/** The colour of a unit of [S II] flux, before the gain. */
export function sulphurUnit(): Rgb {
  const s = total(SULPHUR);
  return linesLinearSrgb(SULPHUR.map(([nm, strength]) => [nm, strength / s] as const));
}

/** The colour of a unit of the R filter's H-alpha group, H-beta riding along. */
export function redUnit(): Rgb {
  return linesLinearSrgb(RED_GROUP.map(([nm, strength]) => [nm, strength / RED_IN_GREEN] as const));
}

/** The colour of the [O III] that goes with a unit of the R filter's H-alpha group. */
export function oxygenUnit(): Rgb {
  return linesLinearSrgb(OXYGEN.map(([nm, strength]) => [nm, strength / RED_IN_GREEN] as const));
}

/** The synchrotron's colour per unit of what the B filter passes, before the gain. */
export function synchrotronUnit(): Rgb {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let nm = FROM_NM; nm <= TO_NM; nm += 1) {
    const flux = synchrotronFlux(nm);
    x += flux * cieX(nm);
    y += flux * cieY(nm);
    z += flux * cieZ(nm);
  }
  const blue = synchrotronInFilter(CRAB_FILTERS.blue);
  return toLinearSrgb(x / blue, y / blue, z / blue);
}

/** The numbers the unmixing runs on, worked out once. */
export interface CrabUnmixing {
  readonly greenScale: number;
  readonly sulphur: Rgb;
  readonly red: Rgb;
  readonly oxygen: Rgb;
  readonly synchrotron: Rgb;
}

let unmixing: CrabUnmixing | null = null;
export function crabUnmixing(): CrabUnmixing {
  unmixing ??= {
    greenScale: greenScale(),
    sulphur: sulphurUnit(),
    red: redUnit(),
    oxygen: oxygenUnit(),
    synchrotron: synchrotronUnit(),
  };
  return unmixing;
}

/** A pixel's lines: its [S II], and its H-alpha group as the R filter passed it. */
export function filamentLines(photo: Rgb, synchrotronShare: number, sulphurScale = CRAB_SULPHUR_SCALE): { sulphur: number; red: number } {
  const lineR = Math.max(photo[0] - synchrotronShare * PHOTO_SYNCHROTRON[0], 0);
  const lineG = Math.max(photo[1] - synchrotronShare * PHOTO_SYNCHROTRON[1], 0);
  const green = lineG / crabUnmixing().greenScale;
  const sulphur = Math.min(lineR / sulphurScale, green);
  return { sulphur, red: green - sulphur };
}

/**
 * A pixel of the picture in true colour, linear sRGB: its linear RGB and synchrotron share
 * (the grey map, linear), and the same OXYGEN_DIFFUSE_LEVELS mipmap levels coarser, where the
 * diffuse [O III] is read. The shader does the same (remnantMap.ts).
 */
export function trueColour(
  photo: Rgb,
  synchrotronShare: number,
  coarsePhoto: Rgb = photo,
  coarseShare: number = synchrotronShare,
  gain = CRAB_TRUE_COLOUR_GAIN,
  sulphurScale = CRAB_SULPHUR_SCALE,
): [number, number, number] {
  const u = crabUnmixing();
  const fine = filamentLines(photo, synchrotronShare, sulphurScale);
  const coarse = filamentLines(coarsePhoto, coarseShare, sulphurScale);
  const oxygen = OXYGEN_COMPACT_SHARE * fine.red + (1 - OXYGEN_COMPACT_SHARE) * coarse.red;
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c += 1) {
    out[c] =
      gain *
      (fine.sulphur * u.sulphur[c]! + fine.red * u.red[c]! + oxygen * u.oxygen[c]! + synchrotronShare * u.synchrotron[c]!);
  }
  return out;
}
