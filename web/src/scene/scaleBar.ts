import { AU_KM, LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';

/**
 * The scale bar: how long a length on screen is, at the focus's distance.
 *
 * A perspective picture has no single scale -- something twice as far is drawn half the
 * size -- so the bar has to say *where* it measures, and it measures at the focus, the
 * point the camera orbits and the one thing on screen whose distance is always known. The
 * tooltip says so.
 *
 * The unit follows the zoom, so the number stays one a person can read: metres at a
 * spacecraft, kilometres at a planet, astronomical units across the Solar System, light
 * years past it. Parsecs, the unit the catalogues give distances in, are in the tooltip
 * with the others rather than on the bar, where a fourth unit to switch to would only be
 * one more thing to read.
 */

/** The bar's longest length on screen, CSS pixels. The shortest is 2/5 of it. */
export const SCALE_BAR_MAX_PX = 120;

export type ScaleUnit = 'm' | 'km' | 'AU' | 'ly';

/**
 * Where each unit takes over, by the longest length the bar can show: km from a kilometre,
 * AU from a tenth of one -- 15 million km, where kilometres stop being a number anyone
 * holds in their head -- and light years from a tenth of one, 6,300 AU, past every orbit
 * the catalog draws.
 */
const UNITS: readonly { readonly unit: ScaleUnit; readonly km: number; readonly fromKm: number }[] = [
  { unit: 'ly', km: LIGHT_YEAR_KM, fromKm: 0.1 * LIGHT_YEAR_KM },
  { unit: 'AU', km: AU_KM, fromKm: 0.1 * AU_KM },
  { unit: 'km', km: 1, fromKm: 1 },
  { unit: 'm', km: 0.001, fromKm: 0 },
];

export interface ScaleBarReading {
  readonly lengthKm: number;
  readonly widthPx: number;
  readonly unit: ScaleUnit;
  /** The bar's own label, "5 AU". */
  readonly label: string;
  /** The same length in every unit, for the tooltip. */
  readonly detail: string;
}

/** The largest of 1, 2 and 5 times a power of ten that is at most `value`. */
export function niceFloor(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const leading = value / power;
  // A hair of slack so 5 computed as 4.999999 is still 5.
  const step = leading >= 5 - 1e-9 ? 5 : leading >= 2 - 1e-9 ? 2 : 1;
  return step * power;
}

/** A count in a unit, as the bar writes it: "200,000 km", "2 million km", "0.5 ly". */
export function formatLength(value: number, unit: ScaleUnit): string {
  if (unit === 'km' && value >= 1e6) {
    return `${Number((value / 1e6).toPrecision(3))} million km`;
  }
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${unit}`;
}

/** Three significant figures, grouped, for the tooltip. */
function approximate(value: number): string {
  if (value >= 1e21 || (value > 0 && value < 1e-4)) {
    return value.toExponential(2);
  }
  return Number(value.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

/** The bar for a picture where one CSS pixel at the focus's distance is `kmPerPx`. */
export function scaleBarReading(kmPerPx: number, maxWidthPx = SCALE_BAR_MAX_PX): ScaleBarReading {
  const maxKm = kmPerPx * maxWidthPx;
  const chosen = UNITS.find((entry) => maxKm >= entry.fromKm) ?? UNITS[UNITS.length - 1]!;
  const value = niceFloor(maxKm / chosen.km);
  const lengthKm = value * chosen.km;
  const detail = [
    `${approximate(lengthKm)} km`,
    `${approximate(lengthKm / AU_KM)} AU`,
    `${approximate(lengthKm / LIGHT_YEAR_KM)} ly`,
    `${approximate(lengthKm / PARSEC_KM)} pc`,
  ].join(' = ');
  return {
    lengthKm,
    widthPx: lengthKm / kmPerPx,
    unit: chosen.unit,
    label: formatLength(value, chosen.unit),
    detail,
  };
}

/**
 * Kilometres per CSS pixel at a distance from the camera, for a vertical field of view
 * and a viewport height: the frame's height at that distance, over its pixels.
 */
export function kmPerPixelAt(distanceKm: number, fovDeg: number, viewportHeightPx: number): number {
  return (2 * distanceKm * Math.tan((fovDeg * Math.PI) / 360)) / viewportHeightPx;
}
