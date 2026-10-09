import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog.ts';
import {
  fixedTrack,
  localMeanSolarHours,
  marsSolDate,
  parseTraverse,
  traverseTrack,
  utcToJdTt,
} from './surface.ts';

const point = (sol: number, lat: number, lon: number, yaw: number | null) => ({
  type: 'Feature',
  properties: { sol, lat, lon, yaw },
  geometry: { type: 'Point', coordinates: [lon, lat, 0] },
});

describe('Mars time', () => {
  it('agrees with the Mars24 worked example', () => {
    // Allison and McEwen's example: 2000-01-06 00:00 UTC, TT 64.184 s later, is
    // Mars Sol Date 44795.9998.
    expect(marsSolDate(2451549.5 + 64.184 / 86_400)).toBeCloseTo(44795.9998, 4);
  });

  it('puts both rovers down in the Martian afternoon, as they landed', () => {
    // Curiosity at about 3 p.m. local time in Gale, Perseverance a little before 4 in
    // Jezero: both landings were planned for mid-afternoon.
    const curiosity = localMeanSolarHours(utcToJdTt('2012-08-06T05:17:57Z'), 137.4416);
    const perseverance = localMeanSolarHours(utcToJdTt('2021-02-18T20:43:38Z'), 77.4509);
    expect(curiosity).toBeGreaterThan(14.5);
    expect(curiosity).toBeLessThan(15.5);
    expect(perseverance).toBeGreaterThan(15.5);
    expect(perseverance).toBeLessThan(16.5);
  });

  it('counts the leap seconds: 2012 had 35, 2017 on has 37', () => {
    const jd = (iso: string) => Date.parse(iso) / 86_400_000 + 2440587.5;
    expect((utcToJdTt('2012-08-06T00:00:00Z') - jd('2012-08-06T00:00:00Z')) * 86_400).toBeCloseTo(
      67.184,
      3,
    );
    expect((utcToJdTt('2021-01-01T00:00:00Z') - jd('2021-01-01T00:00:00Z')) * 86_400).toBeCloseTo(
      69.184,
      3,
    );
  });
});

describe('a traverse', () => {
  const site = {
    kind: 'traverse',
    host: 'mars',
    landingUtc: '2012-08-06T05:17:57Z',
    traverseUrl: '',
  } as const;

  it('keeps each sol’s last drive, in sol order, headings into 0..360', () => {
    const waypoints = parseTraverse({
      features: [point(16, -4.59, 137.44, -100), point(3, -4.5895, 137.4416, 10), point(16, -4.6, 137.45, 170)],
    });
    expect(waypoints.map((w) => w.sol)).toEqual([3, 16]);
    expect(waypoints[1]!.latitudeDeg).toBe(-4.6);
    expect(waypoints[1]!.headingDeg).toBe(170);
    expect(parseTraverse({ features: [point(3, 0, 0, -100)] })[0]!.headingDeg).toBe(260);
  });

  it('starts at touchdown and moves each stop at the end of its sol, local midnight', () => {
    const track = traverseTrack(
      'curiosity',
      site,
      parseTraverse({ features: [point(3, -4.5895, 137.4416, 10), point(16, -4.6, 137.45, 170)] }),
    );
    expect(track.sol).toEqual([0, 3, 16]);
    expect(track.t[0]).toBeCloseTo(utcToJdTt(site.landingUtc), 9);
    for (const k of [1, 2]) {
      const hours = localMeanSolarHours(track.t[k]!, track.longitudeDeg[k]!);
      expect(Math.min(hours, 24 - hours)).toBeLessThan(1e-6);
    }
    // Thirteen sols apart, less the 0.0084 degrees further east the second stop is, where
    // midnight comes 2 seconds sooner.
    expect(track.t[2]! - track.t[1]!).toBeCloseTo((13 - (137.45 - 137.4416) / 360) * 1.0274912517, 9);
    expect((track.t[1]! - track.t[0]!) / 1.0274912517).toBeGreaterThan(3);
    expect((track.t[1]! - track.t[0]!) / 1.0274912517).toBeLessThan(4);
  });

  it('refuses a body whose days it cannot count', () => {
    expect(() => traverseTrack('x', { ...site, host: 'moon' }, [])).toThrow(/Mars/);
  });
});

describe('the surface craft in the catalog', () => {
  const surface = CATALOG.filter((body) => body.vectorWindow === 'surface');

  it('are on Mars, each with a site, and no Horizons table asked for', () => {
    expect(surface.map((body) => body.id).sort()).toEqual(['curiosity', 'insight', 'perseverance']);
    for (const body of surface) {
      expect(body.parent).toBe('mars');
      expect(body.mission?.site?.host).toBe('mars');
      expect(body.mission?.shape?.pointsAt).toBe('zenith');
    }
  });

  it('puts InSight where HiRISE found it', () => {
    const insight = surface.find((body) => body.id === 'insight')!;
    const site = insight.mission!.site!;
    expect(site.kind).toBe('fixed');
    const track = fixedTrack('insight', site as Extract<typeof site, { kind: 'fixed' }>);
    expect([track.latitudeDeg[0], track.longitudeDeg[0]]).toEqual([4.502384, 135.623447]);
  });
});
