import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import { describeWithData as withData } from '../core/describeWithData.ts';
import { loadEphemerisStore, SPEED_OF_LIGHT_KM_S, type EphemerisStore, type Fetcher } from '../core/ephemerisStore.ts';
import { dateToTdb } from '../core/time.ts';
import type { Vec3 } from '../core/vec3.ts';
import {
  applyEclipseShadow,
  coveredSunlight,
  discOverlapArea,
  EARTH_OCCULTING_LAYER_KM,
  ECLIPSE_GLSL,
  ECLIPSE_MAX_OCCLUDERS,
  EclipseSelector,
  mayShadow,
  occludingRadiusKm,
  SUN_DISC_LIGHT,
  sunlightFraction,
  type Sphere,
  whenLightPassed,
} from './eclipseShadow.ts';
import { applyRingShadow, POINT_LIGHT_HOOK, type RingShadowUniforms } from './ringShadow.ts';
import { poleDirection, primeMeridianDirection } from './orientation.ts';
import { LIMB_DARKENING_U } from './starDisc.ts';

/**
 * Eclipses: one body's shadow on another.
 *
 * First the geometry against cases with obvious answers, then against real eclipses:
 * JPL's positions through the same function the shader mirrors, held against NASA's and
 * EclipseWise's predictions (Espenak) and a published Ganymede shadow transit.
 */

const SUN_RADIUS_KM = 695_700;
const AU_KM = 149_597_870.7;
const DEG = Math.PI / 180;

/** A fine numerical integral of the covered light, ring by ring, to check the coarse one. */
function coveredSunlightFine(a: number, b: number, c: number, rings = 4000): number {
  let covered = 0;
  let inside = 0;
  for (let k = 1; k <= rings; k += 1) {
    const x = (k - 0.5) / rings;
    const brightness = 1 - LIMB_DARKENING_U * (1 - Math.sqrt(1 - x * x));
    const upTo = discOverlapArea((a * k) / rings, b, c);
    covered += brightness * (upTo - inside);
    inside = upTo;
  }
  return covered / (Math.PI * a * a * SUN_DISC_LIGHT);
}

describe('discOverlapArea', () => {
  it('is zero for discs apart and the smaller disc for one inside the other', () => {
    expect(discOverlapArea(1, 1, 2.0001)).toBe(0);
    expect(discOverlapArea(1, 0.3, 0.5)).toBeCloseTo(Math.PI * 0.09, 12);
    expect(discOverlapArea(0.3, 1, 0.5)).toBeCloseTo(Math.PI * 0.09, 12);
  });

  it('gives the textbook lens for two unit discs one radius apart', () => {
    expect(discOverlapArea(1, 1, 1)).toBeCloseTo((2 * Math.PI) / 3 - Math.sqrt(3) / 2, 12);
  });
});

describe('coveredSunlight', () => {
  const a = 0.00465;

  it('covers nothing apart, everything in the umbra', () => {
    expect(coveredSunlight(a, a, 2.01 * a)).toBe(0);
    expect(coveredSunlight(a, 3 * a, 1.9 * a)).toBe(1);
  });

  it('weights the disc by its limb darkening', () => {
    // A small disc at the centre hides the brightest light: more than its share of area.
    const central = coveredSunlight(a, 0.1 * a, 0);
    expect(central).toBeGreaterThan(0.01 * 1.15);
    expect(central).toBeLessThan(0.01 / SUN_DISC_LIGHT + 1e-9);
    // An equal disc covering 90% of the area leaves the dark limb: about 7.4%, not 10%.
    let low = 0;
    let high = 2 * a;
    for (let i = 0; i < 60; i += 1) {
      const c = (low + high) / 2;
      if (discOverlapArea(a, a, c) / (Math.PI * a * a) > 0.9) {
        low = c;
      } else {
        high = c;
      }
    }
    expect(1 - coveredSunlight(a, a, low)).toBeCloseTo(0.074, 2);
  });

  it('matches a fine integral to 0.3% of the Sun in every geometry', () => {
    for (const ratio of [0.3, 0.9, 1, 1.03, 1.2, 3, 50, 200]) {
      const b = ratio * a;
      for (let step = 0; step <= 50; step += 1) {
        const c = Math.abs(b - a) + (step / 50) * (a + b - Math.abs(b - a));
        expect(Math.abs(coveredSunlight(a, b, c) - coveredSunlightFine(a, b, c))).toBeLessThan(0.003);
      }
    }
  });
});

describe('sunlightFraction', () => {
  // The Sun 1 AU along +x; the Moon at perigee in front of Earth, which is at the origin.
  const sun: Sphere = { centre: [AU_KM, 0, 0], radius: SUN_RADIUS_KM };
  const moon: Sphere = { centre: [363_300, 0, 0], radius: 1737.4 };
  const ground = (offsetKm: number): [number, number, number] => [6378, offsetKm, 0];

  it('is dark on the axis, partial off it and full sunlight beyond the penumbra', () => {
    expect(sunlightFraction(ground(0), sun, [moon])).toBe(0);
    const partial = sunlightFraction(ground(2000), sun, [moon]);
    expect(partial).toBeGreaterThan(0.05);
    expect(partial).toBeLessThan(0.95);
    expect(sunlightFraction(ground(4000), sun, [moon])).toBe(1);
  });

  it('brightens monotonically out through the penumbra', () => {
    let previous = 0;
    for (let offset = 0; offset <= 4000; offset += 50) {
      const light = sunlightFraction(ground(offset), sun, [moon]);
      expect(light).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = light;
    }
  });

  it('ignores a body behind the point or beyond the Sun', () => {
    expect(sunlightFraction(ground(0), sun, [{ centre: [-363_300, 0, 0], radius: 1737.4 }])).toBe(1);
    expect(sunlightFraction(ground(0), sun, [{ centre: [2 * AU_KM, 0, 0], radius: 1e7 }])).toBe(1);
  });

  it('leaves an annulus when the Moon is at apogee: the antumbra', () => {
    const far: Sphere = { centre: [405_500, 0, 0], radius: 1737.4 };
    const light = sunlightFraction(ground(0), sun, [far]);
    // (1 - 0.9^2 by area, less after the darker limb) -- a ring of sunlight, not night.
    expect(light).toBeGreaterThan(0.05);
    expect(light).toBeLessThan(0.2);
  });
});

describe('mayShadow and occludingRadiusKm', () => {
  const earth = getBody('earth');
  const moon = getBody('moon');
  const jupiter = getBody('jupiter');
  const io = getBody('io');
  const ganymede = getBody('ganymede');
  const venus = getBody('venus');

  it('pairs a planet with its moons and the moons with each other', () => {
    expect(mayShadow(earth, moon)).toBe(true);
    expect(mayShadow(moon, earth)).toBe(true);
    expect(mayShadow(jupiter, ganymede)).toBe(true);
    expect(mayShadow(io, ganymede)).toBe(true);
    expect(mayShadow(io, jupiter)).toBe(true);
    expect(mayShadow(earth, venus)).toBe(false);
    expect(mayShadow(moon, io)).toBe(false);
    expect(mayShadow(earth, earth)).toBe(false);
  });

  it('gives Earth its 87 km occulting layer and nobody else one', () => {
    expect(occludingRadiusKm(earth)).toBe(earth.radiusEquatorialKm + EARTH_OCCULTING_LAYER_KM);
    expect(occludingRadiusKm(ganymede)).toBe(ganymede.radiusEquatorialKm);
  });
});

describe('EclipseSelector', () => {
  /** Earth's frame of the test above: the Sun along +x. */
  function selector(): EclipseSelector {
    const chosen = new EclipseSelector();
    chosen.begin(6378, AU_KM, 0, 0, 0, 0, 0, SUN_RADIUS_KM, 1000);
    return chosen;
  }

  it('keeps an occluder whose penumbra reaches and drops one whose does not', () => {
    const chosen = selector();
    // At new Moon 5 degrees off the line: a near miss, its penumbra short of Earth.
    expect(chosen.offer(363_300 * Math.cos(5 * DEG), 363_300 * Math.sin(5 * DEG), 0, 0, 0, 0, 1737.4)).toBe(0);
    expect(chosen.uniforms.uEclipseCount.value).toBe(0);
    // Half a degree off: the penumbra is on Earth.
    expect(
      chosen.offer(363_300 * Math.cos(0.5 * DEG), 363_300 * Math.sin(0.5 * DEG), 0, 0, 0, 0, 1737.4),
    ).toBeGreaterThan(0);
    expect(chosen.uniforms.uEclipseCount.value).toBe(1);
    // In the scene's unit, relative to the lit body.
    expect(chosen.uniforms.uEclipseOccluders.value[0]!.w).toBeCloseTo(1.7374, 6);
    expect(chosen.uniforms.uEclipseSun.value.x).toBeCloseTo(AU_KM / 1000, 3);
  });

  it('drops a body on the night side', () => {
    const chosen = selector();
    expect(chosen.offer(-363_300, 0, 0, 0, 0, 0, 1737.4)).toBe(0);
  });

  it('keeps the four that could cover the most, the biggest first', () => {
    const chosen = selector();
    const radii = [100, 3000, 500, 2000, 50, 1000];
    for (const radius of radii) {
      chosen.offer(400_000, 0, 0, 0, 0, 0, radius);
    }
    const kept = chosen.uniforms.uEclipseOccluders.value
      .slice(0, chosen.uniforms.uEclipseCount.value)
      .map((occluder) => occluder.w * 1000);
    expect(kept).toHaveLength(ECLIPSE_MAX_OCCLUDERS);
    // 3000 and 2000 both cover the whole Sun, so they tie and keep their order.
    expect(kept).toEqual([3000, 2000, 1000, 500]);
  });

  it('turns and scales its frame for the sky shader', () => {
    const chosen = selector();
    chosen.offer(400_000, 1000, 0, 0, 0, 0, 1737.4);
    const target = new EclipseSelector().uniforms;
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    chosen.copyTransformed(target, turn, 1000 / 6378);
    expect(target.uEclipseCount.value).toBe(1);
    const occluder = target.uEclipseOccluders.value[0]!;
    expect(occluder.x).toBeCloseTo(-1000 / 6378, 6);
    expect(occluder.y).toBeCloseTo(400_000 / 6378, 4);
    expect(occluder.w).toBeCloseTo(1737.4 / 6378, 6);
  });
});

describe('applyEclipseShadow', () => {
  function compile(material: THREE.MeshStandardMaterial): { vertexShader: string; fragmentShader: string } {
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader as never, null as never);
    return shader;
  }

  it('shadows the direct light and measures the vertex from the body’s centre', () => {
    const material = new THREE.MeshStandardMaterial();
    applyEclipseShadow(material, new EclipseSelector().uniforms);
    const shader = compile(material);
    expect(shader.fragmentShader).toContain(
      `${POINT_LIGHT_HOOK}\n        // Another body`,
    );
    expect(shader.fragmentShader).toContain('directLight.color *= eclipseSunlight(vEclipseOffset);');
    expect(shader.fragmentShader).toContain('float eclipseSunlight(vec3 offset)');
    expect(shader.vertexShader).toContain('vEclipseOffset = mat3(modelMatrix) * transformed');
  });

  it('chains after the ring shadow and keys its own program', () => {
    const plain = new THREE.MeshStandardMaterial();
    applyEclipseShadow(plain, new EclipseSelector().uniforms);
    const ringed = new THREE.MeshStandardMaterial();
    const ringUniforms = {
      uRingShadowMap: { value: null },
      uRingShadowSunLocal: { value: new THREE.Vector3() },
      uRingShadowInner: { value: 1 },
      uRingShadowOuter: { value: 2 },
      uRingShadowStrength: { value: 0 },
      uRingShadowMaxAlpha: { value: 1 },
      uRingShadowFloor: { value: 0 },
      uRingShadowExponent: { value: 1 },
      uRingShadowGain: { value: 1 },
    } satisfies RingShadowUniforms;
    applyRingShadow(ringed, ringUniforms, 0.9);
    applyEclipseShadow(ringed, new EclipseSelector().uniforms);

    const shader = compile(ringed);
    expect(shader.fragmentShader).toContain('ringShadowTransmission();');
    expect(shader.fragmentShader).toContain('eclipseSunlight(vEclipseOffset);');
    expect(ringed.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey());
  });

  it('declares every uniform the shader reads', () => {
    for (const name of ['uEclipseCount', 'uEclipseSun', 'uEclipseOccluders']) {
      expect(ECLIPSE_GLSL).toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Real eclipses, against JPL's positions. Skipped when the data has not been generated.
// ---------------------------------------------------------------------------------------

const DATA_ROOT = join(import.meta.dirname, '../../public');
const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;

async function tryLoad(): Promise<EphemerisStore | null> {
  try {
    return await loadEphemerisStore(diskFetcher, '/');
  } catch {
    return null;
  }
}

const store = await tryLoad();
const describeWithData = withData(store !== null);

type Triple = readonly [number, number, number];
const triple = (v: Vec3): Triple => [v.x, v.y, v.z];
const minus = (a: Triple, b: Triple): Triple => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a: Triple, b: Triple): Triple => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a: Triple, k: number): Triple => [a[0] * k, a[1] * k, a[2] * k];
const dotOf = (a: Triple, b: Triple): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossOf = (a: Triple, b: Triple): Triple => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Triple): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Triple): Triple => times(a, 1 / norm(a));

const SECONDS = 1 / 86_400;

/**
 * A TD instant (TT; TDB differs by under 2 ms) from an ISO string written in TD. In 2025
 * and 2026 TT - UTC = 69.184 s, so reading it as UTC puts it that much late.
 */
function td(iso: string): number {
  return dateToTdb(new Date(iso)) - 69.184 * SECONDS;
}

/** Bisects for the instant a predicate flips, between two TDB Julian days. */
function flip(predicate: (jd: number) => boolean, from: number, to: number): number {
  let a = from;
  let b = to;
  const start = predicate(a);
  for (let i = 0; i < 50; i += 1) {
    const middle = (a + b) / 2;
    if (predicate(middle) === start) {
      a = middle;
    } else {
      b = middle;
    }
  }
  return (a + b) / 2;
}

/**
 * The scene as the shadow sees it from one lit body at one instant: the lit body where it
 * is, the Sun and an occluder where the light reaching it passed them -- what the frame
 * loop hands the shader (EclipseSelector), here through `whenLightPassed`.
 */
function shadowScene(s: EphemerisStore, lit: string, occluder: string, jd: number) {
  const litAt = triple(s.stateInRoot(lit, jd)!.position);
  const seen = (id: string): Triple => {
    const state = s.stateInRoot(id, jd)!;
    return plus(litAt, whenLightPassed(minus(triple(state.position), litAt), triple(state.velocity)));
  };
  return {
    litAt,
    sun: { centre: seen('sun'), radius: s.body('sun').radiusEquatorialKm } as Sphere,
    occluder: { centre: seen(occluder), radius: occludingRadiusKm(s.body(occluder)) } as Sphere,
  };
}

describeWithData('Lunar eclipses, against NASA', () => {
  const s = store!;
  // The tables come in chunks, fetched as they are needed; a test needs them now.
  beforeAll(async () => {
    for (const iso of [
      '2025-09-07T16:00:00Z',
      '2025-09-07T18:00:00Z',
      '2025-09-07T20:00:00Z',
      '2026-03-03T10:00:00Z',
      '2026-03-03T11:30:00Z',
      '2026-03-03T13:00:00Z',
    ]) {
      await s.whenLoadedAt(dateToTdb(new Date(iso)), ['sun', 'earth', 'moon']);
    }
  });

  const moonRadius = s.body('moon').radiusEquatorialKm;

  function scene(jd: number) {
    const { litAt: moonAt, sun, occluder: earth } = shadowScene(s, 'moon', 'earth', jd);
    const shadowAxis = unit(minus(earth.centre, sun.centre));
    const fromEarth = minus(moonAt, earth.centre);
    const offAxis = minus(fromEarth, times(shadowAxis, dotOf(fromEarth, shadowAxis)));
    return {
      sun,
      earth,
      moonAt,
      /** The Moon's centre from the shadow's axis, and the way out from it. */
      offAxisKm: norm(offAxis),
      outward: unit(offAxis),
      moonDistanceKm: dotOf(fromEarth, shadowAxis),
    };
  }

  /** The point of the Moon farthest from the axis: the last into the umbra, the first out. */
  function totalAt(jd: number): boolean {
    const here = scene(jd);
    const limb = plus(here.moonAt, times(here.outward, moonRadius));
    return sunlightFraction(limb, here.sun, [here.earth]) === 0;
  }

  /** The umbra's radius at the Moon, km, found with the shadow function itself. */
  function umbraRadiusKm(jd: number): number {
    const here = scene(jd);
    const onAxis = plus(here.moonAt, times(here.outward, -here.offAxisKm));
    let inside = 0;
    let outside = 20_000;
    for (let i = 0; i < 60; i += 1) {
      const radius = (inside + outside) / 2;
      if (sunlightFraction(plus(onAxis, times(here.outward, radius)), here.sun, [here.earth]) === 0) {
        inside = radius;
      } else {
        outside = radius;
      }
    }
    return inside;
  }

  // EclipseWise (Espenak), Herald & Sinnott's shadow: TD of greatest eclipse, contacts in
  // UT1 with the ΔT they used, the umbral magnitude and the umbra's geocentric radius.
  const events = [
    {
      name: '2025-09-07',
      greatest: td('2025-09-07T18:12:58.0Z'),
      deltaT: 71.9,
      u2: '2025-09-07T17:30:36.6Z',
      u3: '2025-09-07T18:53:18.0Z',
      umbralMagnitude: 1.36379,
      umbralRadiusDeg: 0.74,
    },
    {
      name: '2026-03-03',
      greatest: td('2026-03-03T11:34:52.1Z'),
      deltaT: 72.1,
      u2: '2026-03-03T11:03:54.4Z',
      u3: '2026-03-03T12:02:52.6Z',
      umbralMagnitude: 1.15263,
      umbralRadiusDeg: 0.7018,
    },
  ];

  for (const event of events) {
    it(`${event.name}: the umbra's size, the magnitude and the minutes of totality`, () => {
      const here = scene(event.greatest);
      const radius = umbraRadiusKm(event.greatest);
      const radiusDeg = Math.atan(radius / here.moonDistanceKm) / DEG;
      const magnitude = (radius + moonRadius - here.offAxisKm) / (2 * moonRadius);

      // Their UT is UT1 with their ΔT; the shadow does not care, so compare in TD.
      const u2 = flip(totalAt, event.greatest - 3600 * SECONDS, event.greatest);
      const u3 = flip(totalAt, event.greatest, event.greatest + 3600 * SECONDS);
      const u2Published = td(event.u2) + event.deltaT * SECONDS;
      const u3Published = td(event.u3) + event.deltaT * SECONDS;

      // The umbra's size to a ten-thousandth of a degree. The magnitude comes out 0.005
      // deeper, and totality 25 to 50 s longer: their shadow is Earth's oblate one, 0.3%
      // narrower pole-wise, where this is round.
      expect(radiusDeg).toBeCloseTo(event.umbralRadiusDeg, 3);
      expect(Math.abs(magnitude - event.umbralMagnitude)).toBeLessThan(0.01);
      expect(Math.abs(u2 - u2Published) / SECONDS).toBeLessThan(45);
      expect(Math.abs(u3 - u3Published) / SECONDS).toBeLessThan(45);
      // And the Moon is dark at its centre at greatest eclipse.
      expect(sunlightFraction(here.moonAt, here.sun, [here.earth])).toBe(0);
    });
  }
});

describeWithData('The total solar eclipse of 12 August 2026, against NASA', () => {
  const s = store!;
  beforeAll(async () => {
    for (const iso of ['2026-08-12T17:00:00Z', '2026-08-12T18:00:00Z', '2026-08-12T19:00:00Z']) {
      await s.whenLoadedAt(dateToTdb(new Date(iso)), ['sun', 'earth', 'moon']);
    }
  });

  const earth = s.body('earth');
  const a = earth.radiusEquatorialKm;
  const c = earth.radiusPolarKm;

  /**
   * NASA's Besselian elements (Espenak; VSOP87/ELP2000-85, ΔT 71.4 s), t in hours from
   * 18:00 TD: the shadow axis's place x, y on the fundamental plane through Earth's centre,
   * in Earth radii; and the umbra's radius l2 on it (negative: the cone's tip is beyond,
   * the eclipse total).
   */
  const bessel = (t: number) => ({
    x: 0.475593 + 0.5189288 * t - 0.0000773 * t * t - 0.0000088 * t ** 3,
    y: 0.771161 - 0.2301664 * t - 0.0001245 * t * t + 0.0000037 * t ** 3,
    l2: -0.008142 + 0.0000935 * t - 0.0000121 * t * t,
  });
  const T0 = td('2026-08-12T18:00:00Z');

  /** The fundamental plane in the scene frame, from the shadow's axis and Earth's pole. */
  function fundamental(jd: number) {
    const { litAt: earthAt, sun, occluder: moon } = shadowScene(s, 'earth', 'moon', jd);
    const axis = unit(minus(sun.centre, moon.centre));
    const pole = triple(poleDirection(jd, earth));
    const xAxis = unit(crossOf(pole, axis));
    const yAxis = crossOf(axis, xAxis);
    const fromEarth = minus(moon.centre, earthAt);
    return { earthAt, sun, moon, axis, pole, xAxis, yAxis, x: dotOf(fromEarth, xAxis) / a, y: dotOf(fromEarth, yAxis) / a };
  }

  it('casts the shadow axis where the Besselian elements put it, with the umbra their size', () => {
    for (const hours of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const jd = T0 + hours * 3600 * SECONDS;
      const here = fundamental(jd);
      const published = bessel(hours);
      // The umbra's radius on the plane, through the shadow function.
      const centre = plus(here.earthAt, plus(times(here.xAxis, here.x * a), times(here.yAxis, here.y * a)));
      let inside = 0;
      let outside = 500;
      for (let i = 0; i < 50; i += 1) {
        const r = (inside + outside) / 2;
        if (sunlightFraction(plus(centre, times(here.xAxis, r)), here.sun, [here.moon]) === 0) {
          inside = r;
        } else {
          outside = r;
        }
      }

      // Within a kilometre where the axis falls. The umbra comes out 1.5 km wider than
      // theirs, and all of it is two constants: NASA shades with a Moon 0.8 km smaller, to
      // its limb valleys, and a Sun 300 km larger than the IAU's nominal 695,700 km.
      expect(Math.abs(here.x - published.x) * a).toBeLessThan(2);
      expect(Math.abs(here.y - published.y) * a).toBeLessThan(2);
      expect(Math.abs(inside + published.l2 * a)).toBeLessThan(2);
    }
  });

  /** Earth-fixed axes in the scene frame: Greenwich, 90° east, the pole. */
  function axes(jd: number): { x: Triple; y: Triple; z: Triple } {
    const z = triple(poleDirection(jd, earth));
    const x = triple(primeMeridianDirection(jd, earth));
    return { x, y: crossOf(z, x), z };
  }

  /** Where the shadow's axis meets the ellipsoid, Earth-fixed km. */
  function centralPoint(jd: number): Triple {
    const { litAt: earthAt, sun, occluder: moon } = shadowScene(s, 'earth', 'moon', jd);
    const { x, y, z } = axes(jd);
    const toFixed = (v: Triple): Triple => [dotOf(v, x), dotOf(v, y), dotOf(v, z)];
    const origin = toFixed(minus(moon.centre, earthAt));
    const direction = toFixed(unit(minus(moon.centre, sun.centre)));
    // (x² + y²)/a² + z²/c² = 1 along origin + t·direction.
    const scaleOf = (v: Triple): Triple => [v[0] / a, v[1] / a, v[2] / c];
    const o = scaleOf(origin);
    const d = scaleOf(direction);
    const qa = dotOf(d, d);
    const qb = 2 * dotOf(o, d);
    const qc = dotOf(o, o) - 1;
    const t = (-qb - Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa);
    return plus(origin, times(direction, t));
  }

  function geodetic(point: Triple): { latitude: number; longitude: number } {
    const horizontal = Math.hypot(point[0], point[1]);
    return {
      latitude: Math.atan2(point[2], ((c * c) / (a * a)) * horizontal) / DEG,
      longitude: Math.atan2(point[1], point[0]) / DEG,
    };
  }

  /** The share of sunlight at an Earth-fixed point, through the shadow function. */
  function light(jd: number, fixed: Triple): number {
    const { litAt: earthAt, sun, occluder: moon } = shadowScene(s, 'earth', 'moon', jd);
    const { x, y, z } = axes(jd);
    const point = plus(earthAt, plus(times(x, fixed[0]), plus(times(y, fixed[1]), times(z, fixed[2]))));
    return sunlightFraction(point, sun, [moon]);
  }

  /** Drops a point onto the ellipsoid along its radius. */
  function onGround(point: Triple): Triple {
    return times(point, 1 / Math.sqrt((point[0] ** 2 + point[1] ** 2) / (a * a) + (point[2] / c) ** 2));
  }

  // NASA's path table (Espenak), central line and width, with their ΔT of 71.4 s.
  const DELTA_T = 71.4;
  const rows = [
    { ut: '2026-08-12T17:46:00Z', latitude: 65 + 10.3 / 60, longitude: -(25 + 12.3 / 60), widthKm: 294 },
    { ut: '2026-08-12T18:00:00Z', latitude: 58 + 16.3 / 60, longitude: -(21 + 34.4 / 60), widthKm: 307 },
    { ut: '2026-08-12T18:20:00Z', latitude: 48 + 12.7 / 60, longitude: -(13 + 2.9 / 60), widthKm: 319 },
  ];

  for (const row of rows) {
    it(`puts the umbra on the ground where NASA does at ${row.ut.slice(11, 16)} UT`, () => {
      const jd = td(row.ut) + DELTA_T * SECONDS;
      const centre = centralPoint(jd);
      const place = geodetic(centre);
      const northKm = (place.latitude - row.latitude) * 111.2;
      const eastKm = (place.longitude - row.longitude) * 111.2 * Math.cos(row.latitude * DEG);
      expect(light(jd, centre)).toBe(0);

      // The path's width: the footprint's extent across the track.
      const before = centralPoint(jd - 30 * SECONDS);
      const after = centralPoint(jd + 30 * SECONDS);
      const up = unit(centre);
      const track = minus(after, before);
      const along = unit(minus(track, times(up, dotOf(track, up))));
      const across = crossOf(up, along);
      let nearest = 0;
      let farthest = 0;
      for (let angle = 0; angle < 360; angle += 2) {
        const way = plus(times(along, Math.cos(angle * DEG)), times(across, Math.sin(angle * DEG)));
        let inside = 0;
        let outside = 600;
        for (let i = 0; i < 40; i += 1) {
          const r = (inside + outside) / 2;
          if (light(jd, onGround(plus(centre, times(way, r)))) === 0) {
            inside = r;
          } else {
            outside = r;
          }
        }
        const reach = dotOf(minus(onGround(plus(centre, times(way, inside))), centre), across);
        nearest = Math.min(nearest, reach);
        farthest = Math.max(farthest, reach);
      }
      const width = farthest - nearest;

      // A few km, from the scene's own Earth rotation and NASA's ΔT; the path 2-3% wider
      // for the two constants above.
      expect(Math.hypot(northKm, eastKm)).toBeLessThan(8);
      expect(Math.abs(width - row.widthKm)).toBeLessThan(12);
    });
  }
});

describeWithData('Ganymede’s shadow on Jupiter, against published predictions', () => {
  const s = store!;
  beforeAll(async () => {
    for (const iso of ['2026-01-14T00:00:00Z', '2026-01-14T06:00:00Z', '2026-01-21T06:00:00Z', '2026-01-21T12:00:00Z']) {
      await s.whenLoadedAt(dateToTdb(new Date(iso)), ['sun', 'earth', 'jupiter', 'ganymede']);
    }
  });

  const jupiter = s.body('jupiter');

  /**
   * Jupiter's sunlit limb at the point nearest Ganymede's shadow. The limb seen along the
   * Sun's light is an ellipse, its pole foreshortened.
   */
  function limbNearShadow(jd: number) {
    const { litAt: jupiterAt, sun, occluder: ganymede } = shadowScene(s, 'jupiter', 'ganymede', jd);
    const away = unit(minus(jupiterAt, sun.centre));
    const offset = minus(ganymede.centre, jupiterAt);
    const across = minus(offset, times(away, dotOf(offset, away)));
    const pole = triple(poleDirection(jd, jupiter));
    const sinTilt = dotOf(pole, away);
    const poleInSky = unit(minus(pole, times(away, sinTilt)));
    const equatorInSky = crossOf(poleInSky, away);
    const req = jupiter.radiusEquatorialKm;
    const rpol = Math.sqrt(jupiter.radiusPolarKm ** 2 * (1 - sinTilt ** 2) + req ** 2 * sinTilt ** 2);
    const reach = Math.hypot(dotOf(across, equatorInSky) / req, dotOf(across, poleInSky) / rpol);
    return {
      limb: plus(jupiterAt, times(across, 1 / reach)),
      sun,
      ganymede,
      /** Ganymede on the Sun's side of Jupiter, the shadow's centre inside the limb. */
      inFront: dotOf(offset, away) < 0,
      centreOnDisc: reach < 1,
      jupiterAt,
      across,
      away,
    };
  }

  /** Whether the half-shadow -- half the Sun's light gone -- has reached the limb. */
  const halfShadowOnDisc = (jd: number): boolean => {
    const here = limbNearShadow(jd);
    return here.inFront && (here.centreOnDisc || sunlightFraction(here.limb, here.sun, [here.ganymede]) < 0.5);
  };

  const lightTime = (jd: number) => (s.distanceBetween('jupiter', 'earth', jd)! / SPEED_OF_LIGHT_KM_S) * SECONDS;

  // Astronomy magazine's daily sky, seen from Earth and given to the minute in EST: the
  // shadow "slipping onto the cloud tops" at 12:58 a.m. on 14 January and appearing around
  // 4:58 a.m. on the 21st -- 05:58 and 09:58 UT.
  for (const seen of ['2026-01-14T05:58:00Z', '2026-01-21T09:58:00Z']) {
    it(`reaches Jupiter's limb at ${seen.slice(0, 16)} UT, seen from Earth`, () => {
      const published = dateToTdb(new Date(seen));
      // At Jupiter, 35 minutes before it is seen.
      const atJupiter = flip(halfShadowOnDisc, published - 3 * 3600 * SECONDS, published);
      const fromEarth = atJupiter + lightTime(atJupiter);
      expect(Math.abs(fromEarth - published) / SECONDS).toBeLessThan(90);
    });
  }

  it('is a true umbra at mid-transit: Ganymede hides the whole Sun from the cloud tops', () => {
    const published = dateToTdb(new Date('2026-01-14T05:58:00Z'));
    const ingress = flip(halfShadowOnDisc, published - 3 * 3600 * SECONDS, published);
    // The transit lasts 3 h 20 m; 100 minutes in, the shadow is near the middle.
    const here = limbNearShadow(ingress + 100 * 60 * SECONDS);
    expect(here.centreOnDisc).toBe(true);
    const depth = Math.sqrt(jupiter.radiusEquatorialKm ** 2 - dotOf(here.across, here.across));
    const ground = plus(here.jupiterAt, plus(here.across, times(here.away, -depth)));
    expect(sunlightFraction(ground, here.sun, [here.ganymede])).toBe(0);
  });
});
