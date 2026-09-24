import { describe, expect, it } from 'vitest';

import { getBody } from '../catalog.ts';
import { stepMinutes, stepSize, toHorizonsDate, vectorQuery } from './queries.ts';

describe('toHorizonsDate', () => {
  it('writes the time of day, which the moons need and the planets never did', () => {
    expect(toHorizonsDate(new Date('2026-09-24T00:00:00Z'))).toBe('2026-09-24 00:00');
    // A Phobos chunk boundary: 1499 steps of fifteen minutes past midnight.
    expect(toHorizonsDate(new Date('2026-10-09T14:45:00Z'))).toBe('2026-10-09 14:45');
  });

  it('refuses an instant it would have to round', () => {
    expect(() => toHorizonsDate(new Date('2026-09-24T00:00:30Z'))).toThrow(/whole minute/);
  });
});

describe('stepSize', () => {
  it('keeps whole days in days, so the planets ask exactly what they always asked', () => {
    expect(stepSize(1)).toBe('1d');
    expect(stepSize(32)).toBe('32d');
  });

  it('writes anything finer in minutes', () => {
    expect(stepSize(15 / 1440)).toBe('15m');
    expect(stepSize(1.5)).toBe('2160m');
  });

  it('counts minutes exactly, despite the float a fraction of a day becomes', () => {
    expect(stepMinutes(15 / 1440)).toBe(15);
    expect(stepMinutes(75 / 1440)).toBe(75);
  });
});

describe('vectorQuery', () => {
  it("asks for a moon relative to its planet's center, at its own step", () => {
    const query = vectorQuery(
      getBody('phobos'),
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-16T14:45:00Z'),
    );

    expect(query.COMMAND).toBe('401');
    expect(query.CENTER).toBe('500@499');
    expect(query.STEP_SIZE).toBe('15m');
    expect(query.START_TIME).toBe('2026-01-01 00:00');
    expect(query.STOP_TIME).toBe('2026-01-16 14:45');
  });
});
