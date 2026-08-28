import { describe, expect, it } from 'vitest';

import { LIGHTING_MODES, type LightingMode } from '../state/store.ts';
import { useViewStore } from '../state/store.ts';
import {
  acesToneMap,
  DISPLAY_FLOOR,
  LIGHTING,
  linearToSrgb,
  MAP_ALBEDO,
  PHYSICAL_LIGHTING,
  renderedBrightness,
  visibleTerminatorDeg,
} from './shading.ts';

/**
 * Where the terminator actually lands on screen.
 *
 * The geometry is right to a few thousandths of a degree and pinned against JPL, and
 * that turned out not to be enough: the app still looked over-lit, because the default
 * lighting mode carried an ambient fill of 0.08 and a bright body's night side never
 * reached black at all. No terminator edge, just a gradient across the whole disc.
 *
 * Geometry being correct says nothing about what a person sees. These tests measure the
 * second half of that -- the shading, tone mapping and encoding -- so "it looks too
 * lit" becomes a number rather than an argument.
 */

const albedos = Object.entries(MAP_ALBEDO);

describe('the physical mode puts the terminator where the geometry does', () => {
  it.each(albedos)('resolves a real day/night edge on %s', (_id, albedo) => {
    const terminator = visibleTerminatorDeg(albedo, 'natural');

    expect(terminator).not.toBeNull();
    // Geometric answer is 90. Ours lands slightly early and never late: past 90 the
    // cosine is negative and the render is exactly zero, so it cannot spill over.
    // Worst case is Neptune at 88.1, its map being the darkest -- and the real
    // terminator is itself soft over the Sun's half-degree width.
    expect(terminator!).toBeGreaterThan(88);
    expect(terminator!).toBeLessThanOrEqual(90);
  });

  it('leaves the night side genuinely black', () => {
    for (const [id, albedo] of albedos) {
      expect(renderedBrightness(180, albedo, 'natural'), id).toBe(0);
      expect(renderedBrightness(120, albedo, 'natural'), id).toBe(0);
    }
  });

  it('keeps the sub-solar point the brightest place on the body', () => {
    for (const [id, albedo] of albedos) {
      const noon = renderedBrightness(0, albedo, 'natural');

      expect(noon, id).toBeGreaterThan(renderedBrightness(45, albedo, 'natural'));
      expect(renderedBrightness(45, albedo, 'natural'), id).toBeGreaterThan(
        renderedBrightness(80, albedo, 'natural'),
      );
    }
  });
});

describe('the legibility modes are honest about what they cost', () => {
  it('never resolves a terminator on a bright body, which is the tradeoff', () => {
    // Not a bug: Shadow and Flood exist to make the unlit hemisphere readable, and
    // that is exactly what stops the edge from forming. It is why neither may be the
    // default, and why the panel says so.
    expect(visibleTerminatorDeg(MAP_ALBEDO.venus!, 'shadow')).toBeNull();
    expect(visibleTerminatorDeg(MAP_ALBEDO.venus!, 'flood')).toBeNull();
  });

  it('measures how much of the night side each mode lifts', () => {
    const night = (mode: LightingMode) => renderedBrightness(180, MAP_ALBEDO.venus!, mode);

    // 13 of 255 on Venus in Shadow: dim, but never black.
    expect(night('shadow') * 255).toBeGreaterThan(10);
    expect(night('shadow') * 255).toBeLessThan(20);
    expect(night('flood')).toBeGreaterThan(night('shadow'));
    expect(night('natural')).toBe(0);
  });

  it('flattens the terminator almost entirely in Flood', () => {
    const albedo = MAP_ALBEDO.venus!;
    const contrast =
      renderedBrightness(0, albedo, 'flood') - renderedBrightness(180, albedo, 'flood');

    // Under a tenth of the range: the point of Flood is that direction stops mattering.
    expect(contrast).toBeLessThan(0.1);
  });
});

describe('the default mode', () => {
  it('is the physical one', () => {
    // The bug this file exists for was a default, not a calculation. A simulator whose
    // whole claim is that it is measured must open showing the measured thing.
    expect(PHYSICAL_LIGHTING).toBe('natural');
    expect(useViewStore.getState().lighting).toBe(PHYSICAL_LIGHTING);
    expect(LIGHTING[PHYSICAL_LIGHTING].ambient).toBe(0);
  });

  it('is described to the user as the true one', () => {
    const natural = LIGHTING_MODES.find((mode) => mode.id === PHYSICAL_LIGHTING);

    expect(natural?.description).toMatch(/default/i);
    expect(natural?.description).toMatch(/true/i);
  });
});

describe('the tone curve model', () => {
  it('matches three.js: black stays black, and mid grey is lifted by the 0.6 divisor', () => {
    expect(acesToneMap(0)).toBeCloseTo(0, 6);
    // three.js divides by 0.6 before the curve, so the response is far from identity.
    expect(acesToneMap(0.18)).toBeGreaterThan(0.18);
    // Asymptotic, not clamped: that headroom is why nothing blows out at sun 5.
    expect(acesToneMap(10)).toBeCloseTo(1, 1);
    expect(acesToneMap(10)).toBeLessThan(1);
  });

  it('encodes sRGB with the right knee', () => {
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(1)).toBeCloseTo(1, 9);
    // The linear segment below 0.0031308, which is what makes DISPLAY_FLOOR meaningful.
    expect(linearToSrgb(0.001)).toBeCloseTo(0.01292, 9);
    expect(DISPLAY_FLOOR * 255).toBe(2);
  });

  it('rises with albedo, so a dark map renders darker than a bright one', () => {
    expect(renderedBrightness(0, MAP_ALBEDO.venus!, 'natural')).toBeGreaterThan(
      renderedBrightness(0, MAP_ALBEDO.earth!, 'natural'),
    );
  });
});
