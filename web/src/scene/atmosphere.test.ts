import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import {
  airRefractiveIndex,
  ATMOSPHERE_SHADERS,
  ATMOSPHERE_TOP_KM,
  atmosphereMaterial,
  atmosphereRadiusRatio,
  configureAtmosphere,
  integratedDensity,
  KING_CORRECTION,
  MOLECULAR_NUMBER_DENSITY,
  PUBLISHED_ZENITH_OPTICAL_DEPTH_550,
  RAYLEIGH_BETA_PER_M,
  RAYLEIGH_SCALE_HEIGHT_KM,
  RAYLEIGH_WAVELENGTHS_NM,
  rayleighCoefficient,
  rayleighPhase,
  ATMOSPHERE_SEGMENTS,
  chapmanColumn,
  erfcx,
  ERFCX_SHAPE,
  VIEW_SAMPLES,
} from './atmosphere.ts';

/**
 * Earth's sky.
 *
 * This is the one feature here that is derived end to end rather than calibrated, so the
 * tests are a different shape from the ring ones: instead of pinning what was measured
 * off a reference, they check that constants which never saw a screenshot reproduce
 * numbers that were published before this project existed.
 *
 * Two of them do real work. The zenith optical depth is the whole derivation collapsed
 * into one figure that atmospheric science quotes independently. And the ratio between a
 * grazing path and a vertical one has a closed form, which is what makes a limb bright
 * and a nadir view faint -- the single most visible thing the shader does.
 */

const earth = getBody('earth');
const scaleHeightRatio = RAYLEIGH_SCALE_HEIGHT_KM / earth.radiusEquatorialKm;
const shellRatio = atmosphereRadiusRatio(earth.radiusEquatorialKm);

/** Optical depth straight up through the whole atmosphere, per channel. */
const zenithOpticalDepth = (channel: number) =>
  RAYLEIGH_BETA_PER_M[channel]! * RAYLEIGH_SCALE_HEIGHT_KM * 1000;

describe('the scattering coefficient', () => {
  it('reproduces the published zenith optical depth at 550 nm', () => {
    // The number that says the derivation is a derivation. Rayleigh's expression with
    // Loschmidt's number, the King correction and the Peck and Reeder dispersion, times
    // the scale height -- against a figure atmospheric science publishes for Earth.
    // Nothing in the chain was fitted to it.
    expect(zenithOpticalDepth(1)).toBeCloseTo(PUBLISHED_ZENITH_OPTICAL_DEPTH_550, 3);
    const error =
      Math.abs(zenithOpticalDepth(1) - PUBLISHED_ZENITH_OPTICAL_DEPTH_550) /
      PUBLISHED_ZENITH_OPTICAL_DEPTH_550;
    expect(error).toBeLessThan(0.01);
  });

  it('needs the dispersion it would be tempting to drop', () => {
    // n - 1 moves by under 2% across the visible, but beta goes as (n^2 - 1)^2, and a
    // fixed index misses the published depth by more than a tenth -- which is the
    // difference between agreeing with a measurement and merely being near it.
    const fixedIndex = 1.0002926;
    const wavelengthM = 550e-9;
    const fixed =
      ((8 * Math.PI ** 3 * (fixedIndex ** 2 - 1) ** 2) /
        (3 * MOLECULAR_NUMBER_DENSITY * wavelengthM ** 4)) *
      KING_CORRECTION *
      RAYLEIGH_SCALE_HEIGHT_KM *
      1000;

    expect(fixed / PUBLISHED_ZENITH_OPTICAL_DEPTH_550).toBeGreaterThan(1.04);
  });

  it('scales as the inverse fourth power of wavelength', () => {
    // Rayleigh's law itself. Not exactly (680/440)^4, and it should not be: the
    // dispersion in n pushes the blue end a little further still.
    const ratio = RAYLEIGH_BETA_PER_M[2]! / RAYLEIGH_BETA_PER_M[0]!;
    const pureFourthPower = (RAYLEIGH_WAVELENGTHS_NM[0] / RAYLEIGH_WAVELENGTHS_NM[2]) ** 4;

    expect(ratio).toBeCloseTo(5.91, 1);
    expect(ratio).toBeGreaterThan(pureFourthPower);
    expect(ratio / pureFourthPower).toBeLessThan(1.05);
  });

  it('gives air a refractive index within a few parts per million of 1.000293', () => {
    for (const nm of RAYLEIGH_WAVELENGTHS_NM) {
      expect(airRefractiveIndex(nm)).toBeGreaterThan(1.00027);
      expect(airRefractiveIndex(nm)).toBeLessThan(1.00029);
    }
    // Shorter wavelengths refract more, which is the sign of the dispersion above.
    expect(airRefractiveIndex(440)).toBeGreaterThan(airRefractiveIndex(680));
  });

  it('is monotone in wavelength and computed, not tabulated', () => {
    expect(rayleighCoefficient(440)).toBeGreaterThan(rayleighCoefficient(550));
    expect(rayleighCoefficient(550)).toBeGreaterThan(rayleighCoefficient(680));
  });
});

describe('the phase function', () => {
  it('integrates to one over the sphere', () => {
    // The property that makes it a phase function rather than a shape: scattering
    // redistributes light, it does not create any. Checked by quadrature so that a
    // mistyped constant cannot pass.
    let total = 0;
    const steps = 2000;
    for (let i = 0; i < steps; i += 1) {
      const theta = ((i + 0.5) / steps) * Math.PI;
      total += rayleighPhase(Math.cos(theta)) * Math.sin(theta) * (Math.PI / steps);
    }
    expect(total * 2 * Math.PI).toBeCloseTo(1, 6);
  });

  it('is twice as strong along the light as across it', () => {
    // Forward and backward alike, which is why a limb glows both toward the Sun and away
    // from it, and why the brightest sky is never at right angles to it.
    expect(rayleighPhase(1)).toBeCloseTo(rayleighPhase(-1), 12);
    expect(rayleighPhase(1) / rayleighPhase(0)).toBeCloseTo(2, 12);
  });
});

describe('how much air a ray goes through', () => {
  it('is one scale height looking straight down from space', () => {
    // The closed form: the integral of exp(-h/H) from the ground upward is H, whatever
    // else is true. If the marcher disagrees with this it is not integrating density.
    const depth = integratedDensity([0, 0, 10], [0, 0, -1], scaleHeightRatio, shellRatio);

    expect(depth).toBeCloseTo(scaleHeightRatio, 6);
  });

  it('is about seventy times that along the horizon', () => {
    // sqrt(2 pi R H) for a ray grazing the surface, against H looking down. This ratio is
    // the reason the limb is the brightest part of the sky and the reason an atmosphere
    // reads as a shell rather than as a tint.
    const tangent = integratedDensity(
      // Aimed so the ray just skims the surface: offset by one radius, pointing across.
      [1.0, 0, 10],
      [0, 0, -1],
      scaleHeightRatio,
      shellRatio,
      4096,
    );

    expect(tangent / scaleHeightRatio).toBeCloseTo(Math.sqrt((2 * Math.PI) / scaleHeightRatio), 0);
    expect(tangent / scaleHeightRatio).toBeGreaterThan(60);
    expect(tangent / scaleHeightRatio).toBeLessThan(80);
  });

  it('makes the limb optically thick in blue and merely hazy in red', () => {
    const tangent = integratedDensity([1.0, 0, 10], [0, 0, -1], scaleHeightRatio, shellRatio, 4096);
    const radiusM = earth.radiusEquatorialKm * 1000;
    const red = RAYLEIGH_BETA_PER_M[0]! * radiusM * tangent;
    const blue = RAYLEIGH_BETA_PER_M[2]! * radiusM * tangent;

    // Blue is gone by the time it has crossed the limb; red is most of the way through.
    expect(blue).toBeGreaterThan(10);
    expect(Math.exp(-blue)).toBeLessThan(0.001);
    expect(red).toBeLessThan(4);
    expect(Math.exp(-red)).toBeGreaterThan(0.02);
  });

  it('is zero for a ray that misses the atmosphere entirely', () => {
    expect(integratedDensity([0, 0, 10], [0, 0, 1], scaleHeightRatio, shellRatio)).toBe(0);
    expect(integratedDensity([5, 0, 10], [0, 0, -1], scaleHeightRatio, shellRatio)).toBe(0);
  });
});

describe('the shell it is drawn on', () => {
  it('stands 100 km off the ground, which is 1.6% of Earth', () => {
    expect(shellRatio).toBeCloseTo(1 + ATMOSPHERE_TOP_KM / earth.radiusEquatorialKm, 12);
    expect(shellRatio).toBeCloseTo(1.0157, 4);
  });

  it('cuts the atmosphere off where there is nothing left to cut', () => {
    // Eleven millionths of sea level density. Where exactly the shell sits changes the
    // picture by nothing, which is what makes a convention an acceptable boundary.
    const densityAtTop = Math.exp(-ATMOSPHERE_TOP_KM / RAYLEIGH_SCALE_HEIGHT_KM);

    expect(densityAtTop).toBeLessThan(1e-5);
  });

  it('is configured in planet radii, so the shader never sees a kilometre', () => {
    const material = atmosphereMaterial();
    configureAtmosphere(material, earth.radiusEquatorialKm, earth.radiusPolarKm);

    expect(material.uniforms.uAtmosphereRadius!.value).toBeCloseTo(shellRatio, 12);
    expect(material.uniforms.uScaleHeight!.value).toBeCloseTo(scaleHeightRatio, 12);
    expect(material.uniforms.uFlattening!.value).toBeCloseTo(
      earth.radiusPolarKm / earth.radiusEquatorialKm,
      12,
    );

    // Beta arrives already multiplied by the radius, so an optical depth in the shader is
    // beta times a path length measured in radii. The green channel times the scale
    // height has to come back out as the published zenith depth.
    const beta = material.uniforms.uBeta!.value as { x: number; y: number; z: number };
    expect(beta.y * scaleHeightRatio).toBeCloseTo(PUBLISHED_ZENITH_OPTICAL_DEPTH_550, 3);
    expect(beta.z).toBeGreaterThan(beta.x);
  });
});

describe('the material', () => {
  it('carries the logarithmic depth chunks', () => {
    // Not an implementation detail. Omitting them compiles cleanly, renders something
    // plausible and writes depth on a different scale from everything else in the scene,
    // which put the rings behind Saturn from every angle when it happened there.
    expect(ATMOSPHERE_SHADERS.vertex).toContain('logdepthbuf_pars_vertex');
    expect(ATMOSPHERE_SHADERS.vertex).toContain('logdepthbuf_vertex');
    expect(ATMOSPHERE_SHADERS.fragment).toContain('logdepthbuf_pars_fragment');
    expect(ATMOSPHERE_SHADERS.fragment).toContain('logdepthbuf_fragment');
  });

  it('tone maps and encodes like everything else in the scene', () => {
    expect(ATMOSPHERE_SHADERS.fragment).toContain('tonemapping_fragment');
    expect(ATMOSPHERE_SHADERS.fragment).toContain('colorspace_fragment');
  });

  it('attenuates what is behind it rather than only adding to it', () => {
    // Plain additive blending is the easy choice and says the air never dims anything.
    // At the limb, where the optical depth in blue passes ten, that is not a small lie.
    const material = atmosphereMaterial();

    expect(material.blending).toBe(THREE.CustomBlending);
    expect(material.blendSrc).toBe(THREE.OneFactor);
    expect(material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(material.depthWrite).toBe(false);
  });

  it('tests the planet as an ellipsoid, not as a sphere', () => {
    // Earth is 21 km flatter pole to pole. Marching against a sphere would start the
    // atmosphere that far above the ground at the poles.
    expect(ATMOSPHERE_SHADERS.fragment).toContain('uFlattening');
    expect(ATMOSPHERE_SHADERS.fragment).toContain('rayPlanet');
  });

  it('stops the light where the planet blocks it', () => {
    // What draws the terminator into the sky instead of only onto the ground, and what
    // makes the band above it orange: the surviving path to the Sun is long, and blue
    // does not survive a long path.
    expect(ATMOSPHERE_SHADERS.fragment).toContain('rayPlanet(p, uSunLocal)');
  });

  it('marches the view ray only, the Sun path being in closed form', () => {
    expect(VIEW_SAMPLES).toBeGreaterThanOrEqual(12);
    // The inner loop is gone. If one ever comes back, this is where it gets noticed.
    expect(ATMOSPHERE_SHADERS.fragment).toContain('chapmanColumn(altitude');
    expect(ATMOSPHERE_SHADERS.fragment).not.toMatch(/for \(int j/);
  });

  it('draws the shell coarsely, because nothing here needs it fine', () => {
    // The cloud deck needs 256 to stay outside the planet it floats 5 km above. This
    // shell stands 100 km off, so the only thing resolution buys is a halo edge that is
    // not visibly polygonal.
    expect(ATMOSPHERE_SEGMENTS).toBeLessThan(256);
    const sag = shellRatio * (1 - Math.cos(Math.PI / ATMOSPHERE_SEGMENTS));
    const haloThickness = shellRatio - 1;
    expect(sag / haloThickness).toBeLessThan(0.05);
  });
});

describe('the scaled complementary error function', () => {
  /** erfcx by continued fraction, which is reliable exactly where the fit is hardest. */
  const reference = (y: number) => {
    if (y > 4) {
      let f = 0;
      for (let n = 60; n >= 1; n -= 1) {
        f = n / 2 / (y + f);
      }
      return 1 / Math.sqrt(Math.PI) / (y + f);
    }
    let sum = 0;
    let term = y;
    for (let n = 0; n < 200; n += 1) {
      sum += term / (2 * n + 1);
      term *= (-y * y) / (n + 1);
    }
    return Math.exp(y * y) * (1 - (2 / Math.sqrt(Math.PI)) * sum);
  };

  it('is pinned at both ends before it is fitted in the middle', () => {
    // erfcx(0) = 1 exactly, and the tail is 1/(y sqrt(pi)) exactly. Only the shape in
    // between is fitted, which is what keeps one free number from being a free hand.
    expect(erfcx(0)).toBe(1);
    for (const y of [50, 200, 1000]) {
      expect(erfcx(y) * y * Math.sqrt(Math.PI)).toBeCloseTo(1, 2);
    }
  });

  it('holds to better than half a percent everywhere', () => {
    let worst = 0;
    for (let y = 0; y <= 40; y += 0.01) {
      worst = Math.max(worst, Math.abs(erfcx(y) - reference(y)) / reference(y));
    }
    expect(worst).toBeLessThan(0.005);
  });

  it('beats the textbook form, which is unusable here', () => {
    // Abramowitz and Stegun 7.1.26 is accurate to 1.5e-7 *absolutely* in erfc, and this
    // is called where erfc is around 1e-164. Scaling that error by exp(y^2) is what put
    // the Chapman function 12% high at the zenith.
    const textbook = (y: number) => {
      const t = 1 / (1 + 0.3275911 * y);
      return (
        t *
        (0.254829592 +
          t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
      );
    };
    const y = 19.37; // sqrt(X / 2) at Earth's surface, looking straight up
    expect(Math.abs(textbook(y) - reference(y)) / reference(y)).toBeGreaterThan(0.1);
    expect(Math.abs(erfcx(y) - reference(y)) / reference(y)).toBeLessThan(0.001);
  });

  it('keeps its shape parameter where the fit put it', () => {
    expect(ERFCX_SHAPE).toBeCloseTo(1.164, 3);
  });
});

describe('the Chapman function against the integral it replaces', () => {
  /** The same geometry, expressed the way integratedDensity wants it. */
  const brute = (altitude: number, cosZenith: number, samples: number) =>
    integratedDensity(
      [0, 0, 1 + altitude],
      [Math.sqrt(Math.max(0, 1 - cosZenith * cosZenith)), 0, cosZenith],
      scaleHeightRatio,
      // Effectively unbounded: Chapman integrates to infinity, and the difference is the
      // eight parts per million of atmosphere above the 100 km shell.
      1 + 400 / earth.radiusEquatorialKm,
      samples,
    );

  /**
   * Whether the ray runs into the planet before it can leave.
   *
   * The shader skips those samples outright -- they are in shadow -- so they are not
   * geometries this has to agree on, and comparing them would be comparing a full column
   * against the stub of path before the ground.
   */
  const hitsGround = (altitude: number, cosZenith: number) =>
    cosZenith < 0 && (1 + altitude) * Math.sqrt(1 - cosZenith * cosZenith) < 1;

  it('agrees with a brute-force march across every geometry that reaches the Sun', () => {
    let worst = 0;
    for (const altitudeKm of [0, 1, 5, 20, 40, 60]) {
      const altitude = altitudeKm / earth.radiusEquatorialKm;
      for (let deg = 0; deg <= 110; deg += 2) {
        const cosZenith = Math.cos((deg * Math.PI) / 180);
        if (hitsGround(altitude, cosZenith)) {
          continue;
        }
        const reference = brute(altitude, cosZenith, 20000);
        if (reference === 0) {
          continue;
        }
        const closed = chapmanColumn(altitude, cosZenith, scaleHeightRatio);
        worst = Math.max(worst, Math.abs(closed - reference) / reference);
      }
    }
    expect(worst).toBeLessThan(0.01);
  });

  it('is more accurate than the eight-sample march it replaced, not less', () => {
    // The point worth keeping: this was a performance change that improved the physics.
    // Eight samples cannot resolve a density that falls by a factor of e every 8.5 km,
    // and looking straight up is where it is worst.
    const reference = brute(0, 1, 200000);
    const eightSamples = brute(0, 1, 8);
    const closed = chapmanColumn(0, 1, scaleHeightRatio);

    expect(Math.abs(eightSamples - reference) / reference).toBeGreaterThan(0.05);
    expect(Math.abs(closed - reference) / reference).toBeLessThan(0.005);
  });

  it('is exact at the horizon, where the airmass is largest', () => {
    // sqrt(pi X / 2) is the closed form for a grazing ray, and the approximation lands on
    // it exactly because erfcx(0) is exactly 1.
    const horizon = chapmanColumn(0, 0, scaleHeightRatio) / scaleHeightRatio;

    expect(horizon).toBeCloseTo(Math.sqrt(Math.PI / scaleHeightRatio / 2), 2);
  });

  it('handles a ray that points below the horizon and still leaves', () => {
    // Near the terminator the path to the Sun dips and skims over the limb. Clamping that
    // away would flatten the twilight band, which is the part the whole feature is for.
    const skimming = chapmanColumn(0.01, -0.05, scaleHeightRatio);

    expect(skimming).toBeGreaterThan(chapmanColumn(0.01, 0, scaleHeightRatio));
    expect(Number.isFinite(skimming)).toBe(true);
  });

  it('is continuous across the horizon', () => {
    // The two branches meet there, and a seam would draw a hard line across the sky.
    const above = chapmanColumn(0.001, 1e-6, scaleHeightRatio);
    const below = chapmanColumn(0.001, -1e-6, scaleHeightRatio);

    expect(below / above).toBeCloseTo(1, 4);
  });
});
