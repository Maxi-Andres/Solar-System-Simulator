import type { PathTable } from '@sss/tools/types';
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
  tessellatePath,
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

  type Lines = [THREE.LineSegments, THREE.LineSegments, THREE.Line, THREE.Line];
  const parts = (line: TrajectoryLine) => line.object.children as unknown as Lines;

  it('splits the line at the craft: behind, the interval it is in, and ahead', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const { firstChord } = tessellatePath(path);
    const jd = START + 123.4; // inside interval 12

    line.update(jd, ORIGIN, 1, sampler(path));
    const [past, future, nearBehind, nearAhead] = parts(line);
    expect(past.geometry.drawRange).toMatchObject({ start: 0, count: firstChord[12]! * 2 });
    expect(future.geometry.drawRange.start).toBe(firstChord[13]! * 2);
    expect(future.geometry.drawRange.start + future.geometry.drawRange.count).toBe(
      line.chordCount * 2,
    );

    // The two near pieces meet exactly at the craft -- to float32, which at 1 AU from the
    // origin is about ten kilometres; near the focus it is millimetres.
    const craft = interpolateState(path, jd)!.position;
    const behind = nearBehind.geometry.getAttribute('position');
    const ahead = nearAhead.geometry.getAttribute('position');
    const lastBehind = nearBehind.geometry.drawRange.count - 1;
    for (const [attribute, index] of [
      [behind, lastBehind],
      [ahead, 0],
    ] as const) {
      expect(attribute.getX(index)).toBe(Math.fround(craft.x / KM_PER_UNIT));
      expect(attribute.getY(index)).toBe(Math.fround(craft.y / KM_PER_UNIT));
    }
    // And their outer ends are the interval's own samples, where the static line resumes.
    expect(behind.getX(0)).toBe(Math.fround(path.x[12]! / KM_PER_UNIT));
    expect(ahead.getX(nearAhead.geometry.drawRange.count - 1)).toBe(
      Math.fround(path.x[13]! / KM_PER_UNIT),
    );
  });

  it('falls back to the path where the finer data is not loaded', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    line.update(START + 50.5, ORIGIN, 1, () => null);
    const [, , nearBehind] = parts(line);
    expect(nearBehind.geometry.drawRange.count).toBeGreaterThan(CLOSE_IN_STEPS);
  });

  it('draws nothing near the craft while it is crossing a seam', () => {
    const path = circlePath(10, 100, [7]);
    const line = new TrajectoryLine(path, '#ffffff');
    line.update(START + 75, ORIGIN, 1, sampler(path));
    const [, , nearBehind, nearAhead] = parts(line);
    expect(nearBehind.geometry.drawRange.count).toBe(0);
    expect(nearAhead.geometry.drawRange.count).toBe(0);
  });

  it('is all ahead before the path starts and all behind after it ends', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [past, future] = parts(line);

    line.update(START - 5, ORIGIN, 1, sampler(path));
    expect(past.geometry.drawRange.count).toBe(0);
    expect(future.geometry.drawRange).toMatchObject({ start: 0, count: line.chordCount * 2 });

    line.update(START + 400, ORIGIN, 1, sampler(path));
    expect(past.geometry.drawRange.count).toBe(line.chordCount * 2);
    expect(future.geometry.drawRange.count).toBe(0);
  });

  it('draws one period either side of the craft, not the whole path', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [past, future] = parts(line);
    const { chordStartJd, chordStopJd } = tessellatePath(path);
    const jd = START + 180;

    line.update(jd, ORIGIN, 1, sampler(path), 50);
    const oldest = past.geometry.drawRange.start / 2;
    const newest = (future.geometry.drawRange.start + future.geometry.drawRange.count) / 2 - 1;
    // The oldest chord drawn reaches past jd - 50 days and the one before it does not.
    expect(chordStopJd[oldest]).toBeGreaterThan(jd - 50);
    expect(chordStopJd[oldest - 1]).toBeLessThanOrEqual(jd - 50);
    expect(chordStartJd[newest]).toBeLessThan(jd + 50);
    expect(chordStartJd[newest + 1]).toBeGreaterThanOrEqual(jd + 50);

    // No period: the whole of it.
    line.update(jd, ORIGIN, 1, sampler(path), null);
    expect(past.geometry.drawRange.start).toBe(0);
    expect(future.geometry.drawRange.start + future.geometry.drawRange.count).toBe(
      line.chordCount * 2,
    );
  });

  it('carries a small drift on the transform and rebuilds past the tolerance', () => {
    const path = circlePath(10, 100);
    const line = new TrajectoryLine(path, '#ffffff');
    const [past] = parts(line);
    const positions = past.geometry.getAttribute('position');

    line.update(START + 100, ORIGIN, 1000, sampler(path));
    const before = positions.getX(0);

    line.update(START + 100, { x: 500, y: 0, z: 0 }, 1000, sampler(path));
    expect(positions.getX(0)).toBe(before);
    expect(past.position.x).toBeCloseTo(500 / KM_PER_UNIT, 9);

    line.update(START + 100, { x: 5000, y: 0, z: 0 }, 1000, sampler(path));
    expect(positions.getX(0)).toBeCloseTo((path.x[0]! + 5000) / KM_PER_UNIT, 1);
    expect(past.position.x).toBe(0);
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
