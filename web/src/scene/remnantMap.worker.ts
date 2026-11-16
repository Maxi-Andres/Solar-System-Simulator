import { SUPERNOVA_REMNANTS } from '../core/supernovaRemnants.ts';
import { remnantDepthHalf, type RemnantWorkerAnswer, type RemnantWorkerRequest } from './remnantMap.ts';
import { remnantNoiseData } from './remnantVolume.ts';

/**
 * The supernova remnants' gas, made off the main thread (SupernovaRemnants.tsx): the noise
 * every remnant's gas is broken by, about a second's work, and each photographed remnant's
 * depth grid, about half a second each. Several remnants are degrees across on the sky, so
 * their gas is wanted from the very first view -- made in a frame, it held that first frame
 * back by three seconds. Answered with the arrays, transferred rather than copied.
 */
self.onmessage = (event: MessageEvent<RemnantWorkerRequest>) => {
  const request = event.data;
  const post = (answer: RemnantWorkerAnswer, transfer: Transferable[]): void => {
    (self as unknown as Worker).postMessage(answer, transfer);
  };
  if (request.kind === 'noise') {
    // A copy: the worker keeps its own for the depth grids that follow.
    const noise = remnantNoiseData().slice();
    post({ kind: 'noise', noise }, [noise.buffer]);
    return;
  }
  const remnant = SUPERNOVA_REMNANTS.find((candidate) => candidate.key === request.key);
  if (remnant === undefined || remnant.map === null) {
    return;
  }
  void remnantDepthHalf(remnant, remnant.map, request.base).then((depth) => {
    post({ kind: 'depth', key: request.key, depth }, [depth.buffer]);
  });
};
