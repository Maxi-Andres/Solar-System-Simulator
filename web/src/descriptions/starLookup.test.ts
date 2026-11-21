import { describe, expect, it, vi } from 'vitest';

/**
 * descriptionOf for a catalogue star made a body at run time: its id is its record's
 * (`star-<tier>-<index>`), so the lookup goes through the designations the star body carries.
 * Here starBodyFacts stands in for a store that has made Sirius B and Polaris bodies.
 */
vi.mock('../core/starBodies.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/starBodies.ts')>();
  const designations: Record<string, readonly string[]> = {
    'star-0-17': ['GJ 244 B', 'alf CMa B', 'Gaia DR3 2947050466531873024'],
    'star-0-3': ['HR 424', 'alf UMi', 'HIP 11767'],
    'star-2-500': ['HIP 12345'],
  };
  return {
    ...actual,
    starBodyFacts: (id: string) => (designations[id] === undefined ? null : { designations: designations[id] }),
  };
});

const { descriptionOf } = await import('./index.ts');
const { hasDescription } = await import('./ids.ts');

describe('descriptionOf, for a star made a body at run time', () => {
  it('finds it by the designations its body carries', () => {
    expect(descriptionOf('star-0-17')?.id).toBe('sirius-b');
    expect(descriptionOf('star-0-3')?.id).toBe('polaris');
    expect(hasDescription('star-0-17')).toBe(true);
  });

  it('finds none for a star without one, and still finds every other body by its id', () => {
    expect(descriptionOf('star-2-500')).toBeNull();
    expect(descriptionOf('star-9-9')).toBeNull();
    expect(descriptionOf('earth')?.id).toBe('earth');
    expect(hasDescription('star-2-500')).toBe(false);
    expect(hasDescription('earth')).toBe(true);
  });
});
