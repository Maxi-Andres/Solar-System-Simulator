import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PANEL_EXIT_MS } from './Presence.tsx';

/**
 * The closing animation lives in two places that have to agree: the stylesheet says how
 * long it runs, and Presence keeps the panel mounted for that long. If the component
 * lets go first the panel vanishes mid-slide; if the stylesheet ends first it sits there
 * invisible for the difference, swallowing clicks.
 */
const css = await readFile(join(import.meta.dirname, '../index.css'), 'utf8');

function durationOf(className: string): number {
  const rule = new RegExp(`\\.${className}\\s*\\{[^}]*animation:\\s*[\\w-]+\\s+(\\d+)ms`).exec(css);
  if (rule === null) {
    throw new Error(`No animation found for .${className}`);
  }
  return Number(rule[1]);
}

describe('panel animations', () => {
  it('keep a closing panel mounted exactly as long as it animates', () => {
    expect(durationOf('panel-exit')).toBe(PANEL_EXIT_MS);
    expect(durationOf('overlay-exit')).toBe(PANEL_EXIT_MS);
  });

  it('stay small: under a fifth of a second either way', () => {
    for (const name of ['panel-enter', 'panel-exit', 'overlay-enter', 'overlay-exit']) {
      expect(durationOf(name), name).toBeLessThanOrEqual(200);
    }
  });

  it('let a closing panel be clicked through, since it is already gone as far as anyone knows', () => {
    expect(css).toMatch(/\.panel-exit\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.overlay-exit\s*\{[^}]*pointer-events:\s*none/);
  });

  it('respect a request for less motion by dropping the travel, not the animation', () => {
    // The first version cut everything to a millisecond under reduced motion, and on a
    // Windows machine with animation effects off that made every panel pop in and vanish.
    // Reduced motion means no movement; a fade in place is still allowed, and still says
    // that something opened or closed.
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\.panel-enter\s*\{\s*animation-name:\s*overlay-in/);
    expect(block).toMatch(/\.panel-exit\s*\{\s*animation-name:\s*overlay-out/);
    expect(block).not.toMatch(/animation-duration/);
    // And the fades it swaps in move nothing.
    expect(/@keyframes overlay-in\s*\{[^@]*\}/.exec(css)?.[0]).not.toMatch(/transform/);
  });
});
