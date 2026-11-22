import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { sameView, underFloor, warpBetween, WARP_SCALE, type GlowView } from './milkyWayView.ts';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';

const UNITS_PER_PC = PARSEC_KM / KM_PER_UNIT;
const WIDTH = 960;
const HEIGHT = 540;
const CENTRE: [number, number, number] = [8000, 0, 20];
const RADIUS = 25_000;

/** The view from `position` (pc about the Sun) looking at `target`, as MilkyWay.tsx records it. */
function view(position: readonly number[], target: readonly number[] = CENTRE, fov = 50): GlowView {
  const c = new THREE.PerspectiveCamera(fov, WIDTH / HEIGHT, 1, 1e30);
  c.position.set(position[0]! * UNITS_PER_PC, position[1]! * UNITS_PER_PC, position[2]! * UNITS_PER_PC);
  c.lookAt(target[0]! * UNITS_PER_PC, target[1]! * UNITS_PER_PC, target[2]! * UNITS_PER_PC);
  c.updateMatrixWorld();
  return {
    position: [position[0]!, position[1]!, position[2]!],
    world: c.matrixWorld.elements.slice(),
    projection: c.projectionMatrix.elements.slice(),
    width: WIDTH,
    height: HEIGHT,
    visibility: 1,
  };
}

/** A point (pc about the Sun) to this buffer's uv, 0 to 1, through `v`. */
function uvOf(v: GlowView, p: readonly number[]): [number, number] {
  const c = new THREE.PerspectiveCamera();
  c.matrixWorld.fromArray(v.world);
  c.matrixWorld.setPosition(v.position[0] * UNITS_PER_PC, v.position[1] * UNITS_PER_PC, v.position[2] * UNITS_PER_PC);
  c.matrixWorldInverse.copy(c.matrixWorld).invert();
  c.projectionMatrix.fromArray(v.projection);
  const ndc = new THREE.Vector3(p[0]! * UNITS_PER_PC, p[1]! * UNITS_PER_PC, p[2]! * UNITS_PER_PC).project(c);
  return [ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5];
}

function carry(uv: readonly number[], at: readonly [number, number]): [number, number] {
  const x = uv[0]! * at[0] + uv[1]! * at[1] + uv[2]!;
  const y = uv[3]! * at[0] + uv[4]! * at[1] + uv[5]!;
  const w = uv[6]! * at[0] + uv[7]! * at[1] + uv[8]!;
  return [x / w, y / w];
}

/** From `distance` pc off the centre, at `angle` round it in the plane holding the z axis. */
function around(distance: number, angle: number): number[] {
  return [CENTRE[0] + distance * Math.sin(angle), CENTRE[1] + 0.3 * distance, CENTRE[2] + distance * Math.cos(angle)];
}

describe('the Milky Way buffer kept while nothing has changed', () => {
  it('is the same view to the bit, and to a millionth of the distance from the Sun', () => {
    const a = view([1e6, 2e5, 3e5]);
    expect(sameView(a, view([1e6, 2e5, 3e5]))).toBe(true);
    // Moved without turning: the place alone.
    const moved = (by: number): GlowView => view([1e6 + by, 2e5, 3e5], [CENTRE[0] + by, CENTRE[1], CENTRE[2]]);
    expect(sameView(a, moved(0.5))).toBe(true);
    expect(sameView(a, moved(50))).toBe(false);
  });

  it('is not the same view after a turn, a zoom, a resize or a change of fade', () => {
    const a = view([1e6, 2e5, 3e5]);
    expect(sameView(a, view([1e6, 2e5, 3e5], [CENTRE[0] + 10, CENTRE[1], CENTRE[2]]))).toBe(false);
    expect(sameView(a, view([1e6, 2e5, 3e5], CENTRE, 49.99))).toBe(false);
    expect(sameView(a, { ...a, width: WIDTH + 2 })).toBe(false);
    expect(sameView(a, { ...a, visibility: 0.999 })).toBe(false);
  });
});

describe('a kept drawing carried to a new view', () => {
  it('is the identity for the same view, with no error', () => {
    const a = view(around(1.3e6, 0.4));
    const warp = warpBetween(a, a, CENTRE, RADIUS)!;
    expect(warp.errorPx).toBeLessThan(1e-6);
    const at: [number, number] = [0.3, 0.7];
    const back = carry(warp.uv, at);
    expect(back[0]).toBeCloseTo(at[0], 9);
    expect(back[1]).toBeCloseTo(at[1], 9);
  });

  it('puts the galaxy where this view sees it: its centre and its edge in the plane, exactly', () => {
    const kept = view(around(1.3e6, 0.4));
    const now = view(around(1.3e6, 0.41), [CENTRE[0] + 3e4, CENTRE[1] - 2e4, CENTRE[2]]);
    const warp = warpBetween(kept, now, CENTRE, RADIUS)!;
    expect(warp).not.toBeNull();
    const seen = carry(warp.uv, uvOf(now, CENTRE));
    const there = uvOf(kept, CENTRE);
    expect(seen[0]).toBeCloseTo(there[0], 9);
    expect(seen[1]).toBeCloseTo(there[1], 9);
  });

  it('is exact for a turn of the camera where it stands, whatever the depth', () => {
    const at = around(1.3e6, 0.4);
    const kept = view(at);
    const now = view(at, [CENTRE[0] + 1e5, CENTRE[1] + 5e4, CENTRE[2]]);
    expect(warpBetween(kept, now, CENTRE, RADIUS)!.errorPx).toBeLessThan(1e-6);
  });

  it('strays by the galaxy’s depth times the turn about it, in pixels, and grows with the turn', () => {
    const kept = view(around(1.3e6, 0.4));
    const small = warpBetween(kept, view(around(1.3e6, 0.4 + 0.002)), CENTRE, RADIUS)!.errorPx;
    const large = warpBetween(kept, view(around(1.3e6, 0.4 + 0.02)), CENTRE, RADIUS)!.errorPx;
    // The depth's parallax: R / d x angle x pixels per radian, d = 1.3 Mpc, 540 / (2 tan 25 deg).
    const pixelsPerRadian = HEIGHT / (2 * Math.tan((25 * Math.PI) / 180));
    const expected = (RADIUS / 1.3e6) * 0.002 * pixelsPerRadian;
    expect(small).toBeGreaterThan(0.3 * expected);
    expect(small).toBeLessThan(1.5 * expected);
    expect(large / small).toBeGreaterThan(8);
    expect(large / small).toBeLessThan(12);
  });

  it('is not used from inside the galaxy or near it, nor past its growth limit', () => {
    expect(warpBetween(view(around(5e4, 0.4)), view(around(5e4, 0.41)), CENTRE, RADIUS)).toBeNull();
    const kept = view(around(1.3e6, 0.4));
    expect(warpBetween(kept, view(around(1.3e6 * (1 + 2 * WARP_SCALE), 0.4)), CENTRE, RADIUS)).toBeNull();
  });

  it('is not used where the kept drawing did not hold all of the galaxy', () => {
    // Looking well above it: the galaxy past the kept frame's lower edge, 25 degrees down.
    const at = around(1.3e6, 0.4);
    const aside = [CENTRE[0], CENTRE[1] + 7e5, CENTRE[2]];
    expect(warpBetween(view(at, aside), view(at), CENTRE, RADIUS)).toBeNull();
  });
});

describe('a galaxy too faint to draw', () => {
  const profile = 1.4;
  const floor = 1.5e-4;
  const ppr = HEIGHT / (2 * Math.tan((25 * Math.PI) / 180));
  it('is every sprite under the floor from far enough, by the largest sprite at the nearest point', () => {
    expect(underFloor(0.04, 1.6e8, RADIUS, 1000, ppr, 1.5, profile, floor)).toBe(true);
    expect(underFloor(0.04, 1.3e6, RADIUS, 1000, ppr, 1.5, profile, floor)).toBe(false);
    // Inside its sphere, never.
    expect(underFloor(1e-9, RADIUS / 2, RADIUS, 1000, ppr, 1.5, profile, floor)).toBe(false);
  });

  it('keeps a factor of two from the floor', () => {
    // Where the brightest fragment is exactly the floor, and where it is half of it.
    const at = (share: number): number => {
      // peak x (d / 1.5)^2 x profile = share x floor, d = 2 L / (D - R) x ppr.
      const d = 1.5 * Math.sqrt((share * floor) / (0.04 * profile));
      return (2 * 1000 * ppr) / d + RADIUS;
    };
    expect(underFloor(0.04, at(1) * 1.01, RADIUS, 1000, ppr, 1.5, profile, floor)).toBe(false);
    expect(underFloor(0.04, at(0.5) * 1.01, RADIUS, 1000, ppr, 1.5, profile, floor)).toBe(true);
  });
});
