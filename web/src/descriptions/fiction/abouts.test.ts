import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FICTION_ENTRIES, fictionBodyId } from '../../core/fiction.ts';
import { DESCRIBED_IDS } from '../ids.ts';
import { FICTION_ABOUTS } from './abouts.ts';
import { FICTION_ABOUT_NAMES, fictionAboutKey } from './ids.ts';

/** Every paragraph of a page. */
function paragraphs(key: keyof typeof FICTION_ABOUTS): string[] {
  const about = FICTION_ABOUTS[key];
  return [...about.story, ...about.canon, ...about.invented, ...about.reality];
}

describe('fiction’s abouts', () => {
  it('give every fictional entry a page, and name each page', () => {
    for (const record of FICTION_ENTRIES) {
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

  it('show only renders from this app, or real photographs with their credit and a free licence', () => {
    const publicDir = join(import.meta.dirname, '../../../public');
    for (const key of Object.keys(FICTION_ABOUTS) as (keyof typeof FICTION_ABOUTS)[]) {
      expect(FICTION_ABOUTS[key].photos.length, key).toBeGreaterThan(0);
      for (const photo of FICTION_ABOUTS[key].photos) {
        for (const file of [photo.file, photo.largeFile]) {
          expect(existsSync(join(publicDir, file)), file).toBe(true);
          // A thumbnail and its larger copy, both small enough for a page of text.
          expect(statSync(join(publicDir, file)).size, file).toBeLessThan(400_000);
        }
        if (photo.origin === 'render') {
          // The app's own, of what it draws, and said to be.
          expect(photo.file, key).toMatch(/^photos\/fiction\//);
          expect(photo.caption, key).toMatch(/A render from this app/);
          expect(photo.credit, key).toBe('Rendered in this app');
          continue;
        }
        // Anything else is real -- a real place, or the creator -- credited and freely licensed.
        expect(photo.credit.length, photo.file).toBeGreaterThan(2);
        expect(photo.licence, photo.file).toMatch(/^(CC BY(-SA)? \d\.\d|CC0|Public domain|NASA media, not copyrighted)/);
        expect(photo.sourceUrl, photo.file).toMatch(/^https:\/\//);
        if (photo.origin === 'creator') expect(photo.caption, photo.file).toMatch(/real photograph/i);
      }
    }
  });

  it('are kept apart from the real descriptions', () => {
    for (const record of FICTION_ENTRIES) {
      expect(DESCRIBED_IDS.has(fictionBodyId(record.id)), record.id).toBe(false);
      expect(DESCRIBED_IDS.has(record.id), record.id).toBe(false);
    }
  });
});
