import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The halo's stellar streams (Milky Way): each stream's track through space, from the galstreams
 * library (Mateu 2023, MNRAS 520, 5225; https://github.com/cmateu/galstreams, BSD 3-Clause),
 * made once and committed as web/public/streams/tracks.json, with web/public/streams/CREDITS.md.
 *
 * Run with `pnpm -C tools prepare:streams <galstreams>`, `<galstreams>` the package's own folder
 * (the one holding lib/ and tracks/) of a download of the repository -- read as data, nothing in
 * it run.
 *
 * ## What is taken
 *
 * galstreams holds 200-odd tracks of 141 streams, several streams with more than one: its master
 * log (lib/master_log.txt) marks one track per stream "On", the one its author recommends. Only
 * that one is taken, and only where it is an empirical track -- the stream's mean path on the sky
 * fitted to its detected members, not a great circle through its two ends or round its pole
 * (InfoFlags' first digit). Its distance (InfoFlags' second digit, DistanceKind):
 *
 * - 1, **track**: measured along it, from its members;
 * - 0, **mean**: no distance track, but the library places it at its paper's distance -- one mean
 *   for the whole stream (Phoenix's 17.5 kpc, Balbinot et al. 2016), or a line between its two
 *   ends' -- so it is drawn there, how far it runs in depth not measured;
 * - 2, **rough**: a track the library flags to be taken with caution (M68's, from parallaxes).
 *
 * The great circles (galstreams' "ep" and "po" tracks, from a stream's ends or its pole alone)
 * are left out: they are on the sky only as a line drawn through two points.
 *
 * ## What is made
 *
 * Each track resampled to a point every STEP_DEG degrees along the sky (the library samples them
 * far finer than their own precision), split where two of its samples are more than GAP_DEG apart
 * -- Sagittarius's, behind the Galactic disc -- and each point written as its place about the Sun:
 * ICRS equatorial x, y, z in parsecs, rounded to the parsec (the distances are good to a few per
 * cent, hundreds of parsecs at a stream's tens of kiloparsecs). With it: the stream's name, the
 * track's paper, and its width on the sky where galstreams gives one.
 */

export const STEP_DEG = 1.5;
export const GAP_DEG = 4;

const DEG = Math.PI / 180;

export interface MasterEntry {
  readonly imp: string;
  readonly on: boolean;
  readonly trackName: string;
  readonly name: string;
  readonly trackRefs: string;
  readonly refsLatex: string;
  /** Width on the sky, degrees: > 0 the paper's, -1 from the members (the summary's), -9 none. */
  readonly widthPhi2: number;
}

/** galstreams' master log: whitespace-separated, its header commented. */
export function parseMasterLog(text: string): MasterEntry[] {
  const out: MasterEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const f = line.trim().split(/\s+/);
    if (f.length < 9) continue;
    out.push({
      imp: f[0]!,
      on: f[1] === '1',
      trackName: f[2]!,
      name: f[3]!,
      trackRefs: f[4]!,
      refsLatex: f[5]!,
      widthPhi2: Number(f[8]),
    });
  }
  return out;
}

/** An ECSV table's rows, by column name: its header is the first line not commented. */
export function parseEcsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line !== '' && !line.startsWith('#'));
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      row[name] = values[i] ?? '';
    });
    return row;
  });
}

export interface SkyPoint {
  readonly ra: number;
  readonly dec: number;
  /** kpc. */
  readonly distance: number;
}

function unit(ra: number, dec: number): [number, number, number] {
  return [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];
}

/** The angle between two directions on the sky, degrees. */
export function separationDeg(a: SkyPoint, b: SkyPoint): number {
  const u = unit(a.ra, a.dec);
  const v = unit(b.ra, b.dec);
  const cross = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.atan2(cross, dot) / DEG;
}

/**
 * A track resampled: split where it jumps more than `gap` degrees, and each piece kept at a
 * sample every `step` degrees along the sky, its first and last always.
 */
export function resampleTrack(points: readonly SkyPoint[], step = STEP_DEG, gap = GAP_DEG): SkyPoint[][] {
  const pieces: SkyPoint[][] = [];
  let piece: SkyPoint[] = [];
  let along = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    if (i > 0) {
      const d = separationDeg(points[i - 1]!, p);
      if (d > gap) {
        const last = points[i - 1]!;
        if (piece[piece.length - 1] !== last) piece.push(last);
        if (piece.length > 1) pieces.push(piece);
        piece = [p];
        along = 0;
        continue;
      }
      along += d;
    }
    if (piece.length === 0 || along >= step) {
      piece.push(p);
      along = 0;
    }
  }
  const last = points[points.length - 1];
  if (last !== undefined && piece[piece.length - 1] !== last) piece.push(last);
  if (piece.length > 1) pieces.push(piece);
  return pieces;
}

/** A point's place about the Sun: ICRS equatorial x, y, z, pc, rounded. */
export function toParsecs(p: SkyPoint): [number, number, number] {
  const [x, y, z] = unit(p.ra, p.dec);
  const pc = p.distance * 1000;
  return [Math.round(x * pc), Math.round(y * pc), Math.round(z * pc)];
}

const JOURNALS: Readonly<Record<string, string>> = {
  '\\mnras': 'MNRAS',
  '\\apj': 'ApJ',
  '\\apjl': 'ApJL',
  '\\apjs': 'ApJS',
  '\\aj': 'AJ',
  '\\aap': 'A&A',
  '\\nat': 'Nature',
  '\\natas': 'Nat. Astron.',
  '\\pasa': 'PASA',
  'Monthly Notices of the Royal Astronomical Society': 'MNRAS',
  'The Astrophysical Journal': 'ApJ',
  'The Astrophysical Journal Letters': 'ApJL',
  'The Astronomical Journal': 'AJ',
  'Astronomy & Astrophysics': 'A&A',
  'Astronomy and Astrophysics': 'A&A',
  'Nature Astronomy': 'Nat. Astron.',
  'Nature': 'Nature',
};

function field(entry: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*`, 'i').exec(entry);
  if (match === null) return null;
  let i = match.index + match[0].length;
  const open = entry[i];
  if (open === '{') {
    let depth = 0;
    const start = i + 1;
    for (; i < entry.length; i += 1) {
      if (entry[i] === '{') depth += 1;
      else if (entry[i] === '}') {
        depth -= 1;
        if (depth === 0) return entry.slice(start, i);
      }
    }
    return null;
  }
  if (open === '"') {
    const end = entry.indexOf('"', i + 1);
    return end < 0 ? null : entry.slice(i + 1, end);
  }
  const end = entry.slice(i).search(/[,\n]/);
  return entry.slice(i, end < 0 ? undefined : i + end).trim();
}

/** The bibliography's entries, by key. */
export function parseBib(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const starts = [...text.matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)];
  starts.forEach((match, k) => {
    const end = k + 1 < starts.length ? starts[k + 1]!.index : text.length;
    out.set(match[1]!, text.slice(match.index, end));
  });
  return out;
}

function clean(text: string): string {
  return text
    .replace(/\\['"`^~]\{?(\w)\}?/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Papers the library's bibliography lacks or gives wrongly: Ibata et al. 2024 is not in it, and its
 * Ramos2020 is the corrigendum (A&A 640, C5), not the paper (checked at the journals, 2026-11-16).
 */
export const REFERENCE_FIXES: Readonly<Record<string, string>> = {
  Ibata2024: 'Ibata et al. 2024, ApJ 967, 89',
  ibata2024: 'Ibata et al. 2024, ApJ 967, 89',
  Ramos2020: 'Ramos et al. 2020, A&A 638, A104',
  GrillmairCarlin2016: 'Grillmair & Carlin 2016, ASSL 420, 87',
};

/** A paper as "Ibata et al. 2021, ApJ 914, 123", from its bibliography entry; the key itself where it is not there. */
export function formatReference(key: string, bib: Map<string, string>): string {
  const fixed = REFERENCE_FIXES[key];
  if (fixed !== undefined) return fixed;
  const entry = bib.get(key);
  if (entry === undefined) return key.replace(/(\D)(\d{4})/, '$1 $2');
  const authors = (field(entry, 'author') ?? '').split(/\s+and\s+/i).filter((a) => a.trim() !== '');
  const first = authors[0] ?? '';
  // "{Ibata}, R." or "Rodrigo Ibata".
  const surname = clean(first.includes(',') ? first.split(',')[0]! : (first.trim().split(/\s+/).pop() ?? ''));
  const who = authors.length > 2 ? `${surname} et al.` : authors.length === 2 ? `${surname} & ${clean(authors[1]!.includes(',') ? authors[1]!.split(',')[0]! : (authors[1]!.trim().split(/\s+/).pop() ?? ''))}` : surname;
  const year = clean(field(entry, 'year') ?? '');
  const journalRaw = (field(entry, 'journal') ?? '').trim();
  const preprint = /arxiv/i.test(journalRaw);
  const journal = preprint ? '' : (JOURNALS[journalRaw] ?? JOURNALS[clean(journalRaw)] ?? clean(journalRaw));
  const volume = clean(field(entry, 'volume') ?? '');
  const pages = clean(field(entry, 'pages') ?? field(entry, 'eid') ?? '').split(/[-–]/)[0] ?? '';
  const where = [journal, volume, pages].filter((part) => part !== '');
  const eprint = clean(field(entry, 'eprint') ?? '').replace(/^arXiv:/i, '');
  return `${who} ${year}${where.length > 1 ? `, ${journal} ${[volume, pages].filter((p) => p !== '').join(', ')}` : eprint !== '' ? `, arXiv ${eprint}` : ''}`;
}

/** Names as the app shows them, where galstreams' short form is not one. */
export const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  Sagittarius: 'Sagittarius Stream',
  'Orphan-Chenab': 'Orphan–Chenab',
  Pal5: 'Palomar 5',
  Pal15: 'Palomar 15',
  Pal13: 'Palomar 13',
  'AAU-AliqaUma': 'Aliqa Uma',
  'AAU-ATLAS': 'ATLAS',
  ACS: 'Anticenter Stream',
  Monoceros: 'Monoceros Ring',
  'OmegaCen-Fimbulthul': 'Fimbulthul (ω Cen)',
  'NGC3201-Gjoll': 'Gjöll (NGC 3201)',
  'M68-Fjorm': 'Fjörm (M68)',
  'Tri-Pis': 'Triangulum–Pisces',
  TucanaIII: 'Tucana III',
  'M3-Svol': 'Svöl (M3)',
};

/** How its distance is known: see the header. */
export type DistanceKind = 'track' | 'mean' | 'rough';

export interface StreamTrack {
  readonly name: string;
  readonly distance: DistanceKind;
  /** galstreams' name and its track's. */
  readonly galstreams: string;
  readonly track: string;
  readonly reference: string;
  /** Its width on the sky, degrees; null where galstreams gives none. */
  readonly widthDeg: number | null;
  /** Its pieces, each a flat list of x, y, z, pc, ICRS equatorial about the Sun. */
  readonly pieces: number[][];
}

export interface StreamsFile {
  readonly source: string;
  readonly licence: string;
  readonly stepDeg: number;
  readonly streams: StreamTrack[];
}

/** Every recommended empirical track with a distance, read from galstreams' folder. */
export function buildStreams(root: string): StreamsFile {
  const master = parseMasterLog(readFileSync(join(root, 'lib', 'master_log.txt'), 'utf8'));
  const bib = parseBib(readFileSync(join(root, 'tracks', 'docs', 'gsrefs.bib'), 'utf8'));
  const streams: StreamTrack[] = [];
  for (const entry of master) {
    if (!entry.on) continue;
    const base = join(root, 'tracks', `track.${entry.imp}.${entry.name}.${entry.trackRefs}`);
    if (!existsSync(`${base}.ecsv`) || !existsSync(`${base}.summary.ecsv`)) continue;
    const summary = parseEcsv(readFileSync(`${base}.summary.ecsv`, 'utf8'))[0];
    const flags = summary?.InfoFlags ?? '0000';
    if (flags[0] !== '1') continue;
    const distance: DistanceKind = flags[1] === '1' ? 'track' : flags[1] === '2' ? 'rough' : 'mean';
    const rows = parseEcsv(readFileSync(`${base}.ecsv`, 'utf8'));
    const points = rows
      .map((row) => ({ ra: Number(row.ra), dec: Number(row.dec), distance: Number(row.distance) }))
      .filter((p) => Number.isFinite(p.ra) && Number.isFinite(p.dec) && Number.isFinite(p.distance) && p.distance > 0.5);
    const pieces = resampleTrack(points).map((piece) => piece.flatMap(toParsecs));
    if (pieces.length === 0) continue;
    const summaryWidth = Number(summary?.width_phi2);
    const width = entry.widthPhi2 > 0 ? entry.widthPhi2 : entry.widthPhi2 === -1 && summaryWidth > 0 ? summaryWidth : null;
    const refKeys = entry.refsLatex.split(',').filter((key) => key !== '' && key !== '-');
    streams.push({
      name: DISPLAY_NAMES[entry.name] ?? entry.name,
      distance,
      galstreams: entry.name,
      track: entry.trackName,
      reference: refKeys.map((key) => formatReference(key, bib)).join('; '),
      widthDeg: width === null || !(width > 0) ? null : Math.round(width * 100) / 100,
      pieces,
    });
  }
  streams.sort((a, b) => a.name.localeCompare(b.name));
  return {
    source: 'galstreams (Mateu 2023, MNRAS 520, 5225), https://github.com/cmateu/galstreams',
    licence: 'BSD 3-Clause, Copyright (c) 2017, Cecilia Mateu',
    stepDeg: STEP_DEG,
    streams,
  };
}

function main(): void {
  const root = process.argv[2];
  if (root === undefined) {
    console.error('Usage: node src/streams/prepareStreams.ts <galstreams package folder, holding lib/ and tracks/>');
    process.exit(1);
  }
  const out = fileURLToPath(new URL('../../../web/public/streams/', import.meta.url));
  mkdirSync(out, { recursive: true });
  const file = buildStreams(root);
  const json = JSON.stringify(file);
  writeFileSync(join(out, 'tracks.json'), json);
  const points = file.streams.reduce((n, s) => n + s.pieces.reduce((m, p) => m + p.length / 3, 0), 0);
  console.log(`${file.streams.length} streams, ${points} points, ${json.length} bytes`);
  for (const s of file.streams) console.log(`  ${s.name.padEnd(28)} ${s.track.padEnd(20)} ${s.distance.padEnd(6)} ${s.widthDeg ?? '-'}  ${s.reference}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
