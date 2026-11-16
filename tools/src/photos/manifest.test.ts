import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkManifest, type PhotoManifest } from './manifest.ts';

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'manifest.json'), 'utf8')) as PhotoManifest;

describe('the photo manifest', () => {
  it('records a credit, a known licence, its pages and files for every photo', () => {
    expect(checkManifest(manifest)).toEqual([]);
  });

  it('catches a photo without a credit, and one key used for two pictures', () => {
    const object = manifest.objects[0];
    const photo = object?.photos[0];
    if (object === undefined || photo === undefined) throw new Error('the manifest is empty');
    const broken: PhotoManifest = {
      objects: [
        { ...object, photos: [{ ...photo, credit: '' }] },
        { ...object, name: `${object.name} again`, photos: [{ ...photo, title: 'Another picture' }] },
      ],
      unphotographed: [],
    };
    const problems = checkManifest(broken);
    expect(problems.some((line) => line.includes('no credit'))).toBe(true);
    expect(problems.some((line) => line.includes('two different pictures'))).toBe(true);
  });
});
