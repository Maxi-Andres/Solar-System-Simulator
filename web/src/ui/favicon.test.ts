import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

/**
 * Favicon checks.
 *
 * Deliberately about wiring and fitness, not about the drawing: the artwork is a matter
 * of taste and has now changed twice. What must not silently break is the reference from
 * the page, the relative path that keeps it working under the GitHub Pages prefix, and
 * the file actually being a usable icon.
 */

const HERE = import.meta.dirname;
const ICON_PATH = join(HERE, '../../public/rocket.png');
const HTML = readFileSync(join(HERE, '../../index.html'), 'utf8');
const ICON = PNG.sync.read(readFileSync(ICON_PATH));

describe('favicon', () => {
  it('is referenced from the page by a relative path', () => {
    // Relative, so it resolves under /Solar-System-Simulator/ rather than at the domain
    // root, where it would 404 on the published site. This is the check that matters:
    // a favicon is the one asset nobody notices is broken.
    expect(HTML).toContain('href="./rocket.png"');
    expect(HTML).not.toContain('href="/rocket.png"');
  });

  it('is used for the home-screen icon too', () => {
    // Apple ignores SVG favicons entirely, which is why the previous SVG needed a
    // fallback. A PNG serves both.
    expect(HTML).toContain('rel="apple-touch-icon" href="./rocket.png"');
  });

  it('carries the site title', () => {
    expect(HTML).toContain("<title>Max's Solar System</title>");
  });

  it('leaves nothing pointing at the SVG it replaced', () => {
    expect(HTML).not.toContain('favicon.svg');
  });

  it('is square, so it scales to 16px without distortion', () => {
    expect(ICON.width).toBe(ICON.height);
    // A browser renders the tab icon at 16 or 32 CSS pixels; anything from 128 up has
    // the detail to downscale cleanly, and below 64 it would be upscaled on retina.
    expect(ICON.width).toBeGreaterThanOrEqual(64);
  });

  it('has transparency, so it sits on any browser chrome', () => {
    // The previous icon solved this with an opaque dark tile behind the artwork, which
    // reads badly on a dark theme. A transparent PNG adapts instead.
    let transparent = 0;
    for (let i = 0; i < ICON.width * ICON.height; i += 1) {
      if (ICON.data[i * 4 + 3]! < 10) {
        transparent += 1;
      }
    }

    expect(transparent).toBeGreaterThan(0);
  });

  it('is white, because a browser tab is usually dark behind it', () => {
    // The source file was black -- it was simply the one to hand. Recolouring it was
    // exact rather than an inversion: the artwork was pure black with the whole shape
    // in the alpha channel, so there was no shading to lose.
    //
    // Every pixel is white, including the fully transparent ones, so that filtering
    // down to 16px blends toward white instead of dragging a dark fringe out of them.
    //
    // Reduced to one assertion rather than three per pixel: the first version made
    // 786,000 expect() calls and blew the five-second timeout, failing a file that was
    // perfectly correct. A test slow enough to time out is a test that reports noise.
    let darkest = 255;
    for (let i = 0; i < ICON.width * ICON.height; i += 1) {
      darkest = Math.min(darkest, ICON.data[i * 4]!, ICON.data[i * 4 + 1]!, ICON.data[i * 4 + 2]!);
    }

    expect(darkest).toBe(255);
  });

  it('is small enough not to matter to the page weight', () => {
    // It loads on every visit, before anything else is decided.
    expect(statSync(ICON_PATH).size).toBeLessThan(100_000);
  });
});
