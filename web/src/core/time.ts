/**
 * Time scales.
 *
 * Horizons timestamps ephemerides in TDB (Barycentric Dynamical Time), but a clock
 * on a wall shows UTC. Getting between them takes two steps, and skipping either one
 * puts every planet in the wrong place:
 *
 *   UTC --(leap seconds)--> TAI --(+32.184 s)--> TT --(periodic term)--> TDB
 *
 * The offset is about 69.2 s in 2026. Earth moves 30 km/s, so ignoring it would
 * misplace Earth by ~2000 km — sixty thousand times our interpolation error, and a
 * third of Earth's own radius. The TDB-TT term is only ±1.7 ms (±50 m for Earth),
 * but it costs three lines and this project does not round off physics.
 */

/** Unix epoch (1970-01-01T00:00:00Z) as a Julian day number. */
const UNIX_EPOCH_JD = 2440587.5;

/** J2000.0: 2000-01-01T12:00:00 TT, the reference epoch for the ephemerides. */
export const J2000_JD = 2451545.0;

export const MS_PER_DAY = 86_400_000;
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_JULIAN_YEAR = 365.25;

/** TT runs a constant 32.184 s ahead of TAI, by definition. */
const TT_MINUS_TAI_SECONDS = 32.184;

/**
 * TAI - UTC, in seconds, from each leap second introduction.
 *
 * Entries are [UTC Julian day the step took effect, cumulative offset]. The last
 * leap second was inserted at the end of 2016; the CGPM voted in 2022 to stop
 * inserting them by 2035, so 37 s is expected to hold for the life of this project.
 * The full table is here so historical dates come out right when scrubbing back.
 */
export const LEAP_SECONDS: readonly (readonly [number, number])[] = [
  [2441317.5, 10], // 1972-01-01
  [2441499.5, 11], // 1972-07-01
  [2441683.5, 12], // 1973-01-01
  [2442048.5, 13], // 1974-01-01
  [2442413.5, 14], // 1975-01-01
  [2442778.5, 15], // 1976-01-01
  [2443144.5, 16], // 1977-01-01
  [2443509.5, 17], // 1978-01-01
  [2443874.5, 18], // 1979-01-01
  [2444239.5, 19], // 1980-01-01
  [2444786.5, 20], // 1981-07-01
  [2445151.5, 21], // 1982-07-01
  [2445516.5, 22], // 1983-07-01
  [2446247.5, 23], // 1985-07-01
  [2447161.5, 24], // 1988-01-01
  [2447892.5, 25], // 1990-01-01
  [2448257.5, 26], // 1991-01-01
  [2448804.5, 27], // 1992-07-01
  [2449169.5, 28], // 1993-07-01
  [2449534.5, 29], // 1994-07-01
  [2450083.5, 30], // 1996-01-01
  [2450630.5, 31], // 1997-07-01
  [2451179.5, 32], // 1999-01-01
  [2453736.5, 33], // 2006-01-01
  [2454832.5, 34], // 2009-01-01
  [2456109.5, 35], // 2012-07-01
  [2457204.5, 36], // 2015-07-01
  [2457754.5, 37], // 2017-01-01
];

/**
 * TAI - UTC for a given UTC instant.
 *
 * Before 1972 the relationship was a rubber-sheet rate offset rather than integer
 * steps; we return the 1972 value, which is what any date that old deserves in a
 * Solar System viewer.
 */
export function taiMinusUtc(utcJd: number): number {
  let offset = 10;
  for (const entry of LEAP_SECONDS) {
    if (utcJd >= entry[0]) {
      offset = entry[1];
    } else {
      break;
    }
  }
  return offset;
}

/**
 * TDB - TT, in seconds.
 *
 * Both are relativistic time scales that differ only by periodic terms from Earth's
 * motion through the Sun's gravity well. The dominant annual term is enough: the
 * remainder is under a microsecond. Formula from the IAU/Fairhead-Bretagnon series,
 * truncated to its two leading terms.
 */
export function tdbMinusTt(ttJd: number): number {
  const centuriesSinceJ2000 = (ttJd - J2000_JD) / 36525;
  // Mean anomaly of the Earth-Moon barycenter's orbit about the Sun.
  const g = (357.53 + 35999.05 * centuriesSinceJ2000) * (Math.PI / 180);
  return 0.001658 * Math.sin(g) + 0.000014 * Math.sin(2 * g);
}

/** Converts a JavaScript Date (which is UTC) to a Julian day number. */
export function dateToJulianDay(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/**
 * Converts a Julian day number to a JavaScript Date.
 *
 * Rounds to the nearest millisecond: Date has no finer resolution, and the division
 * that produced the Julian day leaves a sub-millisecond residue that would otherwise
 * be truncated downward, losing a millisecond on the round trip.
 */
export function julianDayToDate(jd: number): Date {
  return new Date(Math.round((jd - UNIX_EPOCH_JD) * MS_PER_DAY));
}

/**
 * UTC Julian day to TDB Julian day: the conversion every ephemeris lookup needs.
 */
export function utcToTdb(utcJd: number): number {
  const ttJd = utcJd + (taiMinusUtc(utcJd) + TT_MINUS_TAI_SECONDS) / SECONDS_PER_DAY;
  return ttJd + tdbMinusTt(ttJd) / SECONDS_PER_DAY;
}

/**
 * TDB Julian day back to UTC Julian day.
 *
 * The leap-second lookup wants UTC, which is what we are solving for, so iterate.
 * Two passes converge to well under a microsecond; the loop only matters within a
 * minute of a leap second boundary.
 */
export function tdbToUtc(tdbJd: number): number {
  let utcJd = tdbJd;
  for (let i = 0; i < 3; i += 1) {
    utcJd = tdbJd - (utcToTdb(utcJd) - utcJd);
  }
  return utcJd;
}

/** Converts a Date directly to the TDB Julian day the ephemerides are indexed by. */
export function dateToTdb(date: Date): number {
  return utcToTdb(dateToJulianDay(date));
}

/** How the simulation clock is advancing. */
export type ClockMode = 'live' | 'paused' | 'warp';

/** Named time-warp rates, in simulated seconds per real second. */
export const WARP_RATES = {
  realTime: 1,
  minutePerSecond: 60,
  hourPerSecond: 3_600,
  dayPerSecond: 86_400,
  weekPerSecond: 604_800,
  monthPerSecond: 2_629_800,
  yearPerSecond: 31_557_600,
} as const;

/**
 * The simulation clock.
 *
 * In `live` mode it reads the wall clock every tick, so it never drifts from real
 * time. In `warp` it integrates its own time at `rate`, which may be negative to run
 * the Solar System backwards.
 */
export class SimClock {
  #mode: ClockMode = 'live';
  #rate = 1;
  /** Simulated time, as milliseconds since the Unix epoch (UTC). */
  #epochMs: number;

  constructor(now: Date = new Date()) {
    this.#epochMs = now.getTime();
  }

  get mode(): ClockMode {
    return this.#mode;
  }

  get rate(): number {
    return this.#rate;
  }

  /** True only while the clock is locked to real time — what lights the LIVE dot. */
  get isLive(): boolean {
    return this.#mode === 'live';
  }

  /** Current simulated instant, as a UTC Date. */
  get date(): Date {
    return new Date(this.#epochMs);
  }

  /** Current simulated instant as a TDB Julian day, ready for an ephemeris lookup. */
  get tdbJulianDay(): number {
    return utcToTdb(this.#epochMs / MS_PER_DAY + UNIX_EPOCH_JD);
  }

  /** Snaps back to real time and keeps tracking it. */
  goLive(now: Date = new Date()): void {
    this.#mode = 'live';
    this.#rate = 1;
    this.#epochMs = now.getTime();
  }

  pause(): void {
    this.#mode = 'paused';
  }

  /** Runs at `rate` simulated seconds per real second; negative runs backwards. */
  setRate(rate: number): void {
    this.#rate = rate;
    this.#mode = rate === 0 ? 'paused' : 'warp';
  }

  /** Jumps to an arbitrary instant, which necessarily leaves live mode. */
  setDate(date: Date): void {
    this.#epochMs = date.getTime();
    if (this.#mode === 'live') {
      this.#mode = 'paused';
    }
  }

  /**
   * Advances the clock by one frame.
   *
   * `deltaSeconds` is real elapsed time, which the caller takes from the render loop.
   */
  tick(deltaSeconds: number, now: Date = new Date()): void {
    switch (this.#mode) {
      case 'live':
        this.#epochMs = now.getTime();
        break;
      case 'warp':
        this.#epochMs += deltaSeconds * this.#rate * 1000;
        break;
      case 'paused':
        break;
    }
  }
}
