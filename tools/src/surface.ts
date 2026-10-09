import { MAX_RETRIES, REQUEST_TIMEOUT_MS } from './config.ts';
import { retryDelayMs } from './horizons/client.ts';
import type { BodyId, SurfaceSite, SurfaceTrack } from './types.ts';

/**
 * Craft on the surface of Mars: where they stood, and from when.
 *
 * JPL Horizons is no use here. It holds Curiosity at its 2012 landing site, fourteen
 * kilometres from where the rover is now, and stops Perseverance's file in February 2026.
 * What NASA does publish is each rover's traverse, as its mission maps (MMGIS) show it:
 * one point per drive, with the sol it happened on, the rover's latitude and longitude
 * when it stopped, and its heading. That is the source here.
 *
 * A sol is a Martian day at the rover's own longitude, so turning one into an instant
 * takes Mars time. The Mars24 algorithm (Allison and McEwen 2000, as NASA GISS publishes
 * it) counts Mars Sol Date from a fixed epoch:
 *
 *   MSD = (JD_TT - 2405522.0028779) / 1.0274912517
 *
 * and a sol at east longitude L begins wherever MSD + L / 360 passes a whole number --
 * local midnight. Sol 0 is the local day touchdown fell in, so mission sol N is that
 * day's count plus N.
 */

/** Days of TT in one sol. */
export const SOL_DAYS = 1.0274912517;

/** JD (TT) at which Mars Sol Date is zero. */
export const MSD_EPOCH_JD_TT = 2405522.0028779;

/** Mars Sol Date at a TT Julian day. */
export function marsSolDate(jdTt: number): number {
  return (jdTt - MSD_EPOCH_JD_TT) / SOL_DAYS;
}

/** The TT Julian day at a Mars Sol Date. */
export function jdTtAtMarsSolDate(msd: number): number {
  return msd * SOL_DAYS + MSD_EPOCH_JD_TT;
}

/** Local mean solar time at east longitude `longitudeDeg`, hours. */
export function localMeanSolarHours(jdTt: number, longitudeDeg: number): number {
  const local = marsSolDate(jdTt) + longitudeDeg / 360;
  return (local - Math.floor(local)) * 24;
}

/**
 * TAI - UTC from 2012 on, seconds: the leap seconds of 2012-07-01, 2015-07-01 and
 * 2017-01-01 (IERS Bulletin C). Earlier instants are not asked for here.
 */
const LEAP_SECONDS: readonly (readonly [string, number])[] = [
  ['2012-07-01T00:00:00Z', 35],
  ['2015-07-01T00:00:00Z', 36],
  ['2017-01-01T00:00:00Z', 37],
];

/**
 * A UTC instant as a TT Julian day. Within 2 ms of TDB, the scale the app runs on --
 * a quarter of a millimetre of a rover's drive and nothing of a sol.
 */
export function utcToJdTt(utc: string): number {
  const ms = Date.parse(utc);
  if (Number.isNaN(ms)) {
    throw new Error(`Not an instant: ${utc}`);
  }
  const entry = [...LEAP_SECONDS].reverse().find(([from]) => ms >= Date.parse(from));
  if (entry === undefined) {
    throw new Error(`${utc} is before the leap-second table here starts.`);
  }
  return ms / 86_400_000 + 2440587.5 + (entry[1] + 32.184) / 86_400;
}

/** One drive's end, as NASA's waypoint file records it. */
export interface Waypoint {
  readonly sol: number;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly headingDeg: number | null;
}

/**
 * The waypoints of an MMGIS traverse file, one per sol: the last of each.
 *
 * A sol can hold several drives, and only where the rover ended the sol matters to a
 * track that changes once a sol. Points come back ordered by sol.
 */
export function parseTraverse(geojson: unknown): Waypoint[] {
  const features = (geojson as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error('Traverse file has no features.');
  }
  const bySol = new Map<number, Waypoint>();
  for (const feature of features as { properties?: Record<string, unknown> }[]) {
    const p = feature.properties ?? {};
    const sol = Number(p.sol);
    const latitudeDeg = Number(p.lat);
    const longitudeDeg = Number(p.lon);
    if (![sol, latitudeDeg, longitudeDeg].every(Number.isFinite)) {
      throw new Error(`Traverse point without sol, lat or lon: ${JSON.stringify(p)}`);
    }
    const yaw = p.yaw === undefined || p.yaw === null ? Number.NaN : Number(p.yaw);
    // Later points of the same sol replace earlier ones: the file is in drive order.
    bySol.set(sol, {
      sol,
      latitudeDeg,
      longitudeDeg,
      headingDeg: Number.isFinite(yaw) ? ((yaw % 360) + 360) % 360 : null,
    });
  }
  return [...bySol.values()].sort((a, b) => a.sol - b.sol);
}

/** The local day (MSD + longitude / 360, floored) an instant falls in at a longitude. */
function localDay(jdTt: number, longitudeDeg: number): number {
  return Math.floor(marsSolDate(jdTt) + longitudeDeg / 360);
}

/** The instant mission sol `sol` ends at `longitudeDeg`, given sol 0's local day. */
export function solEndJdTt(solZeroDay: number, sol: number, longitudeDeg: number): number {
  return jdTtAtMarsSolDate(solZeroDay + sol + 1 - longitudeDeg / 360);
}

/** A track whose host the sol arithmetic here is not for. */
function requireMars(host: BodyId): void {
  if (host !== 'mars') {
    throw new Error(`Surface tracks are computed in Mars time; ${host} is not Mars.`);
  }
}

/**
 * A rover's track: touchdown at the first waypoint's position, then each sol's last
 * drive from the end of that sol.
 */
export function traverseTrack(
  id: BodyId,
  site: Extract<SurfaceSite, { kind: 'traverse' }>,
  waypoints: readonly Waypoint[],
): SurfaceTrack {
  requireMars(site.host);
  const first = waypoints[0];
  if (first === undefined) {
    throw new Error(`${id} has no waypoints.`);
  }
  const landing = utcToJdTt(site.landingUtc);
  const solZero = localDay(landing, first.longitudeDeg);

  const stops = [{ t: landing, ...first, sol: 0 }];
  for (const point of waypoints) {
    stops.push({ ...point, t: solEndJdTt(solZero, point.sol, point.longitudeDeg) });
  }
  return {
    id,
    host: site.host,
    count: stops.length,
    t: stops.map((stop) => stop.t),
    latitudeDeg: stops.map((stop) => stop.latitudeDeg),
    longitudeDeg: stops.map((stop) => stop.longitudeDeg),
    headingDeg: stops.map((stop) => stop.headingDeg),
    sol: stops.map((stop) => stop.sol),
  };
}

/** A lander's track: one stop, from touchdown on. */
export function fixedTrack(id: BodyId, site: Extract<SurfaceSite, { kind: 'fixed' }>): SurfaceTrack {
  requireMars(site.host);
  return {
    id,
    host: site.host,
    count: 1,
    t: [utcToJdTt(site.landingUtc)],
    latitudeDeg: [site.latitudeDeg],
    longitudeDeg: [site.longitudeDeg],
    headingDeg: [site.headingDeg],
    sol: [0],
  };
}

/**
 * NASA's traverse file, with the same retries and backoff as every other request here.
 *
 * Network faults and 5xx answers are retried; a 4xx is not -- the file has moved, and
 * waiting will not bring it back.
 */
export async function fetchTraverse(url: string, label: string): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`${label}: ${url} answered HTTP ${response.status}.`, {
          cause: 'permanent',
        });
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as unknown;
    } catch (error) {
      lastError = error;
      if ((error as Error).cause === 'permanent' || attempt === MAX_RETRIES) {
        break;
      }
      const wait = retryDelayMs(attempt, null);
      console.warn(
        `[surface] ${label}: attempt ${attempt}/${MAX_RETRIES} failed (${String(error)}). ` +
          `Retrying in ${(wait / 1000).toFixed(1)} s.`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw new Error(`${label}: traverse not fetched: ${String(lastError)}`);
}
