/**
 * Reduces PARSEC isochrones from the CMD service to the luminosity table the nuclear star
 * cluster is sampled from (web/src/core/nuclearClusterPopulation.ts). Run by hand, once,
 * on the files CMD returns -- it is printed, reviewed and committed, as a table read off a
 * paper is:
 *
 *     node src/stars/reduceIsochrones.ts iso11.dat:0.72 iso7.dat:0.15 iso3.dat:0.09 iso2.dat:0.02
 *
 * Each argument is a CMD isochrone table and the share of the cluster's mass formed at its
 * age. The query behind each file (https://stev.oapd.inaf.it/cgi-bin/cmd, CMD 3.9): PARSEC
 * v1.2S with COLIBRI S_37 tracks, [M/H] = +0.2, the UBVRIJHK system with YBC bolometric
 * corrections (YBCnewVega), no extinction, the Kroupa (2001) canonical IMF corrected for
 * unresolved binaries, single ages log t = 10.0414, 9.8451, 9.4771 and 9.3010 (11, 7, 3
 * and 2 Gyr).
 *
 * What comes out: for every tenth of a magnitude of M_V from -3 to +18.5, the share of the
 * cluster's living stars in it, split into dwarfs (pre-main sequence and main sequence,
 * PARSEC labels 0 and 1) and evolved stars (labels 2 and up: subgiants, the red giant
 * branch, the clump, the AGB), each with its mean B-V and V-K; and the number of living
 * stars per solar mass of living stars; and the evolved stars binned again by M_K, the
 * same way, for their K luminosity function and the colours of a giant of a given K. Between two tabulated stars of one phase, the
 * stars between them (int_IMF's difference, weighted by the age's share) are spread evenly
 * over the magnitudes between; across a change of phase they are put at the later star.
 */
import { readFileSync } from 'node:fs';

interface Row {
  readonly intImf: number;
  readonly mass: number;
  readonly label: number;
  readonly v: number;
  readonly bv: number;
  readonly vk: number;
}

function load(path: string): Row[] {
  const rows: Row[] = [];
  let columns: string[] | null = null;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('# Zini')) {
      columns = line.slice(1).trim().split(/\s+/);
      continue;
    }
    if (line.startsWith('#') || line.trim() === '' || columns === null) {
      continue;
    }
    const values = line.trim().split(/\s+/).map(Number);
    const get = (name: string): number => values[columns!.indexOf(name)]!;
    rows.push({
      intImf: get('int_IMF'),
      mass: get('Mass'),
      label: get('label'),
      v: get('Vmag'),
      bv: get('Bmag') - get('Vmag'),
      vk: get('Vmag') - get('Kmag'),
    });
  }
  return rows;
}

const MIN_V = -3;
const MAX_V = 18.5;
const STEP = 0.1;
const BINS = Math.round((MAX_V - MIN_V) / STEP);

interface Bin {
  n: number;
  bv: number;
  vk: number;
}

const dwarfs: Bin[] = Array.from({ length: BINS }, () => ({ n: 0, bv: 0, vk: 0 }));
const evolved: Bin[] = Array.from({ length: BINS }, () => ({ n: 0, bv: 0, vk: 0 }));

/** The evolved stars again, by M_K: their K luminosity function, and their colours at each K. */
const MIN_K = -10;
const MAX_K = 4;
const K_BINS = Math.round((MAX_K - MIN_K) / STEP);
const evolvedByK: Bin[] = Array.from({ length: K_BINS }, () => ({ n: 0, bv: 0, vk: 0 }));
let stars = 0;
let mass = 0;

function add(v: number, bv: number, vk: number, n: number, giant: boolean): void {
  const index = Math.min(BINS - 1, Math.max(0, Math.floor((v - MIN_V) / STEP)));
  const bin = (giant ? evolved : dwarfs)[index]!;
  bin.n += n;
  bin.bv += n * bv;
  bin.vk += n * vk;
  if (giant) {
    const k = v - vk;
    const byK = evolvedByK[Math.min(K_BINS - 1, Math.max(0, Math.floor((k - MIN_K) / STEP)))]!;
    byK.n += n;
    byK.bv += n * bv;
    byK.vk += n * vk;
  }
}

for (const argument of process.argv.slice(2)) {
  // The share after the last colon: a Windows path has one of its own.
  const colon = argument.lastIndexOf(':');
  const weight = Number(argument.slice(colon + 1));
  const rows = load(argument.slice(0, colon));
  for (let k = 1; k < rows.length; k += 1) {
    const a = rows[k - 1]!;
    const b = rows[k]!;
    const n = (b.intImf - a.intImf) * weight;
    if (!(n > 0)) {
      continue;
    }
    stars += n;
    mass += n * 0.5 * (a.mass + b.mass);
    const giant = b.label >= 2;
    if (a.label !== b.label) {
      add(b.v, b.bv, b.vk, n, giant);
      continue;
    }
    // Spread over the magnitudes between, a piece per hundredth of a magnitude.
    const pieces = Math.max(1, Math.ceil(Math.abs(b.v - a.v) / 0.01));
    for (let p = 0; p < pieces; p += 1) {
      const f = (p + 0.5) / pieces;
      add(a.v + (b.v - a.v) * f, a.bv + (b.bv - a.bv) * f, a.vk + (b.vk - a.vk) * f, n / pieces, giant);
    }
  }
}

const format = (bins: Bin[], start = MIN_V): string =>
  bins
    .map((bin, index) =>
      bin.n > 0
        ? `  [${(start + index * STEP).toFixed(1)}, ${(bin.n / stars).toExponential(4)}, ${(bin.bv / bin.n).toFixed(3)}, ${(bin.vk / bin.n).toFixed(3)}],`
        : null,
    )
    .filter((line) => line !== null)
    .join('\n');

console.log(`// Living stars per solar mass of living stars: ${(stars / mass).toFixed(4)}`);
console.log('// Dwarfs: [M_V bin start, share of all living stars, mean B-V, mean V-K]');
console.log(format(dwarfs));
console.log('// Evolved');
console.log(format(evolved));
console.log('// Evolved by M_K: [M_K bin start, share of all living stars, mean B-V, mean V-K]');
console.log(format(evolvedByK, MIN_K));
