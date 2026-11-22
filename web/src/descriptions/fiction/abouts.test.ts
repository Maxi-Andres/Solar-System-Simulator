import { describe, expect, it } from 'vitest';

import { FICTION, fictionBodyId } from '../../core/fiction.ts';
import { DESCRIBED_IDS } from '../ids.ts';
import { FICTION_ABOUTS } from './abouts.ts';
import { FICTION_ABOUT_NAMES, fictionAboutKey } from './ids.ts';

/** Every paragraph of a page. */
function paragraphs(key: keyof typeof FICTION_ABOUTS): string[] {
  const about = FICTION_ABOUTS[key];
  return [...about.story, ...about.canon, ...about.invented, ...about.reality];
}

describe('fiction’s abouts', () => {
  it('give every Avatar record a page, and name each page', () => {
    for (const record of FICTION) {
      expect(fictionAboutKey(record.id), record.id).not.toBeNull();
    }
    expect(Object.keys(FICTION_ABOUT_NAMES).sort()).toEqual(Object.keys(FICTION_ABOUTS).sort());
  });

  it('say all four things: the story, the canon, the inventions, the real place', () => {
    for (const key of Object.keys(FICTION_ABOUTS) as (keyof typeof FICTION_ABOUTS)[]) {
      const about = FICTION_ABOUTS[key];
      for (const part of [about.story, about.canon, about.invented, about.reality]) {
        expect(part.length, key).toBeGreaterThan(0);
        for (const paragraph of part) expect(paragraph.length, key).toBeGreaterThan(40);
      }
    }
  });

  it('quote the works in a few words at most', () => {
    for (const key of Object.keys(FICTION_ABOUTS) as (keyof typeof FICTION_ABOUTS)[]) {
      for (const paragraph of paragraphs(key)) {
        for (const quote of paragraph.match(/“[^”]*”/g) ?? []) {
          expect(quote.split(/\s+/).length, `${key}: ${quote}`).toBeLessThan(15);
        }
      }
    }
  });

  it('are kept apart from the real descriptions', () => {
    for (const record of FICTION) {
      expect(DESCRIBED_IDS.has(fictionBodyId(record.id)), record.id).toBe(false);
      expect(DESCRIBED_IDS.has(record.id), record.id).toBe(false);
    }
  });
});
