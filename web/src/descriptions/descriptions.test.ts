import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import { NAMED_SATELLITES } from '@sss/tools/satellites/named';
import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { namedSatelliteBodyId, satelliteDefinition } from '../core/satelliteBodies.ts';
import { drawnFromData } from './generated.ts';
import { DESCRIPTIONS } from './index.ts';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));

/**
 * The body a description is of: the catalog's, or -- for a named Earth satellite, which is
 * made at run time from its data -- the one its named.ts entry becomes (satelliteBodies.ts).
 */
function bodyOf(id: BodyId): BodyDefinition {
  const named = NAMED_SATELLITES.find((entry) => namedSatelliteBodyId(entry.id) === id);
  if (named === undefined) return getBody(id);
  const look = named.look === null ? null : { ...named.look, operator: named.operator, launchDate: null };
  return satelliteDefinition(id, named.name, look);
}

describe('the descriptions', () => {
  for (const description of DESCRIPTIONS.values()) {
    it(`${description.id}: every citation is to a source it lists, and every source is cited`, () => {
      const keys = new Set(description.sources.map((source) => source.key));
      const cited = new Set<string>();
      for (const point of [
        ...drawnFromData(bodyOf(description.id)),
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

  it('says how a spacecraft is drawn from its own data, and never calls it a sphere with a map', () => {
    const coverage = { startJd: 2457720.5, stopJd: 2465025.5 };
    const points = drawnFromData(getBody('voyager-1'), coverage);
    const text = points.map((point) => point.text).join(' ');
    expect(text).not.toMatch(/sphere|surface map/);
    expect(points.find((point) => point.title === 'Where it is')?.text).toContain('spacecraft -31');
    // Launched before the data's window: said, with the date it was.
    expect(points.find((point) => point.title === 'Where it is')?.text).toContain('5 September 1977');
    expect(points.find((point) => point.title === 'What stands in its place')?.text).toContain('voyager.glb');
    expect(points.find((point) => point.title === 'Its size')?.text).toContain('13 m');
    expect(points.find((point) => point.title === 'Which way it faces')?.text).toContain('Dish to Earth');
    expect(points.some((point) => point.title === 'Its trail')).toBe(true);
  });

  it('says how a named Earth satellite is drawn: SGP4 from its elements, its model, no trail', () => {
    const points = drawnFromData(bodyOf(namedSatelliteBodyId('iss')));
    expect(points.find((point) => point.title === 'Where it is')?.text).toContain('NORAD 25544');
    expect(points.find((point) => point.title === 'What stands in its place')?.text).toContain('iss.glb');
    expect(points.find((point) => point.title === 'Its size')?.text).toContain('109 m');
    expect(points.some((point) => point.title === 'Its trail')).toBe(false);
  });
});
