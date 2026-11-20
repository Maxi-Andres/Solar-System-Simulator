import type { LaniakeaInfo, LaniakeaLandmark } from '@sss/tools/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { structureBodyId } from '../core/laniakea.ts';
import { structureBodies } from '../core/structures.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { basinDrawnAs, StructurePanel } from './StructureFacts.tsx';

/** A basin of the galaxies' reconstruction as laniakea.json gives it: Apus's, with its box and estimated mass. */
const APUS: LaniakeaLandmark = {
  name: 'Apus basin',
  otherNames: [],
  kind: 'basin',
  raDeg: 199,
  decDeg: -75,
  x: 0,
  y: 0,
  z: 0,
  distancePc: 180e6,
  distanceMethod: 'CF4 velocity field (Dupuy & Courtois 2023)',
  distanceEstimated: true,
  radiusPc: 140e6,
  extentPc: [300e6, 250e6, 210e6],
  sizeNote: null,
  massSun: 2.6e18,
  massNote: 'Estimated: ...',
  members: null,
  group: -1,
  basin: [{ grid: 'galaxiesAttraction', label: 2 }],
  path: null,
  source: 'Dupuy & Courtois 2023, A&A 678, A176, Table A.1: the attractor of the basin.',
  note: null,
};

const textOf = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('a basin\'s panel', () => {
  it('says what it is, its attractor\'s distance, its extent, its mass as estimated, and its source', () => {
    const id = structureBodyId(APUS);
    structureBodies.set(id, APUS);
    const store = {
      body: () => ({ id, name: APUS.name, color: '#d9c38e' }),
      distanceBetween: () => APUS.distancePc * PARSEC_KM,
    } as unknown as EphemerisStore;
    try {
      const text = textOf(renderToStaticMarkup(createElement(StructurePanel, { store, focus: id, jd: 2461000.5, distanceMode: 'center', onClose: () => {} })));
      expect(text).toContain('Basin of attraction');
      expect(text).toContain('Attractor at');
      expect(text).toContain('300 × 250 × 210 Mpc, its box');
      expect(text).toMatch(/Mass .*estimated/);
      expect(text).toContain('Dupuy & Courtois 2023, A&A 678, A176, Table A.1');
      // No catalogue loaded: the mark at its attractor is all that is drawn.
      expect(text).toContain('Its attractor');
    } finally {
      structureBodies.delete(id);
    }
  });

  it('says it is drawn as its outline where the layer has one for it', () => {
    const info = {
      basins: {
        home: { galaxiesAttraction: 1, galaxiesRepulsion: 0, groupsAttraction: 4 },
        basins: [{ name: 'Apus', kind: 'attraction', grid: 'galaxiesAttraction', label: 2, voxels: 1, volumeMpc3: 1, paperVolumeMpcH3: 1, landmark: 'Apus basin' }],
      },
    } as unknown as LaniakeaInfo;
    expect(basinDrawnAs(APUS, { info })).toBe('Its basin’s outline, computed');
    expect(basinDrawnAs({ name: 'Great Attractor' }, { info })).toBe('Its attractor');
    expect(basinDrawnAs(APUS, null)).toBe('Its attractor');
  });
});
