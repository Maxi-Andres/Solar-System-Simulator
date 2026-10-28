import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Stars3dNames } from '@sss/tools/types';
import { expect, it } from 'vitest';

import { ALPHA_CEN_FRAMING_KM, ALPHA_CEN_MEMBERS, alphaCenEntries, alphaCenView } from './alphaCenBodies.ts';
import { abOrbitNormal } from './alphaCentauri.ts';
import { describeWithData as withData } from './describeWithData.ts';

const NAMES = join(import.meta.dirname, '../../public/data/stars3d/names.json');

async function tryLoad(): Promise<Stars3dNames | null> {
  try {
    return JSON.parse(await readFile(NAMES, 'utf8')) as Stars3dNames;
  } catch {
    return null;
  }
}

const names = await tryLoad();
const describeWithData = withData(names !== null);

describeWithData('Alpha Centauri in the star names', () => {
  it('finds all three, each once, under the names the breadcrumb shows', () => {
    const entries = alphaCenEntries(names!);
    expect(entries).not.toBeNull();
    for (const member of ALPHA_CEN_MEMBERS) {
      expect(names!.display[entries![member.key]]).toBe(member.name);
    }
    expect(new Set(Object.values(entries!)).size).toBe(3);
  });
});

it('frames the system from beyond the pair\'s widest separation', () => {
  // 36 AU at apastron: the frame stands well outside it.
  expect(ALPHA_CEN_FRAMING_KM / 149_597_870.7).toBeGreaterThan(3 * 36);
});

it('looks at the system 20 degrees off the pair\'s orbital pole, with a square up', () => {
  const { direction, up } = alphaCenView();
  const pole = abOrbitNormal();
  const dot = (a: readonly number[], b: { x: number; y: number; z: number }) => a[0]! * b.x + a[1]! * b.y + a[2]! * b.z;
  expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
  expect(Math.hypot(...up)).toBeCloseTo(1, 12);
  expect(direction[0] * up[0] + direction[1] * up[1] + direction[2] * up[2]).toBeCloseTo(0, 12);
  expect((Math.acos(dot(direction, pole)) * 180) / Math.PI).toBeCloseTo(20, 9);
});
