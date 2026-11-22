import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BeltFetchers } from '../core/belt.ts';
import { COMET, COMET_FLOATS, cometAxes, cometMagnitude, cometPosition, loadComets, medianM1, type Comets } from '../core/comets.ts';
import { stumpff } from '../core/conic.ts';
import { describeWithData as withData } from '../core/describeWithData.ts';
import { describe, expect, it, vi } from 'vitest';

import {
  COMET_STATIC_FLOATS,
  COMET_TIME_FLOATS,
  COMET_VERTEX_SHADER,
  cometHelioF32,
  cometLook,
  cometLookF32,
  cometPerihelia,
  cometStaticBuffer,
  cometTimes,
  expF32,
  LAGUERRE_ITERATIONS,
  REBASE_DAYS,
  SERIES_TERMS,
  SERIES_Z_MAX,
  stumpffF32,
} from './cometShader.ts';

/**
 * The comets' vertex shader, through its TypeScript mirror, against conic.ts's float64.
 *
 * What is measured is how far the GPU's float32 puts a comet from where the CPU's float64
 * put it before the work moved, as a share of the comet's distance from the Sun: a pixel is
 * a thousandth or so of the camera's distance, so a few parts in a million is a few
 * thousandths of a pixel for a camera as far from the comet as the comet is from the Sun.
 */

const MU = 1.32712440041e11;
const AU = 149_597_870.7;
const DEG = Math.PI / 180;
const REFERENCE_JD = 2461332.5;

interface Worst {
  share: number;
  km: number;
  steps: number;
  where: string;
}

/** Comets of the given rows: q (AU), e, tp (days after the reference). */
function syntheticComets(rows: readonly (readonly [number, number, number])[]): Comets {
  const records = new Float32Array(rows.length * COMET_FLOATS);
  rows.forEach(([qAu, e, tp], k) => {
    const base = k * COMET_FLOATS;
    records[base + COMET.q] = qAu * AU;
    records[base + COMET.e] = e;
    records[base + COMET.i] = (17 + 37 * k) * DEG;
    records[base + COMET.node] = (29 + 71 * k) * DEG;
    records[base + COMET.peri] = (113 + 53 * k) * DEG;
    records[base + COMET.tp] = tp;
    records[base + COMET.M1] = Number.NaN;
    records[base + COMET.K1] = Number.NaN;
  });
  return {
    info: { referenceJd: REFERENCE_JD, count: rows.length } as Comets['info'],
    records,
    axes: cometAxes(records),
    fallbackM1: medianM1(records),
  };
}

/** The shader's answer for comet `k` at `jd`, with the epoch `lag` days behind the clock. */
function shaderAt(comets: Comets, statics: Float32Array, k: number, jd: number, lag: number) {
  const epoch = jd - lag;
  const times = new Float32Array(comets.info.count * COMET_TIME_FLOATS);
  cometTimes(cometPerihelia(comets, MU), comets.info.referenceJd, epoch, times);
  const s = k * COMET_STATIC_FLOATS;
  return cometHelioF32(
    statics[s]!,
    statics[s + 1]!,
    statics[s + 2]!,
    [statics[s + 3]!, statics[s + 4]!, statics[s + 5]!],
    [statics[s + 6]!, statics[s + 7]!, statics[s + 8]!],
    times[k * COMET_TIME_FLOATS]!,
    jd - epoch,
    Math.sqrt(MU),
  );
}

function worstOver(comets: Comets, jds: readonly number[], lags: readonly number[]): Worst {
  const statics = cometStaticBuffer(comets, MU);
  const out = new Float64Array(comets.info.count * 3);
  const worst: Worst = { share: 0, km: 0, steps: 0, where: '' };
  for (const jd of jds) {
    for (const lag of lags) {
      const epoch = jd - lag;
      const times = new Float32Array(comets.info.count * COMET_TIME_FLOATS);
      cometTimes(cometPerihelia(comets, MU), comets.info.referenceJd, epoch, times);
      for (let k = 0; k < comets.info.count; k += 1) {
        const rAu = cometPosition(comets, k, jd, MU, out);
        const s = k * COMET_STATIC_FLOATS;
        const gpu = cometHelioF32(
          statics[s]!,
          statics[s + 1]!,
          statics[s + 2]!,
          [statics[s + 3]!, statics[s + 4]!, statics[s + 5]!],
          [statics[s + 6]!, statics[s + 7]!, statics[s + 8]!],
          times[k * COMET_TIME_FLOATS]!,
          jd - epoch,
          Math.sqrt(MU),
        );
        const km = Math.hypot(gpu.x - out[k * 3]!, gpu.y - out[k * 3 + 1]!, gpu.z - out[k * 3 + 2]!);
        const share = km / (rAu * AU);
        // Not Math.max: a NaN must count as the worst.
        if (!(share <= worst.share)) {
          worst.share = share;
          worst.km = km;
          worst.where = `comet ${k} (q ${(comets.records[k * COMET_FLOATS]! / AU).toPrecision(4)} AU, e ${comets.records[k * COMET_FLOATS + 1]}) at JD ${jd}, r ${rAu.toPrecision(4)} AU`;
        }
        worst.steps = Math.max(worst.steps, gpu.steps);
      }
    }
  }
  return worst;
}

/** Days from perihelion: dense near it, out to a century either side. */
function daysAround(tp: number): number[] {
  const out: number[] = [tp];
  for (let exponent = -4; exponent <= 4.6; exponent += 0.2) {
    out.push(tp + 10 ** exponent, tp - 10 ** exponent);
  }
  return out;
}

const ECCENTRICITIES = [0, 0.2, 0.5, 0.9, 0.99, 0.995, 0.999, 0.9999, 1, 1.0001, 1.001, 1.05, 1.5, 3, 6.14];
const PERIHELIA_AU = [0.006, 0.1, 0.5, 1, 1.5, 5];

describe('Stumpff in float32', () => {
  it('matches the float64 functions to a few float32 steps on both sides of the series switch', () => {
    let worst = 0;
    // The ellipse's z is E^2, at most pi^2 once reduced to half a period; the hyperbola's runs
    // as far negative as -F^2, -400 at F = 20 -- e^20 times the semi-major axis out.
    for (let z = -400; z <= SERIES_Z_MAX; z += 0.01) {
      const [C, S, c1] = stumpffF32(z);
      const exact = stumpff(z);
      worst = Math.max(
        worst,
        Math.abs(C - exact.C) / exact.C,
        Math.abs(S - exact.S) / exact.S,
        // 1 - z S passes through zero at z = pi^2: measured against its scale, not itself.
        Math.abs(c1 - (1 - z * exact.S)) / Math.max(1, Math.abs(1 - z * exact.S)),
      );
    }
    expect(worst).toBeLessThan(2e-6);
  });

  it('covers every z an answer can have with the series: an ellipse reduced to half a period', () => {
    expect(SERIES_Z_MAX).toBeGreaterThan((Math.PI + 0.3) ** 2);
  });

  it('builds exp from a series and an exact power of two, to float32', () => {
    let worst = 0;
    for (let x = -40; x <= 40; x += 0.003) {
      worst = Math.max(worst, Math.abs(expF32(x) / Math.exp(x) - 1));
    }
    expect(worst).toBeLessThan(5e-7);
  });
});

describe('the comet shader, against conic.ts', () => {
  // Every pairing a comet can have: a sungrazer's perihelion only on a near-parabolic orbit,
  // as theirs are -- one 0.006 AU out on a circle would go round five times a day.
  const rows: [number, number, number][] = [];
  for (const e of ECCENTRICITIES) {
    for (const q of PERIHELIA_AU) {
      if (q >= 0.5 || e >= 0.99) {
        rows.push([q, e, 0]);
      }
    }
  }
  const comets = syntheticComets(rows);

  it('agrees on every conic, near perihelion and a century out, epoch lagging up to a day', () => {
    const jds = daysAround(0).map((d) => REFERENCE_JD + d);
    const worst = worstOver(comets, jds, [0, 0.5, -REBASE_DAYS, REBASE_DAYS]);
    // 5.9e-6 at worst, measured: 5 km at the perihelion of a 0.006 AU hyperbola at e = 6.
    expect(worst.share, worst.where).toBeLessThan(1e-5);
  });

  it('converges within its iterations, with one to spare', () => {
    const jds = daysAround(0).map((d) => REFERENCE_JD + d);
    expect(worstOver(comets, jds, [REBASE_DAYS]).steps).toBeLessThan(LAGUERRE_ITERATIONS);
  });

  it('places a perihelion of centuries ago at its perihelion today, a whole number of orbits on', () => {
    // Encke-like, its listed perihelion 150 years before the clock: 45 orbits since.
    const encke = syntheticComets([[0.336, 0.848, -150 * 365.25]]);
    const statics = cometStaticBuffer(encke, MU);
    const period = statics[2]!;
    const atPerihelion = REFERENCE_JD - 150 * 365.25 + 45 * period;
    const gpu = shaderAt(encke, statics, 0, atPerihelion, REBASE_DAYS);
    expect(Math.abs(gpu.rAu - 0.336) / 0.336).toBeLessThan(1e-5);
  });
});

describe('the look', () => {
  it('is cometLook of cometMagnitude, as the frame loop worked it out', () => {
    for (const rAu of [0.01, 0.3, 1, 2.5, 7, 40, 300]) {
      for (const [m1, k1] of [[5.5, 8], [12, 4], [15, 10]] as const) {
        const cpu = cometLook(cometMagnitude(m1, k1, rAu, 12));
        const gpu = cometLookF32(m1, k1, Math.fround(rAu));
        expect(gpu.sizePx).toBeCloseTo(cpu.sizePx, 5);
        expect(gpu.alpha).toBeCloseTo(cpu.alpha, 5);
      }
    }
  });
});

describe('the vertex shader', () => {
  it('iterates as many times as the mirror', () => {
    expect(COMET_VERTEX_SHADER).toContain(`k < ${LAGUERRE_ITERATIONS}; k++`);
    expect(COMET_VERTEX_SHADER).toContain(`k < ${SERIES_TERMS}; k++`);
  });

  it('writes the logarithmic depth the rest of the scene is tested against', () => {
    expect(COMET_VERTEX_SHADER).toContain('#include <logdepthbuf_vertex>');
  });
});

// The generated comets, when there are any.
const DATA_ROOT = join(import.meta.dirname, '../../public');
const disk: BeltFetchers = {
  json: async (path) => {
    try {
      return JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;
    } catch {
      return null;
    }
  },
  binary: async (path) => {
    try {
      const bytes = await readFile(join(DATA_ROOT, path));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } catch {
      return null;
    }
  },
};
vi.spyOn(console, 'info').mockImplementation(() => {});
const generated = await loadComets(disk).catch(() => null);
vi.restoreAllMocks();

withData(generated !== null)('the comet shader, on the catalogue', () => {
  it('puts every comet where conic.ts does, from a century ago to a century on', () => {
    const comets = generated!;
    const reference = comets.info.referenceJd;
    const jds = [reference - 36_525, reference - 3652.5, reference, reference + 0.37, reference + 365.25, reference + 3652.5, reference + 36_525];
    const worst = worstOver(comets, jds, [0, REBASE_DAYS]);
    // 5.0e-7 at worst, measured: 21,000 km for a comet 280 AU out.
    expect(worst.share, worst.where).toBeLessThan(1e-6);
  });

  it('puts each comet at its perihelion distance at its perihelion time', () => {
    const comets = generated!;
    const statics = cometStaticBuffer(comets, MU);
    let worst = 0;
    for (let k = 0; k < comets.info.count; k += 1) {
      const tp = comets.info.referenceJd + comets.records[k * COMET_FLOATS + COMET.tp]!;
      const q = comets.records[k * COMET_FLOATS + COMET.q]! / AU;
      const gpu = shaderAt(comets, statics, k, tp, REBASE_DAYS);
      worst = Math.max(worst, Math.abs(gpu.rAu - q) / q);
    }
    // 6.7e-8, measured.
    expect(worst).toBeLessThan(1e-6);
  });
});
