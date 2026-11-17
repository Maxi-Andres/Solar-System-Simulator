import { describe, expect, it } from 'vitest';

import { auroraShownAt, hoursOutside, OVATION_LATITUDES, OVATION_LONGITUDES, parseOvation } from './aurora.ts';

/** SWPC's layout: longitude-major, [longitude, latitude, percent]. */
function grid(value: (lon: number, lat: number) => unknown = () => 0): unknown[] {
  const cells: unknown[] = [];
  for (let lon = 0; lon < OVATION_LONGITUDES; lon += 1) {
    for (let lat = -90; lat <= 90; lat += 1) cells.push([lon, lat, value(lon, lat)]);
  }
  return cells;
}

function forecast(coordinates: unknown[]) {
  return {
    'Observation Time': '2026-11-17T15:37:00Z',
    'Forecast Time': '2026-11-17T16:55:00Z',
    'Data Format': '[Longitude, Latitude, Aurora]',
    coordinates,
    type: 'MultiPoint',
  };
}

const jdOf = (iso: string) => Date.parse(iso) / 86_400_000 + 2440587.5;

describe('the OVATION forecast', () => {
  it('is read onto the grid, latitude by latitude', () => {
    const parsed = parseOvation(forecast(grid((lon, lat) => (lon === 10 && lat === 67 ? 42 : lat === -70 ? 7 : 0))));
    expect(parsed).not.toBeNull();
    expect(parsed!.probability).toHaveLength(OVATION_LONGITUDES * OVATION_LATITUDES);
    expect(parsed!.probability[(67 + 90) * OVATION_LONGITUDES + 10]).toBe(42);
    expect(parsed!.northMax).toBe(42);
    expect(parsed!.southMax).toBe(7);
    expect(parsed!.forecastJd).toBeCloseTo(jdOf('2026-11-17T16:55:00Z'), 8);
  });

  it('refuses anything that is not one, whole', () => {
    expect(parseOvation(null)).toBeNull();
    expect(parseOvation({ ...forecast(grid()), 'Forecast Time': 'soon' })).toBeNull();
    expect(parseOvation(forecast(grid().slice(1)))).toBeNull();
    expect(parseOvation(forecast(grid(() => 'x')))).toBeNull();
    // A cell twice and another missing.
    const doubled = grid();
    doubled[1] = doubled[0];
    expect(parseOvation(forecast(doubled))).toBeNull();
  });

  it('is drawn only within an hour of the span it covers', () => {
    const parsed = parseOvation(forecast(grid()))!;
    expect(hoursOutside(parsed, jdOf('2026-11-17T16:00:00Z'))).toBe(0);
    expect(auroraShownAt(parsed, jdOf('2026-11-17T14:40:00Z'))).toBe(true);
    expect(auroraShownAt(parsed, jdOf('2026-11-17T18:00:00Z'))).toBe(false);
    expect(hoursOutside(parsed, jdOf('2026-11-19T16:55:00Z'))).toBeCloseTo(48, 6);
  });
});
