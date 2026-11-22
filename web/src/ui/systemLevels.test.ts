import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { PLANETARY_SYSTEMS, systemFramingKm } from '../core/planetarySystems.ts';
import { descriptionOf } from '../descriptions/index.ts';
import { ALPHA_CEN_SYSTEM_DESCRIPTION_ID, TAU_CETI_SYSTEM_DESCRIPTION_ID } from '../descriptions/subjects.ts';
import { AU_KM } from '../scene/scale.ts';
import { alphaCenLadder, LADDER_HYSTERESIS, ladderLevel, systemLadder } from '../state/levels.ts';
import { LevelPanel, levelFacts, levelReading } from './LevelFacts.tsx';

const system = (key: string) => PLANETARY_SYSTEMS.find((candidate) => candidate.key === key)!;
const TAU_CETI = system('tau-ceti');
const live = { voyager1Km: null, centreKm: null };

describe('a star system following the zoom', () => {
  it('is Alpha Centauri from its own framing out, a single body near one, the boundary 2.3 AU', () => {
    const ladder = alphaCenLadder();
    const boundaryAu = Math.sqrt(ladder[0]!.km * ladder[1]!.km) / AU_KM;
    expect(boundaryAu).toBeCloseTo(2.34, 2);
    expect(ladderLevel(ladder, null, 120 * AU_KM)).toBe('alpha-centauri');
    expect(ladderLevel(ladder, null, 0.5 * AU_KM)).toBeNull();
    // Held just past the boundary either way, changed well past it.
    expect(ladderLevel(ladder, null, boundaryAu * 1.1 * AU_KM)).toBeNull();
    expect(ladderLevel(ladder, null, boundaryAu * LADDER_HYSTERESIS * 1.01 * AU_KM)).toBe('alpha-centauri');
    expect(ladderLevel(ladder, 'alpha-centauri', (boundaryAu / 1.1) * AU_KM)).toBe('alpha-centauri');
    expect(ladderLevel(ladder, 'alpha-centauri', (boundaryAu / 1.5) * AU_KM)).toBeNull();
  });

  it('is a planetary system from its breadcrumb framing out, its boundary inside its planets’ orbits', () => {
    for (const planetary of PLANETARY_SYSTEMS) {
      const ladder = systemLadder('planetary-system', planetary.hostRadiusSun! * 695_700, systemFramingKm(planetary));
      expect(ladderLevel(ladder, null, systemFramingKm(planetary)), planetary.key).toBe('planetary-system');
      expect(ladderLevel(ladder, null, 8 * planetary.hostRadiusSun! * 695_700), planetary.key).toBeNull();
    }
    const tau = systemLadder('planetary-system', TAU_CETI.hostRadiusSun! * 695_700, systemFramingKm(TAU_CETI));
    expect(Math.sqrt(tau[0]!.km * tau[1]!.km) / AU_KM).toBeCloseTo(0.48, 2);
  });
});

describe('a star system’s panel', () => {
  const store = { distanceBetween: () => 0 } as unknown as EphemerisStore;
  const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('says what Alpha Centauri is, and offers its description', () => {
    expect(levelReading('alpha-centauri')?.id).toBe(ALPHA_CEN_SYSTEM_DESCRIPTION_ID);
    const facts = levelFacts('alpha-centauri', live).map((fact) => `${fact.label}: ${fact.value}`);
    expect(facts.join(' | ')).toContain('A G2V, B K1V, Proxima M5.5Ve');
  });

  it('says what a planetary system holds, and how sure each planet is', () => {
    const value = (label: string): string =>
      levelFacts('planetary-system', { ...live, system: TAU_CETI }).find((fact) => fact.label === label)!.value;
    expect(value('Planets')).toBe('1 candidate, 3 disputed');
    expect(value('Star mass')).toBe('0.783 M☉');
    expect(value('Outermost orbit')).toBe('1.55 AU at its farthest');
    expect(levelFacts('planetary-system', { ...live, system: system('barnards-star') }).find((fact) => fact.label === 'Planets')?.value).toBe(
      '4 confirmed',
    );
  });

  it('offers a planetary system’s description where one is written, and only there', () => {
    expect(levelReading('planetary-system', TAU_CETI)).toEqual({ id: TAU_CETI_SYSTEM_DESCRIPTION_ID, name: 'Tau Ceti system' });
    expect(levelReading('planetary-system', system('epsilon-eridani'))).toBeNull();
    expect(levelReading('planetary-system', null)).toBeNull();
  });

  it('is titled by the system the focus is in, and says nothing it cannot know without one', () => {
    const html = text(
      renderToStaticMarkup(createElement(LevelPanel, { level: 'planetary-system', store, focus: 'sun', jd: 2461000.5, distanceMode: 'center', onClose: () => {} })),
    );
    expect(html).toContain('Planetary system');
    expect(html).not.toContain('Read about');
    expect(levelFacts('planetary-system', live).every((fact) => fact.value === '--')).toBe(true);
  });
});

describe('the Tau Ceti system’s description', () => {
  it('is real astronomy, its planets as the app draws them, and no fiction', () => {
    const page = descriptionOf(TAU_CETI_SYSTEM_DESCRIPTION_ID);
    expect(page?.subject).toEqual({ name: 'Tau Ceti', kind: 'planetary system' });
    const all = [
      ...page!.lead,
      ...(page!.sections ?? []).flatMap((section) => [section.title, ...(section.text ?? []), ...section.points.flatMap((point) => [point.title, point.text])]),
      ...[...page!.drawnHere, ...page!.measured, ...page!.estimated, ...page!.missing, ...page!.misconceptions].flatMap((point) => [point.title, point.text]),
    ].join(' ');
    for (const fact of ['G8', '11.9 light years', 'Feng et al.', 'g, h and f named disputed', 'e a candidate', 'ten times', 'Project Ozma', '1960', '−0.49']) {
      expect(all, fact).toContain(fact);
    }
    // The planets' own numbers, as planetarySystems.ts draws them.
    for (const planet of TAU_CETI.planets) expect(all, planet.id).toContain(planet.massEarth.toFixed(2));
    expect(all).not.toMatch(/fiction|Hail Mary|Astrophage|Adrian|Eridian/i);
  });
});
