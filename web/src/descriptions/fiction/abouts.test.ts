import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FICTION_ENTRIES, fictionBodyId } from '../../core/fiction.ts';
import { DESCRIBED_IDS } from '../ids.ts';
import { FICTION_ABOUTS, SUPPLIED_BY_AUTHOR } from './abouts.ts';
import { FICTION_ABOUT_NAMES, fictionAboutKey } from './ids.ts';

/** A WebP's width, from its header: lossy (VP8), lossless (VP8L) or extended (VP8X). */
function webpWidth(file: string): number {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return 1 + b.readUIntLE(24, 3);
  if (chunk === 'VP8L') return 1 + (b.readUInt32LE(21) & 0x3fff);
  return b.readUInt16LE(26) & 0x3fff;
}

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

  it('show only the works’ own images: in film/, credited to a studio, sourced, small', () => {
    const publicDir = join(import.meta.dirname, '../../../public');
    for (const key of Object.keys(FICTION_ABOUTS) as (keyof typeof FICTION_ABOUTS)[]) {
      // An about may have none: the Petrova line's, Erid's, the Blip-A's.
      for (const photo of FICTION_ABOUTS[key].photos) {
        expect(photo.origin, photo.file).toBe('film');
        for (const file of [photo.file, photo.largeFile]) {
          expect(file, key).toMatch(/^photos\/fiction\/film\//);
          expect(existsSync(join(publicDir, file)), file).toBe(true);
        }
        expect(photo.credit, photo.file).toMatch(/^© .*Studios$/);
        // A page it is from, or the author's own supply, said so.
        if (photo.sourceUrl !== SUPPLIED_BY_AUTHOR) expect(photo.sourceUrl, photo.file).toMatch(/^https:\/\//);
        // Shown small, for illustration: 800 pixels wide at most, the thumbnail 640.
        expect(webpWidth(join(publicDir, photo.largeFile)), photo.largeFile).toBeLessThanOrEqual(800);
        expect(webpWidth(join(publicDir, photo.file)), photo.file).toBeLessThanOrEqual(640);
      }
    }
    expect(FICTION_ABOUTS['polyphemus-family'].photos.length).toBeGreaterThan(0);
    expect(FICTION_ABOUTS.petrova.photos).toEqual([]);
    // Star Trek's from its official site; none yet for Erid or the Blip-A.
    expect(FICTION_ABOUTS.vulcan.photos.map((photo) => photo.credit)).toEqual(['© CBS Studios', '© CBS Studios']);
    expect(FICTION_ABOUTS.erid.photos).toEqual([]);
    expect(FICTION_ABOUTS['blip-a'].photos).toEqual([]);
  });

  it('are kept apart from the real descriptions', () => {
    for (const record of FICTION_ENTRIES) {
      expect(DESCRIBED_IDS.has(fictionBodyId(record.id)), record.id).toBe(false);
      expect(DESCRIBED_IDS.has(record.id), record.id).toBe(false);
    }
  });
});
