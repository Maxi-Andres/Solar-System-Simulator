import { describe, expect, it } from 'vitest';

import { INTERSTELLAR_CLOUDS, MAGELLANIC_TRACKS, magellanicStreamLb, trackMiddle } from './interstellarClouds.ts';

const angle = (a: readonly [number, number], b: readonly [number, number]): number => {
  const d = Math.PI / 180;
  const c =
    Math.sin(a[1] * d) * Math.sin(b[1] * d) + Math.cos(a[1] * d) * Math.cos(b[1] * d) * Math.cos((a[0] - b[0]) * d);
  return Math.acos(Math.max(-1, Math.min(1, c))) / d;
};

describe('the interstellar clouds', () => {
  it('each have a distance, a size and where both are from', () => {
    for (const cloud of INTERSTELLAR_CLOUDS) {
      expect(cloud.distancePc, cloud.name).toBeGreaterThan(0);
      expect(cloud.radiusPc, cloud.name).toBeGreaterThan(0);
      expect(cloud.distanceReference.length, cloud.name).toBeGreaterThan(10);
      expect(cloud.sizeNote.length, cloud.name).toBeGreaterThan(5);
    }
  });

  it('put the dark clouds near the Sun at their Gaia and VLBA distances', () => {
    const at = (key: string) => INTERSTELLAR_CLOUDS.find((cloud) => cloud.key === key)!;
    expect(at('coalsack').distancePc).toBeCloseTo(189, 0);
    expect(at('rho-oph').distancePc).toBeCloseTo(137.3, 1);
    expect(at('taurus').distancePc).toBeCloseTo(141, 0);
    expect(at('cygnus-x').distancePc).toBe(1400);
  });

  it('dash those whose distance is assumed or disputed: Loop I, Barnard 68, Barnard’s Loop', () => {
    const dashed = INTERSTELLAR_CLOUDS.filter((cloud) => cloud.distanceDisputed).map((cloud) => cloud.key);
    expect(dashed.sort()).toEqual(['b68', 'barnards-loop', 'loop-i']);
  });

  it('draw Loop I as a sphere filling its 58° circle, its rim at the Spur’s dust, 120 pc', () => {
    const loop = INTERSTELLAR_CLOUDS.find((cloud) => cloud.key === 'loop-i')!;
    expect((Math.asin(loop.radiusPc / loop.distancePc) * 180) / Math.PI).toBeCloseTo(58, 6);
    expect(Math.sqrt(loop.distancePc ** 2 - loop.radiusPc ** 2)).toBeCloseTo(120, 6);
  });
});

describe('the Magellanic Stream’s coordinates (Nidever et al. 2008)', () => {
  it('start on the Large Cloud’s meridian and have their pole at l = 188.5, b = −7.5', () => {
    // L_MS = 0 is the Large Cloud's meridian; the Cloud itself is 2.4° off the circle.
    const zero = magellanicStreamLb(0);
    expect(angle(zero, [280.47, -32.75])).toBeLessThan(2.5);
    expect(angle([280.47, -32.75], [188.5, -7.5])).toBeCloseTo(90 - angle(zero, [280.47, -32.75]), 6);
    // Every point of the circle is 90° from its pole.
    for (const lMs of [-140, -60, 0, 45]) {
      expect(angle(magellanicStreamLb(lMs), [188.5, -7.5])).toBeCloseTo(90, 6);
    }
  });

  it('run the Stream past the south Galactic pole, behind the Clouds', () => {
    // The Stream crosses the south Galactic pole's neighbourhood some 60–70° along.
    const nearest = Math.min(...Array.from({ length: 141 }, (_, k) => magellanicStreamLb(-k)[1]));
    expect(nearest).toBeLessThan(-75);
  });

  it('put the Bridge between the two Clouds, and each track’s mark at its middle', () => {
    const bridge = MAGELLANIC_TRACKS.find((track) => track.key === 'magellanic-bridge')!;
    const first = bridge.points[0]!;
    const last = bridge.points[bridge.points.length - 1]!;
    expect(first[2]).toBe(49_590);
    expect(last[2]).toBe(62_440);
    expect(angle([first[0], first[1]], [280.465, -32.889])).toBeLessThan(0.01);
    expect(angle([last[0], last[1]], [302.976, -44.008])).toBeLessThan(0.01);
    for (const track of MAGELLANIC_TRACKS) expect(trackMiddle(track)[2]).toBeGreaterThan(49_000);
  });
});
