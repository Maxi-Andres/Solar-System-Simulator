import { describe, expect, it } from 'vitest';

import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import { layersOf, SHOW_ME } from './showMe.ts';

/** A store with no bodies yet: what "show me" sees before a catalogue has loaded. */
const EMPTY = { bodies: [] } as unknown as EphemerisStore;

describe('show me', () => {
  it('switches on the satellites before waiting for the Space Station, so it loads at all', () => {
    expect(layersOf(SHOW_ME['satellite']!, EMPTY, 'earth')).toContain('satellites');
  });

  it('switches on what a view draws', () => {
    expect(layersOf(SHOW_ME['cmb']!, EMPTY, 'sun')).toContain('observableUniverse');
    expect(layersOf(SHOW_ME['laniakea']!, EMPTY, 'sun')).toEqual(expect.arrayContaining(['laniakea', 'basins', 'flowLines']));
  });
});
