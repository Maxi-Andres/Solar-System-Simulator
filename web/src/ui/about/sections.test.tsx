import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ESA_MODEL_CREDIT } from '../../scene/craftModels.ts';
import { AboutPanel } from '../AboutPanel.tsx';
import { fixtureData, fixtureSources } from './aboutFixture.ts';
import { anchorId, SECTION_IDS } from './nav.ts';
import { REFERENCE_GROUPS, REFERENCES, referenceAnchor } from './references.ts';
import { ABOUT_SECTIONS } from './sections.ts';

// The panel's catalogues arrive through useSyncExternalStore, which a server render
// refuses without a server snapshot; the client one serves for both here.
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return {
    ...react,
    useSyncExternalStore: <T,>(subscribe: (onChange: () => void) => () => void, get: () => T) =>
      react.useSyncExternalStore(subscribe, get, get),
  };
});

/**
 * The About, as sections.
 *
 * It was one scroll nobody could find anything in; now it is six sections behind tabs,
 * each listing its subsections, with numbered citations and cross-references that jump.
 * What can silently break is the wiring: a subsection listed at a section's top with no
 * heading to jump to, a citation to a reference nobody listed, an equation naming a file
 * that has since moved. Rendered to static markup -- there is no browser in the suite.
 */

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');

const rendered = ABOUT_SECTIONS.map((section) => ({
  section,
  html: renderToStaticMarkup(<section.Body data={fixtureData} />),
}));

describe('the About’s sections', () => {
  it('are the six, in reading order', () => {
    expect(ABOUT_SECTIONS.map((section) => section.id)).toEqual([...SECTION_IDS]);
    expect(new Set(ABOUT_SECTIONS.map((section) => section.tab)).size).toBe(SECTION_IDS.length);
  });

  it('each render, with something in them', () => {
    for (const { section, html } of rendered) {
      expect(textOf(html).length, section.id).toBeGreaterThan(500);
    }
  });

  it('list exactly the subsections they have', () => {
    for (const { section, html } of rendered) {
      const headings = [...html.matchAll(/<h3 id="([^"]+)"/g)].map((match) => match[1]);
      expect(headings, section.id).toEqual(section.subsections.map((sub) => anchorId(section.id, sub.id)));
    }
  });

  it('show their tabs, the current one marked', () => {
    const html = renderToStaticMarkup(<AboutPanel {...fixtureSources} />);
    const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>(.*?)<\/button>/g)];
    expect(tabs.map((tab) => textOf(tab[2]!).trim())).toEqual(
      ABOUT_SECTIONS.map((section, index) => `${index + 1} ${section.tab}`),
    );
    expect(tabs.filter((tab) => tab[1] === 'true')).toHaveLength(1);
    // It opens on the overview, with the panel's name over it.
    expect(html).toContain('aria-selected="true" aria-controls="about-panel" tabindex="0"');
    expect(textOf(html)).toContain('Max’s Solar System');
  });
});

describe('cross-references', () => {
  it('reach a subsection that exists', () => {
    const anchors = new Set(
      ABOUT_SECTIONS.flatMap((section) => section.subsections.map((sub) => anchorId(section.id, sub.id))),
    );
    // Xref is a button whose target is only known when clicked, so read the sources instead.
    const asked: string[] = [];
    for (const file of readdirSync(import.meta.dirname).filter((name) => name.endsWith('Section.tsx'))) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      for (const match of source.matchAll(/<Xref to="(\w+)"(?: sub="([\w-]+)")?/g)) {
        asked.push(
          match[2] === undefined ? match[1]! : anchorId(match[1] as (typeof SECTION_IDS)[number], match[2]),
        );
      }
    }
    expect(asked.length).toBeGreaterThan(20);
    for (const target of asked) {
      expect(SECTION_IDS.includes(target as never) || anchors.has(target), target).toBe(true);
    }
  });
});

describe('the reference list', () => {
  it('has each reference once, with a real link where it has one', () => {
    const keys = REFERENCES.map((reference) => reference.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const reference of REFERENCES) {
      if (reference.link !== undefined) {
        expect(reference.link, reference.key).toMatch(/^https:\/\//);
      }
    }
  });

  it('is in Sources, numbered, every entry where a citation jumps to', () => {
    const html = rendered.find(({ section }) => section.id === 'sources')!.html;
    for (const [index, reference] of REFERENCES.entries()) {
      expect(html).toContain(`id="${referenceAnchor(reference.key)}"`);
      expect(html).toContain(`[${index + 1}]`);
    }
    expect(REFERENCE_GROUPS.length).toBeGreaterThan(5);
  });

  it('is cited: every citation names a listed reference, and nearly every reference is cited', () => {
    // Rendering would already have thrown on an unknown key (referenceNumber); this checks
    // the other way, that the list is not a bibliography of things nothing uses.
    const cited = new Set(
      rendered.flatMap(({ html }) =>
        [...html.matchAll(/title="Go to this reference in Sources"[^>]*>(\d+)</g)].map((match) =>
          Number(match[1]),
        ),
      ),
    );
    expect(cited.size).toBeGreaterThan(REFERENCES.length * 0.6);
  });
});

describe('credits', () => {
  const sources = textOf(rendered.find(({ section }) => section.id === 'sources')!.html);

  it('carry the lines their sources ask for, word for word', () => {
    expect(sources).toContain(ESA_MODEL_CREDIT);
    expect(sources).toContain(
      'This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.',
    );
    expect(sources).toContain('Funding for the DPAC has been provided by national institutions');
    expect(sources).toContain('https://doi.org/10.5270/esa-ybmj68p');
    expect(sources).toContain('https://doi.org/10.57780/esa-k25x2cv');
    expect(sources).toContain('CC BY 4.0');
    expect(sources).toContain('This project is not affiliated with or endorsed by NASA, JPL or ESA.');
  });
});

describe('the equations', () => {
  const physics = rendered.find(({ section }) => section.id === 'physics')!.html;

  it('are MathML', () => {
    expect((physics.match(/<math display="block">/g) ?? []).length).toBeGreaterThan(15);
  });

  it('name files that exist', () => {
    const root = join(import.meta.dirname, '../../../..');
    const files = rendered.flatMap(({ html }) =>
      [...html.matchAll(/<code[^>]*>(web\/src\/[^<( ]+)/g)].map((match) => match[1]!),
    );
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });
});
