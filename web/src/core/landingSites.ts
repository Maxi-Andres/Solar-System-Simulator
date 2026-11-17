import type { BodyId } from '@sss/tools/types';

import type { FramingRequest } from '../state/store.ts';
import { angularRadiusPixels } from '../scene/scale.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { registerRegion, regionDefinition, regionOf, type Region } from './regions.ts';
import { surfaceFrame, surfaceState } from './surface.ts';
import { distance, dot, length, subtract, type StateVector, type Vec3 } from './vec3.ts';

/**
 * Where craft landed on the Moon and on Mars: places on the ground, made bodies as the Lagrange
 * points are (regions.ts), each named, found by search and gone to, with a panel of what landed
 * there, when, and whose measurement puts it where it is.
 *
 * **Where.** Every site is a published latitude and longitude of the hardware itself, found in
 * an orbiter's images after the landing -- LRO's narrow-angle camera on the Moon, MRO's HiRISE
 * on Mars -- not the target the mission aimed for. Each says whose numbers it is. On the Moon
 * they are in the Mean Earth / polar axis frame, which is the frame the IAU's rotation model
 * approximates (Archinal et al. 2018) and LRO's mosaics are drawn in; on Mars, planetocentric
 * and east-positive against the IAU prime meridian, the frame of MOLA and HiRISE. Both are the
 * frames the app's own maps and rotations are in (surface.ts, orientation.ts), so a site sits
 * on the ground the map shows: Apollo 11 in Mare Tranquillitatis, as textureAlignment.test.ts
 * checks.
 *
 * **Placed** exactly as the rovers are (surface.ts): on the body's reference ellipsoid at that
 * latitude and longitude, turned by the same IAU rotation the body is drawn with, every frame.
 * Nothing models terrain, so a site in a crater is drawn on the ellipsoid above its floor. A
 * site exists from its landing on, as a craft does from its launch.
 *
 * **What is not here.** Curiosity, Perseverance and InSight are craft in the catalog, on
 * NASA's traverses (tools/src/surface.ts), and are not repeated. A rover that stopped is
 * marked where it stopped; a moving one is not a site.
 *
 * **Shown** only while the body it is on is large on the screen -- its radius past
 * SHOWN_FROM_PX -- and only on the side turned to the camera: thirteen names on a Moon a few
 * dozen pixels across would bury it, and a name seen through the Moon names nothing.
 */

export type LandingHost = 'moon' | 'mars';

export interface LandingSite {
  readonly id: BodyId;
  readonly name: string;
  readonly host: LandingHost;
  /** What is there: the lander, the rover, the descent stage. */
  readonly craft: string;
  readonly operator: string;
  /** Touchdown, UTC: ISO 8601, the date alone where the time is not needed. */
  readonly landedUtc: string;
  /** Planetocentric latitude, degrees north. */
  readonly latitudeDeg: number;
  /** Longitude, degrees east. */
  readonly longitudeDeg: number;
  /** Whose position it is, for the panel: the camera that found it, the paper. */
  readonly source: string;
  /** Anything the panel must add: a rover's last stop, a position from before orbit found it. */
  readonly note?: string;
}

/** The LROC team's table of every craft on the Moon, ME frame: Wagner et al. 2017's 2016 update. */
const LROC_TABLE = 'LRO camera (LROC NAC): Wagner et al. 2017, 2016 table';

/** Konopliv et al. 2026, PSJ 7, 212, Table 7: the landers found in HiRISE images, tied to MOLA. */
const HIRISE_TABLE = 'MRO HiRISE (Konopliv et al. 2026, Table 7)';

/**
 * Sites, in landing order on each body.
 *
 * **Moon.** The LROC team's measurements of the hardware in NAC images, every one in the Mean
 * Earth frame:
 *  - Surveyor 1, the Apollo descent stages, Lunokhod 1 and 2 where they stopped, and Chang'e 3:
 *    "Spacecraft Related Coordinates -- 2016 Update", lroc.im-ldi.com/images/938, the table of
 *    Wagner, Nelson, Plescia, Robinson, Speyerer and Mazarico, "Coordinates of anthropogenic
 *    features on the Moon", Icarus 283, 92 (2017), doi:10.1016/j.icarus.2016.05.011. Each
 *    to a few metres -- Apollo 11's to 0.3.
 *  - The rest, each from the LROC post that found it: Chang'e 4, lroc.im-ldi.com/images/1100
 *    (about 3 m); Chang'e 5, images/1172 (±20 m); Chandrayaan-3's Vikram, images/1314 (its
 *    longitude to two decimals, ±300 m); SLIM, images/1358; Chang'e 6, images/1374 (±30 m);
 *    Blue Ghost 1, images/1407.
 *
 * **Mars.** Planetocentric, east-positive:
 *  - Viking 1 and Pathfinder: the landers in HiRISE images, Konopliv, Park, Le Maistre,
 *    Yseboodt and Baland, "Updated Mars Orientation and Gravity Field ...", PSJ 7, 212 (2026),
 *    doi:10.3847/PSJ/ae9ba7, Table 7 (positions from Reidel 2025), tied to the MOLA frame to
 *    100-300 m.
 *  - Viking 2: NASA NSSDCA's catalogue entry (1975-083C), which says neither frame nor method;
 *    no HiRISE position of the lander has been published in a form found here.
 *  - Phoenix: the Phoenix Analyst's Notebook (Washington University), "IAU 2000 areocentric".
 *  - Spirit and Opportunity where they stopped: worked out here, not published as coordinates
 *    -- the landing point from HiRISE (Konopliv et al. 2026, Table 7) plus the drive to the
 *    last stop in NASA's MER traverse files (MER Analyst's Notebook, MERA_traverse.csv and
 *    MERB_traverse_5130.csv), east and north metres on the 3,396.19 km sphere. Checked: the
 *    same sum puts Opportunity's 2011-12 winter stop, Greeley Haven, within 0.001 degrees of
 *    the radio-tracked one in the same table; Spirit's lands on NASA's "14.6 S, 175.5 E" for
 *    Troy (PIA12205).
 *  - Tianwen-1's lander: Wan, Yu, Di et al., "Visual Localization of the Tianwen-1 Lander
 *    Using Orbital, Descent and Rover Images", Remote Sens. 13, 3439 (2021),
 *    doi:10.3390/rs13173439, ±0.002 degrees, IAU 2000. Zhurong drove south from it; where it
 *    stopped in May 2022 is not published as coordinates, so it is not marked.
 *
 * **Touchdown** instants as the agencies gave them (spacecraft event time); only the date is
 * shown, and the site exists from that instant on.
 */
export const LANDING_SITES: readonly LandingSite[] = [
  // The Moon.
  {
    id: 'site-surveyor-1',
    name: 'Surveyor 1',
    host: 'moon',
    craft: 'Surveyor 1 lander',
    operator: 'NASA',
    landedUtc: '1966-06-02T06:17:36Z',
    latitudeDeg: -2.4745,
    longitudeDeg: 316.6602,
    source: LROC_TABLE,
  },
  {
    id: 'site-apollo-11',
    name: 'Apollo 11',
    host: 'moon',
    craft: 'Eagle’s descent stage',
    operator: 'NASA',
    landedUtc: '1969-07-20T20:17:40Z',
    latitudeDeg: 0.67416,
    longitudeDeg: 23.47314,
    source: LROC_TABLE,
  },
  {
    id: 'site-apollo-12',
    name: 'Apollo 12',
    host: 'moon',
    craft: 'Intrepid’s descent stage',
    operator: 'NASA',
    landedUtc: '1969-11-19T06:54:35Z',
    latitudeDeg: -3.0128,
    longitudeDeg: 336.5781,
    source: LROC_TABLE,
  },
  {
    id: 'site-lunokhod-1',
    name: 'Lunokhod 1',
    host: 'moon',
    craft: 'Lunokhod 1 rover, at its last stop',
    operator: 'Soviet Union',
    landedUtc: '1970-11-17T03:46:50Z',
    latitudeDeg: 38.315,
    longitudeDeg: 324.9919,
    source: LROC_TABLE,
  },
  {
    id: 'site-apollo-14',
    name: 'Apollo 14',
    host: 'moon',
    craft: 'Antares’s descent stage',
    operator: 'NASA',
    landedUtc: '1971-02-05T09:18:11Z',
    latitudeDeg: -3.64589,
    longitudeDeg: 342.52806,
    source: LROC_TABLE,
  },
  {
    id: 'site-apollo-15',
    name: 'Apollo 15',
    host: 'moon',
    craft: 'Falcon’s descent stage, the rover',
    operator: 'NASA',
    landedUtc: '1971-07-30T22:16:29Z',
    latitudeDeg: 26.13239,
    longitudeDeg: 3.6333,
    source: LROC_TABLE,
  },
  {
    id: 'site-apollo-16',
    name: 'Apollo 16',
    host: 'moon',
    craft: 'Orion’s descent stage, the rover',
    operator: 'NASA',
    landedUtc: '1972-04-21T02:23:35Z',
    latitudeDeg: -8.9734,
    longitudeDeg: 15.5011,
    source: LROC_TABLE,
  },
  {
    id: 'site-apollo-17',
    name: 'Apollo 17',
    host: 'moon',
    craft: 'Challenger’s descent stage, the rover',
    operator: 'NASA',
    landedUtc: '1972-12-11T19:54:57Z',
    latitudeDeg: 20.1911,
    longitudeDeg: 30.7723,
    source: LROC_TABLE,
  },
  {
    id: 'site-lunokhod-2',
    name: 'Lunokhod 2',
    host: 'moon',
    craft: 'Lunokhod 2 rover, at its last stop',
    operator: 'Soviet Union',
    landedUtc: '1973-01-15T22:35:00Z',
    latitudeDeg: 25.8323,
    longitudeDeg: 30.9222,
    source: LROC_TABLE,
  },
  {
    id: 'site-change-3',
    name: 'Chang’e 3',
    host: 'moon',
    craft: 'Lander; Yutu nearby',
    operator: 'CNSA',
    landedUtc: '2013-12-14T13:11:18Z',
    latitudeDeg: 44.1214,
    longitudeDeg: 340.4883,
    source: LROC_TABLE,
  },
  {
    id: 'site-change-4',
    name: 'Chang’e 4',
    host: 'moon',
    craft: 'Lander, on the far side; Yutu-2 nearby',
    operator: 'CNSA',
    landedUtc: '2019-01-03T02:26:00Z',
    latitudeDeg: -45.4561,
    longitudeDeg: 177.5885,
    source: 'LRO camera (LROC NAC), 2019-04-30',
  },
  {
    id: 'site-change-5',
    name: 'Chang’e 5',
    host: 'moon',
    craft: 'Lander; its ascent stage left with the samples',
    operator: 'CNSA',
    landedUtc: '2020-12-01T15:11:00Z',
    latitudeDeg: 43.0576,
    longitudeDeg: 308.0839,
    source: 'LRO camera (LROC NAC), 2020-12-04, ±20 m',
  },
  {
    id: 'site-chandrayaan-3',
    name: 'Chandrayaan-3',
    host: 'moon',
    craft: 'Vikram lander; Pragyan nearby',
    operator: 'ISRO',
    landedUtc: '2023-08-23T12:33:00Z',
    latitudeDeg: -69.3741,
    longitudeDeg: 32.32,
    source: 'LRO camera (LROC NAC), 2023-09-05',
  },
  {
    id: 'site-slim',
    name: 'SLIM',
    host: 'moon',
    craft: 'Lander, on its nose',
    operator: 'JAXA',
    landedUtc: '2024-01-19T15:20:00Z',
    latitudeDeg: -13.316,
    longitudeDeg: 25.251,
    source: 'LRO camera (LROC NAC), 2024-01-26',
  },
  {
    id: 'site-change-6',
    name: 'Chang’e 6',
    host: 'moon',
    craft: 'Lander, on the far side; its ascent stage left with the samples',
    operator: 'CNSA',
    landedUtc: '2024-06-01T22:23:00Z',
    latitudeDeg: -41.6385,
    longitudeDeg: 206.0148,
    source: 'LRO camera (LROC NAC), 2024-06-14, ±30 m',
  },
  {
    id: 'site-blue-ghost-1',
    name: 'Blue Ghost 1',
    host: 'moon',
    craft: 'Blue Ghost lander',
    operator: 'Firefly Aerospace, for NASA',
    landedUtc: '2025-03-02T08:34:00Z',
    latitudeDeg: 18.5623,
    longitudeDeg: 61.8103,
    source: 'LRO camera (LROC NAC), 2025-03-07',
  },

  // Mars.
  {
    id: 'site-viking-1',
    name: 'Viking 1 Lander',
    host: 'mars',
    craft: 'Viking 1 lander',
    operator: 'NASA',
    landedUtc: '1976-07-20T11:53:06Z',
    latitudeDeg: 22.2692,
    longitudeDeg: 312.0495,
    source: HIRISE_TABLE,
  },
  {
    id: 'site-viking-2',
    name: 'Viking 2 Lander',
    host: 'mars',
    craft: 'Viking 2 lander',
    operator: 'NASA',
    landedUtc: '1976-09-03T22:58:20Z',
    latitudeDeg: 47.6673,
    longitudeDeg: 134.2809,
    source: 'NASA NSSDCA catalogue',
    note: 'Frame and method not stated by the source',
  },
  {
    id: 'site-mars-pathfinder',
    name: 'Mars Pathfinder',
    host: 'mars',
    craft: 'Lander; Sojourner nearby',
    operator: 'NASA',
    landedUtc: '1997-07-04T16:56:55Z',
    latitudeDeg: 19.0979,
    longitudeDeg: 326.7471,
    source: HIRISE_TABLE,
  },
  {
    id: 'site-spirit',
    name: 'Spirit',
    host: 'mars',
    craft: 'Spirit rover, at Troy',
    operator: 'NASA',
    landedUtc: '2004-01-04T04:35:00Z',
    latitudeDeg: -14.6076,
    longitudeDeg: 175.529,
    source: 'HiRISE landing point + NASA’s traverse',
    note: 'Stuck from 2009; last heard 2010-03-22. Computed here',
  },
  {
    id: 'site-opportunity',
    name: 'Opportunity',
    host: 'mars',
    craft: 'Opportunity rover, at its last stop',
    operator: 'NASA',
    landedUtc: '2004-01-25T05:05:00Z',
    latitudeDeg: -2.3344,
    longitudeDeg: 354.651,
    source: 'HiRISE landing point + NASA’s traverse',
    note: 'Last drive sol 5081; last heard 2018-06-10. Computed here',
  },
  {
    id: 'site-phoenix',
    name: 'Phoenix',
    host: 'mars',
    craft: 'Phoenix lander',
    operator: 'NASA',
    landedUtc: '2008-05-25T23:38:24Z',
    latitudeDeg: 68.2188,
    longitudeDeg: 234.2508,
    source: 'Phoenix Analyst’s Notebook (IAU 2000)',
  },
  {
    id: 'site-tianwen-1',
    name: 'Tianwen-1 Lander',
    host: 'mars',
    craft: 'Lander; Zhurong drove south from it',
    operator: 'CNSA',
    landedUtc: '2021-05-14T23:18:00Z',
    latitudeDeg: 25.066,
    longitudeDeg: 109.925,
    source: 'Wan et al. 2021: orbit, descent and rover images',
    note: 'Zhurong’s last stop (2022) is not published as coordinates',
  },
];

/** The body's radius on the screen, px, from which its sites start to show, and from which they are whole. */
export const SHOWN_FROM_PX = 90;
export const SHOWN_FULL_PX = 180;

/**
 * How far a site may sit past the camera's horizon before it is gone, as the cosine between
 * its up and the direction to the camera: a fade across about three degrees of arc.
 */
const HORIZON_FADE = 0.05;

const SITE_COLOR = '#d8c890';

const sites = new Map<BodyId, LandingSite>(LANDING_SITES.map((site) => [site.id, site]));

export function landingSiteOf(id: BodyId | null): LandingSite | null {
  return id === null ? null : (sites.get(id) ?? null);
}

export function isLandingSite(id: BodyId): boolean {
  return sites.has(id);
}

/** Latitude and east longitude as the panels write them. */
export function formatSiteCoordinates(latitudeDeg: number, longitudeDeg: number): string {
  const east = ((longitudeDeg % 360) + 360) % 360;
  return `${Math.abs(latitudeDeg).toFixed(4)}° ${latitudeDeg < 0 ? 'S' : 'N'}, ${east.toFixed(4)}° E`;
}

const HOST_NAMES: Readonly<Record<LandingHost, string>> = { moon: 'Moon', mars: 'Mars' };

/** A site's region: its panel rows, every number with its source. */
export function landingSiteRegion(site: LandingSite): Region {
  return {
    id: site.id,
    name: site.name,
    layer: 'landing-site',
    kindLabel: `Landing site · ${HOST_NAMES[site.host]}`,
    measured: true,
    facts: [
      { label: 'There', value: site.craft },
      { label: 'Operator', value: site.operator },
      { label: 'Landed', value: site.landedUtc.slice(0, 10) },
      { label: 'Stands at', value: formatSiteCoordinates(site.latitudeDeg, site.longitudeDeg) },
      { label: 'Position', value: site.source },
      ...(site.note === undefined ? [] : [{ label: 'Note', value: site.note }]),
    ],
    framingKm: framingKm(site.host),
    parent: site.host,
    color: SITE_COLOR,
  };
}

/** From straight above, high enough to see the ground about it to the horizon on each side. */
function framingKm(host: LandingHost): number {
  return host === 'moon' ? 3_000 : 6_000;
}

/** Touchdown as a Julian day, TDB to within the 69 s that do not matter to a site. */
export function landingJd(site: LandingSite): number {
  return Date.parse(site.landedUtc) / 86_400_000 + 2440587.5;
}

/** Where the ground at a site is, about its host's centre, at `jd`. */
export function landingSiteState(store: EphemerisStore, site: LandingSite, jd: number): StateVector {
  return surfaceState(store.body(site.host), site.latitudeDeg, site.longitudeDeg, jd);
}

let now: (() => number) | null = null;
let framingStore: EphemerisStore | null = null;

/**
 * The sites made bodies, each about its host, from its landing on. `currentJd` is the clock,
 * for the framing (landingSiteFraming), which looks down on a site where it is now.
 */
export function ensureLandingSites(store: EphemerisStore, currentJd: () => number): void {
  now = currentJd;
  framingStore = store;
  const missing = LANDING_SITES.filter(
    (site) => store.tree.has(site.host) && !store.isPropagatedBody(site.id),
  );
  if (missing.length === 0) return;
  for (const site of missing) registerRegion(landingSiteRegion(site));
  store.addPropagatedBodies(
    missing.map((site) => ({
      body: regionDefinition(regionOf(site.id)!),
      elements: null,
      state: (jd: number): StateVector => landingSiteState(store, site, jd),
      options: {
        aboutParent: true,
        exact: true,
        coverage: { startJd: landingJd(site), stopJd: Number.POSITIVE_INFINITY },
      },
    })),
  );
}

/**
 * A site's framing: from straight above it, north up the screen, at the instant it is chosen.
 * Null for anything that is not a site, or before ensureLandingSites.
 */
export function landingSiteFraming(id: BodyId): FramingRequest | null {
  const site = landingSiteOf(id);
  if (site === null || now === null || framingStore === null) {
    return null;
  }
  const frame = surfaceFrame(framingStore.body(site.host), site.latitudeDeg, site.longitudeDeg, now());
  return {
    km: framingKm(site.host),
    view: {
      direction: [frame.up.x, frame.up.y, frame.up.z],
      up: [frame.north.x, frame.north.y, frame.north.z],
    },
  };
}

/** 0 at or below `none`, 1 at or above `full`, smooth between. */
function smoothRamp(value: number, none: number, full: number): number {
  const t = Math.min(1, Math.max(0, (value - none) / (full - none)));
  return t * t * (3 - 2 * t);
}

/**
 * How much of a site's mark and name to show, 1 to 0: its host large on the screen, and the
 * site on the side of it the camera sees. Positions in km, in one frame.
 */
export function landingSiteVisibility(
  hostKm: Vec3,
  siteKm: Vec3,
  hostRadiusKm: number,
  cameraKm: Vec3,
  viewportHeightPx: number,
  fovDeg: number,
): number {
  const hostPx = angularRadiusPixels(
    hostRadiusKm,
    distance(cameraKm, hostKm),
    viewportHeightPx,
    fovDeg,
  );
  const size = smoothRamp(hostPx, SHOWN_FROM_PX, SHOWN_FULL_PX);
  if (size === 0) {
    return 0;
  }
  const up = subtract(siteKm, hostKm);
  const toCamera = subtract(cameraKm, siteKm);
  const upLength = length(up);
  const cameraDistance = length(toCamera);
  if (upLength === 0 || cameraDistance === 0) {
    return size;
  }
  const facing = dot(up, toCamera) / (upLength * cameraDistance);
  return size * smoothRamp(facing, 0, HORIZON_FADE);
}
