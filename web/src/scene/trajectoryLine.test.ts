import type { PathTable, VectorTable } from '@sss/tools/types';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { interpolateState } from '../core/hermite.ts';
import { SECONDS_PER_DAY } from '../core/time.ts';
import type { Vec3 } from '../core/vec3.ts';
import { KM_PER_UNIT } from './scale.ts';
import {
  chordsFor,
  CLOSE_IN_STEPS,
  closeInTimes,
  orbitalPeriodDays,
  splitDouble,
  TABLE_TRAIL_MARGIN,
  TableTrail,
  tablePath,
  tessellatePath,
  TRAIL_OPACITY,
  trailFade,
  TrajectoryLine,
} from './trajectoryLine.ts';

const START = 2_461_041.5;
const RADIUS_KM = 1.5e8;
const PERIOD_DAYS = 365.25;
const MOTION = (2 * Math.PI) / (PERIOD_DAYS * SECONDS_PER_DAY); // rad/s

/** A circular orbit at 1 AU, sampled every `stepDays`, held to `toleranceKm`. */
function circlePath(stepDays: number, toleranceKm: number, gaps: number[] = []): PathTable {
  const t: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  for (let day = 0; day <= 360; day += stepDays) {
    const angle = MOTION * day * SECONDS_PER_DAY;
    t.push(START + day);
    x.push(RADIUS_KM * Math.cos(angle));
    y.push(RADIUS_KM * Math.sin(angle));
    vx.push(-RADIUS_KM * MOTION * Math.sin(angle));
    vy.push(RADIUS_KM * MOTION * Math.cos(angle));
  }
  const zeros = t.map(() => 0);
  return {
    id: 'probe',
    horizonsId: '-1',
    center: '500@0',
    count: t.length,
    t,
    x,
    y,
    z: zeros,
    vx,
    vy,
    vz: zeros,
    toleranceKm: t.slice(1).map(() => toleranceKm),
    gaps,
  };
}

/** Distance from `p` to the segment a-b, km. */
function toSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
  const length2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const s = Math.min(1, Math.max(0, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / length2));
  return Math.hypot(ap.x - s * ab.x, ap.y - s * ab.y, ap.z - s * ab.z);
}

describe('chordsFor', () => {
  it('needs one chord for a straight line', () => {
    const path = circlePath(10, 100);
    const straight: PathTable = { ...path, vx: path.vx.map(() => 20), vy: path.vy.map(() => 0) };
    expect(chordsFor(straight, 3, new Set())).toBe(1);
  });

  it('cuts a curve until its sag is inside the tolerance', () => {
    const path = circlePath(10, 100);
    // Sag of a 10-day arc at 1 AU: r * theta^2 / 8, theta = 0.172 rad -- about 555,000 km.
    const theta = MOTION * 10 * SECONDS_PER_DAY;
    const sag = (RADIUS_KM * theta * theta) / 8;
    expect(chordsFor(path, 0, new Set())).toBe(Math.ceil(Math.sqrt(sag / 100)));
  });

  it('draws nothing across a gap', () => {
    expect(chordsFor(circlePath(10, 100), 4, new Set([4]))).toBe(0);
  });
});

describe('tessellatePath', () => {
  const path = circlePath(10, 100);
  const { pointsKm, firstChord } = tessellatePath(path);
  const point = (index: number): Vec3 => ({
    x: pointsKm[index * 3]!,
    y: pointsKm[index * 3 + 1]!,
    z: pointsKm[index * 3 + 2]!,
  });

  it('starts and ends every interval on its own samples', () => {
    for (let i = 0; i + 1 < path.count; i += 1) {
      const first = point(firstChord[i]! * 2);
      const last = point(firstChord[i + 1]! * 2 - 1);
      expect(first).toEqual({ x: path.x[i], y: path.y[i], z: path.z[i] });
      expect(last).toEqual({ x: path.x[i + 1], y: path.y[i + 1], z: path.z[i + 1] });
    }
  });

  it('keeps the drawn line within the tolerance of the curve', () => {
    let worst = 0;
    for (let i = 0; i + 1 < path.count; i += 1) {
      for (let k = 0; k <= 200; k += 1) {
        const jd = path.t[i]! + ((path.t[i + 1]! - path.t[i]!) * k) / 200;
        const on = interpolateState(path, jd)!.position;
        let nearest = Infinity;
        for (let chord = firstChord[i]!; chord < firstChord[i + 1]!; chord += 1) {
          nearest = Math.min(nearest, toSegment(on, point(chord * 2), point(chord * 2 + 1)));
        }
        worst = Math.max(worst, nearest);
      }
    }
    expect(worst).toBeLessThanOrEqual(100);
    // And not by wasting chords: the worst is a real fraction of what was allowed.
    expect(worst).toBeGreaterThan(25);
  });

  it('leaves a gap where the path jumps', () => {
    const gapped = tessellatePath(circlePath(10, 100, [5]));
    expect(gapped.firstChord[6]).toBe(gapped.firstChord[5]);
    expect(gapped.firstChord.at(-1)).toBe(firstChord.at(-1)! - (firstChord[6]! - firstChord[5]!));
  });
});

describe('closeInTimes', () => {
  it('runs from start to stop through the instant, strictly in order', () => {
    const times = closeInTimes(10, 20, 4, 13.3);
    expect(times[0]).toBe(10);
    expect(times.at(-1)).toBe(20);
    expect(times).toContain(13.3);
    for (let k = 1; k < times.length; k += 1) {
      expect(times[k]).toBeGreaterThan(times[k - 1]!);
    }
    // Every chord end of the interval is still there.
    for (const end of [12.5, 15, 17.5]) {
      expect(times).toContain(end);
    }
  });

  it('closes in on the instant from both sides', () => {
    const times = closeInTimes(10, 20, 4, 13.3);
    const at = times.indexOf(13.3);
    expect(13.3 - times[at - 1]!).toBeCloseTo((13.3 - 12.5) * 2 ** -CLOSE_IN_STEPS, 12);
    expect(times[at + 1]! - 13.3).toBeCloseTo((15 - 13.3) * 2 ** -CLOSE_IN_STEPS, 12);
  });

  it('does not repeat an instant that sits on a chord end', () => {
    const times = closeInTimes(10, 20, 4, 15);
    expect(times.filter((time) => time === 15)).toHaveLength(1);
    expect(times[0]).toBe(10);
    expect(times.at(-1)).toBe(20);
  });
});

describe('TrajectoryLine', () => {
  const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
  /** The best data the craft is drawn from: here the path itself, exactly. */
  const sampler = (path: PathTable) => (jd: number) => interpolateState(path, jd)?.position ?? null;

  type Lines = [THREE.LineSegments, THREE.Line];
  const parts = (line: TrajectoryLine) => line.object.children as unknown as Lines;

  it('draws only where the craft has been, and runs into it', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const { firstChord } = tessellatePath(path);
    const jd = START + 123.4; // inside interval 12

    line.update(jd, ORIGIN, sampler(path), null);
    const [trail, near] = parts(line);
    // The chords stop at the interval the craft is in; nothing after it is drawn.
    expect(trail.geometry.drawRange).toMatchObject({ start: 0, count: firstChord[12]! * 2 });

    // That interval is drawn from its first sample up to the craft -- to float32, which at
    // 1 AU from the origin is about ten kilometres; near the focus it is millimetres.
    const craft = interpolateState(path, jd)!.position;
    const positions = near.geometry.getAttribute('position');
    const last = near.geometry.drawRange.count - 1;
    expect(positions.getX(0)).toBe(Math.fround(path.x[12]! / KM_PER_UNIT));
    expect(positions.getX(last)).toBe(Math.fround(craft.x / KM_PER_UNIT));
    expect(positions.getY(last)).toBe(Math.fround(craft.y / KM_PER_UNIT));
    // And its newest vertex is now: full strength at the craft.
    const days = near.geometry.getAttribute('aDays');
    expect(days.getX(last)).toBe(Math.fround(jd - START));
  });

  it('reaches back one period, fading to nothing at its end', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [trail] = parts(line);
    const { chordStopJd } = tessellatePath(path);
    const jd = START + 180;

    line.update(jd, ORIGIN, sampler(path), 50);
    const oldest = trail.geometry.drawRange.start / 2;
    // The oldest chord drawn reaches past jd - 50 days and the one before it does not.
    expect(chordStopJd[oldest]).toBeGreaterThan(jd - 50);
    expect(chordStopJd[oldest - 1]).toBeLessThanOrEqual(jd - 50);

    expect(line.material.uniforms.uNowDays!.value).toBe(180);
    expect(line.material.uniforms.uSpanDays!.value).toBe(50);
    expect(trailFade(0, 50)).toBe(1);
    expect(trailFade(25, 50)).toBe(0.5);
    expect(trailFade(50, 50)).toBe(0);
    expect(trailFade(80, 50)).toBe(0);
  });

  it('reaches back to the start of the path for a craft on no orbit', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [trail] = parts(line);
    line.update(START + 180, ORIGIN, sampler(path), null);
    expect(trail.geometry.drawRange.start).toBe(0);
    expect(line.material.uniforms.uSpanDays!.value).toBe(180);
  });

  it('falls back to the path where the finer data is not loaded', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    line.update(START + 50.5, ORIGIN, () => null);
    const [, near] = parts(line);
    expect(near.geometry.drawRange.count).toBeGreaterThan(CLOSE_IN_STEPS);
  });

  it('draws nothing at the craft while it is crossing a seam', () => {
    const path = circlePath(10, 100, [7]);
    const line = new TrajectoryLine(path, '#ffffff');
    line.update(START + 75, ORIGIN, sampler(path));
    const [, near] = parts(line);
    expect(near.geometry.drawRange.count).toBe(0);
  });

  it('is nothing before the path starts and all of it after it ends', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [trail] = parts(line);

    line.update(START - 5, ORIGIN, sampler(path));
    expect(trail.geometry.drawRange.count).toBe(0);

    line.update(START + 400, ORIGIN, sampler(path));
    expect(trail.geometry.drawRange).toMatchObject({ start: 0, count: line.chordCount * 2 });
  });

  it('scales its strength for a line fading in with its planet', () => {
    const line = new TrajectoryLine(circlePath(10, 100), '#ffffff');
    line.setFade(0.5);
    expect(line.material.uniforms.uOpacity!.value).toBeCloseTo(TRAIL_OPACITY / 2, 12);
    // The stretch at the craft has its own shader but the same fade.
    const [, near] = parts(line);
    const nearMaterial = near.material as THREE.ShaderMaterial;
    expect(nearMaterial).not.toBe(line.material);
    expect(nearMaterial.uniforms.uOpacity).toBe(line.material.uniforms.uOpacity);
  });

  it('uploads its chords once, however far the focus moves', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [trail] = parts(line);
    const high = trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const low = trail.geometry.getAttribute('positionLow') as THREE.BufferAttribute;
    const versions = [high.version, low.version];

    // Following a craft: the focus moves every frame, by a lot.
    for (let step = 0; step < 10; step += 1) {
      const origin = { x: step * 1e6, y: -step * 3e5, z: 7 };
      line.update(START + 100 + step / 1440, origin, sampler(path));
    }
    expect([high.version, low.version]).toEqual(versions);
    // The move rides on the uniforms instead, split the same way as the chords.
    const high3 = line.material.uniforms.uOriginHigh!.value as THREE.Vector3;
    const low3 = line.material.uniforms.uOriginLow!.value as THREE.Vector3;
    expect(high3.x + low3.x).toBe(9e6);
    expect(trail.position.x).toBe(0);
  });

  it("keeps float64's precision where the focus is", () => {
    // A vertex beside Voyager, 2.54e10 km out, 123 m from the focus at the craft. A plain
    // float32 there is only good to 2048 km.
    const vertexKm = 2.54e10 + 0.123;
    const originKm = -2.54e10;
    expect(Math.abs(Math.fround(vertexKm) + originKm - 0.123)).toBeGreaterThan(100);

    // The shader's sum, step by step in float32: high with high, low with low.
    const [vertexHigh, vertexLow] = splitDouble(vertexKm);
    const [originHigh, originLow] = splitDouble(originKm);
    const f = Math.fround;
    const km = f(f(vertexHigh + originHigh) + f(vertexLow + originLow));
    expect(Math.abs(km - 0.123)).toBeLessThan(1e-3);
  });

  it('uploads only what the stretch at the craft uses, and nothing when nothing moved', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [, near] = parts(line);
    const positions = near.geometry.getAttribute('position') as THREE.BufferAttribute;

    line.update(START + 123.4, ORIGIN, sampler(path));
    const count = near.geometry.drawRange.count;
    expect(positions.updateRanges).toEqual([{ start: 0, count: count * 3 }]);

    // Paused, focus still: the same line, not written again.
    const version = positions.version;
    line.update(START + 123.4, ORIGIN, sampler(path));
    expect(positions.version).toBe(version);
    // The clock moves on: written again.
    line.update(START + 123.5, ORIGIN, sampler(path));
    expect(positions.version).toBeGreaterThan(version);
  });

  it('draws the stretch at the craft again until the finer data is here', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [, near] = parts(line);
    const positions = near.geometry.getAttribute('position') as THREE.BufferAttribute;

    line.update(START + 50.5, ORIGIN, () => null);
    const version = positions.version;
    // Same instant, same focus, but the stand-in was used: drawn again.
    line.update(START + 50.5, ORIGIN, sampler(path));
    expect(positions.version).toBeGreaterThan(version);
  });
});

describe('orbitalPeriodDays', () => {
  const SUN_GM = 1.32712440041279419e11;

  it('is a year for Earth', () => {
    const v = Math.sqrt(SUN_GM / 1.495978707e8);
    const period = orbitalPeriodDays(
      { position: { x: 1.495978707e8, y: 0, z: 0 }, velocity: { x: 0, y: v, z: 0 } },
      SUN_GM,
    );
    expect(period).toBeCloseTo(365.25, 0);
  });

  it('is none for a craft leaving the Solar System', () => {
    // Voyager 1: 170 AU out at 16.9 km/s, over three times escape speed there.
    const period = orbitalPeriodDays(
      { position: { x: 2.54e10, y: 0, z: 0 }, velocity: { x: 16.9, y: 0, z: 0 } },
      SUN_GM,
    );
    expect(period).toBeNull();
  });
});

describe('a trail drawn from the table', () => {
  it('breaks at a seam, and keeps every sample', () => {
    const table = circlePath(10, 1);
    const seam = { startJd: table.t[3]!, stopJd: table.t[4]!, jumpKm: 50 };
    const path = tablePath(table, [seam], 1);
    expect(path.gaps).toEqual([3]);
    expect(path.count).toBe(table.count);
    expect(path.toleranceKm).toHaveLength(table.count - 1);
  });

  it('is built for one turn and a margin, and rebuilt only once the clock leaves it', () => {
    const table = circlePath(1, 1);
    const asked: [number, number][] = [];
    const trail = new TableTrail((startJd, stopJd) => {
      asked.push([startJd, stopJd]);
      const first = table.t.findIndex((t) => t >= startJd) - 1;
      const last = table.t.findIndex((t) => t >= stopJd);
      const pick = <T>(column: readonly T[]) => column.slice(Math.max(first, 0), last + 1);
      return tablePath(
        {
          ...table,
          t: pick(table.t),
          x: pick(table.x),
          y: pick(table.y),
          z: pick(table.z),
          vx: pick(table.vx),
          vy: pick(table.vy),
          vz: pick(table.vz),
          count: pick(table.t).length,
        },
        [],
        1,
      );
    }, '#ffffff');
    const origin = { x: 0, y: 0, z: 0 };
    const none = () => null;
    const span = 20;

    trail.update(START + 100, origin, none, span);
    expect(asked).toHaveLength(1);
    expect(trail.built.startJd).toBeCloseTo(START + 100 - span * (1 + TABLE_TRAIL_MARGIN));
    expect(trail.built.stopJd).toBeCloseTo(START + 100 + span * TABLE_TRAIL_MARGIN);

    // Inside the margin: the same line.
    trail.update(START + 104, origin, none, span);
    expect(asked).toHaveLength(1);
    // Past it: a new one.
    trail.update(START + 106, origin, none, span);
    expect(asked).toHaveLength(2);
    // And back in time just the same.
    trail.update(START + 80, origin, none, span);
    expect(asked).toHaveLength(3);
    expect(trail.object.visible).toBe(true);
    expect(trail.object.children).toHaveLength(1);
  });

  /** LRO's turn, days: 113 minutes. */
  const ORBITER_PERIOD_DAYS = 113 / 1440;

  /**
   * An LRO-like orbiter: a 113-minute circle 1,800 km out, sampled every six minutes as
   * the generator samples the close orbiters, for `days`.
   */
  function orbiterTable(days: number): VectorTable {
    const period = ORBITER_PERIOD_DAYS;
    const radius = 1800;
    const motion = (2 * Math.PI) / (period * SECONDS_PER_DAY);
    const t: number[] = [];
    for (let k = 0; k * 6 <= days * 1440; k += 1) {
      t.push(START + (k * 6) / 1440);
    }
    const angle = (time: number) => motion * (time - START) * SECONDS_PER_DAY;
    return {
      id: 'orbiter',
      horizonsId: '-85',
      center: '500@301',
      count: t.length,
      t,
      x: t.map((time) => radius * Math.cos(angle(time))),
      y: t.map((time) => radius * Math.sin(angle(time))),
      z: t.map(() => 0),
      vx: t.map((time) => -radius * motion * Math.sin(angle(time))),
      vy: t.map((time) => radius * motion * Math.cos(angle(time))),
      vz: t.map(() => 0),
    };
  }

  /** Its samples from `startJd` to `stopJd`, as the store's loadedSamples gives them. */
  function stretchOf(table: VectorTable, startJd: number, stopJd: number): PathTable {
    const step = table.t[1]! - table.t[0]!;
    const first = Math.max(Math.floor((startJd - table.t[0]!) / step), 0);
    const last = Math.min(Math.ceil((stopJd - table.t[0]!) / step), table.count - 1);
    const pick = <T>(column: readonly T[]) => column.slice(first, last + 1);
    return tablePath(
      {
        ...table,
        t: pick(table.t),
        x: pick(table.x),
        y: pick(table.y),
        z: pick(table.z),
        vx: pick(table.vx),
        vy: pick(table.vy),
        vz: pick(table.vz),
        count: last - first + 1,
      },
      [],
      1,
    );
  }

  type Lines = [THREE.LineSegments, THREE.Line];
  const linesOf = (trail: TableTrail) => trail.object.children[0]!.children as unknown as Lines;

  it('is rebuilt into the same line, however fast the clock runs', () => {
    // A week a second at 60 fps for five seconds: 2.8 hours a frame, more than a whole
    // turn, so every frame needs a stretch of the table it has not drawn before.
    const table = orbiterTable(40);
    let rebuilds = 0;
    const trail = new TableTrail((startJd, stopJd) => {
      rebuilds += 1;
      return stretchOf(table, startJd, stopJd);
    }, '#ffffff');
    trail.setFade(0.5);
    const origin = { x: 0, y: 0, z: 0 };
    const lines = new Set<unknown>();
    const geometries = new Set<unknown>();
    const frames = 300;
    for (let frame = 0; frame < frames; frame += 1) {
      trail.update(START + 1 + (frame * 7) / 60, origin, () => null, ORBITER_PERIOD_DAYS);
      lines.add(trail.object.children[0]);
      geometries.add(linesOf(trail)[0].geometry);
    }
    // Every frame a new stretch, as before...
    expect(rebuilds).toBe(frames);
    // ...but one line, where there were three hundred, each a geometry, five buffers and
    // two materials: its buffers sized on the first builds and reused from there.
    expect(lines.size).toBe(1);
    expect(geometries.size).toBeLessThanOrEqual(2);
    expect(trail.object.children).toHaveLength(1);
    // And still at the strength it was given before any of it.
    const material = linesOf(trail)[0].material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(TRAIL_OPACITY / 2, 12);
  });

  it('draws, rebuilt in place, exactly what a new line would', () => {
    const table = orbiterTable(10);
    let last: PathTable | null = null;
    const trail = new TableTrail((startJd, stopJd) => {
      last = stretchOf(table, startJd, stopJd);
      return last;
    }, '#ffffff');
    const origin = { x: 1e5, y: -2e4, z: 3 };
    const sample = (jd: number) => interpolateState(table, jd)?.position ?? null;

    // A rate that rebuilds every frame, a week a second, and then a minute a frame, which
    // rebuilds every half hour of it.
    for (const [from, step] of [
      [START + 2, 7 / 60],
      [START + 6, 1 / 1440],
    ] as const) {
      for (let frame = 0; frame < 40; frame += 1) {
        const jd = from + frame * step;
        trail.update(jd, origin, sample, ORBITER_PERIOD_DAYS);
        const fresh = new TrajectoryLine(last!, '#ffffff');
        fresh.update(jd, origin, sample, ORBITER_PERIOD_DAYS);

        const [chords, near] = linesOf(trail);
        const [freshChords, freshNear] = fresh.object.children as unknown as Lines;
        // The same chords drawn, from the same vertices, at the same age...
        const range = chords.geometry.drawRange;
        expect(range).toEqual(freshChords.geometry.drawRange);
        expect(range.count).toBeGreaterThan(0);
        for (const name of ['position', 'positionLow', 'aDays']) {
          const size = freshChords.geometry.getAttribute(name).itemSize;
          const drawn = (geometry: THREE.BufferGeometry) =>
            Array.from(
              (geometry.getAttribute(name).array as Float32Array).subarray(
                range.start * size,
                (range.start + range.count) * size,
              ),
            );
          expect(drawn(chords.geometry)).toEqual(drawn(freshChords.geometry));
        }
        // ...the same stretch at the craft...
        const nearCount = near.geometry.drawRange.count;
        expect(near.geometry.drawRange).toEqual(freshNear.geometry.drawRange);
        const nearOf = (line: THREE.Line) =>
          Array.from(
            (line.geometry.getAttribute('position').array as Float32Array).subarray(
              0,
              nearCount * 3,
            ),
          );
        expect(nearOf(near)).toEqual(nearOf(freshNear));
        // ...and the same fade.
        const uniforms = (chords.material as THREE.ShaderMaterial).uniforms;
        expect(uniforms.uNowDays!.value).toBe(fresh.material.uniforms.uNowDays!.value);
        expect(uniforms.uSpanDays!.value).toBe(fresh.material.uniforms.uSpanDays!.value);
        fresh.dispose();
      }
    }
  });

  it('uploads only the chords a rebuild wrote', () => {
    const table = orbiterTable(10);
    const trail = new TableTrail((startJd, stopJd) => stretchOf(table, startJd, stopJd), '#ffffff');
    const origin = { x: 0, y: 0, z: 0 };
    // Two turns' worth of buffer, then a stretch for one turn written into it.
    trail.update(START + 2, origin, () => null, 2 * ORBITER_PERIOD_DAYS);
    const [chords] = linesOf(trail);
    const position = chords.geometry.getAttribute('position') as THREE.BufferAttribute;
    const version = position.version;
    trail.update(START + 4, origin, () => null, ORBITER_PERIOD_DAYS);
    expect(linesOf(trail)[0].geometry.getAttribute('position')).toBe(position);
    expect(position.version).toBeGreaterThan(version);
    const { start, count } = chords.geometry.drawRange;
    expect(position.updateRanges).toHaveLength(1);
    expect(position.updateRanges[0]!.start).toBe(0);
    // Every chord drawn, and not the room left after them.
    expect(position.updateRanges[0]!.count).toBeGreaterThanOrEqual((start + count) * 3);
    expect(position.updateRanges[0]!.count).toBeLessThan(position.array.length);
  });

  it('shows nothing while the data for it is not here', () => {
    const trail = new TableTrail(() => null, '#ffffff');
    trail.update(START, { x: 0, y: 0, z: 0 }, () => null, 1);
    expect(trail.object.visible).toBe(false);
  });
});
