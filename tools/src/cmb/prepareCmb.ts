import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { CmbMapInfo } from '../types.ts';
import { readHealpixColumns } from './fits.ts';
import { ang2pixNest } from './healpix.ts';
import { encodeGreyPng } from './png.ts';

/**
 * The CMB's sky, from Planck (G4): the map the last-scattering sphere is drawn with
 * (web/src/scene/CosmicMicrowaveBackground.tsx), made once and committed as
 * web/public/cmb/cmb.png with its description, cmb.json. Run with `pnpm -C tools prepare:cmb`.
 *
 * ## The source
 *
 * Planck's 2018 release (PR3), the SMICA component-separated CMB map: COM_CMB_IQU-smica_2048_R3.00
 * _full.fits (Planck Collaboration 2020, A&A 641, A4, "Diffuse component separation"), from the
 * NASA/IPAC Infrared Science Archive's mirror of the Planck Legacy Archive. HEALPix, Nside 2048
 * -- 50 million pixels of 1.7 arcminutes -- NESTED, in Galactic coordinates, in K_CMB: the
 * temperature's difference from the mean, 2.7255 K, the monopole and the dipole of our own
 * motion taken out. Its column I_STOKES_INP is the temperature with the Galactic plane's and
 * the bright sources' worst pixels inpainted -- filled from round them with the CMB's own
 * statistics (column TMASKINP says where) -- so the whole sky has a value; it is the map
 * Planck's own all-sky pictures are made from. 2.0 GB, downloaded into tools/cmb/.cache/.
 *
 * Licence: ESA's space-science archives are CC BY-NC 3.0 IGO; credit "ESA, Planck
 * Collaboration" (https://www.cosmos.esa.int/web/esdc/terms-and-conditions). See
 * web/public/cmb/CREDITS.md.
 *
 * ## What is made
 *
 * An equirectangular map, WIDTH x HEIGHT, Galactic: the picture's middle column is l = 0, the
 * Galactic centre, l growing to the LEFT as on Planck's own maps of the sky seen from inside;
 * its top row is b = +90. Each texel the mean of SUPERSAMPLE^2 directions spread evenly over it,
 * each looked up in the HEALPix map -- at the equator a texel is 10.5 arcminutes and holds some
 * 38 of Planck's pixels, so this is a box filter over them; near the poles, where texels narrow
 * to nothing, the same few. SMICA's own resolution is 5 arcminutes.
 *
 * Stored as one byte per texel: 128 + dT / MICROKELVIN_PER_STEP, rounded, clipped to 0-255 --
 * +-512 uK, past which very few texels lie (the run prints how many). The temperatures' scatter
 * at this resolution is about 100 uK, so a step of 4 is a twenty-fifth of it.
 */

export const WIDTH = 2048;
export const HEIGHT = 1024;
export const SUPERSAMPLE = 4;
export const MICROKELVIN_PER_STEP = 4;
export const ZERO_LEVEL = 128;

export const SOURCE_URL =
  'https://irsa.ipac.caltech.edu/data/Planck/release_3/all-sky-maps/maps/component-maps/cmb/COM_CMB_IQU-smica_2048_R3.00_full.fits';
const FILE = 'COM_CMB_IQU-smica_2048_R3.00_full.fits';

const DEG = Math.PI / 180;

/** The Galactic longitude and latitude, degrees, of a point of the map: u from the left, v from the top, each 0 to 1. */
export function galacticOfMap(u: number, v: number): { l: number; b: number } {
  const l = (((0.5 - u) * 360) % 360 + 360) % 360;
  return { l, b: 90 - v * 180 };
}

/** The map: one value per texel, the mean of the HEALPix values about it (NaNs skipped; NaN if all are). */
export function equirectangular(
  values: Float32Array,
  nside: number,
  width: number,
  height: number,
  supersample: number,
): Float32Array {
  const out = new Float32Array(width * height);
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      let sum = 0;
      let n = 0;
      for (let t = 0; t < supersample; t += 1) {
        for (let s = 0; s < supersample; s += 1) {
          const { l, b } = galacticOfMap((i + (s + 0.5) / supersample) / width, (j + (t + 0.5) / supersample) / height);
          const value = values[ang2pixNest(nside, Math.sin(b * DEG), Math.cos(b * DEG), l * DEG)]!;
          if (!Number.isNaN(value)) {
            sum += value;
            n += 1;
          }
        }
      }
      out[j * width + i] = n === 0 ? NaN : sum / n;
    }
  }
  return out;
}

/** One byte per texel, as the header says; and how many were clipped. */
export function encode(kelvin: Float32Array): { bytes: Uint8Array; clipped: number } {
  const bytes = new Uint8Array(kelvin.length);
  let clipped = 0;
  for (let k = 0; k < kelvin.length; k += 1) {
    const step = Math.round(ZERO_LEVEL + (kelvin[k]! * 1e6) / MICROKELVIN_PER_STEP);
    if (step < 0 || step > 255) clipped += 1;
    bytes[k] = Math.min(255, Math.max(0, Number.isNaN(step) ? ZERO_LEVEL : step));
  }
  return { bytes, clipped };
}

/** The source's size, bytes: what a whole download is. */
export const SOURCE_BYTES = 2_013_312_960;

/**
 * Downloads the source into `path`, resuming where a dropped connection left it: IRSA's server
 * drops a 2 GB transfer now and then, so each try asks for the bytes still missing (an HTTP
 * Range), up to twenty tries.
 */
async function download(path: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.part`;
  console.log(`Downloading ${SOURCE_URL} (2.0 GB)...`);
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const have = existsSync(partial) ? statSync(partial).size : 0;
    if (have === SOURCE_BYTES) break;
    const response = await fetch(SOURCE_URL, { headers: have > 0 ? { Range: `bytes=${have}-` } : {} });
    if (!(response.status === 200 || response.status === 206) || response.body === null) {
      throw new Error(`${SOURCE_URL}: HTTP ${response.status}`);
    }
    // A server that ignores the range sends it all again: start over.
    const append = have > 0 && response.status === 206;
    try {
      await pipeline(
        Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
        createWriteStream(partial, { flags: append ? 'a' : 'w' }),
      );
    } catch (error) {
      console.log(`  dropped at ${statSync(partial).size} bytes (${String(error)}); resuming`);
    }
  }
  if (statSync(partial).size !== SOURCE_BYTES) {
    throw new Error(`Downloaded ${statSync(partial).size} of ${SOURCE_BYTES} bytes.`);
  }
  renameSync(partial, path);
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..', '..', '..');
  const source = join(root, 'tools', 'cmb', '.cache', FILE);
  if (!existsSync(source) || statSync(source).size !== SOURCE_BYTES) {
    await download(source);
  }
  console.log('Reading the map...');
  const map = readHealpixColumns(source, ['I_STOKES_INP', 'TMASK']);
  if (map.coordsys !== 'GALACTIC' || map.ordering !== 'NESTED') {
    throw new Error(`Expected a NESTED Galactic map, found ${map.ordering} ${map.coordsys}.`);
  }
  const temperature = map.columns.get('I_STOKES_INP')!;
  const mask = map.columns.get('TMASK')!;

  // The checks: the map's mean and scatter; and that the orientation is the Galaxy's -- Planck's
  // confidence mask, which takes out the Galactic plane, must be mostly 0 along b = 0 and 1 far
  // from it, read through the same lookup as the map.
  let sum = 0;
  let sumSquares = 0;
  let n = 0;
  for (const v of temperature) {
    if (!Number.isNaN(v)) {
      sum += v;
      sumSquares += v * v;
      n += 1;
    }
  }
  const mean = sum / n;
  const rms = Math.sqrt(sumSquares / n - mean * mean);
  console.log(`${n} pixels, mean ${(mean * 1e6).toFixed(2)} uK, rms ${(rms * 1e6).toFixed(1)} uK`);
  const maskMap = equirectangular(mask, map.nside, 360, 180, 1);
  const bandMean = (from: number, to: number): number => {
    let s = 0;
    let c = 0;
    for (let j = 0; j < 180; j += 1) {
      const b = Math.abs(90 - (j + 0.5));
      if (b < from || b >= to) continue;
      for (let i = 0; i < 360; i += 1) {
        s += maskMap[j * 360 + i]!;
        c += 1;
      }
    }
    return s / c;
  };
  const inPlane = bandMean(0, 3);
  const offPlane = bandMean(30, 90);
  console.log(`confidence mask: ${inPlane.toFixed(3)} within 3 deg of the plane, ${offPlane.toFixed(3)} beyond 30 deg`);
  if (!(inPlane < 0.3 && offPlane > 0.9)) {
    throw new Error('The mask is not where the Galactic plane is: the orientation is wrong.');
  }

  console.log(`Making the ${WIDTH} x ${HEIGHT} map...`);
  const kelvin = equirectangular(temperature, map.nside, WIDTH, HEIGHT, SUPERSAMPLE);
  let texelSum = 0;
  let texelSquares = 0;
  for (const v of kelvin) {
    texelSum += v;
    texelSquares += v * v;
  }
  const texelRms = Math.sqrt(texelSquares / kelvin.length - (texelSum / kelvin.length) ** 2);
  const { bytes, clipped } = encode(kelvin);
  console.log(`texel rms ${(texelRms * 1e6).toFixed(1)} uK; ${clipped} texels clipped (${((clipped / kelvin.length) * 100).toFixed(4)} %)`);

  const outDir = join(root, 'web', 'public', 'cmb');
  mkdirSync(outDir, { recursive: true });
  const png = encodeGreyPng(WIDTH, HEIGHT, bytes);
  writeFileSync(join(outDir, 'cmb.png'), png);
  const info: CmbMapInfo = {
    file: 'cmb.png',
    width: WIDTH,
    height: HEIGHT,
    frame: 'galactic',
    centreLongitudeDeg: 0,
    longitudeIncreases: 'left',
    zeroLevel: ZERO_LEVEL,
    microkelvinPerStep: MICROKELVIN_PER_STEP,
    rmsMicrokelvin: Math.round(texelRms * 1e7) / 10,
    clippedTexels: clipped,
    source: `Planck PR3 SMICA, ${FILE}, column I_STOKES_INP (inpainted), Nside ${map.nside}`,
    sourceUrl: SOURCE_URL,
  };
  writeFileSync(join(outDir, 'cmb.json'), `${JSON.stringify(info, null, 2)}\n`);
  console.log(`Wrote web/public/cmb/cmb.png (${(png.length / 1e6).toFixed(2)} MB) and cmb.json.`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
