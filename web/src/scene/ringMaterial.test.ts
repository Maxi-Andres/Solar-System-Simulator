import { describe, expect, it } from 'vitest';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { getBody } from '@sss/tools/catalog';
import {
  apparentOpacity,
  RING_ALBEDO_TIMES_PHASE,
  SHADOW_SOFTNESS,
  sunlitFraction,
  MIN_ELEVATION_SINE,
  opticalDepthFromAlpha,
  RING_SCATTERING_SCALE,
  RING_SHADERS,
  RING_TINT_SRGB,
  singleScattering,
} from './ringMaterial.ts';

/**
 * The ring scattering model, held against the behaviour it exists for.
 *
 * The first rings used `MeshStandardMaterial`, so their brightness went as the cosine
 * between the ring plane and the Sun. In 2026 that is 0.125 — Saturn's rings are nearly
 * edge-on to the Sun — and the rings were reported as almost invisible. Correct for a
 * flat sheet, wrong for a slab of separated particles.
 *
 * These tests pin the three things the replacement has to get right, all of which are
 * checkable against known ring behaviour rather than against taste.
 */

/** Optical depth of the mean visible ring pixel, from its face-on alpha of 0.705. */
const TAU_MEAN = opticalDepthFromAlpha(0.705);

/** Sub-solar elevation sines on Saturn, measured from the generated ephemerides. */
const SOLAR_ELEVATION = { 2026: 0.125, 2027: 0.217, 2030: 0.417 } as const;

/** A representative viewing elevation, well away from the ring plane. */
const VIEW = 0.5;

const reflected = (tau: number, muSun: number, muView = VIEW) =>
  singleScattering(tau, muSun, muView, true) * RING_SCATTERING_SCALE;
const transmitted = (tau: number, muSun: number, muView = VIEW) =>
  singleScattering(tau, muSun, muView, false) * RING_SCATTERING_SCALE;

/**
 * Radiance factor, the unit ring photometry is published in.
 *
 * Comparisons against a Lambertian ring have to happen here rather than in rendered
 * radiance: the two differ by a factor of PI and an albedo, and the first version of
 * these tests compared the model's radiance against Lambert's bare cosine, which is
 * not a comparison of anything. A Lambert surface has I/F = albedo * mu0.
 */
const radianceFactor = (tau: number, muSun: number, muView = VIEW) =>
  RING_ALBEDO_TIMES_PHASE * singleScattering(tau, muSun, muView, true);

/** Reflectance of a Lambertian stand-in, so the comparison means something. */
const LAMBERT_ALBEDO = 0.5;

describe('optical depth from the texture', () => {
  it('reads alpha as face-on opacity, so tau = -ln(1 - alpha)', () => {
    expect(opticalDepthFromAlpha(0)).toBeCloseTo(0, 9);
    expect(opticalDepthFromAlpha(0.5)).toBeCloseTo(Math.LN2, 9);
    // The mean visible pixel: alpha 0.705 is a slab you can just about see through.
    expect(TAU_MEAN).toBeCloseTo(1.22, 2);
  });

  it('puts the sparse and dense rings on either side of tau = 1', () => {
    // The C ring is famously faint and the B ring nearly solid, which is the whole
    // reason a single opacity number could not represent them.
    expect(opticalDepthFromAlpha(0.25)).toBeLessThan(0.5);
    expect(opticalDepthFromAlpha(0.95)).toBeGreaterThan(2.5);
  });

  it('caps the densest pixels rather than sending tau to infinity', () => {
    expect(Number.isFinite(opticalDepthFromAlpha(1))).toBe(true);
    expect(opticalDepthFromAlpha(1)).toBeLessThan(10);
  });
});

describe('brightness near edge-on illumination', () => {
  it('outshines a Lambertian ring of the same albedo, most where it matters', () => {
    // The bug, stated as a test, in radiance factor so the two are comparable. The
    // margin is largest exactly where the old model failed: low Sun, grazing view.
    for (const [year, muSun] of Object.entries(SOLAR_ELEVATION)) {
      const lambert = LAMBERT_ALBEDO * muSun;

      expect(radianceFactor(TAU_MEAN, muSun, 1), year).toBeGreaterThan(lambert);
      expect(radianceFactor(TAU_MEAN, muSun, 0.5), year).toBeGreaterThan(lambert * 2);
    }
  });

  it('doubles a Lambertian ring at 2026 geometry, and triples it at a grazing view', () => {
    // Measured: I/F 0.122 face-on and 0.220 at mu = 0.5, against Lambert's 0.0625.
    const muSun = SOLAR_ELEVATION[2026];
    const lambert = LAMBERT_ALBEDO * muSun;

    expect(radianceFactor(TAU_MEAN, muSun, 1)).toBeCloseTo(0.122, 3);
    expect(radianceFactor(TAU_MEAN, muSun, 1) / lambert).toBeCloseTo(1.96, 1);
    expect(radianceFactor(TAU_MEAN, muSun, 0.5) / lambert).toBeCloseTo(3.52, 1);
  });

  it('reproduces the measured B ring radiance factor with the rings open', () => {
    // The anchor RING_ALBEDO_TIMES_PHASE was set from, checked back: Cassini puts the
    // B ring at I/F = 0.5 to 0.6 at low phase with the rings well open. 2030 geometry
    // at a typical viewing elevation lands at 0.498.
    const dense = opticalDepthFromAlpha(0.95);

    expect(radianceFactor(dense, SOLAR_ELEVATION[2030], 0.5)).toBeGreaterThan(0.45);
    expect(radianceFactor(dense, SOLAR_ELEVATION[2030], 0.5)).toBeLessThan(0.65);
  });

  it('does not render brighter than the planet it orbits', () => {
    // The defect this scale replaced: at 2.0 the lit face rendered at 104% of Saturn's
    // own peak, so the rings outshone Saturn. Saturn's disc peaks at I/F = its albedo.
    const SATURN_PEAK_RADIANCE_FACTOR = 0.54;

    for (const muSun of Object.values(SOLAR_ELEVATION)) {
      expect(radianceFactor(TAU_MEAN, muSun, 1)).toBeLessThan(SATURN_PEAK_RADIANCE_FACTOR);
    }
  });

  it('divides by PI, because that is what the renderer expects', () => {
    // MeshStandardMaterial outputs irradiance * albedo / PI, so a material handing back
    // a radiance factor has to do the same. Missing it was the whole six-fold error.
    expect(RING_SCATTERING_SCALE).toBeCloseTo(RING_ALBEDO_TIMES_PHASE / Math.PI, 12);
  });

  it('brightens as the rings open toward 2032', () => {
    // Saturn's rings were edge-on in 2025 and reach their widest around 2032, so this
    // ordering is the seasonal behaviour and not a property of the model.
    expect(reflected(TAU_MEAN, SOLAR_ELEVATION[2026])).toBeLessThan(
      reflected(TAU_MEAN, SOLAR_ELEVATION[2027]),
    );
    expect(reflected(TAU_MEAN, SOLAR_ELEVATION[2027])).toBeLessThan(
      reflected(TAU_MEAN, SOLAR_ELEVATION[2030]),
    );
  });

  it('stays finite and positive right at the ring plane', () => {
    // Without the elevation clamp the divisions blow up exactly at ring plane
    // crossing, which is a date a person can actually navigate to.
    const atCrossing = reflected(TAU_MEAN, 0);

    expect(Number.isFinite(atCrossing)).toBe(true);
    expect(atCrossing).toBeGreaterThan(0);
    expect(reflected(TAU_MEAN, MIN_ELEVATION_SINE / 2)).toBe(atCrossing);
  });
});

describe('the unlit face', () => {
  /**
   * The contrast reversal, which is the model's best evidence that it is a model and
   * not a brightness multiplier.
   *
   * Seen from the shadowed side, Saturn's dense B ring goes dark because almost nothing
   * gets through it, while the sparse C ring and the Cassini Division stay bright
   * because plenty does. The rings appear to swap places. Cassini photographed exactly
   * this, and no per-ring constant could produce it.
   */
  it('darkens the dense B ring while leaving the sparse C ring bright', () => {
    const sparse = opticalDepthFromAlpha(0.25);
    const dense = opticalDepthFromAlpha(0.95);

    // The sparse ring transmits nearly as much as it reflects.
    expect(transmitted(sparse, 0.4) / reflected(sparse, 0.4)).toBeGreaterThan(0.8);
    // The dense one transmits almost nothing: a factor of fifty down.
    expect(transmitted(dense, 0.4) / reflected(dense, 0.4)).toBeLessThan(0.05);
    // So on the unlit face the order is reversed, which is the observation.
    expect(transmitted(sparse, 0.4)).toBeGreaterThan(transmitted(dense, 0.4));
    expect(reflected(sparse, 0.4)).toBeLessThan(reflected(dense, 0.4));
  });

  it('is never brighter than the lit face', () => {
    for (const alpha of [0.1, 0.3, 0.5, 0.7, 0.9, 0.99]) {
      const tau = opticalDepthFromAlpha(alpha);
      for (const muSun of [0.1, 0.3, 0.6, 0.9]) {
        expect(transmitted(tau, muSun), `alpha ${alpha}, mu0 ${muSun}`).toBeLessThanOrEqual(
          reflected(tau, muSun) + 1e-9,
        );
      }
    }
  });

  it('does not divide by zero when the two elevations coincide', () => {
    // A removable singularity at mu0 == mu, whose limit is (tau/mu) * exp(-tau/mu).
    // It is reachable in practice: it is the whole circle where the viewer sits at the
    // same elevation as the Sun on the far side.
    const exact = transmitted(TAU_MEAN, VIEW, VIEW);
    const limit = (TAU_MEAN / VIEW) * Math.exp(-TAU_MEAN / VIEW) * RING_SCATTERING_SCALE;

    expect(Number.isFinite(exact)).toBe(true);
    expect(exact).toBeCloseTo(limit, 6);

    // And it is continuous through that point rather than spiking.
    const before = transmitted(TAU_MEAN, VIEW - 0.01, VIEW);
    const after = transmitted(TAU_MEAN, VIEW + 0.01, VIEW);
    expect(Math.abs(before - exact)).toBeLessThan(0.05);
    expect(Math.abs(after - exact)).toBeLessThan(0.05);
  });
});

describe('apparent opacity', () => {
  it('grows with the slant path, which a flat alpha channel could not express', () => {
    // Face-on the ring shows its drawn opacity; edge-on it blocks nearly everything,
    // because the line of sight crosses far more particles.
    expect(apparentOpacity(TAU_MEAN, 1)).toBeCloseTo(0.705, 2);
    expect(apparentOpacity(TAU_MEAN, 0.5)).toBeCloseTo(0.913, 2);
    expect(apparentOpacity(TAU_MEAN, 0.2)).toBeGreaterThan(0.99);
  });

  it('is far more opaque than what shipped, which applied alpha twice', () => {
    // The other half of the bug: `map` already multiplies alpha, and an `alphaMap` was
    // set on top of it. three.js reads alphaMap from the GREEN channel, so the ring's
    // opacity was its own alpha times its green — 0.26 where it should have been 0.705.
    const SHIPPED = 0.26;

    expect(apparentOpacity(TAU_MEAN, VIEW) / SHIPPED).toBeGreaterThan(3);
  });

  it('keeps a gap a gap', () => {
    // The Cassini Division and the Encke Gap are drawn as near-zero alpha, and no
    // viewing angle may fill them in.
    expect(apparentOpacity(opticalDepthFromAlpha(0), 0.05)).toBe(0);
    expect(apparentOpacity(opticalDepthFromAlpha(0.02), VIEW)).toBeLessThan(0.05);
  });
});

describe('the model stays within itself', () => {
  it('is bounded, so no geometry can blow out the rings', () => {
    for (const alpha of [0, 0.2, 0.5, 0.8, 1]) {
      const tau = opticalDepthFromAlpha(alpha);
      for (const muSun of [0, 0.05, 0.3, 0.7, 1]) {
        for (const muView of [0.02, 0.1, 0.5, 1]) {
          for (const sameSide of [true, false]) {
            const value = singleScattering(tau, muSun, muView, sameSide);

            expect(Number.isFinite(value), `${alpha} ${muSun} ${muView}`).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            // Bounded by 1, not by 0.5. The first version of this test asserted 0.5,
            // confusing the radiance factor with a hemispheric albedo: `mu0 / (mu0 +
            // mu)` only stays under a half while the Sun is lower than the viewer, and
            // reaches 0.98 for an overhead Sun seen edge-on. That is real limb
            // brightening of a slab, not a runaway.
            expect(value).toBeLessThanOrEqual(1 + 1e-9);
          }
        }
      }
    }
  });

  it('rises with optical depth in reflection, always', () => {
    let previous = -1;
    for (const alpha of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const value = reflected(opticalDepthFromAlpha(alpha), 0.4);

      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it('peaks in the middle in transmission, rather than falling throughout', () => {
    // Written the other way round first, and the model was right and the test wrong.
    // Transmission is not monotonic: a vanishingly thin ring transmits everything but
    // scatters nothing, so you see nothing, and a very dense one lets nothing through.
    // In between there is a maximum, at tau = 2*ln(mu/mu0) / (1/mu0 - 1/mu) -- about
    // 0.45 for these angles, which is roughly the C ring.
    const at = (alpha: number) => transmitted(opticalDepthFromAlpha(alpha), 0.4);

    expect(at(0.05)).toBeLessThan(at(0.3));
    expect(at(0.3)).toBeLessThan(at(0.36));
    expect(at(0.36)).toBeGreaterThan(at(0.7));
    expect(at(0.7)).toBeGreaterThan(at(0.99));
    // And it really does go to nothing at both ends.
    expect(at(0.001)).toBeLessThan(0.02);
    expect(at(0.999)).toBeLessThan(0.02);
  });

  it('returns nothing where there is nothing', () => {
    expect(singleScattering(0, 0.5, 0.5, true)).toBe(0);
  });
});

describe('the shader participates in the scene it is drawn into', () => {
  /**
   * The rings were drawn behind Saturn from every angle, and this is why.
   *
   * The renderer runs with `logarithmicDepthBuffer: true`, so three.js writes depth
   * from the fragment shader. A custom material that leaves these chunks out writes
   * ordinary interpolated depth instead — a different quantity from the one every other
   * object writes — and the depth comparison stops meaning anything. Nothing else
   * catches it: it compiles, it renders, and it looks like a sorting choice.
   */
  it('writes logarithmic depth, like everything else in the scene', () => {
    expect(RING_SHADERS.vertex).toContain('logdepthbuf_pars_vertex');
    expect(RING_SHADERS.vertex).toContain('logdepthbuf_vertex');
    expect(RING_SHADERS.fragment).toContain('logdepthbuf_pars_fragment');
    expect(RING_SHADERS.fragment).toContain('logdepthbuf_fragment');
  });

  it('tone maps and encodes its output, like everything else in the scene', () => {
    // A ShaderMaterial gets neither for free. Without them the rings would sit at a
    // different exposure and in the wrong colour space from the planet beside them.
    expect(RING_SHADERS.fragment).toContain('tonemapping_fragment');
    expect(RING_SHADERS.fragment).toContain('colorspace_fragment');
  });

  it('takes its colour from the tint rather than the map', () => {
    // The map's RGB is blue-violet in the faint bands; see RING_TINT_SRGB. Only its
    // alpha is used, and this pins that so a future edit cannot quietly reintroduce
    // the cast.
    expect(RING_SHADERS.fragment).toContain('uTint * brightness');
    expect(RING_SHADERS.fragment).not.toContain('sampled.rgb');
  });
});

/** The shipped ring map, read at module scope so the describe body stays sync. */
const ringPng = PNG.sync.read(
  await readFile(
    join(import.meta.dirname, '../../public/textures', getBody('saturn').rings!.texture),
  ),
);

describe('the ring tint', () => {
  it('matches the dense bands of the shipped map, normalised', () => {
    // Re-derived from the file rather than trusted, the way the ring radii are.
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < ringPng.width * ringPng.height; i += 1) {
      if (ringPng.data[i * 4 + 3]! > 180) {
        r += ringPng.data[i * 4]!;
        g += ringPng.data[i * 4 + 1]!;
        b += ringPng.data[i * 4 + 2]!;
        n += 1;
      }
    }
    const peak = Math.max(r, g, b);

    expect(RING_TINT_SRGB[0]).toBeCloseTo(r / peak, 2);
    expect(RING_TINT_SRGB[1]).toBeCloseTo(g / peak, 2);
    expect(RING_TINT_SRGB[2]).toBeCloseTo(b / peak, 2);
    void n;
  });

  it('is a warm grey, because ring particles are ice stained by tholins', () => {
    const [r, g, b] = RING_TINT_SRGB;

    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    // Warm, but only slightly: it is off-white, not orange.
    expect(r - b).toBeLessThan(0.15);
  });

  it('rejects the violet cast the faint bands of the map carry', () => {
    // The reported symptom. Measured on the file: material below alpha 120 has blue
    // exceeding red, which is not a colour Saturn's rings are anywhere.
    let redSum = 0;
    let blueSum = 0;
    let n = 0;
    for (let i = 0; i < ringPng.width * ringPng.height; i += 1) {
      const alpha = ringPng.data[i * 4 + 3]!;
      if (alpha > 20 && alpha < 120) {
        redSum += ringPng.data[i * 4]!;
        blueSum += ringPng.data[i * 4 + 2]!;
        n += 1;
      }
    }

    // The file really is violet there...
    expect(blueSum / n - redSum / n).toBeGreaterThan(5);
    // ...and the tint we draw with is not.
    expect(RING_TINT_SRGB[2]).toBeLessThan(RING_TINT_SRGB[0]);
  });
});

describe('the shadow the planet throws on its rings', () => {
  // Saturn, in km, so the numbers below read as distances.
  const A = 60268;
  const C = 54364;
  const RING = 100000;
  /** Sun near the ring plane, as it is in 2026. */
  const SUN: readonly [number, number, number] = [1, 0, 0.125];

  const lit = (point: readonly [number, number, number]) => sunlitFraction(point, SUN, A, C);

  it('darkens the anti-solar side and leaves the sunward side alone', () => {
    expect(lit([-RING, 0, 0])).toBe(0);
    expect(lit([RING, 0, 0])).toBe(1);
  });

  it('does not shadow the flanks, ninety degrees from the Sun', () => {
    expect(lit([0, RING, 0])).toBe(1);
    expect(lit([0, -RING, 0])).toBe(1);
  });

  /** Half-width of the shadow across the ring plane at distance `x` down-sun, in km. */
  function shadowHalfWidth(x: number, sun: readonly [number, number, number]): number {
    let dark = 0;
    let light = A * 3;
    for (let i = 0; i < 60; i += 1) {
      const middle = (dark + light) / 2;
      if (sunlitFraction([-x, middle, 0], sun, A, C) < 0.5) {
        dark = middle;
      } else {
        light = middle;
      }
    }
    return (dark + light) / 2;
  }

  it('throws a shadow the width of the planet when the Sun is in the ring plane', () => {
    // The edge then sits at the equatorial radius exactly, which is what makes the
    // shadow read as the planet's silhouette rather than a wedge of arbitrary width.
    expect(shadowHalfWidth(RING, [1, 0, 0])).toBeCloseTo(A, 0);
  });

  it('narrows the shadow as the Sun rises, because the planet is oblate', () => {
    // The ray from a ring point toward a raised Sun climbs as it travels, and crosses
    // the planet where its silhouette is narrower. Measured: 0.974 of the equatorial
    // radius in 2026, 0.718 by 2030 as the rings open. Predicted exactly by the
    // ellipsoid's own profile, A * sqrt(1 - (z/C)^2) at the height the ray reaches.
    expect(shadowHalfWidth(RING, [1, 0, 0.125]) / A).toBeCloseTo(0.974, 2);
    expect(shadowHalfWidth(RING, [1, 0, 0.417]) / A).toBeCloseTo(0.718, 2);

    const height = (0.125 / Math.sqrt(1 + 0.125 ** 2)) * RING;
    expect(shadowHalfWidth(RING, [1, 0, 0.125])).toBeCloseTo(
      A * Math.sqrt(1 - (height / C) ** 2),
      -2,
    );
  });

  it('stretches the shadow right across the rings when the Sun is near their plane', () => {
    // The reach along the ring plane is C / tan(solar elevation), so at 2026's 7.2
    // degrees it is about 431,000 km -- three times the outer ring. That is why a
    // photograph taken now shows the shadow crossing the entire system, and why one
    // taken with the rings wide open shows only a stub.
    const RING_OUTER = 141880;
    const reach = (muSun: number) => (C * Math.sqrt(1 - muSun ** 2)) / muSun;

    expect(reach(0.125)).toBeGreaterThan(RING_OUTER * 2);
    expect(lit([-RING_OUTER * 0.99, 0, 0])).toBe(0);

    // Wide open, the shadow no longer reaches the middle of the rings at all: the cone
    // passes below the ring plane before it gets there.
    expect(sunlitFraction([-RING, 0, 0], [1, 0, 0.7], A, C)).toBe(1);
  });

  it('softens the edge, but only just', () => {
    const edge = shadowHalfWidth(RING, [1, 0, 0.125]);

    // Enough to stop the boundary aliasing across the ring, narrow enough to stay
    // physical: the real penumbra is about 48 km at this distance, and this is a few
    // times that.
    expect(lit([-RING, edge * (1 - 3 * SHADOW_SOFTNESS), 0])).toBe(0);
    expect(lit([-RING, edge * (1 + 3 * SHADOW_SOFTNESS), 0])).toBe(1);
    // And the transition is monotone through it, not a spike.
    expect(lit([-RING, edge * 0.999, 0])).toBeLessThan(lit([-RING, edge * 1.001, 0]));
  });

  it('shadows nothing when the Sun is straight above the ring plane', () => {
    // Not a Saturn geometry, but the degenerate case the maths has to survive: the
    // shadow collapses onto the planet itself and the whole ring stays lit.
    const overhead: readonly [number, number, number] = [0, 0, 1];

    expect(sunlitFraction([RING, 0, 0], overhead, A, C)).toBe(1);
    expect(sunlitFraction([-RING, 0, 0], overhead, A, C)).toBe(1);
  });

  it('is applied to sunlight and not to the ambient fill', () => {
    // Flood and Shadow lighting add ambient for legibility. Occluding that with a
    // planet would apply a physical effect to an unphysical light.
    expect(RING_SHADERS.fragment).toContain('uSunIntensity * sunlit + uAmbient');
  });
});
