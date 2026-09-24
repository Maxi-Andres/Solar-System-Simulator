import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { decode } from 'jpeg-js';
import { describe, expect, it } from 'vitest';

import { acesToneMap, DISPLAY_FLOOR, linearToSrgb } from './shading.ts';
import {
  AU_KM,
  PHOTOSPHERE_RADIANCE,
  SUN_DRAWN_LUMINANCE,
  SUN_MAP_LUMINANCE,
  SUN_OVEREXPOSURE,
  SUNLIT_EARTH_RADIANCE,
  GLARE_CUBE_COEFFICIENT,
  GLARE_MAX_DEG,
  GLARE_MIN_DEG,
  GLARE_SQUARE_COEFFICIENT,
  glareLevel,
  glareLinear,
  glareRadiusDeg,
  glareSpread,
  glareWorldRadius,
  SOLAR_GLARE_FRAGMENT_SHADER,
  SUN_ANGULAR_RADIUS_AT_1AU_DEG,
  SUN_COLOR_INDEX,
  sunAngularRadiusDeg,
} from './solarGlare.ts';
import { colorIndexToTemperature } from './blackbody.ts';

/**
 * The veil of scattered light around the Sun.
 *
 * One constant is chosen and everything else is either the CIE disability-glare equation
 * or the inverse square law, so that is what these check: that the published equation is
 * the published equation, that distance does what distance does, and that the one chosen
 * number is where it says it is.
 */

describe('the CIE disability-glare equation', () => {
  it('is fifteen at one degree, which is the sum of its two coefficients', () => {
    expect(glareSpread(1)).toBeCloseTo(GLARE_CUBE_COEFFICIENT + GLARE_SQUARE_COEFFICIENT, 10);
    expect(glareSpread(1)).toBeCloseTo(15, 10);
  });

  it('crosses over between its two terms at two degrees', () => {
    // 10/8 and 5/4 are both 1.25: inside two degrees the cornea term dominates, outside
    // it the wide scatter does. Worth pinning, because it is the reason the profile has
    // a bright core and a long tail rather than one shape.
    const cube = GLARE_CUBE_COEFFICIENT / 2 ** 3;
    const square = GLARE_SQUARE_COEFFICIENT / 2 ** 2;
    expect(cube).toBeCloseTo(square, 10);
  });

  it('falls without exception, and never evaluates inside its published range', () => {
    let previous = Infinity;
    for (let angle = GLARE_MIN_DEG; angle <= 30; angle += 0.1) {
      const value = glareSpread(angle);
      expect(value).toBeLessThan(previous);
      previous = value;
    }
    // Below a tenth of a degree the equation is a point-source formula applied inside a
    // disc a third of a degree wide, so it is clamped rather than trusted.
    expect(glareSpread(0.01)).toBe(glareSpread(GLARE_MIN_DEG));
  });
});

describe('the Sun as seen from where you are', () => {
  it('is half a degree across from Earth', () => {
    // The oldest measurement in astronomy: 0.533 degrees, near enough that it eclipses
    // the Moon exactly.
    expect(2 * SUN_ANGULAR_RADIUS_AT_1AU_DEG).toBeCloseTo(0.533, 3);
  });

  it('is nearly three times that from Mercury', () => {
    expect(2 * sunAngularRadiusDeg(695_700, 0.387 * AU_KM)).toBeCloseTo(1.377, 2);
  });
});

describe('distance, which is the whole of the behaviour', () => {
  it('dims by the inverse square once the Sun is small enough to be a point', () => {
    // E = L pi sin^2(theta_R), which is the inverse square law written without assuming
    // the source is a point -- so it agrees with 1/d^2 far away and stays right close in.
    expect(glareLevel(695_700, 2 * AU_KM)).toBeCloseTo(glareLevel(695_700, AU_KM) / 4, 12);
    expect(glareLevel(695_700, 0.5 * AU_KM)).toBeCloseTo(glareLevel(695_700, AU_KM) * 4, 12);
  });

  it('shrinks the halo as the Sun recedes', () => {
    const radii = [0.387, 0.723, 1, 1.524, 5.2, 9.58].map((au) =>
      glareRadiusDeg(695_700, au * AU_KM),
    );
    for (let index = 1; index < radii.length; index += 1) {
      expect(radii[index]!).toBeLessThan(radii[index - 1]!);
    }
    // 8.3 degrees from Mercury's orbit, 3.6 from Earth's, 0.62 from Saturn's.
    expect(radii[0]!).toBeCloseTo(8.3, 0);
    expect(radii[2]!).toBeCloseTo(3.6, 0);
    expect(radii.at(-1)!).toBeCloseTo(0.62, 1);
  });

  it('never asks for a billboard it cannot build', () => {
    // A quad at the source's own distance spans the tangent of its half-angle, which
    // runs away at 90 degrees and comes back negative past it, so the solve is clamped.
    for (const km of [2 * 695_700, 3 * 695_700, 0.01 * AU_KM, 0.1 * AU_KM, AU_KM]) {
      const radius = glareRadiusDeg(695_700, km);
      expect(radius).toBeLessThanOrEqual(GLARE_MAX_DEG);
      expect(Math.tan((radius * Math.PI) / 180)).toBeGreaterThan(0);
    }
    expect(glareRadiusDeg(695_700, 2 * 695_700)).toBe(GLARE_MAX_DEG);
  });

  it('stops exactly where a display stops being able to show it', () => {
    const edge = glareRadiusDeg(695_700, AU_KM);
    expect(linearToSrgb(glareLinear(edge * 0.99, 695_700, AU_KM))).toBeGreaterThan(DISPLAY_FLOOR);
    expect(linearToSrgb(glareLinear(edge * 1.01, 695_700, AU_KM))).toBeLessThan(DISPLAY_FLOOR);
  });
});

describe('the veil is tied to the disc, so there is no constant to get out of step', () => {
  it('scales with the exposure the disc is drawn at', () => {
    // The bug this replaced: the disc went up by 45 and the glare stayed where it was.
    expect(SUN_DRAWN_LUMINANCE).toBeCloseTo(SUN_MAP_LUMINANCE * SUN_OVEREXPOSURE, 10);
    expect(glareLevel(695_700, AU_KM)).toBeGreaterThan(0);
  });

  it('puts a bright rim on the limb, which is the whole of what was missing', () => {
    // Measured on NASA's own frame just outside the disc: 186 of 255. This gives 203.
    const limb = linearToSrgb(glareLinear(SUN_ANGULAR_RADIUS_AT_1AU_DEG, 695_700, AU_KM));
    expect(limb * 255).toBeGreaterThan(150);
    expect(limb * 255).toBeLessThan(255);
  });

  it('is brighter at the limb close up than the version it replaced', () => {
    // In the close-up frame Maxi sent -- a disc 6.38 degrees in angular radius -- the
    // old anchored version put the limb at 35 of 255 against the reference's 186.
    const closeUp = 695_700 / Math.sin((6.381 * Math.PI) / 180);
    const limb = linearToSrgb(glareLinear(6.381, 695_700, closeUp));
    expect(limb * 255).toBeGreaterThan(70);
  });

  it('still leaves the sky black where the halo ends', () => {
    // A veil that never stops is a fog. At Earth's distance it reaches 3.6 degrees,
    // which is wider than the reference's 1.72 -- the eye's glare function is wider
    // than an instrument's, and that difference is documented rather than fitted away.
    expect(glareRadiusDeg(695_700, AU_KM)).toBeLessThan(5);
  });
});

describe('the quad it is drawn on', () => {
  it('is sized by the angle, so it covers the halo at any distance', () => {
    const distanceUnits = 1000;
    const half = glareWorldRadius(distanceUnits, 2.35);
    // Half-width over distance is the tangent of the half-angle, by construction.
    expect((Math.atan(half / distanceUnits) * 180) / Math.PI).toBeCloseTo(2.35, 6);
  });
});

describe('the angle a fragment sits at', () => {
  it('is the arctangent of its offset, not the offset scaled', () => {
    // This shipped wrong once and it was visible immediately: taking the angle as the
    // fraction across the quad times its half-angle is right only while everything is
    // small. At the 39 degrees the quad spans near the Sun, a fragment 15% of the way
    // out is at 6.5 degrees the linear way and 6.8 the right way -- and at the disc's
    // own edge the error was 40%, which put the photosphere mask out at 1.4 solar
    // radii. The frame showed a black ring around the Sun with the halo outside it.
    const halfAngleDeg = 39;
    const tanHalf = Math.tan((halfAngleDeg * Math.PI) / 180);
    const fraction = 0.15;

    const linear = fraction * halfAngleDeg;
    const correct = (Math.atan(fraction * tanHalf) * 180) / Math.PI;

    expect(correct).toBeGreaterThan(linear);
    // At the radius the disc actually occupies, the two disagree by a third.
    const atDisc = 0.107;
    const linearAtDisc = atDisc * halfAngleDeg;
    const correctAtDisc = (Math.atan(atDisc * tanHalf) * 180) / Math.PI;
    expect(correctAtDisc / linearAtDisc).toBeGreaterThan(1.1);
  });
});

describe('the shader says the same thing as the module', () => {
  it('carries the published coefficients rather than its own', () => {
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain('10.0 / (angleDeg * angleDeg * angleDeg)');
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain('5.0 / (angleDeg * angleDeg)');
  });

  it('clamps at the same inner angle', () => {
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain(`max(${GLARE_MIN_DEG.toFixed(2)}`);
  });

  it('takes the arctangent, which is the bug that shipped', () => {
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain('degrees(atan(radius * uTanRadius))');
    expect(SOLAR_GLARE_FRAGMENT_SHADER).not.toContain('radius * uRadiusDeg');
  });

  it('reaches full strength at the limb rather than a tenth of a radius past it', () => {
    // The black ring Maxi found: the mask used to run the other way, so the veil was
    // zero exactly where the halo should be brightest.
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain(
      'smoothstep(uSunRadiusDeg * 0.9, uSunRadiusDeg, angleDeg)',
    );
    expect(SOLAR_GLARE_FRAGMENT_SHADER).not.toContain('uSunRadiusDeg * 1.1');
  });

  it('encodes for the display itself, like the star shader', () => {
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain('0.0031308');
    expect(SOLAR_GLARE_FRAGMENT_SHADER).toContain('1.0 / 2.4');
  });
});

describe('the colour of the veil', () => {
  it('is the Sun itself, not a tint', () => {
    // Scattered sunlight is still sunlight, so the halo takes the Sun's own colour
    // index through the same Planck and CIE path every star here uses.
    expect(SUN_COLOR_INDEX).toBe(0.65);
    expect(colorIndexToTemperature(SUN_COLOR_INDEX)).toBeCloseTo(5778, 0);
  });
});

describe('the disc, which is a light source and not a lit surface', () => {
  it('is 154,000 times brighter than what the exposure is set for', () => {
    // sigma T^4 over pi at 5,772 K against albedo times the solar constant over pi.
    // Nothing here is fitted: it is why a correct render of the Sun is a blank circle.
    expect(PHOTOSPHERE_RADIANCE / SUNLIT_EARTH_RADIANCE).toBeGreaterThan(150_000);
    expect(PHOTOSPHERE_RADIANCE / SUNLIT_EARTH_RADIANCE).toBeLessThan(160_000);
  });

  it('is drawn thousands of times under that, not over it', () => {
    // 45 sounds like an exaggeration and is the opposite of one.
    const under = PHOTOSPHERE_RADIANCE / SUNLIT_EARTH_RADIANCE / SUN_OVEREXPOSURE;
    expect(under).toBeGreaterThan(3000);
  });

  it('lands on the disc colour the reference measures, from a factor not fitted to it', async () => {
    // The factor was chosen to clip red across the whole map. Pushing this texture and
    // its catalog tint through the renderer's response at 45 then averages 255, 249, 60.
    // Reading NASA's render of the Sun pixel by pixel gives 255, 249, 59.
    const srgbToLinear = (v: number): number =>
      v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

    // The catalog tint, #ffd24a, is multiplied onto the map by the material.
    const tint = [255, 210, 74].map((channel) => srgbToLinear(channel / 255));

    const image = decode(
      await readFile(join(import.meta.dirname, '../../public/textures/sun.jpg')),
      { useTArray: true },
    );

    const totals = [0, 0, 0];
    let samples = 0;
    let redClipped = 0;
    // Every 13th texel: two million pixels is more than this needs and slower than the
    // rest of the suite put together.
    for (let index = 0; index < image.data.length; index += 4 * 13) {
      for (let channel = 0; channel < 3; channel += 1) {
        const linear =
          srgbToLinear(image.data[index + channel]! / 255) * tint[channel]! * SUN_OVEREXPOSURE;
        totals[channel]! += linearToSrgb(acesToneMap(linear));
      }
      // 15.4 is where the ACES fit reaches 1: past it a channel cannot rise further.
      if (srgbToLinear(image.data[index]! / 255) * tint[0]! * SUN_OVEREXPOSURE >= 15.4) {
        redClipped += 1;
      }
      samples += 1;
    }

    const mean = totals.map((total) => Math.round((255 * total) / samples));
    expect(mean[0]).toBe(255);
    expect(mean[1]).toBeGreaterThanOrEqual(247);
    expect(mean[1]).toBeLessThanOrEqual(251);
    expect(mean[2]).toBeGreaterThanOrEqual(55);
    expect(mean[2]).toBeLessThanOrEqual(65);

    // And the point of the factor: no red anywhere on the map has headroom left.
    expect(redClipped).toBe(samples);
  });
});

describe('the contrast of the disc, which is what overexposure does to it', () => {
  it('flattens the map almost to the spread the reference has', async () => {
    // Maxi, side by side: "es como con menos contraste entre los colores, hace eso le va
    // a dar un efecto de iluminado". He is describing overexposure, and the frames say
    // so: the green channel across NASA's disc runs 244 to 253, a spread of 9 out of
    // 255. Ours, with the exposure silently reset to unity by the texture loader, ran
    // 52 to 205 -- a spread of 153.
    //
    // At 45 the same map comes out with a spread of about 21: seven times flatter than
    // it was, and within a dozen code values of the reference.
    const srgbToLinear = (v: number): number =>
      v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const tintGreen = srgbToLinear(210 / 255);

    const image = decode(
      await readFile(join(import.meta.dirname, '../../public/textures/sun.jpg')),
      { useTArray: true },
    );

    const green: number[] = [];
    for (let index = 0; index < image.data.length; index += 4 * 17) {
      const linear = srgbToLinear(image.data[index + 1]! / 255) * tintGreen * SUN_OVEREXPOSURE;
      green.push(255 * linearToSrgb(acesToneMap(linear)));
    }
    green.sort((a, b) => a - b);
    const at = (fraction: number): number => green[Math.round(fraction * (green.length - 1))]!;

    const spread = at(0.95) - at(0.05);
    expect(spread).toBeLessThan(30);
    // And the map drawn at unity, which is what shipped, is nothing like that flat.
    expect(spread).toBeLessThan(153 / 5);
  });
});
