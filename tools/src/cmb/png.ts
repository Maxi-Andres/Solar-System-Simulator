import { crc32, deflateSync } from 'node:zlib';

/**
 * A greyscale, 8-bit PNG (ISO/IEC 15948): the signature, IHDR, one IDAT, IEND. Each row filtered
 * by "Up" (type 2), the difference from the row above, which for a smooth map deflates far
 * smaller than the raw rows.
 */
export function encodeGreyPng(width: number, height: number, pixels: Uint8Array): Buffer {
  if (pixels.length !== width * height) {
    throw new Error('The pixels are not width x height.');
  }
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);
    raw[row] = 2;
    for (let x = 0; x < width; x += 1) {
      const above = y === 0 ? 0 : pixels[(y - 1) * width + x]!;
      raw[row + 1 + x] = (pixels[y * width + x]! - above) & 0xff;
    }
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // not interlaced
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
