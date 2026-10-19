import type { BeltInfo, OsculatingElements } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { RECORD, RECORD_FLOATS } from '../core/belt.ts';
import { propagate } from '../core/kepler.ts';
import { SECONDS_PER_DAY } from '../core/time.ts';
import { buildBeltGeometry } from './AsteroidBelt.tsx';
import {
  BELT_FRAGMENT_SHADER,
  BELT_VERTEX_SHADER,
  beltPosition,
  cubicStartF32,
  dotAlpha,
  dotDiameterPx,
  DOT_BRIGHT_ALPHA,
  DOT_BRIGHT_PX,
  DOT_FAINT_ALPHA,
  DOT_FAINT_PX,
  KEPLER_ITERATIONS,
  meanAnomalyF32,
  solveKeplerF32,
} from './beltShader.ts';
import { AU_KM } from './scale.ts';

/**
 * The belt's vertex shader, through its TypeScript mirror.
 *
 * Nothing runs GLSL in a test, so what is checked is the mirror -- the same statements,
 * with float32 rounding written out -- against the app's float64 two-body propagator.
 * That measures what doing the orbit on the GPU in float32 costs, and it is the number
 * that has to stay far below what the two-body model itself costs: 40,000 km and more a
 * year from the elements' epoch.
 */

const DEG = Math.PI / 180;

/** e up to 0.999, then 0.9965 and 0.9996: the belt's most eccentric orbit is at 0.99959. */
function eccentricities(): number[] {
  const grid: number[] = [];
  for (let k = 0; k <= 999; k += k < 900 ? 9 : 1) {
    grid.push(Math.fround(k / 1000));
  }
  grid.push(Math.fround(0.9965), Math.fround(0.9996));
  return grid;
}

/** M across [-π, π), plus runs down to 1e-9 either side of perihelion and of aphelion. */
function meanAnomalies(steps: number): number[] {
  const grid: number[] = [];
  for (let k = 0; k < steps; k += 1) {
    grid.push(Math.fround(-Math.PI + (2 * Math.PI * k) / steps));
  }
  for (let exponent = -9; exponent <= 0; exponent += 0.1) {
    const small = 10 ** exponent;
    grid.push(
      Math.fround(small),
      Math.fround(-small),
      Math.fround(Math.PI - small),
      Math.fround(-Math.PI + small),
    );
  }
  return grid;
}

/** Worst |E - e sin E - M|, evaluated in float64, of the float32 solve. */
function worstResidual(iterations: number, Ms: readonly number[], es: readonly number[]): number {
  let worst = 0;
  for (const e of es) {
    for (const M of Ms) {
      const E = solveKeplerF32(M, e, iterations);
      // Not Math.max: a NaN must count as the worst, not vanish.
      const residual = Math.abs(E - e * Math.sin(E) - M);
      worst = residual <= worst ? worst : residual;
    }
  }
  return worst;
}

/**
 * Kepler's equation by bisection, float64: slow, and it cannot fail. E - e·sin E is
 * monotonic, so halving an interval around the root always closes on it -- the reference
 * Newton's answers are held to, at eccentricities where Newton itself can diverge.
 */
function keplerByBisection(M: number, e: number): number {
  let low = -Math.PI - 1;
  let high = Math.PI + 1;
  for (let k = 0; k < 100; k += 1) {
    const mid = (low + high) / 2;
    if (mid - e * Math.sin(mid) < M) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

describe("Kepler's equation in float32", () => {
  const es = eccentricities();
  const Ms = meanAnomalies(1500);

  it(`is solved to float32's own precision in ${KEPLER_ITERATIONS} iterations, up to e = 0.9996`, () => {
    // 3.8e-7 rad on the full grid in beltShader.ts: one and a half float32 steps of E
    // near 2 rad, which is as finely as the format can write the answer.
    expect(worstResidual(KEPLER_ITERATIONS, Ms, es)).toBeLessThan(4e-7);
  });

  it('reaches that floor one iteration early, which is the margin', () => {
    expect(worstResidual(KEPLER_ITERATIONS - 1, Ms, es)).toBeLessThan(4e-7);
    // And is not there yet one before that: the count is measured, not generous.
    expect(worstResidual(KEPLER_ITERATIONS - 2, Ms, es)).toBeGreaterThan(1e-5);
  });

  it('lands on the root, against a bisection that cannot fail', () => {
    let worst = 0;
    for (const e of es) {
      for (const M of Ms) {
        const error = Math.abs(solveKeplerF32(M, e) - keplerByBisection(M, e));
        worst = error <= worst ? worst : error;
      }
    }
    // 1.7e-6 rad on the full grid, at e = 0.999 a hair before perihelion, where one
    // float32 step of the residual is five hundred of E. Elsewhere well under a micro-radian.
    expect(worst).toBeLessThan(2e-6);
  });

  it('needs the cubic start: the plain one diverges near perihelion above e = 0.99', () => {
    // The case in beltShader.ts, in float64 even: kepler.ts's start, Newton, a hundred times.
    const M = -0.04461061568097513;
    const e = 0.994;
    let E = M + e * Math.sin(M);
    for (let k = 0; k < 100; k += 1) {
      E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    expect(Math.abs(E - e * Math.sin(E) - M)).toBeGreaterThan(1);
    // From the cubic start, in float32, in four.
    const fromCubic = solveKeplerF32(Math.fround(M), Math.fround(e));
    expect(Math.abs(fromCubic - keplerByBisection(Math.fround(M), Math.fround(e)))).toBeLessThan(1e-6);
  });

  it('starts from the cubic root, which near perihelion is nearly the answer', () => {
    for (const e of [0.6, 0.9, 0.99, 0.996]) {
      for (const M of [1e-6, 1e-3, 0.05, -0.05, 0.5, -2, 3.1]) {
        const start = cubicStartF32(Math.fround(M), Math.fround(e));
        expect(Math.abs(start)).toBeLessThanOrEqual(Math.PI + 1e-6);
        // Same side of perihelion as the answer: Newton never has to cross it.
        expect(Math.sign(start)).toBe(Math.sign(M));
      }
    }
    expect(cubicStartF32(0, 0.99)).toBe(0);
  });

  it('wraps the mean anomaly into [-π, π), forward and back', () => {
    for (const dt of [-36_525, -3652.5, -1, 0, 0.5, 365.25, 3652.5, 36_525]) {
      const M = meanAnomalyF32(4, 0.0038, dt);
      expect(M).toBeGreaterThanOrEqual(-Math.PI - 1e-6);
      expect(M).toBeLessThan(Math.PI + 1e-6);
      // The same angle, to float32's precision on n·Δt -- 1.2e-5 rad at a century.
      const exact = 4 + 0.0038 * dt;
      const turns = (exact - M) / (2 * Math.PI);
      expect(Math.abs(turns - Math.round(turns)) * 2 * Math.PI).toBeLessThan(2e-5);
    }
  });
});

/** One asteroid's record, rounded to float32 as the file stores it. */
interface TestOrbit {
  readonly a: number;
  readonly e: number;
  readonly i: number;
  readonly node: number;
  readonly peri: number;
  readonly M: number;
  /** Mean motion, rad/day: worked out from a about the Sun, as SBDB does. */
  readonly n: number;
}

const GM_SUN = 1.32712440041e11;

function orbit(aAu: number, e: number, iDeg: number, nodeDeg: number, periDeg: number, MDeg: number): TestOrbit {
  const a = aAu * AU_KM;
  return {
    a,
    e,
    i: iDeg * DEG,
    node: nodeDeg * DEG,
    peri: periDeg * DEG,
    M: MDeg * DEG,
    n: Math.sqrt(GM_SUN / a ** 3) * SECONDS_PER_DAY,
  };
}

/**
 * Orbits across every eccentricity the belt file can hold, from a main-belt circle to a
 * near-parabolic sungrazer, at inclinations up to a retrograde 160 degrees.
 */
const ORBITS: readonly TestOrbit[] = [
  orbit(2.77, 0, 10.6, 80.3, 73.6, 0),
  orbit(2.36, 0.1, 7.1, 103.8, 151.2, 200),
  orbit(1.46, 0.5, 10.8, 304.3, 178.9, 350),
  orbit(5.2, 0.9, 35, 20, 300, 10),
  orbit(2.6, 0.99, 160, 250, 45, 359.5),
  orbit(1.08, 0.99, 22.2, 88, 31, 0.2),
];

const REFERENCE_JD = 2461000.5;

/** The records as the generator writes them: M wrapped into [-π, π), as the file holds it. */
function recordsOf(orbits: readonly TestOrbit[]): Float32Array {
  const records = new Float32Array(orbits.length * RECORD_FLOATS);
  orbits.forEach((o, k) => {
    const M = o.M >= Math.PI ? o.M - 2 * Math.PI : o.M;
    records.set([o.a, o.e, o.i, o.node, o.peri, M, o.n, 10, 0], k * RECORD_FLOATS);
  });
  return records;
}

/**
 * The record as kepler.ts takes it: the very float32 values the shader reads, so what is
 * measured is the shader's arithmetic and not the file's rounding.
 */
function elementsOf(records: Float32Array, index: number): OsculatingElements {
  const at = (element: keyof typeof RECORD) => records[index * RECORD_FLOATS + RECORD[element]]!;
  const a = at('a');
  const e = at('e');
  return {
    id: `test-${index}`,
    center: '500@10',
    epochJd: REFERENCE_JD,
    eccentricity: e,
    periapsisKm: a * (1 - e),
    inclinationDeg: at('i') / DEG,
    ascendingNodeDeg: at('node') / DEG,
    argPeriapsisDeg: at('peri') / DEG,
    periapsisTimeJd: REFERENCE_JD - at('M') / at('n'),
    meanMotionDegPerSec: at('n') / DEG / SECONDS_PER_DAY,
    meanAnomalyDeg: at('M') / DEG,
    trueAnomalyDeg: 0,
    semiMajorAxisKm: a,
    apoapsisKm: a * (1 + e),
    periodSec: ((2 * Math.PI) / at('n')) * SECONDS_PER_DAY,
  };
}

describe('beltPosition, against kepler.ts', () => {
  const records = recordsOf(ORBITS);

  /** Worst error over `dts`, km and as a fraction of each orbit's semi-major axis. */
  function worstError(dts: readonly number[]): { readonly km: number; readonly relative: number } {
    let km = 0;
    let relative = 0;
    for (let k = 0; k < ORBITS.length; k += 1) {
      for (const dt of dts) {
        const got = beltPosition(records, k, dt);
        const want = propagate(elementsOf(records, k), REFERENCE_JD + dt).position;
        const error = Math.hypot(got.x - want.x, got.y - want.y, got.z - want.z);
        km = Math.max(km, error);
        relative = Math.max(relative, error / ORBITS[k]!.a);
      }
    }
    return { km, relative };
  }

  it('agrees at the reference instant to a few float32 steps of the orbit', () => {
    // Measured: 3.2e-7 of the orbit at worst, 80 km. A float32 holds 6e-8 of a number,
    // and the chain from M to the rotated ellipse is a dozen operations long.
    expect(worstError([0]).relative).toBeLessThan(5e-7);
  });

  it('agrees within a year either side to under 200 km', () => {
    // Measured worst: 141 km. The two-body model itself is off by 40,000 to 190,000 km
    // at a year, so the GPU's share of the error is a tenth of a percent.
    expect(worstError([-365.25, -30, -1, 0.25, 1, 30, 365.25]).km).toBeLessThan(200);
  });

  it('agrees ten years and a century out to what float32 holds of n·Δt', () => {
    // From here the float32 rounding of n·Δt is nearly all of it: n·Δt reaches 14 rad
    // for a main-belt orbit in ten years, where a float32 step is 1e-6 rad. Measured:
    // 2.4e-6 of the orbit at ten years (404 km for a Ceres-like one), 3.1e-5 at a
    // century (13,000 km at 2.8 AU) -- against two-body drift of about a degree at ten
    // years already, millions of km.
    expect(worstError([-3652.5, 3652.5]).relative).toBeLessThan(3e-6);
    expect(worstError([-36_525, 36_525]).relative).toBeLessThan(4e-5);
  });

  it('is in the ecliptic frame kepler.ts uses: the node on the x-y plane, rising', () => {
    // An orbit whose argument of perihelion is zero is at its ascending node at
    // perihelion: on the ecliptic, in the direction of the node's longitude, going north.
    const node = 40 * DEG;
    const nodal = recordsOf([{ ...orbit(2.5, 0.2, 30, 40, 0, 0) }]);
    const atNode = beltPosition(nodal, 0, 0);
    expect(Math.abs(atNode.z)).toBeLessThan(1);
    expect(Math.atan2(atNode.y, atNode.x)).toBeCloseTo(node, 5);
    expect(beltPosition(nodal, 0, 1).z).toBeGreaterThan(0);
  });
});

describe("the Sun's offset, split in two", () => {
  const records = recordsOf(ORBITS);

  it('puts an asteroid beside the focus to the metre', () => {
    // A focus 1,000 km from an asteroid at 2.8 AU: the shader's sum must land on that
    // 1,000 km, though both numbers it adds are four hundred million.
    const helio = beltPosition(records, 0, 100);
    const offset = { x: 1000, y: -500, z: 200 };
    const sunKm = { x: offset.x - helio.x, y: offset.y - helio.y, z: offset.z - helio.z };

    const got = beltPosition(records, 0, 100, sunKm);

    expect(Math.hypot(got.x - offset.x, got.y - offset.y, got.z - offset.z)).toBeLessThan(1e-3);
  });

  it('is what keeps the belt still: one float32 would be off by tens of kilometres', () => {
    // The same sum with the Sun's offset as a single float32, as an unsplit uniform
    // would be. Every asteroid would share this error, and it changes as the focus
    // moves: the whole belt stepping together.
    // An asteroid 4.1e8 km out along x, and a focus 1,000.37 km beyond it.
    const asteroidX = Math.fround(4.1e8);
    const sunX = 1000.37 - asteroidX;
    const unsplit = Math.fround(asteroidX + Math.fround(sunX));
    const split = Math.fround(
      Math.fround(asteroidX + Math.fround(sunX)) + Math.fround(sunX - Math.fround(sunX)),
    );
    // A float32 step at 4.1e8 km is 32 km, and this one lands 8.4 km off.
    expect(Math.abs(unsplit - 1000.37)).toBeGreaterThan(8);
    expect(Math.abs(split - 1000.37)).toBeLessThan(1e-3);
  });

  it('adds the Sun 40 AU away -- Pluto in focus -- to float32 of the sum', () => {
    const sunKm = { x: -40 * AU_KM, y: 3.1e8, z: -1.2e9 };
    const helio = beltPosition(records, 1, 0);
    const got = beltPosition(records, 1, 0, sunKm);
    const want = { x: helio.x + sunKm.x, y: helio.y + sunKm.y, z: helio.z + sunKm.z };
    // A float32 step at 6e9 km is 512 km; the belt is then 40 AU from the camera, where
    // a pixel is millions of kilometres.
    expect(Math.hypot(got.x - want.x, got.y - want.y, got.z - want.z)).toBeLessThan(512);
  });
});

describe('the dots', () => {
  it('run from the faintest to the brightest size and opacity across eight magnitudes', () => {
    expect(dotDiameterPx(15, 15)).toBe(DOT_FAINT_PX);
    expect(dotDiameterPx(7, 15)).toBe(DOT_BRIGHT_PX);
    expect(dotDiameterPx(3, 15)).toBe(DOT_BRIGHT_PX);
    expect(dotAlpha(15, 15)).toBe(DOT_FAINT_ALPHA);
    expect(dotAlpha(4, 15)).toBe(DOT_BRIGHT_ALPHA);
    expect(dotDiameterPx(11, 15)).toBeCloseTo((DOT_FAINT_PX + DOT_BRIGHT_PX) / 2, 10);
  });

  it('stay about a pixel: a convention, never something that claims a size', () => {
    expect(DOT_FAINT_PX).toBeGreaterThanOrEqual(1);
    expect(DOT_BRIGHT_PX).toBeLessThanOrEqual(1.5);
    expect(DOT_BRIGHT_ALPHA).toBeLessThan(1);
  });
});

describe('the shaders', () => {
  it('write the logarithmic depth the rest of the scene is tested against', () => {
    // Without these the dots are depth-tested at the wrong distance: in front of every
    // planet, or behind all of them.
    expect(BELT_VERTEX_SHADER).toContain('#include <logdepthbuf_pars_vertex>');
    expect(BELT_VERTEX_SHADER).toContain('#include <logdepthbuf_vertex>');
    expect(BELT_FRAGMENT_SHADER).toContain('#include <logdepthbuf_pars_fragment>');
    expect(BELT_FRAGMENT_SHADER).toContain('#include <logdepthbuf_fragment>');
    // After gl_Position is written, which the chunk reads.
    expect(BELT_VERTEX_SHADER.indexOf('#include <logdepthbuf_vertex>')).toBeGreaterThan(
      BELT_VERTEX_SHADER.indexOf('gl_Position ='),
    );
  });

  it('iterate exactly as many times as the mirror', () => {
    expect(BELT_VERTEX_SHADER).toContain(`k < ${KEPLER_ITERATIONS};`);
  });

  it('size the dots by the same rule as the mirror', () => {
    expect(BELT_VERTEX_SHADER).toContain(`mix(${DOT_FAINT_PX.toFixed(3)}, ${DOT_BRIGHT_PX.toFixed(3)}, bright)`);
    expect(BELT_VERTEX_SHADER).toContain(`mix(${DOT_FAINT_ALPHA.toFixed(3)}, ${DOT_BRIGHT_ALPHA.toFixed(3)}, bright)`);
  });
});

describe('buildBeltGeometry', () => {
  const info = { count: 2, referenceJd: REFERENCE_JD, magnitudeLimit: 15 } as unknown as BeltInfo;
  const records = recordsOf(ORBITS.slice(0, 2));
  const geometry = buildBeltGeometry({ info, records });

  it('reads the file buffer itself, with no copy', () => {
    const shape = geometry.getAttribute('aShape') as THREE.InterleavedBufferAttribute;
    expect(shape.data.array).toBe(records);
    expect(shape.data.stride).toBe(RECORD_FLOATS);
  });

  it('points each attribute at its own elements', () => {
    const read = (name: string, component: number, index: number): number => {
      const attribute = geometry.getAttribute(name) as THREE.InterleavedBufferAttribute;
      return attribute.getComponent(index, component);
    };
    const at = (index: number, element: keyof typeof RECORD) =>
      records[index * RECORD_FLOATS + RECORD[element]]!;
    for (const index of [0, 1]) {
      expect(read('aShape', 0, index)).toBe(at(index, 'a'));
      expect(read('aShape', 1, index)).toBe(at(index, 'e'));
      expect(read('aShape', 2, index)).toBe(at(index, 'i'));
      expect(read('aAngles', 0, index)).toBe(at(index, 'node'));
      expect(read('aAngles', 1, index)).toBe(at(index, 'peri'));
      expect(read('aAngles', 2, index)).toBe(at(index, 'M'));
      expect(read('aMotion', 0, index)).toBe(at(index, 'n'));
      expect(read('aMotion', 1, index)).toBe(at(index, 'H'));
    }
  });

  it('draws every asteroid, and is never culled by its bounds', () => {
    expect(geometry.drawRange.count).toBe(2);
    expect(geometry.boundingSphere!.radius).toBe(Infinity);
  });
});
