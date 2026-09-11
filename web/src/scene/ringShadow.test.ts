import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import { opticalDepthFromAlpha } from './ringMaterial.ts';
import {
  POINT_LIGHT_HOOK,
  RING_SHADOW_GLSL,
  ringShadowTransmission,
  SHADOW_FLOOR,
  SHADOW_OPACITY_EXPONENT,
  SHADOW_OPACITY_GAIN,
} from './ringShadow.ts';

/**
 * The shadow the rings throw back onto Saturn.
 *
 * Its geometry is easy to get subtly wrong in ways that all look like a plausible
 * shadow: inverted, on the wrong hemisphere, at the wrong radius, or cast onto a sphere
 * while the planet drawn beneath it is an ellipsoid. So the test is the same shape as
 * the one for Saturn's shadow on the rings -- ask questions whose answers are obvious
 * from the geometry, not from the render.
 */

const saturn = getBody('saturn');
const rings = saturn.rings!;
const A = saturn.radiusEquatorialKm;
const INNER = rings.innerRadiusKm;
const OUTER = rings.outerRadiusKm;

/** A ring that is uniformly moderately dense, so radius drops out of the answer. */
const uniform = () => opticalDepthFromAlpha(0.705);
/** A ring with nothing in it. */
const empty = () => 0;

/** Sun at a given elevation above the ring plane, in the +x direction. */
function sunAt(elevationSine: number): [number, number, number] {
  const horizontal = Math.sqrt(1 - elevationSine * elevationSine);
  return [horizontal, elevationSine, 0];
}

/**
 * Solar elevation that puts a given latitude's shadow ray through a given ring radius.
 *
 * Written this way round because the natural one does not work: pick a point and an
 * elevation at random and the ray almost always crosses the ring plane inside the C
 * ring or outside the A ring, and nothing is shadowed. The rings only shadow a narrow
 * band of latitudes at any given time, which is itself the reason ring shadows on
 * Saturn are stripes rather than a wash.
 *
 * `r = |y| / tan(elevation)`, so `elevation = atan(|y| / r)`.
 */
function sunElevationCrossingAt(y: number, ringRadius: number): number {
  return Math.sin(Math.atan(Math.abs(y) / ringRadius));
}

const transmission = (
  point: readonly [number, number, number],
  sunElevationSine: number,
  depth = uniform,
) => ringShadowTransmission(point, sunAt(sunElevationSine), INNER, OUTER, depth);

describe('which hemisphere gets shadowed', () => {
  it('shadows the winter hemisphere and never the summer one', () => {
    // With the Sun north of the ring plane, the rings can only ever come between it and
    // a point in the south. That falls out of the sign of the crossing distance rather
    // than being special-cased, which is the part worth testing.
    const north: [number, number, number] = [-A * 0.3, A * 0.9, 0];
    const south: [number, number, number] = [-A * 0.3, -A * 0.9, 0];

    expect(transmission(south, 0.4)).toBeLessThan(1);
    expect(transmission(north, 0.4)).toBe(1);
  });

  it('swaps hemispheres when the Sun crosses the ring plane', () => {
    // Saturn's seasons. The shadow moves to the other hemisphere at equinox, and this
    // is the whole of the mechanism that makes it do so.
    const south: [number, number, number] = [-A * 0.3, -A * 0.9, 0];

    expect(transmission(south, 0.4)).toBeLessThan(1);
    expect(transmission(south, -0.4)).toBe(1);
  });

  it('shadows nothing at all when the Sun is exactly in the ring plane', () => {
    // The rays never cross it, so nothing can be behind it. Also the case the division
    // would blow up on.
    for (const y of [A * 0.9, 0, -A * 0.9]) {
      expect(transmission([-A * 0.3, y, 0], 0)).toBe(1);
    }
  });
});

describe('where the shadow lands', () => {
  it('falls only where the ray actually crosses the rings', () => {
    // Aimed deliberately at the empty space inside the C ring and at the empty space
    // beyond the A ring. Both get full sunlight, however dense the rings are between.
    const y = -A * 0.9;
    const insideTheRings = sunElevationCrossingAt(y, INNER * 0.8);
    const beyondTheRings = sunElevationCrossingAt(y, OUTER * 1.2);
    const throughTheRings = sunElevationCrossingAt(y, (INNER + OUTER) / 2);

    expect(transmission([0, y, 0], insideTheRings)).toBe(1);
    expect(transmission([0, y, 0], beyondTheRings)).toBe(1);
    // And the one aimed between them is shadowed, or the test above proves nothing.
    expect(transmission([0, y, 0], throughTheRings)).toBeLessThan(0.95);
  });

  it('moves the shadow toward the equator as the Sun rises', () => {
    // A high Sun throws the ring shadow close in, a low one throws it far. The same
    // relationship that stretches Saturn's shadow across the rings at a low Sun, seen
    // from the other end -- and the reason the shadow bands sweep across the planet
    // over Saturn's 29.5-year year.
    const crossingRadius = (y: number, elevationSine: number) =>
      (Math.abs(y) / elevationSine) * Math.sqrt(1 - elevationSine * elevationSine);
    const y = -A * 0.8;

    expect(crossingRadius(y, 0.2)).toBeGreaterThan(crossingRadius(y, 0.8));
    // Which means a given ring radius shadows a lower latitude when the Sun is low.
    expect(sunElevationCrossingAt(A * 0.2, OUTER)).toBeLessThan(
      sunElevationCrossingAt(A * 0.9, OUTER),
    );
  });

  it('ignores an empty ring, whatever the geometry', () => {
    for (const elevation of [0.1, 0.4, 0.9]) {
      expect(transmission([-A * 0.3, -A * 0.9, 0], elevation, empty)).toBe(1);
    }
  });
});

describe('how much light the rings actually stop', () => {
  /**
   * This used to use the slant path, `exp(-tau / mu0)`, which is the physically exact
   * answer and made the shadow three and a half times too wide.
   *
   * The formula was not the problem. Dividing by the solar elevation multiplies the
   * optical depth by eight at 2026's geometry, and that optical depth is not a
   * measurement -- it is an artist's opacity map. Checked against published values it
   * gives the C ring four times too much material. Face-on, that error is barely
   * visible; amplified eightfold it turns every sparse ring into an opaque screen, and
   * their shadows merge with the B ring's into one broad band.
   *
   * So the shadow now uses the map face-on, corrected by an exponent that recovers the
   * published optical depths. Precision the data can actually carry.
   */
  const blockedFraction = (alpha: number) =>
    1 - transmission([0, -A * 0.5, 0], sunElevationCrossingAt(A * 0.5, (INNER + OUTER) / 2), () =>
      opticalDepthFromAlpha(alpha),
    );

  it('does not depend on the solar elevation, because the map cannot support that', () => {
    // The correction that fixed the width. Where the shadow *falls* still follows the
    // Sun; how dark it is no longer does.
    const radius = (INNER + OUTER) / 2;
    const low = transmission(
      [0, -A * 0.15, 0],
      sunElevationCrossingAt(A * 0.15, radius),
    );
    const high = transmission(
      [0, -A * 0.95, 0],
      sunElevationCrossingAt(A * 0.95, radius),
    );

    expect(low).toBeCloseTo(high, 9);
  });

  it('recovers the published optical depth of each ring from the map', () => {
    // The exponent is justified by this table rather than chosen to look right. Opacity
    // is 1 - exp(-tau); the map values are read off the shipped image.
    const published: [string, number, number][] = [
      ['C ring', 0.329, 1 - Math.exp(-0.1)],
      ['B ring', 0.914, 1 - Math.exp(-2.0)],
      ['Cassini Division', 0.431, 1 - Math.exp(-0.1)],
      ['A ring', 0.686, 1 - Math.exp(-0.5)],
    ];

    for (const [name, mapAlpha, real] of published) {
      const corrected = Math.pow(mapAlpha, SHADOW_OPACITY_EXPONENT);

      // The raw map is too dense everywhere but the B ring, and worst where the real
      // ring is thinnest: 3.5x for the C ring and 4.5x for the Cassini Division, which
      // is why their shadows were the ones widening the band.
      if (real < 0.5) {
        expect(mapAlpha / real, `${name} raw`).toBeGreaterThan(1.7);
      }
      if (real < 0.2) {
        expect(mapAlpha / real, `${name} raw`).toBeGreaterThan(3);
      }
      // ...and the correction brings all four to the right order.
      expect(Math.abs(corrected - real), name).toBeLessThan(0.1);
    }
  });

  it('leaves the sparse rings barely shadowing at all', () => {
    // Which is the whole of the width fix: NASA's visible shadow is essentially the B
    // ring's, because the C ring and the Cassini Division hardly block anything.
    expect(blockedFraction(0.329)).toBeLessThan(0.1);
    expect(blockedFraction(0.431)).toBeLessThan(0.2);
  });

  it('keeps the dense B ring genuinely dark', () => {
    expect(blockedFraction(0.914)).toBeGreaterThan(0.7);
    // And the darkest a shadow can get is the floor plus what the B ring passes.
    const deepest = transmission(
      [0, -A * 0.5, 0],
      sunElevationCrossingAt(A * 0.5, (INNER + OUTER) / 2),
      () => opticalDepthFromAlpha(0.95),
    );
    expect(deepest).toBeGreaterThan(0.08);
    expect(deepest).toBeLessThan(0.15);
  });

  it('still keeps the bands distinguishable inside the shadow', () => {
    // The Cassini Division and the C ring have to stay readable, or the band is one
    // flat stripe again.
    expect(blockedFraction(0.914)).toBeGreaterThan(blockedFraction(0.686) * 1.5);
    expect(blockedFraction(0.686)).toBeGreaterThan(blockedFraction(0.431) * 1.5);
  });

  it('never brightens anything', () => {
    for (const elevation of [0.05, 0.2, 0.5, 0.9, -0.5]) {
      for (const y of [A * 0.9, A * 0.2, -A * 0.2, -A * 0.9]) {
        const value = transmission([0, y, 0], elevation);

        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the shader patch', () => {
  it('depends on a line three.js still has', () => {
    // The patch injects after this exact line in three's own lighting chunk. Pinned so
    // that a three.js upgrade which moves it fails here, loudly, rather than silently
    // dropping the shadow.
    expect(THREE.ShaderChunk.lights_fragment_begin).toContain(POINT_LIGHT_HOOK);
  });

  it('applies the flattening, so the shadow lands on an ellipsoid', () => {
    // The mesh carries the polar flattening as a scale, which the raw position
    // attribute does not. Without this the shadow would be computed on a sphere while
    // the planet drawn beneath it is 9.8% flatter.
    expect(RING_SHADOW_GLSL).toContain('vRingShadowPosition');
  });

  it('waits for the ring map rather than guessing', () => {
    // The map loads lazily, so the planet is drawn unshadowed until it arrives. That
    // is a normal state and not an error.
    expect(RING_SHADOW_GLSL).toContain('uRingShadowStrength <= 0.0');
  });

  it('reads the map face-on and corrects it, rather than taking the slant path', () => {
    expect(RING_SHADOW_GLSL).toContain('pow(alphaNormal, uRingShadowExponent)');
    // The slant path is gone: it amplified the map's error eightfold.
    expect(RING_SHADOW_GLSL).not.toContain('tau / abs(sunY)');
  });
});

describe('a ring shadow is dark, not black', () => {
  /**
   * The first version took the unscattered beam as the whole answer and rendered the
   * shadow at 3% of the lit surface, where the reference shows 26%. The width was
   * already right -- 9.3% of the planet's height against NASA's 10.6% -- and a solid
   * black stripe still read as far too heavy, which is a useful reminder that "too wide"
   * and "too dark" are hard to tell apart by eye.
   *
   * What was missing is light that arrives indirectly: diffusely transmitted through the
   * rings, and reflected off the lit rings onto the planet. See SHADOW_FLOOR.
   */
  it('never takes a surface fully to black, however dense the rings', () => {
    const opaque = () => 50; // far past anything the map contains
    const radius = (INNER + OUTER) / 2;
    const sun = sunElevationCrossingAt(A * 0.3, radius);

    expect(transmission([0, -A * 0.3, 0], sun, opaque)).toBeCloseTo(SHADOW_FLOOR, 6);
  });

  it('lands near the range measured off the reference', () => {
    // NASA's shadow band keeps 26% of the lit surface on average and 17% at its
    // darkest, which through this renderer's tone curve are transmissions of 0.120 and
    // 0.077. Ours lands at 0.105, inside that -- reached in two 20% steps by eye, and
    // the fact that eye-tuning converged into the measured range is the useful part.
    const radius = (INNER + OUTER) / 2;
    const deepest = transmission(
      [0, -A * 0.5, 0],
      sunElevationCrossingAt(A * 0.5, radius),
      () => opticalDepthFromAlpha(0.95),
    );

    expect(deepest).toBeGreaterThan(0.077);
    expect(deepest).toBeLessThan(0.12);
  });

  it('still leaves unshadowed surface completely untouched', () => {
    // The floor lifts the shadow, and must not dim anything outside it.
    expect(transmission([0, A * 0.9, 0], 0.4)).toBe(1);
    expect(transmission([0, -A * 0.9, 0], 0.4, empty)).toBe(1);
  });

  it('keeps the sparse rings clearly brighter than the dense ones', () => {
    // The floor must not flatten the band into one grey stripe.
    const radius = (INNER + OUTER) / 2;
    const sun = sunElevationCrossingAt(A * 0.5, radius);
    const point: [number, number, number] = [0, -A * 0.5, 0];
    const sparse = transmission(point, sun, () => opticalDepthFromAlpha(0.2));
    const dense = transmission(point, sun, () => opticalDepthFromAlpha(0.95));

    expect(sparse).toBeGreaterThan(dense * 1.5);
  });
});

describe('the depth gain is separate from the shape correction', () => {
  /**
   * Two knobs that could have been one, and must not be.
   *
   * `SHADOW_OPACITY_EXPONENT` sets which rings block and which do not, and it is pinned
   * to published optical depths -- turning it to chase a depth would undo the width fix
   * it exists for. `SHADOW_OPACITY_GAIN` sets only how dark the darkest part gets.
   */
  const blocked = (alpha: number) =>
    Math.min(
      1,
      Math.pow(1 - Math.exp(-opticalDepthFromAlpha(alpha)), SHADOW_OPACITY_EXPONENT) *
        SHADOW_OPACITY_GAIN,
    );

  it('deepens the dark core without touching the sparse rings', () => {
    // The whole reason the gain is safe: at the B ring it changes the transmitted light
    // by a fifth, at the C ring by a thousandth. It cannot widen the band.
    const withoutGain = (alpha: number) =>
      Math.pow(1 - Math.exp(-opticalDepthFromAlpha(alpha)), SHADOW_OPACITY_EXPONENT);

    expect(1 - blocked(0.95)).toBeLessThan((1 - withoutGain(0.95)) * 0.9);
    expect(Math.abs(blocked(0.329) - withoutGain(0.329))).toBeLessThan(0.01);
  });

  it('is small because transmission is a difference near saturation', () => {
    // A 3% gain on the opacity is a 20% change in the light that gets through, which is
    // why this needs its own name rather than being folded into the exponent, where it
    // would look like part of the physical anchor.
    expect(SHADOW_OPACITY_GAIN).toBeGreaterThan(1);
    expect(SHADOW_OPACITY_GAIN).toBeLessThan(1.1);
  });

  it('never blocks more than all of the light', () => {
    for (const alpha of [0.9, 0.95, 0.99, 1]) {
      expect(blocked(alpha)).toBeLessThanOrEqual(1);
    }
  });

  it('leaves the exponent free to stay anchored to the published depths', () => {
    // Restating the constraint the gain exists to protect.
    expect(Math.abs(Math.pow(0.686, SHADOW_OPACITY_EXPONENT) - (1 - Math.exp(-0.5)))).toBeLessThan(
      0.02,
    );
  });
});
