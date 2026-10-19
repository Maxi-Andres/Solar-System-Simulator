import { describe, expect, it } from 'vitest';

import {
  BELT_POPULATIONS,
  beltLight,
  CLASS_SLOTS,
  CROWDED_BRIGHT_FLOOR,
  CROWDED_LIGHT_BUDGET,
  crowdedAlpha,
  crowdingScale,
  pixelSolidAngle,
  projectedAreaSr,
  regionFade,
  writeCrowding,
  type PopulationLight,
} from './beltCrowding.ts';
import { AU_KM, FOV_DEG } from './scale.ts';
import { RECORD, RECORD_FLOATS } from '../core/belt.ts';
import { FAINT_BINS } from './beltShader.ts';

/**
 * How crowded the belt is on screen, from the camera, and what that does to its dots.
 *
 * The views are the ones the rule was made for: Maxi's screenshot of the whole catalogue
 * from thirty AU, where the inner belt was a white blob; the GPU probe's Jupiter view with
 * the belt across a third of the screen, where B2a was tuned; and close in, which must not
 * change at all.
 */

const HEIGHT_PX = 864;
const MAIN = BELT_POPULATIONS.findIndex((population) => population.name === 'main belt');
const KUIPER = BELT_POPULATIONS.findIndex((population) => population.name === 'trans-Neptunian');

/** The camera `distanceAu` from the Sun, `elevationDeg` above the ecliptic. */
function camera(distanceAu: number, elevationDeg: number) {
  const elevation = (elevationDeg * Math.PI) / 180;
  return {
    x: distanceAu * AU_KM * Math.cos(elevation),
    y: 0,
    z: distanceAu * AU_KM * Math.sin(elevation),
  };
}

/**
 * The main belt's light per covered CSS pixel from a camera, with `count` dots each
 * bringing `meanLight`, before and after the scale.
 */
function mainBelt(count: number, meanLight: number, distanceAu: number, elevationDeg: number) {
  const pixels =
    projectedAreaSr(BELT_POPULATIONS[MAIN]!, camera(distanceAu, elevationDeg)) /
    pixelSolidAngle(FOV_DEG, HEIGHT_PX);
  const light = (count / pixels) * meanLight;
  const scale = crowdingScale(
    count,
    meanLight,
    projectedAreaSr(BELT_POPULATIONS[MAIN]!, camera(distanceAu, elevationDeg)),
    pixelSolidAngle(FOV_DEG, HEIGHT_PX),
  );
  return { pixels, dotsPerPixel: count / pixels, light, scale, after: light * scale };
}

// The main belt as loaded. B2a: its 64,004 main-belt dots bring 0.79 each, opacity times
// area in CSS pixels, measured from the generated tier. Everything: 1.5 million, with the
// faint tiers' 29,000 of light added (see faintBinAlphas), 0.049 each.
const B2A = { count: 64_004, meanLight: 0.79 };
const ALL = { count: 1_500_000, meanLight: ((64_425 + 28_949) * Math.PI) / 4 / 1_500_000 };

describe('crowding', () => {
  it('leaves a close view exactly as it was', () => {
    // Earth in focus, the camera a hundredth of an AU off it: the belt is all round, its
    // dots far apart on screen whatever is loaded.
    const near = { x: AU_KM, y: 0, z: 0.01 * AU_KM };
    const area = projectedAreaSr(BELT_POPULATIONS[MAIN]!, near);
    expect(crowdingScale(ALL.count, ALL.meanLight, area, pixelSolidAngle(FOV_DEG, HEIGHT_PX))).toBe(1);
    expect(regionFade(BELT_POPULATIONS[MAIN]!, near, FOV_DEG, HEIGHT_PX)).toBe(1);
  });

  it('leaves the view B2a was tuned at alone, and barely touches it with everything', () => {
    // The probe's view: the belt across a third of the screen, 225,000 CSS pixels -- the
    // camera 16.6 AU out at 30 degrees. B2a's light there is 0.22 a pixel, under the budget.
    const b2a = mainBelt(B2A.count, B2A.meanLight, 16.6, 30);
    expect(b2a.pixels).toBeGreaterThan(215_000);
    expect(b2a.pixels).toBeLessThan(235_000);
    expect(b2a.light).toBeCloseTo(0.22, 1);
    expect(b2a.scale).toBe(1);
    // The whole catalogue, 6.7 dots a pixel: dimmed by a tenth.
    const all = mainBelt(ALL.count, ALL.meanLight, 16.6, 30);
    expect(all.dotsPerPixel).toBeCloseTo(6.7, 0);
    expect(all.scale).toBeGreaterThan(0.85);
    expect(all.after).toBeCloseTo(CROWDED_LIGHT_BUDGET, 6);
  });

  it('holds the screenshot’s far view to the budget: 30 AU, 30 degrees up, 27-degree field', () => {
    // The main belt covers 68,800 pixels there and the whole catalogue puts 22 dots on
    // each: 1.07 of light a pixel, the blob. Scaled by 0.28, to the budget's 0.3.
    const all = mainBelt(ALL.count, ALL.meanLight, 30, 30);
    expect(all.pixels).toBeCloseTo(68_770, -2);
    expect(all.dotsPerPixel).toBeCloseTo(21.8, 0);
    expect(all.light).toBeCloseTo(1.07, 1);
    expect(all.scale).toBeCloseTo(0.28, 2);
    expect(all.after).toBeLessThanOrEqual(CROWDED_LIGHT_BUDGET + 1e-12);
    // B2a alone is crowded there too: 0.93 dots a pixel, scaled to 0.41.
    expect(mainBelt(B2A.count, B2A.meanLight, 30, 30).scale).toBeCloseTo(0.41, 2);
  });

  it('only ever dims further as the camera pulls back', () => {
    for (const elevation of [0, 5, 30, 60, 90]) {
      let previous = Infinity;
      for (let distance = 1; distance <= 3000; distance *= 1.3) {
        const { scale } = mainBelt(ALL.count, ALL.meanLight, distance, elevation);
        expect(scale).toBeLessThanOrEqual(previous);
        previous = scale;
      }
    }
  });

  it('stays finite edge-on: the ring has a thickness', () => {
    const edgeOn = mainBelt(ALL.count, ALL.meanLight, 30, 0);
    expect(edgeOn.pixels).toBeGreaterThan(0);
    expect(edgeOn.scale).toBeGreaterThan(0);
    // Face-on is the ring's whole area, edge-on its silhouette: fewer pixels, more dimming.
    expect(edgeOn.scale).toBeLessThan(mainBelt(ALL.count, ALL.meanLight, 30, 90).scale);
  });
});

describe('the floor', () => {
  it('never lets a bright asteroid go below it, however crowded', () => {
    expect(crowdedAlpha(0.55, 12, 0.001, 1)).toBe(CROWDED_BRIGHT_FLOOR);
    expect(crowdedAlpha(0.55, 12, 0.5, 1)).toBe(0.275);
    expect(crowdedAlpha(0.55, 12, 1, 1)).toBe(0.55);
  });

  it('holds no faint dot up: at a distance they are the haze the budget is for', () => {
    expect(crowdedAlpha(0.1, 16.5, 0.01, 1)).toBeCloseTo(0.001, 12);
  });

  it('gives way to the fade, which takes everything', () => {
    expect(crowdedAlpha(0.55, 12, 0.001, 0)).toBe(0);
    expect(crowdedAlpha(0.55, 12, 0.001, 0.5)).toBe(CROWDED_BRIGHT_FLOOR / 2);
  });
});

describe('the fade with the region’s size', () => {
  it('follows the moons’ rule: full at 24 pixels of outer radius, gone at 12', () => {
    // Seen from d, the main belt's 3.5 AU is 3.5 · 1800 / d pixels on an 864-pixel
    // screen at 27 degrees.
    const radiusPx = (d: number) => (3.5 * (HEIGHT_PX / (2 * Math.tan((13.5 * Math.PI) / 180)))) / d;
    const at = (d: number) => regionFade(BELT_POPULATIONS[MAIN]!, camera(d, 30), FOV_DEG, HEIGHT_PX);
    expect(radiusPx(262)).toBeCloseTo(24, 0);
    expect(at(260)).toBe(1);
    expect(at(530)).toBe(0);
    expect(at(350)).toBeGreaterThan(0);
    expect(at(350)).toBeLessThan(1);
  });

  it('takes the inner belt off the Sun from afar and leaves the Kuiper belt a ring', () => {
    // The second screenshot: so far out that the Kuiper belt is a ring under two hundred
    // pixels across and the main belt a smudge on the Sun.
    const far = camera(600, 30);
    expect(regionFade(BELT_POPULATIONS[MAIN]!, far, FOV_DEG, HEIGHT_PX)).toBe(0);
    expect(regionFade(BELT_POPULATIONS[KUIPER]!, far, FOV_DEG, HEIGHT_PX)).toBe(1);
  });
});

describe('beltLight and writeCrowding', () => {
  const classes = ['MBA', 'IMB', 'OMB', 'MCA', 'APO', 'ATE', 'AMO', 'IEO', 'TJN', 'CEN', 'TNO', 'PAA', 'HYA', 'AST'] as const;

  it('counts each population from its class codes, and its light from its dots', () => {
    const records = new Float32Array(3 * RECORD_FLOATS);
    // A main-belt asteroid at H 12, a Trojan at H 14, a faint main-belt one at H 16.5.
    [[0, 12], [8, 14], [0, 16.5]].forEach(([code, H], k) => {
      records[k * RECORD_FLOATS + RECORD.class] = code!;
      records[k * RECORD_FLOATS + RECORD.H] = H!;
    });
    const binAlphas = new Float32Array(FAINT_BINS).fill(0.1);
    const light = beltLight([records], binAlphas, classes);
    expect(light.count[MAIN]).toBe(2);
    expect(light.count[BELT_POPULATIONS.findIndex((p) => p.name === 'Jupiter Trojans')]).toBe(1);
    expect(light.populationOfClass[13]).toBe(MAIN);
    // The faint one brings its magnitude's share on a one-pixel disc.
    expect(light.light[MAIN]).toBeGreaterThan((0.1 * Math.PI) / 4);
  });

  it('writes a scale and a fade for every class slot, one where no population claims it', () => {
    const populations: PopulationLight = {
      count: new Float64Array(BELT_POPULATIONS.length).fill(0).map((_, k) => (k === MAIN ? ALL.count : 0)),
      light: new Float64Array(BELT_POPULATIONS.length).fill(0).map((_, k) => (k === MAIN ? ALL.count * ALL.meanLight : 0)),
      populationOfClass: beltLight([], new Float32Array(FAINT_BINS), classes).populationOfClass,
    };
    const crowding = new Float32Array(CLASS_SLOTS);
    const fade = new Float32Array(CLASS_SLOTS);
    writeCrowding(crowding, fade, populations, camera(30, 30), FOV_DEG, HEIGHT_PX);
    expect(crowding[0]).toBeCloseTo(0.28, 2);
    expect(fade[0]).toBe(1);
    // A Trojan: none loaded, nothing to dim.
    expect(crowding[8]).toBe(1);
    // Past the classes the data names.
    expect(crowding[15]).toBe(1);
    expect(fade[15]).toBe(1);
  });
});
