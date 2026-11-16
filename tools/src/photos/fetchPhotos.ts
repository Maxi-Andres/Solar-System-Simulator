/**
 * Downloads the photo library listed in manifest.json into tools/.cache/photos/ (ignored by
 * git), for the description panels to come. Nothing here ships.
 *
 *   pnpm -C tools fetch:photos [key ...] [--force] [--sheet <file.png>]
 *
 * For each photo, once: its file (the smaller rendition its host offers where the manifest
 * names one) into a new, empty directory of its own under downloads/, then
 *
 *   photos/<key>.jpg      no more than 2000 px on its long side (a PNG with transparency
 *                         stays a PNG)
 *   thumbs/<key>.webp     480 px on its long side
 *
 * and the download is deleted. A photo already done is skipped unless --force. index.json
 * lists what is there, with each picture's credit and licence beside it. --sheet also writes
 * a contact sheet of every thumbnail.
 *
 * One request at a time, a few retries with a growing pause: these are other people's servers.
 */
import { mkdir, readFile, rm, stat, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { checkManifest, type Photo, type PhotoManifest, type PhotoObject } from './manifest.ts';

const CACHE = resolve(import.meta.dirname, '..', '..', '.cache', 'photos');
const MANIFEST = resolve(import.meta.dirname, 'manifest.json');
const LONG_SIDE = 2000;
const THUMB_SIDE = 480;
const MAX_BYTES = 250 * 1024 * 1024;
const TRIES = 4;
const USER_AGENT = 'SolarSystemSimulator-photo-library/1.0 (+https://github.com/; non-commercial educational project)';

// No cache: every file is read once, and a cached one stays open.
sharp.cache(false);

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function download(url: string, dir: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(300_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_BYTES) throw new Error(`${length} bytes, more than the ${MAX_BYTES} allowed`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > MAX_BYTES) throw new Error(`${body.length} bytes, more than the ${MAX_BYTES} allowed`);
      const file = join(dir, 'download');
      await writeFile(file, body);
      return file;
    } catch (error) {
      lastError = error;
      // A 404 will not mend itself.
      if (error instanceof Error && error.message === 'HTTP 404') break;
      if (attempt < TRIES) await sleep(2000 * attempt);
    }
  }
  throw new Error(`could not download ${url}: ${String(lastError)}`);
}

interface Done {
  readonly key: string;
  readonly objects: readonly string[];
  readonly file: string;
  readonly thumb: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly credit: string;
  readonly licence: string;
  readonly colour: string;
}

async function prepare(photo: Photo, rawFile: string): Promise<{ file: string; thumb: string }> {
  // The download is somebody else's bytes: sharp reads it as an image or refuses it. Read into
  // memory, so that no file handle outlives this (Windows will not delete an open file).
  const raw = await readFile(rawFile);
  const input = sharp(raw, { limitInputPixels: 1_000_000_000, failOn: 'error' });
  const meta = await input.metadata();
  if (meta.width === undefined || meta.height === undefined) throw new Error(`${photo.key}: not an image`);
  const keepPng = meta.format === 'png' && meta.hasAlpha === true;
  const file = join(CACHE, 'photos', `${photo.key}.${keepPng ? 'png' : 'jpg'}`);
  const resized = sharp(raw, { limitInputPixels: 1_000_000_000 })
    .rotate()
    .resize({ width: LONG_SIDE, height: LONG_SIDE, fit: 'inside', withoutEnlargement: true });
  await (keepPng ? resized.png({ compressionLevel: 9 }) : resized.flatten({ background: '#000' }).jpeg({ quality: 90, mozjpeg: true })).toFile(file);
  const thumb = join(CACHE, 'thumbs', `${photo.key}.webp`);
  await sharp(await readFile(file))
    .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumb);
  return { file, thumb };
}

function existing(key: string): string | null {
  for (const ext of ['jpg', 'png']) {
    const file = join(CACHE, 'photos', `${key}.${ext}`);
    if (existsSync(file) && existsSync(join(CACHE, 'thumbs', `${key}.webp`))) return file;
  }
  return null;
}

/** A grid of every thumbnail with its key under it, for looking the library over. */
async function contactSheet(done: readonly Done[], out: string): Promise<void> {
  const cell = 200;
  const label = 34;
  const columns = 12;
  const rows = Math.ceil(done.length / columns);
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const layers: OverlayOptions[] = [];
  for (const [i, entry] of done.entries()) {
    const x = (i % columns) * cell;
    const y = Math.floor(i / columns) * (cell + label);
    const image = await sharp(entry.thumb)
      .resize({ width: cell - 8, height: cell - 8, fit: 'inside' })
      .toBuffer({ resolveWithObject: true });
    layers.push({
      input: image.data,
      left: x + Math.round((cell - image.info.width) / 2),
      top: y + Math.round((cell - image.info.height) / 2),
    });
    const name = escape(entry.key.length > 30 ? `${entry.key.slice(0, 29)}…` : entry.key);
    const colour = escape(entry.colour);
    layers.push({
      input: Buffer.from(
        `<svg width="${cell}" height="${label}" xmlns="http://www.w3.org/2000/svg">` +
          `<text x="${cell / 2}" y="13" font-family="sans-serif" font-size="11" fill="#ddd" text-anchor="middle">${name}</text>` +
          `<text x="${cell / 2}" y="27" font-family="sans-serif" font-size="10" fill="#8ab" text-anchor="middle">${colour}</text></svg>`,
      ),
      left: x,
      top: y + cell,
    });
  }
  await sharp({ create: { width: columns * cell, height: Math.max(1, rows) * (cell + label), channels: 3, background: '#111' } })
    .composite(layers)
    .png()
    .toFile(out);
  console.log(`Contact sheet: ${out} (${done.length} pictures)`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const sheetAt = args.indexOf('--sheet');
  const sheet = sheetAt >= 0 ? args[sheetAt + 1] : undefined;
  const wanted = new Set(args.filter((arg, i) => !arg.startsWith('--') && (sheetAt < 0 || i !== sheetAt + 1)));

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as PhotoManifest;
  const problems = checkManifest(manifest);
  if (problems.length > 0) throw new Error(`manifest.json:\n  ${problems.join('\n  ')}`);

  // A photo may serve several objects (one picture of a constellation's craft): fetched once.
  const byKey = new Map<string, { photo: Photo; objects: string[] }>();
  for (const object of manifest.objects as readonly PhotoObject[]) {
    for (const photo of object.photos) {
      const entry = byKey.get(photo.key) ?? { photo, objects: [] };
      entry.objects.push(object.name);
      byKey.set(photo.key, entry);
    }
  }

  for (const dir of ['photos', 'thumbs', 'downloads']) await mkdir(join(CACHE, dir), { recursive: true });

  const done: Done[] = [];
  const failed: string[] = [];
  let fetched = 0;
  for (const [key, { photo, objects }] of byKey) {
    if (wanted.size > 0 && !wanted.has(key)) continue;
    let file = force ? null : existing(key);
    let thumb = join(CACHE, 'thumbs', `${key}.webp`);
    if (file === null) {
      // Each download in a new, empty directory of its own.
      const dir = await mkdtemp(join(CACHE, 'downloads', `${key}-`));
      try {
        const raw = await download(photo.downloadUrl ?? photo.fileUrl, dir);
        ({ file, thumb } = await prepare(photo, raw));
        fetched++;
        console.log(`  ${key}`);
      } catch (error) {
        failed.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`  ${key} FAILED: ${String(error)}`);
        continue;
      } finally {
        await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch((error: unknown) =>
          console.warn(`  could not remove ${dir}: ${String(error)}`),
        );
      }
      await sleep(500);
    }
    const meta = await sharp(await readFile(file)).metadata();
    done.push({
      key,
      objects,
      file,
      thumb,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: (await stat(file)).size,
      credit: photo.credit,
      licence: photo.licence,
      colour: photo.colour,
    });
  }

  await writeFile(
    join(CACHE, 'index.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), photos: done.map((d) => ({ ...d, file: d.file.slice(CACHE.length + 1).replace(/\\/g, '/'), thumb: d.thumb.slice(CACHE.length + 1).replace(/\\/g, '/') })) }, null, 1)}\n`,
  );
  const megabytes = done.reduce((sum, d) => sum + d.bytes, 0) / 1024 / 1024;
  console.log(`${done.length} photos in ${CACHE} (${fetched} fetched now), ${megabytes.toFixed(1)} MB.`);
  if (sheet !== undefined) await contactSheet(done, resolve(sheet));
  if (failed.length > 0) {
    console.error(`${failed.length} failed:\n  ${failed.join('\n  ')}`);
    process.exitCode = 1;
  }
}

await main();
