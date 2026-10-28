import { describe, expect, it } from 'vitest';

import { GALACTIC_BASIS } from './galactic.ts';
import {
  BALMER_HUE,
  emissionHue,
  GALAXY_FROM_LY,
  GALAXY_FULL_LY,
  GALAXY_LABELS,
  GALAXY_VIEW,
  galaxyVisibility,
} from './MilkyWay.tsx';
import { GALAXY_FRAMING_KM, LIGHT_YEAR_KM, MAX_VIEW_DISTANCE_KM } from './scale.ts';

const dot = (a: readonly number[], b: { x: number; y: number; z: number }): number =>
  a[0]! * b.x + a[1]! * b.y + a[2]! * b.z;

describe('the Milky Way model on screen', () => {
  it('stays out of the star catalogue and is whole past it', () => {
    expect(galaxyVisibility(0)).toBe(0);
    expect(galaxyVisibility(GALAXY_FROM_LY * LIGHT_YEAR_KM)).toBe(0);
    const middle = galaxyVisibility(Math.sqrt(GALAXY_FROM_LY * GALAXY_FULL_LY) * LIGHT_YEAR_KM);
    expect(middle).toBeCloseTo(0.5, 9);
    expect(galaxyVisibility(GALAXY_FULL_LY * LIGHT_YEAR_KM)).toBe(1);
    expect(galaxyVisibility(MAX_VIEW_DISTANCE_KM)).toBe(1);
  });

  it('frames the galaxy from inside the zoom', () => {
    expect(GALAXY_FRAMING_KM).toBeLessThan(MAX_VIEW_DISTANCE_KM);
    expect(galaxyVisibility(GALAXY_FRAMING_KM)).toBe(1);
  });

  it('looks down from the north galactic pole, 20 degrees off it, with the centre across', () => {
    const { direction, up } = GALAXY_VIEW;
    expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
    expect(Math.hypot(...up)).toBeCloseTo(1, 12);
    expect(direction[0] * up[0] + direction[1] * up[1] + direction[2] * up[2]).toBeCloseTo(0, 12);
    expect(Math.acos(dot(direction, GALACTIC_BASIS.z)) * (180 / Math.PI)).toBeCloseTo(20, 9);
    // The Sun-centre line lies across the frame: square to both the view and its up.
    expect(dot(direction, GALACTIC_BASIS.x)).toBeCloseTo(0, 12);
    expect(dot(up, GALACTIC_BASIS.x)).toBeCloseTo(0, 12);
  });

  it('names the centre first, then the seven arms', () => {
    expect(GALAXY_LABELS[0]).toBe('Galactic Centre');
    expect(GALAXY_LABELS).toHaveLength(8);
  });
});

describe('the HII regions’ colour', () => {
  it('is hydrogen’s pink: red from H-alpha, blue from H-beta, little green', () => {
    const [r, g, b] = BALMER_HUE;
    expect(r).toBeCloseTo(1, 12);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeLessThan(0.6);
  });

  it('is a single line’s own colour when there is one line', () => {
    // H-alpha alone is a deep red.
    const [r, g, b] = emissionHue([[656.28, 1]]);
    expect(r).toBeCloseTo(1, 12);
    expect(g).toBeLessThan(0.3);
    expect(b).toBeLessThan(0.3);
  });
});
