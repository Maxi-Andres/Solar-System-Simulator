import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';

import { drawnFromData } from './generated.ts';
import { DESCRIPTIONS } from './index.ts';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));

describe('the descriptions', () => {
  for (const description of DESCRIPTIONS.values()) {
    it(`${description.id}: every citation is to a source it lists, and every source is cited`, () => {
      const keys = new Set(description.sources.map((source) => source.key));
      const cited = new Set<string>();
      for (const point of [
        ...drawnFromData(getBody(description.id)),
        ...description.drawnHere,
        ...description.measured,
        ...description.estimated,
        ...description.missing,
        ...description.misconceptions,
      ]) {
        for (const key of point.cite ?? []) {
          expect(keys, `${point.title} cites ${key}`).toContain(key);
          cited.add(key);
        }
      }
      expect([...keys].filter((key) => !cited.has(key))).toEqual([]);
    });

    it(`${description.id}: every photo is on disk, credited, and says what its colours are`, () => {
      for (const photo of description.photos) {
        expect(existsSync(PUBLIC + photo.file), photo.file).toBe(true);
        expect(existsSync(PUBLIC + photo.largeFile), photo.largeFile).toBe(true);
        expect(photo.credit).not.toBe('');
        expect(photo.sourceUrl).toMatch(/^https:\/\//);
      }
    });
  }

  it('says how the Sun is drawn from its own data: its radius and its turn', () => {
    const points = drawnFromData(getBody('sun'));
    expect(points.find((point) => point.title === 'Its size and shape')?.text).toContain('695,700 km');
    expect(points.find((point) => point.title === 'How it turns')?.text).toContain('25.38 days');
  });
});
