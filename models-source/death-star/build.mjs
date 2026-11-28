// Builds the web assets of the two Death Stars from the source GLBs (SOURCE.md in each folder):
// the textures re-encoded as WebP at most `size` pixels a side, identical ones kept once, everything else -- geometry,
// materials, node layout -- left exactly as it is. A format change only: the first model's licence
// (CC BY-NC-ND 4.0) allows no other.
//
// usage: node build.mjs <source.glb> <out.glb> [size=2048] [quality=85]
//   node build.mjs death-star-textures-4k.glb ../../web/public/models/fiction/death-star.glb
//   node build.mjs ../death-star-ii/death-star-ii-textures-4k.glb ../../web/public/models/fiction/death-star-ii.glb 2048 70
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { PropertyType } from '@gltf-transform/core';
import { dedup, textureCompress } from '@gltf-transform/functions';
import { createRequire } from 'node:module';
import fs from 'node:fs';

// sharp, the image encoder, is the tools package's (tools/package.json): not installed twice.
const sharp = createRequire(new URL('../../tools/package.json', import.meta.url))('sharp');

const [source, out, size = '2048', quality = '85'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(source);
const before = fs.statSync(source).size;
await doc.transform(
  // The same image stored more than once (the second model's fourteen maps are a few, repeated):
  // kept once. Nothing drawn changes.
  dedup({ propertyTypes: [PropertyType.TEXTURE] }),
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    resize: [Number(size), Number(size)],
    quality: Number(quality),
  }),
);
doc.getRoot().getAsset().generator = 'Solar-System-Simulator build (gltf-transform, sharp): textures to WebP only';
await io.write(out, doc);
console.log(JSON.stringify({ source, out, before, after: fs.statSync(out).size }));
