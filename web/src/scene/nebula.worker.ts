import { NEBULAE } from '../core/nebulae.ts';
import { nebulaGain, type NebulaWorkerAnswer, type NebulaWorkerRequest } from './nebulaVolume.ts';
import { remnantNoiseData } from './remnantVolume.ts';

/**
 * The nebulae's gas, made ready off the main thread (Nebulae.tsx): the noise it is clumped by,
 * about a second's work -- the supernova remnants' worker makes the same noise, and whichever
 * comes first is kept (remnantVolume.ts provideRemnantNoise) -- and each nebula's brightness
 * scale (nebulaVolume.ts nebulaGain), 60 to 100 ms each, which done between frames held a
 * frame back as long. Answered with the noise transferred, and the gain as a number.
 */
self.onmessage = (event: MessageEvent<NebulaWorkerRequest>) => {
  const request = event.data;
  const post = (answer: NebulaWorkerAnswer, transfer: Transferable[] = []): void => {
    (self as unknown as Worker).postMessage(answer, transfer);
  };
  if (request.kind === 'noise') {
    const noise = remnantNoiseData().slice();
    post({ kind: 'noise', noise }, [noise.buffer]);
    return;
  }
  const nebula = NEBULAE.find((candidate) => candidate.key === request.key);
  // An unknown key still answers, so the page is not left waiting: NaN, which it ignores.
  post({ kind: 'gain', key: request.key, gain: nebula === undefined ? Number.NaN : nebulaGain(nebula) });
};
