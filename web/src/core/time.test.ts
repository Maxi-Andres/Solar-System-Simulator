import { describe, expect, it } from 'vitest';

import {
  dateToJulianDay,
  dateToTdb,
  J2000_JD,
  julianDayToDate,
  SimClock,
  taiMinusUtc,
  tdbMinusTt,
  tdbToUtc,
  utcToTdb,
  LEAP_SECONDS,
  WARP_RATES,
} from './time.ts';

const SECONDS_PER_DAY = 86_400;

describe('Julian day conversion', () => {
  it('places the Unix epoch at its known Julian day', () => {
    expect(dateToJulianDay(new Date('1970-01-01T00:00:00Z'))).toBe(2440587.5);
  });

  it('places J2000.0 at noon on 2000-01-01', () => {
    // J2000 is defined in TT, so the UTC instant is 64.184 s earlier. Checking the
    // UTC noon value confirms the day number itself is right.
    expect(dateToJulianDay(new Date('2000-01-01T12:00:00Z'))).toBe(J2000_JD);
  });

  it('round-trips a date through Julian day', () => {
    const original = new Date('2026-08-24T15:47:23.456Z');
    const roundTripped = julianDayToDate(dateToJulianDay(original));

    expect(roundTripped.toISOString()).toBe(original.toISOString());
  });

  it('advances exactly one day per unit', () => {
    const a = dateToJulianDay(new Date('2026-03-01T00:00:00Z'));
    const b = dateToJulianDay(new Date('2026-03-02T00:00:00Z'));

    expect(b - a).toBe(1);
  });
});

describe('leap seconds', () => {
  it('returns 37 s for the current era', () => {
    expect(taiMinusUtc(dateToJulianDay(new Date('2026-08-24T00:00:00Z')))).toBe(37);
  });

  it('steps at each historical introduction', () => {
    // The day before and the day of the 2017-01-01 leap second.
    expect(taiMinusUtc(dateToJulianDay(new Date('2016-12-31T00:00:00Z')))).toBe(36);
    expect(taiMinusUtc(dateToJulianDay(new Date('2017-01-01T00:00:00Z')))).toBe(37);
  });

  it('handles the first entry and dates before it', () => {
    expect(taiMinusUtc(dateToJulianDay(new Date('1972-01-01T00:00:00Z')))).toBe(10);
    expect(taiMinusUtc(dateToJulianDay(new Date('1960-01-01T00:00:00Z')))).toBe(10);
  });

  it('increases monotonically', () => {
    let previous = 0;
    for (let year = 1972; year <= 2030; year += 1) {
      const value = taiMinusUtc(dateToJulianDay(new Date(`${year}-06-15T00:00:00Z`)));
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('TDB', () => {
  it('runs about 69.2 s ahead of UTC in 2026', () => {
    const utcJd = dateToJulianDay(new Date('2026-08-24T00:00:00Z'));
    const offsetSeconds = (utcToTdb(utcJd) - utcJd) * SECONDS_PER_DAY;

    // 37 leap seconds + 32.184 s, plus a sub-2 ms periodic term.
    expect(offsetSeconds).toBeCloseTo(69.184, 2);
  });

  it('keeps the TDB-TT term inside its known +-1.7 ms envelope', () => {
    let largest = 0;
    for (let day = 0; day < 366; day += 1) {
      largest = Math.max(largest, Math.abs(tdbMinusTt(J2000_JD + day)));
    }

    expect(largest).toBeGreaterThan(0.0015);
    expect(largest).toBeLessThan(0.0017);
  });

  it('round-trips UTC through TDB and back', () => {
    for (const iso of ['1999-12-31T23:59:59Z', '2026-08-24T12:00:00Z', '2031-01-01T00:00:00Z']) {
      const utcJd = dateToJulianDay(new Date(iso));
      const recovered = tdbToUtc(utcToTdb(utcJd));

      // Within a microsecond, far tighter than any position depends on.
      expect(Math.abs(recovered - utcJd) * SECONDS_PER_DAY).toBeLessThan(1e-6);
    }
  });

  it('matters: 69 s of neglect would misplace Earth by ~2000 km', () => {
    const utcJd = dateToJulianDay(new Date('2026-08-24T00:00:00Z'));
    const offsetSeconds = (utcToTdb(utcJd) - utcJd) * SECONDS_PER_DAY;
    const earthSpeedKmPerSecond = 29.78;

    expect(offsetSeconds * earthSpeedKmPerSecond).toBeGreaterThan(2000);
  });

  it('converts a Date straight to TDB', () => {
    const date = new Date('2026-08-24T00:00:00Z');

    expect(dateToTdb(date)).toBe(utcToTdb(dateToJulianDay(date)));
  });
});

describe('SimClock', () => {
  it('starts live at the given instant', () => {
    const clock = new SimClock(new Date('2026-08-24T10:00:00Z'));

    expect(clock.isLive).toBe(true);
    expect(clock.mode).toBe('live');
    expect(clock.date.toISOString()).toBe('2026-08-24T10:00:00.000Z');
  });

  it('tracks the wall clock in live mode, ignoring the frame delta', () => {
    const clock = new SimClock(new Date('2026-08-24T10:00:00Z'));
    clock.tick(0.016, new Date('2026-08-24T10:00:05Z'));

    expect(clock.date.toISOString()).toBe('2026-08-24T10:00:05.000Z');
  });

  it('does not move while paused', () => {
    const clock = new SimClock(new Date('2026-08-24T10:00:00Z'));
    clock.pause();
    clock.tick(10, new Date('2026-08-24T11:00:00Z'));

    expect(clock.date.toISOString()).toBe('2026-08-24T10:00:00.000Z');
    expect(clock.isLive).toBe(false);
  });

  it('advances one year per second at the year warp rate', () => {
    const clock = new SimClock(new Date('2026-01-01T00:00:00Z'));
    clock.setRate(WARP_RATES.yearPerSecond);
    clock.tick(1);

    const elapsedDays = (clock.date.getTime() - Date.UTC(2026, 0, 1)) / 86_400_000;
    expect(elapsedDays).toBeCloseTo(365.25, 6);
  });

  it('runs backwards at a negative rate', () => {
    const clock = new SimClock(new Date('2026-08-24T10:00:00Z'));
    clock.setRate(-WARP_RATES.dayPerSecond);
    clock.tick(1);

    expect(clock.date.toISOString()).toBe('2026-08-23T10:00:00.000Z');
  });

  it('treats a zero rate as paused', () => {
    const clock = new SimClock();
    clock.setRate(0);

    expect(clock.mode).toBe('paused');
  });

  it('leaves live mode when jumping to a date, and returns on goLive', () => {
    const clock = new SimClock(new Date('2026-08-24T10:00:00Z'));

    clock.setDate(new Date('2030-01-01T00:00:00Z'));
    expect(clock.isLive).toBe(false);
    expect(clock.date.toISOString()).toBe('2030-01-01T00:00:00.000Z');

    clock.goLive(new Date('2026-08-24T10:00:30Z'));
    expect(clock.isLive).toBe(true);
    expect(clock.rate).toBe(1);
    expect(clock.date.toISOString()).toBe('2026-08-24T10:00:30.000Z');
  });

  it('reports TDB for ephemeris lookups, not UTC', () => {
    const clock = new SimClock(new Date('2026-08-24T00:00:00Z'));
    const utcJd = dateToJulianDay(new Date('2026-08-24T00:00:00Z'));

    expect(clock.tdbJulianDay).toBeGreaterThan(utcJd);
    expect(clock.tdbJulianDay).toBe(utcToTdb(utcJd));
  });
});

describe('LEAP_SECONDS table', () => {
  // Two entries were originally transcribed with the wrong Julian day, which put the
  // 2015 and 2017 steps years off. Deriving the expected days from the dates catches
  // that class of typo instead of trusting hand-written numbers.
  const INTRODUCTIONS: readonly (readonly [string, number])[] = [
    ['1972-01-01', 10], ['1972-07-01', 11], ['1973-01-01', 12], ['1974-01-01', 13],
    ['1975-01-01', 14], ['1976-01-01', 15], ['1977-01-01', 16], ['1978-01-01', 17],
    ['1979-01-01', 18], ['1980-01-01', 19], ['1981-07-01', 20], ['1982-07-01', 21],
    ['1983-07-01', 22], ['1985-07-01', 23], ['1988-01-01', 24], ['1990-01-01', 25],
    ['1991-01-01', 26], ['1992-07-01', 27], ['1993-07-01', 28], ['1994-07-01', 29],
    ['1996-01-01', 30], ['1997-07-01', 31], ['1999-01-01', 32], ['2006-01-01', 33],
    ['2009-01-01', 34], ['2012-07-01', 35], ['2015-07-01', 36], ['2017-01-01', 37],
  ];

  it('matches the IERS introduction dates exactly', () => {
    expect(LEAP_SECONDS).toEqual(
      INTRODUCTIONS.map(([date, offset]) => [
        dateToJulianDay(new Date(`${date}T00:00:00Z`)),
        offset,
      ]),
    );
  });

  it('lists every entry at midnight UTC and in ascending order', () => {
    let previousJd = 0;
    for (const [jd, offset] of LEAP_SECONDS) {
      expect(Number.isInteger(jd - 0.5)).toBe(true);
      expect(jd).toBeGreaterThan(previousJd);
      expect(offset).toBeGreaterThanOrEqual(10);
      previousJd = jd;
    }
  });
});
