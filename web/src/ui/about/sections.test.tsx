import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CATALOG } from '@sss/tools/catalog';
import type { BodyKind } from '@sss/tools/types';

import { ESA_MODEL_CREDIT } from '../../scene/craftModels.ts';
import { AboutPanel } from '../AboutPanel.tsx';
import { fixtureData, fixtureSources } from './aboutFixture.ts';
import { CMB_DIPOLE as TOOLS_CMB_DIPOLE } from '../../../../tools/src/laniakea/frames.ts';
import {
  CMB_DIPOLE,
  EARTH_ROTATION,
  earthSpin,
  galacticYear,
  localArm,
  sunAboutCentreKmS,
  sunAgainstCmb,
  yearlyCmbRange,
} from './AddressSection.tsx';
import { KIND_TERM, termAnchor } from './GlossarySection.tsx';
import { GLOSSARY_PHOTOS } from './glossaryPhotos.ts';
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
  it('are the eight, in reading order', () => {
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

describe('what’s what', () => {
  const html = rendered.find(({ section }) => section.id === 'glossary')!.html;
  const ids = (markup: string) => [...markup.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!);

  it('renders, an entry for each kind the app shows, each with its own anchor', () => {
    const terms = ids(html).filter((id) => id.startsWith('about-glossary-term-'));
    expect(terms.length).toBeGreaterThan(50);
    expect(new Set(terms).size).toBe(terms.length);
    for (const term of ['sun', 'planet', 'dwarf-planet', 'white-dwarf', 'galaxy', 'local-group', 'cmb', 'parsec']) {
      expect(terms, term).toContain(termAnchor(term));
    }
  });

  it('has no anchor any other section has', () => {
    const all = rendered.flatMap(({ html: markup }) => ids(markup));
    expect(new Set(all).size).toBe(all.length);
  });

  it('shows each photo with its credit, lazily, every one a file credited in CREDITS.md', () => {
    const dir = join(import.meta.dirname, '../../../public/glossary');
    const credits = readFileSync(join(dir, 'CREDITS.md'), 'utf8');
    const files = readdirSync(dir).filter((name) => name.endsWith('.webp'));
    expect(files.sort()).toEqual(Object.values(GLOSSARY_PHOTOS).map((photo) => photo.file).sort());
    let bytes = 0;
    for (const [term, photo] of Object.entries(GLOSSARY_PHOTOS)) {
      expect(html, term).toContain(`id="${termAnchor(term)}"`);
      expect(credits, photo.file).toContain(`| \`${photo.file}\` |`);
      expect(credits, photo.file).toContain(photo.credit);
      expect(textOf(html), photo.file).toContain(photo.credit);
      bytes += statSync(join(dir, photo.file)).size;
      expect(statSync(join(dir, photo.file)).size, photo.file).toBeLessThan(60_000);
    }
    expect(bytes).toBeLessThan(1_000_000);
    expect(html.match(/<img /g)?.length).toBe(Object.keys(GLOSSARY_PHOTOS).length);
    expect(html.match(/loading="lazy"/g)?.length).toBe(Object.keys(GLOSSARY_PHOTOS).length);
  });

  it('says what a body of every kind is', () => {
    for (const [kind, term] of Object.entries(KIND_TERM) as [BodyKind, string][]) {
      expect(html, kind).toContain(`id="${termAnchor(term)}"`);
    }
  });
});

describe('where we are', () => {
  const text = textOf(rendered.find(({ section }) => section.id === 'address')!.html);

  it('has the ten shells, Earth to the observable universe', () => {
    for (const shell of ['Earth', 'The Solar System', 'Local Bubble', 'Local (Orion) Arm', 'The Milky Way', 'The Local Group', 'Local Sheet', 'Virgo (Local) Supercluster', 'Laniakea', 'The observable universe']) {
      expect(text, shell).toContain(shell);
    }
    expect(text).toContain('46.2 billion light years');
  });

  it('works its speeds out of the app’s own numbers, and they are the published ones', () => {
    // The tools place the redshifts in the CMB frame with the same dipole.
    expect(CMB_DIPOLE).toEqual(TOOLS_CMB_DIPOLE);
    const earth = CATALOG.find((body) => body.id === 'earth')!;
    expect(EARTH_ROTATION).toEqual({
      radiusEquatorialKm: earth.radiusEquatorialKm,
      rotationRateDegPerDay: earth.rotation!.rotationRateDegPerDay,
    });
    const spin = earthSpin();
    expect(spin.equatorMs).toBeCloseTo(465.1, 0);
    expect(spin.siderealDayS).toBeCloseTo(86_164.09, 1);
    // Gordon et al. 2023's 6.40 mas/yr at GRAVITY's 8.28 kpc; Reid et al. 2019's 236 +- 7 for the circular speed.
    expect(sunAboutCentreKmS()).toBeCloseTo(251.1, 0);
    expect(galacticYear().circularKmS).toBeGreaterThan(229);
    expect(galacticYear().circularKmS).toBeLessThan(243);
    expect(galacticYear().lapMyr).toBeCloseTo(213, -1);
    expect(localArm().lengthLy).toBeCloseTo(19_900, -3);
  });

  it('puts the CMB dipole 11 degrees south of the ecliptic, and Earth between 340 and 400 km/s against it', () => {
    const sun = sunAgainstCmb();
    expect(Math.hypot(sun.x, sun.y, sun.z)).toBeCloseTo(369.82, 6);
    expect((Math.asin(sun.z / 369.82) * 180) / Math.PI).toBeCloseTo(-11.15, 1);
    const range = yearlyCmbRange();
    expect(range.min).toBeCloseTo(340.7, 0);
    expect(range.max).toBeCloseTo(399.1, 0);
    expect(text).toMatch(/between 34\d and 399/);
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
    // The cosmic web's, as cosmic-web.json records them.
    expect(sources).toContain('This work makes use of the service L3S/COSFIL.');
    expect(sources).toContain('Funding for SDSS-III has been provided by the Alfred P. Sloan Foundation, the Participating Institutions, the National Science Foundation, and the U.S. Department of Energy Office of Science');
    expect(sources).toContain('doi:10.26093/cds/vizier.74383465');
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
