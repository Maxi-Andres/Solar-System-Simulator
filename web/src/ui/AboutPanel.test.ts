import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLOSE_ORBIT_WINDOW_MONTHS } from '@sss/tools/config';

import {
  beltSentence,
  CLOSE_ORBIT_MONTHS,
  diameterKm,
  indicatorOpacity,
  INDICATOR_FADE_START,
  scrollState,
  spelled,
} from './AboutPanel.tsx';

/**
 * The About screen's own scrolling.
 *
 * It has its own because the browser's default was wrong twice over: the close button
 * scrolled away with the text, and the scrollbar said where you were without ever saying
 * there was more. The button is now a sibling of the scrolling region, which is a
 * structural fix nothing here can check; the progress ring is arithmetic, and every
 * interesting case is an edge case a rendered test could not reach anyway.
 */

describe('scrollState', () => {
  it('reports nothing to scroll when everything fits', () => {
    const state = scrollState(0, 800, 900);

    expect(state.scrollable).toBe(false);
    // Full rather than empty: nothing is left to read, which is what the ring would say.
    expect(state.progress).toBe(1);
  });

  it('ignores a page that is taller by a rounding error', () => {
    // Sub-pixel layout routinely leaves a scrollHeight a fraction past the client, and a
    // ring on a page nobody can actually scroll is worse than no ring.
    expect(scrollState(0, 900.4, 900).scrollable).toBe(false);
    expect(scrollState(0, 902, 900).scrollable).toBe(true);
  });

  it('runs from nothing read to everything read', () => {
    expect(scrollState(0, 2000, 1000).progress).toBe(0);
    expect(scrollState(500, 2000, 1000).progress).toBe(0.5);
    expect(scrollState(1000, 2000, 1000).progress).toBe(1);
  });

  it('survives the rubber band at both ends', () => {
    // macOS and iOS report overscroll as a negative scrollTop, or as one past the end.
    expect(scrollState(-120, 2000, 1000).progress).toBe(0);
    expect(scrollState(1200, 2000, 1000).progress).toBe(1);
  });

  it('never returns anything outside zero to one', () => {
    for (const top of [-500, 0, 1, 750, 1000, 5000]) {
      for (const height of [900, 1000, 3000]) {
        const { progress } = scrollState(top, height, 1000);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('indicatorOpacity', () => {
  it('stays fully on for most of the read', () => {
    expect(indicatorOpacity(0)).toBe(1);
    expect(indicatorOpacity(0.5)).toBe(1);
    expect(indicatorOpacity(INDICATOR_FADE_START)).toBe(1);
  });

  it('is gone by the end rather than at it', () => {
    // The last paragraph is the one it would otherwise be sitting on top of, with nothing
    // left to report.
    expect(indicatorOpacity(1)).toBe(0);
    expect(indicatorOpacity(0.94)).toBeCloseTo(0.5, 2);
  });

  it('only ever fades, never flickers', () => {
    let previous = 1.0001;
    for (let progress = 0; progress <= 1.0001; progress += 0.01) {
      const opacity = indicatorOpacity(progress);
      expect(opacity).toBeLessThanOrEqual(previous + 1e-9);
      expect(opacity).toBeGreaterThanOrEqual(0);
      previous = opacity;
    }
  });
});

/**
 * That every control answers to the pointer, and that nothing quietly cancels it.
 *
 * Source-text tests, like the favicon and field-of-view ones, because this is styling and
 * wiring: there is no browser in the suite to hover anything in. What makes them worth
 * having is that both failures here are silent. A control with no feedback looks exactly
 * like one whose feedback was overridden, and an inline `transform` beats the stylesheet
 * without warning anybody.
 */
const css = await readFile(join(import.meta.dirname, '../index.css'), 'utf8');

describe('press feedback', () => {

  it('reaches every button by element rather than by class', () => {
    // A class would have to be remembered on each new control. This cannot be forgotten.
    expect(css).toContain('#root button:hover:not(:disabled)');
    expect(css).toContain('#root button:active:not(:disabled)');
  });

  it('is written in properties nothing sets inline', () => {
    // The whole interface is styled with inline style objects, and an inline declaration
    // beats a class rule even on :hover. Reaching for `background` here would silently do
    // nothing on most of the controls it was meant for.
    for (const property of ['filter:', 'box-shadow:', 'transform:']) {
      expect(css).toContain(property);
    }
    const hoverBlock = css.slice(css.indexOf('#root button:hover'), css.indexOf('#root button:active'));
    expect(hoverBlock).not.toMatch(/\n\s*background:/);
    expect(hoverBlock).not.toMatch(/\n\s*color:/);
  });

  it('leaves a disabled control alone', () => {
    expect(css).toContain(':hover:not(:disabled)');
    expect(css).toContain("[aria-disabled='true']");
  });

  it('keeps the keyboard affordance', () => {
    expect(css).toContain('focus-visible');
  });

  it('spares table rows the scale, which would move the columns', () => {
    expect(css).toMatch(/\.ui-press:active[^{]*:not\(tr\)/);
  });

  it('keeps its hands off anything the frame loop positions', async () => {
    // The bug this is here for: the body labels are buttons, and the scene writes their
    // transform sixty times a second. A global `transition: transform` made the names
    // swim after the planets whenever the camera moved, and the press `scale` would have
    // replaced the position outright and flung the label into the corner.
    expect(css).toMatch(/#root button:not\(\.tracks-scene\)/);
    expect(css).toMatch(/:active[^{]*:not\(\.tracks-scene\)/);

    const app = await readFile(join(import.meta.dirname, '../App.tsx'), 'utf8');
    expect(app).toContain('className="tracks-scene"');

    // The brightness is safe and they keep it: a label still answers to the pointer.
    const base = css.slice(css.indexOf('#root button,'), css.indexOf('#root button:hover'));
    expect(base).not.toContain('transform');
  });

  it('leaves the scroll ring free to be pressed', async () => {
    // The regression this exists for: the ring was centred with an inline
    // `transform: translateX(-50%)`, which beat the stylesheet's `scale` and swallowed
    // the press. The centring lives on a wrapper now, and must stay there.
    const panel = await readFile(join(import.meta.dirname, 'AboutPanel.tsx'), 'utf8');
    const ring = panel.slice(panel.indexOf('function ScrollProgress'));
    const button = ring.slice(ring.indexOf('<button'));

    expect(ring).toContain("transform: 'translateX(-50%)'");
    // `transform:` is the inline-style spelling. The ring's own SVG uses the attribute
    // form to start the arc at the top, and that one is none of this test's business.
    expect(button).not.toMatch(/transform:/);
  });
});

/**
 * A layer that is switched off is switched off everywhere.
 *
 * The scene walks its own list of bodies and the panels walk theirs, so turning a kind off
 * hid the spheres and the orbits and left the names floating over empty space and the rows
 * still in the table. Nothing was wrong in either place on its own; they simply were not
 * being told the same thing.
 */
describe('hiding a kind', () => {
  const read = (file: string) => readFile(join(import.meta.dirname, file), 'utf8');

  it('reaches the labels', async () => {
    const projector = await read('../scene/LabelProjector.tsx');

    expect(projector).toContain('visibleKinds');
    expect(projector).toContain('!visibleKinds.has(body.kind)');
  });

  it('reaches the readout table', async () => {
    const readout = await read('ReadoutPanel.tsx');

    expect(readout).toContain('visibleKinds.has(body.kind)');
  });

  it('reaches every list of bodies there is', async () => {
    // The check that survives a new panel: anything that walks `store.bodies` to put
    // something on screen has to filter, or it becomes a different answer to "what is in
    // this scene" from the scene itself.
    for (const file of ['../App.tsx', 'BodyPicker.tsx', 'ReadoutPanel.tsx', '../scene/LabelProjector.tsx']) {
      const source = await read(file);
      if (source.includes('store.bodies')) {
        expect(source, file).toContain('visibleKinds');
      }
    }
  });
});

describe('the About text’s numbers', () => {
  it('spells counts as prose does', () => {
    expect(spelled(7)).toBe('seven');
    expect(spelled(19)).toBe('nineteen');
    expect(spelled(40)).toBe('forty');
    expect(spelled(51)).toBe('fifty-one');
    expect(spelled(174)).toBe('174');
  });

  it('states the close orbiters’ window the generator uses', () => {
    expect(CLOSE_ORBIT_MONTHS).toBe(CLOSE_ORBIT_WINDOW_MONTHS);
  });
});

describe('the belt, in the About text', () => {
  const classes = ['MBA', 'IMB', 'OMB', 'MCA', 'APO', 'ATE', 'AMO', 'IEO', 'TJN', 'CEN', 'TNO', 'PAA', 'HYA', 'AST'] as const;
  const tier = (index: number, count: number, brightestH: number | null, faintestH: number | null) => ({
    file: `elements-${index}.bin`,
    count,
    bytes: count * 36,
    brightestH,
    faintestH,
  });
  const tiers = [tier(0, 83_841, null, 15), tier(1, 123_777, 15, 16), tier(2, 1_367_842, 16, null)];
  const info = {
    source: { name: 'JPL Small-Body Database (SBDB) Query API', url: '', queriedAt: '2026-10-19' },
    file: 'elements-0.bin',
    count: 1_575_460,
    recordFloats: 9,
    magnitudeLimit: 22,
    referenceJd: 2461332.5,
    elementEpochs: { minJd: 2461200.5, maxJd: 2461200.5 },
    classes: [...classes],
    classCounts: {},
    excluded: ['1', '2', '4'],
    dropped: { notElliptic: 0, missingElements: 0 },
    tiers,
  } as const;
  const loaded = (index: number, mainBelt: number, trojans: number) => ({
    index,
    tier: tiers[index]!,
    records: new Float32Array(0),
    classCounts: { MBA: mainBelt, TJN: trojans },
  });

  it('counts what is loaded, and says where the rest is', () => {
    const text = beltSentence(info, [loaded(0, 70_000, 13_841)]);
    expect(text).toContain('the 83,841 brightest of the 1,575,460 asteroids');
    expect(text).toContain('brighter than absolute magnitude 15 — down to about 4 km across');
    expect(text).toContain('70,000 in the main belt');
    expect(text).toContain('Layers panel');
  });

  it('adds the tiers up as they arrive', () => {
    const text = beltSentence(info, [loaded(0, 70_000, 13_841), loaded(1, 120_000, 3_777)]);
    expect(text).toContain('the 207,618 brightest');
    expect(text).toContain('190,000 in the main belt');
    expect(text).toContain('about 3 km across');
  });

  it('says every one, and no limit, once the open last tier is in', () => {
    const text = beltSentence(info, [loaded(0, 1, 0), loaded(1, 1, 0), loaded(2, 1, 0)]);
    expect(text).toContain('every one of the 1,575,460 asteroids JPL’s Small-Body Database knows, each');
    expect(text).not.toContain('Layers panel');
    expect(text).not.toContain('absolute magnitude');
  });

  it('reads B2a data, one tier and no list, as all of it', () => {
    // As B2a wrote it: no tier list at all.
    const { tiers: unused, ...untiered } = info;
    void unused;
    const old = { ...untiered, count: 83_841, magnitudeLimit: 15 };
    const text = beltSentence(old, [{ ...loaded(0, 1, 0), tier: { ...tiers[0]!, faintestH: 15 } }]);
    expect(text).toContain('every one of the 83,841 asteroids');
    expect(text).toContain('brighter than absolute magnitude 15');
  });

  it('turns H into size the standard way', () => {
    // Ceres: H 3.34, albedo 0.09, 939 km across.
    expect(diameterKm(3.34, 0.09)).toBeCloseTo(950, -1);
  });
});
