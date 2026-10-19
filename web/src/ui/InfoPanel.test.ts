import { describe, expect, it } from 'vitest';

import { CATALOG, getBody } from '@sss/tools/catalog';

import { surfaceMapNote } from './InfoPanel.tsx';

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
      expect(surfaceMapNote(body) === null, body.id).toBe(body.textures !== null);
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

  it('never says "none exists" of a body a spacecraft mapped whole', () => {
    // Bennu has a USGS-listed global basemap; Ryugu was imaged all round by Hayabusa2.
    // Their lines say they were mapped and are simply not drawn yet.
    for (const id of ['bennu', 'ryugu']) {
      const note = surfaceMapNote(getBody(id))!;
      expect(note, id).not.toMatch(/none/i);
      expect(note, id).toContain('not drawn yet');
    }
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
