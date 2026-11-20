import type { BodyId } from '@sss/tools/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CATALOG, getBody } from '@sss/tools/catalog';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { descriptionOf } from '../descriptions/index.ts';
import { CMB_DESCRIPTION_ID, LANIAKEA_DESCRIPTION_ID, MILKY_WAY_DESCRIPTION_ID } from '../descriptions/subjects.ts';
import { AU_KM, PARSEC_KM } from '../scene/scale.ts';
import { LEVELS, type LevelId } from '../state/levels.ts';
import { shapeNote, surfaceMapNote } from './InfoPanel.tsx';
import { LevelPanel, levelFacts, levelReading } from './LevelFacts.tsx';

/**
 * The "Surface map" line: what the panel says about a body drawn in flat colour.
 *
 * The danger here is one of tone more than of code. "None exists" is a claim about the
 * world, and the easy generic version of this line -- "never imaged up close" -- is false
 * for some of the bodies it would appear on: Bennu, Ryugu, Deimos, Arrokoth and a dozen
 * small moons were all photographed by spacecraft. So the tests pin which bodies
 * may say "none exists", not just that something is said.
 */

describe('surfaceMapNote', () => {
  it('says nothing for a body that has a map, which is now Ceres and Vesta too', () => {
    for (const id of ['earth', 'moon', 'pluto', 'charon', 'ceres', 'vesta']) {
      expect(surfaceMapNote(getBody(id)), id).toBeNull();
    }
  });

  it('says nothing for a spacecraft, which has a model instead of a surface', () => {
    for (const body of CATALOG.filter((candidate) => candidate.kind === 'spacecraft')) {
      expect(surfaceMapNote(body), body.id).toBeNull();
    }
  });

  it('gives every natural body without a map a line, and every body with one none', () => {
    for (const body of CATALOG.filter((candidate) => candidate.kind !== 'spacecraft')) {
      const mapped = body.textures !== null || (body.shapeModel?.map ?? null) !== null;
      expect(surfaceMapNote(body) === null, body.id).toBe(mapped);
    }
  });

  it('says "none exists" of the bodies no spacecraft has visited', () => {
    for (const id of ['eris', 'makemake', 'haumea', 'pallas']) {
      expect(surfaceMapNote(getBody(id)), id).toBe('None exists: never visited');
    }
  });

  it('names the visit still to come, where one is flying', () => {
    expect(surfaceMapNote(getBody('eurybates'))).toContain('Lucy');
    expect(surfaceMapNote(getBody('eurybates'))).toContain('2027');
    expect(surfaceMapNote(getBody('16-psyche'))).toContain('2029');
    expect(surfaceMapNote(getBody('apophis'))).toContain('OSIRIS-APEX');
  });

  it('says nothing of Bennu and Ryugu, whose global maps are draped on their shapes', () => {
    // OSIRIS-REx's PAN mosaic and Hayabusa2's normal-albedo map: see smallBodies.ts.
    for (const id of ['bennu', 'ryugu']) {
      expect(surfaceMapNote(getBody(id)), id).toBeNull();
    }
  });

  it('never says "none exists" of a body whose imaged half was mapped', () => {
    const note = surfaceMapNote(getBody('arrokoth'))!;
    expect(note).not.toMatch(/none/i);
    expect(note).toContain('not drawn');
  });

  it("says why Deimos's map is missing rather than that it has none", () => {
    expect(surfaceMapNote(getBody('deimos'))).toContain('cannot be placed');
  });

  it('reads "never resolved" off the data for a moon whose size is unpublished', () => {
    // Had a camera resolved it, its size would be measured: the missing radius is the
    // evidence, and it comes from JPL rather than from a list kept here.
    const unsized = CATALOG.filter(
      (body) => body.kind === 'moon' && body.radiusPublished === false,
    );
    expect(unsized.length).toBeGreaterThan(100);
    for (const body of unsized) {
      expect(surfaceMapNote(body), body.id).toContain('never resolved');
    }
  });

  it('claims nothing about a sized small moon, several of which were photographed', () => {
    // Amalthea by Galileo, Hyperion and Phoebe by Cassini, Proteus by Voyager 2.
    for (const id of ['amalthea', 'hyperion', 'phoebe', 'proteus']) {
      expect(surfaceMapNote(getBody(id)), id).toBe('None drawn');
    }
  });
});

describe('shapeNote', () => {
  it("names each shape model's product and the facets drawn of it", () => {
    expect(shapeNote(getBody('bennu').shapeModel!)).toBe(
      'OSIRIS-REx SPO v54 (SPC + lidar), 3.2 m, 196,608 facets',
    );
    for (const body of CATALOG.filter((candidate) => candidate.shapeModel !== undefined)) {
      expect(shapeNote(body.shapeModel!), body.id).toContain(
        body.shapeModel!.facets.toLocaleString('en-US'),
      );
    }
  });

  it('says where a spin is known only near one time', () => {
    for (const id of ['didymos', 'arrokoth', 'donaldjohanson']) {
      expect(getBody(id).shapeModel!.orientationNote, id).not.toBeNull();
    }
    for (const id of ['bennu', 'ryugu']) {
      expect(getBody(id).shapeModel!.orientationNote, id).toBeNull();
    }
  });
});

/**
 * A breadcrumb level's panel (LevelFacts.tsx), shown in place of its centre's while it is selected:
 * its name, its kind, its figures each with where it is from, and its description where one is
 * written. Rendered to static markup with the ephemerides faked: Voyager 1 170 AU out, the
 * centre -- M87, Laniakea's attractor -- 16.5 Mpc.
 */
describe('a level’s panel', () => {
  const store = {
    distanceBetween: (id: BodyId) => (id === 'voyager-1' ? 170 * AU_KM : 16.5e6 * PARSEC_KM),
  } as unknown as EphemerisStore;
  const textOf = (html: string): string =>
    html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
  const render = (level: LevelId, focus: BodyId = 'sun'): string =>
    textOf(
      renderToStaticMarkup(
        createElement(LevelPanel, { level, store, focus, jd: 2461000.5, distanceMode: 'center', onClose: () => {} }),
      ),
    );
  const live = { voyager1Km: 170 * AU_KM, centreKm: 16.5e6 * PARSEC_KM };

  it('renders every level’s name, kind and figures', () => {
    for (const level of Object.keys(LEVELS) as LevelId[]) {
      const text = render(level);
      expect(text, level).toContain(LEVELS[level].name);
      expect(text, level).toContain(LEVELS[level].kind);
      const facts = levelFacts(level, live);
      expect(facts.length, level).toBeGreaterThanOrEqual(3);
      expect(facts.length, level).toBeLessThanOrEqual(5);
      for (const fact of facts) {
        expect(text, `${level}: ${fact.label}`).toContain(fact.label);
        expect(text, `${level}: ${fact.label}`).toContain(fact.value);
        if (fact.source !== null) expect(text, `${level}: ${fact.label}`).toContain(fact.source);
      }
    }
  });

  it('reads its figures off the constants the app draws by', () => {
    const value = (level: LevelId, label: string): string =>
      levelFacts(level, live).find((fact) => fact.label === label)!.value;
    expect(value('solar-system', 'Neptune’s orbit')).toBe('30.07 AU');
    expect(value('solar-system', 'Voyager 1 now')).toBe('170.0 AU');
    expect(value('solar-neighbourhood', 'Star map complete to')).toBe('100 pc, 326 ly');
    expect(value('milky-way', 'Disc')).toBe('about 100,000 ly across');
    expect(value('milky-way', 'Sun from the centre')).toBe('8.28 kpc, 27,000 ly');
    expect(value('local-group', 'Radius')).toBe('1 Mpc, 3.26 million ly');
    expect(value('local-group', 'Andromeda')).toMatch(/^2\.\d\d million ly$/);
    expect(value('local-volume', 'Radius')).toBe('11 Mpc, 35.9 million ly');
    expect(value('virgo-cluster', 'Distance')).toBe('16.5 Mpc, 53.8 million ly');
    expect(value('nearby-universe', 'Mapped to')).toBe('700 Mpc, 2.3 billion ly');
    expect(value('observable-universe', 'Radius')).toBe('46.2 billion ly');
    expect(value('observable-universe', 'Age')).toBe('13.8 billion years');
  });

  it('says nothing live it cannot know', () => {
    const none = { voyager1Km: null, centreKm: null };
    expect(levelFacts('solar-system', none).find((fact) => fact.label === 'Voyager 1 now')!.value).toBe('--');
    expect(levelFacts('laniakea', none).find((fact) => fact.label === 'Attractor')!.value).toBe('--');
  });

  it('offers its description where one is written, and only then', () => {
    expect(levelReading('milky-way')?.id).toBe(MILKY_WAY_DESCRIPTION_ID);
    expect(render('milky-way')).toContain('Read about the Milky Way');
    expect(levelReading('laniakea')?.id).toBe(LANIAKEA_DESCRIPTION_ID);
    expect(render('laniakea')).toContain('Read about the Laniakea Supercluster');
    for (const level of Object.keys(LEVELS) as LevelId[]) {
      const reading = levelReading(level);
      expect(render(level).includes('Read about'), level).toBe(reading !== null);
      if (reading !== null) expect(descriptionOf(reading.id), level).not.toBeNull();
    }
  });

  it('offers the CMB’s for the Observable Universe until its own is written', () => {
    const reading = levelReading('observable-universe');
    expect(reading).not.toBeNull();
    if (descriptionOf('observable-universe') === null) {
      expect(reading!.id).toBe(CMB_DESCRIPTION_ID);
      expect(render('observable-universe')).toContain('Read about the cosmic microwave background');
    } else {
      expect(reading!.id).toBe('observable-universe');
      expect(render('observable-universe')).toContain('Read about the observable universe');
    }
  });
});
