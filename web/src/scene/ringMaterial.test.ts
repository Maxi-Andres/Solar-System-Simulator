import { describe, expect, it } from 'vitest';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { getBody } from '@sss/tools/catalog';
import {
  apparentOpacity,
  chandrasekharH,
  MIN_ELEVATION_SINE,
  multipleScattering,
  opticalDepthFromAlpha,
  RADIANCE_FACTOR_TO_RADIANCE,
  RING_ASYMMETRY,
  RING_PHASE_AT_OPPOSITION,
  henyeyGreenstein,
  cosPhaseFromAbove,
  RING_SHADERS,
  RING_SHADING,
  RING_FLAT_RADIANCE_FACTOR,
  RING_RADIANCE_FACTOR_GLSL,
  RING_OPACITY_GLSL,
  RING_SINGLE_SCATTERING_ALBEDO,
  RING_TINT_SRGB,
  SHADOW_SOFTNESS,
  singleScattering,
  ringRadianceFactor,
  sunlitFraction,
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

/**
 * The full radiance factor, which is the unit ring photometry is published in.
 *
 * Comparisons have to happen here rather than in rendered radiance: the two differ by
 * a factor of PI, and an early version of these tests compared the model's radiance
 * against Lambert's bare cosine, which is not a comparison of anything. A Lambert
 * surface has I/F = albedo * mu0.
 */
const lit = (tau: number, muSun: number, muView = VIEW, cosPhase = 1) =>
  ringRadianceFactor(tau, muSun, muView, true, cosPhase);
const unlit = (tau: number, muSun: number, muView = VIEW, cosPhase = 1) =>
  ringRadianceFactor(tau, muSun, muView, false, cosPhase);

/** Just the directional term, for the tests that are about it specifically. */
const reflected = (tau: number, muSun: number, muView = VIEW) =>
  singleScattering(tau, muSun, muView, true);
const transmitted = (tau: number, muSun: number, muView = VIEW) =>
  singleScattering(tau, muSun, muView, false);

/** Reflectance of a Lambertian stand-in, so the comparison means something. */
const LAMBERT_ALBEDO = 0.5;

/** Saturn's own disc peaks at its albedo, which is the yardstick that matters. */
const SATURN_PEAK_RADIANCE_FACTOR = 0.54;

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

      expect(lit(TAU_MEAN, muSun, 1), year).toBeGreaterThan(lambert);
      expect(lit(TAU_MEAN, muSun, 0.5), year).toBeGreaterThan(lambert * 2);
    }
  });

  it('reproduces the measured B ring radiance factor with the rings open', () => {
    // The anchor the whole brightness scale is set from, checked back: Cassini puts the
    // B ring at I/F = 0.5 to 0.6 at low phase with the rings well open. 2030 geometry
    // at a typical viewing elevation lands at 0.489.
    const dense = opticalDepthFromAlpha(0.95);

    expect(lit(dense, SOLAR_ELEVATION[2030], 0.5)).toBeGreaterThan(0.45);
    expect(lit(dense, SOLAR_ELEVATION[2030], 0.5)).toBeLessThan(0.65);
  });

  it('divides by PI, because that is what the renderer expects', () => {
    // MeshStandardMaterial outputs irradiance * albedo / PI, so a material handing back
    // a radiance factor has to do the same. Missing it was a six-fold error that made
    // the rings brighter than Saturn.
    expect(RADIANCE_FACTOR_TO_RADIANCE).toBeCloseTo(1 / Math.PI, 12);
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
    const limit = (TAU_MEAN / VIEW) * Math.exp(-TAU_MEAN / VIEW);

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
  it('is neutral grey, matching the reference', () => {
    // NASA Eyes' rings measure rgb(23.7, 23.7, 23.7) in a close-up -- grey to within a
    // tenth of a count. Ours measured rgb(17.3, 13.1, 9.9), which reads as brown.
    const [r, g, b] = RING_TINT_SRGB;

    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('gives up a real but counterproductive warmth to get there', () => {
    // Worth pinning what is being traded away, because the warmth was not invented: the
    // dense bands of the shipped map really do measure warm, and ring particles really
    // are ice stained by tholins. At the brightness the rings are drawn at, that small
    // bias lands in brown rather than in off-white -- a warm hue shows far more in
    // shadow than in light.
    let red = 0;
    let blue = 0;
    let n = 0;
    for (let i = 0; i < ringPng.width * ringPng.height; i += 1) {
      if (ringPng.data[i * 4 + 3]! > 180) {
        red += ringPng.data[i * 4]!;
        blue += ringPng.data[i * 4 + 2]!;
        n += 1;
      }
    }

    expect(red / n).toBeGreaterThan(blue / n);
    // And we deliberately do not carry it.
    expect(RING_TINT_SRGB[0]).toBe(RING_TINT_SRGB[2]);
  });

  it('ignores the map RGB entirely, violet faint bands included', () => {
    // Measured on the file: material below alpha 120 has blue exceeding red, which is
    // not a colour Saturn's rings are anywhere. Only the alpha channel is read.
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

    expect(blueSum / n - redSum / n).toBeGreaterThan(5);
    expect(RING_SHADERS.fragment).not.toContain('sampled.rgb');
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

describe('multiple scattering, and why single scattering alone was not enough', () => {
  /**
   * The defect this whole term exists for.
   *
   * Shipped with only the directional term, the rings went near-black viewed edge-on
   * from the shadowed side and white from the lit side. Measured, the ratio between the
   * two faces ran from 3 looking straight down at the rings to **12,625** looking along
   * them, and the lit face reached a radiance factor of 0.95 -- brighter than Saturn's
   * own disc.
   *
   * Both ends were artefacts of leaving multiple scattering out, and both are fixed by
   * one term rather than two patches.
   */
  const GRAZING = [1, 0.5, 0.2, 0.1, 0.05, 0.02] as const;

  /**
   * The phase angle a polar view of the rings actually sits at.
   *
   * Counter-intuitive and load-bearing: with the Sun 7 degrees above the ring plane, a
   * camera above the pole is 83 degrees away from it in phase. Every geometry test here
   * uses it, because testing at opposition is testing the one case the app rarely shows.
   */
  const POLAR_COS_PHASE = cosPhaseFromAbove(SOLAR_ELEVATION[2026]);

  it('keeps the two faces within a factor of ten at every viewing angle', () => {
    // Was 12,625 at the most grazing angle. A large ratio is correct -- the unlit face
    // of a dense ring really is much darker -- but a four-order-of-magnitude one is a
    // model breaking down, not a ring.
    for (const muView of GRAZING) {
      const ratio =
        lit(TAU_MEAN, SOLAR_ELEVATION[2026], muView, POLAR_COS_PHASE) /
        unlit(TAU_MEAN, SOLAR_ELEVATION[2026], muView, POLAR_COS_PHASE);

      expect(ratio, `mu = ${muView}`).toBeGreaterThan(1);
      expect(ratio, `mu = ${muView}`).toBeLessThan(10);
    }
  });

  it('never lets the unlit face go black', () => {
    // The reported symptom, and the physical reason it was wrong: light that cannot
    // pass straight through diffuses through instead. Single scattering says a slab of
    // optical depth 1.2 lit at 7 degrees extinguishes the beam completely, and it does
    // -- but the light does not vanish.
    for (const muView of GRAZING) {
      expect(
        unlit(TAU_MEAN, SOLAR_ELEVATION[2026], muView, POLAR_COS_PHASE),
        `mu = ${muView}`,
      ).toBeGreaterThan(0.005);
    }
    // Single scattering on its own really does collapse, which is what makes the point.
    expect(transmitted(TAU_MEAN, SOLAR_ELEVATION[2026], 0.1)).toBeLessThan(1e-3);
  });

  it('keeps the rings darker than the planet at every angle worth looking from', () => {
    // The complaint that drove three rounds of this: the rings were brighter than
    // Saturn. At the geometry the app actually shows they now sit well under it.
    for (const muView of GRAZING) {
      expect(
        lit(TAU_MEAN, SOLAR_ELEVATION[2026], muView, POLAR_COS_PHASE),
        `mu = ${muView}`,
      ).toBeLessThan(SATURN_PEAK_RADIANCE_FACTOR);
    }
  });

  it('softens the contrast reversal without removing it', () => {
    // The reversal is real and was the previous model's best evidence, so it has to
    // survive: the dense B ring still goes much darker on the unlit face than the
    // sparse C ring does. It is just no longer a factor of fifty, because diffusion
    // carries light through the dense ring too.
    const sparse = opticalDepthFromAlpha(0.25);
    const dense = opticalDepthFromAlpha(0.95);
    const openSun = SOLAR_ELEVATION[2030];

    const sparseRatio = unlit(sparse, openSun, 0.5) / lit(sparse, openSun, 0.5);
    const denseRatio = unlit(dense, openSun, 0.5) / lit(dense, openSun, 0.5);

    // The sparse ring is nearly as bright either side...
    expect(sparseRatio).toBeGreaterThan(0.85);
    // ...while the dense one is much darker, but not extinguished. 0.069 measured,
    // which lands inside the published range for the B ring's unlit face: I/F 0.02 to
    // 0.05 against 0.5 lit, so 0.04 to 0.10.
    //
    // This bound was 0.15 when the albedo was still 0.95, and it moved when the albedo
    // was corrected to 0.55 -- correctly, and for a reason worth keeping: the diffuse
    // term is proportional to how much light a particle re-emits, so a less reflective
    // ring passes less through and its shadowed face is darker.
    expect(denseRatio).toBeLessThan(0.12);
    expect(denseRatio).toBeGreaterThan(0.04);
    // And on the unlit face the order really is reversed.
    expect(unlit(sparse, openSun, 0.5)).toBeGreaterThan(unlit(dense, openSun, 0.5));
    expect(lit(sparse, openSun, 0.5)).toBeLessThan(lit(dense, openSun, 0.5));
  });

  it('still leaves a gap completely empty', () => {
    // Multiple scattering must not fill in the Cassini Division. Nothing scatters where
    // there is nothing to scatter off.
    expect(ringRadianceFactor(opticalDepthFromAlpha(0), 0.125, 0.2, true)).toBe(0);
    expect(ringRadianceFactor(opticalDepthFromAlpha(0), 0.125, 0.2, false)).toBe(0);
  });
});

describe("Chandrasekhar's H-function", () => {
  it('is bounded, and exactly 1 at grazing', () => {
    // The property that fixes the runaway. An unbounded fitted constant has no such
    // limit, which is how the lit face reached a radiance factor of 0.95.
    expect(chandrasekharH(0)).toBe(1);
    for (const mu of [0, 0.1, 0.5, 1]) {
      expect(chandrasekharH(mu)).toBeGreaterThanOrEqual(1);
      expect(chandrasekharH(mu)).toBeLessThan(3);
    }
  });

  it('rises with the single-scattering albedo, so bright material diffuses more', () => {
    expect(chandrasekharH(0.5, 0.2)).toBeLessThan(chandrasekharH(0.5, 0.6));
    expect(chandrasekharH(0.5, 0.6)).toBeLessThan(chandrasekharH(0.5, 0.95));
    // A perfect absorber diffuses nothing: H is 1 everywhere and the term vanishes.
    expect(chandrasekharH(0.5, 0)).toBe(1);
    expect(multipleScattering(TAU_MEAN, 0.4, 0.5, 0)).toBe(0);
  });

  it('makes the diffuse term symmetric between the two faces', () => {
    // Which is the whole reason it lifts the unlit face: light that has bounced several
    // times no longer remembers which side it came in from. The directional term is
    // what stays asymmetric.
    const term = multipleScattering(TAU_MEAN, 0.4, 0.5);

    expect(term).toBeGreaterThan(0);
    expect(multipleScattering(TAU_MEAN, 0.4, 0.5)).toBe(term);
  });

  it('uses the published albedo for ring particles, not for pristine ice', () => {
    // The first version used 0.95, which is laboratory ice. Real ring particles are
    // contaminated and the published range is 0.5 to 0.7. Getting this wrong set the
    // brightness directly and inflated the diffuse term on top of it.
    expect(RING_SINGLE_SCATTERING_ALBEDO).toBeGreaterThan(0.5);
    expect(RING_SINGLE_SCATTERING_ALBEDO).toBeLessThan(0.7);
    // And a backscattering phase function, which is what ring particles have.
    expect(RING_ASYMMETRY).toBeLessThan(0);
  });

  it('is in the scattering path of the shader as well as here', () => {
    // Checked against that path's source rather than the assembled shader, because the
    // flat path is the one currently compiled in. See RING_SHADING.
    expect(RING_RADIANCE_FACTOR_GLSL.scattering).toContain('henyeyGreenstein');
    expect(RING_RADIANCE_FACTOR_GLSL.scattering).toContain('phase * max(scattered, 0.0)');
  });
});

describe('the phase function, and the geometry that exposed it', () => {
  /**
   * The last thing making the rings too bright, and the least obvious.
   *
   * The phase function was a constant 3.0 -- its value near opposition -- applied at
   * every phase angle. What makes that a factor-of-five error rather than a rounding
   * one is a geometry easy to overlook: **a polar view of the rings is a high phase
   * angle** whenever the Sun is near their plane, which in 2026 it is. Looking straight
   * down at the rings puts the Sun 83 degrees away from the camera. The rings are
   * side-lit and were being given a back-lit particle's brightness.
   */
  it('reads a polar view as a high phase angle, not opposition', () => {
    const cosPhase = cosPhaseFromAbove(SOLAR_ELEVATION[2026]);
    const degrees = (Math.acos(cosPhase) * 180) / Math.PI;

    expect(degrees).toBeCloseTo(82.8, 1);
    // Which is nowhere near the opposition the old constant assumed.
    expect(cosPhase).toBeLessThan(0.2);
  });

  it('falls by more than a factor of ten from opposition to side-lit', () => {
    const opposition = henyeyGreenstein(1);
    const sideLit = henyeyGreenstein(cosPhaseFromAbove(SOLAR_ELEVATION[2026]));

    expect(opposition / sideLit).toBeGreaterThan(10);
    expect(RING_PHASE_AT_OPPOSITION).toBe(opposition);
  });

  it('peaks at opposition and falls monotonically away from it', () => {
    let previous = Infinity;
    for (const cosPhase of [1, 0.9, 0.5, 0.125, 0, -0.5, -1]) {
      const value = henyeyGreenstein(cosPhase);

      expect(value, `cosPhase ${cosPhase}`).toBeLessThan(previous);
      expect(value).toBeGreaterThan(0);
      previous = value;
    }
  });

  it('is normalised the way Henyey-Greenstein is, so isotropic means 1', () => {
    // A zero asymmetry is an isotropic scatterer, which must return 1 at every angle.
    for (const cosPhase of [1, 0.3, -0.4, -1]) {
      expect(henyeyGreenstein(cosPhase, 0)).toBeCloseTo(1, 12);
    }
  });

  it('reproduces the NASA Eyes screenshot it was fitted against', () => {
    // Measured off a NASA Eyes capture at this instant and viewpoint: rings 20/255
    // against a planet at 139/255, which is a radiance factor of 0.0144 through this
    // renderer's tone curve. This is the number three rounds of "still too bright" were
    // converging on, so it is worth pinning exactly.
    const value = lit(TAU_MEAN, SOLAR_ELEVATION[2026], 1, cosPhaseFromAbove(SOLAR_ELEVATION[2026]));

    expect(value).toBeCloseTo(0.0144, 2);
  });

  it('still reaches the published B ring brightness at opposition', () => {
    // The other anchor, which the fit had to satisfy at the same time. Both parameters
    // move both numbers, which is why they were fitted together rather than in turn.
    const dense = opticalDepthFromAlpha(0.95);

    expect(lit(dense, SOLAR_ELEVATION[2030], 0.5, 1)).toBeGreaterThan(0.45);
    expect(lit(dense, SOLAR_ELEVATION[2030], 0.5, 1)).toBeLessThan(0.65);
  });

  it('does not apply a phase function to diffuse light', () => {
    // Multiply-scattered light has bounced enough to be isotropic, so giving it a
    // direction would be inventing one. It is also what keeps the rings from going
    // fully dark at high phase.
    expect(multipleScattering(TAU_MEAN, 0.4, 0.5)).toBe(multipleScattering(TAU_MEAN, 0.4, 0.5));
    expect(RING_RADIANCE_FACTOR_GLSL.scattering).toContain(
      'phase * max(scattered, 0.0) + max(multiple, 0.0)',
    );
  });
});

describe('the shading actually in use', () => {
  /**
   * The rings are drawn flat, and this block exists to make that a decision rather
   * than a drift.
   *
   * Four rounds of fixing the physical model each found a real error and each revealed
   * the next. What the last measurement showed is that the remaining gap is not a bug:
   * NASA Eyes' rings sit at 0.106 of Saturn's brightness from above the pole and 0.060
   * from near the ring plane -- they do not brighten edge-on. The model brightened by
   * 3.6x, because a slab of particles seen edge-on genuinely does return more light per
   * unit projected area. Correct, and not what the reference shows.
   *
   * Closing that properly needs a measured particle phase curve, a finite-slab multiple
   * scattering solution and the ring's vertical thickness -- a research problem. The
   * model below stays, tested and correct as far as it goes, as the starting point for
   * whoever picks it up. See the note at the top of ringMaterial.ts.
   */
  it('is flat, a deliberate departure from this project first principle', () => {
    expect(RING_SHADING).toBe('flat');
    expect(RING_SHADERS.fragment).toContain('float radianceFactor = uFlatRadianceFactor;');
    // And the scattering path really is absent from what gets compiled.
    expect(RING_SHADERS.fragment).not.toContain('henyeyGreenstein(cosPhase)');
  });

  it('is view-independent, which is the whole point of choosing it', () => {
    // The symptom this replaced: white from one angle, near-black from another. A
    // constant cannot do that. There is nothing in the compiled radiance factor that
    // depends on where the camera or the Sun is.
    const path = RING_RADIANCE_FACTOR_GLSL.flat;

    expect(path).not.toContain('toCamera');
    expect(path).not.toContain('uSunLocal');
    expect(path).not.toContain('muView');
    expect(path).not.toContain('muSun');
  });

  it('lands the ring mean between the two brightnesses NASA Eyes shows', () => {
    // The constant is applied *before* the map's opacity, so what matters is the
    // product. The map's mean alpha is 0.71, so the ring means about 0.014 -- between
    // the 0.0135 measured from a polar view of NASA Eyes and the 0.0085 from a grazing
    // one. Their two views differ by 1.8x, so no constant reproduces both.
    const MEAN_MAP_ALPHA = 0.71;
    const meanRadianceFactor = RING_FLAT_RADIANCE_FACTOR * MEAN_MAP_ALPHA;

    expect(meanRadianceFactor).toBeGreaterThan(0.0085);
    expect(meanRadianceFactor).toBeLessThan(0.0185);
  });

  it('keeps everything that was geometry rather than photometry', () => {
    // What was set aside is the light model. The shadow, the optical depth structure
    // and the slant-path opacity are geometry, they were never the problem, and they
    // stay.
    expect(RING_SHADERS.fragment).toContain('sunlitFraction');
    expect(RING_SHADERS.fragment).toContain('uMaxAlpha');
    // The band structure, which in the flat path is the only thing carrying it.
    expect(RING_SHADERS.fragment).toContain('float opacity = alphaNormal * uFade;');
  });

  it('leaves the physical model intact and reachable', () => {
    // One constant away, and the reason it is kept rather than deleted: it is four
    // rounds of real corrections, it is tested, and it is where the next attempt
    // should start rather than from nothing.
    expect(RING_RADIANCE_FACTOR_GLSL.scattering).toContain('uAlbedo * 0.25');
    expect(ringRadianceFactor(TAU_MEAN, 0.417, 0.5, true, 1)).toBeGreaterThan(0);
  });
});

describe('band structure in the flat path', () => {
  /**
   * The first flat rings came out with almost no visible structure, and the cause is
   * worth keeping.
   *
   * With a constant brightness, *every* bit of the ring's structure has to arrive
   * through opacity. The scattering path's slant-path opacity, `1 - exp(-tau/mu)`,
   * saturates to 1 for every band as the view goes edge-on -- so it erased the structure
   * exactly where it was being looked at. Measured against a NASA close-up: their bands
   * span a 5.1x brightness range, ours spanned 1.7x.
   */
  it('takes opacity straight from the map, so the bands survive every angle', () => {
    expect(RING_OPACITY_GLSL.flat).toContain('alphaNormal');
    expect(RING_OPACITY_GLSL.flat).not.toContain('muView');
    // And the path that saturates is still there for the model that needs it.
    expect(RING_OPACITY_GLSL.scattering).toContain('exp(-tau / muView)');
  });

  it('has a map with more contrast than the reference needs', () => {
    // p5 to p95 of the shipped map's radial alpha profile is a 7.4x range, against the
    // 5.1x NASA's bands span. The structure was always in the file; the shader was
    // throwing it away.
    const columns: number[] = [];
    for (let x = 0; x < ringPng.width; x += 1) {
      let total = 0;
      for (let y = 0; y < ringPng.height; y += 1) {
        total += ringPng.data[(y * ringPng.width + x) * 4 + 3]!;
      }
      columns.push(total / ringPng.height / 255);
    }
    const visible = columns.filter((a) => a > 0.03).sort((a, b) => a - b);
    const percentile = (q: number) => visible[Math.floor((q / 100) * (visible.length - 1))]!;

    expect(percentile(95) / percentile(5)).toBeGreaterThan(5);
  });

  it('keeps a gap transparent, which the slant path could not promise', () => {
    // Saturated slant opacity fills in anything with a trace of material once the view
    // is grazing enough. Face-on alpha cannot: a gap is a gap from every angle.
    expect(RING_OPACITY_GLSL.flat.trim().startsWith('//')).toBe(true);
    expect(RING_OPACITY_GLSL.flat).toContain('float opacity = alphaNormal * uFade;');
  });
});
