import type { BodyId } from '@sss/tools/types';

import { equatorialToEcliptic } from '../scene/orientation.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { registerRegion, regionDefinition, regionOf, type Region, type RegionFact } from './regions.ts';
import { add, normalize, scale, vec3, type StateVector, type Vec3 } from './vec3.ts';

/**
 * The major annual meteor showers: where Earth crosses each one's stream of dust, and the stream
 * there, computed from its radiant and speed.
 *
 * **What is measured.** Each shower's radiant (the point on the sky its meteors seem to come
 * from), its activity period, the solar longitude of its maximum and its zenithal hourly rate are
 * the International Meteor Organization's Working List of Visual Meteor Showers, Table 5 of its
 * 2026 Meteor Shower Calendar (Rendtel, ed., IMO INFO(3-25)): radiants J2000 at the maximum, rates
 * from recent returns. The geocentric speed -- outside Earth's pull -- and the parent body are the
 * IAU Meteor Data Center's established-shower list (streamestablisheddata2026, updated 2026-11-10;
 * Jenniskens et al. 2020, PSS 182, 104821): the speed the median of its published solutions for
 * the shower, the parent its "Origin" column. Every shower here is "established" there.
 *
 * **What is computed.** Solar longitude -- the Sun's ecliptic longitude, J2000, the calendar a
 * shower keeps from year to year -- from Meeus's low-precision Sun (Astronomical Algorithms ch. 25,
 * 0.01 degrees, a quarter of an hour). The crossing is where Earth is at the maximum's solar
 * longitude, the one nearest the clock: a point on Earth's orbit, made a body. The stream's mean
 * orbit is the heliocentric conic through that point with Earth's velocity plus the meteoroids'
 * geocentric one -- the geocentric speed, away from the radiant -- drawn only near the crossing
 * (scene/MeteorShowers.tsx). A real stream is a braid of filaments of many ages, spread for weeks of
 * Earth's path; the line is its mean.
 */

const DEG = Math.PI / 180;

export interface MeteorShower {
  readonly id: BodyId;
  readonly name: string;
  /** The IAU's three letters and number: "007 PER". */
  readonly iau: string;
  /** IMO Table 5: the first and last day of activity, and the maximum, month and day. */
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly peak: readonly [number, number];
  /** Solar longitude of the maximum, J2000, degrees. */
  readonly peakSolarLongitudeDeg: number;
  /** The radiant at the maximum, J2000, degrees. */
  readonly radiantRaDeg: number;
  readonly radiantDecDeg: number;
  /** Zenithal hourly rate at the maximum; null where IMO lists it as variable. */
  readonly zhr: number | null;
  /** IAU MDC: geocentric speed, km/s, the median of its solutions. */
  readonly geocentricKmS: number;
  /** IAU MDC: the parent body, as its Origin column names it. */
  readonly parent: string;
  /** The parent as a body in this app, if it is one. */
  readonly parentBody: BodyId | null;
}

/** The IMO list's dates read for 2026, the year its maxima are given for. */
const TABLE_YEAR = 2026;

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  {
    id: 'shower-quadrantids', name: 'Quadrantids', iau: '010 QUA',
    start: [12, 28], end: [1, 12], peak: [1, 3], peakSolarLongitudeDeg: 283.15,
    radiantRaDeg: 230, radiantDecDeg: 49, zhr: 80, geocentricKmS: 40.95,
    parent: '(196256) 2003 EH1', parentBody: null,
  },
  {
    id: 'shower-lyrids', name: 'April Lyrids', iau: '006 LYR',
    start: [4, 14], end: [4, 30], peak: [4, 22], peakSolarLongitudeDeg: 32.32,
    radiantRaDeg: 271, radiantDecDeg: 34, zhr: 18, geocentricKmS: 46.8,
    parent: 'C/1861 G1 (Thatcher)', parentBody: null,
  },
  {
    id: 'shower-eta-aquariids', name: 'Eta Aquariids', iau: '031 ETA',
    start: [4, 19], end: [5, 28], peak: [5, 6], peakSolarLongitudeDeg: 45.5,
    radiantRaDeg: 338, radiantDecDeg: -1, zhr: 50, geocentricKmS: 65.8,
    parent: '1P/Halley', parentBody: '1p-halley',
  },
  {
    id: 'shower-southern-delta-aquariids', name: 'Southern Delta Aquariids', iau: '005 SDA',
    start: [7, 12], end: [8, 23], peak: [7, 31], peakSolarLongitudeDeg: 128,
    radiantRaDeg: 340, radiantDecDeg: -16, zhr: 25, geocentricKmS: 40.7,
    parent: '342P/SOHO, of the Marsden group (proposed)', parentBody: null,
  },
  {
    id: 'shower-alpha-capricornids', name: 'Alpha Capricornids', iau: '001 CAP',
    start: [7, 3], end: [8, 15], peak: [7, 31], peakSolarLongitudeDeg: 128,
    radiantRaDeg: 307, radiantDecDeg: -10, zhr: 5, geocentricKmS: 22.65,
    parent: '169P/NEAT', parentBody: null,
  },
  {
    id: 'shower-perseids', name: 'Perseids', iau: '007 PER',
    start: [7, 17], end: [8, 24], peak: [8, 13], peakSolarLongitudeDeg: 140.0,
    radiantRaDeg: 48, radiantDecDeg: 58, zhr: 100, geocentricKmS: 59.1,
    parent: '109P/Swift-Tuttle', parentBody: '109p-swift-tuttle',
  },
  {
    id: 'shower-draconids', name: 'October Draconids', iau: '009 DRA',
    start: [10, 6], end: [10, 10], peak: [10, 9], peakSolarLongitudeDeg: 195.4,
    radiantRaDeg: 262, radiantDecDeg: 54, zhr: 5, geocentricKmS: 19.7,
    parent: '21P/Giacobini-Zinner', parentBody: '21p-giacobini-zinner',
  },
  {
    id: 'shower-orionids', name: 'Orionids', iau: '008 ORI',
    start: [10, 2], end: [11, 7], peak: [10, 21], peakSolarLongitudeDeg: 208,
    radiantRaDeg: 95, radiantDecDeg: 16, zhr: 20, geocentricKmS: 66.3,
    parent: '1P/Halley', parentBody: '1p-halley',
  },
  {
    id: 'shower-southern-taurids', name: 'Southern Taurids', iau: '002 STA',
    start: [9, 20], end: [11, 20], peak: [11, 5], peakSolarLongitudeDeg: 223,
    radiantRaDeg: 52, radiantDecDeg: 15, zhr: 7, geocentricKmS: 27.8,
    parent: '2P/Encke', parentBody: '2p-encke',
  },
  {
    id: 'shower-northern-taurids', name: 'Northern Taurids', iau: '017 NTA',
    start: [10, 20], end: [12, 10], peak: [11, 12], peakSolarLongitudeDeg: 230,
    radiantRaDeg: 58, radiantDecDeg: 22, zhr: 5, geocentricKmS: 28.15,
    parent: '2P/Encke; also 2004 TG10', parentBody: '2p-encke',
  },
  {
    id: 'shower-leonids', name: 'Leonids', iau: '013 LEO',
    start: [11, 6], end: [11, 30], peak: [11, 17], peakSolarLongitudeDeg: 235.27,
    radiantRaDeg: 152, radiantDecDeg: 22, zhr: 15, geocentricKmS: 70.28,
    parent: '55P/Tempel-Tuttle', parentBody: '55p-tempel-tuttle',
  },
  {
    id: 'shower-geminids', name: 'Geminids', iau: '004 GEM',
    start: [12, 4], end: [12, 20], peak: [12, 14], peakSolarLongitudeDeg: 262.2,
    radiantRaDeg: 112, radiantDecDeg: 33, zhr: 150, geocentricKmS: 34.5,
    parent: '(3200) Phaethon, an asteroid', parentBody: null,
  },
  {
    id: 'shower-ursids', name: 'Ursids', iau: '015 URS',
    start: [12, 17], end: [12, 26], peak: [12, 22], peakSolarLongitudeDeg: 270.7,
    radiantRaDeg: 217, radiantDecDeg: 76, zhr: 10, geocentricKmS: 33.2,
    parent: '8P/Tuttle', parentBody: null,
  },
];

const BY_ID = new Map(METEOR_SHOWERS.map((shower) => [shower.id, shower] as const));

export function meteorShowerOf(id: BodyId | null): MeteorShower | null {
  return id === null ? null : (BY_ID.get(id) ?? null);
}

// --- Solar longitude ---------------------------------------------------------------------------

/** The Sun's mean motion in longitude, degrees a day: Meeus 25.2's 36000.76983 per century. */
const SUN_DEG_PER_DAY = 36000.76983 / 36525;

function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** An angle brought into (-180, 180]. */
function wrap180(deg: number): number {
  const w = wrap360(deg);
  return w > 180 ? w - 360 : w;
}

/**
 * The Sun's true geometric longitude, referred to the mean equinox of the date, degrees: Meeus,
 * Astronomical Algorithms (2nd ed.), 25.2 to 25.4, good to 0.01 degree.
 */
export function sunTrueLongitudeOfDate(jd: number): number {
  const t = (jd - 2451545.0) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * DEG;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m);
  return wrap360(l0 + c);
}

/**
 * Solar longitude, J2000, degrees: the date's longitude carried back to the J2000 equinox with
 * Meeus's 0.01397 degrees a year of precession (ch. 25), the frame meteor work gives it in.
 */
export function solarLongitude(jd: number): number {
  const years = (jd - 2451545.0) / 365.25;
  return wrap360(sunTrueLongitudeOfDate(jd) - 0.01397 * years);
}

/** The instant, nearest `nearJd`, at which the solar longitude is `longitudeDeg`. */
export function jdOfSolarLongitude(longitudeDeg: number, nearJd: number): number {
  let jd = nearJd + wrap180(longitudeDeg - solarLongitude(nearJd)) / SUN_DEG_PER_DAY;
  for (let k = 0; k < 3; k += 1) {
    jd += wrap180(longitudeDeg - solarLongitude(jd)) / SUN_DEG_PER_DAY;
  }
  return jd;
}

/** Julian day of 0h UT on a calendar day (Gregorian). */
function calendarJd(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 86_400_000 + 2440587.5;
}

/** A day of the IMO table, read in 2026, as a solar longitude. */
function tableSolarLongitude([month, day]: readonly [number, number]): number {
  return solarLongitude(calendarJd(TABLE_YEAR, month, day));
}

/** The solar longitudes a shower is active between, start and end. */
export function activeArc(shower: MeteorShower): { readonly fromDeg: number; readonly toDeg: number } {
  return { fromDeg: tableSolarLongitude(shower.start), toDeg: tableSolarLongitude(shower.end) };
}

/** Whether Earth is in the shower's stream at `jd`: inside its IMO activity period, any year. */
export function isActive(shower: MeteorShower, jd: number): boolean {
  const { fromDeg, toDeg } = activeArc(shower);
  return wrap360(solarLongitude(jd) - fromDeg) <= wrap360(toDeg - fromDeg);
}

/** The shower's maximum nearest `jd`: within half a year either side. */
export function peakJdNear(shower: MeteorShower, jd: number): number {
  return jdOfSolarLongitude(shower.peakSolarLongitudeDeg, jd);
}

// --- The stream --------------------------------------------------------------------------------

/** The radiant as a unit vector in the scene's frame, ecliptic J2000. */
export function radiantDirection(shower: MeteorShower): Vec3 {
  const ra = shower.radiantRaDeg * DEG;
  const dec = shower.radiantDecDeg * DEG;
  return equatorialToEcliptic(vec3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)));
}

/**
 * The meteoroids' heliocentric state where Earth meets them: Earth's place, and Earth's velocity
 * plus theirs relative to it -- the geocentric speed, travelling away from the radiant. `earth` is
 * Earth's heliocentric state at the maximum, km and km/s.
 */
export function streamState(shower: MeteorShower, earth: StateVector): StateVector {
  return {
    position: earth.position,
    velocity: add(earth.velocity, scale(radiantDirection(shower), -shower.geocentricKmS)),
  };
}

// --- The bodies --------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatDay([month, day]: readonly [number, number]): string {
  return `${MONTHS[month - 1]} ${day}`;
}

function formatRa(deg: number): string {
  const hours = deg / 15;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 60 ? `${h + 1}h 00m` : `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDec(deg: number): string {
  return `${deg < 0 ? '−' : '+'}${Math.abs(deg)}°`;
}

/** "Active · maximum in 3 days", "Active · maximum 2 days ago", "Next active Jul 17". */
export function showerNow(shower: MeteorShower, jd: number): string {
  if (isActive(shower, jd)) {
    const days = Math.round(peakJdNear(shower, jd) - jd);
    if (days === 0) return 'Active · at its maximum';
    const unit = Math.abs(days) === 1 ? 'day' : 'days';
    return days > 0 ? `Active · maximum in ${days} ${unit}` : `Active · maximum ${-days} ${unit} ago`;
  }
  const { fromDeg } = activeArc(shower);
  const startJd = jd + wrap360(fromDeg - solarLongitude(jd)) / SUN_DEG_PER_DAY;
  const start = new Date((jdOfSolarLongitude(fromDeg, startJd) - 2440587.5) * 86_400_000);
  return `Next active ${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
}

const SHOWER_COLOR = '#e0b878';

/** The body's framing: far enough out to see the stream's arc across Earth's orbit. */
const SHOWER_FRAMING_KM = 0.35 * 149_597_870.7;

export function meteorShowerRegion(shower: MeteorShower): Region {
  const facts: RegionFact[] = [
    { label: 'Radiant', value: `${formatRa(shower.radiantRaDeg)} ${formatDec(shower.radiantDecDeg)} (J2000)` },
    { label: 'Active', value: `${formatDay(shower.start)} – ${formatDay(shower.end)}` },
    { label: 'Maximum', value: `${formatDay(shower.peak)} · solar longitude ${shower.peakSolarLongitudeDeg}°` },
    { label: 'Rate', value: shower.zhr === null ? 'Variable' : `${shower.zhr} an hour at the zenith (ZHR)` },
    { label: 'Speed', value: `${shower.geocentricKmS.toFixed(1)} km/s, before Earth’s pull` },
    { label: 'Parent', value: shower.parent },
    { label: 'IAU', value: shower.iau },
    { label: 'Data', value: 'IMO 2026 calendar; IAU Meteor Data Center' },
    { label: 'Drawn', value: 'Where Earth crosses it at the maximum; its mean orbit, computed' },
  ];
  return {
    id: shower.id,
    name: shower.name,
    layer: 'meteor-shower',
    kindLabel: 'Meteor shower · crossing',
    measured: true,
    facts,
    liveFacts: (jd) => [{ label: 'Now', value: showerNow(shower, jd) }],
    framingKm: SHOWER_FRAMING_KM,
    parent: null,
    color: SHOWER_COLOR,
  };
}

/** Earth's heliocentric state at the shower's maximum nearest `jd`; null without Earth. */
export function crossingState(store: EphemerisStore, shower: MeteorShower, jd: number): StateVector | null {
  return store.stateRelativeTo('earth', 'sun', peakJdNear(shower, jd));
}

/** Each shower's crossing made a body about the Sun: where Earth is at its maximum, this year. */
export function ensureMeteorShowers(store: EphemerisStore): void {
  if (!store.tree.has('earth') || !store.tree.has('sun')) return;
  const missing = METEOR_SHOWERS.filter((shower) => !store.isPropagatedBody(shower.id));
  if (missing.length === 0) return;
  for (const shower of missing) registerRegion(meteorShowerRegion(shower));
  store.addPropagatedBodies(
    missing.map((shower) => ({
      body: regionDefinition(regionOf(shower.id)!),
      elements: null,
      state: (jd: number): StateVector | null => {
        const earth = crossingState(store, shower, jd);
        return earth === null ? null : { position: earth.position, velocity: { x: 0, y: 0, z: 0 } };
      },
      options: { exact: true },
    })),
  );
}

/** Unit vector, for tests and the scene: the meteoroids' direction of travel at the crossing. */
export function streamDirection(shower: MeteorShower, earth: StateVector): Vec3 {
  return normalize(streamState(shower, earth).velocity);
}

/**
 * The stream's path either side of the crossing, `halfSpanDays` back and forward along the Sun's
 * two-body pull, every `stepDays`: positions about the Sun, km, oldest first. Integrated (RK4)
 * rather than read off a conic, because a mean radiant and speed can leave a stream from a
 * near-parabolic comet -- the Lyrids', of Thatcher's 415-year orbit -- just unbound, where an
 * ellipse's formula has nothing to say.
 */
export function streamPath(start: StateVector, gmKm3S2: number, halfSpanDays: number, stepDays: number): Vec3[] {
  const steps = Math.round(halfSpanDays / stepDays);
  const h = stepDays * 86_400;
  const accel = (p: Vec3): Vec3 => {
    const r = Math.hypot(p.x, p.y, p.z);
    return scale(p, -gmKm3S2 / (r * r * r));
  };
  const leg = (sign: 1 | -1): Vec3[] => {
    let p = start.position;
    let v = start.velocity;
    const dt = sign * h;
    const out: Vec3[] = [];
    for (let k = 0; k < steps; k += 1) {
      const a1 = accel(p);
      const p2 = add(p, scale(v, dt / 2));
      const v2 = add(v, scale(a1, dt / 2));
      const a2 = accel(p2);
      const p3 = add(p, scale(v2, dt / 2));
      const v3 = add(v, scale(a2, dt / 2));
      const a3 = accel(p3);
      const p4 = add(p, scale(v3, dt));
      const v4 = add(v, scale(a3, dt));
      const a4 = accel(p4);
      p = add(p, scale(add(add(v, scale(add(v2, v3), 2)), v4), dt / 6));
      v = add(v, scale(add(add(a1, scale(add(a2, a3), 2)), a4), dt / 6));
      out.push(p);
    }
    return out;
  };
  return [...leg(-1).reverse(), start.position, ...leg(1)];
}
