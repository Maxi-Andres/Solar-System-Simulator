#!/usr/bin/env node
/**
 * Bakes the fictional worlds' surfaces into images, so the app loads them like textures instead
 * of working them out on the GPU the first time a world is drawn (src/scene/fiction/looks/
 * prebakedSurfaces.ts says what is stored and how it is found).
 *
 * Run it by hand from web/ whenever a look changes -- its test then fails until it is run:
 *
 *   node scripts/bakeFictionSurfaces.mjs [--port 5310] [--chrome <path>] [--only adrian,erid]
 *
 * It serves scripts/bake-fiction/ with Vite (the app's own modules, its data and bake shaders),
 * opens it in headless Chromium -- the one Playwright installs, or --chrome / CHROME_PATH -- and
 * bakes every world there with the app's own bake, then reads back each cube face and writes:
 *
 *   public/textures/fiction/<id>/L<layer>-<face>.webp    colour, or data (lossy, data at higher quality)
 *   public/textures/fiction/<id>/L<layer>-<face>-a.webp  alpha, where used: a relief lossy, a mask
 *                                                        or a sixteen-bit height (10 bits kept) lossless
 *   public/textures/fiction/<id>/L<layer>-preview.png    the six faces at 32 texels, RGBA
 *   public/textures/fiction/manifest.json                each world, by its surface key
 *
 * Deterministic: the same looks on the same GPU give the same files. Not part of the deploy.
 *
 * Why here and not in tools/: it is the app's own code that bakes -- its looks, its data, its
 * shaders, Vite to serve them -- all web/'s; tools/ only lends sharp, the image encoder, which
 * web/ does not otherwise need. The browser is driven over the DevTools protocol with Node's own
 * WebSocket, so nothing new is installed.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const OUT = join(WEB, 'public', 'textures', 'fiction');
const PREVIEW = 32;
/** Lossy colour quality: faithful to the eye on a surface's broad colour; the relief is not in it. */
const COLOUR_QUALITY = 85;
/** Eight-bit alpha with many levels (a relief), lossy at this quality; a mask of few levels, lossless. */
const ALPHA_QUALITY = 75;
/** Data layers (cloud cover, brightness, relief): lossy too, at a higher quality, chroma kept sharp. */
const DATA_QUALITY = 90;
/** Bits kept of a sixteen-bit height: four times eight bits' steps, and the low bits' noise gone. */
const WORD_BITS = 10;

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const port = Number(args.get('port') ?? 5310);
const only = (args.get('only') ?? '').split(',').filter(Boolean);

const sharp = createRequire(join(WEB, '..', 'tools', 'package.json'))('sharp');
const { createServer } = await import(pathToFileURL(createRequire(join(WEB, 'package.json')).resolve('vite')).href);

function chromePath() {
  const given = args.get('chrome') ?? process.env.CHROME_PATH;
  if (given) return given;
  const local = process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '', '.cache');
  for (const candidate of [
    join(local, 'ms-playwright', 'chromium-1200', 'chrome-win64', 'chrome.exe'),
    join(local, 'ms-playwright', 'chromium-1200', 'chrome-linux', 'chrome'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('No Chromium found: pass --chrome <path> or set CHROME_PATH.');
}

/** A minimal DevTools-protocol client: send a method, await its result. */
function devtools(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const waiting = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });
  return {
    opened,
    send(method, params = {}, sessionId) {
      id += 1;
      const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        socket.send(JSON.stringify(message));
      });
    },
    close: () => socket.close(),
  };
}

function halfToFloat(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const exponent = (h >> 10) & 0x1f;
  const fraction = h & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

/** A face read back as floats 0..1, four channels a texel. */
function toFloats(bytes, half) {
  if (!half) return Float32Array.from(bytes, (b) => b / 255);
  const words = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  return Float32Array.from(words, halfToFloat);
}

const clampByte = (v) => Math.min(255, Math.max(0, Math.round(v * 255)));

/** Box-averaged down to PREVIEW texels a side. */
function downsample(floats, size) {
  const step = size / PREVIEW;
  const out = new Float32Array(PREVIEW * PREVIEW * 4);
  for (let y = 0; y < PREVIEW; y += 1) {
    for (let x = 0; x < PREVIEW; x += 1) {
      for (let c = 0; c < 4; c += 1) {
        let sum = 0;
        for (let v = 0; v < step; v += 1) for (let u = 0; u < step; u += 1) sum += floats[(((y * step + v) * size) + x * step + u) * 4 + c];
        out[(y * PREVIEW + x) * 4 + c] = sum / (step * step);
      }
    }
  }
  return out;
}

const vite = await createServer({
  configFile: false,
  root: join(HERE, 'bake-fiction'),
  cacheDir: join(WEB, 'node_modules', '.vite-bake-fiction'),
  logLevel: 'warn',
  server: { port, strictPort: true, host: '127.0.0.1', hmr: false, fs: { allow: [WEB] } },
});
await vite.listen();

const profile = mkdtempSync(join(tmpdir(), 'bake-fiction-'));
const chrome = spawn(
  chromePath(),
  ['--headless=new', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

try {
  const browserUrl = await new Promise((resolve, reject) => {
    let text = '';
    chrome.stderr.on('data', (chunk) => {
      text += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(text);
      if (match) resolve(match[1]);
    });
    chrome.on('exit', () => reject(new Error(`Chromium exited: ${text}`)));
  });
  const browser = devtools(browserUrl);
  await browser.opened;
  const { targetId } = await browser.send('Target.createTarget', { url: `http://127.0.0.1:${port}/` });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await browser.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  for (let i = 0; i < 600 && !(await evaluate('window.ready === true')); i += 1) await new Promise((r) => setTimeout(r, 100));

  const baked = await evaluate(`window.bakeAll(${JSON.stringify(only)})`);
  mkdirSync(OUT, { recursive: true });
  const manifestPath = join(OUT, 'manifest.json');
  const previous = existsSync(manifestPath) ? JSON.parse((await import('node:fs')).readFileSync(manifestPath, 'utf8')) : { worlds: {} };
  const worlds = only.length > 0 ? { ...previous.worlds } : {};
  let total = 0;
  for (const world of baked) {
    const folder = join(OUT, world.id);
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    const size = world.faceSize;
    const layers = [];
    for (let layer = 0; layer < world.layers.length; layer += 1) {
      const { half, data } = world.layers[layer];
      const faces = [];
      for (let face = 0; face < 6; face += 1) {
        const raw = Buffer.from(await evaluate(`window.readFace(${JSON.stringify(world.id)}, ${layer}, ${face})`), 'base64');
        faces.push(toFloats(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), half));
      }
      const alphaUsed = faces.some((floats) => floats.some((v, i) => i % 4 === 3 && Math.abs(v - 1) > 1e-6));
      const alpha = !alphaUsed ? 'none' : half ? 'word' : 'byte';
      // A mask (a few levels, Pandora's water) keeps its edges losslessly; a relief is lossy.
      const levels = new Set();
      if (alpha === 'byte') for (const floats of faces) for (let i = 3; i < floats.length && levels.size < 17; i += 4) levels.add(clampByte(floats[i]));
      const alphaLossless = alpha === 'word' || levels.size <= 16;
      layers.push({ alpha });
      const strip = Buffer.alloc(PREVIEW * 6 * PREVIEW * 4);
      for (let face = 0; face < 6; face += 1) {
        const floats = faces[face];
        const rgb = Buffer.alloc(size * size * 3);
        for (let i = 0; i < size * size; i += 1) for (let c = 0; c < 3; c += 1) rgb[i * 3 + c] = clampByte(floats[i * 4 + c]);
        const colour = await sharp(rgb, { raw: { width: size, height: size, channels: 3 } })
          .webp(data ? { quality: DATA_QUALITY, smartSubsample: true, effort: 6 } : { quality: COLOUR_QUALITY, effort: 6 })
          .toBuffer();
        writeFileSync(join(folder, `L${layer}-${face}.webp`), colour);
        total += colour.length;
        if (alpha !== 'none') {
          const channels = alpha === 'word' ? 3 : 1;
          const a = Buffer.alloc(size * size * channels);
          for (let i = 0; i < size * size; i += 1) {
            const v = Math.min(1, Math.max(0, floats[i * 4 + 3]));
            if (alpha === 'word') {
              const step = 2 ** (16 - WORD_BITS);
              const word = Math.min(65535, Math.round((v * 65535) / step) * step);
              a[i * 3] = word >> 8;
              a[i * 3 + 1] = word & 0xff;
            } else {
              a[i] = clampByte(v);
            }
          }
          const encoded = await sharp(a, { raw: { width: size, height: size, channels } })
            .webp(alphaLossless ? { lossless: true, effort: 6 } : { quality: ALPHA_QUALITY, effort: 6 })
            .toBuffer();
          writeFileSync(join(folder, `L${layer}-${face}-a.webp`), encoded);
          total += encoded.length;
        }
        const small = downsample(floats, size);
        for (let y = 0; y < PREVIEW; y += 1) {
          for (let x = 0; x < PREVIEW; x += 1) {
            for (let c = 0; c < 4; c += 1) {
              strip[(y * PREVIEW * 6 + face * PREVIEW + x) * 4 + c] = clampByte(c === 3 && alpha === 'none' ? 1 : small[(y * PREVIEW + x) * 4 + c]);
            }
          }
        }
      }
      const preview = await sharp(strip, { raw: { width: PREVIEW * 6, height: PREVIEW, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
      writeFileSync(join(folder, `L${layer}-preview.png`), preview);
      total += preview.length;
    }
    worlds[world.id] = { id: world.id, key: world.key, faceSize: size, layers };
    console.log(`${world.id}: ${size} a face, ${layers.length} layer(s), alpha ${layers.map((l) => l.alpha).join('/')}`);
  }
  const sorted = Object.fromEntries(Object.keys(worlds).sort().map((id) => [id, worlds[id]]));
  writeFileSync(manifestPath, `${JSON.stringify({ version: 1, worlds: sorted }, null, 2)}\n`);
  console.log(`written: ${(total / 1e6).toFixed(2)} MB this run`);
  browser.close();
} finally {
  const exited = new Promise((resolve) => chrome.once('exit', resolve));
  chrome.kill();
  await exited;
  await vite.close();
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // A temporary profile left behind is harmless.
  }
}
