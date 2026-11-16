import { describe, expect, it } from 'vitest';

import { formatReference, parseBib, parseEcsv, parseMasterLog, resampleTrack, separationDeg, toParsecs } from './prepareStreams.ts';

describe('galstreams, read', () => {
  it('reads the master log: which track is on, its file name parts and its width', () => {
    const log = [
      '# Imp On TrackName Name TrackRefs TrackRefsLatex Notes from-Members width_phi2 width_phi2_Ref',
      '  st  1  GD-1-I21  GD-1  ibata2021  Ibata2021  -  1  -1.0  from-Members',
      '  st  0  GD-1-PB18 GD-1  pricewhelan2018  PriceWhelan2018  -  0  0.2  x',
      '# st 0 Orphan-I24 Orphan from-Members',
    ].join('\n');
    const entries = parseMasterLog(log);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ imp: 'st', on: true, name: 'GD-1', trackRefs: 'ibata2021', refsLatex: 'Ibata2021', widthPhi2: -1 });
    expect(entries[1]!.on).toBe(false);
  });

  it('reads an ECSV table under its commented header', () => {
    const rows = parseEcsv('# %ECSV 1.0\n# ---\nra,dec,distance\n10,20,5.5\n11,21,6\n');
    expect(rows).toEqual([
      { ra: '10', dec: '20', distance: '5.5' },
      { ra: '11', dec: '21', distance: '6' },
    ]);
  });

  it('formats a paper from the bibliography, and fixes the ones it lacks or gives wrongly', () => {
    const bib = parseBib(
      '@ARTICLE{Ibata2021,\n year = 2021,\n volume = {914},\n pages = {123},\n author = {Rodrigo Ibata and Khyati Malhan and Nicolas Martin},\n journal = {The Astrophysical Journal}\n}\n' +
        '@ARTICLE{Koposov2023,\n author = {{Koposov}, Sergey E. and {Erkal}, Denis and others},\n journal = {\\mnras},\n year = 2023,\n volume = {521},\n pages = {4936-4962}\n}\n',
    );
    expect(formatReference('Ibata2021', bib)).toBe('Ibata et al. 2021, ApJ 914, 123');
    expect(formatReference('Koposov2023', bib)).toBe('Koposov et al. 2023, MNRAS 521, 4936');
    expect(formatReference('Ibata2024', bib)).toBe('Ibata et al. 2024, ApJ 967, 89');
    expect(formatReference('Ramos2020', bib)).toBe('Ramos et al. 2020, A&A 638, A104');
  });
});

describe('a track, resampled', () => {
  const along = (n: number, step: number) => Array.from({ length: n }, (_, i) => ({ ra: i * step, dec: 0, distance: 10 }));

  it('keeps a point about every step along the sky, and both ends', () => {
    const [piece, ...rest] = resampleTrack(along(101, 0.1), 1.5, 4);
    expect(rest).toHaveLength(0);
    expect(piece![0]!.ra).toBe(0);
    expect(piece![piece!.length - 1]!.ra).toBeCloseTo(10, 9);
    for (let i = 1; i < piece!.length - 1; i += 1) {
      expect(separationDeg(piece![i - 1]!, piece![i]!)).toBeGreaterThanOrEqual(1.5 - 1e-9);
      expect(separationDeg(piece![i - 1]!, piece![i]!)).toBeLessThan(1.7);
    }
  });

  it('splits where the track jumps', () => {
    const points = [...along(20, 0.5), ...along(20, 0.5).map((p) => ({ ...p, ra: p.ra + 40 }))];
    expect(resampleTrack(points, 1.5, 4)).toHaveLength(2);
  });

  it('places a point about the Sun in equatorial parsecs', () => {
    expect(toParsecs({ ra: 0, dec: 0, distance: 8 })).toEqual([8000, 0, 0]);
    expect(toParsecs({ ra: 90, dec: 0, distance: 1 })).toEqual([0, 1000, 0]);
    expect(toParsecs({ ra: 0, dec: 90, distance: 2 })).toEqual([0, 0, 2000]);
  });
});
