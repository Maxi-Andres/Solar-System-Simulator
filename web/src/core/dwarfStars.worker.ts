import { sampleDwarfGalaxy, type DwarfSampleRequest } from './dwarfStars.ts';

/** One dwarf galaxy sampled off the main thread, as a cluster is (DwarfStars.tsx); the arrays transferred, not copied. */
self.onmessage = (event: MessageEvent<DwarfSampleRequest>) => {
  const sample = sampleDwarfGalaxy(event.data);
  (self as unknown as Worker).postMessage(sample, [
    sample.positions.buffer,
    sample.absoluteV.buffer,
    sample.colorIndex.buffer,
  ]);
};
