import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Stars3dNames } from '@sss/tools/types';
import { expect, it } from 'vitest';

import { describeWithData as withData } from './describeWithData.ts';
import { searchBodies } from './search.ts';
import { STAR_SHOWN_NAMES, starBodyDefinition, starShownName } from './starBodies.ts';

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

describeWithData('the stars shown by their designation and their proper name', () => {
  it('finds each in the star names, once, and keeps its proper name in what it is shown by', () => {
    for (const [designation, shown] of STAR_SHOWN_NAMES) {
      const entries = [...Array(names!.count).keys()].filter((k) => (names!.designations[k] ?? []).includes(designation));
      expect(entries.length, designation).toBe(1);
      const k = entries[0]!;
      expect(names!.iau[k], designation).toBe(true);
      expect(shown, designation).toBe(`${shown.slice(0, shown.lastIndexOf(' ('))} (${names!.display[k]})`);
      expect(starShownName(names!.display[k]!, names!.designations[k]!), designation).toBe(shown);
    }
  });
});

it('shows the obscure by designation and name, and leaves the famous alone', () => {
  expect(starShownName('Ran', ['eps Eri', 'HIP 16537'])).toBe('ε Eri (Ran)');
  expect(starShownName('Helvetios', ['51 Peg', 'HIP 113357'])).toBe('51 Peg (Helvetios)');
  expect(starShownName('Copernicus', ['55 Cnc A', 'HIP 43587'])).toBe('55 Cnc (Copernicus)');
  expect(starShownName('Chalawan', ['HIP 53721'])).toBe('47 UMa (Chalawan)');
  expect(starShownName('Titawin', ['HIP 7513'])).toBe('υ And (Titawin)');
  expect(starShownName('Keid', ['40 Eri A', 'HIP 19849'])).toBe('40 Eri A (Keid)');
  for (const [display, hip] of [
    ['Sirius', 'HIP 32349'],
    ['Vega', 'HIP 91262'],
    ['Canopus', 'HIP 30438'],
    ['Betelgeuse', 'HIP 27989'],
    ['Polaris', 'HIP 11767'],
    ['Aldebaran', 'HIP 21421'],
    ["Barnard's Star", 'HIP 87937'],
    ['Proxima Centauri', 'HIP 70890'],
  ] as const) {
    expect(starShownName(display, [hip]), display).toBe(display);
  }
});

it('is still found by its proper name', () => {
  const ran = starBodyDefinition('star-0-1', starShownName('Ran', ['HIP 16537']), 0.88);
  expect(searchBodies([ran], 'ran')[0]?.body.id).toBe('star-0-1');
  expect(searchBodies([ran], 'ε eri')[0]?.body.id).toBe('star-0-1');
});
