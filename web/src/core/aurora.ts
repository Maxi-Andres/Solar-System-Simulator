import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from './ephemerisStore.ts';
import { DIPOLE_POLE_LATITUDE_DEG, DIPOLE_POLE_LONGITUDE_DEG } from './magnetosphere.ts';
import { registerRegion, regionDefinition, regionOf, type Region, type RegionFact } from './regions.ts';
import { Signal } from './signal.ts';
import { surfaceFrame } from './surface.ts';
import { add, scale, type StateVector } from './vec3.ts';

/**
 * Earth's auroral ovals, as NOAA's Space Weather Prediction Center forecasts them.
 *
 * The data is SWPC's OVATION Prime aurora forecast (Newell et al. 2009, JGR 114, A09207; Machol
 * et al. 2012, Space Weather 10, S03005, for its use as a forecast): a grid of one degree in
 * geographic latitude and longitude, 360 by 181, of the probability of seeing aurora, 0 to 100 %,
 * driven by the solar wind measured at L1 an hour or so upstream -- so it is valid for a moment
 * 30 to 90 minutes after the wind was measured, its "Forecast Time". Public domain, from
 * services.swpc.noaa.gov, which serves it to any page (Access-Control-Allow-Origin: *): fetched by
 * the browser when the Auroras layer is on, and again every ten minutes while it stays on.
 *
 * **Only near its time.** The oval swells and shrinks with the solar wind over hours; a forecast
 * says nothing about last week or next. So it is drawn only while the clock is within an hour of
 * the span the forecast covers (from the wind's measurement to the forecast's time), and not at
 * all elsewhere. A statistical oval for a Kp index was the other choice (Feldstein's, Starkov's):
 * but for any date but now nobody has said what the Kp was, and an oval for an assumed one would
 * be a picture of a night that may not have happened. The panel says why nothing is drawn.
 */

export const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

/** The grid: longitude 0 to 359 east, latitude -90 to 90, one degree. */
export const OVATION_LONGITUDES = 360;
export const OVATION_LATITUDES = 181;

/** How long past either end of the forecast's span the clock may be and the oval still drawn. */
export const AURORA_MARGIN_HOURS = 1;

/** How often to fetch again while the layer stays on, ms: SWPC makes a new one every few minutes. */
export const AURORA_REFRESH_MS = 10 * 60 * 1000;

export interface AuroraForecast {
  /** When the solar wind it was driven by was measured, and the moment it is for: Julian days, UTC. */
  readonly observedJd: number;
  readonly forecastJd: number;
  readonly observedIso: string;
  readonly forecastIso: string;
  /** Probability, percent, at [latitude + 90][longitude], row by row. */
  readonly probability: Uint8Array;
  /** The highest in each hemisphere, percent. */
  readonly northMax: number;
  readonly southMax: number;
}

function isoToJd(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms / 86_400_000 + 2440587.5 : null;
}

/**
 * The forecast from SWPC's JSON, or null if it is not one: a download is untrusted, so every
 * cell is checked to be a number on the grid, and anything else refuses the whole.
 */
export function parseOvation(json: unknown): AuroraForecast | null {
  if (typeof json !== 'object' || json === null) return null;
  const record = json as Record<string, unknown>;
  const observedJd = isoToJd(record['Observation Time']);
  const forecastJd = isoToJd(record['Forecast Time']);
  const coordinates = record['coordinates'];
  if (observedJd === null || forecastJd === null || !Array.isArray(coordinates)) return null;
  if (coordinates.length !== OVATION_LONGITUDES * OVATION_LATITUDES) return null;
  const probability = new Uint8Array(OVATION_LONGITUDES * OVATION_LATITUDES);
  const seen = new Uint8Array(probability.length);
  let northMax = 0;
  let southMax = 0;
  for (const cell of coordinates) {
    if (!Array.isArray(cell) || cell.length !== 3) return null;
    const [lon, lat, value] = cell as unknown[];
    if (typeof lon !== 'number' || typeof lat !== 'number' || typeof value !== 'number') return null;
    if (!Number.isInteger(lon) || !Number.isInteger(lat) || lon < 0 || lon >= OVATION_LONGITUDES) return null;
    if (lat < -90 || lat > 90 || !Number.isFinite(value)) return null;
    const index = (lat + 90) * OVATION_LONGITUDES + lon;
    const percent = Math.round(Math.min(100, Math.max(0, value)));
    probability[index] = percent;
    seen[index] = 1;
    if (lat > 0) northMax = Math.max(northMax, percent);
    if (lat < 0) southMax = Math.max(southMax, percent);
  }
  if (seen.includes(0)) return null;
  return {
    observedJd,
    forecastJd,
    observedIso: record['Observation Time'] as string,
    forecastIso: record['Forecast Time'] as string,
    probability,
    northMax,
    southMax,
  };
}

/** How far the clock (UTC Julian day) is outside the forecast's span, hours; 0 inside it. */
export function hoursOutside(forecast: AuroraForecast, utcJd: number): number {
  const from = Math.min(forecast.observedJd, forecast.forecastJd);
  const to = Math.max(forecast.observedJd, forecast.forecastJd);
  const days = utcJd < from ? from - utcJd : utcJd > to ? utcJd - to : 0;
  return days * 24;
}

/** Whether the oval is drawn at the clock's instant. */
export function auroraShownAt(forecast: AuroraForecast, utcJd: number): boolean {
  return hoursOutside(forecast, utcJd) <= AURORA_MARGIN_HOURS;
}

// --- Fetching ----------------------------------------------------------------------------------

let current: AuroraForecast | null = null;
let failed = false;
let fetchedAt = Number.NEGATIVE_INFINITY;
let inFlight: Promise<void> | null = null;

/** Fires when a new forecast arrives. */
export const auroraChanged = new Signal();

export function auroraForecast(): AuroraForecast | null {
  return current;
}

/** Fetches the latest forecast, unless one arrived within AURORA_REFRESH_MS or is on its way. */
export function refreshAurora(nowMs: number, fetcher: (url: string) => Promise<unknown> = defaultFetch): void {
  if (inFlight !== null || nowMs - fetchedAt < AURORA_REFRESH_MS) return;
  fetchedAt = nowMs;
  inFlight = fetcher(OVATION_URL)
    .then((json) => {
      const parsed = parseOvation(json);
      failed = parsed === null && current === null;
      if (parsed !== null) {
        current = parsed;
        auroraChanged.emit();
      }
    })
    .catch(() => {
      failed = current === null;
    })
    .finally(() => {
      inFlight = null;
    });
}

async function defaultFetch(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

// --- The bodies --------------------------------------------------------------------------------

export const NORTHERN_AURORA_ID: BodyId = 'aurora-north';
export const SOUTHERN_AURORA_ID: BodyId = 'aurora-south';

/** The green line's height, km, where the mark sits: the oval's lower edge glows brightest. */
export const AURORA_MARK_HEIGHT_KM = 110;

const AURORA_COLOR = '#7fe08a';

function utcLabel(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function liveFacts(north: boolean, utcOf: (tdbJd: number) => number): (jd: number) => readonly RegionFact[] {
  return (jd) => {
    if (current === null) {
      return [{ label: 'Forecast', value: failed ? 'NOAA’s forecast could not be fetched' : 'Not yet fetched' }];
    }
    const outside = hoursOutside(current, utcOf(jd));
    const drawn =
      outside <= AURORA_MARGIN_HOURS
        ? 'Yes'
        : outside < 48
          ? `No: the clock is ${Math.round(outside)} hours from the forecast`
          : `No: the clock is ${Math.round(outside / 24)} days from the forecast`;
    return [
      { label: 'Forecast for', value: utcLabel(current.forecastIso) },
      { label: 'Solar wind at', value: utcLabel(current.observedIso) },
      { label: 'Most likely', value: `${north ? current.northMax : current.southMax} % chance of seeing it` },
      { label: 'Drawn', value: drawn },
    ];
  };
}

const STATIC_FACTS: readonly RegionFact[] = [
  { label: 'What', value: 'Light of oxygen hit by electrons from the magnetosphere' },
  { label: 'Height', value: 'Mostly 100–250 km; green, 557.7 nm' },
  { label: 'Model', value: 'NOAA SWPC OVATION Prime, from the solar wind at L1' },
  { label: 'Drawn', value: 'Within an hour of the forecast only; never a guess' },
  { label: 'Mark', value: 'At the geomagnetic pole (IGRF-13), which the oval rings' },
];

export function auroraRegions(utcOf: (tdbJd: number) => number): readonly Region[] {
  return [
    {
      id: NORTHERN_AURORA_ID,
      name: 'Northern lights',
      layer: 'aurora',
      kindLabel: 'Aurora · forecast',
      measured: false,
      facts: STATIC_FACTS,
      liveFacts: liveFacts(true, utcOf),
      framingKm: 4 * 6371,
      parent: 'earth',
      color: AURORA_COLOR,
    },
    {
      id: SOUTHERN_AURORA_ID,
      name: 'Southern lights',
      layer: 'aurora',
      kindLabel: 'Aurora · forecast',
      measured: false,
      facts: STATIC_FACTS,
      liveFacts: liveFacts(false, utcOf),
      framingKm: 4 * 6371,
      parent: 'earth',
      color: AURORA_COLOR,
    },
  ];
}

/** The two ovals made bodies: each a mark over its geomagnetic pole, turning with Earth. */
export function ensureAuroraBodies(store: EphemerisStore, utcOf: (tdbJd: number) => number): void {
  if (!store.tree.has('earth')) return;
  const regions = auroraRegions(utcOf).filter((region) => !store.isPropagatedBody(region.id));
  if (regions.length === 0) return;
  for (const region of regions) registerRegion(region);
  const earth = store.body('earth');
  store.addPropagatedBodies(
    regions.map((region) => {
      const north = region.id === NORTHERN_AURORA_ID;
      const latitude = north ? DIPOLE_POLE_LATITUDE_DEG : -DIPOLE_POLE_LATITUDE_DEG;
      const longitude = north ? DIPOLE_POLE_LONGITUDE_DEG : DIPOLE_POLE_LONGITUDE_DEG + 180;
      return {
        body: regionDefinition(regionOf(region.id)!),
        elements: null,
        state: (jd: number): StateVector => {
          const frame = surfaceFrame(earth, latitude, longitude, jd);
          return {
            position: add(frame.positionKm, scale(frame.up, AURORA_MARK_HEIGHT_KM)),
            velocity: { x: 0, y: 0, z: 0 },
          };
        },
        options: { aboutParent: true, exact: true },
      };
    }),
  );
}
