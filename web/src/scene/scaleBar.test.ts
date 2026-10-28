import { describe, expect, it } from 'vitest';

import {
  CENSUS_EDGE_LY,
  censusEdgeVisibility,
  DISTANCE_RINGS_LY,
  RING_MAX_OPACITY,
  ringVisibility,
  sphereOutline,
} from './distanceRings.ts';
import { AU_KM, FOV_DEG, LIGHT_YEAR_KM, MAX_VIEW_DISTANCE_KM, PARSEC_KM } from './scale.ts';
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
    // The census seen whole, and the galaxy (D2b): light years all the way out.
    expect(barAt(3000 * LIGHT_YEAR_KM).label).toBe('100 ly');
    expect(barAt(MAX_VIEW_DISTANCE_KM).label).toBe('20,000 ly');
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
    // The census seen whole, 3,000 ly out; past it the rulers go one by one as the galaxy
    // comes in, and from the farthest zoom every one is under a pixel.
    const at = 3000 * LIGHT_YEAR_KM;
    expect(ringVisibility(1 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(0);
    expect(ringVisibility(100 * LIGHT_YEAR_KM, at, HEIGHT, FOV_DEG)).toBe(1);
  });

  it('stay under everything real', () => {
    expect(RING_MAX_OPACITY).toBeLessThanOrEqual(0.5);
  });
});

describe('the edge of the star census', () => {
  const R = CENSUS_EDGE_LY * LIGHT_YEAR_KM;

  it('is 100 parsecs, 326.16 light years', () => {
    expect(R).toBeCloseTo(100 * PARSEC_KM, 0);
    expect(CENSUS_EDGE_LY).toBeCloseTo(326.156, 3);
  });

  it('is drawn as the sphere is seen: grazing lines of sight, not a circle of radius R', () => {
    const D = 1000 * LIGHT_YEAR_KM;
    const outline = sphereOutline(R, D)!;
    // Every point of the outline is a tangent point: its line of sight is square to the
    // radius there, so camera, outline point and centre make a right angle.
    const along = D - outline.towardCameraKm;
    expect(along * along + outline.radiusKm * outline.radiusKm).toBeCloseTo(D * D - R * R, -20);
    // And it fills asin(R / D) of the view, a touch more than R / D would.
    expect(Math.atan(outline.radiusKm / along)).toBeCloseTo(Math.asin(R / D), 12);
  });

  it('has no outline from inside', () => {
    expect(sphereOutline(R, R * 0.5)).toBeNull();
    expect(sphereOutline(R, R)).toBeNull();
  });

  it('shows from well outside, and not from inside or right at its surface', () => {
    expect(censusEdgeVisibility(R, 50 * LIGHT_YEAR_KM, HEIGHT, FOV_DEG)).toBe(0);
    expect(censusEdgeVisibility(R, R * 1.01, HEIGHT, FOV_DEG)).toBe(0);
    expect(censusEdgeVisibility(R, 3000 * LIGHT_YEAR_KM, HEIGHT, FOV_DEG)).toBe(1);
    // From across the galaxy the census is a dot, and its edge is not drawn.
    expect(censusEdgeVisibility(R, MAX_VIEW_DISTANCE_KM, HEIGHT, FOV_DEG)).toBe(0);
  });
});
