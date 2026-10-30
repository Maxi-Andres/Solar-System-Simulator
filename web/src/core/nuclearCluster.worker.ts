import { sampleNuclearCluster } from './nuclearCluster.ts';

/**
 * The nuclear star cluster's sample, off the main thread: half a second of drawing three
 * hundred thousand stars, which in a frame would be a visible hitch (NuclearCluster.tsx).
 * Answered with the arrays, transferred rather than copied.
 */
self.onmessage = () => {
  const sample = sampleNuclearCluster();
  (self as unknown as Worker).postMessage(sample, [
    sample.positions.buffer,
    sample.absoluteV.buffer,
    sample.colorIndex.buffer,
  ]);
};
