import { describe, expect, it } from 'vitest';

import { NEBULAE, nebulaFrame, partAxes } from '../core/nebulae.ts';
import {
  brightestColumn,
  hasNebulaGain,
  HYDROGEN_RED,
  MAX_PARTS,
  nebulaGain,
  OXYGEN_TEAL,
  partsAt,
  prepareParts,
  provideNebulaGain,
} from './nebulaVolume.ts';
import { lineColour } from './remnantVolume.ts';

const byKey = (key: string) => NEBULAE.find((nebula) => nebula.key === key)!;

describe('a nebula’s volume', () => {
  it('is drawn in hydrogen’s red and oxygen’s teal', () => {
    const [r, g, b] = lineColour(HYDROGEN_RED);
    expect(r).toBe(1);
    expect(g).toBeLessThan(0.3);
    // H-beta's blue makes it a little pink, as an H II region's true colour is.
    expect(b).toBeLessThan(0.35);
    expect(b).toBeGreaterThan(g);
    const [tr, tg, tb] = lineColour(OXYGEN_TEAL);
    expect(tg).toBe(1);
    expect(tb).toBeGreaterThan(tr);
  });

  it('fits every nebula in the shader’s parts', () => {
    for (const nebula of NEBULAE) expect(nebula.parts.length).toBeLessThanOrEqual(MAX_PARTS);
  });

  it('puts a shell’s surface where its semi-axes say', () => {
    const ring = byKey('ring');
    const [main] = prepareParts(ring);
    const { e1 } = partAxes(ring, ring.parts[0]!);
    // 44" along its major axis, the nebula's radius being half its 1.47' major axis.
    const along = 44 / 60 / (ring.sizeArcmin[0] / 2);
    const p = { x: e1.x * along, y: e1.y * along, z: e1.z * along };
    const q = main!.rows.map((row) => row.x * p.x + row.y * p.y + row.z * p.z);
    expect(Math.hypot(...q)).toBeCloseTo(1, 6);
  });

  it('has the Horsehead’s pillar dark, in front of IC 434', () => {
    const horsehead = byKey('horsehead');
    const parts = prepareParts(horsehead);
    const { away } = nebulaFrame(horsehead);
    const [, dust] = partsAt(parts, { x: 0, y: 0, z: 0 }, away);
    expect(dust).toBeGreaterThan(10);
  });

  it('has a brightest line of sight for every nebula, so each can be scaled to it', () => {
    for (const nebula of NEBULAE) expect(brightestColumn(nebula, undefined, 9, 60)).toBeGreaterThan(0.05);
  });
});

describe('a nebula’s gain from the worker', () => {
  it('is used as given, and never replaces one worked out here', () => {
    const [first, second] = NEBULAE;
    expect(hasNebulaGain(first!)).toBe(false);
    provideNebulaGain(first!.key, 1.25);
    expect(hasNebulaGain(first!)).toBe(true);
    expect(nebulaGain(first!)).toBe(1.25);
    const here = nebulaGain(second!);
    provideNebulaGain(second!.key, here * 2);
    expect(nebulaGain(second!)).toBe(here);
  });
});
