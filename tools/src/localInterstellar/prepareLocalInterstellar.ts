import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The Sun's surroundings in the interstellar medium, made once and committed as
 * web/public/local-ism/local-ism.json (web/src/core/localInterstellar.ts draws it). Run with
 * `pnpm -C tools prepare:local-ism`; it downloads its three sources itself, into
 * tools/.cache/local-ism/ (or `--cache <dir>`), each from Harvard Dataverse, each CC0.
 *
 * ## The Local Bubble
 *
 * Pelgrims et al. 2020 (A&A 636, A17), "Modeling the magnetized Local Bubble from dust data":
 * the inner surface of the bubble's shell -- along each line of sight the first inflection of
 * the dust extinction's rise, in the 3D extinction map of Lallement et al. 2019 -- and its
 * spherical-harmonic expansions. Released as L19_map-inner_final.fits (doi:10.7910/DVN/RHPVNC):
 * HEALPix, Nside 128, RING, Galactic, the distance from the Sun in pc, one column the raw
 * estimate and the others the expansions to l_max = 2 ... 40. We take l_max = 6, the model the
 * paper maps (its Fig. 4) and builds its magnetic-field fits on (its Tables 2 and 3): the raw
 * surface's finer detail is below what the dust map resolves (its Sect. 3.2).
 *
 * Kept as the distance on a grid of Galactic longitude and latitude, BUBBLE_STEP_DEG apart --
 * each node the HEALPix pixel it falls in, the l_max = 6 surface being smooth on that scale --
 * rounded to the parsec.
 *
 * ## The Radcliffe Wave
 *
 * Konietzka et al. 2024 (Nature 628, 62), "The Radcliffe Wave is oscillating": the best-fit
 * model of the wave (doi:10.7910/DVN/F98QHY) -- heliocentric Galactic x, y, z in pc, and its
 * vertical velocity -- one point in WAVE_STRIDE kept; and the molecular clouds along it, their
 * 12CO positions and spreads (doi:10.7910/DVN/Q7F4PC). The wave was found by Alves et al. 2020
 * (Nature 578, 237); Konietzka et al. refit it with clusters' and clouds' motions.
 */

const DATAVERSE = 'https://dataverse.harvard.edu/api/access/datafile/';

export const SOURCES = {
  bubble: { id: 6477817, file: 'L19_map-inner_final.fits', doi: '10.7910/DVN/RHPVNC' },
  waveModel: { id: 8954305, file: 'Radcliffe_Wave_best_fit_model_Konietzka2024.csv', doi: '10.7910/DVN/F98QHY' },
  waveClouds: { id: 7211929, file: 'Radcliffe_Wave_CO_analysis_Konietzka2024.csv', doi: '10.7910/DVN/Q7F4PC' },
} as const;

/** The bubble's column: the expansion to l_max = 6. */
export const BUBBLE_COLUMN = 'r_in_lmax-06';
export const BUBBLE_STEP_DEG = 3;
/** One of the wave model's points in this many: about 9 pc apart. */
export const WAVE_STRIDE = 8;

// --- FITS -----------------------------------------------------------------------------------

interface Header {
  readonly cards: Map<string, string>;
  /** Where the data after it starts, bytes. */
  readonly end: number;
}

function readHeader(fd: number, start: number): Header {
  const cards = new Map<string, string>();
  const block = Buffer.alloc(2880);
  let at = start;
  for (;;) {
    if (readSync(fd, block, 0, 2880, at) !== 2880) throw new Error('The FITS file ends inside a header.');
    at += 2880;
    for (let c = 0; c < 36; c += 1) {
      const card = block.toString('latin1', c * 80, c * 80 + 80);
      const key = card.slice(0, 8).trim();
      if (key === 'END') return { cards, end: at };
      if (card[8] !== '=') continue;
      let value = card.slice(10);
      const quoted = value.trimStart().startsWith("'");
      value = quoted ? value.trimStart().slice(1).split("'")[0]!.trim() : value.split('/')[0]!.trim();
      cards.set(key, value);
    }
  }
}

/** A column of 8-byte floats from the HEALPix binary table that is the first extension. */
export function readHealpixDoubles(path: string, name: string): { nside: number; ordering: string; values: Float64Array } {
  const fd = openSync(path, 'r');
  try {
    const primary = readHeader(fd, 0);
    const table = readHeader(fd, primary.end);
    const card = (key: string): string => {
      const value = table.cards.get(key);
      if (value === undefined) throw new Error(`No ${key} in the table's header.`);
      return value;
    };
    if (card('XTENSION') !== 'BINTABLE' || card('PIXTYPE') !== 'HEALPIX') throw new Error('Not a HEALPix binary table.');
    const rowBytes = Number(card('NAXIS1'));
    const rows = Number(card('NAXIS2'));
    const nside = Number(card('NSIDE'));
    if (rows !== 12 * nside * nside) throw new Error(`${rows} rows for Nside ${nside}.`);
    const fields = Number(card('TFIELDS'));
    let offset = -1;
    let at = 0;
    for (let k = 1; k <= fields; k += 1) {
      // Written 'double' by its maker, not FITS's 'D': both are one 8-byte float.
      const form = card(`TFORM${k}`).toUpperCase();
      if (form !== 'D' && form !== '1D' && form !== 'DOUBLE') throw new Error(`Column ${k} is ${form}, not one double.`);
      if (card(`TTYPE${k}`) === name) offset = at;
      at += 8;
    }
    if (at !== rowBytes) throw new Error('The columns do not add up to the row.');
    if (offset < 0) throw new Error(`No column ${name}.`);
    const buffer = Buffer.alloc(rows * rowBytes);
    if (readSync(fd, buffer, 0, buffer.length, table.end) !== buffer.length) throw new Error('The FITS file ends inside its table.');
    const values = new Float64Array(rows);
    for (let i = 0; i < rows; i += 1) values[i] = buffer.readDoubleBE(i * rowBytes + offset);
    return { nside, ordering: card('ORDERING'), values };
  } finally {
    closeSync(fd);
  }
}

// --- HEALPix, RING ---------------------------------------------------------------------------

/**
 * The RING pixel holding a direction: z = cos(colatitude), phi the longitude, radians. The
 * reference library's (HEALPix C++, healpix_base.cc, loc2pix, RING branch), written out.
 */
export function ang2pixRing(nside: number, z: number, phi: number): number {
  const twoPi = 2 * Math.PI;
  const za = Math.abs(z);
  let p = phi % twoPi;
  if (p < 0) p += twoPi;
  const tt = p / (Math.PI / 2); // in [0, 4)
  const ncap = 2 * nside * (nside - 1);
  const npix = 12 * nside * nside;
  if (za <= 2 / 3) {
    const temp1 = nside * (0.5 + tt);
    const temp2 = nside * z * 0.75;
    const jp = Math.floor(temp1 - temp2);
    const jm = Math.floor(temp1 + temp2);
    const ir = nside + 1 + jp - jm;
    const kshift = 1 - (ir & 1);
    const t1 = jp + jm - nside + kshift + 1 + 4 * nside * 2;
    const ip = Math.floor(t1 / 2) % (4 * nside);
    return ncap + (ir - 1) * 4 * nside + ip;
  }
  const tp = tt - Math.floor(tt);
  const tmp = nside * Math.sqrt(3 * (1 - za));
  const jp = Math.floor(tp * tmp);
  const jm = Math.floor((1 - tp) * tmp);
  const ir = jp + jm + 1;
  const ip = Math.floor(tt * ir) % (4 * ir);
  return z > 0 ? 2 * ir * (ir - 1) + ip : npix - 2 * ir * (ir + 1) + ip;
}

/** The bubble's grid: rows of latitude from -90 to +90, columns of longitude from 0, each BUBBLE_STEP_DEG. */
export function bubbleGrid(values: Float64Array, nside: number, stepDeg = BUBBLE_STEP_DEG): { nLon: number; nLat: number; radiiPc: number[] } {
  const nLon = Math.round(360 / stepDeg);
  const nLat = Math.round(180 / stepDeg) + 1;
  const radiiPc: number[] = [];
  for (let j = 0; j < nLat; j += 1) {
    const b = (-90 + j * stepDeg) * (Math.PI / 180);
    for (let i = 0; i < nLon; i += 1) {
      const l = i * stepDeg * (Math.PI / 180);
      const r = values[ang2pixRing(nside, Math.sin(b), l)]!;
      if (!Number.isFinite(r) || r <= 0) throw new Error(`No distance at l ${i * stepDeg}, b ${-90 + j * stepDeg}.`);
      radiiPc.push(Math.round(r));
    }
  }
  return { nLon, nLat, radiiPc };
}

// --- Tables ----------------------------------------------------------------------------------

/** A comma-separated table with a header row (Dataverse's original format for these). */
export function readTable(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const head = lines[0]!.split(/[,\t]/).map((name) => name.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(/[,\t]/);
    return Object.fromEntries(head.map((name, k) => [name, (cells[k] ?? '').trim()]));
  });
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

export function waveModel(rows: readonly Record<string, string>[], stride = WAVE_STRIDE): number[][] {
  const kept: number[][] = [];
  rows.forEach((row, k) => {
    if (k % stride === 0 || k === rows.length - 1) {
      kept.push([round1(Number(row.x)), round1(Number(row.y)), round1(Number(row.z)), round1(Number(row.vz))]);
    }
  });
  for (const point of kept) if (point.some((v) => !Number.isFinite(v))) throw new Error('A wave point is not a number.');
  return kept;
}

export function waveClouds(rows: readonly Record<string, string>[]): { name: string; xyz: number[]; spread: number[] }[] {
  return rows.map((row) => {
    const xyz = [Number(row.x), Number(row.y), Number(row.z)];
    const spread = [Number(row.xspread), Number(row.yspread), Number(row.zspread)];
    if ([...xyz, ...spread].some((v) => !Number.isFinite(v))) throw new Error(`Cloud ${row.name} is not numbers.`);
    return { name: row.name!.replace(/_/g, ' '), xyz, spread };
  });
}

// --- Main -----------------------------------------------------------------------------------

async function download(cache: string, id: number, file: string): Promise<string> {
  const path = join(cache, file);
  if (existsSync(path)) return path;
  console.log(`Downloading ${file}...`);
  // ?format=original: a tabular file as its depositor uploaded it, not Dataverse's own export.
  const response = await fetch(`${DATAVERSE}${id}?format=original`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const at = process.argv.indexOf('--cache');
  const cache = at > 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1]! : join(root, 'tools', '.cache', 'local-ism');
  mkdirSync(cache, { recursive: true });

  const fits = await download(cache, SOURCES.bubble.id, SOURCES.bubble.file);
  const map = readHealpixDoubles(fits, BUBBLE_COLUMN);
  if (map.ordering !== 'RING') throw new Error(`Expected RING ordering, found ${map.ordering}.`);
  const bubble = bubbleGrid(map.values, map.nside);
  const radii = [...bubble.radiiPc].sort((a, b) => a - b);
  console.log(`Local Bubble: ${radii[0]}-${radii[radii.length - 1]} pc, median ${radii[radii.length >> 1]} pc`);

  const model = waveModel(readTable(readFileSync(await download(cache, SOURCES.waveModel.id, SOURCES.waveModel.file), 'utf8')));
  const clouds = waveClouds(readTable(readFileSync(await download(cache, SOURCES.waveClouds.id, SOURCES.waveClouds.file), 'utf8')));
  console.log(`Radcliffe Wave: ${model.length} model points, ${clouds.length} clouds`);

  const out = {
    bubble: {
      source: `Pelgrims et al. 2020, A&A 636, A17: ${SOURCES.bubble.file}, column ${BUBBLE_COLUMN}, doi:${SOURCES.bubble.doi}`,
      stepDeg: BUBBLE_STEP_DEG,
      nLon: bubble.nLon,
      nLat: bubble.nLat,
      radiiPc: bubble.radiiPc,
    },
    wave: {
      source: `Konietzka et al. 2024, Nature 628, 62: doi:${SOURCES.waveModel.doi} and doi:${SOURCES.waveClouds.doi}`,
      model,
      clouds,
    },
  };
  const outDir = join(root, 'web', 'public', 'local-ism');
  mkdirSync(outDir, { recursive: true });
  const text = `${JSON.stringify(out)}\n`;
  writeFileSync(join(outDir, 'local-ism.json'), text);
  console.log(`Wrote web/public/local-ism/local-ism.json (${(text.length / 1024).toFixed(1)} KB).`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
