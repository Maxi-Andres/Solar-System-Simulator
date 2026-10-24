import { describe, expect, it } from 'vitest';

import { DISTANCE_RINGS_LY, RING_MAX_OPACITY, ringVisibility } from './distanceRings.ts';
import { AU_KM, FOV_DEG, LIGHT_YEAR_KM, MAX_VIEW_DISTANCE_KM } from './scale.ts';
import { kmPerPixelAt, niceFloor, SCALE_BAR_MAX_PX, scaleBarReading } from './scaleBar.ts';

const HEIGHT = 910;

/** The bar with the camera `distanceKm` from its focus, in a 910-pixel frame. */
function barAt(distanceKm: number) {
  return scaleBarReading(kmPerPixelAt(distanceKm, FOV_DEG, HEIGHT));
}

describe('the scale bar', () => {
  it('rounds to 1, 2 or 5 times a power of ten', () => {
    expect(niceFloor(7.3)).toBe(5);
    expect(niceFloor(1999)).toBe(1000);
    expect(niceFloor(0.034)).toBeCloseTo(0.02, 12);
    expect(niceFloor(5)).toBe(5);
  });

  it('switches unit with the zoom: m, km, AU, ly', () => {
    expect(barAt(0.5).unit).toBe('m'); // the ISS's framing, 436 m out
    expect(barAt(50_000).unit).toBe('km'); // Earth, eight radii out
    expect(barAt(30 * AU_KM).unit).toBe('AU');
    expect(barAt(50 * LIGHT_YEAR_KM).unit).toBe('ly');
    expect(barAt(MAX_VIEW_DISTANCE_KM).label).toBe('100 ly');
  });

  it('writes large kilometres as millions', () => {
    const bar = barAt(0.3 * AU_KM);
    expect(bar.unit).toBe('km');
    expect(bar.label).toMatch(/^\d+(\.\d+)? million km$/);
  });

  it('is between two fifths of its length and all of it, and measures what it says', () => {
    for (let exponent = -3; exponent <= 17; exponent += 0.37) {
      const kmPerPx = kmPerPixelAt(10 ** exponent, FOV_DEG, HEIGHT);
      const bar = scaleBarReading(kmPerPx);
      expect(bar.widthPx).toBeLessThanOrEqual(SCALE_BAR_MAX_PX + 1e-9);
      expect(bar.widthPx).toBeGreaterThanOrEqual(SCALE_BAR_MAX_PX * 0.4 - 1e-9);
      expect((bar.widthPx * kmPerPx) / bar.lengthKm).toBeCloseTo(1, 12);
    }
  });

  it('gives every unit, parsecs too, in the tooltip', () => {
    const bar = barAt(100 * LIGHT_YEAR_KM);
    expect(bar.detail).toContain(' km = ');
    expect(bar.detail).toContain(' AU = ');
    expect(bar.detail).toContain(' ly = ');
    expect(bar.detail).toMatch(/ pc$/);
    // 10 ly is 3.07 pc.
    expect(scaleBarReading(10 * LIGHT_YEAR_KM / 100, 100).detail).toContain('3.07 pc');
  });

  it('is the frame height over its pixels at the focus', () => {
    // The frame is 2 tan(13.5 deg) = 0.48 of the distance tall.
    expect(kmPerPixelAt(HEIGHT, FOV_DEG, HEIGHT)).toBeCloseTo(2 * Math.tan((13.5 * Math.PI) / 180), 12);
  });
});

describe('the distance rings', () => {
  it('draw nothing anywhere the camera could go before the light years', () => {
    // The old limit, 2,000 AU from the Sun: every ring gone.
    for (const lightYears of DISTANCE_RINGS_LY) {
      expect(ringVisibility(lightYears * LIGHT_YEAR_KM, 2000 * AU_KM, HEIGHT, FOV_DEG)).toBe(0);
    }
  });

  it('show the nearest stars’ rings from the Solar Neighbourhood’s framing', () => {
    const at = 50 * LIGHT_YEAR_KM;
    // The 1-ly ring is 38 px in radius there, still coming in.
    expect(ringVisibility(1 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBeGreaterThan(0.5);
    expect(ringVisibility(5 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(1);
    expect(ringVisibility(10 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(1);
    expect(ringVisibility(100 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(1);
  });

  it('let the 1-ly ring shrink away from far out, keeping the 100-ly one', () => {
    const at = MAX_VIEW_DISTANCE_KM;
    expect(ringVisibility(1 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(0);
    expect(ringVisibility(100 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(1);
  });

  it('stay under everything real', () => {
    expect(RING_MAX_OPACITY).toBeLessThanOrEqual(0.5);
  });
});
