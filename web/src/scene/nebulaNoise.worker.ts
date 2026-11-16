import { remnantNoiseData } from './remnantVolume.ts';

/**
 * The noise the nebulae's gas is clumped by (Nebulae.tsx), made off the main thread: about a
 * second's work. The supernova remnants' worker makes the same noise; whichever comes first is
 * kept (remnantVolume.ts provideRemnantNoise). Answered with the array, transferred.
 */
self.onmessage = () => {
  const noise = remnantNoiseData().slice();
  (self as unknown as Worker).postMessage(noise, [noise.buffer]);
};
