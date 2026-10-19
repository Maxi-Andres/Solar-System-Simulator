import { describe, expect, it } from 'vitest';

import { compactCount, densityLabel, megabytes, progressText, spokenCount } from './LayersPanel.tsx';

/**
 * The belt's density choices, as words. Every number here comes from belt.json in the
 * app; these are the generator's planned tiers, so the labels are the ones a viewer sees.
 */

describe('the density labels', () => {
  it('say the planned tiers as a person would', () => {
    expect(spokenCount(83_841)).toBe('84 thousand');
    expect(spokenCount(83_841 + 123_777)).toBe('210 thousand');
    expect(spokenCount(487_538)).toBe('490 thousand');
    expect(spokenCount(942_263)).toBe('940 thousand');
    expect(spokenCount(1_575_460)).toBe('1.6 million');
    // Where two figures in thousands round up to a thousand, it is a million.
    expect(spokenCount(999_600)).toBe('1 million');
    expect(spokenCount(812)).toBe('812');
  });

  it('give sizes in megabytes, to two figures', () => {
    expect(megabytes(3_018_276)).toBe('3.0');
    expect(megabytes(7_474_248)).toBe('7.5');
    expect(megabytes(17_551_368)).toBe('18');
    expect(megabytes(56_716_560)).toBe('57');
  });

  it('call the last choice All', () => {
    const density = { tiers: 5, count: 1_575_460, bytes: 56_716_560, faintestH: null };
    expect(densityLabel(density, true)).toBe('All 1.6 million');
    expect(densityLabel({ ...density, tiers: 1, count: 83_841 }, false)).toBe('84 thousand');
  });
});

describe('progressText', () => {
  const base = { wanted: 3, loaded: 1, bytesWanted: 17_551_368, bytesLoaded: 9_100_000, failed: false };

  it('counts the tier on its way and the megabytes in hand', () => {
    expect(progressText(base)).toBe('Loading 2 of 3 · 9.1 of 18 MB');
  });

  it('says nothing once everything asked for is here, or before belt.json says what is', () => {
    expect(progressText({ ...base, loaded: 3, bytesLoaded: 17_551_368 })).toBeNull();
    expect(progressText({ ...base, loaded: 0, bytesWanted: 0, bytesLoaded: 0 })).toBeNull();
  });

  it('says so when a tier failed', () => {
    expect(progressText({ ...base, failed: true })).toBe('Could not load the asteroids');
  });
});

describe('compactCount', () => {
  it('fits a family count on a chip', () => {
    expect(compactCount(548)).toBe('548');
    expect(compactCount(1_460)).toBe('1.5k');
    expect(compactCount(64_004)).toBe('64k');
    expect(compactCount(123_777)).toBe('124k');
    expect(compactCount(1_460_000)).toBe('1.5M');
    // Never "1000k".
    expect(compactCount(999_700)).toBe('1M');
  });
});
