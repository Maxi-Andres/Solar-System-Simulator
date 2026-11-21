import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import type { RingSystem } from '@sss/tools/types';
import { J2000_JD } from '../core/time.ts';
import { poleDirection } from './orientation.ts';
import {
  bandOpticalDepth,
  RING_STRIP_TEXELS,
  ringFlatRadianceFactor,
  ringShadowSettings,
  ringStripLevels,
  ringStripOpacity,
  SATURN_RING_REFLECTIVITY,
} from './ringBands.ts';
import { RING_FLAT_RADIANCE_FACTOR } from './ringMaterial.ts';
import { SHADOW_FLOOR, SHADOW_OPACITY_EXPONENT, SHADOW_OPACITY_GAIN } from './ringShadow.ts';

/**
 * Uranus's and Neptune's rings, drawn from their measurements: the strip has to hold what
 * the measurements say -- each ring where it is, as opaque as its optical depth, and no ring
 * anywhere else -- at every level of detail.
 */

const uranus = getBody('uranus');
const neptune = getBody('neptune');
const uranusRings = uranus.rings!;
const neptuneRings = neptune.rings!;

/** The strip's opacity at a radius, km. */
function opacityAt(rings: RingSystem, strip: Float32Array, radiusKm: number): number {
  const i = Math.floor(((radiusKm - rings.innerRadiusKm) / (rings.outerRadiusKm - rings.innerRadiusKm)) * strip.length);
  return strip[i]!;
}

describe('the measured ring systems', () => {
  it('are drawn from measurements, not a picture, and Saturn’s from its picture', () => {
    expect(uranusRings.texture).toBeNull();
    expect(neptuneRings.texture).toBeNull();
    expect(getBody('saturn').rings!.texture).toBe('saturn-rings.png');
    expect(getBody('saturn').rings!.bands).toEqual([]);
  });

  it('draws Uranus’s nine classical rings, lambda and zeta, and Neptune’s four measured ones', () => {
    const names = (rings: RingSystem) => rings.bands.map((band) => band.name);
    for (const ring of ['6', '5', '4', 'alpha', 'beta', 'eta', 'gamma', 'delta', 'lambda', 'epsilon', 'zeta']) {
      expect(names(uranusRings)).toContain(ring);
    }
    expect(names(neptuneRings)).toEqual(['Galle', 'Le Verrier', 'Lassell', 'Adams']);
  });

  it('keeps every ring inside its strip, and the strip outside the planet', () => {
    for (const body of [uranus, neptune]) {
      const rings = body.rings!;
      expect(rings.innerRadiusKm).toBeGreaterThan(body.radiusEquatorialKm);
      for (const band of rings.bands) {
        expect(band.radiusKm - band.widthKm / 2, `${body.id} ${band.name}`).toBeGreaterThanOrEqual(rings.innerRadiusKm);
        expect(band.radiusKm + band.widthKm / 2, `${body.id} ${band.name}`).toBeLessThanOrEqual(rings.outerRadiusKm);
      }
    }
  });

  it('gives each ring the optical depth its equivalent depth and width imply, within the published range', () => {
    const depth = (name: string) => bandOpticalDepth(uranusRings.bands.find((band) => band.name === name)!);
    // Published normal optical depths (Rings of Uranus; de Pater et al. 2013).
    expect(depth('epsilon')).toBeGreaterThan(0.5);
    expect(depth('epsilon')).toBeLessThan(2.5);
    expect(depth('gamma')).toBeGreaterThan(0.7);
    expect(depth('gamma')).toBeLessThan(0.9);
    expect(depth('alpha')).toBeGreaterThan(0.3);
    expect(depth('alpha')).toBeLessThan(0.7);
    // Adams outside its arcs: 0.011 +/- 0.003 (Horn et al. 1990).
    expect(bandOpticalDepth(neptuneRings.bands.find((band) => band.name === 'Adams')!)).toBeCloseTo(0.011, 3);
  });
});

describe('the strip', () => {
  const strip = ringStripOpacity(uranusRings);
  const texelKm = (uranusRings.outerRadiusKm - uranusRings.innerRadiusKm) / RING_STRIP_TEXELS;

  it('resolves the epsilon ring, and draws it as opaque as its depth', () => {
    expect(texelKm).toBeLessThan(7);
    const epsilon = uranusRings.bands.find((band) => band.name === 'epsilon')!;
    expect(opacityAt(uranusRings, strip, epsilon.radiusKm)).toBeCloseTo(1 - Math.exp(-bandOpticalDepth(epsilon)), 6);
  });

  it('leaves the gaps clear: between lambda and epsilon, and between delta and lambda', () => {
    expect(opacityAt(uranusRings, strip, 50600)).toBe(0);
    expect(opacityAt(uranusRings, strip, 49200)).toBe(0);
  });

  it('keeps each narrow ring’s whole blocking, however much narrower than a texel', () => {
    // A ring's equivalent width -- its width times its face-on opacity -- summed across the
    // strip is what it blocks. Narrow rings land in one or two texels and must keep it.
    const blocked = strip.reduce((sum, opacity) => sum + opacity * texelKm, 0);
    const expected = uranusRings.bands.reduce(
      (sum, band) => sum + band.widthKm * (1 - Math.exp(-bandOpticalDepth(band))),
      0,
    );
    // Overlapping rings (eta and its broad part, delta and its) multiply rather than add.
    expect(blocked / expected).toBeGreaterThan(0.99);
    expect(blocked / expected).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('keeps Neptune’s faintest ring, which eight bits would have lost', () => {
    const neptuneStrip = ringStripOpacity(neptuneRings);
    // Galle: optical depth 7.5e-5, a twentieth of one step of an 8-bit alpha.
    const galle = opacityAt(neptuneRings, neptuneStrip, 41900);
    expect(galle).toBeGreaterThan(5e-5);
    expect(galle).toBeLessThan(1 / 255);
  });

  it('fades a ring with distance rather than flickering: every mip level keeps the mean', () => {
    const levels = ringStripLevels(strip);
    const mean = (level: Float32Array) => level.reduce((sum, v) => sum + v, 0) / level.length;
    expect(levels[levels.length - 1]!.length).toBe(1);
    for (const level of levels) {
      expect(mean(level)).toBeCloseTo(mean(strip), 6);
    }
  });
});

describe('how they are drawn', () => {
  it('draws them as dark as their particles: an eleventh of Saturn’s brightness', () => {
    expect(ringFlatRadianceFactor(getBody('saturn').rings!)).toBe(RING_FLAT_RADIANCE_FACTOR);
    expect(ringFlatRadianceFactor(uranusRings)).toBeCloseTo((RING_FLAT_RADIANCE_FACTOR * 0.05) / SATURN_RING_REFLECTIVITY, 12);
    expect(ringFlatRadianceFactor(uranusRings) / RING_FLAT_RADIANCE_FACTOR).toBeCloseTo(1 / 11, 2);
  });

  it('casts their plain face-on shadow, and Saturn’s with its corrections', () => {
    expect(ringShadowSettings(uranusRings)).toEqual({ floor: 0, exponent: 1, gain: 1 });
    expect(ringShadowSettings(getBody('saturn').rings!)).toEqual({
      floor: SHADOW_FLOOR,
      exponent: SHADOW_OPACITY_EXPONENT,
      gain: SHADOW_OPACITY_GAIN,
    });
  });

  it('lays Uranus’s rings across its 98-degree tilt: their normal is its pole, nearly in the ecliptic', () => {
    // The rings are turned onto poleDirection, as Saturn's are (ringGeometry.test.ts).
    // The IAU's Uranus pole is the one north of the invariable plane, 82 degrees from the
    // ecliptic's; the other, the one it turns anticlockwise about, is 98. Either way the
    // pole lies within 8 degrees of the ecliptic, so the rings stand nearly upright to it.
    const pole = poleDirection(J2000_JD, uranus);
    const fromEclipticNorth = (Math.acos(pole.z) * 180) / Math.PI;
    expect(fromEclipticNorth).toBeCloseTo(82.3, 1);
  });
});
