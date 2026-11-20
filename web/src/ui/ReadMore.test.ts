import { describe, expect, it } from 'vitest';

import { spokenName } from './ReadMore.tsx';

describe('the way into a description', () => {
  it('puts "the" before the names English says it before, and only those', () => {
    expect(spokenName('Sun')).toBe('the Sun');
    expect(spokenName('Coalsack')).toBe('the Coalsack');
    expect(spokenName('Hyades')).toBe('the Hyades');
    expect(spokenName('Perseids')).toBe('the Perseids');
    expect(spokenName('Geminids')).toBe('the Geminids');
    expect(spokenName('Ring Nebula')).toBe('the Ring Nebula');
    expect(spokenName('Coma Cluster')).toBe('the Coma Cluster');
    expect(spokenName('Chandra X-ray Observatory')).toBe('the Chandra X-ray Observatory');
    expect(spokenName('Mars')).toBe('Mars');
    expect(spokenName('Betelgeuse')).toBe('Betelgeuse');
    expect(spokenName('NGC 253')).toBe('NGC 253');
    expect(spokenName('Voyager 1')).toBe('Voyager 1');
    expect(spokenName('The Moon')).toBe('The Moon');
  });
});
