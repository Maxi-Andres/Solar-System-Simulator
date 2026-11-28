import { describe, expect, it } from 'vitest';

import {
  FICTION,
  FICTION_ANCHOR_STARS,
  FICTION_COLOR,
  FORTY_ERI_A,
  fictionBodyId,
  fictionOf,
  fictionRecord,
  fictionTag,
  fictionWorldLook,
  idSeed,
  inventedOrbit,
  isFictionBody,
  PENDING_RESEARCH,
  realAnchorOf,
  searchFiction,
  seededRandom,
  FICTION_ENTRIES,
  fictionEntry,
  fictionOfReading,
  fictionReadingId,
  fictionTargetId,
  valuesOfEntry,
  standIn,
  valueNote,
  valueOf,
  type FictionRecord,
  type FictionValue,
} from './fiction.ts';

/** Every number a record carries, by name. */
function valuesOf(record: FictionRecord): [string, FictionValue<unknown>][] {
  return [
    ['radiusKm', record.radiusKm],
    ['massEarth', record.massEarth],
    ['semiMajorAxisKm', record.orbit.semiMajorAxisKm],
    ['eccentricity', record.orbit.eccentricity],
    ['inclinationDeg', record.orbit.inclinationDeg],
    ['nodeDeg', record.orbit.nodeDeg],
    ...(record.orbit.periodDays === undefined ? [] : [['periodDays', record.orbit.periodDays] as [string, FictionValue]]),
    ...record.facts.map((fact): [string, FictionValue<unknown>] => [fact.label, fact.value]),
  ];
}

describe('the fiction records', () => {
  it('are each one thing, with a work, an anchor and a reality check', () => {
    expect(new Set(FICTION.map((record) => record.id)).size).toBe(FICTION.length);
    for (const record of FICTION) {
      expect(record.name.length, record.id).toBeGreaterThan(0);
      expect(record.work.title.length, record.id).toBeGreaterThan(0);
      expect(record.work.creator.length, record.id).toBeGreaterThan(0);
      expect(record.work.year, record.id).toBeGreaterThan(1800);
      expect(record.anchorLine, record.id).toMatch(/real/);
      expect(record.realityCheck.length, record.id).toBeGreaterThan(20);
      // Fan wikis are not canon: a value known only through one is marked unverified.
      for (const [name, value] of valuesOf(record)) {
        if ('source' in value && /fandom|wiki/i.test(value.source.full)) {
          expect(value.source.unverified, `${record.id} ${name}`).toBe(true);
          expect(valueNote(value).kind, `${record.id} ${name}`).toBe('unverified');
        }
      }
      expect(fictionRecord(record.id)).toBe(record);
    }
  });

  it('say where every number is from: the canon with a source, an invention with why, or silence', () => {
    for (const record of FICTION) {
      for (const [name, value] of valuesOf(record)) {
        if ('silent' in value) continue;
        if ('source' in value) {
          expect(value.source.short.length, `${record.id} ${name}`).toBeGreaterThan(3);
          expect(value.source.full.length, `${record.id} ${name}`).toBeGreaterThan(value.source.short.length);
        } else {
          expect(value.invented, `${record.id} ${name}`).toBe(true);
          expect(value.why.length, `${record.id} ${name}`).toBeGreaterThan(5);
        }
      }
    }
  });

  it('give every world a size and an orbit to draw, finite and positive', () => {
    for (const record of FICTION) {
      expect(valueOf(record.radiusKm)!, record.id).toBeGreaterThan(0);
      expect(valueOf(record.massEarth)!, record.id).toBeGreaterThan(0);
      expect(valueOf(record.orbit.semiMajorAxisKm)!, record.id).toBeGreaterThan(valueOf(record.radiusKm)!);
      const e = valueOf(record.orbit.eccentricity)!;
      expect(e >= 0 && e < 1, record.id).toBe(true);
    }
  });

  it('hang every chain of anchors from a real thing in the end', () => {
    for (const record of FICTION) {
      expect(realAnchorOf(record), record.id).not.toBeNull();
      if (record.anchor.kind === 'fiction') {
        expect(fictionRecord(record.anchor.id), record.id).not.toBeNull();
      }
    }
  });

  it('put Pandora about Polyphemus, about the real Alpha Centauri A, both from Avatar', () => {
    const pandora = fictionRecord('pandora')!;
    const polyphemus = fictionRecord('polyphemus')!;
    expect(pandora.kind).toBe('moon');
    expect(pandora.anchor).toEqual({ kind: 'fiction', id: 'polyphemus' });
    expect(polyphemus.kind).toBe('planet');
    expect(polyphemus.anchor).toEqual({ kind: 'alphaCen', member: 'A' });
    expect(realAnchorOf(pandora)).toEqual({ kind: 'alphaCen', member: 'A' });
    for (const record of [pandora, polyphemus]) {
      expect(record.work).toEqual({ title: 'Avatar', creator: 'James Cameron', year: 2009, medium: 'film' });
      expect(record.look.kind).toBe('world');
    }
  });

  it('carry Avatar’s canon where it has numbers, and say what was invented where it has none', () => {
    const pandora = fictionRecord('pandora')!;
    const polyphemus = fictionRecord('polyphemus')!;
    // The Confidential Report's table: 11,447 km across, 0.72 Earths, 0.8 g as printed.
    expect(valueOf(pandora.radiusKm)).toBe(5723.5);
    expect(valueNote(pandora.radiusKm)).toMatchObject({ kind: 'canon', text: 'Confidential Report, 2009' });
    expect(valueOf(pandora.massEarth)).toBe(0.72);
    const gravity = pandora.facts.find((fact) => fact.label === 'Surface gravity')!;
    expect(valueOf(gravity.value)).toBe(0.8);
    // Its own diameter and mass give 0.89 g, which the note says.
    expect(0.72 / (11_447 / 12_742) ** 2).toBeCloseTo(0.89, 2);
    expect(gravity.note).toMatch(/0.89 g/);
    // Polyphemus from a comparison, read as Neptune's radius, and shown so.
    expect(valueOf(polyphemus.radiusKm)).toBe(24_622);
    expect(valueNote(polyphemus.radiusKm).text).toBe('as Neptune · Pandorapedia');
    expect(valueNote(polyphemus.massEarth).kind).toBe('invented');
    // Polyphemus spans about 10 degrees of Pandora's sky.
    const spanDeg = (2 * Math.atan(valueOf(polyphemus.radiusKm)! / valueOf(pandora.orbit.semiMajorAxisKm)!) * 180) / Math.PI;
    expect(spanDeg).toBeGreaterThan(9.5);
    expect(spanDeg).toBeLessThan(11);
    expect(polyphemus.look.kind === 'world' && polyphemus.look.rings).toBeUndefined();
  });

  it('keep no stand-in for the two Avatar worlds: the research is in', () => {
    const pending = FICTION.flatMap((record) => valuesOf(record)).filter(([, value]) => valueNote(value).kind === 'standIn');
    expect(pending).toEqual([]);
  });

  it('give every entry -- world, overlay, ship, line -- a unique id and a reason or a source for each number', () => {
    expect(new Set(FICTION_ENTRIES.map((entry) => entry.id)).size).toBe(FICTION_ENTRIES.length);
    for (const entry of FICTION_ENTRIES) {
      expect(fictionEntry(entry.id)).toBe(entry);
      for (const value of valuesOfEntry(entry)) {
        if ('silent' in value) continue;
        if ('source' in value) {
          expect(value.source.full.length, entry.id).toBeGreaterThan(value.source.short.length);
          if (/wiki|as widely quoted/i.test(value.source.full)) expect(value.source.unverified, entry.id).toBe(true);
        } else {
          expect(value.why.length, entry.id).toBeGreaterThan(5);
          expect(value.pending, entry.id).toBeUndefined();
        }
      }
    }
  });

  it('find each entry at its own body, or at the real one it is drawn over or runs to', () => {
    expect(fictionTargetId(fictionEntry('adrian')!)).toBe('tau-ceti-e');
    expect(fictionTargetId(fictionEntry('petrova-sun')!)).toBe('venus');
    expect(fictionTargetId(fictionEntry('hail-mary')!)).toBe(fictionBodyId('hail-mary'));
    expect(fictionTargetId(fictionEntry('pandora')!)).toBe(fictionBodyId('pandora'));
    expect(fictionOfReading(fictionReadingId('petrova-sun'))?.id).toBe('petrova-sun');
    expect(fictionOfReading('alpha-centauri-a')).toBeNull();
  });
});

describe('Polyphemus’ moons and Trojans', () => {
  const moons = FICTION.filter((record) => record.kind === 'moon' && record.anchor.kind === 'fiction' && record.anchor.id === 'polyphemus');
  const a = (record: FictionRecord) => valueOf(record.orbit.semiMajorAxisKm)!;

  it('are fourteen, nearest first, with Pandora the fifth at 270,000 km', () => {
    expect(moons).toHaveLength(14);
    expect(moons[4]!.id).toBe('pandora');
    expect(a(moons[4]!)).toBe(270_000);
    for (let k = 1; k < moons.length; k += 1) expect(a(moons[k]!)).toBeGreaterThan(a(moons[k - 1]!));
    expect(fictionRecord('pandora')!.aliases).toContain('Polyphemus V');
  });

  it('lie outside the Roche limit and inside half the Hill sphere, every number invented with why', () => {
    // Hill radius at 1.23 AU: a (m / 3M)^(1/3), Polyphemus 17.15 Earths about 1.1055 Suns.
    const hill = 1.23 * 149_597_870.7 * ((17.15 / 332_946) / (3 * 1.1055)) ** (1 / 3);
    expect(hill).toBeGreaterThan(4.5e6);
    expect(hill).toBeLessThan(4.7e6);
    for (const moon of moons) {
      expect(a(moon), moon.id).toBeGreaterThanOrEqual(65_000);
      expect(a(moon), moon.id).toBeLessThanOrEqual(hill / 2);
      if (moon.id === 'pandora') continue;
      for (const value of [moon.radiusKm, moon.massEarth, moon.orbit.semiMajorAxisKm, moon.orbit.eccentricity, moon.orbit.inclinationDeg]) {
        expect(valueNote(value).kind, moon.id).toBe('invented');
      }
      expect(valueOf(moon.radiusKm)!, moon.id).toBeGreaterThanOrEqual(50);
      expect(valueOf(moon.radiusKm)!, moon.id).toBeLessThanOrEqual(3_000);
      expect(valueOf(moon.orbit.eccentricity)!, moon.id).toBeLessThan(0.2);
    }
  });

  it('keep neighbours off the low-order resonances: no period ratio within 1.5% of one', () => {
    const resonances = [
      ...Array.from({ length: 7 }, (_, q) => (q + 2) / (q + 1)),
      ...[1, 3, 5].map((q) => (q + 2) / q),
      3,
      4,
    ];
    for (let k = 1; k < moons.length; k += 1) {
      const ratio = (a(moons[k]!) / a(moons[k - 1]!)) ** 1.5;
      for (const r of resonances) {
        expect(Math.abs(ratio - r) / r, `${moons[k - 1]!.name} : ${moons[k]!.name}`).toBeGreaterThan(0.015);
      }
    }
  });

  it('go round prograde near the equator inside, tilted outside, the outermost retrograde', () => {
    const plane = valueOf(fictionRecord('pandora')!.orbit.inclinationDeg)!;
    const tilt = (record: FictionRecord) => Math.abs(valueOf(record.orbit.inclinationDeg)! - plane);
    for (const moon of moons.slice(0, 9)) expect(tilt(moon), moon.id).toBeLessThan(3);
    for (const moon of moons.slice(9, 13)) expect(tilt(moon), moon.id).toBeGreaterThan(10);
    const outer = moons[13]!;
    expect(valueOf(outer.orbit.nodeDeg)).toBeCloseTo((valueOf(fictionRecord('pandora')!.orbit.nodeDeg)! + 180) % 360, 6);
  });

  it('name Dante and Hades, and the Trojans, from the game only, unverified; number the rest', () => {
    const name = (record: FictionRecord) => record.facts.find((fact) => fact.label === 'Name')!.value;
    expect(moons[0]!.name).toBe('Dante');
    expect(moons[1]!.name).toBe('Hades');
    for (const record of [moons[0]!, moons[1]!, fictionRecord('poly-l4')!, fictionRecord('poly-l5')!]) {
      expect(valueNote(name(record)).kind, record.id).toBe('unverified');
      expect(valueNote(name(record)).text, record.id).toMatch(/unverified$/);
    }
    expect(moons.slice(2).filter((moon) => moon.id !== 'pandora').map((moon) => moon.name)).toEqual(
      ['III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'].map((numeral) => `Polyphemus ${numeral}`),
    );
    expect(valueNote(name(moons[2]!)).kind).toBe('invented');
  });

  it('put the Trojans at Polyphemus’ L4 and L5, not among the fourteen, on its orbit', () => {
    for (const point of [4, 5] as const) {
      const trojan = fictionRecord(`poly-l${point}`)!;
      expect(trojan.kind).toBe('trojan');
      expect(trojan.anchor).toEqual({ kind: 'lagrange', of: 'polyphemus', point });
      expect(trojan.orbit).toBe(fictionRecord('polyphemus')!.orbit);
      expect(realAnchorOf(trojan)).toEqual({ kind: 'alphaCen', member: 'A' });
    }
    expect(valueOf(fictionRecord('poly-l4')!.radiusKm)!).toBeGreaterThan(valueOf(fictionRecord('poly-l5')!.radiusKm)!);
  });

  it('give each a look of the new palettes, its own seed', () => {
    const others = [...moons.filter((moon) => moon.id !== 'pandora'), fictionRecord('poly-l4')!, fictionRecord('poly-l5')!];
    for (const record of others) {
      expect(record.look.kind === 'world' && ['barren', 'icy'].includes(record.look.palette), record.id).toBe(true);
    }
    const seeds = FICTION.map((record) => (record.look.kind === 'world' ? record.look.seed : -1));
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe('Erid and Vulcan', () => {
  const erid = fictionRecord('erid')!;
  const vulcan = fictionRecord('vulcan')!;

  it('go round the real 40 Eridani A, a catalogue star made a body with its measured mass', () => {
    for (const record of [erid, vulcan]) {
      expect(record.anchor).toEqual({ kind: 'star', designation: FORTY_ERI_A });
      expect(realAnchorOf(record)).toEqual({ kind: 'star', designation: FORTY_ERI_A });
    }
    const star = FICTION_ANCHOR_STARS.find((candidate) => candidate.designation === FORTY_ERI_A)!;
    expect(star.massSun).toBe(0.78);
    expect(star.massReference).toMatch(/Ma et al. 2018/);
    expect(star.companions).toEqual(['40 Eri B', '40 Eri C']);
  });

  it('give Erid Weir’s numbers, from his document, and only its plane invented', () => {
    expect(valueOf(erid.radiusKm)).toBe(12_835);
    expect(valueOf(erid.massEarth)).toBe(8.47);
    expect(valueOf(erid.orbit.semiMajorAxisKm)! / 149_597_870.7).toBeCloseTo(0.224, 9);
    expect(valueOf(erid.orbit.eccentricity)).toBe(0.04);
    expect(valueOf(erid.orbit.periodDays!)).toBe(42.245);
    for (const value of [erid.radiusKm, erid.massEarth, erid.orbit.semiMajorAxisKm, erid.orbit.periodDays!]) {
      expect(valueNote(value).text).toBe('Weir’s Eridian document');
    }
    expect(valueNote(erid.orbit.inclinationDeg).kind).toBe('invented');
    // Its own radius and mass give its 2.09 g.
    expect(8.47 / (12_835 / 6_371) ** 2).toBeCloseTo(2.09, 2);
    // And its distance and period a star of 0.84 Suns, not 40 Eri A's 0.78: drawn from the period.
    expect(0.224 ** 3 / (42.245 / 365.25) ** 2).toBeCloseTo(0.84, 2);
    expect(erid.orbit.drawnFromPeriod).toBe(true);
  });

  it('give Vulcan its star and no moon from the canon, its size and orbit invented, no fanon 1.4 g', () => {
    expect(valueNote(vulcan.facts.find((fact) => fact.label === 'Star')!.value).kind).toBe('canon');
    expect(valueOf(vulcan.facts.find((fact) => fact.label === 'Moons')!.value)).toBe('none');
    for (const value of [vulcan.radiusKm, vulcan.massEarth, vulcan.orbit.semiMajorAxisKm, vulcan.orbit.eccentricity]) {
      expect(valueNote(value).kind).toBe('invented');
    }
    const values = valuesOfEntry(vulcan).flatMap((value) => ('value' in value ? [String(value.value)] : []));
    expect(values.includes('1.4')).toBe(false);
    // In the habitable zone (L = 0.46 Suns: Earth's light at 0.68 AU), well outside Erid.
    const aAu = valueOf(vulcan.orbit.semiMajorAxisKm)! / 149_597_870.7;
    expect(0.46 / aAu ** 2).toBeGreaterThan(1);
    expect(0.46 / aAu ** 2).toBeLessThan(1.3);
    expect(aAu - 0.224).toBeGreaterThan(0.3);
  });
});

describe('fiction among the bodies', () => {
  it('knows its bodies by id, and no real one', () => {
    expect(isFictionBody(fictionBodyId('pandora'))).toBe(true);
    expect(fictionOf(fictionBodyId('polyphemus'))?.name).toBe('Polyphemus');
    // Saturn's moon Pandora is real.
    for (const id of ['pandora', 'saturn', 'sun', 'alpha-cen-a-s1']) {
      expect(isFictionBody(id), id).toBe(false);
      expect(fictionWorldLook(id), id).toBeNull();
    }
    expect(fictionWorldLook(fictionBodyId('pandora'))?.palette).toBe('jungle-moon');
  });

  it('has a colour of its own', () => {
    expect(FICTION_COLOR).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('a value and its note', () => {
  it('says the source, the stand-in, the invention or the silence', () => {
    const source = { short: 'Pandorapedia', full: 'Pandorapedia, “Pandora”' };
    expect(valueNote({ value: 1, source })).toEqual({ text: 'Pandorapedia', kind: 'canon', detail: source.full });
    expect(valueNote({ value: 1, source, basis: 'as Neptune' }).text).toBe('as Neptune · Pandorapedia');
    expect(valueNote(standIn(1)).kind).toBe('standIn');
    expect(valueNote(standIn(1)).detail).toBe(PENDING_RESEARCH);
    expect(valueNote({ value: 1, invented: true, why: 'x' })).toEqual({ text: 'invented · canon silent', kind: 'invented', detail: 'x' });
    expect(valueNote({ silent: true }).text).toBe('canon silent');
    expect(valueOf({ silent: true })).toBeNull();
    expect(valueOf({ value: 3, source })).toBe(3);
  });
});

describe('search', () => {
  it('finds a world by its name, its work or its creator, and all of them by "fiction"', () => {
    expect(searchFiction('pand').map((record) => record.id)).toEqual(['pandora']);
    const avatar = FICTION.filter((record) => record.work.title === 'Avatar').length;
    expect(searchFiction('Avatar').length).toBe(avatar);
    expect(searchFiction('cameron').length).toBe(avatar);
    expect(searchFiction('fiction').length).toBe(FICTION_ENTRIES.length);
    expect(searchFiction('polyphemus')[0]!.id).toBe('polyphemus');
    // Project Hail Mary's: the world over τ Ceti e, the ship, both Petrova lines.
    // Adrian itself before the line that runs to it.
    expect(searchFiction('adrian').map((entry) => entry.id)).toEqual(['adrian', 'petrova-tau-ceti']);
    expect(searchFiction('hail mary')[0]!.id).toBe('hail-mary');
    expect(searchFiction('petrova').map((entry) => entry.id).sort()).toEqual(['petrova-sun', 'petrova-tau-ceti']);
    // Adrian, Erid, the two ships and the two lines.
    expect(searchFiction('weir').length).toBe(6);
    expect(searchFiction('erid').map((entry) => entry.id)).toEqual(['erid']);
    expect(searchFiction('vulcan').map((entry) => entry.id)).toEqual(['vulcan']);
    expect(searchFiction('blip-a').map((entry) => entry.id)).toEqual(['blip-a']);
    expect(searchFiction('star trek').map((entry) => entry.id)).toEqual(['vulcan']);
    // Pandora by its number among the moons, before Polyphemus VI and the rest.
    expect(searchFiction('Polyphemus V')[0]!.id).toBe('pandora');
    expect(searchFiction('dante').map((record) => record.id)).toEqual(['polyphemus-1']);
    expect(searchFiction('poly-l5')[0]!.id).toBe('poly-l5');
    // By its Na'vi name too.
    expect(searchFiction('naranawm').map((record) => record.id)).toEqual(['polyphemus']);
    expect(searchFiction('jupiter')).toEqual([]);
    expect(searchFiction('  ')).toEqual([]);
  });
});

describe('invented positions', () => {
  const record = (position: FictionRecord['position']): FictionRecord => ({ ...fictionRecord('pandora')!, position });

  it('seeds from the id: the same every time, another for another id', () => {
    expect(idSeed('pandora')).toBe(idSeed('pandora'));
    expect(idSeed('pandora')).not.toBe(idSeed('pandorb'));
    // FNV-1a's offset basis for the empty string.
    expect(idSeed('')).toBe(0x811c9dc5);
    const a = seededRandom(42);
    const b = seededRandom(42);
    const drawn = Array.from({ length: 100 }, () => a());
    expect(Array.from({ length: 100 }, () => b())).toEqual(drawn);
    expect(drawn.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('makes an orbit within the bounds asked, fixed by the id', () => {
    const bounds = { minKm: 1e7, maxKm: 1e9, maxEccentricity: 0.3 };
    const orbits = Array.from({ length: 200 }, (_, k) => inventedOrbit(`thing-${k}`, bounds));
    for (const orbit of orbits) {
      expect(orbit.semiMajorAxisKm).toBeGreaterThanOrEqual(1e7);
      expect(orbit.semiMajorAxisKm).toBeLessThanOrEqual(1e9);
      expect(orbit.eccentricity).toBeGreaterThanOrEqual(0);
      expect(orbit.eccentricity).toBeLessThan(0.3);
      expect(orbit.inclinationDeg).toBeGreaterThanOrEqual(0);
      expect(orbit.inclinationDeg).toBeLessThanOrEqual(180);
      expect(orbit.nodeDeg).toBeGreaterThanOrEqual(0);
      expect(orbit.nodeDeg).toBeLessThan(360);
    }
    expect(inventedOrbit('thing-7', bounds)).toEqual(orbits[7]);
    expect(new Set(orbits.map((orbit) => orbit.semiMajorAxisKm)).size).toBe(orbits.length);
    // Spread over the sphere: about as many orbits tilted past 90 degrees as under.
    const retrograde = orbits.filter((orbit) => orbit.inclinationDeg > 90).length;
    expect(retrograde).toBeGreaterThan(70);
    expect(retrograde).toBeLessThan(130);
  });

  it('is said on the tag of a thing placed so, and not on one the canon places', () => {
    expect(fictionTag(record('canon'))).toBe('FICTION');
    expect(fictionTag(record('invented'))).toBe('FICTION · POSITION INVENTED');
    // Only Star Wars', whose galaxy the canon never places: every one of them.
    const invented = FICTION.filter((r) => r.position === 'invented');
    expect(invented.map((r) => r.id).sort()).toEqual(['endor', 'forest-moon-of-endor', 'yavin-4', 'yavin-prime']);
    expect(invented.every((r) => r.work.title === 'Star Wars')).toBe(true);
  });
});
