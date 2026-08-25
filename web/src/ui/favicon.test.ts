import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Favicon checks.
 *
 * Deliberately about wiring and bounds, not about the drawing: the artwork is a
 * matter of taste and has already changed once. What must not silently break is the
 * reference from the page, the relative path that keeps it working under the GitHub
 * Pages prefix, and everything staying inside the viewBox.
 */

const HERE = import.meta.dirname;
const SVG = readFileSync(join(HERE, '../../public/favicon.svg'), 'utf8');
const HTML = readFileSync(join(HERE, '../../index.html'), 'utf8');

describe('favicon', () => {
  it('is referenced from the page by a relative path', () => {
    // Relative, so it resolves under /Solar-System-Simulator/ rather than at the
    // domain root, where it would 404 on the published site.
    expect(HTML).toContain('href="./favicon.svg"');
    expect(HTML).not.toContain('href="/favicon.svg"');
  });

  it('carries the site title', () => {
    expect(HTML).toContain("<title>Max's Solar System</title>");
  });

  it('is a square 32-unit SVG, so it scales cleanly to 16px', () => {
    expect(SVG).toContain('viewBox="0 0 32 32"');
    expect(SVG).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('keeps every drawn coordinate inside the viewBox', () => {
    // Path points and shape centres only. Rotation angles and radii are not
    // positions; sweeping them up here previously failed on a -45 degree rotation.
    const coordinates: number[] = [];

    for (const match of SVG.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
      for (const pair of match[1]!.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/g)) {
        coordinates.push(Number(pair[1]), Number(pair[2]));
      }
    }
    for (const match of SVG.matchAll(/c[xy]="([\d.]+)"/g)) {
      coordinates.push(Number(match[1]));
    }

    expect(coordinates.length).toBeGreaterThan(10);
    for (const value of coordinates) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(32);
    }
  });

  it('has a filled tile behind the artwork, so it reads on any browser chrome', () => {
    expect(SVG).toMatch(/<rect[^>]*fill="#[0-9a-f]{6}"/i);
  });
});
