import { basinParts, type BasinRequest } from './laniakeaBasins.ts';

/**
 * A basin of attraction netted and its field blurred off the main thread (laniakeaBasins.ts):
 * 100 to 200 ms a basin, each a long task where it was done between frames. Answered with the
 * arrays transferred, or null where the grid has no such basin.
 */
self.onmessage = (event: MessageEvent<BasinRequest>) => {
  const parts = basinParts(event.data);
  const transfer = parts === null ? [] : [parts.positions.buffer, parts.normals.buffer, parts.indices.buffer, parts.volume.data.buffer];
  (self as unknown as Worker).postMessage(parts, transfer);
};
